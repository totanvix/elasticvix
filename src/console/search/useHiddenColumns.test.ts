import { describe, it, expect, beforeEach } from 'vitest';
import { hiddenColumnsKey, loadHiddenColumns, saveHiddenColumns, toggleHidden } from './useHiddenColumns';

describe('hiddenColumnsKey', () => {
  it('namespaces the key by connection id', () => {
    expect(hiddenColumnsKey('abc')).toBe('elasticvix.search.hiddenColumns.abc');
  });
});

describe('loadHiddenColumns / saveHiddenColumns', () => {
  beforeEach(() => localStorage.clear());

  it('returns an empty set when nothing is stored', () => {
    expect(loadHiddenColumns('c1')).toEqual(new Set());
  });

  it('round-trips a set of hidden column names', () => {
    saveHiddenColumns('c1', new Set(['age', 'meta']));
    expect(loadHiddenColumns('c1')).toEqual(new Set(['age', 'meta']));
  });

  it('keeps hidden sets isolated per connection', () => {
    saveHiddenColumns('c1', new Set(['age']));
    expect(loadHiddenColumns('c2')).toEqual(new Set());
  });

  it('falls back to an empty set on corrupted storage', () => {
    localStorage.setItem(hiddenColumnsKey('c1'), '{not json');
    expect(loadHiddenColumns('c1')).toEqual(new Set());
  });

  it('ignores non-string entries in stored arrays', () => {
    localStorage.setItem(hiddenColumnsKey('c1'), JSON.stringify(['age', 3, null]));
    expect(loadHiddenColumns('c1')).toEqual(new Set(['age']));
  });
});

describe('toggleHidden', () => {
  it('adds a column immutably', () => {
    const before = new Set(['age']);
    const after = toggleHidden(before, 'meta');
    expect(after).toEqual(new Set(['age', 'meta']));
    expect(before).toEqual(new Set(['age']));
  });

  it('removes a column that was already hidden', () => {
    expect(toggleHidden(new Set(['age', 'meta']), 'age')).toEqual(new Set(['meta']));
  });
});
