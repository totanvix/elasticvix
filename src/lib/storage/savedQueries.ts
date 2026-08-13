import { getDb } from './db';
import type { SavedQuery } from '../types';

export async function putSavedQuery(q: SavedQuery): Promise<void> {
  await (await getDb()).put('savedQueries', q);
}

export async function putSavedQueries(qs: SavedQuery[]): Promise<void> {
  const tx = (await getDb()).transaction('savedQueries', 'readwrite');
  await Promise.all([...qs.map((q) => tx.store.put(q)), tx.done]);
}

export async function deleteSavedQuery(id: string): Promise<void> {
  await (await getDb()).delete('savedQueries', id);
}

export async function listSavedQueries(): Promise<SavedQuery[]> {
  return (await getDb()).getAll('savedQueries');
}

export async function searchSavedQueries(opts: { text?: string; tags?: string[] }): Promise<SavedQuery[]> {
  const all = await listSavedQueries();
  const text = opts.text?.trim().toLowerCase();
  return all.filter((q) => {
    if (opts.tags && opts.tags.length > 0 && !opts.tags.every((t) => q.tags.includes(t))) return false;
    if (text && !q.name.toLowerCase().includes(text)) return false;
    return true;
  });
}
