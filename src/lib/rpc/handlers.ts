import type { Connection } from '../types';
import { buildAuthHeaders } from '../es/auth';
import { parseMajor } from '../es/version';
import { flattenMapping } from '../es/mapping';
import type { RpcRequest, RpcResponse, EsResult } from './messages';

export interface HandlerDeps { fetchFn?: typeof fetch }

function urlOf(conn: Connection, path: string): string {
  return conn.baseUrl.replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`);
}

async function doEs(
  conn: Connection, method: string, path: string, body: string | undefined, fetchFn: typeof fetch,
): Promise<EsResult> {
  const start = Date.now();
  try {
    const resp = await fetchFn(urlOf(conn, path), {
      method,
      headers: { 'content-type': 'application/json', ...buildAuthHeaders(conn.auth) },
      body: body && method !== 'GET' && method !== 'HEAD' ? body : undefined,
    });
    const text = await resp.text();
    let parsed: unknown = text;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* keep raw text */ }
    return { status: resp.status, took: Date.now() - start, body: parsed };
  } catch (e) {
    return { status: 0, took: Date.now() - start, body: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function handleRpc(msg: RpcRequest, deps: HandlerDeps = {}): Promise<RpcResponse> {
  const fetchFn = deps.fetchFn ?? fetch;

  if (msg.kind === 'esRequest') {
    return { kind: 'esRequest', result: await doEs(msg.connection, msg.method, msg.path, msg.body, fetchFn) };
  }

  if (msg.kind === 'detectVersion') {
    const r = await doEs(msg.connection, 'GET', '/', undefined, fetchFn);
    if (r.error || r.status === 0) return { kind: 'detectVersion', result: { error: r.error ?? 'unreachable' } };
    const version = (r.body as { version?: { number?: string } } | null)?.version?.number;
    return { kind: 'detectVersion', result: { version, major: version ? parseMajor(version) : undefined } };
  }

  // fetchMapping
  const r = await doEs(msg.connection, 'GET', `/${msg.index}/_mapping`, undefined, fetchFn);
  if (r.error || r.status >= 400) return { kind: 'fetchMapping', result: { fields: [], error: r.error ?? `status ${r.status}` } };
  const body = r.body as Record<string, { mappings?: unknown }> | null;
  const first = body ? Object.values(body)[0] : undefined;
  const fields = first?.mappings ? flattenMapping(first.mappings) : [];
  return { kind: 'fetchMapping', result: { fields } };
}
