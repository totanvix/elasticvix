// Sentinel returned by prune() when nothing under a value matches the query.
const NO_MATCH = Symbol('no-match');

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function prune(value: unknown, q: string): unknown {
  if (Array.isArray(value)) {
    const kept: unknown[] = [];
    for (const el of value) {
      const p = prune(el, q);
      if (p !== NO_MATCH) kept.push(p);
    }
    return kept.length > 0 ? kept : NO_MATCH;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    let any = false;
    for (const [key, val] of Object.entries(value)) {
      if (key.toLowerCase().includes(q)) {
        out[key] = val; // key match → keep the whole subtree unpruned
        any = true;
        continue;
      }
      const p = prune(val, q);
      if (p !== NO_MATCH) {
        out[key] = p;
        any = true;
      }
    }
    return any ? out : NO_MATCH;
  }
  return String(value).toLowerCase().includes(q) ? value : NO_MATCH;
}

// Prune a JSON body to just the paths matching `query` (key or leaf value,
// case-insensitive). Empty query returns `body` unchanged; no match returns
// `undefined`. Pure — never mutates `body`.
export function filterResponse(body: unknown, query: string): unknown {
  const q = query.trim().toLowerCase();
  if (q === '') return body;
  const pruned = prune(body, q);
  return pruned === NO_MATCH ? undefined : pruned;
}
