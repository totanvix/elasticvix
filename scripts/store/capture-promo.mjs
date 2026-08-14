import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { mkdirSync, readdirSync, statSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAW_DIR } from './shots.mjs';

// Promo tiles for the store listing. Both are drawn on the same brand
// background as the framed screenshots so the listing reads as one set.
// The marquee also carries a real UI crop — it is the image the store uses for
// featured placement, and a logo alone shows nothing about the product.

// AMENDED (controller-authorized): branded Google Chrome ignores puppeteer
// flags inconsistently for extension work on this machine (see
// capture-screenshots.mjs for the full rationale). Reuse the same "Chrome for
// Testing" executable-resolution approach here for consistency, even though
// this script only ever loads a plain file:// page (no extension involved).
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
const OUT = 'docs/store/promo';
const SHOT = '01-search.png'; // the raw search capture, sitting in RAW_DIR
mkdirSync(OUT, { recursive: true });

const ICON_SVG = (size) => `<svg viewBox="0 0 128 128" width="${size}" height="${size}" aria-hidden="true">
  <rect width="128" height="128" rx="28" fill="#0F172A"/>
  <rect x="28" y="30" width="72" height="16" rx="8" fill="#14B8A6"/>
  <rect x="28" y="56" width="52" height="16" rx="8" fill="#FACC15"/>
  <rect x="28" y="82" width="72" height="16" rx="8" fill="#F472B6"/>
</svg>`;

const BACKGROUND = `
  radial-gradient(900px 520px at 8% -18%, rgba(20, 184, 166, 0.34), transparent 62%),
  radial-gradient(760px 460px at 102% 4%, rgba(244, 114, 182, 0.18), transparent 60%),
  linear-gradient(165deg, #0f172a 0%, #0a1120 100%)`;

const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: ${BACKGROUND};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #f8fafc; overflow: hidden;
  }
  .icon { border-radius: 22%; flex: none; }
  h1 { font-weight: 700; letter-spacing: -0.03em; line-height: 1; }
  p { color: #9fc9c4; letter-spacing: -0.005em; }`;

// 440x280 — rendered small in search results, so it stays a wordmark: icon,
// name, one short line. Anything denser turns to mush at half size.
const smallHtml = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { width: 440px; height: 280px; }
  ${BASE_CSS}
  body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
  h1 { font-size: 46px; }
  p { font-size: 17px; }
</style></head>
<body>
  ${ICON_SVG(84)}
  <div style="text-align:center">
    <h1>Elasticvix</h1>
    <p style="margin-top:10px">Elasticsearch client for Chrome</p>
  </div>
</body></html>`;

// 1400x560 — the featured-placement image. Half of it is a real screenshot,
// bleeding off the right edge so it reads as a window into the app.
const marqueeHtml = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { width: 1400px; height: 560px; }
  ${BASE_CSS}
  body { display: flex; align-items: center; }
  .copy { width: 620px; padding-left: 76px; flex: none; }
  .brand { display: flex; align-items: center; gap: 20px; }
  h1 { font-size: 68px; }
  p.tagline { font-size: 26px; line-height: 1.35; margin-top: 22px; color: #a9c6d6; }
  /* Wider than the space left for it: the card bleeds off the right edge so it
     reads as a window into a running app rather than a pasted thumbnail. */
  .shot {
    margin-left: 24px; width: 900px; height: 496px; flex: none;
    border-radius: 16px; overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.3);
    box-shadow: 0 30px 70px rgba(2, 6, 23, 0.65);
  }
  .shot img { width: 100%; height: 100%; object-fit: cover; object-position: left top; display: block; }
</style></head>
<body>
  <div class="copy">
    <div class="brand">${ICON_SVG(76)}<h1>Elasticvix</h1></div>
    <p class="tagline">Query console, search UI and cluster overview for Elasticsearch — right in your browser.</p>
  </div>
  <div class="shot"><img src="./${SHOT}" alt=""></div>
</body></html>`;

const rawShot = resolve(RAW_DIR, SHOT);
if (!existsSync(rawShot)) {
  console.error(`Missing ${rawShot} — run scripts/store/capture-screenshots.mjs first.`);
  process.exit(1);
}

const PAGES = [
  { name: 'small-440x280.png', w: 440, h: 280, html: smallHtml },
  { name: 'marquee-1400x560.png', w: 1400, h: 560, html: marqueeHtml },
];

let browser;
try {
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();

  for (const { name, w, h, html } of PAGES) {
    // Written into RAW_DIR so the marquee's `./<crop>` resolves without any
    // file:// path juggling.
    const htmlPath = resolve(RAW_DIR, `promo-${w}x${h}.html`);
    writeFileSync(htmlPath, html);
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
    await page.goto(`file://${htmlPath}`);
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 250));
    const buf = await page.screenshot({ type: 'png' });
    // Captured at 2x for sharp text, then resized to the exact store size.
    await sharp(buf)
      .resize(w, h)
      .flatten({ background: '#0f172a' })
      .removeAlpha()
      .png()
      .toFile(`${OUT}/${name}`);
    rmSync(htmlPath, { force: true });
    console.log(`saved ${OUT}/${name}`);
  }
} finally {
  if (browser) await browser.close();
}
