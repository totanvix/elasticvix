import { describe, it, expect } from 'vitest';
import { spec } from './spec';
import {
  resolveCompletions, docCompletions, bodyCompletions, resolveValueField,
  bodyValueField, docValueField,
} from './engine';
import type { FlatField } from '../types';

const fields: FlatField[] = [
  { path: 'title', type: 'text' },
  { path: 'user.name', type: 'keyword' },
];

describe('resolveCompletions', () => {
  it('suggests top-level body keys at the root', () => {
    const labels = resolveCompletions(spec, 'queryBody', [], true, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['query', 'size', 'from', 'sort', 'aggs']));
  });
  it('suggests bool clauses under query.bool', () => {
    const labels = resolveCompletions(spec, 'queryBody', ['query', 'bool'], true, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['must', 'should', 'filter', 'must_not']));
  });
  it('injects field names where a field key is expected (match)', () => {
    const items = resolveCompletions(spec, 'queryBody', ['query', 'match'], true, fields);
    expect(items).toEqual([
      { label: 'title', kind: 'field', detail: 'text' },
      { label: 'user.name', kind: 'field', detail: 'keyword' },
    ]);
  });
  it('injects field names in a value position (exists.field)', () => {
    const items = resolveCompletions(spec, 'queryBody', ['query', 'exists', 'field'], false, fields);
    expect(items.map((c) => c.label)).toEqual(['title', 'user.name']);
  });
  it('resolves through arrays (bool.must[0] -> query clauses)', () => {
    const labels = resolveCompletions(spec, 'queryBody', ['query', 'bool', 'must', '0'], true, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['match', 'term', 'range', 'bool']));
  });
  it('offers enum values in a value position (sort order)', () => {
    const items = resolveCompletions(spec, 'queryBody', ['sort', '0', 'anyField', 'order'], false, fields);
    expect(items.map((c) => c.label)).toEqual(['asc', 'desc']);
  });
});

describe('docCompletions (whole request-line + body document)', () => {
  const oneField: FlatField[] = [{ path: 'title', type: 'text' }];

  it('suggests bool clauses when the cursor is in the body of a GET _search', () => {
    const doc = 'GET /logs-*/_search\n{ "query": { "bool": { "" } } }';
    const pos = doc.indexOf('""') + 1;
    const labels = docCompletions(doc, pos, oneField).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['must', 'should', 'filter', 'must_not']));
  });

  it('injects real field names in a field-key position (match)', () => {
    const doc = 'POST /logs-*/_search\n{ "query": { "match": { "" } } }';
    const pos = doc.indexOf('""') + 1;
    const items = docCompletions(doc, pos, oneField);
    expect(items).toEqual([{ label: 'title', kind: 'field', detail: 'text' }]);
  });

  it('returns [] when the cursor is on the request line (line 1)', () => {
    const doc = 'GET /logs-*/_search\n{ }';
    expect(docCompletions(doc, 3, oneField)).toEqual([]);
  });
});

describe('bodyCompletions (body-only Search page document)', () => {
  const oneField: FlatField[] = [{ path: 'title', type: 'text' }];

  it('suggests top-level _search keys at the root', () => {
    const doc = '{ "" }';
    const pos = doc.indexOf('""') + 1;
    const labels = bodyCompletions(doc, pos, oneField).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['query', 'size', 'from', 'sort', 'aggs']));
  });

  it('injects real field names in a field-key position (match)', () => {
    const doc = '{ "query": { "match": { "" } } }';
    const pos = doc.indexOf('""') + 1;
    expect(bodyCompletions(doc, pos, oneField)).toEqual([{ label: 'title', kind: 'field', detail: 'text' }]);
  });
});

describe('resolveValueField', () => {
  const f: FlatField[] = [
    { path: 'status', type: 'keyword' },
    { path: 'title', type: 'text' },
    { path: 'title.keyword', type: 'keyword' },
  ];
  it('returns the field for a term value position', () => {
    expect(resolveValueField(['query', 'term', 'status'], false, f)).toBe('status');
  });
  it('returns the field for a terms array element', () => {
    expect(resolveValueField(['query', 'terms', 'status', '0'], false, f)).toBe('status');
  });
  it('returns a dotted keyword sub-field', () => {
    expect(resolveValueField(['query', 'term', 'title.keyword'], false, f)).toBe('title.keyword');
  });
  it('returns undefined in a key position', () => {
    expect(resolveValueField(['query', 'term'], true, f)).toBeUndefined();
  });
  it('returns undefined for a range sub-key (gte)', () => {
    expect(resolveValueField(['query', 'range', 'price', 'gte'], false, f)).toBeUndefined();
  });
  it('returns undefined for a text field', () => {
    expect(resolveValueField(['query', 'match', 'title'], false, f)).toBeUndefined();
  });
  it('returns undefined for a non-field key (size)', () => {
    expect(resolveValueField(['size'], false, f)).toBeUndefined();
  });
});

describe('bodyValueField / docValueField', () => {
  const f: FlatField[] = [{ path: 'status', type: 'keyword' }];

  it('bodyValueField finds the field at a term value (Search body)', () => {
    const doc = '{ "query": { "term": { "status": "" } } }';
    const pos = doc.indexOf('""') + 1;
    expect(bodyValueField(doc, pos, f)).toBe('status');
  });
  it('bodyValueField returns undefined in a key position', () => {
    const doc = '{ "query": { "term": { "" } } }';
    const pos = doc.indexOf('""') + 1;
    expect(bodyValueField(doc, pos, f)).toBeUndefined();
  });
  it('docValueField finds the field at a term value (REST doc)', () => {
    const doc = 'POST /logs/_search\n{ "query": { "term": { "status": "" } } }';
    const pos = doc.indexOf('""') + 1;
    expect(docValueField(doc, pos, f)).toBe('status');
  });
  it('docValueField returns undefined on the request line', () => {
    const doc = 'GET /logs/_search\n{ }';
    expect(docValueField(doc, 3, f)).toBeUndefined();
  });
});
