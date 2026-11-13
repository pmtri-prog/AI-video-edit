import { Router } from "express";
import { projectExists, readMeta } from "../meta.js";
import { buildProjectTimeline } from "../projectTimeline.js";
import { HttpError } from "../util.js";

/**
 * Timeline CHỈ ĐỌC của một video project - scene, lời nói, SFX, nhạc, tất cả
 * đã quy đổi về giây trên video lắp ráp để web vẽ cùng trục với bản draft.
 * Mount dưới prefix /api/projects (xem index.ts): GET /api/projects/:id/timeline
 *
 * Không có PUT: web UI là dashboard giám sát, mọi thay đổi bản dựng vẫn đi qua
 * AI (ghi chú duyệt draft) hoặc các job của backend.
 */
const router = Router();

router.get("/:id/timeline", (req, res) => {
  const id = req.params.id;
  if (!projectExists(id)) {
    throw new HttpError(404, "PROJECT_NOT_FOUND", `Không tìm thấy project "${id}"`);
  }
  res.json({ timeline: buildProjectTimeline(id, readMeta(id)) });
});

export default router;
