import fs from "node:fs";
import path from "node:path";
import { paths, repoRoot } from "./config.js";
import { contentGateOf } from "./contentGate.js";
import { listProjectAssets, projectDirOf, type MusicMeta, type ProjectMeta, type SfxMeta } from "./meta.js";
import { readMusicLibrary } from "./routes/music.js";
import { ensureDir } from "./util.js";

/**
 * Duyệt 3 · Âm thanh - nhạc nền (cả bài hoặc theo đoạn) + SFX theo từng điểm.
 *
 * Lựa chọn của người duyệt lưu ở `meta.soundGate`; `applySound` dịch nó sang
 * timeline thật (`audio.music` | `audio.musicSections`, `audio.sfx` owner
 * "sound"). Mọi lần dựng draft đều gọi lại `applySound`, nên đổi cảnh ở Duyệt 2
 * không làm mất âm thanh đã chọn.
 */

export const SOUND_MODES = ["none", "whole", "sections"] as const;
export type SoundMode = (typeof SOUND_MODES)[number];

/** Biên giữa hai đoạn nhạc: bài trước nhỏ dần, bài sau to dần trong khoảng này */
export const CROSSFADE_SEC = 1;

export interface SoundSection {
  start: number;
  end: number;
  /** Tên đoạn để người duyệt nhận ra (câu móc, ý 1…) */
  label: string;
  /** File nhạc trong project (assets/...) - null = im lặng đoạn này */
  file: string | null;
}

export interface SoundCue {
  id: string;
  /** Giây trên timeline video */
  at: number;
  label: string;
  /** Tên file trong assets/sound-effects/ */
  file: string;
  volume: number;
  enabled: boolean;
  source: "insert" | "card" | "user";
}

export interface SoundGate {
  mode: SoundMode;
  /** Bài dùng cho cả video (mode whole) */
  file: string | null;
  volume: number;
  duckVolume: number;
  sections: SoundSection[];
  cues: SoundCue[];
  updatedAt: string | null;
}

export const DEFAULT_SOUND: SoundGate = {
  mode: "none",
  file: null,
  volume: 0.35,
  duckVolume: 0.12,
  sections: [],
  cues: [],
  updatedAt: null,
};

const SFX_DIR = path.join(repoRoot, "assets", "sound-effects");
const LIB_PREFIX = "library:";

const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp01 = (n: unknown, fb: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fb;

export function soundGateOf(meta: ProjectMeta): SoundGate | null {
  const raw = meta.soundGate as Partial<SoundGate> | undefined;
  return raw && typeof raw === "object" ? { ...DEFAULT_SOUND, ...raw } : null;
}

export function sfxFileExists(file: string): boolean {
  return path.basename(file) === file && fs.existsSync(path.join(SFX_DIR, file));
}

/** Bài nhạc chọn được: thư viện chung (assets/music) + file audio đã có trong project */
export function musicOptions(id: string) {
  const lib = readMusicLibrary()
    .filter((e) => fs.existsSync(path.join(paths.musicDir, e.file)))
    .map((e) => ({
      value: LIB_PREFIX + e.file,
      label: e.file,
      tags: e.tags,
      description: e.description,
      url: `assets/music/${e.file}`,
    }));
  const dir = projectDirOf(id);
  const own = listProjectAssets(id)
    .filter((f) => f.kind === "audio")
    .map((f) => path.relative(dir, path.join(repoRoot, f.relPath)).split(path.sep).join("/"))
    .filter((rel) => !rel.startsWith("assets/sfx/") && !/voice|transcript/i.test(rel))
    .map((rel) => ({ value: rel, label: rel.replace(/^assets\//, ""), tags: [] as string[], description: "", url: `video-projects/${id}/${rel}` }));
  return [...own.filter((o) => !lib.some((l) => o.value === `assets/music/${l.label}`)), ...lib];
}

/**
 * Chuẩn hóa giá trị chọn nhạc về đường dẫn trong project. Bài từ thư viện chung
 * được chép vào assets/music/ của project (Remotion chỉ stage file trong project).
 */
function resolveMusic(id: string, v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const dir = projectDirOf(id);
  if (v.startsWith(LIB_PREFIX)) {
    const name = v.slice(LIB_PREFIX.length);
    const src = path.join(paths.musicDir, name);
    if (path.basename(name) !== name || !fs.existsSync(src)) return null;
    const dst = path.join(dir, "assets", "music", name);
    if (!fs.existsSync(dst)) {
      ensureDir(path.dirname(dst));
      fs.copyFileSync(src, dst);
    }
    return `assets/music/${name}`;
  }
  const rel = v.trim().replace(/\\/g, "/");
  const abs = path.resolve(dir, rel);
  return abs.startsWith(path.resolve(dir) + path.sep) && fs.existsSync(abs) ? rel : null;
}

/** Các đoạn CÓ thoại (giây), gap < 0.6s gộp lại - để nhạc tự nhỏ xuống khi đang nói */
export function speechRanges(transcript: unknown): [number, number][] {
  const segs =
    transcript && typeof transcript === "object" && Array.isArray((transcript as { segments?: unknown }).segments)
      ? ((transcript as { segments: Record<string, unknown>[] }).segments)
      : [];
  const spans: [number, number][] = [];
  for (const s of segs) {
    const words = Array.isArray(s.words) ? (s.words as Record<string, unknown>[]) : [];
    const timed = words.filter((w) => typeof w.start === "number" && typeof w.end === "number");
    if (timed.length > 0) {
      for (const w of timed) spans.push([w.start as number, Math.max(w.start as number, w.end as number)]);
    } else if (typeof s.start === "number" && typeof s.end === "number") {
      spans.push([s.start, s.end]);
    }
  }
  spans.sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [a, b] of spans) {
    const last = out.at(-1);
    if (last && a - last[1] < 0.6) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out.map(([a, b]) => [r2(a), r2(b)]);
}

/** Đoạn nhạc mặc định: câu móc, rồi từng ý mà Duyệt 1 đã đếm */
export function suggestSections(meta: ProjectMeta, durationSec: number): SoundSection[] {
  const review = contentGateOf(meta).review;
  const cuts = new Set<number>();
  if (review?.hook && review.hook.end > 0.5 && review.hook.end < durationSec - 1) cuts.add(r2(review.hook.end));
  for (const idea of review?.ideas ?? []) {
    if (idea.start > 1 && idea.start < durationSec - 1) cuts.add(r2(idea.start));
  }
  if (review?.split && review.split.at > 1 && review.split.at < durationSec - 1) cuts.add(r2(review.split.at));
  const points = [0, ...[...cuts].sort((a, b) => a - b), r2(durationSec)];
  const out: SoundSection[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i + 1] - points[i] < 2) continue;
    out.push({
      start: points[i],
      end: points[i + 1],
      label: i === 0 && review?.hook ? "Câu móc" : `Đoạn ${out.length + 1}`,
      file: null,
    });
  }
  // Đoạn quá ngắn bị bỏ - nối biên để đoạn liền nhau phủ hết video
  for (let i = 1; i < out.length; i++) out[i].start = out[i - 1].end;
  if (out.length > 0) {
    out[0].start = 0;
    out.at(-1)!.end = r2(durationSec);
  }
  return out.length > 0 ? out : [{ start: 0, end: r2(durationSec), label: "Cả bài", file: null }];
}

/** SFX gợi ý: lúc hiện cảnh sự kiện (swoosh) và lúc hiện thẻ chữ (pop) */
export function suggestCues(meta: ProjectMeta): SoundCue[] {
  const fps = meta.fps || 30;
  // Brief tắt SFX = gợi ý vẫn hiện để người duyệt thấy, nhưng mặc định TẮT
  const on = meta.brief?.sfxMode !== "none";
  const cues: SoundCue[] = [];
  for (const ins of meta.inserts ?? []) {
    if (ins.kind !== "motion" && !ins.src) continue;
    if (ins.start < 0.2) continue; // mở video bằng cảnh wow - không cần tiếng chuyển
    const file = ins.sfx && sfxFileExists(ins.sfx.file) ? ins.sfx.file : "swoosh.mp3";
    cues.push({
      id: `ins-${ins.id}`,
      at: r2(ins.start),
      label: `Hiện cảnh: ${ins.anchor?.text?.slice(0, 50) || ins.src || ins.kind}`,
      file,
      volume: ins.sfx?.volume ?? 0.4,
      enabled: on,
      source: "insert",
    });
  }
  const cards = ((meta.tryoh as { cards?: unknown } | undefined)?.cards ?? []) as Record<string, unknown>[];
  cards.forEach((c, i) => {
    if (typeof c.from !== "number") return;
    const headline = typeof c.headline === "string" ? c.headline : "";
    cues.push({
      id: `card-${i}`,
      at: r2(c.from / fps),
      label: `Thẻ chữ: ${headline || (typeof c.label === "string" ? c.label : `#${i + 1}`)}`,
      file: c.big ? "ding.mp3" : "pop.mp3",
      volume: 0.4,
      enabled: on,
      source: "card",
    });
  });
  return cues.filter((c) => sfxFileExists(c.file)).sort((a, b) => a.at - b.at);
}

export function normSound(id: string, raw: unknown, durationSec: number, prev: SoundGate): SoundGate {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mode = SOUND_MODES.includes(r.mode as SoundMode) ? (r.mode as SoundMode) : prev.mode;
  const file = "file" in r ? resolveMusic(id, r.file) : prev.file;
  const sections = Array.isArray(r.sections)
    ? (r.sections as Record<string, unknown>[])
        .map((s, i) => {
          const start = Math.max(0, Math.min(Number(s.start), durationSec));
          const end = Math.max(0, Math.min(Number(s.end), durationSec));
          if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 0.5) return null;
          return {
            start: r2(start),
            end: r2(end),
            label: typeof s.label === "string" && s.label.trim() ? s.label.trim().slice(0, 40) : `Đoạn ${i + 1}`,
            file: resolveMusic(id, s.file),
          };
        })
        .filter((s): s is SoundSection => !!s)
        .sort((a, b) => a.start - b.start)
        .slice(0, 12)
    : prev.sections;
  const cues = Array.isArray(r.cues)
    ? (r.cues as Record<string, unknown>[])
        .map((c, i) => {
          const at = Number(c.at);
          if (!Number.isFinite(at) || at < 0 || at > durationSec) return null;
          if (typeof c.file !== "string" || !sfxFileExists(c.file)) return null;
          const source = c.source === "insert" || c.source === "card" ? c.source : "user";
          return {
            id: typeof c.id === "string" && /^[\w-]{1,60}$/.test(c.id) ? c.id : `user-${i}-${Math.round(at * 100)}`,
            at: r2(at),
            label: typeof c.label === "string" ? c.label.slice(0, 80) : "",
            file: c.file,
            volume: clamp01(c.volume, 0.4),
            enabled: c.enabled !== false,
            source,
          } satisfies SoundCue;
        })
        .filter((c): c is SoundCue => !!c)
        .sort((a, b) => a.at - b.at)
        .slice(0, 60)
    : prev.cues;
  return {
    mode,
    file,
    volume: clamp01(r.volume, prev.volume),
    duckVolume: clamp01(r.duckVolume, prev.duckVolume),
    sections,
    cues,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Ghi lựa chọn âm thanh vào timeline thật của meta (không ghi file meta - người
 * gọi tự writeMeta). SFX của minh họa (owner "insert") bị thay bằng danh sách
 * điểm của bước này, vì bước Âm thanh là nơi duyệt cuối cùng cho mọi SFX.
 */
export function applySound(meta: ProjectMeta, gate: SoundGate, transcript: unknown): void {
  const id = meta.id;
  const dir = projectDirOf(id);
  const audio = (meta.audio ??= { sfx: [] });
  const speech = speechRanges(transcript);
  const music = (file: string): MusicMeta => ({ file, volume: gate.volume, duckVolume: gate.duckVolume, speech });

  audio.music = gate.mode === "whole" && gate.file ? music(gate.file) : null;
  audio.musicSections =
    gate.mode === "sections"
      ? gate.sections
          .filter((s) => s.file)
          .map((s) => ({ ...music(s.file!), from: s.start, to: s.end, crossfade: CROSSFADE_SEC }))
      : [];

  const keep = (audio.sfx ?? []).filter((s) => s.owner !== "insert" && s.owner !== "sound");
  const mine: SfxMeta[] = [];
  for (const c of gate.cues) {
    if (!c.enabled || !sfxFileExists(c.file)) continue;
    const dst = path.join(dir, "assets", "sfx", c.file);
    if (!fs.existsSync(dst)) {
      ensureDir(path.dirname(dst));
      fs.copyFileSync(path.join(SFX_DIR, c.file), dst);
    }
    mine.push({ file: `assets/sfx/${c.file}`, atFrame: Math.max(0, Math.round(c.at * meta.fps)), volume: c.volume, owner: "sound" });
  }
  audio.sfx = [...keep, ...mine];
}
