import { useCallback, useEffect, useRef, useState } from 'react';
import type { Connection } from '../../lib/types';
import { esRequest } from '../../lib/rpc/client';
import { esErrorReason } from '../search/searchLib';
import {
  parseClusterHealth,
  parseClusterInfo,
  parseClusterStats,
  parseNodes,
  type ClusterHealth,
  type ClusterInfo,
  type ClusterStats,
  type NodeRow,
} from './clusterLib';

export interface Async<T> {
  loading: boolean;
  error?: string;
  data?: T;
}

export interface ClusterData {
  health: Async<ClusterHealth>;
  info: Async<ClusterInfo>;
  stats: Async<ClusterStats>;
  nodes: Async<NodeRow[]>;
  refresh: () => void;
}

const STATS_PATH =
  '/_cluster/stats?filter_path=indices.count,indices.docs.count,indices.store.size_in_bytes';
const NODES_PATH =
  '/_cat/nodes?format=json&h=name,version,master,cpu,ram.current,ram.max,ram.percent,heap.current,heap.max,heap.percent,disk.used,disk.total,disk.used_percent';

const IDLE = { loading: false } as const;

export function useClusterData(active: Connection | undefined): ClusterData {
  const [health, setHealth] = useState<Async<ClusterHealth>>(IDLE);
  const [info, setInfo] = useState<Async<ClusterInfo>>(IDLE);
  const [stats, setStats] = useState<Async<ClusterStats>>(IDLE);
  const [nodes, setNodes] = useState<Async<NodeRow[]>>(IDLE);
  const seq = useRef(0);

  const load = useCallback(() => {
    if (!active) return;
    const my = ++seq.current;
    const run = <T,>(
      path: string,
      parse: (body: unknown) => T | undefined,
      set: (a: Async<T>) => void,
    ) => {
      set({ loading: true });
      esRequest(active, 'GET', path)
        .then((res) => {
          if (my !== seq.current) return; // superseded by a newer load / connection switch
          if (res.status === 0 || res.error) {
            set({ loading: false, error: res.error ?? 'unreachable' });
            return;
          }
          if (res.status >= 400) {
            set({ loading: false, error: esErrorReason(res.body) ?? `HTTP ${res.status}` });
            return;
          }
          const data = parse(res.body);
          set(data === undefined ? { loading: false, error: 'unexpected response' } : { loading: false, data });
        })
        .catch((e: unknown) => {
          if (my === seq.current) set({ loading: false, error: e instanceof Error ? e.message : 'request failed' });
        });
    };
    run('/_cluster/health', parseClusterHealth, setHealth);
    run('/', parseClusterInfo, setInfo);
    run(STATS_PATH, parseClusterStats, setStats);
    run(NODES_PATH, parseNodes, setNodes);
  }, [active]);

  useEffect(() => {
    seq.current += 1;
    setHealth(IDLE);
    setInfo(IDLE);
    setStats(IDLE);
    setNodes(IDLE);
    if (active) load();
    return () => {
      seq.current += 1; // ignore in-flight fetches after unmount / connection change
    };
  }, [active, load]);

  return { health, info, stats, nodes, refresh: load };
}
