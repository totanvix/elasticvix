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

  const addOrUpdate = useCallback(
    async (conn: Connection) => {
      const isNew = !connections.some((c) => c.id === conn.id);
      await saveConnection(conn);
      await reload();
      if (isNew) await setActive(conn.id);
    },
    [connections, reload, setActive],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteConnection(id);
      if (id === activeId) {
        const list = await listConnections();
        await setActiveConnectionId(list[0]?.id);
      }
      await reload();
    },
    [activeId, reload],
  );

  const test = useCallback(async (conn: Connection): Promise<TestResult> => {
    const res = await detectVersion(conn);
    if (res.error) return { ok: false, error: res.error };
    return { ok: true, version: res.version, major: res.major };
  }, []);

  const active = connections.find((c) => c.id === activeId);
  return { connections, active, activeId, setActive, addOrUpdate, remove, test };
}
