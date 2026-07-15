# Elasticvix — Trang Search kiểu Elasticvue + sửa quản lý connection — Thiết kế

**Ngày:** 2026-07-15
**Trạng thái:** Đã brainstorm & duyệt, chờ viết implementation plan
**Nhánh nền:** `feat/console-ui` (Plan 2 — Console UI đã xong, chưa merge)

---

## 1. Bối cảnh & mục tiêu

Sau Plan 2 (console REST 3-pane), người dùng nêu 3 yêu cầu:

1. **Bug:** sau khi thêm connection thì không sửa được thông tin (không có lối vào Edit; dialog cũng đóng băng state cũ).
2. **Bám sát UI của Elasticvue** cho dễ dùng — cụ thể là trải nghiệm trang **Search** (screenshot Elasticvue: chọn indices → query → bảng kết quả).
3. **Cho user chọn indices** thay vì phải tự gõ index vào request line.

Phạm vi đợt này (đã chốt với user):

> **Thêm trang Search kiểu Elasticvue** (multi-select indices + query editor + bảng hits với đủ 4 tính năng phụ: Aggregations tab, filter trang, download JSON, xem chi tiết document) · **giữ nguyên console REST hiện tại** · **top bar đổi thành nav kiểu Elasticvue** · **sửa bug edit/delete connection**.

Hướng visual: theo **cấu trúc & thao tác** của Elasticvue (nav trên, thanh chọn indices, tab HITS/AGGREGATIONS, bảng dày đặc, phân trang góc phải) nhưng **giữ identity Elasticvix** — shadcn tokens, font Be Vietnam Pro, dark mode `.dark`. Không thêm font/màu/dependency UI mới ngoài các component shadcn copy-in cần thiết.

---

## 2. Quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Phạm vi UI | Thêm trang **Search** riêng, giữ console REST; không clone các trang khác của Elasticvue (Nodes/Shards/Indices/Snapshots để sau) |
| Điều hướng | **State đơn giản** `'search' \| 'rest'` ở `App`, persist vào `localStorage`; **không router** |
| Chọn indices | **Multi-select từ danh sách** (`GET _cat/indices?format=json`), có ô search lọc; **không** hỗ trợ index pattern tự do ở v1 |
| Index hệ thống | Ẩn index tên bắt đầu bằng `.` khỏi danh sách chọn (dùng console REST nếu cần) |
| Trang Search v1 | Bảng hits + **Aggregations tab + filter trang hiện tại + download JSON + dialog chi tiết document** (đủ 4 tính năng phụ) |
| Sort bảng | **Client-side trên trang hiện tại** (tránh lỗi fielddata khi sort text field qua ES) — ghi rõ giới hạn trên UI/spec |
| Phân trang | State from/size của bảng **ghi đè** `from`/`size` trong query body (giống Elasticvue); size 10/25/50/100, mặc định 25 |
| Edit/Delete connection | Qua **cluster selector dropdown** ở top bar (mỗi row có nút edit/delete); dialog remount bằng `key` + prefill đủ auth |
| Search & History | Query chạy từ trang Search **không** ghi vào History/Saved (chỉ console REST ghi) |
| Persist trang Search | Indices đã chọn + query text lưu **per-connection** vào `localStorage` |

---

## 3. Kiến trúc & điều hướng

### 3.1 App & view state

- `App` thêm `useState<'search' | 'rest'>`, khởi tạo từ `localStorage` (key ví dụ `elasticvix.view`), ghi lại khi đổi.
- View `rest` = console 3-pane hiện tại giữ nguyên (left rail Saved/History chỉ thuộc REST).
- View `search` = `SearchPage` mới, chiếm toàn bộ vùng dưới top bar.

### 3.2 Top bar mới (`src/console/nav/TopNav.tsx`)

Kiểu Elasticvue:

- **Trái:** brand "Elasticvix" + **cluster selector** — nút hiển thị `● tên-connection · version` với chấm health màu:
  - xanh/vàng/đỏ theo `GET _cluster/health` (qua `esRequest` sẵn có), fetch khi đổi connection active;
  - **xám** khi không kết nối được / chưa có connection.
- **Phải:** 2 tab nav **SEARCH | REST** (uppercase, letter-spacing — vibe Elasticvue nhưng style bằng shadcn tokens) + theme toggle hiện có.

### 3.3 Cấu trúc code mới

```
src/console/nav/TopNav.tsx            — top bar + nav tabs
src/console/connections/ClusterSelector.tsx — thay ConnectionSwitcher (dropdown + health dot)
src/console/search/SearchPage.tsx     — compose trang Search
src/console/search/IndicesSelect.tsx  — popover multi-select indices
src/console/search/useIndices.ts      — fetch/lọc/cache danh sách indices
src/console/search/useSearch.ts       — build request, chạy search, state phân trang
src/console/search/HitsTable.tsx      — bảng kết quả + sort/filter/phân trang
src/console/search/AggregationsView.tsx — tab aggregations
src/console/search/DocDialog.tsx      — dialog chi tiết document
src/console/search/downloadJson.ts    — tải response ra file
src/console/ui/popover.tsx, checkbox.tsx (+ table.tsx nếu cần) — shadcn copy-in
```

Nhắc lại quy ước repo: **import tương đối, không dùng `@/`** (landmine WXT đã ghi nhận).

---

## 4. Trang Search — chi tiết

### 4.1 Chọn indices (`IndicesSelect` + `useIndices`)

- Nguồn: `esRequest(conn, 'GET', '_cat/indices?format=json&h=index,health,status,docs.count')`.
- Popover chứa: ô search lọc theo tên, danh sách checkbox (tên index + docs.count mờ), nút refresh.
- Ẩn index bắt đầu bằng `.`; sort theo tên. Cache in-memory theo connection, refresh thủ công.
- Trigger hiển thị tóm tắt: 1 index → tên; nhiều → `index1 +2 nữa`.

### 4.2 Query editor

- CodeMirror (tái dùng stack hiện có), **chỉ body JSON** — không request line; method/path do trang tự build: `POST /{indices.join(',')}/_search`.
- Mặc định `{"query":{"match_all":{}}}`; nút Reset query về mặc định.
- **Autocomplete field-aware:** gọi `fetchMapping(conn, index)` cho **từng** index đã chọn (tận dụng cache sẵn có theo index), union + dedupe `FlatField[]` làm nguồn field. Vì document toàn JSON (không có request line) nên dùng thẳng completion source hiện có trên cả document.
- Chạy: nút **SEARCH** + phím `Mod-Enter`; hiển thị `took` ms cạnh nút sau khi chạy.

### 4.3 Chạy search & phân trang (`useSearch`)

- Body gửi đi = query của user **merge đè** `{ from, size }` từ state bảng (parse JSON → set 2 key → stringify; user có gõ from/size trong query thì state bảng thắng).
- `hits.total` normalize: ES6 = number; ES7+ = `{ value, relation }` → `{ value: number, isGte: boolean }`.
- Đổi trang / đổi size → chạy lại query với from mới. Đổi indices hoặc query → reset về trang 1.

### 4.4 Bảng hits (`HitsTable`)

- Cột: `_id` (+ `_index` khi chọn >1 index) + **union key top-level của `_source`** trên các row trang hiện tại.
- Cell: primitive hiển thị thẳng; object/array → JSON rút gọn 1 dòng (ellipsis, `title` tooltip full).
- **Sort:** click header toggle asc/desc — sort **client-side trang hiện tại**; so sánh number/string tự nhiên.
- **Filter trang hiện tại:** input góc phải trên bảng, lọc case-insensitive trên chuỗi hoá toàn bộ cell của row (client-side, không gọi ES).
- **Phân trang:** góc phải dưới — `size` select (10/25/50/100) + `x–y of N` (thêm `+` khi `isGte`) + prev/next.
- Click row → mở `DocDialog`.

### 4.5 Tab HITS | AGGREGATIONS

- Tab bar ngay trên vùng kết quả (shadcn Tabs sẵn có).
- **Aggregations:** hiển thị `response.aggregations` pretty-print (tái dùng kiểu render của ResponseView); không có aggs → thông báo "Query không có aggregations".

### 4.6 DocDialog

- Dialog hiển thị full hit JSON (`_index`, `_id`, `_score`, `_source`…) format sẵn + nút **Copy** (copy JSON vào clipboard).

### 4.7 Download as JSON

- Nút tải **nguyên raw response** của lần search gần nhất → Blob + `<a download>` với tên `elasticvix-search-<timestamp>.json` (timestamp không chứa ký tự cấm trong tên file, vd `2026-07-15T10-30-00`).

### 4.8 Persist

- `localStorage` key theo connection id: indices đã chọn + query text. Đổi connection → nạp lại state của connection đó (không có thì về mặc định).

---

## 5. Sửa quản lý connection (bug #1)

### 5.1 ClusterSelector (thay ConnectionSwitcher)

- Nút top bar (health dot + tên + version) → mở dropdown (Popover):
  - Mỗi connection 1 row: tên + version; click row → switch active.
  - Icon **edit** (bút chì) → mở `ConnectionDialog` chế độ sửa.
  - Icon **delete** (thùng rác) → click lần 1 biến thành nút xác nhận "Xóa?", click lần 2 mới xóa (không dùng `window.confirm`).
  - Cuối danh sách: **+ Add connection**.
- Xóa connection đang active → active chuyển sang connection còn lại đầu tiên (hoặc trống). Xóa xong đóng row confirm.

### 5.2 Fix ConnectionDialog

- **Remount đúng dữ liệu:** parent giữ `dialogState: { mode: 'add' } | { mode: 'edit'; conn: Connection } | null`; chỉ render dialog khi khác `null`, với `key={conn?.id ?? 'new'}` → mỗi lần mở là state mới, hết đóng băng `useState(initial…)`.
- **Prefill đủ auth:** khởi tạo username/password/apiKey/token từ `initial.auth` (hiện luôn rỗng khi edit).
- Giữ nguyên flow Test (ensure host permission + detect version) và Save hiện có; Save khi edit giữ `id`/`createdAt`, cập nhật `updatedAt`.

---

## 6. Xử lý lỗi & empty states

| Tình huống | Hành vi |
|---|---|
| ES trả lỗi (query sai, index không tồn tại) | Panel đỏ dưới editor: headline = `error.reason` (fallback: status), expand xem raw JSON lỗi |
| Mất mạng / chưa cấp host permission | Thông báo rõ nguyên nhân + nút thử lại (tái dùng cơ chế lỗi của `esRequest`) |
| Chưa có connection | Trang Search hiển thị gợi ý thêm connection (link mở dialog) |
| Chưa chọn index | Nút SEARCH disabled + hint "Chọn ít nhất 1 index" |
| 0 hits | Bảng trống + thông báo "Không có kết quả" |
| `_cat/indices` lỗi | Thông báo trong popover + nút thử lại |
| Cluster health lỗi | Chấm xám, tooltip ghi lý do — không chặn UI |

---

## 7. Kiểm thử

Theo pattern repo (vitest cho logic thuần, harness mock cho UI):

**Unit (vitest):**
- Build cột từ hits (union key top-level, có/không `_index`).
- Normalize `hits.total` ES6 (number) vs ES7+ (`{value, relation}`).
- Merge `from`/`size` đè vào query body (kể cả khi user đã gõ from/size).
- Parse `_cat/indices` + lọc index `.`-prefix + sort.
- Sort/filter client-side (number vs string, case-insensitive).
- Union + dedupe FlatField từ nhiều index.

**Harness (Playwright + mock browser/ES, sẵn có từ Plan 2):**
- Thêm canned response: `_cat/indices`, `{indices}/_search` (hits + aggs), `_cluster/health`.
- Smoke: chọn indices → search → bảng hiện đúng cột/row → đổi trang → mở DocDialog → tab Aggregations → download nút hoạt động → edit connection prefill đúng → delete connection.

**Verify thật (thủ công, ngoài CI):** chạy trên ES 6.5 / 7 / 8 thật của user — autocomplete field trên trang Search, health dot, `_cat/indices` trên cluster lớn.

---

## 8. Ngoài phạm vi v1

- Index pattern tự do (`logs-*`) trong ô chọn indices.
- Sort server-side qua ES (`sort` param) — chỉ sort client-side trang hiện tại.
- Ghi search runs vào History/Saved queries.
- Bulk action trên row (delete documents…) như Elasticvue.
- Các trang Elasticvue khác: HOME / NODES / SHARDS / INDICES / SNAPSHOTS.
