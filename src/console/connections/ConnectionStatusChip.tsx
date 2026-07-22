import { RotateCw } from 'lucide-react';
import { Button } from '../ui/button';
import { connectionTitle, statusDotClass } from './health';
import type { ConnectionStatus } from './useConnectionStatus';

type Props = {
  status: ConnectionStatus;
};

export function ConnectionStatusChip({ status }: Props) {
  const { phase, clusterStatus, reason, isChecking, retryNow } = status;
  const dot = statusDotClass(phase, clusterStatus);
  const title = connectionTitle(phase, clusterStatus, reason);

  if (phase === 'checking') {
    return (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground" title={title}>
        <span className={`inline-block h-2 w-2 animate-pulse rounded-full ${dot}`} />
        Checking…
      </span>
    );
  }

  if (phase === 'connected') {
    return (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground" title={title}>
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        Connected
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      <span className="text-destructive" title={title}>
        Disconnected
      </span>
      <Button variant="outline" size="sm" className="h-7 px-2" onClick={retryNow} disabled={isChecking}>
        <RotateCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
        {isChecking ? 'Retrying…' : 'Retry'}
      </Button>
    </span>
  );
}
