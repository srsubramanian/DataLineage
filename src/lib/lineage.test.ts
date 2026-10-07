import { describe, expect, it } from 'vitest';
import { ids, sampleData } from '../test/fixture';
import { describeEdge, isIdentity, LineageGraph, nameMatches, screenOf, transformationKinds } from './lineage';

const g = new LineageGraph(sampleData);
const sfFact = (c: string) => ids.sf('CORE.FACT_TRANSACTION', c);

describe('LineageGraph', () => {
  it('counts attributes and source columns', () => {
    expect(g.uiFields).toHaveLength(11);
    // 12 mapped columns + SETTLEMENT_DT (in the schema, unmapped) + SETTLE_DT (referenced, not in the schema)
    expect(g.sourceColumns).toHaveLength(14);
  });

  it('traces Amount through all layers, including the joined currency columns', () => {
    const a = g.analyze(ids.amount);
    expect(a.status).toBe('ok');
    expect(a.deepest).toBe(4);
    expect([...a.ids].filter((id) => g.node(id).layer === 'sf').sort()).toEqual(
      [ids.sf('REF.CURRENCY', 'MINOR_UNITS'), sfFact('CCY_CD'), sfFact('TXN_AMT_MINOR')].sort(),
    );
  });

  it('flags a column missing from the Snowflake schema as a broken mapping', () => {
    const a = g.analyze(ids.settled);
    expect(a.status).toBe('broken');
    expect(a.broken.map((e) => [e.from, e.to])).toEqual([[sfFact('SETTLE_DT'), ids.gqlSettled]]);
    expect(g.notes[ids.gqlSettled]).toMatch(/renamed to SETTLEMENT_DT/);
  });

  it('flags Dispute reason as missing a Snowflake source and ends at GraphQL', () => {
    const a = g.analyze(ids.dispute);
    expect(a.status).toBe('missing');
    expect(a.deepest).toBe(3);
    expect(a.endNode).toBe(ids.gqlDispute);
    expect(g.notes[ids.gqlDispute]).toMatch(/Resolver stub/);
  });

  it('computes impact as downstream UI fields', () => {
    expect(g.impactOf(ids.dataAmount).map((u) => u.id).sort()).toEqual([ids.amount, ids.selectedTotal]);
    expect(g.impactOf(sfFact('CCY_CD')).map((u) => u.id)).toEqual([ids.amount]);
  });
});

describe('edge helpers', () => {
  const edge = (from: string, to: string) => g.edges.find((e) => e.from === from && e.to === to)!;

  it('reads OpenLineage transformation types', () => {
    const id = edge(sfFact('TXN_ID'), 'gql:Transaction#id');
    expect(isIdentity(id)).toBe(true);
    expect(describeEdge(id)).toBe('resolver Transaction.id');

    const join = edge(sfFact('MERCHANT_ID'), 'gql:Merchant#name');
    expect(isIdentity(join)).toBe(false);
    expect(transformationKinds(join)).toBe('INDIRECT · JOIN');
  });

  it('falls back to the kinds when there is no description, and treats unreported as a transform', () => {
    expect(describeEdge({ from: 'a', to: 'b', transformations: [{ type: 'DIRECT', subtype: 'IDENTITY' }] })).toBe('DIRECT · IDENTITY');
    expect(isIdentity({ from: 'a', to: 'b', transformations: [] })).toBe(false);
  });
});

describe('nameMatches', () => {
  it('treats _ and . as spaces and ignores case', () => {
    expect(nameMatches(g.node(ids.sf('CORE.DIM_MERCHANT', 'MERCHANT_NM')), 'merchant nm')).toBe(true);
    expect(nameMatches(g.node('gql:Money#value'), 'money value')).toBe(true);
    expect(nameMatches(g.node(ids.amount), '')).toBe(false);
  });
});

describe('screenOf', () => {
  it('returns the last ctx segment', () => {
    expect(screenOf(g.node('ui:TxnDetail.RiskPanel#Risk'))).toBe('RiskPanel');
  });
});
