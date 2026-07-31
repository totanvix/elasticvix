# Keyword map — CWS + Google (khảo sát 2026-07-31)

> Task 1.1 của [growth plan](../superpowers/plans/2026-07-31-growth-plan-3-weeks.md).
> Nguồn: search trực tiếp trên chromewebstore.google.com và Google.

## Vị trí hiện tại của Elasticvix trên CWS search

| Keyword | Kết quả | Ghi chú |
|---|---|---|
| `elasticsearch` | **#9/10** | Trên mình: Elasticsearch Tools, Multi ES Heads, ES Client, ES Explorer, ES Perf Monitoring, Elasticvue, EasyElastic, ES Upgrade Monitoring |
| `elasticsearch client` | **#3/3** | Field nhỏ, dễ giữ vị trí. Trên mình: ES Client, Elasticsearch Tools |
| `elasticsearch gui` | **Không rank** | Chỉ Elasticvue hiện ra. Listing mình không có chữ "GUI" → lỗ hổng lớn nhất |
| `elasticsearch head` | Không rank | Multi ES Heads (2.9★), ES Client. Không đáng nhét từ "head" vào listing |
| `kibana` | Không rank | Toàn Kibana-helper extension. Người search "kibana" trong CWS không tìm ES client → bỏ keyword này ở CWS, chỉ dùng cho web content |

## Đối thủ trên CWS

| Extension | Users | Rating | Summary họ dùng |
|---|---|---|---|
| Elasticvue | ~80.000 | 4.9★ (89 ratings) | "Elasticsearch frontend" — cực ngắn, bỏ trống nhiều keyword |
| ES Client – Elasticsearch Browser Tool for Devs | ? | 4.7★ | "Elasticsearch management client" — chiếm chữ "browser tool" trong title |
| Elasticsearch Tools | ? | ? | "query builder, REST client, cluster health & shards" |
| Multi Elasticsearch Heads | ? | 2.9★ | Rating thấp, bỏ qua |

Nhận xét: Elasticvue thắng bằng users + ratings (yếu tố ranking nặng nhất), không phải bằng
keyword — summary họ rất nghèo. Extension mới không đấu được số users ngay, nhưng **phủ keyword
tốt hơn thì thắng ở các query cụ thể** (`elasticsearch client`, `elasticsearch gui`) là khả thi
trong vài tuần.

## Bảng keyword → hành động

| Keyword | Ưu tiên | Đã phủ ở đâu | Hành động (task 1.2) |
|---|---|---|---|
| `elasticsearch gui` | **P0** | Chưa hề | Thêm "GUI" vào summary + description |
| `elasticsearch client` | P0 | Title + summary | Giữ nguyên, đang tốt |
| `elasticsearch` | P0 (dài hạn) | Khắp nơi | Rank lên nhờ ratings + weekly users, không phải nhờ text |
| `query console` / `query dsl` | P1 | Summary + description | Giữ |
| `elasticsearch browser` | P1 | Description ("runs entirely in your browser") | Cân nhắc đưa "browser" lên summary |
| `multi-cluster` | P2 | Summary | Giữ |
| `kibana alternative` | P2 | — | Chỉ dùng trong web content/guides, không nhét vào CWS listing |
| `elasticsearch frontend` | P2 | Chưa | Thêm chữ "frontend" vào description (Elasticvue độc chiếm từ này) |

## Đề xuất cụ thể cho task 1.2

1. **Summary** (manifest, 132 ký tự) — bản hiện tại 124 ký tự:
   > Elasticsearch client with query console, field-aware autocomplete, saved queries, and multi-cluster support. For ES 6.x-9.x.

   Bản đề xuất (~129 ký tự, thêm GUI, giữ mọi keyword cũ):
   > Elasticsearch client & GUI with query console, field-aware autocomplete, saved queries, and multi-cluster support. ES 6.x-9.x.

2. **Title** (manifest, 45 ký tự) — hiện `Elasticvix - Elasticsearch Client` (33). Có thể lên
   `Elasticvix - Elasticsearch Client & GUI` (39). Đổi title/summary = đổi manifest = upload
   zip mới = qua review lại → **gộp vào lần release tới**, không upload riêng chỉ để đổi chữ.

3. **Description** (sửa trên dashboard, không cần review manifest): rải tự nhiên các từ
   `GUI`, `frontend`, `browser extension` vào đoạn mở đầu. Sửa được ngay không cần release.

## Google-side — chủ đề guide đã kiểm chứng demand

| Chủ đề guide | Bằng chứng demand | Ghi chú |
|---|---|---|
| Query Elasticsearch without Kibana | Thread discuss.elastic.co, Quora, có cả tool tên "elastiq — Query Elasticsearch without Kibana" | Guide 1 (task 1.3) — demand thật, ít bài hướng dẫn tử tế |
| Browse/view Elasticsearch index mapping | `_mapping` JSON khó đọc là pain phổ biến | Guide 2 (task 1.3) |
| "best elasticsearch gui" | Listicle của DronaHQ, Retool, UI Bakery, Slant, SaaSHub... thống trị trang 1 | Không viết guide đấu listicle. Thay vào đó: **submit Elasticvix vào Slant, SaaSHub, 1bench** (mở rộng task 1.5) |

## Kết luận

- Việc ra kết quả nhanh nhất: thêm "GUI" vào listing (1.2) — đang mất không một keyword mà đối thủ độc chiếm.
- Trục thắng dài hạn trên CWS: ratings + weekly users → launch wave tuần 2 quan trọng đúng như plan.
- 1.5 mở rộng: ngoài AlternativeTo, thêm Slant + SaaSHub (các trang này đang rank trang 1 Google cho "elasticsearch gui").
