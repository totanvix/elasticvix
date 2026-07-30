import { RotateCw } from 'lucide-react';
import { Button } from '../ui/button';
import type { Connection } from '../../lib/types';
import { statusDotClass, type ClusterStatus } from '../connections/health';
import { useClusterData } from './useClusterData';
import { NodesTable } from './NodesTable';
import { formatBytes, formatInt, type ClusterHealth } from './clusterLib';

const DASH = '—';

function n(v: number | undefined): string {
  return v === undefined ? DASH : formatInt(v);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const PILL_TONE: Record<ClusterStatus, string> = {
  green: 'text-green-600 dark:text-green-400',
  yellow: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  unknown: 'text-muted-foreground',
};

function StatusPill({ status }: { status: ClusterStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PILL_TONE[status]}`}
    >
      <span className={`h-2 w-2 rounded-full ${statusDotClass('connected', status)}`} /> {status}
    </span>
  );
}

function Card({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="min-w-[7rem] flex-1 rounded-lg border bg-muted/30 px-3.5 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${warn ? 'text-amber-600 dark:text-amber-400' : ''}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function shardSub(h: ClusterHealth): string | undefined {
  const parts: string[] = [];
  if (h.activePrimary !== undefined) parts.push(`${h.activePrimary} primary`);
  if (h.activePercent !== undefined) parts.push(`${h.activePercent}%`);
  return parts.length ? parts.join(' · ') : undefined;
}

type Props = { active?: Connection };

export function ClusterPage({ active }: Props) {
  if (!active) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Select or add a connection to view its cluster.</div>
    );
  }
  return <ClusterInner active={active} />;
}

function ClusterInner({ active }: { active: Connection }) {
  const { health, info, stats, nodes, refresh } = useClusterData(active);
  const h = health.data;
  const i = info.data;
  const s = stats.data;
  const busy = health.loading || info.loading || stats.loading || nodes.loading;

  const distro = i?.distribution && i.distribution !== 'elasticsearch' ? i.distribution : 'Elasticsearch';
  const versionLine = [
    i ? `${cap(distro)} ${i.versionNumber ?? '?'}` : undefined,
    i?.buildFlavor,
    i?.luceneVersion ? `Lucene ${i.luceneVersion}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">{h?.clusterName ?? i?.clusterName ?? active.name}</h1>
        {h && <StatusPill status={h.status} />}
        <Button variant="outline" size="sm" className="ml-auto" onClick={refresh} disabled={busy}>
          <RotateCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>
      {health.error && <p className="mt-2 text-sm text-destructive">Cluster health unavailable — {health.error}</p>}
      {versionLine && <p className="mt-1 text-sm text-muted-foreground">{versionLine}</p>}

      <div className="mt-4 flex flex-wrap gap-2.5">
        <Card label="Nodes" value={n(h?.nodes)} sub={h?.dataNodes !== undefined ? `${h.dataNodes} data` : undefined} />
        <Card label="Active shards" value={n(h?.active)} sub={h ? shardSub(h) : undefined} />
        <Card
          label="Unassigned"
          value={n(h?.unassigned)}
          warn={(h?.unassigned ?? 0) > 0}
          sub={h?.relocating !== undefined ? `${h.relocating} relocating` : undefined}
        />
        <Card label="Indices" value={stats.error ? DASH : n(s?.indices)} />
        <Card label="Docs" value={stats.error ? DASH : n(s?.docs)} />
        <Card
          label="Store size"
          value={stats.error || s?.storeBytes === undefined ? DASH : formatBytes(s.storeBytes)}
        />
        <Card label="Pending tasks" value={n(h?.pendingTasks)} />
      </div>

      <div className="mb-2 mt-6 text-sm font-semibold">
        Nodes {nodes.data ? <span className="font-normal text-muted-foreground">({nodes.data.length})</span> : null}
      </div>
      <NodesTable nodes={nodes} />
    </div>
  );
}
