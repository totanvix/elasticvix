const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 7 * DAY;

export function formatRelativeTime(now: number, ts: number): string {
  const diff = now - ts;
  if (diff < MINUTE) return 'just now'; // includes future ts (clock skew)
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(ts).toLocaleDateString();
}
