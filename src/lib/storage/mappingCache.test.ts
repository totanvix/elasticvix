import { describe, it, expect, beforeEach } from 'vitest';
import { getCachedFields, setCachedFields, MAPPING_TTL_MS } from './mappingCache';

describe('mapping cache', () => {
  beforeEach(async () => {
    const { getDb } = await import('./db');
    await (await getDb()).clear('mappingCache');
  });

  it('returns cached fields within TTL', async () => {
    await setCachedFields('c', 'logs', [{ path: 'a', type: 'text' }], 1000);
    expect(await getCachedFields('c', 'logs', 1000 + MAPPING_TTL_MS - 1))
      .toEqual([{ path: 'a', type: 'text' }]);
  });
  it('returns undefined when stale', async () => {
    await setCachedFields('c', 'logs', [{ path: 'a', type: 'text' }], 1000);
    expect(await getCachedFields('c', 'logs', 1000 + MAPPING_TTL_MS + 1)).toBeUndefined();
  });
  it('returns undefined when missing', async () => {
    expect(await getCachedFields('c', 'nope')).toBeUndefined();
  });
});
