import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Insert, InsertTheme } from "../manifest";
import { VIETNAMESE_FONT_FAMILY, vietnameseFontFaceCss } from "./vietnameseFont";

/**
 * Lớp CHÈN minh họa của Bước 2 (luồng duyệt từng bước).
 *
 * Mỗi insert là một Sequence phủ LÊN footage người nói - tiếng footage vẫn chạy
 * (video chèn luôn muted). Ba cách hiện: full (phủ kín), top (nửa trên, người
 * nói còn ở nửa dưới), pip (khung nhỏ góc trên phải). Motion graphic là mẫu
 * CÓ THAM SỐ (counter/chapter/list/cta) để người dùng sửa chữ và số trên web rồi
 * dựng lại mà không cần AI viết lại HTML.
 *
 * Nằm TRÊN scene, DƯỚI phụ đề (Assemble.tsx) - phụ đề đọc liên tục nên luôn ở trên.
 */

const DEFAULT_THEME: Required<Pick<InsertTheme, "primary" | "accent" | "background" | "text">> = {
  primary: "#ed3c47",
  accent: "#ffd23f",
  background: "#101113",
  text: "#ffffff",
};

const FONT = `'${VIETNAMESE_FONT_FAMILY}', 'Segoe UI', sans-serif`;
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

interface Region {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
}

function regionOf(display: Insert["display"], w: number, h: number): Region {
  const u = w / 1080;
  if (display === "top") return { left: 0, top: 0, width: w, height: Math.round(h * 0.5), radius: 0 };
  if (display === "pip") {
    const width = Math.round(w * 0.46);
    return {
      left: w - width - Math.round(w * 0.05),
      top: Math.round(h * 0.09),
      width,
      height: Math.round(width * 1.25),
      radius: Math.round(28 * u),
    };
  }
  return { left: 0, top: 0, width: w, height: h, radius: 0 };
}

/**
 * Footage người nói để dựng kiểu CHIA ĐÔI cho display "top": nội dung nửa trên,
 * người nói dời xuống nửa dưới. Chỉ có khi timeline là MỘT scene footage (luồng
 * duyệt từng bước) - nhiều scene thì không biết frame nào thuộc file nào.
 */
export interface SplitSource {
  src: string;
  /** frame bắt đầu bên trong file, ứng với frame 0 của timeline */
  startFrame: number;
}

export const InsertTrack: React.FC<{
  inserts: Insert[];
  theme?: InsertTheme;
  split?: SplitSource | null;
}> = ({ inserts, theme, split }) => {
  const t = { ...DEFAULT_THEME, ...(theme ?? {}) };
  return (
    <AbsoluteFill>
      <style>{vietnameseFontFaceCss}</style>
      {inserts.map((ins) => (
        <Sequence key={ins.id} from={ins.fromFrame} durationInFrames={ins.durationInFrames}>
          <InsertClip insert={ins} theme={t} split={split ?? null} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const InsertClip: React.FC<{ insert: Insert; theme: typeof DEFAULT_THEME; split: SplitSource | null }> = ({
  insert,
  theme,
  split,
}) => {
  const frame = useCurrentFrame();
  const { width: w, height: h, fps } = useVideoConfig();
  const u = w / 1080;
  const last = insert.durationInFrames - 1;
  // Clip ngắn thì nhịp chuyển cảnh co lại theo, không bao giờ chiếm quá 1/3 clip
  const T = Math.max(1, Math.min(8, Math.floor(insert.durationInFrames / 3)));
  const pIn = insert.transitionIn === "cut" ? 1 : interpolate(frame, [0, T], [0, 1], CLAMP);
  const pOut = insert.transitionOut === "cut" ? 1 : interpolate(frame, [last - T, last], [1, 0], CLAMP);

  let opacity = 1;
  let translateY = 0;
  let scale = 1;
  if (insert.transitionIn === "fade" || insert.transitionIn === "zoom") opacity *= pIn;
  if (insert.transitionOut === "fade" || insert.transitionOut === "zoom") opacity *= pOut;
  // Khung "nửa trên" trượt từ MÉP TRÊN xuống - trượt từ dưới lên là quét ngang mặt người nói
  const dir = insert.display === "top" ? -1 : 1;
  if (insert.transitionIn === "slide") translateY += dir * (1 - pIn) * 100;
  if (insert.transitionOut === "slide") translateY += dir * (1 - pOut) * 100;
  if (insert.transitionIn === "zoom") scale *= 1.12 - 0.12 * pIn;
  if (insert.transitionOut === "zoom") scale *= 1.12 - 0.12 * pOut;

  const r = regionOf(insert.display, w, h);
  const pip = insert.display === "pip";

  let body: React.ReactNode = null;
  if (insert.kind === "video" && insert.src) {
    body = (
      <OffthreadVideo
        src={staticFile(insert.src)}
        muted
        startFrom={Math.round(insert.mediaStart * fps)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    );
  } else if (insert.kind === "image" && insert.src) {
    // Ken Burns rất nhẹ - ảnh tĩnh đứng im 3-5 giây trông như video bị treo
    const kb = interpolate(frame, [0, Math.max(1, last)], [1, 1.06], CLAMP);
    body = (
      <Img
        src={staticFile(insert.src)}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${kb})` }}
      />
    );
  } else if (insert.kind === "motion" && insert.motion) {
    body = <MotionCard insert={insert} theme={theme} />;
  }

  const box = (
    <div
      style={{
        position: "absolute",
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        overflow: "hidden",
        borderRadius: r.radius,
        border: pip ? `${Math.round(6 * u)}px solid ${theme.text}` : undefined,
        boxShadow: insert.display === "full" ? undefined : `0 ${Math.round(12 * u)}px ${Math.round(40 * u)}px rgba(0,0,0,0.45)`,
        backgroundColor: theme.background,
        opacity,
        transform: `translateY(${translateY}%) scale(${scale})`,
      }}
    >
      {body}
      {insert.credit ? (
        <div
          style={{
            position: "absolute",
            left: Math.round(24 * u),
            bottom: Math.round((insert.display === "full" ? 120 : 20) * u),
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: Math.round(24 * u),
            color: "rgba(255,255,255,0.88)",
            textShadow: "0 1px 4px rgba(0,0,0,0.8)",
          }}
        >
          {insert.credit}
        </div>
      ) : null}
    </div>
  );

  if (insert.display !== "top" || !split) return box;
  // CHIA ĐÔI: video dọc quay selfie có mặt người nói ở nửa TRÊN khung - phủ nửa
  // trên là che đúng mặt. Nửa dưới phát lại chính footage (muted - tiếng vẫn từ
  // scene chính), cắt lấy vùng mặt, khớp đúng frame với timeline.
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: r.height,
          width: w,
          height: h - r.height,
          overflow: "hidden",
          backgroundColor: theme.background,
          opacity,
        }}
      >
        <OffthreadVideo
          src={staticFile(split.src)}
          muted
          startFrom={split.startFrame + insert.fromFrame}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 28%" }}
        />
      </div>
      {box}
    </>
  );
};

// ================================ Motion graphic ================================

/** "12.000" → { prefix:"", num:12000, decimals:0, thousands:".", suffix:"" } */
function parseValue(value: string) {
  const m = /^(\D*?)(\d[\d.,]*)(.*)$/.exec(value.trim());
  if (!m) return null;
  const raw = m[2];
  // Kiểu Việt: "." ngăn nghìn, "," thập phân. "11,5" → 11.5 ; "12.000" → 12000
  const commaDecimal = /,\d{1,2}$/.test(raw);
  const decimals = commaDecimal ? raw.split(",").pop()!.length : 0;
  const num = parseFloat(raw.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(num)) return null;
  return { prefix: m[1], num, decimals, thousands: /\.\d{3}/.test(raw), suffix: m[3] };
}

function formatValue(n: number, decimals: number, thousands: boolean): string {
  const fixed = n.toFixed(decimals);
  const [int, dec] = fixed.split(".");
  const intFmt = thousands ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : int;
  return dec ? `${intFmt},${dec}` : intFmt;
}

const MotionCard: React.FC<{ insert: Insert; theme: typeof DEFAULT_THEME }> = ({ insert, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width: w } = useVideoConfig();
  const u = w / 1080;
  const m = insert.motion!;
  // Cỡ chữ theo CÁCH HIỆN - không suy từ diện tích: nửa trên vẫn rộng đủ cả
  // khung, co theo diện tích (lần đầu làm vậy) ra chữ 34px đọc không nổi trên điện thoại
  const k = insert.display === "pip" ? 0.5 : insert.display === "top" ? 0.85 : 1;
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 18 });
  const rise = (1 - enter) * 40 * u;

  const wrap: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: Math.round(28 * u * k),
    padding: Math.round(80 * u * k),
    fontFamily: FONT,
    color: theme.text,
    textAlign: "center",
    backgroundColor: theme.background,
  };
  const title: React.CSSProperties = {
    fontWeight: 800,
    fontSize: Math.round(72 * u * k),
    lineHeight: 1.15,
    opacity: enter,
    transform: `translateY(${rise}px)`,
  };
  const label: React.CSSProperties = {
    fontWeight: 600,
    fontSize: Math.round(40 * u * k),
    opacity: 0.85 * enter,
  };
  const bar = (
    <div
      style={{
        width: interpolate(enter, [0, 1], [0, 160 * u * k]),
        height: Math.round(10 * u * k),
        borderRadius: 999,
        backgroundColor: theme.primary,
      }}
    />
  );

  if (m.template === "counter") {
    const parsed = parseValue(m.value);
    const p = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 36 });
    const shown = parsed
      ? `${parsed.prefix}${formatValue(parsed.num * p, parsed.decimals, parsed.thousands)}${parsed.suffix}`
      : m.value;
    return (
      <div style={wrap}>
        {m.title ? <div style={title}>{m.title}</div> : null}
        <div
          style={{
            fontWeight: 800,
            fontSize: Math.round(220 * u * k),
            lineHeight: 1,
            color: theme.accent,
            fontVariantNumeric: "tabular-nums",
            opacity: enter,
          }}
        >
          {shown}
        </div>
        {bar}
        {m.label ? <div style={label}>{m.label}</div> : null}
      </div>
    );
  }

  if (m.template === "chapter") {
    return (
      <div style={wrap}>
        {m.label ? (
          <div
            style={{
              fontWeight: 700,
              fontSize: Math.round(36 * u * k),
              letterSpacing: 4 * u,
              textTransform: "uppercase",
              color: theme.background,
              backgroundColor: theme.accent,
              borderRadius: 999,
              padding: `${Math.round(10 * u * k)}px ${Math.round(28 * u * k)}px`,
              opacity: enter,
            }}
          >
            {m.label}
          </div>
        ) : null}
        <div style={{ ...title, fontSize: Math.round(110 * u * k) }}>{m.title}</div>
        {bar}
      </div>
    );
  }

  if (m.template === "list") {
    return (
      <div style={wrap}>
        {m.title ? <div style={title}>{m.title}</div> : null}
        {/* Khối mục căn giữa khung nhưng các dòng thẳng lề trái với nhau */}
        <div style={{ display: "flex", flexDirection: "column", gap: Math.round(22 * u * k), textAlign: "left" }}>
        {m.items.map((item, i) => {
          const s = spring({ frame: frame - 8 - i * 7, fps, config: { damping: 200 }, durationInFrames: 14 });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: Math.round(24 * u * k),
                fontWeight: 700,
                fontSize: Math.round(54 * u * k),
                opacity: s,
                transform: `translateX(${(1 - s) * 60 * u}px)`,
              }}
            >
              <span
                style={{
                  flex: "none",
                  width: Math.round(72 * u * k),
                  height: Math.round(72 * u * k),
                  borderRadius: 999,
                  backgroundColor: theme.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: Math.round(38 * u * k),
                }}
              >
                {i + 1}
              </span>
              <span>{item}</span>
            </div>
          );
        })}
        </div>
      </div>
    );
  }

  // cta
  const pulse = 1 + 0.04 * Math.sin((frame / fps) * Math.PI * 2);
  return (
    <div style={wrap}>
      <div style={title}>{m.title}</div>
      {m.label ? (
        <div
          style={{
            fontWeight: 800,
            fontSize: Math.round(48 * u * k),
            color: theme.text,
            backgroundColor: theme.primary,
            borderRadius: 999,
            padding: `${Math.round(22 * u * k)}px ${Math.round(48 * u * k)}px`,
            opacity: enter,
            transform: `scale(${enter > 0.99 ? pulse : enter})`,
          }}
        >
          {m.label}
        </div>
      ) : null}
    </div>
  );
};
