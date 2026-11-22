import { extractJson, generateText } from "./aiText.js";
import type { Channel, ContentItem, ContentVariant } from "./content.js";
import { isDownloaded, readCatalog, type MediaItem } from "./mediaLibrary.js";
import { HttpError, nowIso } from "./util.js";

/**
 * Phái sinh từng kênh bằng Claude, theo luật content TryOh (skill tryoh-content):
 * một câu chuyện gốc → LinkedIn Trí (G1, người trong nghề) → Facebook Trí (G2,
 * kể chuyện) → TikTok (video 30–45s, một ý). Bản sau đọc bản trước để giữ
 * nguyên thông điệp và con số chính.
 */

const COMMON_RULES = `LUẬT CHUNG (bắt buộc):
- Content TryOh không nhằm tăng like. Người đọc là người duyệt ngân sách sampling ở brand và agency (CMO, Brand/Trade Manager, agency).
- Một bài một ý, MỘT con số chính, một CTA. Cùng thông điệp với các kênh khác, chỉ khác giọng.
- CHỈ dùng số liệu và tên khách có trong câu chuyện gốc. Không bịa số, không thêm tên khách.
- Viết đúng tên "TryOh!" (T và O hoa, có dấu chấm than). Không viết hoa toàn bộ câu chữ.
- Cấm tuyệt đối hóa: "nhất", "đầu tiên", "duy nhất", "số 1", "100%", "đột phá", "giải pháp toàn diện", "hàng đầu".
- Không nêu đơn giá, giá vốn, báo giá. Không mô tả việc dùng dữ liệu người nhận mẫu cho mục đích hay chiến dịch khác.
- Giải pháp đang thử nghiệm thì viết "đang thử nghiệm cùng một số nhãn", không nêu tỷ lệ chuyển đổi.
- Tiếng Việt tự nhiên, không emoji dày đặc (tối đa 2), không hashtag giữa câu.`;

const CHANNEL_BRIEF: Record<Channel, string> = {
  linkedin: `KÊNH: LinkedIn cá nhân của Phạm Minh Trí. GIỌNG G1 - Trí nói như người trong nghề activation/sampling.
- Bài phân tích 150–250 chữ, góc nhìn ngành. Câu mở là một quan sát hoặc con số, không chào hỏi.
- Đoạn ngắn 1–3 câu. Kết bằng một câu hỏi thật cho người trong nghề hoặc CTA mềm (nhắn Trí / để lại email).
- Tối đa 3 hashtag ở cuối.`,
  facebook: `KÊNH: Facebook cá nhân của Phạm Minh Trí. GIỌNG G2 - Trí kể chuyện, gần gũi, hậu trường.
- Viết lại CÙNG thông điệp và CÙNG con số chính của bản LinkedIn, nhưng thành câu chuyện: chuyện gì xảy ra ở sự kiện, ai nói gì, Trí học được gì.
- 120–220 chữ, ngôi "mình". Kết bằng một câu ngắn có CTA nhẹ.
- Không hashtag hoặc tối đa 2.`,
  tiktok: `KÊNH: TikTok cá nhân của Trí - video dọc 30–45 giây, Trí nói trước máy + footage sự kiện thật.
- Lời thoại 70–110 chữ (đọc được trong 30–45s), một ý, câu đầu là hook trong 3 giây (con số hoặc câu hỏi ngạc nhiên).
- Kết bằng một câu hỏi thật cho người trong nghề. Không end card, không mascot.
- scene sheet: mỗi dòng một beat theo đúng định dạng
  [mm:ss-mm:ss] lop=wow|consent|engage|none cap=1|2|3|- the_chu="chữ lên màn hình, ngắn" nhan="nhãn mono: sự kiện · ngày" nguon=-
  lop: wow = trải nghiệm tại sự kiện, consent = dữ liệu/đồng ý, engage = chăm lại sau. cap = vạch "mức trưởng thành dữ liệu" 1/2/3 chỉ khi bài nói về cấp độ đó, còn lại để "-". Số trên màn hình luôn kèm ngày hoặc nơi ở nhan.
  Nhắc tới "đối tác sampling" / TikTok Beauty Fest / Food Fest thì beat đó the_chu="Đối tác sampling của TikTok Beauty Fest 2026" (hoặc Food Fest).
- caption TikTok: 1–2 câu + 3–5 hashtag (#TryOh và hashtag ngành).`,
};

function sourceBlock(item: ContentItem, ch: Channel): string {
  const parts = [`CÂU CHUYỆN GỐC:\n${item.story || "(trống)"}`];
  const li = item.variants.linkedin?.text;
  if (ch !== "linkedin" && li) parts.push(`BẢN LINKEDIN ĐÃ CÓ (giữ đúng thông điệp và con số chính này):\n${li}`);
  return parts.join("\n\n");
}

export async function deriveVariant(item: ContentItem, ch: Channel): Promise<ContentVariant> {
  if (!item.story.trim() && !item.variants.linkedin?.text) {
    throw new HttpError(400, "STORY_REQUIRED", "Cần câu chuyện gốc (hoặc bản LinkedIn) trước khi phái sinh");
  }
  const shape =
    ch === "tiktok"
      ? `{"text": "lời thoại", "sceneSheet": "các dòng scene sheet, ngăn bằng \\n", "caption": "caption + hashtag"}`
      : `{"text": "nội dung bài đăng hoàn chỉnh"}`;
  const prompt = `Bạn viết content cho TryOh! (nền tảng trải nghiệm thương hiệu, sampling có dữ liệu). Khẩu hiệu: "Where brands can touch."

${COMMON_RULES}

${CHANNEL_BRIEF[ch]}

${sourceBlock(item, ch)}

Trả về DUY NHẤT một JSON, không giải thích: ${shape}`;

  const ai = await generateText({ prompt, usageTag: `content-${ch}`, timeoutMs: 3 * 60_000 });
  const parsed = extractJson<{ text?: unknown; sceneSheet?: unknown; caption?: unknown }>(ai.text);
  const text = typeof parsed?.text === "string" ? parsed.text.trim() : "";
  if (!text) throw new HttpError(502, "AI_BAD_OUTPUT", "AI không trả về nội dung hợp lệ - thử lại");

  const prev = item.variants[ch];
  const v: ContentVariant = {
    text,
    status: "draft",
    postUrl: prev?.postUrl ?? null,
    updatedAt: nowIso(),
  };
  if (ch === "tiktok") {
    if (typeof parsed?.sceneSheet === "string") v.sceneSheet = parsed.sceneSheet.trim();
    if (typeof parsed?.caption === "string") v.caption = parsed.caption.trim();
    v.projectId = prev?.projectId ?? null;
  }
  return v;
}

/** Ảnh lộ rõ mặt mà chưa được duyệt thì không bao giờ được chọn */
const usable = (m: MediaItem): boolean =>
  m.kind === "image" && !(m.tags?.faces === "recognizable" && !m.tags.approved);

/** Ưu tiên ảnh đã biết không lộ mặt, rồi ảnh đã tải về máy, rồi ảnh chưa gắn tag */
const rank = (m: MediaItem): number =>
  (m.tags?.faces === "none" || m.tags?.faces === "far" ? 0 : 2) + (isDownloaded(m) ? 0 : 1);

/**
 * Chọn bộ ảnh ĐỒNG NHẤT cho content: AI chọn một sự kiện khớp câu chuyện nhất,
 * rồi lấy tối đa `count` ảnh của riêng sự kiện đó (cùng địa điểm, cùng ánh sáng),
 * rải đều theo thứ tự trong thư mục để không ra năm tấm gần như giống nhau.
 */
export async function pickMedia(item: ContentItem, count = 5): Promise<{ event: string | null; ids: string[] }> {
  const cat = readCatalog();
  const events = cat.events.filter((e) => cat.items.some((m) => m.event === e.name && usable(m)));
  if (events.length === 0) return { event: null, ids: [] };

  const text = [item.title, item.story, item.variants.linkedin?.text ?? ""].join("\n").slice(0, 4000);
  const prompt = `Danh sách sự kiện có ảnh thật (tên thư mục):
${events.map((e) => `- ${e.name}`).join("\n")}

Gợi ý viết tắt: TBF = TikTok Beauty Fest, DHG = Dược Hậu Giang.

Nội dung bài:
${text}

Chọn MỘT sự kiện khớp nội dung nhất. Không sự kiện nào liên quan thì trả null.
Trả về DUY NHẤT JSON: {"event": "tên đúng như trong danh sách" | null}`;
  const ai = await generateText({ prompt, usageTag: "content-media", timeoutMs: 60_000 });
  const picked = extractJson<{ event?: unknown }>(ai.text)?.event;
  const event = typeof picked === "string" ? events.find((e) => e.name === picked)?.name ?? null : null;
  if (!event) return { event: null, ids: [] };

  const pool = cat.items.filter((m) => m.event === event && usable(m));
  const best = Math.min(...pool.map(rank));
  const tier = pool.filter((m) => rank(m) === best);
  const src = tier.length >= count ? tier : pool;
  const step = src.length / Math.min(count, src.length);
  const ids = Array.from({ length: Math.min(count, src.length) }, (_, i) => src[Math.floor(i * step)].id);
  return { event, ids };
}
