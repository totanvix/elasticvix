import puppeteer from 'puppeteer-core';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAW_DIR, SHOT_VIEWPORT } from './shots.mjs';

// AMENDED (controller-authorized): demo Elasticsearch runs on :9201, not :9200
// (9200 belongs to an unrelated live project and must never be touched here).
const DEMO_ES_URL = 'http://localhost:9201';

// NOTE: branded Google Chrome (stable channel, v137+) silently ignores
// --load-extension/--disable-extensions-except (Google removed the flags from
// branded builds; see the Chromium extensions PSA on removing --load-extension
// in Chrome-branded builds). The brief's path to Google Chrome.app does not
// load the extension at all on this machine's Chrome 150. "Chrome for
// Testing" is Google's official unbranded automation build that still
// supports these flags, so we install/use that instead:
//   node node_modules/.pnpm/@puppeteer+browsers@*/node_modules/@puppeteer/browsers/lib/main-cli.js \
//     install chrome@stable --path node_modules/.cache/chrome-for-testing
function firstSubdir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  if (entries.length === 0) throw new Error(`No subdirectory found under ${dir}`);
  // Alphabetical order doesn't track recency (e.g. 'mac_arm-99.x' would sort
  // before 'mac_arm-151.x'), so with more than one cached build, pick the one
  // installed most recently rather than an arbitrary one.
  const newest = entries
    .map((name) => ({ name, mtimeMs: statSync(resolve(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  return newest.name;
}

function findChromeForTesting() {
  const base = resolve('node_modules/.cache/chrome-for-testing/chrome');
  const buildDir = firstSubdir(base); // e.g. 'mac_arm-151.0.7922.34' (skips the sibling .metadata file)
  const platformDir = firstSubdir(resolve(base, buildDir)); // e.g. 'chrome-mac-arm64'
  return resolve(base, buildDir, platformDir, 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
}

const CHROME = findChromeForTesting();
const EXT = resolve('.output/chrome-mv3');
const OUT = RAW_DIR;
// Fixed profile so connections/saved queries persist across shot 1..5 runs;
// lives under node_modules/.cache so it never touches git status or gets
// wiped by a wxt build.
const PROFILE_DIR = resolve('node_modules/.cache/elasticvix-shots-profile');
const args = process.argv.slice(2);
const isFresh = args.includes('--fresh'); // start from an empty profile (no stale connections/queries/theme)
const shotArg = args.find((a) => /^\d+$/.test(a)); // '1'..'5' or blank = all

mkdirSync(OUT, { recursive: true });
if (isFresh) rmSync(PROFILE_DIR, { recursive: true, force: true });

// A previous run that crashed or was killed mid-flight (before browser.close()
// ran) can leave a stale SingletonLock in the profile dir, which then hangs
// or fails the next launch on this same profile. Clear it (and its siblings)
// before every launch — a no-op if they're not there.
for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
  rmSync(resolve(PROFILE_DIR, f), { force: true });
}

let browser;
try {
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--no-first-run',
      '--no-default-browser-check',
      `--window-size=${SHOT_VIEWPORT.width},${SHOT_VIEWPORT.height + 120}`,
      `--user-data-dir=${PROFILE_DIR}`,
    ],
    // Captured at 2x so the composed listing image stays sharp after the frame
    // scales the UI down into its card.
    defaultViewport: { ...SHOT_VIEWPORT, deviceScaleFactor: 2 },
  });

  const sw = await browser.waitForTarget((t) => t.type() === 'service_worker', { timeout: 10000 });
  const extId = new URL(sw.url()).host;
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extId}/console.html`);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(1000);

  // Two things shipped after the first screenshot set that can pop over a shot:
  // the "What's new" dialog (opens when the stored last-seen version differs
  // from the running one) and the rate/star nudge (opens after 15 runs, and
  // capturing runs queries). Pin both to a quiet state on the extension origin,
  // then reload so the app boots with them already settled.
  await page.evaluate(() => {
    const version = chrome.runtime.getManifest().version;
    localStorage.setItem('elasticvix.changelog.lastSeenVersion', version);
    localStorage.setItem(
      'elasticvix.engagement',
      JSON.stringify({ runs: 0, status: 'dismissed', snoozedAtRuns: 0 }),
    );
  });
  await page.reload();
  await sleep(800);

  async function save(name) {
    await page.screenshot({ type: 'png', path: `${OUT}/${name}` });
    console.log(`saved ${OUT}/${name}`);
  }

  // Connections/saved-queries load asynchronously from chrome.storage via the
  // service worker (slower to settle on a profile that already has data + a
  // cold service worker than on a fresh one). A one-shot check right after
  // page load can race that hydration and report "doesn't exist" for
  // something that's actually there a moment later — which then creates a
  // duplicate. Poll instead of trusting a single fixed sleep.
  async function eventuallyBodyIncludes(text, timeoutMs = 3000, intervalMs = 200) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = await page.evaluate((t) => document.body.innerText.includes(t), text);
      if (found || Date.now() >= deadline) return found;
      await sleep(intervalMs);
    }
  }

  // Puppeteer's ::-p-text() is ALWAYS a substring match, quoted or not (quotes
  // only let the argument contain spaces/special chars — see
  // PSelectorParser.js's `unquote`). That means unquoted-style text clicking
  // would match 'Save' against the 'Saved' tab label too. Drive clicks off the
  // DOM directly instead, matching a <button>'s exact trimmed text.
  async function clickButton(text) {
    await page.waitForFunction(
      (t) => Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.trim() === t),
      {},
      text,
    );
    await page.evaluate((t) => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === t);
      btn?.click();
    }, text);
    await sleep(300);
  }

  // Generic "scoped exact-text button click" for content that Radix portals to
  // the end of <body> (dialogs, popovers) — querying the whole document by text
  // would also match same-labelled buttons elsewhere on the page (e.g. the
  // header's cluster-selector trigger showing the same connection name as the
  // row inside its own now-open popover).
  async function clickScopedButton(scopeSelector, text) {
    await page.waitForFunction(
      (s, t) => Array.from(document.querySelectorAll(`${s} button`)).some((b) => b.textContent?.trim() === t),
      {},
      scopeSelector,
      text,
    );
    await page.evaluate(
      (s, t) => {
        const btn = Array.from(document.querySelectorAll(`${s} button`)).find((b) => b.textContent?.trim() === t);
        btn?.click();
      },
      scopeSelector,
      text,
    );
    await sleep(300);
  }

  const clickDialogButton = (text) => clickScopedButton('[data-slot="dialog-content"]', text);
  const clickPopoverButton = (text) => clickScopedButton('[data-slot="popover-content"]', text);

  // The cluster selector trigger lives in TopNav's `.ml-3` wrapper and is always
  // rendered (regardless of Search/REST view), showing the active connection
  // name (or "No connection").
  async function openClusterSelector() {
    await page.locator('header div.ml-3 button').click();
    await sleep(300);
  }

  async function ensureConnection(name, url) {
    // The header trigger only shows the *active* connection's name, and the
    // rest of the list only exists in the DOM while the (Radix) popover is
    // open — so checking document.body.innerText for a non-active connection
    // always reports "missing" and creates a duplicate every run. Open the
    // popover first so the full list is actually rendered, then check it.
    await openClusterSelector();
    const exists = await page.evaluate(
      (n) =>
        Array.from(document.querySelectorAll('[data-slot="popover-content"] button')).some(
          (b) => b.textContent?.trim() === n,
        ),
      name,
    );
    if (exists) {
      await page.keyboard.press('Escape');
      await sleep(300);
      return;
    }
    await clickPopoverButton('Add connection');
    await page.locator('#c-name').fill(name);
    await page.locator('#c-url').fill(url);
    await clickDialogButton('Save');
    await sleep(1500); // health check + indices load
  }

  async function switchToConnection(name) {
    const isActive = await page.evaluate(
      (n) => document.querySelector('header div.ml-3 button')?.textContent?.includes(n) ?? false,
      name,
    );
    if (isActive) return;
    await openClusterSelector();
    await clickPopoverButton(name);
    await sleep(800);
  }

  // TopNav renders literal 'SEARCH' / 'REST' labels (see NAV_ITEMS in TopNav.tsx),
  // not 'Search'.
  async function goToView(label) {
    const isActive = await page.evaluate(
      (l) =>
        Array.from(document.querySelectorAll('nav button')).some(
          (b) => b.textContent?.trim() === l && b.className.includes('border-primary'),
        ),
      label,
    );
    if (isActive) return;
    await clickButton(label);
    await sleep(400);
  }

  // Type compact single-line JSON, then let the app's own Format action
  // pretty-print it. Typing pretty JSON directly does not work: CodeMirror's
  // auto-close-brackets indents and closes on Enter, so literal closing braces
  // in the typed text land as stray duplicate `}` lines. `aria-label` differs
  // per view — 'Format' in the REST console, 'Format JSON' in Search.
  async function setEditorBody(text, { format = true } = {}) {
    await page.locator('.cm-content').click();
    await page.keyboard.down('Meta');
    await page.keyboard.press('a');
    await page.keyboard.up('Meta');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(text, { delay: 5 });
    await sleep(300);
    // Typing can auto-trigger the completion popup (activateOnTyping); dismiss
    // it so it doesn't linger over the query text in the screenshot. Callers
    // that specifically want the popup open (shot 2) re-summon it afterwards.
    await page.keyboard.press('Escape');
    await sleep(200);
    if (format) await formatEditor();
  }

  // REST console Run button. Its label carries the shortcut ('Run ⌘↵'), so match
  // by prefix. Sending the shortcut itself does not work here: CodeMirror's
  // default keymap binds Mod-Enter to insertBlankLine and wins over the app's
  // own Mod-Enter run binding, so the keypress just adds an empty line.
  async function clickRun() {
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.trim().startsWith('Run'),
      );
      btn?.click();
    });
    await sleep(1800);
  }

  async function formatEditor() {
    await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="Format"], [aria-label="Format JSON"]');
      btn?.click();
    });
    await sleep(400);
  }

  // IndicesSelect is a checkbox popover (not a plain button), and its trigger
  // label changes with selection state, so drive it structurally: open the
  // popover (Button has `w-72` from IndicesSelect.tsx), then reconcile checked
  // state against the desired single selection.
  //
  // Clicks must be sequential with a render-settling delay in between: the
  // parent's onChange closes over the current `selected` array, so firing two
  // checkbox clicks back-to-back without letting React re-render in between
  // makes the second click's closure clobber the first click's update (both
  // read the same stale `selected`), leaving the wrong set of indices checked.
  async function selectOnlyIndex(name) {
    await page.locator('button.w-72').click();
    await sleep(400);
    const rows = await page.evaluate(() =>
      Array.from(document.querySelectorAll('label'))
        .map((label) => {
          const cb = label.querySelector('[role="checkbox"]');
          const span = label.querySelector('span.flex-1');
          if (!cb || !span) return null;
          return { name: span.textContent?.trim(), checked: cb.getAttribute('data-state') === 'checked' };
        })
        .filter((r) => r !== null),
    );
    for (const row of rows) {
      const shouldCheck = row.name === name;
      if (row.checked !== shouldCheck) {
        await page.evaluate((rowName) => {
          const label = Array.from(document.querySelectorAll('label')).find(
            (l) => l.querySelector('span.flex-1')?.textContent?.trim() === rowName,
          );
          label?.querySelector('[role="checkbox"]')?.click();
        }, row.name);
        await sleep(400); // let React re-render before the next click reads/writes state
      }
    }
    await page.keyboard.press('Escape');
    await sleep(300);
  }

  // The hits table leads with `_id` — a random string that says nothing about
  // the data. Hiding it is a normal in-app action (Columns menu), driven here
  // through the same per-connection localStorage key the menu writes.
  async function hideColumns(columns) {
    const connectionId = await page.evaluate(
      async () => (await chrome.storage.local.get('activeConnectionId')).activeConnectionId,
    );
    if (!connectionId) return;
    await page.evaluate(
      (id, cols) => localStorage.setItem(`elasticvix.search.hiddenColumns.${id}`, JSON.stringify(cols)),
      connectionId,
      columns,
    );
    await page.reload();
    await sleep(1200);
  }

  async function runSearchAndWait() {
    await clickButton('Search'); // SearchPage toolbar Run button (distinct from nav 'SEARCH')
    await sleep(1500);
  }

  // Theme persists in localStorage across script invocations, so a later shot
  // can silently inherit whatever an earlier one left behind (bit us once:
  // re-running shot 1 after shot 5 produced a dark screenshot). Every shot
  // that cares about theme should call this rather than assume a default.
  // The theme control moved into the Settings popover, so drive it through the
  // key it persists to ('elasticvix-theme') and reload — one step instead of
  // opening a menu, and it works from any view.
  async function ensureTheme(mode) {
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if ((mode === 'dark') === isDark) return;
    await page.evaluate((m) => localStorage.setItem('elasticvix-theme', m), mode);
    await page.reload();
    await sleep(1200);
  }

  // Idempotent: saves a REST query so the "Library" left rail (shot 4's
  // subject) never shows its empty state. Must switch to REST view *before*
  // checking for existing text, since SavedQueriesPanel (and its saved-query
  // names) is only mounted while the REST view is active.
  async function ensureSavedQuery(name, requestText, tags) {
    await goToView('REST');
    await sleep(300);
    const exists = await eventuallyBodyIncludes(name);
    if (exists) return;
    await setEditorBody(requestText);
    await clickButton('Save'); // QueryEditor toolbar -> opens SaveQueryDialog
    await sleep(400);
    await page.locator('#q-name').fill(name);
    if (tags) await page.locator('#q-tags').fill(tags);
    await clickDialogButton('Save');
    await sleep(500);
  }

  const run = async (n, fn) => {
    if (!shotArg || shotArg === String(n)) await fn();
  };

  // Setup shared by every shot: one connection to the demo cluster, and a
  // small saved-query library so shot 4 shows real content and tag chips.
  await ensureConnection('Local demo', DEMO_ES_URL);
  await ensureSavedQuery(
    'Top categories by revenue',
    'GET /products/_search\n{"size":0,"aggs":{"by_category":{"terms":{"field":"category","size":5}}}}',
    'products, aggs',
  );
  await ensureSavedQuery(
    'Errors in the last hour',
    'GET /app-logs/_search\n{"query":{"term":{"level":"error"}},"size":20}',
    'logs, oncall',
  );
  await ensureSavedQuery(
    'Slowest requests',
    'GET /app-logs/_search\n{"query":{"range":{"latency_ms":{"gte":500}}},"sort":[{"latency_ms":"desc"}],"size":20}',
    'logs, perf',
  );

  // --- 1. Search UI: hits table filled from products, aggregation query ---
  await run(1, async () => {
    await switchToConnection('Local demo');
    await goToView('SEARCH');
    await ensureTheme('light');
    await hideColumns(['_id']);
    await selectOnlyIndex('products');
    // Kept short on purpose: formatted JSON gets tall fast, and the editor pane
    // is 192px — a longer body would be cut off mid-query in the screenshot.
    await setEditorBody('{"query":{"match":{"name":"pro"}},"sort":[{"price":"desc"}],"size":25}');
    await runSearchAndWait();
    await save('01-search.png');
  });

  // --- 2. REST console with field autocomplete open ---
  await run(2, async () => {
    await goToView('REST');
    await ensureTheme('light');
    await sleep(500);
    // Run a real request first so the response pane shows actual JSON behind
    // the completion popup — an empty "Run a request to see the response."
    // pane wastes half the screenshot.
    await setEditorBody('GET /products/_search\n{"query":{"term":{"category":"laptops"}},"size":3}');
    await clickRun();
    // Build the body by typing only opening delimiters: CodeMirror auto-closes
    // each one and indents on Enter, so the visible text is already
    // pretty-printed. Format can't be used here — the body is deliberately
    // left mid-token so the completion popup has something to complete.
    await page.locator('.cm-content').click();
    await page.keyboard.down('Meta');
    await page.keyboard.press('a');
    await page.keyboard.up('Meta');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('GET /products/_search\n{\n"query": {\n"term": {\n"', { delay: 20 });
    await sleep(400);
    await page.keyboard.down('Control');
    await page.keyboard.press('Space');
    await page.keyboard.up('Control');
    await sleep(900);
    await save('02-console-autocomplete.png');
  });

  // --- 3. Cluster overview: health + per-node RAM/heap/disk table ---
  await run(3, async () => {
    await switchToConnection('Local demo');
    await ensureTheme('light');
    await goToView('CLUSTER');
    // Wait for the node table to render (proves the four fetches resolved).
    await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length > 0, { timeout: 15000 });
    await sleep(800);
    await save('03-cluster.png');
  });

  // --- 4. Saved queries library + a run response in the REST console ---
  await run(4, async () => {
    await goToView('REST');
    await ensureTheme('light');
    await sleep(500);
    await setEditorBody(
      'GET /app-logs/_search\n{"query":{"term":{"level":"error"}},"aggs":{"by_service":{"terms":{"field":"service"}}},"size":5}',
    );
    await clickRun();
    await save('04-saved-queries.png');
  });

  // --- 5. Dark mode + the multi-cluster selector open ---
  await run(5, async () => {
    // Adding a connection makes it active, so switch back afterwards: the shot
    // needs the demo cluster's data (and its hidden-column preference, which is
    // stored per connection).
    await ensureConnection('Staging', DEMO_ES_URL);
    await switchToConnection('Local demo');
    // Theme before the search: switching it reloads the page, which would throw
    // away results captured before it.
    await ensureTheme('dark');
    await hideColumns(['_id']);
    await goToView('SEARCH');
    await selectOnlyIndex('products');
    await setEditorBody('{"query":{"match":{"name":"pro"}},"sort":[{"price":"desc"}],"size":25}');
    await runSearchAndWait();
    await openClusterSelector();
    await sleep(500);
    await save('05-dark-mode.png');
  });

  console.log('Done.');
} finally {
  if (browser) await browser.close();
}
