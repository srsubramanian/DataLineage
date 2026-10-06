import { useCallback, useEffect, useState } from 'react';

export type Coverage = 'all' | 'ok' | 'issues';

export interface ViewState {
  q: string;
  /** Selected UI node id. */
  row: string;
  /** Impact node id (non-UI). */
  node: string | null;
  screen: string;
  cov: Coverage;
}

export const DEFAULT_VIEW: ViewState = { q: '', row: 'u2', node: null, screen: 'All', cov: 'all' };

const COVERAGES: Coverage[] = ['all', 'ok', 'issues'];

function read(defaults: ViewState): ViewState {
  const p = new URLSearchParams(window.location.search);
  const cov = p.get('cov') as Coverage | null;
  return {
    q: p.get('q') ?? defaults.q,
    row: p.get('field') ?? defaults.row,
    node: p.get('node') ?? defaults.node,
    screen: p.get('screen') ?? defaults.screen,
    cov: cov && COVERAGES.includes(cov) ? cov : defaults.cov,
  };
}

function write(s: ViewState, defaults: ViewState) {
  const p = new URLSearchParams();
  if (s.row !== defaults.row) p.set('field', s.row);
  if (s.node) p.set('node', s.node);
  if (s.q) p.set('q', s.q);
  if (s.screen !== defaults.screen) p.set('screen', s.screen);
  if (s.cov !== defaults.cov) p.set('cov', s.cov);
  const qs = p.toString();
  const url = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
  window.history.replaceState(null, '', url);
}

/** View state mirrored to the query string for deep links, e.g. `?field=u2&node=s2`. */
export function useUrlState(defaults: ViewState = DEFAULT_VIEW) {
  const [state, setState] = useState(() => read(defaults));
  useEffect(() => write(state, defaults), [state, defaults]);
  const update = useCallback((patch: Partial<ViewState>) => setState((s) => ({ ...s, ...patch })), []);
  return [state, update] as const;
}
