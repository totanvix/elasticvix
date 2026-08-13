import { describe, it, expect, beforeEach } from 'vitest';
import {
  CHANGELOG_SEEN_KEY,
  hasUnseenRelease,
  loadLastSeenVersion,
  saveLastSeenVersion,
  seedLastSeenVersion,
} from './changelogLib';
import { RELEASES } from './releases';

describe('hasUnseenRelease', () => {
  it('stays quiet on a fresh profile', () => {
    expect(hasUnseenRelease(null, '1.0.8')).toBe(false);
  });
  it('flags a newer running version', () => {
    expect(hasUnseenRelease('1.0.7', '1.0.8')).toBe(true);
  });
  it('stays quiet once the running version was seen', () => {
    expect(hasUnseenRelease('1.0.8', '1.0.8')).toBe(false);
  });
  it('flags a rollback too — any mismatch counts', () => {
    expect(hasUnseenRelease('1.0.9', '1.0.8')).toBe(true);
  });
});

describe('changelog storage', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when never written', () => {
    expect(loadLastSeenVersion()).toBeNull();
  });
  it('round-trips a version', () => {
    saveLastSeenVersion('1.0.8');
    expect(loadLastSeenVersion()).toBe('1.0.8');
  });
  it('seeds an empty profile', () => {
    seedLastSeenVersion('1.0.8');
    expect(loadLastSeenVersion()).toBe('1.0.8');
  });
  it('does not overwrite an existing value', () => {
    localStorage.setItem(CHANGELOG_SEEN_KEY, '1.0.7');
    seedLastSeenVersion('1.0.9');
    expect(loadLastSeenVersion()).toBe('1.0.7');
  });
});

describe('RELEASES data', () => {
  it('has no duplicate versions', () => {
    const versions = RELEASES.map((r) => r.version);
    expect(new Set(versions).size).toBe(versions.length);
  });
  it('is ordered newest first by date', () => {
    const dates = RELEASES.map((r) => r.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
  it('gives every release at least one change', () => {
    expect(RELEASES.every((r) => r.changes.length > 0)).toBe(true);
  });
});
