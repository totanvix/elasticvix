import { describe, it, expect, beforeEach } from 'vitest';
import { getCachedFieldValues, setCachedFieldValues, FIELD_VALUES_TTL_MS } from './fieldValuesCache';

describe('field values cache', () => {
  beforeEach(async () => {
    const { getDb } = await import('./db');
    await (await getDb()).clear('fieldValuesCache');
  });

  it('returns cached values within TTL', async () => {
    await setCachedFieldValues('c', 'logs', 'status', ['open', 'closed'], 1000);
    expect(await getCachedFieldValues('c', 'logs', 'status', 1000 + FIELD_VALUES_TTL_MS - 1))
      .toEqual(['open', 'closed']);
  });
  it('returns a cached empty (negative) result within TTL', async () => {
    await setCachedFieldValues('c', 'logs', 'bad', [], 1000);
    expect(await getCachedFieldValues('c', 'logs', 'bad', 1000)).toEqual([]);
  });
  it('returns undefined when stale', async () => {
    await setCachedFieldValues('c', 'logs', 'status', ['open'], 1000);
    expect(await getCachedFieldValues('c', 'logs', 'status', 1000 + FIELD_VALUES_TTL_MS + 1)).toBeUndefined();
  });
  it('returns undefined when missing', async () => {
    expect(await getCachedFieldValues('c', 'logs', 'nope')).toBeUndefined();
  });
});
