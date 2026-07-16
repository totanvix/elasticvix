import { getDb } from './db';
import { HISTORY_CAP } from './history';
import type { SearchHistoryEntry } from '../types';

export async function addSearchHistory(entry: SearchHistoryEntry): Promise<void> {
  const db = await getDb();
  await db.put('searchHistory', entry);
  const keys = await db.getAllKeysFromIndex('searchHistory', 'by-ranAt'); // ascending by ranAt
  const excess = keys.length - HISTORY_CAP;
  if (excess > 0) {
    const tx = db.transaction('searchHistory', 'readwrite');
    for (let i = 0; i < excess; i++) await tx.store.delete(keys[i]!);
    await tx.done;
  }
}

export async function listSearchHistory(): Promise<SearchHistoryEntry[]> {
  const all = await (await getDb()).getAllFromIndex('searchHistory', 'by-ranAt');
  return all.reverse(); // newest first
}

export async function deleteSearchHistory(id: string): Promise<void> {
  await (await getDb()).delete('searchHistory', id);
}

export async function clearSearchHistory(): Promise<void> {
  await (await getDb()).clear('searchHistory');
}
