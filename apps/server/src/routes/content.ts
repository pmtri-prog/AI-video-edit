import { Router } from "express";
import {
  createContent,
  getContent,
  isChannel,
  patchContent,
  readContent,
  writeContent,
  type ContentItem,
} from "../content.js";
import { deriveVariant, pickMedia } from "../contentDerive.js";
import { briefOf, readMeta, writeMeta } from "../meta.js";
import { isDownloaded, readCatalog } from "../mediaLibrary.js";
import { HttpError, nowIso } from "../util.js";

/**
 * Content đa kênh: một câu chuyện gốc → LinkedIn → Facebook → TikTok (xem content.ts).
 * Không có endpoint nào đăng bài: đăng là việc Trí làm (hoặc Claude qua Chrome
 * và DỪNG hỏi Trí trước khi bấm Đăng), app chỉ giữ bản nháp, trạng thái và link.
 */
const router = Router();

/** Kèm thông tin ảnh đã chọn để web không phải gọi kho lần nữa */
function withMedia(item: ContentItem) {
  const cat = readCatalog();
  const media = item.mediaIds
    .map((id) => cat.items.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map((m) => ({
      id: m.id,
      title: m.title,
      event: m.event,
      viewUrl: m.viewUrl ?? null,
      localPath: isDownloaded(m) ? m.localPath : null,
      faces: m.tags?.faces ?? null,
    }));
  return { ...item, media };
}

router.get("/", (_req, res) => {
  res.json({ items: readContent() });
});

router.post("/", (req, res) => {
  const items = readContent();
  const item = createContent(items, (req.body ?? {}) as Record<string, unknown>);
  writeContent(items);
  res.status(201).json({ item: withMedia(item) });
});

router.get("/:id", (req, res) => {
  res.json({ item: withMedia(getContent(readContent(), req.params.id)) });
});

router.patch("/:id", (req, res) => {
  const items = readContent();
  const item = getContent(items, req.params.id);
  patchContent(item, (req.body ?? {}) as Record<string, unknown>);
  writeContent(items);
  res.json({ item: withMedia(item) });
});

router.delete("/:id", (req, res) => {
  const items = readContent();
  getContent(items, req.params.id);
  writeContent(items.filter((i) => i.id !== req.params.id));
  res.status(204).end();
});

// POST /api/content/:id/derive { channel } - AI viết bản cho kênh đó (ghi đè bản nháp cũ)
router.post("/:id/derive", async (req, res) => {
  const channel = req.body?.channel;
  if (!isChannel(channel)) throw new HttpError(400, "INVALID_CHANNEL", "channel phải là linkedin | facebook | tiktok");
  const item = getContent(readContent(), req.params.id);
  if (item.variants[channel]?.status === "posted") {
    throw new HttpError(409, "ALREADY_POSTED", "Bản này đã đăng - không viết đè");
  }
  const variant = await deriveVariant(item, channel);
  // Đọc lại sau lời gọi AI (vài chục giây) để không đè thay đổi xảy ra trong lúc chờ
  const items = readContent();
  const fresh = getContent(items, req.params.id);
  fresh.variants[channel] = variant;
  fresh.updatedAt = nowIso();
  writeContent(items);
  res.json({ item: withMedia(fresh) });
});

// POST /api/content/:id/media - chọn bộ ảnh thật đồng nhất (một sự kiện) từ Kho TryOh
router.post("/:id/media", async (req, res) => {
  const item = getContent(readContent(), req.params.id);
  const { event, ids } = await pickMedia(item);
  const items = readContent();
  const fresh = getContent(items, req.params.id);
  fresh.mediaEvent = event;
  fresh.mediaIds = ids;
  fresh.updatedAt = nowIso();
  writeContent(items);
  res.json({ item: withMedia(fresh) });
});

/**
 * POST /api/content/:id/apply { projectId } - đưa kịch bản TikTok + scene sheet
 * vào brief notes của project video (skill dựng đọc scene sheet từ đó). Bật luôn
 * "Kho TryOh" khi content có bộ ảnh, để bước stage ảnh không bị 409.
 */
router.post("/:id/apply", (req, res) => {
  const projectId = typeof req.body?.projectId === "string" ? req.body.projectId : "";
  if (!projectId) throw new HttpError(400, "PROJECT_REQUIRED", "Thiếu projectId");
  const items = readContent();
  const item = getContent(items, req.params.id);
  const tt = item.variants.tiktok;
  if (!tt?.text) throw new HttpError(409, "TIKTOK_MISSING", "Chưa có bản TikTok - phái sinh trước");

  const meta = readMeta(projectId);
  const brief = briefOf(meta);
  const cat = readCatalog();
  const photos = item.mediaIds
    .map((id) => cat.items.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map((m) => `- ${m.id} · ${m.title} [${m.event}]`);
  const block = [
    `=== Content: ${item.title} (id ${item.id}) ===`,
    `Lời thoại:\n${tt.text}`,
    tt.sceneSheet ? `Scene sheet:\n${tt.sceneSheet}` : "",
    photos.length
      ? `Ảnh thật đã chọn (Kho TryOh, cùng sự kiện "${item.mediaEvent}") - stage bằng POST /api/media-library/<id>/stage:\n${photos.join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  // Thay khối cũ của cùng content (chạy lại không bị dồn hai bản)
  const marker = `=== Content: `;
  const kept = brief.notes
    .split(/\n{2,}(?==== Content: )/)
    .filter((part) => !(part.startsWith(marker) && part.includes(`(id ${item.id})`)))
    .join("\n\n")
    .trim();
  brief.notes = [kept, block].filter(Boolean).join("\n\n");
  if (photos.length) brief.brollLibrary = true;
  meta.brief = brief;
  writeMeta(projectId, meta);

  tt.projectId = projectId;
  tt.updatedAt = nowIso();
  item.updatedAt = nowIso();
  writeContent(items);
  res.json({ item: withMedia(item), notes: brief.notes });
});

export default router;
