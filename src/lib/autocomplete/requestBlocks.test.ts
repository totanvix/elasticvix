import { describe, it, expect } from 'vitest';
import {
  splitBlocks, blockAt, runnableBlockAt, activeBlockRange,
  formatBodyEdits, applyEdits, appendRequestEdit,
} from './requestBlocks';

const TWO = 'GET /logs/_search\n{\n  "query": {}\n}\n\nPOST /users/_count\n{ "query": { "term": { "a": 1 } } }';

describe('splitBlocks', () => {
  it('parses a single block with a body', () => {
    const doc = 'GET /logs/_search\n{\n  "query": {}\n}';
    const blocks = splitBlocks(doc);
    expect(blocks).toHaveLength(1);
    const b = blocks[0]!;
    expect(b.method).toBe('GET');
    expect(b.path).toBe('/logs/_search');
    expect(b.index).toBe('logs');
    expect(b.endpoint).toBe('_search');
    expect(b.lineFrom).toBe(0);
    expect(b.lineTo).toBe('GET /logs/_search'.length);
    expect(b.bodyText).toBe('{\n  "query": {}\n}');
    expect(doc.slice(b.bodyFrom, b.bodyTo)).toBe(b.bodyText);
  });
  it('parses a block without a body', () => {
    const blocks = splitBlocks('GET /_cat/indices');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.bodyFrom).toBe(blocks[0]!.bodyTo);
    expect(blocks[0]!.bodyText).toBe('');
  });
  it('splits two blank-line separated blocks', () => {
    const blocks = splitBlocks(TWO);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.bodyText).toBe('{\n  "query": {}\n}');
    expect(blocks[1]!.method).toBe('POST');
    expect(blocks[1]!.index).toBe('users');
    expect(TWO.slice(blocks[1]!.bodyFrom, blocks[1]!.bodyTo)).toBe(blocks[1]!.bodyText);
  });
  it('splits adjacent blocks with no blank line between', () => {
    const doc = 'GET /a/_search\n{ }\nGET /b/_search\n{ }';
    expect(splitBlocks(doc).map((b) => b.path)).toEqual(['/a/_search', '/b/_search']);
  });
  it('leaves leading junk outside any block', () => {
    const doc = 'not a request\nGET /_search\n{}';
    const blocks = splitBlocks(doc);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.lineFrom).toBe(doc.indexOf('GET'));
  });
  it('keeps interior blank lines but trims trailing ones', () => {
    const doc = 'GET /_search\n{\n\n  "size": 1\n}\n\n\n';
    const b = splitBlocks(doc)[0]!;
    expect(b.bodyText).toBe('{\n\n  "size": 1\n}');
  });
  it('detects lowercase methods', () => {
    expect(splitBlocks('get /_search')[0]!.method).toBe('GET');
  });
  it('does not treat an indented method-looking line inside a body as a boundary', () => {
    const doc = 'GET /_search\n{\n  GET /x\n}';
    expect(splitBlocks(doc)).toHaveLength(1);
  });
  it('keeps offsets accurate with CRLF line endings', () => {
    const doc = 'GET /_search\r\n{ "size": 1 }\r\n';
    const b = splitBlocks(doc)[0]!;
    expect(b.method).toBe('GET');
    expect(b.path).toBe('/_search');
    expect(b.lineTo).toBe('GET /_search'.length);
    expect(b.bodyText).toBe('{ "size": 1 }');
    expect(doc.slice(b.bodyFrom, b.bodyTo)).toBe(b.bodyText);
  });
});

describe('blockAt / runnableBlockAt', () => {
  const blocks = splitBlocks(TWO);
  const secondStart = TWO.indexOf('POST');
  it('returns the block containing the cursor', () => {
    expect(blockAt(blocks, TWO.indexOf('"query"'))).toBe(blocks[0]);
  });
  it('maps a blank line between blocks to the preceding block', () => {
    expect(blockAt(blocks, secondStart - 1)).toBe(blocks[0]);
  });
  it('switches at the first char of the next request line', () => {
    expect(blockAt(blocks, secondStart)).toBe(blocks[1]);
  });
  it('returns undefined before the first block', () => {
    const bs = splitBlocks('junk\n' + TWO);
    expect(blockAt(bs, 2)).toBeUndefined();
  });
  it('runnableBlockAt falls back to the first block', () => {
    const bs = splitBlocks('junk\n' + TWO);
    expect(runnableBlockAt(bs, 2)).toBe(bs[0]);
  });
  it('runnableBlockAt returns undefined for a doc with no blocks', () => {
    expect(runnableBlockAt(splitBlocks('just text'), 0)).toBeUndefined();
  });
});

describe('activeBlockRange', () => {
  it('covers request line through body of the block at cursor', () => {
    const range = activeBlockRange(TWO, TWO.indexOf('"query"'));
    expect(range).toEqual({ from: 0, to: TWO.indexOf('\n\nPOST') });
  });
  it('covers only the request line when there is no body', () => {
    const doc = 'GET /_cat/indices';
    expect(activeBlockRange(doc, 5)).toEqual({ from: 0, to: doc.length });
  });
  it('returns undefined when the doc has no blocks', () => {
    expect(activeBlockRange('nope', 0)).toBeUndefined();
  });
});

describe('formatBodyEdits / applyEdits', () => {
  it('pretty-prints valid bodies and skips invalid ones', () => {
    const doc = 'GET /a/_search\n{"size":1}\n\nGET /b/_search\n{oops}\n\nGET /c/_search\n{"from": 2}';
    const edits = formatBodyEdits(doc);
    expect(edits).toHaveLength(2);
    expect(applyEdits(doc, edits)).toBe(
      'GET /a/_search\n{\n  "size": 1\n}\n\nGET /b/_search\n{oops}\n\nGET /c/_search\n{\n  "from": 2\n}',
    );
  });
  it('emits no edit for an already-formatted body', () => {
    expect(formatBodyEdits('GET /_search\n{\n  "size": 1\n}')).toEqual([]);
  });
  it('returns exact offsets', () => {
    const doc = 'GET /a/_search\n{"size":1}';
    const edits = formatBodyEdits(doc);
    expect(edits).toEqual([
      { from: doc.indexOf('{"size'), to: doc.length, insert: '{\n  "size": 1\n}' },
    ]);
  });
});

describe('appendRequestEdit', () => {
  it('inserts without separator into an empty doc', () => {
    const r = appendRequestEdit('', { method: 'GET', path: '/_search', body: '{}' });
    expect(r).toEqual({ from: 0, insert: 'GET /_search\n{}', cursor: 0 });
  });
  it('leaves one blank line after existing content', () => {
    const doc = 'GET /a/_search\n{}';
    const r = appendRequestEdit(doc, { method: 'POST', path: '/b/_doc', body: '{ "x": 1 }' });
    expect(r).toEqual({ from: doc.length, insert: '\n\nPOST /b/_doc\n{ "x": 1 }', cursor: doc.length + 2 });
  });
  it('adds only the missing newline when the doc ends with one', () => {
    const doc = 'GET /a/_search\n{}\n';
    const r = appendRequestEdit(doc, { method: 'GET', path: '/b', body: '' });
    expect(r).toEqual({ from: doc.length, insert: '\nGET /b', cursor: doc.length + 1 });
  });
  it('adds no separator when the doc already ends with a blank line', () => {
    const doc = 'GET /a\n{}\n\n';
    const r = appendRequestEdit(doc, { method: 'GET', path: '/b' });
    expect(r).toEqual({ from: doc.length, insert: 'GET /b', cursor: doc.length });
  });
});
