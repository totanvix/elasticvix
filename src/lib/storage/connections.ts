import type { Connection } from '../types';

const CONNECTIONS_KEY = 'connections';
const ACTIVE_KEY = 'activeConnectionId';

export async function listConnections(): Promise<Connection[]> {
  const res = await browser.storage.local.get(CONNECTIONS_KEY);
  return (res[CONNECTIONS_KEY] as Connection[] | undefined) ?? [];
}

export async function saveConnection(c: Connection): Promise<void> {
  const list = await listConnections();
  const idx = list.findIndex((x) => x.id === c.id);
  const next = idx === -1 ? [...list, c] : list.map((x) => (x.id === c.id ? c : x));
  await browser.storage.local.set({ [CONNECTIONS_KEY]: next });
}

export async function deleteConnection(id: string): Promise<void> {
  const next = (await listConnections()).filter((x) => x.id !== id);
  await browser.storage.local.set({ [CONNECTIONS_KEY]: next });
}

export async function getActiveConnectionId(): Promise<string | undefined> {
  const res = await browser.storage.local.get(ACTIVE_KEY);
  return res[ACTIVE_KEY] as string | undefined;
}

export async function setActiveConnectionId(id: string | undefined): Promise<void> {
  await browser.storage.local.set({ [ACTIVE_KEY]: id });
}
