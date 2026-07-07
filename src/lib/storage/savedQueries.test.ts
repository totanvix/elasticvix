import { describe, it, expect, beforeEach } from 'vitest';
import { putSavedQuery, listSavedQueries, deleteSavedQuery, searchSavedQueries } from './savedQueries';
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
