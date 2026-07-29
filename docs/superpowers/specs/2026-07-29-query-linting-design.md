# Design — Query linting theo mapping

> **Trạng thái:** đã duyệt design, chờ viết implementation plan.
> **Ngày:** 2026-07-29

## 1. Mục tiêu & bối cảnh

Khoét sâu moat "field-aware" của elasticvix. Sau autocomplete gợi ý field + gợi ý giá trị, và
mappings viewer xem field→type, bước tiếp là **cảnh báo khi query tham chiếu một field không có trong
mapping của index — ngay khi gõ, trước khi gửi** (`docs/research/…` §2.5: "chưa tool nào làm").

Thuần client-side đọc mapping đã cache (`getFields`) — **không** gửi/ghi gì lên cluster. Tái dùng
`@codemirror/lint` (đã trong deps, chưa dùng) + spec `@field` markers có sẵn.

**Cảnh báo, không chặn:** linter chỉ hiện gạch chân + message; `Cmd/Ctrl+Enter` vẫn gửi query bình
thường. Đây là công cụ hỗ trợ, không phải cổng chặn.

## 2. Phạm vi v1

**Trong phạm vi:**
- Kiểm **tên field** ở đúng các vị trí spec đánh dấu `@field`:
  - **Key position:** key dưới `term`/`terms`/`match`/`match_phrase`/`range`/`sort[]` (spec: node có
    `"@field"`). Ví dụ `{"term":{"catgory":…}}` → `catgory` là field ref.
  - **Value position:** value của `exists.field`, `aggs.*.terms.field`, `aggs.*.{avg,sum,max,min}.field`
    (spec: desc `"@field"` → `kind:'field'`). Ví dụ `{"exists":{"field":"catgory"}}`.
- Áp dụng cả **Search editor** lẫn **REST console**.
- **Toggle bật/tắt** trong toolbar (mặc định BẬT), lưu localStorage.

**Ngoài phạm vi v1 (ghi nhận, không làm):**
- "Did you mean X?" quick-fix (cảnh báo sai mà còn sửa code đúng→sai thì tệ hơn — thêm sau khi base
  linter chứng minh êm).
- Kiểm type-mismatch (`term` trên `text` field), báo unknown DSL keyword.
- Sửa handler `fetchMapping` (chỉ lấy `Object.values(body)[0]` — mapping của index cụ thể đầu tiên).

## 3. Chiến lược tránh false-positive (cốt lõi)

Linter báo sai trên query hợp lệ = bị tắt đi và bỏ phí. Các chốt:

1. **Chỉ lint đúng `@field` position** theo spec — không đụng DSL keyword (`query`/`bool`/`must`/`size`…)
   hay `@any` (tên aggs tự đặt). Cùng một spec autocomplete dùng, không hard-code query type.
2. **`fields` rỗng → không lint gì.** Bao trọn: không mapping, chưa cache, fetch lỗi, endpoint không có
   `bodyRef`.
3. **REST request-line chứa `*` hoặc `,`** (wildcard/multi-target như `logs-*`, `a,b`) → **bỏ qua lint**.
   Lý do: handler `fetchMapping` chỉ lấy mapping index cụ thể **đầu tiên** → mapping thiếu → sẽ báo sai
   field hợp lệ ở index khác. Search page an toàn (union tất cả index đã chọn qua `unionFields`).
4. **Token chứa `*` / `?` / `^` hoặc rỗng → bỏ qua** (wildcard field, boost pattern như `title^2`).
5. **Wording "not in the cached mapping"** (không phải "does not exist") — thành thật về field dynamic
   mới thêm, runtime field, `_source`-only, alias có thể vắng trong cache.
6. **Off-switch:** toggle toolbar (mặc định BẬT). Vì các case ở #5 sẽ khiến linter *đôi khi* báo nhầm
   field có thật — một click là tắt. (Đã cân nhắc: **không** thêm Settings page; dùng localStorage như
   `useHiddenColumns`.)

**Severity:** `warning` (gạch vàng), không phải `error`. Không bao giờ chặn gửi.

## 4. Kiến trúc

### 4.1. `src/lib/autocomplete/lintFields.ts` (mới, thuần, test được)

```ts
export interface FieldRef { from: number; to: number; field: string }
export function findUnknownFields(
  bodyText: string,   // JSON body only (Search: cả doc; REST: phần sau dòng 1)
  rootRef: string,    // spec root ref (endpoint.bodyRef, vd 'queryBody')
  fields: FlatField[],
): FieldRef[]
```

- `fields` rỗng → trả `[]` ngay.
- Parse `bodyText` bằng `json()`, đi `syntaxTree` (mirror `keyPath.ts`: nodes `Object`/`Property`/
  `PropertyName`/`Array`; `unquote` + `sliceDoc` lấy text & range).
- Đệ quy từ root (`resolveDesc(spec, '#'+rootRef)`), thread `Resolved` state:
  - Tại `Object` node (`current.kind==='object'`, `node = current.node`), với mỗi Property key `K`:
    - `K in node` → DSL keyword (không lint key). `nextDesc = node[K]`.
    - else `'@field' in node` → **K là field ref**: nếu `!fieldSet.has(K)` và không `looksPattern(K)` →
      diagnostic trên range của `PropertyName`. `nextDesc = node['@field']`.
    - else `'@any' in node` → tên tự đặt (không lint). `nextDesc = node['@any']`.
    - else → không rõ (leaf, không lint). `nextDesc = undefined`.
    - Đệ quy value với `next = nextDesc===undefined ? {kind:'leaf'} : resolveDesc(spec, nextDesc)`.
  - Tại value là `String` và `resolved.kind==='field'` → **value là field ref**: nếu `!fieldSet.has(val)`
    và không `looksPattern(val)` → diagnostic trên range chuỗi.
  - `Array` + `resolved.kind==='array'` → đệ quy từng phần tử với `resolveDesc(spec, elem)`.
- `looksPattern(t)` = rỗng hoặc chứa `*`/`?`/`^`.

Cần export từ `engine.ts`: `resolveDesc` và type `Resolved` (thêm `export`, không đổi logic).

### 4.2. `src/console/editor/editorExtensions.ts` (sửa)

- `buildEditorExtensions(getFields, getFieldValues, lintEnabled: boolean)` — **cắm `linter()` có điều
  kiện**: `lintEnabled ? [linter(restLintSource(getFields))] : []`. Lint source (async):
  - Parse request line; nếu không có `bodyRef`, hoặc `index` chứa `*`/`,` → `[]`. Ngược lại
    `fields = await getFields(index)`, `bodyStart = nl+1`, gọi
    `findUnknownFields(doc.slice(bodyStart), bodyRef, fields)`, cộng offset `bodyStart` vào from/to.
  - Map `FieldRef` → CM `Diagnostic` `{from, to, severity:'warning', message}`.
- **Reactivity qua rebuild:** `lintEnabled` nằm trong deps `useMemo` của editor → toggle làm rebuild
  extension array (thêm/bỏ `linter`), CM tự re-lint / xoá gạch. Không cần `forceLinting`/view ref.
  Lint chạy khi tắt = extension không có mặt → không fetch, không diagnostic.

### 4.3. Toggle — `src/console/editor/useLintEnabled.ts` (mới, pattern `useHiddenColumns`)

```ts
export const LINT_ENABLED_KEY = 'elasticvix.lint.fields';
export function loadLintEnabled(): boolean       // default true
export function saveLintEnabled(v: boolean): void
export function useLintEnabled(): { enabled: boolean; toggle: () => void }
```

- Global (không per-connection): một boolean. Default BẬT (thiếu key → true).
- Nút toolbar (icon, vd `SpellCheck`) ở **cả** QueryEditor (REST) lẫn SearchPage toolbar; trạng thái
  hiện rõ bật/tắt (variant khác nhau).

### 4.4. Wiring editor

- **REST — `QueryEditor.tsx`:** có toolbar riêng (Run/Save/Format). Gọi `useLintEnabled()`, render nút
  toggle cạnh Format, đưa `enabled` vào `buildEditorExtensions(getFields, getFieldValues, enabled)` và
  vào deps `useMemo`.
- **Search — `SearchEditor.tsx`:** dựng extension inline qua `useMemo`. Thêm prop `lintEnabled`; cắm
  `lintEnabled ? [linter(searchLintSource(getFields))] : []`; đưa `lintEnabled` vào deps. `getFields`
  không nhận index (union đã concrete) → **không cần guard wildcard**; rootRef = `queryBody`, offset 0.
- **Search toolbar — `SearchPage.tsx`:** gọi `useLintEnabled()`, render nút toggle cạnh Format/Save,
  truyền `enabled` xuống `SearchEditor` qua prop `lintEnabled`.
- Cả hai editor đọc/ghi cùng key localStorage; mỗi view mount lại đọc trạng thái mới → nhất quán toàn
  cục (không cần đồng bộ live giữa 2 component vì chỉ một view mount tại một thời điểm).

## 5. Edge cases

| Tình huống | Hành vi |
|---|---|
| `{"term":{"catgory":…}}`, mapping có `category` | Cảnh báo `catgory` (key `@field`, không khớp). ✓ |
| `{"exists":{"field":"catgory"}}` | Cảnh báo value `catgory` (`kind:'field'`). ✓ |
| `{"query":{"bool":{"must":[…]}}}` | `query`/`bool`/`must` là keyword → không lint. ✓ |
| `{"aggs":{"my_agg":{"terms":{"field":"category"}}}}` | `my_agg` là `@any` → không lint; `field:"category"` khớp → im. ✓ |
| `GET /logs-*/_search` field lạ | Index có `*` → bỏ lint hoàn toàn. ✓ |
| Field dynamic mới thêm (cache cũ) | Có thể báo nhầm → wording "cached mapping" + user tắt toggle. ✓ (giới hạn đã biết) |
| Mapping rỗng / fetch lỗi | `fields=[]` → không lint. ✓ |
| Toggle tắt | Không lint, không fetch. ✓ |
| `title^2` trong `multi_match.fields` (nếu gõ) | `looksPattern` → bỏ qua. ✓ |

## 6. Test (TDD)

- `lintFields.test.ts` (thuần, không IO):
  - key `@field` sai → 1 diagnostic đúng range; key khớp → 0.
  - value `exists.field` / `aggs…field` sai → diagnostic; khớp → 0.
  - DSL keyword (`query`/`bool`/`must`/`size`) → 0.
  - `aggs.<name>` (@any) → 0.
  - `fields=[]` → 0.
  - `looksPattern` (`cat*`, `title^2`) → 0.
  - multi-field: `name.keyword` khớp → 0.
  - JSON dở dang (đang gõ) → không crash, trả `[]`/bỏ node lỗi.
- `useLintEnabled.test.ts`: default true; save/load round-trip; corrupted → true. (mirror
  `useHiddenColumns.test.ts`, chỉ test hàm thuần.)
- Wiring `linter()` + toggle button + squiggle: verify bằng **screenshot-ui-review** trên extension thật.

## 7. File đụng tới

| File | Thay đổi |
|---|---|
| `src/lib/autocomplete/engine.ts` | export `resolveDesc` + type `Resolved` (thêm `export`) |
| `src/lib/autocomplete/lintFields.ts` | **mới** — `findUnknownFields` (whole-tree walk, thuần) |
| `src/console/editor/useLintEnabled.ts` | **mới** — toggle localStorage + hook |
| `src/console/editor/editorExtensions.ts` | thêm `linter()` cho REST (guard wildcard/comma + offset) |
| `src/console/search/SearchEditor.tsx` | thêm `linter()` cho Search editor |
| `src/console/editor/QueryEditor.tsx` | nút toggle lint (REST toolbar) |
| `src/console/search/SearchPage.tsx` | nút toggle lint (Search toolbar) + truyền enabled getter |
| `src/lib/autocomplete/lintFields.test.ts` | **mới** |
| `src/console/editor/useLintEnabled.test.ts` | **mới** |

## 8. Quyết định thiết kế đã chốt

- **Warning-only, không chặn gửi** — dynamic/runtime field khiến "chắc chắn sai" là không thể; chỉ gợi ý.
- **Off-switch toggle (localStorage, không Settings page)** — advisor nhấn mạnh: linter *sẽ* đôi khi báo
  nhầm field thật, cần tắt nhanh. Rẻ như `useHiddenColumns`.
- **Bỏ qua wildcard/comma index ở REST** — né đúng case handler trả mapping thiếu; không sửa handler
  (ngoài scope, tránh đụng code đang chạy).
- **Module walk riêng `lintFields.ts`** — engine.ts đã ~210 dòng + 4 entry point; whole-tree walk là
  việc mới, tách để test độc lập. Chỉ export thêm `resolveDesc`/`Resolved`.
- **Wording "cached mapping"** — thành thật về giới hạn, giảm hiểu nhầm khi thi thoảng báo nhầm.
