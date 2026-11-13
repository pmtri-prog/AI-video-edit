import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./config.js";
import { projectDirOf, type ProjectMeta } from "./meta.js";
import type { QcCheck } from "./qc.js";
import { execFileCaptureAll, toRepoRel } from "./util.js";

/**
 * Hai check về NHỊP KHUNG HÌNH - đo bằng máy, không cần AI:
 *
 * `footage-fps` (NGUYÊN NHÂN): footage có fps không chia hết cho fps project
 *   thì bộ lắp ráp phải lặp hoặc bỏ frame KHÔNG ĐỀU. 24 -> 30fps: cứ 4 frame lại
 *   lặp 1; 50 -> 30fps: bỏ xen kẽ 1-2 frame. Mắt thấy là chuyển động "khựng
 *   nhịp" (judder) ở mọi cú lia máy, cử động tay. 60 -> 30 hay 29.97 -> 30 thì
 *   không sao (bỏ đều 1/2, hoặc lệch 1 frame mỗi ~33s).
 *
 * `stutter` (HẬU QUẢ): đo trên chính video đã lắp ráp. Một frame giống hệt frame
 *   trước nằm LẺ giữa các frame đang chuyển động = khựng. Đo bằng YDIF (chênh lệch
 *   độ sáng trung bình giữa hai frame liền nhau) của signalstats.
 *
 *   VÌ SAO "LẺ" (đã đo trên video tổng hợp 2026-11-13, ffmpeg 8.1):
 *   - frame lặp đo ra YDIF ~0.002, frame chuyển động ~1.1 -> tách rất rõ.
 *   - 24fps chiếu ở 30fps: [đ, đ, đ, đ, LẶP, đ, đ, đ, đ, LẶP] - frame lặp kẹp
 *     giữa hai frame động mỗi bên -> phải bắt.
 *   - Animation cố ý vẽ 2 frame một hình (stop-motion, giấy, người que...):
 *     [đ, LẶP, đ, LẶP] - lặp đều xen kẽ. Đây là PHONG CÁCH, không phải lỗi. Đòi
 *     hai frame động ở MỖI BÊN thì mẫu này tự rơi ra, không báo nhầm.
 *   - Card đứng yên: cả chuỗi YDIF ~0, hàng xóm không động -> không bắt (đứng
 *     hình dài đã có check `freeze` lo).
 *
 * Cả hai chỉ dừng ở warn: khựng nhịp là lỗi chất lượng nhìn thấy được, nhưng
 * không làm hỏng video tới mức phải khóa final.
 */

// ---------------------------------------------------------------- footage-fps

/** Tỉ lệ fps footage/project lệch số nguyên không quá 1% thì coi là đều */
const RATIO_TOLERANCE = 0.01;
/** avg_frame_rate lệch r_frame_rate > 2% = footage fps thay đổi (VFR) có rớt frame */
const VFR_TOLERANCE = 0.02;
/** Các fps project hợp lệ để gợi ý đổi sang */
const STANDARD_FPS = [24, 25, 30, 50, 60];

// -------------------------------------------------------------------- stutter

/** Thu nhỏ khung trước khi đo - đủ thấy chuyển động, nhanh gấp nhiều lần (60s 1080x1920 ~1.2s) */
const STUTTER_SCALE_W = 270;
/**
 * Hàng xóm phải có YDIF >= ngần này mới gọi là "đang chuyển động". Dưới mức đó
 * (người nói gần như đứng yên, màn hình tĩnh) thì frame lặp cũng không ai thấy.
 */
const MOVE_MIN_YDIF = 0.25;
/** Frame bị coi là lặp khi YDIF của nó <= 10% hàng xóm yếu nhất */
const DUP_RATIO = 0.1;
/** Các frame lặp cách nhau dưới ngần này gộp chung một vùng */
const REGION_GAP_SEC = 1.0;
/** Vùng phải có ít nhất ngần này frame lặp mới báo (lý do ở checkStutter) */
const MIN_REGION_DUPS = 2;
const MAX_LISTED = 5;

function fmt(n: number, digits = 2): string {
  return Number.isFinite(n) ? n.toFixed(digits) : "?";
}

function parseRate(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const [a, b] = v.split("/");
  const num = parseFloat(a);
  const den = b === undefined ? 1 : parseFloat(b);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0 || num <= 0) return null;
  return num / den;
}

/** Chỉ nhận file nằm trong project - đường dẫn tính từ project hoặc từ repo root */
function resolveInside(projectId: string, rel: string, baseDir?: string): string | null {
  const root = path.resolve(projectDirOf(projectId));
  const candidates = [
    ...(baseDir ? [path.resolve(baseDir, rel)] : []),
    path.resolve(root, rel),
    path.resolve(repoRoot, rel),
  ];
  for (const abs of candidates) {
    if (abs.startsWith(root + path.sep) && fs.existsSync(abs)) return abs;
  }
  return null;
}

/**
 * Mọi file footage của project: `srcVideo` của scene + thẻ <video src> trong
 * composition HyperFrames (talking-head thường nằm ngay trong index.html).
 */
function footageFiles(projectId: string, meta: ProjectMeta): string[] {
  const found = new Set<string>(htmlVideoFiles(projectId));
  for (const s of meta.scenes ?? []) {
    if (typeof s.srcVideo === "string" && s.srcVideo) {
      const abs = resolveInside(projectId, s.srcVideo);
      if (abs) found.add(abs);
    }
  }
  return [...found];
}

/**
 * File video mà composition HyperFrames nhúng qua thẻ <video src> (đường dẫn
 * tuyệt đối, chỉ file nằm trong project). Dùng chung với QC `clipped-words` để
 * biết bản cắt của auto-trim có thật sự được dùng không.
 */
export function htmlVideoFiles(projectId: string): string[] {
  const found = new Set<string>();
  const dir = projectDirOf(projectId);
  const htmlFiles = [path.join(dir, "index.html")];
  try {
    for (const e of fs.readdirSync(path.join(dir, "compositions"), { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith(".html")) htmlFiles.push(path.join(dir, "compositions", e.name));
    }
  } catch {
    /* không có compositions/ */
  }
  // `\s` trước src để không khớp nhầm `data-src`
  const videoTag = /<video\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi;
  for (const html of htmlFiles) {
    let text: string;
    try {
      text = fs.readFileSync(html, "utf8");
    } catch {
      continue;
    }
    for (const m of text.matchAll(videoTag)) {
      const src = m[1];
      if (/^[a-z]+:/i.test(src)) continue; // http:, data:, blob:
      const abs = resolveInside(projectId, src, path.dirname(html));
      if (abs) found.add(abs);
    }
  }
  return [...found];
}

async function probeRates(fileAbs: string): Promise<{ r: number; avg: number | null } | null> {
  const res = await execFileCaptureAll(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate,avg_frame_rate",
      "-of", "json", fileAbs],
    { timeoutMs: 30_000 },
  );
  if (res.timedOut || res.code !== 0) return null;
  try {
    const s = (JSON.parse(res.stdout) as { streams?: Record<string, unknown>[] }).streams?.[0];
    const r = s ? parseRate(s.r_frame_rate) : null;
    return r === null ? null : { r, avg: s ? parseRate(s.avg_frame_rate) : null };
  } catch {
    return null;
  }
}

function evenRatio(src: number, project: number): boolean {
  const ratio = src / project;
  const n = Math.round(ratio);
  return n >= 1 && Math.abs(ratio - n) <= RATIO_TOLERANCE * ratio;
}

/** fps project chuẩn gần fps hiện tại nhất mà footage chia đều được */
function suggestFps(src: number, project: number): number | null {
  const ok = STANDARD_FPS.filter((c) => evenRatio(src, c));
  if (ok.length === 0) return null;
  return ok.sort((a, b) => Math.abs(a - project) - Math.abs(b - project))[0];
}

export async function checkFootageFps(projectId: string, meta: ProjectMeta | null): Promise<QcCheck> {
  const label = "Nhịp khung hình footage";
  const projectFps = meta ? Number(meta.fps) || 0 : 0;
  if (!meta || projectFps <= 0) {
    return { id: "footage-fps", label, status: "warn", detail: "Không đo được: meta.json không có fps", value: null };
  }
  const files = footageFiles(projectId, meta);
  if (files.length === 0) {
    return { id: "footage-fps", label, status: "pass", detail: "Project không dùng footage quay thật", value: 0 };
  }

  const issues: string[] = [];
  const fine: string[] = [];
  const unreadable: string[] = [];
  for (const abs of files) {
    const name = path.basename(abs);
    const rates = await probeRates(abs);
    if (!rates) {
      unreadable.push(name);
      continue;
    }
    const problems: string[] = [];
    if (!evenRatio(rates.r, projectFps)) {
      const kind =
        rates.r < projectFps
          ? "phải lặp frame không đều"
          : "phải bỏ frame không đều";
      const tip = suggestFps(rates.r, projectFps);
      problems.push(
        `${fmt(rates.r, 2)}fps trong project ${projectFps}fps - ${kind}, chuyển động bị khựng nhịp` +
          (tip !== null ? ` (đặt fps project ${tip} thì khớp)` : ""),
      );
    }
    if (rates.avg !== null && Math.abs(rates.avg - rates.r) / rates.r > VFR_TOLERANCE) {
      problems.push(
        `fps thay đổi trong lúc quay (trung bình ${fmt(rates.avg, 2)} so với danh nghĩa ${fmt(rates.r, 2)}) - ` +
          "máy quay đã rớt frame, thường gặp ở video điện thoại thiếu sáng",
      );
    }
    if (problems.length > 0) issues.push(`${toRepoRel(abs)}: ${problems.join("; ")}`);
    else fine.push(`${name} ${fmt(rates.r, 2)}fps`);
  }

  if (issues.length === 0) {
    return {
      id: "footage-fps",
      label,
      status: unreadable.length > 0 ? "warn" : "pass",
      detail:
        `Footage khớp nhịp project ${projectFps}fps: ${fine.join(", ") || "(không có)"}` +
        (unreadable.length ? `. Không đọc được fps của: ${unreadable.join(", ")}` : ""),
      value: 0,
    };
  }
  return {
    id: "footage-fps",
    label,
    status: "warn",
    detail:
      `${issues.length} file footage lệch nhịp: ${issues.join(" | ")}` +
      (fine.length ? `. Khớp: ${fine.join(", ")}` : "") +
      (unreadable.length ? `. Không đọc được fps của: ${unreadable.join(", ")}` : ""),
    value: issues.length,
  };
}

// ---------------------------------------------------------------- stutter

interface Region {
  start: number;
  end: number;
  frames: number[];
}

/**
 * Tìm frame lặp lẻ trong chuỗi YDIF - trả về chỉ số frame. Thuần tính toán,
 * không đụng ffmpeg.
 */
function findIsolatedDuplicates(ydif: number[]): number[] {
  const out: number[] = [];
  // Frame 0 luôn có YDIF 0 (không có frame trước) - bắt đầu từ 2 để đủ hai hàng xóm mỗi bên
  for (let i = 2; i + 2 < ydif.length; i++) {
    const weakest = Math.min(ydif[i - 2], ydif[i - 1], ydif[i + 1], ydif[i + 2]);
    if (weakest >= MOVE_MIN_YDIF && ydif[i] <= DUP_RATIO * weakest) out.push(i);
  }
  return out;
}

export async function checkStutter(fileAbs: string, durationSec: number | null): Promise<QcCheck> {
  const label = "Giật hình (frame lặp lẻ)";
  const res = await execFileCaptureAll(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", fileAbs, "-an", "-vf",
      `scale=${STUTTER_SCALE_W}:-2,signalstats,metadata=print:key=lavfi.signalstats.YDIF`,
      "-f", "null", "-"],
    // Giải mã cả bài: ~1.2s cho mỗi phút 1080x1920 trên máy đã đo, trần rộng cho máy yếu
    { timeoutMs: 120_000 + Math.max(0, durationSec ?? 0) * 1000 },
  );
  if (res.timedOut) {
    return { id: "stutter", label, status: "warn", detail: "Không đo được: ffmpeg quá thời gian", value: null };
  }
  const out = `${res.stderr}\n${res.stdout}`;
  const times: number[] = [];
  const ydif: number[] = [];
  let pending: number | null = null;
  for (const line of out.split("\n")) {
    const t = line.match(/pts_time:([\d.]+)/);
    if (t) {
      pending = parseFloat(t[1]);
      continue;
    }
    const y = line.match(/lavfi\.signalstats\.YDIF=([\d.]+)/);
    if (y && pending !== null) {
      times.push(pending);
      ydif.push(parseFloat(y[1]));
      pending = null;
    }
  }
  if (ydif.length < 10) {
    return {
      id: "stutter",
      label,
      status: "warn",
      detail: `Không đo được: ffmpeg không trả số liệu từng frame (${res.code === 0 ? "file quá ngắn" : `mã thoát ${res.code}`})`,
      value: null,
    };
  }

  const grouped: Region[] = [];
  for (const i of findIsolatedDuplicates(ydif)) {
    const t = times[i];
    const last = grouped[grouped.length - 1];
    if (last && t - last.end <= REGION_GAP_SEC) {
      last.end = t;
      last.frames.push(i);
    } else {
      grouped.push({ start: t, end: t, frames: [i] });
    }
  }
  // Chỉ báo vùng có >= MIN_REGION_DUPS frame lặp. Đo 2026-11-13 trên bản draft
  // Remotion thật: cảnh ảnh tĩnh (nền gradient) ở đầu video, x264 tinh chỉnh dần
  // chất lượng trong vài frame đầu (YDIF 9.3 -> 4.6 -> 0.0001 -> 3.9) - đủ để
  // dựng ra một "frame lặp lẻ" giả dù mắt nhìn 10 frame y hệt nhau. Khựng nhịp
  // thật do lệch fps luôn lặp thành chuỗi (b-roll 25fps trong 30fps: 12 frame
  // trong 2.5s), còn MỘT frame lặp đơn lẻ thì mắt gần như không thấy.
  const regions = grouped.filter((r) => r.frames.length >= MIN_REGION_DUPS);
  const lone = grouped.length - regions.length;
  const dups = regions.flatMap((r) => r.frames);
  if (dups.length === 0) {
    return {
      id: "stutter",
      label,
      status: "pass",
      detail:
        `Đã soát ${ydif.length} frame: không có chuỗi frame lặp giữa chuyển động` +
        (lone > 0 ? ` (bỏ qua ${lone} frame lặp đơn lẻ - thường là bộ nén tinh chỉnh ảnh tĩnh, mắt không thấy)` : ""),
      value: 0,
    };
  }

  const describe = (r: Region): string => {
    const gaps = r.frames.slice(1).map((f, k) => f - r.frames[k]);
    const sorted = [...gaps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const regular = r.frames.length >= 3 && gaps.every((g) => Math.abs(g - median) <= 1);
    return (
      `${fmt(r.start)}-${fmt(r.end)}s (${r.frames.length} frame lặp` +
      (regular
        ? `, đều mỗi ~${median} frame - dấu hiệu footage fps thấp hơn project, xem check "Nhịp khung hình footage")`
        : ", không đều - rớt frame lúc quay hoặc lúc render)")
    );
  };

  const worst = [...regions].sort((a, b) => b.frames.length - a.frames.length).slice(0, MAX_LISTED);
  worst.sort((a, b) => a.start - b.start);
  return {
    id: "stutter",
    label,
    status: "warn",
    detail:
      `${dups.length} frame lặp lẻ giữa chuyển động, trong ${regions.length} vùng: ` +
      worst.map(describe).join("; ") +
      (regions.length > MAX_LISTED ? " ..." : "") +
      ". Tua tới các mốc này xem chuyển động có khựng không.",
    value: dups.length,
    marks: regions.map((r) => ({
      at: r.start,
      ...(r.end > r.start ? { end: r.end } : {}),
      label: `Giật hình: ${r.frames.length} frame lặp`,
    })),
  };
}
