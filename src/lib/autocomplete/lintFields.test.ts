import { describe, it, expect } from 'vitest';
import { findUnknownFields } from './lintFields';
import type { FlatField } from '../types';

const FIELDS: FlatField[] = [
  { path: 'category', type: 'keyword' },
  { path: 'name', type: 'text' },
  { path: 'name.keyword', type: 'keyword' },
  { path: 'price', type: 'float' },
];
const find = (body: string) => findUnknownFields(body, 'queryBody', FIELDS).map((d) => d.field);

describe('findUnknownFields', () => {
  it('flags an unknown field key under term', () => {
    expect(find('{"query":{"term":{"catgory":"x"}}}')).toEqual(['catgory']);
  });
  it('accepts a known field key', () => {
    expect(find('{"query":{"term":{"category":"x"}}}')).toEqual([]);
  });
  it('accepts a known multi-field subfield', () => {
    expect(find('{"query":{"term":{"name.keyword":"x"}}}')).toEqual([]);
  });
  it('flags an unknown field in exists.field (value position)', () => {
    expect(find('{"query":{"exists":{"field":"catgory"}}}')).toEqual(['catgory']);
  });
  it('flags an unknown field in an aggs field value', () => {
    expect(find('{"aggs":{"by_cat":{"terms":{"field":"catgory"}}}}')).toEqual(['catgory']);
  });
  it('does not flag DSL keywords', () => {
    expect(find('{"query":{"bool":{"must":[{"match_all":{}}]}},"size":10,"from":0}')).toEqual([]);
  });
  it('does not flag user-chosen aggregation names (@any)', () => {
    expect(find('{"aggs":{"not_a_field":{"terms":{"field":"category"}}}}')).toEqual([]);
  });
  it('returns nothing when the mapping is empty', () => {
    expect(findUnknownFields('{"query":{"term":{"catgory":"x"}}}', 'queryBody', [])).toEqual([]);
  });
  it('skips wildcard/boost-looking tokens', () => {
    expect(find('{"query":{"term":{"cat*":"x"}}}')).toEqual([]);
  });
  it('flags unknown field under range and sort', () => {
    expect(find('{"query":{"range":{"prize":{"gte":1}}}}')).toEqual(['prize']);
    expect(find('{"sort":[{"prize":{"order":"asc"}}]}')).toEqual(['prize']);
  });
  it('reports the source range of the offending token', () => {
    const body = '{"query":{"term":{"catgory":"x"}}}';
    const [d] = findUnknownFields(body, 'queryBody', FIELDS);
    expect(body.slice(d!.from, d!.to)).toBe('"catgory"');
  });
  it('does not throw on incomplete JSON while typing', () => {
    expect(() => findUnknownFields('{"query":{"term":{"cat', 'queryBody', FIELDS)).not.toThrow();
  });
});
