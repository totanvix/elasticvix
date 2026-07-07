# VixElastic Query Console — Plan 1: Core & Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the headless, fully-tested core of the VixElastic Chrome extension: the domain logic (auth, version, mapping flattening, autocomplete engine), local storage (connections, saved queries, history, mapping cache), and the background service-worker RPC gateway that talks to Elasticsearch.

**Architecture:** A WXT (Manifest V3) extension. All network access lives in the **background service worker**, exposed to the UI as a small typed RPC layer (`esRequest`, `detectVersion`, `fetchMapping`). Pure domain logic is isolated in `src/lib/**` as framework-free functions so it can be unit-tested with Vitest. Storage is split: connections + settings in `chrome.storage.local`, and saved queries / history / mapping cache in IndexedDB (via `idb`).

**Tech Stack:** WXT + Vite, React 19 (UI comes in Plan 2), TypeScript strict, pnpm, CodeMirror 6 (`@codemirror/*`), `idb`, Vitest + `fake-indexeddb`, WXT's `fakeBrowser` test double.

## Global Constraints

- **Package manager:** `pnpm` only. **TypeScript strict mode** on.
- **Extension:** Chrome **Manifest V3**, built with **WXT**. Background service worker is the **only** place that calls the network.
- **Permissions:** declared `permissions: ["storage"]`. Hosts are **optional** (`optional_host_permissions`), requested at runtime — **never** declare required host permissions and **never** `<all_urls>` as a required permission.
- **ES version support:** test carefully on **6.x (incl. 6.5), 7.x, 8.x**; **9.x best-effort**. Detect version on connect; adapt 6.x differences (mapping `_type` layer; doc CRUD path may carry a type).
- **Auth types:** `none`, `basic`, `apiKey`, `bearer`.
- **Storage split:** connections + `activeConnectionId` + settings → `chrome.storage.local`; saved queries, history, mapping cache → IndexedDB.
- **Privacy:** everything stays local. **No telemetry, no remote code, no external network calls** except to the user's own ES clusters.
- **History cap:** keep the newest **500** entries; prune older.
- **Editor model:** one request per editor (single `METHOD /path` + JSON body).
- All async storage/RPC functions return `Promise`. All data is treated **immutably** (return new objects; never mutate inputs).

---

## File Structure

```
wxt.config.ts                       # WXT config: manifest, react module
vitest.config.ts                    # Vitest + WxtVitest (fakeBrowser)
package.json / tsconfig.json
entrypoints/
  background.ts                     # registers RPC handler; opens console tab on icon click
  console/
    index.html                     # stub in Plan 1 (real UI in Plan 2)
    main.tsx                        # stub root
src/lib/
  types.ts                         # shared domain types
  es/
    auth.ts                        # buildAuthHeaders(auth)
    version.ts                     # parseMajor(version)
    paths.ts                       # docPath(opts)
    mapping.ts                     # flattenMapping / flattenProperties
  autocomplete/
    spec.json                      # curated ES DSL spec
    spec.ts                        # SpecData types + load + validateSpec
    requestLine.ts                 # parseRequestLine(line)
    keyPath.ts                     # resolveKeyPath(state, pos)
    engine.ts                      # resolveCompletions(...) + esCompletionSource(...)
  storage/
    connections.ts                 # chrome.storage.local connection CRUD + active id
    db.ts                          # IndexedDB schema (idb)
    savedQueries.ts                # saved-query repo (tags + search)
    history.ts                     # history repo (append + cap + list)
    mappingCache.ts                # cached FlatField[] per (connection,index) with TTL
  rpc/
    messages.ts                    # RPC request/response message types
    handlers.ts                    # background-side handleRpc(msg)
    client.ts                      # UI-side esRequest/detectVersion/fetchMapping
tests/ … (colocated as *.test.ts next to each module)
```

---

## Task 1: Scaffold the WXT + React + Vitest project

**Files:**
- Create: `package.json`, `wxt.config.ts`, `tsconfig.json`, `vitest.config.ts`, `entrypoints/background.ts`, `entrypoints/console/index.html`, `entrypoints/console/main.tsx`

**Interfaces:**
- Produces: a buildable extension + a runnable Vitest setup that later tasks depend on.

- [ ] **Step 1: Initialize the project and install dependencies**

Run in the project root (`/Users/totanvix/Documents/vix/coding/VixElastic`):

```bash
pnpm init
pnpm add -D wxt @wxt-dev/module-react typescript vitest @vitest/coverage-v8 \
  fake-indexeddb jsdom @types/react @types/react-dom @types/chrome
pnpm add react react-dom idb \
  @codemirror/state @codemirror/view @codemirror/language @codemirror/lang-json \
  @codemirror/autocomplete @codemirror/lint @codemirror/commands @lezer/common
```

> mvpui + Tailwind v4 are installed in **Plan 2** (UI). Plan 1 is headless.

- [ ] **Step 2: Write `wxt.config.ts`**

```ts
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'VixElastic',
    description: 'Elasticsearch query console with field-aware autocomplete and saved queries.',
    permissions: ['storage'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    action: {}, // no default_popup: icon click opens a full-page tab (background handles it)
  },
});
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['fake-indexeddb/auto'],
    coverage: { provider: 'v8', include: ['src/lib/**'] },
  },
});
```

- [ ] **Step 5: Write minimal entrypoints**

`entrypoints/background.ts`:

```ts
export default defineBackground(() => {
  // Icon click opens the console in a full-page tab.
  browser.action.onClicked.addListener(() => {
    browser.tabs.create({ url: browser.runtime.getURL('/console.html') });
  });
});
```

`entrypoints/console/index.html`:

```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>VixElastic</title></head>
  <body><div id="root"></div><script type="module" src="./main.tsx"></script></body>
</html>
```

`entrypoints/console/main.tsx`:

```tsx
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')!).render(<div>VixElastic console (UI in Plan 2)</div>);
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "test": "vitest run",
    "test:watch": "vitest",
    "compile": "tsc --noEmit"
  }
}
```

- [ ] **Step 6: Verify build + test harness run**

Run: `pnpm build` → Expected: builds `.output/chrome-mv3` with no errors.
Run: `pnpm test` → Expected: "No test files found" (exit 0) — the runner works.

- [ ] **Step 7: Commit**

```bash
printf 'node_modules/\ndist/\n.output/\n.wxt/\n*.local\n.env\n.DS_Store\n' > .gitignore
git add -A
git commit -m "chore: scaffold WXT + React + Vitest project"
```

---

## Task 2: Shared domain types

**Files:**
- Create: `src/lib/types.ts`

**Interfaces:**
- Produces: `AuthConfig`, `EsMajor`, `Connection`, `SavedQuery`, `HistoryEntry`, `FlatField` — consumed by nearly every later task.

- [ ] **Step 1: Write `src/lib/types.ts`** (no test needed — type-only module)

```ts
export type AuthConfig =
  | { type: 'none' }
  | { type: 'basic'; username: string; password: string }
  | { type: 'apiKey'; apiKey: string }
  | { type: 'bearer'; token: string };

export type EsMajor = 6 | 7 | 8 | 9;

export interface Connection {
  id: string;
  name: string;
  baseUrl: string; // e.g. https://host:9200 (no trailing slash)
  auth: AuthConfig;
  version?: string;
  major?: EsMajor;
  createdAt: number;
  updatedAt: number;
}

export interface SavedQuery {
  id: string;
  name: string;
  tags: string[];
  method: string;
  path: string;
  body: string;
  connectionId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEntry {
  id: string;
  method: string;
  path: string;
  body: string;
  connectionId: string;
  status?: number;
  took?: number;
  ranAt: number;
}

export interface FlatField {
  path: string; // dotted, e.g. "user.address.city"
  type: string; // keyword/text/date/long/...
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm compile` → Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add shared domain types"
```

---

## Task 3: Auth header builder

**Files:**
- Create: `src/lib/es/auth.ts`, `src/lib/es/auth.test.ts`

**Interfaces:**
- Consumes: `AuthConfig` from `types.ts`.
- Produces: `buildAuthHeaders(auth: AuthConfig): Record<string, string>`.

- [ ] **Step 1: Write the failing test** — `src/lib/es/auth.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { buildAuthHeaders } from './auth';

describe('buildAuthHeaders', () => {
  it('returns no header for none', () => {
    expect(buildAuthHeaders({ type: 'none' })).toEqual({});
  });
  it('encodes basic auth as base64', () => {
    expect(buildAuthHeaders({ type: 'basic', username: 'elastic', password: 'pw' }))
      .toEqual({ Authorization: 'Basic ' + btoa('elastic:pw') });
  });
  it('formats an API key header', () => {
    expect(buildAuthHeaders({ type: 'apiKey', apiKey: 'abc123' }))
      .toEqual({ Authorization: 'ApiKey abc123' });
  });
  it('formats a bearer header', () => {
    expect(buildAuthHeaders({ type: 'bearer', token: 'tok' }))
      .toEqual({ Authorization: 'Bearer tok' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/es/auth.test.ts` → Expected: FAIL, "Cannot find module './auth'".

- [ ] **Step 3: Write `src/lib/es/auth.ts`**

```ts
import type { AuthConfig } from '../types';

export function buildAuthHeaders(auth: AuthConfig): Record<string, string> {
  switch (auth.type) {
    case 'none':
      return {};
    case 'basic':
      return { Authorization: 'Basic ' + btoa(`${auth.username}:${auth.password}`) };
    case 'apiKey':
      return { Authorization: `ApiKey ${auth.apiKey}` };
    case 'bearer':
      return { Authorization: `Bearer ${auth.token}` };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/lib/es/auth.test.ts` → Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/es/auth.ts src/lib/es/auth.test.ts
git commit -m "feat: add auth header builder"
```

---

## Task 4: Version parsing + version-aware doc path

**Files:**
- Create: `src/lib/es/version.ts`, `src/lib/es/version.test.ts`, `src/lib/es/paths.ts`, `src/lib/es/paths.test.ts`

**Interfaces:**
- Consumes: `EsMajor` from `types.ts`.
- Produces: `parseMajor(version: string): EsMajor | undefined`; `docPath(opts: { index: string; id?: string; type?: string; major?: EsMajor }): string`.

- [ ] **Step 1: Write the failing tests**

`src/lib/es/version.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseMajor } from './version';

describe('parseMajor', () => {
  it.each([
    ['6.5.4', 6], ['7.17.0', 7], ['8.13.1', 8], ['9.0.0', 9],
  ])('maps %s to major %i', (v, major) => {
    expect(parseMajor(v)).toBe(major);
  });
  it('returns undefined for unsupported or garbage versions', () => {
    expect(parseMajor('5.6.0')).toBeUndefined();
    expect(parseMajor('nonsense')).toBeUndefined();
  });
});
```

`src/lib/es/paths.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { docPath } from './paths';

describe('docPath', () => {
  it('uses _doc for 7+', () => {
    expect(docPath({ index: 'logs', id: '1', major: 8 })).toBe('/logs/_doc/1');
  });
  it('uses the type segment for 6.x when a type is given', () => {
    expect(docPath({ index: 'logs', id: '1', type: 'doc', major: 6 })).toBe('/logs/doc/1');
  });
  it('falls back to _doc for 6.x when no type is given', () => {
    expect(docPath({ index: 'logs', id: '1', major: 6 })).toBe('/logs/_doc/1');
  });
  it('omits the id when not provided', () => {
    expect(docPath({ index: 'logs', major: 8 })).toBe('/logs/_doc');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test src/lib/es/version.test.ts src/lib/es/paths.test.ts` → Expected: FAIL, modules not found.

- [ ] **Step 3: Write implementations**

`src/lib/es/version.ts`:

```ts
import type { EsMajor } from '../types';

export function parseMajor(version: string): EsMajor | undefined {
  const m = /^(\d+)\./.exec(version.trim());
  if (!m) return undefined;
  const major = Number(m[1]);
  return major === 6 || major === 7 || major === 8 || major === 9 ? major : undefined;
}
```

`src/lib/es/paths.ts`:

```ts
import type { EsMajor } from '../types';

export function docPath(opts: { index: string; id?: string; type?: string; major?: EsMajor }): string {
  const segment = opts.major === 6 && opts.type ? opts.type : '_doc';
  const base = `/${opts.index}/${segment}`;
  return opts.id ? `${base}/${opts.id}` : base;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm test src/lib/es/version.test.ts src/lib/es/paths.test.ts` → Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/es/version.ts src/lib/es/version.test.ts src/lib/es/paths.ts src/lib/es/paths.test.ts
git commit -m "feat: add version parsing and version-aware doc path"
```

---

## Task 5: Mapping flattener (ES 6 + 7/8/9 shapes)

**Files:**
- Create: `src/lib/es/mapping.ts`, `src/lib/es/mapping.test.ts`

**Interfaces:**
- Consumes: `FlatField` from `types.ts`.
- Produces: `flattenMapping(mappingsForIndex: unknown): FlatField[]` — input is the value of `response[index].mappings`.

- [ ] **Step 1: Write the failing test** — `src/lib/es/mapping.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { flattenMapping } from './mapping';

describe('flattenMapping', () => {
  it('flattens ES7+ properties with nested objects and multi-fields', () => {
    const mappings = {
      properties: {
        title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
        user: { properties: { name: { type: 'keyword' }, age: { type: 'long' } } },
      },
    };
    expect(flattenMapping(mappings)).toEqual([
      { path: 'title', type: 'text' },
      { path: 'title.keyword', type: 'keyword' },
      { path: 'user.name', type: 'keyword' },
      { path: 'user.age', type: 'long' },
    ]);
  });

  it('flattens the ES6 mapping shape that has a type layer', () => {
    const mappings = { doc: { properties: { message: { type: 'text' } } } };
    expect(flattenMapping(mappings)).toEqual([{ path: 'message', type: 'text' }]);
  });

  it('returns [] for an empty mapping', () => {
    expect(flattenMapping({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/es/mapping.test.ts` → Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/lib/es/mapping.ts`**

```ts
import type { FlatField } from '../types';

interface MappingNode {
  type?: string;
  properties?: Record<string, MappingNode>;
  fields?: Record<string, MappingNode>;
}

export function flattenProperties(
  properties: Record<string, MappingNode> | undefined,
  prefix = '',
): FlatField[] {
  if (!properties) return [];
  const out: FlatField[] = [];
  for (const [name, node] of Object.entries(properties)) {
    const path = prefix ? `${prefix}.${name}` : name;
    if (node.properties) {
      out.push(...flattenProperties(node.properties, path));
    } else {
      out.push({ path, type: node.type ?? 'object' });
      if (node.fields) {
        for (const [sub, subNode] of Object.entries(node.fields)) {
          out.push({ path: `${path}.${sub}`, type: subNode.type ?? 'keyword' });
        }
      }
    }
  }
  return out;
}

export function flattenMapping(mappingsForIndex: unknown): FlatField[] {
  const m = mappingsForIndex as { properties?: Record<string, MappingNode> } & Record<string, any>;
  if (m && m.properties) return flattenProperties(m.properties); // ES7+
  const out: FlatField[] = []; // ES6: iterate the (usually single) type
  for (const key of Object.keys(m ?? {})) {
    const node = m[key];
    if (node && typeof node === 'object' && node.properties) {
      out.push(...flattenProperties(node.properties));
    }
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/lib/es/mapping.test.ts` → Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/es/mapping.ts src/lib/es/mapping.test.ts
git commit -m "feat: add version-aware mapping flattener"
```

---

## Task 6: Curated autocomplete spec + validator

**Files:**
- Create: `src/lib/autocomplete/spec.json`, `src/lib/autocomplete/spec.ts`, `src/lib/autocomplete/spec.test.ts`

**Interfaces:**
- Produces: types `ValueDesc`, `BodyNode`, `EndpointSpec`, `SpecData`; `spec: SpecData` (loaded); `validateSpec(spec: SpecData): string[]` (empty array = valid).
- Descriptor grammar: `"#ref"` = another body node · `"[#ref]"`/`"[@field]"` = array of that · `"@field"` = an ES field name · `"@any"` = arbitrary user-chosen key · `"enum:a,b"` = fixed values · `"int"`/`"string"`/`"any"` = leaf value.

- [ ] **Step 1: Write `src/lib/autocomplete/spec.json`**

```json
{
  "endpoints": {
    "_search": { "methods": ["GET", "POST"], "bodyRef": "queryBody" },
    "_count":  { "methods": ["GET", "POST"], "bodyRef": "queryBody" },
    "_mapping": { "methods": ["GET"] },
    "_doc": { "methods": ["GET", "POST", "PUT", "DELETE"] },
    "_bulk": { "methods": ["POST", "PUT"] }
  },
  "bodies": {
    "queryBody": {
      "query": "#query", "size": "int", "from": "int",
      "sort": "[#sortItem]", "_source": "any", "aggs": "#aggs"
    },
    "query": {
      "bool": "#bool", "match": "#matchQ", "match_phrase": "#matchQ",
      "term": "#termQ", "terms": "#termsQ", "range": "#rangeQ",
      "exists": "#existsQ", "match_all": {}
    },
    "bool": {
      "must": "[#query]", "should": "[#query]", "filter": "[#query]",
      "must_not": "[#query]", "minimum_should_match": "any"
    },
    "matchQ": { "@field": "#matchOpts" },
    "matchOpts": { "query": "any", "operator": "enum:or,and", "fuzziness": "any" },
    "termQ": { "@field": "any" },
    "termsQ": { "@field": "any" },
    "rangeQ": { "@field": "#rangeOpts" },
    "rangeOpts": { "gte": "any", "lte": "any", "gt": "any", "lt": "any", "format": "string", "boost": "int" },
    "existsQ": { "field": "@field" },
    "sortItem": { "@field": "#sortOpts" },
    "sortOpts": { "order": "enum:asc,desc", "mode": "enum:min,max,sum,avg,median" },
    "aggs": { "@any": "#aggBody" },
    "aggBody": { "terms": "#aggTerms", "avg": "#aggFieldOnly", "sum": "#aggFieldOnly", "max": "#aggFieldOnly", "min": "#aggFieldOnly" },
    "aggTerms": { "field": "@field", "size": "int" },
    "aggFieldOnly": { "field": "@field" }
  }
}
```

- [ ] **Step 2: Write the failing test** — `src/lib/autocomplete/spec.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { spec, validateSpec } from './spec';

describe('curated spec', () => {
  it('every endpoint bodyRef and every #ref resolves', () => {
    expect(validateSpec(spec)).toEqual([]);
  });
  it('reports a dangling reference', () => {
    const broken = { endpoints: {}, bodies: { a: { x: '#missing' } } };
    expect(validateSpec(broken as any)).toContain('a.x -> #missing');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test src/lib/autocomplete/spec.test.ts` → Expected: FAIL, module not found.

- [ ] **Step 4: Write `src/lib/autocomplete/spec.ts`**

```ts
import raw from './spec.json';

export type ValueDesc = string | BodyNode;
export interface BodyNode { [key: string]: ValueDesc }
export interface EndpointSpec { methods: string[]; bodyRef?: string }
export interface SpecData {
  endpoints: Record<string, EndpointSpec>;
  bodies: Record<string, BodyNode>;
}

export const spec: SpecData = raw as SpecData;

function refName(desc: string): string | undefined {
  if (desc.startsWith('[') && desc.endsWith(']')) desc = desc.slice(1, -1);
  if (desc.startsWith('#')) return desc.slice(1);
  return undefined;
}

export function validateSpec(s: SpecData): string[] {
  const errors: string[] = [];
  for (const [name, ep] of Object.entries(s.endpoints)) {
    if (ep.bodyRef && !s.bodies[ep.bodyRef]) errors.push(`endpoint ${name} -> #${ep.bodyRef}`);
  }
  const walk = (node: BodyNode, trail: string) => {
    for (const [key, desc] of Object.entries(node)) {
      if (typeof desc === 'object') { walk(desc, `${trail}.${key}`); continue; }
      const ref = refName(desc);
      if (ref && !s.bodies[ref]) errors.push(`${trail}.${key} -> #${ref}`);
    }
  };
  for (const [name, node] of Object.entries(s.bodies)) walk(node, name);
  return errors;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm test src/lib/autocomplete/spec.test.ts` → Expected: 2 passing.
(If the first test fails with a dangling ref, fix `spec.json` — the validator is doing its job.)

Add to `tsconfig.json` compilerOptions if not present: `"resolveJsonModule": true`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/autocomplete/spec.json src/lib/autocomplete/spec.ts src/lib/autocomplete/spec.test.ts tsconfig.json
git commit -m "feat: add curated ES DSL spec with validator"
```

---

## Task 7: Request-line parser

**Files:**
- Create: `src/lib/autocomplete/requestLine.ts`, `src/lib/autocomplete/requestLine.test.ts`

**Interfaces:**
- Produces: `parseRequestLine(line: string): { method: string; path: string; index?: string; endpoint?: string }`.

- [ ] **Step 1: Write the failing test** — `src/lib/autocomplete/requestLine.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parseRequestLine } from './requestLine';

describe('parseRequestLine', () => {
  it('parses method, index and endpoint', () => {
    expect(parseRequestLine('GET /logs-*/_search')).toEqual({
      method: 'GET', path: '/logs-*/_search', index: 'logs-*', endpoint: '_search',
    });
  });
  it('handles a pure endpoint with no index', () => {
    expect(parseRequestLine('GET /_cat/indices')).toEqual({
      method: 'GET', path: '/_cat/indices', index: undefined, endpoint: '_cat/indices',
    });
  });
  it('defaults the method to GET when omitted', () => {
    expect(parseRequestLine('/my-index/_doc/1').method).toBe('GET');
  });
  it('lowercases nothing but uppercases the method', () => {
    expect(parseRequestLine('post /x/_search').method).toBe('POST');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/autocomplete/requestLine.test.ts` → Expected: FAIL.

- [ ] **Step 3: Write `src/lib/autocomplete/requestLine.ts`**

```ts
export function parseRequestLine(
  line: string,
): { method: string; path: string; index?: string; endpoint?: string } {
  const trimmed = line.trim();
  const space = trimmed.indexOf(' ');
  let method = 'GET';
  let path = trimmed;
  if (space !== -1) {
    method = trimmed.slice(0, space).toUpperCase();
    path = trimmed.slice(space + 1).trim();
  }
  const clean = (path.split('?')[0] ?? '').replace(/^\//, '');
  const segs = clean.split('/').filter(Boolean);
  let index: string | undefined;
  let endpoint: string | undefined;
  for (const seg of segs) {
    if (seg.startsWith('_')) endpoint = endpoint ? `${endpoint}/${seg}` : seg;
    else if (!index && !endpoint) index = seg;
  }
  return { method, path: path.startsWith('/') ? path : `/${path}`, index, endpoint };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/lib/autocomplete/requestLine.test.ts` → Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/autocomplete/requestLine.ts src/lib/autocomplete/requestLine.test.ts
git commit -m "feat: add request-line parser"
```

---

## Task 8: JSON key-path resolver (CodeMirror / Lezer)

**Files:**
- Create: `src/lib/autocomplete/keyPath.ts`, `src/lib/autocomplete/keyPath.test.ts`

**Interfaces:**
- Consumes: CodeMirror `EditorState` + `json()` language.
- Produces: `resolveKeyPath(state: EditorState, pos: number): { path: string[]; inKey: boolean }`. `path` is the chain of object keys / array indices from the JSON root to the cursor; `inKey` is `true` when the cursor is at a position where an **object key** is expected (suggest keys), `false` when a **value** is expected (suggest field names / enum values).

> **Implementation note for the engineer:** the exact Lezer node names come from `@lezer/json` (`Object`, `Property`, `PropertyName`, `Array`, plus `⚠` error nodes for incomplete input). If a test fails, log the tree with `syntaxTree(state).cursor().iterate(n => console.log(n.name, n.from, n.to))` and adjust the name checks — do **not** weaken the tests.

- [ ] **Step 1: Write the failing test** — `src/lib/autocomplete/keyPath.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { resolveKeyPath } from './keyPath';

function stateAt(text: string): { state: EditorState; pos: number } {
  const pos = text.indexOf('|');
  const doc = text.replace('|', '');
  return { state: EditorState.create({ doc, extensions: [json()] }), pos };
}

describe('resolveKeyPath', () => {
  it('detects a top-level key position', () => {
    const { state, pos } = stateAt('{ "|" }');
    expect(resolveKeyPath(state, pos)).toEqual({ path: [], inKey: true });
  });
  it('detects a nested key position inside query.bool', () => {
    const { state, pos } = stateAt('{ "query": { "bool": { "|" } } }');
    const r = resolveKeyPath(state, pos);
    expect(r.path).toEqual(['query', 'bool']);
    expect(r.inKey).toBe(true);
  });
  it('detects a value position after a key', () => {
    const { state, pos } = stateAt('{ "query": { "exists": { "field": "|" } } }');
    const r = resolveKeyPath(state, pos);
    expect(r.path).toEqual(['query', 'exists', 'field']);
    expect(r.inKey).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/autocomplete/keyPath.test.ts` → Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/lib/autocomplete/keyPath.ts`**

```ts
import { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';

function unquote(s: string): string {
  return s.replace(/^"/, '').replace(/"$/, '');
}

export function resolveKeyPath(
  state: EditorState,
  pos: number,
): { path: string[]; inKey: boolean } {
  const tree = syntaxTree(state);
  const inner: SyntaxNode = tree.resolveInner(pos, -1);
  const path: string[] = [];

  // Value position when the cursor is inside a Property's value (after the ':').
  let inKey = true;
  for (let n: SyntaxNode | null = inner; n; n = n.parent) {
    if (n.name === 'Property') {
      const nameNode = n.getChild('PropertyName');
      // If the cursor is past the property name, we're in the value → not a key.
      if (nameNode && pos > nameNode.to) inKey = false;
      break;
    }
    if (n.name === 'Object' || n.name === 'JsonText') break;
  }

  // Build the path from enclosing Property names (outermost last → reverse at end).
  for (let n: SyntaxNode | null = inner; n; n = n.parent) {
    if (n.name === 'Property') {
      const nameNode = n.getChild('PropertyName');
      if (nameNode) path.unshift(unquote(state.sliceDoc(nameNode.from, nameNode.to)));
    }
    if (n.name === 'Array') {
      // Count value children that end before the cursor → array index.
      let idx = 0;
      for (let c = n.firstChild; c; c = c.nextSibling) {
        if (c.name === '[' || c.name === ']' || c.name === ',') continue;
        if (c.to <= pos) idx++;
        else break;
      }
      path.unshift(String(Math.max(0, idx - (inKey ? 0 : 0))));
    }
  }

  // When we are typing the key itself, that partial key is NOT part of the path.
  if (inKey && inner.name === 'PropertyName') path.pop();

  return { path, inKey };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/lib/autocomplete/keyPath.test.ts` → Expected: 3 passing.
If a case fails, log the tree as described in the implementation note and adjust node-name handling until all three pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/autocomplete/keyPath.ts src/lib/autocomplete/keyPath.test.ts
git commit -m "feat: add JSON key-path resolver"
```

---

## Task 9: Autocomplete engine (completion resolution + CodeMirror source)

**Files:**
- Create: `src/lib/autocomplete/engine.ts`, `src/lib/autocomplete/engine.test.ts`

**Interfaces:**
- Consumes: `SpecData`, `spec`, `BodyNode`, `ValueDesc` (Task 6); `FlatField` (Task 2); `resolveKeyPath` (Task 8); `parseRequestLine` (Task 7).
- Produces:
  - `interface CompletionItem { label: string; kind: 'keyword' | 'field' | 'value'; detail?: string }`
  - `resolveCompletions(spec: SpecData, rootRef: string, path: string[], inKey: boolean, fields: FlatField[]): CompletionItem[]` — the pure core.
  - `esCompletionSource(getFields: (index?: string) => Promise<FlatField[]>): (ctx) => Promise<CompletionResult | null>` — the CodeMirror source used by the UI in Plan 2.

- [ ] **Step 1: Write the failing test** — `src/lib/autocomplete/engine.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { spec } from './spec';
import { resolveCompletions } from './engine';
import type { FlatField } from '../types';

const fields: FlatField[] = [
  { path: 'title', type: 'text' },
  { path: 'user.name', type: 'keyword' },
];

describe('resolveCompletions', () => {
  it('suggests top-level body keys at the root', () => {
    const labels = resolveCompletions(spec, 'queryBody', [], true, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['query', 'size', 'from', 'sort', 'aggs']));
  });
  it('suggests bool clauses under query.bool', () => {
    const labels = resolveCompletions(spec, 'queryBody', ['query', 'bool'], true, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['must', 'should', 'filter', 'must_not']));
  });
  it('injects field names where a field key is expected (match)', () => {
    const items = resolveCompletions(spec, 'queryBody', ['query', 'match'], true, fields);
    expect(items).toEqual([
      { label: 'title', kind: 'field', detail: 'text' },
      { label: 'user.name', kind: 'field', detail: 'keyword' },
    ]);
  });
  it('injects field names in a value position (exists.field)', () => {
    const items = resolveCompletions(spec, 'queryBody', ['query', 'exists', 'field'], false, fields);
    expect(items.map((c) => c.label)).toEqual(['title', 'user.name']);
  });
  it('resolves through arrays (bool.must[0] -> query clauses)', () => {
    const labels = resolveCompletions(spec, 'queryBody', ['query', 'bool', 'must', '0'], true, fields).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['match', 'term', 'range', 'bool']));
  });
  it('offers enum values in a value position (sort order)', () => {
    const items = resolveCompletions(spec, 'queryBody', ['sort', '0', 'anyField', 'order'], false, fields);
    expect(items.map((c) => c.label)).toEqual(['asc', 'desc']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/autocomplete/engine.test.ts` → Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/lib/autocomplete/engine.ts`**

```ts
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { FlatField } from '../types';
import { spec as defaultSpec, type SpecData, type BodyNode, type ValueDesc } from './spec';
import { resolveKeyPath } from './keyPath';
import { parseRequestLine } from './requestLine';

export interface CompletionItem {
  label: string;
  kind: 'keyword' | 'field' | 'value';
  detail?: string;
}

type Resolved =
  | { kind: 'object'; node: BodyNode }
  | { kind: 'array'; elem: string }
  | { kind: 'field' }
  | { kind: 'any' }
  | { kind: 'enum'; values: string[] }
  | { kind: 'leaf' };

function resolveDesc(spec: SpecData, desc: ValueDesc): Resolved {
  if (desc && typeof desc === 'object') return { kind: 'object', node: desc };
  const s = String(desc);
  if (s.startsWith('[') && s.endsWith(']')) return { kind: 'array', elem: s.slice(1, -1) };
  if (s.startsWith('#')) {
    const node = spec.bodies[s.slice(1)];
    return node ? { kind: 'object', node } : { kind: 'leaf' };
  }
  if (s === '@field') return { kind: 'field' };
  if (s === '@any') return { kind: 'any' };
  if (s.startsWith('enum:')) return { kind: 'enum', values: s.slice(5).split(',') };
  return { kind: 'leaf' };
}

function step(spec: SpecData, current: Resolved, key: string): Resolved {
  if (current.kind === 'array') return resolveDesc(spec, current.elem);
  if (current.kind === 'object') {
    const desc = current.node[key] ?? current.node['@field'] ?? current.node['@any'];
    return desc === undefined ? { kind: 'leaf' } : resolveDesc(spec, desc);
  }
  return { kind: 'leaf' };
}

function fieldItems(fields: FlatField[]): CompletionItem[] {
  return fields.map((f) => ({ label: f.path, kind: 'field', detail: f.type }));
}

export function resolveCompletions(
  spec: SpecData,
  rootRef: string,
  path: string[],
  inKey: boolean,
  fields: FlatField[],
): CompletionItem[] {
  let current = resolveDesc(spec, `#${rootRef}`);
  for (const key of path) current = step(spec, current, key);

  if (inKey) {
    if (current.kind === 'object') {
      const items: CompletionItem[] = [];
      for (const k of Object.keys(current.node)) {
        if (k === '@field') items.push(...fieldItems(fields));
        else if (k === '@any') continue;
        else items.push({ label: k, kind: 'keyword' });
      }
      return items;
    }
    if (current.kind === 'field') return fieldItems(fields);
    return [];
  }
  if (current.kind === 'field') return fieldItems(fields);
  if (current.kind === 'enum') return current.values.map((v) => ({ label: v, kind: 'value' }));
  return [];
}

const KIND_TO_CM: Record<CompletionItem['kind'], string> = {
  keyword: 'keyword',
  field: 'property',
  value: 'enum',
};

// CodeMirror completion source used by the UI (Plan 2).
export function esCompletionSource(getFields: (index?: string) => Promise<FlatField[]>) {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const firstLine = ctx.state.doc.line(1).text;
    const cursorLine = ctx.state.doc.lineAt(ctx.pos).number;

    // Request line (line 1): endpoint/method completion is minimal here; body is the focus.
    if (cursorLine === 1) return null;

    const { endpoint, index } = parseRequestLine(firstLine);
    const ep = endpoint ? defaultSpec.endpoints[endpoint] : undefined;
    const rootRef = ep?.bodyRef;
    if (!rootRef) return null;

    const { path, inKey } = resolveKeyPath(ctx.state, ctx.pos);
    const fields = await getFields(index);
    const items = resolveCompletions(defaultSpec, rootRef, path, inKey, fields);
    if (items.length === 0) return null;

    const word = ctx.matchBefore(/[\w.]*/);
    return {
      from: word ? word.from : ctx.pos,
      options: items.map((it) => ({ label: it.label, type: KIND_TO_CM[it.kind], detail: it.detail })),
    };
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/lib/autocomplete/engine.test.ts` → Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/autocomplete/engine.ts src/lib/autocomplete/engine.test.ts
git commit -m "feat: add autocomplete engine and CodeMirror source"
```

---

## Task 10: Connections storage (chrome.storage.local)

**Files:**
- Create: `src/lib/storage/connections.ts`, `src/lib/storage/connections.test.ts`

**Interfaces:**
- Consumes: `Connection` (Task 2); WXT `browser.storage.local`; `fakeBrowser` in tests.
- Produces:
  - `listConnections(): Promise<Connection[]>`
  - `saveConnection(c: Connection): Promise<void>` (insert or replace by id)
  - `deleteConnection(id: string): Promise<void>`
  - `getActiveConnectionId(): Promise<string | undefined>`
  - `setActiveConnectionId(id: string | undefined): Promise<void>`

- [ ] **Step 1: Write the failing test** — `src/lib/storage/connections.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { listConnections, saveConnection, deleteConnection, getActiveConnectionId, setActiveConnectionId } from './connections';
import type { Connection } from '../types';

const conn = (id: string): Connection => ({
  id, name: id, baseUrl: 'http://localhost:9200', auth: { type: 'none' }, createdAt: 1, updatedAt: 1,
});

describe('connections storage', () => {
  beforeEach(() => fakeBrowser.reset());

  it('saves and lists connections', async () => {
    await saveConnection(conn('a'));
    await saveConnection(conn('b'));
    expect((await listConnections()).map((c) => c.id)).toEqual(['a', 'b']);
  });
  it('replaces a connection with the same id', async () => {
    await saveConnection(conn('a'));
    await saveConnection({ ...conn('a'), name: 'renamed' });
    const list = await listConnections();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe('renamed');
  });
  it('deletes a connection', async () => {
    await saveConnection(conn('a'));
    await deleteConnection('a');
    expect(await listConnections()).toEqual([]);
  });
  it('tracks the active connection id', async () => {
    await setActiveConnectionId('a');
    expect(await getActiveConnectionId()).toBe('a');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/storage/connections.test.ts` → Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/lib/storage/connections.ts`**

```ts
import type { Connection } from '../types';

const CONNECTIONS_KEY = 'connections';
const ACTIVE_KEY = 'activeConnectionId';

export async function listConnections(): Promise<Connection[]> {
  const res = await browser.storage.local.get(CONNECTIONS_KEY);
  return (res[CONNECTIONS_KEY] as Connection[] | undefined) ?? [];
}

export async function saveConnection(c: Connection): Promise<void> {
  const list = await listConnections();
  const idx = list.findIndex((x) => x.id === c.id);
  const next = idx === -1 ? [...list, c] : list.map((x) => (x.id === c.id ? c : x));
  await browser.storage.local.set({ [CONNECTIONS_KEY]: next });
}

export async function deleteConnection(id: string): Promise<void> {
  const next = (await listConnections()).filter((x) => x.id !== id);
  await browser.storage.local.set({ [CONNECTIONS_KEY]: next });
}

export async function getActiveConnectionId(): Promise<string | undefined> {
  const res = await browser.storage.local.get(ACTIVE_KEY);
  return res[ACTIVE_KEY] as string | undefined;
}

export async function setActiveConnectionId(id: string | undefined): Promise<void> {
  await browser.storage.local.set({ [ACTIVE_KEY]: id });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/lib/storage/connections.test.ts` → Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/connections.ts src/lib/storage/connections.test.ts
git commit -m "feat: add connections storage"
```

---

## Task 11: IndexedDB schema + saved-queries repo

**Files:**
- Create: `src/lib/storage/db.ts`, `src/lib/storage/savedQueries.ts`, `src/lib/storage/savedQueries.test.ts`

**Interfaces:**
- Consumes: `SavedQuery`, `HistoryEntry`, `FlatField` (Task 2); `idb`.
- Produces:
  - `db.ts`: `getDb(): Promise<IDBPDatabase<VixSchema>>` with object stores `savedQueries` (keyPath `id`), `history` (keyPath `id`, index `by-ranAt`), `mappingCache` (keyPath `key`).
  - `savedQueries.ts`: `putSavedQuery(q)`, `deleteSavedQuery(id)`, `listSavedQueries()`, `searchSavedQueries(opts: { text?: string; tags?: string[] }): Promise<SavedQuery[]>`.

- [ ] **Step 1: Write `src/lib/storage/db.ts`**

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SavedQuery, HistoryEntry, FlatField } from '../types';

export interface CachedMapping {
  key: string; // `${connectionId}::${index}`
  fields: FlatField[];
  fetchedAt: number;
}

export interface VixSchema extends DBSchema {
  savedQueries: { key: string; value: SavedQuery };
  history: { key: string; value: HistoryEntry; indexes: { 'by-ranAt': number } };
  mappingCache: { key: string; value: CachedMapping };
}

let dbPromise: Promise<IDBPDatabase<VixSchema>> | undefined;

export function getDb(): Promise<IDBPDatabase<VixSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<VixSchema>('vixelastic', 1, {
      upgrade(db) {
        db.createObjectStore('savedQueries', { keyPath: 'id' });
        const hist = db.createObjectStore('history', { keyPath: 'id' });
        hist.createIndex('by-ranAt', 'ranAt');
        db.createObjectStore('mappingCache', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}
```

- [ ] **Step 2: Write the failing test** — `src/lib/storage/savedQueries.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { putSavedQuery, listSavedQueries, deleteSavedQuery, searchSavedQueries } from './savedQueries';
import type { SavedQuery } from '../types';

const q = (id: string, name: string, tags: string[]): SavedQuery => ({
  id, name, tags, method: 'GET', path: '/x/_search', body: '{}', createdAt: 1, updatedAt: 1,
});

describe('saved queries repo', () => {
  beforeEach(async () => {
    for (const s of await listSavedQueries()) await deleteSavedQuery(s.id);
  });

  it('stores and lists', async () => {
    await putSavedQuery(q('1', 'prod errors', ['prod']));
    expect((await listSavedQueries()).map((x) => x.id)).toEqual(['1']);
  });
  it('filters by tag', async () => {
    await putSavedQuery(q('1', 'a', ['prod']));
    await putSavedQuery(q('2', 'b', ['dev']));
    const r = await searchSavedQueries({ tags: ['prod'] });
    expect(r.map((x) => x.id)).toEqual(['1']);
  });
  it('filters by name text (case-insensitive)', async () => {
    await putSavedQuery(q('1', 'Slow Query', []));
    await putSavedQuery(q('2', 'Fast', []));
    const r = await searchSavedQueries({ text: 'slow' });
    expect(r.map((x) => x.id)).toEqual(['1']);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test src/lib/storage/savedQueries.test.ts` → Expected: FAIL, module not found.

- [ ] **Step 4: Write `src/lib/storage/savedQueries.ts`**

```ts
import { getDb } from './db';
import type { SavedQuery } from '../types';

export async function putSavedQuery(q: SavedQuery): Promise<void> {
  await (await getDb()).put('savedQueries', q);
}

export async function deleteSavedQuery(id: string): Promise<void> {
  await (await getDb()).delete('savedQueries', id);
}

export async function listSavedQueries(): Promise<SavedQuery[]> {
  return (await getDb()).getAll('savedQueries');
}

export async function searchSavedQueries(opts: { text?: string; tags?: string[] }): Promise<SavedQuery[]> {
  const all = await listSavedQueries();
  const text = opts.text?.trim().toLowerCase();
  return all.filter((q) => {
    if (opts.tags && opts.tags.length > 0 && !opts.tags.every((t) => q.tags.includes(t))) return false;
    if (text && !q.name.toLowerCase().includes(text)) return false;
    return true;
  });
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm test src/lib/storage/savedQueries.test.ts` → Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage/db.ts src/lib/storage/savedQueries.ts src/lib/storage/savedQueries.test.ts
git commit -m "feat: add IndexedDB schema and saved-queries repo"
```

---

## Task 12: History repo (append + 500 cap)

**Files:**
- Create: `src/lib/storage/history.ts`, `src/lib/storage/history.test.ts`

**Interfaces:**
- Consumes: `getDb` (Task 11); `HistoryEntry` (Task 2).
- Produces: `addHistory(entry: HistoryEntry): Promise<void>` (prunes to newest 500 by `ranAt`); `listHistory(): Promise<HistoryEntry[]>` (newest first); `HISTORY_CAP = 500`.

- [ ] **Step 1: Write the failing test** — `src/lib/storage/history.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { addHistory, listHistory, HISTORY_CAP } from './history';
import type { HistoryEntry } from '../types';

const entry = (id: string, ranAt: number): HistoryEntry => ({
  id, method: 'GET', path: '/x/_search', body: '{}', connectionId: 'c', ranAt,
});

describe('history repo', () => {
  beforeEach(async () => {
    const { getDb } = await import('./db');
    await (await getDb()).clear('history');
  });

  it('lists newest first', async () => {
    await addHistory(entry('a', 10));
    await addHistory(entry('b', 20));
    expect((await listHistory()).map((h) => h.id)).toEqual(['b', 'a']);
  });
  it('prunes to the newest HISTORY_CAP entries', async () => {
    for (let i = 0; i < HISTORY_CAP + 5; i++) await addHistory(entry(String(i), i));
    const all = await listHistory();
    expect(all).toHaveLength(HISTORY_CAP);
    expect(all[0]!.id).toBe(String(HISTORY_CAP + 4)); // newest kept
    expect(all.some((h) => h.id === '0')).toBe(false); // oldest pruned
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/storage/history.test.ts` → Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/lib/storage/history.ts`**

```ts
import { getDb } from './db';
import type { HistoryEntry } from '../types';

export const HISTORY_CAP = 500;

export async function addHistory(entry: HistoryEntry): Promise<void> {
  const db = await getDb();
  await db.put('history', entry);
  const keys = await db.getAllKeysFromIndex('history', 'by-ranAt'); // ascending by ranAt
  const excess = keys.length - HISTORY_CAP;
  if (excess > 0) {
    const tx = db.transaction('history', 'readwrite');
    for (let i = 0; i < excess; i++) await tx.store.delete(keys[i]!);
    await tx.done;
  }
}

export async function listHistory(): Promise<HistoryEntry[]> {
  const all = await (await getDb()).getAllFromIndex('history', 'by-ranAt');
  return all.reverse(); // newest first
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/lib/storage/history.test.ts` → Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/history.ts src/lib/storage/history.test.ts
git commit -m "feat: add history repo with 500-entry cap"
```

---

## Task 13: Mapping cache repo (per connection+index, with TTL)

**Files:**
- Create: `src/lib/storage/mappingCache.ts`, `src/lib/storage/mappingCache.test.ts`

**Interfaces:**
- Consumes: `getDb`, `CachedMapping` (Task 11); `FlatField` (Task 2).
- Produces:
  - `MAPPING_TTL_MS = 5 * 60 * 1000`
  - `getCachedFields(connectionId: string, index: string, now?: number): Promise<FlatField[] | undefined>` (returns `undefined` if missing or stale)
  - `setCachedFields(connectionId: string, index: string, fields: FlatField[], now?: number): Promise<void>`

- [ ] **Step 1: Write the failing test** — `src/lib/storage/mappingCache.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getCachedFields, setCachedFields, MAPPING_TTL_MS } from './mappingCache';

describe('mapping cache', () => {
  beforeEach(async () => {
    const { getDb } = await import('./db');
    await (await getDb()).clear('mappingCache');
  });

  it('returns cached fields within TTL', async () => {
    await setCachedFields('c', 'logs', [{ path: 'a', type: 'text' }], 1000);
    expect(await getCachedFields('c', 'logs', 1000 + MAPPING_TTL_MS - 1))
      .toEqual([{ path: 'a', type: 'text' }]);
  });
  it('returns undefined when stale', async () => {
    await setCachedFields('c', 'logs', [{ path: 'a', type: 'text' }], 1000);
    expect(await getCachedFields('c', 'logs', 1000 + MAPPING_TTL_MS + 1)).toBeUndefined();
  });
  it('returns undefined when missing', async () => {
    expect(await getCachedFields('c', 'nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/storage/mappingCache.test.ts` → Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/lib/storage/mappingCache.ts`**

```ts
import { getDb } from './db';
import type { FlatField } from '../types';

export const MAPPING_TTL_MS = 5 * 60 * 1000;

function keyOf(connectionId: string, index: string): string {
  return `${connectionId}::${index}`;
}

export async function getCachedFields(
  connectionId: string,
  index: string,
  now: number = Date.now(),
): Promise<FlatField[] | undefined> {
  const row = await (await getDb()).get('mappingCache', keyOf(connectionId, index));
  if (!row) return undefined;
  if (now - row.fetchedAt > MAPPING_TTL_MS) return undefined;
  return row.fields;
}

export async function setCachedFields(
  connectionId: string,
  index: string,
  fields: FlatField[],
  now: number = Date.now(),
): Promise<void> {
  await (await getDb()).put('mappingCache', { key: keyOf(connectionId, index), fields, fetchedAt: now });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/lib/storage/mappingCache.test.ts` → Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/mappingCache.ts src/lib/storage/mappingCache.test.ts
git commit -m "feat: add mapping cache repo with TTL"
```

---

## Task 14: Background RPC gateway (messages + handlers)

**Files:**
- Create: `src/lib/rpc/messages.ts`, `src/lib/rpc/handlers.ts`, `src/lib/rpc/handlers.test.ts`
- Modify: `entrypoints/background.ts`

**Interfaces:**
- Consumes: `Connection` (Task 2); `buildAuthHeaders` (Task 3); `parseMajor` (Task 4); `flattenMapping` (Task 5).
- Produces:
  - `messages.ts`: request/response union types (`RpcRequest`, `RpcResponse`, plus `EsResult`, `VersionResult`, `MappingResult`).
  - `handlers.ts`: `handleRpc(msg: RpcRequest, deps?: HandlerDeps): Promise<RpcResponse>` where `HandlerDeps = { fetchFn?: typeof fetch }` (injectable for tests).
  - `background.ts` registers `handleRpc` on `browser.runtime.onMessage`.

- [ ] **Step 1: Write `src/lib/rpc/messages.ts`**

```ts
import type { Connection, EsMajor, FlatField } from '../types';

export interface EsResult { status: number; took: number; body: unknown; error?: string }
export interface VersionResult { version?: string; major?: EsMajor; error?: string }
export interface MappingResult { fields: FlatField[]; error?: string }

export type RpcRequest =
  | { kind: 'esRequest'; connection: Connection; method: string; path: string; body?: string }
  | { kind: 'detectVersion'; connection: Connection }
  | { kind: 'fetchMapping'; connection: Connection; index: string };

export type RpcResponse =
  | { kind: 'esRequest'; result: EsResult }
  | { kind: 'detectVersion'; result: VersionResult }
  | { kind: 'fetchMapping'; result: MappingResult };
```

- [ ] **Step 2: Write the failing test** — `src/lib/rpc/handlers.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { handleRpc } from './handlers';
import type { Connection } from '../types';

const conn: Connection = {
  id: 'c', name: 'c', baseUrl: 'http://es:9200',
  auth: { type: 'basic', username: 'u', password: 'p' }, createdAt: 1, updatedAt: 1,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('handleRpc', () => {
  it('esRequest sends auth header and returns status + parsed body', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { took: 5, hits: {} }));
    const res = await handleRpc({ kind: 'esRequest', connection: conn, method: 'GET', path: '/x/_search' }, { fetchFn });
    expect(res.kind).toBe('esRequest');
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('http://es:9200/x/_search');
    expect((init.headers as Record<string, string>).Authorization).toBe('Basic ' + btoa('u:p'));
    if (res.kind === 'esRequest') {
      expect(res.result.status).toBe(200);
      expect(res.result.body).toEqual({ took: 5, hits: {} });
    }
  });

  it('detectVersion extracts version and major from GET /', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { version: { number: '6.5.4' } }));
    const res = await handleRpc({ kind: 'detectVersion', connection: conn }, { fetchFn });
    if (res.kind === 'detectVersion') {
      expect(res.result.version).toBe('6.5.4');
      expect(res.result.major).toBe(6);
    }
  });

  it('fetchMapping flattens the mapping for the index', async () => {
    const body = { logs: { mappings: { properties: { msg: { type: 'text' } } } } };
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, body));
    const res = await handleRpc({ kind: 'fetchMapping', connection: conn, index: 'logs' }, { fetchFn });
    if (res.kind === 'fetchMapping') {
      expect(res.result.fields).toEqual([{ path: 'msg', type: 'text' }]);
    }
  });

  it('esRequest reports a transport error instead of throwing', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const res = await handleRpc({ kind: 'esRequest', connection: conn, method: 'GET', path: '/' }, { fetchFn });
    if (res.kind === 'esRequest') {
      expect(res.result.status).toBe(0);
      expect(res.result.error).toContain('Failed to fetch');
    }
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test src/lib/rpc/handlers.test.ts` → Expected: FAIL, module not found.

- [ ] **Step 4: Write `src/lib/rpc/handlers.ts`**

```ts
import type { Connection } from '../types';
import { buildAuthHeaders } from '../es/auth';
import { parseMajor } from '../es/version';
import { flattenMapping } from '../es/mapping';
import type { RpcRequest, RpcResponse, EsResult } from './messages';

export interface HandlerDeps { fetchFn?: typeof fetch }

function urlOf(conn: Connection, path: string): string {
  return conn.baseUrl.replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`);
}

async function doEs(
  conn: Connection, method: string, path: string, body: string | undefined, fetchFn: typeof fetch,
): Promise<EsResult> {
  const start = Date.now();
  try {
    const resp = await fetchFn(urlOf(conn, path), {
      method,
      headers: { 'content-type': 'application/json', ...buildAuthHeaders(conn.auth) },
      body: body && method !== 'GET' && method !== 'HEAD' ? body : undefined,
    });
    const text = await resp.text();
    let parsed: unknown = text;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* keep raw text */ }
    return { status: resp.status, took: Date.now() - start, body: parsed };
  } catch (e) {
    return { status: 0, took: Date.now() - start, body: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function handleRpc(msg: RpcRequest, deps: HandlerDeps = {}): Promise<RpcResponse> {
  const fetchFn = deps.fetchFn ?? fetch;

  if (msg.kind === 'esRequest') {
    return { kind: 'esRequest', result: await doEs(msg.connection, msg.method, msg.path, msg.body, fetchFn) };
  }

  if (msg.kind === 'detectVersion') {
    const r = await doEs(msg.connection, 'GET', '/', undefined, fetchFn);
    if (r.error || r.status === 0) return { kind: 'detectVersion', result: { error: r.error ?? 'unreachable' } };
    const version = (r.body as { version?: { number?: string } } | null)?.version?.number;
    return { kind: 'detectVersion', result: { version, major: version ? parseMajor(version) : undefined } };
  }

  // fetchMapping
  const r = await doEs(msg.connection, 'GET', `/${msg.index}/_mapping`, undefined, fetchFn);
  if (r.error || r.status >= 400) return { kind: 'fetchMapping', result: { fields: [], error: r.error ?? `status ${r.status}` } };
  const body = r.body as Record<string, { mappings?: unknown }> | null;
  const first = body ? Object.values(body)[0] : undefined;
  const fields = first?.mappings ? flattenMapping(first.mappings) : [];
  return { kind: 'fetchMapping', result: { fields } };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm test src/lib/rpc/handlers.test.ts` → Expected: 4 passing.

- [ ] **Step 6: Wire the handler into the background**

Replace `entrypoints/background.ts`:

```ts
import { handleRpc } from '@/lib/rpc/handlers';
import type { RpcRequest } from '@/lib/rpc/messages';

export default defineBackground(() => {
  browser.action.onClicked.addListener(() => {
    browser.tabs.create({ url: browser.runtime.getURL('/console.html') });
  });

  browser.runtime.onMessage.addListener((msg: RpcRequest) => {
    // Returning a Promise makes the response async; the UI awaits it.
    return handleRpc(msg);
  });
});
```

- [ ] **Step 7: Verify build + full test suite**

Run: `pnpm build` → Expected: builds cleanly.
Run: `pnpm test` → Expected: all suites pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/rpc/ entrypoints/background.ts
git commit -m "feat: add background RPC gateway for ES requests"
```

---

## Task 15: UI-side RPC client

**Files:**
- Create: `src/lib/rpc/client.ts`, `src/lib/rpc/client.test.ts`

**Interfaces:**
- Consumes: `RpcRequest`, `RpcResponse`, `EsResult`, `VersionResult`, `MappingResult` (Task 14); `Connection` (Task 2); `fakeBrowser` in tests.
- Produces:
  - `esRequest(connection, method, path, body?): Promise<EsResult>`
  - `detectVersion(connection): Promise<VersionResult>`
  - `fetchMapping(connection, index): Promise<MappingResult>`

- [ ] **Step 1: Write the failing test** — `src/lib/rpc/client.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { esRequest } from './client';
import type { Connection } from '../types';
import type { RpcRequest, RpcResponse } from './messages';

const conn: Connection = {
  id: 'c', name: 'c', baseUrl: 'http://es:9200', auth: { type: 'none' }, createdAt: 1, updatedAt: 1,
};

describe('rpc client', () => {
  beforeEach(() => fakeBrowser.reset());

  it('sends an esRequest message and unwraps the result', async () => {
    const spy = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({
      kind: 'esRequest', result: { status: 200, took: 3, body: { ok: true } },
    } satisfies RpcResponse as any);

    const result = await esRequest(conn, 'GET', '/x/_search');
    expect(result).toEqual({ status: 200, took: 3, body: { ok: true } });
    const sent = spy.mock.calls[0]![0] as RpcRequest;
    expect(sent.kind).toBe('esRequest');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/rpc/client.test.ts` → Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/lib/rpc/client.ts`**

```ts
import type { Connection } from '../types';
import type { RpcRequest, RpcResponse, EsResult, VersionResult, MappingResult } from './messages';

async function send(msg: RpcRequest): Promise<RpcResponse> {
  return (await browser.runtime.sendMessage(msg)) as RpcResponse;
}

export async function esRequest(
  connection: Connection, method: string, path: string, body?: string,
): Promise<EsResult> {
  const res = await send({ kind: 'esRequest', connection, method, path, body });
  if (res.kind !== 'esRequest') throw new Error('unexpected rpc response');
  return res.result;
}

export async function detectVersion(connection: Connection): Promise<VersionResult> {
  const res = await send({ kind: 'detectVersion', connection });
  if (res.kind !== 'detectVersion') throw new Error('unexpected rpc response');
  return res.result;
}

export async function fetchMapping(connection: Connection, index: string): Promise<MappingResult> {
  const res = await send({ kind: 'fetchMapping', connection, index });
  if (res.kind !== 'fetchMapping') throw new Error('unexpected rpc response');
  return res.result;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/lib/rpc/client.test.ts` → Expected: 1 passing.

- [ ] **Step 5: Full verification**

Run: `pnpm test` → Expected: every suite passes.
Run: `pnpm compile` → Expected: no type errors.
Run: `pnpm build` → Expected: builds `.output/chrome-mv3`.

- [ ] **Step 6: Manual smoke test (background gateway against a real cluster)**

1. `pnpm dev`, then load `.output/chrome-mv3` as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked).
2. Open the extension's background service worker console (Inspect views).
3. Grant a host at runtime, then exercise the gateway:

```js
await chrome.permissions.request({ origins: ['http://localhost:9200/*'] });
const conn = { id: 'x', name: 'x', baseUrl: 'http://localhost:9200', auth: { type: 'none' }, createdAt: 0, updatedAt: 0 };
await chrome.runtime.sendMessage({ kind: 'detectVersion', connection: conn });
```

Expected: a `{ kind: 'detectVersion', result: { version, major } }` response from your cluster.

- [ ] **Step 7: Commit**

```bash
git add src/lib/rpc/client.ts src/lib/rpc/client.test.ts
git commit -m "feat: add UI-side RPC client"
```

---

## Self-Review (completed against the spec)

- **Auth (4 types):** Task 3 ✓. **Version detect + 6.x adapt:** Tasks 4, 5, 14 ✓. **Field-aware autocomplete (spec + key-path + engine):** Tasks 6–9 ✓. **Storage split (chrome.storage + IndexedDB) with tags/search, 500-cap history, mapping TTL:** Tasks 10–13 ✓. **Background gateway + optional host perms + local-only:** Tasks 1, 14, 15 ✓ (host permission is *requested* in the UI — Plan 2 Task on connections — and only declared as optional here).
- **Type consistency:** `Connection/SavedQuery/HistoryEntry/FlatField` are defined once in Task 2 and imported everywhere; RPC message names (`esRequest/detectVersion/fetchMapping`) match between `messages.ts`, `handlers.ts`, and `client.ts`.
- **Deferred to Plan 2 (UI):** request-line autocomplete for endpoints/index names (engine returns `null` on line 1 for now), the CodeMirror editor wiring of `esCompletionSource`, and all React components.

---

## Plan 2 preview — Console UI (to be written in full after Plan 1)

Deliverable: the full-page React console wired to the Plan 1 core. Tasks (outline):

1. **UI setup** — install `github:tungmvp/mvp-ui#main` + Tailwind v4 (`@tailwindcss/vite`), import `@mvp-ui/tokens`, theme provider with light/dark via `data-theme`, real `console/main.tsx` + `App.tsx`.
2. **App shell** — 3-pane layout (left rail / editor / response) using mvpui layout components.
3. **Connection management** — list + add/edit dialog (name, baseUrl, auth type → conditional fields), **Test** button (`detectVersion`), runtime `chrome.permissions.request` for the host, switcher with status dot + version.
4. **Editor pane** — CodeMirror 6 + `@uiw/react-codemirror`, `json()` + JSON linter + `esCompletionSource(getFields)` where `getFields` reads mapping cache or calls `fetchMapping`; Run (⌘/Ctrl+Enter), Format.
5. **Response viewer** — read-only CodeMirror JSON, status/took badge, Copy; distinguishes transport vs ES errors.
6. **Saved queries panel** — Save dialog (name + tags), tag-filter chips + text search (`searchSavedQueries`), click-to-load.
7. **History panel** — newest-first list (`listHistory`), click-to-load; append on every run.
8. **Final wiring + manual verification** — checklist run against **ES 6.5, 7.x, 8.x**.

---
```
