import type { LineageData } from './types';

/**
 * Loads the lineage graph. Set `VITE_LINEAGE_URL` to point at the `GET /lineage` endpoint;
 * without it the bundled sample fixture is used.
 */
export async function loadLineage(signal?: AbortSignal): Promise<LineageData> {
  const url = import.meta.env.VITE_LINEAGE_URL as string | undefined;
  if (url) {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
    return (await res.json()) as LineageData;
  }
  const mod = await import('../fixtures/lineage.sample.json');
  return mod.default as LineageData;
}
