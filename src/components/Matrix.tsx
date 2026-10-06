import type { KeyboardEvent } from 'react';
import { edgeKey, isDirect, nameMatches, type Analysis, type LineageGraph } from '../lib/lineage';
import { layerVars } from '../lib/palette';
import type { DisplaySettings } from '../lib/settings';
import type { LineageNode } from '../lib/types';

interface Props {
  graph: LineageGraph;
  rows: LineageNode[];
  analyses: Map<string, Analysis>;
  q: string;
  selectedRow: string;
  impactNode: string | null;
  /** UI ids downstream of the impact node. */
  impacted: Set<string>;
  settings: DisplaySettings;
  onSelectRow: (rowId: string) => void;
  onSelectNode: (rowId: string, node: LineageNode) => void;
}

export function Matrix(props: Props) {
  const { graph, rows, q, settings } = props;
  return (
    <div className="matrix">
      <div className="matrix-head matrix-grid">
        {graph.layers.map((l, i) => [
          <div
            key={l.id}
            className={`matrix-head-cell${settings.layerColors ? ' has-bar' : ''}`}
            style={layerVars(l.id, settings.layerColors)}
          >
            <span className="mono layer-idx">{String(i + 1).padStart(2, '0')}</span>
            <span className="matrix-head-label">{l.label}</span>
            <span className="matrix-head-sys">{l.sys}</span>
          </div>,
          i < graph.lastLayerIndex && <div key={`${l.id}-c`} />,
        ])}
      </div>

      {rows.map((u) => (
        <Row key={u.id} {...props} ui={u} />
      ))}

      {rows.length === 0 && (
        <div className="matrix-empty">{q ? `No lineage matches “${q}”.` : 'No fields match the current filters.'}</div>
      )}

      <Legend />
    </div>
  );
}

function Row({ graph, analyses, q, selectedRow, impactNode, impacted, settings, onSelectRow, onSelectNode, ui }: Props & { ui: LineageNode }) {
  const a = analyses.get(ui.id)!;
  const selected = selectedRow === ui.id;
  const cls = ['matrix-row', 'matrix-grid', selected && 'is-selected', !selected && impacted.has(ui.id) && 'is-impacted']
    .filter(Boolean)
    .join(' ');
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSelectRow(ui.id);
    }
  };

  return (
    <div className={cls} tabIndex={0} aria-current={selected || undefined} aria-label={ui.name} onClick={() => onSelectRow(ui.id)} onKeyDown={onKeyDown}>
      {graph.layers.map((l, i) => {
        const missing = i > a.deepest;
        const nodes = graph.nodes.filter((n) => n.layer === l.id && a.ids.has(n.id));
        return [
          <div key={l.id} className={`cell${missing ? ' is-missing' : ''}`} style={layerVars(l.id, settings.layerColors)}>
            {nodes.map((n) => (
              <button
                key={n.id}
                type="button"
                className={['chip', impactNode === n.id && 'is-node', nameMatches(n, q) && 'is-hit'].filter(Boolean).join(' ')}
                title={`${n.type} · ${n.ctx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(ui.id, n);
                }}
              >
                <span className="chip-line">
                  <span className="layer-dot" aria-hidden />
                  <span className={`chip-name${i === 0 ? '' : ' mono'}`}>{n.name}</span>
                </span>
                {settings.showTypes && <span className="chip-type mono">{n.type}</span>}
              </button>
            ))}
            {missing && <div className="missing-box">{i === a.deepest + 1 ? 'No source mapped' : ''}</div>}
            {i === 0 && a.status !== 'ok' && (
              <span className={`issue-tag is-${a.status}`}>{a.status === 'broken' ? 'Broken mapping' : 'No source'}</span>
            )}
          </div>,
          i < graph.lastLayerIndex && <Connector key={`${l.id}-c`} graph={graph} analysis={a} layerIndex={i} showMark={settings.showConnectors} />,
        ];
      })}
    </div>
  );
}

/** Gutter between layer `layerIndex` and the next one upstream. */
function Connector({ graph, analysis, layerIndex, showMark }: { graph: LineageGraph; analysis: Analysis; layerIndex: number; showMark: boolean }) {
  const layer = graph.layers[layerIndex].id;
  const es = analysis.edges.filter((e) => graph.node(e.to).layer === layer);
  const gap = layerIndex >= analysis.deepest;
  const broken = es.some((e) => e.broken);
  const transformed = es.some((e) => !isDirect(e));
  const kind = gap ? 'gap' : broken ? 'broken' : transformed ? 'transform' : 'direct';
  const title = gap ? 'No upstream mapping' : es.map((e) => (e.broken ? `BROKEN: ${e.broken}` : e.logic)).join('\n');
  const mark = broken ? '!' : transformed ? 'ƒ' : '=';

  return (
    <div className={`connector is-${kind}`} title={title} data-edges={es.map(edgeKey).join(' ')}>
      <div className="connector-line" />
      {showMark && !gap && <div className="connector-mark mono">{mark}</div>}
    </div>
  );
}

function Legend() {
  return (
    <div className="legend">
      <span>
        <span className="legend-mark mono is-transform">ƒ</span>Transformed at this hop
      </span>
      <span>
        <span className="legend-mark mono is-direct">=</span>Passed through unchanged
      </span>
      <span>
        <span className="legend-mark mono is-broken">!</span>Broken mapping
      </span>
      <span>
        <span className="legend-gap" />
        No upstream source
      </span>
    </div>
  );
}
