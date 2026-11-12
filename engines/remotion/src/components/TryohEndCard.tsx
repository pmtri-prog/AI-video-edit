import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { MONO, TRYOH, tryohFontFaceCss, useTryohFonts } from "../tryohTokens";

/** End card TryOh!: kem full khung, logo từ file ở giữa (560px), tryoh.vn mono 36px, fade in 0.4s. */
export const TryohEndCard: React.FC = () => {
  useTryohFonts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, Math.round(0.4 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: TRYOH.kem, justifyContent: "center", alignItems: "center", opacity }}>
      <style>{tryohFontFaceCss}</style>
      <Img src={staticFile("tryoh/tryoh-logo-mau.svg")} style={{ width: 560, height: "auto" }} />
      <div style={{ marginTop: 40, fontFamily: MONO, fontSize: 36, fontWeight: 400, color: TRYOH.muc }}>
        tryoh.vn
      </div>
    </AbsoluteFill>
  );
};
