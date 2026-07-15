export interface Hit {
  _index?: string;
  _id?: string;
  _score?: number | null;
  _source?: Record<string, unknown>;
}

export type SortDir = 'asc' | 'desc';

export function extractHits(responseBody: unknown): Hit[] {
  const hits = (responseBody as { hits?: { hits?: unknown } } | null | undefined)?.hits?.hits;
  return Array.isArray(hits) ? (hits as Hit[]) : [];
}

export function deriveColumns(hits: Hit[], hasMultipleIndices: boolean): string[] {
  const sourceKeys: string[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    for (const key of Object.keys(hit._source ?? {})) {
      if (!seen.has(key)) {
        seen.add(key);
        sourceKeys.push(key);
      }
    }
  }
  return [...(hasMultipleIndices ? ['_index'] : []), '_id', ...sourceKeys];
}

export function cellText(hit: Hit, column: string): string {
  const value = column === '_index' || column === '_id' ? hit[column] : hit._source?.[column];
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function sortHits(hits: Hit[], column: string, dir: SortDir): Hit[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...hits].sort((a, b) => {
    const ta = cellText(a, column);
    const tb = cellText(b, column);
    const na = Number(ta);
    const nb = Number(tb);
    const isNumeric = ta !== '' && tb !== '' && !Number.isNaN(na) && !Number.isNaN(nb);
    return sign * (isNumeric ? na - nb : ta.localeCompare(tb));
  });
}

export function filterHits(hits: Hit[], columns: string[], query: string): Hit[] {
  const q = query.trim().toLowerCase();
  if (!q) return hits;
  return hits.filter((hit) => columns.some((column) => cellText(hit, column).toLowerCase().includes(q)));
}
