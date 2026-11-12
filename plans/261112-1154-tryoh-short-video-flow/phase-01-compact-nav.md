# Phase 1 — Chế độ gọn cho menu

## Files
- `apps/web/src/components/Shell.tsx` — cờ `compact` trên từng mục NAV, lọc khi bật.
- `apps/web/src/app/config/page.tsx` — card công tắc.
- `apps/web/src/lib/locales/{vi,en}.ts` — chuỗi.

## Cách làm
- Tùy chọn giao diện của một máy → `localStorage` key `aiev-compact-nav`, mặc định TẮT (người cài mới vẫn thấy đủ).
- Mục ẩn khi bật: images, text-to-video, translate-video, voices, video-styles, assets, sfx, prompts.
- Đang đứng ở trang bị ẩn thì vẫn mở được bằng URL (chỉ ẩn menu, không chặn route).
- Đồng bộ giữa Config và Shell bằng sự kiện `storage` + custom event, không reload.

## Kiểm tra
typecheck, check-design-system, bật/tắt trên trình duyệt thấy menu đổi ngay.
