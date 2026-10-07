import { describeEdge, edgeKey, hasDescription, isIdentity, isMasking, transformationKinds, type Analysis, type LineageGraph } from '../lib/lineage';
import { layerVars } from '../lib/palette';
import type { DisplaySettings } from '../lib/settings';
import type { LineageNode } from '../lib/types';

interface Props {
  graph: LineageGraph;
  field: LineageNode;
  analysis: Analysis;
  impactNode: LineageNode | null;
  impact: LineageNode[];
  settings: DisplaySettings;
  onSelectRow: (rowId: string) => void;
  onClearNode: () => void;
}

export function DetailPanel({ graph, field, analysis: a, impactNode, impact, settings, onSelectRow, onClearNode }: Props) {
  const transforms = a.edges.filter((e) => !isIdentity(e)).length;
  const sources = [...a.ids].filter((id) => graph.indexOf(id) === graph.lastLayerIndex).length;
  const end = a.endNode ? graph.node(a.endNode) : null;

  return (
    <aside className="detail blueprint" aria-label={`Lineage of ${field.name}`}>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />

      <div className="detail-head">
        <span className="eyebrow">{field.ctx}</span>
        <h2 className="detail-title">{field.name}</h2>
        <div className="detail-tags">
          <span className="tag tag-outline">{a.edges.length} hops</span>
          <span className="tag tag-accent">{transforms} transforms</span>
          <span className="tag tag-outline">{sources} source columns</span>
        </div>
      </div>

      {(a.broken.length > 0 || end) && (
        <div className="detail-section detail-issues">
          {a.broken.map((e) => (
            <div key={edgeKey(e)} className="issue-card is-broken">
              <span className="issue-card-title">Broken mapping</span>
              <span className="mono issue-card-where">
                {graph.node(e.to).name}
                {'  ←  '}
                {graph.node(e.from).name}
              </span>
              <span className="issue-card-detail">{e.broken}</span>
              {graph.notes[e.to] && <span className="issue-card-detail">{graph.notes[e.to]}</span>}
            </div>
          ))}
          {end && (
            <div className="issue-card is-missing">
              <span className="issue-card-title">No Snowflake source</span>
              <span className="mono issue-card-where">
                Chain ends at {graph.layerOf(end.id).label} · {end.name}
              </span>
              <span className="issue-card-detail">{graph.notes[end.id] ?? 'No upstream mapping found'}</span>
            </div>
          )}
        </div>
      )}

      {settings.showImpact && impactNode && (
        <div className="detail-section detail-impact">
          <div className="detail-impact-head">
            <span className="detail-impact-label">Impact of {graph.layerOf(impactNode.id).label} field</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClearNode}>
              Clear
            </button>
          </div>
          <span className="mono detail-impact-node">{impactNode.name}</span>
          <span className="detail-impact-count">Feeds {impact.length} UI field(s):</span>
          <div className="detail-impact-list">
            {impact.map((u) => (
              <button key={u.id} type="button" className="btn btn-secondary btn-sm" aria-pressed={u.id === field.id} onClick={() => onSelectRow(u.id)}>
                {u.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <ol className="trail">
        {graph.layers.slice(0, a.deepest + 1).map((l, i) => {
          const nodes = graph.nodes.filter((n) => n.layer === l.id && a.ids.has(n.id));
          const maps = a.edges.filter((e) => graph.node(e.to).layer === l.id);
          return (
            <li key={l.id} className={`trail-step${i === a.deepest ? ' is-last' : ''}`} style={layerVars(l.id, settings.layerColors)}>
              <div className="trail-track" aria-hidden>
                <div className="layer-dot" />
                <div className="trail-rail" />
              </div>
              <div className="trail-body">
                <div className="trail-heading">
                  <span className="mono layer-idx">{String(i + 1).padStart(2, '0')}</span>
                  <span className="trail-label">{l.label}</span>
                </div>
                {nodes.map((n) => (
                  <div key={n.id} className="trail-node">
                    <span className={`trail-node-name${i === 0 ? '' : ' mono'}`}>{n.name}</span>
                    <span className="trail-node-meta">
                      {n.type} · {n.ctx}
                    </span>
                  </div>
                ))}
                {maps.map((e) => (
                  <div key={edgeKey(e)} className="trail-map">
                    <span className="trail-map-label">
                      {graph.node(e.to).name}
                      {'  ←  '}
                      {graph.node(e.from).name}
                    </span>
                    <span className="trail-map-kinds">
                      <span className="mono">{transformationKinds(e)}</span>
                      {isMasking(e) && <span className="trail-map-masked">Masked</span>}
                    </span>
                    {(e.broken || hasDescription(e)) && (
                      <code className={`trail-code mono is-${e.broken ? 'broken' : isIdentity(e) ? 'direct' : 'transform'}`}>
                        {e.broken ? `${describeEdge(e)}  ✕  ${e.broken}` : describeEdge(e)}
                      </code>
                    )}
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
