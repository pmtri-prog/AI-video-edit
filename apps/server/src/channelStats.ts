import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./config.js";
import { HttpError, ensureDir } from "./util.js";

/**
 * Chỉ số kênh: số liệu video ngắn sau khi đăng (TikTok / FB Reels / YT Shorts).
 *
 * Lưu ở channel-stats/*.json (gitignore - repo công khai, đây là dữ liệu kênh
 * riêng của người dùng). Claude đọc số từ trang Studio của từng nền tảng rồi
 * PUT vào đây; web chỉ hiển thị.
 *
 * KHÔNG BAO GIỜ lưu tên người bình luận hay bất kỳ dữ liệu cá nhân nào của
 * người xem: chỉ có số đếm. Field `notes` là ghi chú của người đo (giờ đo, nguồn
 * số), không phải nơi chép bình luận.
 */

export const PLATFORMS = ["tiktok", "fb", "yt"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const MILESTONES = ["24h", "7d", "30d"] as const;
export type Milestone = (typeof MILESTONES)[number];

export const VIDEO_STATUSES = ["idea", "ready", "posted"] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const LESSON_STATUSES = ["testing", "confirmed", "dropped"] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export interface ChannelVideo {
  id: string;
  title: string;
  durationSec: number | null;
  /** 1 Data & insight, 2 Ý tưởng/công nghệ/sự kiện hot, 3 Đúng luật */
  pillar: 1 | 2 | 3 | null;
  axis: string;
  audience: string;
  status: VideoStatus;
  /** yyyy-mm-dd */
  postedAt: string | null;
  postedHour: number | null;
  /** Cách mở đầu: "canh-that" | "mat" | "the-chu" | ... (chuỗi tự do ngắn) */
  opensWith: string | null;
  notes: string;
}

export interface Retention {
  s2: number | null;
  s5: number | null;
  s10: number | null;
}

export interface Measurement {
  videoId: string;
  platform: Platform;
  milestone: Milestone;
  /** yyyy-mm-dd hoặc ISO datetime */
  measuredAt: string;
  views: number | null;
  avgWatchSec: number | null;
  fullWatch: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  newFollowers: number | null;
  pctFeed: number | null;
  pctSearch: number | null;
  retention: Retention;
  notes: string;
}

export interface Lesson {
  id: string;
  text: string;
  status: LessonStatus;
}

export interface ChannelStats {
  videos: ChannelVideo[];
  measurements: Measurement[];
  lessons: Lesson[];
}

const dir = () => path.join(repoRoot, "channel-stats");
const FILES = {
  videos: "videos.json",
  measurements: "measurements.json",
  lessons: "lessons.json",
} as const;

// ------------------------------------------------------------- Validate

function bad(msg: string): never {
  throw new HttpError(400, "INVALID_CHANNEL_STATS", msg);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, field: string, max = 500): string {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") return bad(`${field} phải là chuỗi`);
  const s = v.trim();
  if (s.length > max) return bad(`${field} dài quá ${max} ký tự`);
  return s;
}

function reqStr(v: unknown, field: string, max = 300): string {
  const s = str(v, field, max);
  if (!s) bad(`Thiếu ${field}`);
  return s;
}

function oneOf<T extends string>(v: unknown, list: readonly T[], field: string): T {
  if (typeof v !== "string" || !(list as readonly string[]).includes(v)) {
    return bad(`${field} phải là một trong: ${list.join(", ")}`);
  }
  return v as T;
}

/** Số >= 0 (hoặc null/bỏ trống). `max` = 1 cho tỷ lệ. */
function num(v: unknown, field: string, max = Infinity): number | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max) {
    return bad(`${field} phải là số trong khoảng 0..${max === Infinity ? "∞" : max}`);
  }
  return v;
}

function dateStr(v: unknown, field: string): string {
  const s = reqStr(v, field, 40);
  if (!/^\d{4}-\d{2}-\d{2}([T ][\d:.+\-Zz]+)?$/.test(s) || Number.isNaN(Date.parse(s))) {
    bad(`${field} phải là yyyy-mm-dd hoặc ISO datetime`);
  }
  return s;
}

export function normalizeVideo(raw: unknown, id: string): ChannelVideo {
  if (!isObj(raw)) return bad("Video phải là object");
  const vid = reqStr(id, "id", 120);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(vid)) bad("id video phải là kebab-case ASCII");
  const pillar = raw.pillar === undefined || raw.pillar === null ? null : raw.pillar;
  if (pillar !== null && pillar !== 1 && pillar !== 2 && pillar !== 3) bad("pillar phải là 1, 2 hoặc 3");
  const hour = num(raw.postedHour, "postedHour", 23);
  return {
    id: vid,
    title: reqStr(raw.title, "title"),
    durationSec: num(raw.durationSec, "durationSec"),
    pillar: pillar as 1 | 2 | 3 | null,
    axis: str(raw.axis, "axis"),
    audience: str(raw.audience, "audience"),
    status: raw.status === undefined ? "posted" : oneOf(raw.status, VIDEO_STATUSES, "status"),
    postedAt: raw.postedAt ? dateStr(raw.postedAt, "postedAt").slice(0, 10) : null,
    postedHour: hour === null ? null : Math.floor(hour),
    opensWith: str(raw.opensWith, "opensWith", 40) || null,
    notes: str(raw.notes, "notes", 1000),
  };
}

export function normalizeMeasurement(raw: unknown): Measurement {
  if (!isObj(raw)) return bad("Measurement phải là object");
  const ret = isObj(raw.retention) ? raw.retention : {};
  return {
    videoId: reqStr(raw.videoId, "videoId", 120),
    platform: oneOf(raw.platform, PLATFORMS, "platform"),
    milestone: oneOf(raw.milestone, MILESTONES, "milestone"),
    measuredAt: dateStr(raw.measuredAt, "measuredAt"),
    views: num(raw.views, "views"),
    avgWatchSec: num(raw.avgWatchSec, "avgWatchSec"),
    fullWatch: num(raw.fullWatch, "fullWatch", 1),
    likes: num(raw.likes, "likes"),
    comments: num(raw.comments, "comments"),
    shares: num(raw.shares, "shares"),
    saves: num(raw.saves, "saves"),
    newFollowers: num(raw.newFollowers, "newFollowers"),
    pctFeed: num(raw.pctFeed, "pctFeed", 1),
    pctSearch: num(raw.pctSearch, "pctSearch", 1),
    retention: {
      s2: num(ret.s2, "retention.s2", 1),
      s5: num(ret.s5, "retention.s5", 1),
      s10: num(ret.s10, "retention.s10", 1),
    },
    notes: str(raw.notes, "notes", 1000),
  };
}

export function normalizeLessons(raw: unknown): Lesson[] {
  if (!Array.isArray(raw)) return bad("Lessons phải là mảng");
  const seen = new Set<string>();
  return raw.map((r, i) => {
    if (!isObj(r)) return bad(`lessons[${i}] phải là object`);
    const id = reqStr(r.id ?? `l${i + 1}`, "id", 60);
    if (seen.has(id)) bad(`Trùng id bài học "${id}"`);
    seen.add(id);
    return {
      id,
      text: reqStr(r.text, "text", 500),
      status: oneOf(r.status ?? "testing", LESSON_STATUSES, "status"),
    };
  });
}

const mKey = (m: Pick<Measurement, "videoId" | "platform" | "milestone">) =>
  `${m.videoId}|${m.platform}|${m.milestone}`;

// ------------------------------------------------------------- Đọc / ghi

function readJson<T>(file: keyof typeof FILES, fallback: T): T {
  const p = path.join(dir(), FILES[file]);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch (err) {
    throw new HttpError(
      500,
      "CHANNEL_STATS_CORRUPT",
      `Không đọc được channel-stats/${FILES[file]}: ${(err as Error).message}`,
    );
  }
}

function writeJson(file: keyof typeof FILES, data: unknown): void {
  ensureDir(dir());
  const p = path.join(dir(), FILES[file]);
  // Ghi file tạm rồi rename: tắt máy giữa lúc ghi không để lại JSON cụt
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, p);
}

export function readChannelStats(): ChannelStats {
  return {
    videos: readJson<ChannelVideo[]>("videos", []),
    measurements: readJson<Measurement[]>("measurements", []),
    lessons: readJson<Lesson[]>("lessons", []),
  };
}

/** Upsert theo (videoId, platform, milestone). Trả số dòng sau khi gộp. */
export function upsertMeasurements(raw: unknown): Measurement[] {
  if (!Array.isArray(raw) || raw.length === 0) bad("Body phải là mảng measurement không rỗng");
  const incoming = (raw as unknown[]).map(normalizeMeasurement);
  const map = new Map(readJson<Measurement[]>("measurements", []).map((m) => [mKey(m), m]));
  for (const m of incoming) map.set(mKey(m), m);
  const all = [...map.values()];
  writeJson("measurements", all);
  return all;
}

export function upsertVideo(id: string, raw: unknown): ChannelVideo {
  const video = normalizeVideo(raw, id);
  const videos = readJson<ChannelVideo[]>("videos", []);
  const i = videos.findIndex((v) => v.id === video.id);
  if (i >= 0) videos[i] = video;
  else videos.push(video);
  writeJson("videos", videos);
  return video;
}

export function replaceLessons(raw: unknown): Lesson[] {
  const lessons = normalizeLessons(raw);
  writeJson("lessons", lessons);
  return lessons;
}
