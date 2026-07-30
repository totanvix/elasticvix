type Props = { current?: string; max?: string; percent?: number };

const clamp = (p: number) => Math.max(0, Math.min(100, p));

export function MetricBar({ current, max, percent }: Props) {
  if (current === undefined && max === undefined && percent === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="min-w-[9rem]">
      <div className="flex items-baseline justify-between text-xs tabular-nums">
        <span>
          {current ?? '—'}
          {max ? ` / ${max}` : ''}
        </span>
        {percent !== undefined && <span className="font-semibold">{percent}%</span>}
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${clamp(percent ?? 0)}%` }} />
      </div>
    </div>
  );
}
