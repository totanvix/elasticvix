# Elasticvix Query Console — Plan 2: Console UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full-page React console UI for Elasticvix on top of the tested Plan 1 core (RPC client, storage repos, autocomplete engine, types) — connection management, a CodeMirror query editor with field-aware autocomplete, response viewer, saved queries (tags + search), and history — plus fix the two integration risks Plan 1's review surfaced.

**Architecture:** A single full-page React 19 app (opened in a tab by the background icon-click handler) under `src/console/`, imported by `entrypoints/console/main.tsx`. UI uses **mvpui** (`@mvp-ui/ui` + `@mvp-ui/tokens`) on **Tailwind v4**; the editor is **CodeMirror 6** via `@uiw/react-codemirror`. All data access goes through Plan 1: `src/lib/rpc/client.ts` (background gateway) and `src/lib/storage/*`. Local state is plain React hooks (no external store); server-ish reads (connections, saved queries, history, mappings) are read/written directly through the repos.

**Tech Stack:** React 19, mvpui, Tailwind v4 (`@tailwindcss/vite`), CodeMirror 6 (`@uiw/react-codemirror`, `@codemirror/lang-json`, `@codemirror/lint`), WXT/Vite, TS strict, pnpm, Vitest.

## Global Constraints

- **Build on Plan 1 (already merged to `master`).** Do not reimplement core logic — consume `esRequest`/`detectVersion`/`fetchMapping` (`src/lib/rpc/client.ts`), `listConnections`/`saveConnection`/`deleteConnection`/`getActiveConnectionId`/`setActiveConnectionId` (`src/lib/storage/connections.ts`), `putSavedQuery`/`deleteSavedQuery`/`listSavedQueries`/`searchSavedQueries` (`src/lib/storage/savedQueries.ts`), `addHistory`/`listHistory` (`src/lib/storage/history.ts`), `getCachedFields`/`setCachedFields` (`src/lib/storage/mappingCache.ts`), `esCompletionSource`/`resolveCompletions` (`src/lib/autocomplete/engine.ts`), and the shared types in `src/lib/types.ts`.
- **App name is `Elasticvix`** everywhere user-visible. IndexedDB name is `elasticvix`. Internal type name `VixSchema` stays.
- **UI kit:** mvpui only for components — `import { … } from '@mvp-ui/ui'`; tokens CSS from `@mvp-ui/tokens`. Prefer mvpui components over hand-rolled ones. **Component prop names below are best-effort — verify each against the installed `@mvp-ui/ui` types and adjust; do not invent props the library lacks.**
- **Styling:** Tailwind v4 utility classes + mvpui tokens. No other CSS framework. No hardcoded hex colors — use mvpui token variables / Tailwind theme.
- **Theme:** support light/dark by setting `data-theme="dark"` on `document.documentElement`; default to the OS preference; expose a toggle.
- **Editor model:** one request per editor — line 1 is `METHOD /path`, the rest is a JSON body.
- **React conventions (user ruleset):** function components only; props typed with a named `type Props`; no `React.FC`; destructure props; group hooks at top; no `any` (use `unknown` + narrow); immutable state updates; boolean props prefixed `is/has/can`; event handlers `handleX`, props `onX`; no `console.log` in shipped code (surface errors in UI state).
- **No secrets, local-only, no telemetry.** Requests reach ES only through the background gateway.
- **Testing:** UI is verified **manually** per task (concrete checklist, load unpacked extension). Pure/logic changes (Task 2, and any pure helper) get Vitest tests. No heavy Playwright e2e in this plan.
- **Verify commands per task:** `pnpm compile` (tsc) and, for anything touching the bundle, `pnpm build`. Manual UI checks run against a real ES cluster (the user has ES 6.5 / 7 / 8).

---

## File Structure

```
wxt.config.ts                      # MODIFY: add `@` alias (→ ./src) + Tailwind v4 vite plugin
entrypoints/console/main.tsx       # MODIFY: mount <App/>, import styles.css
src/console/
  styles.css                       # @import tokens + tailwindcss
  App.tsx                          # providers (theme) + Layout
  theme.tsx                        # ThemeProvider + useTheme (data-theme on <html>)
  layout/
    ConsoleLayout.tsx              # 3-pane responsive layout + top bar
  connections/
    useConnections.ts             # list/active/add/delete/test + host permission
    ConnectionSwitcher.tsx
    ConnectionDialog.tsx
  editor/
    useConsoleRun.ts              # request text ↔ run via rpc ↔ response + history
    getFields.ts                   # (connId, index) → FlatField[] via cache→fetchMapping
    editorExtensions.ts            # json() + linter + autocompletion(esCompletionSource)
    QueryEditor.tsx                # CodeMirror editor + Run/Save/Format toolbar
    ResponseView.tsx
  library/
    SavedQueriesPanel.tsx
    HistoryPanel.tsx
  ids.ts                           # newId() helper (crypto.randomUUID)
src/lib/autocomplete/engine.ts     # MODIFY (Task 2): parse only the JSON body sub-range
src/lib/autocomplete/engine.test.ts# MODIFY (Task 2): add whole-document integration test
```

> After Task 1 fixes the `@` alias, source imports may use `@/lib/...` and `@/console/...`. Until then (and inside `src/lib/**` which already ships), keep relative imports.

---

## Task 1: UI toolchain — `@` alias fix, Tailwind v4, mvpui, smoke test

**Files:**
- Modify: `wxt.config.ts`, `entrypoints/console/main.tsx`, `package.json` (deps)
- Create: `src/console/styles.css`, `src/console/App.tsx`

**Interfaces:**
- Produces: a working build where `@/…` resolves in both `tsc` and the WXT bundler, Tailwind v4 + mvpui render, and the console tab shows a styled mvpui `Button`.

**Deferred-risk note (from Plan 1 review):** `tsconfig.json` maps `@/*`→`./src/*` but the WXT bundler maps `@`→repo root. This task reconciles them. Until it does, do NOT use `@/` imports.

- [ ] **Step 1: Add the `@` alias + Tailwind v4 plugin to `wxt.config.ts`**

```ts
import { defineConfig } from 'wxt';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Elasticvix',
    description: 'Elasticsearch query console with field-aware autocomplete and saved queries.',
    permissions: ['storage'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    action: {},
  },
});
```

- [ ] **Step 2: Install the UI dependencies**

```bash
pnpm add @tailwindcss/vite tailwindcss @uiw/react-codemirror
pnpm add github:tungmvp/mvp-ui#main
```

**mvpui install is the main integration risk — verify it resolves the two packages.** After install, confirm both `@mvp-ui/ui` and `@mvp-ui/tokens` resolve:

```bash
node -e "require.resolve('@mvp-ui/ui'); require.resolve('@mvp-ui/tokens'); console.log('mvpui OK')"
```

If that fails (a git dependency pointing at a monorepo root may not expose the sub-packages), STOP and report it — do not guess. Fallbacks to try, in order, and report which worked:
1. Install the exact ref from the mvpui README (it may require the `#main` tag or a build step / `prepare` script to produce `dist/`).
2. Add the specific workspace packages by subpath if pnpm supports it for this repo layout.
3. Vendor the built `@mvp-ui/ui` + `@mvp-ui/tokens` (their `dist/`) into the repo and reference via `file:` — last resort; note it in the report.

- [ ] **Step 3: Create the CSS entrypoint** — `src/console/styles.css`

```css
@import "@mvp-ui/tokens/dist/index.css";
@import "tailwindcss";
```

- [ ] **Step 4: Minimal themed App that smoke-tests the whole toolchain** — `src/console/App.tsx`

```tsx
import { Button } from '@mvp-ui/ui';

export function App() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Elasticvix</h1>
      <Button>It works</Button>
    </div>
  );
}
```

- [ ] **Step 5: Mount it** — `entrypoints/console/main.tsx`

```tsx
import { createRoot } from 'react-dom/client';
import { App } from '@/console/App';
import '@/console/styles.css';

createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 6: Verify build + alias**

Run: `pnpm compile` → Expected: no errors (proves `@/` resolves for tsc).
Run: `pnpm build` → Expected: builds `.output/chrome-mv3` with no unresolved-import errors (proves `@/` resolves for the bundler and Tailwind/mvpui compile).

- [ ] **Step 7: Manual verification**

1. `chrome://extensions` → Load unpacked → `.output/chrome-mv3`.
2. Click the toolbar icon → a tab opens showing "Elasticvix" and a **styled** mvpui button (not an unstyled native button — confirms tokens + Tailwind loaded).
3. In DevTools console on that tab, run `document.documentElement.setAttribute('data-theme','dark')` → the button/background restyle to dark (confirms token theming).

- [ ] **Step 8: Commit**

```bash
git add wxt.config.ts entrypoints/console/main.tsx src/console/styles.css src/console/App.tsx package.json pnpm-lock.yaml
git commit -m "feat(ui): set up mvpui + Tailwind v4 toolchain and @ alias"
```

---

## Task 2: Autocomplete over a real request-line + body document (must-do #1)

**Files:**
- Modify: `src/lib/autocomplete/engine.ts`
- Modify: `src/lib/autocomplete/engine.test.ts`

**Interfaces:**
- Consumes: `parseRequestLine`, `resolveKeyPath`, `resolveCompletions`, `spec` (all existing).
- Produces: exported pure `docCompletions(docText: string, pos: number, fields: FlatField[]): CompletionItem[]` — computes completions for a full editor document (request line + JSON body) by parsing ONLY the body sub-range. `esCompletionSource` is rewritten to call it.

**Why:** Plan 1's review found `resolveKeyPath` runs `syntaxTree` over the whole document, but the real editor document's line 1 (`GET /x/_search`) is not JSON and corrupts the Lezer tree. This task extracts the body sub-range, parses that in isolation, and adds an integration test over a realistic document.

- [ ] **Step 1: Write the failing test** — add to `src/lib/autocomplete/engine.test.ts`

```ts
import { docCompletions } from './engine';

describe('docCompletions (whole request-line + body document)', () => {
  const fields = [{ path: 'title', type: 'text' }];

  it('suggests bool clauses when the cursor is in the body of a GET _search', () => {
    const doc = 'GET /logs-*/_search\n{ "query": { "bool": { "" } } }';
    const pos = doc.indexOf('""') + 1; // inside the empty key string
    const labels = docCompletions(doc, pos, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['must', 'should', 'filter', 'must_not']));
  });

  it('injects real field names in a field-key position (match)', () => {
    const doc = 'POST /logs-*/_search\n{ "query": { "match": { "" } } }';
    const pos = doc.indexOf('""') + 1;
    const items = docCompletions(doc, pos, fields);
    expect(items).toEqual([{ label: 'title', kind: 'field', detail: 'text' }]);
  });

  it('returns [] when the cursor is on the request line (line 1)', () => {
    const doc = 'GET /logs-*/_search\n{ }';
    expect(docCompletions(doc, 3, fields)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/lib/autocomplete/engine.test.ts` → Expected: FAIL, `docCompletions` is not exported.

- [ ] **Step 3: Implement `docCompletions` and rewrite `esCompletionSource`** in `src/lib/autocomplete/engine.ts`

Add these imports at the top (alongside the existing ones):

```ts
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
```

Add the pure function and rewrite the source (replace the existing `esCompletionSource` body):

```ts
// Compute completions for a whole editor document: line 1 is `METHOD /path`,
// the remaining lines are the JSON body. Only the body sub-range is parsed as
// JSON (line 1 is not JSON and would corrupt the syntax tree).
export function docCompletions(docText: string, pos: number, fields: FlatField[]): CompletionItem[] {
  const nl = docText.indexOf('\n');
  if (nl === -1 || pos <= nl) return []; // still on the request line (or no body)

  const firstLine = docText.slice(0, nl);
  const { endpoint } = parseRequestLine(firstLine);
  const rootRef = endpoint ? defaultSpec.endpoints[endpoint]?.bodyRef : undefined;
  if (!rootRef) return [];

  const bodyStart = nl + 1;
  const bodyText = docText.slice(bodyStart);
  const bodyState = EditorState.create({ doc: bodyText, extensions: [json()] });
  const { path, inKey } = resolveKeyPath(bodyState, pos - bodyStart);
  return resolveCompletions(defaultSpec, rootRef, path, inKey, fields);
}

const KIND_TO_CM: Record<CompletionItem['kind'], string> = {
  keyword: 'keyword',
  field: 'property',
  value: 'enum',
};

// CodeMirror completion source used by the UI. `getFields` resolves the target
// index's fields (from cache or a fresh _mapping fetch).
export function esCompletionSource(getFields: (index?: string) => Promise<FlatField[]>) {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const docText = ctx.state.doc.toString();
    const nl = docText.indexOf('\n');
    if (nl === -1 || ctx.pos <= nl) return null;

    const { index } = parseRequestLine(docText.slice(0, nl));
    const fields = await getFields(index);
    const items = docCompletions(docText, ctx.pos, fields);
    if (items.length === 0) return null;

    const word = ctx.matchBefore(/[\w.]*/);
    return {
      from: word ? word.from : ctx.pos,
      options: items.map((it) => ({ label: it.label, type: KIND_TO_CM[it.kind], detail: it.detail })),
    };
  };
}
```

Remove the now-unused `syntaxTree`-over-whole-doc path and the old line-number logic from the previous `esCompletionSource` (the old body used `ctx.state.doc.line(1)` and `resolveKeyPath(ctx.state, ctx.pos)` directly — both are replaced above). Keep `resolveCompletions`, `resolveDesc`, `step`, `CompletionItem`, and the `import { spec as defaultSpec }` intact.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/lib/autocomplete/engine.test.ts` → Expected: the 6 existing `resolveCompletions` tests + 3 new `docCompletions` tests pass.
Run: `pnpm test` → Expected: full suite green.
Run: `pnpm compile` → Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/autocomplete/engine.ts src/lib/autocomplete/engine.test.ts
git commit -m "fix(autocomplete): parse only the JSON body sub-range for completions"
```

---

## Task 3: Theme provider + 3-pane app shell

**Files:**
- Create: `src/console/theme.tsx`, `src/console/layout/ConsoleLayout.tsx`, `src/console/ids.ts`
- Modify: `src/console/App.tsx`

**Interfaces:**
- Produces: `ThemeProvider`, `useTheme(): { theme: 'light'|'dark'; toggle: () => void }`; `ConsoleLayout` (slots: `topBar`, `leftRail`, `editor`, `response`); `newId(): string`.

- [ ] **Step 1: Theme provider** — `src/console/theme.tsx`

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
type ThemeContextValue = { theme: Theme; toggle: () => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);

function initialTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

type Props = { children: ReactNode };

export function ThemeProvider({ children }: Props) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
```

- [ ] **Step 2: id helper** — `src/console/ids.ts`

```ts
export function newId(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 3: Layout shell** — `src/console/layout/ConsoleLayout.tsx`

```tsx
import type { ReactNode } from 'react';

type Props = {
  topBar: ReactNode;
  leftRail: ReactNode;
  editor: ReactNode;
  response: ReactNode;
};

export function ConsoleLayout({ topBar, leftRail, editor, response }: Props) {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2">{topBar}</header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-y-auto border-r">{leftRail}</aside>
        <main className="grid min-w-0 flex-1 grid-cols-2">
          <section className="min-w-0 overflow-hidden border-r">{editor}</section>
          <section className="min-w-0 overflow-auto">{response}</section>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire App with the provider + a placeholder layout** — `src/console/App.tsx`

```tsx
import { ThemeProvider, useTheme } from './theme';
import { ConsoleLayout } from './layout/ConsoleLayout';
import { Button } from '@mvp-ui/ui';

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button onClick={toggle} aria-label="Toggle theme">
      {theme === 'dark' ? '☀️' : '🌙'}
    </Button>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ConsoleLayout
        topBar={<><span className="font-semibold">Elasticvix</span><div className="ml-auto"><ThemeToggle /></div></>}
        leftRail={<div className="p-3 text-sm opacity-60">Saved / History (Task 7–8)</div>}
        editor={<div className="p-3 text-sm opacity-60">Editor (Task 5)</div>}
        response={<div className="p-3 text-sm opacity-60">Response (Task 6)</div>}
      />
    </ThemeProvider>
  );
}
```

- [ ] **Step 5: Verify + manual check**

Run: `pnpm compile` and `pnpm build` → no errors.
Manual: reload the unpacked extension, open the console tab → see the top bar with "Elasticvix" + theme toggle, a left rail, and two panes. Click the toggle → whole UI flips light/dark. Confirm the layout fills the viewport with no horizontal page scroll.

- [ ] **Step 6: Commit**

```bash
git add src/console/theme.tsx src/console/ids.ts src/console/layout/ConsoleLayout.tsx src/console/App.tsx
git commit -m "feat(ui): theme provider and 3-pane console layout"
```

---

## Task 4: Connection state + management UI

**Files:**
- Create: `src/console/connections/useConnections.ts`, `ConnectionSwitcher.tsx`, `ConnectionDialog.tsx`
- Modify: `src/console/App.tsx` (mount the switcher in the top bar; provide active connection via context or lifted state)

**Interfaces:**
- Consumes: `listConnections`, `saveConnection`, `deleteConnection`, `getActiveConnectionId`, `setActiveConnectionId` (storage/connections); `detectVersion` (rpc/client); `Connection`, `AuthConfig`, `EsMajor` (types); `newId`.
- Produces: `useConnections()` returning `{ connections, active, activeId, setActive, addOrUpdate, remove, test }`; `ConnectionSwitcher`; `ConnectionDialog`.

- [ ] **Step 1: `useConnections` hook** — `src/console/connections/useConnections.ts`

```ts
import { useCallback, useEffect, useState } from 'react';
import type { Connection } from '@/lib/types';
import {
  listConnections, saveConnection, deleteConnection,
  getActiveConnectionId, setActiveConnectionId,
} from '@/lib/storage/connections';
import { detectVersion } from '@/lib/rpc/client';

type TestResult = { ok: boolean; version?: string; error?: string };

export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);

  const reload = useCallback(async () => {
    const [list, id] = await Promise.all([listConnections(), getActiveConnectionId()]);
    setConnections(list);
    setActiveId(id ?? list[0]?.id);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const setActive = useCallback(async (id: string) => {
    await setActiveConnectionId(id);
    setActiveId(id);
  }, []);

  // Ensure the extension may reach the connection's origin (optional host perm).
  const ensureHostPermission = useCallback(async (baseUrl: string): Promise<boolean> => {
    try {
      const origin = new URL(baseUrl).origin + '/*';
      const has = await browser.permissions.contains({ origins: [origin] });
      if (has) return true;
      return await browser.permissions.request({ origins: [origin] });
    } catch {
      return false;
    }
  }, []);

  const addOrUpdate = useCallback(async (conn: Connection) => {
    await saveConnection(conn);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    await deleteConnection(id);
    await reload();
  }, [reload]);

  const test = useCallback(async (conn: Connection): Promise<TestResult> => {
    const granted = await ensureHostPermission(conn.baseUrl);
    if (!granted) return { ok: false, error: 'Host permission denied' };
    const res = await detectVersion(conn);
    if (res.error) return { ok: false, error: res.error };
    return { ok: true, version: res.version };
  }, [ensureHostPermission]);

  const active = connections.find((c) => c.id === activeId);
  return { connections, active, activeId, setActive, addOrUpdate, remove, test, ensureHostPermission };
}
```

- [ ] **Step 2: Connection dialog** — `src/console/connections/ConnectionDialog.tsx`

Renders an add/edit form in an mvpui `Modal`/`Dialog`. Fields: name, baseUrl, auth-type `Select` (`none`/`basic`/`apiKey`/`bearer`) with conditional inputs, a **Test** button showing the result, and **Save**. **Verify each mvpui component's real props against `@mvp-ui/ui` and adjust** (the shapes below are the intended structure).

```tsx
import { useState } from 'react';
import { Modal, Button, Input, Label, Select } from '@mvp-ui/ui';
import type { AuthConfig, Connection } from '@/lib/types';
import { newId } from '@/console/ids';

type Props = {
  isOpen: boolean;
  initial?: Connection;
  onClose: () => void;
  onSave: (conn: Connection) => void;
  onTest: (conn: Connection) => Promise<{ ok: boolean; version?: string; error?: string }>;
};

const AUTH_TYPES = ['none', 'basic', 'apiKey', 'bearer'] as const;

export function ConnectionDialog({ isOpen, initial, onClose, onSave, onTest }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? 'http://localhost:9200');
  const [authType, setAuthType] = useState<AuthConfig['type']>(initial?.auth.type ?? 'none');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secret, setSecret] = useState(''); // apiKey or bearer token
  const [testMsg, setTestMsg] = useState<string>('');

  const buildAuth = (): AuthConfig => {
    if (authType === 'basic') return { type: 'basic', username, password };
    if (authType === 'apiKey') return { type: 'apiKey', apiKey: secret };
    if (authType === 'bearer') return { type: 'bearer', token: secret };
    return { type: 'none' };
  };

  const buildConn = (): Connection => {
    const now = Date.now();
    return {
      id: initial?.id ?? newId(),
      name: name.trim() || baseUrl,
      baseUrl: baseUrl.replace(/\/$/, ''),
      auth: buildAuth(),
      version: initial?.version,
      major: initial?.major,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
  };

  const handleTest = async () => {
    setTestMsg('Testing…');
    const r = await onTest(buildConn());
    setTestMsg(r.ok ? `OK — Elasticsearch ${r.version ?? '?'}` : `Failed — ${r.error}`);
  };

  if (!isOpen) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? 'Edit connection' : 'Add connection'}>
      <div className="flex flex-col gap-3 p-1">
        <div><Label htmlFor="c-name">Name</Label><Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label htmlFor="c-url">Base URL</Label><Input id="c-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://host:9200" /></div>
        <div>
          <Label htmlFor="c-auth">Auth</Label>
          <Select id="c-auth" value={authType} onChange={(v: AuthConfig['type']) => setAuthType(v)}>
            {AUTH_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
        {authType === 'basic' && (
          <>
            <div><Label htmlFor="c-user">Username</Label><Input id="c-user" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
            <div><Label htmlFor="c-pass">Password</Label><Input id="c-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          </>
        )}
        {(authType === 'apiKey' || authType === 'bearer') && (
          <div><Label htmlFor="c-secret">{authType === 'apiKey' ? 'API key' : 'Token'}</Label><Input id="c-secret" value={secret} onChange={(e) => setSecret(e.target.value)} /></div>
        )}
        {testMsg && <p className="text-sm opacity-80">{testMsg}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Button onClick={handleTest}>Test</Button>
          <Button onClick={() => { onSave(buildConn()); onClose(); }}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 3: Connection switcher** — `src/console/connections/ConnectionSwitcher.tsx`

A dropdown showing the active connection with a status dot + version, options to switch, and an "Add connection" action opening `ConnectionDialog`. Use mvpui `Dropdown` + `Badge` (verify props). It receives the `useConnections()` result via props from `App` (lift the hook to `App` so the editor can read the active connection too).

```tsx
import { useState } from 'react';
import { Dropdown, Button, Badge } from '@mvp-ui/ui';
import type { Connection } from '@/lib/types';
import { ConnectionDialog } from './ConnectionDialog';

type Props = {
  connections: Connection[];
  active?: Connection;
  onSelect: (id: string) => void;
  onSave: (conn: Connection) => void;
  onTest: (conn: Connection) => Promise<{ ok: boolean; version?: string; error?: string }>;
};

export function ConnectionSwitcher({ connections, active, onSelect, onSave, onTest }: Props) {
  const [isDialogOpen, setDialogOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Dropdown
        trigger={
          <Button>
            {active ? active.name : 'No connection'}
            {active?.version && <Badge className="ml-2">{active.version}</Badge>}
          </Button>
        }
      >
        {connections.map((c) => (
          <button key={c.id} className="block w-full px-3 py-1.5 text-left hover:bg-black/5" onClick={() => onSelect(c.id)}>
            {c.name}
          </button>
        ))}
        <button className="block w-full px-3 py-1.5 text-left hover:bg-black/5" onClick={() => setDialogOpen(true)}>+ Add connection</button>
      </Dropdown>
      <ConnectionDialog isOpen={isDialogOpen} onClose={() => setDialogOpen(false)} onSave={onSave} onTest={onTest} />
    </div>
  );
}
```

- [ ] **Step 4: Lift `useConnections` into `App` and mount the switcher** in the top bar (pass `connections/active/onSelect/onSave/onTest`). Keep the theme toggle. Expose `active` to the editor section (Task 5 will consume it).

- [ ] **Step 5: Verify + manual check**

Run: `pnpm compile`, `pnpm build` → no errors.
Manual (against real ES): open console → Add connection → enter your ES 6.5 URL + auth → **Test**: the browser prompts for host permission; grant it; expect "OK — Elasticsearch 6.5.x". Save → the switcher shows the name + version badge. Add a second cluster and switch between them. Reload the tab → connections persist (chrome.storage).

- [ ] **Step 6: Commit**

```bash
git add src/console/connections/ src/console/App.tsx
git commit -m "feat(ui): connection management (add/test/switch) with host permission"
```

---

## Task 5: Query editor (CodeMirror) with autocomplete, Run, Format

**Files:**
- Create: `src/console/editor/getFields.ts`, `editorExtensions.ts`, `useConsoleRun.ts`, `QueryEditor.tsx`
- Modify: `src/console/App.tsx` (render `QueryEditor` in the editor slot; hold response state)

**Interfaces:**
- Consumes: `esRequest`, `fetchMapping` (rpc/client); `getCachedFields`, `setCachedFields` (storage/mappingCache); `esCompletionSource` (engine); `parseRequestLine` (autocomplete/requestLine); `addHistory` (storage/history); `Connection`, `FlatField`, `EsResult`, `HistoryEntry` (types); `newId`.
- Produces: `getFields(connectionId, index?)`; `buildEditorExtensions(getFields)`; `useConsoleRun(active)` → `{ text, setText, run, isRunning, response, format }`; `QueryEditor`.

- [ ] **Step 1: `getFields` (cache → fetchMapping)** — `src/console/editor/getFields.ts`

```ts
import type { FlatField } from '@/lib/types';
import { getCachedFields, setCachedFields } from '@/lib/storage/mappingCache';
import { fetchMapping } from '@/lib/rpc/client';
import type { Connection } from '@/lib/types';

// Returns the flattened fields for the request's target index, cached with TTL.
export function makeGetFields(connection: Connection | undefined) {
  return async (index?: string): Promise<FlatField[]> => {
    if (!connection || !index || index.includes('*')) return []; // no single concrete index → skip
    const cached = await getCachedFields(connection.id, index);
    if (cached) return cached;
    const res = await fetchMapping(connection, index);
    if (res.error) return [];
    await setCachedFields(connection.id, index, res.fields);
    return res.fields;
  };
}
```

- [ ] **Step 2: Editor extensions** — `src/console/editor/editorExtensions.ts`

```ts
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter } from '@codemirror/lint';
import { autocompletion } from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import type { FlatField } from '@/lib/types';
import { esCompletionSource } from '@/lib/autocomplete/engine';

export function buildEditorExtensions(getFields: (index?: string) => Promise<FlatField[]>): Extension[] {
  return [
    json(),
    // Lint the JSON body but never block editing/running (warnings only).
    linter(jsonParseLinter()),
    autocompletion({ override: [esCompletionSource(getFields)] }),
  ];
}
```

- [ ] **Step 3: Run hook** — `src/console/editor/useConsoleRun.ts`

```ts
import { useCallback, useState } from 'react';
import type { Connection, HistoryEntry } from '@/lib/types';
import type { EsResult } from '@/lib/rpc/messages';
import { esRequest } from '@/lib/rpc/client';
import { parseRequestLine } from '@/lib/autocomplete/requestLine';
import { addHistory } from '@/lib/storage/history';
import { newId } from '@/console/ids';

const DEFAULT_TEXT = 'GET /_search\n{\n  "query": {\n    "match_all": {}\n  }\n}';

function splitRequest(text: string): { method: string; path: string; body?: string } {
  const nl = text.indexOf('\n');
  const firstLine = nl === -1 ? text : text.slice(0, nl);
  const { method, path } = parseRequestLine(firstLine);
  const body = nl === -1 ? '' : text.slice(nl + 1).trim();
  return { method, path, body: body || undefined };
}

export function useConsoleRun(active: Connection | undefined) {
  const [text, setText] = useState<string>(DEFAULT_TEXT);
  const [response, setResponse] = useState<EsResult | undefined>(undefined);
  const [isRunning, setRunning] = useState(false);

  const run = useCallback(async () => {
    if (!active) { setResponse({ status: 0, took: 0, body: null, error: 'No active connection' }); return; }
    const { method, path, body } = splitRequest(text);
    setRunning(true);
    try {
      const result = await esRequest(active, method, path, body);
      setResponse(result);
      const entry: HistoryEntry = {
        id: newId(), method, path, body: body ?? '', connectionId: active.id,
        status: result.status, took: result.took, ranAt: Date.now(),
      };
      await addHistory(entry);
    } finally {
      setRunning(false);
    }
  }, [active, text]);

  const format = useCallback(() => {
    const nl = text.indexOf('\n');
    if (nl === -1) return;
    const head = text.slice(0, nl);
    const body = text.slice(nl + 1).trim();
    try {
      setText(`${head}\n${JSON.stringify(JSON.parse(body), null, 2)}`);
    } catch {
      /* leave invalid JSON as-is */
    }
  }, [text]);

  return { text, setText, run, isRunning, response, format };
}
```

- [ ] **Step 4: The editor component** — `src/console/editor/QueryEditor.tsx`

```tsx
import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { keymap } from '@codemirror/view';
import { Button } from '@mvp-ui/ui';
import type { Connection } from '@/lib/types';
import type { EsResult } from '@/lib/rpc/messages';
import { useTheme } from '@/console/theme';
import { makeGetFields } from './getFields';
import { buildEditorExtensions } from './editorExtensions';
import { useConsoleRun } from './useConsoleRun';

type Props = {
  active: Connection | undefined;
  onResponse: (r: EsResult | undefined) => void;
  onSaveRequest: (text: string) => void; // opens the Save dialog (Task 7)
};

export function QueryEditor({ active, onResponse, onSaveRequest }: Props) {
  const { theme } = useTheme();
  const { text, setText, run, isRunning, response, format } = useConsoleRun(active);

  // Push responses up to the parent (which renders ResponseView).
  useMemo(() => onResponse(response), [response, onResponse]);

  const extensions = useMemo(() => {
    const getFields = makeGetFields(active);
    return [
      ...buildEditorExtensions(getFields),
      keymap.of([{ key: 'Mod-Enter', run: () => { void run(); return true; } }]),
    ];
  }, [active, run]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-2 py-1">
        <Button onClick={() => void run()} disabled={isRunning}>{isRunning ? 'Running…' : 'Run ⌘↵'}</Button>
        <Button onClick={() => onSaveRequest(text)}>Save</Button>
        <Button onClick={format}>Format</Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <CodeMirror
          value={text}
          onChange={setText}
          extensions={extensions}
          theme={theme === 'dark' ? 'dark' : 'light'}
          height="100%"
        />
      </div>
    </div>
  );
}
```

> Note on `useMemo(() => onResponse(response), …)`: calling a parent setter during render can warn. If React flags it, move it to a `useEffect(() => onResponse(response), [response])` instead — pick whichever your React 19 setup accepts without warnings during manual testing.

- [ ] **Step 5: Wire into `App`** — hold `const [response, setResponse] = useState<EsResult>()` in `App`, pass `active` + `setResponse` to `QueryEditor`, and pass `response` to the (Task 6) `ResponseView`. Wire `onSaveRequest` to open the Task 7 dialog (stub it for now: `() => {}`).

- [ ] **Step 6: Verify + manual check**

Run: `pnpm compile`, `pnpm build` → no errors.
Manual (real ES): with an active connection, type `GET /<your-index>/_search` then a body; in the body type inside `"query": { }` → the autocomplete dropdown offers `bool/match/term/range/...`; inside `match: { }` it offers your index's real field names. Press **⌘/Ctrl+Enter** → the response appears (Task 6 renders it; for now confirm no error in console and that a network call to ES happened via the background worker). **Format** prettifies the body.

- [ ] **Step 7: Commit**

```bash
git add src/console/editor/ src/console/App.tsx
git commit -m "feat(ui): CodeMirror query editor with field-aware autocomplete, run, format"
```

---

## Task 6: Response viewer

**Files:**
- Create: `src/console/editor/ResponseView.tsx`
- Modify: `src/console/App.tsx` (render it in the response slot)

**Interfaces:**
- Consumes: `EsResult` (types).
- Produces: `ResponseView`.

- [ ] **Step 1: Component** — `src/console/editor/ResponseView.tsx`

```tsx
import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { Button, Badge } from '@mvp-ui/ui';
import type { EsResult } from '@/lib/rpc/messages';
import { useTheme } from '@/console/theme';

type Props = { response: EsResult | undefined };

function statusTone(status: number): string {
  if (status === 0) return 'bg-red-500';         // transport error
  if (status >= 200 && status < 300) return 'bg-green-500';
  return 'bg-amber-500';                          // ES-level error (4xx/5xx)
}

export function ResponseView({ response }: Props) {
  const { theme } = useTheme();
  const pretty = useMemo(() => {
    if (!response) return '';
    if (response.error && response.status === 0) return `// Transport error\n${response.error}`;
    try { return JSON.stringify(response.body, null, 2); } catch { return String(response.body); }
  }, [response]);

  if (!response) return <div className="p-3 text-sm opacity-60">Run a request to see the response.</div>;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-2 py-1 text-sm">
        <span className={`inline-block h-2 w-2 rounded-full ${statusTone(response.status)}`} />
        <span>{response.status === 0 ? 'ERR' : response.status}</span>
        <span className="opacity-60">· {response.took} ms</span>
        <Button className="ml-auto" onClick={() => void navigator.clipboard.writeText(pretty)}>Copy</Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <CodeMirror
          value={pretty}
          editable={false}
          extensions={[json(), EditorView.lineWrapping]}
          theme={theme === 'dark' ? 'dark' : 'light'}
          height="100%"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render in `App`** — response slot renders `<ResponseView response={response} />`.

- [ ] **Step 3: Verify + manual check**

Run: `pnpm compile`, `pnpm build` → no errors.
Manual: run a successful `_search` → green dot, `200 · N ms`, pretty JSON, **Copy** works. Point at a wrong port → red dot + "Transport error". Send a malformed query (e.g. bad field) → amber dot + the ES error JSON with its status. Confirm transport vs ES errors are visually distinct.

- [ ] **Step 4: Commit**

```bash
git add src/console/editor/ResponseView.tsx src/console/App.tsx
git commit -m "feat(ui): response viewer with status/took and transport-vs-ES error display"
```

---

## Task 7: Saved queries panel (name + tags + search)

**Files:**
- Create: `src/console/library/SavedQueriesPanel.tsx`, `src/console/library/SaveQueryDialog.tsx`
- Modify: `src/console/App.tsx` (left rail tab "Saved"; wire the editor's Save button + load-into-editor)

**Interfaces:**
- Consumes: `putSavedQuery`, `deleteSavedQuery`, `listSavedQueries`, `searchSavedQueries` (storage/savedQueries); `SavedQuery` (types); `parseRequestLine`; `newId`.
- Produces: `SaveQueryDialog` (name + tags → `putSavedQuery`); `SavedQueriesPanel` (search box + tag chips + list; clicking loads the query into the editor).

- [ ] **Step 1: Save dialog** — `src/console/library/SaveQueryDialog.tsx`

```tsx
import { useState } from 'react';
import { Modal, Button, Input, Label } from '@mvp-ui/ui';
import type { SavedQuery } from '@/lib/types';
import { parseRequestLine } from '@/lib/autocomplete/requestLine';
import { newId } from '@/console/ids';

type Props = {
  isOpen: boolean;
  requestText: string;        // full editor text (request line + body)
  connectionId?: string;
  onClose: () => void;
  onSaved: (q: SavedQuery) => void;
};

export function SaveQueryDialog({ isOpen, requestText, connectionId, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [tagsText, setTagsText] = useState('');

  const handleSave = async () => {
    const nl = requestText.indexOf('\n');
    const firstLine = nl === -1 ? requestText : requestText.slice(0, nl);
    const { method, path } = parseRequestLine(firstLine);
    const body = nl === -1 ? '' : requestText.slice(nl + 1);
    const now = Date.now();
    const q: SavedQuery = {
      id: newId(),
      name: name.trim() || `${method} ${path}`,
      tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      method, path, body, connectionId, createdAt: now, updatedAt: now,
    };
    const { putSavedQuery } = await import('@/lib/storage/savedQueries');
    await putSavedQuery(q);
    onSaved(q);
    onClose();
  };

  if (!isOpen) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Save query">
      <div className="flex flex-col gap-3 p-1">
        <div><Label htmlFor="q-name">Name</Label><Input id="q-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label htmlFor="q-tags">Tags (comma-separated)</Label><Input id="q-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="prod, slow" /></div>
        <div className="mt-2 flex justify-end"><Button onClick={handleSave}>Save</Button></div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Panel** — `src/console/library/SavedQueriesPanel.tsx`

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Input, Tag, Button } from '@mvp-ui/ui';
import type { SavedQuery } from '@/lib/types';
import { listSavedQueries, searchSavedQueries, deleteSavedQuery } from '@/lib/storage/savedQueries';

type Props = {
  reloadKey: number;                       // bump to force a reload after a save
  onLoad: (q: SavedQuery) => void;         // load into editor
};

export function SavedQueriesPanel({ reloadKey, onLoad }: Props) {
  const [all, setAll] = useState<SavedQuery[]>([]);
  const [text, setText] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const reload = useCallback(async () => setAll(await listSavedQueries()), []);
  useEffect(() => { void reload(); }, [reload, reloadKey]);

  const [results, setResults] = useState<SavedQuery[]>([]);
  useEffect(() => { void searchSavedQueries({ text, tags: activeTags }).then(setResults); }, [text, activeTags, all]);

  const allTags = useMemo(() => Array.from(new Set(all.flatMap((q) => q.tags))).sort(), [all]);
  const toggleTag = (t: string) => setActiveTags((cur) => cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]);

  return (
    <div className="flex flex-col gap-2 p-2">
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search saved…" />
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allTags.map((t) => (
            <button key={t} onClick={() => toggleTag(t)}>
              <Tag className={activeTags.includes(t) ? 'ring-2' : ''}>#{t}</Tag>
            </button>
          ))}
        </div>
      )}
      <ul className="flex flex-col">
        {results.map((q) => (
          <li key={q.id} className="group flex items-center gap-1">
            <button className="flex-1 truncate px-1 py-1 text-left text-sm hover:bg-black/5" onClick={() => onLoad(q)} title={`${q.method} ${q.path}`}>
              {q.name}
            </button>
            <Button className="opacity-0 group-hover:opacity-100" onClick={() => void deleteSavedQuery(q.id).then(reload)}>✕</Button>
          </li>
        ))}
        {results.length === 0 && <li className="px-1 py-2 text-sm opacity-50">No saved queries</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Wire in `App`** — the editor's Save button opens `SaveQueryDialog` with the current editor text + active connection id; on save, bump a `savedReloadKey`. The left rail shows a "Saved" tab hosting `SavedQueriesPanel`; `onLoad(q)` sets the editor text to `` `${q.method} ${q.path}\n${q.body}` `` (add a `setText` path from `App` down to the editor — lift the editor text state into `App` or expose a ref/callback).

- [ ] **Step 4: Verify + manual check**

Run: `pnpm compile`, `pnpm build` → no errors.
Manual: write a query → **Save** with name + tags `prod, slow` → it appears in the Saved panel. Type in the search box → filters by name. Click a tag chip → filters by tag (AND). Click a saved item → it loads back into the editor exactly. Delete one → it disappears. Reload the tab → saved queries persist (IndexedDB).

- [ ] **Step 5: Commit**

```bash
git add src/console/library/SavedQueriesPanel.tsx src/console/library/SaveQueryDialog.tsx src/console/App.tsx
git commit -m "feat(ui): saved queries panel with tags and search"
```

---

## Task 8: History panel + final wiring + manual verification

**Files:**
- Create: `src/console/library/HistoryPanel.tsx`
- Modify: `src/console/App.tsx` (left rail "History" tab; refresh after each run)

**Interfaces:**
- Consumes: `listHistory` (storage/history); `HistoryEntry` (types).
- Produces: `HistoryPanel` (newest-first list; clicking loads the request into the editor).

- [ ] **Step 1: Panel** — `src/console/library/HistoryPanel.tsx`

```tsx
import { useEffect, useState } from 'react';
import type { HistoryEntry } from '@/lib/types';
import { listHistory } from '@/lib/storage/history';

type Props = {
  reloadKey: number;                          // bump after each run
  onLoad: (e: HistoryEntry) => void;
};

export function HistoryPanel({ reloadKey, onLoad }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  useEffect(() => { void listHistory().then(setEntries); }, [reloadKey]);

  return (
    <ul className="flex flex-col p-2">
      {entries.map((e) => (
        <li key={e.id}>
          <button className="flex w-full items-center gap-2 px-1 py-1 text-left text-sm hover:bg-black/5" onClick={() => onLoad(e)}>
            <span className="font-mono text-xs opacity-70">{e.method}</span>
            <span className="flex-1 truncate">{e.path}</span>
            {e.status != null && <span className="text-xs opacity-60">{e.status}</span>}
          </button>
        </li>
      ))}
      {entries.length === 0 && <li className="px-1 py-2 text-sm opacity-50">No history yet</li>}
    </ul>
  );
}
```

- [ ] **Step 2: Left-rail tabs + final wiring** in `App` — use an mvpui `Tabs` (verify props) in the left rail to switch between **Saved** and **History**. Bump a `runReloadKey` after each successful run (thread a callback from `useConsoleRun`/`QueryEditor` up to `App`) so History refreshes. `HistoryPanel.onLoad(e)` sets the editor text to `` `${e.method} ${e.path}\n${e.body}` ``.

Confirm the full data flow end-to-end: connection switch → editor autocomplete uses the active connection's mappings → run → response view + history entry → saved queries load back → theme toggle affects editor + response.

- [ ] **Step 3: Verify (build) + full manual verification checklist**

Run: `pnpm compile`, `pnpm build`, and `pnpm test` (Task 2's tests + all Plan 1 tests) → all green.

Manual verification (load unpacked; run against **ES 6.5, 7.x, and 8.x** — the user has these):
- [ ] Add + test connections for ES 6.5, 7.x, 8.x (basic auth on the secured ones); version badge shows the right major each time.
- [ ] Autocomplete: DSL keywords by context; **real field names** from the connected index's mapping (verify on 6.5 — the `_type` mapping layer — and on 7/8).
- [ ] Run `GET /idx/_search` **with a body** → returns real hits (confirms the GET→POST gateway promotion from Plan 1 works end-to-end, not match_all).
- [ ] A 401 (wrong credentials) shows an ES-error response, not a false success.
- [ ] Save a query with tags; reload tab; it persists and loads back exactly.
- [ ] History records each run newest-first and loads back.
- [ ] Light/dark toggle restyles the whole console including both editors.
- [ ] No horizontal page scroll; panes scroll internally.

- [ ] **Step 4: Commit**

```bash
git add src/console/library/HistoryPanel.tsx src/console/App.tsx
git commit -m "feat(ui): history panel and final console wiring"
```

---

## Self-Review (against the spec)

- **Spec §6 UI (3-pane, connection switcher, editor Run/Save/Format, response badge/copy, saved tags+search, dark mode):** Tasks 3–8 ✓. **Field-aware autocomplete wired to live mappings:** Task 5 (`makeGetFields` → cache/`fetchMapping`) + Task 2 (real-document parsing) ✓. **Auth 4 types + optional host permission + multi-cluster switch:** Task 4 ✓. **History cap/persistence + saved queries:** Tasks 7–8 consuming Plan 1 repos ✓. **Error handling (transport vs ES, JSON lint non-blocking, mapping-fetch failure silent):** Task 6 + Task 5 (`makeGetFields` returns `[]` on error; linter is warning-only) ✓. **Manual-test posture, ES 6.5/7/8:** Task 8 checklist ✓. **Both Plan 1 deferred must-dos:** Task 1 (`@` alias) + Task 2 (request-line offset) ✓.
- **Ambiguity flagged for the implementer:** mvpui component prop names are best-effort and MUST be verified against the installed `@mvp-ui/ui` types (Task 1 establishes the real API); the mvpui git install may need a fallback (Task 1 Step 2).
- **Deferred (not in this plan):** index/document/mapping-management UIs, multi-request scratchpad, import/export, cross-machine sync, query variables, and the actual Chrome Web Store submission (listing/screenshots/review) — all future sub-projects.

---
```
