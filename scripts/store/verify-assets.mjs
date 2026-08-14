import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { SHOTS, OUT_DIR } from './shots.mjs';

const SPECS = [
  { path: 'public/icon/16.png', w: 16, h: 16, opaque: false },
  { path: 'public/icon/32.png', w: 32, h: 32, opaque: false },
  { path: 'public/icon/48.png', w: 48, h: 48, opaque: false },
  { path: 'public/icon/128.png', w: 128, h: 128, opaque: false },
  // Screenshots come from the one shot list, so renaming or reordering a shot
  // can never leave this check pointing at a file nobody produces any more.
  ...SHOTS.map((s) => ({ path: `${OUT_DIR}/${s.file}`, w: 1280, h: 800, opaque: true })),
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
