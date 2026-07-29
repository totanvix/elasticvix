import { describe, it, expect, beforeEach } from 'vitest';
import { makeLoadMapping } from './useIndexMapping';
import type { Connection, FlatField } from '../../lib/types';
import type { MappingResult } from '../../lib/rpc/messages';

const conn: Connection = {
  id: 'c1', name: 'demo', baseUrl: 'http://localhost:9201',
  auth: { type: 'none' }, createdAt: 0, updatedAt: 0,
};
const FIELDS: FlatField[] = [{ path: 'level', type: 'keyword' }, { path: 'msg', type: 'text' }];

describe('makeLoadMapping', () => {
  beforeEach(async () => {
    const { getDb } = await import('../../lib/storage/db');
    await (await getDb()).clear('mappingCache');
  });

  it('fetches, returns fields, and caches (second call skips fetch)', async () => {
    let calls = 0;
    const fetch = async (): Promise<MappingResult> => { calls++; return { fields: FIELDS }; };
    const load = makeLoadMapping(conn, fetch);
    expect(await load('logs')).toEqual({ fields: FIELDS });
    expect(await load('logs')).toEqual({ fields: FIELDS });
    expect(calls).toBe(1);
  });

  it('returns error and does not cache it (retries next time)', async () => {
    let calls = 0;
    const fetch = async (): Promise<MappingResult> => { calls++; return { fields: [], error: 'no_such_index' }; };
    const load = makeLoadMapping(conn, fetch);
    expect(await load('nope')).toEqual({ fields: [], error: 'no_such_index' });
    expect(await load('nope')).toEqual({ fields: [], error: 'no_such_index' });
    expect(calls).toBe(2);
  });

  it('skipCache forces a fetch even when cached', async () => {
    let calls = 0;
    const fetch = async (): Promise<MappingResult> => { calls++; return { fields: FIELDS }; };
    const load = makeLoadMapping(conn, fetch);
    await load('logs');
    await load('logs', { skipCache: true });
    expect(calls).toBe(2);
  });

  it('returns empty without fetching when index is undefined', async () => {
    let calls = 0;
    const fetch = async (): Promise<MappingResult> => { calls++; return { fields: FIELDS }; };
    const load = makeLoadMapping(conn, fetch);
    expect(await load(undefined)).toEqual({ fields: [] });
    expect(calls).toBe(0);
  });
});
