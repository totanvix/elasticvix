import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from './relativeTime';

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const NOW = 1_750_000_000_000;

describe('formatRelativeTime', () => {
  it('returns "just now" for timestamps under a minute old', () => {
    expect(formatRelativeTime(NOW, NOW)).toBe('just now');
    expect(formatRelativeTime(NOW, NOW - 59_999)).toBe('just now');
  });
  it('returns "just now" for future timestamps (clock skew)', () => {
    expect(formatRelativeTime(NOW, NOW + 5 * MINUTE)).toBe('just now');
  });
  it('formats minutes', () => {
    expect(formatRelativeTime(NOW, NOW - MINUTE)).toBe('1m ago');
    expect(formatRelativeTime(NOW, NOW - 59 * MINUTE)).toBe('59m ago');
  });
  it('formats hours', () => {
    expect(formatRelativeTime(NOW, NOW - HOUR)).toBe('1h ago');
    expect(formatRelativeTime(NOW, NOW - 23 * HOUR)).toBe('23h ago');
  });
  it('formats days under a week', () => {
    expect(formatRelativeTime(NOW, NOW - DAY)).toBe('1d ago');
    expect(formatRelativeTime(NOW, NOW - 6 * DAY)).toBe('6d ago');
  });
  it('falls back to a locale date at 7 days and beyond', () => {
    const ts = NOW - 7 * DAY;
    expect(formatRelativeTime(NOW, ts)).toBe(new Date(ts).toLocaleDateString());
  });
});
