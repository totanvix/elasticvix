import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  applyImport,
  buildExport,
  mergeById,
  parseExport,
  stripCredentials,
  type ExportEnvelope,
} from './backup';
import { getActiveConnectionId, listConnections, saveConnection, setActiveConnectionId } from './connections';
import { deleteSavedQuery, listSavedQueries, putSavedQuery } from './savedQueries';
import { deleteSearchSavedQuery, listSearchSavedQueries, putSearchSavedQuery } from './searchSavedQueries';
import type { AuthConfig, Connection, SavedQuery, SearchSavedQuery } from '../types';

const conn = (id: string, auth: AuthConfig = { type: 'none' }): Connection => ({
  id, name: id, baseUrl: 'http://localhost:9200', auth, createdAt: 1, updatedAt: 1,
});

const sq = (id: string): SavedQuery => ({
  id, name: id, tags: ['t'], method: 'GET', path: '/x/_search', body: '{}', createdAt: 1, updatedAt: 1,
});

const ssq = (id: string): SearchSavedQuery => ({
  id, name: id, tags: [], indices: ['logs-*'], body: '{}', createdAt: 1, updatedAt: 1,
});

const envelope = (over: Partial<ExportEnvelope> = {}): ExportEnvelope => ({
  format: EXPORT_FORMAT,
  version: EXPORT_VERSION,
  exportedAt: 5,
  includesCredentials: true,
  connections: [],
  savedQueries: [],
  searchSavedQueries: [],
  ...over,
});

beforeEach(async () => {
  fakeBrowser.reset();
  for (const s of await listSavedQueries()) await deleteSavedQuery(s.id);
  for (const s of await listSearchSavedQueries()) await deleteSearchSavedQuery(s.id);
});

describe('stripCredentials', () => {
  it('replaces every auth type with none and keeps other fields', () => {
    const input = [
      conn('a', { type: 'basic', username: 'u', password: 'p' }),
      conn('b', { type: 'apiKey', apiKey: 'k' }),
      conn('c', { type: 'bearer', token: 't' }),
      conn('d'),
    ];
    const out = stripCredentials(input);
    expect(out.map((c) => c.auth)).toEqual([{ type: 'none' }, { type: 'none' }, { type: 'none' }, { type: 'none' }]);
    expect(out[0]!.baseUrl).toBe('http://localhost:9200');
    expect(out[3]).not.toBe(input[3]);
  });
  it('does not mutate the input', () => {
    const input = [conn('a', { type: 'basic', username: 'u', password: 'p' })];
    stripCredentials(input);
    expect(input[0]!.auth).toEqual({ type: 'basic', username: 'u', password: 'p' });
  });
});

describe('buildExport', () => {
  it('builds an envelope with credentials when enabled', async () => {
    await saveConnection(conn('a', { type: 'basic', username: 'u', password: 'p' }));
    await setActiveConnectionId('a');
    await putSavedQuery(sq('q1'));
    await putSearchSavedQuery(ssq('s1'));
    const env = await buildExport({ includeCredentials: true });
    expect(env.format).toBe(EXPORT_FORMAT);
    expect(env.version).toBe(EXPORT_VERSION);
    expect(env.includesCredentials).toBe(true);
    expect(env.connections[0]!.auth).toEqual({ type: 'basic', username: 'u', password: 'p' });
    expect(env.activeConnectionId).toBe('a');
    expect(env.savedQueries.map((q) => q.id)).toEqual(['q1']);
    expect(env.searchSavedQueries.map((q) => q.id)).toEqual(['s1']);
  });
  it('strips credentials when disabled', async () => {
    await saveConnection(conn('a', { type: 'apiKey', apiKey: 'secret' }));
    const env = await buildExport({ includeCredentials: false });
    expect(env.includesCredentials).toBe(false);
    expect(env.connections[0]!.auth).toEqual({ type: 'none' });
  });
  it('omits activeConnectionId when unset', async () => {
    const env = await buildExport({ includeCredentials: false });
    expect('activeConnectionId' in env).toBe(false);
  });
});

describe('parseExport', () => {
  it('rejects invalid JSON', () => {
    expect(parseExport('{not json')).toEqual({ ok: false, error: 'Not valid JSON.' });
  });
  it('rejects non-object roots and foreign files', () => {
    expect(parseExport('[]').ok).toBe(false);
    expect(parseExport('"str"').ok).toBe(false);
    expect(parseExport(JSON.stringify({ format: 'other-app', version: 1 }))).toEqual({
      ok: false,
      error: 'Not an Elasticvix export file.',
    });
  });
  it('rejects files from a newer export version', () => {
    const r = parseExport(JSON.stringify(envelope({ version: EXPORT_VERSION + 1 })));
    expect(r).toEqual({ ok: false, error: 'This file was created by a newer version of Elasticvix.' });
  });
  it('rejects missing sections', () => {
    const { savedQueries: _dropped, ...rest } = envelope();
    expect(parseExport(JSON.stringify(rest))).toEqual({ ok: false, error: 'The file is missing data sections.' });
  });
  it('rejects invalid items with an indexed message', () => {
    const bad = parseExport(JSON.stringify(envelope({ connections: [conn('a'), { id: 1 } as unknown as Connection] })));
    expect(bad).toEqual({ ok: false, error: 'connections[1] is not a valid connection.' });
    const badTags = parseExport(
      JSON.stringify(envelope({ savedQueries: [{ ...sq('q'), tags: 'x' } as unknown as SavedQuery] })),
    );
    expect(badTags).toEqual({ ok: false, error: 'savedQueries[0] is not a valid saved query.' });
    const badSearch = parseExport(
      JSON.stringify(envelope({ searchSavedQueries: [{ ...ssq('s'), indices: [1] } as unknown as SearchSavedQuery] })),
    );
    expect(badSearch).toEqual({ ok: false, error: 'searchSavedQueries[0] is not a valid saved query.' });
  });
  it('rejects a non-string activeConnectionId', () => {
    const r = parseExport(JSON.stringify({ ...envelope(), activeConnectionId: 42 }));
    expect(r).toEqual({ ok: false, error: 'activeConnectionId is not valid.' });
  });
  it('accepts empty sections and ignores unknown keys', () => {
    const r = parseExport(JSON.stringify({ ...envelope(), futureKey: true }));
    expect(r.ok).toBe(true);
  });
  it('round-trips a built envelope', async () => {
    await saveConnection(conn('a', { type: 'bearer', token: 't' }));
    await setActiveConnectionId('a');
    await putSavedQuery(sq('q1'));
    await putSearchSavedQuery(ssq('s1'));
    const env = await buildExport({ includeCredentials: true });
    const r = parseExport(JSON.stringify(env));
    expect(r).toEqual({ ok: true, envelope: env });
  });
});

describe('mergeById', () => {
  it('overwrites in place, appends new ids, keeps order', () => {
    const merged = mergeById(
      [{ id: 'a', v: 1 }, { id: 'b', v: 1 }],
      [{ id: 'b', v: 2 }, { id: 'c', v: 2 }],
    );
    expect(merged).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 2 }]);
  });
  it('last occurrence wins for duplicate ids in incoming', () => {
    const merged = mergeById([], [{ id: 'a', v: 1 }, { id: 'a', v: 2 }]);
    expect(merged).toEqual([{ id: 'a', v: 2 }]);
  });
});

describe('applyImport', () => {
  it('merges all three data sets and reports counts', async () => {
    await saveConnection(conn('keep'));
    await saveConnection({ ...conn('replace'), name: 'old' });
    await putSavedQuery({ ...sq('q1'), name: 'old' });
    await putSearchSavedQuery(ssq('s-keep'));
    const summary = await applyImport(
      envelope({
        connections: [{ ...conn('replace'), name: 'new' }, conn('added')],
        savedQueries: [{ ...sq('q1'), name: 'new' }, sq('q2')],
        searchSavedQueries: [ssq('s-new')],
      }),
    );
    expect(summary).toEqual({ connections: 2, savedQueries: 2, searchSavedQueries: 1 });
    const conns = await listConnections();
    expect(conns.map((c) => `${c.id}:${c.name}`)).toEqual(['keep:keep', 'replace:new', 'added:added']);
    const queries = await listSavedQueries();
    expect(queries.find((q) => q.id === 'q1')!.name).toBe('new');
    expect(queries.map((q) => q.id).sort()).toEqual(['q1', 'q2']);
    expect((await listSearchSavedQueries()).map((q) => q.id).sort()).toEqual(['s-keep', 's-new']);
  });

  it('keeps existing auth when the file was exported without credentials', async () => {
    await saveConnection(conn('a', { type: 'basic', username: 'u', password: 'p' }));
    await applyImport(envelope({ includesCredentials: false, connections: [conn('a')] }));
    expect((await listConnections())[0]!.auth).toEqual({ type: 'basic', username: 'u', password: 'p' });
  });
  it('overwrites auth with none when the file includes credentials', async () => {
    await saveConnection(conn('a', { type: 'basic', username: 'u', password: 'p' }));
    await applyImport(envelope({ includesCredentials: true, connections: [conn('a')] }));
    expect((await listConnections())[0]!.auth).toEqual({ type: 'none' });
  });

  it('applies activeConnectionId only when currently unset and present in merged', async () => {
    await applyImport(envelope({ connections: [conn('a')], activeConnectionId: 'a' }));
    expect(await getActiveConnectionId()).toBe('a');
  });
  it('does not overwrite an existing activeConnectionId', async () => {
    await saveConnection(conn('current'));
    await setActiveConnectionId('current');
    await applyImport(envelope({ connections: [conn('a')], activeConnectionId: 'a' }));
    expect(await getActiveConnectionId()).toBe('current');
  });
  it('ignores an activeConnectionId that matches no connection', async () => {
    await applyImport(envelope({ connections: [conn('a')], activeConnectionId: 'ghost' }));
    expect(await getActiveConnectionId()).toBeUndefined();
  });

  it('round-trips: export, wipe, import restores the same state', async () => {
    await saveConnection(conn('a', { type: 'apiKey', apiKey: 'k' }));
    await setActiveConnectionId('a');
    await putSavedQuery(sq('q1'));
    await putSearchSavedQuery(ssq('s1'));
    const env = await buildExport({ includeCredentials: true });

    fakeBrowser.reset();
    for (const s of await listSavedQueries()) await deleteSavedQuery(s.id);
    for (const s of await listSearchSavedQueries()) await deleteSearchSavedQuery(s.id);

    await applyImport(env);
    expect(await listConnections()).toEqual([conn('a', { type: 'apiKey', apiKey: 'k' })]);
    expect(await getActiveConnectionId()).toBe('a');
    expect(await listSavedQueries()).toEqual([sq('q1')]);
    expect(await listSearchSavedQueries()).toEqual([ssq('s1')]);
  });
  it('is idempotent: importing the same file twice yields the same state', async () => {
    const env = envelope({ connections: [conn('a')], savedQueries: [sq('q1')], searchSavedQueries: [ssq('s1')] });
    await applyImport(env);
    await applyImport(env);
    expect(await listConnections()).toHaveLength(1);
    expect(await listSavedQueries()).toHaveLength(1);
    expect(await listSearchSavedQueries()).toHaveLength(1);
  });
});
