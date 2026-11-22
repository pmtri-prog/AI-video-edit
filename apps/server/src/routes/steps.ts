import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { nanoid } from "nanoid";
import { extractJson, generateText } from "../aiText.js";
import { repoRoot } from "../config.js";
import * as db from "../db.js";
import { broadcast } from "../events.js";
import {
  CHANNEL_SKILL,
  FIXED_HASHTAGS,
  HOOK_FORMULAS,
  MAX_EXTRA_HASHTAGS,
  WOW_INSERT_ID,
  WOW_SEC,
  buildContentPrompt,
  contentGateOf,
  isChannelProject,
  normReview,
  type ContentDecision,
} from "../contentGate.js";
import { resolveTrimSource } from "../jobs/autoTrim.js";
import {
  DEFAULT_INSERT_RULES,
  INSERT_DISPLAYS,
  INSERT_KINDS,
  INSERT_TRANSITIONS,
  MOTION_TEMPLATES,
  listProjectAssets,
  normStepGates,
  projectDirOf,
  projectExists,
  readMeta,
  writeMeta,
  type InsertMeta,
  type InsertRules,
  type InsertTransition,
  type ProjectMeta,
  type SfxMeta,
} from "../meta.js";
import { queue } from "../queue.js";
import {
  DEFAULT_SOUND,
  SOUND_MODES,
  applySound,
  musicOptions,
  normSound,
  soundGateOf,
  suggestCues,
  suggestSections,
  type SoundGate,
} from "../soundGate.js";
import { HttpError, ensureDir, ffprobeDurationMs, nowIso } from "../util.js";

/**
 * Luồng DUYỆT TỪNG BƯỚC - Bước 2 "Minh họa".
 *
 *   GET  /api/projects/:id/steps/illustrate          -> IllustrateState
 *   PUT  /api/projects/:id/steps/illustrate          { inserts, rules } -> IllustrateState
 *   POST /api/projects/:id/steps/illustrate/suggest  -> IllustrateState (AI đề xuất)
 *   POST /api/projects/:id/steps/illustrate/draft    { force? } -> 202 { job }
 *
 * Danh sách minh họa là DỮ LIỆU CÓ CẤU TRÚC trong meta.json (`inserts`), người
 * dùng sửa từng field trên web. AI chỉ đề xuất danh sách ban đầu; dựng draft là
 * việc tất định của server + Remotion, không có agent nào chen vào - đó là cách
 * duy nhất để "sửa bước nào chỉ bước đó chạy lại".
 */

const router = Router();

const SFX_DIR = path.join(repoRoot, "assets", "sound-effects");
const SFX_LIBRARY = path.join(SFX_DIR, "library.json");

interface Segment {
  i: number;
  start: number;
  end: number;
  text: string;
}

interface StepBase {
  /** Tính từ thư mục project */
  videoRel: string;
  /** Video GỐC mà bản cắt sinh ra từ đó - không được đem làm b-roll của chính nó */
  sourceRel: string | null;
  transcriptRel: string | null;
  durationSec: number;
  segments: Segment[];
}

const posixRel = (from: string, to: string) => path.relative(from, to).split(path.sep).join("/");

function readJson(abs: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch {
    return null;
  }
}

function segmentsOf(json: unknown): Segment[] {
  const raw = Array.isArray(json)
    ? json
    : json && typeof json === "object" && Array.isArray((json as { segments?: unknown }).segments)
      ? ((json as { segments: unknown[] }).segments)
      : [];
  const out: Segment[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const r = s as Record<string, unknown>;
    if (typeof r.start !== "number" || typeof r.end !== "number") continue;
    out.push({ i: out.length, start: r.start, end: r.end, text: String(r.text ?? "").trim() });
  }
  return out;
}

/**
 * Video NỀN của luồng từng bước: bản đã cắt ở Bước 1 nếu còn file, không thì
 * video gốc. Transcript đi theo đúng hệ thời gian của video nền.
 */
async function stepBase(id: string): Promise<StepBase> {
  const dir = projectDirOf(id);
  const report = readJson(path.join(dir, "assets", "auto-trim-report.json")) as {
    output?: string | null;
    source?: string;
  } | null;

  // Báo cáo của project nhân bản vẫn trỏ về file của project GỐC - chỉ tin đường
  // dẫn nằm trong chính project này (staging của Remotion cũng từ chối file ngoài)
  const inside = (rel: string | null | undefined): string | null => {
    if (!rel) return null;
    const abs = path.resolve(repoRoot, rel);
    return abs.startsWith(path.resolve(dir) + path.sep) && fs.existsSync(abs) ? abs : null;
  };
  let videoAbs: string | null = null;
  let transcriptRel: string | null = null;
  const cutAbs = inside(report?.output);
  const srcAbs = inside(report?.source);
  if (cutAbs) {
    videoAbs = cutAbs;
    if (fs.existsSync(path.join(dir, "assets", "transcript.cut.json"))) transcriptRel = "assets/transcript.cut.json";
  } else {
    try {
      videoAbs = srcAbs ?? resolveTrimSource(id, null);
    } catch {
      videoAbs = null;
    }
    for (const rel of ["assets/transcript.raw.json", "assets/transcript.json"]) {
      if (fs.existsSync(path.join(dir, rel))) {
        transcriptRel = rel;
        break;
      }
    }
  }
  if (!videoAbs) {
    throw new HttpError(404, "NO_BASE_VIDEO", "Project chưa có video - làm Bước 0 và Bước 1 trước");
  }
  const tjson = transcriptRel ? readJson(path.join(dir, transcriptRel)) : null;
  const segments = segmentsOf(tjson);
  const ms = await ffprobeDurationMs(videoAbs);
  const tDur =
    tjson && typeof tjson === "object" && typeof (tjson as { duration?: unknown }).duration === "number"
      ? (tjson as { duration: number }).duration
      : (segments.at(-1)?.end ?? 0);
  return {
    videoRel: posixRel(dir, videoAbs),
    sourceRel: srcAbs ? posixRel(dir, srcAbs) : null,
    transcriptRel,
    durationSec: ms ? ms / 1000 : tDur,
    segments,
  };
}

interface SfxOption {
  file: string;
  tags: string[];
  description: string;
}

/** SFX hợp làm âm thanh chuyển cảnh/hiện minh họa - chỉ file còn trên đĩa. */
function sfxOptions(): SfxOption[] {
  const lib = readJson(SFX_LIBRARY);
  if (!Array.isArray(lib)) return [];
  const want = new Set(["transition", "swoosh", "pop", "reveal", "ui", "hay-dung"]);
  return lib
    .filter((e): e is { file: string; tags?: string[]; description?: string } => !!e && typeof e.file === "string")
    .filter((e) => (e.tags ?? []).some((t) => want.has(t)))
    .filter((e) => fs.existsSync(path.join(SFX_DIR, e.file)))
    .slice(0, 40)
    .map((e) => ({ file: e.file, tags: e.tags ?? [], description: e.description ?? "" }));
}

function sfxExists(file: string): boolean {
  return path.basename(file) === file && fs.existsSync(path.join(SFX_DIR, file));
}

/** File có thể dùng làm b-roll/ảnh: mọi video/ảnh trong assets/ trừ video nền, bản gốc, bản cắt. */
function mediaFiles(id: string, base: StepBase) {
  const dir = projectDirOf(id);
  return listProjectAssets(id)
    .filter((f) => f.kind === "video" || f.kind === "image")
    .map((f) => ({
      rel: posixRel(dir, path.join(repoRoot, f.relPath)),
      name: f.name,
      kind: f.kind as "video" | "image",
      description: (f as { description?: string }).description ?? "",
    }))
    .filter(
      (f) =>
        f.rel !== base.videoRel &&
        f.rel !== base.sourceRel &&
        !/\.cut\./.test(f.name) &&
        !f.rel.startsWith("assets/sfx/"),
    );
}

// ------------------------------- Chuẩn hóa -------------------------------

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;

function safeProjectRel(id: string, v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const rel = v.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  const dir = projectDirOf(id);
  const abs = path.resolve(dir, rel);
  if (!abs.startsWith(path.resolve(dir) + path.sep)) return null;
  return posixRel(dir, abs);
}

function normRules(raw: unknown): InsertRules {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pct = num(r.maxCoverPct);
  const sfx = typeof r.defaultSfx === "string" && sfxExists(r.defaultSfx) ? r.defaultSfx : null;
  return {
    maxCoverPct: Number.isFinite(pct) ? Math.min(100, Math.max(0, Math.round(pct))) : DEFAULT_INSERT_RULES.maxCoverPct,
    defaultTransition: pick(r.defaultTransition, INSERT_TRANSITIONS, DEFAULT_INSERT_RULES.defaultTransition),
    defaultSfx: r.defaultSfx === undefined ? DEFAULT_INSERT_RULES.defaultSfx : sfx,
  };
}

function normInsert(
  id: string,
  raw: unknown,
  base: StepBase,
  rules: InsertRules,
  origin: InsertMeta["origin"],
): InsertMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const dur = base.durationSec || Infinity;
  let start = num(r.start);
  let end = num(r.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  start = Math.max(0, Math.min(start, dur));
  end = Math.max(0, Math.min(end, dur, start + 20));
  if (end - start < 0.3) return null;

  const kind = pick(r.kind, INSERT_KINDS, "motion");
  const segIdx = num(r.segment ?? (r.anchor as { segment?: unknown } | null)?.segment);
  const seg =
    Number.isInteger(segIdx) && base.segments[segIdx]
      ? base.segments[segIdx]
      : base.segments.find((s) => start >= s.start - 0.05 && start < s.end) ?? null;

  const sfxRaw = r.sfx;
  let sfx: InsertMeta["sfx"] = null;
  if (typeof sfxRaw === "string" && sfxExists(sfxRaw)) sfx = { file: sfxRaw, volume: 0.4 };
  else if (sfxRaw && typeof sfxRaw === "object") {
    const s = sfxRaw as Record<string, unknown>;
    const vol = num(s.volume);
    if (typeof s.file === "string" && sfxExists(s.file)) {
      sfx = { file: s.file, volume: Number.isFinite(vol) ? Math.min(1, Math.max(0, vol)) : 0.4 };
    }
  }

  let motion: InsertMeta["motion"] = null;
  if (kind === "motion") {
    const m = (r.motion && typeof r.motion === "object" ? r.motion : {}) as Record<string, unknown>;
    motion = {
      template: pick(m.template, MOTION_TEMPLATES, "chapter"),
      title: str(m.title, 80),
      value: str(m.value, 24),
      label: str(m.label, 60),
      items: Array.isArray(m.items) ? m.items.map((x) => str(x, 60)).filter(Boolean).slice(0, 6) : [],
    };
  }
  const ms = num(r.mediaStart);

  return {
    id: typeof r.id === "string" && /^[\w-]{1,40}$/.test(r.id) ? r.id : `ins_${nanoid(8)}`,
    anchor: seg ? { segment: seg.i, text: seg.text } : null,
    kind,
    start: Math.round(start * 100) / 100,
    end: Math.round(end * 100) / 100,
    display: pick(r.display, INSERT_DISPLAYS, "full"),
    src: kind === "motion" ? null : safeProjectRel(id, r.src),
    mediaStart: Number.isFinite(ms) && ms >= 0 ? ms : 0,
    transitionIn: pick(r.transitionIn, INSERT_TRANSITIONS, rules.defaultTransition),
    transitionOut: pick(r.transitionOut, INSERT_TRANSITIONS, rules.defaultTransition),
    sfx,
    credit: str(r.credit, 80),
    motion,
    note: str(r.note, 240),
    origin: r.origin === "ai" || r.origin === "user" ? r.origin : origin,
  };
}

async function stateOf(id: string, meta: ProjectMeta = readMeta(id)) {
  const base = await stepBase(id);
  return {
    base: { video: base.videoRel, transcript: base.transcriptRel, durationSec: base.durationSec },
    segments: base.segments,
    inserts: meta.inserts ?? [],
    rules: meta.insertRules ?? DEFAULT_INSERT_RULES,
    files: mediaFiles(id, base),
    sfx: sfxOptions(),
    flow: meta.flow ?? null,
  };
}

function assertProject(id: string): void {
  if (!projectExists(id)) throw new HttpError(404, "PROJECT_NOT_FOUND", `Không tìm thấy project "${id}"`);
}

// --------------------------------- Routes ---------------------------------

router.get("/:id/steps/illustrate", async (req, res) => {
  assertProject(req.params.id);
  res.json(await stateOf(req.params.id));
});

router.put("/:id/steps/illustrate", async (req, res) => {
  const id = req.params.id;
  assertProject(id);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const base = await stepBase(id);
  const meta = readMeta(id);
  const rules = "rules" in body ? normRules(body.rules) : (meta.insertRules ?? DEFAULT_INSERT_RULES);
  if (body.inserts !== undefined && !Array.isArray(body.inserts)) {
    throw new HttpError(400, "INVALID_INSERTS", "inserts phải là mảng");
  }
  if (Array.isArray(body.inserts)) {
    meta.inserts = (body.inserts as unknown[])
      .map((x) => normInsert(id, x, base, rules, "user"))
      .filter((x): x is InsertMeta => x !== null)
      .sort((a, b) => a.start - b.start);
  }
  meta.insertRules = rules;
  writeMeta(id, meta);
  res.json(await stateOf(id, meta));
});

router.post("/:id/steps/illustrate/suggest", async (req, res) => {
  const id = req.params.id;
  assertProject(id);
  const base = await stepBase(id);
  if (base.segments.length === 0) {
    throw new HttpError(409, "NO_TRANSCRIPT", "Chưa có lời thoại - bóc lời ở Bước 1 trước");
  }
  const meta = readMeta(id);
  const rules = meta.insertRules ?? DEFAULT_INSERT_RULES;
  const files = mediaFiles(id, base);
  const sfx = sfxOptions();

  const prompt = buildSuggestPrompt(base, rules, files, sfx, openingRule(meta));
  const ai = await generateText({ prompt, usageTag: "steps-illustrate", projectId: id, timeoutMs: 3 * 60_000 });
  const parsed = extractJson<{ items?: unknown }>(ai.text);
  const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : null;
  if (!items) {
    throw new HttpError(502, "SUGGEST_PARSE_FAILED", `AI không trả về JSON hợp lệ. 200 ký tự đầu: ${ai.text.slice(0, 200)}`);
  }
  const suggested = (items as unknown[])
    .map((x) => normInsert(id, { ...(x as object), origin: "ai", id: undefined }, base, rules, "ai"))
    .filter((x): x is InsertMeta => x !== null);

  // Giữ mọi minh họa NGƯỜI DÙNG đã sửa/tự thêm; chỉ thay phần AI đề xuất cũ.
  // Đề xuất mới nào đè lên một minh họa của người dùng thì bỏ.
  const mine = (meta.inserts ?? []).filter((x) => x.origin === "user");
  const overlaps = (a: InsertMeta, b: InsertMeta) => a.start < b.end && b.start < a.end;
  meta.inserts = [...mine, ...suggested.filter((s) => !mine.some((m) => overlaps(m, s)))].sort(
    (a, b) => a.start - b.start,
  );
  meta.insertRules = rules;
  writeMeta(id, meta);
  res.json(await stateOf(id, meta));
});

router.post("/:id/steps/illustrate/draft", async (req, res) => {
  const id = req.params.id;
  assertProject(id);
  const force = (req.body as { force?: unknown } | undefined)?.force === true;
  if (db.hasActiveJobForProject(id)) {
    throw new HttpError(409, "BUSY", `Project "${id}" đang có job chạy/chờ trong hàng đợi`);
  }
  const base = await stepBase(id);
  const meta = readMeta(id);
  const dir = projectDirOf(id);

  // Project dựng bằng luồng cũ: timeline (scene, chữ, sfx, nhạc) do agent ghi
  // theo hệ thời gian KHÁC. Ghi đè phải được người dùng đồng ý một lần.
  const switching = meta.flow !== "steps";
  const sameScene =
    (meta.scenes ?? []).length === 1 && meta.scenes?.[0]?.srcVideo === base.videoRel;
  if (switching && (meta.scenes ?? []).length > 0 && !sameScene && !force) {
    throw new HttpError(
      409,
      "OLD_FLOW_TIMELINE",
      "Project này đã có timeline do luồng cũ (AI tự dựng) tạo. Dựng draft theo từng bước sẽ thay timeline đó - gửi lại với force: true nếu đồng ý.",
    );
  }

  meta.flow = "steps";
  meta.scenes = [
    { id: "main", srcVideo: base.videoRel, from: 0, to: Math.round(base.durationSec * 100) / 100 },
  ];
  const audio = (meta.audio ??= { sfx: [] });
  if (switching) {
    // Chữ / sfx / nhạc của luồng cũ neo theo timeline cũ - giữ lại là lệch
    for (const k of ["captions", "overlays", "subtitles"]) meta[k] = [];
    delete meta.tryoh;
    audio.sfx = [];
    audio.music = null;
    audio.voice = null;
  }
  // Đã duyệt bước Âm thanh: nhạc + mọi SFX lấy từ đó (dựng lại không mất lựa chọn)
  const sound = soundGateOf(meta);
  if (sound) {
    applySound(meta, sound, base.transcriptRel ? readJson(path.join(dir, base.transcriptRel)) : null);
  } else {
    // SFX của minh họa: chép vào assets/sfx/ (Remotion chỉ stage file trong project)
    const keep = (audio.sfx ?? []).filter((s) => s.owner !== "insert");
    const mine: SfxMeta[] = [];
    for (const ins of meta.inserts ?? []) {
      if (!ins.sfx || !sfxExists(ins.sfx.file)) continue;
      if (ins.kind !== "motion" && !ins.src) continue;
      const dst = path.join(dir, "assets", "sfx", ins.sfx.file);
      if (!fs.existsSync(dst)) {
        ensureDir(path.dirname(dst));
        fs.copyFileSync(path.join(SFX_DIR, ins.sfx.file), dst);
      }
      mine.push({
        file: `assets/sfx/${ins.sfx.file}`,
        atFrame: Math.max(0, Math.round(ins.start * meta.fps)),
        volume: ins.sfx.volume,
        owner: "insert",
      });
    }
    audio.sfx = [...keep, ...mine];
  }
  writeMeta(id, meta);

  const job = db.createJob({ id: `job_${nanoid()}`, projectId: id, type: "assemble-draft" });
  const api = db.jobToApi(job);
  broadcast("job", api);
  queue.enqueue(job.id);
  res.status(202).json({ job: api });
});

// ------------------------- Duyệt 1 · Nội dung -------------------------
//
//   GET  /api/projects/:id/steps/content          -> ContentState
//   POST /api/projects/:id/steps/content/analyze  -> ContentState (AI chấm câu móc, đếm ý)
//   PUT  /api/projects/:id/steps/content          { decision } -> ContentState
//
// Quyết định cảnh wow 0–3s được ghi thành một minh họa người dùng (id cố định)
// trong meta.inserts, nên Duyệt 2 thấy và sửa được như mọi minh họa khác.

async function contentStateOf(id: string, meta: ProjectMeta = readMeta(id)) {
  const base = await stepBase(id);
  const gate = contentGateOf(meta);
  return {
    ...gate,
    formulas: HOOK_FORMULAS,
    channel: isChannelProject(meta) ? { skill: CHANNEL_SKILL, hashtags: FIXED_HASHTAGS, maxExtra: MAX_EXTRA_HASHTAGS } : null,
    durationSec: base.durationSec,
    hasTranscript: base.segments.length > 0,
    files: mediaFiles(id, base),
  };
}

router.get("/:id/steps/content", async (req, res) => {
  assertProject(req.params.id);
  res.json(await contentStateOf(req.params.id));
});

router.post("/:id/steps/content/analyze", async (req, res) => {
  const id = req.params.id;
  assertProject(id);
  const base = await stepBase(id);
  if (base.segments.length === 0) {
    throw new HttpError(409, "NO_TRANSCRIPT", "Chưa có lời thoại - bóc lời trước khi chấm nội dung");
  }
  const ai = await generateText({
    prompt: buildContentPrompt(base.segments, base.durationSec),
    usageTag: "steps-content",
    projectId: id,
    timeoutMs: 3 * 60_000,
  });
  const parsed = extractJson(ai.text);
  if (!parsed || typeof parsed !== "object") {
    throw new HttpError(502, "CONTENT_PARSE_FAILED", `AI không trả về JSON hợp lệ. 200 ký tự đầu: ${ai.text.slice(0, 200)}`);
  }
  const meta = readMeta(id);
  const gate = contentGateOf(meta);
  meta.contentGate = { ...gate, review: normReview(parsed, base.segments, base.durationSec, nowIso()) };
  writeMeta(id, meta);
  res.json(await contentStateOf(id, meta));
});

router.put("/:id/steps/content", async (req, res) => {
  const id = req.params.id;
  assertProject(id);
  const raw = ((req.body ?? {}) as { decision?: unknown }).decision;
  if (!raw || typeof raw !== "object") throw new HttpError(400, "INVALID_DECISION", "Thiếu decision");
  const d = raw as Record<string, unknown>;
  const base = await stepBase(id);
  const meta = readMeta(id);
  const gate = contentGateOf(meta);

  let wow: ContentDecision["wow"] = gate.decision.wow;
  if ("wow" in d) {
    wow = null;
    const w = d.wow && typeof d.wow === "object" ? (d.wow as Record<string, unknown>) : null;
    if (w) {
      const src = safeProjectRel(id, w.src);
      if (!src || !mediaFiles(id, base).some((f) => f.rel === src)) {
        throw new HttpError(400, "INVALID_WOW_SRC", "Cảnh wow phải là video/ảnh nằm trong assets của project");
      }
      const ms = num(w.mediaStart);
      wow = { src, mediaStart: Number.isFinite(ms) && ms >= 0 ? ms : 0 };
    }
  }
  const decision: ContentDecision = {
    splitParts:
      "splitParts" in d ? (typeof d.splitParts === "boolean" ? d.splitParts : null) : gate.decision.splitParts,
    title: "title" in d ? str(d.title, 120) : gate.decision.title,
    wow,
  };
  meta.contentGate = { ...gate, decision };

  // Cảnh wow ↔ minh họa mở đầu. Bỏ cả minh họa nào đè lên 0–3s để không chồng nhau.
  const others = (meta.inserts ?? []).filter((x) => x.id !== WOW_INSERT_ID);
  if (wow) {
    const end = Math.min(WOW_SEC, base.durationSec || WOW_SEC);
    const isImage = mediaFiles(id, base).find((f) => f.rel === wow.src)?.kind === "image";
    const ins = normInsert(
      id,
      {
        id: WOW_INSERT_ID,
        start: 0,
        end,
        kind: isImage ? "image" : "video",
        display: "full",
        src: wow.src,
        mediaStart: wow.mediaStart,
        transitionIn: "cut",
        transitionOut: "fade",
        note: "Cảnh wow 0–3 giây (chọn ở Duyệt 1) - không mở bằng mặt người nói",
      },
      base,
      meta.insertRules ?? DEFAULT_INSERT_RULES,
      "user",
    );
    meta.inserts = [...(ins ? [ins] : []), ...others.filter((x) => x.start >= end)].sort((a, b) => a.start - b.start);
  } else {
    meta.inserts = others;
  }
  writeMeta(id, meta);
  res.json(await contentStateOf(id, meta));
});

// --------------------------------- Prompt ---------------------------------

/**
 * Luật 0–3 giây cho AI đề xuất minh họa. Đã chọn cảnh wow ở Duyệt 1 → không đụng
 * vào. Kênh TikTok của Trí cấm mở bằng mặt người nói (guideline mục 6).
 */
function openingRule(meta: ProjectMeta): string {
  if ((meta.inserts ?? []).some((x) => x.id === WOW_INSERT_ID)) {
    return `0–${WOW_SEC} giây đầu đã có cảnh wow do người dùng chọn - không chèn gì trong khoảng đó.`;
  }
  if (isChannelProject(meta)) {
    return `0–${WOW_SEC} giây đầu PHẢI là một cảnh sự kiện thật (kind "video", display "full") phủ lên người nói - không mở bằng mặt người nói.`;
  }
  return "Không chèn trong 2 giây đầu (giữ mặt người nói), trừ khi câu mở đầu là một con số.";
}

function buildSuggestPrompt(
  base: StepBase,
  rules: InsertRules,
  files: ReturnType<typeof mediaFiles>,
  sfx: SfxOption[],
  opening: string,
): string {
  const lines = base.segments.map((s) => `[${s.i}] ${s.start.toFixed(1)}–${s.end.toFixed(1)}s: ${s.text}`);
  const fileLines = files.length
    ? files.map((f) => `- ${f.rel} (${f.kind === "video" ? "video" : "ảnh"})${f.description ? ` - ${f.description}` : ""}`)
    : ["(không có)"];
  const sfxLines = sfx.length
    ? sfx.map((s) => `- ${s.file} [${s.tags.join(", ")}] ${s.description}`)
    : ["(không có)"];
  return `Bạn là biên tập viên video ngắn dọc (TikTok/Reels) tiếng Việt. Đây là video người nói trước camera, quay ngẫu hứng không kịch bản, dài ${base.durationSec.toFixed(1)} giây (đã cắt khoảng lặng).
Nhiệm vụ: chọn những khoảnh khắc nên CHÈN MINH HỌA phủ lên người nói để người xem dễ hình dung hơn và đỡ chán.

LỜI NÓI (chỉ số câu, mốc giây trên video):
${lines.join("\n")}

FILE CÓ SẴN TRONG PROJECT (dùng được làm video/ảnh minh họa):
${fileLines.join("\n")}

MẪU MOTION GRAPHIC DỰNG SẴN (kind "motion"):
- counter: một con số nổi bật người nói nhắc tới. value = con số ĐÚNG như người nói ("26%", "12.000", "11,5 giờ"); title = số đó nói về cái gì (≤ 6 chữ); label = chú thích ngắn hoặc rỗng.
- chapter: người nói chuyển sang ý/phần mới. label = "PHẦN 1", "MẸO 2"…; title = tên ý ≤ 6 chữ.
- list: người nói liệt kê 2–5 thứ. title ≤ 6 chữ; items mỗi mục ≤ 5 chữ.
- cta: câu kêu gọi cuối video. title ≤ 8 chữ; label = chữ trên nút ≤ 4 chữ.

HIỆU ỨNG ÂM THANH ĐƯỢC DÙNG (ghi đúng tên file, hoặc null):
${sfxLines.join("\n")}

LUẬT:
1. Mỗi minh họa neo vào MỘT câu (segment). start/end nằm trong khoảng của câu đó (được lấn sang câu kế tối đa 1 giây). Dài 2–6 giây.
2. Tổng thời gian các minh họa ≤ ${rules.maxCoverPct}% thời lượng video. ${opening}
3. Chỉ dùng chữ/số ĐÚNG như người nói. Tuyệt đối không bịa số liệu.
4. Người nói nhắc tới vật/cảnh cụ thể mà có file khớp ở trên → kind "video" hoặc "image", src = đường dẫn file đó. Không có file khớp nhưng một cảnh quay thật sẽ giúp nhiều → kind "video", src null, note bắt đầu bằng "Cần file:" rồi mô tả ngắn cảnh nên quay/tải lên.
5. display: motion graphic dùng "full" hoặc "top"; video dùng "full"; ảnh sản phẩm/màn hình có thể "pip".
6. Hai minh họa không chồng nhau, cách nhau ≥ 1 giây.
7. Video dưới 2 phút: 3–7 minh họa. Ưu tiên chất lượng hơn số lượng.
8. transitionIn/transitionOut: "cut" | "fade" | "slide" | "zoom" (mặc định "${rules.defaultTransition}").
9. note: một câu tiếng Việt giải thích vì sao chèn ở đây.

Trả về DUY NHẤT một khối JSON, không giải thích gì thêm:
{"items":[{"segment":3,"start":12.4,"end":16.0,"kind":"motion","display":"full","src":null,"motion":{"template":"counter","title":"Thời lượng pin","value":"11,5 giờ","label":"","items":[]},"transitionIn":"fade","transitionOut":"fade","sfx":null,"note":"Người nói nhắc thời lượng pin - con số nên hiện to."}]}`;
}

// ------------------------- Trạng thái các cổng -------------------------
//
//   PUT /api/projects/:id/steps/gates  { approved: number[], stale: number[] } -> StepGates
//
// Lưu ở meta.stepGates để danh sách project hiện được tiến độ (và mở máy khác vẫn thấy).

router.put("/:id/steps/gates", (req, res) => {
  const id = req.params.id;
  assertProject(id);
  const gates = normStepGates(req.body);
  if (!gates) throw new HttpError(400, "INVALID_GATES", "Cần { approved: number[], stale: number[] }");
  const meta = readMeta(id);
  meta.stepGates = gates;
  writeMeta(id, meta);
  res.json(gates);
});

// ------------------------- Duyệt 3 · Âm thanh -------------------------
//
//   GET  /api/projects/:id/steps/sound          -> SoundState
//   PUT  /api/projects/:id/steps/sound          { mode, file, volume, duckVolume, sections, cues } -> SoundState
//   POST /api/projects/:id/steps/sound/suggest  -> SoundState (đoạn theo ý + SFX theo cảnh/thẻ chữ, giữ bài đã chọn)
//
// Lưu xong là ghi luôn vào timeline (audio.music | audio.musicSections, audio.sfx
// owner "sound"); dựng draft sau đó nghe được ngay.

function transcriptOf(id: string, base: StepBase): unknown {
  return base.transcriptRel ? readJson(path.join(projectDirOf(id), base.transcriptRel)) : null;
}

async function soundStateOf(id: string, meta: ProjectMeta = readMeta(id)) {
  const base = await stepBase(id);
  const saved = soundGateOf(meta);
  const gate: SoundGate = saved ?? {
    ...DEFAULT_SOUND,
    sections: suggestSections(meta, base.durationSec),
    cues: suggestCues(meta),
  };
  return {
    gate,
    saved: !!saved,
    modes: SOUND_MODES,
    durationSec: base.durationSec,
    music: musicOptions(id),
    sfx: sfxOptions(),
    brief: { musicMode: meta.brief?.musicMode ?? null, sfxMode: meta.brief?.sfxMode ?? null },
  };
}

router.get("/:id/steps/sound", async (req, res) => {
  assertProject(req.params.id);
  res.json(await soundStateOf(req.params.id));
});

router.put("/:id/steps/sound", async (req, res) => {
  const id = req.params.id;
  assertProject(id);
  const base = await stepBase(id);
  const meta = readMeta(id);
  const prev = soundGateOf(meta) ?? {
    ...DEFAULT_SOUND,
    sections: suggestSections(meta, base.durationSec),
    cues: suggestCues(meta),
  };
  const gate = normSound(id, req.body, base.durationSec, prev);
  if (gate.mode === "whole" && !gate.file) {
    throw new HttpError(400, "NO_MUSIC_FILE", "Chọn bài nhạc cho cả video, hoặc chọn \"Không nhạc\"");
  }
  meta.soundGate = gate;
  applySound(meta, gate, transcriptOf(id, base));
  writeMeta(id, meta);
  res.json(await soundStateOf(id, meta));
});

router.post("/:id/steps/sound/suggest", async (req, res) => {
  const id = req.params.id;
  assertProject(id);
  const base = await stepBase(id);
  const meta = readMeta(id);
  const prev = soundGateOf(meta) ?? DEFAULT_SOUND;
  // Giữ bài đã gán cho đoạn trùng mốc bắt đầu; điểm SFX gợi ý lại từ đầu
  const sections = suggestSections(meta, base.durationSec).map((s) => ({
    ...s,
    file: prev.sections.find((p) => Math.abs(p.start - s.start) < 0.3)?.file ?? null,
  }));
  const gate: SoundGate = { ...prev, sections, cues: suggestCues(meta), updatedAt: new Date().toISOString() };
  meta.soundGate = gate;
  applySound(meta, gate, transcriptOf(id, base));
  writeMeta(id, meta);
  res.json(await soundStateOf(id, meta));
});

export default router;
