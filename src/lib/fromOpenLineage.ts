import type { Dataset, RunEvent } from './openlineage';
import type { Edge, Layer, LineageData, LineageNode } from './types';

interface DatasetInfo {
  layer: Layer;
  namespace: string;
  name: string;
  /** field → type; null when no schema facet has been seen for the dataset. */
  schema: Map<string, string> | null;
}

export const nodeId = (layer: Layer, dataset: string, field: string) => `${layer.id}:${dataset}#${field}`;

/**
 * Builds the field-level lineage graph from OpenLineage run events.
 *
 * - Every dataset whose namespace belongs to a layer contributes its `schema` fields as nodes.
 * - Every `columnLineage` input field becomes an edge into the output field.
 * - An input field missing from its dataset's known schema is kept as a node and its edge is
 *   marked broken (e.g. a resolver still selecting a renamed Snowflake column).
 * - `datalineage_notes` facets attach human notes to fields.
 *
 * Later events override earlier ones for the same output field.
 */
export function fromOpenLineage(events: RunEvent[], layers: Layer[]): LineageData {
  const layerByNs = new Map(layers.map((l) => [l.namespace, l]));
  const datasets = new Map<string, DatasetInfo>();
  const key = (namespace: string, name: string) => `${namespace}\u0000${name}`;

  const register = (d: Dataset): DatasetInfo | undefined => {
    const layer = layerByNs.get(d.namespace);
    if (!layer) return undefined;
    let info = datasets.get(key(d.namespace, d.name));
    if (!info) {
      info = { layer, namespace: d.namespace, name: d.name, schema: null };
      datasets.set(key(d.namespace, d.name), info);
    }
    const fields = d.facets?.schema?.fields;
    if (fields) {
      info.schema ??= new Map();
      for (const f of fields) info.schema.set(f.name, f.type ?? '');
    }
    return info;
  };

  for (const ev of events) for (const d of [...(ev.inputs ?? []), ...(ev.outputs ?? [])]) register(d);

  const nodes = new Map<string, LineageNode>();
  const makeNode = (info: DatasetInfo, field: string, type: string): LineageNode => {
    const { layer, name } = info;
    const id = nodeId(layer, name, field);
    let n = nodes.get(id);
    if (!n) {
      n = {
        id,
        layer: layer.id,
        namespace: info.namespace,
        dataset: name,
        field,
        name: layer.nodeName ? layer.nodeName(name, field) : field,
        type,
        ctx: layer.ctx ? layer.ctx(name) : name,
      };
      nodes.set(id, n);
    }
    return n;
  };

  for (const info of datasets.values()) for (const [field, type] of info.schema ?? []) makeNode(info, field, type);

  const lineage = new Map<string, Edge[]>(); // output node id → edges into it
  const notes: Record<string, string> = {};

  for (const ev of events) {
    for (const out of ev.outputs ?? []) {
      const outInfo = datasets.get(key(out.namespace, out.name));
      if (!outInfo) continue;

      for (const [field, { note }] of Object.entries(out.facets?.datalineage_notes?.fields ?? {})) {
        notes[makeNode(outInfo, field, outInfo.schema?.get(field) ?? '').id] = note;
      }

      for (const [field, { inputFields }] of Object.entries(out.facets?.columnLineage?.fields ?? {})) {
        const to = makeNode(outInfo, field, outInfo.schema?.get(field) ?? '');
        const edges: Edge[] = [];
        for (const input of inputFields) {
          const inInfo = datasets.get(key(input.namespace, input.name)) ?? register({ namespace: input.namespace, name: input.name });
          if (!inInfo) continue;
          const missing = inInfo.schema !== null && !inInfo.schema.has(input.field);
          const from = makeNode(inInfo, input.field, missing ? 'not in schema' : (inInfo.schema?.get(input.field) ?? ''));
          edges.push({
            from: from.id,
            to: to.id,
            transformations: input.transformations ?? [],
            ...(missing && { broken: `${input.field} is not a field of ${input.name}` }),
          });
        }
        lineage.set(to.id, edges);
      }
    }
  }

  return { layers, nodes: [...nodes.values()], edges: [...lineage.values()].flat(), notes };
}
