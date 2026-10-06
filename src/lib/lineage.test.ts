import { describe, expect, it } from 'vitest';
import sample from '../fixtures/lineage.sample.json';
import { LineageGraph, nameMatches, screenOf } from './lineage';
import type { LineageData } from './types';

const g = new LineageGraph(sample as LineageData);

describe('LineageGraph', () => {
  it('counts attributes and source columns', () => {
    expect(g.uiFields).toHaveLength(11);
    expect(g.sourceColumns).toHaveLength(13);
  });

  it('traces Amount through all layers, including the joined currency columns', () => {
    const a = g.analyze('u2');
    expect(a.status).toBe('ok');
    expect(a.deepest).toBe(4);
    expect([...a.ids].filter((id) => g.node(id).layer === 'sf').sort()).toEqual(['s2', 's3', 's3b']);
  });

  it('flags the renamed SETTLE_DT column as broken', () => {
    const a = g.analyze('u12');
    expect(a.status).toBe('broken');
    expect(a.broken.map((e) => `${e.from}>${e.to}`)).toEqual(['s12>g10']);
  });

  it('flags Dispute reason as missing a Snowflake source and ends at GraphQL', () => {
    const a = g.analyze('u11');
    expect(a.status).toBe('missing');
    expect(a.deepest).toBe(3);
    expect(a.endNode).toBe('g9');
    expect(g.gaps[a.endNode!]).toMatch(/Resolver stub/);
  });

  it('computes impact as downstream UI fields', () => {
    expect(g.impactOf('d2').map((u) => u.id).sort()).toEqual(['u10', 'u2']);
    expect(g.impactOf('s2').map((u) => u.id).sort()).toEqual(['u10', 'u2']);
    expect(g.impactOf('s3').map((u) => u.id)).toEqual(['u2']);
  });
});

describe('nameMatches', () => {
  it('treats _ and . as spaces and ignores case', () => {
    expect(nameMatches(g.node('s7'), 'merchant nm')).toBe(true);
    expect(nameMatches(g.node('s7'), 'MERCHANT_NM')).toBe(true);
    expect(nameMatches(g.node('g2v'), 'money value')).toBe(true);
    expect(nameMatches(g.node('u2'), '')).toBe(false);
  });
});

describe('screenOf', () => {
  it('returns the last ctx segment', () => {
    expect(screenOf(g.node('u7'))).toBe('RiskPanel');
  });
});
