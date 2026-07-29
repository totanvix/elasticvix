# Query Linting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cảnh báo (gạch vàng, không chặn) khi query tham chiếu một field không có trong mapping đã cache của index, ngay khi gõ, ở cả Search editor và REST console — với công tắc tắt/bật.

**Architecture:** Một module thuần `lintFields.ts` đi cây JSON theo spec `@field` markers (tái dùng `resolveDesc`/`Resolved` từ engine). Cắm `@codemirror/lint` `linter()` vào 2 editor, có guard tránh false-positive (mapping rỗng, wildcard/comma index). Toggle lưu localStorage (pattern `useHiddenColumns`).

**Tech Stack:** React 19, TS strict (`noUncheckedIndexedAccess`), CodeMirror 6 (`@codemirror/lint`, `@codemirror/language`, `@lezer/common`), Vitest, Tailwind v4, lucide-react.

## Global Constraints

- TS strict, `noUncheckedIndexedAccess: true` — truy cập mảng/`firstChild` phải guard hoặc `!` khi chắc.
- Immutable: không mutate input.
- Linter **warning-only, không chặn** `Cmd/Ctrl+Enter`.
- **Tránh false-positive (bắt buộc):** `fields` rỗng → `[]`; REST index chứa `*`/`,` → bỏ lint; token chứa `*`/`?`/`^` hoặc rỗng → bỏ; wording "not in the cached mapping".
- Toggle mặc định **BẬT**; global localStorage key `elasticvix.lint.fields`.
- Test hook/pure: repo **không** dùng `@testing-library/react` — test logic thuần; component/CM wiring verify bằng screenshot.
- Commands: `pnpm test`, `pnpm compile`, `pnpm build`. Commit tiếng Anh, không attribution footer.

---

### Task 1: Whole-tree field walk — `lintFields.ts`

**Files:**
- Modify: `src/lib/autocomplete/engine.ts` (export `resolveDesc` + type `Resolved`)
- Create: `src/lib/autocomplete/lintFields.ts`
- Test: `src/lib/autocomplete/lintFields.test.ts`

**Interfaces:**
- Consumes: `spec`, `ValueDesc` từ `./spec`; `resolveDesc`, `Resolved` từ `./engine`; `FlatField` từ `../types`; `syntaxTree` (`@codemirror/language`), `EditorState` (`@codemirror/state`), `json` (`@codemirror/lang-json`), `SyntaxNode` (`@lezer/common`).
- Produces: `findUnknownFields(bodyText: string, rootRef: string, fields: FlatField[]): FieldRef[]` where `interface FieldRef { from: number; to: number; field: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/autocomplete/lintFields.test.ts
import { describe, it, expect } from 'vitest';
import { findUnknownFields } from './lintFields';
import type { FlatField } from '../types';

const FIELDS: FlatField[] = [
  { path: 'category', type: 'keyword' },
  { path: 'name', type: 'text' },
  { path: 'name.keyword', type: 'keyword' },
  { path: 'price', type: 'float' },
];
const find = (body: string) => findUnknownFields(body, 'queryBody', FIELDS).map((d) => d.field);

describe('findUnknownFields', () => {
  it('flags an unknown field key under term', () => {
    expect(find('{"query":{"term":{"catgory":"x"}}}')).toEqual(['catgory']);
  });
  it('accepts a known field key', () => {
    expect(find('{"query":{"term":{"category":"x"}}}')).toEqual([]);
  });
  it('accepts a known multi-field subfield', () => {
    expect(find('{"query":{"term":{"name.keyword":"x"}}}')).toEqual([]);
  });
  it('flags an unknown field in exists.field (value position)', () => {
    expect(find('{"query":{"exists":{"field":"catgory"}}}')).toEqual(['catgory']);
  });
  it('flags an unknown field in an aggs field value', () => {
    expect(find('{"aggs":{"by_cat":{"terms":{"field":"catgory"}}}}')).toEqual(['catgory']);
  });
  it('does not flag DSL keywords', () => {
    expect(find('{"query":{"bool":{"must":[{"match_all":{}}]}},"size":10,"from":0}')).toEqual([]);
  });
  it('does not flag user-chosen aggregation names (@any)', () => {
    expect(find('{"aggs":{"not_a_field":{"terms":{"field":"category"}}}}')).toEqual([]);
  });
  it('returns nothing when the mapping is empty', () => {
    expect(findUnknownFields('{"query":{"term":{"catgory":"x"}}}', 'queryBody', [])).toEqual([]);
  });
  it('skips wildcard/boost-looking tokens', () => {
    expect(find('{"query":{"term":{"cat*":"x"}}}')).toEqual([]);
  });
  it('flags unknown field under range and sort', () => {
    expect(find('{"query":{"range":{"prize":{"gte":1}}}}')).toEqual(['prize']);
    expect(find('{"sort":[{"prize":{"order":"asc"}}]}')).toEqual(['prize']);
  });
  it('reports the source range of the offending token', () => {
    const body = '{"query":{"term":{"catgory":"x"}}}';
    const [d] = findUnknownFields(body, 'queryBody', FIELDS);
    expect(body.slice(d!.from, d!.to)).toBe('"catgory"');
  });
  it('does not throw on incomplete JSON while typing', () => {
    expect(() => findUnknownFields('{"query":{"term":{"cat', 'queryBody', FIELDS)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/autocomplete/lintFields.test.ts`
Expected: FAIL — module `./lintFields` not found.

- [ ] **Step 3a: Export spec primitives from `engine.ts`**

Change two declarations (add `export`, no logic change):

```ts
// was: type Resolved =
export type Resolved =
```

```ts
// was: function resolveDesc(spec: SpecData, desc: ValueDesc): Resolved {
export function resolveDesc(spec: SpecData, desc: ValueDesc): Resolved {
```

- [ ] **Step 3b: Write `lintFields.ts`**

```ts
// src/lib/autocomplete/lintFields.ts
import { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { json } from '@codemirror/lang-json';
import type { SyntaxNode } from '@lezer/common';
import type { FlatField } from '../types';
import { spec as defaultSpec, type ValueDesc } from './spec';
import { resolveDesc, type Resolved } from './engine';

export interface FieldRef {
  from: number;
  to: number;
  field: string;
}

const LEAF: Resolved = { kind: 'leaf' };
const VALUE_NODES = new Set(['Object', 'Array', 'String', 'Number', 'True', 'False', 'Null']);

function unquote(s: string): string {
  return s.replace(/^"/, '').replace(/"$/, '');
}

// Skip empty tokens and wildcard/boost patterns (e.g. `title^2`, `cat*`) — those
// are valid query syntax, not literal field names, and would be false positives.
function looksPattern(t: string): boolean {
  return t === '' || /[*?^]/.test(t);
}

function propertyValue(prop: SyntaxNode): SyntaxNode | null {
  for (let c = prop.firstChild; c; c = c.nextSibling) {
    if (VALUE_NODES.has(c.name)) return c;
  }
  return null;
}

// Walk the JSON body and report tokens sitting at a spec `@field` position that
// are not present in the index mapping. Pure: no IO. Returns [] when the mapping
// is unknown (empty) so an absent mapping never produces warnings.
export function findUnknownFields(bodyText: string, rootRef: string, fields: FlatField[]): FieldRef[] {
  if (fields.length === 0) return [];
  const fieldSet = new Set(fields.map((f) => f.path));
  const state = EditorState.create({ doc: bodyText, extensions: [json()] });
  const tree = syntaxTree(state);
  const rootValue = tree.topNode.firstChild;
  if (!rootValue) return [];

  const out: FieldRef[] = [];
  const check = (token: string, from: number, to: number) => {
    if (!looksPattern(token) && !fieldSet.has(token)) out.push({ from, to, field: token });
  };

  const visit = (node: SyntaxNode, resolved: Resolved): void => {
    if (node.name === 'Object') {
      if (resolved.kind !== 'object') return;
      const bodyNode = resolved.node;
      for (let c = node.firstChild; c; c = c.nextSibling) {
        if (c.name !== 'Property') continue;
        const nameNode = c.getChild('PropertyName');
        if (!nameNode) continue;
        const key = unquote(state.sliceDoc(nameNode.from, nameNode.to));
        let nextDesc: ValueDesc | undefined;
        if (key in bodyNode) {
          nextDesc = bodyNode[key];
        } else if ('@field' in bodyNode) {
          nextDesc = bodyNode['@field'];
          check(key, nameNode.from, nameNode.to);
        } else if ('@any' in bodyNode) {
          nextDesc = bodyNode['@any'];
        }
        const valueNode = propertyValue(c);
        if (valueNode) visit(valueNode, nextDesc === undefined ? LEAF : resolveDesc(defaultSpec, nextDesc));
      }
    } else if (node.name === 'Array') {
      if (resolved.kind !== 'array') return;
      const elemResolved = resolveDesc(defaultSpec, resolved.elem);
      for (let c = node.firstChild; c; c = c.nextSibling) {
        if (VALUE_NODES.has(c.name)) visit(c, elemResolved);
      }
    } else if (node.name === 'String') {
      if (resolved.kind === 'field') {
        check(unquote(state.sliceDoc(node.from, node.to)), node.from, node.to);
      }
    }
  };

  visit(rootValue, resolveDesc(defaultSpec, `#${rootRef}`));
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/autocomplete/lintFields.test.ts && pnpm compile`
Expected: all PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/autocomplete/engine.ts src/lib/autocomplete/lintFields.ts src/lib/autocomplete/lintFields.test.ts
git commit -m "feat(lint): walk query body for fields absent from the mapping"
```

---

### Task 2: Toggle storage + hook — `useLintEnabled.ts`

**Files:**
- Create: `src/console/editor/useLintEnabled.ts`
- Test: `src/console/editor/useLintEnabled.test.ts`

**Interfaces:**
- Produces: `LINT_ENABLED_KEY`, `loadLintEnabled(): boolean`, `saveLintEnabled(enabled: boolean): void`, `useLintEnabled(): { enabled: boolean; toggle: () => void }` (consumed by QueryEditor Task 3 and SearchPage Task 4).

- [ ] **Step 1: Write the failing test**

```ts
// src/console/editor/useLintEnabled.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadLintEnabled, saveLintEnabled, LINT_ENABLED_KEY } from './useLintEnabled';

describe('lint enabled storage', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to true when unset', () => {
    expect(loadLintEnabled()).toBe(true);
  });
  it('round-trips false', () => {
    saveLintEnabled(false);
    expect(loadLintEnabled()).toBe(false);
  });
  it('round-trips true', () => {
    saveLintEnabled(true);
    expect(loadLintEnabled()).toBe(true);
  });
  it('treats any non-"false" stored value as enabled', () => {
    localStorage.setItem(LINT_ENABLED_KEY, 'garbage');
    expect(loadLintEnabled()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/console/editor/useLintEnabled.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

```ts
// src/console/editor/useLintEnabled.ts
import { useCallback, useState } from 'react';

export const LINT_ENABLED_KEY = 'elasticvix.lint.fields';

// Default ON: only an explicit 'false' disables it.
export function loadLintEnabled(): boolean {
  return localStorage.getItem(LINT_ENABLED_KEY) !== 'false';
}

export function saveLintEnabled(enabled: boolean): void {
  localStorage.setItem(LINT_ENABLED_KEY, enabled ? 'true' : 'false');
}

export function useLintEnabled(): { enabled: boolean; toggle: () => void } {
  const [enabled, setEnabled] = useState<boolean>(() => loadLintEnabled());
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      saveLintEnabled(next);
      return next;
    });
  }, []);
  return { enabled, toggle };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/console/editor/useLintEnabled.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/console/editor/useLintEnabled.ts src/console/editor/useLintEnabled.test.ts
git commit -m "feat(lint): persist a global enable/disable toggle"
```

---

### Task 3: Wire linter into REST console — `editorExtensions.ts` + `QueryEditor.tsx`

**Files:**
- Modify: `src/console/editor/editorExtensions.ts`
- Modify: `src/console/editor/QueryEditor.tsx`

**Interfaces:**
- Consumes: `findUnknownFields`/`FieldRef` (Task 1); `useLintEnabled` (Task 2); `linter`/`Diagnostic` (`@codemirror/lint`); `parseRequestLine`, `spec` (autocomplete).
- Produces: `buildEditorExtensions(getFields, getFieldValues, lintEnabled: boolean)`; exported `searchFieldLinter(getFields: () => Promise<FlatField[]>): Extension` (consumed by Task 4).

- [ ] **Step 1: Rewrite `editorExtensions.ts`**

```ts
// src/console/editor/editorExtensions.ts
import { json } from '@codemirror/lang-json';
import { autocompletion } from '@codemirror/autocomplete';
import { linter, type Diagnostic } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import type { FlatField } from '../../lib/types';
import { esCompletionSource } from '../../lib/autocomplete/engine';
import { findUnknownFields, type FieldRef } from '../../lib/autocomplete/lintFields';
import { spec as defaultSpec } from '../../lib/autocomplete/spec';
import { parseRequestLine } from '../../lib/autocomplete/requestLine';

function toDiagnostics(refs: FieldRef[], offset: number, index?: string): Diagnostic[] {
  const where = index ? ` of ${index}` : '';
  return refs.map((r) => ({
    from: offset + r.from,
    to: offset + r.to,
    severity: 'warning' as const,
    message: `"${r.field}" is not in the cached mapping${where}`,
  }));
}

// REST console: request line on line 1, JSON body after. Skip linting when the
// endpoint has no body spec, or the target is multi/wildcard (`*`/`,`) — the
// mapping fetch only returns the first concrete index, so a partial mapping
// would flag valid fields.
function restLinter(getFields: (index?: string) => Promise<FlatField[]>): Extension {
  return linter(async (view): Promise<Diagnostic[]> => {
    const docText = view.state.doc.toString();
    const nl = docText.indexOf('\n');
    if (nl === -1) return [];
    const { index, endpoint } = parseRequestLine(docText.slice(0, nl));
    const bodyRef = endpoint ? defaultSpec.endpoints[endpoint]?.bodyRef : undefined;
    if (!bodyRef) return [];
    if (index && /[*,]/.test(index)) return [];
    const fields = await getFields(index);
    const bodyStart = nl + 1;
    const refs = findUnknownFields(docText.slice(bodyStart), bodyRef, fields);
    return toDiagnostics(refs, bodyStart, index);
  });
}

// Search editor: the whole document is a `_search` body (no request line).
export function searchFieldLinter(getFields: () => Promise<FlatField[]>): Extension {
  const bodyRef = defaultSpec.endpoints['_search']?.bodyRef ?? 'queryBody';
  return linter(async (view): Promise<Diagnostic[]> => {
    const fields = await getFields();
    const refs = findUnknownFields(view.state.doc.toString(), bodyRef, fields);
    return toDiagnostics(refs, 0);
  });
}

export function buildEditorExtensions(
  getFields: (index?: string) => Promise<FlatField[]>,
  getFieldValues: (index: string | undefined, field: string) => Promise<string[]>,
  lintEnabled: boolean,
): Extension[] {
  return [
    json(),
    autocompletion({ override: [esCompletionSource(getFields, getFieldValues)] }),
    ...(lintEnabled ? [restLinter(getFields)] : []),
  ];
}
```

- [ ] **Step 2: Add the toggle to `QueryEditor.tsx`**

Import the hook + icon (add to existing imports):

```tsx
import { SpellCheck } from 'lucide-react';
import { useLintEnabled } from './useLintEnabled';
```

Read the hook and thread `lintEnabled` into the memo (replace the `extensions`/`useMemo` block):

```tsx
  const { enabled: lintEnabled, toggle: toggleLint } = useLintEnabled();

  const extensions = useMemo(() => {
    const getFields = makeGetFields(active);
    const getFieldValues = makeGetFieldValues(active);
    return [
      ...buildEditorExtensions(getFields, getFieldValues, lintEnabled),
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
  }, [active, onRun, lintEnabled]);
```

Add the toggle button to the toolbar (after the Format button, before `</div>`):

```tsx
        <Button size="sm" variant="outline" onClick={onFormat}>
          Format
        </Button>
        <Button
          size="sm"
          variant={lintEnabled ? 'secondary' : 'ghost'}
          onClick={toggleLint}
          aria-label="Toggle field linting"
          title={lintEnabled ? 'Field linting on' : 'Field linting off'}
        >
          <SpellCheck className="h-4 w-4" /> Lint
        </Button>
```

- [ ] **Step 3: Typecheck + build**

Run: `pnpm compile && pnpm test && pnpm build`
Expected: typecheck clean; all tests PASS; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/console/editor/editorExtensions.ts src/console/editor/QueryEditor.tsx
git commit -m "feat(lint): field linting + toggle in the REST console"
```

---

### Task 4: Wire linter into Search editor — `SearchEditor.tsx` + `SearchPage.tsx`

**Files:**
- Modify: `src/console/search/SearchEditor.tsx`
- Modify: `src/console/search/SearchPage.tsx`

**Interfaces:**
- Consumes: `searchFieldLinter` (Task 3); `useLintEnabled` (Task 2).
- Produces: `SearchEditor` prop `lintEnabled: boolean`.

- [ ] **Step 1: Add linting to `SearchEditor.tsx`**

Add imports:

```tsx
import { searchFieldLinter } from '../editor/editorExtensions';
```

Add `lintEnabled` to props:

```tsx
type Props = {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  getFields: () => Promise<FlatField[]>;
  getFieldValues: (field: string) => Promise<string[]>;
  lintEnabled: boolean;
};

export function SearchEditor({ value, onChange, onRun, getFields, getFieldValues, lintEnabled }: Props) {
```

Insert the linter into the memo array and its deps:

```tsx
  const extensions = useMemo(
    () => [
      json(),
      autocompletion({ override: [bodyCompletionSource(getFields, getFieldValues)] }),
      ...(lintEnabled ? [searchFieldLinter(getFields)] : []),
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              onRun();
              return true;
            },
          },
        ]),
      ),
    ],
    [getFields, getFieldValues, onRun, lintEnabled],
  );
```

- [ ] **Step 2: Add the toggle to `SearchPage.tsx`**

Add imports:

```tsx
import { SpellCheck } from 'lucide-react';
import { useLintEnabled } from '../editor/useLintEnabled';
```

Read the hook near the other state (after `const [mappingIndex, ...]`):

```tsx
  const { enabled: lintEnabled, toggle: toggleLint } = useLintEnabled();
```

Pass the prop to `SearchEditor` (the existing usage lists `getFields`/`getFieldValues`):

```tsx
          <SearchEditor
            value={search.queryText}
            onChange={search.changeQuery}
            onRun={() => void search.runSearch()}
            getFields={getFields}
            getFieldValues={getFieldValues}
            lintEnabled={lintEnabled}
          />
```

Add the toggle button in the toolbar (after the existing `Reset query` button):

```tsx
          <Button variant="outline" size="sm" onClick={() => search.changeQuery(DEFAULT_QUERY)}>
            Reset query
          </Button>
          <Button
            variant={lintEnabled ? 'secondary' : 'ghost'}
            size="sm"
            onClick={toggleLint}
            aria-label="Toggle field linting"
            title={lintEnabled ? 'Field linting on' : 'Field linting off'}
          >
            <SpellCheck className="h-4 w-4" /> Lint
          </Button>
```

- [ ] **Step 3: Typecheck, test, build**

Run: `pnpm compile && pnpm test && pnpm build`
Expected: typecheck clean; all tests PASS; build → `.output/chrome-mv3`.

- [ ] **Step 4: Commit**

```bash
git add src/console/search/SearchEditor.tsx src/console/search/SearchPage.tsx
git commit -m "feat(lint): field linting + toggle in the Search editor"
```

---

## Post-implementation

- **screenshot-ui-review** trên extension thật (ES demo 9201, index `products`): gõ query với field sai (vd `catgory`) → gạch vàng + hover message; chụp (a) squiggle + tooltip ở REST, (b) squiggle ở Search, (c) tắt toggle → hết gạch. Lưu ảnh `ui-review/` (render inline).
- Không push/merge — chờ user duyệt ảnh.

## Self-Review

**Spec coverage:**
- §2 lint key `@field` + value `@field` ← Task 1 (`findUnknownFields`). Search + REST ← Task 3/4. Toggle ← Task 2 + Task 3/4 buttons.
- §3 false-positive guards: `@field`-only walk ← Task 1; `fields=[]`→[] ← Task 1; wildcard/comma index ← Task 3 `restLinter`; `looksPattern` ← Task 1; wording "cached mapping" ← Task 3 `toDiagnostics`; off-switch ← Task 2 + toggles; warning severity ← Task 3.
- §4.1 `lintFields` ← Task 1 (+ engine export). §4.2 `buildEditorExtensions(...,lintEnabled)` + `restLinter` ← Task 3. §4.3 `useLintEnabled` ← Task 2. §4.4 wiring REST(QueryEditor)/Search(SearchEditor+SearchPage) ← Task 3/4.
- §5 edge cases ← Task 1 tests (term/exists/aggs/@any/keywords/empty/pattern/range/sort/incomplete) + Task 3 guard (wildcard).
- §6 tests: `lintFields.test.ts` ← Task 1; `useLintEnabled.test.ts` ← Task 2; wiring qua screenshot ← Post-implementation.

**Placeholder scan:** không TBD/TODO; mọi code step có block thật.

**Type consistency:** `FieldRef {from,to,field}` khớp Task 1 ↔ Task 3 `toDiagnostics`. `findUnknownFields(bodyText, rootRef, fields)` khớp Task 1 ↔ Task 3/4 linters. `buildEditorExtensions(getFields, getFieldValues, lintEnabled)` khớp Task 3 def ↔ QueryEditor call. `searchFieldLinter(getFields)` khớp Task 3 export ↔ Task 4 import. `useLintEnabled(): {enabled, toggle}` khớp Task 2 ↔ Task 3/4. Prop `lintEnabled: boolean` khớp Task 4 SearchEditor ↔ SearchPage.
