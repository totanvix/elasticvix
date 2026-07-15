import type { FlatField } from '../../lib/types';

export interface TotalInfo {
  value: number;
  isGte: boolean;
}

export function normalizeTotal(responseBody: unknown): TotalInfo {
  const total = (responseBody as { hits?: { total?: unknown } } | null | undefined)?.hits?.total;
  if (typeof total === 'number') return { value: total, isGte: false }; // ES6
  if (total && typeof total === 'object') {
    const t = total as { value?: unknown; relation?: unknown };
    return { value: typeof t.value === 'number' ? t.value : 0, isGte: t.relation === 'gte' };
  }
  return { value: 0, isGte: false };
}

export function mergeFromSize(queryText: string, from: number, size: number): string | undefined {
  try {
    const parsed: unknown = JSON.parse(queryText.trim() || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    return JSON.stringify({ ...(parsed as Record<string, unknown>), from, size });
  } catch {
    return undefined;
  }
}

export function buildSearchPath(indices: string[]): string {
  return `/${indices.join(',')}/_search`;
}

export function unionFields(lists: FlatField[][]): FlatField[] {
  const seen = new Map<string, FlatField>();
  for (const list of lists) {
    for (const field of list) {
      if (!seen.has(field.path)) seen.set(field.path, field);
    }
  }
  return [...seen.values()];
}

export function esErrorReason(responseBody: unknown): string | undefined {
  const err = (responseBody as { error?: unknown } | null | undefined)?.error;
  if (typeof err === 'string') return err;
  if (!err || typeof err !== 'object') return undefined;
  const e = err as { reason?: unknown; root_cause?: unknown };
  const rootCause = Array.isArray(e.root_cause) ? (e.root_cause[0] as { reason?: unknown } | undefined) : undefined;
  const reason = rootCause?.reason ?? e.reason;
  return typeof reason === 'string' ? reason : undefined;
}
