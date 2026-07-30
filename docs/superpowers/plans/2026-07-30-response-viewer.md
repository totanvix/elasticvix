# Response Viewer Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fold / download / filter to the shared `ResponseView` so a large ES response becomes navigable.

**Architecture:** One pure function (`filterResponse`) prunes the JSON body by key/value match; one tiny helper names the download file; `ResponseView` wires CodeMirror folding, a Download button, and a filter input on top of both. Pure logic is unit-tested; the React wrapper is verified by typecheck + screenshot.

**Tech Stack:** React 19, `@uiw/react-codemirror`, `@codemirror/language` (folding), `@codemirror/lang-json`, Vitest, Tailwind v4, lucide-react, TypeScript strict.

## Global Constraints

- TypeScript strict; `noUncheckedIndexedAccess` is on.
- Repo test convention: NO `@testing-library/react`. Extract pure logic and unit-test it; thin React wrappers are verified via typecheck + `screenshot-ui-review`.
- Commits in English, imperative subject ≤50 chars, **no attribution footer**.
- Screenshots use the demo ES on port **9201** only. Port **9200 is the live viec.co production cluster — never touch it.**
- Dark mode via Tailwind `.dark` class; keep both themes legible.
- Immutable data only — `filterResponse` returns new objects/arrays, never mutates its input.

---

### Task 1: `filterResponse` pure prune function

**Files:**
- Create: `src/console/editor/filterResponse.ts`
- Test: `src/console/editor/filterResponse.test.ts`

**Interfaces:**
- Produces: `filterResponse(body: unknown, query: string): unknown` — returns `body`
  unchanged when the trimmed query is empty; a pruned deep copy keeping only paths
  whose key or leaf value contains the query (case-insensitive); or `undefined` when
  nothing matches. A matched **key** keeps its whole subtree unpruned.

- [ ] **Step 1: Write the failing test**

```ts
// src/console/editor/filterResponse.test.ts
import { describe, it, expect } from 'vitest';
import { filterResponse } from './filterResponse';

const RESP = {
  took: 5,
  hits: {
    total: { value: 42 },
    hits: [
      { _id: '1', _source: { title: 'Senior Dev', salary: 3000 } },
      { _id: '2', _source: { title: 'Junior Dev', salary: 1500 } },
    ],
  },
};

describe('filterResponse', () => {
  it('returns the body unchanged for an empty query', () => {
    expect(filterResponse(RESP, '')).toBe(RESP);
    expect(filterResponse(RESP, '   ')).toBe(RESP);
  });

  it('keeps every path whose key matches, dropping the rest', () => {
    expect(filterResponse(RESP, 'title')).toEqual({
      hits: { hits: [{ _source: { title: 'Senior Dev' } }, { _source: { title: 'Junior Dev' } }] },
    });
  });

  it('matches leaf string values case-insensitively', () => {
    expect(filterResponse(RESP, 'senior')).toEqual({
      hits: { hits: [{ _source: { title: 'Senior Dev' } }] },
    });
  });

  it('matches numeric leaf values by string form', () => {
    expect(filterResponse(RESP, '3000')).toEqual({
      hits: { hits: [{ _source: { salary: 3000 } }] },
    });
  });

  it('keeps the whole subtree when a key matches', () => {
    expect(filterResponse(RESP, '_source')).toEqual({
      hits: {
        hits: [
          { _source: { title: 'Senior Dev', salary: 3000 } },
          { _source: { title: 'Junior Dev', salary: 1500 } },
        ],
      },
    });
  });

  it('preserves the path to root for a nested match', () => {
    expect(filterResponse(RESP, 'value')).toEqual({ hits: { total: { value: 42 } } });
  });

  it('compacts arrays to only matching elements', () => {
    const data = { rows: [{ n: 'apple' }, { n: 'banana' }, { n: 'cherry' }] };
    expect(filterResponse(data, 'ban')).toEqual({ rows: [{ n: 'banana' }] });
  });

  it('returns undefined when nothing matches', () => {
    expect(filterResponse(RESP, 'zzz-nope')).toBeUndefined();
  });

  it('handles boolean and null leaves without throwing', () => {
    const data = { a: true, b: null, c: 'hello' };
    expect(filterResponse(data, 'null')).toEqual({ b: null });
    expect(filterResponse(data, 'true')).toEqual({ a: true });
  });

  it('does not mutate the input', () => {
    const snapshot = JSON.stringify(RESP);
    filterResponse(RESP, 'title');
    expect(JSON.stringify(RESP)).toBe(snapshot);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/console/editor/filterResponse.test.ts`
Expected: FAIL — `filterResponse` is not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/console/editor/filterResponse.ts

// Sentinel returned by prune() when nothing under a value matches the query.
const NO_MATCH = Symbol('no-match');

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function prune(value: unknown, q: string): unknown {
  if (Array.isArray(value)) {
    const kept: unknown[] = [];
    for (const el of value) {
      const p = prune(el, q);
      if (p !== NO_MATCH) kept.push(p);
    }
    return kept.length > 0 ? kept : NO_MATCH;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    let any = false;
    for (const [key, val] of Object.entries(value)) {
      if (key.toLowerCase().includes(q)) {
        out[key] = val; // key match → keep the whole subtree unpruned
        any = true;
        continue;
      }
      const p = prune(val, q);
      if (p !== NO_MATCH) {
        out[key] = p;
        any = true;
      }
    }
    return any ? out : NO_MATCH;
  }
  return String(value).toLowerCase().includes(q) ? value : NO_MATCH;
}

// Prune a JSON body to just the paths matching `query` (key or leaf value,
// case-insensitive). Empty query returns `body` unchanged; no match returns
// `undefined`. Pure — never mutates `body`.
export function filterResponse(body: unknown, query: string): unknown {
  const q = query.trim().toLowerCase();
  if (q === '') return body;
  const pruned = prune(body, q);
  return pruned === NO_MATCH ? undefined : pruned;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/console/editor/filterResponse.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/console/editor/filterResponse.ts src/console/editor/filterResponse.test.ts
git commit -m "feat(response): prune-by-match response filter helper"
```

---

### Task 2: `responseDownloadName` helper

**Files:**
- Modify: `src/console/search/downloadJson.ts`
- Test: `src/console/search/downloadJson.test.ts` (create if absent, else append)

**Interfaces:**
- Consumes: existing `downloadJson(data: unknown, filename: string): void`.
- Produces: `responseDownloadName(now: Date): string` → `elasticvix-response-<stamp>.json`
  where `<stamp>` is `now.toISOString().slice(0, 19)` with `:` replaced by `-`.

- [ ] **Step 1: Write the failing test**

```ts
// src/console/search/downloadJson.test.ts  (append if the file already exists)
import { describe, it, expect } from 'vitest';
import { responseDownloadName } from './downloadJson';

describe('responseDownloadName', () => {
  it('builds a timestamped response filename', () => {
    expect(responseDownloadName(new Date('2026-07-30T12:34:56.000Z'))).toBe(
      'elasticvix-response-2026-07-30T12-34-56.json',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/console/search/downloadJson.test.ts`
Expected: FAIL — `responseDownloadName` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/console/search/downloadJson.ts`:

```ts
export function responseDownloadName(now: Date): string {
  const stamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
  return `elasticvix-response-${stamp}.json`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/console/search/downloadJson.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/console/search/downloadJson.ts src/console/search/downloadJson.test.ts
git commit -m "feat(response): responseDownloadName filename helper"
```

---

### Task 3: Wire fold + download + filter into `ResponseView`

**Files:**
- Modify: `src/console/editor/ResponseView.tsx`

**Interfaces:**
- Consumes: `filterResponse` (Task 1), `downloadJson` + `responseDownloadName` (Task 2),
  `codeFolding` / `foldGutter` / `foldKeymap` from `@codemirror/language`, `keymap` from
  `@codemirror/view`, `Input` from `../ui/input`, `Copy` / `Download` from `lucide-react`.
- Produces: no exported API change — same `ResponseView({ response })` component.

Use the **frontend-design** skill for the header control styling (filter input width,
icon-button grouping, spacing, dark-mode legibility, empty-state copy).

- [ ] **Step 1: Replace the component body**

Full new content for `src/console/editor/ResponseView.tsx`:

```tsx
import { useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView, keymap } from '@codemirror/view';
import { codeFolding, foldGutter, foldKeymap } from '@codemirror/language';
import { Copy, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { EsResult } from '../../lib/rpc/messages';
import { downloadJson, responseDownloadName } from '../search/downloadJson';
import { filterResponse } from './filterResponse';
import { useTheme } from '../theme';

type Props = { response: EsResult | undefined };

// Stable extension array: read-only JSON with wrapping + folding.
const EXTENSIONS = [json(), EditorView.lineWrapping, codeFolding(), foldGutter(), keymap.of(foldKeymap)];

function statusTone(status: number): string {
  if (status === 0) return 'bg-destructive'; // transport error
  if (status >= 200 && status < 300) return 'bg-green-500';
  return 'bg-amber-500'; // ES-level error (4xx/5xx)
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ResponseView({ response }: Props) {
  const { theme } = useTheme();
  const [filter, setFilter] = useState('');

  const isTransportError = response?.status === 0 && Boolean(response?.error);
  const filterable = Boolean(response) && !isTransportError;

  // Displayed text obeys the filter (WYSIWYG): Copy/Download act on what is shown.
  const view = useMemo(() => {
    if (!response) return { text: '', noMatch: false, downloadValue: undefined as unknown };
    if (isTransportError) {
      return { text: `// Transport error\n${response.error}`, noMatch: false, downloadValue: undefined as unknown };
    }
    const q = filter.trim();
    const value = q === '' ? response.body : filterResponse(response.body, filter);
    if (q !== '' && value === undefined) return { text: '', noMatch: true, downloadValue: undefined as unknown };
    return { text: stringify(value), noMatch: false, downloadValue: value };
  }, [response, filter, isTransportError]);

  if (!response) {
    return <div className="p-3 text-sm text-muted-foreground">Run a request to see the response.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-2 py-1 text-sm">
        <span className={`inline-block h-2 w-2 rounded-full ${statusTone(response.status)}`} />
        <span>{response.status === 0 ? 'ERR' : response.status}</span>
        <span className="text-muted-foreground">· {response.took} ms</span>
        <div className="ml-auto flex items-center gap-1">
          {filterable && (
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter response…"
              aria-label="Filter response"
              className="h-7 w-44"
            />
          )}
          {filterable && (
            <Button
              size="sm"
              variant="ghost"
              className="w-8 px-0"
              aria-label="Download response"
              disabled={view.noMatch}
              onClick={() => downloadJson(view.downloadValue, responseDownloadName(new Date()))}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="w-8 px-0"
            aria-label="Copy response"
            disabled={view.noMatch}
            onClick={() => void navigator.clipboard.writeText(view.text)}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {view.noMatch ? (
          <div className="p-3 text-sm text-muted-foreground">No matching paths.</div>
        ) : (
          <CodeMirror
            value={view.text}
            editable={false}
            extensions={EXTENSIONS}
            theme={theme === 'dark' ? 'dark' : 'light'}
            height="100%"
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `pnpm exec tsc --noEmit && pnpm build`
Expected: no type errors; build succeeds. (Confirms `Input` path, lucide icons, and the CodeMirror fold imports resolve.)

- [ ] **Step 3: Full test suite**

Run: `pnpm test`
Expected: all green (new filterResponse + downloadJson tests included).

- [ ] **Step 4: Commit**

```bash
git add src/console/editor/ResponseView.tsx
git commit -m "feat(response): fold, download, and filter in the response viewer"
```

---

### Task 4: Screenshot review

**Not a code task — a verification gate.** Use the **screenshot-ui-review** skill.

- [ ] Seed the demo ES on port **9201** if needed (never 9200), start the extension, open the REST console.
- [ ] Run a `_search` that returns a multi-doc response.
- [ ] Capture three states and present them inline:
  1. Response with fold gutter visible (a node folded).
  2. Filter active (e.g. `title`) showing the pruned tree + the filter input.
  3. The Download button present in the header (and dark mode looks right).
- [ ] Confirm each image is not blank/error before presenting.

## Self-Review

- **Spec coverage:** fold (Task 3), download + `responseDownloadName` (Tasks 2–3),
  filter prune semantics (Task 1), WYSIWYG Copy/Download (Task 3), transport-error
  hides filter/download (Task 3), "No matching paths" (Task 3). All covered.
- **Placeholder scan:** none — every step has real code.
- **Type consistency:** `filterResponse(body, query)`, `responseDownloadName(now)`,
  `downloadJson(data, filename)` used identically across tasks. `view.downloadValue`
  feeds `downloadJson`; `view.text` feeds Copy — consistent.
