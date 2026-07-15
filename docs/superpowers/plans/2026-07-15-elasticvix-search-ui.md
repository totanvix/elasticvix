# Elasticvix — Elasticvue-style Search Page + Connection Edit/Delete — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Elasticvue-style **Search page** (multi-select indices → JSON query editor with field-aware autocomplete → hits table with pagination/sort/filter, Aggregations tab, doc-detail dialog, download JSON) plus an Elasticvue-style **top nav** (cluster selector with health dot + SEARCH | REST tabs), and fix the **connection edit/delete** bug (no edit entry point; dialog freezes stale state; auth never prefilled).

**Architecture:** Everything builds on the existing Plan 1 core (RPC `esRequest`/`detectVersion`/`fetchMapping`, storage repos, autocomplete engine) and Plan 2 console UI (shadcn copy-ins, CodeMirror, theme). New code lives in `src/console/search/` (pure logic split into three small tested libs + hooks + presentational components), `src/console/nav/TopNav.tsx`, and a `ClusterSelector` that replaces `ConnectionSwitcher`. Navigation between the two views is a plain `useState<'search' | 'rest'>` persisted to `localStorage` — no router. The autocomplete engine gains a **body-only** completion source (the Search editor has no `METHOD /path` request line).

**Tech Stack:** React 19, shadcn/ui copy-ins (Radix + CVA + tailwind-merge), Tailwind v4, CodeMirror 6 (`@uiw/react-codemirror`), WXT/Vite, TS strict, pnpm, Vitest. New deps: `@radix-ui/react-popover`, `@radix-ui/react-checkbox` only.

**Spec:** `docs/superpowers/specs/2026-07-15-elasticvix-search-ui-design.md` (approved 2026-07-15).

## Global Constraints

- **Branch:** work on `feat/console-ui` (Plan 2 branch, not yet merged).
- **Relative imports only — NO `@/` alias** (WXT hard-maps `@` → repo root; the alias was removed on purpose).
- **App name `Elasticvix`** in user-visible text. Follow Elasticvue's *structure* but keep Elasticvix identity: shadcn tokens, Be Vietnam Pro, dark mode via the **`.dark` class**. No new fonts, no hardcoded hex colors, no CSS frameworks.
- **Reuse Plan 1 core** — never reimplement: `esRequest`/`detectVersion`/`fetchMapping` (`src/lib/rpc/client.ts`), connections repo (`src/lib/storage/connections.ts`), mapping cache via `makeGetFields` (`src/console/editor/getFields.ts`), `resolveCompletions`/`resolveKeyPath` (`src/lib/autocomplete/*`), types (`src/lib/types.ts`).
- **ES support:** 6.x (incl. 6.5) / 7 / 8 first-class, 9 best-effort. `hits.total` is a **number on ES6**, an object `{value, relation}` on ES7+.
- **Search page rules (from spec):** hide indices starting with `.`; page sizes **10/25/50/100, default 25**; table `from`/`size` **override** the same keys in the user query; sort & filter are **client-side on the current page only**; Search runs are **NOT** recorded to History/Saved; default query is `{"query":{"match_all":{}}}`.
- **Persist keys:** view → `elasticvix.view`; per-connection search state → `elasticvix.search.<connectionId>` (JSON `{selected, queryText}`).
- **React conventions (user ruleset):** function components; named `type Props`; no `React.FC`; destructured props; no `any` (use `unknown` + narrow); immutable updates; boolean props `is/has/can`; handlers `handleX`/props `onX`; **no `console.log`** — surface errors in UI state.
- **Testing:** Vitest for pure logic (`describe/it/expect` imported from `vitest`, tests colocated as `*.test.ts`). UI verified by `pnpm compile` + the mock harness smoke in Task 13. Real-ES verification (6.5/7/8) is a manual follow-up outside this plan.
- **Gates per task:** `pnpm test` and `pnpm compile` must pass before each commit. `pnpm build` for tasks that change the bundle graph (1, 12, 13).
- **Commits:** conventional format `<type>: <description>`, no attribution footer.

---

## File Structure

```
src/console/ui/popover.tsx                      # NEW  Task 1: shadcn copy-in (Radix popover)
src/console/ui/checkbox.tsx                     # NEW  Task 1: shadcn copy-in (Radix checkbox)
src/console/connections/authFields.ts           # NEW  Task 2: AuthConfig → dialog form prefill (pure)
src/console/connections/authFields.test.ts      # NEW  Task 2
src/console/connections/ConnectionDialog.tsx    # MOD  Task 2: prefill auth via initialAuthFields
src/console/search/indicesLib.ts                # NEW  Task 3: parse/filter/sort _cat/indices (pure)
src/console/search/indicesLib.test.ts           # NEW  Task 3
src/console/search/searchLib.ts                 # NEW  Task 4: total/merge/path/unionFields/esErrorReason (pure)
src/console/search/searchLib.test.ts            # NEW  Task 4
src/console/search/hitsLib.ts                   # NEW  Task 5: Hit, columns, cellText, sort, filter (pure)
src/console/search/hitsLib.test.ts              # NEW  Task 5
src/lib/autocomplete/engine.ts                  # MOD  Task 6: + bodyCompletions, bodyCompletionSource
src/lib/autocomplete/engine.test.ts             # MOD  Task 6: + bodyCompletions tests
src/console/connections/health.ts               # NEW  Task 7: ClusterStatus + dot class (pure)
src/console/connections/health.test.ts          # NEW  Task 7
src/console/connections/useClusterHealth.ts     # NEW  Task 7: GET /_cluster/health → status
src/console/connections/ClusterSelector.tsx     # NEW  Task 7: dropdown switch/edit/delete/add + health dot
src/console/connections/useConnections.ts       # MOD  Task 7: remove() re-points active on delete
src/console/search/useIndices.ts                # NEW  Task 8: list indices for the active connection
src/console/search/IndicesSelect.tsx            # NEW  Task 8: popover multi-select with filter + reload
src/console/search/useSearch.ts                 # NEW  Task 9: run/pagination/persist state machine
src/console/search/SearchEditor.tsx             # NEW  Task 9: body-only CodeMirror + autocomplete + Mod-Enter
src/console/search/downloadJson.ts              # NEW  Task 10: filename (pure) + blob download
src/console/search/downloadJson.test.ts         # NEW  Task 10
src/console/search/HitsTable.tsx                # NEW  Task 10: table + sort + filter + pagination footer
src/console/search/DocDialog.tsx                # NEW  Task 10: hit detail + copy
src/console/search/AggregationsView.tsx         # NEW  Task 10: aggregations JSON view
src/console/search/SearchPage.tsx               # NEW  Task 11: compose the page
src/console/nav/TopNav.tsx                      # NEW  Task 12: brand + ClusterSelector + nav tabs + theme toggle
src/console/layout/ConsoleLayout.tsx            # MOD  Task 12: split into AppShell + RestPanes
src/console/App.tsx                             # MOD  Task 12: view state + TopNav + SearchPage
src/console/connections/ConnectionSwitcher.tsx  # DEL  Task 12: replaced by ClusterSelector
```

---

### Task 1: shadcn UI primitives — Popover + Checkbox

**Files:**
- Create: `src/console/ui/popover.tsx`
- Create: `src/console/ui/checkbox.tsx`
- Modify: `package.json` (via `pnpm add`)

**Interfaces:**
- Consumes: `cn` from `src/console/lib/utils.ts` (existing).
- Produces: `Popover`, `PopoverTrigger`, `PopoverContent` and `Checkbox` — Radix-based, used by Tasks 7, 8.

- [ ] **Step 1: Install the two Radix primitives**

```bash
pnpm add @radix-ui/react-popover @radix-ui/react-checkbox
```

- [ ] **Step 2: Create `src/console/ui/popover.tsx`**

```tsx
import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '../lib/utils';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

function PopoverContent({
  className,
  align = 'start',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-72 rounded-md border bg-popover p-2 text-popover-foreground shadow-md outline-none',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
```

- [ ] **Step 3: Create `src/console/ui/checkbox.tsx`**

```tsx
import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '../lib/utils';

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="h-3.5 w-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
```

- [ ] **Step 4: Verify**

Run: `pnpm compile`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/console/ui/popover.tsx src/console/ui/checkbox.tsx
git commit -m "feat(ui): add popover and checkbox shadcn primitives"
```

---

### Task 2: ConnectionDialog auth prefill (bug fix, part 1)

**Files:**
- Create: `src/console/connections/authFields.ts`
- Create: `src/console/connections/authFields.test.ts`
- Modify: `src/console/connections/ConnectionDialog.tsx:22-27`

**Interfaces:**
- Consumes: `AuthConfig` from `src/lib/types.ts`.
- Produces: `initialAuthFields(auth: AuthConfig | undefined): AuthFormFields` where `AuthFormFields = { username: string; password: string; secret: string }`. Contract for callers (Task 7, 11): **the dialog initializes state once per mount — always remount it per open with `key={conn?.id ?? 'new'}` and render it only while open.**

- [ ] **Step 1: Write the failing test — `src/console/connections/authFields.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { initialAuthFields } from './authFields';

describe('initialAuthFields', () => {
  it('prefills basic auth credentials', () => {
    expect(initialAuthFields({ type: 'basic', username: 'elastic', password: 's3cret' })).toEqual({
      username: 'elastic',
      password: 's3cret',
      secret: '',
    });
  });

  it('prefills the shared secret field for apiKey and bearer', () => {
    expect(initialAuthFields({ type: 'apiKey', apiKey: 'abc' })).toEqual({ username: '', password: '', secret: 'abc' });
    expect(initialAuthFields({ type: 'bearer', token: 'tok' })).toEqual({ username: '', password: '', secret: 'tok' });
  });

  it('returns empty fields for none or missing auth', () => {
    expect(initialAuthFields({ type: 'none' })).toEqual({ username: '', password: '', secret: '' });
    expect(initialAuthFields(undefined)).toEqual({ username: '', password: '', secret: '' });
  });
});
```

- [ ] **Step 2: Run it — must fail**

Run: `pnpm vitest run src/console/connections/authFields.test.ts`
Expected: FAIL (module `./authFields` not found).

- [ ] **Step 3: Implement `src/console/connections/authFields.ts`**

```ts
import type { AuthConfig } from '../../lib/types';

export interface AuthFormFields {
  username: string;
  password: string;
  secret: string;
}

export function initialAuthFields(auth: AuthConfig | undefined): AuthFormFields {
  if (auth?.type === 'basic') return { username: auth.username, password: auth.password, secret: '' };
  if (auth?.type === 'apiKey') return { username: '', password: '', secret: auth.apiKey };
  if (auth?.type === 'bearer') return { username: '', password: '', secret: auth.token };
  return { username: '', password: '', secret: '' };
}
```

- [ ] **Step 4: Run tests — must pass**

Run: `pnpm vitest run src/console/connections/authFields.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Use it in `ConnectionDialog`**

In `src/console/connections/ConnectionDialog.tsx`, add the import and replace the three empty-string `useState('')` initializers (lines 25–27):

```tsx
import { initialAuthFields } from './authFields';
```

```tsx
export function ConnectionDialog({ isOpen, initial, onOpenChange, onSave, onTest }: Props) {
  // State initializes once per mount — callers must remount per open (key={conn?.id ?? 'new'}).
  const init = initialAuthFields(initial?.auth);
  const [name, setName] = useState(initial?.name ?? '');
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? 'http://localhost:9200');
  const [authType, setAuthType] = useState<AuthConfig['type']>(initial?.auth.type ?? 'none');
  const [username, setUsername] = useState(init.username);
  const [password, setPassword] = useState(init.password);
  const [secret, setSecret] = useState(init.secret);
```

The rest of the component is unchanged.

- [ ] **Step 6: Verify and commit**

Run: `pnpm test && pnpm compile`
Expected: all tests pass, no type errors.

```bash
git add src/console/connections/authFields.ts src/console/connections/authFields.test.ts src/console/connections/ConnectionDialog.tsx
git commit -m "fix(connections): prefill auth fields when editing a connection"
```

---

### Task 3: indicesLib — parse `_cat/indices`

**Files:**
- Create: `src/console/search/indicesLib.ts`
- Create: `src/console/search/indicesLib.test.ts`

**Interfaces:**
- Produces: `IndexInfo = { index: string; health?: string; docsCount?: string }` and `parseCatIndices(body: unknown): IndexInfo[]` — drops `.`-prefixed (system) indices, drops malformed rows, sorts by name ascending. Input is the parsed JSON of `GET /_cat/indices?format=json&h=index,health,docs.count` (note: the docs-count key in each row is literally `"docs.count"`).

- [ ] **Step 1: Write the failing test — `src/console/search/indicesLib.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseCatIndices } from './indicesLib';

describe('parseCatIndices', () => {
  it('parses rows, drops system indices, and sorts by name', () => {
    const body = [
      { index: 'zeta', health: 'yellow', 'docs.count': '12' },
      { index: '.kibana_1', health: 'green', 'docs.count': '1' },
      { index: 'alpha', health: 'green', 'docs.count': '3' },
    ];
    expect(parseCatIndices(body)).toEqual([
      { index: 'alpha', health: 'green', docsCount: '3' },
      { index: 'zeta', health: 'yellow', docsCount: '12' },
    ]);
  });

  it('returns [] for non-array bodies', () => {
    expect(parseCatIndices({ error: 'boom' })).toEqual([]);
    expect(parseCatIndices(undefined)).toEqual([]);
  });

  it('skips malformed rows and tolerates missing optional columns', () => {
    const body = [{ index: 'a' }, 'junk', { health: 'green' }, null];
    expect(parseCatIndices(body)).toEqual([{ index: 'a', health: undefined, docsCount: undefined }]);
  });
});
```

- [ ] **Step 2: Run it — must fail**

Run: `pnpm vitest run src/console/search/indicesLib.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/console/search/indicesLib.ts`**

```ts
export interface IndexInfo {
  index: string;
  health?: string;
  docsCount?: string;
}

export function parseCatIndices(body: unknown): IndexInfo[] {
  if (!Array.isArray(body)) return [];
  const out: IndexInfo[] = [];
  for (const row of body) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (typeof r.index !== 'string' || r.index.startsWith('.')) continue;
    out.push({
      index: r.index,
      health: typeof r.health === 'string' ? r.health : undefined,
      docsCount: typeof r['docs.count'] === 'string' ? r['docs.count'] : undefined,
    });
  }
  return out.sort((a, b) => a.index.localeCompare(b.index));
}
```

- [ ] **Step 4: Run tests — must pass**

Run: `pnpm vitest run src/console/search/indicesLib.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/console/search/indicesLib.ts src/console/search/indicesLib.test.ts
git commit -m "feat(search): parse and filter _cat/indices"
```

---

### Task 4: searchLib — total / merge / path / fields / error reason

**Files:**
- Create: `src/console/search/searchLib.ts`
- Create: `src/console/search/searchLib.test.ts`

**Interfaces:**
- Consumes: `FlatField` from `src/lib/types.ts`.
- Produces (used by Tasks 9, 10, 11):
  - `TotalInfo = { value: number; isGte: boolean }`
  - `normalizeTotal(responseBody: unknown): TotalInfo` — ES6 numeric & ES7+ object totals.
  - `mergeFromSize(queryText: string, from: number, size: number): string | undefined` — returns the merged JSON string, `undefined` when `queryText` is not a JSON object (table state wins over user-typed `from`/`size`; empty editor counts as `{}`).
  - `buildSearchPath(indices: string[]): string` — `/a,b/_search`.
  - `unionFields(lists: FlatField[][]): FlatField[]` — dedupe by `path`, first type wins.
  - `esErrorReason(responseBody: unknown): string | undefined` — first `root_cause` reason, else `error.reason`, else string `error`, else `undefined`.

- [ ] **Step 1: Write the failing test — `src/console/search/searchLib.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildSearchPath, esErrorReason, mergeFromSize, normalizeTotal, unionFields } from './searchLib';

describe('normalizeTotal', () => {
  it('reads the ES6 numeric total', () => {
    expect(normalizeTotal({ hits: { total: 42 } })).toEqual({ value: 42, isGte: false });
  });

  it('reads the ES7+ object total with gte relation', () => {
    expect(normalizeTotal({ hits: { total: { value: 10000, relation: 'gte' } } })).toEqual({ value: 10000, isGte: true });
    expect(normalizeTotal({ hits: { total: { value: 7, relation: 'eq' } } })).toEqual({ value: 7, isGte: false });
  });

  it('falls back to zero when total is missing', () => {
    expect(normalizeTotal({})).toEqual({ value: 0, isGte: false });
    expect(normalizeTotal(undefined)).toEqual({ value: 0, isGte: false });
  });
});

describe('mergeFromSize', () => {
  it('overrides from/size the user typed in the query', () => {
    const merged = mergeFromSize('{"query":{"match_all":{}},"from":99,"size":1}', 0, 25);
    expect(JSON.parse(merged as string)).toEqual({ query: { match_all: {} }, from: 0, size: 25 });
  });

  it('treats an empty editor as an empty object', () => {
    expect(JSON.parse(mergeFromSize('', 25, 25) as string)).toEqual({ from: 25, size: 25 });
  });

  it('returns undefined for invalid JSON or non-object roots', () => {
    expect(mergeFromSize('{oops', 0, 25)).toBeUndefined();
    expect(mergeFromSize('[1,2]', 0, 25)).toBeUndefined();
  });
});

describe('buildSearchPath', () => {
  it('joins indices with commas', () => {
    expect(buildSearchPath(['a'])).toBe('/a/_search');
    expect(buildSearchPath(['a', 'b'])).toBe('/a,b/_search');
  });
});

describe('unionFields', () => {
  it('dedupes by path keeping the first type seen', () => {
    expect(
      unionFields([
        [{ path: 'user.name', type: 'keyword' }],
        [
          { path: 'user.name', type: 'text' },
          { path: 'age', type: 'long' },
        ],
      ]),
    ).toEqual([
      { path: 'user.name', type: 'keyword' },
      { path: 'age', type: 'long' },
    ]);
  });
});

describe('esErrorReason', () => {
  it('prefers the first root_cause reason', () => {
    const body = { error: { root_cause: [{ reason: 'no such index [nope]' }], reason: 'outer' }, status: 404 };
    expect(esErrorReason(body)).toBe('no such index [nope]');
  });

  it('falls back to error.reason, then string errors, then undefined', () => {
    expect(esErrorReason({ error: { reason: 'parse error' } })).toBe('parse error');
    expect(esErrorReason({ error: 'plain string error' })).toBe('plain string error');
    expect(esErrorReason({})).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it — must fail**

Run: `pnpm vitest run src/console/search/searchLib.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/console/search/searchLib.ts`**

```ts
import type { FlatField } from '../../lib/types';

export interface TotalInfo {
  value: number;
  isGte: boolean;
}

export function normalizeTotal(responseBody: unknown): TotalInfo {
  const total = (responseBody as { hits?: { total?: unknown } } | null | undefined)?.hits?.total;
  if (typeof total === 'number') return { value: total, isGte: false }; // ES6
  if (total && typeof total === 'object') {
    const t = total as { value?: unknown; relation?: unknown };
    return { value: typeof t.value === 'number' ? t.value : 0, isGte: t.relation === 'gte' };
  }
  return { value: 0, isGte: false };
}

export function mergeFromSize(queryText: string, from: number, size: number): string | undefined {
  try {
    const parsed: unknown = JSON.parse(queryText.trim() || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    return JSON.stringify({ ...(parsed as Record<string, unknown>), from, size });
  } catch {
    return undefined;
  }
}

export function buildSearchPath(indices: string[]): string {
  return `/${indices.join(',')}/_search`;
}

export function unionFields(lists: FlatField[][]): FlatField[] {
  const seen = new Map<string, FlatField>();
  for (const list of lists) {
    for (const field of list) {
      if (!seen.has(field.path)) seen.set(field.path, field);
    }
  }
  return [...seen.values()];
}

export function esErrorReason(responseBody: unknown): string | undefined {
  const err = (responseBody as { error?: unknown } | null | undefined)?.error;
  if (typeof err === 'string') return err;
  if (!err || typeof err !== 'object') return undefined;
  const e = err as { reason?: unknown; root_cause?: unknown };
  const rootCause = Array.isArray(e.root_cause) ? (e.root_cause[0] as { reason?: unknown } | undefined) : undefined;
  const reason = rootCause?.reason ?? e.reason;
  return typeof reason === 'string' ? reason : undefined;
}
```

- [ ] **Step 4: Run tests — must pass**

Run: `pnpm vitest run src/console/search/searchLib.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/console/search/searchLib.ts src/console/search/searchLib.test.ts
git commit -m "feat(search): search request/response helpers"
```

---

### Task 5: hitsLib — table data helpers

**Files:**
- Create: `src/console/search/hitsLib.ts`
- Create: `src/console/search/hitsLib.test.ts`

**Interfaces:**
- Produces (used by Tasks 10, 11):
  - `Hit = { _index?: string; _id?: string; _score?: number | null; _source?: Record<string, unknown> }`
  - `SortDir = 'asc' | 'desc'`
  - `extractHits(responseBody: unknown): Hit[]`
  - `deriveColumns(hits: Hit[], hasMultipleIndices: boolean): string[]` — `['_index'?, '_id', ...sourceKeys]`, source keys in first-appearance order across the page.
  - `cellText(hit: Hit, column: string): string` — metadata columns from the hit, others from `_source`; objects/arrays JSON-stringified; null/undefined → `''`.
  - `sortHits(hits: Hit[], column: string, dir: SortDir): Hit[]` — immutable; numeric compare when both cells parse as numbers, else `localeCompare`.
  - `filterHits(hits: Hit[], columns: string[], query: string): Hit[]` — case-insensitive substring over every rendered cell; blank query returns input.

- [ ] **Step 1: Write the failing test — `src/console/search/hitsLib.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { cellText, deriveColumns, extractHits, filterHits, sortHits, type Hit } from './hitsLib';

const hits: Hit[] = [
  { _index: 'a', _id: '1', _source: { name: 'zeta', age: 30, meta: { x: 1 } } },
  { _index: 'b', _id: '2', _source: { name: 'alpha', city: 'HN' } },
];

describe('extractHits', () => {
  it('extracts hits.hits arrays and tolerates malformed bodies', () => {
    expect(extractHits({ hits: { hits } })).toEqual(hits);
    expect(extractHits({})).toEqual([]);
    expect(extractHits(undefined)).toEqual([]);
  });
});

describe('deriveColumns', () => {
  it('unions _source keys in first-appearance order after _id', () => {
    expect(deriveColumns(hits, false)).toEqual(['_id', 'name', 'age', 'meta', 'city']);
  });

  it('prepends _index when several indices are selected', () => {
    expect(deriveColumns(hits, true)).toEqual(['_index', '_id', 'name', 'age', 'meta', 'city']);
  });
});

describe('cellText', () => {
  it('renders metadata, primitives, objects, and missing values', () => {
    expect(cellText(hits[0], '_id')).toBe('1');
    expect(cellText(hits[0], '_index')).toBe('a');
    expect(cellText(hits[0], 'age')).toBe('30');
    expect(cellText(hits[0], 'meta')).toBe('{"x":1}');
    expect(cellText(hits[0], 'city')).toBe('');
  });
});

describe('sortHits', () => {
  it('sorts without mutating the input', () => {
    const byName = sortHits(hits, 'name', 'asc');
    expect(byName.map((h) => h._id)).toEqual(['2', '1']);
    expect(hits[0]._id).toBe('1');
  });

  it('sorts 2 vs 10 numerically, not lexically', () => {
    const nums: Hit[] = [
      { _id: 'x', _source: { n: 10 } },
      { _id: 'y', _source: { n: 2 } },
    ];
    expect(sortHits(nums, 'n', 'asc').map((h) => h._id)).toEqual(['y', 'x']);
    expect(sortHits(nums, 'n', 'desc').map((h) => h._id)).toEqual(['x', 'y']);
  });
});

describe('filterHits', () => {
  const columns = deriveColumns(hits, true);

  it('matches case-insensitively across all rendered cells', () => {
    expect(filterHits(hits, columns, 'ALPHA').map((h) => h._id)).toEqual(['2']);
    expect(filterHits(hits, columns, '"x":1').map((h) => h._id)).toEqual(['1']);
  });

  it('returns all hits for blank queries', () => {
    expect(filterHits(hits, columns, '  ')).toEqual(hits);
  });
});
```

- [ ] **Step 2: Run it — must fail**

Run: `pnpm vitest run src/console/search/hitsLib.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/console/search/hitsLib.ts`**

```ts
export interface Hit {
  _index?: string;
  _id?: string;
  _score?: number | null;
  _source?: Record<string, unknown>;
}

export type SortDir = 'asc' | 'desc';

export function extractHits(responseBody: unknown): Hit[] {
  const hits = (responseBody as { hits?: { hits?: unknown } } | null | undefined)?.hits?.hits;
  return Array.isArray(hits) ? (hits as Hit[]) : [];
}

export function deriveColumns(hits: Hit[], hasMultipleIndices: boolean): string[] {
  const sourceKeys: string[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    for (const key of Object.keys(hit._source ?? {})) {
      if (!seen.has(key)) {
        seen.add(key);
        sourceKeys.push(key);
      }
    }
  }
  return [...(hasMultipleIndices ? ['_index'] : []), '_id', ...sourceKeys];
}

export function cellText(hit: Hit, column: string): string {
  const value = column === '_index' || column === '_id' ? hit[column] : hit._source?.[column];
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function sortHits(hits: Hit[], column: string, dir: SortDir): Hit[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...hits].sort((a, b) => {
    const ta = cellText(a, column);
    const tb = cellText(b, column);
    const na = Number(ta);
    const nb = Number(tb);
    const isNumeric = ta !== '' && tb !== '' && !Number.isNaN(na) && !Number.isNaN(nb);
    return sign * (isNumeric ? na - nb : ta.localeCompare(tb));
  });
}

export function filterHits(hits: Hit[], columns: string[], query: string): Hit[] {
  const q = query.trim().toLowerCase();
  if (!q) return hits;
  return hits.filter((hit) => columns.some((column) => cellText(hit, column).toLowerCase().includes(q)));
}
```

- [ ] **Step 4: Run tests — must pass**

Run: `pnpm vitest run src/console/search/hitsLib.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/console/search/hitsLib.ts src/console/search/hitsLib.test.ts
git commit -m "feat(search): hits table data helpers"
```

---

### Task 6: engine — body-only completions for the Search editor

**Files:**
- Modify: `src/lib/autocomplete/engine.ts` (append after `docCompletions`, before `esCompletionSource`)
- Modify: `src/lib/autocomplete/engine.test.ts` (append a describe block)

**Interfaces:**
- Consumes: existing `resolveCompletions`, `resolveKeyPath`, `defaultSpec`, `KIND_TO_CM` (all already in `engine.ts`).
- Produces (used by Task 9):
  - `bodyCompletions(docText: string, pos: number, fields: FlatField[]): CompletionItem[]` — the whole document is the JSON body of a `_search` request (no request line). Root ref: `defaultSpec.endpoints['_search']?.bodyRef ?? 'queryBody'`.
  - `bodyCompletionSource(getFields: () => Promise<FlatField[]>)` — CodeMirror completion source (note: `getFields` takes **no** index argument — the caller already scoped it to the selected indices).

- [ ] **Step 1: Write the failing tests — append to `src/lib/autocomplete/engine.test.ts`**

Add `bodyCompletions` to the existing import from `./engine`, then append:

```ts
describe('bodyCompletions (body-only Search page document)', () => {
  const oneField: FlatField[] = [{ path: 'title', type: 'text' }];

  it('suggests top-level _search keys at the root', () => {
    const doc = '{ "" }';
    const pos = doc.indexOf('""') + 1;
    const labels = bodyCompletions(doc, pos, oneField).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['query', 'size', 'from', 'sort', 'aggs']));
  });

  it('injects real field names in a field-key position (match)', () => {
    const doc = '{ "query": { "match": { "" } } }';
    const pos = doc.indexOf('""') + 1;
    expect(bodyCompletions(doc, pos, oneField)).toEqual([{ label: 'title', kind: 'field', detail: 'text' }]);
  });
});
```

- [ ] **Step 2: Run it — must fail**

Run: `pnpm vitest run src/lib/autocomplete/engine.test.ts`
Expected: FAIL (`bodyCompletions` is not exported).

- [ ] **Step 3: Implement — append to `src/lib/autocomplete/engine.ts`**

```ts
// Compute completions for a body-only document (Search page): the whole doc is
// the JSON body of a `_search` request — there is no request line to strip.
export function bodyCompletions(docText: string, pos: number, fields: FlatField[]): CompletionItem[] {
  const rootRef = defaultSpec.endpoints['_search']?.bodyRef ?? 'queryBody';
  const state = EditorState.create({ doc: docText, extensions: [json()] });
  const { path, inKey } = resolveKeyPath(state, pos);
  return resolveCompletions(defaultSpec, rootRef, path, inKey, fields);
}

// CodeMirror source for the Search page editor. `getFields` is already scoped
// to the selected indices by the caller, so it takes no index argument.
export function bodyCompletionSource(getFields: () => Promise<FlatField[]>) {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const fields = await getFields();
    const items = bodyCompletions(ctx.state.doc.toString(), ctx.pos, fields);
    if (items.length === 0) return null;

    const word = ctx.matchBefore(/[\w.]*/);
    return {
      from: word ? word.from : ctx.pos,
      options: items.map((it) => ({ label: it.label, type: KIND_TO_CM[it.kind], detail: it.detail })),
    };
  };
}
```

Note: `KIND_TO_CM` is declared later in the file than `docCompletions` — place these two functions **after** the `KIND_TO_CM` declaration (e.g. at the end of the file) so the const is initialized before use.

- [ ] **Step 4: Run tests — must pass**

Run: `pnpm vitest run src/lib/autocomplete/engine.test.ts`
Expected: all passed (existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/autocomplete/engine.ts src/lib/autocomplete/engine.test.ts
git commit -m "feat(autocomplete): body-only completion source for the search page"
```

---

### Task 7: ClusterSelector — health dot + switch/edit/delete/add (bug fix, part 2)

**Files:**
- Create: `src/console/connections/health.ts`
- Create: `src/console/connections/health.test.ts`
- Create: `src/console/connections/useClusterHealth.ts`
- Create: `src/console/connections/ClusterSelector.tsx`
- Modify: `src/console/connections/useConnections.ts:53-59` (the `remove` callback)

**Interfaces:**
- Consumes: `Popover` (Task 1), `ConnectionDialog` + remount contract (Task 2), `esRequest`, `useConnections`'s `TestResult`.
- Produces (used by Task 12):
  - `ClusterStatus = 'green' | 'yellow' | 'red' | 'unknown'`; `toClusterStatus(body: unknown): ClusterStatus`; `healthDotClass(status: ClusterStatus): string`.
  - `useClusterHealth(active: Connection | undefined): { status: ClusterStatus; reason?: string }` — `reason` explains an `unknown` status (transport error / HTTP status) and feeds the dot's tooltip.
  - `<ClusterSelector connections active? onSelect(id) onSave(conn) onDelete(id) onTest(conn) />` — full replacement for `ConnectionSwitcher`.
  - `useConnections().remove(id)` now re-points the active connection to the first remaining one (or clears it) when the active connection is deleted.

- [ ] **Step 1: Write the failing test — `src/console/connections/health.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { healthDotClass, toClusterStatus } from './health';

describe('toClusterStatus', () => {
  it('accepts the three ES statuses', () => {
    expect(toClusterStatus({ status: 'green' })).toBe('green');
    expect(toClusterStatus({ status: 'yellow' })).toBe('yellow');
    expect(toClusterStatus({ status: 'red' })).toBe('red');
  });

  it('maps anything else to unknown', () => {
    expect(toClusterStatus({ status: 'purple' })).toBe('unknown');
    expect(toClusterStatus({})).toBe('unknown');
    expect(toClusterStatus(undefined)).toBe('unknown');
  });
});

describe('healthDotClass', () => {
  it('maps each status to a tailwind dot class', () => {
    expect(healthDotClass('green')).toBe('bg-green-500');
    expect(healthDotClass('yellow')).toBe('bg-amber-500');
    expect(healthDotClass('red')).toBe('bg-red-500');
    expect(healthDotClass('unknown')).toBe('bg-gray-400');
  });
});
```

- [ ] **Step 2: Run it — must fail**

Run: `pnpm vitest run src/console/connections/health.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/console/connections/health.ts`**

```ts
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
```

- [ ] **Step 4: Run tests — must pass**

Run: `pnpm vitest run src/console/connections/health.test.ts`
Expected: all passed.

- [ ] **Step 5: Create `src/console/connections/useClusterHealth.ts`**

```ts
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
```

- [ ] **Step 6: Create `src/console/connections/ClusterSelector.tsx`**

```tsx
import { useState } from 'react';
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { Connection } from '../../lib/types';
import { ConnectionDialog } from './ConnectionDialog';
import type { TestResult } from './useConnections';
import { useClusterHealth } from './useClusterHealth';
import { healthDotClass } from './health';

type DialogState = { mode: 'add' } | { mode: 'edit'; conn: Connection };

type Props = {
  connections: Connection[];
  active?: Connection;
  onSelect: (id: string) => void;
  onSave: (conn: Connection) => void;
  onDelete: (id: string) => void;
  onTest: (conn: Connection) => Promise<TestResult>;
};

export function ClusterSelector({ connections, active, onSelect, onSave, onDelete, onTest }: Props) {
  const [isOpen, setOpen] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState | undefined>(undefined);
  const [confirmingId, setConfirmingId] = useState<string | undefined>(undefined);
  const { status, reason } = useClusterHealth(active);
  const dotTitle = reason ? `Cluster health unknown — ${reason}` : `Cluster health: ${status}`;

  const openDialog = (state: DialogState) => {
    setOpen(false);
    setConfirmingId(undefined);
    setDialogState(state);
  };

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) setConfirmingId(undefined);
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" title={dotTitle}>
            <span className={`inline-block h-2 w-2 rounded-full ${healthDotClass(status)}`} />
            <span className="max-w-40 truncate">{active ? active.name : 'No connection'}</span>
            {active?.version && <span className="text-muted-foreground">· {active.version}</span>}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-1">
          {connections.map((c) => (
            <div
              key={c.id}
              className={`flex items-center gap-1 rounded-sm px-2 py-1.5 text-sm hover:bg-accent ${
                c.id === active?.id ? 'bg-accent/50' : ''
              }`}
            >
              <button
                type="button"
                className="flex-1 truncate text-left"
                onClick={() => {
                  onSelect(c.id);
                  setOpen(false);
                }}
              >
                {c.name}
                {c.version && <span className="text-muted-foreground"> · {c.version}</span>}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label={`Edit ${c.name}`}
                onClick={() => openDialog({ mode: 'edit', conn: c })}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {confirmingId === c.id ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    onDelete(c.id);
                    setConfirmingId(undefined);
                  }}
                >
                  Delete?
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label={`Delete ${c.name}`}
                  onClick={() => setConfirmingId(c.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
          {connections.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">No connections yet.</p>}
          <div className="mt-1 border-t pt-1">
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => openDialog({ mode: 'add' })}>
              <Plus className="h-3.5 w-3.5" /> Add connection
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {dialogState && (
        <ConnectionDialog
          key={dialogState.mode === 'edit' ? dialogState.conn.id : 'new'}
          isOpen
          initial={dialogState.mode === 'edit' ? dialogState.conn : undefined}
          onOpenChange={(open) => {
            if (!open) setDialogState(undefined);
          }}
          onSave={onSave}
          onTest={onTest}
        />
      )}
    </>
  );
}
```

- [ ] **Step 7: Fix `remove` in `src/console/connections/useConnections.ts`**

Replace the existing `remove` callback (lines 53–59) with:

```ts
  const remove = useCallback(
    async (id: string) => {
      await deleteConnection(id);
      if (id === activeId) {
        const list = await listConnections();
        await setActiveConnectionId(list[0]?.id);
      }
      await reload();
    },
    [activeId, reload],
  );
```

(`listConnections` and `setActiveConnectionId` are already imported in this file; `setActiveConnectionId` accepts `undefined` to clear.)

- [ ] **Step 8: Verify and commit**

Run: `pnpm test && pnpm compile`
Expected: all tests pass, no type errors. (`ClusterSelector` is not wired into `App` yet — that happens in Task 12.)

```bash
git add src/console/connections/health.ts src/console/connections/health.test.ts src/console/connections/useClusterHealth.ts src/console/connections/ClusterSelector.tsx src/console/connections/useConnections.ts
git commit -m "feat(connections): cluster selector with health dot, edit and delete"
```

---

### Task 8: Indices multi-select

**Files:**
- Create: `src/console/search/useIndices.ts`
- Create: `src/console/search/IndicesSelect.tsx`

**Interfaces:**
- Consumes: `esRequest`, `parseCatIndices`/`IndexInfo` (Task 3), `Popover`/`Checkbox` (Task 1), `Input`/`Button` (existing).
- Produces (used by Task 11):
  - `useIndices(active: Connection | undefined): { indices: IndexInfo[]; isLoading: boolean; error?: string; reload(): Promise<void> }`
  - `<IndicesSelect indices selected isLoading error? onChange(selected: string[]) onReload() />`

- [ ] **Step 1: Create `src/console/search/useIndices.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import type { Connection } from '../../lib/types';
import { esRequest } from '../../lib/rpc/client';
import { parseCatIndices, type IndexInfo } from './indicesLib';

const CAT_INDICES_PATH = '/_cat/indices?format=json&h=index,health,docs.count';

export function useIndices(active: Connection | undefined) {
  const [indices, setIndices] = useState<IndexInfo[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const reload = useCallback(async () => {
    if (!active) {
      setIndices([]);
      setError(undefined);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const res = await esRequest(active, 'GET', CAT_INDICES_PATH);
      if (res.error) {
        setIndices([]);
        setError(res.error);
      } else if (res.status >= 400) {
        setIndices([]);
        setError(`HTTP ${res.status}`);
      } else {
        setIndices(parseCatIndices(res.body));
      }
    } catch (e) {
      setIndices([]);
      setError(e instanceof Error ? e.message : 'Failed to load indices');
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { indices, isLoading, error, reload };
}
```

- [ ] **Step 2: Create `src/console/search/IndicesSelect.tsx`**

```tsx
import { useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { IndexInfo } from './indicesLib';

type Props = {
  indices: IndexInfo[];
  selected: string[];
  isLoading: boolean;
  error?: string;
  onChange: (selected: string[]) => void;
  onReload: () => void;
};

function triggerLabel(selected: string[]): string {
  if (selected.length === 0) return 'Select indices';
  if (selected.length === 1) return selected[0];
  return `${selected[0]} +${selected.length - 1}`;
}

export function IndicesSelect({ indices, selected, isLoading, error, onChange, onReload }: Props) {
  const [filter, setFilter] = useState('');
  const visible = indices.filter((i) => i.index.toLowerCase().includes(filter.trim().toLowerCase()));

  const toggle = (name: string, isChecked: boolean) => {
    onChange(isChecked ? [...selected, name] : selected.filter((s) => s !== name));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-72 justify-between">
          <span className="truncate">{triggerLabel(selected)}</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2">
        <div className="flex items-center gap-1 pb-2">
          <Input placeholder="Filter indices…" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8" />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Reload indices" onClick={onReload}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {error && (
          <p className="px-1 pb-2 text-sm text-destructive">
            {error}{' '}
            <button type="button" className="underline" onClick={onReload}>
              Retry
            </button>
          </p>
        )}
        <div className="max-h-64 overflow-y-auto">
          {visible.map((i) => (
            <label
              key={i.index}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-sm hover:bg-accent"
            >
              <Checkbox checked={selected.includes(i.index)} onCheckedChange={(v) => toggle(i.index, v === true)} />
              <span className="flex-1 truncate">{i.index}</span>
              {i.docsCount && <span className="text-xs text-muted-foreground tabular-nums">{i.docsCount}</span>}
            </label>
          ))}
          {!error && visible.length === 0 && (
            <p className="px-1 py-2 text-sm text-muted-foreground">{isLoading ? 'Loading…' : 'No indices.'}</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm compile`
Expected: no type errors.

```bash
git add src/console/search/useIndices.ts src/console/search/IndicesSelect.tsx
git commit -m "feat(search): indices multi-select with filter and reload"
```

---

### Task 9: useSearch state machine + body-only SearchEditor

**Files:**
- Create: `src/console/search/useSearch.ts`
- Create: `src/console/search/SearchEditor.tsx`

**Interfaces:**
- Consumes: `esRequest`, `EsResult`, `mergeFromSize`/`buildSearchPath`/`normalizeTotal`/`TotalInfo` (Task 4), `bodyCompletionSource` (Task 6), `useTheme`.
- Produces (used by Tasks 10, 11):
  - `DEFAULT_QUERY: string`, `PAGE_SIZES: readonly [10, 25, 50, 100]`.
  - `useSearch(active)` returns `{ selected, selectIndices(string[]), queryText, changeQuery(string), response?: EsResult, total?: TotalInfo, isRunning, page, size, inputError?, runSearch(), goToPage(p), changeSize(s) }`. Persists `{selected, queryText}` to `localStorage` under `elasticvix.search.<connectionId>` inside the change callbacks (NOT in an effect — an effect would race the connection-switch load and overwrite the stored state with defaults).
  - `<SearchEditor value onChange onRun getFields />` where `getFields: () => Promise<FlatField[]>`.

- [ ] **Step 1: Create `src/console/search/useSearch.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import type { Connection } from '../../lib/types';
import type { EsResult } from '../../lib/rpc/messages';
import { esRequest } from '../../lib/rpc/client';
import { buildSearchPath, mergeFromSize, normalizeTotal, type TotalInfo } from './searchLib';

export const DEFAULT_QUERY = '{\n  "query": {\n    "match_all": {}\n  }\n}';
export const PAGE_SIZES = [10, 25, 50, 100] as const;
const DEFAULT_SIZE = 25;

interface PersistedSearch {
  selected: string[];
  queryText: string;
}

function storageKey(connectionId: string): string {
  return `elasticvix.search.${connectionId}`;
}

function loadPersisted(connectionId: string): PersistedSearch {
  try {
    const raw = localStorage.getItem(storageKey(connectionId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedSearch>;
      return {
        selected: Array.isArray(parsed.selected)
          ? parsed.selected.filter((s): s is string => typeof s === 'string')
          : [],
        queryText: typeof parsed.queryText === 'string' ? parsed.queryText : DEFAULT_QUERY,
      };
    }
  } catch {
    /* corrupted state falls back to defaults */
  }
  return { selected: [], queryText: DEFAULT_QUERY };
}

function persist(connectionId: string, next: PersistedSearch): void {
  localStorage.setItem(storageKey(connectionId), JSON.stringify(next));
}

export function useSearch(active: Connection | undefined) {
  const [selected, setSelected] = useState<string[]>([]);
  const [queryText, setQueryText] = useState(DEFAULT_QUERY);
  const [response, setResponse] = useState<EsResult | undefined>(undefined);
  const [total, setTotal] = useState<TotalInfo | undefined>(undefined);
  const [isRunning, setRunning] = useState(false);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [inputError, setInputError] = useState<string | undefined>(undefined);

  const activeId = active?.id;

  // Reload persisted selection + query whenever the active connection changes.
  useEffect(() => {
    const persisted = activeId ? loadPersisted(activeId) : { selected: [], queryText: DEFAULT_QUERY };
    setSelected(persisted.selected);
    setQueryText(persisted.queryText);
    setResponse(undefined);
    setTotal(undefined);
    setPage(1);
    setInputError(undefined);
  }, [activeId]);

  const selectIndices = useCallback(
    (next: string[]) => {
      setSelected(next);
      setPage(1);
      if (activeId) persist(activeId, { selected: next, queryText });
    },
    [activeId, queryText],
  );

  const changeQuery = useCallback(
    (text: string) => {
      setQueryText(text);
      if (activeId) persist(activeId, { selected, queryText: text });
    },
    [activeId, selected],
  );

  const runAt = useCallback(
    async (nextPage: number, nextSize: number) => {
      if (!active || selected.length === 0) return;
      const body = mergeFromSize(queryText, (nextPage - 1) * nextSize, nextSize);
      if (body === undefined) {
        setInputError('Query is not valid JSON');
        return;
      }
      setInputError(undefined);
      setRunning(true);
      try {
        const result = await esRequest(active, 'POST', buildSearchPath(selected), body);
        setResponse(result);
        setTotal(result.status >= 200 && result.status < 300 ? normalizeTotal(result.body) : undefined);
        setPage(nextPage);
        setSize(nextSize);
      } finally {
        setRunning(false);
      }
    },
    [active, selected, queryText],
  );

  const runSearch = useCallback(() => runAt(1, size), [runAt, size]);
  const goToPage = useCallback((p: number) => runAt(p, size), [runAt, size]);
  const changeSize = useCallback((s: number) => runAt(1, s), [runAt]);

  return {
    selected,
    selectIndices,
    queryText,
    changeQuery,
    response,
    total,
    isRunning,
    page,
    size,
    inputError,
    runSearch,
    goToPage,
    changeSize,
  };
}
```

- [ ] **Step 2: Create `src/console/search/SearchEditor.tsx`**

```tsx
import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { autocompletion } from '@codemirror/autocomplete';
import { keymap } from '@codemirror/view';
import type { FlatField } from '../../lib/types';
import { bodyCompletionSource } from '../../lib/autocomplete/engine';
import { useTheme } from '../theme';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  getFields: () => Promise<FlatField[]>;
};

export function SearchEditor({ value, onChange, onRun, getFields }: Props) {
  const { theme } = useTheme();

  const extensions = useMemo(
    () => [
      json(),
      autocompletion({ override: [bodyCompletionSource(getFields)] }),
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            onRun();
            return true;
          },
        },
      ]),
    ],
    [getFields, onRun],
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={theme === 'dark' ? 'dark' : 'light'}
      height="100%"
    />
  );
}
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm compile`
Expected: all green.

```bash
git add src/console/search/useSearch.ts src/console/search/SearchEditor.tsx
git commit -m "feat(search): search runner with pagination and body-only editor"
```

---

### Task 10: HitsTable + DocDialog + AggregationsView + download

**Files:**
- Create: `src/console/search/downloadJson.ts`
- Create: `src/console/search/downloadJson.test.ts`
- Create: `src/console/search/HitsTable.tsx`
- Create: `src/console/search/DocDialog.tsx`
- Create: `src/console/search/AggregationsView.tsx`

**Interfaces:**
- Consumes: `hitsLib` (Task 5), `TotalInfo` (Task 4), `PAGE_SIZES` (Task 9), existing `Button`/`Input`/`Select`/`Dialog`/`Tabs` primitives, `useTheme`.
- Produces (used by Task 11):
  - `searchDownloadName(now: Date): string`, `downloadJson(data: unknown, filename: string): void`.
  - `<HitsTable hits hasMultipleIndices total? page size isRunning onPageChange(p) onSizeChange(s) onRowClick(hit) />` — owns sort + filter state internally (both client-side, current page only).
  - `<DocDialog hit? onClose() />` — open when `hit !== undefined`.
  - `<AggregationsView responseBody />` — renders `responseBody.aggregations` or an empty-state message.

- [ ] **Step 1: Write the failing test — `src/console/search/downloadJson.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { searchDownloadName } from './downloadJson';

describe('searchDownloadName', () => {
  it('builds a filename without characters that are invalid on disk', () => {
    const name = searchDownloadName(new Date('2026-07-15T10:30:00Z'));
    expect(name).toBe('elasticvix-search-2026-07-15T10-30-00.json');
    expect(name).not.toMatch(/[:*?"<>|\\/]/);
  });
});
```

- [ ] **Step 2: Run it — must fail**

Run: `pnpm vitest run src/console/search/downloadJson.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/console/search/downloadJson.ts`**

```ts
export function searchDownloadName(now: Date): string {
  const stamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
  return `elasticvix-search-${stamp}.json`;
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run tests — must pass**

Run: `pnpm vitest run src/console/search/downloadJson.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Create `src/console/search/HitsTable.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cellText, deriveColumns, filterHits, sortHits, type Hit, type SortDir } from './hitsLib';
import type { TotalInfo } from './searchLib';
import { PAGE_SIZES } from './useSearch';

type Props = {
  hits: Hit[];
  hasMultipleIndices: boolean;
  total?: TotalInfo;
  page: number;
  size: number;
  isRunning: boolean;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  onRowClick: (hit: Hit) => void;
};

type Sort = { column: string; dir: SortDir };

export function HitsTable({
  hits,
  hasMultipleIndices,
  total,
  page,
  size,
  isRunning,
  onPageChange,
  onSizeChange,
  onRowClick,
}: Props) {
  const [sort, setSort] = useState<Sort | undefined>(undefined);
  const [filter, setFilter] = useState('');

  const columns = useMemo(() => deriveColumns(hits, hasMultipleIndices), [hits, hasMultipleIndices]);
  const rows = useMemo(() => {
    const filtered = filterHits(hits, columns, filter);
    return sort ? sortHits(filtered, sort.column, sort.dir) : filtered;
  }, [hits, columns, filter, sort]);

  const handleSort = (column: string) => {
    setSort((prev) =>
      prev?.column === column ? { column, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { column, dir: 'asc' },
    );
  };

  if (hits.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No results.</div>;
  }

  const from = (page - 1) * size;
  const lastPage = total ? Math.max(1, Math.ceil(total.value / size)) : page;
  const totalLabel = total ? `${total.value}${total.isGte ? '+' : ''}` : '?';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-end border-b px-2 py-1.5">
        <Input
          placeholder="Filter current page…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 w-64"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background">
            <tr className="border-b text-left">
              {columns.map((c) => (
                <th key={c} className="whitespace-nowrap px-2 py-1.5 font-medium">
                  <button type="button" className="hover:text-primary" onClick={() => handleSort(c)}>
                    {c}
                    {sort?.column === c && <span> {sort.dir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((h, i) => (
              <tr
                key={`${h._index ?? ''}-${h._id ?? i}`}
                className="cursor-pointer border-b hover:bg-accent/50"
                onClick={() => onRowClick(h)}
              >
                {columns.map((c) => (
                  <td key={c} className="max-w-64 truncate px-2 py-1.5" title={cellText(h, c)}>
                    {cellText(h, c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-3 text-sm text-muted-foreground">No rows match the filter.</p>}
      </div>
      <div className="flex items-center justify-end gap-3 border-t px-2 py-1.5 text-sm tabular-nums">
        <span className="text-muted-foreground">Rows per page</span>
        <Select value={String(size)} onValueChange={(v) => onSizeChange(Number(v))}>
          <SelectTrigger className="h-7 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>
          {from + 1}–{from + rows.length} of {totalLabel}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={isRunning || page <= 1}
          aria-label="Previous page"
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={isRunning || page >= lastPage}
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `src/console/search/DocDialog.tsx`**

```tsx
import { useMemo } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import type { Hit } from './hitsLib';

type Props = {
  hit?: Hit;
  onClose: () => void;
};

export function DocDialog({ hit, onClose }: Props) {
  const pretty = useMemo(() => (hit ? JSON.stringify(hit, null, 2) : ''), [hit]);

  return (
    <Dialog
      open={hit !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">
            {hit?._index} / {hit?._id}
          </DialogTitle>
        </DialogHeader>
        <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 font-mono text-xs">{pretty}</pre>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(pretty)}>
            Copy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 7: Create `src/console/search/AggregationsView.tsx`**

```tsx
import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { useTheme } from '../theme';

type Props = {
  responseBody: unknown;
};

export function AggregationsView({ responseBody }: Props) {
  const { theme } = useTheme();
  const aggs = (responseBody as { aggregations?: unknown } | null | undefined)?.aggregations;
  const pretty = useMemo(() => (aggs === undefined ? '' : JSON.stringify(aggs, null, 2)), [aggs]);

  if (aggs === undefined) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        The query has no aggregations. Add an &quot;aggs&quot; block and search again.
      </div>
    );
  }

  return (
    <CodeMirror
      value={pretty}
      editable={false}
      extensions={[json(), EditorView.lineWrapping]}
      theme={theme === 'dark' ? 'dark' : 'light'}
      height="100%"
    />
  );
}
```

- [ ] **Step 8: Verify and commit**

Run: `pnpm test && pnpm compile`
Expected: all green.

```bash
git add src/console/search/downloadJson.ts src/console/search/downloadJson.test.ts src/console/search/HitsTable.tsx src/console/search/DocDialog.tsx src/console/search/AggregationsView.tsx
git commit -m "feat(search): hits table, doc dialog, aggregations view, download"
```

---

### Task 11: SearchPage — compose

**Files:**
- Create: `src/console/search/SearchPage.tsx`

**Interfaces:**
- Consumes: everything from Tasks 3–10, `makeGetFields` (existing), `ConnectionDialog` (+ remount contract), `Tabs` (existing).
- Produces (used by Task 12): `<SearchPage active onSaveConnection(conn) onTestConnection(conn) />`.

- [ ] **Step 1: Create `src/console/search/SearchPage.tsx`**

```tsx
import { useCallback, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import type { Connection, FlatField } from '../../lib/types';
import { makeGetFields } from '../editor/getFields';
import { ConnectionDialog } from '../connections/ConnectionDialog';
import type { TestResult } from '../connections/useConnections';
import { esErrorReason, unionFields } from './searchLib';
import { extractHits, type Hit } from './hitsLib';
import { useIndices } from './useIndices';
import { DEFAULT_QUERY, useSearch } from './useSearch';
import { IndicesSelect } from './IndicesSelect';
import { SearchEditor } from './SearchEditor';
import { HitsTable } from './HitsTable';
import { DocDialog } from './DocDialog';
import { AggregationsView } from './AggregationsView';
import { downloadJson, searchDownloadName } from './downloadJson';

type Props = {
  active: Connection | undefined;
  onSaveConnection: (conn: Connection) => void;
  onTestConnection: (conn: Connection) => Promise<TestResult>;
};

export function SearchPage({ active, onSaveConnection, onTestConnection }: Props) {
  const indicesState = useIndices(active);
  const search = useSearch(active);
  const [openHit, setOpenHit] = useState<Hit | undefined>(undefined);
  const [isAddOpen, setAddOpen] = useState(false);

  const getFields = useCallback(async (): Promise<FlatField[]> => {
    if (!active || search.selected.length === 0) return [];
    const perIndex = makeGetFields(active);
    const lists = await Promise.all(search.selected.map((index) => perIndex(index)));
    return unionFields(lists);
  }, [active, search.selected]);

  if (!active) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>No Elasticsearch connection yet.</p>
        <Button onClick={() => setAddOpen(true)}>Add connection</Button>
        {isAddOpen && (
          <ConnectionDialog
            key="new"
            isOpen
            onOpenChange={(open) => {
              if (!open) setAddOpen(false);
            }}
            onSave={onSaveConnection}
            onTest={onTestConnection}
          />
        )}
      </div>
    );
  }

  const hits = extractHits(search.response?.body);
  const isEsError = search.response !== undefined && (search.response.status === 0 || search.response.status >= 400);
  const errorHeadline = isEsError
    ? search.response?.error ?? esErrorReason(search.response?.body) ?? `HTTP ${search.response?.status}`
    : undefined;
  const hasResults = search.response !== undefined && !isEsError;
  const canSearch = search.selected.length > 0 && !search.isRunning;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <IndicesSelect
          indices={indicesState.indices}
          selected={search.selected}
          isLoading={indicesState.isLoading}
          error={indicesState.error}
          onChange={search.selectIndices}
          onReload={() => void indicesState.reload()}
        />
        <Button onClick={() => void search.runSearch()} disabled={!canSearch}>
          {search.isRunning ? 'Searching…' : 'Search'}
        </Button>
        {search.selected.length === 0 && <span className="text-sm text-muted-foreground">Select at least 1 index</span>}
        {hasResults && <span className="text-sm text-muted-foreground tabular-nums">{search.response?.took} ms</span>}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => search.changeQuery(DEFAULT_QUERY)}>
            Reset query
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={search.response === undefined}
            onClick={() => downloadJson(search.response?.body, searchDownloadName(new Date()))}
          >
            <Download className="h-4 w-4" /> JSON
          </Button>
        </div>
      </div>

      <div className="h-48 shrink-0 overflow-hidden rounded-md border">
        <SearchEditor
          value={search.queryText}
          onChange={search.changeQuery}
          onRun={() => void search.runSearch()}
          getFields={getFields}
        />
      </div>

      {(search.inputError ?? errorHeadline) && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm">
          <p className="font-medium text-destructive">{search.inputError ?? errorHeadline}</p>
          {isEsError && search.response && (
            <details className="mt-1">
              <summary className="cursor-pointer text-muted-foreground">Raw error</summary>
              <pre className="mt-1 max-h-48 overflow-auto font-mono text-xs">
                {JSON.stringify(search.response.body, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      <Tabs defaultValue="hits" className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="hits">Hits</TabsTrigger>
          <TabsTrigger value="aggregations">Aggregations</TabsTrigger>
        </TabsList>
        <TabsContent value="hits" className="min-h-0 flex-1 overflow-hidden rounded-md border">
          {hasResults ? (
            <HitsTable
              hits={hits}
              hasMultipleIndices={search.selected.length > 1}
              total={search.total}
              page={search.page}
              size={search.size}
              isRunning={search.isRunning}
              onPageChange={(p) => void search.goToPage(p)}
              onSizeChange={(s) => void search.changeSize(s)}
              onRowClick={setOpenHit}
            />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">Run a search to see results.</div>
          )}
        </TabsContent>
        <TabsContent value="aggregations" className="min-h-0 flex-1 overflow-auto rounded-md border">
          {hasResults ? (
            <AggregationsView responseBody={search.response?.body} />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">Run a search to see aggregations.</div>
          )}
        </TabsContent>
      </Tabs>

      <DocDialog hit={openHit} onClose={() => setOpenHit(undefined)} />
    </div>
  );
}
```

- [ ] **Step 2: Verify and commit**

Run: `pnpm compile`
Expected: no type errors. (Not yet reachable from `App` — Task 12.)

```bash
git add src/console/search/SearchPage.tsx
git commit -m "feat(search): compose the search page"
```

---

### Task 12: TopNav + view switching + wire everything into App

**Files:**
- Create: `src/console/nav/TopNav.tsx`
- Modify: `src/console/layout/ConsoleLayout.tsx` (full rewrite: split into `AppShell` + `RestPanes`)
- Modify: `src/console/App.tsx` (full rewrite below)
- Delete: `src/console/connections/ConnectionSwitcher.tsx`

**Interfaces:**
- Consumes: `ClusterSelector` (Task 7), `SearchPage` (Task 11), everything already in `App`.
- Produces: `ConsoleView = 'search' | 'rest'`; `<TopNav view onViewChange connections active? onSelect onSave onDelete onTest />`; `AppShell`/`RestPanes` layout primitives. View persisted under `elasticvix.view`; **default view is `search`**.

- [ ] **Step 1: Create `src/console/nav/TopNav.tsx`**

```tsx
import { Moon, Sun } from 'lucide-react';
import { Button } from '../ui/button';
import { useTheme } from '../theme';
import type { Connection } from '../../lib/types';
import { ClusterSelector } from '../connections/ClusterSelector';
import type { TestResult } from '../connections/useConnections';

export type ConsoleView = 'search' | 'rest';

type Props = {
  view: ConsoleView;
  onViewChange: (view: ConsoleView) => void;
  connections: Connection[];
  active?: Connection;
  onSelect: (id: string) => void;
  onSave: (conn: Connection) => void;
  onDelete: (id: string) => void;
  onTest: (conn: Connection) => Promise<TestResult>;
};

const NAV_ITEMS: { view: ConsoleView; label: string }[] = [
  { view: 'search', label: 'SEARCH' },
  { view: 'rest', label: 'REST' },
];

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}

export function TopNav({ view, onViewChange, connections, active, onSelect, onSave, onDelete, onTest }: Props) {
  return (
    <>
      <span className="text-lg font-semibold">Elasticvix</span>
      <div className="ml-3">
        <ClusterSelector
          connections={connections}
          active={active}
          onSelect={onSelect}
          onSave={onSave}
          onDelete={onDelete}
          onTest={onTest}
        />
      </div>
      <nav className="ml-auto flex items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            type="button"
            className={`border-b-2 px-3 py-2 text-sm font-medium tracking-wider ${
              view === item.view
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => onViewChange(item.view)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <ThemeToggle />
    </>
  );
}
```

- [ ] **Step 2: Rewrite `src/console/layout/ConsoleLayout.tsx` as AppShell + RestPanes**

```tsx
import type { ReactNode } from 'react';

type ShellProps = {
  topBar: ReactNode;
  children: ReactNode;
};

export function AppShell({ topBar, children }: ShellProps) {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b px-4 py-2">{topBar}</header>
      <div className="flex min-h-0 flex-1">{children}</div>
    </div>
  );
}

type PanesProps = {
  leftRail: ReactNode;
  editor: ReactNode;
  response: ReactNode;
};

export function RestPanes({ leftRail, editor, response }: PanesProps) {
  return (
    <>
      <aside className="w-64 shrink-0 overflow-y-auto border-r">{leftRail}</aside>
      <main className="grid min-w-0 flex-1 grid-cols-2">
        <section className="min-w-0 overflow-hidden border-r">{editor}</section>
        <section className="min-w-0 overflow-auto">{response}</section>
      </main>
    </>
  );
}
```

(The old `ConsoleLayout` export is removed — `App.tsx` is its only consumer and is rewritten in the next step.)

- [ ] **Step 3: Rewrite `src/console/App.tsx`**

```tsx
import { useState } from 'react';
import { ThemeProvider } from './theme';
import { AppShell, RestPanes } from './layout/ConsoleLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useConnections } from './connections/useConnections';
import { useConsoleRun } from './editor/useConsoleRun';
import { QueryEditor } from './editor/QueryEditor';
import { ResponseView } from './editor/ResponseView';
import { SaveQueryDialog } from './library/SaveQueryDialog';
import { SavedQueriesPanel } from './library/SavedQueriesPanel';
import { HistoryPanel } from './library/HistoryPanel';
import { TopNav, type ConsoleView } from './nav/TopNav';
import { SearchPage } from './search/SearchPage';

const VIEW_KEY = 'elasticvix.view';

function loadView(): ConsoleView {
  return localStorage.getItem(VIEW_KEY) === 'rest' ? 'rest' : 'search';
}

function ConsoleInner() {
  const conns = useConnections();
  const runner = useConsoleRun(conns.active);
  const [view, setView] = useState<ConsoleView>(loadView);
  const [isSaveOpen, setSaveOpen] = useState(false);
  const [savedReloadKey, setSavedReloadKey] = useState(0);

  const handleViewChange = (next: ConsoleView) => {
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  };

  const loadIntoEditor = (r: { method: string; path: string; body: string }) => {
    runner.setText(`${r.method} ${r.path}\n${r.body}`);
  };

  return (
    <>
      <AppShell
        topBar={
          <TopNav
            view={view}
            onViewChange={handleViewChange}
            connections={conns.connections}
            active={conns.active}
            onSelect={conns.setActive}
            onSave={conns.addOrUpdate}
            onDelete={conns.remove}
            onTest={conns.test}
          />
        }
      >
        {view === 'search' ? (
          <main className="min-w-0 flex-1 overflow-hidden">
            <SearchPage active={conns.active} onSaveConnection={conns.addOrUpdate} onTestConnection={conns.test} />
          </main>
        ) : (
          <RestPanes
            leftRail={
              <Tabs defaultValue="saved" className="h-full p-2">
                <TabsList>
                  <TabsTrigger value="saved">Saved</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                <TabsContent value="saved" className="overflow-y-auto">
                  <SavedQueriesPanel reloadKey={savedReloadKey} onLoad={loadIntoEditor} />
                </TabsContent>
                <TabsContent value="history" className="overflow-y-auto">
                  <HistoryPanel reloadKey={runner.ranAt} onLoad={loadIntoEditor} />
                </TabsContent>
              </Tabs>
            }
            editor={
              <QueryEditor
                active={conns.active}
                text={runner.text}
                onChange={runner.setText}
                onRun={runner.run}
                isRunning={runner.isRunning}
                onFormat={runner.format}
                onSave={() => setSaveOpen(true)}
              />
            }
            response={<ResponseView response={runner.response} />}
          />
        )}
      </AppShell>
      <SaveQueryDialog
        isOpen={isSaveOpen}
        requestText={runner.text}
        connectionId={conns.active?.id}
        onOpenChange={setSaveOpen}
        onSaved={() => setSavedReloadKey((k) => k + 1)}
      />
    </>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ConsoleInner />
    </ThemeProvider>
  );
}
```

- [ ] **Step 4: Delete the replaced component**

```bash
rm src/console/connections/ConnectionSwitcher.tsx
grep -rn "ConnectionSwitcher" src/ entrypoints/ || echo "no references"
```

Expected: `no references`.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test && pnpm compile && pnpm build`
Expected: tests green, no type errors, build succeeds.

```bash
git add -A src/console/ && git commit -m "feat(ui): elasticvue-style top nav with search and rest views"
```

---

### Task 13: Mock-harness smoke test + final gates

The harness reuses Plan 2's approach: serve the built extension page with an injected `window.browser` mock (no real Chrome APIs, no real ES). The mock lives in the **session scratchpad** (never committed).

**Files:**
- Create (scratchpad, NOT in repo): `<scratchpad>/harness/mock-browser.js`
- Generated: `.output/chrome-mv3/harness.html`, `.output/chrome-mv3/mock-browser.js` (git-ignored build output)

- [ ] **Step 1: Build the extension**

```bash
pnpm build
```

- [ ] **Step 2: Write the mock — `<scratchpad>/harness/mock-browser.js`**

```js
// Injected before the console module: fakes chrome.storage.local, permissions,
// and the background RPC (runtime.sendMessage) with canned ES responses.
(() => {
  const store = {};

  const CAT_INDICES = [
    { index: 'laravel_auditing_v1', health: 'green', 'docs.count': '1234' },
    { index: 'products', health: 'yellow', 'docs.count': '87' },
    { index: '.kibana_1', health: 'green', 'docs.count': '5' },
  ];

  const SEARCH_RESPONSE = {
    took: 3,
    hits: {
      total: { value: 2, relation: 'eq' },
      hits: [
        {
          _index: 'laravel_auditing_v1',
          _id: '217',
          _source: { event: 'updated', user_id: 12, new_values: { apply_to: '2026-07-08' } },
        },
        { _index: 'laravel_auditing_v1', _id: '218', _source: { event: 'created', user_id: 7 } },
      ],
    },
    aggregations: {
      events: { buckets: [{ key: 'updated', doc_count: 1 }, { key: 'created', doc_count: 1 }] },
    },
  };

  const esResult = (status, body) => ({ status, took: 3, body });

  function handle(msg) {
    if (msg.kind === 'detectVersion') return { kind: 'detectVersion', result: { version: '8.16.2', major: 8 } };
    if (msg.kind === 'fetchMapping')
      return {
        kind: 'fetchMapping',
        result: { fields: [{ path: 'event', type: 'keyword' }, { path: 'user_id', type: 'long' }] },
      };
    const path = msg.path || '';
    let result;
    if (path.startsWith('/_cluster/health')) result = esResult(200, { status: 'yellow' });
    else if (path.startsWith('/_cat/indices')) result = esResult(200, CAT_INDICES);
    else if (path.endsWith('/_search')) result = esResult(200, SEARCH_RESPONSE);
    else result = esResult(404, { error: { reason: `no handler for ${path}` } });
    return { kind: 'esRequest', result };
  }

  const browserMock = {
    runtime: { sendMessage: async (msg) => handle(msg) },
    storage: {
      local: {
        get: async (key) => (key in store ? { [key]: store[key] } : {}),
        set: async (obj) => {
          Object.assign(store, obj);
        },
      },
    },
    permissions: { contains: async () => true, request: async () => true },
  };

  window.browser = browserMock;
  window.chrome = browserMock;
})();
```

- [ ] **Step 3: Generate the harness page and serve it**

```bash
cp <scratchpad>/harness/mock-browser.js .output/chrome-mv3/mock-browser.js
cp .output/chrome-mv3/console.html .output/chrome-mv3/harness.html
perl -0pi -e 's/<script/<script src="\.\/mock-browser.js"><\/script><script/' .output/chrome-mv3/harness.html
python3 -m http.server 8123 --directory .output/chrome-mv3 &
```

Open `http://localhost:8123/harness.html` (Playwright MCP or a browser).

- [ ] **Step 4: Smoke checklist (all must pass)**

1. First load lands on the **SEARCH** view; empty state offers "Add connection".
2. Add a connection (any URL, e.g. `http://localhost:9200`) → Test shows `OK — Elasticsearch 8.16.2` → Save. Cluster selector shows the name, version `8.16.2`, and a **yellow** health dot.
3. Cluster selector → pencil icon → dialog opens **prefilled** (name, URL, auth) → change the name → Save → new name shows in the selector. Reopen edit → shows the **new** name (no stale state).
4. Add a second connection, then delete it: trash icon → button becomes `Delete?` → click → row disappears. Delete the **active** connection → active falls back to the remaining one.
5. Indices select lists `laravel_auditing_v1` and `products` — **not** `.kibana_1`. The filter input narrows the list; the refresh icon reloads it.
6. With no index selected, Search is disabled and the hint "Select at least 1 index" shows. Select an index → Search runs → table shows columns `_id, event, user_id, new_values`, 2 rows, footer `1–2 of 2`.
7. Filter `created` → 1 row. Click the `_id` header → sort toggles ↑/↓.
8. Click a row → DocDialog shows the full hit JSON; Copy puts it on the clipboard.
9. Aggregations tab shows the `events` buckets JSON.
10. `JSON` button downloads `elasticvix-search-<stamp>.json`.
11. REST tab → the old 3-pane console still works (run `GET /_search` → canned response renders).
12. Reload the page → the last view (REST) is restored (`elasticvix.view`); switch back to SEARCH → selected index and query text were restored (`elasticvix.search.<id>`). Theme toggle still works on both views.

- [ ] **Step 5: Final gates**

```bash
pnpm test && pnpm compile && pnpm build
```

Expected: full suite green (54 pre-existing + all new), no type errors, build succeeds. Fix anything that fails, commit fixes with `fix:` commits.

- [ ] **Step 6: Update the SDD ledger (if present)**

Append a completion note to `.superpowers/sdd/progress.md` (git-ignored) if the file exists.

**Out of scope, needs the user's real ES clusters (6.5/7/8) afterwards:** live field-aware autocomplete while typing on the Search page, the optional host-permission prompt, ES-6.x numeric `hits.total` and `_cat/indices` on a large cluster, real cluster-health colors.
