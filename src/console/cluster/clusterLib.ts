import { toClusterStatus, type ClusterStatus } from '../connections/health';

export interface ClusterHealth {
  clusterName?: string;
  status: ClusterStatus;
  nodes?: number;
  dataNodes?: number;
  activePrimary?: number;
  active?: number;
  relocating?: number;
  initializing?: number;
  unassigned?: number;
  delayedUnassigned?: number;
  pendingTasks?: number;
  activePercent?: number;
}

export interface ClusterInfo {
  clusterName?: string;
  versionNumber?: string;
  distribution?: string;
  buildFlavor?: string;
  luceneVersion?: string;
}

export interface ClusterStats {
  indices?: number;
  docs?: number;
  storeBytes?: number;
}

export interface NodeRow {
  name: string;
  version?: string;
  isMaster: boolean;
  cpuPercent?: number;
  ramCurrent?: string;
  ramMax?: string;
  ramPercent?: number;
  heapCurrent?: string;
  heapMax?: string;
  heapPercent?: number;
  diskUsed?: string;
  diskTotal?: string;
  diskPercent?: number;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function roundOpt(v: unknown): number | undefined {
  const n = num(v);
  return n === undefined ? undefined : Math.round(n);
}
function toPercent(v: unknown): number | undefined {
  if (typeof v !== 'string' && typeof v !== 'number') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : Math.round(n);
}

export function parseClusterHealth(body: unknown): ClusterHealth | undefined {
  if (!isObj(body)) return undefined;
  return {
    clusterName: str(body.cluster_name),
    status: toClusterStatus(body),
    nodes: num(body.number_of_nodes),
    dataNodes: num(body.number_of_data_nodes),
    activePrimary: num(body.active_primary_shards),
    active: num(body.active_shards),
    relocating: num(body.relocating_shards),
    initializing: num(body.initializing_shards),
    unassigned: num(body.unassigned_shards),
    delayedUnassigned: num(body.delayed_unassigned_shards),
    pendingTasks: num(body.number_of_pending_tasks),
    activePercent: roundOpt(body.active_shards_percent_as_number),
  };
}

export function parseClusterInfo(body: unknown): ClusterInfo | undefined {
  if (!isObj(body)) return undefined;
  const version = isObj(body.version) ? body.version : {};
  return {
    clusterName: str(body.cluster_name),
    versionNumber: str(version.number),
    distribution: str(version.distribution),
    buildFlavor: str(version.build_flavor),
    luceneVersion: str(version.lucene_version),
  };
}

export function parseClusterStats(body: unknown): ClusterStats | undefined {
  if (!isObj(body)) return undefined;
  const indices = isObj(body.indices) ? body.indices : {};
  const docs = isObj(indices.docs) ? indices.docs : {};
  const store = isObj(indices.store) ? indices.store : {};
  return { indices: num(indices.count), docs: num(docs.count), storeBytes: num(store.size_in_bytes) };
}

export function parseNodes(body: unknown): NodeRow[] | undefined {
  if (!Array.isArray(body)) return undefined;
  return body.map((raw) => {
    const r = isObj(raw) ? raw : {};
    return {
      name: str(r.name) ?? '(unknown)',
      version: str(r.version),
      isMaster: r.master === '*',
      cpuPercent: toPercent(r.cpu),
      ramCurrent: str(r['ram.current']),
      ramMax: str(r['ram.max']),
      ramPercent: toPercent(r['ram.percent']),
      heapCurrent: str(r['heap.current']),
      heapMax: str(r['heap.max']),
      heapPercent: toPercent(r['heap.percent']),
      diskUsed: str(r['disk.used']),
      diskTotal: str(r['disk.total']),
      diskPercent: toPercent(r['disk.used_percent']),
    };
  });
}

const UNITS = ['KB', 'MB', 'GB', 'TB', 'PB'];
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024;
    i += 1;
  }
  const rounded = Math.round(v * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${label} ${UNITS[i]}`;
}

export function formatInt(n: number): string {
  return n.toLocaleString('en-US');
}
