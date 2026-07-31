# Growth plan 3 tuần — kéo user cho Elasticvix

> Mục tiêu: user thật dùng hằng tuần (weekly active), đo bằng CWS dashboard.
> Chiến lược: **Hướng A — nền trước, nổ sau.** Tuần 1 xây nền (listing, SEO, phân phối),
> tuần 2 launch wave, tuần 3 content compound + đo. Không viết bài so sánh đối thủ.
> Phân công: **[AI]** = Claude làm được trọn gói trong repo. **[Bạn]** = việc cần tài khoản
> cá nhân / thao tác dashboard — AI soạn sẵn nội dung, bạn dán và bấm.

## Số đo thành công (đo cuối tuần 3)

| Chỉ số | Nguồn đo | Baseline (điền trước khi bắt đầu) | Mục tiêu |
|---|---|---|---|
| Weekly users | CWS dashboard → Stats | 2 | ≥ 100 |
| Tổng installs | CWS dashboard | 28 | ≥ 300 |
| GitHub stars | repo totanvix/elasticvix | 0 | ≥ 50 |
| Website visits/tuần | GoatCounter (gắn ở tuần 1) | 0 | ≥ 200 |
| Rating trên CWS | store listing | 0 | ≥ 5 rating, trung bình ≥ 4.5 |

Mục tiêu là ước lượng thực tế cho lần launch đầu, không phải cam kết — nếu Show HN
lên trang nhất thì vượt xa; nếu chìm thì installs chủ yếu đến từ store search (chậm mà đều).

---

## Tuần 1 — Nền (foundation)

### 1.1 Keyword research CWS + Google — [AI]
- Lập danh sách keyword ứng viên: `elasticsearch client`, `elasticsearch gui`,
  `elasticsearch browser`, `query console`, `kibana alternative`, `elasticsearch chrome extension`…
- Đối chiếu từng keyword với title/summary/description hiện tại trong `docs/store/listing.md`.
- Kiểm tra Elasticvue và các extension ES khác đang rank keyword nào trên CWS search.
- **Verify:** file `docs/research/keyword-map.md` — bảng keyword → độ ưu tiên → đã phủ ở đâu.

### 1.2 Tối ưu store listing — [AI soạn] + [Bạn dán]
- Sửa `docs/store/listing.md` (và manifest nếu cần đổi title/summary) theo keyword map.
  Listing hiện tại đã tốt — chỉ tinh chỉnh, không viết lại.
- [Bạn] dán bản mới vào CWS dashboard. Lưu ý: đổi title/summary trong manifest cần
  upload zip mới → qua review lại; cân nhắc gộp với lần release kế tiếp.
- **Verify:** listing công khai trên CWS hiển thị đúng bản mới.

### 1.3 Website SEO + analytics — [AI] + [Bạn verify Search Console]
- Gắn GoatCounter (free, privacy-friendly, không cần cookie banner) vào `website/`.
  [Bạn] tạo tài khoản GoatCounter (1 phút), đưa AI mã site.
- Thêm `sitemap.xml`, `robots.txt`, meta description cho các trang hiện có.
- Viết 2 trang guide đầu tiên (dạng giải quyết vấn đề, không so sánh):
  1. *How to query Elasticsearch without Kibana* — target search cùng tên.
  2. *How to browse an Elasticsearch index mapping* — target "view elasticsearch mapping".
  Mỗi bài: hướng dẫn thật + cuối bài giới thiệu Elasticvix làm được việc đó 1 click.
- [Bạn] verify site trên Google Search Console (dán meta tag AI đưa), submit sitemap.
- **Verify:** 2 trang live trên GitHub Pages, GoatCounter nhận hit, Search Console nhận sitemap.

### 1.4 Phân phối qua GitHub — [AI soạn] + [Bạn bấm]
- [Bạn] thêm GitHub topics cho repo: `elasticsearch`, `elasticsearch-client`,
  `elasticsearch-gui`, `chrome-extension`, `developer-tools` (Settings → topics, 1 phút).
- [AI] soạn PR thêm Elasticvix vào `dzharii/awesome-elasticsearch` và các awesome list
  liên quan (awesome-chrome-extensions…). [Bạn] duyệt rồi để AI mở PR bằng `gh`.
- [AI] thêm badge CWS (link store + version) vào README.
- [Bạn] upload social preview image cho repo (AI xuất ảnh từ promo tile sẵn có).
- **Verify:** topics hiện trên repo, PR awesome list đã mở, README có badge store.

### 1.5 Directory listings — [AI soạn nội dung] + [Bạn submit]
- AlternativeTo: tạo entry Elasticvix, liệt kê là alternative của Elasticvue / Kibana / Cerebro.
  Đây là directory entry, không phải bài so sánh — bắt đúng tệp người đang tìm tool thay thế.
- LibHunt / Openbase-style directories nếu còn hoạt động.
- **Verify:** entry AlternativeTo live.

---

## Tuần 2 — Launch wave

> Nguyên tắc: AI soạn draft mọi bài; **bạn đăng bằng tài khoản cá nhân, giọng thật
> "tôi build cái này", và trực trả lời comment trong ngày đăng** (AI hỗ trợ soạn reply).
> Đăng từ nhỏ tới lớn để gom feedback + sửa lỗi trước khi bắn phát to nhất.

### 2.1 Elastic Discuss forum (discuss.elastic.co) — thứ 2
- Draft: giới thiệu tool trong category phù hợp, tone chia sẻ với cộng đồng ES.
- **Verify:** bài đăng live, trả lời hết comment trong 48h.

### 2.2 Reddit r/elasticsearch — thứ 3
- [AI] đọc rule sub trước, draft bài "I built a browser-based Elasticsearch client
  with autocomplete that reads your cluster". Kèm 1 ảnh/GIF demo.
- Nếu ổn, tuần sau cân nhắc r/devops / r/selfhosted (rule self-promo chặt hơn, cần account
  có lịch sử tham gia — đừng ép nếu account mới).
- **Verify:** bài live, không bị mod xoá, trả lời hết comment.

### 2.3 dev.to build story — thứ 4
- Bài dạng kể chuyện: *What I learned building an Elasticsearch client as a Chrome extension*
  (MV3 pain, CORS, autocomplete đọc mapping…). Không phải bài quảng cáo — câu chuyện kỹ thuật
  thật, sản phẩm xuất hiện tự nhiên.
- **Verify:** bài live trên dev.to, cross-post link vào README/website.

### 2.4 Show HN — thứ 5 hoặc thứ 6, 8–10h sáng US Eastern
- Title draft: `Show HN: Elasticvix – Elasticsearch client that runs entirely in your browser`.
- [AI] soạn first comment (backstory, vì sao build, khác gì Elasticvue/Kibana — trả lời
  trung thực khi được hỏi, không chê đối thủ) + FAQ dự phòng (security? credentials lưu đâu?
  sao không dùng Kibana? MV3 permissions?).
- [Bạn] đăng và trực comment ít nhất 4–6h đầu.
- **Verify:** bài đăng đúng khung giờ; mọi comment có reply.

### 2.5 Product Hunt — quyết định sau
- Dev tool thuần thường không hợp PH. Chỉ làm nếu tuần 2 còn sức. Mặc định: bỏ.

---

## Tuần 3 — Compound + đo

### 3.1 Guide content đợt 2 — [AI]
- Mở Search Console xem query nào đã có impression → viết 2–3 guide tiếp theo
  theo data thật thay vì đoán.
- **Verify:** trang mới live, có internal link từ trang cũ.

### 3.2 Đo và kết luận kênh — [AI phân tích] + [Bạn export số]
- [Bạn] export số từ CWS dashboard (installs, weekly users theo ngày).
- [AI] đối chiếu với GoatCounter referrers + mốc thời gian từng post → kênh nào ra install.
- Điền bảng số đo ở đầu file này.
- **Verify:** file `docs/research/growth-week3-report.md` — kênh nào chạy, kênh nào bỏ.

### 3.3 Chăm sóc sau launch — [Bạn, ~15 phút/tuần từ đây]
- Trả lời review trên CWS (rating thấp mà được reply tử tế thường được sửa).
- Trả lời issue GitHub mới.
- Mỗi tháng: liếc Search Console → nếu có query mới nổi thì bảo AI viết thêm guide.

---

## Rủi ro

| Rủi ro | Ứng phó |
|---|---|
| Show HN chìm (đa số Show HN < 10 điểm) | Vẫn được backlink + vài chục visit. Không đăng lại ngay — HN cho phép repost sau vài tháng nếu bài không có traction. |
| Reddit xoá bài vì self-promo | Đọc rule trước, chọn sub chính (r/elasticsearch) nơi tool đúng chủ đề. Không spam nhiều sub cùng lúc. |
| Đổi manifest title → phải qua review CWS lại | Gộp đổi title vào một lần release, chấp nhận vài ngày review. |
| Review/rating ảo | Tuyệt đối không mua/nhờ rating ảo — vi phạm policy CWS, có thể bay listing. Chỉ nudge trong app (đã build) và nhờ người dùng thật. |
| AI content bị nhận ra trên HN/Reddit | AI chỉ draft; bạn sửa lại theo giọng mình trước khi đăng. Post ngắn, thật, có chi tiết cá nhân. |

## Việc [Bạn] phải tự làm (AI không thay được)

1. Dán listing mới vào CWS dashboard (1.2) và điền baseline vào bảng số đo.
2. Tạo tài khoản GoatCounter + verify Google Search Console (1.3).
3. Thêm GitHub topics + social preview (1.4), duyệt PR awesome list trước khi mở.
4. Submit AlternativeTo (1.5).
5. Đăng bài forum/Reddit/dev.to/HN bằng account cá nhân + trực comment (tuần 2).
6. Export số CWS cuối tuần 3 (3.2).
