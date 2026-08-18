import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_TEXT, loadConsoleText, persistConsoleText } from './consolePersistence';

describe('console text persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips text per connection', () => {
    persistConsoleText('c1', 'GET /a/_search\n{}');
    persistConsoleText('c2', 'GET /b/_search\n{}');
    expect(loadConsoleText('c1')).toBe('GET /a/_search\n{}');
    expect(loadConsoleText('c2')).toBe('GET /b/_search\n{}');
  });
  it('falls back to the default when nothing is stored', () => {
    expect(loadConsoleText('missing')).toBe(DEFAULT_TEXT);
  });
  it('falls back to the default on corrupted storage', () => {
    localStorage.setItem('elasticvix.console.c1', 'not json');
    expect(loadConsoleText('c1')).toBe(DEFAULT_TEXT);
  });
  it('falls back to the default on a wrong shape', () => {
    localStorage.setItem('elasticvix.console.c1', JSON.stringify({ text: 42 }));
    expect(loadConsoleText('c1')).toBe(DEFAULT_TEXT);
  });
});
