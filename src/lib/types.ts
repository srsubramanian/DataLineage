import type { Transformation } from './openlineage';

export type LayerId = 'ui' | 'bff' | 'data' | 'gql' | 'sf';

/** One tier of the stack, identified in OpenLineage by its dataset namespace. Ordered UI → Snowflake. */
export interface Layer {
  id: LayerId;
  label: string;
  sys: string;
  /** OpenLineage dataset namespace of this layer's datasets. */
  namespace: string;
  /** Display name for a field; defaults to the field name. */
  nodeName?: (dataset: string, field: string) => string;
  /** Where the field lives, shown under its name; defaults to the dataset name. */
  ctx?: (dataset: string) => string;
}

/** A field of an OpenLineage dataset. */
export interface LineageNode {
  id: string;
  layer: LayerId;
  namespace: string;
  dataset: string;
  field: string;
  name: string;
  type: string;
  ctx: string;
}

/** One `inputFields` entry of a columnLineage facet. Points upstream → downstream. */
export interface Edge {
  from: string;
  to: string;
  transformations: Transformation[];
  /** Set when the input field is missing from its dataset's schema; the text is the reason. */
  broken?: string;
}

/** The graph the page renders, built from OpenLineage events by `fromOpenLineage`. */
export interface LineageData {
  layers: Layer[];
  nodes: LineageNode[];
  edges: Edge[];
  /** nodeId → note from the `datalineage_notes` facet. */
  notes: Record<string, string>;
}
