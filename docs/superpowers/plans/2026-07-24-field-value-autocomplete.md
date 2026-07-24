# Field-Value Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi con trỏ ở vị trí value mà key bao ngoài là một keyword field, autocomplete tự gợi ý các giá trị thật của field đó trong index (qua một `terms` aggregation), có cache guardrail.

**Architecture:** Bốn tầng tách bạch — (1) resolver thuần `resolveValueField` phát hiện vị trí value của keyword field; (2) completion source async gọi resolver rồi fetch giá trị khi spec không ra completion nào; (3) `getFieldValues` fetch + cache (dùng lại `esRequest`, không thêm RPC kind); (4) IndexedDB store `fieldValuesCache` (db v3). Cache là chốt chính giữ tải cluster production thấp.

**Tech Stack:** TypeScript (strict), React 19, CodeMirror 6 (`@codemirror/autocomplete`, `@lezer/common`), `idb` (IndexedDB), Vitest + fake-indexeddb, WXT extension.

## Global Constraints

- Package manager: **pnpm**. Typecheck: `pnpm compile` (tsc --noEmit). Tests: `pnpm test`.
- TypeScript **strict**: explicit types on all exported functions; **no `any`** (use `unknown` + narrow); **immutable** updates only.
- Style: single quotes, semicolons, `import type { … }` for type-only imports. Match surrounding code.
- **Reuse `esRequest`** (`src/lib/rpc/client.ts`) — do **not** add a new RPC `kind`.
- **v1 = keyword fields only** (incl. `.keyword` sub-fields). No boolean/numeric/text; no Settings toggle.
- Terms agg body is fixed: `{ "size": 0, "aggs": { "vix_values": { "terms": { "field": <field>, "size": 20 } } } }`.
- Field-value suggestions apply **only when `resolveCompletions` returns an empty list** (spec enums and field-name positions win).
- Commits: conventional commits, English, no attribution footer.

---

### Task 1: `resolveValueField` — pure resolver

**Files:**
- Modify: `src/lib/autocomplete/engine.ts` (add exported function near `resolveCompletions`)
- Test: `src/lib/autocomplete/engine.test.ts` (add a `describe` block)

**Interfaces:**
- Consumes: `FlatField` from `../types` (already imported in engine.ts).
- Produces: `resolveValueField(path: string[], inKey: boolean, fields: FlatField[]): string | undefined` — returns the keyword field name when the cursor is at its value position, else `undefined`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/autocomplete/engine.test.ts` (import `resolveValueField` in the existing top import from `./engine`):

```ts
describe('resolveValueField', () => {
  const f: FlatField[] = [
    { path: 'status', type: 'keyword' },
    { path: 'title', type: 'text' },
    { path: 'title.keyword', type: 'keyword' },
  ];
  it('returns the field for a term value position', () => {
    expect(resolveValueField(['query', 'term', 'status'], false, f)).toBe('status');
  });
  it('returns the field for a terms array element', () => {
    expect(resolveValueField(['query', 'terms', 'status', '0'], false, f)).toBe('status');
  });
  it('returns a dotted keyword sub-field', () => {
    expect(resolveValueField(['query', 'term', 'title.keyword'], false, f)).toBe('title.keyword');
  });
  it('returns undefined in a key position', () => {
    expect(resolveValueField(['query', 'term'], true, f)).toBeUndefined();
  });
  it('returns undefined for a range sub-key (gte)', () => {
    expect(resolveValueField(['query', 'range', 'price', 'gte'], false, f)).toBeUndefined();
  });
  it('returns undefined for a text field', () => {
    expect(resolveValueField(['query', 'match', 'title'], false, f)).toBeUndefined();
  });
  it('returns undefined for a non-field key (size)', () => {
    expect(resolveValueField(['size'], false, f)).toBeUndefined();
  });
});
```

Update the import line at the top of the test file:

```ts
import { resolveCompletions, docCompletions, bodyCompletions, resolveValueField } from './engine';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test engine.test`
Expected: FAIL — `resolveValueField is not a function` / not exported.

- [ ] **Step 3: Implement `resolveValueField`**

Add to `src/lib/autocomplete/engine.ts` (after `resolveCompletions`):

```ts
// At a value position, returns the enclosing key when it is a real keyword
// field of the target index — the signal to suggest that field's actual
// values. Skips trailing array-index segments (e.g. terms: { field: [ "|" ] }).
export function resolveValueField(
  path: string[],
  inKey: boolean,
  fields: FlatField[],
): string | undefined {
  if (inKey) return undefined;
  let key: string | undefined;
  for (let i = path.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(path[i])) continue; // array index, not the field key
    key = path[i];
    break;
  }
  if (key === undefined) return undefined;
  const field = fields.find((f) => f.path === key);
  return field?.type === 'keyword' ? field.path : undefined;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test engine.test`
Expected: PASS (all `resolveValueField` cases green; existing engine tests still green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/autocomplete/engine.ts src/lib/autocomplete/engine.test.ts
git commit -m "feat(autocomplete): resolve keyword field at value position"
```

---

### Task 2: `fieldValuesCache` store + db v3

**Files:**
- Modify: `src/lib/storage/db.ts` (bump version 2→3, add store + type)
- Create: `src/lib/storage/fieldValuesCache.ts`
- Test: `src/lib/storage/fieldValuesCache.test.ts`

**Interfaces:**
- Produces:
  - `FIELD_VALUES_TTL_MS: number`
  - `getCachedFieldValues(connectionId, index, field, now?): Promise<string[] | undefined>` — `undefined` on miss/stale; a cached `[]` (negative result) is returned as `[]`.
  - `setCachedFieldValues(connectionId, index, field, values, now?): Promise<void>`
  - `CachedFieldValues` type + `fieldValuesCache` object store in `VixSchema`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/storage/fieldValuesCache.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getCachedFieldValues, setCachedFieldValues, FIELD_VALUES_TTL_MS } from './fieldValuesCache';

describe('field values cache', () => {
  beforeEach(async () => {
    const { getDb } = await import('./db');
    await (await getDb()).clear('fieldValuesCache');
  });

  it('returns cached values within TTL', async () => {
    await setCachedFieldValues('c', 'logs', 'status', ['open', 'closed'], 1000);
    expect(await getCachedFieldValues('c', 'logs', 'status', 1000 + FIELD_VALUES_TTL_MS - 1))
      .toEqual(['open', 'closed']);
  });
  it('returns a cached empty (negative) result within TTL', async () => {
    await setCachedFieldValues('c', 'logs', 'bad', [], 1000);
    expect(await getCachedFieldValues('c', 'logs', 'bad', 1000)).toEqual([]);
  });
  it('returns undefined when stale', async () => {
    await setCachedFieldValues('c', 'logs', 'status', ['open'], 1000);
    expect(await getCachedFieldValues('c', 'logs', 'status', 1000 + FIELD_VALUES_TTL_MS + 1)).toBeUndefined();
  });
  it('returns undefined when missing', async () => {
    expect(await getCachedFieldValues('c', 'logs', 'nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test fieldValuesCache`
Expected: FAIL — cannot import `./fieldValuesCache` / store `fieldValuesCache` does not exist.

- [ ] **Step 3a: Add the store to `db.ts`**

In `src/lib/storage/db.ts`:

Add the type (after `CachedMapping`):

```ts
export interface CachedFieldValues {
  key: string; // `${connectionId}::${index}::${field}`
  values: string[];
  fetchedAt: number;
}
```

Add to `VixSchema` (inside the interface body):

```ts
  fieldValuesCache: { key: string; value: CachedFieldValues };
```

Bump the version in `openDB` from `2` to `3`:

```ts
    dbPromise = openDB<VixSchema>('elasticvix', 3, {
```

Add to the `upgrade` callback (alongside the other guarded creates):

```ts
        if (!db.objectStoreNames.contains('fieldValuesCache')) {
          db.createObjectStore('fieldValuesCache', { keyPath: 'key' });
        }
```

- [ ] **Step 3b: Implement `fieldValuesCache.ts`**

Create `src/lib/storage/fieldValuesCache.ts`:

```ts
import { getDb } from './db';

export const FIELD_VALUES_TTL_MS = 5 * 60 * 1000;

function keyOf(connectionId: string, index: string, field: string): string {
  return `${connectionId}::${index}::${field}`;
}

export async function getCachedFieldValues(
  connectionId: string,
  index: string,
  field: string,
  now: number = Date.now(),
): Promise<string[] | undefined> {
  const row = await (await getDb()).get('fieldValuesCache', keyOf(connectionId, index, field));
  if (!row) return undefined;
  if (now - row.fetchedAt > FIELD_VALUES_TTL_MS) return undefined;
  return row.values;
}

export async function setCachedFieldValues(
  connectionId: string,
  index: string,
  field: string,
  values: string[],
  now: number = Date.now(),
): Promise<void> {
  await (await getDb()).put('fieldValuesCache', {
    key: keyOf(connectionId, index, field),
    values,
    fetchedAt: now,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test fieldValuesCache`
Expected: PASS (all 4 cases).

Then run the full storage suite to confirm the db version bump didn't break existing stores:
Run: `pnpm test src/lib/storage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/db.ts src/lib/storage/fieldValuesCache.ts src/lib/storage/fieldValuesCache.test.ts
git commit -m "feat(storage): add field-values cache store (db v3)"
```

---

### Task 3: `getFieldValues` — fetch top values via terms agg

**Files:**
- Create: `src/console/editor/getFieldValues.ts`
- Test: `src/console/editor/getFieldValues.test.ts`

**Interfaces:**
- Consumes: `esRequest` (`../../lib/rpc/client`), `EsResult` (`../../lib/rpc/messages`), `getCachedFieldValues`/`setCachedFieldValues` (Task 2), `Connection` (`../../lib/types`).
- Produces:
  - `buildFieldValuesBody(field: string, size?: number): string`
  - `parseFieldValues(body: unknown): string[]`
  - `makeGetFieldValues(connection: Connection | undefined, request?: EsRequester): (index: string | undefined, field: string) => Promise<string[]>`
  - `type EsRequester = (connection: Connection, method: string, path: string, body?: string) => Promise<EsResult>`

- [ ] **Step 1: Write the failing tests**

Create `src/console/editor/getFieldValues.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { makeGetFieldValues, buildFieldValuesBody, parseFieldValues } from './getFieldValues';
import type { Connection } from '../../lib/types';
import type { EsResult } from '../../lib/rpc/messages';

const conn: Connection = {
  id: 'c1', name: 'demo', baseUrl: 'http://localhost:9201',
  auth: { type: 'none' }, createdAt: 0, updatedAt: 0,
};

function okResult(keys: (string | number | boolean)[]): EsResult {
  return {
    status: 200, took: 1,
    body: { aggregations: { vix_values: { buckets: keys.map((k) => ({ key: k, doc_count: 1 })) } } },
  };
}

describe('parseFieldValues', () => {
  it('extracts bucket keys', () => {
    expect(parseFieldValues(okResult(['open', 'closed']).body)).toEqual(['open', 'closed']);
  });
  it('returns [] when aggregations missing', () => {
    expect(parseFieldValues({ hits: {} })).toEqual([]);
    expect(parseFieldValues(null)).toEqual([]);
  });
  it('coerces non-string keys to string', () => {
    expect(parseFieldValues(okResult([1, true]).body)).toEqual(['1', 'true']);
  });
});

describe('buildFieldValuesBody', () => {
  it('builds a size:0 terms agg body', () => {
    expect(JSON.parse(buildFieldValuesBody('status', 20))).toEqual({
      size: 0, aggs: { vix_values: { terms: { field: 'status', size: 20 } } },
    });
  });
});

describe('makeGetFieldValues', () => {
  beforeEach(async () => {
    const { getDb } = await import('../../lib/storage/db');
    await (await getDb()).clear('fieldValuesCache');
  });

  it('fetches, returns values, and caches (second call skips the request)', async () => {
    let calls = 0;
    const request = async (): Promise<EsResult> => { calls++; return okResult(['open', 'closed']); };
    const get = makeGetFieldValues(conn, request);
    expect(await get('logs', 'status')).toEqual(['open', 'closed']);
    expect(await get('logs', 'status')).toEqual(['open', 'closed']);
    expect(calls).toBe(1);
  });

  it('returns [] on error and negative-caches it', async () => {
    let calls = 0;
    const request = async (): Promise<EsResult> => {
      calls++; return { status: 400, took: 1, body: null, error: 'bad_field' };
    };
    const get = makeGetFieldValues(conn, request);
    expect(await get('logs', 'bad')).toEqual([]);
    expect(await get('logs', 'bad')).toEqual([]);
    expect(calls).toBe(1);
  });

  it('returns [] when index is missing without calling the request', async () => {
    let calls = 0;
    const request = async (): Promise<EsResult> => { calls++; return okResult(['x']); };
    const get = makeGetFieldValues(conn, request);
    expect(await get(undefined, 'status')).toEqual([]);
    expect(calls).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test getFieldValues`
Expected: FAIL — cannot import `./getFieldValues`.

- [ ] **Step 3: Implement `getFieldValues.ts`**

Create `src/console/editor/getFieldValues.ts`:

```ts
import type { Connection } from '../../lib/types';
import type { EsResult } from '../../lib/rpc/messages';
import { esRequest } from '../../lib/rpc/client';
import { getCachedFieldValues, setCachedFieldValues } from '../../lib/storage/fieldValuesCache';

const FIELD_VALUES_SIZE = 20;

export type EsRequester = (
  connection: Connection, method: string, path: string, body?: string,
) => Promise<EsResult>;

export function buildFieldValuesBody(field: string, size: number = FIELD_VALUES_SIZE): string {
  return JSON.stringify({ size: 0, aggs: { vix_values: { terms: { field, size } } } });
}

export function parseFieldValues(body: unknown): string[] {
  const buckets = (body as { aggregations?: { vix_values?: { buckets?: unknown } } } | null)
    ?.aggregations?.vix_values?.buckets;
  if (!Array.isArray(buckets)) return [];
  const out: string[] = [];
  for (const b of buckets) {
    const key = (b as { key?: unknown }).key;
    if (key !== undefined && key !== null) out.push(String(key));
  }
  return out;
}

// Returns the top values of a keyword field for the target index, cached with
// TTL. Never throws: any failure (unreachable, non-aggregatable field, missing
// permission) resolves to [] and is negative-cached so autocomplete never
// hammers the cluster on repeated keystrokes.
export function makeGetFieldValues(
  connection: Connection | undefined,
  request: EsRequester = esRequest,
) {
  return async (index: string | undefined, field: string): Promise<string[]> => {
    if (!connection || !index) return [];
    const cached = await getCachedFieldValues(connection.id, index, field);
    if (cached) return cached;
    const res = await request(connection, 'POST', `/${index}/_search`, buildFieldValuesBody(field));
    const values = res.error || res.status >= 400 ? [] : parseFieldValues(res.body);
    await setCachedFieldValues(connection.id, index, field, values);
    return values;
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test getFieldValues`
Expected: PASS (all cases). `calls` assertions confirm cache-hit + negative-cache skip the request.

- [ ] **Step 5: Commit**

```bash
git add src/console/editor/getFieldValues.ts src/console/editor/getFieldValues.test.ts
git commit -m "feat(autocomplete): fetch top field values via terms agg"
```

---

### Task 4: Wire value fetching into the completion sources

**Files:**
- Modify: `src/lib/autocomplete/engine.ts` (add `bodyValueField`/`docValueField`; extend both `*CompletionSource` functions with an optional `getFieldValues`)
- Test: `src/lib/autocomplete/engine.test.ts` (add a `describe` for the two value-field helpers)

**Interfaces:**
- Consumes: `resolveValueField` (Task 1), existing `resolveKeyPath`, `parseRequestLine`, `defaultSpec`, `EditorState`, `json`.
- Produces:
  - `bodyValueField(docText: string, pos: number, fields: FlatField[]): string | undefined`
  - `docValueField(docText: string, pos: number, fields: FlatField[]): string | undefined`
  - Extended signatures (backward compatible — new param defaults to a no-op so existing callers still compile):
    - `bodyCompletionSource(getFields, getFieldValues?: (field: string) => Promise<string[]>)`
    - `esCompletionSource(getFields, getFieldValues?: (index: string | undefined, field: string) => Promise<string[]>)`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/autocomplete/engine.test.ts` (import the two helpers in the top `./engine` import):

```ts
describe('bodyValueField / docValueField', () => {
  const f: FlatField[] = [{ path: 'status', type: 'keyword' }];

  it('bodyValueField finds the field at a term value (Search body)', () => {
    const doc = '{ "query": { "term": { "status": "" } } }';
    const pos = doc.indexOf('""') + 1;
    expect(bodyValueField(doc, pos, f)).toBe('status');
  });
  it('bodyValueField returns undefined in a key position', () => {
    const doc = '{ "query": { "term": { "" } } }';
    const pos = doc.indexOf('""') + 1;
    expect(bodyValueField(doc, pos, f)).toBeUndefined();
  });
  it('docValueField finds the field at a term value (REST doc)', () => {
    const doc = 'POST /logs/_search\n{ "query": { "term": { "status": "" } } }';
    const pos = doc.indexOf('""') + 1;
    expect(docValueField(doc, pos, f)).toBe('status');
  });
  it('docValueField returns undefined on the request line', () => {
    const doc = 'GET /logs/_search\n{ }';
    expect(docValueField(doc, 3, f)).toBeUndefined();
  });
});
```

Update the top import:

```ts
import {
  resolveCompletions, docCompletions, bodyCompletions,
  resolveValueField, bodyValueField, docValueField,
} from './engine';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test engine.test`
Expected: FAIL — `bodyValueField`/`docValueField` not exported.

- [ ] **Step 3a: Add the two value-field helpers**

In `src/lib/autocomplete/engine.ts`, after `bodyCompletions` (and before `bodyCompletionSource`):

```ts
// Value-field detection for the Search page (body-only document).
export function bodyValueField(docText: string, pos: number, fields: FlatField[]): string | undefined {
  const state = EditorState.create({ doc: docText, extensions: [json()] });
  const { path, inKey } = resolveKeyPath(state, pos);
  return resolveValueField(path, inKey, fields);
}

// Value-field detection for the REST console (request line + body document).
export function docValueField(docText: string, pos: number, fields: FlatField[]): string | undefined {
  const nl = docText.indexOf('\n');
  if (nl === -1 || pos <= nl) return undefined; // on the request line / no body
  const bodyStart = nl + 1;
  const state = EditorState.create({ doc: docText.slice(bodyStart), extensions: [json()] });
  const { path, inKey } = resolveKeyPath(state, pos - bodyStart);
  return resolveValueField(path, inKey, fields);
}
```

- [ ] **Step 3b: Extend `bodyCompletionSource`**

Replace the existing `bodyCompletionSource` with:

```ts
export function bodyCompletionSource(
  getFields: () => Promise<FlatField[]>,
  getFieldValues: (field: string) => Promise<string[]> = async () => [],
) {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const fields = await getFields();
    const docText = ctx.state.doc.toString();
    const items = bodyCompletions(docText, ctx.pos, fields);
    const word = ctx.matchBefore(/[\w.]*/);
    const from = word ? word.from : ctx.pos;

    if (items.length === 0) {
      const field = bodyValueField(docText, ctx.pos, fields);
      if (field) {
        const values = await getFieldValues(field);
        if (values.length > 0) {
          return { from, options: values.map((v) => ({ label: v, type: 'enum' })) };
        }
      }
      return null;
    }
    return {
      from,
      options: items.map((it) => ({ label: it.label, type: KIND_TO_CM[it.kind], detail: it.detail })),
    };
  };
}
```

- [ ] **Step 3c: Extend `esCompletionSource`**

Replace the existing `esCompletionSource` with:

```ts
export function esCompletionSource(
  getFields: (index?: string) => Promise<FlatField[]>,
  getFieldValues: (index: string | undefined, field: string) => Promise<string[]> = async () => [],
) {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const docText = ctx.state.doc.toString();
    const nl = docText.indexOf('\n');
    if (nl === -1 || ctx.pos <= nl) return null;

    const { index } = parseRequestLine(docText.slice(0, nl));
    const fields = await getFields(index);
    const items = docCompletions(docText, ctx.pos, fields);
    const word = ctx.matchBefore(/[\w.]*/);
    const from = word ? word.from : ctx.pos;

    if (items.length === 0) {
      const field = docValueField(docText, ctx.pos, fields);
      if (field) {
        const values = await getFieldValues(index, field);
        if (values.length > 0) {
          return { from, options: values.map((v) => ({ label: v, type: 'enum' })) };
        }
      }
      return null;
    }
    return {
      from,
      options: items.map((it) => ({ label: it.label, type: KIND_TO_CM[it.kind], detail: it.detail })),
    };
  };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test engine.test`
Expected: PASS (new helper tests + all existing engine tests).

Run: `pnpm compile`
Expected: no type errors (existing callers still compile — `getFieldValues` is optional).

- [ ] **Step 5: Commit**

```bash
git add src/lib/autocomplete/engine.ts src/lib/autocomplete/engine.test.ts
git commit -m "feat(autocomplete): suggest field values in completion sources"
```

---

### Task 5: Thread `getFieldValues` through the editors (Search + REST)

**Files:**
- Modify: `src/console/editor/editorExtensions.ts`
- Modify: `src/console/editor/QueryEditor.tsx`
- Modify: `src/console/search/SearchEditor.tsx`
- Modify: `src/console/search/SearchPage.tsx`

**Interfaces:**
- Consumes: `makeGetFieldValues` (Task 3), extended `bodyCompletionSource`/`esCompletionSource` (Task 4).
- Produces: end-to-end wiring. Search page binds the value getter to the joined selected indices; REST console passes the request-line index through.

- [ ] **Step 1: Wire the REST console — `editorExtensions.ts`**

Replace `buildEditorExtensions` in `src/console/editor/editorExtensions.ts`:

```ts
export function buildEditorExtensions(
  getFields: (index?: string) => Promise<FlatField[]>,
  getFieldValues: (index: string | undefined, field: string) => Promise<string[]>,
): Extension[] {
  return [json(), autocompletion({ override: [esCompletionSource(getFields, getFieldValues)] })];
}
```

- [ ] **Step 2: Wire the REST console — `QueryEditor.tsx`**

In `src/console/editor/QueryEditor.tsx`, add the import near the existing `makeGetFields` import:

```ts
import { makeGetFieldValues } from './getFieldValues';
```

In the `useMemo` body, build and pass the value getter:

```ts
  const extensions = useMemo(() => {
    const getFields = makeGetFields(active);
    const getFieldValues = makeGetFieldValues(active);
    return [
      ...buildEditorExtensions(getFields, getFieldValues),
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            onRun();
            return true;
          },
        },
      ]),
    ];
  }, [active, onRun]);
```

- [ ] **Step 3: Wire the Search page — `SearchEditor.tsx`**

In `src/console/search/SearchEditor.tsx`, add `getFieldValues` to `Props` and pass it to the source:

```ts
type Props = {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  getFields: () => Promise<FlatField[]>;
  getFieldValues: (field: string) => Promise<string[]>;
};

export function SearchEditor({ value, onChange, onRun, getFields, getFieldValues }: Props) {
```

Update the `autocompletion` line:

```ts
      autocompletion({ override: [bodyCompletionSource(getFields, getFieldValues)] }),
```

Add `getFieldValues` to the `useMemo` dependency array:

```ts
    [getFields, getFieldValues, onRun],
```

- [ ] **Step 4: Wire the Search page — `SearchPage.tsx`**

In `src/console/search/SearchPage.tsx`, add the import next to `makeGetFields`:

```ts
import { makeGetFieldValues } from '../editor/getFieldValues';
```

Add a `getFieldValues` callback right after the existing `getFields` `useCallback` (around `SearchPage.tsx:53-58`). It fires the terms agg across all selected indices at once (ES merges buckets across a comma-separated index list):

```ts
  const getFieldValues = useCallback(async (field: string): Promise<string[]> => {
    if (!active || search.selected.length === 0) return [];
    return makeGetFieldValues(active)(search.selected.join(','), field);
  }, [active, search.selected]);
```

Pass it to the `<SearchEditor>` element (add the prop alongside the existing `getFields={getFields}`):

```tsx
        getFieldValues={getFieldValues}
```

- [ ] **Step 5: Typecheck + full test suite**

Run: `pnpm compile`
Expected: no type errors.

Run: `pnpm test`
Expected: PASS (whole suite). Note: `engine.test.ts` is known to occasionally flake under the full parallel run (see project memory `autocomplete-engine-test-flaky`); if a single unrelated case flakes, re-run `pnpm test engine.test` in isolation to confirm green.

- [ ] **Step 6: Manual smoke test**

Use the **demo** cluster, not the live one (project memory: port 9200 is viec.co production — use the demo ES on **9201**, seed via `scripts/store/seed-es.mjs`).

1. `pnpm dev`, load the extension, open the console.
2. Connect to the demo cluster (`http://localhost:9201`).
3. **Search page:** select an index that has a keyword field, type `{ "query": { "term": { "<keyword-field>": "` — a dropdown of real values should appear automatically (no Ctrl+Space).
4. Confirm no suggestions appear for a `text` field or inside `range` (`"gte": `).
5. **REST console:** `POST /<index>/_search` + body, repeat the term-value check.
6. Confirm repeated typing does not spam the cluster (values load once per field within the 5-minute TTL) — observe in the network panel that only one `_search` with `size:0` fires per field.

- [ ] **Step 7: Commit**

```bash
git add src/console/editor/editorExtensions.ts src/console/editor/QueryEditor.tsx src/console/search/SearchEditor.tsx src/console/search/SearchPage.tsx
git commit -m "feat(autocomplete): wire field-value suggestions into editors"
```

---

## Self-Review

**1. Spec coverage** (against `docs/superpowers/specs/2026-07-24-field-value-autocomplete-design.md`):
- §3 Tầng 1 resolver → Task 1. ✓
- §3 Tầng 2 source (spec-wins precedence via empty-items gate) → Task 4. ✓
- §3 Tầng 3 fetch+cache+negative-cache+no-throw → Task 3. ✓
- §3 Tầng 4 storage + db v3 → Task 2. ✓
- §5 wiring (Search joined indices, REST request-line index) → Task 5. ✓
- §6 edge cases (terms array, range.gte, text, no index, spec-enum wins) → covered by Task 1 + Task 4 tests. ✓
- §4 guardrails (cache primary, negative caching, size:0 top-20) → Task 3 impl + Task 5 manual step 6. ✓

**2. Placeholder scan:** No TBD/TODO; every code step contains complete code; every test step contains real assertions. ✓

**3. Type consistency:** `makeGetFieldValues(connection, request?)` returns `(index: string | undefined, field: string) => Promise<string[]>` — matches `esCompletionSource`'s `getFieldValues` param and `editorExtensions`/`QueryEditor` usage. Search page wraps it into `(field) => Promise<string[]>` matching `bodyCompletionSource`/`SearchEditor`. `resolveValueField(path, inKey, fields)` signature identical across Task 1 and Task 4. `getCachedFieldValues`/`setCachedFieldValues`/`FIELD_VALUES_TTL_MS`/`CachedFieldValues` consistent between Task 2 and Task 3. `buildFieldValuesBody`/`parseFieldValues` consistent within Task 3. Terms agg name `vix_values` identical in `buildFieldValuesBody` and `parseFieldValues`. ✓
