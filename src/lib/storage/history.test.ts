import { describe, it, expect, beforeEach } from 'vitest';
import { addHistory, listHistory, HISTORY_CAP } from './history';
import type { HistoryEntry } from '../types';

const entry = (id: string, ranAt: number): HistoryEntry => ({
  id, method: 'GET', path: '/x/_search', body: '{}', connectionId: 'c', ranAt,
});

describe('history repo', () => {
  beforeEach(async () => {
    const { getDb } = await import('./db');
    await (await getDb()).clear('history');
  });

  it('lists newest first', async () => {
    await addHistory(entry('a', 10));
    await addHistory(entry('b', 20));
    expect((await listHistory()).map((h) => h.id)).toEqual(['b', 'a']);
  });
  it('prunes to the newest HISTORY_CAP entries', async () => {
    for (let i = 0; i < HISTORY_CAP + 5; i++) await addHistory(entry(String(i), i));
    const all = await listHistory();
    expect(all).toHaveLength(HISTORY_CAP);
    expect(all[0]!.id).toBe(String(HISTORY_CAP + 4)); // newest kept
    expect(all.some((h) => h.id === '0')).toBe(false); // oldest pruned
  });
});
