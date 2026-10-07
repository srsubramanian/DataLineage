import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import notesSchema from '../../schemas/LineageNotesDatasetFacet.json';
import columnLineageSchema from '../../schemas/openlineage/ColumnLineageDatasetFacet.json';
import runEventSchema from '../../schemas/openlineage/OpenLineage.json';
import schemaFacetSchema from '../../schemas/openlineage/SchemaDatasetFacet.json';
import { sampleEvents } from '../test/fixture';
import { parseEvents } from './data';
import { fromOpenLineage } from './fromOpenLineage';
import { LAYERS } from './layers';
import type { RunEvent } from './openlineage';

const facet = { _producer: 'https://example.com/test', _schemaURL: 'https://example.com/facet.json' };

describe('sample fixture', () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  for (const s of [runEventSchema, columnLineageSchema, schemaFacetSchema, notesSchema]) ajv.addSchema(s);
  const validator = (ref: string) => ajv.getSchema(ref)!;

  it('is valid OpenLineage: RunEvents and their dataset facets', () => {
    const runEvent = validator('https://openlineage.io/spec/2-0-2/OpenLineage.json#/$defs/RunEvent');
    const facets: Record<string, ReturnType<typeof validator>> = {
      schema: validator('https://openlineage.io/spec/facets/1-2-0/SchemaDatasetFacet.json#/$defs/SchemaDatasetFacet'),
      columnLineage: validator('https://openlineage.io/spec/facets/1-2-0/ColumnLineageDatasetFacet.json#/$defs/ColumnLineageDatasetFacet'),
      datalineage_notes: validator(`${notesSchema.$id}#/$defs/LineageNotesDatasetFacet`),
    };
    for (const ev of sampleEvents) {
      expect(runEvent(ev), JSON.stringify(runEvent.errors)).toBe(true);
      for (const d of [...(ev.inputs ?? []), ...(ev.outputs ?? [])]) {
        for (const [name, facet] of Object.entries(d.facets ?? {})) {
          const validate = facets[name];
          expect(validate, `unexpected facet ${name}`).toBeDefined();
          expect(validate(facet), `${d.name} ${name}: ${JSON.stringify(validate.errors)}`).toBe(true);
        }
      }
    }
  });

  it('rejects malformed facets', () => {
    const columnLineage = validator('https://openlineage.io/spec/facets/1-2-0/ColumnLineageDatasetFacet.json#/$defs/ColumnLineageDatasetFacet');
    const bad = { ...facet, fields: { x: { inputFields: [{ namespace: 'n', name: 'd', field: 'f', transformations: [{ subtype: 'IDENTITY' }] }] } } };
    expect(columnLineage({ ...bad, fields: { x: { inputFields: [{ namespace: 'n', name: 'd', field: 'f', transformations: [{ type: 'DIRECT' }] }] } } })).toBe(true);
    expect(columnLineage(bad)).toBe(false);
  });
});

const ev = (outputs: RunEvent['outputs'], inputs: RunEvent['inputs'] = []): RunEvent => ({
  eventTime: '2026-10-06T00:00:00Z',
  producer: 'test',
  schemaURL: 'https://openlineage.io/spec/2-0-2/OpenLineage.json#/$defs/RunEvent',
  run: { runId: '00000000-0000-0000-0000-000000000000' },
  job: { namespace: 'test', name: 'job' },
  inputs,
  outputs,
});
const [ui, , , , sf] = LAYERS;

describe('fromOpenLineage', () => {
  it('ignores datasets outside the configured layers', () => {
    const data = fromOpenLineage([ev([{ namespace: 'postgres://elsewhere', name: 't', facets: { schema: { ...facet, fields: [{ name: 'a' }] } } }])], LAYERS);
    expect(data.nodes).toEqual([]);
  });

  it('only marks a missing input field broken when the input schema is known', () => {
    const lineage = (field: string) => ({
      columnLineage: { ...facet, fields: { [field]: { inputFields: [{ namespace: sf.namespace, name: 'DB.S.T', field: 'COL' }] } } },
    });
    const unknown = fromOpenLineage([ev([{ namespace: ui.namespace, name: 'A.B', facets: lineage('x') }])], LAYERS);
    expect(unknown.edges[0].broken).toBeUndefined();

    const known = fromOpenLineage(
      [ev([{ namespace: ui.namespace, name: 'A.B', facets: lineage('x') }], [{ namespace: sf.namespace, name: 'DB.S.T', facets: { schema: { ...facet, fields: [{ name: 'OTHER' }] } } }])],
      LAYERS,
    );
    expect(known.edges[0].broken).toBe('COL is not a field of DB.S.T');
    expect(known.nodes.find((n) => n.field === 'COL')?.type).toBe('not in schema');
  });

  it('lets a later event replace the lineage of the same output field', () => {
    const out = (col: string) =>
      ev([{ namespace: ui.namespace, name: 'A.B', facets: { columnLineage: { ...facet, fields: { x: { inputFields: [{ namespace: sf.namespace, name: 'DB.S.T', field: col }] } } } } }]);
    const data = fromOpenLineage([out('OLD'), out('NEW')], LAYERS);
    expect(data.edges.map((e) => e.from)).toEqual(['sf:DB.S.T#NEW']);
  });
});

describe('parseEvents', () => {
  it('accepts a JSON array or NDJSON', () => {
    const e = ev([]);
    expect(parseEvents(JSON.stringify([e, e]))).toHaveLength(2);
    expect(parseEvents(`${JSON.stringify(e)}\n\n${JSON.stringify(e)}\n`)).toHaveLength(2);
  });
});
