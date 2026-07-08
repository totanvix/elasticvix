import { useCallback, useEffect, useState } from 'react';
import type { Connection, EsMajor } from '../../lib/types';
import {
  listConnections,
  saveConnection,
  deleteConnection,
  getActiveConnectionId,
  setActiveConnectionId,
} from '../../lib/storage/connections';
import { detectVersion } from '../../lib/rpc/client';

export type TestResult = { ok: boolean; version?: string; major?: EsMajor; error?: string };

export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);

  const reload = useCallback(async () => {
    const [list, id] = await Promise.all([listConnections(), getActiveConnectionId()]);
    setConnections(list);
    setActiveId(id ?? list[0]?.id);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setActive = useCallback(async (id: string) => {
    await setActiveConnectionId(id);
    setActiveId(id);
  }, []);

  // Ensure the extension may reach the connection's origin (optional host perm).
  const ensureHostPermission = useCallback(async (baseUrl: string): Promise<boolean> => {
    try {
      const origin = new URL(baseUrl).origin + '/*';
      if (await browser.permissions.contains({ origins: [origin] })) return true;
      return await browser.permissions.request({ origins: [origin] });
    } catch {
      return false;
    }
  }, []);

  const addOrUpdate = useCallback(
    async (conn: Connection) => {
      await saveConnection(conn);
      await reload();
      await setActive(conn.id);
    },
    [reload, setActive],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteConnection(id);
      await reload();
    },
    [reload],
  );

  const test = useCallback(
    async (conn: Connection): Promise<TestResult> => {
      if (!(await ensureHostPermission(conn.baseUrl))) return { ok: false, error: 'Host permission denied' };
      const res = await detectVersion(conn);
      if (res.error) return { ok: false, error: res.error };
      return { ok: true, version: res.version, major: res.major };
    },
    [ensureHostPermission],
  );

  const active = connections.find((c) => c.id === activeId);
  return { connections, active, activeId, setActive, addOrUpdate, remove, test };
}
