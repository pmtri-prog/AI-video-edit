import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "../config.js";
import { updateJob } from "../db.js";
import { projectAssetsDirOf, projectDirOf } from "../meta.js";
import type { JobCtx } from "../queue.js";
import { ensureDir, ffprobeDurationMs, toRepoRel } from "../util.js";

/**
 * Job "screen-capture" - Playwright quay một trang web thành clip 1080x1920 để
 * AI chèn làm cảnh trám (công tắc brief.fillerScenes). Việc quay nằm ở
 * scripts/screen-capture.mjs và chạy như process con qua ctx.exec, nên nút Hủy
 * trên web kill được ngay như mọi job render khác.
 *
 * Route ghi yêu cầu ra file cạnh meta.json (giống auto-trim) vì bảng jobs chỉ
 * có một cột sceneId - không đủ chỗ cho url + chữ neo + thời lượng.
 */

export interface ScreenCaptureRequest {
  /** Job nào được dùng yêu cầu này - chống dùng nhầm yêu cầu cũ còn sót */
  jobId: string;
  url: string;
  /** Chữ trên trang để cuộn tới (bỏ trống = đi hết trang) */
  focusText: string | null;
  /** Chữ để cuộn tới cuối clip (bỏ trống = trôi nhẹ quanh focusText) */
  endText: string | null;
  seconds: number;
  /** CSS selector cần làm mờ (tên, số điện thoại trên dashboard...) */
  blurSelectors: string[];
  /** Danh sách host cho phép lúc tạo yêu cầu - script kiểm lại MỌI lần điều hướng (redirect) */
  allowedHosts: string[];
  /** Tên file ra trong assets/screen/ (kebab-case, không đuôi) */
  name: string;
  createdAt: string;
}

function requestPathOf(projectId: string, jobId: string): string {
  return path.join(projectDirOf(projectId), `screen-capture-${jobId}.json`);
}

export function writeScreenCaptureRequest(projectId: string, req: ScreenCaptureRequest): void {
  fs.writeFileSync(requestPathOf(projectId, req.jobId), JSON.stringify(req, null, 2) + "\n", "utf8");
}

/** Tên file chưa dùng trong assets/screen/ - không bao giờ ghi đè clip cũ */
export function freeScreenFileName(projectId: string, name: string): string {
  const dir = path.join(projectAssetsDirOf(projectId), "screen");
  let candidate = `${name}.mp4`;
  for (let i = 2; fs.existsSync(path.join(dir, candidate)); i++) candidate = `${name}-${i}.mp4`;
  return candidate;
}

export async function runScreenCapture(ctx: JobCtx): Promise<void> {
  const { projectId, id: jobId } = ctx.job;
  const reqPath = requestPathOf(projectId, jobId);
  if (!fs.existsSync(reqPath)) throw new Error(`Thiếu file yêu cầu quay màn hình của job ${jobId}`);
  const req = JSON.parse(fs.readFileSync(reqPath, "utf8")) as ScreenCaptureRequest;
  if (req.jobId !== jobId) throw new Error("File yêu cầu không thuộc job này");

  const dir = path.join(projectAssetsDirOf(projectId), "screen");
  ensureDir(dir);
  const outAbs = path.join(dir, freeScreenFileName(projectId, req.name));

  ctx.progress(2, `Mở ${req.url}`);
  let ms: number | null = null;
  try {
    await ctx.exec(
      process.execPath,
      [path.join(repoRoot, "scripts", "screen-capture.mjs"), reqPath, outAbs],
      repoRoot,
      (line) => {
        const m = /^progress (\d+)\/(\d+)$/.exec(line);
        if (m) ctx.progress(5 + (90 * Number(m[1])) / Number(m[2]), "Đang quay màn hình");
      },
    );
    ms = await ffprobeDurationMs(outAbs);
    if (!ms) throw new Error("Quay xong nhưng file ra không đọc được");
  } catch (err) {
    // Hủy giữa chừng / lỗi: không để clip dở trong assets/ cho agent nhặt nhầm
    fs.rmSync(outAbs, { force: true });
    throw err;
  } finally {
    fs.rmSync(reqPath, { force: true });
  }
  const rel = toRepoRel(outAbs);
  // outputPath để agent đọc qua GET /api/jobs/:id rồi tham chiếu trong composition
  updateJob(jobId, { outputPath: rel });
  ctx.log(`[screen-capture] ${rel} (${(ms / 1000).toFixed(1)}s)`);
  ctx.progress(100, `Đã lưu ${path.basename(outAbs)}`);
}
