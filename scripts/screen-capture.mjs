#!/usr/bin/env node
/**
 * Quay màn hình một trang web thành clip dọc 1080x1920 làm cảnh trám.
 *
 *   node scripts/screen-capture.mjs <request.json> <out.mp4>
 *
 * Do job "screen-capture" của render queue gọi (apps/server/src/jobs/screenCapture.ts),
 * request đã qua kiểm tra ở route: { url, focusText?, endText?, seconds, blurSelectors? }
 *
 * Không dùng recordVideo của Playwright: nó ghi theo pixel CSS nên trang mobile
 * chỉ chiếm một góc khung, phần còn lại xám. Thay vào đó chụp TỪNG KHUNG ở
 * deviceScaleFactor 2 (540x960 CSS = 1080x1920 thật) rồi đẩy thẳng vào FFmpeg -
 * nét, và chạy lại ra y hệt. Dùng Chrome đã cài trên máy (channel "chrome"),
 * không tải thêm trình duyệt.
 */
import fs from "node:fs";
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

/** easeInOutCubic - cuộn mượt đầu và cuối */
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const browser = await chromium.launch({ channel: "chrome" });
let ff;
try {
  const page = await browser.newPage({
    viewport: VIEW,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "vi-VN",
  });
  await page.goto(req.url, { waitUntil: "networkidle", timeout: 60_000 });
  // Cuộn tức thời theo từng khung, không để smooth-scroll của trang chen vào
  const blur = (req.blurSelectors ?? []).map((s) => `${s}{filter:blur(14px)!important}`).join("");
  await page.addStyleTag({ content: `html{scroll-behavior:auto!important}${blur}` });
  await page.waitForTimeout(500);

  // Khoảng cuộn: focusText → endText; chỉ focusText thì trôi nhẹ quanh nó; không có gì thì đi hết trang
  const [from, to] = await page.evaluate(({ focusText, endText, vh }) => {
    const find = (t) =>
      [...document.querySelectorAll("body *")].find(
        (e) => e.children.length === 0 && (e.textContent || "").includes(t),
      );
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
  const ffDone = new Promise((resolve, reject) => {
    ff.on("error", reject);
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg thoát mã ${code}`))));
  });

  // 15% đầu đứng yên cho người xem kịp nhìn, phần còn lại cuộn
  const hold = Math.round(total * 0.15);
  for (let f = 0; f < total; f++) {
    const x = f < hold ? 0 : (f - hold) / Math.max(1, total - hold - 1);
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(from + (to - from) * ease(x)));
    const jpg = await page.screenshot({ type: "jpeg", quality: 90 });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 15 === 0) console.log(`progress ${f}/${total}`);
  }
  ff.stdin.end();
  await ffDone;
  console.log(`progress ${total}/${total}`);
  console.log(`Đã quay ${seconds}s (${total} khung), cuộn ${Math.round(from)}→${Math.round(to)}px: ${outPath}`);
} catch (err) {
  ff?.stdin.destroy();
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
} finally {
  await browser.close();
}
