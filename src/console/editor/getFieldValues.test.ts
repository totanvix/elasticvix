import { describe, it, expect, beforeEach } from 'vitest';
import { makeGetFieldValues, buildFieldValuesBody, parseFieldValues } from './getFieldValues';
import type { Connection } from '../../lib/types';
import type { EsResult } from '../../lib/rpc/messages';

const conn: Connection = {
  id: 'c1', name: 'demo', baseUrl: 'http://localhost:9201',
  auth: { type: 'none' }, createdAt: 0, updatedAt: 0,
};

function okResult(keys: (string | number | boolean)[]): EsResult {
  return {
    status: 200, took: 1,
    body: { aggregations: { vix_values: { buckets: keys.map((k) => ({ key: k, doc_count: 1 })) } } },
  };
}

describe('parseFieldValues', () => {
  it('extracts bucket keys', () => {
    expect(parseFieldValues(okResult(['open', 'closed']).body)).toEqual(['open', 'closed']);
  });
  it('returns [] when aggregations missing', () => {
    expect(parseFieldValues({ hits: {} })).toEqual([]);
    expect(parseFieldValues(null)).toEqual([]);
  });
  it('coerces non-string keys to string', () => {
    expect(parseFieldValues(okResult([1, true]).body)).toEqual(['1', 'true']);
  });
});

describe('buildFieldValuesBody', () => {
  it('builds a size:0 terms agg body', () => {
    expect(JSON.parse(buildFieldValuesBody('status', 20))).toEqual({
      size: 0, aggs: { vix_values: { terms: { field: 'status', size: 20 } } },
    });
  });
});

describe('makeGetFieldValues', () => {
  beforeEach(async () => {
    const { getDb } = await import('../../lib/storage/db');
    await (await getDb()).clear('fieldValuesCache');
  });

  it('fetches, returns values, and caches (second call skips the request)', async () => {
    let calls = 0;
    const request = async (): Promise<EsResult> => { calls++; return okResult(['open', 'closed']); };
    const get = makeGetFieldValues(conn, request);
    expect(await get('logs', 'status')).toEqual(['open', 'closed']);
    expect(await get('logs', 'status')).toEqual(['open', 'closed']);
    expect(calls).toBe(1);
  });

  it('returns [] on error and negative-caches it', async () => {
    let calls = 0;
    const request = async (): Promise<EsResult> => {
      calls++; return { status: 400, took: 1, body: null, error: 'bad_field' };
    };
    const get = makeGetFieldValues(conn, request);
    expect(await get('logs', 'bad')).toEqual([]);
    expect(await get('logs', 'bad')).toEqual([]);
    expect(calls).toBe(1);
  });

  it('returns [] when index is missing without calling the request', async () => {
    let calls = 0;
    const request = async (): Promise<EsResult> => { calls++; return okResult(['x']); };
    const get = makeGetFieldValues(conn, request);
    expect(await get(undefined, 'status')).toEqual([]);
    expect(calls).toBe(0);
  });
});
