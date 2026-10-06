import { useEffect, useMemo, useState } from 'react';
import { DetailPanel } from './components/DetailPanel';
import { Matrix } from './components/Matrix';
import { Segmented, type SegmentOption } from './components/Segmented';
import { TopBar } from './components/TopBar';
import { loadLineage } from './lib/data';
import { LineageGraph, nameMatches, screenOf } from './lib/lineage';
import { DEFAULT_SETTINGS, type DisplaySettings } from './lib/settings';
import type { LineageData } from './lib/types';
import { useUrlState, type Coverage } from './lib/useUrlState';

const BAD = 'oklch(0.55 0.15 25)';

interface AppProps {
  /** Supply data directly (tests, embedding); otherwise it is loaded via `loadLineage`. */
  data?: LineageData;
  settings?: Partial<DisplaySettings>;
}

export function App({ data: initial, settings: overrides }: AppProps) {
  const [data, setData] = useState(initial ?? null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (initial) return;
    const ctrl = new AbortController();
    loadLineage(ctrl.signal).then(setData, (e: Error) => {
      if (!ctrl.signal.aborted) setError(e);
    });
    return () => ctrl.abort();
  }, [initial]);

  if (error) return <div className="page-message">Couldn’t load lineage: {error.message}</div>;
  if (!data) return <div className="page-message">Loading lineage…</div>;
  return <LineageMatrixPage data={data} settings={{ ...DEFAULT_SETTINGS, ...overrides }} />;
}

function LineageMatrixPage({ data, settings }: { data: LineageData; settings: DisplaySettings }) {
  const graph = useMemo(() => new LineageGraph(data), [data]);
  const [state, update] = useUrlState();
  const { q, screen, cov } = state;

  const uis = graph.uiFields;
  const analyses = useMemo(() => new Map(graph.uiFields.map((u) => [u.id, graph.analyze(u.id)])), [graph]);
  const screens = useMemo(() => ['All', ...new Set(graph.uiFields.map(screenOf))], [graph]);

  // Fall back gracefully on stale deep links.
  const row = graph.has(state.row) && graph.indexOf(state.row) === 0 ? state.row : uis[0].id;
  const node = state.node && graph.has(state.node) && graph.indexOf(state.node) > 0 ? state.node : null;

  const impact = useMemo(() => (node ? graph.impactOf(node) : []), [graph, node]);
  const impacted = useMemo(() => new Set(impact.map((u) => u.id)), [impact]);

  const rows = uis.filter((u) => {
    const a = analyses.get(u.id)!;
    return (
      (screen === 'All' || screenOf(u) === screen) &&
      (cov === 'all' || (cov === 'ok') === (a.status === 'ok')) &&
      (!q.trim() || [...a.ids].some((id) => nameMatches(graph.node(id), q)))
    );
  });

  const okCount = [...analyses.values()].filter((a) => a.status === 'ok').length;
  const covPct = Math.round((100 * okCount) / uis.length);
  const isFiltered = q.trim() !== '' || screen !== 'All' || cov !== 'all';

  const covOptions: SegmentOption<Coverage>[] = [
    { value: 'all', label: 'All', count: uis.length, dot: 'transparent' },
    { value: 'ok', label: 'Fully traced', count: okCount, dot: 'var(--color-accent)' },
    { value: 'issues', label: 'Issues', count: uis.length - okCount, dot: BAD },
  ];

  return (
    <div className="page">
      <TopBar q={q} onQuery={(v) => update({ q: v })} attrCount={uis.length} srcCount={graph.sourceColumns.length} />

      <section className="intro">
        <div className="intro-copy">
          <span className="eyebrow">Attribute lineage matrix</span>
          <h1>Every screen field, traced to its Snowflake column</h1>
          <p>
            Each row is one field in the UI. Read left to right through the BFF, Data API and GraphQL layers to the source. Select any cell to see
            what it feeds.
          </p>
        </div>
        <div className="intro-controls">
          {isFiltered && (
            <>
              <span className="intro-showing">
                Showing {rows.length} of {uis.length}
              </span>
              <button type="button" className="btn btn-ghost" onClick={() => update({ q: '', screen: 'All', cov: 'all' })}>
                Clear
              </button>
            </>
          )}
          <span className="control-label">Coverage {covPct}%</span>
          <Segmented label="Coverage" options={covOptions} value={cov} onChange={(v) => update({ cov: v })} />
          <span className="control-label">Screen</span>
          <Segmented label="Screen" options={screens.map((s) => ({ value: s, label: s }))} value={screen} onChange={(v) => update({ screen: v })} />
        </div>
      </section>

      <main className="main">
        <Matrix
          graph={graph}
          rows={rows}
          analyses={analyses}
          q={q}
          selectedRow={row}
          impactNode={node}
          impacted={impacted}
          settings={settings}
          onSelectRow={(id) => update({ row: id, node: null })}
          onSelectNode={(rowId, n) => update({ row: rowId, node: graph.indexOf(n.id) === 0 ? null : n.id })}
        />
        <DetailPanel
          graph={graph}
          field={graph.node(row)}
          analysis={analyses.get(row)!}
          impactNode={node ? graph.node(node) : null}
          impact={impact}
          settings={settings}
          onSelectRow={(id) => update({ row: id })}
          onClearNode={() => update({ node: null })}
        />
      </main>
    </div>
  );
}
