import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

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
  const [entry] = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  if (!entry) throw new Error(`No subdirectory found under ${dir}`);
  return entry;
}

function findChromeForTesting() {
  const base = resolve('node_modules/.cache/chrome-for-testing/chrome');
  const buildDir = firstSubdir(base); // e.g. 'mac_arm-151.0.7922.34' (skips the sibling .metadata file)
  const platformDir = firstSubdir(resolve(base, buildDir)); // e.g. 'chrome-mac-arm64'
  return resolve(base, buildDir, platformDir, 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
}

const CHROME = findChromeForTesting();
const EXT = resolve('.output/chrome-mv3');
const OUT = 'docs/store/screenshots';
const shotArg = process.argv[2]; // '1'..'5' or blank = all

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,880',
    // Fixed profile so connections/saved queries persist across shot 1..5 runs;
    // lives under node_modules/.cache so it never touches git status or gets
    // wiped by a wxt build.
    `--user-data-dir=${resolve('node_modules/.cache/elasticvix-shots-profile')}`,
  ],
  defaultViewport: { width: 1280, height: 800 },
});

const sw = await browser.waitForTarget((t) => t.type() === 'service_worker', { timeout: 10000 });
const extId = new URL(sw.url()).host;
const page = await browser.newPage();
await page.goto(`chrome-extension://${extId}/console.html`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1000);

async function save(name) {
  const buf = await page.screenshot({ type: 'png' });
  await sharp(buf).flatten({ background: '#ffffff' }).removeAlpha().png().toFile(`${OUT}/${name}`);
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

async function setEditorBody(text) {
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

async function runSearchAndWait() {
  await clickButton('Search'); // SearchPage toolbar Run button (distinct from nav 'SEARCH')
  await sleep(1500);
}

// Theme persists in localStorage across script invocations, so a later shot
// can silently inherit whatever an earlier one left behind (bit us once:
// re-running shot 1 after shot 5 produced a dark screenshot). Every shot
// that cares about theme should call this rather than assume a default.
async function ensureTheme(mode) {
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if ((mode === 'dark') === isDark) return;
  await page.locator('[aria-label="Toggle theme"]').click();
  await sleep(500);
}

// Idempotent: saves a REST query so the "Saved" left rail (shot 2's
// background and shot 3's subject) never shows its empty state. Must switch
// to REST view *before* checking for existing text, since SavedQueriesPanel
// (and its saved-query names) is only mounted while the REST view is active.
async function ensureSavedQuery(name, requestText) {
  await goToView('REST');
  await sleep(300);
  const exists = await eventuallyBodyIncludes(name);
  if (exists) return;
  await setEditorBody(requestText);
  await clickButton('Save'); // QueryEditor toolbar -> opens SaveQueryDialog
  await sleep(400);
  await page.locator('#q-name').fill(name);
  await clickDialogButton('Save');
  await sleep(500);
}

const run = async (n, fn) => {
  if (!shotArg || shotArg === String(n)) await fn();
};

// Setup shared by every shot: one connection to the demo cluster, and a
// couple of saved queries so shot 2/3 never show the saved-queries empty
// state (and shot 3 has more than one item to show off the library).
//
// Bodies are typed as compact single-line JSON, not pretty-printed with
// embedded newlines: CodeMirror's auto-close-brackets does smart
// indent-and-close-on-Enter, which collides with literal closing braces
// already present in typed multi-line text and leaves stray duplicate `}`
// lines behind. Compact JSON sidesteps that entirely.
await ensureConnection('Local demo', DEMO_ES_URL);
await ensureSavedQuery('Products by category', 'GET /products/_search\n{"query":{"match_all":{}}}');
await ensureSavedQuery('Error logs by service', 'GET /app-logs/_search\n{"query":{"term":{"level":"error"}}}');

// --- 1. Search UI with hits filled from products + an aggs-bearing query ---
await run(1, async () => {
  await switchToConnection('Local demo');
  await goToView('SEARCH');
  await ensureTheme('light');
  await selectOnlyIndex('products');
  await setEditorBody(
    '{"query":{"range":{"price":{"gte":10}}},"aggs":{"by_category":{"terms":{"field":"category"}},"avg_price":{"avg":{"field":"price"}}},"size":25}',
  );
  await runSearchAndWait();
  await save('01-search.png');
});

// --- 2. REST view with autocomplete open (field suggestions from products mapping) ---
await run(2, async () => {
  await goToView('REST');
  await ensureTheme('light');
  await sleep(500);
  // "term" query expects a field name as its key -> triggers field (not just
  // keyword) suggestions from the products mapping (brand/category/name/...).
  await setEditorBody('GET /products/_search\n{"query":{"term":{"');
  await page.keyboard.down('Control');
  await page.keyboard.press('Space');
  await page.keyboard.up('Control');
  await sleep(800);
  await save('02-console-autocomplete.png');
});

// --- 3. Saved queries panel (REST view left rail) ---
await run(3, async () => {
  await goToView('REST');
  await ensureTheme('light');
  await sleep(500);
  await clickButton('Saved'); // left rail tab (defaults to it, but be explicit)
  await sleep(500);
  await save('03-saved-queries.png');
});

// --- 4. Connections (multi-cluster selector) ---
await run(4, async () => {
  await ensureTheme('light');
  await ensureConnection('Staging', DEMO_ES_URL);
  await openClusterSelector();
  await sleep(500);
  await save('04-connections.png');
});

// --- 5. Dark mode (Search view, with data visible) ---
await run(5, async () => {
  await switchToConnection('Local demo');
  await goToView('SEARCH');
  await selectOnlyIndex('products');
  const hasResults = await page.evaluate(() => document.querySelectorAll('table tbody tr').length > 0);
  if (!hasResults) {
    await setEditorBody('{"query":{"match_all":{}}}');
    await runSearchAndWait();
  }
  await ensureTheme('dark');
  await save('05-dark-mode.png');
});

await browser.close();
console.log('Done.');
