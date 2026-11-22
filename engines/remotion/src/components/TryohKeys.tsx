import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { Tryoh } from "../manifest";
import { BODY, HEADING, MONO, TRYOH } from "../tryohTokens";

/**
 * Key layout theo style TryOh!: key chính ở band trên (y 200-300), key liên quan và thẻ
 * trạng thái ở band dưới ngay trên vùng caption (đáy pill ở y 1270). Phẳng: không kính mờ,
 * không gradient, không glow. Nằm ngoài lớp zoom của footage nên không trôi khi punch-in.
 */
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const BAND_BOTTOM = 650;

/** Tách thành hai dòng tại khoảng trắng gần giữa câu nhất (theo số ký tự). */
const splitBalanced = (text: string): string[] => {
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  return best < 0 ? [text] : [text.slice(0, best), text.slice(best + 1)];
};

export const TryohKey: React.FC<{ tierKey: Tryoh["keys"][number] }> = ({ tierKey }) => {
  const frame = useCurrentFrame();
  const last = tierKey.durationInFrames - 1;
  const enter = 1 - Math.pow(1 - interpolate(frame, [0, 12], [0, 1], clamp), 3); // power3.out
  const exit = interpolate(frame, [last - 9, last], [1, 0], clamp);
  const opacity = Math.min(enter, exit);
  const y = (1 - enter) * 24 - (1 - exit) * 12;

  if (tierKey.tier === "main") {
    // Key dài (> 24 ký tự) không vừa một dòng 876px: hạ cỡ chữ và cho xuống dòng, kéo lên sát mép an toàn 150px.
    const long = tierKey.text.length > 24;
    // Key dài: tự ngắt ở khoảng trắng gần giữa nhất để hai dòng dài gần bằng nhau
    // (không mồ côi "thu.") và hộp nền ôm vừa chữ thay vì kéo hết bề ngang.
    const lines = long ? splitBalanced(tierKey.text) : [tierKey.text];
    return (
      <div style={{ position: "absolute", top: 200, left: 64, right: 140, display: "flex", opacity, transform: `translateY(${y}px)` }}>
        <div
          style={{
            background: TRYOH.cat,
            color: TRYOH.muc,
            borderRadius: 32,
            padding: "16px 36px 20px",
            fontFamily: HEADING,
            fontWeight: 700,
            fontSize: long ? 54 : 64,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            whiteSpace: "nowrap",
          }}
        >
          {lines.map((line, i) => (
            <React.Fragment key={i}>
              {i > 0 ? <br /> : null}
              {line}
            </React.Fragment>
          ))}
          <span style={{ color: TRYOH.do }}>.</span>
        </div>
      </div>
    );
  }

  const status = tierKey.tier === "status";
  return (
    <div style={{ position: "absolute", left: 64, bottom: BAND_BOTTOM, opacity, transform: `translateY(${y}px)` }}>
      <div
        style={{
          background: status ? TRYOH.cat : TRYOH.hong,
          color: status ? TRYOH.doDam : TRYOH.muc,
          borderRadius: 999,
          padding: status ? "10px 24px" : "14px 34px 16px",
          fontFamily: status ? MONO : BODY,
          fontWeight: status ? 400 : 600,
          fontSize: status ? 32 : 46,
          whiteSpace: "nowrap",
        }}
      >
        {tierKey.text}
      </div>
    </div>
  );
};
