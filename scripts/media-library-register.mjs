#!/usr/bin/env node
/**
 * Ghi nhận một file vừa tải từ Google Drive vào Kho TryOh.
 *
 * Kho TryOh chỉ là DANH MỤC (apps/server/data/media-library/catalog.json) của
 * footage/ảnh trên Shared Drive. Backend không đọc được Drive, nên clip được tải
 * THEO NHU CẦU qua Chrome của người dùng (thường rơi vào ~/Downloads), rồi chạy
 * script này để:
 *   1. CHUYỂN file vào apps/server/data/media-library/files/<driveId><ext>
 *      (chuyển chứ không chép - ổ máy chật, không giữ hai bản),
 *   2. tính sha256 + thời lượng (ffprobe), ghi localPath vào danh mục.
 * Sau đó project mới lấy được clip qua POST /api/media-library/:id/stage.
 *
 * Cùng hash đã ghi nhận cho một mục khác (Drive có hai bản trùng) -> báo ra và
 * vẫn ghi cho mục này, nhưng trỏ về file đã có, xóa bản tải mới.
 *
 * Chạy:
 *   node scripts/media-library-register.mjs <driveFileId> <đường-dẫn-file-đã-tải>
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const libDir = path.join(repoRoot, "apps", "server", "data", "media-library");
const catalogPath = path.join(libDir, "catalog.json");
const filesDir = path.join(libDir, "files");

function die(msg) {
  console.error(`Lỗi: ${msg}`);
  process.exit(1);
}

const [id, rawFile] = process.argv.slice(2);
if (!id || !rawFile) die("cách dùng: node scripts/media-library-register.mjs <driveFileId> <file>");
const src = path.resolve(rawFile);
if (!fs.existsSync(src) || !fs.statSync(src).isFile()) die(`không thấy file "${src}"`);
if (!fs.existsSync(catalogPath)) die("chưa có danh mục Kho TryOh (catalog.json) - lập danh mục trước");

const cat = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const item = cat.items.find((i) => i.id === id);
if (!item) die(`không có mục "${id}" trong danh mục`);

/** Băm theo từng khúc 8MB - clip sự kiện có thể vài GB, đọc trọn vào RAM là treo máy */
function sha256(abs) {
  const h = crypto.createHash("sha256");
  const fd = fs.openSync(abs, "r");
  const buf = Buffer.alloc(8 * 1024 * 1024);
  try {
    for (let n; (n = fs.readSync(fd, buf, 0, buf.length, null)) > 0; ) h.update(buf.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return h.digest("hex");
}
const hash = sha256(src);
const toRel = (abs) => path.relative(repoRoot, abs).split(path.sep).join("/");

let dst;
const twin = cat.items.find((i) => i.id !== id && i.sha256 === hash && i.localPath && fs.existsSync(path.join(repoRoot, i.localPath)));
if (twin) {
  console.log(`Trùng nội dung với "${twin.title}" (${twin.id}) - dùng lại file đã có, bỏ bản tải mới.`);
  dst = path.join(repoRoot, twin.localPath);
  if (path.resolve(dst) !== src) fs.rmSync(src);
} else {
  fs.mkdirSync(filesDir, { recursive: true });
  const ext = (path.extname(item.title) || path.extname(src)).toLowerCase();
  dst = path.join(filesDir, `${id}${ext}`);
  if (src !== dst) {
    try {
      fs.renameSync(src, dst);
    } catch {
      // Khác ổ đĩa (vd tải về USB) -> chép rồi xóa
      fs.copyFileSync(src, dst);
      fs.rmSync(src);
    }
  }
}

let durationSec = null;
if (item.kind === "video") {
  try {
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dst], { encoding: "utf8" });
    const d = Number.parseFloat(out.trim());
    durationSec = Number.isFinite(d) ? Math.round(d * 100) / 100 : null;
  } catch {
    console.warn("Không đo được thời lượng (ffprobe lỗi hoặc không có trên PATH)");
  }
}

item.localPath = toRel(dst);
item.sha256 = hash;
if (durationSec !== null) item.durationSec = durationSec;

const tmp = `${catalogPath}.tmp`;
fs.writeFileSync(tmp, JSON.stringify(cat, null, 2) + "\n", "utf8");
fs.renameSync(tmp, catalogPath);
console.log(`Đã ghi nhận "${item.title}" [${item.event}] -> ${item.localPath}${durationSec ? ` (${durationSec}s)` : ""}`);
