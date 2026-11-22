import fs from "node:fs";
import path from "node:path";
import { paths } from "../config.js";
import { updateJob } from "../db.js";
import type { JobCtx } from "../queue.js";
import {
  briefOf,
  projectDirOf,
  readMeta,
  writeMeta,
  type ProjectMeta,
  type SceneMeta,
} from "../meta.js";
import { syncBrandLogo } from "../childProject.js";
import { getStyle } from "../styles.js";
import { ensureDir, execFileCapture, remotionCli } from "../util.js";
import { remotionSpeedArgs } from "../renderSettings.js";
import { parseProgressLine, shortenStep } from "./progress.js";

/**
 * Job assemble-draft | assemble-final - Remotion lắp timeline từ meta.json.
 * 1. Stage asset bằng hardlink (fallback copy) vào engines/remotion/public/staging/<projectId>/
 * 2. Sinh props.resolved.json - mọi đường dẫn asset đổi thành "staging/<projectId>/<file>"
 * 3. npx remotion render Assemble --props=<abs> --output=<abs> (cwd engines/remotion)
 *    Draft thêm --crf 28. Final ghi outputs/<projectId>-v<N>.mp4 (N tự tăng) + cập nhật meta.json.
 * (Điều kiện "final phải có assemble-draft done" đã được check 409 ở route POST /api/jobs.)
 */
export async function runAssemble(ctx: JobCtx): Promise<void> {
  const { projectId, type } = ctx.job;
  const draft = type === "assemble-draft";
  const projectDir = projectDirOf(projectId);
  const meta = readMeta(projectId);

  // ---- 1. Stage asset --------------------------------------------------
  ctx.progress(0, "Stage asset vào Remotion staging");
  // Namespace "vid-" để không đụng staging của image project trùng id (img-<id>)
  const stagingId = `vid-${projectId}`;
  const stagingAbs = path.join(paths.stagingDir, stagingId);
  fs.rmSync(stagingAbs, { recursive: true, force: true });
  ensureDir(stagingAbs);

  // Cache theo đường dẫn nguồn ĐÃ CHUẨN HÓA (path.resolve): cùng một file được
  // tham chiếu bằng nhiều cách viết ("assets/voice.wav", "assets\\voice.wav",
  // "./assets/voice.wav") phải trúng cache thay vì bị coi là hai nguồn khác
  // nhau. Windows không phân biệt hoa thường trong tên file nên khóa so sánh
  // hạ hết về chữ thường ở đó.
  const keyOf = (s: string): string => (process.platform === "win32" ? s.toLowerCase() : s);
  const staged = new Map<string, string>();
  /** Nguồn đang "sở hữu" mỗi tên flat trong staging - để phân biệt trùng thật/giả */
  const flatOwner = new Map<string, { rel: string; srcKey: string; publicRel: string }>();
  const stage = (relFromProject: string): string => {
    const srcAbs = path.join(projectDir, relFromProject);
    // meta.json do agent ghi - chặn traversal kiểu "../../.env" thoát khỏi project
    const resolved = path.resolve(srcAbs);
    if (!resolved.startsWith(path.resolve(projectDir) + path.sep)) {
      throw new Error(
        `Đường dẫn asset "${relFromProject}" nằm ngoài project ${projectId} - từ chối stage`,
      );
    }
    const srcKey = keyOf(resolved);
    const cached = staged.get(srcKey);
    if (cached) return cached;
    if (!fs.existsSync(srcAbs)) {
      throw new Error(`Thiếu asset "${relFromProject}" trong project ${projectId}`);
    }
    // Flatten đường dẫn để mọi file nằm phẳng trong staging/vid-<projectId>/
    const flat = relFromProject.split(/[\\/]+/).join("__");
    const dstAbs = path.join(stagingAbs, flat);
    const publicRel = `staging/${stagingId}/${flat}`;
    // Tên flat đã có chủ: nếu chủ cũ trỏ về CÙNG file nguồn (chỉ khác cách viết
    // đường dẫn) thì không phải xung đột - dùng lại bản đã stage. Chỉ khi hai
    // NGUỒN khác nhau thật sự (vd "a/b.mp4" và "a__b.mp4") cùng flatten về một
    // tên mới là xung đột: để rơi xuống linkSync thì EEXIST bị catch nhầm thành
    // "FS không hỗ trợ hardlink" và copyFileSync ghi đè im lặng file trước -
    // phải chặn bằng lỗi rõ ràng chỉ đích danh hai đường dẫn.
    const owner = flatOwner.get(keyOf(flat));
    if (owner) {
      if (owner.srcKey === srcKey) {
        staged.set(srcKey, owner.publicRel);
        return owner.publicRel;
      }
      throw new Error(
        `Xung đột tên khi stage: "${relFromProject}" và "${owner.rel}" ` +
          `cùng flatten về "${flat}" - đổi tên một trong hai file trong project ${projectId}`,
      );
    }
    if (fs.existsSync(dstAbs)) {
      // Không có chủ trong map mà file đích vẫn tồn tại (staging chưa được dọn
      // sạch?) - trạng thái bất thường, vẫn từ chối ghi đè im lặng
      throw new Error(
        `File staging "${flat}" đã tồn tại trước khi stage "${relFromProject}" - staging chưa sạch, chạy lại job`,
      );
    }
    try {
      fs.linkSync(srcAbs, dstAbs); // hardlink - không tốn dung lượng
    } catch {
      fs.copyFileSync(srcAbs, dstAbs); // fallback (khác ổ đĩa / FS không hỗ trợ)
    }
    staged.set(srcKey, publicRel);
    flatOwner.set(keyOf(flat), { rel: relFromProject, srcKey, publicRel });
    ctx.log(`[stage] ${relFromProject} -> ${publicRel}`);
    return publicRel;
  };

  // ---- Footage lớn hơn khung xuất → bản làm việc đúng độ phân giải ----
  // OffthreadVideo trả từng frame cho Chrome dưới dạng BMP không nén (4K dọc ~33MB
  // MỖI frame) → "Could not extract frame ... EPIPE" / "disk space is low" giữa
  // render (skill remotion-assemble). Trước đây trông vào agent nhớ tự scale;
  // luồng duyệt từng bước không có agent, nên server làm luôn cho mọi luồng.
  for (const scene of meta.scenes ?? []) {
    if (typeof scene.srcVideo !== "string" || !scene.srcVideo) continue;
    const work = await workingCopy(projectDir, scene.srcVideo, meta.width, meta.height, meta.fps, ctx);
    if (work !== scene.srcVideo) scene.srcVideo = work;
  }

  // props = bản sao meta với đường dẫn asset đã resolve sang staging/
  const props = JSON.parse(JSON.stringify(meta)) as ProjectMeta;

  for (const scene of props.scenes ?? []) {
    if (typeof scene.src === "string" && scene.src) {
      // Scene HyperFrames: dùng file render trung gian
      const finalRel =
        typeof scene.render === "string" && scene.render
          ? scene.render
          : `renders/${scene.id}.mp4`;
      const draftRel = finalRel.replace(/\.mp4$/i, ".draft.mp4");
      let renderRel = draft ? draftRel : finalRel;
      if (!fs.existsSync(path.join(projectDir, renderRel))) {
        const alt = draft ? finalRel : draftRel;
        if (fs.existsSync(path.join(projectDir, alt))) {
          ctx.log(`[warn] Không thấy ${renderRel}, dùng tạm ${alt}`);
          renderRel = alt;
        } else {
          throw new Error(
            `Scene "${scene.id}" chưa được render (${renderRel}). Chạy job scene-${draft ? "draft" : "final"} trước.`,
          );
        }
      }
      scene.render = stage(renderRel);
    } else if (
      (typeof scene.srcVideo === "string" && scene.srcVideo) ||
      (typeof scene.srcImage === "string" && scene.srcImage)
    ) {
      // Scene footage/ảnh nhưng còn sót field `render` cũ: Remotion (SceneClip)
      // check `render` TRƯỚC srcVideo/srcImage - render cũ chưa stage sẽ vừa
      // 404 giữa chừng vừa đè mất footage. Footage thắng: bỏ field render thừa.
      if (scene.render != null) {
        if (typeof scene.render === "string" && scene.render) {
          ctx.log(`[warn] Scene "${scene.id}" có cả render lẫn footage - bỏ field render thừa`);
        }
        delete scene.render;
      }
    } else if (typeof scene.render === "string" && scene.render) {
      // Scene chỉ có `render` (không src/srcVideo/srcImage) - vẫn phải stage,
      // nếu không Remotion load đường dẫn renders/... từ public/ và 404 giữa render.
      if (!fs.existsSync(path.join(projectDir, scene.render))) {
        throw new Error(
          `Scene "${scene.id}": không thấy file render "${scene.render}" trong project ${projectId}`,
        );
      }
      scene.render = stage(scene.render);
    }
    if (typeof scene.srcVideo === "string" && scene.srcVideo) {
      scene.srcVideo = stage(scene.srcVideo);
    }
    // Scene ảnh tĩnh (ảnh minh họa AI) - cũng phải stage, nếu không Remotion
    // load `assets/...` từ public/ và chết 404 giữa chừng.
    if (typeof scene.srcImage === "string" && scene.srcImage) {
      scene.srcImage = stage(scene.srcImage);
    }
  }

  // ---- Kẹp transitionOverlap về giới hạn an toàn ----
  // transitionOverlap là số frame chồng lấn với scene KẾ TIẾP (xem
  // engines/remotion/src/manifest.ts: from += duration - transitionOverlap).
  // Overlap lớn hơn thời lượng của một trong hai scene liền kề đẩy mốc from
  // lùi quá đà: scene sau bắt đầu TRƯỚC cả scene trước nó, hiện ra thành cảnh
  // nhấp nháy / scene trong mờ chồng nhau. Kẹp về min(scene này, scene kế):
  // overlap bằng đúng thời lượng (crossfade phủ trọn scene) vẫn render được nên
  // không đụng - chỉ kẹp phần vượt quá, giữ nguyên output của manifest đang chạy tốt.
  {
    // Cách tính thời lượng frame khớp resolveSceneDurationInFrames bên Remotion:
    // durationInFrames, hoặc scene srcVideo suy từ round(to*fps) - round(from*fps).
    const frameOf = (scene: SceneMeta): number | null => {
      if (typeof scene.durationInFrames === "number") return scene.durationInFrames;
      if (
        typeof scene.srcVideo === "string" &&
        scene.srcVideo &&
        typeof scene.from === "number" &&
        typeof scene.to === "number"
      ) {
        return Math.max(1, Math.round(scene.to * props.fps) - Math.round(scene.from * props.fps));
      }
      return null; // thiếu thời lượng - để Remotion tự báo lỗi rõ ở bước render
    };
    const scenes = props.scenes ?? [];
    for (let i = 0; i < scenes.length; i++) {
      const overlap = scenes[i].transitionOverlap;
      if (typeof overlap !== "number" || overlap <= 0) continue;
      const cur = frameOf(scenes[i]);
      const next = i + 1 < scenes.length ? frameOf(scenes[i + 1]) : null;
      if (cur === null || next === null) continue;
      const limit = Math.max(0, Math.min(cur, next));
      if (overlap > limit) {
        ctx.log(
          `[warn] Scene "${scenes[i].id}": transitionOverlap ${overlap} vượt thời lượng scene liền kề - kẹp về ${limit}`,
        );
        scenes[i].transitionOverlap = limit;
      }
    }
  }

  // ---- Logo thương hiệu đóng góc (BẮT BUỘC khi Style Design có logo) ----
  //
  // Chèn Ở ĐÂY chứ không giao cho agent: logo đóng góc là thứ phải có ở MỌI
  // video, mà bất cứ việc gì giao cho agent nhớ thì sớm muộn cũng có lần quên.
  // Đặt tại tầng lắp ráp thì kể cả render lại một project cũ (không chạy phiên
  // edit nào) logo vẫn có mặt.
  const brief = briefOf(meta);
  const logoFile = syncBrandLogo(projectId, getStyle(brief.styleId));
  if (logoFile) {
    (props as ProjectMeta & { watermark?: unknown }).watermark = {
      file: stage(path.posix.join("assets", logoFile)),
      position: "top-left",
    };
    ctx.log(`[watermark] logo góc trên trái: assets/${logoFile}`);
  } else {
    // Xóa mọi watermark agent lỡ ghi vào meta.json: watermark là việc RIÊNG
    // của server (xem comment trên), và đường dẫn agent ghi chưa qua stage nên
    // Remotion sẽ 404 giữa chừng render. null = không đóng logo, khớp
    // watermarkSchema (nullable) bên engines/remotion/src/manifest.ts.
    (props as ProjectMeta & { watermark?: unknown }).watermark = null;
    ctx.log("[watermark] Style Design không có logo - video không đóng logo");
  }

  if (props.audio) {
    if (typeof props.audio.voice === "string" && props.audio.voice) {
      props.audio.voice = stage(props.audio.voice);
    }
    // Kiểm tra sfx TRƯỚC khi stage: meta.ts để atFrame optional nhưng schema
    // Remotion (engines/remotion/src/manifest.ts sfxSchema) BẮT BUỘC atFrame là
    // số nguyên >= 0, volume 0..1, mediaStart >= 0. Thiếu/sai là render chết
    // giữa chừng với lỗi zod khó hiểu - chặn ở đây với thông báo chỉ đích danh.
    (props.audio.sfx ?? []).forEach((sfx, i) => {
      const label = `audio.sfx[${i}] (file "${typeof sfx.file === "string" ? sfx.file : "?"}")`;
      if (typeof sfx.atFrame !== "number" || !Number.isInteger(sfx.atFrame) || sfx.atFrame < 0) {
        throw new Error(
          `${label}: atFrame phải là số nguyên >= 0 (hiện tại: ${JSON.stringify(sfx.atFrame)}) - sửa meta.json rồi chạy lại`,
        );
      }
      if (
        sfx.volume !== undefined &&
        (typeof sfx.volume !== "number" || sfx.volume < 0 || sfx.volume > 1)
      ) {
        throw new Error(
          `${label}: volume phải nằm trong khoảng 0..1 (hiện tại: ${JSON.stringify(sfx.volume)})`,
        );
      }
      const mediaStart = sfx.mediaStart; // field mở rộng - meta.ts không khai báo kiểu
      if (
        mediaStart !== undefined &&
        (typeof mediaStart !== "number" || !Number.isFinite(mediaStart) || mediaStart < 0)
      ) {
        throw new Error(
          `${label}: mediaStart phải là số >= 0 (hiện tại: ${JSON.stringify(mediaStart)})`,
        );
      }
    });
    for (const sfx of props.audio.sfx ?? []) {
      if (typeof sfx.file === "string" && sfx.file) sfx.file = stage(sfx.file);
    }
    // Nhạc nền (file đã copy vào assets/ của project - xem skill background-music)
    const music = props.audio.music;
    if (music && typeof music.file === "string" && music.file) {
      music.file = stage(music.file);
    }
    // Nhạc theo đoạn (bước Âm thanh) - mỗi đoạn một file
    const sections = (props.audio as { musicSections?: { file?: unknown }[] }).musicSections ?? [];
    for (const sec of sections) {
      if (typeof sec.file === "string" && sec.file) sec.file = stage(sec.file);
    }
  }

  // ---- Minh họa chèn (Bước 2 luồng duyệt từng bước) ----
  // meta lưu GIÂY + đường dẫn trong project; Remotion cần FRAME + đường dẫn staging.
  // Insert thiếu file (video/ảnh chưa chọn) bị BỎ QUA có ghi log, không làm chết
  // cả bản draft - người dùng đang duyệt dở thì vẫn xem được phần đã xong.
  {
    const fps = meta.fps;
    const out: Record<string, unknown>[] = [];
    for (const ins of meta.inserts ?? []) {
      const fromFrame = Math.max(0, Math.round(ins.start * fps));
      const durationInFrames = Math.round(ins.end * fps) - fromFrame;
      if (durationInFrames < 2) continue;
      if (ins.kind !== "motion" && !ins.src) {
        ctx.log(`[insert] ${ins.id}: chưa có file - bỏ qua trong bản này`);
        continue;
      }
      if (ins.kind !== "motion" && ins.src && !fs.existsSync(path.join(projectDir, ins.src))) {
        ctx.log(`[insert] ${ins.id}: không thấy ${ins.src} - bỏ qua`);
        continue;
      }
      out.push({
        id: ins.id,
        kind: ins.kind,
        fromFrame,
        durationInFrames,
        display: ins.display,
        src: ins.kind === "motion" || !ins.src ? null : stage(ins.src),
        mediaStart: ins.mediaStart ?? 0,
        transitionIn: ins.transitionIn,
        transitionOut: ins.transitionOut,
        credit: ins.credit ?? "",
        ...(ins.kind === "motion" && ins.motion ? { motion: ins.motion } : {}),
      });
    }
    (props as Record<string, unknown>).inserts = out;
    const c = getStyle(brief.styleId).colors;
    (props as Record<string, unknown>).insertTheme = {
      primary: c.primary,
      accent: c.accent,
      background: c.background,
      text: c.text,
    };
    if (out.length) ctx.log(`[insert] ${out.length} minh họa chèn lên footage`);
  }

  // ---- 2. props.resolved.json -----------------------------------------
  const propsAbs = path.join(projectDir, "props.resolved.json");
  fs.writeFileSync(propsAbs, JSON.stringify(props, null, 2) + "\n", "utf8");
  ctx.log(`[props] Đã ghi ${propsAbs}`);

  // ---- 3. Remotion render ----------------------------------------------
  ensureDir(paths.outputsDir);
  const outName = draft ? `${projectId}-draft.mp4` : `${projectId}-v${nextVersion(projectId)}.mp4`;
  const outAbs = path.join(paths.outputsDir, outName);

  ctx.progress(0, "Remotion render Assemble");
  // Concurrency + --gl angle (GPU) lấy từ tab Cấu hình - Remotion mặc định render bằng CPU thuần
  // Draft: CRF cao + x264 veryfast - encode CPU nhẹ đi nhiều, chất lượng draft không quan trọng
  const args = [
    remotionCli(),
    "render",
    "Assemble",
    `--props=${propsAbs}`,
    `--output=${outAbs}`,
    ...remotionSpeedArgs(),
    ...(draft ? ["--crf", "28", "--x264-preset", "veryfast"] : []),
  ];
  await ctx.exec(process.execPath, args, paths.remotionDir, (line) => {
    const pct = parseProgressLine(line);
    if (pct !== null) ctx.progress(pct, shortenStep(line));
  });

  if (!fs.existsSync(outAbs)) {
    throw new Error(`Remotion render xong nhưng không thấy file ${outName}`);
  }

  const outputRel = `outputs/${outName}`;
  updateJob(ctx.job.id, { outputPath: outputRel });

  // Final xong → meta.json là nguồn sự thật cho web UI
  if (!draft) {
    const freshMeta = readMeta(projectId);
    freshMeta.status = "done";
    freshMeta.output = outputRel;
    writeMeta(projectId, freshMeta);
    ctx.log(`[meta] Cập nhật status=done, output=${outputRel}`);
  }
}

/** Quét outputs/ tìm <projectId>-v<N>.mp4 lớn nhất → N+1 (bắt đầu từ 1) */
function nextVersion(projectId: string): number {
  let max = 0;
  if (fs.existsSync(paths.outputsDir)) {
    const re = new RegExp(`^${escapeRegExp(projectId)}-v(\\d+)\\.mp4$`, "i");
    for (const name of fs.readdirSync(paths.outputsDir)) {
      const m = re.exec(name);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  return max + 1;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Bản làm việc của footage: đúng khung xuất (cover + crop giữa), CFR theo fps,
 * xoay dọc đã nướng vào điểm ảnh. Lưu ở renders/proxy/ (gitignore, nằm trong
 * project nên stage được) và dùng lại khi nguồn chưa đổi. Footage đã vừa khung
 * thì trả nguyên đường dẫn - không encode thừa.
 *
 * Chỉ đổi đường dẫn trong PROPS của lần dựng này (meta.json giữ nguyên nguồn):
 * from/to vẫn đúng vì chỉ đổi cỡ khung, không đổi thời gian.
 */
async function workingCopy(
  projectDir: string,
  rel: string,
  w: number,
  h: number,
  fps: number,
  ctx: JobCtx,
): Promise<string> {
  const abs = path.join(projectDir, rel);
  if (!fs.existsSync(abs)) return rel;
  let sw = 0;
  let sh = 0;
  let rate = fps;
  let rotation = 0;
  try {
    const out = await execFileCapture("ffprobe", [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height,r_frame_rate:stream_side_data=rotation",
      "-of", "json", abs,
    ]);
    const st = (JSON.parse(out) as { streams?: Array<Record<string, unknown>> }).streams?.[0] ?? {};
    sw = Number(st.width) || 0;
    sh = Number(st.height) || 0;
    const [a, b] = String(st.r_frame_rate ?? "").split("/").map(Number);
    if (a && b) rate = a / b;
    const side = (st.side_data_list as Array<{ rotation?: number }> | undefined) ?? [];
    rotation = Math.abs(Number(side.find((x) => x.rotation !== undefined)?.rotation ?? 0)) % 180;
  } catch {
    return rel; // không probe được thì để Remotion tự xử như trước
  }
  if (!sw || !sh) return rel;
  if (rotation === 90) [sw, sh] = [sh, sw];
  const fitsFrame = sw <= w * 1.05 && sh <= h * 1.05;
  if (fitsFrame && Math.abs(rate - fps) < 0.01) return rel;

  const stem = path.basename(rel).replace(/\.[^.]+$/, "");
  const outRel = path.posix.join("renders", "proxy", `${stem}.${w}x${h}@${Math.round(fps)}.mp4`);
  const outAbs = path.join(projectDir, outRel);
  if (fs.existsSync(outAbs) && fs.statSync(outAbs).mtimeMs >= fs.statSync(abs).mtimeMs) {
    ctx.log(`[proxy] dùng lại ${outRel}`);
    return outRel;
  }
  ensureDir(path.dirname(outAbs));
  ctx.progress(1, `Thu footage ${sw}x${sh} về ${w}x${h} cho Remotion`);
  ctx.log(`[proxy] ${rel} ${sw}x${sh}@${rate.toFixed(2)} → ${outRel}`);
  const tmp = `${outAbs}.tmp.mp4`;
  await ctx.exec(
    "ffmpeg",
    [
      "-hide_banner", "-nostats", "-y", "-i", abs,
      "-vf", `fps=${fps},scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
      tmp,
    ],
    projectDir,
  );
  fs.renameSync(tmp, outAbs);
  return outRel;
}
