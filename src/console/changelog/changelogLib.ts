export const CHANGELOG_SEEN_KEY = 'elasticvix.changelog.lastSeenVersion';

// null means the key was never written — a fresh profile, which stays quiet.
// We cannot tell a first install from an upgrade without an onInstalled listener,
// so a new user is never pointed at releases they never missed.
export function hasUnseenRelease(stored: string | null, running: string): boolean {
  if (stored === null) return false;
  return stored !== running;
}

export function loadLastSeenVersion(): string | null {
  return localStorage.getItem(CHANGELOG_SEEN_KEY);
}

export function saveLastSeenVersion(version: string): void {
  localStorage.setItem(CHANGELOG_SEEN_KEY, version);
}

export function seedLastSeenVersion(running: string): void {
  if (localStorage.getItem(CHANGELOG_SEEN_KEY) === null) saveLastSeenVersion(running);
}

// Cap the bullets shown in the update toast — a narrow card can't hold a long
// release. `remaining` drives a "+N more" line that points at the full dialog.
export function previewChanges(
  changes: readonly string[],
  max: number,
): { shown: readonly string[]; remaining: number } {
  return { shown: changes.slice(0, max), remaining: Math.max(0, changes.length - max) };
}
