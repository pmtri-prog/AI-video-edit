import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { nanoid } from "nanoid";
import { repoRoot } from "../config.js";
import * as db from "../db.js";
import { broadcast } from "../events.js";
import { writeScreenCaptureRequest } from "../jobs/screenCapture.js";
import { briefOf, projectDirOf, projectExists, readMeta } from "../meta.js";
import { queue } from "../queue.js";
import { HttpError, nowIso, toKebabAscii } from "../util.js";

/**
 * POST /api/projects/:id/screen-capture - xếp job quay màn hình một trang web
 * làm cảnh trám. Hai lớp chặn:
 *  - brief.fillerScenes TẮT → 409 FILLER_DISABLED (công tắc thật, không chỉ là lời trong prompt)
 *  - host ngoài assets/screen-capture-sites.json → 403 SITE_NOT_ALLOWED (AI không được
 *    tự đi quay một trang bất kỳ, kể cả trang nội bộ trên mạng LAN)
 */

const SITES_FILE = path.join(repoRoot, "assets", "screen-capture-sites.json");

/** Đọc mỗi request - sửa file là ăn ngay, không cần khởi động lại server */
function allowedHosts(): string[] {
  try {
    const raw = JSON.parse(fs.readFileSync(SITES_FILE, "utf8")) as { sites?: Array<{ host?: unknown }> };
    return (raw.sites ?? [])
      .map((s) => (typeof s.host === "string" ? s.host.trim().toLowerCase() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

const optText = (v: unknown, field: string): string | null => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || v.length > 120) {
    throw new HttpError(400, "INVALID_FIELD", `${field} phải là chuỗi tối đa 120 ký tự`);
  }
  return v.trim() || null;
};

const router = Router();

// { url, focusText?, endText?, seconds? (2-15, mặc định 4), name?, blurSelectors? } → 202 Job
router.post("/:id/screen-capture", (req, res) => {
  const id = req.params.id;
  if (!projectExists(id)) {
    throw new HttpError(404, "PROJECT_NOT_FOUND", `Không tìm thấy video project "${id}"`);
  }
  if (!briefOf(readMeta(id)).fillerScenes) {
    throw new HttpError(
      409,
      "FILLER_DISABLED",
      'Project đang TẮT "Cảnh trám minh họa" - không được quay màn hình làm cảnh trám',
    );
  }
  const body = (req.body ?? {}) as Record<string, unknown>;

  let url: URL;
  try {
    url = new URL(String(body.url ?? ""));
  } catch {
    throw new HttpError(400, "INVALID_URL", "url không hợp lệ");
  }
  if (url.protocol !== "https:") throw new HttpError(400, "INVALID_URL", "Chỉ quay trang https");
  const host = url.hostname.toLowerCase();
  const hosts = allowedHosts();
  if (!hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
    throw new HttpError(
      403,
      "SITE_NOT_ALLOWED",
      `"${host}" chưa có trong danh sách trang được quay (assets/screen-capture-sites.json): ${hosts.join(", ") || "(trống)"}`,
    );
  }

  const seconds = body.seconds === undefined ? 4 : Number(body.seconds);
  if (!Number.isFinite(seconds) || seconds < 2 || seconds > 15) {
    throw new HttpError(400, "INVALID_FIELD", "seconds phải trong khoảng 2-15");
  }
  const blurSelectors = Array.isArray(body.blurSelectors)
    ? body.blurSelectors.filter((s): s is string => typeof s === "string" && s.trim() !== "" && s.length <= 200)
    : [];
  // Selector đi thẳng vào một thẻ <style> - cấm ký tự đóng khối để không chèn được CSS khác
  if (blurSelectors.some((s) => /[{}<>]/.test(s))) {
    throw new HttpError(400, "INVALID_FIELD", "blurSelectors không được chứa { } < >");
  }
  const name = toKebabAscii(optText(body.name, "name") ?? host).slice(0, 60) || "screen";

  // Dọn file yêu cầu của job đã kết thúc mà chưa chạy (vd bị hủy khi còn chờ)
  for (const f of fs.readdirSync(projectDirOf(id))) {
    const m = /^screen-capture-(job_[\w-]+)\.json$/.exec(f);
    const st = m ? db.getJob(m[1])?.status : null;
    if (m && st !== "queued" && st !== "running") fs.rmSync(path.join(projectDirOf(id), f), { force: true });
  }

  const jobId = `job_${nanoid()}`;
  writeScreenCaptureRequest(id, {
    jobId,
    url: url.toString(),
    focusText: optText(body.focusText, "focusText"),
    endText: optText(body.endText, "endText"),
    seconds,
    blurSelectors,
    allowedHosts: hosts,
    name,
    createdAt: nowIso(),
  });
  const job = db.createJob({ id: jobId, projectId: id, type: "screen-capture" });
  broadcast("job", db.jobToApi(job));
  queue.enqueue(job.id);
  res.status(202).json(db.jobToApi(job));
});

export default router;
