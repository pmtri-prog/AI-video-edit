# Phase 4 — Gắn kho vào edit

## Files
- `apps/server/src/meta.ts` — brief thêm công tắc `brollLibrary: boolean` (mặc định TẮT; preset Trí BẬT).
- `apps/server/src/editPrompt.ts` — in CẢ HAI chiều BẬT/TẮT (luật CLAUDE.md mục 5.7).
- Route stage trả `409 BROLL_DISABLED` khi brief tắt.
- `.claude/skills/activos-tiktok/SKILL.md` mục 4 — thay quy trình "tải về ~/Downloads + so hash" bằng: tra `GET /api/media-library`, stage qua API.
- `docs/API.md`.

## Luật chèn (ghi vào prompt + skill)
- Lời nói nhắc sự kiện/brand/máy → tìm mục approved khớp tag; ưu tiên `faces: none|far`.
- Scene sheet trong brief notes thắng mọi lựa chọn tự động.
- Brand trên màn hình phải nằm trong danh sách duyệt của guideline mục 9.
- Không có clip khớp → giữ talking head, ghi vào báo cáo; KHÔNG dùng ảnh AI (autoIllustrations vẫn OFF).
- Mỗi clip b-roll 2–5 giây, không phủ quá 40% thời lượng video.

## Kiểm tra
Dựng thử một draft thật từ raw có nhắc sự kiện có trong kho, xem bằng mắt.
