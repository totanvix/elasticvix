# Elasticvix — Gói publish lên Chrome Web Store — Thiết kế

**Ngày:** 2026-07-16
**Trạng thái:** Đã brainstorm & duyệt, chờ viết implementation plan

---

## 1. Bối cảnh & mục tiêu

Extension Elasticvix (WXT + React, MV3) đã hoàn thiện các tính năng lõi: query console với autocomplete field-aware, search UI (hits table, aggregations, download), saved queries + history, multi-cluster với 4 kiểu auth, light/dark mode. Spec gốc (2026-07-07) xác định đích đến là **publish công khai lên Chrome Web Store**.

Mục tiêu của sub-project này: chuẩn bị **đầy đủ mọi nội dung, asset và thay đổi code** để submit lần đầu lên Chrome Web Store, kèm checklist các bước thủ công.

**Không thuộc phạm vi:** landing page riêng, kế hoạch marketing (Product Hunt, Reddit...), thay đổi tính năng extension.

---

## 2. Quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Host permissions | **Giữ install-time rộng** (`http://*/*`, `https://*/*`) như hiện tại — không sửa code permissions. Chấp nhận in-depth review, đầu tư viết justification thuyết phục (elasticvue là tiền lệ đã được duyệt với quyền tương tự) |
| Icon | Claude thiết kế 2–3 phương án SVG, user duyệt, export PNG 16/32/48/128 |
| Privacy policy | Soạn nội dung markdown, **user dán vào Notion public page** để lấy URL công khai. Repo GitHub giữ private |
| Screenshots | Claude dựng ES demo local (Docker) + seed dữ liệu mẫu + browser automation chụp 1280×800. User duyệt trước khi dùng |
| Ngôn ngữ listing | **Tiếng Anh** (locale duy nhất) |
| Tên trên store | **`Elasticvix - Elasticsearch Client`** (title lấy từ manifest `name`) |
| Visibility | **Public ngay** khi được duyệt |
| Email hỗ trợ / dev account | **totanvix@gmail.com** |
| Phạm vi | Gói submit bắt buộc **+ 2 promo tiles** (440×280, 1400×560) |
| Version lần đầu | Giữ `1.0.0` |

---

## 3. Deliverables

| # | Hạng mục | Dạng | Nơi lưu |
|---|----------|------|---------|
| 1 | Icon: SVG gốc + PNG 16/32/48/128 | Asset | `public/icon/` (PNG), `docs/store/icon.svg` (gốc) |
| 2 | 5 screenshot 1280×800, PNG 24-bit không alpha | Asset | `docs/store/screenshots/` |
| 3 | Promo tiles: small 440×280 + marquee 1400×560 | Asset | `docs/store/promo/` |
| 4 | Nội dung listing EN: title, summary ≤132 ký tự, mô tả chi tiết, category | Text | `docs/store/listing.md` |
| 5 | Privacy policy (nguồn để dán vào Notion) | Text | `docs/store/privacy-policy.md` |
| 6 | Privacy form: single purpose, permission justifications, data usage, remote code | Text | `docs/store/privacy-form.md` |
| 7 | Checklist submit từng bước (việc thủ công của user) | Text | `docs/store/submission-checklist.md` |
| 8 | File zip sẵn sàng upload | Build | `.output/elasticvix-1.0.0-chrome.zip` (từ `wxt zip`) |

---

## 4. Thay đổi code

Chỉ 2 file, không đụng logic:

### 4.1 `wxt.config.ts`
- `manifest.name`: `Elasticvix - Elasticsearch Client` (≤75 ký tự — đây chính là title trên store)
- `manifest.description`: bản tối ưu ≤132 ký tự (đây chính là summary trên store). Draft: *"Elasticsearch client with query console, field-aware autocomplete, saved queries, and multi-cluster support. For ES 6.x–9.x."* (kiểm đếm ký tự khi implement)
- Icons: đặt PNG vào `public/icon/{16,32,48,128}.png` theo convention của WXT để tự sinh `manifest.icons` (nếu WXT không tự nhận thì khai tường minh trong `manifest.icons`)
- `permissions`/`host_permissions`: **giữ nguyên**

### 4.2 `package.json`
- `version` giữ `1.0.0`. Bổ sung `description`, `author` cho gọn gàng (không ảnh hưởng store).

---

## 5. Nội dung listing (EN)

- **Category:** Developer Tools
- **Title:** từ manifest — `Elasticvix - Elasticsearch Client`
- **Summary:** từ manifest — bản ≤132 ký tự ở mục 4.1
- **Mô tả chi tiết** — cấu trúc:
  1. Một câu hook: client Elasticsearch chạy ngay trong Chrome, không cần cài đặt server
  2. Nhóm tính năng:
     - Query console + autocomplete theo mapping thật của index (field-aware)
     - Search UI: hits table, aggregations view, document dialog, download kết quả
     - Saved queries có tên/tags/tìm kiếm + lịch sử tự động
     - Multi-cluster: nhiều connection, chuyển đổi nhanh, health dot; auth: none, basic, API key, bearer
     - Light/dark mode
  3. Phiên bản ES hỗ trợ: 6.x, 7.x, 8.x (tested), 9.x (best-effort)
  4. Đoạn privacy: *"All data stays on your machine — connections, credentials, and queries are stored locally and sent only to the Elasticsearch clusters you configure. No analytics, no tracking."*
- **Support email:** totanvix@gmail.com. **Không khai homepage** (repo private, chưa có landing).

---

## 6. Privacy & compliance (privacy tab trên dashboard)

1. **Single purpose:** "Client interface for Elasticsearch: connect to clusters, run queries, and browse search results."
2. **Justification `storage`:** lưu connection profiles, saved queries, query history — hoàn toàn local trên máy user.
3. **Justification host permissions rộng (điểm mấu chốt của review):**
   - User tự nhập URL cluster Elasticsearch bất kỳ: self-hosted, IP nội bộ, mọi port, cloud → không thể liệt kê domain trước
   - Extension **không có content script**, không đọc/sửa trang web nào
   - Chỉ background service worker gửi HTTP request, và chỉ đến đúng URL cluster user đã cấu hình
4. **Data usage:** khai **không thu thập dữ liệu người dùng** — credentials và queries chỉ lưu local, không gửi về bất kỳ server nào của developer (chuẩn khai của dev-tool local-only; tránh badge "collects authentication information" trên listing). Tick đủ 3 certification của CWS.
5. **Remote code:** No — toàn bộ JS đóng gói trong zip.
6. **Privacy policy URL:** Notion public page (user tạo từ deliverable #5).

### Nội dung privacy policy (khung)
- Extension không có analytics, tracking, quảng cáo
- Dữ liệu được lưu: connection profiles (gồm credentials), saved queries, query history — trong storage local của trình duyệt (IndexedDB / chrome.storage)
- Dữ liệu đi đâu: chỉ đến các cluster Elasticsearch user tự cấu hình; không bao giờ đến server của developer
- Cách xoá dữ liệu: xoá connection/queries trong app hoặc gỡ extension
- Ngày hiệu lực + contact: totanvix@gmail.com

---

## 7. Assets

### 7.1 Icon
- 2–3 phương án SVG: biểu tượng gợi Elasticsearch (khối cluster / tia search) + nét riêng "vix"; nền phẳng; phải nhận diện tốt ở 16×16
- Render các phương án ra PNG cho user xem và chọn
- Export PNG 16/32/48/128 → `public/icon/`

### 7.2 Screenshots (5 ảnh, 1280×800, PNG 24-bit không alpha)
1. Search UI — hits table + aggregations panel, dữ liệu e-commerce mẫu
2. Query console — autocomplete field-aware đang mở gợi ý
3. Saved queries + history
4. Connections — multi-cluster với health dot
5. Dark mode — chụp lại màn search (màn nhiều dữ liệu nhất, thể hiện theme tốt nhất)

**Cách sản xuất:** Elasticsearch chạy Docker local → seed 2–3 index dữ liệu mẫu sạch (products, logs) → build extension, load vào Chrome qua browser automation → viewport đúng 1280×800 → chụp → script hậu kỳ kiểm tra kích thước + strip alpha channel. User duyệt cả 5 ảnh.

### 7.3 Promo tiles
- Small tile 440×280 + marquee 1400×560
- Dựng bằng HTML/CSS (nền gradient theo màu brand + icon + tagline "Elasticsearch client for Chrome") → chụp đúng kích thước → cùng pipeline kiểm tra như screenshots

---

## 8. Verify trước khi submit

- `pnpm compile` và `pnpm test` xanh
- `wxt zip` → giải nén kiểm tra manifest: có `icons` đủ 4 size, `name`, `description` đúng bản chốt
- Script kiểm tra toàn bộ ảnh: đúng kích thước từng loại, PNG 24-bit, không alpha
- Load bản build vào Chrome profile sạch, đi qua flow chính: thêm connection → search → save query → mở lại saved query

---

## 9. Checklist submit (các bước thủ công của user)

Soạn chi tiết trong `docs/store/submission-checklist.md`, khung:

1. Tạo Chrome Web Store developer account với totanvix@gmail.com (phí $5 một lần)
2. Dán `privacy-policy.md` vào Notion, publish public, lấy URL
3. Tạo item mới trên dashboard, upload zip
4. Dán nội dung từ `listing.md` (category, mô tả), upload screenshots + promo tiles
5. Điền privacy tab theo `privacy-form.md`, dán URL Notion
6. Distribution: Public, mọi region, free
7. Submit review — lưu ý: vì host permissions rộng, review có thể kéo dài vài ngày đến vài tuần; nếu bị hỏi thêm, trả lời dựa trên justification đã soạn

---

## 10. Rủi ro & ứng phó

| Rủi ro | Ứng phó |
|---|---|
| Bị reject vì host permissions rộng | Justification đã soạn kỹ; nếu vẫn reject, phương án B là chuyển sang `optional_host_permissions` xin động (đã có thiết kế trong spec gốc 2026-07-07) |
| Khai data usage sai → gỡ listing | Khai "không thu thập" chỉ đúng khi extension thực sự không gửi telemetry — hiện tại đúng; nếu sau này thêm analytics phải cập nhật khai báo + privacy policy trước khi ship |
| WXT không tự nhận icon trong `public/icon/` | Khai tường minh `manifest.icons` trong `wxt.config.ts` |
| Screenshot bị lệch kích thước / có alpha | Script hậu kỳ verify tự động cả 3 điều kiện trước khi coi là xong |
