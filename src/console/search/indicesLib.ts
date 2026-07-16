export interface IndexInfo {
  index: string;
  health?: string;
  docsCount?: string;
}

/** Name of the index holding the most documents, used as the default selection. */
export function largestIndex(indices: IndexInfo[]): string | undefined {
  let best: string | undefined;
  let bestCount = -1;
  for (const i of indices) {
    const parsed = i.docsCount ? Number(i.docsCount) : 0;
    const count = Number.isFinite(parsed) ? parsed : 0;
    if (count > bestCount) {
      bestCount = count;
      best = i.index;
    }
  }
  return best;
}

export function parseCatIndices(body: unknown): IndexInfo[] {
  if (!Array.isArray(body)) return [];
  const out: IndexInfo[] = [];
  for (const row of body) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (typeof r.index !== 'string' || r.index.startsWith('.')) continue;
    out.push({
      index: r.index,
      health: typeof r.health === 'string' ? r.health : undefined,
      docsCount: typeof r['docs.count'] === 'string' ? r['docs.count'] : undefined,
    });
  }
  return out.sort((a, b) => a.index.localeCompare(b.index));
}
