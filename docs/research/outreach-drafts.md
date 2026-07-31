# Outreach drafts — awesome list + directories (tuần 1)

> Task 1.4/1.5 của [growth plan](../superpowers/plans/2026-07-31-growth-plan-3-weeks.md).
> Bạn duyệt nội dung ở đây → AI mở PR awesome list bằng `gh`; các directory bạn tự submit
> (cần tài khoản cá nhân), copy nguyên văn bên dưới.

## 1. PR vào dzharii/awesome-elasticsearch — [AI mở sau khi bạn duyệt]

- **Vị trí:** section "Elasticsearch plugins" → subsection **Cluster** (nơi có
  elasticsearch-head, Cerebro, Elastic HQ).
- **Dòng thêm** (đúng format của list):

  ```markdown
  [totanvix/elasticvix](https://github.com/totanvix/elasticvix) - Elasticvix is a free open source (MIT) Chrome extension: an Elasticsearch client with a query console, autocomplete that suggests real field names and values from your cluster, a visual search UI, saved queries and multi-cluster support. ES 6.x-9.x
  ```

- **PR title:** `Add Elasticvix to Cluster tools`
- **PR body:**

  ```
  Adds Elasticvix, a free open-source (MIT) Chrome extension Elasticsearch client.

  Notable vs existing entries: its autocomplete reads the index mappings of the
  connected cluster and suggests real field names and keyword-field values while
  writing Query DSL, and it lints fields that don't exist in the mapping before
  the query runs. Runs entirely in the browser — no server component.

  - Source: https://github.com/totanvix/elasticvix
  - Chrome Web Store: https://chromewebstore.google.com/detail/elasticvix-elasticsearch/glnbabapnpecmdaekagajnedgkbhcgad
  ```

## 2. AlternativeTo — [Bạn submit tại alternativeto.net/manage-item/]

- **Name:** Elasticvix
- **URL:** https://totanvix.github.io/elasticvix/
- **Short description (dưới 140 ký tự):**
  > Free open-source Chrome extension Elasticsearch client & GUI: query console with cluster-aware autocomplete, search UI, multi-cluster.
- **Full description:**
  > Elasticvix is an Elasticsearch client that runs entirely in your browser as a Chrome extension. It offers a query console whose autocomplete reads your cluster — suggesting real field names and values from your index mappings — plus field linting, a visual search UI with mapping browser, document edit/delete, saved queries, history, and multi-cluster support with basic auth, API key, or bearer token. Free, open source (MIT), no server, no account, no tracking.
- **License:** Open Source (MIT) · **Platforms:** Chrome (extension)
- **Alternative to:** Elasticvue, Cerebro, elasticsearch-head, Kibana (Dev Tools), ElasticHQ
- **Tags:** elasticsearch, database-management, developer-tools, gui-client

## 3. Slant — [Bạn thêm tại slant.co topic "elasticsearch-gui-clients"]

- Topic: *What are the best Elasticsearch GUI clients?* (topic id 11537 — đang rank
  trang 1 Google cho "elasticsearch gui clients")
- **Option name:** Elasticvix
- **Pros gợi ý (mỗi pro một dòng, viết như user thật):**
  - Autocomplete suggests real field names and values from your own cluster, not static keywords
  - Lints fields that aren't in the index mapping before you run the query
  - Runs entirely in the browser as a Chrome extension — nothing to install or host
  - Free and open source (MIT), no account or tracking
- **Con trung thực (Slant cho phép, tăng độ tin):**
  - Chrome-only — no Firefox or desktop version

## 4. SaaSHub — [Bạn submit tại saashub.com/submit]

- **Name:** Elasticvix
- **Tagline:** Elasticsearch client & GUI in your browser
- **Description:** dùng lại Full description của AlternativeTo ở trên.
- **Categories:** Developer Tools, Database Tools

## Ghi chú

- Không tự tạo trang đối thủ hay viết review chéo — chỉ tạo entry cho chính mình,
  điền field "alternative to" theo cơ chế của từng trang.
- Sau khi các entry live, thêm link vào README (mục badges) nếu trang cho backlink.
