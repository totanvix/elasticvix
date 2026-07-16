import { describe, it, expect } from 'vitest';
import { parseCatIndices, largestIndex } from './indicesLib';

describe('parseCatIndices', () => {
  it('parses rows, drops system indices, and sorts by name', () => {
    const body = [
      { index: 'zeta', health: 'yellow', 'docs.count': '12' },
      { index: '.kibana_1', health: 'green', 'docs.count': '1' },
      { index: 'alpha', health: 'green', 'docs.count': '3' },
    ];
    expect(parseCatIndices(body)).toEqual([
      { index: 'alpha', health: 'green', docsCount: '3' },
      { index: 'zeta', health: 'yellow', docsCount: '12' },
    ]);
  });

  it('returns [] for non-array bodies', () => {
    expect(parseCatIndices({ error: 'boom' })).toEqual([]);
    expect(parseCatIndices(undefined)).toEqual([]);
  });

  it('skips malformed rows and tolerates missing optional columns', () => {
    const body = [{ index: 'a' }, 'junk', { health: 'green' }, null];
    expect(parseCatIndices(body)).toEqual([{ index: 'a', health: undefined, docsCount: undefined }]);
  });
});

describe('largestIndex', () => {
  it('returns the index with the most docs', () => {
    const indices = [
      { index: 'small', docsCount: '3' },
      { index: 'big', docsCount: '900' },
      { index: 'mid', docsCount: '42' },
    ];
    expect(largestIndex(indices)).toBe('big');
  });

  it('treats missing/invalid docs.count as zero and falls back to the first index', () => {
    expect(largestIndex([{ index: 'a' }, { index: 'b' }])).toBe('a');
    expect(largestIndex([{ index: 'a', docsCount: 'x' }, { index: 'b', docsCount: '1' }])).toBe('b');
  });

  it('returns undefined for an empty list', () => {
    expect(largestIndex([])).toBeUndefined();
  });
});
