import { useEffect, useState } from 'react';
import type { Connection } from '../../lib/types';
import { esRequest } from '../../lib/rpc/client';
import { toClusterStatus, type ClusterStatus } from './health';

export interface ClusterHealth {
  status: ClusterStatus;
  reason?: string; // set when status is 'unknown' because the health call failed
}

export function useClusterHealth(active: Connection | undefined): ClusterHealth {
  const [health, setHealth] = useState<ClusterHealth>({ status: 'unknown' });

  useEffect(() => {
    let isStale = false;
    setHealth({ status: 'unknown' });
    if (!active) return;
    esRequest(active, 'GET', '/_cluster/health')
      .then((res) => {
        if (isStale) return;
        if (res.error) setHealth({ status: 'unknown', reason: res.error });
        else if (res.status >= 400) setHealth({ status: 'unknown', reason: `HTTP ${res.status}` });
        else setHealth({ status: toClusterStatus(res.body) });
      })
      .catch((e: unknown) => {
        if (!isStale) setHealth({ status: 'unknown', reason: e instanceof Error ? e.message : 'health check failed' });
      });
    return () => {
      isStale = true;
    };
  }, [active]);

  return health;
}
