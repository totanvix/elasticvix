import { describe, it, expect } from 'vitest';
import { filterResponse } from './filterResponse';

const RESP = {
  took: 5,
  hits: {
    total: { value: 42 },
    hits: [
      { _id: '1', _source: { title: 'Senior Dev', salary: 3000 } },
      { _id: '2', _source: { title: 'Junior Dev', salary: 1500 } },
    ],
  },
};

describe('filterResponse', () => {
  it('returns the body unchanged for an empty query', () => {
    expect(filterResponse(RESP, '')).toBe(RESP);
    expect(filterResponse(RESP, '   ')).toBe(RESP);
  });

  it('keeps every path whose key matches, dropping the rest', () => {
    expect(filterResponse(RESP, 'title')).toEqual({
      hits: { hits: [{ _source: { title: 'Senior Dev' } }, { _source: { title: 'Junior Dev' } }] },
    });
  });

  it('matches leaf string values case-insensitively', () => {
    expect(filterResponse(RESP, 'senior')).toEqual({
      hits: { hits: [{ _source: { title: 'Senior Dev' } }] },
    });
  });

  it('matches numeric leaf values by string form', () => {
    expect(filterResponse(RESP, '3000')).toEqual({
      hits: { hits: [{ _source: { salary: 3000 } }] },
    });
  });

  it('keeps the whole subtree when a key matches', () => {
    expect(filterResponse(RESP, '_source')).toEqual({
      hits: {
        hits: [
          { _source: { title: 'Senior Dev', salary: 3000 } },
          { _source: { title: 'Junior Dev', salary: 1500 } },
        ],
      },
    });
  });

  it('preserves the path to root for a nested match', () => {
    expect(filterResponse(RESP, 'value')).toEqual({ hits: { total: { value: 42 } } });
  });

  it('compacts arrays to only matching elements', () => {
    const data = { rows: [{ n: 'apple' }, { n: 'banana' }, { n: 'cherry' }] };
    expect(filterResponse(data, 'ban')).toEqual({ rows: [{ n: 'banana' }] });
  });

  it('returns undefined when nothing matches', () => {
    expect(filterResponse(RESP, 'zzz-nope')).toBeUndefined();
  });

  it('handles boolean and null leaves without throwing', () => {
    const data = { a: true, b: null, c: 'hello' };
    expect(filterResponse(data, 'null')).toEqual({ b: null });
    expect(filterResponse(data, 'true')).toEqual({ a: true });
  });

  it('does not mutate the input', () => {
    const snapshot = JSON.stringify(RESP);
    filterResponse(RESP, 'title');
    expect(JSON.stringify(RESP)).toBe(snapshot);
  });
});
