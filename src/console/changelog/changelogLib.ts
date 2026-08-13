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
