"use client";

/**
 * Card "Timeline bản draft" - xem bản draft trên một trục thời gian: scene, lời
 * nói, SFX, nhạc nền, lỗi QC và ghi chú duyệt draft. Bấm vào đâu tua tới đó.
 *
 * CHỈ ĐỌC + GHI CHÚ, không phải trình dựng: web UI là dashboard giám sát (skill
 * webui-design). Muốn sửa gì thì ghim ghi chú tại đúng giây, gửi cho AI ở card
 * "Duyệt bản draft" - đường sửa đó đã có sẵn và AI còn nguyên ngữ cảnh dựng.
 *
 * Mọi mốc đến từ server đã quy đổi về giây trên video lắp ráp (GET
 * /api/projects/:id/timeline + marks của QC). Web không tự dời mốc transcript -
 * đó chính là cái bẫy lệch trục đã ghi ở QC dead-air.
 */

import { MonitorPlay, Pin, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addReviewNote,
  getProjectTimeline,
  getQcReport,
  getReviewNotes,
  mediaUrl,
  REVIEW_TEXT_MAX,
  type ProjectTimeline,
  type QcReport,
  type QcStatus,
  type ReviewNote,
  type TimelineSceneKind,
} from "@/lib/api";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { IconButton } from "@/components/IconButton";
import { Panel } from "@/components/Panel";
import { clock } from "@/lib/format";
import { useT } from "@/lib/i18n";

/** Màu viền trái của khối scene theo loại - chỉ dùng token có sẵn */
const KIND_COLOR: Record<TimelineSceneKind, string> = {
  hyperframes: "var(--chart-2)",
  footage: "var(--chart-3)",
  image: "var(--secondary)",
  other: "var(--text-muted)",
};

const KIND_KEY: Record<TimelineSceneKind, string> = {
  hyperframes: "timeline.kind-hyperframes",
  footage: "timeline.kind-footage",
  image: "timeline.kind-image",
  other: "timeline.kind-other",
};

/** Một mốc QC đã dàn phẳng từ các check - kèm check nó thuộc về */
interface QcPoint {
  key: string;
  at: number;
  end?: number;
  label: string;
  status: Exclude<QcStatus, "pass">;
  checkLabel: string;
  detail: string;
}

type Selected = { kind: "qc"; point: QcPoint } | { kind: "note"; note: ReviewNote } | null;

/** Bước vạch chia trên thước sao cho có khoảng 6-10 vạch */
function rulerStep(total: number): number {
  for (const s of [1, 2, 5, 10, 15, 30, 60, 120, 300]) if (total / s <= 10) return s;
  return 600;
}

export function ProjectTimelineCard({
  projectId,
  output,
  version,
  width,
  height,
  qcRevision = 0,
  notesRevision = 0,
  seekRequest = null,
  onNotesChanged,
}: {
  projectId: string;
  /** Video final trong meta - fallback khi chưa có draft */
  output?: string | null;
  /** updatedAt của project - cache-bust video + nạp lại timeline */
  version?: string;
  width?: number;
  height?: number;
  /** Tăng lên mỗi lần QC chạy lại -> nạp lại các mốc lỗi */
  qcRevision?: number;
  /** Tăng lên mỗi lần ghi chú đổi ở card khác -> nạp lại ghi chú */
  notesRevision?: number;
  /** Card khác xin tua tới một giây (vd bấm mốc trong danh sách ghi chú) */
  seekRequest?: { at: number; nonce: number } | null;
  onNotesChanged?: () => void;
}) {
  const { t, tf } = useT();
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const tracksRef = useRef<HTMLDivElement>(null);

  // ---- Video: draft trước, không có thì final (cùng quy ước ProjectReviewCard)
  const [draftMissing, setDraftMissing] = useState(false);
  const cacheBust = version ? `?v=${encodeURIComponent(version)}` : "";
  const draftUrl = mediaUrl(`outputs/${projectId}-draft.mp4`) + cacheBust;
  const finalUrl = output ? mediaUrl(output) + cacheBust : null;
  const videoUrl = draftMissing ? finalUrl : draftUrl;
  useEffect(() => {
    setDraftMissing(false);
  }, [projectId, version]);

  // ---- Dữ liệu -------------------------------------------------------------
  const [timeline, setTimeline] = useState<ProjectTimeline | null>(null);
  const [qc, setQc] = useState<{ report: QcReport | null; stale: boolean }>({ report: null, stale: false });
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getProjectTimeline(projectId)
      .then(({ timeline }) => {
        if (!alive) return;
        setTimeline(timeline);
        setLoadError(null);
      })
      .catch((e) => {
        if (alive) setLoadError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [projectId, version]);

  useEffect(() => {
    let alive = true;
    getQcReport(projectId)
      .then((r) => {
        if (alive) setQc({ report: r.report, stale: Boolean(r.stale) });
      })
      .catch(() => {
        if (alive) setQc({ report: null, stale: false });
      });
    return () => {
      alive = false;
    };
  }, [projectId, version, qcRevision]);

  const loadNotes = useCallback(async () => {
    try {
      setNotes((await getReviewNotes(projectId)).notes);
    } catch {
      // Lỗi ghi chú đã có card "Duyệt bản draft" báo - timeline chỉ thiếu ghim
    }
  }, [projectId]);
  useEffect(() => {
    loadNotes();
  }, [loadNotes, notesRevision]);

  const qcPoints = useMemo<QcPoint[]>(() => {
    const out: QcPoint[] = [];
    for (const c of qc.report?.checks ?? []) {
      if (c.status === "pass") continue;
      (c.marks ?? []).forEach((m, i) =>
        out.push({
          key: `${c.id}-${i}`,
          at: m.at,
          end: m.end,
          label: m.label,
          status: c.status as Exclude<QcStatus, "pass">,
          checkLabel: c.label,
          detail: c.detail,
        })
      );
    }
    return out.sort((a, b) => a.at - b.at);
  }, [qc.report]);

  // ---- Đầu phát ------------------------------------------------------------
  const [current, setCurrent] = useState(0);
  const [videoDur, setVideoDur] = useState(0);
  const total = Math.max(timeline?.durationSec ?? 0, videoDur) || 1;
  const pct = (sec: number) => `${Math.min(100, Math.max(0, (sec / total) * 100))}%`;
  const span = (a: number, b: number) => `${Math.max(0.3, ((b - a) / total) * 100)}%`;

  // timeupdate chỉ bắn ~4 lần/giây - vạch đầu phát giật cục. Đang phát thì bám
  // theo từng khung hình, dừng thì thôi (không tốn CPU khi đứng yên).
  const rafRef = useRef<number | null>(null);
  const follow = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setCurrent(v.currentTime);
    if (!v.paused && !v.ended) rafRef.current = requestAnimationFrame(follow);
  }, []);
  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  const seek = useCallback((sec: number, play = false) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, sec);
    setCurrent(v.currentTime);
    if (play) void v.play().catch(() => {});
  }, []);

  // Card khác xin tua -> tua + cuộn card vào tầm mắt
  useEffect(() => {
    if (!seekRequest) return;
    seek(seekRequest.at, true);
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [seekRequest, seek]);

  function onTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    const box = tracksRef.current?.getBoundingClientRect();
    // Bấm vào cột nhãn bên trái thì bỏ qua - chỉ vùng làn mới là trục thời gian
    if (!box || box.width <= 0 || e.clientX < box.left) return;
    seek(((e.clientX - box.left) / box.width) * total);
    setSelected(null);
  }

  /** Nút trong làn: làm việc của nó rồi chặn không cho khối làn tua đè lên */
  const act = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  // ---- Chọn mốc + ghim ghi chú --------------------------------------------
  const [selected, setSelected] = useState<Selected>(null);
  const [pin, setPin] = useState<{ at: number; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function savePin() {
    if (!pin || !pin.text.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await addReviewNote(projectId, pin.at, pin.text.trim());
      setPin(null);
      await loadNotes();
      onNotesChanged?.();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const portrait = (height ?? 1920) > (width ?? 1080);
  const step = rulerStep(total);
  const ticks: number[] = [];
  for (let s = 0; s <= total + 0.001; s += step) ticks.push(s);

  /** Nhãn + làn - hai cột thẳng hàng nhau */
  const lane = (label: string, body: React.ReactNode, empty?: string) => (
    <div className="flex items-center gap-3">
      <span className="w-[88px] shrink-0 text-meta text-[var(--text-muted)]">{label}</span>
      <div className="relative h-7 min-w-0 flex-1 rounded-[var(--radius)] bg-[var(--bg-subtle)]">
        {body}
        {empty && (
          <span className="absolute inset-0 flex items-center px-2 text-meta text-[var(--text-muted)]">
            {empty}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div ref={cardRef}>
      <Card
        title={t("timeline.title")}
        hint={{ titleKey: "help.timeline.title", bodyKey: "help.timeline.body" }}
        actions={
          qc.stale ? <Badge tone="muted" label={t("timeline.qc-stale")} dot={false} /> : undefined
        }
      >
        {loadError && (
          <div className="mb-3">
            <ErrorBanner message={t("timeline.load-error")} detail={loadError} />
          </div>
        )}

        {!videoUrl ? (
          <EmptyState icon={MonitorPlay} description={t("review.no-draft")} />
        ) : (
          <div className="flex flex-wrap items-start gap-4">
            <video
              ref={videoRef}
              controls
              src={videoUrl}
              onError={() => setDraftMissing(true)}
              onLoadedMetadata={(e) => setVideoDur(e.currentTarget.duration || 0)}
              onPlay={() => {
                if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
                rafRef.current = requestAnimationFrame(follow);
              }}
              onSeeked={(e) => setCurrent(e.currentTarget.currentTime)}
              onTimeUpdate={(e) => {
                if (e.currentTarget.paused) setCurrent(e.currentTarget.currentTime);
              }}
              className={`shrink-0 rounded-[var(--radius)] bg-[var(--bg-subtle)] ${
                portrait ? "h-[360px] w-auto" : "w-[480px] max-w-full"
              }`}
            />

            <div className="flex min-w-[320px] flex-1 flex-col gap-3">
              {/* Thước thời gian + các làn. Cột nhãn bên trái, vùng làn bên phải
                  là một khối duy nhất để vạch đầu phát xuyên qua mọi làn. */}
              <div className="flex gap-3">
                <div className="w-[88px] shrink-0" />
                <div className="relative h-5 min-w-0 flex-1">
                  {ticks.map((s, i) => (
                    <span
                      key={s}
                      // Vạch đầu canh trái, vạch cuối canh phải - canh giữa thì hai
                      // nhãn ở mép bị cắt mất nửa
                      className={`absolute top-0 text-meta text-[var(--text-muted)] ${
                        i === 0 ? "" : i === ticks.length - 1 && s >= total - step / 2 ? "-translate-x-full" : "-translate-x-1/2"
                      }`}
                      style={{ left: pct(s) }}
                    >
                      {clock(s)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative flex cursor-pointer flex-col gap-1" onClick={onTrackClick}>
                {/* Vùng làn (để đo vị trí bấm) + vạch đầu phát, căn đúng cột làn:
                    88px nhãn + 12px gap. Nằm TRÊN các làn nhưng không bắt chuột. */}
                <div
                  ref={tracksRef}
                  className="pointer-events-none absolute inset-y-0 left-[100px] right-0 z-10"
                >
                  <div
                    className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-[var(--primary)]"
                    style={{ left: pct(current) }}
                  />
                </div>

                {lane(
                  t("timeline.lane-scenes"),
                  timeline?.scenes.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={act(() => seek(s.start))}
                      title={`${s.id} · ${t(KIND_KEY[s.kind])}${s.muted ? ` · ${t("timeline.muted")}` : ""} · ${clock(s.start)}-${clock(s.end)}`}
                      className="absolute inset-y-0 truncate rounded-[var(--radius)] border border-l-[3px] border-[var(--border)] bg-[var(--surface)] px-2 text-left text-meta"
                      style={{ left: pct(s.start), width: span(s.start, s.end), borderLeftColor: KIND_COLOR[s.kind] }}
                    >
                      {s.id}
                    </button>
                  )),
                  timeline && timeline.scenes.length === 0 ? t("timeline.no-scenes") : undefined
                )}

                {lane(
                  t("timeline.lane-speech"),
                  timeline?.speech.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={act(() => seek(p.start))}
                      title={`${clock(p.start)} · ${p.text}`}
                      className="absolute inset-y-1 truncate rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-1 text-left text-meta text-[var(--text-muted)]"
                      style={{ left: pct(p.start), width: span(p.start, p.end) }}
                    >
                      {p.text}
                    </button>
                  )),
                  timeline && timeline.speech.length === 0 ? t("timeline.no-speech") : undefined
                )}

                {lane(
                  "SFX",
                  timeline?.sfx.map((x, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={act(() => seek(x.at))}
                      title={`${clock(x.at)} · ${x.label}`}
                      aria-label={`${x.label} ${clock(x.at)}`}
                      className="absolute inset-y-1 w-1 -translate-x-1/2 rounded-full bg-[var(--secondary)]"
                      style={{ left: pct(x.at) }}
                    />
                  )),
                  timeline && timeline.sfx.length === 0 ? t("timeline.no-sfx") : undefined
                )}

                {lane(
                  t("timeline.lane-music"),
                  timeline?.music ? (
                    <div
                      className="absolute inset-y-1 truncate rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-2 text-meta text-[var(--text-muted)]"
                      style={{ left: pct(timeline.music.start), width: span(timeline.music.start, timeline.music.end) }}
                      title={timeline.music.label}
                    >
                      {timeline.music.ducks.map(([a, b], i) => (
                        <span
                          key={i}
                          className="absolute inset-y-0 bg-[var(--border)]"
                          style={{ left: pct(a), width: span(a, b) }}
                          title={t("timeline.duck")}
                        />
                      ))}
                      <span className="relative">{timeline.music.label}</span>
                    </div>
                  ) : null,
                  timeline && !timeline.music ? t("timeline.no-music") : undefined
                )}

                {lane(
                  t("timeline.lane-qc"),
                  qcPoints.map((p) =>
                    p.end !== undefined && p.end - p.at > 0.2 ? (
                      <button
                        key={p.key}
                        type="button"
                        onClick={act(() => {
                          seek(p.at);
                          setSelected({ kind: "qc", point: p });
                        })}
                        title={`${clock(p.at)} · ${p.label}`}
                        className="absolute inset-y-2 rounded-full border border-[var(--danger)] bg-[var(--danger-bg)]"
                        style={{ left: pct(p.at), width: span(p.at, p.end) }}
                      />
                    ) : (
                      <button
                        key={p.key}
                        type="button"
                        onClick={act(() => {
                          seek(p.at);
                          setSelected({ kind: "qc", point: p });
                        })}
                        title={`${clock(p.at)} · ${p.label}`}
                        className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--danger)] ${
                          p.status === "fail" ? "bg-[var(--danger)]" : "bg-[var(--surface)]"
                        }`}
                        style={{ left: pct(p.at) }}
                      />
                    )
                  ),
                  !qc.report ? t("timeline.no-qc") : qcPoints.length === 0 ? t("timeline.qc-clean") : undefined
                )}

                {lane(
                  t("timeline.lane-notes"),
                  notes.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={act(() => {
                        seek(n.atSec);
                        setSelected({ kind: "note", note: n });
                      })}
                      title={`${clock(n.atSec)} · ${n.text}`}
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: pct(n.atSec),
                        color: n.status === "resolved" ? "var(--success)" : "var(--primary)",
                      }}
                    >
                      <Pin size={14} strokeWidth={2} />
                    </button>
                  )),
                  notes.length === 0 ? t("timeline.no-notes") : undefined
                )}
              </div>

              {timeline?.unresolvedFrom && (
                <p className="text-meta text-[var(--text-muted)]">
                  {tf("timeline.unresolved", { id: timeline.unresolvedFrom })}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  small
                  onClick={() => {
                    setPin({ at: videoRef.current?.currentTime ?? current, text: "" });
                    setSaveError(null);
                  }}
                >
                  <Pin size={14} strokeWidth={2} />
                  {tf("review.pin-at", { time: clock(current) })}
                </Button>
                {timeline?.speechSource && (
                  <span className="min-w-0 truncate text-meta text-[var(--text-muted)]">
                    {tf("timeline.speech-source", {
                      source: timeline.speechSource === "captions" ? t("timeline.from-captions") : timeline.speechSource,
                    })}
                  </span>
                )}
              </div>

              {selected && (
                <Panel
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[var(--primary)]">
                        {clock(selected.kind === "qc" ? selected.point.at : selected.note.atSec)}
                      </span>
                      {selected.kind === "qc" ? selected.point.label : t("timeline.lane-notes")}
                      {selected.kind === "qc" && (
                        <Badge
                          tone={selected.point.status === "fail" ? "danger" : "muted"}
                          label={t(selected.point.status === "fail" ? "qc.status-fail" : "qc.status-warn")}
                        />
                      )}
                    </span>
                  }
                  actions={
                    <IconButton label={t("common.close")} size="sm" onClick={() => setSelected(null)}>
                      <X size={14} strokeWidth={2} />
                    </IconButton>
                  }
                >
                  {selected.kind === "qc" ? (
                    <>
                      <p className="text-meta text-[var(--text-muted)]">
                        {selected.point.checkLabel}: {selected.point.detail}
                      </p>
                      <div>
                        <Button
                          small
                          variant="secondary"
                          onClick={() =>
                            setPin({
                              at: selected.point.at,
                              text: `[QC] ${selected.point.label} - ${selected.point.checkLabel}`,
                            })
                          }
                        >
                          <Pin size={13} strokeWidth={2} />
                          {t("timeline.pin-from-qc")}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="whitespace-pre-line text-sm">{selected.note.text}</p>
                  )}
                </Panel>
              )}

              {pin && (
                <Panel
                  title={<span className="font-mono text-[var(--primary)]">{clock(pin.at)}</span>}
                  actions={
                    <IconButton label={t("common.close")} size="sm" onClick={() => setPin(null)}>
                      <X size={14} strokeWidth={2} />
                    </IconButton>
                  }
                >
                  <textarea
                    className="input"
                    rows={2}
                    autoFocus
                    maxLength={REVIEW_TEXT_MAX}
                    value={pin.text}
                    placeholder={t("review.note-placeholder")}
                    onChange={(e) => setPin({ ...pin, text: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        savePin();
                      } else if (e.key === "Escape") {
                        setPin(null);
                      }
                    }}
                  />
                  {saveError && <ErrorBanner message={t("review.action-error")} detail={saveError} />}
                  <div className="flex justify-end">
                    <Button small disabled={saving || !pin.text.trim()} onClick={savePin}>
                      <Pin size={13} strokeWidth={2} />
                      {t("review.add")}
                    </Button>
                  </div>
                </Panel>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
