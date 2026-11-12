# Luồng video ngắn của Trí: raw → cắt → edit ActivOS + kho TryOh

Status: in progress · Created 2026-11-12

## Mục tiêu
Một luồng gọn cho video của Trí: up video raw → AI chọn đoạn (Trí duyệt) → cắt 9:16 → tự edit tối đa 3 video theo skill `activos-tiktok`, có b-roll + ảnh thật từ kho TryOh (Google Shared Drive) tự chèn theo lời nói.

## Quyết định đã chốt (Trí, 2026-11-12)
- Tab không dùng: **ẩn khỏi menu** bằng công tắc "Chế độ gọn", không xóa code.
- Giữ bước **duyệt danh sách đoạn** trước khi cắt.
- Độ dài clip: **chọn riêng mỗi video** (giữ ô min/max hiện có).
- Auto edit: **giữ tối đa 3** project mỗi lần cắt.
- Kho TryOh: lấy qua **Chrome** (Trí đã đăng nhập), KHÔNG cài Google Drive for desktop. Tải về thư mục kho cục bộ rồi app index (đổi ý 2026-11-12).
  - Shared Drive "Tryoh!" `0AAVIirV656S_Uk9PVA`; footage: `TryOh!E vent Media` `1IT1PlUR6ATGif7GQiO17E5ynkFFnIh53` — mỗi thư mục con = một sự kiện → tên thư mục = tag sự kiện.
  - Brand: `Tryoh Brand Asset` `1Mm_WnjuVXCxyb8CayP1NO5i6olmhCm54` (font, Logo, Mascot, color.pdf).
- **Không đóng logo TryOh ở góc** video TikTok (TikTok hạn chế watermark đầu/cuối) → Style Design TryOh tạo không logo.
- Style Design TryOh: ĐÃ TẠO (id `tryoh`, mặc định) theo Quy chuẩn nhận diện TryOh! v1.0 (Drive `1Hzz2mXM6Necnxh00ESY6r-jsCsj0RorI`), không logo góc. Guideline nói TryOh! thay ActivOS ở mọi chỗ khách thấy → skill `activos-tiktok` cần đổi end card (chờ Trí).
- Tag: **Gemini vision tự gắn + Trí sửa** trên web.
- Chèn: **tự chèn theo lời nói**; scene sheet trong brief notes vẫn thắng.
- "Video trám" = b-roll.

## Phases
| # | Phase | Status | File |
|---|---|---|---|
| 1 | Chế độ gọn cho menu | code xong, chưa xem trên trình duyệt | [phase-01](phase-01-compact-nav.md) |
| 2 | Auto cut nhớ cấu hình + đặt sẵn ActivOS | API xong + test; còn tạo Style Design `activos` | [phase-02](phase-02-auto-cut-prefs.md) |
| 3 | Kho TryOh: index + tag Gemini + tab web | todo | [phase-03](phase-03-tryoh-media-library.md) |
| 4 | Gắn kho vào edit (prompt + skill) | todo | [phase-04](phase-04-broll-in-edit.md) |

Phụ thuộc: 4 cần 3. 3 cần Trí cài Google Drive for desktop. 1, 2 độc lập.

## Acceptance
- Menu chế độ gọn: Dashboard, Videos Project, Auto cut, Kho TryOh, Render Queue, Style Design, Skills, Cấu hình, Kết nối.
- Tạo phiên Auto cut thứ hai không phải chọn lại aspect/layout/style/brief/autoEdit.
- Edit một clip nói về sự kiện có trong kho → draft có b-roll đúng sự kiện, không lộ mặt khách, không file trùng.
- `npm run typecheck` + `npm run build` + `check-design-system.mjs` sạch.
