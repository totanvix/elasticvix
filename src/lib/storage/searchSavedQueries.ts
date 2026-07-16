import { getDb } from './db';
import type { SearchSavedQuery } from '../types';

export async function putSearchSavedQuery(q: SearchSavedQuery): Promise<void> {
  await (await getDb()).put('searchSavedQueries', q);
}

export async function deleteSearchSavedQuery(id: string): Promise<void> {
  await (await getDb()).delete('searchSavedQueries', id);
}

export async function listSearchSavedQueries(): Promise<SearchSavedQuery[]> {
  return (await getDb()).getAll('searchSavedQueries');
}

export async function searchSearchSavedQueries(opts: { text?: string; tags?: string[] }): Promise<SearchSavedQuery[]> {
  const all = await listSearchSavedQueries();
  const text = opts.text?.trim().toLowerCase();
  return all.filter((q) => {
    if (opts.tags && opts.tags.length > 0 && !opts.tags.every((t) => q.tags.includes(t))) return false;
    if (text && !q.name.toLowerCase().includes(text)) return false;
    return true;
  });
}
