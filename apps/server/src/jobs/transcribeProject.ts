import path from "node:path";
import type { JobCtx } from "../queue.js";
import { updateJob } from "../db.js";
import { projectDirOf } from "../meta.js";
import { transcribeWith } from "../stt.js";
import { toRepoRel } from "../util.js";
import { resolveTrimSource } from "./autoTrim.js";

/**
 * Job "transcribe" - bóc lời MỘT video nguồn của video project ra
 * `assets/transcript.raw.json`.
 *
 * Vì sao cần job riêng: luồng duyệt từng bước phải bóc lời TRƯỚC khi đo khoảng
 * lặng + mỡ thừa (auto-trim analyze dùng transcript làm hàng rào; thiếu nó thì
 * `deadWeight` rỗng và không tìm được câu nói lại / từ đệm). Trước đây chỉ agent
 * Claude bóc lời trong phiên edit, nên người dùng không bấm được từ web UI.
 *
 * Ghi ĐÚNG `assets/transcript.raw.json` - tên auto-trim đọc đầu tiên, theo hệ
 * thời gian của file GỐC (không phải bản đã cắt).
 *
 * `sceneId` của job mang đường dẫn nguồn tính từ thư mục project ("assets/x.mov");
 * null = để resolveTrimSource tự chọn như auto-trim.
 */
export async function runTranscribeProject(ctx: JobCtx): Promise<void> {
  const { projectId, id: jobId, sceneId } = ctx.job;
  const videoAbs = resolveTrimSource(projectId, sceneId);
  const outJsonAbs = path.join(projectDirOf(projectId), "assets", "transcript.raw.json");

  ctx.progress(
    5,
    `Bóc lời ${path.basename(videoAbs)} bằng Whisper trên máy - mất khoảng bằng thời lượng video`,
  );
  const res = await transcribeWith({
    provider: "local",
    videoAbs,
    outJsonAbs,
    language: "vi",
    onLog: (line) => ctx.log(line),
    // BẮT BUỘC: không truyền thì hủy job xong whisper vẫn chạy tiếp và ăn CPU/GPU
    isCanceled: () => ctx.isCanceled(),
  });

  const rel = toRepoRel(outJsonAbs);
  updateJob(jobId, { outputPath: rel });
  ctx.log(
    `[transcribe] ${rel} - ${res.segments.length} câu, ${res.durationSec.toFixed(1)}s, ` +
      `mốc từng chữ: ${res.wordTimestamps ? "có" : "không"}`,
  );
  ctx.progress(100, `Đã bóc lời ${res.segments.length} câu`);
}
