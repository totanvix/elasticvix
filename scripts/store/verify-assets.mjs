import sharp from 'sharp';
import { existsSync } from 'node:fs';

const SPECS = [
  { path: 'public/icon/16.png', w: 16, h: 16, opaque: false },
  { path: 'public/icon/32.png', w: 32, h: 32, opaque: false },
  { path: 'public/icon/48.png', w: 48, h: 48, opaque: false },
  { path: 'public/icon/128.png', w: 128, h: 128, opaque: false },
  { path: 'docs/store/screenshots/01-search.png', w: 1280, h: 800, opaque: true },
  { path: 'docs/store/screenshots/02-console-autocomplete.png', w: 1280, h: 800, opaque: true },
  { path: 'docs/store/screenshots/03-saved-queries.png', w: 1280, h: 800, opaque: true },
  { path: 'docs/store/screenshots/04-connections.png', w: 1280, h: 800, opaque: true },
  { path: 'docs/store/screenshots/05-dark-mode.png', w: 1280, h: 800, opaque: true },
  { path: 'docs/store/promo/small-440x280.png', w: 440, h: 280, opaque: true },
  { path: 'docs/store/promo/marquee-1400x560.png', w: 1400, h: 560, opaque: true },
];

const strict = process.argv.includes('--strict');
let failed = false;

for (const spec of SPECS) {
  if (!existsSync(spec.path)) {
    if (strict) {
      console.error(`FAIL ${spec.path}: missing`);
      failed = true;
    } else {
      console.warn(`WARN ${spec.path}: missing (skipped)`);
    }
    continue;
  }
  const meta = await sharp(spec.path).metadata();
  const problems = [];
  if (meta.width !== spec.w || meta.height !== spec.h) {
    problems.push(`size ${meta.width}x${meta.height}, expected ${spec.w}x${spec.h}`);
  }
  if (spec.opaque && (meta.hasAlpha || meta.channels !== 3)) {
    problems.push(`must be 24-bit opaque PNG (hasAlpha=${meta.hasAlpha}, channels=${meta.channels})`);
  }
  if (problems.length > 0) {
    console.error(`FAIL ${spec.path}: ${problems.join('; ')}`);
    failed = true;
  } else {
    console.log(`OK   ${spec.path}`);
  }
}

process.exit(failed ? 1 : 0);
