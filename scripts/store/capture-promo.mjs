import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

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
mkdirSync(OUT, { recursive: true });

const SIZES = [
  { name: 'small-440x280.png', w: 440, h: 280 },
  { name: 'marquee-1400x560.png', w: 1400, h: 560 },
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();

for (const { name, w, h } of SIZES) {
  await page.setViewport({ width: w, height: h });
  await page.goto(`file://${resolve('scripts/store/promo.html')}`);
  await new Promise((r) => setTimeout(r, 300));
  const buf = await page.screenshot({ type: 'png' });
  await sharp(buf).flatten({ background: '#0F172A' }).removeAlpha().png().toFile(`${OUT}/${name}`);
  console.log(`saved ${OUT}/${name}`);
}

await browser.close();
