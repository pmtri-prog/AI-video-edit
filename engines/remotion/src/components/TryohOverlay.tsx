import React from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import type { Tryoh, TryohCard } from "../manifest";
import { BODY, HEADING, MONO, TRYOH, tryohFontFaceCss, useTryohFonts } from "../tryohTokens";
import { fadeInOut } from "./fade";
import { TryohKey } from "./TryohKeys";

/**
 * Lớp nhìn TryOh! trên footage: thanh 3 cấp (góc trên trái), thẻ lớp, thẻ nguồn.
 * Không logo góc, không gradient, không glow, không bóng đổ.
 */

const LAYER_COLOR = {
  wow: TRYOH.hong,
  consent: TRYOH.xanh,
  engage: TRYOH.vang,
  none: TRYOH.cat,
} as const;
const PILL_COLORS = [TRYOH.hong, TRYOH.xanh, TRYOH.vang];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Mốc level tại frame: mỗi mốc có hiệu lực tới mốc kế (0 = không cấp nào → cả ba sáng). */
const levelAt = (levels: Tryoh["levels"], frame: number): number => {
  let current = 0;
  for (const mark of levels) if (frame >= mark.from) current = mark.level;
  return current;
};

/** Độ sáng một vạch: chuyển bằng tween opacity 0.3s, không hiệu ứng khác. */
const pillOpacity = (levels: Tryoh["levels"], frame: number, fps: number, pill: number): number => {
  const lit = (f: number) => {
    const level = levelAt(levels, f);
    return level === 0 || level === pill ? 1 : 0.3;
  };
  const span = Math.round(0.3 * fps);
  return interpolate(frame, [frame - span, frame], [lit(frame - span), lit(frame)], clamp);
};

const LevelBar: React.FC<{ levels: Tryoh["levels"]; fps: number }> = ({ levels, fps }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", top: 150, left: 64, display: "flex", gap: 8 }}>
      {PILL_COLORS.map((color, i) => (
        <div
          key={color}
          style={{
            width: 72,
            height: 10,
            borderRadius: 5,
            background: color,
            opacity: pillOpacity(levels, frame, fps, i + 1),
          }}
        />
      ))}
    </div>
  );
};

const Card: React.FC<{ card: TryohCard }> = ({ card }) => {
  const frame = useCurrentFrame();
  const last = card.durationInFrames - 1;
  const enter = interpolate(frame, [0, 14], [0, 1], clamp);
  const eased = 1 - Math.pow(1 - enter, 3); // power3.out
  const opacity = Math.min(eased, fadeInOut(frame, last, 1, 8));
  return (
    <div
      style={{
        position: "absolute",
        top: 230,
        left: 64,
        maxWidth: 876,
        padding: "40px 48px",
        borderRadius: 32,
        background: LAYER_COLOR[card.layer],
        color: TRYOH.muc,
        opacity,
        transform: `translateY(${(1 - eased) * 40}px)`,
      }}
    >
      <div
        style={{
          fontFamily: HEADING,
          fontWeight: 700,
          fontSize: card.big ? 170 : card.headline.length > 14 ? 88 : 120,
          lineHeight: 1.0,
          letterSpacing: "-0.02em",
        }}
      >
        {card.headline}
        {card.dot ? <span style={{ color: TRYOH.do }}>.</span> : null}
      </div>
      {card.label ? (
        <div style={{ fontFamily: MONO, fontWeight: 400, fontSize: 30, marginTop: 20 }}>
          {card.label}
        </div>
      ) : null}
    </div>
  );
};

const SourceTag: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 64,
        bottom: 650,
        padding: "10px 20px",
        borderRadius: 64,
        background: TRYOH.pill,
        color: "#ffffff",
        fontFamily: MONO,
        fontWeight: 400,
        fontSize: 30,
        opacity,
      }}
    >
      {text}
    </div>
  );
};

export const TryohOverlay: React.FC<{ tryoh: Tryoh; fps: number }> = ({ tryoh, fps }) => {
  useTryohFonts();
  return (
    <AbsoluteFill style={{ fontFamily: BODY }}>
      <style>{tryohFontFaceCss}</style>
      {/* Thanh 3 cấp chỉ có nghĩa với series có lớp Wow/Consent/Engage; video không khai levels thì không hiện */}
      {tryoh.levels.length > 0 ? <LevelBar levels={tryoh.levels} fps={fps} /> : null}
      {tryoh.cards.map((card, i) => (
        <Sequence key={`card-${i}`} from={card.from} durationInFrames={card.durationInFrames}>
          <Card card={card} />
        </Sequence>
      ))}
      {tryoh.keys.map((k, i) => (
        <Sequence key={`key-${i}`} from={k.from} durationInFrames={k.durationInFrames}>
          <TryohKey tierKey={k} />
        </Sequence>
      ))}
      {tryoh.sources.map((s, i) => (
        <Sequence key={`src-${i}`} from={s.from} durationInFrames={s.durationInFrames}>
          <SourceTag text={s.text} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
