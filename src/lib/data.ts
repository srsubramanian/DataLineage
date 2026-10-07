import { fromOpenLineage } from './fromOpenLineage';
import { LAYERS } from './layers';
import type { RunEvent } from './openlineage';
import type { LineageData } from './types';

/**
 * Loads OpenLineage run events and builds the lineage graph. Set `VITE_LINEAGE_URL` to an endpoint
 * returning a JSON array of RunEvents (or NDJSON, one event per line); without it the bundled
 * sample events are used.
 */
export async function loadLineage(signal?: AbortSignal): Promise<LineageData> {
  return fromOpenLineage(await loadEvents(signal), LAYERS);
}

async function loadEvents(signal?: AbortSignal): Promise<RunEvent[]> {
  const url = import.meta.env.VITE_LINEAGE_URL as string | undefined;
  if (!url) return (await import('../fixtures/lineage.openlineage.json')).default as RunEvent[];

  const res = await fetch(url, { signal, headers: { Accept: 'application/json, application/x-ndjson' } });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  return parseEvents(await res.text());
}

export function parseEvents(text: string): RunEvent[] {
  const trimmed = text.trim();
  if (trimmed.startsWith('[')) return JSON.parse(trimmed) as RunEvent[];
  return trimmed
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as RunEvent);
}
