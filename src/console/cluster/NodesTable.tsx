import type { Async } from './useClusterData';
import type { NodeRow } from './clusterLib';
import { MetricBar } from './MetricBar';

type Props = { nodes: Async<NodeRow[]> };

export function NodesTable({ nodes }: Props) {
  if (nodes.loading && !nodes.data) {
    return <p className="p-3 text-sm text-muted-foreground">Loading nodes…</p>;
  }
  if (nodes.error) {
    return <p className="p-3 text-sm text-destructive">Nodes unavailable — {nodes.error}</p>;
  }
  const rows = nodes.data ?? [];
  if (rows.length === 0) {
    return <p className="p-3 text-sm text-muted-foreground">No nodes.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Version</th>
            <th className="px-3 py-2 font-medium">CPU</th>
            <th className="px-3 py-2 font-medium">RAM</th>
            <th className="px-3 py-2 font-medium">JVM heap</th>
            <th className="px-3 py-2 font-medium">Disk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => (
            <tr key={n.name} className="border-b last:border-0">
              <td className="px-3 py-2.5">
                <span className="font-medium">{n.name}</span>
                {n.isMaster && (
                  <span className="ml-2 rounded border border-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    master
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 tabular-nums">{n.version ?? '—'}</td>
              <td className="px-3 py-2.5 tabular-nums">{n.cpuPercent === undefined ? '—' : `${n.cpuPercent}%`}</td>
              <td className="px-3 py-2.5">
                <MetricBar current={n.ramCurrent} max={n.ramMax} percent={n.ramPercent} />
              </td>
              <td className="px-3 py-2.5">
                <MetricBar current={n.heapCurrent} max={n.heapMax} percent={n.heapPercent} />
              </td>
              <td className="px-3 py-2.5">
                <MetricBar current={n.diskUsed} max={n.diskTotal} percent={n.diskPercent} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
