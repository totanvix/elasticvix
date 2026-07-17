# Checklist submit Elasticvix lên Chrome Web Store

## A. Chuẩn bị một lần (làm tay)

- [ ] 1. Tạo Chrome Web Store developer account tại https://chrome.google.com/webstore/devconsole
      với Google account gắn email totanvix@gmail.com. Trả phí đăng ký $5 (một lần). Xác minh email.
- [x] 2. Privacy policy đã publish tại https://totanvix.github.io/elasticvix-web/privacy-policy/
      (repo public totanvix/elasticvix-web, GitHub Pages; nguồn nội dung: `docs/store/privacy-policy.md` —
      sửa nội dung thì cập nhật cả hai nơi).

## B. Kiểm tra trước khi upload (chạy máy)

- [ ] 3. `pnpm compile && pnpm test` — xanh.
- [ ] 4. `pnpm build && node scripts/store/verify-assets.mjs --strict` — tất cả OK.
- [ ] 5. `pnpm wxt zip` — có file `.output/elasticvix-1.0.0-chrome.zip`.
- [ ] 6. Smoke test bản zip: mở Chrome profile sạch → chrome://extensions → bật Developer mode →
      Load unpacked trỏ vào `.output/chrome-mv3` → thêm connection → chạy 1 search →
      save 1 query → mở lại saved query. Mọi bước hoạt động.

## C. Trên developer dashboard

- [ ] 7. New item → upload `.output/elasticvix-1.0.0-chrome.zip`.
- [ ] 8. Tab **Store listing**: điền theo `docs/store/listing.md`
      (category Developer Tools, description, support email; homepage: https://totanvix.github.io/elasticvix-web/).
- [ ] 9. Upload ảnh:
      - 5 screenshots trong `docs/store/screenshots/` (đúng thứ tự 01→05)
      - Small promo tile: `docs/store/promo/small-440x280.png`
      - Marquee promo tile: `docs/store/promo/marquee-1400x560.png`
- [ ] 10. Tab **Privacy**: điền theo `docs/store/privacy-form.md`, dán
      https://totanvix.github.io/elasticvix-web/privacy-policy/ vào Privacy policy.
- [ ] 11. Tab **Distribution**: Public · All regions · Free.
- [ ] 12. Submit for review.

## D. Sau khi submit

- Vì extension dùng broad host permissions, Chrome sẽ in-depth review: thường vài ngày,
  có thể tới vài tuần. Không rebuild/re-upload trong lúc chờ trừ khi bị yêu cầu.
- Nếu reviewer hỏi thêm về quyền: trả lời dựa trên mục "Host permission" trong
  `docs/store/privacy-form.md`.
- Nếu bị reject vì quyền rộng: phương án B là chuyển sang `optional_host_permissions`
  xin động theo thiết kế trong `docs/superpowers/specs/2026-07-07-vixelastic-query-console-design.md`.
- Được duyệt → kiểm tra listing công khai, cài từ store và smoke test lại một lần.
