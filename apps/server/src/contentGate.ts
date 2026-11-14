/**
 * Duyệt 1 "Nội dung" của luồng 4 lần duyệt: chấm câu móc theo 7 công thức,
 * đếm số ý (một video một ý, hai ý thì đề xuất tách Phần 1/Phần 2), liệt kê
 * tên riêng + con số cần soát, và luật kênh dùng ở Duyệt 4 (caption + hashtag).
 *
 * Nguồn luật: skill `activos-tiktok` mục 6.1 và `assets/brand/activos/guideline.md`
 * mục 5–6 (Trí duyệt 14/11/2026). Sửa luật ở đó thì sửa cả ở đây.
 */

import type { ProjectMeta } from "./meta.js";

export interface HookFormula {
  id: number;
  name: string;
  /** Câu mẫu đã duyệt - chỉ để tham khảo, KHÔNG tự viết lại lời người nói */
  example: string;
  /** Chỉ dùng khi có thật (bình luận thật, sự cố thật) */
  realOnly: boolean;
}

export const HOOK_FORMULAS: HookFormula[] = [
  {
    id: 1,
    name: "Cố tình làm khó",
    example: "Trong máy phát mẫu của mình có một bước mà mình cố tình làm cho chậm đi 10 giây.",
    realOnly: false,
  },
  {
    id: 2,
    name: "Tại sao một chi tiết lạ",
    example: "Ở TikTok Food Fest, tại sao mình lại đặt máy chụp ảnh ngay cạnh máy phát mẫu?",
    realOnly: false,
  },
  {
    id: 3,
    name: "Con số lớn rồi câu hỏi khó",
    example: "Hơn 5.000 mẫu trong một ngày ở TikTok Beauty Fest. Nhưng câu hỏi khó nhất lại đến vào ngày hôm sau.",
    realOnly: false,
  },
  {
    id: 4,
    name: "Cho người nghĩ mình biết rồi",
    example: "Ai làm sự kiện lâu chắc nghĩ phát mẫu thì có gì đâu mà phải nghĩ. Mình cũng từng nghĩ thế.",
    realOnly: false,
  },
  {
    id: 5,
    name: "Điều mình khó chịu",
    example: "Mình không thích cái cảnh dọn booth xong là mọi thứ biến mất theo.",
    realOnly: false,
  },
  {
    id: 6,
    name: "Trả lời bình luận",
    example: "Trả lời anh [tên]: máy chụp ảnh ở sự kiện thì liên quan gì đến dữ liệu cho nhãn?",
    realOnly: true,
  },
  {
    id: 7,
    name: "Hậu trường / sự cố",
    example: "[Giờ], [ngày] ở [nơi], máy của mình [sự cố thật]. Đây là cách mình xử lý.",
    realOnly: true,
  },
];

/** Luật kênh TikTok cá nhân của Trí (skill activos-tiktok) */
export const CHANNEL_SKILL = "activos-tiktok";
export const FIXED_HASHTAGS = ["#tryoh", "#learnontiktok", "#sukien", "#sampling"];
export const MAX_EXTRA_HASHTAGS = 2;
/** Cảnh wow mở đầu dài 3 giây - id cố định trong meta.inserts */
export const WOW_INSERT_ID = "wow-open";
export const WOW_SEC = 3;

export function isChannelProject(meta: ProjectMeta): boolean {
  return meta.brief?.skill === CHANNEL_SKILL;
}

/**
 * Bộ hashtag khi đăng: 4 tag cố định trước, rồi tối đa 2 tag thêm (không trùng).
 * Server ép luật này, prompt chỉ là gợi ý.
 */
export function channelHashtags(aiTags: string[]): string[] {
  const fixed = new Set(FIXED_HASHTAGS.map((t) => t.toLowerCase()));
  const extras: string[] = [];
  for (const t of aiTags) {
    const k = t.toLowerCase();
    if (fixed.has(k) || extras.some((e) => e.toLowerCase() === k)) continue;
    extras.push(t);
    if (extras.length >= MAX_EXTRA_HASHTAGS) break;
  }
  return [...FIXED_HASHTAGS, ...extras];
}

// ------------------------------- Kết quả chấm -------------------------------

export interface ContentReview {
  generatedAt: string;
  /** Câu mở đầu và đánh giá theo 7 công thức */
  hook: {
    text: string;
    start: number;
    end: number;
    /** 1–7, null = không khớp công thức nào */
    formula: number | null;
    weak: boolean;
    reason: string;
    /** Công thức gần nhất nên dùng nếu quay lại - không phải lời viết sẵn */
    suggestFormula: number | null;
  };
  ideas: { title: string; start: number; end: number }[];
  /** Có từ 2 ý trở lên thì đề xuất điểm tách + câu hỏi bỏ ngỏ cuối Phần 1 */
  split: { at: number; question: string } | null;
  names: { text: string; note: string }[];
  numbers: { text: string; note: string }[];
}

/** Quyết định của người duyệt ở Duyệt 1 - giữ nguyên khi chấm lại */
export interface ContentDecision {
  /** null = chưa quyết; true = tách 2 phần; false = giữ 1 video */
  splitParts: boolean | null;
  /** Chữ tiêu đề (đè cảnh wow + mặc định cho ảnh bìa) */
  title: string;
  /** Cảnh wow 0–3s: file trong project + giây bắt đầu trong file đó */
  wow: { src: string; mediaStart: number } | null;
}

export interface ContentGateState {
  review: ContentReview | null;
  decision: ContentDecision;
}

export const EMPTY_DECISION: ContentDecision = { splitParts: null, title: "", wow: null };

export function contentGateOf(meta: ProjectMeta): ContentGateState {
  const raw = (meta.contentGate ?? null) as Partial<ContentGateState> | null;
  return {
    review: raw?.review ?? null,
    decision: { ...EMPTY_DECISION, ...(raw?.decision ?? {}) },
  };
}

// --------------------------------- Prompt ---------------------------------

interface Seg {
  i: number;
  start: number;
  end: number;
  text: string;
}

/** Mở bằng tên giải pháp hoặc câu nhật ký = câu móc yếu (skill 6.1), chặn cứng không chờ AI. */
const WEAK_OPENERS: { re: RegExp; reason: string }[] = [
  { re: /^\s*(activos|tryoh|try oh)\b/i, reason: "Mở bằng tên giải pháp" },
  { re: /^\s*ngày (đầu tiên|thứ \d+) của (mình|tôi)/i, reason: "Mở bằng câu nhật ký" },
];

export function weakOpener(text: string): string | null {
  return WEAK_OPENERS.find((w) => w.re.test(text))?.reason ?? null;
}

export function buildContentPrompt(segs: Seg[], durationSec: number): string {
  const lines = segs.map((s) => `[${s.i}] ${s.start.toFixed(1)}–${s.end.toFixed(1)}s: ${s.text}`);
  const formulas = HOOK_FORMULAS.map(
    (f) => `${f.id}. ${f.name}${f.realOnly ? " (chỉ khi có thật)" : ""} - ví dụ: "${f.example}"`,
  );
  return `Bạn là biên tập nội dung cho kênh TikTok cá nhân của một người làm ngành sự kiện/sampling. Video người nói trước camera, dài ${durationSec.toFixed(1)} giây.

LỜI NÓI (chỉ số câu, mốc giây):
${lines.join("\n")}

7 CÔNG THỨC CÂU MÓC ĐÃ DUYỆT (câu mở đầu nghe "sai sai" hoặc là một câu hỏi chưa có lời đáp):
${formulas.join("\n")}
Câu móc YẾU: mở bằng tên giải pháp ("ActivOS giúp nhãn…"), câu nhật ký ("ngày đầu tiên của mình ở…"), hoặc chê nhãn/agency khác.

VIỆC CẦN LÀM:
1. hook: câu móc là 1–2 câu đầu tiên. Cho biết khớp công thức nào (1–7) hay null. weak = true nếu yếu hoặc không khớp. reason: một câu tiếng Việt. suggestFormula: công thức gần nhất nên dùng nếu quay lại (số) hoặc null. KHÔNG viết lại lời người nói.
2. ideas: các Ý CHÍNH của video (thường 1, tối đa 3). Mỗi ý: title ≤ 8 chữ, start/end theo mốc giây ở trên.
3. split: nếu có từ 2 ý độc lập trở lên → {"at": giây nên tách (đầu một câu), "question": câu hỏi bỏ ngỏ ≤ 15 chữ để cuối Phần 1 dẫn sang Phần 2, dùng đúng ý người nói}. Một ý → null.
4. names: tên riêng (sự kiện, địa điểm, thương hiệu, người) cần soát chính tả. note: lý do cần soát, hoặc rỗng.
5. numbers: mọi con số người nói nhắc (số lượng, tiền, %). note: "tiền" nếu là số tiền, còn lại rỗng.

Trả về DUY NHẤT một khối JSON:
{"hook":{"segment":0,"text":"...","formula":2,"weak":false,"reason":"...","suggestFormula":null},"ideas":[{"title":"...","start":0,"end":61.2}],"split":null,"names":[{"text":"SECC","note":""}],"numbers":[{"text":"200K","note":"tiền"}]}`;
}

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function formulaId(v: unknown): number | null {
  const x = n(v);
  return Number.isInteger(x) && x >= 1 && x <= HOOK_FORMULAS.length ? x : null;
}

function textList(v: unknown): { text: string; note: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {}))
    .map((x) => ({ text: s(x.text, 80), note: s(x.note, 120) }))
    .filter((x) => x.text)
    .slice(0, 30);
}

/** Chuẩn hóa JSON của AI. Mốc giây bị kẹp vào video; câu móc lấy chữ THẬT từ transcript. */
export function normReview(raw: unknown, segs: Seg[], durationSec: number, at: string): ContentReview {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const h = (r.hook && typeof r.hook === "object" ? r.hook : {}) as Record<string, unknown>;
  const dur = durationSec || segs.at(-1)?.end || 0;

  // Câu móc = câu đầu (AI chỉ được chọn segment đầu hoặc thứ hai)
  const segIdx = clamp(Number.isInteger(n(h.segment)) ? n(h.segment) : 0, 0, Math.min(1, segs.length - 1));
  const first = segs[0];
  const pickSeg = segs[segIdx] ?? first;
  const hookText = first ? segs.slice(0, segIdx + 1).map((x) => x.text).join(" ") : s(h.text, 300);
  let formula = formulaId(h.formula);
  let weak = h.weak === true || formula === null;
  let reason = s(h.reason, 240);
  const hardWeak = weakOpener(hookText);
  if (hardWeak) {
    formula = null;
    weak = true;
    reason = `${hardWeak}. ${reason}`.trim();
  }

  const ideas = (Array.isArray(r.ideas) ? r.ideas : [])
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {}))
    .map((x) => ({
      title: s(x.title, 80),
      start: clamp(n(x.start) || 0, 0, dur),
      end: clamp(Number.isFinite(n(x.end)) ? n(x.end) : dur, 0, dur),
    }))
    .filter((x) => x.title && x.end > x.start)
    .slice(0, 3);

  let split: ContentReview["split"] = null;
  const sp = r.split && typeof r.split === "object" ? (r.split as Record<string, unknown>) : null;
  if (sp && ideas.length >= 2 && Number.isFinite(n(sp.at))) {
    // Tách đúng đầu một câu: lấy câu bắt đầu gần mốc AI chọn nhất
    const want = n(sp.at);
    const best = segs.reduce((a, b) => (Math.abs(b.start - want) < Math.abs(a.start - want) ? b : a), segs[0]);
    if (best && best.start > 0) split = { at: best.start, question: s(sp.question, 160) };
  }

  return {
    generatedAt: at,
    hook: {
      text: hookText,
      start: first?.start ?? 0,
      end: pickSeg?.end ?? 0,
      formula,
      weak,
      reason,
      suggestFormula: formulaId(h.suggestFormula),
    },
    ideas,
    split,
    names: textList(r.names),
    numbers: textList(r.numbers),
  };
}
