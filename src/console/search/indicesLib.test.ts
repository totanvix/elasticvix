import { describe, it, expect } from 'vitest';
import { parseCatIndices } from './indicesLib';

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
