import { useCallback, useEffect, useRef, useState } from 'react';
import type { Connection } from '../../lib/types';
import { esRequest } from '../../lib/rpc/client';
import {
  healthOutcome,
  nextRetryDelay,
  toClusterStatus,
  type ClusterStatus,
  type ConnectionPhase,
} from './health';

export interface ConnectionStatus {
  phase: ConnectionPhase;
  clusterStatus: ClusterStatus;
  reason?: string; // why the last check failed, when disconnected
  isChecking: boolean; // a health request is currently in flight
  retryNow: () => void;
}

// Re-check while connected so a dropped VPN/network flips the badge without
// user action; failures retry on the backoff schedule from nextRetryDelay.
const CONNECTED_POLL_MS = 30_000;

export function useConnectionStatus(active: Connection | undefined): ConnectionStatus {
  const [phase, setPhase] = useState<ConnectionPhase>('checking');
  const [clusterStatus, setClusterStatus] = useState<ClusterStatus>('unknown');
  const [reason, setReason] = useState<string | undefined>(undefined);
  const [isChecking, setChecking] = useState(false);
  const seq = useRef(0); // bumped on connection change so stale checks are ignored
  const failures = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const runCheck = useCallback((conn: Connection, mySeq: number) => {
    setChecking(true);
    void esRequest(conn, 'GET', '/_cluster/health')
      .then((res) => ({ outcome: healthOutcome(res), body: res.body }))
      .catch((e: unknown) => ({
        outcome: { isOk: false, reason: e instanceof Error ? e.message : 'health check failed' },
        body: null,
      }))
      .then(({ outcome, body }) => {
        if (mySeq !== seq.current) return;
        setChecking(false);
        if (outcome.isOk) {
          failures.current = 0;
          setPhase('connected');
          setClusterStatus(toClusterStatus(body));
          setReason(undefined);
          timer.current = window.setTimeout(() => runCheck(conn, mySeq), CONNECTED_POLL_MS);
        } else {
          failures.current += 1;
          setPhase('disconnected');
          setClusterStatus('unknown');
          setReason(outcome.reason);
          timer.current = window.setTimeout(() => runCheck(conn, mySeq), nextRetryDelay(failures.current));
        }
      });
  }, []);

  useEffect(() => {
    seq.current += 1;
    failures.current = 0;
    window.clearTimeout(timer.current);
    setPhase('checking');
    setClusterStatus('unknown');
    setReason(undefined);
    setChecking(false);
    if (active) runCheck(active, seq.current);
    return () => {
      seq.current += 1;
      window.clearTimeout(timer.current);
    };
  }, [active, runCheck]);

  const retryNow = useCallback(() => {
    if (!active || isChecking) return;
    window.clearTimeout(timer.current);
    failures.current = 0; // manual retry restarts the backoff schedule
    runCheck(active, seq.current);
  }, [active, isChecking, runCheck]);

  return { phase, clusterStatus, reason, isChecking, retryNow };
}
