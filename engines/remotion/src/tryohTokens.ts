import { staticFile } from "remotion";
import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";

/**
 * Nhận diện TryOh! v1.0 cho overlay video dọc (skill activos-tiktok mục 3).
 * Màu ghi hex thẳng - không dùng CSS variable để overlay render đúng ở mọi nơi.
 */
export const TRYOH = {
  hong: "#fbd9cb",
  xanh: "#cde4ff",
  vang: "#fee4a9",
  cat: "#efe6da",
  kem: "#f6f2ec",
  do: "#f43a1c",
  doDam: "#b3260f",
  muc: "#1a1a1a",
  pill: "rgba(26,26,26,0.72)",
} as const;

export const HEADING = "'TryohHeading', sans-serif";
export const BODY = "'TryohBody', sans-serif";
export const MONO = "'TryohMono', monospace";

export const tryohFontFaceCss = `
@font-face{font-family:'TryohHeading';src:url('${staticFile("tryoh/SpaceGrotesk-VF.ttf")}') format('truetype');font-weight:300 700;font-display:block;}
@font-face{font-family:'TryohBody';src:url('${staticFile("tryoh/BeVietnamPro-Regular.ttf")}') format('truetype');font-weight:400;font-display:block;}
@font-face{font-family:'TryohBody';src:url('${staticFile("tryoh/BeVietnamPro-SemiBold.ttf")}') format('truetype');font-weight:600;font-display:block;}
@font-face{font-family:'TryohMono';src:url('${staticFile("tryoh/JetBrainsMono-VF.ttf")}') format('truetype');font-weight:100 800;font-display:block;}
`;

/** Chặn render tới khi font TryOh! sẵn sàng (tránh frame đầu vẽ bằng font dự phòng). */
export const useTryohFonts = (): void => {
  const [handle] = useState(() => delayRender("Nạp font TryOh!"));
  useEffect(() => {
    Promise.all([
      document.fonts.load("700 100px 'TryohHeading'", "Tiếng Việt đủ dấu"),
      document.fonts.load("400 50px 'TryohBody'", "Tiếng Việt đủ dấu"),
      document.fonts.load("600 50px 'TryohBody'", "Tiếng Việt đủ dấu"),
      document.fonts.load("400 30px 'TryohMono'", "Nguồn: BCG × Google, 2024"),
    ])
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle))
      .catch((err: unknown) =>
        cancelRender(new Error(`Không nạp được font TryOh!: ${String(err)}`)),
      );
  }, [handle]);
};
