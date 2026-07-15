export type ClusterStatus = 'green' | 'yellow' | 'red' | 'unknown';

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

export function healthDotClass(status: ClusterStatus): string {
  return DOT_CLASS[status];
}
