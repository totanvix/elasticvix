import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { esRequest } from './client';
import type { Connection } from '../types';
import type { RpcRequest, RpcResponse } from './messages';

const conn: Connection = {
  id: 'c', name: 'c', baseUrl: 'http://es:9200', auth: { type: 'none' }, createdAt: 1, updatedAt: 1,
};

describe('rpc client', () => {
  beforeEach(() => fakeBrowser.reset());

  it('sends an esRequest message and unwraps the result', async () => {
    const spy = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({
      kind: 'esRequest', result: { status: 200, took: 3, body: { ok: true } },
    } satisfies RpcResponse as any);

    const result = await esRequest(conn, 'GET', '/x/_search');
    expect(result).toEqual({ status: 200, took: 3, body: { ok: true } });
    const sent = spy.mock.calls[0]![0] as unknown as RpcRequest;
    expect(sent.kind).toBe('esRequest');
  });
});
