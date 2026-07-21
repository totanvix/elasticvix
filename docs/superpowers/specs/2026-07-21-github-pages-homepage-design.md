# Elasticvix — Trang chủ GitHub Pages & thay thế elasticvix-web — Thiết kế

**Ngày:** 2026-07-21
**Trạng thái:** Đã brainstorm & duyệt, chờ viết implementation plan

---

## 1. Bối cảnh & mục tiêu

Repo `totanvix/elasticvix` vừa được chuyển public. Extension đã live trên Chrome Web Store
(https://chromewebstore.google.com/detail/elasticvix-elasticsearch/glnbabapnpecmdaekagajnedgkbhcgad, v1.0.0).

Hiện tại homepage + privacy policy được host tạm trên repo phụ `totanvix/elasticvix-web`
(GitHub Pages, legacy build từ branch main): một trang placeholder tối giản và trang privacy policy.
Store dashboard đang trỏ vào các URL `elasticvix-web`.

Mục tiêu:

1. Xây **trang chủ giới thiệu sản phẩm** đúng nghĩa (landing page) host bằng GitHub Pages
   ngay trên repo `elasticvix`.
2. **Thay thế hoàn toàn `elasticvix-web`**: chuyển privacy policy sang site mới, cập nhật mọi
   tham chiếu trong docs, cuối cùng xoá repo `elasticvix-web`.

**Không thuộc phạm vi:** custom domain, analytics, blog/changelog, i18n, thay đổi code extension.

---

## 2. Quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Cơ chế hosting | **GitHub Actions deploy từ thư mục `website/` trên main** (`actions/upload-pages-artifact` + `actions/deploy-pages`), trigger khi push thay đổi `website/**` + `workflow_dispatch`. Bật Pages ở chế độ workflow qua `gh api` |
| Vị trí source | `website/` trên branch main (không dùng branch `gh-pages`, không dùng `/docs` vì sẽ publish tài liệu nội bộ) |
| URL mới | `https://totanvix.github.io/elasticvix/` và `https://totanvix.github.io/elasticvix/privacy-policy/` |
| Công nghệ trang | HTML + CSS thuần, self-contained (không CDN, không framework, không JS logic), light/dark theo `prefers-color-scheme` |
| Ngôn ngữ | Tiếng Anh (khớp store listing) |
| Nội dung | Tái sử dụng copy đã duyệt trong `docs/store/listing.md` — không viết copy mới |
| CTA chính | "Add to Chrome" → link store ở trên |
| Số phận elasticvix-web | **Xoá repo** — nhưng chỉ sau khi site mới sống VÀ user đã cập nhật store dashboard |

---

## 3. Cấu trúc site

```
website/
├── index.html              # Landing page
├── privacy-policy/
│   └── index.html          # Render từ docs/store/privacy-policy.md, giữ nguyên nội dung + effective date
└── assets/
    ├── icon.svg            # Từ docs/store/icon.svg
    └── *.png               # Screenshots copy từ docs/store/screenshots/ (01→05)
```

Bố cục `index.html`:

1. **Hero** — icon, tên "Elasticvix", tagline "Elasticsearch client that runs entirely in your browser",
   nút chính **Add to Chrome** (link store), nút phụ **View on GitHub**.
2. **Screenshot chính** — `01-search.png`.
3. **Features** — 4 nhóm nguyên văn từ listing, mỗi nhóm kèm screenshot tương ứng:
   Query Console (`02-console-autocomplete.png`), Search UI (`01-search.png` — dùng lại từ hero
   hoặc bỏ ở hero nếu trùng lặp gây nặng trang), Saved Queries & History (`03-saved-queries.png`),
   Multi-Cluster (`04-connections.png`). `05-dark-mode.png` minh hoạ cạnh khối Privacy hoặc
   phần "Works with" tuỳ bố cục khi triển khai.
4. **Works with** — ES 6.x, 7.x, 8.x (tested), 9.x (best effort).
5. **Privacy** — "All data stays on your machine..." + link privacy policy.
6. **Footer** — GitHub, Chrome Web Store, Privacy Policy, support email.

---

## 4. Migration khỏi elasticvix-web — thứ tự bắt buộc

Store listing đang live và trỏ vào URL cũ, nên thứ tự sau là bắt buộc để không có link chết:

1. Deploy site mới trên repo `elasticvix`, verify cả hai URL trả 200.
2. Cập nhật docs trong repo: mọi URL `elasticvix-web` → `elasticvix` trong
   `docs/store/listing.md`, `docs/store/submission-checklist.md`, `docs/store/privacy-form.md`.
   Ghi chú trong checklist: sửa privacy policy thì cập nhật cả `docs/store/privacy-policy.md`
   lẫn `website/privacy-policy/index.html`.
3. Set metadata repo GitHub `totanvix/elasticvix`: homepage = URL Pages mới,
   description = summary trong manifest ("Elasticsearch client with query console, field-aware
   autocomplete, saved queries, and multi-cluster support. For ES 6.x-9.x.").
4. **User (thao tác tay):** cập nhật store dashboard — trường Homepage và Privacy policy URL
   sang URL mới. Lưu ý: thay đổi listing có thể trigger review lại.
5. Chỉ sau khi bước 4 xong: xoá repo `totanvix/elasticvix-web`
   (cần `gh auth` scope `delete_repo`, hoặc user xoá tay trên GitHub UI).

---

## 5. Verification

- Workflow deploy chạy xanh trên GitHub Actions.
- `curl -sI https://totanvix.github.io/elasticvix/` và `.../privacy-policy/` trả 200.
- Trang render đúng ở light + dark mode, screenshots hiển thị, các link (store, GitHub,
  privacy, mailto) đúng đích.
- Không còn chuỗi `elasticvix-web` nào trong repo (ngoài spec/plan lịch sử ghi lại quá trình).

Site tĩnh không có JS logic → không cần test framework; verify thủ công theo tiêu chí trên.
