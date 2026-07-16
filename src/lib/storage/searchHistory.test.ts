import { describe, it, expect, beforeEach } from 'vitest';
import { addSearchHistory, listSearchHistory, deleteSearchHistory, clearSearchHistory } from './searchHistory';
import { HISTORY_CAP } from './history';
import type { SearchHistoryEntry } from '../types';

const entry = (id: string, ranAt: number): SearchHistoryEntry => ({
  id, indices: ['logs-*'], body: '{}', connectionId: 'c', ranAt,
});

describe('search history repo', () => {
  beforeEach(async () => {
    const { getDb } = await import('./db');
    await (await getDb()).clear('searchHistory');
  });

  it('lists newest first', async () => {
    await addSearchHistory(entry('a', 10));
    await addSearchHistory(entry('b', 20));
    expect((await listSearchHistory()).map((h) => h.id)).toEqual(['b', 'a']);
  });
  it('prunes to the newest HISTORY_CAP entries', async () => {
    for (let i = 0; i < HISTORY_CAP + 5; i++) await addSearchHistory(entry(String(i), i));
    const all = await listSearchHistory();
    expect(all).toHaveLength(HISTORY_CAP);
    expect(all[0]!.id).toBe(String(HISTORY_CAP + 4)); // newest kept
    expect(all.some((h) => h.id === '0')).toBe(false); // oldest pruned
  });
  it('deletes a single entry', async () => {
    await addSearchHistory(entry('a', 10));
    await addSearchHistory(entry('b', 20));
    await deleteSearchHistory('a');
    expect((await listSearchHistory()).map((h) => h.id)).toEqual(['b']);
  });
  it('clears all entries', async () => {
    await addSearchHistory(entry('a', 10));
    await addSearchHistory(entry('b', 20));
    await clearSearchHistory();
    expect(await listSearchHistory()).toHaveLength(0);
  });
});
