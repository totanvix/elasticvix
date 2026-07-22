import type { EsResult } from '../../lib/rpc/messages';

export type ClusterStatus = 'green' | 'yellow' | 'red' | 'unknown';

export interface HealthOutcome { isOk: boolean; reason?: string }

// Connected means the health endpoint answered without a transport error and
// below 400 — an auth or server error is as unusable as an unreachable host.
export function healthOutcome(res: EsResult): HealthOutcome {
  if (res.error !== undefined || res.status === 0) return { isOk: false, reason: res.error ?? 'unreachable' };
  if (res.status >= 400) return { isOk: false, reason: `HTTP ${res.status}` };
  return { isOk: true };
}

const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 30_000;

export function nextRetryDelay(consecutiveFailures: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(consecutiveFailures - 1, 0), RETRY_MAX_MS);
}

export function toClusterStatus(responseBody: unknown): ClusterStatus {
  const status = (responseBody as { status?: unknown } | null | undefined)?.status;
  return status === 'green' || status === 'yellow' || status === 'red' ? status : 'unknown';
}

const DOT_CLASS: Record<ClusterStatus, string> = {
  green: 'bg-green-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
  unknown: 'bg-gray-400',
};

export type ConnectionPhase = 'checking' | 'connected' | 'disconnected';

// One color language for every connection indicator: gray while checking,
// red when unreachable, cluster health color once connected.
export function statusDotClass(phase: ConnectionPhase, cluster: ClusterStatus): string {
  if (phase === 'checking') return DOT_CLASS.unknown;
  if (phase === 'disconnected') return DOT_CLASS.red;
  return DOT_CLASS[cluster];
}

export function connectionTitle(phase: ConnectionPhase, cluster: ClusterStatus, reason?: string): string {
  if (phase === 'checking') return 'Checking connection…';
  if (phase === 'disconnected') return `Disconnected — ${reason ?? 'unreachable'}`;
  return `Connected — cluster health: ${cluster}`;
}
