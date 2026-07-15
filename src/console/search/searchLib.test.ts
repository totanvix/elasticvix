import { describe, it, expect } from 'vitest';
import { buildSearchPath, esErrorReason, mergeFromSize, normalizeTotal, unionFields } from './searchLib';

describe('normalizeTotal', () => {
  it('reads the ES6 numeric total', () => {
    expect(normalizeTotal({ hits: { total: 42 } })).toEqual({ value: 42, isGte: false });
  });

  it('reads the ES7+ object total with gte relation', () => {
    expect(normalizeTotal({ hits: { total: { value: 10000, relation: 'gte' } } })).toEqual({ value: 10000, isGte: true });
    expect(normalizeTotal({ hits: { total: { value: 7, relation: 'eq' } } })).toEqual({ value: 7, isGte: false });
  });

  it('falls back to zero when total is missing', () => {
    expect(normalizeTotal({})).toEqual({ value: 0, isGte: false });
    expect(normalizeTotal(undefined)).toEqual({ value: 0, isGte: false });
  });
});

describe('mergeFromSize', () => {
  it('overrides from/size the user typed in the query', () => {
    const merged = mergeFromSize('{"query":{"match_all":{}},"from":99,"size":1}', 0, 25);
    expect(JSON.parse(merged as string)).toEqual({ query: { match_all: {} }, from: 0, size: 25 });
  });

  it('treats an empty editor as an empty object', () => {
    expect(JSON.parse(mergeFromSize('', 25, 25) as string)).toEqual({ from: 25, size: 25 });
  });

  it('returns undefined for invalid JSON or non-object roots', () => {
    expect(mergeFromSize('{oops', 0, 25)).toBeUndefined();
    expect(mergeFromSize('[1,2]', 0, 25)).toBeUndefined();
  });
});

describe('buildSearchPath', () => {
  it('joins indices with commas', () => {
    expect(buildSearchPath(['a'])).toBe('/a/_search');
    expect(buildSearchPath(['a', 'b'])).toBe('/a,b/_search');
  });
});

describe('unionFields', () => {
  it('dedupes by path keeping the first type seen', () => {
    expect(
      unionFields([
        [{ path: 'user.name', type: 'keyword' }],
        [
          { path: 'user.name', type: 'text' },
          { path: 'age', type: 'long' },
        ],
      ]),
    ).toEqual([
      { path: 'user.name', type: 'keyword' },
      { path: 'age', type: 'long' },
    ]);
  });
});

describe('esErrorReason', () => {
  it('prefers the first root_cause reason', () => {
    const body = { error: { root_cause: [{ reason: 'no such index [nope]' }], reason: 'outer' }, status: 404 };
    expect(esErrorReason(body)).toBe('no such index [nope]');
  });

  it('falls back to error.reason, then string errors, then undefined', () => {
    expect(esErrorReason({ error: { reason: 'parse error' } })).toBe('parse error');
    expect(esErrorReason({ error: 'plain string error' })).toBe('plain string error');
    expect(esErrorReason({})).toBeUndefined();
  });
});
