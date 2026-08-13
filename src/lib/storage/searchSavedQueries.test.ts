import { describe, it, expect, beforeEach } from 'vitest';
import {
  putSearchSavedQuery,
  putSearchSavedQueries,
  listSearchSavedQueries,
  deleteSearchSavedQuery,
  searchSearchSavedQueries,
} from './searchSavedQueries';
import type { SearchSavedQuery } from '../types';

const q = (id: string, name: string, tags: string[]): SearchSavedQuery => ({
  id, name, tags, indices: ['logs-*'], body: '{}', createdAt: 1, updatedAt: 1,
});

describe('search saved queries repo', () => {
  beforeEach(async () => {
    for (const s of await listSearchSavedQueries()) await deleteSearchSavedQuery(s.id);
  });

  it('stores and lists', async () => {
    await putSearchSavedQuery(q('1', 'prod errors', ['prod']));
    expect((await listSearchSavedQueries()).map((x) => x.id)).toEqual(['1']);
  });
  it('deletes', async () => {
    await putSearchSavedQuery(q('1', 'a', []));
    await deleteSearchSavedQuery('1');
    expect(await listSearchSavedQueries()).toHaveLength(0);
  });
  it('bulk-puts: inserts new and overwrites existing in one call', async () => {
    await putSearchSavedQuery(q('1', 'old', []));
    await putSearchSavedQueries([q('1', 'new', []), q('2', 'b', [])]);
    const all = await listSearchSavedQueries();
    expect(all.map((x) => `${x.id}:${x.name}`).sort()).toEqual(['1:new', '2:b']);
  });
  it('filters by tag', async () => {
    await putSearchSavedQuery(q('1', 'a', ['prod']));
    await putSearchSavedQuery(q('2', 'b', ['dev']));
    const r = await searchSearchSavedQueries({ tags: ['prod'] });
    expect(r.map((x) => x.id)).toEqual(['1']);
  });
  it('filters by name text (case-insensitive)', async () => {
    await putSearchSavedQuery(q('1', 'Slow Query', []));
    await putSearchSavedQuery(q('2', 'Fast', []));
    const r = await searchSearchSavedQueries({ text: 'slow' });
    expect(r.map((x) => x.id)).toEqual(['1']);
  });
});
