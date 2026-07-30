# Response Viewer Upgrade — Design

**Date:** 2026-07-30
**Status:** Approved
**Feature:** Fold / Download / Filter for the response viewer.

## Goal

Invest in the **output** side of elasticvix. The last three features (field-aware
autocomplete, field-value suggestions, query linting) all improved the **input**
editor; the response viewer has had zero investment. Add three capabilities to
`ResponseView` so a large ES response becomes navigable:

1. **Fold / expand** JSON nodes.
2. **Download** the response.
3. **Filter** the response by key/value, pruning the tree to just what matters.

## Why

- A `_search` response can be thousands of lines. Without folding it is unreadable.
- The REST console has no download button today (only Copy) — you cannot save a response.
- Finding one field in a huge response means Cmd+F across the whole page. §2.5 of
  `docs/research/elasticvue-vs-elasticvix.md` flags response filtering as a gap in
  **both** elasticvix and Elasticvue — the filter is the differentiating half.

## Placement

`ResponseView` is shared by two surfaces, so all three additions land there and
benefit both automatically:

- REST console — `src/console/App.tsx:85` (`<ResponseView response={runner.response} />`).
- Search page "Raw" tab — `src/console/search/SearchPage.tsx:245`.

## Design

### 1. Fold / expand

Add three extensions to the existing read-only CodeMirror instance in `ResponseView`:

- `codeFolding()` — the fold state field + folding behaviour.
- `foldGutter()` — the click targets in the gutter.
- `keymap.of(foldKeymap)` — keyboard folding (Ctrl/Cmd-Shift-`[` / `]`).

`@codemirror/lang-json` already supplies fold ranges for objects/arrays, so no
custom fold logic is needed. All three are exported from `@codemirror/language`
(verified installed: `@codemirror/language ^6.12.4`). No new state, no new
component — verified by typecheck + screenshot.

### 2. Download

Add a **Download** button in the `ResponseView` header, next to the existing
**Copy** button. Reuse `downloadJson(data, filename)` from
`src/console/search/downloadJson.ts`; add a sibling helper
`responseDownloadName(now: Date): string` → `elasticvix-response-<stamp>.json`
(same stamp format as `searchDownloadName`).

**WYSIWYG rule:** Copy and Download both act on the **currently displayed** text.
With no filter that is the full body; with a filter active it is the pruned result.
This makes both buttons unambiguous — to save the full response, clear the filter.

### 3. Filter (prune by key/value)

A text input in the `ResponseView` header. A pure function drives it:

```ts
// src/console/editor/filterResponse.ts
export function filterResponse(body: unknown, query: string): unknown;
```

Semantics (query compared case-insensitively; `q` = `query.trim().toLowerCase()`):

- **Empty query** (`q === ''`): return `body` unchanged.
- **Leaf** (string / number / boolean / null): keep iff `String(value).toLowerCase()`
  contains `q`. A kept leaf is returned as-is.
- **Object**: for each `[key, value]` entry —
  - if `key.toLowerCase()` contains `q` → keep the **entire** `value` subtree unpruned
    (matching the key means the user wants its whole contents);
  - else recurse into `value`; if the recursion keeps anything, keep `key` with the
    pruned value.
  - The object is kept iff ≥1 entry is kept.
- **Array**: recurse each element; keep elements whose recursion keeps anything
  (pruned). The array compacts (non-matching elements dropped). Kept iff ≥1 element kept.
- **Root keeps nothing**: `filterResponse` returns a sentinel (`undefined`) so the
  caller can render a "No matching paths" state instead of empty JSON.

The function is pure, synchronous, no IO — fits the repo convention (extract pure
logic, unit-test it; the React wrapper is thin and verified by typecheck + screenshot).

### Rendering states in `ResponseView`

- Compute `filtered = filterResponse(response.body, query)`.
- Displayed text = `query` empty ? full pretty body : `JSON.stringify(filtered, null, 2)`.
- If `query` non-empty **and** `filtered === undefined` → show "No matching paths".
- **Hide the filter input and the derived text path when the body is not filterable**:
  a transport error (`response.status === 0`) renders a `// Transport error` string,
  not a JSON object — no tree to prune, so no filter input in that case. Copy/Download
  still operate on the error text.

## File Structure

- **Create** `src/console/editor/filterResponse.ts` — `filterResponse(body, query)` (pure).
- **Create** `src/console/editor/filterResponse.test.ts` — unit tests.
- **Modify** `src/console/editor/ResponseView.tsx` — fold extensions, filter state
  (`useState('')`), Download button, "No matching paths" state, filter input.
- **Modify** `src/console/search/downloadJson.ts` — add `responseDownloadName(now)`.

`ResponseView.tsx` grows from ~60 lines but stays well under the 800-line ceiling.

## Testing

Unit tests for `filterResponse`:

- empty query returns the body unchanged (reference-equal is fine);
- leaf value match (string contains, case-insensitive);
- numeric leaf match (`3000` matched by `"3000"`, and `String(number)` contains);
- object key match keeps the whole subtree unpruned;
- object value match keeps only the matching entry with its path;
- nested object path preserved to root;
- array compaction keeps only matching elements;
- no match at root returns `undefined`;
- boolean / null leaves handled without throwing.

Visible parts (fold gutter, Download button, filter input, "No matching paths")
verified via `screenshot-ui-review` against the demo ES on port **9201** — never
9200 (that is the live viec.co production cluster).

## Non-goals

- Dot-path extraction (the rejected alternative) — the prune-by-match semantics won.
- Highlight/jump-to-match (CodeMirror's built-in search already covers Cmd+F).
- Touching the Search page tab-bar Download button. The Search "Raw" tab will show
  both the tab-bar Download (full body) and the ResponseView Download (WYSIWYG);
  harmless and left as-is to keep the change surgical.
