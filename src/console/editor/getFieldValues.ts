import type { Connection } from '../../lib/types';
import type { EsResult } from '../../lib/rpc/messages';
import { esRequest } from '../../lib/rpc/client';
import { getCachedFieldValues, setCachedFieldValues } from '../../lib/storage/fieldValuesCache';

const FIELD_VALUES_SIZE = 20;

export type EsRequester = (
  connection: Connection, method: string, path: string, body?: string,
) => Promise<EsResult>;

export function buildFieldValuesBody(field: string, size: number = FIELD_VALUES_SIZE): string {
  return JSON.stringify({ size: 0, aggs: { vix_values: { terms: { field, size } } } });
}

export function parseFieldValues(body: unknown): string[] {
  const buckets = (body as { aggregations?: { vix_values?: { buckets?: unknown } } } | null)
    ?.aggregations?.vix_values?.buckets;
  if (!Array.isArray(buckets)) return [];
  const out: string[] = [];
  for (const b of buckets) {
    const key = (b as { key?: unknown }).key;
    if (key !== undefined && key !== null) out.push(String(key));
  }
  return out;
}

// Returns the top values of a keyword field for the target index, cached with
// TTL. Never throws: any failure (unreachable, non-aggregatable field, missing
// permission) resolves to [] and is negative-cached so autocomplete never
// hammers the cluster on repeated keystrokes.
export function makeGetFieldValues(
  connection: Connection | undefined,
  request: EsRequester = esRequest,
) {
  return async (index: string | undefined, field: string): Promise<string[]> => {
    if (!connection || !index) return [];
    const cached = await getCachedFieldValues(connection.id, index, field);
    if (cached) return cached;
    const res = await request(connection, 'POST', `/${index}/_search`, buildFieldValuesBody(field));
    const values = res.error || res.status >= 400 ? [] : parseFieldValues(res.body);
    await setCachedFieldValues(connection.id, index, field, values);
    return values;
  };
}
