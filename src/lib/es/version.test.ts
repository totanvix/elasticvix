import { describe, it, expect } from 'vitest';
import { parseMajor } from './version';

describe('parseMajor', () => {
  it.each([
    ['6.5.4', 6], ['7.17.0', 7], ['8.13.1', 8], ['9.0.0', 9],
  ])('maps %s to major %i', (v, major) => {
    expect(parseMajor(v)).toBe(major);
  });
  it('returns undefined for unsupported or garbage versions', () => {
    expect(parseMajor('5.6.0')).toBeUndefined();
    expect(parseMajor('nonsense')).toBeUndefined();
  });
});
