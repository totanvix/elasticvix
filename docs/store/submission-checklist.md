# Checklist submit Elasticvix lên Chrome Web Store

## A. Chuẩn bị một lần (làm tay)

- [ ] 1. Tạo Chrome Web Store developer account tại https://chrome.google.com/webstore/devconsole
      với Google account gắn email totanvix@gmail.com. Trả phí đăng ký $5 (một lần). Xác minh email.
- [x] 2. Privacy policy đã publish tại https://totanvix.github.io/elasticvix/privacy-policy/
      (repo totanvix/elasticvix, GitHub Pages từ `website/`; nguồn nội dung: `docs/store/privacy-policy.md` —
      sửa nội dung thì cập nhật cả `website/privacy-policy/index.html`).

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
      (category Developer Tools, description, support email; homepage: https://totanvix.github.io/elasticvix/).
- [ ] 9. Upload ảnh (store cho tối đa 5 screenshot, 1280x800):
      - `01-search.png` — Search UI
      - `02-console-autocomplete.png` — autocomplete đọc mapping
      - `03-cluster.png` — cluster overview
      - `04-saved-queries.png` — saved queries + response
      - `05-dark-mode.png` — dark mode + multi-cluster
      - Small promo tile: `docs/store/promo/small-440x280.png`
      - Marquee promo tile: `docs/store/promo/marquee-1400x560.png`
- [ ] 10. Tab **Privacy**: điền theo `docs/store/privacy-form.md`, dán
      https://totanvix.github.io/elasticvix/privacy-policy/ vào Privacy policy.
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

## E. Mỗi lần phát hành bản mới

- Thêm entry cho version sắp phát hành vào `src/console/changelog/releases.ts` và commit
  **trước** khi chạy `pnpm release`. `pnpm version patch` tự tạo commit tag, nên entry thêm sau
  sẽ nằm ngoài tag đó. Nội dung viết bằng tiếng Anh, mô tả lợi ích cho người dùng.
- Sau đó: `pnpm compile && pnpm test` → `pnpm release` → `pnpm zip` → upload bản zip lên dashboard.

## F. Chụp lại ảnh listing (screenshot + promo)

Chạy khi UI đổi đủ nhiều để ảnh cũ không còn đúng. Toàn bộ dùng cluster demo ở cổng **9201** —
9200 là Elasticsearch thật của dự án khác, không được đụng vào.

```bash
# 1. Cluster demo 3 node (tên node es01/es02/es03, health xanh, bảng node đủ dòng)
docker network create elasticvix-demo-net
docker run -d --name elasticvix-es01 --network elasticvix-demo-net -p 9201:9200 \
  -e node.name=es01 -e cluster.name=elasticvix-demo \
  -e discovery.seed_hosts=elasticvix-es02,elasticvix-es03 \
  -e cluster.initial_master_nodes=es01,es02,es03 \
  -e xpack.security.enabled=false -e http.cors.enabled=true -e http.cors.allow-origin='"*"' \
  -e http.cors.allow-headers=X-Requested-With,Content-Type,Content-Length,Authorization \
  -e ES_JAVA_OPTS="-Xms384m -Xmx384m" docker.elastic.co/elasticsearch/elasticsearch:8.14.0
# es02 và es03: như trên, bỏ -p và các biến http.cors, đổi node.name
ES_URL=http://localhost:9201 node scripts/store/seed-es.mjs

# 2. Chụp UI rồi ghép khung
pnpm build
node scripts/store/capture-screenshots.mjs --fresh   # thêm 1..5 để chụp lại đúng một ảnh
node scripts/store/compose-screenshots.mjs
node scripts/store/capture-promo.mjs
node scripts/store/verify-assets.mjs --strict
```

- Tiêu đề trên mỗi ảnh nằm ở `scripts/store/shots.mjs` — sửa ở đó, cả bước chụp lẫn bước ghép
  khung đều đọc chung danh sách này.
- `--fresh` xoá profile Chrome tạm để không dính connection/theme của lần chạy trước.
- Ảnh gốc chưa ghép khung nằm ở `node_modules/.cache/elasticvix-shots-raw/`.
- Chụp xong thì tắt cluster demo cho nhẹ máy: `docker stop elasticvix-es01 elasticvix-es02 elasticvix-es03`.
