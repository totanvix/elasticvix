export const ENGAGEMENT_KEY = 'elasticvix.engagement';

/** Explicit runs (REST console + Search) before the nudge first appears. */
export const SHOW_AFTER_RUNS = 15;
/** Extra runs after "Maybe later" before the nudge reappears. */
export const SNOOZE_RUNS = 40;

export const GITHUB_URL = 'https://github.com/totanvix/elasticvix';
export const CWS_REVIEW_URL =
  'https://chromewebstore.google.com/detail/elasticvix-elasticsearch/glnbabapnpecmdaekagajnedgkbhcgad/reviews';

export type EngagementStatus = 'pending' | 'snoozed' | 'dismissed';

export type EngagementState = {
  runs: number;
  status: EngagementStatus;
  snoozedAtRuns: number;
};

export const DEFAULT_ENGAGEMENT: EngagementState = { runs: 0, status: 'pending', snoozedAtRuns: 0 };

export function recordRun(state: EngagementState): EngagementState {
  return { ...state, runs: state.runs + 1 };
}

export function snooze(state: EngagementState): EngagementState {
  return { ...state, status: 'snoozed', snoozedAtRuns: state.runs };
}

export function dismiss(state: EngagementState): EngagementState {
  return { ...state, status: 'dismissed' };
}

export function shouldShowNudge(state: EngagementState): boolean {
  if (state.status === 'pending') return state.runs >= SHOW_AFTER_RUNS;
  if (state.status === 'snoozed') return state.runs >= state.snoozedAtRuns + SNOOZE_RUNS;
  return false;
}

function isEngagementState(v: unknown): v is EngagementState {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.runs === 'number' &&
    typeof o.snoozedAtRuns === 'number' &&
    (o.status === 'pending' || o.status === 'snoozed' || o.status === 'dismissed')
  );
}

export function loadEngagement(): EngagementState {
  const raw = localStorage.getItem(ENGAGEMENT_KEY);
  if (!raw) return DEFAULT_ENGAGEMENT;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isEngagementState(parsed) ? parsed : DEFAULT_ENGAGEMENT;
  } catch {
    return DEFAULT_ENGAGEMENT;
  }
}

export function saveEngagement(state: EngagementState): void {
  localStorage.setItem(ENGAGEMENT_KEY, JSON.stringify(state));
}
