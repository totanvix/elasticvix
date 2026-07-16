import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { basename } from 'node:path';

const [svgPath, finalFlag] = process.argv.slice(2);
if (!svgPath) {
  console.error('Usage: node scripts/store/render-icons.mjs <svg> [--final]');
  process.exit(1);
}

const name = basename(svgPath, '.svg');

if (finalFlag === '--final') {
  mkdirSync('public/icon', { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    await sharp(svgPath).resize(size, size).png().toFile(`public/icon/${size}.png`);
    console.log(`public/icon/${size}.png`);
  }
} else {
  const outDir = 'docs/store/icon-options/preview';
  mkdirSync(outDir, { recursive: true });
  for (const size of [128, 48, 16]) {
    const out = `${outDir}/${name}-${size}.png`;
    await sharp(svgPath).resize(size, size).png().toFile(out);
    console.log(out);
  }
}
