import { describe, it, expect } from 'vitest';
import { typeClass, sortFields, filterFields } from './mappingViewLib';
import type { FlatField } from '../../lib/types';

const F: FlatField[] = [
  { path: 'name', type: 'text' },
  { path: 'name.keyword', type: 'keyword' },
  { path: 'category', type: 'keyword' },
  { path: 'price', type: 'float' },
];

describe('typeClass', () => {
  it('maps types to a semantic class', () => {
    expect(typeClass('keyword')).toBe('keyword');
    expect(typeClass('text')).toBe('text');
    expect(typeClass('match_only_text')).toBe('text');
    expect(typeClass('date')).toBe('date');
    expect(typeClass('date_nanos')).toBe('date');
    expect(typeClass('boolean')).toBe('boolean');
    expect(typeClass('long')).toBe('number');
    expect(typeClass('float')).toBe('number');
    expect(typeClass('scaled_float')).toBe('number');
    expect(typeClass('geo_point')).toBe('other');
    expect(typeClass('object')).toBe('other');
  });
});

describe('sortFields', () => {
  it('sorts alphabetically by path without mutating input', () => {
    const before = [...F];
    const out = sortFields(F);
    expect(out.map((f) => f.path)).toEqual(['category', 'name', 'name.keyword', 'price']);
    expect(F).toEqual(before); // immutable
  });
});

describe('filterFields', () => {
  it('returns all fields (input order) for an empty query', () => {
    expect(filterFields(F, '   ')).toEqual(F);
  });
  it('matches path substring case-insensitively', () => {
    expect(filterFields(F, 'NAME').map((f) => f.path)).toEqual(['name', 'name.keyword']);
  });
  it('returns [] when nothing matches', () => {
    expect(filterFields(F, 'zzz')).toEqual([]);
  });
});
