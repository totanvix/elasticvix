# Cluster Overview — Design Spec

**Date:** 2026-07-30
**Status:** Approved (mockup-reviewed)
**Feature:** A dedicated CLUSTER tab showing cluster health, version, counts, and a per-node resource table (research doc §1.9, expanded from the "lightweight popover" to a full tab per user request).

## Goal

Give the user an at-a-glance operational view of the connected cluster — status, shards, indices/docs/size, and **per-node RAM / JVM heap / disk / CPU** — as a first-class tab that the console opens on by default.

## Scope

**In scope:**
- New **CLUSTER** tab, nav order `CLUSTER · SEARCH · REST`, **default view = CLUSTER**.
- Header: cluster name + health status pill + version line.
- Summary cards: nodes, active shards, unassigned, indices, docs, store size, pending tasks.
- Per-node table: name (+ master badge), version, CPU, RAM, JVM heap, disk — each resource as `used / max` + rounded percent + a bar.
- Manual **Refresh**; per-section independent loading/error.

**Out of scope (deferred):**
- Auto-polling the tab (the header status chip already polls health every 30s).
- Shard allocation view, index-level table, node roles decoding beyond a master badge, load average, CPU history/charts, snapshots — all Elasticvue admin territory.
- The earlier popover idea and the clickable-chip affordance are **dropped**: the tab replaces them; `ConnectionStatusChip` stays a plain status indicator, unchanged.

## Data sources (four independent fetches)

Each endpoint is fetched independently when the tab mounts / connection changes / Refresh is pressed, and has its **own** loading + error state so a slow or failing one never blanks the others.

| Slot | Request | Feeds |
|---|---|---|
| health | `GET /_cluster/health` | status pill, nodes/shards/pending cards |
| info | `GET /` | version line (name, version, build_flavor, lucene) |
| stats | `GET /_cluster/stats?filter_path=indices.count,indices.docs.count,indices.store.size_in_bytes` | indices / docs / store-size cards |
| nodes | `GET /_cat/nodes?format=json&h=name,version,master,cpu,ram.current,ram.max,ram.percent,heap.current,heap.max,heap.percent,disk.used,disk.total,disk.used_percent` | per-node table |

**The `filter_path` and the `_cat/nodes` `h=` column list are load-bearing** — a typo silently drops a field to "—" rather than erroring. Both strings are pinned verbatim in the plan and are the contract the parser tests encode.

Why `_cat/nodes` (not `_nodes/stats`): it returns already-human-formatted per-node values (`"1.5gb"`, `"56"`) and explicit percent columns, so the table needs only percent rounding, not byte math. Why split fetches: `_cluster/stats` fans out across nodes and can be slow on large clusters; isolating it means the header + node table still render while it loads.

## Design decisions (load-bearing)

1. **Default view = CLUSTER.** `loadView()` returns `'cluster'` when nothing valid is stored, and accepts `'cluster' | 'search' | 'rest'`. Existing users with `'search'`/`'rest'` stored keep their choice.
2. **No active connection → prompt**, not a fetch. The tab shows "Select or add a connection" (mirroring how SearchPage guards on `active`).
3. **Missing vs zero.** Parsers return `number | undefined` per field. A field ES did not send renders "—"; a genuine `0` renders "0". This matters most for `unassigned_shards: 0` (the reassuring number) and `store size 0 → "0 B"`.
4. **Percentages: prefer what ES sends, round for display.** `_cat/nodes` gives `ram.percent`/`heap.percent`/`disk.used_percent` and `active_shards_percent_as_number` comes from health — round each to an integer; never recompute when ES already provides it. Bars clamp width to 0–100%.
5. **Node count shown once.** `health.number_of_nodes` feeds the Nodes card; the node table length is the same figure from a different endpoint — do not surface a second, separately-fetched node count that could disagree mid-refresh.
6. **Byte formatting is pure, tested logic.** Binary units (KB/MB/GB/TB at 1024, matching ES's own `_cat` output), one decimal for GB+, `0 → "0 B"`.

## Architecture

### Pure logic — `src/console/cluster/clusterLib.ts` (unit-tested)

```ts
import type { ClusterStatus } from '../connections/health'; // reuse toClusterStatus

export interface ClusterHealth {
  clusterName?: string;
  status: ClusterStatus;
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

export function parseClusterHealth(body: unknown): ClusterHealth | undefined;
export function parseClusterInfo(body: unknown): ClusterInfo | undefined;
export function parseClusterStats(body: unknown): ClusterStats | undefined;
export function parseNodes(body: unknown): NodeRow[] | undefined; // undefined when body is not an array
export function formatBytes(bytes: number): string;   // 0 -> "0 B", 81128 -> "79.2 KB" (1 decimal, strip .0)
export function formatInt(n: number): string;          // 1234567 -> "1,234,567"
```

Rules: `parseClusterHealth`/`Info`/`Stats` return `undefined` for a non-object body (the hook renders "unexpected response"). `status` comes from the shared `toClusterStatus`. `parseNodes` maps each `_cat/nodes` row: `isMaster = row.master === '*'`; percents via a private `toPercent(str)` that returns `Math.round(Number(str))` or `undefined` when absent/NaN; `current`/`max`/`used`/`total` pass through as the strings ES already formatted.

### Hook — `src/console/cluster/useClusterData.ts`

```ts
export interface Async<T> { loading: boolean; error?: string; data?: T }
export interface ClusterData {
  health: Async<ClusterHealth>; info: Async<ClusterInfo>;
  stats: Async<ClusterStats>;   nodes: Async<NodeRow[]>;
  refresh: () => void;
}
export function useClusterData(active: Connection | undefined): ClusterData;
```

**Fetch-and-guard behaviour (written out so the stale-response guard isn't rediscovered at implementation time):**
- A `seq` ref (number) is bumped on every `load()` call and on connection change. Each of the four fetches captures `my = seq.current`; when it resolves it **returns early if `my !== seq.current`** (a newer load or a connection switch superseded it), so a slow response from a previous connection can never overwrite current state.
- `load()` sets each slot to `{ loading: true }`, then per endpoint: transport error/`status 0` → `{ error: res.error ?? 'unreachable' }`; `status ≥ 400` → `{ error: esErrorReason(body) ?? 'HTTP <status>' }`; parser returns `undefined` → `{ error: 'unexpected response' }`; else `{ data }`.
- The mount/connection effect bumps `seq`, resets all four slots, and calls `load()` when `active` is defined; the cleanup bumps `seq` again so in-flight fetches are ignored after unmount.
- `refresh` is `load` (re-runs all four). No timers on this hook.

### Components — `src/console/cluster/`

- `ClusterPage.tsx` — `{ active?: Connection }`. No active → centered prompt. Else `useClusterData(active)`, renders header (name + `<StatusPill>` + version line from `info`), `<SummaryCards>`, `<NodesTable>`, and a Refresh button (spins while any slot is loading). Each section shows its own skeleton/loading and error text.
- `NodesTable.tsx` — `{ nodes: Async<NodeRow[]> }`. Table with Name (+ master badge), Version, CPU, RAM, JVM heap, Disk. RAM/heap/disk cells use `<MetricBar>`. Empty/loading/error states.
- `MetricBar.tsx` — `{ current?: string; max?: string; percent?: number }`. Renders `current / max` + `percent%` + a bar (`width: clamp(percent)`); shows "—" when data absent.
- Status pill: a small local component reusing `statusDotClass`/`ClusterStatus` from `connections/health.ts` for color parity with the header dot.

### Wiring

- `nav/TopNav.tsx`: `ConsoleView = 'cluster' | 'search' | 'rest'`; `NAV_ITEMS` reordered to `[cluster, search, rest]` with label `CLUSTER`.
- `App.tsx`: `loadView()` defaults to `'cluster'` and accepts the three values; render `view === 'cluster' ? <main…><ClusterPage active={conns.active} /></main> : view === 'search' ? … : …`. The cluster `<main>` gets `overflow-y-auto` (the page scrolls internally).

## Testing

- **Unit (Vitest), `clusterLib.test.ts`:** `parseClusterHealth` (full; `unassigned: 0` → 0 not undefined; missing fields; percent rounding; non-object → undefined); `parseClusterInfo` (ES; OpenSearch `distribution`; missing); `parseClusterStats` (full; missing); `parseNodes` (single node, `master:'*'` → isMaster; percent parse+round; missing columns; non-array → undefined; empty array → `[]`); `formatBytes` (0→"0 B", 81128→"79.2 KB", 8394457088→"7.8 GB", 1024→"1 KB"); `formatInt` (700, 1234567).
- **Typecheck:** `pnpm compile` clean.
- **Screenshot (demo ES 9201 only — never 9200):** the CLUSTER tab with real data, light + dark; confirm the node table's RAM/heap/disk bars and the status pill render.

## Success criteria

1. Console opens on the CLUSTER tab; nav reads `CLUSTER · SEARCH · REST`.
2. Header shows cluster name, a color-correct status pill, and the version line; cards show nodes/shards/indices/docs/size/pending; the node table shows per-node RAM/heap/disk/CPU.
3. A slow/failing `_cluster/stats` (or nodes) leaves the rest of the page rendered, with an error only in its own section.
4. `unassigned: 0` shows "0"; store size `0` shows "0 B"; absent fields show "—".
5. `pnpm test` and `pnpm compile` are green.
