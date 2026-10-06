export type LayerId = 'ui' | 'bff' | 'data' | 'gql' | 'sf';

/** Ordered UI → Snowflake. */
export interface Layer {
  id: LayerId;
  label: string;
  sys: string;
}

export interface LineageNode {
  id: string;
  layer: LayerId;
  name: string;
  type: string;
  /** Where it lives: UI `Screen › Component`, BFF endpoint, DTO class, GraphQL type, `SCHEMA.TABLE`. */
  ctx: string;
}

/** Edges point upstream → downstream (from = source side, to = consumer side). */
export interface Edge {
  from: string;
  to: string;
  logic: string;
  /** Present when the mapping exists but is invalid; the text is the reason. */
  broken?: string;
}

/** nodeId → reason the chain ends there. */
export type Gaps = Record<string, string>;

export interface LineageData {
  layers: Layer[];
  nodes: LineageNode[];
  edges: Edge[];
  gaps: Gaps;
}
