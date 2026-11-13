import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./config.js";
import {
  readAutoTrimReport,
  readSourceTranscript,
  resolveTrimSource,
  type AutoTrimReport,
} from "./jobs/autoTrim.js";
import { projectDirOf, type ProjectMeta, type SceneMeta } from "./meta.js";
import { parseTranscriptJson, readProjectTranscript } from "./transcript.js";
import { toRepoRel } from "./util.js";

/**
 * Dòng thời gian của một project, quy đổi về GIÂY TRÊN VIDEO LẮP RÁP.
 *
 * Dùng chung cho hai chỗ phải nói cùng một ngôn ngữ thời gian:
 * - QC `clipped-words` (qcCuts.ts): điểm cắt rơi vào giây nào của video.
 * - Timeline trên web (GET /api/projects/:id/timeline): vẽ scene, lời nói,
 *   SFX, nhạc lên cùng một trục với bản draft đang phát.
 *
 * Cái bẫy cần nhớ (đã ghi ở QC dead-air): transcript theo hệ thời gian của
 * FOOTAGE (bản gốc hoặc bản .cut.mp4), không phải của video lắp ráp. Video lắp
 * ráp chèn intro/cutaway nên hai trục lệch nhau - phải quy đổi qua `from`/`to`
 * của từng scene footage, không được vẽ thẳng transcript lên trục video.
 */

export interface TimedWord {
  text: string;
  start: number;
  end: number;
}

export interface FileTranscript {
  relPath: string;
  words: TimedWord[];
}

/**
 * Đường dẫn trong meta.json -> tuyệt đối, chỉ chấp nhận file nằm TRONG project.
 * Agent hay viết theo hai lối (tính từ project hoặc từ repo root) - nhận cả hai.
 */
export function resolveProjectFile(projectId: string, rel: string): string | null {
  const root = path.resolve(projectDirOf(projectId));
  const inside = (abs: string): boolean => abs.startsWith(root + path.sep);
  for (const abs of [path.resolve(root, rel), path.resolve(repoRoot, rel)]) {
    if (inside(abs) && fs.existsSync(abs)) return abs;
  }
  return null;
}

/**
 * Giây bắt đầu + thời lượng của từng scene trên video lắp ráp - cùng công thức
 * với engines/remotion/src/manifest.ts (cộng dồn, trừ transitionOverlap). Scene
 * thiếu thời lượng thì từ đó trở đi không suy ra được (null).
 */
export function sceneTimeline(
  scenes: SceneMeta[],
  fps: number,
): Array<{ start: number; dur: number } | null> {
  const out: Array<{ start: number; dur: number } | null> = [];
  let frame: number | null = 0;
  for (const s of scenes) {
    let dur: number | null = null;
    if (typeof s.durationInFrames === "number") dur = s.durationInFrames;
    else if (s.srcVideo && typeof s.from === "number" && typeof s.to === "number") {
      dur = Math.max(1, Math.round(s.to * fps) - Math.round(s.from * fps));
    }
    if (frame === null || dur === null) {
      out.push(null);
      frame = null;
      continue;
    }
    out.push({ start: frame / fps, dur: dur / fps });
    frame += dur - (typeof s.transitionOverlap === "number" ? s.transitionOverlap : 0);
  }
  return out;
}

/** Transcript JSON (mọi dạng parseTranscriptJson nhận) -> danh sách chữ có mốc, đã sắp */
export function transcriptWords(json: unknown, relPath: string): FileTranscript | null {
  const segments = parseTranscriptJson(json);
  if (!segments) return null;
  const words: TimedWord[] = [];
  for (const seg of segments) {
    if (seg.words.length > 0) {
      for (const w of seg.words) {
        if (w.end > w.start) words.push({ text: w.word.trim(), start: w.start, end: w.end });
      }
    } else if (seg.end > seg.start) {
      // Câu không có mốc từng chữ: cả câu thành một "chữ" dài
      words.push({ text: seg.text.slice(0, 40), start: seg.start, end: seg.end });
    }
  }
  words.sort((a, b) => a.start - b.start);
  return words.length > 0 ? { relPath, words } : null;
}

function readTranscriptFile(abs: string): FileTranscript | null {
  try {
    return transcriptWords(JSON.parse(fs.readFileSync(abs, "utf8")), toRepoRel(abs));
  } catch {
    return null;
  }
}

export interface TranscriptMap {
  report: AutoTrimReport | null;
  /** Video nguồn mà auto-trim đã cắt (tuyệt đối) */
  sourceAbs: string | null;
  /** Bản .cut.mp4 auto-trim sinh ra (tuyệt đối) */
  cutAbs: string | null;
  /**
   * Transcript theo đúng hệ thời gian của file `abs`. `certain` = có báo cáo
   * auto-trim làm chứng; false = chỉ đoán theo quy ước (vd chưa từng auto-trim,
   * transcript gốc coi là của video nguồn mặc định).
   */
  forFile(abs: string): { transcript: FileTranscript | null; certain: boolean };
}

/** Ghép mỗi file video của project với transcript đúng hệ thời gian của nó */
export function transcriptMap(projectId: string): TranscriptMap {
  const report = readAutoTrimReport(projectId);
  const sourceT = readSourceTranscript(projectId);
  const sourceTranscript = sourceT ? transcriptWords(sourceT.json, sourceT.relPath) : null;
  const sourceAbs = report ? path.resolve(repoRoot, report.source) : null;
  const cutAbs = report?.output ? path.resolve(repoRoot, report.output) : null;
  let defaultSourceAbs: string | null = null;
  try {
    defaultSourceAbs = resolveTrimSource(projectId, null);
  } catch {
    defaultSourceAbs = null;
  }
  const cache = new Map<string, { transcript: FileTranscript | null; certain: boolean }>();

  return {
    report,
    sourceAbs,
    cutAbs,
    forFile(abs) {
      const hit = cache.get(abs);
      if (hit) return hit;
      let out: { transcript: FileTranscript | null; certain: boolean } = { transcript: null, certain: false };
      if (cutAbs && abs === cutAbs && report?.transcript.cut) {
        const t = readTranscriptFile(path.resolve(repoRoot, report.transcript.cut));
        out = { transcript: t, certain: t !== null };
      } else if (sourceAbs && abs === sourceAbs && sourceTranscript) {
        // Chắc chắn khi chính transcript này là cái job cắt đã dùng làm hàng rào
        out = { transcript: sourceTranscript, certain: report?.transcript.source === sourceTranscript.relPath };
      } else if (!report && defaultSourceAbs && abs === defaultSourceAbs && sourceTranscript) {
        out = { transcript: sourceTranscript, certain: false };
      }
      cache.set(abs, out);
      return out;
    },
  };
}

// ------------------------------------------------------------ Mô hình vẽ

export type TimelineSceneKind = "hyperframes" | "footage" | "image" | "other";

export interface TimelineScene {
  id: string;
  kind: TimelineSceneKind;
  start: number;
  end: number;
  /** Footage có tắt tiếng không (tiếng đi qua audio.voice) */
  muted: boolean;
}

export interface TimelineSpan {
  start: number;
  end: number;
  text: string;
}

export interface ProjectTimeline {
  fps: number;
  durationSec: number;
  scenes: TimelineScene[];
  /** Lời nói đã gom thành cụm, theo giây video */
  speech: TimelineSpan[];
  /** Nguồn của làn lời nói: "captions" (phụ đề trong meta) | đường dẫn transcript | null */
  speechSource: string | null;
  sfx: Array<{ at: number; label: string; file: string }>;
  music: { label: string; file: string; start: number; end: number; ducks: Array<[number, number]> } | null;
  /** id scene thiếu thời lượng - từ scene này trở đi không vẽ được */
  unresolvedFrom: string | null;
}

/** Hai chữ cách nhau dưới ngần này thì chung một cụm trên làn lời nói */
const PHRASE_GAP_SEC = 0.35;
/** Cụm dài quá thì cắt ra cho dễ đọc */
const PHRASE_MAX_SEC = 4;

function groupPhrases(words: TimedWord[]): TimelineSpan[] {
  const out: TimelineSpan[] = [];
  for (const w of [...words].sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    if (last && w.start - last.end <= PHRASE_GAP_SEC && w.end - last.start <= PHRASE_MAX_SEC) {
      last.end = Math.max(last.end, w.end);
      last.text = `${last.text} ${w.text}`.trim();
    } else {
      out.push({ start: w.start, end: w.end, text: w.text });
    }
  }
  return out;
}

function baseName(file: string): string {
  return path.basename(file).replace(/\.[^.]+$/, "");
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function buildProjectTimeline(projectId: string, meta: ProjectMeta): ProjectTimeline {
  const fps = Number(meta.fps) || 30;
  const scenes = Array.isArray(meta.scenes) ? meta.scenes : [];
  const tl = sceneTimeline(scenes, fps);

  const outScenes: TimelineScene[] = [];
  let unresolvedFrom: string | null = null;
  scenes.forEach((s, i) => {
    const t = tl[i];
    if (!t) {
      unresolvedFrom ??= s.id;
      return;
    }
    const kind: TimelineSceneKind = s.src ? "hyperframes" : s.srcVideo ? "footage" : s.srcImage ? "image" : "other";
    outScenes.push({ id: s.id, kind, start: t.start, end: t.start + t.dur, muted: s.muted === true });
  });
  const tryohEnd = num((meta as { tryoh?: { endCardFrames?: unknown } }).tryoh?.endCardFrames) ?? 0;
  const durationSec = Math.max(0, ...outScenes.map((s) => s.end)) + tryohEnd / fps;

  // ---- Lời nói -----------------------------------------------------------
  let speech: TimelineSpan[] = [];
  let speechSource: string | null = null;
  const captions: unknown[] = Array.isArray(meta.captions) ? meta.captions : [];
  if (captions.length > 0) {
    // Phụ đề karaoke đã theo FRAME TUYỆT ĐỐI của video lắp ráp - dùng thẳng
    for (const raw of captions) {
      const cue = raw as { from?: unknown; durationInFrames?: unknown; words?: unknown };
      const from = num(cue.from);
      const dur = num(cue.durationInFrames);
      if (from === null || dur === null) continue;
      const words = Array.isArray(cue.words) ? cue.words : [];
      const text = words.map((w) => (w && typeof w === "object" ? String((w as { text?: unknown }).text ?? "") : "")).join(" ");
      speech.push({ start: from / fps, end: (from + dur) / fps, text: text.trim() });
    }
    speechSource = "captions";
  } else {
    // Quy đổi transcript của từng file footage qua from/to của scene dùng nó
    const map = transcriptMap(projectId);
    const words: TimedWord[] = [];
    const used = new Set<string>();
    scenes.forEach((s, i) => {
      const t = tl[i];
      if (!t || !s.srcVideo || s.muted === true) return;
      const abs = resolveProjectFile(projectId, s.srcVideo);
      if (!abs) return;
      const { transcript } = map.forFile(abs);
      if (!transcript) return;
      used.add(transcript.relPath);
      const from = num(s.from) ?? 0;
      const to = from + t.dur;
      for (const w of transcript.words) {
        if (w.end <= from || w.start >= to) continue;
        words.push({
          text: w.text,
          start: t.start + Math.max(0, w.start - from),
          end: t.start + Math.min(t.dur, w.end - from),
        });
      }
    });
    if (words.length > 0) {
      speech = groupPhrases(words);
      speechSource = [...used].join(", ");
    } else if (meta.audio?.voice) {
      // Giọng đọc (text to video, lồng tiếng) phát từ giây 0 của video - transcript
      // của nó đã cùng trục với video lắp ráp.
      const t = readProjectTranscript(projectId);
      if (t) {
        const all: TimedWord[] = [];
        for (const seg of t.segments) {
          if (seg.words.length > 0) for (const w of seg.words) all.push({ text: w.word.trim(), start: w.start, end: w.end });
          else all.push({ text: seg.text, start: seg.start, end: seg.end });
        }
        speech = groupPhrases(all);
        speechSource = t.relPath;
      }
    }
  }

  // ---- SFX + nhạc --------------------------------------------------------
  const sfx = (meta.audio?.sfx ?? [])
    .filter((x) => typeof x.atFrame === "number" && typeof x.file === "string")
    .map((x) => ({ at: (x.atFrame as number) / fps, label: baseName(x.file), file: x.file }))
    .sort((a, b) => a.at - b.at);

  const m = meta.audio?.music;
  const music =
    m && typeof m.file === "string" && m.file
      ? {
          label: baseName(m.file),
          file: m.file,
          start: 0,
          end: durationSec,
          ducks: (Array.isArray(m.speech) ? m.speech : []).filter(
            (r): r is [number, number] => Array.isArray(r) && num(r[0]) !== null && num(r[1]) !== null,
          ),
        }
      : null;

  return { fps, durationSec, scenes: outScenes, speech, speechSource, sfx, music, unresolvedFrom };
}
