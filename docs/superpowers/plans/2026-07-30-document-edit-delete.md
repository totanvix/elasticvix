# Document Edit & Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user edit and delete a single document from the Search UI's `DocDialog`, writing directly to the connected cluster.

**Architecture:** Extract all path/parsing logic into a pure, unit-tested `docWrite.ts`. Rework `DocDialog` into a view/edit/confirm-delete state machine that calls `esRequest` for GET/PUT/DELETE. `SearchPage` passes the active connection plus an `onChanged` callback that re-runs the current search page.

**Tech Stack:** React 19, `@uiw/react-codemirror` + `@codemirror/lang-json`, TypeScript strict, Vitest.

## Global Constraints

- **Port 9200 is the live viec.co PRODUCTION cluster — never touch it.** All testing uses demo ES on **9201**. Re-seed with `ES_URL=http://localhost:9201 node scripts/store/seed-es.mjs` after any delete test.
- TypeScript strict; no `@testing-library/react` (pure logic is unit-tested, React wrappers verified by `pnpm compile` + screenshot).
- Immutable updates; files focused; commit after each task.
- Commits in English, imperative subject ≤50 chars, no attribution footer.
- Write path is `/{index}/{hit._type ?? '_doc'}/{encodeURIComponent(id)}`; both PUT and DELETE carry `?refresh=wait_for`; `if_seq_no`/`if_primary_term` are sent **only when the GET response returned both**.
- Editor is seeded from `_source` only; the full document is always **refetched** on Edit (the search query may restrict `_source`).

---

### Task 1: Pure doc-write helpers

**Files:**
- Create: `src/console/search/docWrite.ts`
- Test: `src/console/search/docWrite.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface DocRef { index: string; type?: string; id: string }`
  - `interface DocMeta { source: Record<string, unknown>; seqNo?: number; primaryTerm?: number }`
  - `documentPath(ref: DocRef): string`
  - `writePath(path: string, guard: { seqNo?: number; primaryTerm?: number }): string`
  - `extractDocMeta(getBody: unknown): DocMeta | undefined`
  - `parseEditableSource(text: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string }`

- [ ] **Step 1: Write the failing test**

```ts
// src/console/search/docWrite.test.ts
import { describe, it, expect } from 'vitest';
import { documentPath, writePath, extractDocMeta, parseEditableSource } from './docWrite';

describe('documentPath', () => {
  it('falls back to _doc when the hit has no type', () => {
    expect(documentPath({ index: 'products', id: '42' })).toBe('/products/_doc/42');
  });
  it('uses the real 6.x type when present', () => {
    expect(documentPath({ index: 'products', type: 'item', id: '42' })).toBe('/products/item/42');
  });
  it('escapes ids containing slashes and spaces', () => {
    expect(documentPath({ index: 'p', id: 'a/b c' })).toBe('/p/_doc/a%2Fb%20c');
  });
});

describe('writePath', () => {
  it('always requests refresh=wait_for', () => {
    expect(writePath('/p/_doc/1', {})).toBe('/p/_doc/1?refresh=wait_for');
  });
  it('adds the concurrency guard only when both values are present', () => {
    expect(writePath('/p/_doc/1', { seqNo: 5, primaryTerm: 2 })).toBe(
      '/p/_doc/1?refresh=wait_for&if_seq_no=5&if_primary_term=2',
    );
  });
  it('omits the guard when only one value is present', () => {
    expect(writePath('/p/_doc/1', { seqNo: 5 })).toBe('/p/_doc/1?refresh=wait_for');
  });
  it('treats seqNo 0 as present', () => {
    expect(writePath('/p/_doc/1', { seqNo: 0, primaryTerm: 1 })).toBe(
      '/p/_doc/1?refresh=wait_for&if_seq_no=0&if_primary_term=1',
    );
  });
});

describe('extractDocMeta', () => {
  it('returns source with seq/primary from a found document', () => {
    expect(
      extractDocMeta({ found: true, _seq_no: 7, _primary_term: 3, _source: { a: 1 } }),
    ).toEqual({ source: { a: 1 }, seqNo: 7, primaryTerm: 3 });
  });
  it('returns source only when seq/primary are absent (old 6.x)', () => {
    expect(extractDocMeta({ found: true, _source: { a: 1 } })).toEqual({ source: { a: 1 } });
  });
  it('returns undefined when the document was not found', () => {
    expect(extractDocMeta({ found: false })).toBeUndefined();
  });
  it('returns undefined for a malformed body', () => {
    expect(extractDocMeta(null)).toBeUndefined();
    expect(extractDocMeta('nope')).toBeUndefined();
    expect(extractDocMeta({ found: true, _source: 'not-an-object' })).toBeUndefined();
  });
});

describe('parseEditableSource', () => {
  it('accepts a JSON object', () => {
    expect(parseEditableSource('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });
  it('rejects arrays and scalars', () => {
    expect(parseEditableSource('[1,2]').ok).toBe(false);
    expect(parseEditableSource('42').ok).toBe(false);
  });
  it('rejects invalid JSON', () => {
    expect(parseEditableSource('{bad').ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- src/console/search/docWrite.test.ts`
Expected: FAIL — `docWrite` module does not exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/console/search/docWrite.ts
export interface DocRef {
  index: string;
  type?: string; // hit._type; undefined on 7.x+
  id: string;
}

export interface DocMeta {
  source: Record<string, unknown>;
  seqNo?: number;
  primaryTerm?: number;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function documentPath(ref: DocRef): string {
  const type = ref.type ?? '_doc';
  return `/${ref.index}/${type}/${encodeURIComponent(ref.id)}`;
}

export function writePath(path: string, guard: { seqNo?: number; primaryTerm?: number }): string {
  const params = ['refresh=wait_for'];
  if (guard.seqNo !== undefined && guard.primaryTerm !== undefined) {
    params.push(`if_seq_no=${guard.seqNo}`, `if_primary_term=${guard.primaryTerm}`);
  }
  return `${path}?${params.join('&')}`;
}

export function extractDocMeta(getBody: unknown): DocMeta | undefined {
  if (!isPlainObject(getBody) || getBody.found !== true) return undefined;
  const source = getBody._source;
  if (!isPlainObject(source)) return undefined;
  const seqNo = typeof getBody._seq_no === 'number' ? getBody._seq_no : undefined;
  const primaryTerm = typeof getBody._primary_term === 'number' ? getBody._primary_term : undefined;
  return { source, seqNo, primaryTerm };
}

export function parseEditableSource(
  text: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
  }
  if (!isPlainObject(parsed)) return { ok: false, error: 'Document must be a JSON object' };
  return { ok: true, value: parsed };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- src/console/search/docWrite.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/console/search/docWrite.ts src/console/search/docWrite.test.ts
git commit -m "feat(search): pure helpers for document write path and parsing"
```

---

### Task 2: Edit/delete in DocDialog + SearchPage wiring

**Files:**
- Modify: `src/console/search/hitsLib.ts` (add `_type?: string` to `Hit`)
- Modify: `src/console/search/DocDialog.tsx` (view/edit/confirm-delete state machine)
- Modify: `src/console/search/SearchPage.tsx:252` (pass `connection` + `onChanged`)
- Verify: `pnpm compile` + `pnpm test` + screenshot-ui-review (no RTL for the wrapper)

**Interfaces:**
- Consumes: `documentPath`, `writePath`, `extractDocMeta`, `parseEditableSource`, `DocRef`, `DocMeta` (Task 1); `esRequest` (`src/lib/rpc/client.ts`); `esErrorReason` (`src/console/search/searchLib.ts`); `useTheme` (`src/console/theme`); `Hit` (`hitsLib.ts`).
- Produces: `DocDialog` props `{ hit?: Hit; connection: Connection; onClose: () => void; onChanged: (removed: boolean) => void }`. `onChanged(false)` after a save, `onChanged(true)` after a delete — the caller reads the pre-refresh row count to decide page step-back.

- [ ] **Step 1: Add `_type` to the Hit interface**

In `src/console/search/hitsLib.ts`, extend `Hit`:

```ts
export interface Hit {
  _index?: string;
  _id?: string;
  _type?: string;
  _score?: number | null;
  _source?: Record<string, unknown>;
}
```

- [ ] **Step 2: Rewrite DocDialog as a view/edit/delete state machine**

Replace the entire contents of `src/console/search/DocDialog.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import type { Connection } from '../../lib/types';
import { esRequest } from '../../lib/rpc/client';
import { useTheme } from '../theme';
import type { Hit } from './hitsLib';
import { esErrorReason } from './searchLib';
import {
  documentPath,
  writePath,
  extractDocMeta,
  parseEditableSource,
  type DocRef,
  type DocMeta,
} from './docWrite';

type Props = {
  hit?: Hit;
  connection: Connection;
  onClose: () => void;
  onChanged: () => void;
};

type Mode = 'view' | 'edit' | 'confirmDelete';

const EDIT_EXTENSIONS = [json(), EditorView.lineWrapping];

function refOf(hit: Hit | undefined): DocRef | undefined {
  if (!hit || hit._index === undefined || hit._id === undefined) return undefined;
  return { index: hit._index, type: hit._type, id: hit._id };
}

function reason(res: { body: unknown; status: number; error?: string }): string {
  return res.error ?? esErrorReason(res.body) ?? `Request failed (status ${res.status})`;
}

export function DocDialog({ hit, connection, onClose, onChanged }: Props) {
  const { theme } = useTheme();
  const [mode, setMode] = useState<Mode>('view');
  const [meta, setMeta] = useState<DocMeta | undefined>(undefined);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const ref = refOf(hit);
  const pretty = useMemo(() => (hit ? JSON.stringify(hit, null, 2) : ''), [hit]);

  // Reset to a clean view whenever a different hit opens the dialog.
  useEffect(() => {
    setMode('view');
    setMeta(undefined);
    setEditText('');
    setBusy(false);
    setError(undefined);
  }, [hit]);

  const parsed = useMemo(() => parseEditableSource(editText), [editText]);
  const editInvalid = mode === 'edit' && !parsed.ok;

  async function startEdit() {
    if (!ref) return;
    setBusy(true);
    setError(undefined);
    // Refetch the full document — the search query may have restricted _source,
    // so hit._source can be partial and must never be written back.
    const res = await esRequest(connection, 'GET', documentPath(ref));
    setBusy(false);
    if (res.status < 200 || res.status >= 300) {
      setError(reason(res));
      return;
    }
    const m = extractDocMeta(res.body);
    if (!m) {
      setError('Could not read the document.');
      return;
    }
    setMeta(m);
    setEditText(JSON.stringify(m.source, null, 2));
    setMode('edit');
  }

  async function save() {
    if (!ref || !parsed.ok) return;
    setBusy(true);
    setError(undefined);
    const path = writePath(documentPath(ref), {
      seqNo: meta?.seqNo,
      primaryTerm: meta?.primaryTerm,
    });
    const res = await esRequest(connection, 'PUT', path, JSON.stringify(parsed.value));
    setBusy(false);
    if (res.status >= 200 && res.status < 300) {
      onChanged();
      onClose();
      return;
    }
    setError(
      res.status === 409
        ? 'Document changed since you opened it — reopen and try again.'
        : reason(res),
    );
  }

  async function remove() {
    if (!ref) return;
    setBusy(true);
    setError(undefined);
    const res = await esRequest(connection, 'DELETE', writePath(documentPath(ref), {}));
    setBusy(false);
    if (res.status >= 200 && res.status < 300) {
      onChanged();
      onClose();
      return;
    }
    setError(reason(res));
  }

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

        {mode === 'edit' ? (
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <CodeMirror
              value={editText}
              editable={!busy}
              extensions={EDIT_EXTENSIONS}
              theme={theme === 'dark' ? 'dark' : 'light'}
              height="100%"
            />
          </div>
        ) : (
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 font-mono text-xs">{pretty}</pre>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {mode === 'confirmDelete' && (
          <p className="text-sm">
            Delete{' '}
            <span className="font-mono">
              {hit?._index}/{hit?._id}
            </span>
            ? This cannot be undone.
          </p>
        )}

        <div className="flex justify-end gap-2">
          {mode === 'view' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigator.clipboard.writeText(pretty)}
              >
                Copy
              </Button>
              <Button variant="outline" size="sm" disabled={!ref || busy} onClick={() => void startEdit()}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!ref || busy}
                onClick={() => {
                  setError(undefined);
                  setMode('confirmDelete');
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </>
          )}

          {mode === 'edit' && (
            <>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setMode('view')}>
                Cancel
              </Button>
              <Button size="sm" disabled={busy || editInvalid} onClick={() => void save()}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}

          {mode === 'confirmDelete' && (
            <>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setMode('view')}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" disabled={busy} onClick={() => void remove()}>
                {busy ? 'Deleting…' : 'Delete'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Wire the connection + refresh callback in SearchPage**

In `src/console/search/SearchPage.tsx`, replace the `DocDialog` usage (currently line 252):

```tsx
      <DocDialog
        hit={openHit}
        connection={active}
        onClose={() => setOpenHit(undefined)}
        onChanged={(removed) => {
          // Read the pre-refresh row count: deleting the last row on a later page
          // would strand the user on an empty page, so step back one instead.
          const stepBack =
            removed && search.page > 1 && extractHits(search.response?.body).length <= 1;
          void search.goToPage(stepBack ? search.page - 1 : search.page);
        }}
      />
```

Note: `active` is guaranteed defined in this branch of `SearchPage` (the hits table only renders when `active` is set). `extractHits` and `search` are already in scope. `search.goToPage` re-runs without recording history. The pre-refresh row count is read from `search.response` *before* the async `goToPage`, avoiding a stale-closure read of the post-refresh state — and only `removed` (delete) can shrink the row set, so an edit always refreshes the same page.

- [ ] **Step 4: Typecheck**

Run: `pnpm compile`
Expected: no errors. (Confirms the new `DocDialog` props, the `_type` field, and the CodeMirror usage all typecheck.)

- [ ] **Step 5: Full test suite**

Run: `pnpm test`
Expected: all green (Task 1 tests included; nothing else regressed).

- [ ] **Step 6: Commit**

```bash
git add src/console/search/hitsLib.ts src/console/search/DocDialog.tsx src/console/search/SearchPage.tsx
git commit -m "feat(search): edit and delete a document from the doc dialog"
```

---

### Task 3: Screenshot UI review (demo ES 9201)

**Files:** none committed (screenshots go to git-ignored `ui-review/`).

- [ ] **Step 1: Ensure demo ES 9201 is seeded**

Run: `ES_URL=http://localhost:9201 node scripts/store/seed-es.mjs` (only against 9201 — never 9200).

- [ ] **Step 2: Capture states via the Puppeteer + Chrome for Testing recipe**

Reuse the proven capture recipe (fixed extension id `glnbabapnpecmdaekagajnedgkbhcgad`, connection injected into `browser.storage.local`, temp script in repo root). Drive: run a search, open a doc, screenshot **view mode with Edit/Delete buttons**, **edit mode** (JSON editor), and the **confirm-delete** step, in light and dark.

- [ ] **Step 3: Verify a real edit and delete against 9201**

Edit a field, Save, confirm the hits table updates; delete a doc via confirm, confirm the row disappears. Then re-seed so the demo data is whole for the final capture set.

- [ ] **Step 4: Present screenshots inline (Read tool) and finish**

Render each `ui-review/*.png` inline; leave them in place per the screenshot-ui-review skill.

## Self-Review

**Spec coverage:** Edit flow (fetch-fresh, `_source`-only, concurrency guard, refresh) → Task 1 helpers + Task 2 `startEdit`/`save`. Delete flow (confirm, refresh) → Task 2 `remove` + confirm mode. Path/type derivation → `documentPath` + `_type` field. Refresh + empty-page step-back → Task 2 Step 3. Error surfacing (409 / raw) → `reason()` + save's 409 branch. Testing → Task 1 unit tests + Task 3 screenshots.

**Placeholder scan:** none — every step has concrete code or an exact command.

**Type consistency:** `DocRef`/`DocMeta`/`documentPath`/`writePath`/`extractDocMeta`/`parseEditableSource` names match between Task 1 (definition) and Task 2 (consumption). `DocDialog` prop shape `{ hit, connection, onClose, onChanged }` matches the SearchPage call site. `_type?: string` added before it is read in `refOf`.
