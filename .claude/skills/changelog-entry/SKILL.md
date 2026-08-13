---
name: changelog-entry
description: Add or update an entry in the elasticvix in-app changelog (src/console/changelog/releases.ts), which users read from the "What's new" dialog. Use this whenever you finish a change an extension user would notice — a new feature, a visible UI change, or a bug fix under src/ or entrypoints/ — and before writing any feat/fix commit, even when the user never mentions the changelog. Also use when preparing a release, bumping the version, or answering what shipped in a given version.
---

# Changelog entries for elasticvix

The extension ships its own release notes. Users open them from the Settings menu → **What's new**, and the Settings gear turns accent-orange when there is an entry they have not read yet. That signal is only honest if the file is current, so the changelog is part of finishing a user-facing change — not a release-day chore.

The data lives in one place: `src/console/changelog/releases.ts`, newest release first.

```ts
export type ReleaseEntry = {
  version: string;
  date: string; // ISO 'YYYY-MM-DD'
  changes: readonly string[];
};
```

## Step 1 — Decide whether this change earns an entry

Ask one question: **would someone using the extension notice this without reading the diff?** If yes, it needs a line. If no, skip it and move on.

| Change | Entry? | Why |
|---|---|---|
| New feature in `src/` or `entrypoints/` | Yes | Visible in the product |
| Bug fix a user could have hit | Yes | They were affected; tell them it's gone |
| Visible UI change (layout, wording, controls) | Yes | They will see it |
| Website changes (`website/`) | No | Not part of the extension |
| Docs, plans, specs (`docs/`) | No | Internal |
| Tests only, refactors with identical behaviour, build config | No | Nothing to notice |
| Dependency bumps | Usually no | Unless behaviour visibly changes |

When it is genuinely borderline, prefer adding the line. A short changelog that skips things readers noticed erodes trust in it faster than one extra modest line.

## Step 2 — Find the entry to write into

The top entry is either **already released** or **still accumulating**. Tell them apart by comparing it with the shipped version:

```bash
node -p "require('./package.json').version"    # what users are running now
head -20 src/console/changelog/releases.ts      # the version of the top entry
```

- **Top entry version is ahead of `package.json`** (for example top is `1.0.8`, package.json is `1.0.7`) — that entry is unreleased and still open. Append your bullet to its `changes` array.
- **They are equal** — the top entry already shipped. Create a new entry above it: next patch version, today's date, your bullet as the first item.

This matters because `pnpm release` runs `pnpm version patch`, which creates the tag commit itself. An entry added after that lands outside the tag and ships a release later than it should. Writing the entry as part of the change keeps the two in step.

Keep the array newest-first, keep `readonly`, and never renumber or reorder existing entries — users may have read them already.

## Step 3 — Write the line for the reader, not the reviewer

The audience is a developer using the extension, not someone reviewing the commit. So describe what they can now do, in plain English, in the interface's own vocabulary — the same words the UI uses for the same things.

Rules that carry most of the quality:

- **English, sentence case, ending with a period.** All extension UI is English.
- **Lead with the capability, not the component.** "Fold JSON in the response viewer" beats "ResponseView now supports folding".
- **Name things as the UI names them.** If the button says "Backup & restore", the entry says Backup & restore.
- **Prefix fixes with `Fix:`** so a scanner can separate new capability from repair.
- **One idea per bullet.** Two unrelated things in one commit are two bullets.
- **No commit grammar, no scopes, no file paths, no issue numbers.**

Real examples from this repo:

| Commit subject | Changelog line |
|---|---|
| `feat(nav): add help icon linking to the Elasticvix website` | `Help icon in the nav opens the Elasticvix website.` |
| `fix(search): keep type column visible for long field names in mapping dialog` | `Fix: the type column stays visible for long field names in the mapping dialog.` |
| `feat(backup): export/import connections and saved queries` | `Backup & restore — export your connections and saved queries to a JSON file, and import them back on another machine.` |
| `feat(cluster): CLUSTER tab with per-node resource table` | `CLUSTER tab with a per-node table of RAM, heap, disk and CPU.` |

Where a feature needs a clause of explanation, an em dash carries it well — see the Backup line above. Use it when the plain name alone would leave the reader guessing; skip it when the name is self-evident.

## Step 4 — Check it

```bash
pnpm test src/console/changelog/changelogLib.test.ts
```

`changelogLib.test.ts` guards the data itself: no duplicate versions, entries ordered newest-first by date, every release has at least one change. If you added a version out of order or reused one, this fails.

Then `pnpm compile` for the types.

To see it as a user does, load the built extension and open Settings → What's new. Forcing the unread state is one line in the console:

```js
localStorage.setItem('elasticvix.changelog.lastSeenVersion', '0.0.1');
```

Reload and the gear turns accent-orange with a **New** label on the menu item.

## At release time

The version bump is what publishes the entry, so before `pnpm release`:

1. Confirm the top entry's version matches the version the bump will produce.
2. Refresh its `date` if it was written days earlier — it should be the day you release.
3. `pnpm compile && pnpm test`, then `pnpm release`.

`docs/store/submission-checklist.md` section E carries this same sequence for the store upload.
