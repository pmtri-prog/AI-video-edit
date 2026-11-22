import React from "react";
import {
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Music, MusicSection } from "../manifest";

/** Thời gian chuyển mượt quanh mỗi biên speech range (giây). */
const DUCK_RAMP_SEC = 0.4;
/** Fade-in nhạc đầu video (giây). */
const FADE_IN_SEC = 0.5;
/** Fade-out nhạc cuối video (giây). */
const FADE_OUT_SEC = 1;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Một bài nhạc phát trong cửa sổ [startF, endF) của timeline, auto-ducking TẤT
 * ĐỊNH theo speech ranges (không Math.random/Date):
 * - Trong speech range → duckVolume, ngoài → volume; chuyển mượt 0.4s quanh biên.
 * - Fade-in `fadeInF` frame đầu cửa sổ, fade-out `fadeOutF` frame cuối cửa sổ.
 * - `loop` để bài ngắn hơn cửa sổ tự lặp.
 */
const MusicWindow: React.FC<{
  music: Music;
  startF: number;
  endF: number;
  fadeInF: number;
  fadeOutF: number;
}> = ({ music, startF, endF, fadeInF, fadeOutF }) => {
  const { fps } = useVideoConfig();
  // Frame trong Sequence là TƯƠNG ĐỐI - cộng startF để so với speech ranges
  // (giây tuyệt đối). Không dùng tham số của volume callback vì với `loop`
  // Remotion đếm lại frame theo từng vòng lặp, ducking sẽ lệch từ vòng thứ hai.
  const frame = useCurrentFrame() + startF;

  const half = Math.max(1, DUCK_RAMP_SEC * fps) / 2;
  let duckAmount = 0;
  for (const [startSec, endSec] of music.speech) {
    const s = startSec * fps;
    const e = endSec * fps;
    if (e <= s) continue;
    const rampIn = interpolate(frame, [s - half, s + half], [0, 1], clamp);
    const rampOut = interpolate(frame, [e - half, e + half], [1, 0], clamp);
    duckAmount = Math.max(duckAmount, Math.min(rampIn, rampOut));
  }
  const level = music.volume + (music.duckVolume - music.volume) * duckAmount;
  const fadeIn = interpolate(frame, [startF, startF + Math.max(1, fadeInF)], [0, 1], clamp);
  const fadeOut = interpolate(frame, [endF - 1 - Math.max(1, fadeOutF), endF - 1], [1, 0], clamp);
  const vol = Math.max(0, level * Math.min(fadeIn, fadeOut));

  return <Audio src={staticFile(music.file)} loop volume={() => vol} />;
};

/** Nhạc nền một bài cho cả video. */
export const MusicTrack: React.FC<{ music: Music }> = ({ music }) => {
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <Sequence from={0} durationInFrames={durationInFrames} layout="none">
      <MusicWindow
        music={music}
        startF={0}
        endF={durationInFrames}
        fadeInF={FADE_IN_SEC * fps}
        fadeOutF={FADE_OUT_SEC * fps}
      />
    </Sequence>
  );
};

/**
 * Nhạc theo đoạn: mỗi đoạn một bài phát từ đầu bài. Biên giữa hai đoạn đè lên
 * nhau `crossfade` giây (mỗi bên nửa khoảng) - bài trước nhỏ dần, bài sau to dần.
 * Đầu và cuối video dùng fade như nhạc cả bài.
 */
export const MusicSectionsTrack: React.FC<{ sections: MusicSection[] }> = ({ sections }) => {
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <>
      {sections.map((s, i) => {
        const xf = s.crossfade * fps;
        const atStart = s.from <= 0.05;
        const atEnd = s.to * fps >= durationInFrames - 1;
        const startF = Math.max(0, Math.round(s.from * fps - (atStart ? 0 : xf / 2)));
        const endF = Math.min(durationInFrames, Math.round(s.to * fps + (atEnd ? 0 : xf / 2)));
        if (endF - startF < 2) return null;
        return (
          <Sequence key={`${i}-${s.file}`} from={startF} durationInFrames={endF - startF} layout="none">
            <MusicWindow
              music={s}
              startF={startF}
              endF={endF}
              fadeInF={atStart ? FADE_IN_SEC * fps : xf}
              fadeOutF={atEnd ? FADE_OUT_SEC * fps : xf}
            />
          </Sequence>
        );
      })}
    </>
  );
};
