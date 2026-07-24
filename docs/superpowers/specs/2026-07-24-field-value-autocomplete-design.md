# Design — Gợi ý giá trị field trong autocomplete (enum động)

> **Trạng thái:** đã duyệt design, chờ viết implementation plan.
> **Ngày:** 2026-07-24

## 1. Mục tiêu & bối cảnh

elasticvix khác Elasticvue ở **field-aware autocomplete** đọc từ `_mapping` thật — đây là lý do
tồn tại của sản phẩm (xem `docs/research/elasticvue-vs-elasticvix.md` §2.1). Tính năng này
**khoét sâu moat đó**: khi con trỏ ở vị trí value mà key bao ngoài là một **keyword field** của
index đích, autocomplete tự gợi ý **các giá trị thật** đang tồn tại trong index (qua một `terms`
aggregation). Chưa GUI Elasticsearch miễn phí nào có tính năng này.

Ví dụ: gõ `{"query": {"term": {"status": "▊` → gợi ý `open`, `closed`, `pending`… lấy trực tiếp
từ dữ liệu index, thay vì phải nhớ hoặc tự tra.

## 2. Phạm vi v1

**Trong phạm vi:**
- Chỉ **keyword field** (bao gồm `.keyword` sub-field của multi-field). `flattenMapping` đã sinh
  các sub-field này với `type: 'keyword'` (`src/lib/es/mapping.ts:21-24`), nên gate theo
  `type === 'keyword'` là chính xác — trúng đúng field aggregatable.
- Áp dụng **cả** Search page (`bodyCompletionSource`) lẫn REST console (`esCompletionSource`) — hai
  source dùng chung resolver.
- Tự nhiên phủ các query context có dạng `{ <field>: <value> }`: `term`, `match`, `match_phrase`,
  `prefix`, `wildcard`, và phần tử mảng của `terms`. Gate dựa trên "key bao ngoài là keyword field",
  **không** hard-code từng query type.

**Ngoài phạm vi v1 (ghi nhận, không làm):**
- boolean field (domain nhỏ `[true,false]` — có thể thêm sau bằng enum tĩnh).
- numeric / date field (cardinality cao, terms agg ít hữu ích).
- text field (cần `fielddata`, mặc định tắt — tốn kém).
- Toggle bật/tắt trong Settings (đã cân nhắc và loại: cache + debounce đủ để giữ tải thấp).

## 3. Kiến trúc — IO ở rìa, resolver thuần

Bốn tầng, tách bạch để test độc lập:

### Tầng 1 — Resolver thuần (`src/lib/autocomplete/engine.ts`, sync, test được)

Thêm hàm thuần:

```ts
export function resolveValueField(
  path: string[],
  inKey: boolean,
  fields: FlatField[],
): string | undefined
```

Trả về **tên field** nếu:
- `inKey === false` (đang ở vị trí value), VÀ
- segment cuối của `path` sau khi **bỏ qua các array-index** (chuỗi toàn chữ số) khớp một
  `FlatField` có `type === 'keyword'`.

Ngược lại trả `undefined`.

**Quy tắc ưu tiên (spec thắng):** field-value **chỉ** áp dụng khi `resolveCompletions` trả **rỗng**
ở vị trí value. Cụ thể, ở value position spec có thể ra: `kind: 'enum'` (enum tĩnh → trả enum),
`kind: 'field'` (value là *tên field*, như `exists.field`, `aggs…field` → trả danh sách field), hoặc
không ra gì (`any`/`leaf` → `[]`). Chỉ ở nhánh cuối (`[]`) mới xét `resolveValueField`. Nhờ vậy cả
enum tĩnh lẫn vị trí "value-là-tên-field" đều thắng tự nhiên, không cần so sánh thủ công.

Cơ sở đã kiểm chứng (`src/lib/autocomplete/keyPath.test.ts:23-28`): ở vị trí value,
`resolveKeyPath` trả `path` kết thúc bằng chính key bao ngoài. Ví dụ
`{ "query": { "exists": { "field": "▊" } } }` → `path: ['query','exists','field'], inKey: false`.
Nên `{"term": {"status": "▊"}}` → `path` kết thúc `[...,'term','status']` → field = `status`.

### Tầng 2 — Completion source async (rìa)

Sửa `bodyCompletionSource` và `esCompletionSource`. Tính spec/field items như hiện tại, rồi:
- Nếu items **không rỗng** → trả như cũ (spec/field completions). Field-value không đụng vào.
- Nếu items **rỗng** → gọi `resolveValueField(path, inKey, fields)`. Trả về một field →
  `await getFieldValues(...)` → completions `kind: 'value'`. Trả `undefined` → `null` như cũ.

Đây chính là cách hiện thực quy tắc "spec thắng" ở Tầng 1: chỉ khi spec không ra completion nào mới
fetch field-value.

`resolveValueField` là sync và rẻ (quét mảng), nên chỉ khi nó trả field mới phát sinh fetch async.

Chữ ký cập nhật (mỗi source nhận thêm một getter, giữ đúng khuôn index như `getFields` hiện có):
- `bodyCompletionSource(getFields, getFieldValues)` với `getFieldValues: (field: string) => Promise<string[]>`
  — index đã được caller (Search page) bind sẵn.
- `esCompletionSource(getFields, getFieldValues)` với
  `getFieldValues: (index: string | undefined, field: string) => Promise<string[]>`
  — index parse từ request line trong source.

### Tầng 3 — Fetch + cache (`src/console/editor/getFieldValues.ts`, mirror `getFields.ts`)

```ts
export function makeGetFieldValues(connection: Connection | undefined):
  (index: string | undefined, field: string) => Promise<string[]>
```

- **Cache-first:** `getCachedFieldValues(connId, index, field)` với TTL (5 phút, tái dùng hằng số kiểu
  `MAPPING_TTL_MS`). Cache hit → trả ngay.
- **Miss:** `esRequest(connection, 'POST', '/{index}/_search', body)` (dùng lại
  `src/lib/rpc/client.ts` — **không thêm RPC kind mới**) với body:

  ```json
  { "size": 0, "aggs": { "vix_values": { "terms": { "field": "<field>", "size": 20 } } } }
  ```

  Parse `aggregations.vix_values.buckets[].key` (ép về string) → `string[]`.
- **Ghi cache cả kết quả rỗng/lỗi** (`[]`) với TTL để **không đập lại cluster** khi field không
  aggregatable / thiếu quyền / lỗi mapping.
- **Không bao giờ throw** — mọi lỗi → trả `[]`. Autocomplete không vỡ.
- `index` rỗng / `connection` rỗng → trả `[]`.

### Tầng 4 — Storage (`src/lib/storage/fieldValuesCache.ts` + bump db)

- IndexedDB store mới `fieldValuesCache`, key `${connectionId}::${index}::${field}`,
  value `{ key: string; values: string[]; fetchedAt: number }`.
- `src/lib/storage/db.ts`: bump version `2 → 3`, thêm `createObjectStore` có guard `contains()` như
  pattern hiện tại (`db.ts:25-45`). Thêm type `CachedFieldValues` và entry vào `VixSchema`.
- API: `getCachedFieldValues(connId, index, field, now?)` và
  `setCachedFieldValues(connId, index, field, values, now?)` — mirror `mappingCache.ts`.

## 4. Guardrail chi phí

Cluster ES production (viec.co, port 9200) là mối lo tải. Các chốt:
- **Cache là chốt chính:** mỗi `(index, field)` chỉ fire terms agg **tối đa 1 lần/TTL**; gõ tiếp là
  cache hit.
- **Negative caching:** query lỗi/rỗng cũng cache → không lặp lại trên production.
- **Debounce gõ sẵn của CodeMirror** lo phần trong-một-từ.
- `size: 0` + top-20 terms = query rẻ, có biên.

## 5. Wiring cụ thể

- **Search page:** `SearchPage.tsx` đã có `getFields` union nhiều index đã chọn (`SearchPage.tsx:53-58`).
  Thêm một callback `getFieldValues(field)` bind vào `search.selected.join(',')` (ES gộp buckets qua
  nhiều index — đúng ý người dùng). Truyền xuống `SearchEditor` → `bodyCompletionSource`.
- **REST console:** `QueryEditor.tsx` / `editorExtensions.ts` truyền `makeGetFieldValues(active)` xuống
  `esCompletionSource`; source tự parse index từ request line (đã có sẵn cơ chế cho `getFields`).

## 6. Edge cases

| Tình huống | Hành vi |
|---|---|
| `terms` mảng: `{"terms":{"status":["▊"]}}` | `path` kết thúc `[...,'status','0']` → bỏ index `'0'` → field `status`. ✓ |
| `range.gte`: `{"range":{"price":{"gte":▊}}}` | key cuối `gte` không có trong fields → không gợi ý. ✓ |
| text / unknown field | không phải `keyword` → không gợi ý, rơi về luồng cũ. ✓ |
| không index / không connection | trả `[]`, im lặng. ✓ |
| vị trí là spec enum tĩnh | spec enum thắng, không đụng field-value. ✓ |

**Giới hạn v1 đã biết:** giá trị chứa dấu cách/ký tự đặc biệt có thể neo `from` chưa hoàn hảo do
`matchBefore(/[\w.]*/)` hiện tại; giữ nguyên hành vi hiện có cho v1, xử lý sau nếu cần.

## 7. Test (TDD)

- `engine.test.ts` — `resolveValueField`: ra field cho term/match/terms-array trên keyword field;
  ra `undefined` cho key-position, `range.gte`, text field, `size`, và vị trí spec-enum.
- `fieldValuesCache.test.ts` — set/get, TTL hết hạn (fake-indexeddb, như `mappingCache.test.ts`).
- `getFieldValues.test.ts` — cache-hit bỏ qua fetch; miss thì fetch + cache; lỗi → `[]` và có cache.
- Dựng body terms-agg đúng + parse `buckets[].key` (unit test).

## 8. File đụng tới

| File | Thay đổi |
|---|---|
| `src/lib/autocomplete/engine.ts` | thêm `resolveValueField`; wire vào 2 completion source |
| `src/lib/storage/db.ts` | bump v3 + store `fieldValuesCache` + type `CachedFieldValues` |
| `src/lib/storage/fieldValuesCache.ts` | **mới** — get/set + TTL |
| `src/console/editor/getFieldValues.ts` | **mới** — `makeGetFieldValues` |
| `src/console/search/SearchPage.tsx` | thêm callback `getFieldValues` bind `search.selected` |
| `src/console/search/SearchEditor.tsx` | nhận & truyền `getFieldValues` prop |
| `src/console/editor/editorExtensions.ts` + `QueryEditor.tsx` | truyền `getFieldValues` cho REST source |
| các file `*.test.ts` tương ứng | mới/cập nhật |

## 9. Quyết định thiết kế đã chốt

- **Tự bật + debounce + cache** (không phải manual Ctrl+Space, không toggle Settings) — giữ DNA
  "field-aware, tự bật", cache/negative-cache giữ tải cluster thấp.
- **Dùng lại `esRequest` generic**, không thêm RPC kind `fetchFieldValues` — KISS/YAGNI. Đánh đổi:
  kém đối xứng với `fetchMapping`, đổi lại ít code hơn.
- **keyword-only cho v1** — đảo ngược thứ tự đề xuất trong doc research (vốn xếp mục này cuối vì tốn
  công) vì giá trị chiến lược cao nhất; effort thực tế chỉ ở mức vừa nhờ hạ tầng sẵn có.
