import { describe, it, expect } from 'vitest';
import { documentPath, writePath, extractDocMeta, parseEditableSource } from './docWrite';

describe('documentPath', () => {
  it('falls back to _doc when the hit has no type', () => {
    expect(documentPath({ index: 'products', id: '42' })).toBe('/products/_doc/42');
  });
  it('uses the real 6.x type when present', () => {
    expect(documentPath({ index: 'products', type: 'item', id: '42' })).toBe('/products/item/42');
  });
  it('escapes ids containing slashes and spaces', () => {
    expect(documentPath({ index: 'p', id: 'a/b c' })).toBe('/p/_doc/a%2Fb%20c');
  });
});

describe('writePath', () => {
  it('always requests refresh=wait_for', () => {
    expect(writePath('/p/_doc/1', {})).toBe('/p/_doc/1?refresh=wait_for');
  });
  it('adds the concurrency guard only when both values are present', () => {
    expect(writePath('/p/_doc/1', { seqNo: 5, primaryTerm: 2 })).toBe(
      '/p/_doc/1?refresh=wait_for&if_seq_no=5&if_primary_term=2',
    );
  });
  it('omits the guard when only one value is present', () => {
    expect(writePath('/p/_doc/1', { seqNo: 5 })).toBe('/p/_doc/1?refresh=wait_for');
  });
  it('treats seqNo 0 as present', () => {
    expect(writePath('/p/_doc/1', { seqNo: 0, primaryTerm: 1 })).toBe(
      '/p/_doc/1?refresh=wait_for&if_seq_no=0&if_primary_term=1',
    );
  });
});

describe('extractDocMeta', () => {
  it('returns source with seq/primary from a found document', () => {
    expect(
      extractDocMeta({ found: true, _seq_no: 7, _primary_term: 3, _source: { a: 1 } }),
    ).toEqual({ source: { a: 1 }, seqNo: 7, primaryTerm: 3 });
  });
  it('returns source only when seq/primary are absent (old 6.x)', () => {
    expect(extractDocMeta({ found: true, _source: { a: 1 } })).toEqual({ source: { a: 1 } });
  });
  it('returns undefined when the document was not found', () => {
    expect(extractDocMeta({ found: false })).toBeUndefined();
  });
  it('returns undefined for a malformed body', () => {
    expect(extractDocMeta(null)).toBeUndefined();
    expect(extractDocMeta('nope')).toBeUndefined();
    expect(extractDocMeta({ found: true, _source: 'not-an-object' })).toBeUndefined();
  });
});

describe('parseEditableSource', () => {
  it('accepts a JSON object', () => {
    expect(parseEditableSource('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });
  it('rejects arrays and scalars', () => {
    expect(parseEditableSource('[1,2]').ok).toBe(false);
    expect(parseEditableSource('42').ok).toBe(false);
  });
  it('rejects invalid JSON', () => {
    expect(parseEditableSource('{bad').ok).toBe(false);
  });
});
