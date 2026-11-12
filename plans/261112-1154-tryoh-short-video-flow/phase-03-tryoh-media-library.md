# Phase 3 — Kho TryOh (b-roll + ảnh thật)

## Tiền đề (Trí làm)
Cài Google Drive for desktop, đăng nhập, bật Shared Drive. Thư mục sẽ hiện ở
`~/Library/CloudStorage/GoogleDrive-<tài khoản>/Shared drives/<tên>`. Để chế độ "Stream" (file tải khi đọc).

## Thiết kế
- Cấu hình đường dẫn gốc kho ở trang Cấu hình (`data/media-library.json` → `rootDir`), không hardcode, `path.join` toàn bộ.
- Index: `data/media-library/index.json` — mỗi mục `{ id = sha256 đầu file, relPath, kind: video|image, durationSec?, width, height, mtime, tags: { event?, brand?, shot: wide|hand|machine|screen|crowd|product, faces: none|far|recognizable }, description, approved }`.
  - Khóa là **hash** → Drive đổi tên / tải trùng ` (1)` không sinh mục mới (đúng luật chống trùng của skill).
- Quét: job `media-index` trong render queue (thấy được tiến độ). Video: trích 3 frame bằng ffmpeg; ảnh: dùng thẳng. Gửi Gemini vision (`gemini-2.5-flash`) → tag + mô tả. Chỉ tag file mới/đổi hash. Thiếu key → vẫn index, tag rỗng.
- Thư mục `TryOh bằng chứng`, ảnh máy… Trí tự bỏ vào Drive; không đọc `~/Documents` trực tiếp.
- API: `GET /api/media-library?query=&kind=&event=`, `PATCH /api/media-library/:id` (sửa tag, approved), `POST /api/media-library/scan`, `POST /api/media-library/:id/stage {projectId}` → chép vào `video-projects/<id>/assets/broll/` (hash trùng thì bỏ qua) và trả `relPath`.
- Web: tab "Kho TryOh" — lưới thumbnail, lọc theo sự kiện/loại cảnh/lộ mặt, sửa tag, nút Quét lại.

## Rủi ro
- File Drive dạng stream: lần đầu đọc chậm, mất mạng thì lỗi → job ghi rõ file nào bỏ qua, không làm hỏng cả lượt.
- Ảnh lộ mặt khách / SĐT: `faces: recognizable` mặc định `approved=false`, AI không được lấy trừ khi Trí duyệt.
