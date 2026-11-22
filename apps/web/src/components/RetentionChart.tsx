"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

/**
 * Đường "còn người xem theo giây": mỗi video một đường qua 0s (100%), 2s, 5s,
 * 10s. SVG thuần, đo bề rộng theo container (ResizeObserver) để 1 unit = 1 px
 * thật - cùng lý do với TokenTimelineChart. Màu đi qua token, không hex.
 */

export interface RetentionSeries {
  id: string;
  label: string;
  /** Tỷ lệ 0..1 ở 2s / 5s / 10s; null = chưa đo */
  s2: number | null;
  s5: number | null;
  s10: number | null;
}

const H = 240;
const PAD_L = 40;
const PAD_R = 16;
const PAD_T = 12;
const PAD_B = 24;
const X_SECONDS = [0, 2, 5, 10] as const;
const Y_TICKS = [0, 0.25, 0.5, 0.75, 1] as const;

/** Thứ tự cố định; vượt quá thì lặp lại và xám cuối cùng làm nền. */
const SERIES_COLORS = [
  "var(--primary)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--secondary)",
  "var(--text-muted)",
] as const;

export function RetentionChart({
  series,
  goal,
}: {
  series: RetentionSeries[];
  /** Mục tiêu ở giây 2 (0..1) - vẽ đường đứt ngang */
  goal: number;
}) {
  const { t } = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(240, el.clientWidth)));
    ro.observe(el);
    setWidth(Math.max(240, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const plotW = width - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const x = (sec: number) => PAD_L + (sec / 10) * plotW;
  const y = (v: number) => PAD_T + (1 - v) * plotH;

  const lines = series.map((s, i) => {
    const pts: Array<[number, number]> = [[0, 1]];
    if (s.s2 !== null) pts.push([2, s.s2]);
    if (s.s5 !== null) pts.push([5, s.s5]);
    if (s.s10 !== null) pts.push([10, s.s10]);
    return { ...s, color: SERIES_COLORS[i % SERIES_COLORS.length], pts };
  });

  return (
    <div>
      <div ref={wrapRef} className="w-full">
        <svg width={width} height={H} role="img" aria-label={t("cs.chart.aria")}>
          {Y_TICKS.map((v) => (
            <g key={v}>
              <line
                x1={PAD_L}
                x2={width - PAD_R}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={PAD_L - 8}
                y={y(v) + 4}
                textAnchor="end"
                className="fill-[var(--text-muted)] text-xs"
              >
                {Math.round(v * 100)}%
              </text>
            </g>
          ))}
          {X_SECONDS.map((sec) => (
            <text
              key={sec}
              x={x(sec)}
              y={H - 6}
              textAnchor={sec === 0 ? "start" : sec === 10 ? "end" : "middle"}
              className="fill-[var(--text-muted)] text-xs"
            >
              {sec}s
            </text>
          ))}
          <line
            x1={PAD_L}
            x2={width - PAD_R}
            y1={y(goal)}
            y2={y(goal)}
            stroke="var(--text-muted)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <text
            x={width - PAD_R - 4}
            y={y(goal) - 6}
            textAnchor="end"
            className="fill-[var(--text-muted)] text-xs"
          >
            {t("cs.chart.goal")} {Math.round(goal * 100)}%
          </text>
          {lines.map((l) => (
            <g key={l.id}>
              <polyline
                points={l.pts.map(([sec, v]) => `${x(sec)},${y(v)}`).join(" ")}
                fill="none"
                stroke={l.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {l.pts.map(([sec, v]) => (
                <circle key={sec} cx={x(sec)} cy={y(v)} r={3.5} fill={l.color} />
              ))}
            </g>
          ))}
        </svg>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {lines.map((l) => (
          <li key={l.id} className="flex min-w-0 items-center gap-2 text-meta text-[var(--text-muted)]">
            <span
              className="inline-block h-0.5 w-4 shrink-0 rounded-full"
              style={{ background: l.color }}
              aria-hidden="true"
            />
            <span className="truncate" title={l.label}>
              {l.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
