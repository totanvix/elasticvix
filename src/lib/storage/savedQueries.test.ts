import { describe, it, expect, beforeEach } from 'vitest';
import { putSavedQuery, putSavedQueries, listSavedQueries, deleteSavedQuery, searchSavedQueries } from './savedQueries';
import type { SavedQuery } from '../types';

const q = (id: string, name: string, tags: string[]): SavedQuery => ({
  id, name, tags, method: 'GET', path: '/x/_search', body: '{}', createdAt: 1, updatedAt: 1,
});

describe('saved queries repo', () => {
  beforeEach(async () => {
    for (const s of await listSavedQueries()) await deleteSavedQuery(s.id);
  });

  it('stores and lists', async () => {
    await putSavedQuery(q('1', 'prod errors', ['prod']));
    expect((await listSavedQueries()).map((x) => x.id)).toEqual(['1']);
  });
  it('bulk-puts: inserts new and overwrites existing in one call', async () => {
    await putSavedQuery(q('1', 'old', []));
    await putSavedQueries([q('1', 'new', []), q('2', 'b', [])]);
    const all = await listSavedQueries();
    expect(all.map((x) => `${x.id}:${x.name}`).sort()).toEqual(['1:new', '2:b']);
  });
  it('filters by tag', async () => {
    await putSavedQuery(q('1', 'a', ['prod']));
    await putSavedQuery(q('2', 'b', ['dev']));
    const r = await searchSavedQueries({ tags: ['prod'] });
    expect(r.map((x) => x.id)).toEqual(['1']);
  });
  it('filters by name text (case-insensitive)', async () => {
    await putSavedQuery(q('1', 'Slow Query', []));
    await putSavedQuery(q('2', 'Fast', []));
    const r = await searchSavedQueries({ text: 'slow' });
    expect(r.map((x) => x.id)).toEqual(['1']);
  });
});
