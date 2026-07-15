export interface IndexInfo {
  index: string;
  health?: string;
  docsCount?: string;
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
