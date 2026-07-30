# Document Edit & Delete — Design Spec

**Date:** 2026-07-30
**Status:** Approved
**Feature:** Edit and delete a single document from the Search UI (research doc §1.1)

## Goal

Turn the read-only `DocDialog` into a viewer that can also **edit** and **delete**
the document it shows, writing directly to the connected cluster. This covers the
daily dev need "fix bad data in place" without hand-writing `POST /_update` or
`DELETE` requests.

## Scope

**In scope (MVP):** single-document edit + delete, inside the existing
`DocDialog`, opened from a row in the hits table.

**Out of scope (deferred):** bulk delete via row checkboxes, create-new-document,
partial/scripted updates. These are natural follow-ups but not part of this cut.

## Non-negotiable safety context

This feature **writes and deletes real cluster data**.

- All manual/automated testing runs against the **demo cluster on port 9201**.
  **Port 9200 is the live viec.co production cluster — never touch it.**
- The seed script requires `ES_URL` and must be pointed at 9201:
  `ES_URL=http://localhost:9201 node scripts/store/seed-es.mjs`.
- After any test that deletes a demo document, re-seed before final screenshots.

## User flows

### View → Edit → Save

1. Clicking a row opens `DocDialog` in **view mode** — unchanged from today: it
   renders the full hit (`_index`/`_id`/`_score`/`_source`) as pretty JSON with a
   Copy button. View mode is not modified beyond adding action buttons.
2. **Edit** button → the dialog fetches the document **fresh** via
   `GET /{index}/{type}/{id}`, then switches to **edit mode**: a JSON editor
   pre-filled with the document's **`_source` only** (pretty-printed). `_index`
   and `_id` show read-only in the header.
3. The user edits the JSON. On every change the text is validated; invalid JSON
   disables Save and shows an inline error.
4. **Save** → `PUT /{index}/{type}/{id}?refresh=wait_for` with the edited
   `_source` as the body, plus `&if_seq_no=<n>&if_primary_term=<p>` **only when**
   the GET response carried those values.
   - `2xx` → close the dialog and trigger a search refresh so the hits table
     reflects the change. (Closing on success — same as delete — avoids
     re-rendering view mode from the now-stale `hit` prop; the refreshed table is
     the source of truth.)
   - `409` → inline error: "Document changed since you opened it — reopen and try
     again."
   - other non-2xx / transport error → surface the raw ES error text in the
     dialog.

### View → Delete → Confirm

1. View mode shows a **Delete** button (destructive styling).
2. Clicking it switches an inline confirm region **inside the dialog** (no
   separate primitive): "Delete `{index}/{id}`? This cannot be undone." with
   Cancel / Delete.
3. **Delete** → `DELETE /{index}/{type}/{id}?refresh=wait_for`.
   - `2xx` → close the dialog and trigger a search refresh.
   - non-2xx / transport error → surface the raw ES error text; stay open.

### Refresh after a mutation

`SearchPage` passes an `onChanged` callback to `DocDialog`. It re-runs the current
page via the existing `goToPage(page)` (which does **not** record history). If the
refreshed page comes back empty and `page > 1`, step back one page so the user
isn't left on a blank page after deleting the last row.

## Design decisions (load-bearing — do not "simplify" away)

### 1. Fetch fresh on Edit — prevents silent data loss, not just lost updates

`useSearch.runAt` builds the search body via `mergeFromSize`, so the user's query
can legitimately contain `"_source": ["a","b"]` or `"_source": false`. That makes
`hit._source` **routinely partial or absent**. PUTting a partial `_source` back
would **silently delete every field the query omitted**. Editing must therefore
operate on a freshly fetched full document, never on `hit._source` from the search
results. Edit is disabled if the hit lacks `_index` or `_id`; a missing/partial
`_source` is irrelevant because we refetch.

### 2. Seed the editor from `_source` only

View mode keeps rendering the full hit. Edit mode operates on `_source` alone.
Writing the full hit (with `_index`/`_id`/`_score`) into the document body would
corrupt the document.

### 3. `refresh=wait_for` on every write

ES's default `refresh_interval` is 1s. A post-mutation re-search fires well inside
that window and would return the pre-edit document, making the table look broken.
`?refresh=wait_for` on both PUT and DELETE makes the change visible to the
follow-up search. (Supported since ES 5.0.)

### 4. Document path derives the type from the hit, never version-sniffing

Path is `/{index}/{hit._type ?? '_doc'}/{id}`:
- 6.x custom-typed index → the real type from the hit.
- 7.x → `_doc`.
- 8/9.x → `_type` absent → `_doc`.

This requires adding `_type?: string` to the `Hit` interface in `hitsLib.ts`. The
`id` segment is `encodeURIComponent`-escaped (ids can contain `/`, spaces,
unicode).

### 5. Optimistic-concurrency params are conditional

Send `if_seq_no` / `if_primary_term` **only when the GET doc response returned
both**. Old 6.x (< 6.7) does not expose sequence numbers; sending the params there
is a 400 that would dead-end Save. Deriving the capability from the cluster's own
GET response avoids hardcoding a version floor.

### 6. Data streams are not special-cased

Writing directly to a data-stream backing index (`_index` starting `.ds-`) is
rejected on ES 8+. We do not build around this — we only ensure the ES error text
reaches the dialog instead of being swallowed.

## Architecture

### Pure logic — `src/console/search/docWrite.ts` (unit-tested)

The repo convention is: extract pure logic and unit-test it; React wrappers are
verified by typecheck + screenshot (no `@testing-library/react`).

```ts
export interface DocRef {
  index: string;
  type?: string;   // hit._type; undefined on 7.x+
  id: string;
}

export interface DocMeta {
  source: Record<string, unknown>;
  seqNo?: number;
  primaryTerm?: number;
}

// Build the escaped write path. type falls back to '_doc'.
//   documentPath({index:'products', id:'a/b'}) -> '/products/_doc/a%2Fb'
export function documentPath(ref: DocRef): string;

// Append refresh=wait_for and, when both are present, the concurrency guard.
//   writePath(path, {seqNo:5, primaryTerm:2})
//     -> path + '?refresh=wait_for&if_seq_no=5&if_primary_term=2'
//   writePath(path, {}) -> path + '?refresh=wait_for'
export function writePath(path: string, guard: { seqNo?: number; primaryTerm?: number }): string;

// Extract source + seq/primary from a GET /{index}/{type}/{id} response body.
// Returns undefined if the body isn't a well-formed found document.
export function extractDocMeta(getBody: unknown): DocMeta | undefined;

// Validate the editor text. ok:true only for a JSON object (not array/scalar).
export function parseEditableSource(text: string):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string };
```

### React wrapper — `src/console/search/DocDialog.tsx` (reworked)

Local state: `mode: 'view' | 'edit' | 'confirmDelete'`, `editText`, `busy`,
`error`, and the fetched `DocMeta`. New props: the active `Connection` and an
`onChanged: () => void` callback. Uses `esRequest` directly for GET/PUT/DELETE.
The editor reuses `editorExtensions.ts`; if CodeMirror fights the Radix Dialog
focus trap, a plain `<textarea>` is an acceptable MVP fallback.

### Wiring — `src/console/search/SearchPage.tsx`

Pass the active connection and an `onChanged` handler to `DocDialog`. `onChanged`
calls `goToPage(page)`, then, if the resulting hits are empty and `page > 1`,
`goToPage(page - 1)`.

### Type change — `src/console/search/hitsLib.ts`

Add `_type?: string` to `Hit`.

## Testing

- **Unit (Vitest):** `docWrite.test.ts` covers `documentPath` (type fallback + id
  escaping), `writePath` (with and without the guard), `extractDocMeta`
  (found doc, missing seq/primary, malformed body), `parseEditableSource`
  (object ok, array/scalar rejected, invalid JSON rejected).
- **Typecheck:** `pnpm compile` clean.
- **Manual / screenshot (demo ES 9201 only):** open a demo doc, edit a field, save,
  confirm the table updates; delete a doc via the confirm step; capture view/edit/
  confirm states in light and dark. Re-seed before the final capture set.

## Success criteria

1. Editing a field and saving updates the document on the cluster and the hits
   table reflects it without a manual re-run.
2. A query with a restricted `_source` still edits the **full** document (no field
   loss).
3. Delete removes the document after an explicit confirm; the table refreshes and
   never strands the user on a blank page.
4. Errors (409, permission, data-stream) surface as readable messages in the
   dialog.
5. `pnpm test` and `pnpm compile` are green.
