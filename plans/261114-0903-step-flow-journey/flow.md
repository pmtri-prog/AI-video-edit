# Luồng edit 4 lần duyệt

Trạng thái: đã code 14/11/2026. Đổi thứ tự cổng cùng ngày: bìa + caption lên Duyệt 1, thêm Duyệt 3 Âm thanh, bỏ cổng Đóng gói. Trang `/projects/<id>/steps`.
Code: `apps/server/src/contentGate.ts`, `routes/steps.ts` (content), `routes/publish.ts` (hashtag),
`soundGate.ts`, `apps/web/src/app/projects/[id]/steps/{page,ContentGate,CoverGate,SoundGate}.tsx`. API: `docs/API.md` mục "Luồng 4 lần duyệt".
Chưa làm: ghi chú theo thời điểm ở Duyệt 4 (Bản nháp); tách Phần 1/2 mới chỉ ghi quyết định (tạo 2 project bằng mục Clip). Ảnh Stitch: `stitch/v2/` · canvas https://stitch.google.com/projects/4772943092769373169

Nguồn luật: skill `activos-tiktok` mục 1.1, 3.9, 6.1, 7 và `assets/brand/activos/guideline.md` mục 5, 6, 6B (Trí duyệt 14/11/2026, học từ kênh Khánh LifeTech).

## Nguyên tắc

1. Câu móc quyết định view. Ảnh bìa chỉ làm đẹp lưới trang kênh, nên duyệt nhanh.
2. 0–3 giây là cảnh wow thật, câu móc lồng tiếng đè lên. Không mở bằng mặt người nói.
3. Một video một ý. Hai ý thì tách Phần 1 / Phần 2, không bỏ ý.
4. Không cắt nội dung để đạt độ dài. Video câu chuyện được dài tới khoảng 2 phút.
5. Máy chỉ dừng giữa hai cổng khi QC báo đỏ. Sửa cổng nào chỉ chạy lại phần sau cổng đó.

## Các bước

| # | Loại | Nội dung |
|---|---|---|
| máy | tự chạy | Chép lời, tìm khoảng lặng, **chấm câu móc theo 7 công thức**, **đếm số ý**, tìm ứng viên cảnh wow 0–3s |
| 1 | **Duyệt: Nội dung & bìa** | Câu móc khớp công thức nào (hay bị gắn cờ yếu: mở bằng tên giải pháp/câu nhật ký). Chọn cảnh wow 0–3s và chữ tiêu đề. Một ý hay tách phần (điểm tách + câu hỏi bỏ ngỏ cuối Phần 1). Đoạn cắt trên bản chép lời (giữ ≥ 85% lời). Tên riêng và con số (chỉ số trong guideline mục 9). **Ảnh bìa** từ ảnh/video sự kiện thật, **tiêu đề dạng câu hỏi** (kết "?", không chấm đỏ). **Caption** = một câu nhắc lại câu móc + `#tryoh #learnontiktok #sukien #sampling` + tối đa 2 tag. Nếu đã tách: mỗi phần một bìa, một caption |
| máy | tự chạy | Cắt thô, tìm cảnh trong Kho TryOh |
| 2 | **Duyệt: Cảnh sự kiện** | Cảnh nào chèn câu nào, mặt khách, logo, không lặp cảnh. Dựng draft để xem thử |
| máy | tự chạy | Gợi ý đoạn nhạc theo câu móc + từng ý, gợi ý điểm SFX ở mỗi cảnh chèn và thẻ chữ |
| 3 | **Duyệt: Âm thanh** | Nhạc nền: không nhạc / một bài cả video (mặc định) / theo đoạn (mỗi đoạn một bài hoặc im lặng, chuyển mượt 1s). Nhạc tự nhỏ khi đang nói. SFX từng điểm: bật/tắt, đổi tiếng, nghe thử, âm lượng. Duyệt = dựng bản nháp có âm thanh |
| máy | tự chạy | Phụ đề, chữ, render nháp, QC tự động |
| 4 | **Duyệt: Bản nháp** | Xem hết, chạy QC. **Duyệt & xuất bản** = render final từ đúng timeline đó, rồi hiện video + ảnh bìa + caption để đăng. Giữ project |

## Máy không được làm thay Trí

- Không tự viết lại lời câu móc. Câu móc mới nghĩa là quay lại, Trí quyết.
- Công thức 6 (trả lời bình luận) chỉ khi có bình luận thật. Công thức 7 (sự cố) chỉ khi có sự cố thật.
- Câu móc chỉ nói về máy/trải nghiệm của chính Trí, không chê nhãn hay agency khác. Không nói tiền.

## Ghi chú về ảnh Stitch

Stitch tự bịa vài chi tiết minh họa, không phải tính năng: "-65% tỷ lệ giữ chân", "độ chắc tiếng 98%", nội dung Phần 2, máy render RTX. Nhãn "Nghe sai sai / nghịch lý" trong Duyệt 1 không phải một trong 7 công thức. Khi code, câu móc phải khớp đúng một trong 7, không thì gắn cờ.
