import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { listConnections, saveConnection, deleteConnection, getActiveConnectionId, setActiveConnectionId } from './connections';
import type { Connection } from '../types';

const conn = (id: string): Connection => ({
  id, name: id, baseUrl: 'http://localhost:9200', auth: { type: 'none' }, createdAt: 1, updatedAt: 1,
});

describe('connections storage', () => {
  beforeEach(() => fakeBrowser.reset());

  it('saves and lists connections', async () => {
    await saveConnection(conn('a'));
    await saveConnection(conn('b'));
    expect((await listConnections()).map((c) => c.id)).toEqual(['a', 'b']);
  });
  it('replaces a connection with the same id', async () => {
    await saveConnection(conn('a'));
    await saveConnection({ ...conn('a'), name: 'renamed' });
    const list = await listConnections();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe('renamed');
  });
  it('deletes a connection', async () => {
    await saveConnection(conn('a'));
    await deleteConnection('a');
    expect(await listConnections()).toEqual([]);
  });
  it('tracks the active connection id', async () => {
    await setActiveConnectionId('a');
    expect(await getActiveConnectionId()).toBe('a');
  });
});
