# ActivOS — Brand guideline cho bot tạo video TikTok

> **File này là nguồn sự thật.** Skill `activos-tiktok` đọc file này trước mỗi lần dựng. Muốn đổi luật thì sửa ở đây, không cần sửa skill. Vị trí: `assets/brand/activos/guideline.md`.

> **English summary.** Brand rules for an AI video generator producing TikTok videos for Phạm Minh Trí's personal channel, which sells ActivOS Events to agencies and FMCG/beauty brand managers. Format: vertical 9:16. Story order is always Wow → Consent → Engage, coloured peach / sky / mint. Fonts: Archivo (width 62%, weight 800) for headlines, Be Vietnam Pro for subtitles, JetBrains Mono for labels. No emoji, no all-caps, no gradients, no white text on pastel. Use only real footage with no recognisable consumer faces. Every number carries a date and a place. Never mention costs, margins or prices.

Nguồn: quy chuẩn thương hiệu ActivOS (chốt 05/11/2026) và doc "Kế hoạch TikTok cá nhân của Trí" (mục 2, 5, 5B, 9, 12, 13 — bản 12/11/2026).
Các thông số riêng cho định dạng video (cỡ chữ, vùng an toàn) do mình thêm vào, quy chuẩn gốc chưa có. Đã duyệt dùng cố định ngày 12/11/2026.

> **Cập nhật 12/11/2026: video dùng nhận diện TryOh! v1.0.** Màu và font lấy từ bộ nhận diện TryOh trong `assets/brand/tryoh/` (bảng màu `03-mau/mau-tryoh.txt`, font `04-chu/font-tryoh.txt`). Mục 3 (Màu), mục 4 (Chữ: font) và màu 3 vạch ở mục 5 bên dưới là bản ActivOS cũ, **không còn dùng cho phần nhìn**; thông số thay thế nằm ở skill `activos-tiktok` mục 2–3. Mọi luật còn lại (lời thoại, từ cấm, số liệu, tên khách, hình ảnh thật, không lộ mặt, công thức Wow → Consent → Engage) giữ nguyên.

---

## 1. Kênh này là gì

- **Người nói:** Phạm Minh Trí, founder ActivOS. Đã làm phần cứng, làm D2C, làm marketing, rồi tự vibe code để làm máy cho sự kiện.
- **Định vị:** Tech experience & data. Câu nói trên kênh: *"Mình làm trải nghiệm công nghệ ở sự kiện, và biến nó thành dữ liệu thật cho nhãn."*
- **Mục tiêu duy nhất:** bán ActivOS Events. View và follow chỉ là phương tiện.
- **Người xem:**
  - người nghĩ ý tưởng ở agency (creative, planner);
  - người chạy sự kiện ở agency (AM, producer);
  - người cầm ngân sách ở nhãn FMCG, beauty (brand, trade, activation manager).
- **Khẩu hiệu:** `Make offline count.` — luôn tiếng Anh, có dấu chấm.

## 2. Tên — viết đúng từng chữ

| Đúng | Sai |
|---|---|
| ActivOS | Activos, ACTIVOS, Activ OS, Activ-OS |
| ActivOS Events | "thuê thiết bị", "activation trọn gói" |
| Smart Booth · Smart Sampling · Snap & Sample | "ActivOS Smart Booth" (không thêm ActivOS phía trước) |
| Wow · Consent · Engage (tiếng Anh, viết hoa chữ đầu) | WOW, wow |

- **TryOh!:** chỉ dùng khi nói về máy đặt ở chung cư, quán cà phê. Không dùng "Thử là Ồ!".
- **Snap & Sample:** sắp ra mắt. Hình nào dùng phải ghi "Hình minh hoạ".
- **SiliconZ:** không xuất hiện trên video.

## 3. Màu (bản ActivOS cũ - phần nhìn đã chuyển sang TryOh!, xem đầu file)

| Token | Hex | Dùng cho |
|---|---|---|
| peach | `#ffd3c2` | Lớp **Wow** (trải nghiệm tại sự kiện) · cấp 1 · Smart Booth |
| sky | `#cde4ff` | Lớp **Consent** (xác thực, đồng ý, dữ liệu, luật) · cấp 2 · Snap & Sample |
| mint | `#d1ffca` | Lớp **Engage** (chăm lại sau sự kiện) · cấp 3 · Smart Sampling · thẻ "Đang chạy" |
| lilac | `#e4d9ff` | Màu thứ tư khi xoay vòng, không gắn lớp nào |
| yellow | `#fff100` | **Chỉ** thẻ "Đang thử nghiệm". Không làm nền khối |
| black | `#000000` | Chữ chính, nền mảng tối |
| white | `#ffffff` | Chữ trên nền đen, nền thẻ |
| g2 | `#e5e5e5` | Nền sáng mặc định |
| g5 | `#444444` | Chữ phụ trên nền sáng |
| g7 | `#1a1a1a` | Thẻ trên nền đen |
| overlay | `rgba(0,0,0,0.72)` | Viên chú thích đặt trên ảnh hiện trường, chữ trắng |

**Luật màu:**
- Chữ trên mọi nền pastel là **đen**. Không bao giờ đặt chữ trắng trên pastel hay vàng.
- Mỗi khung hình tối đa 3 màu pastel, cộng đen và trắng.
- Không dùng gradient.
- Không thêm màu ngoài bảng trên: không đỏ, không xanh lá cho đúng/sai.
- Nội dung thuộc lớp nào thì dùng màu lớp đó. Nội dung không thuộc lớp nào thì xoay vòng mint → peach → sky → lilac; hai thẻ liền nhau không cùng màu.
- Màu dùng thành mảng lớn (khối, thẻ), không rắc chấm nhỏ.

## 4. Chữ

| Vai | Font | Thông số |
|---|---|---|
| Tiêu đề lớn, con số, thẻ chữ chính | **Archivo** | Đậm 800, `font-stretch: 62%`, khoảng chữ −2%, dòng 0,9–1,05 |
| Phụ đề, lời thoại trên màn hình | **Be Vietnam Pro** | 600 (phụ đề), 400–500 (chữ thường) |
| Nhãn nhỏ: ngày, nơi, nguồn | **JetBrains Mono** | 400 |

File font nằm sẵn trong `assets/styles/files/activos/`: `Archivo-VF.ttf` (biến thiên, có trục độ rộng 62–125), `BeVietnamPro-Regular.ttf`, `BeVietnamPro-SemiBold.ttf`, `JetBrainsMono-VF.ttf`. Bot nạp bằng `@font-face` từ các file này, không gọi Google Fonts lúc render.

- **Không viết hoa toàn bộ**, kể cả tiêu đề. Chỉ hoa chữ đầu câu và tên riêng.
- **Không emoji.** Ký hiệu được dùng: `→` `✓` `·` `+` `–`.
- Mỗi khung hình tối đa một tiêu đề Archivo lớn.
- Số viết kiểu Việt: dấu chấm ngăn nghìn (5.000+), dấu phẩy thập phân (1,5 lần).

**Cỡ chữ trên khung 1080 × 1920:**
- Tiêu đề Archivo: 120–160px.
- Phụ đề Be Vietnam Pro: 52–60px, tối đa 2 dòng.
- Nhãn mono (ngày, nguồn): 30–34px.

## 5. Định dạng video

- **Khung:** dọc 9:16, 1080 × 1920.
- **Độ dài:** 40–60 giây.
- **Phụ đề cứng toàn bộ**, vì người xem thường tắt tiếng.
- **Vùng an toàn:** chữ và logo nằm trong khoảng 150px dưới mép trên, trên 400px cách mép dưới, và cách mép phải 140px, để không bị nút và caption của TikTok che.
- **Chuyển động:** chậm, có mục đích. Zoom nhẹ 1 → 1,08. Không hiệu ứng giật, không chuyển cảnh lòe loẹt.

### Bộ nhận diện trong video
- **3 vạch màu ở góc trên:** peach · sky · mint, theo thứ tự Wow → Consent → Engage. Video nói cấp nào thì vạch cấp đó sáng, hai vạch còn lại mờ 30%.
  - cấp 1 = peach
  - cấp 2 = sky
  - cấp 3 = mint
- **Thẻ chữ theo lớp:** khối pastel bo góc 32px, chữ đen.
- **Thẻ nguồn:** chữ mono nhỏ ở góc dưới, ví dụ `Nguồn: BCG × Google, 2024`. Ghi đúng năm của con số (2021 cho số hiệu quả, 2024 cho định nghĩa và xu hướng).

### Logo
- **Không có end card, không đóng logo góc.** Góc trên dành cho 3 vạch màu. Style Design cố ý để trống logo để hệ thống không tự đóng logo góc.
- Dùng file gốc trong `assets/brand/activos/`, chép vào `assets/` của project rồi mới dùng. Không gõ lại chữ ActivOS bằng font khác.
  - `activos-ngang.svg` cho nền sáng, `activos-ngang-nen-toi.svg` cho nền đen.
- Không kéo méo, không đổi màu, không đổi thứ tự vạch, không thêm bóng, viền.
- Chừa khoảng trống quanh logo tối thiểu bằng nửa chiều cao chữ A.
- Logo nhãn chỉ xuất hiện khi nhãn đã đồng ý. Khi đứng cạnh nhau: logo nhãn `×` ActivOS, cao bằng nhau.

## 6. Công thức một video

| Giây | Lớp | Làm gì |
|---|---|---|
| 0–3 | Wow · hook | Cảnh trải nghiệm thật hoặc một con số có ngày và nơi. **Không mở bằng mặt người nói.** |
| 3–25 | Wow · concept | Trải nghiệm là gì, vì sao người qua đường dừng lại |
| 25–40 | Consent | Người chơi xác thực khoảng 10 giây, đồng ý rõ ràng. Quay cận tay, che số |
| 40–55 | Engage | Nhãn chăm lại người đã đồng ý. Một con số có ngày và nơi |
| 55–60 | Câu hỏi | Một câu hỏi thật cho người trong nghề, video kết ở câu này (không end card) |

**Một video = một ý, một con số.** Có hai ý thì cắt thành hai video.

## 7. Giọng nói và lời thoại

- **Xưng hô:** "mình", gọi người xem là "mọi người" hoặc "anh em".
- Câu ngắn, nói như kể cho bạn nghe. Mở bằng một cảnh cụ thể: giờ, nơi, người.
- **Gần như không nói thuật ngữ tiếng Anh.** Wow, Consent, Engage chỉ hiện trên thẻ chữ. Thuật ngữ BCG (Nascent, Emerging, Connected, Multi-moment, first-party data) được nói, nhưng luôn kèm giải thích tiếng Việt và câu "theo BCG và Google".
- Nói về **cái nhãn có thể làm**, không nói về cái nhãn chưa làm hay làm sai. Không chê "kiểu cũ", không chê đơn vị khác.
- Người tiêu dùng là người: nói "người đã đồng ý", "người thật đã xác thực". **Không** nói "data khách", "lead", "thu data".
- Nhắc lời hứa khi nói về dữ liệu: "Dữ liệu chỉ dùng cho chiến dịch đó."
  - Câu "Brand không nhận danh sách số điện thoại" chỉ dùng sau khi Trí xác nhận đúng với cách đang làm.
- Nói rõ cái gì đang chạy, cái gì đang thử. Ví dụ: "Đo người quay lại mua đang thử nghiệm cùng một số nhãn", kèm thẻ vàng "Đang thử nghiệm".

**Từ cấm:** giải pháp toàn diện · đột phá · hàng đầu · tối ưu hoá trải nghiệm · nhất · đầu tiên · 100% · chúng tôi tự hào · inbox báo giá · comment để nhận tài liệu.

**Kết video:** bằng một câu hỏi thật, ví dụ: "Nhãn của mọi người đang ở bậc nào?". Không kêu gọi kiểu bán hàng.

## 8. Hình ảnh

- **Chỉ dùng ảnh và video thật từ sự kiện đã chạy.** Không stock, không 3D, không hình AI cho hiện trường.
- **Không để lộ mặt người tiêu dùng nhận ra được.** Quay từ xa, từ sau, hoặc cận tay.
- **Che toàn bộ tên và số điện thoại** trên màn hình máy và hệ thống.
- Ảnh có chữ đè lên: thêm lớp phủ đen từ trong suốt 25% tới 88% ở đáy.
- Ảnh sản phẩm tách nền đặt trên nền pastel phẳng, có bóng elip dưới chân.
- Bộ cảnh nên có ở mỗi sự kiện:
  1. lắp máy (time-lapse);
  2. máy chạy, người chơi;
  3. màn hình game hoặc nhận quà;
  4. sự cố và cách xử lý;
  5. dọn máy;
  6. Trí nói một câu vào camera.

## 9. Số liệu và tên khách

- **Mọi con số có ngày và nơi.** Chỉ dùng số đã có trên activos.vn, báo cáo đã gửi nhãn, hoặc số đã đánh dấu "đã xác nhận" trong bảng 12.3 của doc kế hoạch.
- Sự kiện được dùng trong mạch hiện tại. Tên nào chưa được duyệt thì bot không tự nêu:
  - **TikTok Beauty Fest:** sampling partner, hơn 5.000 mẫu một ngày.
  - **TikTok Food Fest 2026:** sampling partner, máy chụp ảnh đặt cạnh máy phát mẫu.
  - **Dược Hậu Giang, Ngày hội Biofermin:** AEON Mall Bình Tân, 24–25/10/2026.
  - Còn lại nói theo ngành: "một nhãn chăm sóc da đa quốc gia", "một agency".
- Với nhãn dược và thực phẩm bảo vệ sức khỏe: **không nói công dụng sản phẩm**.

## 10. Không bao giờ đưa lên video

- Đơn giá, báo giá, giá vốn, biên lợi nhuận, mọi chi phí nội bộ (OTP, phí điểm đặt, công kỹ thuật).
- Chuyện nội bộ công ty: cổ đông, nợ, thuế, tái cấu trúc.
- Doanh thu Epione, cụm "khởi nghiệp thành công".
- Pixel, CAPI, việc gửi dữ liệu sang Meta hay TikTok — chưa nói cho tới khi đã soát luật.
- Mặt, tên, số điện thoại người tham gia.

## 11. Checklist trước khi xuất video

- [ ] 3 giây đầu là cảnh thật hoặc con số, không phải mặt người nói
- [ ] Một ý, một con số; con số có ngày và nơi
- [ ] Thuật ngữ BCG có câu "theo BCG và Google" và thẻ nguồn đúng năm
- [ ] Tên viết đúng: ActivOS, Smart Booth, Smart Sampling, Snap & Sample
- [ ] Không emoji, không viết hoa toàn bộ, không gradient, không chữ trắng trên pastel
- [ ] Màu đúng lớp: peach = Wow / cấp 1, sky = Consent / cấp 2, mint = Engage / cấp 3
- [ ] Không lộ mặt, tên, số điện thoại người tiêu dùng
- [ ] Không có giá, chi phí, biên
- [ ] Tên nhãn chỉ xuất hiện khi đã được đồng ý
- [ ] Phụ đề cứng đầy đủ, nằm trong vùng an toàn
- [ ] Kết bằng câu hỏi, không end card
