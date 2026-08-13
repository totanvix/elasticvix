import type { AuthConfig, Connection, SavedQuery, SearchSavedQuery } from '../types';
import { getActiveConnectionId, listConnections, saveConnections, setActiveConnectionId } from './connections';
import { listSavedQueries, putSavedQueries } from './savedQueries';
import { listSearchSavedQueries, putSearchSavedQueries } from './searchSavedQueries';

export const EXPORT_FORMAT = 'elasticvix-export';
export const EXPORT_VERSION = 1;

export interface ExportEnvelope {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: number;
  includesCredentials: boolean;
  connections: Connection[];
  activeConnectionId?: string;
  savedQueries: SavedQuery[];
  searchSavedQueries: SearchSavedQuery[];
}

export type ParseResult = { ok: true; envelope: ExportEnvelope } | { ok: false; error: string };

export interface ImportSummary {
  connections: number;
  savedQueries: number;
  searchSavedQueries: number;
}

export function stripCredentials(connections: Connection[]): Connection[] {
  return connections.map((c) => ({ ...c, auth: { type: 'none' } }));
}

export async function buildExport(opts: { includeCredentials: boolean }): Promise<ExportEnvelope> {
  const [connections, activeConnectionId, savedQueries, searchSavedQueries] = await Promise.all([
    listConnections(),
    getActiveConnectionId(),
    listSavedQueries(),
    listSearchSavedQueries(),
  ]);
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    includesCredentials: opts.includeCredentials,
    connections: opts.includeCredentials ? connections : stripCredentials(connections),
    ...(activeConnectionId !== undefined && { activeConnectionId }),
    savedQueries,
    searchSavedQueries,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isAuthConfig(v: unknown): v is AuthConfig {
  if (!isRecord(v)) return false;
  if (v.type === 'none') return true;
  if (v.type === 'basic') return typeof v.username === 'string' && typeof v.password === 'string';
  if (v.type === 'apiKey') return typeof v.apiKey === 'string';
  if (v.type === 'bearer') return typeof v.token === 'string';
  return false;
}

function isConnection(v: unknown): v is Connection {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.baseUrl === 'string' &&
    isAuthConfig(v.auth) &&
    (v.version === undefined || typeof v.version === 'string') &&
    (v.major === undefined || typeof v.major === 'number') &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number'
  );
}

function isSavedQuery(v: unknown): v is SavedQuery {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    isStringArray(v.tags) &&
    typeof v.method === 'string' &&
    typeof v.path === 'string' &&
    typeof v.body === 'string' &&
    (v.connectionId === undefined || typeof v.connectionId === 'string') &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number'
  );
}

function isSearchSavedQuery(v: unknown): v is SearchSavedQuery {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    isStringArray(v.tags) &&
    isStringArray(v.indices) &&
    typeof v.body === 'string' &&
    (v.connectionId === undefined || typeof v.connectionId === 'string') &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number'
  );
}

function validateItems<T>(
  arr: unknown[],
  guard: (v: unknown) => v is T,
  section: string,
  noun: string,
): { ok: true; items: T[] } | { ok: false; error: string } {
  const items: T[] = [];
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (!guard(item)) return { ok: false, error: `${section}[${i}] is not a valid ${noun}.` };
    items.push(item);
  }
  return { ok: true, items };
}

export function parseExport(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Not valid JSON.' };
  }
  if (!isRecord(raw) || raw.format !== EXPORT_FORMAT || typeof raw.version !== 'number') {
    return { ok: false, error: 'Not an Elasticvix export file.' };
  }
  if (raw.version > EXPORT_VERSION) {
    return { ok: false, error: 'This file was created by a newer version of Elasticvix.' };
  }
  if (!Array.isArray(raw.connections) || !Array.isArray(raw.savedQueries) || !Array.isArray(raw.searchSavedQueries)) {
    return { ok: false, error: 'The file is missing data sections.' };
  }
  const connections = validateItems(raw.connections, isConnection, 'connections', 'connection');
  if (!connections.ok) return connections;
  const savedQueries = validateItems(raw.savedQueries, isSavedQuery, 'savedQueries', 'saved query');
  if (!savedQueries.ok) return savedQueries;
  const searchSavedQueries = validateItems(
    raw.searchSavedQueries,
    isSearchSavedQuery,
    'searchSavedQueries',
    'saved query',
  );
  if (!searchSavedQueries.ok) return searchSavedQueries;
  if (raw.activeConnectionId !== undefined && typeof raw.activeConnectionId !== 'string') {
    return { ok: false, error: 'activeConnectionId is not valid.' };
  }
  return {
    ok: true,
    envelope: {
      format: EXPORT_FORMAT,
      version: raw.version,
      exportedAt: typeof raw.exportedAt === 'number' ? raw.exportedAt : 0,
      includesCredentials: raw.includesCredentials === true,
      connections: connections.items,
      ...(raw.activeConnectionId !== undefined && { activeConnectionId: raw.activeConnectionId }),
      savedQueries: savedQueries.items,
      searchSavedQueries: searchSavedQueries.items,
    },
  };
}

export function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const incomingById = new Map(incoming.map((item) => [item.id, item]));
  const existingIds = new Set(existing.map((item) => item.id));
  const merged = existing.map((item) => incomingById.get(item.id) ?? item);
  const added = [...incomingById.values()].filter((item) => !existingIds.has(item.id));
  return [...merged, ...added];
}

export async function applyImport(envelope: ExportEnvelope): Promise<ImportSummary> {
  const existing = await listConnections();
  const existingById = new Map(existing.map((c) => [c.id, c]));
  // With credentials stripped on export, an incoming auth of 'none' is a lossy
  // artifact — keep the working auth of the same-id existing connection.
  const incoming = envelope.includesCredentials
    ? envelope.connections
    : envelope.connections.map((c) => {
        const current = existingById.get(c.id);
        if (c.auth.type === 'none' && current && current.auth.type !== 'none') return { ...c, auth: current.auth };
        return c;
      });
  const merged = mergeById(existing, incoming);
  await saveConnections(merged);

  const currentActive = await getActiveConnectionId();
  if (
    currentActive === undefined &&
    envelope.activeConnectionId !== undefined &&
    merged.some((c) => c.id === envelope.activeConnectionId)
  ) {
    await setActiveConnectionId(envelope.activeConnectionId);
  }

  await putSavedQueries(envelope.savedQueries);
  await putSearchSavedQueries(envelope.searchSavedQueries);

  return {
    connections: envelope.connections.length,
    savedQueries: envelope.savedQueries.length,
    searchSavedQueries: envelope.searchSavedQueries.length,
  };
}
