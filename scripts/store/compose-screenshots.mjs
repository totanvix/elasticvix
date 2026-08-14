import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SHOTS, RAW_DIR, OUT_DIR, CARD_WIDTH, CARD_HEIGHT } from './shots.mjs';

// Turns each raw UI capture from capture-screenshots.mjs into the 1280x800
// listing image the store shows: the same screenshot, framed on brand
// background under a one-line headline. The store renders these small, so the
// headline is what a browsing user actually reads first.

function firstSubdir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  if (entries.length === 0) throw new Error(`No subdirectory found under ${dir}`);
  const newest = entries
    .map((name) => ({ name, mtimeMs: statSync(resolve(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  return newest.name;
}

function findChromeForTesting() {
  const base = resolve('node_modules/.cache/chrome-for-testing/chrome');
  const buildDir = firstSubdir(base);
  const platformDir = firstSubdir(resolve(base, buildDir));
  return resolve(base, buildDir, platformDir, 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
}

// The shipped extension icon, inline so the page needs no file:// asset lookup.
const ICON_SVG = `<svg viewBox="0 0 128 128" width="30" height="30" aria-hidden="true">
  <rect width="128" height="128" rx="28" fill="#0F172A"/>
  <rect x="28" y="30" width="72" height="16" rx="8" fill="#14B8A6"/>
  <rect x="28" y="56" width="52" height="16" rx="8" fill="#FACC15"/>
  <rect x="28" y="82" width="72" height="16" rx="8" fill="#F472B6"/>
</svg>`;

function frameHtml({ file, title, subtitle }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1280px; height: 800px; }
  body {
    background:
      radial-gradient(900px 520px at 12% -12%, rgba(20, 184, 166, 0.30), transparent 62%),
      radial-gradient(760px 460px at 105% 8%, rgba(244, 114, 182, 0.16), transparent 60%),
      linear-gradient(165deg, #0f172a 0%, #0a1120 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #f8fafc;
    display: flex; flex-direction: column; align-items: center;
    padding: 34px 38px 0;
  }
  header { width: 100%; display: flex; align-items: flex-start; justify-content: space-between; gap: 32px; }
  h1 { font-size: 35px; line-height: 1.15; font-weight: 700; letter-spacing: -0.022em; }
  p.sub { margin-top: 7px; font-size: 17.5px; line-height: 1.35; color: #9db3c8; letter-spacing: -0.005em; }
  .brand { display: flex; align-items: center; gap: 9px; padding-top: 4px; white-space: nowrap; }
  .brand svg { border-radius: 8px; flex: none; }
  .brand span { font-size: 16px; font-weight: 600; color: #cbd5e1; letter-spacing: -0.01em; }
  .card {
    margin-top: 22px; width: ${CARD_WIDTH}px; height: ${CARD_HEIGHT}px; border-radius: 14px; overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.28);
    box-shadow: 0 26px 64px rgba(2, 6, 23, 0.62);
  }
  .card img { display: block; width: 100%; height: 100%; }
</style></head>
<body>
  <header>
    <div>
      <h1>${title}</h1>
      <p class="sub">${subtitle}</p>
    </div>
    <div class="brand">${ICON_SVG}<span>Elasticvix</span></div>
  </header>
  <div class="card"><img src="./${file}" alt=""></div>
</body></html>`;
}

mkdirSync(OUT_DIR, { recursive: true });
const only = process.argv.slice(2).find((a) => /^\d+$/.test(a));

let browser;
try {
  browser = await puppeteer.launch({ executablePath: findChromeForTesting(), headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

  for (const shot of SHOTS) {
    if (only && only !== String(shot.id)) continue;
    // The page lives next to the raw capture so `./<file>` resolves without
    // any file:// path juggling.
    const htmlPath = resolve(RAW_DIR, `frame-${shot.id}.html`);
    writeFileSync(htmlPath, frameHtml(shot));
    await page.goto(`file://${htmlPath}`);
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 200));
    const buf = await page.screenshot({ type: 'png' });
    // The store wants opaque 24-bit PNGs (verify-assets.mjs --strict checks it).
    await sharp(buf).flatten({ background: '#0f172a' }).removeAlpha().png().toFile(`${OUT_DIR}/${shot.file}`);
    rmSync(htmlPath, { force: true });
    console.log(`saved ${OUT_DIR}/${shot.file}`);
  }
} finally {
  if (browser) await browser.close();
}
