import { describe, it, expect, vi } from 'vitest';
import { handleRpc } from './handlers';
import type { Connection } from '../types';

const conn: Connection = {
  id: 'c', name: 'c', baseUrl: 'http://es:9200',
  auth: { type: 'basic', username: 'u', password: 'p' }, createdAt: 1, updatedAt: 1,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('handleRpc', () => {
  it('esRequest sends auth header and returns status + parsed body', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { took: 5, hits: {} }));
    const res = await handleRpc({ kind: 'esRequest', connection: conn, method: 'GET', path: '/x/_search' }, { fetchFn });
    expect(res.kind).toBe('esRequest');
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('http://es:9200/x/_search');
    expect((init.headers as Record<string, string>).Authorization).toBe('Basic ' + btoa('u:p'));
    if (res.kind === 'esRequest') {
      expect(res.result.status).toBe(200);
      expect(res.result.body).toEqual({ took: 5, hits: {} });
    }
  });

  it('detectVersion extracts version and major from GET /', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { version: { number: '6.5.4' } }));
    const res = await handleRpc({ kind: 'detectVersion', connection: conn }, { fetchFn });
    if (res.kind === 'detectVersion') {
      expect(res.result.version).toBe('6.5.4');
      expect(res.result.major).toBe(6);
    }
  });

  it('fetchMapping flattens the mapping for the index', async () => {
    const body = { logs: { mappings: { properties: { msg: { type: 'text' } } } } };
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, body));
    const res = await handleRpc({ kind: 'fetchMapping', connection: conn, index: 'logs' }, { fetchFn });
    if (res.kind === 'fetchMapping') {
      expect(res.result.fields).toEqual([{ path: 'msg', type: 'text' }]);
    }
  });

  it('esRequest reports a transport error instead of throwing', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const res = await handleRpc({ kind: 'esRequest', connection: conn, method: 'GET', path: '/' }, { fetchFn });
    if (res.kind === 'esRequest') {
      expect(res.result.status).toBe(0);
      expect(res.result.error).toContain('Failed to fetch');
    }
  });
});
