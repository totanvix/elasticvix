# VixElastic — Query Console (sub-project 1) — Thiết kế

**Ngày:** 2026-07-07
**Trạng thái:** Đã brainstorm & duyệt, chờ viết implementation plan

---

## 1. Bối cảnh & mục tiêu

Người dùng đang dùng extension **elasticvue** nhưng thiếu hai thứ:

1. **Gợi ý cú pháp query (autocomplete)** khi soạn Query DSL.
2. **Lưu lại query** để tái sử dụng.

Định hướng dài hạn là một GUI Elasticsearch đầy đủ **viết lại từ đầu** (không fork elasticvue) dưới dạng **Chrome extension**. Vì đây là dự án lớn nên được **chia nhỏ**; tài liệu này chỉ đặc tả **sub-project đầu tiên**:

> **Kết nối cluster tối thiểu + Query Console với autocomplete field-aware + lưu/quản lý query.**

Các mảng quản trị khác (index, document, mapping editor, node/shard, snapshot, cluster health) để các sub-project sau, mỗi cái một chu trình spec → plan → code riêng.

---

## 2. Quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Phạm vi sản phẩm | GUI thay thế elasticvue, **viết lại từ đầu** (chia nhỏ, làm Query Console trước) |
| Đóng gói | **Chrome extension (Manifest V3)**, background service worker gọi ES để né CORS |
| Giao diện chính | **Trang full-page** mở trong tab riêng khi click icon |
| Framework UI | **React + shadcn/ui + Tailwind** |
| Khung dựng | **WXT** (MV3) + Vite, TypeScript strict, **pnpm** |
| Editor | **CodeMirror 6** |
| Mức autocomplete | **Cấp 3 — field-aware** (endpoint + DSL keyword theo ngữ cảnh + tên field/index thật từ mapping) |
| Nguồn tri thức autocomplete | **Spec tự biên tập** (JSON gọn, có thể seed từ spec chính thức của Elastic) |
| Phiên bản ES hỗ trợ | **6, 7, 8, 9** — detect version lúc connect, thích ứng phần khác biệt |
| Xác thực | **none, basic, API key, bearer** |
| Đa cluster | Lưu nhiều connection, chuyển đổi qua lại |
| Lưu query | Query có **tên + tags + tìm kiếm**, kèm **lịch sử tự động** |
| Đơn vị soạn thảo | **Một request mỗi editor** cho v1 (multi-request scratchpad để sau) |
| Kiểm thử | TDD + coverage cao cho **logic thuần**; kiểm thử tay cho UI; **bỏ e2e nặng** ở v1 |

---

## 3. Kiến trúc & luồng dữ liệu

**Ba khối chính:**

### 3.1 Background service worker — "cổng gọi ES"
Toàn bộ request tới Elasticsearch đi qua đây để né CORS. `host_permissions` xin theo host người dùng nhập (không xin bừa `<all_urls>`). Đây là nơi **duy nhất** chạm mạng.

API RPC (UI ↔ background qua `chrome.runtime` message, bọc trong lớp typed nhỏ):

```
esRequest(connectionId, { method, path, body }) → { status, took, body, error }
detectVersion(connection) → { version, major }
fetchMapping(connectionId, index) → { fields: FlatField[] }   // có cache
```

Service worker tự gắn header auth đã resolve, `fetch` tới ES, trả kết quả thô về UI.

### 3.2 UI — trang full-page (React)
Click icon → `chrome.action.onClicked` → mở tab `chrome-extension://.../console.html`. Đây là toàn bộ ứng dụng console. **Không dùng content script** (không nhúng vào trang web nào), nên CSP sạch, Tailwind/shadcn không xung đột.

### 3.3 Lớp Storage
- **Connections** (kèm secret) + `activeConnectionId` + `settings` → `chrome.storage.local`.
  - ⚠️ **Caveat:** `chrome.storage.local` *không mã hoá*, chỉ nằm trong profile Chrome. Chấp nhận được cho tool cá nhân; ghi rõ để người dùng biết.
- **Saved queries, History, Mapping cache** → **IndexedDB** (lib `idb`), vì tích luỹ nhiều và cần search/lọc tag.

### 3.4 Luồng chạy một query
```
Editor (method + path + body) --⌘/Ctrl+Enter-->
  UI resolve connection + auth header -->
  RPC esRequest --> background fetch ES -->
  trả về --> UI render response (pretty JSON, status, took) --> ghi vào History
```

### 3.5 Luồng autocomplete field-aware
```
Khi connect: background GET / (lấy version) --> cache trên connection
Khi gõ trong body: UI cần field --> fetchMapping(index) (cache theo index, có TTL) -->
  làm phẳng danh sách field --> nạp vào completion source của CodeMirror
Endpoint + DSL keyword: đọc từ spec JSON tĩnh đóng gói sẵn trong extension
```

---

## 4. Mô hình dữ liệu

```ts
type AuthConfig =
  | { type: 'none' }
  | { type: 'basic';  username: string; password: string }
  | { type: 'apiKey'; apiKey: string }   // → Authorization: ApiKey <...>
  | { type: 'bearer'; token: string }    // → Authorization: Bearer <...>

type Connection = {
  id: string
  name: string
  baseUrl: string                        // https://host:9200
  auth: AuthConfig
  version?: string                       // detect lúc connect, vd "8.13.0"
  major?: 6 | 7 | 8 | 9
  createdAt: number
  updatedAt: number
}

type SavedQuery = {
  id: string
  name: string
  tags: string[]
  method: string                         // GET/POST/PUT/DELETE
  path: string                           // /index/_search
  body: string                           // JSON dạng text
  connectionId?: string                  // gắn cluster nếu muốn
  createdAt: number
  updatedAt: number
}

type HistoryEntry = {
  id: string
  method: string
  path: string
  body: string
  connectionId: string
  status?: number
  took?: number
  ranAt: number
}

type FlatField = {
  path: string                           // vd "user.address.city"
  type: string                           // keyword/text/date/long/...
}
```

- History **tự giới hạn** (ví dụ giữ 500 bản gần nhất, prune cũ).

---

## 5. Autocomplete engine (phần lõi)

**Đơn vị soạn thảo:** mỗi editor = một request — dòng đầu `METHOD /path`, các dòng sau là JSON body.

**Engine quyết định gợi ý gì dựa vào vị trí con trỏ:**

### 5.1 Trên dòng request
- Vị trí method → `GET / POST / PUT / DELETE / HEAD`.
- Trong path → tên **index thật** (từ `_cat/indices`, field-aware) + các endpoint từ spec (`_search`, `_count`, `_mapping`, `_bulk`, `_cat/...`) theo vị trí.

### 5.2 Trong JSON body
- Dùng cây cú pháp JSON của CodeMirror (**Lezer**) để tìm **key-path của con trỏ** kể cả khi JSON còn dở (vd đang ở `query.bool.`).
- Đối chiếu key-path với **spec DSL tự biên tập** để biết key hợp lệ tại đó:
  - dưới `query` → `bool/match/term/range/match_all/exists/...`
  - dưới `query.bool` → `must/should/filter/must_not/minimum_should_match`
  - dưới `range.<field>` → `gte/lte/gt/lt/format`
- **Chèn field-aware:** tại các vị trí spec đánh dấu `@field` (key trong `match`/`term`/`range`, phần tử của `sort`, `_source`, `aggs.*.field`) → bơm **danh sách field thật** từ mapping cache của index đang query, kèm kiểu field làm gợi ý phụ.

### 5.3 Hình dạng spec tự biên tập

```jsonc
{
  "endpoints": {
    "_search": { "methods": ["GET","POST"], "body": "#queryBody" },
    "_count":  { "methods": ["GET","POST"], "body": "#queryBody" }
  },
  "bodies": {
    "queryBody": { "query":"#query", "size":"int", "from":"int",
                   "sort":"#sort", "_source":"#sourceFilter", "aggs":"#aggs" },
    "query":     { "bool":"#bool", "match":"#matchQ", "term":"#fieldVal",
                   "range":"#rangeQ", "match_all":{}, "exists":{"field":"@field"} },
    "bool":      { "must":"[#query]", "should":"[#query]",
                   "filter":"[#query]", "must_not":"[#query]" },
    "rangeQ":    { "@field": {"gte":"any","lte":"any","gt":"any","lt":"any"} }
  }
}
```

Quy ước: `@field` = bơm tên field từ mapping · `#ref` = tham chiếu node khác · `[#x]` = mảng của x. Có thể **seed từ spec chính thức của Elastic** để phủ nhanh, rồi tỉa lại (tuỳ chọn, không bắt buộc cho v1).

**Phạm vi phủ tối thiểu ở v1:** endpoint `_search`, `_count`, `_mapping`, `_cat/indices`, và CRUD document (`_doc`/`_bulk`); phần Query DSL cốt lõi: `bool`, `match`, `match_phrase`, `term`, `terms`, `range`, `exists`, `match_all`, cùng `size/from/sort/_source/aggs` ở cấp thân request. Ngoài danh sách này chấp nhận thiếu và mở rộng dần.

### 5.4 Thích ứng version
- Spec nền theo ~8.x.
- ES6 có tầng `_type` trong mapping → bước làm phẳng mapping xử lý riêng.
- Khác biệt DSL vụn giữa 6→9 tạm bỏ qua; thêm guard sau khi cần.

### 5.5 Làm phẳng mapping
Duyệt `properties`, đệ quy `object`/`nested` → path chấm (`user.address.city`) kèm `type`.

### 5.6 Tích hợp CodeMirror
Một `completion source` custom nạp vào `autocompletion({ override: [...] })`, trả về `label` + `type` (keyword/field/snippet) + `info` + `apply` dạng snippet cho các khung.

---

## 6. Giao diện (full-page, 3 vùng)

```
┌────────────────────────────────────────────────────────────────┐
│ [▼ prod-cluster ●8.13]                              [⚙ Settings] │
├──────────────┬─────────────────────────┬───────────────────────┤
│ Saved | Hist │  GET /logs-*/_search     │  200 · 34ms   [Copy]  │
│ ─────────────│  {                       │  {                    │
│ 🔍 search    │    "query": {            │    "took": 34,        │
│ #tag1 #tag2  │      "bool": { ... }     │    "hits": { ... }    │
│              │    }                     │                       │
│ • prod errors│  }                       │                       │
│ • slow query │  [Run ⌘↵] [Save] [Format]│                       │
└──────────────┴─────────────────────────┴───────────────────────┘
   left rail          request editor            response viewer
```

- **Left rail:** chuyển giữa **Saved Queries** (ô search + lọc tag chips) và **History**. Click 1 mục → nạp vào editor.
- **Editor:** dòng request + body; nút **Run (⌘/Ctrl+Enter)**, **Save** (dialog: tên + tags), **Format** (prettify JSON).
- **Response:** JSON đẹp (CodeMirror read-only), badge status + took ms + Copy.
- **Connection switcher:** dropdown; dialog "Add connection" gồm name, baseUrl, chọn auth → field tương ứng, nút **Test** (gọi detectVersion), chấm xanh/đỏ + version.

---

## 7. Xử lý lỗi

- **Lỗi transport** (host không tới, cert lỗi, 401) vs **lỗi từ ES** (JSON error kèm status): in rõ ở response pane, không lẫn lộn.
- **JSON body sai** trước khi Run → lint inline (CodeMirror JSON linter) + cảnh báo, nhưng **vẫn cho chạy** (không chặn cứng).
- **Mapping fetch lỗi** → autocomplete field-aware lặng lẽ vắng mặt, endpoint/DSL vẫn chạy. **Không bao giờ chặn việc gõ.**
- **Detect version lỗi** → đánh dấu unknown, vẫn cho gửi request.
- **HTTPS self-signed cert:** Chrome extension **không thể** bỏ qua kiểm tra cert như app desktop → người dùng phải trust cert ở trình duyệt/OS. Giới hạn cố hữu của hướng extension, hiển thị thông báo hướng dẫn khi gặp lỗi cert.

---

## 8. Kiểm thử (lệch khỏi quy tắc mặc định — đã được duyệt)

Quy tắc chung yêu cầu 80% coverage + TDD + e2e. Với extension cá nhân, e2e đầy đủ là quá sức so với giá trị. Thay vào đó:

- **TDD + coverage cao** cho **logic thuần** (giá trị nhất, dễ test nhất), chạy bằng **Vitest**:
  - autocomplete engine: resolve key-path từ JSON + con trỏ, tra spec, bơm field
  - làm phẳng mapping (gồm nhánh ES6 `_type`)
  - builder header auth (từng loại auth)
  - repository saved query / history (dùng `fake-indexeddb`)
  - kiểm tra tính hợp lệ của spec tự biên tập
- **Kiểm thử tay theo checklist** cho phần UI extension.
- **Bỏ e2e nặng ở v1** (Playwright load extension) — ghi là tùy chọn tương lai.

---

## 9. Ngoài phạm vi v1

Để dành cho các sub-project sau:

- Quản lý index/document, sửa mapping, theo dõi node/shard/snapshot, dashboard cluster health
- Multi-request scratchpad kiểu Kibana
- Import/export saved queries
- Đồng bộ nhiều máy (mọi thứ đang lưu local)
- Biến/template trong query

---

## 10. Rủi ro & lưu ý

- **Độ phủ spec autocomplete:** spec tự biên tập ban đầu chỉ phủ phần hay dùng; cần chấp nhận không đầy đủ và mở rộng dần. Seed từ spec Elastic giúp giảm rủi ro này.
- **Dải version rộng (6→9):** chỉ đảm bảo phần Query DSL cốt lõi + mapping; không cam kết độ chính xác từng phiên bản.
- **Bảo mật secret:** lưu plaintext trong `chrome.storage.local` — chấp nhận cho tool cá nhân, không dùng cho môi trường chia sẻ máy.
- **CodeMirror JSON incomplete parsing:** cần xử lý cẩn thận trường hợp JSON dở khi resolve key-path để autocomplete không vỡ.
