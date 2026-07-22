import type { Connection } from '../types';
import { buildAuthHeaders } from '../es/auth';
import { parseMajor } from '../es/version';
import { flattenMapping } from '../es/mapping';
import type { RpcRequest, RpcResponse, EsResult } from './messages';

export interface HandlerDeps { fetchFn?: typeof fetch; timeoutMs?: number }

// Without a deadline a black-holed connection (VPN just came up, stale DNS,
// server accepts TCP but never answers) hangs fetch forever and the console
// stays stuck on "Searching…". 30s matches the Elasticsearch client default.
const REQUEST_TIMEOUT_MS = 30_000;

function urlOf(conn: Connection, path: string): string {
  return conn.baseUrl.replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`);
}

async function doEs(
  conn: Connection, method: string, path: string, body: string | undefined,
  fetchFn: typeof fetch, timeoutMs: number,
): Promise<EsResult> {
  const start = Date.now();
  // ES commonly sends a query body with GET /_search, but the Fetch API forbids
  // a GET/HEAD body. Mirror Kibana Dev Tools: promote such calls to POST so the
  // body is not silently dropped. Uppercase first so a lowercase verb can't slip.
  const upper = method.toUpperCase();
  const hasBody = body != null && body !== '';
  const effectiveMethod = hasBody && (upper === 'GET' || upper === 'HEAD') ? 'POST' : upper;
  try {
    const resp = await fetchFn(urlOf(conn, path), {
      method: effectiveMethod,
      headers: { 'content-type': 'application/json', ...buildAuthHeaders(conn.auth) },
      body: hasBody && effectiveMethod !== 'GET' && effectiveMethod !== 'HEAD' ? body : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await resp.text();
    let parsed: unknown = text;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* keep raw text */ }
    return { status: resp.status, took: Date.now() - start, body: parsed };
  } catch (e) {
    // Match by name, not instanceof: the DOMException constructor can come from
    // a different realm than the signal's reason (e.g. jsdom vs Node in tests).
    const isTimeout = typeof e === 'object' && e !== null && (e as { name?: string }).name === 'TimeoutError';
    const message = isTimeout
      ? `Request timed out after ${Math.round(timeoutMs / 1000)}s`
      : e instanceof Error ? e.message : String(e);
    return { status: 0, took: Date.now() - start, body: null, error: message };
  }
}

export async function handleRpc(msg: RpcRequest, deps: HandlerDeps = {}): Promise<RpcResponse> {
  const fetchFn = deps.fetchFn ?? fetch;
  const timeoutMs = deps.timeoutMs ?? REQUEST_TIMEOUT_MS;

  if (msg.kind === 'esRequest') {
    return { kind: 'esRequest', result: await doEs(msg.connection, msg.method, msg.path, msg.body, fetchFn, timeoutMs) };
  }

  if (msg.kind === 'detectVersion') {
    const r = await doEs(msg.connection, 'GET', '/', undefined, fetchFn, timeoutMs);
    if (r.error || r.status === 0) return { kind: 'detectVersion', result: { error: r.error ?? 'unreachable' } };
    if (r.status >= 400) return { kind: 'detectVersion', result: { error: `status ${r.status}` } };
    const version = (r.body as { version?: { number?: string } } | null)?.version?.number;
    return { kind: 'detectVersion', result: { version, major: version ? parseMajor(version) : undefined } };
  }

  // fetchMapping
  const r = await doEs(msg.connection, 'GET', `/${msg.index}/_mapping`, undefined, fetchFn, timeoutMs);
  if (r.error || r.status >= 400) return { kind: 'fetchMapping', result: { fields: [], error: r.error ?? `status ${r.status}` } };
  const body = r.body as Record<string, { mappings?: unknown }> | null;
  const first = body ? Object.values(body)[0] : undefined;
  const fields = first?.mappings ? flattenMapping(first.mappings) : [];
  return { kind: 'fetchMapping', result: { fields } };
}
