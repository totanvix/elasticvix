# So sánh elasticvix vs Elasticvue — gap analysis & đề xuất

> **Tóm tắt:**
> - **Elasticvue là full admin GUI** (monitoring, quản trị index/document, snapshots); **elasticvix là query console chuyên biệt** — hai định vị khác nhau, không cần đuổi theo toàn bộ.
> - **Đáng thêm nhất:** sửa/xoá document từ Search UI, mappings viewer, export/import config, multi-request console, QoL cho response (fold, download).
> - **Lợi thế thật của elasticvix (đã kiểm chứng):** autocomplete field-aware từ mapping thật — Elasticvue chỉ có keyword list tĩnh, phải bấm Ctrl+Space, gợi ý sai ngữ cảnh. Saved queries có tags, search history riêng — Elasticvue không có.
> - **Chưa cần:** snapshots, nodes/shards monitoring, index templates, AWS IAM — admin territory, lệch ICP.

## Cách so sánh

- **Elasticvue 1.15.0** chạy thật bằng Docker (`cars10/elasticvue`, cổng 9280), kết nối ES 8.14 demo trên cổng 9201 (bật CORS), seed 700 docs bằng `scripts/store/seed-es.mjs`. Đã click qua từng màn hình: Home, Nodes, Shards, Indices, Search, REST, Snapshots, Settings.
- **elasticvix** kiểm kê từ source trong repo này (agent đọc toàn bộ `src/`, `entrypoints/`, `docs/store/`).

---

## Phần 1 — Elasticvue có, elasticvix chưa có

Bảng tổng quan, chi tiết từng nhóm bên dưới:

| Nhóm | Tính năng | Đề xuất |
|---|---|---|
| Document | Sửa document inline, xoá document (đơn + bulk) | ✅ Nên thêm |
| Index | Mappings viewer (xem info/mapping của index) | ✅ Nên thêm |
| App | Export/import config (backup JSON) | ✅ Nên thêm |
| REST | Multi-tab / nhiều request | ✅ Nên thêm (kiểu Kibana) |
| REST | Fold/expand response, download response | ✅ Nên thêm |
| Index | Hành động quản trị index (create, delete, refresh, flush...) | ⚠️ Cân nhắc (bản tối giản) |
| Search | Query-string box + search examples | ⚠️ Cân nhắc |
| Search | Tab Aggregations render riêng | ⚠️ Cân nhắc |
| Cluster | Trang cluster overview (info + health chi tiết) | ⚠️ Cân nhắc (bản nhẹ) |
| App | i18n (8 ngôn ngữ) | ⚠️ Cân nhắc (làm khung sớm) |
| Cluster | Nodes view, Shards view, shard recovery/allocation | ❌ Chưa cần |
| Snapshot | Snapshot repositories + restore | ❌ Chưa cần |
| Index | Index templates, aliases UI, clone/forcemerge/close/read-only | ❌ Chưa cần |
| Auth | AWS IAM (SigV4) | ❌ Chưa cần |
| App | Vim keybindings, hide-indices regex, localize timestamp | ❌ Chưa cần |

### 1.1. Sửa / xoá document — ✅ Nên thêm

- **Là gì:** trong Search results của Elasticvue, double-click một hit mở modal hiện full JSON kèm metadata (`_version`, `_seq_no`...), sửa trực tiếp rồi bấm **UPDATE DOCUMENT**. Checkbox từng dòng + bulk action **Delete document**.
- **Lợi ích:** dev debug data xấu sửa được ngay tại chỗ, không phải viết tay `POST /index/_update/id`. Đây là thao tác lặp lại nhiều lần trong ngày khi làm việc với dữ liệu thật.
- **Đánh giá:** elasticvix đã có `DocDialog` hiện JSON chỉ đọc — thêm nút Edit/Save + Delete là bước tự nhiên, effort nhỏ, đúng ICP (dev thao tác dữ liệu hằng ngày). Đáng làm nhất trong danh sách.

### 1.2. Mappings viewer — ✅ Nên thêm

- **Là gì:** xem mapping/settings của index dưới dạng UI (Elasticvue để trong menu index → Show info).
- **Lợi ích:** viết query đúng phải biết field nào là `keyword` field nào là `text` — hiện dev phải tự gõ `GET /index/_mapping` rồi đọc JSON thô.
- **Đánh giá:** elasticvix **đã fetch và flatten mapping sẵn** cho autocomplete (`src/lib/storage/mappingCache.ts`) — chỉ thiếu UI hiển thị. Rẻ nhất để làm, và có thể làm đẹp hơn Elasticvue: bảng field → type có search, thay vì JSON thô.

### 1.3. Export / import config — ✅ Nên thêm

- **Là gì:** Settings của Elasticvue có **DOWNLOAD BACKUP** / **IMPORT BACKUP** — xuất toàn bộ config (clusters, saved queries...) ra JSON và nhập lại.
- **Lợi ích:** đổi máy, cài lại extension, hoặc share saved queries cho đồng nghiệp không bị mất sạch. Với extension, gỡ ra cài lại là **mất hết IndexedDB + storage.local** — rủi ro mất saved queries thật.
- **Đánh giá:** quan trọng cho retention. Connections + saved queries của elasticvix đều đã là JSON — serialize/deserialize là đủ. Lưu ý: mask credentials khi export hoặc cảnh báo rõ.

### 1.4. Multi-request console — ✅ Nên thêm (kiểu Kibana, không phải kiểu tabs)

- **Là gì:** Elasticvue cho mở nhiều **tab** REST song song, mỗi tab một request.
- **Lợi ích:** so sánh 2 query, giữ nguyên ngữ cảnh khi thử nghiệm.
- **Đánh giá:** nên làm theo **kiểu Kibana Dev Tools** (nhiều request trong 1 editor, Cmd+Enter chạy request tại cursor) thay vì tabs — hợp DNA "Kibana-style console" của elasticvix hơn, và là thứ dev Kibana đã quen tay. Parser `requestLine.ts` hiện tại đã tách dòng `METHOD /path` — mở rộng lên multi-block là khả thi.

### 1.5. QoL cho response viewer — ✅ Nên thêm

- **Là gì:** Elasticvue có fold/expand từng node JSON (`unfold_more`/`unfold_less`) và **DOWNLOAD RESPONSE BODY**.
- **Lợi ích:** response `_search` vài nghìn dòng mà không fold được thì gần như không đọc nổi.
- **Đánh giá:** CodeMirror có sẵn `@codemirror/language` fold gutter — bật cho `ResponseView` là xong. Download JSON thì Search UI đã có (`downloadJson.ts`), chỉ cần nối sang REST view. Effort rất nhỏ.

### 1.6. Hành động quản trị index — ⚠️ Cân nhắc bản tối giản

- **Là gì:** menu mỗi index của Elasticvue có 14 hành động: Show info, Show stats, Aliases, Reindex, Clone, Forcemerge, Refresh, Flush, Clear cache, Set read-only/writable, Close, Delete all documents, Delete index. Kèm nút NEW INDEX và bulk action.
- **Lợi ích:** không phải nhớ cú pháp API quản trị.
- **Đánh giá:** full bộ là admin territory — lệch định vị. Nhưng một **subset dev-flavored** đáng cân nhắc: create index (khi test), delete index, refresh (sau khi bulk test data). Số còn lại dev gõ qua REST console được. Làm sau nhóm ✅.

### 1.7. Query-string search box + examples — ⚠️ Cân nhắc

- **Là gì:** ô search 1 dòng nhận Lucene query string (`level:error AND service:api-gateway`), kèm dropdown ví dụ; index pattern hỗ trợ wildcard `*`.
- **Lợi ích:** tra nhanh không cần viết JSON DSL — hạ rào cản cho query đơn giản.
- **Đánh giá:** hợp Search UI của elasticvix (thêm 1 input phía trên editor, dịch thành `query_string` query). Giá trị vừa, effort vừa. Cân nhắc sau khi xong nhóm ✅.

### 1.8. Aggregations tab — ⚠️ Cân nhắc

- **Là gì:** khi query có `aggs`, Elasticvue render kết quả aggregations ở tab riêng thay vì bắt đọc raw JSON.
- **Đánh giá:** elasticvix đang để user đọc aggs trong tab Raw. Một tab render buckets dạng bảng là nâng cấp tốt cho use case phân tích, nhưng đứng sau các mục ✅ về độ cấp thiết.

### 1.9. Cluster overview — ⚠️ Cân nhắc bản nhẹ

- **Là gì:** trang Home của Elasticvue: cluster info (version, build...), health chi tiết (shards active/unassigned, pending tasks), đếm nodes/indices/docs/disk.
- **Đánh giá:** elasticvix đã có health dot — thêm 1 popover/panel hiện chi tiết `_cluster/health` + `GET /` khi click là đủ dùng, không cần cả trang. Rẻ, đáng làm ở mức popover.

### 1.10. i18n — ⚠️ Cân nhắc làm khung sớm

- **Là gì:** Elasticvue có 8 ngôn ngữ (EN, 2×中文, FR, IT, RU, JA, KO).
- **Đánh giá:** elasticvix đang hard-code English. Chưa cần nhiều ngôn ngữ ngay, nhưng **đưa string ra file message sớm thì rẻ, để muộn thì đắt**. Quyết định khi có tín hiệu user ngoài thị trường EN.

### 1.11. Nhóm chưa cần — ❌

- **Nodes/Shards monitoring** (CPU/RAM/heap/disk từng node, shard allocation, recovery): admin/ops territory. Elasticvue làm tốt và miễn phí — cạnh tranh ở đây là đánh vào chỗ mạnh nhất của họ.
- **Snapshots/repositories**: tần suất dùng thấp với dev, rủi ro cao (restore nhầm), khối lượng UI lớn.
- **Index templates, aliases UI, clone/forcemerge/close/read-only**: như trên — REST console cover được khi cần.
- **AWS IAM auth**: cần SigV4 signing — nặng; chỉ xét khi có user AWS OpenSearch yêu cầu thật.
- **Vim keybindings, hide-indices regex...**: nice-to-have nhỏ, không tạo khác biệt.

---

## Phần 2 — Elasticvue còn thiếu, elasticvix đang/có thể làm tốt hơn

### 2.1. Autocomplete — lợi thế lớn nhất, nên khoét sâu

Đã test trực tiếp trên Elasticvue 1.15.0: gõ `{"qu` trong REST body **không tự hiện gợi ý**; bấm Ctrl+Space mới hiện, và list là keyword tĩnh — gợi ý cả `cutoff_frequency` ở top level (sai ngữ cảnh), không biết field nào tồn tại trong index.

elasticvix: engine đọc syntax tree, đi theo key-path, gợi ý đúng ngữ cảnh + **tên field và type thật từ `_mapping`**, tự bật khi gõ. Không GUI miễn phí nào đang có tính năng này — đây là lý do tồn tại của sản phẩm.

**Khoét sâu:**
- **Mở rộng `spec.json`** — hiện chỉ ~8 query types (`bool/match/match_phrase/term/terms/range/exists/match_all`) và 5 aggs (`terms/avg/sum/max/min`). Thiếu `wildcard`, `prefix`, `fuzzy`, `nested`, `multi_match`, `function_score`, `date_histogram`, `percentiles`... Mỗi entry thêm vào là autocomplete tốt hơn Elasticvue thêm một bậc.
- **Gợi ý giá trị enum** cho keyword field (chạy `terms` agg lấy top values) — không tool nào có.

### 2.2. Saved queries + history — hơn sẵn, nên giữ khoảng cách

- Elasticvue saved queries: chỉ **Query + Name + ô filter**, không tags. elasticvix: tags, filter theo tag (AND), search theo tên — hơn rõ.
- Elasticvue **không có history cho trang Search** (chỉ REST có). elasticvix có search history riêng, relative time, clear all.
- Thiếu duy nhất: export/import (mục 1.3) — bịt nốt là trọn vẹn.

### 2.3. Kibana-style console — đúng format dev đã quen

Elasticvue tách form Method + Path + body, và phải có riêng nút **"Paste kibana console query"** để convert — bằng chứng dev toàn paste query format Kibana vào. elasticvix dùng thẳng format Kibana (`GET /_search` + body), không cần convert. Giữ nguyên hướng này; làm multi-request (1.4) sẽ nới rộng thêm khoảng cách.

### 2.4. Bearer token auth

Elasticvue chỉ có none / basic / API key / AWS IAM — **không có bearer/JWT**. elasticvix có đủ none / basic / API key / bearer. Giữ và ghi vào store listing làm điểm cộng (nhiều cluster đứng sau proxy JWT).

### 2.5. Những chỗ cả hai cùng yếu — cơ hội vượt

- **Search/filter trong response** — response dài muốn tìm 1 field phải Cmd+F cả trang. Chưa ai có filter theo JSON path.
- **Lint query trước khi gửi** — elasticvix đã có `@codemirror/lint` trong dependencies; báo lỗi field không tồn tại trong mapping *trước khi* gửi là thứ chưa tool nào làm.
- **Diff 2 response** — chạy 2 biến thể query rồi so kết quả; hợp multi-request console (1.4).

Lưu ý cho công bằng: local-first / không telemetry **không phải** differentiator — Elasticvue cũng local và open source. Phân phối cũng ngang: Elasticvue có đủ web/docker/desktop/extension, hỗ trợ mọi version ES (kể cả EOL).

---

## Thứ tự đề xuất

1. **Mappings viewer** — rẻ nhất (data đã có sẵn), giá trị ngay.
2. **Sửa/xoá document** — bước tự nhiên từ DocDialog, đúng nhu cầu hằng ngày.
3. **Response QoL** (fold + download) — effort nhỏ.
4. **Export/import config** — chống mất dữ liệu, giữ chân user.
5. **Multi-request console kiểu Kibana** — nới rộng lợi thế console.
6. **Mở rộng autocomplete spec + enum values** — khoét sâu moat, chạy song song các mục trên.

Muốn tôi đào sâu phần nào — ví dụ spec chi tiết cho một mục ✅, hay ước lượng effort từng mục?
