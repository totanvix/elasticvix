import { describe, it, expect, beforeEach } from 'vitest';
import { loadLintEnabled, saveLintEnabled, LINT_ENABLED_KEY } from './useLintEnabled';

describe('lint enabled storage', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to true when unset', () => {
    expect(loadLintEnabled()).toBe(true);
  });
  it('round-trips false', () => {
    saveLintEnabled(false);
    expect(loadLintEnabled()).toBe(false);
  });
  it('round-trips true', () => {
    saveLintEnabled(true);
    expect(loadLintEnabled()).toBe(true);
  });
  it('treats any non-"false" stored value as enabled', () => {
    localStorage.setItem(LINT_ENABLED_KEY, 'garbage');
    expect(loadLintEnabled()).toBe(true);
  });
});
