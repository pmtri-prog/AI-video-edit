#!/usr/bin/env node
/**
 * Nhập bảng chỉ số cũ (2 file CSV) vào channel-stats/*.json của repo.
 *
 *   node scripts/import-channel-stats.mjs [thư-mục-chứa-csv]
 *
 * Mặc định: ~/Documents/TryOh chỉ số kênh video, cần hai file
 *   - chi-so-video-ngan.csv  (dòng đo: ngay_do, moc, ma_video, nen_tang, luot_xem...)
 *   - danh-sach-video.csv    (danh mục: ma_video, tieu_de, gia_tri = trụ cột, truc, tep...)
 *
 * Đi qua CHÍNH module kho dữ liệu của server (apps/server/src/channelStats.ts)
 * nên dùng đúng bộ kiểm tra như API. Chạy lại bao nhiêu lần cũng không trùng:
 * video upsert theo id, dòng đo upsert theo (video, nền tảng, mốc). Không đụng
 * vào lessons.json.
 *
 * Không nhập tên người bình luận hay dữ liệu cá nhân - CSV nguồn cũng không có.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = process.argv[2] || path.join(os.homedir(), "Documents", "TryOh chỉ số kênh video");

/** CSV có dấu ngoặc kép, dấu phẩy và xuống dòng trong ô. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v !== "")) rows.push(row);
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

function readCsv(name) {
  const file = path.join(srcDir, name);
  if (!fs.existsSync(file)) {
    console.error(`Không thấy ${file}`);
    process.exit(1);
  }
  return parseCsv(fs.readFileSync(file, "utf8"));
}

const numOrNull = (v) => {
  if (v === "" || v === undefined) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const PLATFORM = { TikTok: "tiktok", "FB Reels": "fb", "YT Shorts": "yt" };
const MILESTONE = { "24h": "24h", "7 ngày": "7d", "30 ngày": "30d" };

function statusOf(text) {
  if (/đã đăng/i.test(text)) return "posted";
  if (/đã dựng/i.test(text)) return "ready";
  return "idea";
}

// Nạp module TypeScript của server qua tsx (đã cài trong apps/server).
const requireFromServer = createRequire(path.join(repoRoot, "apps", "server", "package.json"));
const { register } = await import(pathToFileURL(requireFromServer.resolve("tsx/esm/api")).href);
register();
const store = await import(pathToFileURL(path.join(repoRoot, "apps", "server", "src", "channelStats.ts")).href);

const catalog = readCsv("danh-sach-video.csv");
const rows = readCsv("chi-so-video-ngan.csv");

// Ngày đăng nằm ở file đo, không có ở danh mục.
const postedAt = new Map();
for (const r of rows) if (r.ma_video && r.ngay_dang) postedAt.set(r.ma_video, r.ngay_dang);

let videoCount = 0;
for (const v of catalog) {
  if (!v.ma_video) continue;
  const pillar = Number.parseInt(v.gia_tri, 10);
  store.upsertVideo(v.ma_video, {
    title: v.tieu_de,
    durationSec: numOrNull(v.thoi_luong_s),
    pillar: [1, 2, 3].includes(pillar) ? pillar : null,
    axis: v.truc,
    audience: v.tep,
    status: statusOf(v.trang_thai),
    postedAt: postedAt.get(v.ma_video) ?? null,
    notes: v.ghi_chu,
  });
  videoCount++;
}

const known = new Set(catalog.map((v) => v.ma_video));
const measurements = [];
for (const r of rows) {
  if (!known.has(r.ma_video)) {
    console.warn(`Bỏ qua dòng đo của video không có trong danh mục: ${r.ma_video}`);
    continue;
  }
  // "Đo 21:45; ..." -> giữ giờ đo nếu ghi chú có, không thì chỉ ngày.
  const time = /Đo (\d{1,2}):(\d{2})/.exec(r.ghi_chu);
  const measuredAt = time
    ? `${r.ngay_do}T${time[1].padStart(2, "0")}:${time[2]}:00+07:00`
    : r.ngay_do;
  measurements.push({
    videoId: r.ma_video,
    platform: PLATFORM[r.nen_tang],
    milestone: MILESTONE[r.moc],
    measuredAt,
    views: numOrNull(r.luot_xem),
    avgWatchSec: numOrNull(r.xem_tb_s),
    fullWatch: numOrNull(r.xem_het),
    likes: numOrNull(r.thich),
    comments: numOrNull(r.binh_luan),
    shares: numOrNull(r.chia_se),
    saves: numOrNull(r.luu),
    newFollowers: numOrNull(r.follow_moi),
    pctFeed: numOrNull(r.pct_feed),
    pctSearch: numOrNull(r.pct_tim_kiem),
    notes: r.ghi_chu,
  });
}
if (measurements.length) store.upsertMeasurements(measurements);

console.log(`Đã nhập ${videoCount} video và ${measurements.length} dòng đo vào ${path.join(repoRoot, "channel-stats")}`);
