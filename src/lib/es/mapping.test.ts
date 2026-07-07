import { describe, it, expect } from 'vitest';
import { flattenMapping } from './mapping';

describe('flattenMapping', () => {
  it('flattens ES7+ properties with nested objects and multi-fields', () => {
    const mappings = {
      properties: {
        title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        user: { properties: { name: { type: 'keyword' }, age: { type: 'long' } } },
      },
    };
    expect(flattenMapping(mappings)).toEqual([
      { path: 'title', type: 'text' },
      { path: 'title.keyword', type: 'keyword' },
      { path: 'user.name', type: 'keyword' },
      { path: 'user.age', type: 'long' },
    ]);
  });

  it('flattens the ES6 mapping shape that has a type layer', () => {
    const mappings = { doc: { properties: { message: { type: 'text' } } } };
    expect(flattenMapping(mappings)).toEqual([{ path: 'message', type: 'text' }]);
  });

  it('returns [] for an empty mapping', () => {
    expect(flattenMapping({})).toEqual([]);
  });
});
