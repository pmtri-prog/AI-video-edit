import React from "react";
import { AbsoluteFill, Img, staticFile, useVideoConfig } from "remotion";
import { BRAND_HEADING_FAMILY, ensureBrandFont } from "./brandFonts";
import type { ThumbnailProps } from "./thumbnailManifest";

/**
 * Bố cục "Nhãn dán" của still `Thumbnail` - dùng cho Style Design phẳng
 * (effects.gradient và liquidGlass đều tắt, vd TryOh!). Trí chốt mẫu này
 * 12/11/2026 cho mọi video talking head:
 *
 *  - frame video tràn khung, không phủ tối
 *  - tối đa 3 từ khóa (`tags`) trên viên thuốc màu, xoay chéo nhẹ, dán
 *    ngay trên thẻ title (dưới mặt)
 *  - thẻ dưới chứa title, chữ đặc màu text; câu không có dấu kết thì thêm
 *    dấu chấm màu primary (chữ ký TryOh!)
 *
 * Cố ý KHÔNG có logo: kênh TikTok của Trí bỏ logo góc lẫn end card (TikTok hạn
 * chế watermark), ảnh bìa theo cùng quyết định đó.
 *
 * Mọi chữ nằm trong vùng giữa 3:4 (y 16,6%-83,3%) vì lưới trang cá nhân
 * TikTok chỉ hiện phần đó của ảnh bìa.
 */

const hexToRgb = (hex: string): [number, number, number] => {
  const raw = hex.trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [239, 230, 218];
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};

/** Trộn 2 màu hex theo tỉ lệ t (0 = a, 1 = b). */
const mix = (a: string, b: string, t: number): string => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

/** Góc xoay từng viên - xen chiều cho cảm giác dán tay. */
const PILL_ROTATE = [-6, 5, -3];

export const ThumbnailStickers: React.FC<ThumbnailProps> = ({ frame, title, tags, tagColors, design }) => {
  const { width, height } = useVideoConfig();
  const { colors, fonts, fontFiles } = design;
  // Theo cạnh NGẮN: khung 16:9 dùng cùng cỡ chữ với 9:16 thay vì phóng gấp 1,8 lần
  const u = Math.min(width, height) / 1080;

  const hasBrandHeading = ensureBrandFont(BRAND_HEADING_FAMILY, fontFiles.heading);
  const headingFont = `${hasBrandHeading ? `'${BRAND_HEADING_FAMILY}', ` : ""}'${fonts.heading.replace(/'/g, "")}', 'Segoe UI', sans-serif`;

  // Màu viên: tagColors (vd 3 lớp Wow/Consent/Engage) → suy từ style
  const fallback = [mix(colors.primary, "#ffffff", 0.8), colors.accent, mix(colors.background, colors.text, 0.06)];
  const pillColor = (i: number) => tagColors[i] ?? fallback[i % fallback.length];
  const cardColor = mix(colors.background, colors.text, 0.04);

  const text = title.trim();
  const needsDot = text !== "" && !/[.?!…]$/.test(text);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      {frame ? (
        <Img
          src={staticFile(frame)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : null}

      {/* Viên dán + thẻ title chung một cột neo đáy: viên luôn nằm sát trên
          thẻ (vùng ngực), title dài mấy dòng cũng không đẩy viên lên mặt */}
      <div
        style={{
          position: "absolute",
          left: Math.round(65 * u),
          right: Math.round(65 * u),
          bottom: Math.round(height * 0.18),
          display: "flex",
          flexDirection: "column",
        }}
      >
        {tags.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: `${Math.round(14 * u)}px ${Math.round(18 * u)}px`,
              padding: `0 ${Math.round(10 * u)}px`,
              marginBottom: Math.round(-18 * u),
              position: "relative",
              zIndex: 1,
            }}
          >
            {tags.slice(0, 3).map((tag, i) => (
              <div
                key={i}
                style={{
                  transform: `rotate(${PILL_ROTATE[i]}deg)`,
                  backgroundColor: pillColor(i),
                  color: colors.text,
                  fontFamily: headingFont,
                  fontWeight: 700,
                  fontSize: Math.round(58 * u),
                  lineHeight: 1.2,
                  padding: `${Math.round(20 * u)}px ${Math.round(42 * u)}px`,
                  borderRadius: 999,
                  whiteSpace: "nowrap",
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        ) : null}

        {text ? (
          <div
            style={{
              backgroundColor: cardColor,
              borderRadius: Math.round(43 * u),
              padding: Math.round(59 * u),
            }}
          >
            <div
              style={{
                fontFamily: headingFont,
                fontWeight: 700,
                fontSize: Math.round(119 * u),
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                color: colors.text,
                textWrap: "balance",
              }}
            >
              {text}
              {needsDot ? <span style={{ color: colors.primary }}>.</span> : null}
            </div>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
