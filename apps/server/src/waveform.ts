import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { childEnv } from "./config.js";
import { projectDirOf } from "./meta.js";
import { ensureDir } from "./util.js";

/**
 * Sóng âm của video nguồn cho timeline cắt tay (Bước 1 luồng duyệt từng bước).
 *
 * Đỉnh biên độ |sample| lớn nhất mỗi 20ms (50 điểm/giây), 0..1 - đủ để mắt thấy
 * chỗ nào im, chỗ nào có tiếng, và để web tự dò khoảng im theo ngưỡng người
 * dùng kéo. Giải mã MỘT lần (mono 8kHz) rồi lưu đệm ở renders/waveform/ theo
 * mtime nguồn: video 10 phút ~ 30.000 số, mở lại trang là có ngay.
 */

export const PEAKS_PER_SEC = 50;
const SAMPLE_RATE = 8000;

export interface Waveform {
  durationSec: number;
  peaksPerSec: number;
  peaks: number[];
}

export async function waveformOf(projectId: string, sourceAbs: string): Promise<Waveform> {
  const stem = path.basename(sourceAbs, path.extname(sourceAbs));
  const cacheAbs = path.join(projectDirOf(projectId), "renders", "waveform", `${stem}.json`);
  const srcMtime = fs.statSync(sourceAbs).mtimeMs;
  try {
    const cached = JSON.parse(fs.readFileSync(cacheAbs, "utf8")) as Waveform & { srcMtime?: number };
    if (cached.srcMtime === srcMtime && Array.isArray(cached.peaks)) {
      return { durationSec: cached.durationSec, peaksPerSec: cached.peaksPerSec, peaks: cached.peaks };
    }
  } catch {
    // chưa có đệm hoặc hỏng - tính lại
  }

  const pcm = await decodePcm(sourceAbs);
  const samples = Math.floor(pcm.length / 2);
  const win = SAMPLE_RATE / PEAKS_PER_SEC;
  const peaks: number[] = [];
  for (let i = 0; i < samples; i += win) {
    let max = 0;
    const end = Math.min(samples, i + win);
    for (let j = i; j < end; j++) {
      const v = Math.abs(pcm.readInt16LE(j * 2));
      if (v > max) max = v;
    }
    peaks.push(Math.round((max / 32768) * 1000) / 1000);
  }
  const wf: Waveform = { durationSec: samples / SAMPLE_RATE, peaksPerSec: PEAKS_PER_SEC, peaks };
  ensureDir(path.dirname(cacheAbs));
  fs.writeFileSync(cacheAbs, JSON.stringify({ ...wf, srcMtime }), "utf8");
  return wf;
}

function decodePcm(sourceAbs: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      ["-v", "error", "-i", sourceAbs, "-vn", "-ac", "1", "-ar", String(SAMPLE_RATE), "-f", "s16le", "-"],
      { env: childEnv(), windowsHide: true },
    );
    const chunks: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.stderr.on("data", (c: Buffer) => {
      err += c.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Giải mã âm thanh quá 3 phút - đã dừng"));
    }, 180_000);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg giải mã âm thanh lỗi (mã ${code}): ${err.slice(0, 300)}`));
    });
  });
}

/**
 * Chữ kèm mốc giây của transcript GỐC (cùng hệ thời gian với video nguồn) -
 * để timeline hiện chữ ngay dưới sóng âm. Đọc đúng hai file auto-trim dùng.
 */
export function sourceWords(projectId: string): Array<{ s: number; e: number; w: string }> {
  const dir = projectDirOf(projectId);
  for (const rel of ["assets/transcript.raw.json", "assets/transcript.json"]) {
    let json: unknown;
    try {
      json = JSON.parse(fs.readFileSync(path.join(dir, rel), "utf8"));
    } catch {
      continue;
    }
    const segs = Array.isArray(json)
      ? json
      : ((json as { segments?: unknown[] } | null)?.segments ?? []);
    const out: Array<{ s: number; e: number; w: string }> = [];
    for (const seg of segs as Array<{ words?: Array<{ word?: string; start?: number; end?: number }> }>) {
      for (const w of seg?.words ?? []) {
        if (typeof w.start === "number" && typeof w.end === "number") {
          out.push({ s: w.start, e: w.end, w: String(w.word ?? "").trim() });
        }
      }
    }
    return out;
  }
  return [];
}
