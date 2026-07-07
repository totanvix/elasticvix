import { getDb } from './db';
import type { HistoryEntry } from '../types';

export const HISTORY_CAP = 500;

export async function addHistory(entry: HistoryEntry): Promise<void> {
  const db = await getDb();
  await db.put('history', entry);
  const keys = await db.getAllKeysFromIndex('history', 'by-ranAt'); // ascending by ranAt
  const excess = keys.length - HISTORY_CAP;
  if (excess > 0) {
    const tx = db.transaction('history', 'readwrite');
    for (let i = 0; i < excess; i++) await tx.store.delete(keys[i]!);
    await tx.done;
  }
}

export async function listHistory(): Promise<HistoryEntry[]> {
  const all = await (await getDb()).getAllFromIndex('history', 'by-ranAt');
  return all.reverse(); // newest first
}
