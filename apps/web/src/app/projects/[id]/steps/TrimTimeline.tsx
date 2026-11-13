"use client";

/**
 * Timeline sóng âm để CẮT TAY ở Bước 1.
 *
 * Vì sao có: máy đo khoảng lặng dùng transcript làm hàng rào, mà Whisper hay
 * kéo mốc chữ phủ cả khoảng lặng phía sau → máy không dám cắt những chỗ im thật
 * (đo thật: video 56s chỉ cắt được 0,4s). Ở đây người dùng NHÌN sóng âm, NGHE,
 * rồi tự chọn đoạn - server cắt nguyên văn các đoạn này (manualCuts).
 *
 * Thao tác: kéo trên sóng âm = chọn đoạn cắt; bấm chỗ trống = tua video tới đó;
 * bấm một đoạn = chọn nó (kéo hai mép để chỉnh, Delete để xóa).
 */

import { Play, Scissors, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import { Segmented } from "@/components/Segmented";

export interface Range {
  start: number;
  end: number;
}

const muted = "text-[var(--text-muted)]";
/** Chừa mỗi mép khoảng im khi tự chọn - đủ để câu không cụt đầu cụt đuôi */
const PAD = 0.08;
/** Canvas quá rộng thì trình duyệt không vẽ - giới hạn an toàn */
const MAX_CANVAS = 30000;

const ts = (sec: number) => {
  const m = Math.floor(sec / 60);
  return `${m}:${(sec - m * 60).toFixed(1).padStart(4, "0")}`;
};

/** Gộp các đoạn chồng/chạm nhau, sắp theo thời gian. */
export function mergeRanges(list: Range[]): Range[] {
  const sorted = list
    .filter((r) => r.end - r.start > 0.02)
    .map((r) => ({ start: Math.max(0, r.start), end: r.end }))
    .sort((a, b) => a.start - b.start);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + 0.01) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out.map((r) => ({ start: Math.round(r.start * 100) / 100, end: Math.round(r.end * 100) / 100 }));
}

/** Khoảng im theo sóng âm: các đỉnh liền nhau dưới ngưỡng dB, dài ít nhất minSec. */
function detectQuiet(peaks: number[], pps: number, thresholdDb: number, minSec: number): Range[] {
  const out: Range[] = [];
  const minBuckets = Math.max(1, Math.round(minSec * pps));
  let runStart = -1;
  for (let i = 0; i <= peaks.length; i++) {
    const quiet = i < peaks.length && 20 * Math.log10(Math.max(peaks[i], 1e-5)) < thresholdDb;
    if (quiet && runStart < 0) runStart = i;
    if (!quiet && runStart >= 0) {
      if (i - runStart >= minBuckets) {
        const start = runStart / pps + PAD;
        const end = i / pps - PAD;
        if (end - start > 0.05) out.push({ start, end });
      }
      runStart = -1;
    }
  }
  return out;
}

const ZOOMS = { out: 40, mid: 80, in: 160 } as const;
type Zoom = keyof typeof ZOOMS;

type Drag =
  | { mode: "new"; t0: number; t1: number; x0: number }
  | { mode: "resize"; idx: number; edge: "start" | "end" };

export function TrimTimeline({
  durationSec,
  peaks,
  peaksPerSec,
  words,
  autoSilences,
  candidates,
  manual,
  onManualChange,
  onToggleCandidate,
  playhead,
  onSeek,
  onPlay,
}: {
  durationSec: number;
  peaks: number[];
  peaksPerSec: number;
  words: Array<{ s: number; e: number; w: string }>;
  /** Khoảng lặng máy sẽ tự cắt (null = đã tắt cắt tự động) */
  autoSilences: Range[] | null;
  candidates: Array<Range & { checked: boolean; label: string }>;
  manual: Range[];
  onManualChange: (next: Range[]) => void;
  onToggleCandidate: (i: number) => void;
  playhead: number;
  onSeek: (t: number) => void;
  onPlay: (start: number, end: number) => void;
}) {
  const [zoom, setZoom] = useState<Zoom>("mid");
  const [thresholdDb, setThresholdDb] = useState(-38);
  const [minSec, setMinSec] = useState(0.35);
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);

  const pps = Math.min(ZOOMS[zoom], MAX_CANVAS / Math.max(1, durationSec));
  const width = Math.max(1, Math.round(durationSec * pps));
  const H = 96;

  const quiet = useMemo(
    () => detectQuiet(peaks, peaksPerSec, thresholdDb, minSec),
    [peaks, peaksPerSec, thresholdDb, minSec],
  );
  const quietSec = quiet.reduce((s, r) => s + r.end - r.start, 0);

  // Vẽ sóng âm - màu lấy từ token để đổi theo theme sáng/tối
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = H * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, H);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text-muted").trim();
    const per = peaksPerSec / pps; // số đỉnh mỗi pixel
    for (let x = 0; x < width; x++) {
      const a = Math.floor(x * per);
      const b = Math.max(a + 1, Math.floor((x + 1) * per));
      let m = 0;
      for (let i = a; i < b && i < peaks.length; i++) if (peaks[i] > m) m = peaks[i];
      const h = Math.max(1, m * (H - 8));
      ctx.fillRect(x, (H - h) / 2, 1, h);
    }
  }, [peaks, peaksPerSec, pps, width]);

  const tAt = (clientX: number) => {
    const el = laneRef.current;
    if (!el) return 0;
    const x = clientX - el.getBoundingClientRect().left;
    return Math.min(durationSec, Math.max(0, x / pps));
  };

  function onDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const t = tAt(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ mode: "new", t0: t, t1: t, x0: e.clientX });
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const t = tAt(e.clientX);
    if (drag.mode === "new") {
      setDrag({ ...drag, t1: t });
    } else {
      const next = manual.map((r, i) =>
        i !== drag.idx
          ? r
          : drag.edge === "start"
            ? { start: Math.min(t, r.end - 0.05), end: r.end }
            : { start: r.start, end: Math.max(t, r.start + 0.05) },
      );
      onManualChange(next);
    }
  }

  function onUp(e: PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    if (drag.mode === "new") {
      const moved = Math.abs(e.clientX - drag.x0) > 4;
      if (!moved) {
        // Bấm: trúng đoạn đã chọn thì chọn nó, không thì tua video tới đó
        const t = drag.t0;
        const hit = manual.findIndex((r) => t >= r.start && t <= r.end);
        if (hit >= 0) setSelected(hit);
        else {
          setSelected(null);
          onSeek(t);
        }
      } else {
        const r = { start: Math.min(drag.t0, drag.t1), end: Math.max(drag.t0, drag.t1) };
        const next = mergeRanges([...manual, r]);
        onManualChange(next);
        setSelected(next.findIndex((x) => x.start <= r.start + 0.01 && x.end >= r.end - 0.01));
      }
    } else {
      onManualChange(mergeRanges(manual));
    }
    setDrag(null);
  }

  function removeSelected() {
    if (selected === null) return;
    onManualChange(manual.filter((_, i) => i !== selected));
    setSelected(null);
  }

  const sel = selected !== null ? manual[selected] : null;
  const pending = drag?.mode === "new" && Math.abs(drag.t1 - drag.t0) * pps > 4 ? drag : null;
  const tickStep = pps >= 120 ? 1 : pps >= 60 ? 2 : 5;
  const manualSec = manual.reduce((s, r) => s + r.end - r.start, 0);

  // Ước bề rộng chữ 12px ~ 7px/ký tự + 6px khoảng cách
  const visibleWords = useMemo(() => {
    const out: typeof words = [];
    let nextFree = -Infinity;
    for (const w of words) {
      const x = w.s * pps;
      if (!w.w || x < nextFree) continue;
      out.push(w);
      nextFree = x + w.w.length * 7 + 6;
    }
    return out;
  }, [words, pps]);

  const box = (r: Range) => ({ left: r.start * pps, width: Math.max(1, (r.end - r.start) * pps) });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Thu phóng timeline"
          value={zoom}
          onChange={setZoom}
          options={[
            { value: "out", label: "Thu nhỏ" },
            { value: "mid", label: "Vừa" },
            { value: "in", label: "Phóng to" },
          ]}
        />
        <label className="flex items-center gap-2 text-sm">
          Ngưỡng im
          <input
            type="range"
            className="slider w-32"
            min={-60}
            max={-20}
            value={thresholdDb}
            onChange={(e) => setThresholdDb(Number(e.target.value))}
            aria-label="Ngưỡng im (dB)"
          />
          <span className="w-14 text-meta tabular-nums">{thresholdDb} dB</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Dài từ
          <input
            type="number"
            className="input w-20"
            min={0.1}
            max={3}
            step={0.05}
            value={minSec}
            onChange={(e) => setMinSec(Math.max(0.1, Number(e.target.value) || 0.1))}
          />
          giây
        </label>
        <Button
          variant="secondary"
          small
          disabled={quiet.length === 0}
          onClick={() => onManualChange(mergeRanges([...manual, ...quiet]))}
        >
          <Scissors size={14} /> Chọn cắt hết {quiet.length} khoảng im ({quietSec.toFixed(1)}s)
        </Button>
        {manual.length > 0 && (
          <Button
            variant="secondary"
            small
            onClick={() => {
              onManualChange([]);
              setSelected(null);
            }}
          >
            Bỏ hết đoạn đã chọn
          </Button>
        )}
      </div>

      <div
        className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] focus:outline-none"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === "Delete" || e.key === "Backspace") && selected !== null) {
            e.preventDefault();
            removeSelected();
          }
        }}
      >
        <div className="relative select-none" style={{ width }}>
          {/* Thước giây */}
          <div className="relative h-5 border-b border-[var(--border)]">
            {Array.from({ length: Math.floor(durationSec / tickStep) + 1 }, (_, k) => k * tickStep).map((t) => (
              <span
                key={t}
                className={`absolute top-0 border-l border-[var(--border)] pl-1 text-xs ${muted}`}
                style={{ left: t * pps }}
              >
                {ts(t).replace(/\.0$/, "")}
              </span>
            ))}
          </div>

          {/* Dải báo hiệu: máy tự cắt / chỗ nói thừa / khoảng im theo sóng âm */}
          <div className="relative h-2">
            {(autoSilences ?? []).map((r, i) => (
              <span key={`a${i}`} className="absolute inset-y-0 bg-[var(--danger)]" style={box(r)} />
            ))}
          </div>

          {/* Làn chính: kéo để chọn */}
          <div
            ref={laneRef}
            className="relative cursor-crosshair"
            style={{ height: H }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
          >
            {quiet.map((r, i) => (
              <span
                key={`q${i}`}
                className="absolute inset-y-0 border-x border-dashed border-[var(--border)] bg-[var(--bg-subtle)]"
                style={box(r)}
              />
            ))}
            {candidates.map((c, i) => (
              <button
                type="button"
                key={`c${i}`}
                title={`${c.label} - bấm để ${c.checked ? "bỏ cắt" : "cắt"}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onToggleCandidate(i)}
                className={`absolute bottom-0 h-3 ${c.checked ? "bg-[var(--secondary)]" : "border border-[var(--secondary)]"}`}
                style={box(c)}
              />
            ))}
            {manual.map((r, i) => (
              <span
                key={`m${i}`}
                className={`absolute inset-y-0 border-[var(--primary)] bg-[var(--primary-soft)] ${
                  selected === i ? "border-2" : "border"
                }`}
                style={box(r)}
              >
                {selected === i &&
                  (["start", "end"] as const).map((edge) => (
                    <span
                      key={edge}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        laneRef.current?.setPointerCapture(e.pointerId);
                        setDrag({ mode: "resize", idx: i, edge });
                      }}
                      className={`absolute inset-y-0 w-2 cursor-ew-resize bg-[var(--primary)] ${
                        edge === "start" ? "-left-1" : "-right-1"
                      }`}
                    />
                  ))}
              </span>
            ))}
            {pending && (
              <span
                className="absolute inset-y-0 border-2 border-dashed border-[var(--primary)]"
                style={box({ start: Math.min(pending.t0, pending.t1), end: Math.max(pending.t0, pending.t1) })}
              />
            )}
            {/* Sóng âm vẽ ĐÈ lên các vùng màu để vẫn thấy sóng bên trong đoạn đã chọn */}
            <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" style={{ width, height: H }} />
            <span
              className="pointer-events-none absolute inset-y-0 w-px bg-[var(--primary)]"
              style={{ left: playhead * pps }}
            />
          </div>

          {/* Chữ đã nói - bấm để tua tới chữ đó. Chữ nào sẽ đè lên chữ trước thì
              ẩn (thu nhỏ thấy thưa chữ, phóng to thấy đủ) thay vì cắt cụt thành "m.m..." */}
          {visibleWords.length > 0 && (
            <div className="relative h-6 border-t border-[var(--border)]">
              {visibleWords.map((w, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => onSeek(w.s)}
                  className="absolute top-1 whitespace-nowrap text-left text-xs hover:text-[var(--primary)]"
                  style={{ left: w.s * pps }}
                  title={`${ts(w.s)} ${w.w}`}
                >
                  {w.w}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`flex flex-wrap items-center gap-4 text-meta ${muted}`}>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border-2 border-[var(--primary)] bg-[var(--primary-soft)]" /> Bạn chọn cắt
        </span>
        {autoSilences && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-3 bg-[var(--danger)]" /> Máy tự cắt (khoảng lặng)
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 bg-[var(--secondary)]" /> Chỗ nói thừa (bấm để bật/tắt)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 border border-dashed border-[var(--border)] bg-[var(--bg-subtle)]" /> Khoảng im theo
          sóng âm
        </span>
        <span>Kéo trên sóng âm để chọn · bấm chỗ trống để tua · Delete để xóa đoạn đang chọn</span>
      </div>

      {sel && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            Đoạn đang chọn: <span className="tabular-nums">{ts(sel.start)} → {ts(sel.end)}</span> (
            {(sel.end - sel.start).toFixed(2)}s)
          </span>
          <Button variant="secondary" small onClick={() => onPlay(sel.start, sel.end)}>
            <Play size={14} /> Nghe đoạn này
          </Button>
          <IconButton label="Xóa đoạn này" size="sm" tone="danger" onClick={removeSelected}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      )}
      <p className={`text-meta ${muted}`}>
        Đã chọn {manual.length} đoạn · {manualSec.toFixed(1)}s. Đoạn bạn chọn được cắt đúng y như chọn, không bị máy chặn.
      </p>
    </div>
  );
}
