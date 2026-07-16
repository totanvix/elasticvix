# Chrome Web Store — Privacy Tab

> Dán từng mục vào tab **Privacy** của developer dashboard.

## Single purpose

Elasticvix provides a client interface for Elasticsearch: connect to clusters, run queries, and browse search results.

## Permission justifications

### storage

Used to store the user's Elasticsearch connection profiles, saved queries, query history, and UI preferences locally on their device. Nothing is transmitted to the developer.

### Host permission (http://*/* and https://*/*)

Users connect to their own Elasticsearch clusters, which can be hosted on any URL: localhost, private/internal IP addresses, any port, or any cloud provider. It is impossible to enumerate these hosts in advance, so broad host access is required for the extension's single purpose.

The extension has no content scripts and never reads or modifies web pages. The only network requests are made by the background service worker, exclusively to the cluster base URLs the user has explicitly configured inside the extension.

## Remote code

No — all JavaScript is packaged inside the extension. (Chọn "No, I am not using remote code".)

## Data usage

Không tick mục nào trong danh sách "What user data do you plan to collect?" — extension không thu thập dữ liệu người dùng: credentials và queries chỉ lưu local trên máy, chỉ gửi đến cluster do chính user cấu hình, không bao giờ gửi về developer.

Tick đủ 3 certification:
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

## Privacy policy URL

URL của Notion public page (tạo ở bước checklist — dán nội dung docs/store/privacy-policy.md).
