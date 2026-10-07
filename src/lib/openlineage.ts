/**
 * The subset of the OpenLineage spec this app reads.
 * RunEvent: https://openlineage.io/spec/2-0-2/OpenLineage.json
 * Facets: SchemaDatasetFacet 1-2-0, ColumnLineageDatasetFacet 1-2-0, plus our custom `datalineage_notes`.
 */

export interface RunEvent {
  eventType?: 'START' | 'RUNNING' | 'COMPLETE' | 'ABORT' | 'FAIL' | 'OTHER';
  eventTime: string;
  producer: string;
  schemaURL: string;
  run: { runId: string; facets?: Record<string, unknown> };
  job: { namespace: string; name: string; facets?: Record<string, unknown> };
  inputs?: Dataset[];
  outputs?: Dataset[];
}

export interface Dataset {
  namespace: string;
  name: string;
  facets?: DatasetFacets;
}

interface Facet {
  _producer: string;
  _schemaURL: string;
}

export interface DatasetFacets {
  schema?: SchemaDatasetFacet;
  columnLineage?: ColumnLineageDatasetFacet;
  datalineage_notes?: LineageNotesDatasetFacet;
  [facet: string]: unknown;
}

export interface SchemaField {
  name: string;
  type?: string;
  description?: string;
  fields?: SchemaField[];
}

export interface SchemaDatasetFacet extends Facet {
  fields?: SchemaField[];
}

export type TransformationType = 'DIRECT' | 'INDIRECT';

/** Subtypes named by the spec; producers may send others. */
export type TransformationSubtype =
  | 'IDENTITY'
  | 'TRANSFORMATION'
  | 'AGGREGATION'
  | 'JOIN'
  | 'GROUP_BY'
  | 'FILTER'
  | 'SORT'
  | 'WINDOW'
  | 'CONDITIONAL'
  | (string & {});

export interface Transformation {
  type: TransformationType;
  subtype?: TransformationSubtype;
  description?: string;
  masking?: boolean;
}

export interface InputField {
  namespace: string;
  name: string;
  field: string;
  transformations?: Transformation[];
}

export interface ColumnLineageDatasetFacet extends Facet {
  fields: Record<string, { inputFields: InputField[] }>;
  dataset?: InputField[];
}

export interface LineageNotesDatasetFacet extends Facet {
  fields: Record<string, { note: string }>;
}
