import fs from "node:fs";
import path from "node:path";
import { projectDirOf, type ProjectMeta } from "./meta.js";
import {
  resolveProjectFile,
  sceneTimeline,
  transcriptMap,
  type FileTranscript,
  type TimedWord,
} from "./projectTimeline.js";
import type { QcCheck, QcStatus } from "./qc.js";
import { htmlVideoFiles } from "./qcMotion.js";
import { ensureDir, execFileCaptureAll, toRepoRel } from "./util.js";

/**
 * QC `clipped-words` - có điểm cắt nào rơi vào GIỮA một chữ không.
 *
 * Lỗi này lọt qua mọi lưới hiện có:
 * - Lưới của auto-trim (`guardWordMidpoints`) chỉ chặn khoảng cắt đè lên TRUNG
 *   ĐIỂM chữ. Một khoảng cắt ăn mất 40% đầu chữ vẫn lọt - và nghe ra là "cụt chữ".
 * - Mép `from`/`to` của scene footage do AI tự chọn, không qua lưới nào cả.
 *
 * VÌ SAO KHÔNG TIN TRANSCRIPT MỘT MÌNH: whisper hay kéo dài mốc kết thúc của chữ
 * đứng trước khoảng nghỉ sang cả phần im lặng phía sau. Chỉ dựa vào mốc chữ thì
 * một nhát cắt nằm gọn trong khoảng lặng (đúng) vẫn bị báo là "cắt giữa chữ".
 * Nên mỗi điểm cắt phải qua HAI phép thử độc lập:
 *   1. Transcript: điểm cắt nằm sâu trong một chữ (cách cả hai mép >= MIN_DEPTH_SEC,
 *      vì mép chữ của bộ bóc băng sai vài chục ms là bình thường).
 *   2. Âm thanh: ngay HAI BÊN điểm cắt (mỗi bên EDGE_WIN_SEC) đều đang có tiếng,
 *      đo trên chính file chứa nhát cắt. Một bên im là nhát cắt rơi vào chỗ nghỉ.
 * Cả hai cùng đúng mới là cụt chữ thật.
 *
 * Mức độ: chỉ FAIL (chặn final) khi cả hai phép thử cùng xác nhận VÀ biết chắc
 * transcript là của đúng file đó (có báo cáo auto-trim làm chứng). Thiếu một
 * trong các điều kiện đó thì tối đa là warn - không khóa cửa bằng một suy đoán.
 */

const LABEL = "Cụt chữ ở điểm cắt";

/** Điểm cắt phải nằm sâu trong chữ ít nhất ngần này ở CẢ HAI phía mới tính (warn) */
const MIN_DEPTH_SEC = 0.05;
/**
 * Sâu tới ngần này mới đủ CHẶN final. Đo 2026-11-13 trên giọng Linh của macOS
 * + whisper base: mốc chữ lệch tiếng thật tới ~0.1s ("Đây" bắt đầu sớm 0.1s).
 * Chỗ hai chữ nói liền không có khoảng nghỉ thì phép thử âm thanh không gỡ được
 * sai số này (hai bên đều có tiếng dù cắt đúng ranh giới) - nên vùng 0.05-0.1s
 * chỉ là "nghe lại", không khóa cửa.
 */
const FAIL_DEPTH_SEC = 0.1;
/** Sai số dấu phẩy động: 1.0 - 0.9 ra 0.0999... */
const EPS = 1e-6;
/** Cửa sổ đo âm lượng mỗi bên điểm cắt */
const EDGE_WIN_SEC = 0.04;
/** Mép file không phải điểm cắt (đầu/cuối bản ghi) */
const FILE_EDGE_SEC = 0.05;
/** Cửa sổ dựng thang âm lượng tham chiếu của cả file */
const REF_WIN_SEC = 0.05;
/**
 * Khoảng cách giữa tiếng nói (p90) và nền (p10) phải >= ngần này mới tách được
 * "đang có tiếng" với "đang nghỉ". Hẹp hơn là file có nhạc nền/ồn suốt - đo âm
 * lượng khi đó vô nghĩa, quay về chỉ dùng transcript (tối đa warn).
 */
const MIN_DYNAMIC_DB = 12;
/** Tần số mẫu khi giải mã để đo - chỉ cần mức năng lượng, không cần chất */
const PCM_RATE = 8000;
const MAX_LISTED = 5;
const FFMPEG_TIMEOUT_MS = 180_000;

// ------------------------------------------------------------------- Kiểu

type Word = TimedWord;
type Transcript = FileTranscript;

/** Một file chứa nhát cắt, kèm transcript đúng hệ thời gian của nó (nếu có) */
interface CutFile {
  abs: string;
  rel: string;
  transcript: Transcript | null;
  /** Transcript chắc chắn là của file này (báo cáo auto-trim làm chứng) */
  certain: boolean;
}

interface CutPoint {
  file: CutFile;
  /** Giây trong file chứa nhát cắt */
  at: number;
  /** Giây trên video lắp ráp - null khi không suy ra được */
  videoAt: number | null;
  where: string;
  /**
   * Được phép chặn final. Mối nối bên trong bản cắt của auto-trim chỉ chặn khi
   * bản cắt THẬT SỰ được dùng (scene footage hoặc thẻ <video> của composition) -
   * bản cắt bị bỏ xó thì cụt chữ trong đó không ai nghe thấy.
   */
  blocking: boolean;
}

interface Finding {
  status: Exclude<QcStatus, "pass">;
  point: CutPoint;
  word: Word;
  depth: number;
  confirmedByAudio: boolean;
}

interface AudioLevels {
  samples: Int16Array;
  durationSec: number;
  /** Mức coi là "đang có tiếng" (dBFS) - null khi file không tách được tiếng/nền */
  thresholdDb: number | null;
}

// ---------------------------------------------------------------- Tiện ích

function fmt(n: number, digits = 2): string {
  return Number.isFinite(n) ? n.toFixed(digits) : "?";
}

/** Chữ chứa điểm `t` cùng độ sâu (khoảng cách tới mép gần nhất) */
function wordAt(words: Word[], t: number): { word: Word; depth: number } | null {
  for (const w of words) {
    if (w.start >= t) break;
    if (w.end <= t) continue;
    return { word: w, depth: Math.min(t - w.start, w.end - t) };
  }
  return null;
}

// --------------------------------------------------------------- Âm lượng

/**
 * Giải mã audio một lần ra PCM mono 8kHz rồi đo trong RAM. File tạm nằm trong
 * renders/ của project (cùng ổ đĩa với project, đã gitignore) và bị xóa ngay.
 */
async function loadLevels(fileAbs: string, tmpDir: string): Promise<AudioLevels | null> {
  ensureDir(tmpDir);
  const tmp = path.join(tmpDir, `qc-cuts-${process.pid}-${Date.now()}.pcm`);
  try {
    const r = await execFileCaptureAll(
      "ffmpeg",
      ["-hide_banner", "-nostats", "-v", "error", "-y", "-i", fileAbs, "-vn", "-ac", "1",
        "-ar", String(PCM_RATE), "-f", "s16le", tmp],
      { timeoutMs: FFMPEG_TIMEOUT_MS },
    );
    if (r.timedOut || r.code !== 0 || !fs.existsSync(tmp)) return null;
    const buf = fs.readFileSync(tmp);
    // Chép sang ArrayBuffer riêng: Buffer có thể nằm lệch byteOffset lẻ, Int16Array
    // dựng thẳng lên đó sẽ ném lỗi căn lề.
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length - (buf.length % 2));
    const samples = new Int16Array(ab);
    if (samples.length < PCM_RATE * REF_WIN_SEC * 4) return null;

    const win = Math.round(PCM_RATE * REF_WIN_SEC);
    const dbs: number[] = [];
    for (let i = 0; i + win <= samples.length; i += win) dbs.push(rmsDb(samples, i, i + win));
    dbs.sort((a, b) => a - b);
    const noise = dbs[Math.floor(dbs.length * 0.1)];
    const speech = dbs[Math.floor(dbs.length * 0.9)];
    return {
      samples,
      durationSec: samples.length / PCM_RATE,
      // Giữa nền và tiếng nói (theo dB): âm tiết nhỏ có thể lọt dưới ngưỡng -
      // chấp nhận bỏ sót còn hơn báo oan.
      thresholdDb: speech - noise >= MIN_DYNAMIC_DB ? noise + (speech - noise) / 2 : null,
    };
  } catch {
    return null;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function rmsDb(samples: Int16Array, from: number, to: number): number {
  let sum = 0;
  const a = Math.max(0, from);
  const b = Math.min(samples.length, to);
  if (b <= a) return -120;
  for (let i = a; i < b; i++) sum += samples[i] * samples[i];
  const meanSq = sum / (b - a);
  return meanSq > 0 ? 10 * Math.log10(meanSq / (32768 * 32768)) : -120;
}

/** Hai bên điểm cắt có đều đang có tiếng không - null = không đo được */
function soundOnBothSides(levels: AudioLevels | null, t: number): boolean | null {
  if (!levels || levels.thresholdDb === null) return null;
  const at = Math.round(t * PCM_RATE);
  const w = Math.round(EDGE_WIN_SEC * PCM_RATE);
  const before = rmsDb(levels.samples, at - w, at);
  const after = rmsDb(levels.samples, at, at + w);
  return before >= levels.thresholdDb && after >= levels.thresholdDb;
}

// ------------------------------------------------------------------ Check

export async function checkClippedWords(projectId: string, meta: ProjectMeta | null): Promise<QcCheck> {
  if (!meta) {
    return { id: "clipped-words", label: LABEL, status: "warn", detail: "Không đo được: không đọc được meta.json", value: null };
  }
  const fps = Number(meta.fps) || 30;
  const scenes = Array.isArray(meta.scenes) ? meta.scenes : [];
  const timeline = sceneTimeline(scenes, fps);

  // ---- Gắn transcript cho từng file theo đúng hệ thời gian của nó ----------
  // (projectTimeline.ts: bản cắt <-> transcript.cut.json, bản gốc <-> transcript
  // gốc; chưa từng auto-trim thì chỉ đoán theo quy ước -> certain=false, tối đa warn)
  const map = transcriptMap(projectId);
  const report = map.report;
  const reportSourceAbs = map.sourceAbs;
  const reportOutputAbs = map.cutAbs;
  const htmlVideos = htmlVideoFiles(projectId);
  const cutFileUsed =
    reportOutputAbs !== null &&
    (htmlVideos.includes(reportOutputAbs) ||
      scenes.some((s) => s.srcVideo && resolveProjectFile(projectId, s.srcVideo) === reportOutputAbs));

  const files = new Map<string, CutFile>();
  const fileFor = (abs: string): CutFile => {
    const hit = files.get(abs);
    if (hit) return hit;
    const { transcript, certain } = map.forFile(abs);
    const f: CutFile = { abs, rel: toRepoRel(abs), transcript, certain };
    files.set(abs, f);
    return f;
  };

  /** Mối nối trong bản cắt rơi vào giây nào của video (nếu bản cắt được dùng làm footage) */
  const videoTimeInCutFile = (t: number): number | null => {
    if (!reportOutputAbs) return null;
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const tl = timeline[i];
      if (!tl || !s.srcVideo || s.muted === true) continue;
      if (resolveProjectFile(projectId, s.srcVideo) !== reportOutputAbs) continue;
      const from = typeof s.from === "number" ? s.from : 0;
      if (t >= from && t < from + tl.dur) return tl.start + (t - from);
    }
    return null;
  };

  const points: CutPoint[] = [];
  let autoTrimJoins = 0;
  let sceneEdges = 0;
  const notes: string[] = [];

  // ---- 1) Mối nối bên trong bản cắt của auto-trim ------------------------
  if (report?.output && reportSourceAbs && fs.existsSync(reportSourceAbs)) {
    const keep = Array.isArray(report.keepRanges) ? report.keepRanges : null;
    if (!keep) {
      notes.push(
        "báo cáo auto-trim được tạo trước khi có danh sách đoạn giữ nên chưa soát được các mối nối " +
          "bên trong bản cắt - chạy lại auto-trim để soát",
      );
    } else {
      if (!cutFileUsed) {
        notes.push(
          `bản cắt ${report.output} không thấy được dùng ở scene hay composition nào, nên lỗi ở các mối nối ` +
            "của nó chỉ cảnh báo, không chặn final",
        );
      }
      const src = fileFor(reportSourceAbs);
      let joinAt = 0; // giây trong bản cắt
      for (let i = 0; i < keep.length - 1; i++) {
        joinAt += keep[i][1] - keep[i][0];
        const videoAt = videoTimeInCutFile(joinAt);
        const where = `mối nối auto-trim #${i + 1} (giây ${fmt(joinAt)} của bản cắt)`;
        // Mỗi mối nối có hai mép trên file nguồn: chỗ đoạn trước dừng, chỗ đoạn sau bắt đầu
        points.push({ file: src, at: keep[i][1], videoAt, blocking: cutFileUsed, where: `${where}, mép cuối đoạn trước` });
        points.push({ file: src, at: keep[i + 1][0], videoAt, blocking: cutFileUsed, where: `${where}, mép đầu đoạn sau` });
        autoTrimJoins++;
      }
    }
  }

  // ---- 2) Mép đầu/cuối của scene footage --------------------------------
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (!s.srcVideo || s.muted === true) continue; // scene câm: tiếng không đi qua mép này
    const abs = resolveProjectFile(projectId, s.srcVideo);
    if (!abs) continue;
    const file = fileFor(abs);
    const tl = timeline[i];
    const from = typeof s.from === "number" ? s.from : 0;
    const to = typeof s.to === "number" ? s.to : null;

    // Hai scene liền nhau phát nối tiếp cùng một file (thường do tách scene để
    // zoom) thì chỗ giáp ranh KHÔNG phải nhát cắt - tiếng chạy liền mạch.
    const prev = i > 0 ? scenes[i - 1] : null;
    const contiguousWithPrev =
      prev?.srcVideo && prev.muted !== true && typeof prev.to === "number" &&
      resolveProjectFile(projectId, prev.srcVideo) === abs && Math.abs(prev.to - from) <= 1.5 / fps;
    const next = i + 1 < scenes.length ? scenes[i + 1] : null;
    const contiguousWithNext =
      to !== null && next?.srcVideo && next.muted !== true &&
      resolveProjectFile(projectId, next.srcVideo) === abs &&
      Math.abs((typeof next.from === "number" ? next.from : 0) - to) <= 1.5 / fps;

    if (from > FILE_EDGE_SEC && !contiguousWithPrev) {
      points.push({ file, at: from, videoAt: tl ? tl.start : null, blocking: true, where: `đầu scene "${s.id}"` });
      sceneEdges++;
    }
    if (to !== null && !contiguousWithNext) {
      points.push({ file, at: to, videoAt: tl ? tl.start + tl.dur : null, blocking: true, where: `cuối scene "${s.id}"` });
      sceneEdges++;
    }
  }

  if (points.length === 0) {
    return {
      id: "clipped-words",
      label: LABEL,
      status: "pass",
      detail:
        "Không có điểm cắt nào trên footage để soát (không có scene footage có tiếng, chưa chạy auto-trim)" +
        (notes.length ? `. Lưu ý: ${notes.join("; ")}` : ""),
      value: 0,
    };
  }

  // ---- 3) Soát từng điểm --------------------------------------------------
  const tmpDir = path.join(projectDirOf(projectId), "renders");
  const levelsOf = new Map<string, AudioLevels | null>();
  const findings: Finding[] = [];
  let noTranscript = 0;
  let fileEnd = 0;
  let silentInsideWord = 0;

  for (const p of points) {
    const words = p.file.transcript?.words;
    if (!words) {
      noTranscript++;
      continue;
    }
    if (!levelsOf.has(p.file.abs)) levelsOf.set(p.file.abs, await loadLevels(p.file.abs, tmpDir));
    const levels = levelsOf.get(p.file.abs) ?? null;
    if (levels && p.at >= levels.durationSec - FILE_EDGE_SEC) {
      fileEnd++; // mép "to" chạm cuối file: phát hết file chứ không cắt
      continue;
    }

    const hit = wordAt(words, p.at);
    if (!hit || hit.depth + EPS < MIN_DEPTH_SEC) continue;
    const sound = soundOnBothSides(levels, p.at);
    if (sound === false) {
      // Transcript bảo trong chữ nhưng một bên điểm cắt đang im: mốc chữ của
      // whisper bị kéo dài sang khoảng nghỉ. Không phải cụt chữ.
      silentInsideWord++;
      continue;
    }
    findings.push({
      status: sound === true && p.file.certain && p.blocking && hit.depth + EPS >= FAIL_DEPTH_SEC ? "fail" : "warn",
      point: p,
      word: hit.word,
      depth: hit.depth,
      confirmedByAudio: sound === true,
    });
  }

  // ---- 4) Báo cáo ---------------------------------------------------------
  const scope =
    `Đã soát ${points.length - fileEnd} điểm cắt (${autoTrimJoins} mối nối auto-trim x 2 mép, ${sceneEdges - fileEnd} mép scene footage)`;
  const extra: string[] = [...notes];
  if (noTranscript > 0) extra.push(`${noTranscript} điểm nằm trên file không có transcript nên không soát được chữ`);
  if (silentInsideWord > 0) {
    extra.push(
      `bỏ qua ${silentInsideWord} điểm transcript báo nằm trong chữ nhưng một bên điểm cắt đang im ` +
        "(mốc chữ của whisper bị kéo dài sang khoảng nghỉ)",
    );
  }
  if (htmlVideos.length > 0) {
    extra.push("điểm cắt của footage nhúng trong composition HyperFrames (thẻ <video>) chưa soát được");
  }
  const tail = extra.length ? `. Lưu ý: ${extra.join("; ")}.` : ".";

  if (findings.length === 0) {
    return {
      id: "clipped-words",
      label: LABEL,
      status: "pass",
      detail: `${scope}: không điểm nào cắt vào giữa chữ${tail}`,
      value: 0,
    };
  }

  const status: QcStatus = findings.some((f) => f.status === "fail") ? "fail" : "warn";
  const listed = [...findings]
    // Lỗi chặn final lên trước, cùng mức thì theo thứ tự thời gian để tua lần lượt
    .sort((a, b) =>
      a.status !== b.status
        ? a.status === "fail" ? -1 : 1
        : (a.point.videoAt ?? a.point.at) - (b.point.videoAt ?? b.point.at),
    )
    .slice(0, MAX_LISTED)
    .map((f) => {
      const at = f.point.videoAt !== null
        ? `${fmt(f.point.videoAt)}s`
        : `giây ${fmt(f.point.at)} của ${f.point.file.rel}`;
      const proof = f.confirmedByAudio
        ? "hai bên điểm cắt đều đang có tiếng"
        : "chưa đo được âm thanh để xác nhận - nghe lại";
      return `${at} - ${f.point.where} cắt giữa chữ "${f.word.text}" (lấn ${fmt(f.depth)}s vào chữ, ${proof})`;
    });
  const fails = findings.filter((f) => f.status === "fail").length;
  const advice =
    status === "fail"
      ? " Dời điểm cắt ra khoảng nghỉ gần nhất (mép scene: sửa from/to trong meta.json theo mốc chữ " +
        "của transcript; mối nối auto-trim: bỏ duyệt ứng viên đó rồi chạy lại auto-trim)."
      : " Nghe lại các chỗ này trước khi render final.";
  return {
    id: "clipped-words",
    label: LABEL,
    status,
    detail:
      `${findings.length} điểm cắt vào giữa chữ` +
      (fails > 0 ? ` (${fails} điểm chắc chắn: transcript và âm thanh cùng xác nhận)` : "") +
      `: ${listed.join("; ")}` +
      (findings.length > MAX_LISTED ? " ..." : "") +
      `.${advice} ${scope}${tail}`,
    value: findings.length,
    // Chỉ điểm quy được ra giây của video mới vẽ được lên timeline
    marks: findings
      .filter((f) => f.point.videoAt !== null)
      .map((f) => ({ at: f.point.videoAt as number, label: `Cụt chữ "${f.word.text}"` })),
  };
}
