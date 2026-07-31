import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_ENGAGEMENT,
  ENGAGEMENT_KEY,
  SHOW_AFTER_RUNS,
  SNOOZE_RUNS,
  dismiss,
  loadEngagement,
  recordRun,
  saveEngagement,
  shouldShowNudge,
  snooze,
  type EngagementState,
} from './engagementLib';

describe('engagement transitions', () => {
  it('recordRun increments runs without mutating input', () => {
    const state = DEFAULT_ENGAGEMENT;
    const next = recordRun(state);
    expect(next.runs).toBe(1);
    expect(state.runs).toBe(0);
  });

  it('snooze keeps runs and remembers the snooze point', () => {
    const state: EngagementState = { runs: 20, status: 'pending', snoozedAtRuns: 0 };
    const next = snooze(state);
    expect(next).toEqual({ runs: 20, status: 'snoozed', snoozedAtRuns: 20 });
  });

  it('dismiss is terminal', () => {
    const next = dismiss({ runs: 20, status: 'pending', snoozedAtRuns: 0 });
    expect(next.status).toBe('dismissed');
  });
});

describe('shouldShowNudge', () => {
  it('hides before the run threshold', () => {
    expect(shouldShowNudge({ runs: SHOW_AFTER_RUNS - 1, status: 'pending', snoozedAtRuns: 0 })).toBe(false);
  });

  it('shows once pending reaches the threshold', () => {
    expect(shouldShowNudge({ runs: SHOW_AFTER_RUNS, status: 'pending', snoozedAtRuns: 0 })).toBe(true);
  });

  it('hides right after snooze', () => {
    const state = snooze({ runs: SHOW_AFTER_RUNS, status: 'pending', snoozedAtRuns: 0 });
    expect(shouldShowNudge(state)).toBe(false);
  });

  it('shows again after enough runs past the snooze point', () => {
    const snoozed = snooze({ runs: SHOW_AFTER_RUNS, status: 'pending', snoozedAtRuns: 0 });
    const state: EngagementState = { ...snoozed, runs: snoozed.snoozedAtRuns + SNOOZE_RUNS };
    expect(shouldShowNudge(state)).toBe(true);
  });

  it('never shows after dismiss, regardless of runs', () => {
    expect(shouldShowNudge({ runs: 1000, status: 'dismissed', snoozedAtRuns: 0 })).toBe(false);
  });
});

describe('engagement storage', () => {
  beforeEach(() => localStorage.clear());

  it('defaults when unset', () => {
    expect(loadEngagement()).toEqual(DEFAULT_ENGAGEMENT);
  });

  it('round-trips a state', () => {
    const state: EngagementState = { runs: 7, status: 'snoozed', snoozedAtRuns: 5 };
    saveEngagement(state);
    expect(loadEngagement()).toEqual(state);
  });

  it('falls back to default on corrupt JSON', () => {
    localStorage.setItem(ENGAGEMENT_KEY, '{not json');
    expect(loadEngagement()).toEqual(DEFAULT_ENGAGEMENT);
  });

  it('falls back to default on wrong shape', () => {
    localStorage.setItem(ENGAGEMENT_KEY, JSON.stringify({ runs: 'many', status: 'pending' }));
    expect(loadEngagement()).toEqual(DEFAULT_ENGAGEMENT);
  });
});
