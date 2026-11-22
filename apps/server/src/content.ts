import fs from "node:fs";
import path from "node:path";
import { paths } from "./config.js";
import { HttpError, ensureDir, nowIso, toKebabAscii } from "./util.js";

/**
 * Content đa kênh - MỘT câu chuyện gốc phân phối ra nhiều kênh theo thứ tự
 * LinkedIn (bài phân tích, giọng người trong nghề) → Facebook (bản kể chuyện)
 * → TikTok (kịch bản video ngắn + scene sheet cho skill dựng).
 *
 * Mỗi bản chung một thông điệp, một con số chính, khác giọng theo kênh - không
 * phải ba bài khác ý. Bản sau phái sinh từ bản trước để giữ đúng thông điệp.
 *
 * File: apps/server/data/content.json (gitignore - nội dung chưa đăng của người dùng).
 */

export const CHANNELS = ["linkedin", "facebook", "tiktok"] as const;
export type Channel = (typeof CHANNELS)[number];
export type VariantStatus = "draft" | "approved" | "posted";
const STATUSES: VariantStatus[] = ["draft", "approved", "posted"];

export interface ContentVariant {
  /** Thân bài (LinkedIn/Facebook) hoặc lời thoại video (TikTok) */
  text: string;
  /** TikTok: caption đăng kèm video + hashtag */
  caption?: string;
  /** TikTok: scene sheet theo định dạng của skill dựng (dán vào brief notes) */
  sceneSheet?: string;
  status: VariantStatus;
  /** Link bài sau khi đăng */
  postUrl: string | null;
  /** TikTok: project video đã nhận kịch bản này */
  projectId?: string | null;
  updatedAt: string;
}

export interface ContentItem {
  id: string;
  title: string;
  /** Câu chuyện gốc: chiến dịch vừa chạy, con số mới, câu khách nói, bài học vận hành */
  story: string;
  variants: Partial<Record<Channel, ContentVariant>>;
  /** Ảnh thật từ Kho TryOh đã chọn cho content này (id mục trong catalog) */
  mediaIds: string[];
  /** Sự kiện của bộ ảnh - cả bộ lấy cùng một sự kiện để đồng nhất */
  mediaEvent: string | null;
  createdAt: string;
  updatedAt: string;
}

const storePath = (): string => path.join(paths.dataDir, "content.json");

export function readContent(): ContentItem[] {
  try {
    const raw = JSON.parse(fs.readFileSync(storePath(), "utf8")) as { items?: ContentItem[] };
    return Array.isArray(raw.items) ? raw.items : [];
  } catch {
    return [];
  }
}

/** Ghi qua file tạm rồi rename - hỏng giữa chừng là mất cả lịch content */
export function writeContent(items: ContentItem[]): void {
  ensureDir(paths.dataDir);
  const tmp = `${storePath()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ items }, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, storePath());
}

export function getContent(items: ContentItem[], id: string): ContentItem {
  const item = items.find((i) => i.id === id);
  if (!item) throw new HttpError(404, "CONTENT_NOT_FOUND", `Không có content "${id}"`);
  return item;
}

export function isChannel(v: unknown): v is Channel {
  return typeof v === "string" && (CHANNELS as readonly string[]).includes(v);
}

const str = (v: unknown, field: string, max: number): string => {
  if (typeof v !== "string") throw new HttpError(400, "INVALID_CONTENT", `${field} phải là string`);
  return v.trim().slice(0, max);
};

export function createContent(items: ContentItem[], body: Record<string, unknown>): ContentItem {
  const title = str(body.title, "title", 160);
  const story = str(body.story ?? "", "story", 6000);
  if (!title) throw new HttpError(400, "INVALID_CONTENT", "Thiếu tiêu đề");
  const base = toKebabAscii(title).slice(0, 48) || "content";
  let id = base;
  for (let n = 2; items.some((i) => i.id === id); n++) id = `${base}-${n}`;
  const now = nowIso();
  const item: ContentItem = { id, title, story, variants: {}, mediaIds: [], mediaEvent: null, createdAt: now, updatedAt: now };
  items.unshift(item);
  return item;
}

/** PATCH: title/story + từng bản kênh (text/caption/sceneSheet/status/postUrl) */
export function patchContent(item: ContentItem, body: Record<string, unknown>): void {
  if ("title" in body) {
    const t = str(body.title, "title", 160);
    if (!t) throw new HttpError(400, "INVALID_CONTENT", "Tiêu đề không được rỗng");
    item.title = t;
  }
  if ("story" in body) item.story = str(body.story, "story", 6000);
  const variants = body.variants;
  if (variants !== undefined) {
    if (!variants || typeof variants !== "object" || Array.isArray(variants)) {
      throw new HttpError(400, "INVALID_CONTENT", "variants phải là object");
    }
    for (const [ch, raw] of Object.entries(variants as Record<string, unknown>)) {
      if (!isChannel(ch)) throw new HttpError(400, "INVALID_CONTENT", `Kênh không hợp lệ: ${ch}`);
      if (!raw || typeof raw !== "object") throw new HttpError(400, "INVALID_CONTENT", `variants.${ch} phải là object`);
      const p = raw as Record<string, unknown>;
      const v: ContentVariant = item.variants[ch] ?? { text: "", status: "draft", postUrl: null, updatedAt: nowIso() };
      if ("text" in p) v.text = str(p.text, "text", 20000);
      if ("caption" in p) v.caption = str(p.caption, "caption", 4000);
      if ("sceneSheet" in p) v.sceneSheet = str(p.sceneSheet, "sceneSheet", 8000);
      if ("status" in p) {
        if (!STATUSES.includes(p.status as VariantStatus)) {
          throw new HttpError(400, "INVALID_CONTENT", `status phải là ${STATUSES.join(" | ")}`);
        }
        v.status = p.status as VariantStatus;
      }
      if ("postUrl" in p) {
        const u = p.postUrl === null ? "" : str(p.postUrl, "postUrl", 600);
        if (u && !/^https:\/\//i.test(u)) throw new HttpError(400, "INVALID_CONTENT", "postUrl phải là link https");
        v.postUrl = u || null;
      }
      v.updatedAt = nowIso();
      item.variants[ch] = v;
    }
  }
  item.updatedAt = nowIso();
}
