import type { Edge, Layer, LayerId, LineageData, LineageNode } from './types';

export type Status = 'ok' | 'broken' | 'missing';

export interface Analysis {
  /** The UI node plus all of its ancestors. */
  ids: Set<string>;
  /** Max layer index present in the chain (0–4). */
  deepest: number;
  /** Edges with both ends in `ids`. */
  edges: Edge[];
  broken: Edge[];
  missing: boolean;
  /** Node at the deepest layer when the chain stops short of Snowflake. */
  endNode: string | null;
  status: Status;
}

export const edgeKey = (e: Edge) => `${e.from}>${e.to}`;
export const isDirect = (e: Edge) => /^Direct/.test(e.logic);

/** Indexed, read-only view of the lineage graph with traversal helpers. */
export class LineageGraph {
  readonly layers: Layer[];
  readonly nodes: LineageNode[];
  readonly edges: Edge[];
  readonly gaps: Record<string, string>;
  private readonly byId: Map<string, LineageNode>;
  private readonly layerIndex: Map<LayerId, number>;
  private readonly upstream = new Map<string, Edge[]>();
  private readonly downstream = new Map<string, Edge[]>();

  constructor(data: LineageData) {
    this.layers = data.layers;
    this.nodes = data.nodes;
    this.edges = data.edges;
    this.gaps = data.gaps;
    this.byId = new Map(data.nodes.map((n) => [n.id, n]));
    this.layerIndex = new Map(data.layers.map((l, i) => [l.id, i]));
    for (const e of data.edges) {
      push(this.upstream, e.to, e);
      push(this.downstream, e.from, e);
    }
  }

  get lastLayerIndex() {
    return this.layers.length - 1;
  }

  node(id: string): LineageNode {
    const n = this.byId.get(id);
    if (!n) throw new Error(`Unknown lineage node: ${id}`);
    return n;
  }

  has(id: string) {
    return this.byId.has(id);
  }

  layerOf(id: string): Layer {
    return this.layers[this.indexOf(id)];
  }

  indexOf(id: string): number {
    return this.layerIndex.get(this.node(id).layer) ?? 0;
  }

  nodesIn(layer: LayerId): LineageNode[] {
    return this.nodes.filter((n) => n.layer === layer);
  }

  get uiFields(): LineageNode[] {
    return this.nodesIn(this.layers[0].id);
  }

  get sourceColumns(): LineageNode[] {
    return this.nodesIn(this.layers[this.lastLayerIndex].id);
  }

  /** All nodes reachable upstream (`up`) or downstream (`down`) of `start`, excluding it. */
  walk(start: string, dir: 'up' | 'down'): Set<string> {
    const index = dir === 'up' ? this.upstream : this.downstream;
    const seen = new Set<string>();
    const queue = [start];
    while (queue.length) {
      const id = queue.shift()!;
      for (const e of index.get(id) ?? []) {
        const next = dir === 'up' ? e.from : e.to;
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return seen;
  }

  analyze(uid: string): Analysis {
    const ids = new Set([uid, ...this.walk(uid, 'up')]);
    const deepest = Math.max(...[...ids].map((id) => this.indexOf(id)));
    const edges = this.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
    const broken = edges.filter((e) => e.broken);
    const missing = deepest < this.lastLayerIndex;
    const endNode = missing ? ([...ids].find((id) => this.indexOf(id) === deepest) ?? null) : null;
    const status: Status = broken.length ? 'broken' : missing ? 'missing' : 'ok';
    return { ids, deepest, edges, broken, missing, endNode, status };
  }

  /** UI fields that descend from `nodeId`. */
  impactOf(nodeId: string): LineageNode[] {
    const down = this.walk(nodeId, 'down');
    return this.uiFields.filter((u) => down.has(u.id));
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

const normalize = (s: string) => s.toLowerCase().replace(/[_.]/g, ' ');

/** Case-insensitive name match where `_` and `.` count as spaces. Empty query matches nothing. */
export function nameMatches(node: LineageNode, query: string): boolean {
  const q = query.trim();
  return q !== '' && normalize(node.name).includes(normalize(q));
}

/** Screen name = last segment of a UI node's `ctx` (`TxnSearch › ResultsGrid` → `ResultsGrid`). */
export function screenOf(node: LineageNode): string {
  const parts = node.ctx.split('›');
  return parts[parts.length - 1].trim();
}
