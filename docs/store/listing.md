# Chrome Web Store — Store Listing (EN)

> Dán từng mục vào tab **Store listing** của developer dashboard.
> Title và Summary lấy tự động từ manifest khi upload zip — hai mục đầu chỉ để đối chiếu.

## Title (từ manifest — 39/45 ký tự)

Elasticvix - Elasticsearch Client & GUI

## Summary (từ manifest — 126/132 ký tự)

Elasticsearch client & GUI with query console, field-aware autocomplete, saved queries, and multi-cluster support. ES 6.x-9.x.

> Title/Summary lấy từ manifest → chỉ đổi khi upload zip mới (qua review lại).
> Thêm "GUI" theo [keyword map](../research/keyword-map.md): keyword "elasticsearch gui"
> hiện chỉ mình Elasticvue rank.

## Category

Developer Tools

## Language

English

## Description (dán vào ô Description — plain text, giữ nguyên xuống dòng)

Elasticvix is an Elasticsearch client and GUI that runs entirely in your browser — a lightweight frontend for your cluster. Connect and start querying in seconds. No server, no desktop app, no account, nothing sent to us.

What sets it apart: the autocomplete and linting actually read your cluster. Instead of static keyword lists, you get the real field names and real values from your own indices as you type — so you write correct queries faster and catch mistakes before you run them.

QUERY CONSOLE
• Write Query DSL with autocomplete that knows your data — it reads your index mappings to suggest real field names, and even the real values of keyword fields, not just static keywords
• Context-aware suggestions that follow the Query DSL structure and API endpoints as you type
• Field linting flags any field that isn't in your index mapping before you run — no more silent zero-hit queries from a mistyped field (toggle on or off)
• A response viewer built for big responses: fold JSON nodes, filter down to just the paths you care about, and download the whole response in one click
• One-key formatting and Cmd/Ctrl+Enter to run

SEARCH UI
• Pick indices and search visually, without hand-writing full requests
• Open any index's mapping as a searchable field → type table — no more reading raw _mapping JSON
• Results in a sortable hits table with a full document detail view
• Edit or delete a document straight from the results — no hand-written _update or DELETE, and a confirm step before anything is deleted
• Run aggregations and inspect the raw response
• Download results as JSON

CLUSTER OVERVIEW
• The tab it opens on: cluster health, version, and shard, index, and document counts at a glance
• A per-node table showing RAM, JVM heap, disk, and CPU usage — the numbers you actually check
• One-click refresh, and each section loads on its own so a slow cluster never blanks the page

SAVED QUERIES & HISTORY
• Save queries with names and tags, and find them again by search or tag
• Every request is kept in history automatically, so you can pick up where you left off

MULTI-CLUSTER
• Store as many connections as you need and switch between them instantly
• See each cluster's health at a glance
• Auth: none, basic auth, API key, or bearer token

WORKS WITH
• Elasticsearch 6.x, 7.x, 8.x (tested) and 9.x (best effort)

PRIVACY
All data stays on your machine. Connections, credentials, saved queries, and history are stored locally in your browser and sent only to the Elasticsearch clusters you configure. No analytics, no tracking, nothing ever sent to us.

WHY "ACCESS TO ALL SITES"?
An Elasticsearch cluster can live on any URL — localhost, a private IP, or any cloud host — so the extension requests broad host access to reach the cluster URLs you add. It has no content scripts: it never reads or changes the websites you visit. Requests go only to clusters you configure yourself.

OPEN SOURCE
Elasticvix is free and open source under the MIT License. There's no server behind it and we never store your data. Browse the code, report issues, and send pull requests: https://github.com/totanvix/elasticvix

## Support email

totanvix@gmail.com

## Homepage

https://totanvix.github.io/elasticvix/
