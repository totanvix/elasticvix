import { describe, it, expect } from 'vitest';
import { cellText, deriveColumns, extractHits, filterHits, sortHits, type Hit } from './hitsLib';

const hits: Hit[] = [
  { _index: 'a', _id: '1', _source: { name: 'zeta', age: 30, meta: { x: 1 } } },
  { _index: 'b', _id: '2', _source: { name: 'alpha', city: 'HN' } },
];

describe('extractHits', () => {
  it('extracts hits.hits arrays and tolerates malformed bodies', () => {
    expect(extractHits({ hits: { hits } })).toEqual(hits);
    expect(extractHits({})).toEqual([]);
    expect(extractHits(undefined)).toEqual([]);
  });
});

describe('deriveColumns', () => {
  it('unions _source keys in first-appearance order after _id', () => {
    expect(deriveColumns(hits, false)).toEqual(['_id', 'name', 'age', 'meta', 'city']);
  });

  it('prepends _index when several indices are selected', () => {
    expect(deriveColumns(hits, true)).toEqual(['_index', '_id', 'name', 'age', 'meta', 'city']);
  });
});

describe('cellText', () => {
  it('renders metadata, primitives, objects, and missing values', () => {
    const hit0 = hits[0];
    const hit1 = hits[1];
    if (!hit0 || !hit1) throw new Error('Test data missing');
    expect(cellText(hit0, '_id')).toBe('1');
    expect(cellText(hit0, '_index')).toBe('a');
    expect(cellText(hit0, 'age')).toBe('30');
    expect(cellText(hit0, 'meta')).toBe('{"x":1}');
    expect(cellText(hit0, 'city')).toBe('');
  });
});

describe('sortHits', () => {
  it('sorts without mutating the input', () => {
    const byName = sortHits(hits, 'name', 'asc');
    expect(byName.map((h) => h._id)).toEqual(['2', '1']);
    const hit0 = hits[0];
    if (!hit0) throw new Error('Test data missing');
    expect(hit0._id).toBe('1');
  });

  it('sorts 2 vs 10 numerically, not lexically', () => {
    const nums: Hit[] = [
      { _id: 'x', _source: { n: 10 } },
      { _id: 'y', _source: { n: 2 } },
    ];
    expect(sortHits(nums, 'n', 'asc').map((h) => h._id)).toEqual(['y', 'x']);
    expect(sortHits(nums, 'n', 'desc').map((h) => h._id)).toEqual(['x', 'y']);
  });
});

describe('filterHits', () => {
  const columns = deriveColumns(hits, true);

  it('matches case-insensitively across all rendered cells', () => {
    expect(filterHits(hits, columns, 'ALPHA').map((h) => h._id)).toEqual(['2']);
    expect(filterHits(hits, columns, '"x":1').map((h) => h._id)).toEqual(['1']);
  });

  it('returns all hits for blank queries', () => {
    expect(filterHits(hits, columns, '  ')).toEqual(hits);
  });
});
