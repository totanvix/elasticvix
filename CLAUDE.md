# CLAUDE.md

Elasticvix — a Chrome extension that is an Elasticsearch query console: Kibana-style REST console
with field-aware autocomplete, a Search UI, cluster overview, saved queries and history.
Published on the Chrome Web Store; the marketing site in `website/` deploys to GitHub Pages.

## Commands

```bash
pnpm dev        # WXT dev server
pnpm build      # production build to .output/chrome-mv3
pnpm test       # vitest run
pnpm compile    # tsc --noEmit
pnpm release    # pnpm version patch && git push --follow-tags
```

Run `pnpm compile && pnpm test` before calling work done. A full `pnpm test` run occasionally
times out a slow IndexedDB test under load — rerun the file alone before treating it as a failure.

## Layout

| Path | What lives there |
|---|---|
| `entrypoints/` | `background.ts` (opens the console tab, RPC gateway) and `console/` (the whole UI) |
| `src/lib/` | Pure logic and storage. Covered by the coverage report; keep testable logic here |
| `src/console/` | React UI, one folder per feature (`search/`, `editor/`, `cluster/`, `settings/`, …) |
| `website/` | Hand-written static HTML, one full page per file, no build step |
| `docs/store/` | Chrome Web Store listing copy, privacy forms, submission checklist |

Convention within a feature folder: `Component.tsx` + `use*.ts` hook + `*Lib.ts` pure helpers +
colocated `*.test.ts`. Extract logic into pure functions and test those — there is no
`@testing-library`, so components themselves are verified by screenshot, not unit test.

## Storage

Three backends, each with a settled purpose. Putting data in the wrong one causes real bugs.

- `browser.storage.local` — connections and the active connection id, via `src/lib/storage/connections.ts`.
  Keep that file the only consumer.
- IndexedDB through `idb` (`src/lib/storage/db.ts`) — saved queries, history, and derived caches.
- `localStorage` with an `elasticvix.` prefix — UI preferences only (view, theme, lint toggle, last-seen version).

## Changelog — required for user-facing changes

The extension shows its own release notes in Settings → **What's new**, backed by
`src/console/changelog/releases.ts`. Any change an extension user would notice — a feature, a
visible UI change, a bug fix under `src/` or `entrypoints/` — adds a line there **in the same
commit**. `pnpm version patch` creates the tag commit itself, so an entry written afterwards ships
a release late.

Use the **changelog-entry** skill for the details: which entry to append to versus when to open a
new version, and how to phrase the line. Website-only, docs-only, test-only and behaviour-preserving
refactors do not need an entry.

Never bypass a failing commit hook with `--no-verify`; fix what it reports.

## UI text

Everything the user reads is English — labels, dialogs, errors, changelog lines. Write for the
person using the console: name things as the interface names them, say what an action does rather
than how it is built, and keep errors specific about what happened and what to do next.

Colour carries meaning here. Destructive red (`bg-destructive`, `text-destructive`) means a failure:
a disconnected cluster, a failed request, a warning about exposing credentials. Anything that is
merely new or noteworthy uses the brand accent (`--primary`) instead, so the two never blur.
Never let colour be the only carrier of meaning — pair it with a label, an icon, or `aria-label`.
