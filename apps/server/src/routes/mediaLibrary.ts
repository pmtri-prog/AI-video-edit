import { Router } from "express";
import { readMeta } from "../meta.js";
import {
  applyTagPatch,
  getItem,
  isDownloaded,
  queryCatalog,
  readCatalog,
  stageToProject,
  writeCatalog,
  type MediaKind,
} from "../mediaLibrary.js";
import { HttpError } from "../util.js";

/**
 * Kho TryOh - danh mục footage/ảnh sự kiện thật (xem mediaLibrary.ts).
 * Không có endpoint nhận đường dẫn file tùy ý: ghi nhận bản tải về là việc của
 * scripts/media-library-register.mjs chạy trên máy (server có thể đang mở tunnel).
 */
const router = Router();

const KINDS: MediaKind[] = ["video", "image", "other"];

function boolQuery(v: unknown): boolean | undefined {
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return undefined;
}

// GET /api/media-library?event=&kind=&q=&downloaded=1&approved=1
//   -> { source, listedAt, events, items: (MediaItem & { downloaded })[] }
router.get("/", (req, res) => {
  const cat = readCatalog();
  const kind = KINDS.includes(req.query.kind as MediaKind) ? (req.query.kind as MediaKind) : undefined;
  const items = queryCatalog(cat, {
    event: typeof req.query.event === "string" ? req.query.event : undefined,
    kind,
    q: typeof req.query.q === "string" ? req.query.q : undefined,
    downloaded: boolQuery(req.query.downloaded),
    approved: boolQuery(req.query.approved),
  });
  res.json({
    source: cat.source,
    listedAt: cat.listedAt,
    events: cat.events,
    items: items.map((i) => ({ ...i, downloaded: isDownloaded(i) })),
  });
});

// PATCH /api/media-library/:id { tags: { shot?, faces?, description?, brands?, approved? } }
router.patch("/:id", (req, res) => {
  const cat = readCatalog();
  const item = getItem(cat, req.params.id);
  item.tags = applyTagPatch(item.tags, (req.body ?? {}).tags);
  writeCatalog(cat);
  res.json({ item: { ...item, downloaded: isDownloaded(item) } });
});

/**
 * POST /api/media-library/:id/stage { projectId } -> { relPath, reused }
 * Chép bản đã tải vào assets/broll/ của project. Công tắc THẬT: brief tắt
 * "Kho TryOh" thì từ chối, đừng để skill dài lấn át lựa chọn của người dùng.
 * Clip lộ mặt chưa được duyệt cũng bị từ chối.
 */
router.post("/:id/stage", async (req, res) => {
  const projectId = typeof req.body?.projectId === "string" ? req.body.projectId : "";
  if (!projectId) throw new HttpError(400, "PROJECT_REQUIRED", "Thiếu projectId");
  const meta = readMeta(projectId);
  if (!meta.brief?.brollLibrary) {
    throw new HttpError(
      409,
      "BROLL_DISABLED",
      `Project "${projectId}" đang TẮT "Kho TryOh" - không được chèn b-roll từ kho`,
    );
  }
  const item = getItem(readCatalog(), req.params.id);
  if (item.tags?.faces === "recognizable" && !item.tags.approved) {
    throw new HttpError(
      409,
      "MEDIA_NOT_APPROVED",
      `"${item.title}" lộ rõ mặt người và chưa được duyệt dùng`,
    );
  }
  res.json(await stageToProject(item, projectId));
});

export default router;
