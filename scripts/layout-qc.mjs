#!/usr/bin/env node
/**
 * Soát bố cục một composition HyperFrames TRƯỚC khi render.
 *
 *   node scripts/layout-qc.mjs video-projects/<id> [--step 0.1] [--json]
 *   node scripts/layout-qc.mjs path/to/file.html        (một file composition bất kỳ)
 *
 * Mở index.html trong Chrome (Playwright), tua timeline GSAP qua từng mốc và đo
 * khung của mọi lớp CHỮ/THẺ đang hiện. Báo:
 *  - lọt khỏi vùng an toàn TikTok: trên 150px, dưới 400px, phải 140px (khung 1080x1920)
 *  - hai lớp đè lên nhau (vd thẻ chữ đè phụ đề, khung quay màn hình đè nhãn)
 *
 * Lớp nào được soát: phần tử có data-qc="ui". (Không dùng data-layer: HyperFrames đã bỏ
 * thuộc tính đó và `hyperframes lint` báo lỗi deprecated_data_layer.) Lớp nền phủ kín khung (video,
 * quay màn hình, motion graphic toàn khung) gắn data-qc="bg" - nó cố ý tràn
 * vùng an toàn và nằm dưới phụ đề nên không soát. Composition chưa gắn data-qc
 * thì lùi về soát .cue và .card (có cảnh báo).
 *
 * Mã thoát: 0 đạt, 2 có lỗi bố cục, 1 lỗi chạy. Nhanh: ~1s cho 10s video.
 */
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const step = Math.max(0.02, Number(args[args.indexOf("--step") + 1]) || 0.1);
const asJson = args.includes("--json");
if (!dir) {
  console.error("Cách dùng: node scripts/layout-qc.mjs video-projects/<id> [--step 0.1] [--json]");
  process.exit(1);
}
const file = dir.endsWith(".html") ? path.resolve(dir) : path.resolve(dir, "index.html");
if (!fs.existsSync(file)) {
  console.error(`Không thấy ${file}`);
  process.exit(1);
}

const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(pathToFileURL(file).href);
  // Timeline đăng ký theo composition id (chuẩn HyperFrames) - project cũ dùng "main"
  await page.waitForFunction(
    () => {
      const id = document.querySelector("[data-composition-id]")?.dataset.compositionId;
      const tls = window.__timelines || {};
      window.__qcTl = tls[id] ?? tls.main ?? Object.values(tls)[0];
      return !!window.__qcTl;
    },
    null,
    { polling: 100, timeout: 30_000 },
  );

  const setup = await page.evaluate(async () => {
    await document.fonts.ready; // đo trước khi font tải xong là đo sai kích thước chữ
    const root = document.querySelector("[data-composition-id]");
    const W = Number(root?.dataset.width) || 1080;
    const H = Number(root?.dataset.height) || 1920;
    const dur = Math.min(window.__qcTl.duration(), Number(root?.dataset.duration) || Infinity);
    const tagged = document.querySelectorAll('[data-qc="ui"]').length > 0;
    const subScenes = document.querySelectorAll("[data-composition-src]").length;
    return { W, H, dur, tagged, subScenes };
  });
  if (setup.W !== 1080 || setup.H !== 1920) await page.setViewportSize({ width: setup.W, height: setup.H });
  const sel = setup.tagged ? '[data-qc="ui"]' : ".cue, .card";
  // Vùng an toàn TikTok chỉ áp cho video dọc; video ngang chỉ soát tràn khung
  const vertical = setup.H > setup.W;
  const SAFE = vertical
    ? { top: 150, bottom: setup.H - 400, right: setup.W - 140 }
    : { top: 0, bottom: setup.H, right: setup.W };

  const issues = new Map(); // key → { from, to, msg }
  const note = (key, t, msg) => {
    const it = issues.get(key);
    if (it) it.to = t;
    else issues.set(key, { from: t, to: t, msg });
  };

  for (let t = 0; t <= setup.dur + 1e-6; t += step) {
    const boxes = await page.evaluate(
      ([t, sel]) => {
        window.__qcTl.seek(t, false);
        const visible = (el) => {
          let o = 1;
          for (let e = el; e && e !== document.body; e = e.parentElement) {
            const cs = getComputedStyle(e);
            if (cs.display === "none" || cs.visibility === "hidden") return false;
            o *= Number(cs.opacity);
          }
          return o > 0.05;
        };
        const els = [...document.querySelectorAll(sel)].filter(visible);
        return els.map((el) => {
          const r = el.getBoundingClientRect();
          return {
            name: el.id ? `#${el.id}` : `.${[...el.classList].join(".") || el.tagName.toLowerCase()}`,
            caption: el.classList.contains("cue"),
            idx: els.indexOf(el),
            parents: els.filter((p) => p !== el && p.contains(el)).map((p) => els.indexOf(p)),
            x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height,
          };
        }).filter((b) => b.w > 0 && b.h > 0);
      },
      [t, sel],
    );

    const ts = Math.round(t * 10) / 10;
    for (const b of boxes) {
      if (b.y < SAFE.top) note(`${b.name}:top`, ts, `${b.name} lọt vùng trên (y=${Math.round(b.y)} < ${SAFE.top})`);
      if (b.b > SAFE.bottom) note(`${b.name}:bottom`, ts, `${b.name} lọt vùng dưới (đáy=${Math.round(b.b)} > ${SAFE.bottom}, vùng caption/nút TikTok)`);
      if (b.r > SAFE.right) note(`${b.name}:right`, ts, `${b.name} tràn mép phải ${Math.round(b.r - SAFE.right)}px (nút like/comment che)`);
    }
    for (const a of boxes)
      for (const c of boxes) {
        if (a.idx >= c.idx || a.parents.includes(c.idx) || c.parents.includes(a.idx)) continue;
        const w = Math.min(a.r, c.r) - Math.max(a.x, c.x);
        const h = Math.min(a.b, c.b) - Math.max(a.y, c.y);
        if (w > 8 && h > 8) note(`${a.name}x${c.name}`, ts, `${a.name} đè lên ${c.name} (${Math.round(w)}×${Math.round(h)}px)`);
      }
  }

  const list = [...issues.values()];
  if (asJson) {
    console.log(JSON.stringify({ pass: list.length === 0, tagged: setup.tagged, subScenes: setup.subScenes, duration: setup.dur, issues: list }, null, 2));
  } else {
    console.log(`Soát bố cục ${path.basename(path.resolve(dir), ".html")}: ${setup.dur.toFixed(1)}s, mỗi ${step}s, lớp: ${sel}`);
    if (!setup.tagged) console.log('  Cảnh báo: chưa gắn data-qc="ui" - chỉ soát .cue và .card');
    if (setup.subScenes) console.log(`  Cảnh báo: ${setup.subScenes} cảnh con (data-composition-src) không được soát - chỉ soát lớp trong index.html`);
    if (!list.length) console.log("ĐẠT: không có lỗi bố cục");
    else {
      console.log(`CHƯA ĐẠT: ${list.length} lỗi`);
      for (const it of list) console.log(`  ${it.from.toFixed(1)}-${it.to.toFixed(1)}s  ${it.msg}`);
    }
  }
  process.exitCode = list.length ? 2 : 0;
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
} finally {
  await browser.close();
}
