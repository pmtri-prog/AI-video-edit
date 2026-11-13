import path from "node:path";
import { Router } from "express";
import { nanoid } from "nanoid";
import * as db from "../db.js";
import { broadcast } from "../events.js";
import { resolveTrimSource } from "../jobs/autoTrim.js";
import { projectDirOf, projectExists } from "../meta.js";
import { queue } from "../queue.js";
import { assertSttAvailable } from "../stt.js";
import { HttpError, toRepoRel } from "../util.js";

/**
 * POST /api/projects/:id/transcribe { source? } -> 202 { job, source }
 *
 * Bóc lời video nguồn của project ra assets/transcript.raw.json (job
 * "transcribe", Whisper trên máy). Là bước đầu của Bước 1 "Cắt thô" trong luồng
 * duyệt từng bước: auto-trim analyze cần transcript này để tìm từ đệm, câu nói
 * lại, chỗ ngập ngừng - không có nó thì chỉ đo được khoảng lặng.
 *
 * `source` = đường dẫn tính từ thư mục project ("assets/clip.mov"); bỏ trống thì
 * server tự chọn đúng như auto-trim (assets/face.* → video lớn nhất, bỏ *.cut.*).
 */

const router = Router();

router.post("/:id/transcribe", (req, res) => {
  const id = req.params.id;
  if (!projectExists(id)) {
    throw new HttpError(404, "PROJECT_NOT_FOUND", `Không tìm thấy project "${id}"`);
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (body.source !== undefined && body.source !== null && typeof body.source !== "string") {
    throw new HttpError(400, "INVALID_SOURCE", "source phải là chuỗi đường dẫn");
  }
  // Đi qua hàng rào traversal của auto-trim: ngoài project → 400, không có file → 404
  const sourceAbs = resolveTrimSource(id, typeof body.source === "string" ? body.source : null);
  // Thiếu faster-whisper thì job vẫn báo NO_WHISPER kèm hướng dẫn pip; ở đây chỉ
  // chặn sớm provider bị tắt hẳn để người dùng không thấy job chạy rồi chết
  assertSttAvailable("local");

  // Bóc lời ghi đè transcript.raw.json - auto-trim đang đọc file đó thì hỏng cả hai
  if (db.hasActiveJobForProject(id)) {
    throw new HttpError(409, "BUSY", `Project "${id}" đang có job chạy/chờ trong hàng đợi`);
  }

  const sourceRel = path.relative(projectDirOf(id), sourceAbs).split(path.sep).join("/");
  const job = db.createJob({
    id: `job_${nanoid()}`,
    projectId: id,
    type: "transcribe",
    sceneId: sourceRel,
  });
  const api = db.jobToApi(job);
  broadcast("job", api);
  queue.enqueue(job.id);
  res.status(202).json({ job: api, source: toRepoRel(sourceAbs) });
});

export default router;
