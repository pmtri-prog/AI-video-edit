import React from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import type { CaptionCue, Tryoh } from "../manifest";
import { BODY, TRYOH, tryohFontFaceCss, useTryohFonts } from "../tryohTokens";
import { fadeInOut } from "./fade";

/**
 * Phụ đề karaoke TryOh!: viên mực 72% + chữ trắng Be Vietnam Pro 600, từ đang đọc
 * gạch chân 6px màu của cấp hiện tại (không đổi màu chữ, không glow, không scale).
 * Đặt bottom 420px - trên vùng UI TikTok, cách mép phải 140px.
 */

const UNDERLINE = [TRYOH.hong, TRYOH.xanh, TRYOH.vang];

const underlineColor = (levels: Tryoh["levels"], frame: number): string => {
  let level = 0;
  for (const mark of levels) if (frame >= mark.from) level = mark.level;
  return level === 0 ? TRYOH.cat : UNDERLINE[level - 1];
};

const Cue: React.FC<{ cue: CaptionCue; levels: Tryoh["levels"] }> = ({ cue, levels }) => {
  const frame = useCurrentFrame();
  const abs = frame + cue.from;
  const color = underlineColor(levels, abs);
  const opacity = fadeInOut(frame, cue.durationInFrames - 1, 3, 3);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 420, paddingLeft: 64, paddingRight: 140, opacity }}>
      <div
        style={{
          background: TRYOH.pill,
          borderRadius: 32,
          padding: "22px 36px",
          color: "#ffffff",
          fontFamily: BODY,
          fontWeight: 600,
          fontSize: 56,
          lineHeight: 1.3,
          textAlign: "center",
          maxWidth: 876,
        }}
      >
        {cue.words.map((w, i) => {
          const spoken = abs >= w.start && abs <= w.end;
          return (
            <span
              key={`${w.text}-${i}`}
              style={{
                display: "inline-block",
                margin: "0 0.2em",
                boxShadow: spoken ? `inset 0 -6px 0 ${color}` : "none",
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const TryohCaptions: React.FC<{ captions: CaptionCue[]; levels: Tryoh["levels"] }> = ({ captions, levels }) => {
  useTryohFonts();
  return (
    <>
      <style>{tryohFontFaceCss}</style>
      {captions.map((cue, i) => (
        <Sequence key={`cue-${cue.from}-${i}`} from={cue.from} durationInFrames={cue.durationInFrames}>
          <Cue cue={cue} levels={levels} />
        </Sequence>
      ))}
    </>
  );
};
