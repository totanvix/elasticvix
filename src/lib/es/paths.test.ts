import { describe, it, expect } from 'vitest';
import { docPath } from './paths';

describe('docPath', () => {
  it('uses _doc for 7+', () => {
    expect(docPath({ index: 'logs', id: '1', major: 8 })).toBe('/logs/_doc/1');
  });
  it('uses the type segment for 6.x when a type is given', () => {
    expect(docPath({ index: 'logs', id: '1', type: 'doc', major: 6 })).toBe('/logs/doc/1');
  });
  it('falls back to _doc for 6.x when no type is given', () => {
    expect(docPath({ index: 'logs', id: '1', major: 6 })).toBe('/logs/_doc/1');
  });
  it('omits the id when not provided', () => {
    expect(docPath({ index: 'logs', major: 8 })).toBe('/logs/_doc');
  });
});
