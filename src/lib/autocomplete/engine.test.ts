import { describe, it, expect } from 'vitest';
import { CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { spec } from './spec';
import {
  resolveCompletions, docCompletions, bodyCompletions, resolveValueField,
  bodyValueField, docValueField, docStringStart, bodyStringStart, escapeJsonString,
  esCompletionSource, bodyCompletionSource,
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

describe('expanded query types', () => {
  it('suggests the expanded query types under query', () => {
    const labels = resolveCompletions(spec, 'queryBody', ['query'], true, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining([
      'wildcard', 'prefix', 'fuzzy', 'regexp', 'multi_match', 'match_phrase_prefix',
      'query_string', 'simple_query_string', 'ids', 'nested', 'constant_score',
      'dis_max', 'function_score',
    ]));
  });
  it('injects field names in a field-key position (wildcard)', () => {
    const items = resolveCompletions(spec, 'queryBody', ['query', 'wildcard'], true, fields);
    expect(items).toEqual([
      { label: 'title', kind: 'field', detail: 'text' },
      { label: 'user.name', kind: 'field', detail: 'keyword' },
    ]);
  });
  it('suggests wildcard options under a field', () => {
    const labels = resolveCompletions(spec, 'queryBody', ['query', 'wildcard', 'title'], true, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['value', 'case_insensitive']));
  });
  it('injects field names inside the multi_match fields array', () => {
    const items = resolveCompletions(spec, 'queryBody', ['query', 'multi_match', 'fields', '0'], false, fields);
    expect(items.map((c) => c.label)).toEqual(['title', 'user.name']);
  });
  it('offers multi_match type enum values', () => {
    const labels = resolveCompletions(spec, 'queryBody', ['query', 'multi_match', 'type'], false, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['best_fields', 'phrase_prefix']));
  });
  it('suggests nested query keys', () => {
    const labels = resolveCompletions(spec, 'queryBody', ['query', 'nested'], true, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['path', 'query', 'score_mode']));
  });
  it('resolves nested.query back to the query clauses', () => {
    const labels = resolveCompletions(spec, 'queryBody', ['query', 'nested', 'query'], true, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['bool', 'match', 'term']));
  });
  it('suggests function_score keys', () => {
    const labels = resolveCompletions(spec, 'queryBody', ['query', 'function_score'], true, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['query', 'functions', 'score_mode', 'boost_mode']));
  });
  it('suggests score function keys inside the functions array', () => {
    const labels = resolveCompletions(spec, 'queryBody', ['query', 'function_score', 'functions', '0'], true, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['filter', 'weight', 'field_value_factor', 'random_score']));
  });
  it('resolves constant_score.filter back to the query clauses', () => {
    const labels = resolveCompletions(spec, 'queryBody', ['query', 'constant_score', 'filter'], true, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['bool', 'match', 'term']));
  });
});

describe('expanded aggregations', () => {
  it('suggests the expanded agg types', () => {
    const labels = resolveCompletions(spec, 'queryBody', ['aggs', 'myAgg'], true, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining([
      'date_histogram', 'histogram', 'percentiles', 'cardinality', 'stats',
      'value_count', 'range', 'filter', 'nested', 'top_hits', 'aggs',
    ]));
  });
  it('offers calendar_interval enum values for date_histogram', () => {
    const labels = resolveCompletions(spec, 'queryBody', ['aggs', 'x', 'date_histogram', 'calendar_interval'], false, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['day', 'month', 'year']));
  });
  it('injects field names for date_histogram.field', () => {
    const items = resolveCompletions(spec, 'queryBody', ['aggs', 'x', 'date_histogram', 'field'], false, fields);
    expect(items.map((c) => c.label)).toEqual(['title', 'user.name']);
  });
  it('supports nested sub-aggregations', () => {
    const labels = resolveCompletions(spec, 'queryBody', ['aggs', 'outer', 'aggs', 'inner'], true, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['terms', 'avg', 'date_histogram']));
  });
  it('resolves the filter agg to the query clauses', () => {
    const labels = resolveCompletions(spec, 'queryBody', ['aggs', 'x', 'filter'], true, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['bool', 'match', 'term']));
  });
  it('suggests range agg bucket keys inside ranges', () => {
    const labels = resolveCompletions(spec, 'queryBody', ['aggs', 'x', 'range', 'ranges', '0'], true, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['from', 'to', 'key']));
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

describe('multi-request documents', () => {
  const oneField: FlatField[] = [{ path: 'title', type: 'text' }];
  const doc = 'GET /logs/_search\n{ "query": { "match": { "" } } }\n\nPOST /users/_count\n{ "query": { "bool": { "" } } }';

  it('completions in the second block resolve at its own body position', () => {
    const pos = doc.lastIndexOf('""') + 1;
    const labels = docCompletions(doc, pos, oneField).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['must', 'should', 'filter', 'must_not']));
  });
  it('completions in the first block are unaffected by later blocks', () => {
    const pos = doc.indexOf('""') + 1;
    expect(docCompletions(doc, pos, oneField)).toEqual([{ label: 'title', kind: 'field', detail: 'text' }]);
  });
  it('returns [] on the second request line', () => {
    expect(docCompletions(doc, doc.indexOf('POST') + 3, oneField)).toEqual([]);
  });
  it('returns [] on the blank line between blocks', () => {
    expect(docCompletions(doc, doc.indexOf('\n\nPOST') + 1, oneField)).toEqual([]);
  });
  it('docValueField finds the field at a term value in the second block', () => {
    const f: FlatField[] = [{ path: 'status', type: 'keyword' }];
    const d = 'GET /a/_search\n{ "size": 1 }\n\nPOST /logs/_search\n{ "query": { "term": { "status": "" } } }';
    expect(docValueField(d, d.lastIndexOf('""') + 1, f)).toBe('status');
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

describe('escapeJsonString', () => {
  it('doubles backslashes for the JSON-string context', () => {
    // arg = App\Viec (one backslash) → App\\Viec (two, as it appears in the doc)
    expect(escapeJsonString('App\\Viec')).toBe('App\\\\Viec');
  });
  it('is a no-op for plain values', () => {
    expect(escapeJsonString('active')).toBe('active');
  });
  it('escapes an embedded quote', () => {
    expect(escapeJsonString('a"b')).toBe('a\\"b');
  });
});

describe('string content start (replacement range for values with specials)', () => {
  it('returns the content start when the caret is inside the value string', () => {
    const typed = 'App\\\\Viec'; // doc form: App\\Viec
    const doc = `{ "term": { "t": "${typed}" } }`;
    const pos = doc.indexOf(typed) + typed.length;
    expect(bodyStringStart(doc, pos)).toBe(doc.indexOf(typed));
  });
  it('returns null when the caret sits just past the closing quote (never eat it)', () => {
    const doc = '{ "term": { "t": "abc" } }';
    const closeQuote = doc.indexOf('"abc"') + 4;
    expect(bodyStringStart(doc, closeQuote + 1)).toBeNull();
  });
  it('offsets into the request-block body for the REST console', () => {
    const typed = 'a\\\\b'; // doc form: a\\b
    const doc = `POST /x/_search\n{ "term": { "t": "${typed}" } }`;
    const pos = doc.indexOf(typed) + typed.length;
    expect(docStringStart(doc, pos)).toBe(doc.indexOf(typed));
  });
  it('returns null on a request line (no body to complete)', () => {
    const doc = 'GET /logs/_search\n{ }';
    expect(docStringStart(doc, 3)).toBeNull();
  });
});

describe('esCompletionSource — accepting a keyword value with backslashes', () => {
  const raw = 'App\\Viec\\Models\\Worker\\Ekyc'; // ES value, single backslashes
  const fields: FlatField[] = [{ path: 'auditable_type', type: 'keyword' }];
  const getFields = async () => fields;
  const getFieldValues = async () => [raw, 'App\\Models\\Worker'];

  // The value as it sits in the editor: a PHP class in a JSON string (backslashes doubled).
  const typed = 'App\\\\Viec\\\\Models\\\\Worker\\\\'; // doc form: App\\Viec\\Models\\Worker\\
  const doc = `POST /audit/_search\n{ "query": { "match": { "auditable_type": "${typed}" } } }`;
  const pos = doc.indexOf(typed) + typed.length; // caret right before the closing quote

  it('replaces the whole typed prefix instead of appending after it', async () => {
    const source = esCompletionSource(getFields, getFieldValues);
    const ctx = new CompletionContext(EditorState.create({ doc, extensions: [json()] }), pos, true);
    const res = (await source(ctx)) as CompletionResult;

    // `from` lands right after the opening quote, so accept overwrites the prefix.
    expect(doc.slice(res.from, pos)).toBe(typed);
    const first = res.options[0]!;
    expect(first.label).toBe(escapeJsonString(raw)); // escaped: filters against + inserts into JSON
    expect((first as { displayLabel?: string }).displayLabel).toBe(raw); // readable in the dropdown
  });
});

describe('bodyCompletionSource — keyword value on the Search page', () => {
  it('escapes the value and anchors `from` after the opening quote', async () => {
    const raw = 'a\\b';
    const fields: FlatField[] = [{ path: 'status', type: 'keyword' }];
    const source = bodyCompletionSource(async () => fields, async () => [raw]);
    const typed = 'a\\\\'; // doc form: a\\
    const doc = `{ "query": { "term": { "status": "${typed}" } } }`;
    const pos = doc.indexOf(`"${typed}"`) + 1 + typed.length;
    const ctx = new CompletionContext(EditorState.create({ doc, extensions: [json()] }), pos, true);
    const res = (await source(ctx)) as CompletionResult;

    expect(doc.slice(res.from, pos)).toBe(typed);
    expect(res.options[0]!.label).toBe(escapeJsonString(raw));
  });
});
