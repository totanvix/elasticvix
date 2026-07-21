# GitHub Pages Homepage & elasticvix-web Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Landing page giới thiệu Elasticvix + privacy policy host bằng GitHub Pages trên repo `totanvix/elasticvix`, thay thế và xoá repo `elasticvix-web`.

**Architecture:** Site tĩnh (HTML + CSS thuần, không JS, không CDN) sống trong `website/` trên branch main; GitHub Actions workflow deploy lên Pages khi `website/**` thay đổi. Migration theo thứ tự: site mới sống → cập nhật docs + repo metadata → user cập nhật store dashboard → xoá `elasticvix-web`.

**Tech Stack:** HTML/CSS tĩnh, GitHub Actions (`actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`), `gh` CLI.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-21-github-pages-homepage-design.md`.
- Site self-contained: KHÔNG CDN, KHÔNG webfont ngoài, KHÔNG JavaScript. Light/dark theo `prefers-color-scheme`.
- Ngôn ngữ trang: tiếng Anh; copy lấy nguyên văn từ `docs/store/listing.md` — không viết copy mới.
- URL store (CTA chính): `https://chromewebstore.google.com/detail/elasticvix-elasticsearch/glnbabapnpecmdaekagajnedgkbhcgad`
- URL GitHub: `https://github.com/totanvix/elasticvix`
- URL Pages mới: `https://totanvix.github.io/elasticvix/` và `https://totanvix.github.io/elasticvix/privacy-policy/`
- Support email: `totanvix@gmail.com`
- Commit theo conventional commits, KHÔNG footer attribution (đã tắt trong `~/.claude/settings.json`).
- Push thẳng lên `main` (pattern hiện tại của repo).
- KHÔNG xoá `elasticvix-web` trước khi user xác nhận đã cập nhật store dashboard (Task 5).

---

### Task 1: Landing page (`website/index.html` + assets)

**Files:**
- Create: `website/assets/icon.svg` (copy từ `docs/store/icon.svg`)
- Create: `website/assets/01-search.png` … `05-dark-mode.png` (copy từ `docs/store/screenshots/`)
- Create: `website/index.html`

**Interfaces:**
- Produces: `website/` là root artifact cho Pages (Task 3 upload nguyên thư mục này); `website/index.html` link tới `./privacy-policy/` (Task 2 tạo trang đó).

- [ ] **Step 1: Copy assets**

```bash
mkdir -p website/assets
cp docs/store/icon.svg website/assets/icon.svg
cp docs/store/screenshots/01-search.png website/assets/01-search.png
cp docs/store/screenshots/02-console-autocomplete.png website/assets/02-console-autocomplete.png
cp docs/store/screenshots/03-saved-queries.png website/assets/03-saved-queries.png
cp docs/store/screenshots/04-connections.png website/assets/04-connections.png
cp docs/store/screenshots/05-dark-mode.png website/assets/05-dark-mode.png
ls website/assets
```

Expected: 6 files (icon.svg + 5 PNG).

- [ ] **Step 2: Viết `website/index.html`**

Nội dung đầy đủ (hero không có screenshot — screenshot 01 nằm ở feature row "Search UI" theo spec):

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Elasticvix — Elasticsearch Client for Chrome</title>
  <meta name="description" content="Elasticsearch client with query console, field-aware autocomplete, saved queries, and multi-cluster support. For ES 6.x-9.x.">
  <link rel="icon" type="image/svg+xml" href="./assets/icon.svg">
  <style>
    :root {
      color-scheme: light dark;
      --bg: #ffffff;
      --fg: #0f172a;
      --muted: #475569;
      --accent: #0d9488;
      --accent-contrast: #ffffff;
      --card: #f8fafc;
      --border: #e2e8f0;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a;
        --fg: #e2e8f0;
        --muted: #94a3b8;
        --accent: #2dd4bf;
        --accent-contrast: #042f2e;
        --card: #1e293b;
        --border: #334155;
      }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      line-height: 1.6;
    }
    a { color: var(--accent); }
    img.shot {
      width: 100%;
      height: auto;
      border: 1px solid var(--border);
      border-radius: 12px;
      display: block;
    }
    .wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; }

    /* Hero */
    .hero { text-align: center; padding: 72px 24px 56px; }
    .hero .icon { border-radius: 22px; margin-bottom: 20px; }
    .hero h1 { font-size: 40px; letter-spacing: -0.02em; }
    .hero .tagline { color: var(--muted); font-size: 20px; margin: 8px auto 24px; max-width: 640px; }
    .cta-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      border-radius: 10px;
      font-weight: 600;
      text-decoration: none;
      border: 1px solid var(--accent);
    }
    .btn-primary { background: var(--accent); color: var(--accent-contrast); }
    .btn-secondary { color: var(--accent); }
    .hero .works-with { color: var(--muted); font-size: 14px; margin-top: 20px; }

    /* Feature rows */
    .feature {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 48px;
      align-items: center;
      padding: 48px 0;
    }
    .feature:nth-child(even) .feature-text { order: 1; }
    .feature:nth-child(even) .feature-media { order: 2; }
    .feature h2 { font-size: 26px; letter-spacing: -0.01em; margin-bottom: 12px; }
    .feature ul { list-style: none; }
    .feature li { padding-left: 24px; position: relative; margin-bottom: 10px; color: var(--muted); }
    .feature li::before { content: "•"; color: var(--accent); position: absolute; left: 8px; }
    @media (max-width: 760px) {
      .feature { grid-template-columns: 1fr; gap: 24px; padding: 32px 0; }
      .feature:nth-child(even) .feature-text { order: 0; }
      .feature:nth-child(even) .feature-media { order: 0; }
    }

    /* Privacy */
    .privacy {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 40px;
      margin: 48px 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 48px;
      align-items: center;
    }
    .privacy h2 { font-size: 26px; margin-bottom: 12px; }
    .privacy p { color: var(--muted); margin-bottom: 12px; }
    @media (max-width: 760px) { .privacy { grid-template-columns: 1fr; padding: 24px; } }

    /* Footer */
    footer {
      border-top: 1px solid var(--border);
      margin-top: 32px;
      padding: 32px 24px 48px;
      text-align: center;
      color: var(--muted);
      font-size: 14px;
    }
    footer nav { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; margin-bottom: 12px; }
  </style>
</head>
<body>
  <section class="hero">
    <svg class="icon" width="96" height="96" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="128" height="128" rx="28" fill="#0F172A"/>
      <rect x="28" y="30" width="72" height="16" rx="8" fill="#14B8A6"/>
      <rect x="28" y="56" width="52" height="16" rx="8" fill="#FACC15"/>
      <rect x="28" y="82" width="72" height="16" rx="8" fill="#F472B6"/>
    </svg>
    <h1>Elasticvix</h1>
    <p class="tagline">An Elasticsearch client that runs entirely in your browser. Connect to any cluster and start querying in seconds — no server, no desktop app.</p>
    <div class="cta-row">
      <a class="btn btn-primary" href="https://chromewebstore.google.com/detail/elasticvix-elasticsearch/glnbabapnpecmdaekagajnedgkbhcgad">Add to Chrome</a>
      <a class="btn btn-secondary" href="https://github.com/totanvix/elasticvix">View on GitHub</a>
    </div>
    <p class="works-with">Works with Elasticsearch 6.x, 7.x, 8.x (tested) and 9.x (best effort)</p>
  </section>

  <main class="wrap">
    <section class="feature">
      <div class="feature-media">
        <img class="shot" src="./assets/02-console-autocomplete.png" alt="Query console with field-aware autocomplete" width="1280" height="800">
      </div>
      <div class="feature-text">
        <h2>Query Console</h2>
        <ul>
          <li>Write Query DSL with autocomplete that knows your data: suggestions include real field names read from your index mappings, not just keywords</li>
          <li>Context-aware suggestions for API endpoints and query DSL</li>
          <li>JSON linting, formatting, and Cmd/Ctrl+Enter to run</li>
        </ul>
      </div>
    </section>

    <section class="feature">
      <div class="feature-media">
        <img class="shot" src="./assets/01-search.png" alt="Search UI with hits table" width="1280" height="800" loading="lazy">
      </div>
      <div class="feature-text">
        <h2>Search UI</h2>
        <ul>
          <li>Pick indices and search without hand-writing full requests</li>
          <li>Results in a hits table with a document detail view</li>
          <li>Run aggregations and inspect results in the raw response view</li>
          <li>Download results as JSON</li>
        </ul>
      </div>
    </section>

    <section class="feature">
      <div class="feature-media">
        <img class="shot" src="./assets/03-saved-queries.png" alt="Saved queries with names and tags" width="1280" height="800" loading="lazy">
      </div>
      <div class="feature-text">
        <h2>Saved Queries &amp; History</h2>
        <ul>
          <li>Save queries with names and tags, find them again with search</li>
          <li>Automatic query history</li>
        </ul>
      </div>
    </section>

    <section class="feature">
      <div class="feature-media">
        <img class="shot" src="./assets/04-connections.png" alt="Multiple cluster connections" width="1280" height="800" loading="lazy">
      </div>
      <div class="feature-text">
        <h2>Multi-Cluster</h2>
        <ul>
          <li>Store multiple connections and switch instantly</li>
          <li>Cluster health at a glance</li>
          <li>Auth: none, basic auth, API key, or bearer token</li>
        </ul>
      </div>
    </section>

    <section class="privacy">
      <div>
        <h2>Your data stays yours</h2>
        <p>All data stays on your machine. Connections, credentials, saved queries, and history are stored locally in your browser and sent only to the Elasticsearch clusters you configure. No analytics, no tracking, nothing ever sent to us.</p>
        <p><a href="./privacy-policy/">Read the privacy policy</a></p>
      </div>
      <div>
        <img class="shot" src="./assets/05-dark-mode.png" alt="Elasticvix in dark mode" width="1280" height="800" loading="lazy">
      </div>
    </section>
  </main>

  <footer>
    <nav>
      <a href="https://github.com/totanvix/elasticvix">GitHub</a>
      <a href="https://chromewebstore.google.com/detail/elasticvix-elasticsearch/glnbabapnpecmdaekagajnedgkbhcgad">Chrome Web Store</a>
      <a href="./privacy-policy/">Privacy Policy</a>
      <a href="mailto:totanvix@gmail.com">totanvix@gmail.com</a>
    </nav>
    <p>Elasticvix — Elasticsearch client for Chrome</p>
  </footer>
</body>
</html>
```

- [ ] **Step 3: Verify nội dung trang**

```bash
grep -c "chromewebstore.google.com/detail/elasticvix-elasticsearch/glnbabapnpecmdaekagajnedgkbhcgad" website/index.html
grep -c "github.com/totanvix/elasticvix" website/index.html
grep -c 'href="./privacy-policy/"' website/index.html
grep -c "<script" website/index.html
grep -cE "https?://(fonts|cdn|unpkg|jsdelivr)" website/index.html
```

Expected: `2`, `2`, `2`, `0` (grep exit 1 khi 0 match — đúng kỳ vọng), `0` (exit 1). Không JS, không CDN.

- [ ] **Step 4: Xem thử bằng browser local**

```bash
cd website && python3 -m http.server 8899 &
sleep 1 && curl -s -o /dev/null -w "%{http_code}" http://localhost:8899/
```

Expected: `200`. Mở `http://localhost:8899/` kiểm tra mắt thường: hero, 4 feature rows xen kẽ, privacy card, footer; thử cả dark mode. Sau đó `kill %1`.

- [ ] **Step 5: Commit**

```bash
git add website/
git commit -m "feat: product landing page for github pages"
```

---

### Task 2: Trang privacy policy (`website/privacy-policy/index.html`)

**Files:**
- Create: `website/privacy-policy/index.html`
- Reference (không sửa): `docs/store/privacy-policy.md`

**Interfaces:**
- Consumes: style tokens giống Task 1 (inline CSS riêng, không share file).
- Produces: URL `/privacy-policy/` mà `index.html` (Task 1) và store dashboard (Task 5) trỏ tới.

- [ ] **Step 1: Viết `website/privacy-policy/index.html`**

Nội dung giữ NGUYÊN VĂN từ `docs/store/privacy-policy.md` (effective date July 16, 2026):

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Privacy Policy — Elasticvix</title>
  <meta name="description" content="Elasticvix privacy policy. All data stays on your machine.">
  <link rel="icon" type="image/svg+xml" href="../assets/icon.svg">
  <style>
    :root {
      color-scheme: light dark;
      --bg: #ffffff;
      --fg: #0f172a;
      --muted: #475569;
      --accent: #0d9488;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a;
        --fg: #e2e8f0;
        --muted: #94a3b8;
        --accent: #2dd4bf;
      }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      line-height: 1.7;
    }
    a { color: var(--accent); }
    main { max-width: 720px; margin: 0 auto; padding: 48px 24px 72px; }
    .back { font-size: 14px; }
    h1 { font-size: 32px; letter-spacing: -0.02em; margin: 16px 0 4px; }
    .effective { color: var(--muted); font-size: 14px; margin-bottom: 28px; }
    h2 { font-size: 20px; margin: 28px 0 8px; }
    p, li { color: var(--muted); margin-bottom: 10px; }
    ul { padding-left: 24px; }
  </style>
</head>
<body>
  <main>
    <a class="back" href="../">&larr; Elasticvix</a>
    <h1>Elasticvix Privacy Policy</h1>
    <p class="effective">Effective date: July 16, 2026</p>

    <p>Elasticvix ("the extension") is a Chrome extension that provides a client interface for Elasticsearch clusters.</p>

    <h2>Summary</h2>
    <p>Elasticvix does not collect, transmit, sell, or share any personal data. Everything you enter stays in your browser.</p>

    <h2>Data stored locally</h2>
    <p>The extension stores the following data locally in your browser (using Chrome extension storage and IndexedDB):</p>
    <ul>
      <li>Connection profiles you create: cluster name, base URL, and credentials (username/password, API key, or bearer token) if you configure authentication</li>
      <li>Saved queries, including their names and tags</li>
      <li>Query history</li>
      <li>UI preferences such as light/dark theme</li>
    </ul>
    <p>This data never leaves your device except as described below.</p>

    <h2>Where your data goes</h2>
    <p>The only network requests the extension makes are to the Elasticsearch cluster URLs you configure yourself. Credentials are sent only to their corresponding cluster as part of those requests.</p>
    <p>The extension contains no analytics, no tracking, no advertising, and no third-party services. The developer operates no server and receives no data from the extension.</p>

    <h2>Permissions</h2>
    <p>The extension requests access to all URLs solely because an Elasticsearch cluster may be hosted on any address (localhost, private networks, or cloud providers). The extension has no content scripts and never reads or modifies the websites you visit.</p>

    <h2>Data removal</h2>
    <p>You can delete connections and saved queries inside the extension. Query history is automatically capped, and uninstalling the extension removes all locally stored data.</p>

    <h2>Changes to this policy</h2>
    <p>If this policy changes, the updated version will be published at this page with a new effective date.</p>

    <h2>Contact</h2>
    <p><a href="mailto:totanvix@gmail.com">totanvix@gmail.com</a></p>
  </main>
</body>
</html>
```

- [ ] **Step 2: Verify nội dung khớp bản gốc**

```bash
grep -c "Effective date: July 16, 2026" website/privacy-policy/index.html
grep -c "does not collect, transmit, sell, or share" website/privacy-policy/index.html
grep -c "<script" website/privacy-policy/index.html
```

Expected: `1`, `1`, `0` (exit 1). Đối chiếu mắt thường từng heading với `docs/store/privacy-policy.md` — 8 mục: Summary, Data stored locally, Where your data goes, Permissions, Data removal, Changes to this policy, Contact (+ đoạn mở đầu).

- [ ] **Step 3: Commit**

```bash
git add website/privacy-policy/
git commit -m "feat: privacy policy page on github pages site"
```

---

### Task 3: Workflow deploy + bật Pages + verify site live

**Files:**
- Create: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: thư mục `website/` (Task 1, 2).
- Produces: site live tại `https://totanvix.github.io/elasticvix/` — điều kiện tiên quyết cho Task 4 (docs trỏ URL mới) và Task 5 (store dashboard).

- [ ] **Step 1: Viết `.github/workflows/deploy-pages.yml`**

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - "website/**"
      - ".github/workflows/deploy-pages.yml"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: website
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Bật GitHub Pages chế độ workflow**

```bash
gh api repos/totanvix/elasticvix/pages -X POST -f build_type=workflow
```

Expected: JSON có `"build_type": "workflow"`. Nếu lỗi 409 (Pages đã tồn tại) thì chạy:

```bash
gh api repos/totanvix/elasticvix/pages -X PUT -f build_type=workflow
```

- [ ] **Step 3: Commit và push**

```bash
git add .github/workflows/deploy-pages.yml
git commit -m "ci: github pages deploy workflow"
git push origin main
```

- [ ] **Step 4: Chờ workflow xanh**

```bash
gh run watch --repo totanvix/elasticvix $(gh run list --repo totanvix/elasticvix --workflow=deploy-pages.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: kết thúc với `✓ ... completed with 'success'`. Nếu fail: đọc log bằng `gh run view --log-failed`, sửa, push lại — KHÔNG bỏ qua.

- [ ] **Step 5: Verify site live**

```bash
curl -s -o /dev/null -w "home: %{http_code}\n" https://totanvix.github.io/elasticvix/
curl -s -o /dev/null -w "privacy: %{http_code}\n" https://totanvix.github.io/elasticvix/privacy-policy/
curl -s -o /dev/null -w "asset: %{http_code}\n" https://totanvix.github.io/elasticvix/assets/01-search.png
```

Expected: cả ba `200` (Pages lần đầu có thể trễ ~1-2 phút — retry trước khi kết luận fail).

---

### Task 4: Cập nhật docs references + repo metadata

**Files:**
- Modify: `docs/store/listing.md` (dòng 61)
- Modify: `docs/store/submission-checklist.md` (dòng 7-9, 24, 30)
- Modify: `docs/store/privacy-form.md` (dòng 36)

**Interfaces:**
- Consumes: URL mới đã live (Task 3).
- Produces: docs sạch tham chiếu `elasticvix-web`; repo metadata trỏ site mới.

- [ ] **Step 1: Thay URL trong 3 file docs**

Trong `docs/store/listing.md`, mục `## Homepage`: thay
`https://totanvix.github.io/elasticvix-web/` → `https://totanvix.github.io/elasticvix/`.

Trong `docs/store/privacy-form.md` (dòng 36): thay
`https://totanvix.github.io/elasticvix-web/privacy-policy/` → `https://totanvix.github.io/elasticvix/privacy-policy/`.

Trong `docs/store/submission-checklist.md`:
- Mục 2 (dòng 7-9) thay cả khối bằng:

```markdown
- [x] 2. Privacy policy đã publish tại https://totanvix.github.io/elasticvix/privacy-policy/
      (repo totanvix/elasticvix, GitHub Pages từ `website/`; nguồn nội dung: `docs/store/privacy-policy.md` —
      sửa nội dung thì cập nhật cả `website/privacy-policy/index.html`).
```

- Dòng 24: thay `homepage: https://totanvix.github.io/elasticvix-web/` → `homepage: https://totanvix.github.io/elasticvix/`.
- Dòng 30: thay `https://totanvix.github.io/elasticvix-web/privacy-policy/` → `https://totanvix.github.io/elasticvix/privacy-policy/`.

- [ ] **Step 2: Verify không còn tham chiếu**

```bash
grep -rn "elasticvix-web" docs/store/
```

Expected: không match (exit 1). (`docs/superpowers/` được phép giữ tham chiếu lịch sử trong spec/plan.)

- [ ] **Step 3: Set repo metadata**

```bash
gh repo edit totanvix/elasticvix \
  --homepage "https://totanvix.github.io/elasticvix/" \
  --description "Elasticsearch client with query console, field-aware autocomplete, saved queries, and multi-cluster support. For ES 6.x-9.x."
gh api repos/totanvix/elasticvix --jq '{homepage, description}'
```

Expected: JSON hiển thị đúng homepage + description vừa set.

- [ ] **Step 4: Commit và push**

```bash
git add docs/store/
git commit -m "docs: point store docs to elasticvix github pages"
git push origin main
```

---

### Task 5: User cập nhật store dashboard, rồi xoá elasticvix-web

**Files:** không sửa file — thao tác GitHub/dashboard.

**Interfaces:**
- Consumes: site mới live (Task 3), URL mới trong docs (Task 4).
- Produces: `elasticvix-web` bị xoá; migration hoàn tất.

- [ ] **Step 1: BLOCKING — yêu cầu user cập nhật store dashboard**

Nhắn user (đợi xác nhận, KHÔNG tự tiếp tục):

> Vào https://chrome.google.com/webstore/devconsole → item Elasticvix:
> - Tab **Store listing** → Homepage: `https://totanvix.github.io/elasticvix/`
> - Tab **Privacy** → Privacy policy: `https://totanvix.github.io/elasticvix/privacy-policy/`
> - Save/Submit. Lưu ý: thay đổi listing có thể trigger review lại.
> Xác nhận xong để tôi xoá repo elasticvix-web.

- [ ] **Step 2: Xoá repo elasticvix-web (sau xác nhận của user)**

```bash
gh repo delete totanvix/elasticvix-web --yes
```

Nếu lỗi thiếu scope `delete_repo`: chạy `gh auth refresh -h github.com -s delete_repo` (user phải hoàn tất OAuth trên browser) rồi thử lại, HOẶC hướng dẫn user xoá tay: GitHub → repo `elasticvix-web` → Settings → Danger Zone → Delete this repository.

- [ ] **Step 3: Verify repo đã xoá và site cũ chết, site mới sống**

```bash
gh api repos/totanvix/elasticvix-web 2>&1 | grep -c "Not Found"
curl -s -o /dev/null -w "new site: %{http_code}\n" https://totanvix.github.io/elasticvix/
```

Expected: `1` (404 Not Found) và `new site: 200`.
