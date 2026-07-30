# Cluster Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A default CLUSTER tab showing cluster health, version, counts, and a per-node RAM/heap/disk/CPU table.

**Architecture:** Pure parsers/formatters in `clusterLib.ts` (unit-tested). A `useClusterData` hook runs four independent, stale-guarded fetches. `ClusterPage` composes header + cards + `NodesTable` (+ `MetricBar`). Nav gains a CLUSTER item (first, default).

**Tech Stack:** React 19, TypeScript strict, Vitest, Tailwind + shadcn primitives.

## Global Constraints

- **Port 9200 is live viec.co PRODUCTION — never touch it.** Screenshots use demo ES on **9201**. This feature is read-only (no writes).
- TypeScript strict; no `@testing-library/react` (pure logic unit-tested; React verified by `pnpm compile` + screenshot).
- Reuse `toClusterStatus`/`statusDotClass` from `connections/health.ts` and `esErrorReason` from `search/searchLib.ts` — do not re-derive.
- Pin verbatim: `filter_path=indices.count,indices.docs.count,indices.store.size_in_bytes` and the `_cat/nodes` `h=` list.
- Commits in English, imperative ≤50 chars, no attribution footer. Commit after each task.

---

### Task 1: Pure parsers + formatters

**Files:** Create `src/console/cluster/clusterLib.ts`; Test `src/console/cluster/clusterLib.test.ts`.

**Interfaces produced:** `ClusterHealth`, `ClusterInfo`, `ClusterStats`, `NodeRow`, `parseClusterHealth`, `parseClusterInfo`, `parseClusterStats`, `parseNodes`, `formatBytes`, `formatInt` (signatures in the spec).

- [ ] **Step 1: Write the failing test**

```ts
// src/console/cluster/clusterLib.test.ts
import { describe, it, expect } from 'vitest';
import {
  parseClusterHealth, parseClusterInfo, parseClusterStats, parseNodes, formatBytes, formatInt,
} from './clusterLib';

describe('parseClusterHealth', () => {
  const body = {
    cluster_name: 'c', status: 'yellow', number_of_nodes: 1, number_of_data_nodes: 1,
    active_primary_shards: 2, active_shards: 2, relocating_shards: 0, initializing_shards: 0,
    unassigned_shards: 2, delayed_unassigned_shards: 0, number_of_pending_tasks: 0,
    active_shards_percent_as_number: 50.0,
  };
  it('maps fields and rounds percent', () => {
    const h = parseClusterHealth(body)!;
    expect(h.status).toBe('yellow');
    expect(h.clusterName).toBe('c');
    expect(h.nodes).toBe(1);
    expect(h.unassigned).toBe(2);
    expect(h.activePercent).toBe(50);
  });
  it('keeps a genuine zero (not undefined)', () => {
    expect(parseClusterHealth({ ...body, unassigned_shards: 0 })!.unassigned).toBe(0);
  });
  it('rounds a fractional percent', () => {
    expect(parseClusterHealth({ ...body, active_shards_percent_as_number: 66.6667 })!.activePercent).toBe(67);
  });
  it('leaves missing fields undefined but still returns status unknown', () => {
    const h = parseClusterHealth({})!;
    expect(h.status).toBe('unknown');
    expect(h.nodes).toBeUndefined();
  });
  it('returns undefined for a non-object body', () => {
    expect(parseClusterHealth(null)).toBeUndefined();
    expect(parseClusterHealth('x')).toBeUndefined();
  });
});

describe('parseClusterInfo', () => {
  it('reads version fields from GET /', () => {
    const i = parseClusterInfo({ cluster_name: 'c', version: { number: '8.14.0', build_flavor: 'default', lucene_version: '9.10.0' } })!;
    expect(i.versionNumber).toBe('8.14.0');
    expect(i.buildFlavor).toBe('default');
    expect(i.luceneVersion).toBe('9.10.0');
  });
  it('exposes an OpenSearch distribution', () => {
    expect(parseClusterInfo({ version: { number: '2.11.0', distribution: 'opensearch' } })!.distribution).toBe('opensearch');
  });
  it('returns undefined for a non-object body', () => {
    expect(parseClusterInfo(42)).toBeUndefined();
  });
});

describe('parseClusterStats', () => {
  it('reads indices counts and store size', () => {
    const s = parseClusterStats({ indices: { count: 2, docs: { count: 700 }, store: { size_in_bytes: 81128 } } })!;
    expect(s).toEqual({ indices: 2, docs: 700, storeBytes: 81128 });
  });
  it('tolerates missing subtrees', () => {
    expect(parseClusterStats({})).toEqual({ indices: undefined, docs: undefined, storeBytes: undefined });
  });
  it('returns undefined for a non-object body', () => {
    expect(parseClusterStats(null)).toBeUndefined();
  });
});

describe('parseNodes', () => {
  const row = {
    name: 'n1', version: '8.14.0', master: '*', cpu: '0',
    'ram.current': '1.5gb', 'ram.max': '7.8gb', 'ram.percent': '20',
    'heap.current': '290.5mb', 'heap.max': '512mb', 'heap.percent': '56',
    'disk.used': '15.8gb', 'disk.total': '99.3gb', 'disk.used_percent': '15.93',
  };
  it('maps a node row and rounds percents', () => {
    const [n] = parseNodes([row])!;
    expect(n.name).toBe('n1');
    expect(n.isMaster).toBe(true);
    expect(n.ramPercent).toBe(20);
    expect(n.diskPercent).toBe(16); // 15.93 -> 16
    expect(n.ramCurrent).toBe('1.5gb');
  });
  it('flags a non-master node', () => {
    expect(parseNodes([{ ...row, master: '-' }])![0].isMaster).toBe(false);
  });
  it('leaves missing metrics undefined', () => {
    const [n] = parseNodes([{ name: 'n2' }])!;
    expect(n.ramPercent).toBeUndefined();
    expect(n.ramCurrent).toBeUndefined();
  });
  it('returns [] for an empty array and undefined for a non-array', () => {
    expect(parseNodes([])).toEqual([]);
    expect(parseNodes({})).toBeUndefined();
  });
});

describe('formatBytes', () => {
  it('formats across units with a 0 B floor', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(81128)).toBe('79.2 KB');
    expect(formatBytes(8394457088)).toBe('7.8 GB');
  });
});

describe('formatInt', () => {
  it('adds thousands separators', () => {
    expect(formatInt(700)).toBe('700');
    expect(formatInt(1234567)).toBe('1,234,567');
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module missing)**

Run: `pnpm test -- src/console/cluster/clusterLib.test.ts`

- [ ] **Step 3: Implement**

```ts
// src/console/cluster/clusterLib.ts
import { toClusterStatus, type ClusterStatus } from '../connections/health';

export interface ClusterHealth {
  clusterName?: string; status: ClusterStatus;
  nodes?: number; dataNodes?: number;
  activePrimary?: number; active?: number; relocating?: number;
  initializing?: number; unassigned?: number; delayedUnassigned?: number;
  pendingTasks?: number; activePercent?: number;
}
export interface ClusterInfo {
  clusterName?: string; versionNumber?: string;
  distribution?: string; buildFlavor?: string; luceneVersion?: string;
}
export interface ClusterStats { indices?: number; docs?: number; storeBytes?: number }
export interface NodeRow {
  name: string; version?: string; isMaster: boolean; cpuPercent?: number;
  ramCurrent?: string; ramMax?: string; ramPercent?: number;
  heapCurrent?: string; heapMax?: string; heapPercent?: number;
  diskUsed?: string; diskTotal?: string; diskPercent?: number;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function num(v: unknown): number | undefined { return typeof v === 'number' ? v : undefined; }
function str(v: unknown): string | undefined { return typeof v === 'string' ? v : undefined; }
function roundOpt(v: unknown): number | undefined { const n = num(v); return n === undefined ? undefined : Math.round(n); }
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
      ramCurrent: str(r['ram.current']), ramMax: str(r['ram.max']), ramPercent: toPercent(r['ram.percent']),
      heapCurrent: str(r['heap.current']), heapMax: str(r['heap.max']), heapPercent: toPercent(r['heap.percent']),
      diskUsed: str(r['disk.used']), diskTotal: str(r['disk.total']), diskPercent: toPercent(r['disk.used_percent']),
    };
  });
}

const UNITS = ['KB', 'MB', 'GB', 'TB', 'PB'];
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < UNITS.length - 1) { v /= 1024; i += 1; }
  const rounded = Math.round(v * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${label} ${UNITS[i]}`;
}

export function formatInt(n: number): string { return n.toLocaleString('en-US'); }
```

- [ ] **Step 4: Run — expect PASS.** `pnpm test -- src/console/cluster/clusterLib.test.ts`
- [ ] **Step 5: Commit** — `feat(cluster): pure parsers and formatters for cluster data`

---

### Task 2: Hook + view components + nav wiring

**Files:** Create `useClusterData.ts`, `MetricBar.tsx`, `NodesTable.tsx`, `ClusterPage.tsx` (all in `src/console/cluster/`); Modify `src/console/nav/TopNav.tsx`, `src/console/App.tsx`. Verify: `pnpm compile` + `pnpm test` + screenshot.

- [ ] **Step 1: Hook** — create `src/console/cluster/useClusterData.ts` with the full content from the spec's Architecture section (four `run(...)` calls, `seq` stale-guard, `IDLE` reset on connection change). `STATS_PATH`/`NODES_PATH` constants pinned verbatim.

- [ ] **Step 2: MetricBar** — create `src/console/cluster/MetricBar.tsx`:

```tsx
type Props = { current?: string; max?: string; percent?: number };
const clamp = (p: number) => Math.max(0, Math.min(100, p));

export function MetricBar({ current, max, percent }: Props) {
  if (current === undefined && max === undefined && percent === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="min-w-[9rem]">
      <div className="flex items-baseline justify-between text-xs tabular-nums">
        <span>{current ?? '—'}{max ? ` / ${max}` : ''}</span>
        {percent !== undefined && <span className="font-semibold">{percent}%</span>}
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${clamp(percent ?? 0)}%` }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: NodesTable** — create `src/console/cluster/NodesTable.tsx` (loading/error/empty + table with Name+master badge, Version, CPU, RAM/heap/disk via MetricBar) as written in the spec's component section.

- [ ] **Step 4: ClusterPage** — create `src/console/cluster/ClusterPage.tsx` (no-active prompt; `ClusterInner` with header + StatusPill + version line + summary cards + NodesTable + Refresh) as written in the spec's component section. Cards read `stats.error ? '—' : …` so a failed stats fetch dashes only those three cards.

- [ ] **Step 5: Nav** — in `src/console/nav/TopNav.tsx`:

```tsx
export type ConsoleView = 'cluster' | 'search' | 'rest';
// ...
const NAV_ITEMS: { view: ConsoleView; label: string }[] = [
  { view: 'cluster', label: 'CLUSTER' },
  { view: 'search', label: 'SEARCH' },
  { view: 'rest', label: 'REST' },
];
```

- [ ] **Step 6: App wiring** — in `src/console/App.tsx`: import `ClusterPage`; change `loadView` to default `'cluster'`:

```tsx
function loadView(): ConsoleView {
  const v = localStorage.getItem(VIEW_KEY);
  return v === 'search' || v === 'rest' ? v : 'cluster';
}
```

and add the cluster branch to the render:

```tsx
{view === 'cluster' ? (
  <main className="min-w-0 flex-1 overflow-hidden">
    <ClusterPage active={conns.active} />
  </main>
) : view === 'search' ? (
  <main className="min-w-0 flex-1 overflow-hidden">
    <SearchPage active={conns.active} onSaveConnection={conns.addOrUpdate} onTestConnection={conns.test} />
  </main>
) : (
  <RestPanes … />   // unchanged
)}
```

- [ ] **Step 7: Typecheck** — `pnpm compile` clean.
- [ ] **Step 8: Full suite** — `pnpm test` all green.
- [ ] **Step 9: Commit** — `feat(cluster): CLUSTER tab with per-node resource table`

---

### Task 3: Screenshot UI review (demo ES 9201)

- [ ] **Step 1:** Ensure demo ES 9201 is up + seeded (never 9200).
- [ ] **Step 2:** Build (`pnpm build`) and capture the CLUSTER tab via the Puppeteer + Chrome for Testing recipe (extension id `glnbabapnpecmdaekagajnedgkbhcgad`, connection injected into `browser.storage.local`; the tab is default so no nav click needed). Capture light + dark.
- [ ] **Step 3:** Read each `ui-review/*.png` inline to self-check (status pill color, cards, node RAM/heap/disk bars), present, and leave images in place.

## Self-Review

**Spec coverage:** health/info/stats/nodes fetches → hook (Task 2 Step 1) + parsers (Task 1). Header/cards/table → ClusterPage/NodesTable/MetricBar (Task 2 Steps 2-4). Nav reorder + default → Task 2 Steps 5-6. Missing-vs-zero + percent rounding + byte format → Task 1 tests. Independent section failure → hook's four slots + Card `stats.error` dashing.

**Placeholder scan:** none — Task 1 has full code; Task 2 references the spec's verbatim component code + explicit edits.

**Type consistency:** `Async<T>`, `ClusterData`, and the four parser return types match between `clusterLib.ts`, `useClusterData.ts`, and the components. `ConsoleView` extended in one place (TopNav) and consumed in App. `NodeRow` fields match MetricBar/NodesTable usage.
