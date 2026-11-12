# Phase 2 — Auto cut nhớ cấu hình + đặt sẵn ActivOS

## Files
- `apps/server/src/prefs.ts` — đã có scope `auto-cut`, dùng lại.
- `apps/server/src/routes/autoCut.ts` — `GET /defaults`; POST/PATCH ghi nhớ.
- `apps/web/src/components/AutoCutCreateModal.tsx` — nạp mặc định từ `/defaults`.
- `docs/API.md` — thêm endpoint.

## Nhớ gì / không nhớ gì
- Nhớ: `mode`, `params.minSec/maxSec/count/minutes/overlapSec`, `output` (aspect, layout, background, styleId, fps), `brief` TRỪ field gắn với một video (`sourceDescription`, `mainKey`, `notes`), `transcribe`, `autoEdit`.
- Không nhớ: `name`, `sourceRel`, `params.request`, segments.
- Theo đúng luật `prefs.ts`: chỉ ghi SAU khi validate thành công; đọc qua normalize (`parseOutput`, `parseBriefPatch`), file hỏng = về mặc định.

## Đặt sẵn cho Trí (dữ liệu máy, không commit)
- Tạo Style Design `activos` (màu theo guideline, font Archivo / Be Vietnam Pro / JetBrains Mono tải qua trang Style Design, **không logo**).
- Tạo phiên đầu với: mode `ai`, 9:16, layout `auto`, style `activos`, skill `activos-tiktok`, autoCut `tight`, autoIllustrations OFF, autoEdit ON → từ đó thành mặc định.

## Kiểm tra
Tạo 2 phiên liên tiếp qua API, phiên 2 không gửi output/brief vẫn ra đúng bộ của phiên 1.
