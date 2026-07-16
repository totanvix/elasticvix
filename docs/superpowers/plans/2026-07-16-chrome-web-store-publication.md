# Chrome Web Store Publication Package — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn bị toàn bộ asset, nội dung và thay đổi manifest để submit Elasticvix 1.0.0 lên Chrome Web Store.

**Architecture:** Không đụng logic extension — chỉ sửa metadata trong `wxt.config.ts`, thêm icon vào `public/icon/`, và sinh toàn bộ asset/text vào `docs/store/`. Asset ảnh được sản xuất bằng pipeline script (`sharp` render/hậu kỳ, `puppeteer-core` điều khiển Chrome thật có load extension, Elasticsearch demo chạy Docker làm dữ liệu screenshot). Một script `verify-assets.mjs` kiểm tra máy móc mọi ràng buộc ảnh của store.

**Tech Stack:** WXT 0.20 (build/zip), sharp (SVG→PNG, strip alpha, verify), puppeteer-core (điều khiển Chrome tại `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`), Docker (Elasticsearch 8.14 demo), pnpm.

## Global Constraints

- Tên trên store (= manifest `name`, giới hạn 45 ký tự): `Elasticvix - Elasticsearch Client` — 33 ký tự, dùng đúng chuỗi này ở mọi nơi.
- Summary (= manifest `description`, giới hạn 132 ký tự): `Elasticsearch client with query console, field-aware autocomplete, saved queries, and multi-cluster support. For ES 6.x-9.x.` — 124 ký tự, dùng đúng chuỗi này.
- **Không thay đổi** `permissions` / `host_permissions` hiện có (`storage`, `http://*/*`, `https://*/*`).
- Screenshots: đúng 5 file, 1280×800, PNG 24-bit (3 channels), **không alpha**.
- Promo: small tile 440×280 và marquee 1400×560, cùng ràng buộc PNG 24-bit không alpha.
- Icon manifest: PNG tại `public/icon/{16,32,48,128}.png` (WXT tự nhận theo regex `icons?/{size}.png` — đã xác minh trong wxt 0.20.27).
- Version giữ `1.0.0`. Listing tiếng Anh. Email hỗ trợ: `totanvix@gmail.com`.
- Commit message theo convention `<type>: <description>`, KHÔNG thêm Co-Authored-By (attribution đã tắt toàn cục).
- Node script dùng ESM (`.mjs`), chạy bằng `node`, fetch built-in của Node (không thêm dep HTTP).

---

### Task 1: Store metadata trong manifest

**Files:**
- Modify: `wxt.config.ts`
- Modify: `package.json` (description, author)

**Interfaces:**
- Produces: manifest build ra có `name` = `Elasticvix - Elasticsearch Client`, `description` = chuỗi summary 124 ký tự. Task 12 kiểm tra lại đúng 2 giá trị này trong zip.

- [ ] **Step 1: Sửa `wxt.config.ts`**

Thay block `manifest` hiện tại bằng:

```ts
  manifest: {
    name: 'Elasticvix - Elasticsearch Client',
    description:
      'Elasticsearch client with query console, field-aware autocomplete, saved queries, and multi-cluster support. For ES 6.x-9.x.',
    permissions: ['storage'],
    host_permissions: ['http://*/*', 'https://*/*'],
    action: {},
  },
```

- [ ] **Step 2: Sửa `package.json`**

Đổi 2 field (giữ nguyên phần còn lại):

```json
  "description": "Elasticsearch client Chrome extension: query console, field-aware autocomplete, saved queries, multi-cluster.",
  "author": "totanvix <totanvix@gmail.com>",
```

- [ ] **Step 3: Build và verify manifest**

Run:
```bash
pnpm build && node -e "
const m = require('./.output/chrome-mv3/manifest.json');
console.log(m.name, '|', m.name.length);
console.log(m.description, '|', m.description.length);
if (m.name !== 'Elasticvix - Elasticsearch Client') throw new Error('bad name');
if (m.description.length > 132) throw new Error('desc too long');
console.log('OK');
"
```
Expected: in ra name (33) + description (124) + `OK`.

- [ ] **Step 4: Compile + test vẫn xanh**

Run: `pnpm compile && pnpm test`
Expected: exit 0, không test nào fail.

- [ ] **Step 5: Commit**

```bash
git add wxt.config.ts package.json
git commit -m "feat: store-ready extension name and description in manifest"
```

---

### Task 2: Dev deps + 3 phương án icon SVG + render preview

**Files:**
- Modify: `package.json` (devDependencies qua pnpm)
- Create: `docs/store/icon-options/option-a.svg`
- Create: `docs/store/icon-options/option-b.svg`
- Create: `docs/store/icon-options/option-c.svg`
- Create: `scripts/store/render-icons.mjs`

**Interfaces:**
- Produces: `scripts/store/render-icons.mjs <svg-path>` — render 1 SVG ra `docs/store/icon-options/preview/<tên>-{128,48,16}.png` để duyệt, và (khi truyền `--final`) ra `public/icon/{16,32,48,128}.png`. Task 3 dùng lại script này với `--final`.

- [ ] **Step 1: Cài dev deps**

Run: `pnpm add -D sharp puppeteer-core`
Expected: cài thành công, lockfile cập nhật.

- [ ] **Step 2: Tạo 3 file SVG phương án**

`docs/store/icon-options/option-a.svg` — "E bars" (chữ E cách điệu 3 thanh màu, nền navy):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#0F172A"/>
  <rect x="28" y="30" width="72" height="16" rx="8" fill="#14B8A6"/>
  <rect x="28" y="56" width="52" height="16" rx="8" fill="#FACC15"/>
  <rect x="28" y="82" width="72" height="16" rx="8" fill="#F472B6"/>
</svg>
```

`docs/store/icon-options/option-b.svg` — "Search cluster" (kính lúp + 3 node):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#0D9488"/>
  <circle cx="56" cy="56" r="26" fill="none" stroke="#FFFFFF" stroke-width="10"/>
  <line x1="76" y1="76" x2="100" y2="100" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>
  <circle cx="47" cy="50" r="5" fill="#FFFFFF"/>
  <circle cx="65" cy="50" r="5" fill="#FFFFFF"/>
  <circle cx="56" cy="66" r="5" fill="#FFFFFF"/>
</svg>
```

`docs/store/icon-options/option-c.svg` — "Vix bolt" (tia sét trên gradient indigo→teal):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4F46E5"/>
      <stop offset="1" stop-color="#14B8A6"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#g)"/>
  <path d="M72 20 L40 72 H60 L52 108 L92 52 H70 Z" fill="#FFFFFF"/>
</svg>
```

- [ ] **Step 3: Viết `scripts/store/render-icons.mjs`**

```js
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
```

- [ ] **Step 4: Render preview cả 3 phương án**

Run:
```bash
node scripts/store/render-icons.mjs docs/store/icon-options/option-a.svg
node scripts/store/render-icons.mjs docs/store/icon-options/option-b.svg
node scripts/store/render-icons.mjs docs/store/icon-options/option-c.svg
```
Expected: 9 file PNG trong `docs/store/icon-options/preview/` (3 phương án × 3 size).

- [ ] **Step 5: ⛔ CHECKPOINT — trình user duyệt**

Đọc (Read tool) 3 file preview 128px và 3 file 16px, mô tả từng phương án, hỏi user chọn (A/B/C hoặc yêu cầu chỉnh màu/hình). KHÔNG tự quyết. Chỉ sang Task 3 khi user đã chọn.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml docs/store/icon-options scripts/store/render-icons.mjs
git commit -m "feat: icon design options and render pipeline for store assets"
```

---

### Task 3: Chốt icon, đưa vào manifest

**Files:**
- Create: `docs/store/icon.svg` (copy từ phương án được chọn, có thể đã chỉnh theo góp ý)
- Create: `public/icon/16.png`, `public/icon/32.png`, `public/icon/48.png`, `public/icon/128.png`

**Interfaces:**
- Consumes: `scripts/store/render-icons.mjs` (Task 2), phương án user chọn ở checkpoint Task 2.
- Produces: manifest build ra có block `icons` đủ 4 size; `docs/store/icon.svg` là nguồn duy nhất cho promo tiles (Task 11).

- [ ] **Step 1: Copy SVG được chọn thành nguồn chính thức**

Run (ví dụ user chọn option A — thay đúng file được chọn):
```bash
cp docs/store/icon-options/option-a.svg docs/store/icon.svg
```

- [ ] **Step 2: Export final PNG**

Run: `node scripts/store/render-icons.mjs docs/store/icon.svg --final`
Expected: in ra 4 dòng `public/icon/{16,32,48,128}.png`.

- [ ] **Step 3: Build và verify manifest có icons**

Run:
```bash
pnpm build && node -e "
const m = require('./.output/chrome-mv3/manifest.json');
console.log(JSON.stringify(m.icons));
for (const s of ['16','32','48','128']) if (!m.icons?.[s]) throw new Error('missing icon ' + s);
console.log('OK');
"
```
Expected: `{"16":"icon/16.png","32":"icon/32.png","48":"icon/48.png","128":"icon/128.png"}` + `OK`.

- [ ] **Step 4: Commit**

```bash
git add docs/store/icon.svg public/icon
git commit -m "feat: extension icons wired into manifest"
```

---

### Task 4: Script verify-assets

**Files:**
- Create: `scripts/store/verify-assets.mjs`

**Interfaces:**
- Produces: `node scripts/store/verify-assets.mjs [--strict]` — kiểm tra kích thước mọi asset store; với screenshot/promo kiểm thêm không-alpha + 3 channels. Không strict: file chưa tồn tại chỉ WARN. `--strict`: thiếu file = FAIL (dùng ở Task 12).

- [ ] **Step 1: Viết `scripts/store/verify-assets.mjs`**

```js
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
```

- [ ] **Step 2: Chạy để verify icons đã có (screenshot/promo mới chỉ WARN)**

Run: `node scripts/store/verify-assets.mjs`
Expected: 4 dòng `OK public/icon/...`, 7 dòng `WARN ... missing (skipped)`, exit 0.

- [ ] **Step 3: Kiểm tra script bắt lỗi thật (test âm tính)**

Run từng lệnh:
```bash
mkdir -p docs/store/screenshots
node -e "import('sharp').then(async ({ default: sharp }) => { await sharp({ create: { width: 100, height: 100, channels: 4, background: '#ffffff' } }).png().toFile('docs/store/screenshots/01-search.png'); })"
node scripts/store/verify-assets.mjs; echo "exit=$?"
rm docs/store/screenshots/01-search.png
```
Expected: dòng `FAIL docs/store/screenshots/01-search.png: size 100x100...` và `exit=1`; lệnh cuối xoá file rác.

- [ ] **Step 4: Commit**

```bash
git add scripts/store/verify-assets.mjs
git commit -m "feat: automated store asset verification script"
```

---

### Task 5: Nội dung listing (`docs/store/listing.md`)

**Files:**
- Create: `docs/store/listing.md`

**Interfaces:**
- Produces: toàn bộ text để dán vào tab "Store listing" của dashboard. Task 8 (checklist) tham chiếu file này.

- [ ] **Step 1: Viết file với nội dung đầy đủ sau**

````markdown
# Chrome Web Store — Store Listing (EN)

> Dán từng mục vào tab **Store listing** của developer dashboard.
> Title và Summary lấy tự động từ manifest khi upload zip — hai mục đầu chỉ để đối chiếu.

## Title (từ manifest — 33/45 ký tự)

Elasticvix - Elasticsearch Client

## Summary (từ manifest — 124/132 ký tự)

Elasticsearch client with query console, field-aware autocomplete, saved queries, and multi-cluster support. For ES 6.x-9.x.

## Category

Developer Tools

## Language

English

## Description (dán vào ô Description — plain text, giữ nguyên xuống dòng)

Elasticvix is an Elasticsearch client that runs entirely in your browser. Connect to any cluster and start querying in seconds — no server, no desktop app.

QUERY CONSOLE
• Write Query DSL with autocomplete that knows your data: suggestions include real field names read from your index mappings, not just keywords
• Context-aware suggestions for API endpoints and query DSL
• JSON linting, formatting, and Cmd/Ctrl+Enter to run

SEARCH UI
• Pick indices and search without hand-writing full requests
• Results in a hits table with a document detail view
• Aggregations view
• Download results as JSON

SAVED QUERIES & HISTORY
• Save queries with names and tags, find them again with search
• Automatic query history

MULTI-CLUSTER
• Store multiple connections and switch instantly
• Cluster health at a glance
• Auth: none, basic auth, API key, or bearer token

WORKS WITH
• Elasticsearch 6.x, 7.x, 8.x (tested) and 9.x (best effort)

PRIVACY
All data stays on your machine. Connections, credentials, saved queries, and history are stored locally in your browser and sent only to the Elasticsearch clusters you configure. No analytics, no tracking, nothing ever sent to us.

WHY "ACCESS TO ALL SITES"?
An Elasticsearch cluster can live on any URL — localhost, a private IP, or any cloud host — so the extension requests broad host access to reach the cluster URLs you add. It has no content scripts: it never reads or changes the websites you visit. Requests go only to clusters you configure yourself.

## Support email

totanvix@gmail.com

## Homepage

(bỏ trống)
````

- [ ] **Step 2: Verify độ dài các chuỗi khớp manifest**

Run:
```bash
node -e "
const fs = require('fs');
const listing = fs.readFileSync('docs/store/listing.md', 'utf8');
const m = require('./.output/chrome-mv3/manifest.json');
if (!listing.includes(m.name)) throw new Error('listing title != manifest name');
if (!listing.includes(m.description)) throw new Error('listing summary != manifest description');
console.log('OK');
"
```
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add docs/store/listing.md
git commit -m "docs: chrome web store listing content"
```

---

### Task 6: Privacy policy (`docs/store/privacy-policy.md`)

**Files:**
- Create: `docs/store/privacy-policy.md`

**Interfaces:**
- Produces: nội dung để user dán nguyên văn vào một Notion public page; URL của page đó điền vào field "Privacy policy" trên dashboard (Task 8 nhắc bước này).

- [ ] **Step 1: Viết file với nội dung đầy đủ sau**

```markdown
# Elasticvix Privacy Policy

Effective date: July 16, 2026

Elasticvix ("the extension") is a Chrome extension that provides a client interface for Elasticsearch clusters.

## Summary

Elasticvix does not collect, transmit, sell, or share any personal data. Everything you enter stays in your browser.

## Data stored locally

The extension stores the following data locally in your browser (using Chrome extension storage and IndexedDB):

- Connection profiles you create: cluster name, base URL, and credentials (username/password, API key, or bearer token) if you configure authentication
- Saved queries, including their names and tags
- Query history
- UI preferences such as light/dark theme

This data never leaves your device except as described below.

## Where your data goes

The only network requests the extension makes are to the Elasticsearch cluster URLs you configure yourself. Credentials are sent only to their corresponding cluster as part of those requests.

The extension contains no analytics, no tracking, no advertising, and no third-party services. The developer operates no server and receives no data from the extension.

## Permissions

The extension requests access to all URLs solely because an Elasticsearch cluster may be hosted on any address (localhost, private networks, or cloud providers). The extension has no content scripts and never reads or modifies the websites you visit.

## Data removal

You can delete individual connections, saved queries, or history entries inside the extension. Uninstalling the extension removes all locally stored data.

## Changes to this policy

If this policy changes, the updated version will be published at this page with a new effective date.

## Contact

totanvix@gmail.com
```

- [ ] **Step 2: Commit**

```bash
git add docs/store/privacy-policy.md
git commit -m "docs: privacy policy for chrome web store"
```

---

### Task 7: Privacy form (`docs/store/privacy-form.md`)

**Files:**
- Create: `docs/store/privacy-form.md`

**Interfaces:**
- Produces: câu trả lời cho từng field trong tab **Privacy** của dashboard. Task 8 tham chiếu.

- [ ] **Step 1: Viết file với nội dung đầy đủ sau**

```markdown
# Chrome Web Store — Privacy Tab

> Dán từng mục vào tab **Privacy** của developer dashboard.

## Single purpose

Elasticvix provides a client interface for Elasticsearch: connect to clusters, run queries, and browse search results.

## Permission justifications

### storage

Used to store the user's Elasticsearch connection profiles, saved queries, query history, and UI preferences locally on their device. Nothing is transmitted to the developer.

### Host permission (http://*/* and https://*/*)

Users connect to their own Elasticsearch clusters, which can be hosted on any URL: localhost, private/internal IP addresses, any port, or any cloud provider. It is impossible to enumerate these hosts in advance, so broad host access is required for the extension's single purpose.

The extension has no content scripts and never reads or modifies web pages. The only network requests are made by the background service worker, exclusively to the cluster base URLs the user has explicitly configured inside the extension.

## Remote code

No — all JavaScript is packaged inside the extension. (Chọn "No, I am not using remote code".)

## Data usage

Không tick mục nào trong danh sách "What user data do you plan to collect?" — extension không thu thập dữ liệu người dùng: credentials và queries chỉ lưu local trên máy, chỉ gửi đến cluster do chính user cấu hình, không bao giờ gửi về developer.

Tick đủ 3 certification:
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

## Privacy policy URL

URL của Notion public page (tạo ở bước checklist — dán nội dung docs/store/privacy-policy.md).
```

- [ ] **Step 2: Commit**

```bash
git add docs/store/privacy-form.md
git commit -m "docs: privacy tab answers and permission justifications"
```

---

### Task 8: Checklist submit (`docs/store/submission-checklist.md`)

**Files:**
- Create: `docs/store/submission-checklist.md`

**Interfaces:**
- Consumes: tên file asset từ Task 4 (SPECS), `listing.md`, `privacy-policy.md`, `privacy-form.md`.
- Produces: hướng dẫn từng bước cuối cùng cho user — deliverable chốt của dự án.

- [ ] **Step 1: Viết file với nội dung đầy đủ sau**

```markdown
# Checklist submit Elasticvix lên Chrome Web Store

## A. Chuẩn bị một lần (làm tay)

- [ ] 1. Tạo Chrome Web Store developer account tại https://chrome.google.com/webstore/devconsole
      với Google account gắn email totanvix@gmail.com. Trả phí đăng ký $5 (một lần). Xác minh email.
- [ ] 2. Tạo Notion page mới → dán nguyên văn nội dung `docs/store/privacy-policy.md` →
      Share → "Publish to web" → copy public URL. Kiểm tra URL mở được ở cửa sổ ẩn danh.

## B. Kiểm tra trước khi upload (chạy máy)

- [ ] 3. `pnpm compile && pnpm test` — xanh.
- [ ] 4. `pnpm build && node scripts/store/verify-assets.mjs --strict` — tất cả OK.
- [ ] 5. `pnpm wxt zip` — có file `.output/elasticvix-1.0.0-chrome.zip`.
- [ ] 6. Smoke test bản zip: mở Chrome profile sạch → chrome://extensions → bật Developer mode →
      Load unpacked trỏ vào `.output/chrome-mv3` → thêm connection → chạy 1 search →
      save 1 query → mở lại saved query. Mọi bước hoạt động.

## C. Trên developer dashboard

- [ ] 7. New item → upload `.output/elasticvix-1.0.0-chrome.zip`.
- [ ] 8. Tab **Store listing**: điền theo `docs/store/listing.md`
      (category Developer Tools, description, support email; homepage bỏ trống).
- [ ] 9. Upload ảnh:
      - 5 screenshots trong `docs/store/screenshots/` (đúng thứ tự 01→05)
      - Small promo tile: `docs/store/promo/small-440x280.png`
      - Marquee promo tile: `docs/store/promo/marquee-1400x560.png`
- [ ] 10. Tab **Privacy**: điền theo `docs/store/privacy-form.md`, dán URL Notion vào Privacy policy.
- [ ] 11. Tab **Distribution**: Public · All regions · Free.
- [ ] 12. Submit for review.

## D. Sau khi submit

- Vì extension dùng broad host permissions, Chrome sẽ in-depth review: thường vài ngày,
  có thể tới vài tuần. Không rebuild/re-upload trong lúc chờ trừ khi bị yêu cầu.
- Nếu reviewer hỏi thêm về quyền: trả lời dựa trên mục "Host permission" trong
  `docs/store/privacy-form.md`.
- Nếu bị reject vì quyền rộng: phương án B là chuyển sang `optional_host_permissions`
  xin động theo thiết kế trong `docs/superpowers/specs/2026-07-07-vixelastic-query-console-design.md`.
- Được duyệt → kiểm tra listing công khai, cài từ store và smoke test lại một lần.
```

- [ ] **Step 2: Commit**

```bash
git add docs/store/submission-checklist.md
git commit -m "docs: step-by-step store submission checklist"
```

---

### Task 9: Elasticsearch demo + seed dữ liệu mẫu

**Files:**
- Create: `scripts/store/seed-es.mjs`

**Interfaces:**
- Produces: ES 8.14 chạy tại `http://localhost:9200` (không auth) với index `products` (200 docs) và `app-logs` (500 docs). Task 10 kết nối extension vào đây. Dữ liệu sinh bằng LCG có seed cố định → chạy lại ra đúng dữ liệu cũ (screenshot tái lập được).

- [ ] **Step 1: Chạy Elasticsearch bằng Docker**

Run:
```bash
docker run -d --name elasticvix-demo -p 9200:9200 \
  -e discovery.type=single-node \
  -e xpack.security.enabled=false \
  -e ES_JAVA_OPTS="-Xms512m -Xmx512m" \
  docker.elastic.co/elasticsearch/elasticsearch:8.14.0
```
Chờ tới khi sẵn sàng:
```bash
until curl -s http://localhost:9200 >/dev/null; do sleep 2; done; curl -s http://localhost:9200 | head -3
```
Expected: JSON có `"cluster_name"`.

- [ ] **Step 2: Viết `scripts/store/seed-es.mjs`**

```js
const ES = 'http://localhost:9200';

// LCG có seed cố định để dữ liệu tái lập được giữa các lần chạy
let seed = 42;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

async function createIndex(name, mappings) {
  await fetch(`${ES}/${name}`, { method: 'DELETE' }).catch(() => {});
  const res = await fetch(`${ES}/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mappings }),
  });
  if (!res.ok) throw new Error(`create ${name}: ${res.status} ${await res.text()}`);
}

async function bulk(index, docs) {
  const ndjson =
    docs.flatMap((d) => [JSON.stringify({ index: { _index: index } }), JSON.stringify(d)]).join('\n') + '\n';
  const res = await fetch(`${ES}/_bulk?refresh=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-ndjson' },
    body: ndjson,
  });
  const body = await res.json();
  if (body.errors) throw new Error(`bulk ${index} had errors`);
  console.log(`${index}: ${docs.length} docs`);
}

// --- products (200 docs) ---
await createIndex('products', {
  properties: {
    name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
    category: { type: 'keyword' },
    brand: { type: 'keyword' },
    price: { type: 'float' },
    rating: { type: 'float' },
    in_stock: { type: 'boolean' },
    created_at: { type: 'date' },
  },
});
const categories = ['laptops', 'phones', 'audio', 'wearables', 'cameras', 'accessories'];
const brands = ['Aurora', 'Nimbus', 'Vertex', 'Pulse', 'Orbit'];
const adjectives = ['Pro', 'Air', 'Max', 'Lite', 'Ultra', 'Mini'];
const nouns = ['Book', 'Pad', 'Buds', 'Watch', 'Cam', 'Dock', 'Hub', 'Drive'];
const products = Array.from({ length: 200 }, (_, i) => ({
  name: `${pick(brands)} ${pick(nouns)} ${pick(adjectives)} ${100 + i}`,
  category: pick(categories),
  brand: pick(brands),
  price: Math.round((10 + rand() * 1990) * 100) / 100,
  rating: Math.round((1 + rand() * 4) * 10) / 10,
  in_stock: rand() > 0.2,
  created_at: new Date(Date.UTC(2026, 0, 1) + Math.floor(rand() * 190) * 86400000).toISOString(),
}));
await bulk('products', products);

// --- app-logs (500 docs) ---
await createIndex('app-logs', {
  properties: {
    '@timestamp': { type: 'date' },
    level: { type: 'keyword' },
    service: { type: 'keyword' },
    message: { type: 'text' },
    latency_ms: { type: 'integer' },
    status: { type: 'integer' },
  },
});
const levels = ['info', 'info', 'info', 'warn', 'error'];
const services = ['api-gateway', 'orders', 'payments', 'search', 'auth'];
const messages = [
  'request completed',
  'cache miss, falling back to database',
  'retrying upstream call',
  'connection pool exhausted',
  'token refreshed',
  'slow query detected',
];
const logs = Array.from({ length: 500 }, () => ({
  '@timestamp': new Date(Date.UTC(2026, 6, 15) + Math.floor(rand() * 86400000)).toISOString(),
  level: pick(levels),
  service: pick(services),
  message: pick(messages),
  latency_ms: Math.floor(rand() * 900) + 5,
  status: pick([200, 200, 200, 201, 404, 500]),
}));
await bulk('app-logs', logs);

console.log('Seed done.');
```

- [ ] **Step 3: Chạy seed và verify**

Run:
```bash
node scripts/store/seed-es.mjs \
  && curl -s "http://localhost:9200/products/_count" \
  && echo \
  && curl -s "http://localhost:9200/app-logs/_count"
```
Expected: `products: 200 docs`, `app-logs: 500 docs`, hai count JSON trả `"count":200` và `"count":500`.

- [ ] **Step 4: Commit**

```bash
git add scripts/store/seed-es.mjs
git commit -m "feat: reproducible elasticsearch demo seed for store screenshots"
```

---

### Task 10: Chụp 5 screenshots

**Files:**
- Create: `scripts/store/capture-screenshots.mjs`
- Create: `docs/store/screenshots/01-search.png` … `05-dark-mode.png`

**Interfaces:**
- Consumes: ES demo từ Task 9 (`http://localhost:9200`), build từ `pnpm build` (`.output/chrome-mv3`), sharp + puppeteer-core từ Task 2.
- Produces: 5 file PNG 1280×800 24-bit không alpha, pass `verify-assets.mjs`.

**Lưu ý cho người thực thi:** script dưới dùng selector theo text/aria thật trong code (`Add connection`, `#c-name`, `#c-url`, nav `REST`, `aria-label="Toggle theme"`). UI có thể khác chi tiết nhỏ — chạy headed (`headless: false`), quan sát từng bước; nếu một selector không khớp, đọc component tương ứng trong `src/console/` để lấy selector đúng rồi sửa script. Không chụp khi màn hình chưa đúng trạng thái mô tả.

- [ ] **Step 1: Build extension mới nhất**

Run: `pnpm build`
Expected: `.output/chrome-mv3/` được tạo lại, có `icon/` và manifest đúng.

- [ ] **Step 2: Viết `scripts/store/capture-screenshots.mjs`**

```js
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const EXT = resolve('.output/chrome-mv3');
const OUT = 'docs/store/screenshots';
const shotArg = process.argv[2]; // '1'..'5' hoặc bỏ trống = tất cả

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--window-size=1280,880',
    // Profile cố định để connection/saved query giữ lại giữa các lần chạy shot 1..5;
    // nằm trong node_modules/.cache nên không dính git status và không bị wxt build xoá
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

async function clickText(text) {
  await page.locator(`::-p-text(${text})`).click();
  await sleep(300);
}

async function ensureConnection(name, url) {
  // Idempotent: profile giữ lại giữa các lần chạy, connection đã có thì tên hiện trên nav
  const exists = await page.evaluate((n) => document.body.innerText.includes(n), name);
  if (exists) return;
  // Nút "Add connection" có ở empty state của SearchPage và trong ClusterSelector
  await clickText('Add connection');
  await page.locator('#c-name').fill(name);
  await page.locator('#c-url').fill(url);
  await clickText('Save');
  await sleep(1500); // chờ health check + load indices
}

async function setEditorBody(json) {
  // Editor CodeMirror: focus rồi thay toàn bộ nội dung
  await page.locator('.cm-content').click();
  await page.keyboard.down('Meta');
  await page.keyboard.press('a');
  await page.keyboard.up('Meta');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(json, { delay: 5 });
  await sleep(300);
}

const run = async (n, fn) => {
  if (!shotArg || shotArg === String(n)) await fn();
};

// Setup chung: 1 connection tới demo cluster
await ensureConnection('Local demo', 'http://localhost:9200');

// --- 1. Search UI với hits + aggregations ---
await run(1, async () => {
  // Chọn index products trong IndicesSelect, nhập body có aggs, Run
  await clickText('products');
  await setEditorBody(
    '{"query":{"range":{"price":{"gte":10}}},"aggs":{"by_category":{"terms":{"field":"category"}},"avg_price":{"avg":{"field":"price"}}},"size":25}'
  );
  await page.keyboard.down('Meta');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Meta');
  await sleep(1500);
  await save('01-search.png');
});

// --- 2. Query console (REST view) với autocomplete đang mở ---
await run(2, async () => {
  await clickText('REST');
  await sleep(500);
  await setEditorBody('{"query":{"ma');
  // Trigger autocomplete (Ctrl+Space là binding mặc định của CodeMirror autocomplete)
  await page.keyboard.down('Control');
  await page.keyboard.press('Space');
  await page.keyboard.up('Control');
  await sleep(600);
  await save('02-console-autocomplete.png');
});

// --- 3. Saved queries + history ---
await run(3, async () => {
  // Ở REST view: lưu query hiện tại rồi mở panel saved.
  // Lưu ý: nếu chạy lại shot này, xoá query trùng tên trong panel trước khi chụp.
  await clickText('Save');
  await page.keyboard.type('Products by category');
  await clickText('Save query');
  await sleep(500);
  await clickText('Saved');
  await sleep(500);
  await save('03-saved-queries.png');
});

// --- 4. Connections (multi-cluster) ---
await run(4, async () => {
  // Thêm connection thứ 2 để selector thể hiện multi-cluster
  await ensureConnection('Staging', 'http://localhost:9200');
  // Mở cluster selector ở top nav
  await clickText('Local demo');
  await sleep(500);
  await save('04-connections.png');
});

// --- 5. Dark mode (màn search) ---
await run(5, async () => {
  await clickText('Search');
  await page.locator('[aria-label="Toggle theme"]').click();
  await sleep(500);
  await save('05-dark-mode.png');
});

await browser.close();
console.log('Done.');
```

- [ ] **Step 3: Chạy từng shot, quan sát và sửa selector nếu lệch**

Run lần lượt:
```bash
node scripts/store/capture-screenshots.mjs 1
node scripts/store/capture-screenshots.mjs 2
node scripts/store/capture-screenshots.mjs 3
node scripts/store/capture-screenshots.mjs 4
node scripts/store/capture-screenshots.mjs 5
```
Expected: mỗi lần in `saved docs/store/screenshots/0X-*.png`. Sau mỗi shot, Read file PNG để tự kiểm tra trạng thái màn hình đúng mô tả (hits table có dữ liệu, dropdown autocomplete đang mở, panel saved hiển thị, selector connections mở, theme tối). Sai thì sửa selector/flow và chạy lại shot đó.

- [ ] **Step 4: Verify máy móc**

Run: `node scripts/store/verify-assets.mjs`
Expected: 5 dòng screenshots đều `OK` (1280×800, không alpha); chỉ còn promo WARN.

- [ ] **Step 5: ⛔ CHECKPOINT — trình user duyệt 5 ảnh**

Read 5 file PNG, gửi user xem và mô tả từng ảnh. Chờ user chốt (đổi góc chụp / dữ liệu / thứ tự nếu được yêu cầu). Chỉ commit khi user đồng ý.

- [ ] **Step 6: Commit**

```bash
git add scripts/store/capture-screenshots.mjs docs/store/screenshots
git commit -m "feat: store screenshots and capture pipeline"
```

---

### Task 11: Promo tiles (440×280 + 1400×560)

**Files:**
- Create: `scripts/store/promo.html`
- Create: `scripts/store/capture-promo.mjs`
- Create: `docs/store/promo/small-440x280.png`, `docs/store/promo/marquee-1400x560.png`

**Interfaces:**
- Consumes: `docs/store/icon.svg` (Task 3).
- Produces: 2 PNG pass `verify-assets.mjs`.

- [ ] **Step 1: Viết `scripts/store/promo.html`**

Template dùng chung cho 2 size, đọc icon qua đường dẫn tương đối `../../docs/store/icon.svg`, layout scale theo viewport:

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; }
  body {
    display: flex; align-items: center; justify-content: center; gap: 4vw;
    background: linear-gradient(135deg, #0F172A 0%, #134E4A 100%);
    font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #fff;
  }
  img.icon { width: 22vh; height: 22vh; min-width: 64px; min-height: 64px; }
  .text h1 { font-size: 9vh; font-weight: 700; letter-spacing: -0.02em; }
  .text p { font-size: 4.2vh; color: #99F6E4; margin-top: 1vh; }
</style>
</head>
<body>
  <img class="icon" src="../../docs/store/icon.svg" alt="">
  <div class="text">
    <h1>Elasticvix</h1>
    <p>Elasticsearch client for Chrome</p>
  </div>
</body>
</html>
```

(Ghi chú: file nằm ở `scripts/store/`, nên đường dẫn tương đối tới icon là `../../docs/store/icon.svg`.)

- [ ] **Step 2: Viết `scripts/store/capture-promo.mjs`**

```js
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
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
```

- [ ] **Step 3: Chạy và verify**

Run:
```bash
node scripts/store/capture-promo.mjs && node scripts/store/verify-assets.mjs
```
Expected: 2 dòng `saved ...`; verify-assets in `OK` cho cả 11 asset (không còn WARN).

- [ ] **Step 4: Xem lại bằng mắt**

Read 2 file PNG — chữ không tràn, icon rõ, không méo. Nếu layout lệch ở size nhỏ, chỉnh các giá trị `vh`/`vw` trong `promo.html` và chạy lại.

- [ ] **Step 5: Commit**

```bash
git add scripts/store/promo.html scripts/store/capture-promo.mjs docs/store/promo
git commit -m "feat: promo tiles for store listing"
```

---

### Task 12: Đóng gói cuối + verify toàn bộ

**Files:**
- Create: `.output/elasticvix-1.0.0-chrome.zip` (không commit — build artifact)

**Interfaces:**
- Consumes: mọi task trước.
- Produces: zip sẵn sàng upload; toàn bộ điều kiện submit đã xanh.

- [ ] **Step 1: Toàn bộ check máy**

Run:
```bash
pnpm compile && pnpm test && pnpm build && node scripts/store/verify-assets.mjs --strict
```
Expected: tất cả exit 0, verify in 11 dòng `OK`.

- [ ] **Step 2: Tạo zip và kiểm tra nội dung**

Run:
```bash
pnpm wxt zip && unzip -p .output/elasticvix-1.0.0-chrome.zip manifest.json | node -e "
let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{
  const m = JSON.parse(s);
  if (m.name !== 'Elasticvix - Elasticsearch Client') throw new Error('bad name');
  if (!m.icons || !m.icons['128']) throw new Error('missing icons');
  if (m.version !== '1.0.0') throw new Error('bad version');
  console.log('zip manifest OK:', m.name, m.version);
});"
```
Expected: `zip manifest OK: Elasticvix - Elasticsearch Client 1.0.0`. (Nếu tên file zip khác, `ls .output/*.zip` và dùng tên thật — cập nhật luôn tên trong `docs/store/submission-checklist.md` cho khớp.)

- [ ] **Step 3: Smoke test tay trong Chrome profile sạch**

Làm theo mục B.6 của `docs/store/submission-checklist.md` (load `.output/chrome-mv3`, thêm connection tới `http://localhost:9200`, chạy search, save query, mở lại saved query). Xác nhận từng bước hoạt động — đây là gate cuối trước khi báo hoàn thành.

- [ ] **Step 4: Dọn môi trường demo**

Run: `docker rm -f elasticvix-demo && rm -rf node_modules/.cache/elasticvix-shots-profile`
Expected: container bị xoá.

- [ ] **Step 5: Commit chốt (nếu có thay đổi lặt vặt phát sinh)**

```bash
git status --short
# nếu có file thay đổi thuộc phạm vi dự án:
git add -A && git commit -m "chore: final store submission package"
```

---

## Sau khi hoàn thành

Mọi thứ user cần làm tiếp nằm trong `docs/store/submission-checklist.md` (mục A và C — tạo dev account, dán privacy policy vào Notion, upload và điền form).
