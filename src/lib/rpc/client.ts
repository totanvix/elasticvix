import type { Connection } from '../types';
import type { RpcRequest, RpcResponse, EsResult, VersionResult, MappingResult } from './messages';

async function send(msg: RpcRequest): Promise<RpcResponse> {
  return (await browser.runtime.sendMessage(msg)) as RpcResponse;
}

export async function esRequest(
  connection: Connection, method: string, path: string, body?: string,
): Promise<EsResult> {
  const res = await send({ kind: 'esRequest', connection, method, path, body });
  if (res.kind !== 'esRequest') throw new Error('unexpected rpc response');
  return res.result;
}

export async function detectVersion(connection: Connection): Promise<VersionResult> {
  const res = await send({ kind: 'detectVersion', connection });
  if (res.kind !== 'detectVersion') throw new Error('unexpected rpc response');
  return res.result;
}

export async function fetchMapping(connection: Connection, index: string): Promise<MappingResult> {
  const res = await send({ kind: 'fetchMapping', connection, index });
  if (res.kind !== 'fetchMapping') throw new Error('unexpected rpc response');
  return res.result;
}
