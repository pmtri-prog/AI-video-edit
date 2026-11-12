import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { paths, repoRoot } from "./config.js";
import { projectAssetsDirOf, readMeta } from "./meta.js";
import { HttpError, ensureDir, toKebabAscii, toRepoRel } from "./util.js";

/**
 * Kho TryOh - danh mục footage/ảnh sự kiện THẬT nằm trên Google Shared Drive.
 *
 * Vì sao chỉ là DANH MỤC chứ không phải bản sao: kho trên Drive lớn hơn nhiều so
 * với ổ máy, nên chỉ lưu tên/ID/sự kiện; clip nào cần cho video nào thì mới tải
 * (qua Chrome của người dùng - backend không có quyền đọc Drive) rồi ghi nhận
 * bằng `scripts/media-library-register.mjs`. Tag chi tiết (loại cảnh, lộ mặt)
 * cũng gắn DẦN khi clip được tải về và xem, không quét cả kho.
 *
 * File: apps/server/data/media-library/catalog.json (gitignore - dữ liệu của
 * người dùng). File đã tải: apps/server/data/media-library/files/<driveId><ext>.
 */

export type MediaKind = "video" | "image" | "other";
export type ShotType = "wide" | "crowd" | "hand" | "product" | "machine" | "screen" | "other";
/** none = không có người; far = người nhỏ/quay lưng; recognizable = nhận ra mặt */
export type FaceExposure = "none" | "far" | "recognizable";

export interface MediaTags {
  shot: ShotType | null;
  faces: FaceExposure | null;
  /** Mô tả ngắn cảnh quay - để AI chọn clip khớp lời nói */
  description: string;
  /** Brand/sản phẩm nhìn thấy trong khung (đối chiếu danh sách duyệt của guideline) */
  brands: string[];
  /**
   * Người dùng đã duyệt cho dùng. Clip lộ mặt khách mặc định KHÔNG duyệt -
   * AI không được lấy tới khi người dùng bật.
   */
  approved: boolean;
}

export interface MediaItem {
  id: string;
  title: string;
  mimeType: string;
  kind: MediaKind;
  /** Tên thư mục sự kiện cấp 1 trên Drive - dùng thẳng làm tag sự kiện */
  event: string;
  folderPath: string;
  createdTime?: string;
  modifiedTime?: string;
  viewUrl?: string;
  tags: MediaTags | null;
  /** Đường dẫn (tương đối repo) của bản đã tải; null = chưa tải */
  localPath: string | null;
  sha256?: string | null;
  durationSec?: number | null;
}

export interface MediaCatalog {
  source: { driveId: string; rootFolderId: string; rootName: string };
  listedAt: string;
  events: { name: string; folderId: string; fileCount: number }[];
  items: MediaItem[];
}

export const mediaLibraryDir = (): string => path.join(paths.dataDir, "media-library");
const catalogPath = (): string => path.join(mediaLibraryDir(), "catalog.json");
export const mediaFilesDir = (): string => path.join(mediaLibraryDir(), "files");

const SHOTS: ShotType[] = ["wide", "crowd", "hand", "product", "machine", "screen", "other"];
const FACES: FaceExposure[] = ["none", "far", "recognizable"];

/** Chưa lập danh mục -> catalog rỗng (không phải lỗi: kho là tính năng tùy chọn) */
export function readCatalog(): MediaCatalog {
  try {
    const raw = JSON.parse(fs.readFileSync(catalogPath(), "utf8")) as MediaCatalog;
    if (!raw || !Array.isArray(raw.items)) throw new Error("bad catalog");
    return raw;
  } catch {
    return {
      source: { driveId: "", rootFolderId: "", rootName: "" },
      listedAt: "",
      events: [],
      items: [],
    };
  }
}

/** Ghi qua file tạm rồi rename - catalog hỏng giữa chừng là mất cả danh mục */
export function writeCatalog(cat: MediaCatalog): void {
  ensureDir(mediaLibraryDir());
  const tmp = `${catalogPath()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cat, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, catalogPath());
}

export function getItem(cat: MediaCatalog, id: string): MediaItem {
  const item = cat.items.find((i) => i.id === id);
  if (!item) throw new HttpError(404, "MEDIA_NOT_FOUND", `Không có mục "${id}" trong Kho TryOh`);
  return item;
}

/** Bản đã tải còn trên đĩa không (người dùng có thể đã xóa để lấy chỗ) */
export function isDownloaded(item: MediaItem): boolean {
  return !!item.localPath && fs.existsSync(path.join(repoRoot, item.localPath));
}

export interface MediaQuery {
  event?: string;
  kind?: MediaKind;
  /** chỉ mục đã tải về máy */
  downloaded?: boolean;
  /** chỉ mục đã duyệt dùng */
  approved?: boolean;
  /** tìm trong tên file, sự kiện, mô tả, brand (không phân biệt hoa thường/dấu) */
  q?: string;
}

const fold = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

export function queryCatalog(cat: MediaCatalog, q: MediaQuery): MediaItem[] {
  const needle = q.q ? fold(q.q.trim()) : "";
  const eventNeedle = q.event ? fold(q.event.trim()) : "";
  return cat.items.filter((i) => {
    if (q.kind && i.kind !== q.kind) return false;
    if (eventNeedle && !fold(i.event).includes(eventNeedle)) return false;
    if (q.downloaded !== undefined && isDownloaded(i) !== q.downloaded) return false;
    if (q.approved !== undefined && (i.tags?.approved ?? false) !== q.approved) return false;
    if (needle) {
      const hay = fold(
        [i.title, i.event, i.folderPath, i.tags?.description ?? "", ...(i.tags?.brands ?? [])].join(" "),
      );
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

/** Validate patch tag từ client; trả tag mới đầy đủ */
export function applyTagPatch(cur: MediaTags | null, raw: unknown): MediaTags {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new HttpError(400, "INVALID_TAGS", "tags phải là object");
  }
  const b = raw as Record<string, unknown>;
  const next: MediaTags = cur
    ? { ...cur, brands: [...cur.brands] }
    : { shot: null, faces: null, description: "", brands: [], approved: false };
  if ("shot" in b) {
    if (b.shot !== null && !SHOTS.includes(b.shot as ShotType)) {
      throw new HttpError(400, "INVALID_TAGS", `shot phải là null hoặc: ${SHOTS.join(" | ")}`);
    }
    next.shot = b.shot as ShotType | null;
  }
  if ("faces" in b) {
    if (b.faces !== null && !FACES.includes(b.faces as FaceExposure)) {
      throw new HttpError(400, "INVALID_TAGS", `faces phải là null hoặc: ${FACES.join(" | ")}`);
    }
    next.faces = b.faces as FaceExposure | null;
  }
  if ("description" in b) {
    if (typeof b.description !== "string") throw new HttpError(400, "INVALID_TAGS", "description phải là string");
    next.description = b.description.trim().slice(0, 500);
  }
  if ("brands" in b) {
    if (!Array.isArray(b.brands) || !b.brands.every((x) => typeof x === "string")) {
      throw new HttpError(400, "INVALID_TAGS", "brands phải là mảng string");
    }
    next.brands = (b.brands as string[]).map((x) => x.trim()).filter(Boolean);
  }
  if ("approved" in b) {
    if (typeof b.approved !== "boolean") throw new HttpError(400, "INVALID_TAGS", "approved phải là boolean");
    next.approved = b.approved;
  }
  return next;
}

export function sha256File(abs: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    fs.createReadStream(abs)
      .on("error", reject)
      .on("data", (c) => h.update(c))
      .on("end", () => resolve(h.digest("hex")));
  });
}

/**
 * Chép bản đã tải của một mục vào `video-projects/<id>/assets/broll/` (Remotion
 * chỉ stage file NẰM TRONG project). Cùng hash đã có trong assets/ của project
 * thì trả lại file cũ - không bao giờ chép một clip hai lần (luật của skill).
 */
export async function stageToProject(item: MediaItem, projectId: string): Promise<{ relPath: string; reused: boolean }> {
  if (!item.localPath) {
    throw new HttpError(
      409,
      "MEDIA_NOT_DOWNLOADED",
      `"${item.title}" chưa tải về máy - tải qua Chrome rồi ghi nhận bằng scripts/media-library-register.mjs`,
    );
  }
  readMeta(projectId); // 400/404 nếu id sai hoặc project không tồn tại
  const src = path.join(repoRoot, item.localPath);
  if (!fs.existsSync(src)) {
    throw new HttpError(409, "MEDIA_NOT_DOWNLOADED", `Bản tải của "${item.title}" không còn trên đĩa: ${item.localPath}`);
  }
  const hash = item.sha256 ?? (await sha256File(src));
  const assetsDir = projectAssetsDirOf(projectId);
  const brollDir = path.join(assetsDir, "broll");

  // Đã có trong project (kể cả ở thư mục khác của assets/) -> dùng lại
  if (fs.existsSync(brollDir)) {
    for (const name of fs.readdirSync(brollDir)) {
      const abs = path.join(brollDir, name);
      if (fs.statSync(abs).isFile() && (await sha256File(abs)) === hash) {
        return { relPath: toRepoRel(abs), reused: true };
      }
    }
  }

  ensureDir(brollDir);
  const ext = path.extname(src).toLowerCase();
  const base = toKebabAscii(`${item.event} ${path.basename(item.title, path.extname(item.title))}`).slice(0, 60);
  const dst = path.join(brollDir, `${base || "broll"}-${item.id.slice(0, 6)}${ext}`);
  fs.copyFileSync(src, dst);
  return { relPath: toRepoRel(dst), reused: false };
}
