# Mappings Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép xem mapping (bảng field → type có tìm kiếm) của một index bằng một cú click từ ô chọn index trên trang Search.

**Architecture:** Ba đơn vị mới trong `src/console/search/` — một lib thuần (`mappingViewLib`), một loader cache-first + hook (`useIndexMapping`), một dialog (`MappingDialog`) — cộng hai file wiring (`IndicesSelect`, `SearchPage`). Tái dùng đúng primitive đã test: `getCachedFields`/`setCachedFields`/`fetchMapping`. Không thêm RPC mới, không ghi lên cluster.

**Tech Stack:** React 19, TypeScript strict (`noUncheckedIndexedAccess`), Tailwind v4 (dark qua class `.dark`), Vitest + fake-indexeddb, shadcn-style UI (`Dialog`/`Input`/`Button`), lucide-react.

## Global Constraints

- TypeScript strict, `noUncheckedIndexedAccess: true` — index truy cập mảng phải guard hoặc dùng `!` khi chắc chắn.
- Immutable: không mutate mảng đầu vào (sort phải copy `[...fields]`).
- Test hook: repo **không** dùng `@testing-library/react`. Test phần **logic thuần/async tách rời** (mirror `getFieldValues.test.ts` — inject hàm fetch), hook chỉ là vỏ mỏng, verify bằng typecheck + screenshot.
- Test command: `pnpm test` (vitest run). Typecheck: `pnpm compile` (tsc --noEmit). Build: `pnpm build`.
- Badge màu: raw Tailwind palette + `dark:` (pattern có sẵn `bg-green-500/15 text-green-600 dark:text-green-400`).
- Commit message tiếng Anh, conventional commits, không attribution footer.

---

### Task 1: Pure helpers — `mappingViewLib.ts`

**Files:**
- Create: `src/console/search/mappingViewLib.ts`
- Test: `src/console/search/mappingViewLib.test.ts`

**Interfaces:**
- Consumes: `FlatField` từ `src/lib/types` (`{ path: string; type: string }`).
- Produces:
  - `typeClass(type: string): TypeClass` where `type TypeClass = 'keyword' | 'text' | 'date' | 'number' | 'boolean' | 'other'`
  - `sortFields(fields: FlatField[]): FlatField[]` (immutable, alphabet theo `path`)
  - `filterFields(fields: FlatField[], query: string): FlatField[]` (substring, case-insensitive, giữ thứ tự)

- [ ] **Step 1: Write the failing test**

```ts
// src/console/search/mappingViewLib.test.ts
import { describe, it, expect } from 'vitest';
import { typeClass, sortFields, filterFields } from './mappingViewLib';
import type { FlatField } from '../../lib/types';

const F: FlatField[] = [
  { path: 'name', type: 'text' },
  { path: 'name.keyword', type: 'keyword' },
  { path: 'category', type: 'keyword' },
  { path: 'price', type: 'float' },
];

describe('typeClass', () => {
  it('maps types to a semantic class', () => {
    expect(typeClass('keyword')).toBe('keyword');
    expect(typeClass('text')).toBe('text');
    expect(typeClass('match_only_text')).toBe('text');
    expect(typeClass('date')).toBe('date');
    expect(typeClass('date_nanos')).toBe('date');
    expect(typeClass('boolean')).toBe('boolean');
    expect(typeClass('long')).toBe('number');
    expect(typeClass('float')).toBe('number');
    expect(typeClass('scaled_float')).toBe('number');
    expect(typeClass('geo_point')).toBe('other');
    expect(typeClass('object')).toBe('other');
  });
});

describe('sortFields', () => {
  it('sorts alphabetically by path without mutating input', () => {
    const before = [...F];
    const out = sortFields(F);
    expect(out.map((f) => f.path)).toEqual(['category', 'name', 'name.keyword', 'price']);
    expect(F).toEqual(before); // immutable
  });
});

describe('filterFields', () => {
  it('returns all fields (input order) for an empty query', () => {
    expect(filterFields(F, '   ')).toEqual(F);
  });
  it('matches path substring case-insensitively', () => {
    expect(filterFields(F, 'NAME').map((f) => f.path)).toEqual(['name', 'name.keyword']);
  });
  it('returns [] when nothing matches', () => {
    expect(filterFields(F, 'zzz')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/console/search/mappingViewLib.test.ts`
Expected: FAIL — module `./mappingViewLib` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/console/search/mappingViewLib.ts
import type { FlatField } from '../../lib/types';

export type TypeClass = 'keyword' | 'text' | 'date' | 'number' | 'boolean' | 'other';

const NUMBER_TYPES = new Set([
  'long', 'integer', 'short', 'byte', 'double', 'float', 'half_float', 'scaled_float', 'unsigned_long',
]);

export function typeClass(type: string): TypeClass {
  if (type === 'keyword') return 'keyword';
  if (type === 'text' || type === 'match_only_text') return 'text';
  if (type === 'date' || type === 'date_nanos') return 'date';
  if (type === 'boolean') return 'boolean';
  if (NUMBER_TYPES.has(type)) return 'number';
  return 'other';
}

export function sortFields(fields: FlatField[]): FlatField[] {
  return [...fields].sort((a, b) => a.path.localeCompare(b.path));
}

export function filterFields(fields: FlatField[], query: string): FlatField[] {
  const q = query.trim().toLowerCase();
  if (!q) return fields;
  return fields.filter((f) => f.path.toLowerCase().includes(q));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/console/search/mappingViewLib.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/console/search/mappingViewLib.ts src/console/search/mappingViewLib.test.ts
git commit -m "feat(search): pure helpers for mapping view (typeClass, sort, filter)"
```

---

### Task 2: Cache-first loader + hook — `useIndexMapping.ts`

**Files:**
- Create: `src/console/search/useIndexMapping.ts`
- Test: `src/console/search/useIndexMapping.test.ts`

**Interfaces:**
- Consumes: `getCachedFields`/`setCachedFields` từ `src/lib/storage/mappingCache`; `fetchMapping` từ `src/lib/rpc/client`; `MappingResult` (`{ fields: FlatField[]; error?: string }`) từ `src/lib/rpc/messages`; `Connection`, `FlatField` từ `src/lib/types`.
- Produces:
  - `makeLoadMapping(connection: Connection | undefined, fetch?): (index: string | undefined, opts?: { skipCache?: boolean }) => Promise<MappingResult>` (testable, inject `fetch`).
  - `useIndexMapping(connection, index): { fields: FlatField[]; isLoading: boolean; error?: string; reload: () => Promise<void> }` (hook consumed by MappingDialog in Task 3).

- [ ] **Step 1: Write the failing test** (only the testable loader — mirror `getFieldValues.test.ts`)

```ts
// src/console/search/useIndexMapping.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { makeLoadMapping } from './useIndexMapping';
import type { Connection, FlatField } from '../../lib/types';
import type { MappingResult } from '../../lib/rpc/messages';

const conn: Connection = {
  id: 'c1', name: 'demo', baseUrl: 'http://localhost:9201',
  auth: { type: 'none' }, createdAt: 0, updatedAt: 0,
};
const FIELDS: FlatField[] = [{ path: 'level', type: 'keyword' }, { path: 'msg', type: 'text' }];

describe('makeLoadMapping', () => {
  beforeEach(async () => {
    const { getDb } = await import('../../lib/storage/db');
    await (await getDb()).clear('mappingCache');
  });

  it('fetches, returns fields, and caches (second call skips fetch)', async () => {
    let calls = 0;
    const fetch = async (): Promise<MappingResult> => { calls++; return { fields: FIELDS }; };
    const load = makeLoadMapping(conn, fetch);
    expect(await load('logs')).toEqual({ fields: FIELDS });
    expect(await load('logs')).toEqual({ fields: FIELDS });
    expect(calls).toBe(1);
  });

  it('returns error and does not cache it (retries next time)', async () => {
    let calls = 0;
    const fetch = async (): Promise<MappingResult> => { calls++; return { fields: [], error: 'no_such_index' }; };
    const load = makeLoadMapping(conn, fetch);
    expect(await load('nope')).toEqual({ fields: [], error: 'no_such_index' });
    expect(await load('nope')).toEqual({ fields: [], error: 'no_such_index' });
    expect(calls).toBe(2);
  });

  it('skipCache forces a fetch even when cached', async () => {
    let calls = 0;
    const fetch = async (): Promise<MappingResult> => { calls++; return { fields: FIELDS }; };
    const load = makeLoadMapping(conn, fetch);
    await load('logs');
    await load('logs', { skipCache: true });
    expect(calls).toBe(2);
  });

  it('returns empty without fetching when index is undefined', async () => {
    let calls = 0;
    const fetch = async (): Promise<MappingResult> => { calls++; return { fields: FIELDS }; };
    const load = makeLoadMapping(conn, fetch);
    expect(await load(undefined)).toEqual({ fields: [] });
    expect(calls).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/console/search/useIndexMapping.test.ts`
Expected: FAIL — `makeLoadMapping` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/console/search/useIndexMapping.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Connection, FlatField } from '../../lib/types';
import type { MappingResult } from '../../lib/rpc/messages';
import { getCachedFields, setCachedFields } from '../../lib/storage/mappingCache';
import { fetchMapping } from '../../lib/rpc/client';

type FetchMapping = (connection: Connection, index: string) => Promise<MappingResult>;

// Cache-first mapping loader. `fetch` injectable for tests. Surfaces errors so the UI can
// distinguish "index has no fields" from "fetch failed" (unlike makeGetFields, which returns []).
export function makeLoadMapping(connection: Connection | undefined, fetch: FetchMapping = fetchMapping) {
  return async (index: string | undefined, opts?: { skipCache?: boolean }): Promise<MappingResult> => {
    if (!connection || !index) return { fields: [] };
    if (!opts?.skipCache) {
      const cached = await getCachedFields(connection.id, index);
      if (cached) return { fields: cached };
    }
    const res = await fetch(connection, index);
    if (res.error) return { fields: [], error: res.error };
    await setCachedFields(connection.id, index, res.fields);
    return { fields: res.fields };
  };
}

export type IndexMappingState = {
  fields: FlatField[];
  isLoading: boolean;
  error?: string;
  reload: () => Promise<void>;
};

export function useIndexMapping(
  connection: Connection | undefined,
  index: string | undefined,
): IndexMappingState {
  const [fields, setFields] = useState<FlatField[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const loadSeq = useRef(0);

  const run = useCallback(
    async (skipCache: boolean) => {
      loadSeq.current += 1;
      const seq = loadSeq.current;
      if (!connection || !index) {
        setFields([]);
        setError(undefined);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(undefined);
      const res = await makeLoadMapping(connection)(index, { skipCache });
      if (seq !== loadSeq.current) return;
      setFields(res.fields);
      setError(res.error);
      setLoading(false);
    },
    [connection, index],
  );

  useEffect(() => {
    void run(false);
  }, [run]);

  const reload = useCallback(() => run(true), [run]);
  return { fields, isLoading, error, reload };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test src/console/search/useIndexMapping.test.ts && pnpm compile`
Expected: tests PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/console/search/useIndexMapping.ts src/console/search/useIndexMapping.test.ts
git commit -m "feat(search): cache-first mapping loader and hook"
```

---

### Task 3: The dialog — `MappingDialog.tsx`

**Files:**
- Create: `src/console/search/MappingDialog.tsx`

**Interfaces:**
- Consumes: `useIndexMapping` (Task 2); `filterFields`, `sortFields`, `typeClass`, `TypeClass` (Task 1); `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` từ `../ui/dialog`; `Input` từ `../ui/input`; `Button` từ `../ui/button`; `RefreshCw` từ `lucide-react`; `Connection` từ `../../lib/types`.
- Produces: `MappingDialog({ connection, index, onClose })` — consumed by `SearchPage` in Task 4. Open khi `index !== undefined`.

- [ ] **Step 1: Write the component**

```tsx
// src/console/search/MappingDialog.tsx
import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import type { Connection } from '../../lib/types';
import { useIndexMapping } from './useIndexMapping';
import { filterFields, sortFields, typeClass, type TypeClass } from './mappingViewLib';

type Props = {
  connection: Connection | undefined;
  index: string | undefined;
  onClose: () => void;
};

const BADGE_CLASS: Record<TypeClass, string> = {
  keyword: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  text: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  date: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  number: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  boolean: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  other: 'bg-muted text-muted-foreground',
};

function splitPath(path: string): { parent: string; leaf: string } {
  const i = path.lastIndexOf('.');
  return i === -1 ? { parent: '', leaf: path } : { parent: path.slice(0, i + 1), leaf: path.slice(i + 1) };
}

export function MappingDialog({ connection, index, onClose }: Props) {
  const { fields, isLoading, error, reload } = useIndexMapping(connection, index);
  const [filter, setFilter] = useState('');
  const sorted = useMemo(() => sortFields(fields), [fields]);
  const visible = useMemo(() => filterFields(sorted, filter), [sorted, filter]);

  return (
    <Dialog
      open={index !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="truncate font-mono">{index}</span>
            <span className="text-sm font-normal text-muted-foreground tabular-nums">{fields.length} fields</span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7"
              aria-label="Reload mapping"
              onClick={() => void reload()}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Filter fields…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8"
        />

        <div className="max-h-[60vh] overflow-auto rounded-md border">
          {error ? (
            <div className="p-4 text-sm">
              <p className="text-destructive">{error}</p>
              <button type="button" className="mt-1 underline text-muted-foreground" onClick={() => void reload()}>
                Retry
              </button>
            </div>
          ) : isLoading && fields.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {fields.length === 0 ? 'No fields.' : 'No fields match the filter.'}
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Field</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((f) => {
                  const { parent, leaf } = splitPath(f.path);
                  return (
                    <tr key={f.path} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-1.5 font-mono text-xs">
                        <span className="text-muted-foreground">{parent}</span>
                        {leaf}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 font-mono text-xs ${BADGE_CLASS[typeClass(f.type)]}`}
                        >
                          {f.type}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm compile`
Expected: clean. (Component has no unit test — repo convention; wiring verified by screenshot in the review step.)

- [ ] **Step 3: Commit**

```bash
git add src/console/search/MappingDialog.tsx
git commit -m "feat(search): mapping dialog with field/type table"
```

---

### Task 4: Wire into the index picker — `IndicesSelect.tsx` + `SearchPage.tsx`

**Files:**
- Modify: `src/console/search/IndicesSelect.tsx`
- Modify: `src/console/search/SearchPage.tsx`

**Interfaces:**
- Consumes: `MappingDialog` (Task 3).
- Produces: `IndicesSelect` prop mới `onViewMapping: (index: string) => void`; `SearchPage` giữ state `mappingIndex` và render `MappingDialog`.

- [ ] **Step 1: Add the icon + prop to `IndicesSelect.tsx`**

Thêm `List` vào import lucide (dòng 2 hiện là `import { ChevronDown, RefreshCw } from 'lucide-react';`):

```tsx
import { ChevronDown, RefreshCw, List } from 'lucide-react';
```

Thêm field vào `type Props` (sau `onReload`):

```tsx
  onReload: () => void;
  onViewMapping: (index: string) => void;
```

Đổi chữ ký hàm để nhận prop mới:

```tsx
export function IndicesSelect({ indices, selected, isLoading, error, onChange, onReload, onViewMapping }: Props) {
```

Trong `visible.map(...)`, thêm icon-button vào cuối mỗi `<label>` row (sau span `docsCount`):

```tsx
              {i.docsCount && <span className="text-xs text-muted-foreground tabular-nums">{i.docsCount}</span>}
              <button
                type="button"
                aria-label={`View mapping for ${i.index}`}
                className="shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onViewMapping(i.index);
                }}
              >
                <List className="h-3.5 w-3.5" />
              </button>
```

- [ ] **Step 2: Wire `SearchPage.tsx`**

Thêm import (cạnh `import { DocDialog } from './DocDialog';`):

```tsx
import { MappingDialog } from './MappingDialog';
```

Thêm state (cạnh `const [openHit, setOpenHit] = useState<Hit | undefined>(undefined);`):

```tsx
  const [mappingIndex, setMappingIndex] = useState<string | undefined>(undefined);
```

Truyền prop cho `IndicesSelect` (thêm dòng sau `onReload={...}`):

```tsx
        <IndicesSelect
          indices={indicesState.indices}
          selected={search.selected}
          isLoading={indicesState.isLoading}
          error={indicesState.error}
          onChange={search.selectIndices}
          onReload={() => void indicesState.reload()}
          onViewMapping={setMappingIndex}
        />
```

Render dialog cạnh `<DocDialog ... />`:

```tsx
      <DocDialog hit={openHit} onClose={() => setOpenHit(undefined)} />
      <MappingDialog connection={active} index={mappingIndex} onClose={() => setMappingIndex(undefined)} />
```

- [ ] **Step 3: Typecheck, test, build**

Run: `pnpm compile && pnpm test && pnpm build`
Expected: typecheck clean; all tests PASS; build succeeds → `.output/chrome-mv3`.

- [ ] **Step 4: Commit**

```bash
git add src/console/search/IndicesSelect.tsx src/console/search/SearchPage.tsx
git commit -m "feat(search): open mapping viewer from the index picker"
```

---

## Post-implementation

- **screenshot-ui-review** trên extension thật (ES demo 9201 đang chạy, index `products`/`app-logs`): mở popover index → click icon → dialog mapping; chụp light + dark, và một shot filter fields. Lưu ảnh trong project.
- Không push origin, không merge — chờ user duyệt ảnh.

## Self-Review

**Spec coverage:**
- §2 bảng field→type ← Task 3. Entry point icon per-row ← Task 4. Filter ← Task 1 (`filterFields`) + Task 3. Color-code ← Task 1 (`typeClass`) + Task 3 (`BADGE_CLASS`). 4 trạng thái ← Task 3. Reload ← Task 2 (`reload`/`skipCache`) + Task 3.
- §3.1 `mappingViewLib` ← Task 1. §3.2 `useIndexMapping` + `makeLoadMapping` ← Task 2. §3.3 `MappingDialog` (+ sort alphabet) ← Task 1 (`sortFields`) + Task 3. §3.4 wiring ← Task 4.
- §5 edge cases: cache-hit/miss/error ← Task 2 tests; empty vs error ← Task 3 render; loadSeq race ← Task 2 hook; icon không toggle checkbox ← Task 4 `preventDefault`; multi-field mờ parent ← Task 3 `splitPath`.
- §6 tests: `mappingViewLib.test.ts` ← Task 1; `useIndexMapping.test.ts` ← Task 2; wiring qua screenshot ← Post-implementation.

**Placeholder scan:** không có TBD/TODO; mọi step code có block thật.

**Type consistency:** `MappingResult { fields, error? }` khớp `messages.ts`. `TypeClass` union nhất quán giữa Task 1 và `BADGE_CLASS` (Task 3). `makeLoadMapping`/`useIndexMapping` signature khớp giữa Task 2 và Task 3. Prop `onViewMapping: (index: string) => void` khớp giữa Task 4 IndicesSelect và SearchPage.
