# Design — Mappings viewer

> **Trạng thái:** đã duyệt design, chờ viết implementation plan.
> **Ngày:** 2026-07-29

## 1. Mục tiêu & bối cảnh

Mỗi index Elasticsearch có một **mapping** — danh sách field và kiểu (`keyword`, `text`, `date`,
`float`, `boolean`…). Biết kiểu field là điều kiện để viết query đúng (ví dụ `term` trên `text`
thường ra rỗng, phải dùng `match`). Hiện muốn xem mapping, dev phải gõ `GET /index/_mapping` rồi đọc
JSON lồng nhau thô. Tính năng này biến việc đó thành **một bảng field → type có ô tìm kiếm**, mở bằng
một cú click ngay từ ô chọn index trên trang Search.

elasticvix **đã fetch và flatten mapping sẵn** cho autocomplete (`mappingCache` + `flattenMapping` +
`fetchMapping` RPC) — feature này chủ yếu là tầng hiển thị, tái dùng đúng hạ tầng đã test. Nối mạch
tự nhiên với autocomplete field-aware (gợi ý tên field + giá trị → giờ xem được toàn bộ field/type).

## 2. Phạm vi v1

**Trong phạm vi:**
- Bảng **field → type** cho một index, đọc từ mapping đã flatten (`FlatField = { path, type }`).
- Entry point: **icon trên từng dòng index** trong popover `IndicesSelect` (trang Search). Click icon
  mở dialog mapping của đúng index đó, **không** đụng tới checkbox chọn index.
- Ô **filter fields** (substring, không phân biệt hoa thường).
- **Color-code kiểu field** bằng badge (keyword / text / date / number / boolean).
- 4 trạng thái: **loading**, **error** (kèm Retry), **empty** (index không field), **data**.
- Nút **reload** trong dialog — fetch tươi, bỏ qua cache.

**Ngoài phạm vi v1 (ghi nhận, không làm):**
- Sửa mapping, index admin actions (create/delete/refresh…).
- Hiển thị analyzer / settings / raw mapping JSON tab — dữ liệu đó **không** có trong `FlatField`
  (chỉ `{ path, type }`); thêm sau nếu cần bằng cách mở rộng `flattenMapping`.
- REST console (chỉ Search page cho v1).

## 3. Kiến trúc — tái dùng primitive đã test, thêm tầng UI

Ba đơn vị mới + hai file sửa. Tách bạch để test độc lập.

### 3.1. `mappingViewLib.ts` (mới, thuần, test được)

```ts
export function filterFields(fields: FlatField[], query: string): FlatField[]
```

- Trim + lowercase query; match substring trên `field.path` (lowercase).
- Query rỗng → trả **toàn bộ** fields (giữ nguyên thứ tự đầu vào).
- Không khớp → `[]`.
- Thuần, không IO → unit test trực tiếp.

### 3.2. `useIndexMapping.ts` (mới, hook — mirror `useIndices`)

```ts
export function useIndexMapping(
  connection: Connection | undefined,
  index: string | undefined,
): { fields: FlatField[]; isLoading: boolean; error?: string; reload: () => Promise<void> }
```

- Chạy khi `index` được set (dialog mở). `index` undefined → không fetch, trả rỗng.
- **Cache-first:** `getCachedFields(connection.id, index)` (TTL 5 phút). Hit → dùng ngay, **không**
  gọi cluster.
- **Miss:** `fetchMapping(connection, index)`. Lỗi (`res.error`) → set `error`, `fields = []`.
  Thành công → `setCachedFields` + set `fields`.
- `reload()` — **bỏ qua cache**, gọi thẳng `fetchMapping` + ghi cache lại (mirror nút reload của
  `useIndices`).
- Dùng `loadSeq` ref chống race khi đổi index nhanh (như `useIndices`).

**Vì sao không tái dùng thẳng `makeGetFields`:** hàm đó nuốt lỗi thành `[]` (đúng cho autocomplete
im lặng), nhưng viewer cần **phân biệt "index rỗng field" với "fetch lỗi"** — nếu không sẽ hiện
"No fields" khi thực chất là lỗi mạng. Hook mới vẫn tái dùng đúng các primitive đã test
(`getCachedFields` / `setCachedFields` / `fetchMapping`), chỉ thêm surface lỗi + loading + reload.
`makeGetFields` giữ nguyên → autocomplete không bị đụng.

### 3.3. `MappingDialog.tsx` (mới, nương `DocDialog`)

```tsx
type Props = { connection: Connection | undefined; index: string | undefined; onClose: () => void }
```

- `<Dialog open={index !== undefined}>` (mirror `DocDialog` mở theo `hit !== undefined`).
- Gọi `useIndexMapping(connection, index)`; state filter cục bộ (`useState`).
- Title: `{index}` + đếm field (`{n} fields`), kèm nút reload (icon `RefreshCw`, spin khi loading).
- Ô filter (`Input`) → `filterFields(fields, query)`.
- **Sắp xếp hiển thị:** fields sắp theo alphabet theo `path` (`localeCompare`, immutable copy) — dễ tra;
  multi-field như `name.keyword` nằm ngay sau `name`. Sort ở tầng dialog trước khi filter/render
  (giữ `filterFields` thuần chỉ lọc, không sort).
- Bảng 2 cột **Field** (path, monospace; phần parent của multi-field làm mờ) · **Type** (badge màu).
- Render trong container `max-h-[60vh] overflow-auto`; `.map()` thẳng (vài trăm field — virtualization
  là YAGNI cho v1).
- Trạng thái: loading (spinner/"Loading…"), error (message + nút Retry gọi `reload`), empty
  ("No fields."), data (bảng).

**Badge màu theo kiểu** — nhóm về 5 lớp semantic, mặc định (kiểu lạ) rơi về "other":
`keyword` → keyword; `text` / `match_only_text` → text; `date` / `date_nanos` → date;
số (`long/integer/short/byte/double/float/half_float/scaled_float/unsigned_long`) → number;
`boolean` → boolean; còn lại → other (badge trung tính). Hàm phân loại `typeClass(type)` để thuần &
test được (đặt trong `mappingViewLib.ts`).

### 3.4. Wiring

- **`IndicesSelect.tsx`**: thêm prop `onViewMapping: (index: string) => void`. Mỗi dòng thêm một
  icon-button (`List`) đứng sau tên/đếm. Handler: `e.preventDefault(); e.stopPropagation();
  onViewMapping(i.index)` — `preventDefault` chặn label toggle checkbox.
- **`SearchPage.tsx`**: thêm state `mappingIndex` (giống `openHit`). Truyền
  `onViewMapping={setMappingIndex}` xuống `IndicesSelect`; render
  `<MappingDialog connection={active} index={mappingIndex} onClose={() => setMappingIndex(undefined)} />`
  ở cuối (cạnh `DocDialog`).

## 4. Guardrail chi phí

- Cache-first: mở dialog khi cache còn tươi → **0 request** lên cluster.
- Chỉ fetch khi miss hoặc user bấm reload; `fetchMapping` là read-only (`GET _mapping`), không ghi.

## 5. Edge cases

| Tình huống | Hành vi |
|---|---|
| Cache hit (autocomplete vừa warm) | Hiện bảng ngay, không gọi cluster. ✓ |
| Cache miss | Fetch `_mapping`, ghi cache, hiện bảng. ✓ |
| Fetch lỗi (mạng / quyền) | Trạng thái error + Retry; **không** hiện "empty". ✓ |
| Index không có field (mapping rỗng) | Trạng thái empty "No fields." ✓ |
| Đổi index nhanh (mở A rồi B) | `loadSeq` bỏ kết quả cũ, chỉ hiện B. ✓ |
| Click icon trên dòng index | Mở dialog, **không** tick/bỏ tick chọn index. ✓ |
| Multi-field (`name` + `name.keyword`) | Hiện cả hai dòng, phần `name.` làm mờ. ✓ |
| `connection` / `index` undefined | Không fetch, dialog đóng. ✓ |

## 6. Test (TDD)

- `mappingViewLib.test.ts`:
  - `filterFields`: match substring, case-insensitive, query rỗng → all (giữ thứ tự), no-match → [].
  - `typeClass`: keyword/text/date/số/boolean → đúng lớp; kiểu lạ → 'other'.
- `useIndexMapping.test.ts` (fake-indexeddb + mock `fetchMapping`, style `useIndices`/`useHiddenColumns`):
  - cache-hit → **không** gọi `fetchMapping`, trả fields.
  - miss → gọi `fetchMapping` một lần, ghi cache, trả fields.
  - lỗi → `error` set, `fields = []`, **không** ghi cache.
  - `reload()` → gọi `fetchMapping` kể cả khi cache còn tươi.
- Wiring dialog + icon (`IndicesSelect`, `MappingDialog`, `SearchPage`): verify bằng
  **screenshot-ui-review** trên extension thật, như các feature trước.

## 7. File đụng tới

| File | Thay đổi |
|---|---|
| `src/console/search/mappingViewLib.ts` | **mới** — `filterFields`, `typeClass` (thuần) |
| `src/console/search/useIndexMapping.ts` | **mới** — hook cache-first + error/loading/reload |
| `src/console/search/MappingDialog.tsx` | **mới** — dialog bảng field→type |
| `src/console/search/IndicesSelect.tsx` | thêm prop `onViewMapping` + icon-button mỗi dòng |
| `src/console/search/SearchPage.tsx` | state `mappingIndex` + render `MappingDialog` |
| `src/console/search/mappingViewLib.test.ts` | **mới** |
| `src/console/search/useIndexMapping.test.ts` | **mới** |

## 8. Quyết định thiết kế đã chốt

- **Hook riêng `useIndexMapping`** (không tái dùng `makeGetFields`) để surface lỗi cho UI — viewer
  cần phân biệt empty vs error. Đổi lại: một hook mỏng single-use, đúng pattern repo (`useIndices`…).
- **Color-code kiểu field** — badge màu mã hoá thông tin thật (lọc được vs tìm toàn văn), không phải
  trang trí. Đã duyệt qua mockup.
- **Entry point: icon per-index-row** (không nút gộp, không nav tab mới) — rõ per-index, giữ định vị
  "query console, không phải admin GUI".
- **Chỉ đọc từ cache/`fetchMapping`**, không thêm RPC mới — KISS/DRY.
