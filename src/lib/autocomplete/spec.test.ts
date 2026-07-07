import { describe, it, expect } from 'vitest';
import { spec, validateSpec } from './spec';

describe('curated spec', () => {
  it('every endpoint bodyRef and every #ref resolves', () => {
    expect(validateSpec(spec)).toEqual([]);
  });
  it('reports a dangling reference', () => {
    const broken = { endpoints: {}, bodies: { a: { x: '#missing' } } };
    expect(validateSpec(broken as any)).toContain('a.x -> #missing');
  });
});
