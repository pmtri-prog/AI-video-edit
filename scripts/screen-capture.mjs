#!/usr/bin/env node
/**
 * Quay màn hình một trang web thành clip dọc 1080x1920 làm cảnh trám.
 *
 *   node scripts/screen-capture.mjs <request.json> <out.mp4>
 *
 * Do job "screen-capture" của render queue gọi (apps/server/src/jobs/screenCapture.ts),
 * request đã qua kiểm tra ở route:
 *   { url, focusText?, endText?, seconds, blurSelectors?, allowedHosts }
 *
 * Không dùng recordVideo của Playwright: nó ghi theo pixel CSS nên trang mobile
 * chỉ chiếm một góc khung, phần còn lại xám. Thay vào đó chụp TỪNG KHUNG ở
 * deviceScaleFactor 2 (540x960 CSS = 1080x1920 thật) rồi đẩy thẳng vào FFmpeg -
 * nét, và chạy lại ra y hệt. Dùng Chrome đã cài trên máy (channel "chrome").
 *
 * Route chỉ kiểm được URL đầu. Redirect 30x, meta refresh hay `location=` có thể
 * đưa trang sang host khác (localhost, máy trong LAN...) - nên script tự kiểm
 * host của MỌI lần điều hướng khung chính và dừng ngay nếu ra ngoài danh sách.
 */
import fs from "node:fs";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const FPS = 30;
const VIEW = { width: 540, height: 960 };

const [reqPath, outPath] = process.argv.slice(2);
if (!reqPath || !outPath) {
  console.error("Cách dùng: node scripts/screen-capture.mjs <request.json> <out.mp4>");
  process.exit(1);
}
const req = JSON.parse(fs.readFileSync(reqPath, "utf8"));
const seconds = Math.min(15, Math.max(2, Number(req.seconds) || 4));
const total = Math.round(seconds * FPS);
const hosts = (req.allowedHosts ?? []).map((h) => String(h).toLowerCase());

/** Chỉ https và đúng host/tên miền con trong danh sách - about:blank là trang trắng ban đầu */
const allowed = (u) => {
  if (u === "about:blank") return true;
  try {
    const x = new URL(u);
    const h = x.hostname.toLowerCase();
    return x.protocol === "https:" && hosts.some((a) => h === a || h.endsWith(`.${a}`));
  } catch {
    return false;
  }
};

/** easeInOutCubic - cuộn mượt đầu và cuối */
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const browser = await chromium.launch({ channel: "chrome" });
let ff = null;
let offsite = null;
try {
  const page = await browser.newPage({
    viewport: VIEW,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "vi-VN",
  });
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame() && !allowed(f.url())) offsite ??= f.url();
  });
  const assertOnsite = () => {
    if (offsite || !allowed(page.url())) {
      throw new Error(`Trang chuyển sang địa chỉ ngoài danh sách cho phép: ${offsite ?? page.url()}`);
    }
  };

  // "load" thay vì "networkidle": trang có analytics/chat không bao giờ rảnh mạng
  const resp = await page.goto(req.url, { waitUntil: "load", timeout: 60_000 });
  for (let r = resp?.request(); r; r = r.redirectedFrom()) {
    if (!allowed(r.url())) offsite ??= r.url();
  }
  assertOnsite();
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

  // Cuộn tức thời theo từng khung, không để smooth-scroll của trang chen vào
  const blur = (req.blurSelectors ?? []).map((s) => `${s}{filter:blur(14px)!important}`).join("");
  await page.addStyleTag({ content: `html{scroll-behavior:auto!important}${blur}` });

  // Ảnh lazy-load chỉ tải khi lọt vào màn hình - cuộn một lượt cho tải hết trước khi quay
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
  assertOnsite();

  // Khoảng cuộn: focusText → endText; chỉ focusText thì trôi nhẹ quanh nó; không có gì thì đi hết trang
  const [from, to] = await page.evaluate(({ focusText, endText, vh }) => {
    // Phần tử SÂU NHẤT đang hiện (có kích thước) chứa đoạn chữ - chữ bị chẻ bởi <b>/<a> vẫn khớp
    const find = (t) => {
      let best = null;
      for (const e of document.querySelectorAll("body *")) {
        const r = e.getBoundingClientRect();
        if (r.width && r.height && (e.innerText || "").includes(t)) best = e;
      }
      return best;
    };
    const yOf = (t) => {
      const el = find(t);
      if (!el) throw new Error(`Không thấy chữ "${t}" trên trang`);
      return el.getBoundingClientRect().top + scrollY - vh * 0.3;
    };
    const max = document.documentElement.scrollHeight - innerHeight;
    const clamp = (y) => Math.max(0, Math.min(max, y));
    if (!focusText) return [0, max];
    const a = clamp(yOf(focusText));
    return [a, clamp(endText ? yOf(endText) : a + vh * 0.25)];
  }, { focusText: req.focusText || "", endText: req.endText || "", vh: VIEW.height });

  ff = spawn("ffmpeg", [
    "-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-vf", "scale=1080:1920,format=yuv420p", "-c:v", "libx264", "-crf", "18",
    "-preset", "veryfast", "-movflags", "+faststart", outPath,
  ]);
  ff.stdin.on("error", () => {}); // EPIPE khi ffmpeg chết sớm - lỗi thật đi qua ffDone
  const ffDone = new Promise((resolve, reject) => {
    ff.on("error", reject);
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg thoát mã ${code}`))));
  });
  ffDone.catch(() => {}); // tránh unhandledRejection khi lỗi xảy ra trước lúc await

  // 15% đầu đứng yên cho người xem kịp nhìn, phần còn lại cuộn
  const hold = Math.round(total * 0.15);
  for (let f = 0; f < total; f++) {
    const x = f < hold ? 0 : (f - hold) / Math.max(1, total - hold - 1);
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(from + (to - from) * ease(x)));
    assertOnsite();
    const jpg = await page.screenshot({ type: "jpeg", quality: 90 });
    if (!ff.stdin.write(jpg)) await Promise.race([once(ff.stdin, "drain"), ffDone]);
    if (f % 15 === 0) console.log(`progress ${f}/${total}`);
  }
  ff.stdin.end();
  await ffDone;
  console.log(`progress ${total}/${total}`);
  console.log(`Đã quay ${seconds}s (${total} khung), cuộn ${Math.round(from)}→${Math.round(to)}px: ${outPath}`);
} catch (err) {
  ff?.kill("SIGKILL");
  fs.rmSync(outPath, { force: true }); // không để lại clip dở
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
} finally {
  await browser.close();
}
