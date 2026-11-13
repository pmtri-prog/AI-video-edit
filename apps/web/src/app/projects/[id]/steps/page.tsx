"use client";

/**
 * BẢN THỬ luồng "duyệt từng bước" trên một video project THẬT.
 *
 * Bước 0 (tải video thô) và Bước 1 (bóc lời → đo khoảng lặng + chỗ nói thừa →
 * người duyệt từng chỗ → cắt) chạy thật qua backend. Bước 2–6 vẫn là giao diện
 * mô phỏng của /mockup/step-flow. Trạng thái "đã duyệt" của từng bước tạm lưu ở
 * localStorage - khi chốt luồng sẽ chuyển xuống meta.json của project.
 */

import { Check, Film, Play, RotateCcw, Scissors, Upload } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  AUTO_CUT_LEVELS,
  analyzeAutoTrim,
  applyAutoTrim,
  getAutoTrimReport,
  getJobs,
  getProject,
  getTrimWaveform,
  mediaUrl,
  transcribeProject,
  uploadAsset,
  type AutoTrimReport,
  type DeadWeightCandidate,
  type DeadWeightKind,
  type FileInfo,
  type Job,
  type ProjectDetail,
  type TrimAggressiveness,
  type TrimAnalyzeResult,
  type TrimWaveform,
} from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useJobEvents, useUploadEvents } from "@/lib/useEvents";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { AUTO_CUT_LEVEL_LABEL } from "@/components/BriefFields";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { SwitchField } from "@/components/Field";
import { IconButton } from "@/components/IconButton";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader } from "@/components/PageHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { Segmented } from "@/components/Segmented";
import { StatTile } from "@/components/StatTile";
import {
  MusicStep,
  PublishStep,
  SubtitleStep,
  ThumbnailStep,
  type SubPreset,
  type ThumbLayout,
} from "@/app/mockup/step-flow/steps";
import { Frame, STEP_STATUS, Stepper, type StepStatus } from "@/app/mockup/step-flow/ui";
import { IllustrateReal } from "./IllustrateReal";
import { TrimTimeline, type Range } from "./TrimTimeline";

const NAMES = [
  "Đầu vào",
  "Cắt thô",
  "Minh họa",
  "Phụ đề & chữ",
  "Nhạc nền",
  "Thumbnail",
  "Duyệt & xuất bản",
] as const;

const KIND_LABEL: Record<DeadWeightKind, string> = {
  filler: "Từ đệm",
  stutter: "Nói lắp",
  "repeat-take": "Câu nói lại",
  hesitation: "Ngập ngừng",
};

const muted = "text-[var(--text-muted)]";

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Giây → "1:05.3" */
function ts(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

/** Giây → "2:31" */
function dur(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const isActive = (j: Job | undefined | null) => !!j && (j.status === "queued" || j.status === "running");

// ======================= Trạng thái duyệt (localStorage) =======================

interface StepState {
  approved: number[];
  stale: number[];
}

function useStepState(id: string) {
  const key = `aiev-steps-${id}`;
  const [state, setState] = useState<StepState>({ approved: [], stale: [] });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setState(JSON.parse(raw) as StepState);
    } catch {
      // hỏng thì coi như chưa duyệt gì
    }
  }, [key]);
  const save = useCallback(
    (next: StepState) => {
      setState(next);
      localStorage.setItem(key, JSON.stringify(next));
    },
    [key],
  );
  return [state, save] as const;
}

// =================================== Trang ===================================

export default function StepsPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [report, setReport] = useState<AutoTrimReport | null>(null);
  const [current, setCurrent] = useState(0);
  const [steps, saveSteps] = useStepState(id);
  const [sourceRel, setSourceRel] = useState<string | null>(null);
  const [preview, setPreview] = useState<"source" | "cut" | "draft">("source");
  /** Vị trí đang phát của video GỐC - cho vạch chạy trên timeline cắt tay */
  const [playhead, setPlayhead] = useState(0);
  // state của các bước mô phỏng
  const [subPreset, setSubPreset] = useState<SubPreset>("pop");
  const [hl, setHl] = useState("#ffd23f");
  const [thumbFrame, setThumbFrame] = useState(1);
  const [thumbLayout, setThumbLayout] = useState<ThumbLayout>("bottom");

  const videoRef = useRef<HTMLVideoElement>(null);
  const stopAt = useRef<number | null>(null);
  const pendingSeek = useRef<{ at: number; stop: number | null; target: "source" | "cut" } | null>(null);

  const reload = useCallback(() => {
    getProject(id)
      .then((p) => {
        setProject(p);
        setLoadError(null);
      })
      .catch((e) => setLoadError(errText(e)));
  }, [id]);

  useEffect(() => {
    reload();
    getJobs(30, id)
      .then(setJobs)
      .catch(() => {});
  }, [id, reload]);

  // Báo cáo cắt nằm ở /media - tải lại mỗi lần project đổi (updatedAt cache-bust)
  useEffect(() => {
    if (!project) return;
    getAutoTrimReport(id, project.updatedAt).then(setReport);
  }, [id, project]);

  useJobEvents((job) => {
    if (job.projectId !== id) return;
    setJobs((list) => [job, ...list.filter((j) => j.id !== job.id)]);
    if (job.status === "done") reload();
    // Draft vừa dựng xong thì cho xem luôn
    if (job.status === "done" && job.type === "assemble-draft") setPreview("draft");
  });

  const videos = useMemo(
    () => (project?.files.assets ?? []).filter((f) => f.kind === "video" && !/\.cut\./.test(f.name)),
    [project],
  );
  useEffect(() => {
    if (sourceRel || videos.length === 0) return;
    setSourceRel([...videos].sort((a, b) => b.size - a.size)[0].relPath);
  }, [videos, sourceRel]);
  const source = videos.find((v) => v.relPath === sourceRel) ?? null;
  // Đúng hai file auto-trim đọc làm hàng rào (không tính bản .cut đã dời mốc)
  const hasTranscript = (project?.files.assets ?? []).some((f) =>
    /\/assets\/transcript(\.raw)?\.json$/.test(f.relPath),
  );
  const latestOf = (type: Job["type"]) => jobs.find((j) => j.type === type);
  const transcribeJob = latestOf("transcribe");
  const trimJob = latestOf("auto-trim");
  const busy = jobs.some(isActive);
  // Báo cáo chỉ tính khi đúng là của video đang chọn
  const myReport = report && source && report.source === source.relPath ? report : null;
  const cutRel = myReport?.output ?? null;
  const draftJob = latestOf("assemble-draft");
  const lastDraft = jobs.find((j) => j.type === "assemble-draft" && j.status === "done" && j.outputPath);
  const draftRel = lastDraft?.outputPath ?? null;

  const statuses: StepStatus[] = NAMES.map((_, i) => {
    if (steps.stale.includes(i)) return "stale";
    if (steps.approved.includes(i)) return "approved";
    if (i === 0) return "review";
    // Đã có bản cắt hoặc đã duyệt Bước 0 thì Bước 1 đang chờ duyệt, không phải "chưa làm"
    if (i === 1) return busy ? "running" : cutRel || steps.approved.includes(0) ? "review" : "todo";
    if (i === 2) {
      if (isActive(draftJob)) return "running";
      return draftRel || steps.approved.includes(1) ? "review" : "todo";
    }
    return "todo";
  });
  const st = statuses[current];

  function approve() {
    saveSteps({
      approved: [...new Set([...steps.approved, current])],
      stale: steps.stale.filter((x) => x !== current),
    });
    if (current < NAMES.length - 1) setCurrent(current + 1);
  }

  function reopen() {
    // Mở lại: bước này về chờ duyệt, các bước SAU đã duyệt chuyển "cần xem lại"
    const later = steps.approved.filter((x) => x > current);
    saveSteps({
      approved: steps.approved.filter((x) => x < current),
      stale: [...new Set([...steps.stale.filter((x) => x !== current), ...later])],
    });
  }

  /**
   * Nghe một đoạn: lùi 1 giây trước, dừng sau 0,6 giây. `target` = mốc đó tính
   * trên video gốc (Bước 1) hay trên bản đã cắt (Bước 2 trở đi).
   */
  function playRange(start: number, end: number, target: "source" | "cut" = "source") {
    go(Math.max(0, start - 1), end + 0.6, target);
  }

  /** Tua tới giây `t` của video gốc và phát tiếp (bấm trên timeline cắt tay). */
  function seekTo(t: number) {
    go(t, null, "source");
  }

  function go(at: number, stop: number | null, target: "source" | "cut") {
    const want = target === "cut" && cutRel ? "cut" : "source";
    if (preview !== want) {
      pendingSeek.current = { at, stop, target: want };
      setPreview(want);
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = at;
    stopAt.current = stop;
    void v.play();
  }

  const canApprove =
    current === 0 ? !!source : current === 1 ? !!cutRel && !busy : current === 2 ? !!draftRel && !busy : false;

  const previewRel =
    preview === "draft" && draftRel
      ? draftRel
      : preview === "cut" && cutRel
        ? cutRel
        : (source?.relPath ?? null);
  // Draft dựng lại đè cùng tên file - gắn mốc xong job để trình duyệt không giữ bản cũ
  const previewSrc = previewRel
    ? (() => {
        const u = mediaUrl(previewRel);
        const v = preview === "draft" && lastDraft ? (lastDraft.finishedAt ?? lastDraft.id) : null;
        return v ? `${u}${u.includes("?") ? "&" : "?"}v=${encodeURIComponent(v)}` : u;
      })()
    : null;
  const previewOptions = [
    { value: "source" as const, label: "Gốc" },
    ...(cutRel ? [{ value: "cut" as const, label: "Đã cắt" }] : []),
    ...(draftRel ? [{ value: "draft" as const, label: "Draft" }] : []),
  ];

  if (loadError) {
    return <Banner tone="danger" message="Không mở được project" detail={loadError} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={project?.name ?? id}
        subtitle={
          project
            ? `${project.width}×${project.height} · ${project.fps}fps · bản thử luồng duyệt từng bước`
            : undefined
        }
        actions={<LinkButton href={`/projects/${id}`}>Mở trang project cũ</LinkButton>}
      />

      <Banner
        tone="info"
        message="Bản thử: Bước 0, 1, 2 chạy thật trên video của bạn. Bước 3–6 vẫn là giao diện mô phỏng với dữ liệu giả."
      />

      <Stepper names={NAMES} statuses={statuses} current={current} onSelect={setCurrent} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 lg:sticky lg:top-4">
          <Card
            title="Xem trước"
            actions={
              previewOptions.length > 1 ? (
                <Segmented
                  label="Bản xem trước"
                  value={preview}
                  onChange={setPreview}
                  options={previewOptions}
                />
              ) : undefined
            }
          >
            {previewRel ? (
              <video
                key={previewSrc ?? previewRel}
                ref={videoRef}
                src={previewSrc ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="max-h-[70vh] w-full rounded-[var(--radius)] bg-black"
                onLoadedMetadata={() => {
                  const p = pendingSeek.current;
                  if (!p) return;
                  pendingSeek.current = null;
                  go(p.at, p.stop, p.target);
                }}
                onTimeUpdate={(e) => {
                  if (preview === "source") setPlayhead(e.currentTarget.currentTime);
                  if (stopAt.current !== null && e.currentTarget.currentTime >= stopAt.current) {
                    e.currentTarget.pause();
                    stopAt.current = null;
                  }
                }}
              />
            ) : (
              <Frame>
                <span className="px-4 text-center text-sm opacity-60">Chưa có video</span>
              </Frame>
            )}
            {previewRel && (
              <p className={`mt-2 truncate text-meta ${muted}`}>
                {preview === "draft" && draftRel ? "Draft" : preview === "cut" && cutRel ? "Bản đã cắt" : "Bản gốc"} ·{" "}
                {previewRel.split("/").pop()}
              </p>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card
            title={
              <span className="flex items-center gap-2">
                Bước {current} · {NAMES[current]}
                <Badge tone={STEP_STATUS[st].tone} label={STEP_STATUS[st].label} />
              </span>
            }
            actions={
              st === "approved" ? (
                <Button variant="secondary" onClick={reopen}>
                  <RotateCcw size={14} /> Mở lại để sửa
                </Button>
              ) : (
                <Button variant="primary" onClick={approve} disabled={!canApprove}>
                  <Check size={14} /> Duyệt, sang Bước {current + 1}
                </Button>
              )
            }
          >
            <p className="text-sm">
              {current === 0 &&
                (source
                  ? `Video thô: ${source.name} · ${formatBytes(source.size)}. Không có kịch bản - Bước 1 sẽ cắt theo chính lời bạn nói.`
                  : "Tải video thô lên để bắt đầu.")}
              {current === 1 &&
                (cutRel && myReport
                  ? `Đã cắt: ${dur(myReport.duration.beforeSec)} → ${dur(myReport.duration.afterSec ?? myReport.duration.beforeSec)}. Xem bản đã cắt bên trái, ổn thì duyệt.`
                  : "AI bóc lời, đo khoảng lặng và tìm chỗ nói thừa. Bạn nghe và tick từng chỗ muốn cắt rồi bấm Cắt.")}
              {current === 2 &&
                (draftRel
                  ? "Draft đã có minh họa - xem bên trái (nút Draft). Ổn thì duyệt, chưa ổn thì sửa từng minh họa rồi dựng lại."
                  : "AI đề xuất chỗ chèn video, ảnh, motion graphic theo lời bạn nói. Sửa từng cái rồi bấm Dựng draft.")}
              {current >= 3 && "Bước này chưa nối thật - bên dưới là giao diện mô phỏng với dữ liệu giả."}
            </p>
            {current === 1 && !steps.approved.includes(0) && (
              <p className={`mt-2 text-meta ${muted}`}>Bước 0 chưa duyệt - vẫn làm được, nhưng nên duyệt Bước 0 trước.</p>
            )}
          </Card>

          {current === 0 && (
            <SourceStep
              id={id}
              videos={videos}
              sourceRel={sourceRel}
              onPick={(rel) => {
                setSourceRel(rel);
                setPreview("source");
              }}
              onUploaded={(f) => {
                setSourceRel(f.relPath);
                reload();
              }}
            />
          )}
          {current === 1 &&
            (source ? (
              <CutStepReal
                id={id}
                source={source}
                hasTranscript={hasTranscript}
                transcribeJob={transcribeJob}
                trimJob={trimJob}
                busy={busy}
                report={myReport}
                playhead={playhead}
                onSeek={seekTo}
                onPlay={playRange}
                onShowCut={() => setPreview("cut")}
                onJob={(j) => setJobs((list) => [j, ...list])}
              />
            ) : (
              <Banner tone="muted" message="Chưa có video - quay lại Bước 0 để tải video lên." />
            ))}
          {current === 2 && (
            <IllustrateReal
              id={id}
              busy={busy}
              draftJob={draftJob}
              onJob={(j) => setJobs((list) => [j, ...list])}
              onPlay={(a, b) => playRange(a, b, "cut")}
              onShowDraft={() => setPreview("draft")}
            />
          )}
          {current === 3 && (
            <SubtitleStep preset={subPreset} setPreset={setSubPreset} hl={hl} setHl={setHl} />
          )}
          {current === 4 && <MusicStep />}
          {current === 5 && (
            <ThumbnailStep
              frame={thumbFrame}
              setFrame={setThumbFrame}
              layout={thumbLayout}
              setLayout={setThumbLayout}
            />
          )}
          {current === 6 && <PublishStep />}
        </div>
      </div>
    </div>
  );
}

// ================================ Bước 0 · Đầu vào ================================

function SourceStep({
  id,
  videos,
  sourceRel,
  onPick,
  onUploaded,
}: {
  id: string;
  videos: FileInfo[];
  sourceRel: string | null;
  onPick: (rel: string) => void;
  onUploaded: (f: FileInfo) => void;
}) {
  const [uploading, setUploading] = useState<{ name: string; received: number; total: number } | null>(
    null,
  );
  const [err, setErr] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useUploadEvents((e) => {
    if (e.projectId !== id || e.done) return;
    setUploading((u) => (u ? { ...u, received: e.received ?? u.received, total: e.total || u.total } : u));
  });

  async function upload(file: File) {
    if (!file.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name)) {
      setErr(`"${file.name}" không phải file video`);
      return;
    }
    setErr(null);
    setUploading({ name: file.name, received: 0, total: file.size });
    try {
      onUploaded(await uploadAsset(file, "project", id));
    } catch (e) {
      setErr(errText(e));
    } finally {
      setUploading(null);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void upload(f);
  }

  return (
    <>
      <Card
        title="Video thô"
        actions={
          <Button
            variant="secondary"
            small
            onClick={() => inputRef.current?.click()}
            disabled={!!uploading}
          >
            <Upload size={14} /> Chọn video
          </Button>
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed p-6 text-center ${
            over ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)]"
          }`}
        >
          <Film size={24} className={muted} />
          <span className="text-sm">Kéo thả video thô vào đây</span>
          <span className={`text-meta ${muted}`}>MP4, MOV… quay điện thoại để nguyên file gốc, không cần nén</span>
        </div>

        {uploading && (
          <div className="mt-3">
            <ProgressBar
              progress={uploading.total ? (uploading.received / uploading.total) * 100 : 0}
              step={`Đang tải ${uploading.name}`}
            />
          </div>
        )}
        {err && (
          <div className="mt-3">
            <Banner tone="danger" message="Tải lên không được" detail={err} />
          </div>
        )}

        {videos.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            <span className="text-sm">Dùng video nào làm bản thô</span>
            {videos.map((v) => (
              <label
                key={v.relPath}
                className="flex cursor-pointer items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] p-3"
              >
                <input
                  type="radio"
                  className="checkbox"
                  name="source"
                  checked={sourceRel === v.relPath}
                  onChange={() => onPick(v.relPath)}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{v.name}</span>
                <span className={`text-meta ${muted}`}>{formatBytes(v.size)}</span>
              </label>
            ))}
          </div>
        )}
      </Card>

      <Card title="Kịch bản">
        <Banner
          tone="muted"
          message="Video quay ngẫu hứng, không có kịch bản. Bước 1 sẽ cắt dựa trên chính lời bạn nói: bỏ khoảng lặng, từ đệm, câu nói lại, chỗ ngập ngừng - bạn nghe và duyệt từng chỗ trước khi cắt."
        />
      </Card>
    </>
  );
}

// ================================ Bước 1 · Cắt thô ================================

function CutStepReal({
  id,
  source,
  hasTranscript,
  transcribeJob,
  trimJob,
  busy,
  report,
  playhead,
  onSeek,
  onPlay,
  onShowCut,
  onJob,
}: {
  id: string;
  source: FileInfo;
  hasTranscript: boolean;
  transcribeJob: Job | undefined;
  trimJob: Job | undefined;
  busy: boolean;
  report: AutoTrimReport | null;
  playhead: number;
  onSeek: (t: number) => void;
  onPlay: (start: number, end: number) => void;
  onShowCut: () => void;
  onJob: (j: Job) => void;
}) {
  const { t } = useT();
  const [level, setLevel] = useState<TrimAggressiveness>("default");
  const [analysis, setAnalysis] = useState<TrimAnalyzeResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cut, setCut] = useState<boolean[]>([]);
  const [err, setErr] = useState<{ message: string; detail?: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [autoSilence, setAutoSilence] = useState(report?.autoSilence !== false);
  const [wave, setWave] = useState<TrimWaveform | null>(null);
  const [waveErr, setWaveErr] = useState<string | null>(null);
  // Đoạn cắt tay: nháp trong localStorage (chưa bấm Cắt vẫn không mất), lần
  // đầu lấy từ báo cáo của lần cắt trước (server lưu manualCuts trong báo cáo)
  const manualKey = `aiev-manual-cuts-${id}-${source.relPath}`;
  const [manual, setManualState] = useState<Range[]>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(manualKey) : null;
      if (raw) return JSON.parse(raw) as Range[];
    } catch {
      // nháp hỏng thì bỏ
    }
    return report?.manualCuts ?? [];
  });
  const setManual = (next: Range[]) => {
    setManualState(next);
    localStorage.setItem(manualKey, JSON.stringify(next));
  };

  useEffect(() => {
    let alive = true;
    getTrimWaveform(id, source.relPath)
      .then((w) => alive && setWave(w))
      .catch((e) => alive && setWaveErr(errText(e)));
    return () => {
      alive = false;
    };
  }, [id, source.relPath]);

  const analyze = useCallback(
    async (lv: TrimAggressiveness) => {
      setAnalyzing(true);
      setErr(null);
      try {
        const r = await analyzeAutoTrim(id, { source: source.relPath, level: lv });
        setAnalysis(r);
        // Mặc định tick những chỗ AI chắc từ 70% - người dùng nghe rồi bỏ tick
        setCut(r.deadWeight.candidates.map((c) => c.confidence >= 0.7));
      } catch (e) {
        setErr({ message: "Phân tích không được", detail: errText(e) });
      } finally {
        setAnalyzing(false);
      }
    },
    [id, source.relPath],
  );

  // Có transcript mà chưa phân tích thì tự phân tích (đồng bộ, vài giây)
  useEffect(() => {
    if (hasTranscript && !analysis && !analyzing && !busy && !err) void analyze(level);
  }, [hasTranscript, analysis, analyzing, busy, err, analyze, level]);

  async function startTranscribe() {
    setStarting(true);
    setErr(null);
    try {
      const r = await transcribeProject(id, source.relPath);
      onJob(r.job);
      setAnalysis(null);
    } catch (e) {
      setErr({ message: "Không bắt đầu bóc lời được", detail: errText(e) });
    } finally {
      setStarting(false);
    }
  }

  async function applyCut() {
    if (!analysis) return;
    setStarting(true);
    setErr(null);
    try {
      const picked = analysis.deadWeight.candidates
        .filter((_, i) => cut[i])
        .map((c) => ({ start: c.start, end: c.end }));
      const r = await applyAutoTrim(id, {
        source: source.relPath,
        level,
        cutCandidates: picked,
        manualCuts: manual,
        autoSilence,
      });
      onJob(r.job);
    } catch (e) {
      setErr({ message: "Không cắt được", detail: errText(e) });
    } finally {
      setStarting(false);
    }
  }

  const candidates = analysis?.deadWeight.candidates ?? [];
  const pickedSec = candidates.reduce((s, c, i) => s + (cut[i] ? c.end - c.start : 0), 0);
  const pickedCount = cut.filter(Boolean).length;
  const manualSec = manual.reduce((s, r) => s + r.end - r.start, 0);

  // --------------------------- Chưa có transcript ---------------------------
  if (!hasTranscript) {
    const running = isActive(transcribeJob);
    return (
      <Card title="Bóc lời">
        {running && transcribeJob ? (
          <div className="flex flex-col gap-2">
            <ProgressBar progress={transcribeJob.progress} step={transcribeJob.step} />
            <p className={`text-meta ${muted}`}>
              Whisper chạy trên máy, mất khoảng bằng thời lượng video. Có thể rời trang, xong sẽ tự cập nhật.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              AI cần nghe hết video một lượt để biết bạn nói gì - nhờ đó mới tìm được từ đệm, câu nói lại, chỗ
              ngập ngừng, và không cắt vào giữa chữ.
            </p>
            {transcribeJob?.status === "failed" && (
              <Banner tone="danger" message="Lần bóc lời trước bị lỗi - xem log ở Render Queue rồi thử lại." />
            )}
            {err && <Banner tone="danger" message={err.message} detail={err.detail} />}
            <div>
              <Button variant="primary" onClick={startTranscribe} disabled={starting || busy}>
                Bóc lời video
              </Button>
            </div>
          </div>
        )}
      </Card>
    );
  }

  const trimRunning = isActive(trimJob);

  return (
    <>
      {err && <Banner tone="danger" message={err.message} detail={err.detail} />}

      {report && !trimRunning && (
        <Card
          title="Kết quả cắt"
          actions={
            <Badge
              tone={report.verdict === "pass" ? "success" : "danger"}
              label={report.verdict === "pass" ? "Đạt" : "Còn chỗ lặng"}
            />
          }
        >
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatTile label="Trước" value={dur(report.duration.beforeSec)} />
            <StatTile
              label="Sau"
              value={dur(report.duration.afterSec ?? report.duration.beforeSec)}
            />
            <StatTile label="Đã bỏ" value={`${report.duration.removedSec.toFixed(1)}s`} sub={`${report.removed.ranges} đoạn`} />
            <StatTile
              label="Chỗ nói thừa đã cắt"
              value={String(report.candidates.approved)}
              sub={report.candidates.rejected.length ? `${report.candidates.rejected.length} chỗ bị chặn vì đè lên chữ` : undefined}
            />
          </div>
          {report.verdict !== "pass" && report.verification.reason && (
            <div className="mt-3">
              <Banner tone="danger" message={report.verification.reason} />
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className={`text-meta ${muted}`}>
              Chưa ưng thì đổi lựa chọn bên dưới rồi cắt lại - luôn cắt từ bản gốc, không cắt chồng.
            </span>
            <Button variant="secondary" small onClick={onShowCut}>
              <Play size={14} /> Xem bản đã cắt
            </Button>
          </div>
        </Card>
      )}

      {trimRunning && trimJob && (
        <Card title="Đang cắt">
          <ProgressBar progress={trimJob.progress} step={trimJob.step} />
        </Card>
      )}

      <Card
        title="Mức cắt khoảng lặng"
        actions={
          <Button variant="secondary" small onClick={startTranscribe} disabled={busy || starting}>
            Bóc lời lại
          </Button>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <SwitchField
              id="auto-silence"
              label="Máy tự cắt khoảng lặng"
              checked={autoSilence}
              onChange={setAutoSilence}
            />
            <Segmented
              label="Mức cắt"
              value={level}
              disabled={!autoSilence}
              onChange={(lv) => {
                setLevel(lv);
                void analyze(lv);
              }}
              options={AUTO_CUT_LEVELS.map((lv) => ({ value: lv, label: t(AUTO_CUT_LEVEL_LABEL[lv]) }))}
            />
          </div>
          <span className={`text-meta ${muted}`}>
            Máy cắt chưa đúng thì tự chọn đoạn cắt trên timeline sóng âm bên dưới.
          </span>
        </div>
        {analysis && (
          <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatTile label="Video gốc" value={dur(analysis.silence.durationSec)} />
            <StatTile
              label="Máy tự cắt"
              value={autoSilence ? `${analysis.silence.removedSec.toFixed(1)}s` : "Tắt"}
              sub={autoSilence ? `${analysis.silence.silences.length} khoảng lặng` : "chỉ cắt đoạn bạn chọn"}
            />
            <StatTile
              label="Chỗ nói thừa đã chọn"
              value={`${pickedCount}/${candidates.length}`}
              sub={`${pickedSec.toFixed(1)}s`}
            />
            <StatTile
              label="Bạn chọn cắt"
              value={`${manualSec.toFixed(1)}s`}
              sub={`${manual.length} đoạn · còn ≈ ${dur(
                analysis.silence.durationSec - (autoSilence ? analysis.silence.removedSec : 0) - pickedSec - manualSec,
              )}`}
            />
          </div>
        )}
        {analyzing && <p className={`mt-3 text-meta ${muted}`}>Đang phân tích…</p>}
        {analysis && !analysis.guarded && (
          <div className="mt-3">
            <Banner tone="danger" message={analysis.note} />
          </div>
        )}
      </Card>

      <Card title="Timeline sóng âm - tự chọn đoạn cắt">
        {wave ? (
          <TrimTimeline
            durationSec={wave.durationSec}
            peaks={wave.peaks}
            peaksPerSec={wave.peaksPerSec}
            words={wave.words}
            autoSilences={autoSilence && analysis ? analysis.silence.silences : null}
            candidates={candidates.map((c, i) => ({
              start: c.start,
              end: c.end,
              checked: !!cut[i],
              label: `${KIND_LABEL[c.kind] ?? c.kind}: “${c.text}”`,
            }))}
            manual={manual}
            onManualChange={setManual}
            onToggleCandidate={(i) => setCut((arr) => arr.map((x, j) => (j === i ? !x : x)))}
            playhead={playhead}
            onSeek={onSeek}
            onPlay={onPlay}
          />
        ) : waveErr ? (
          <Banner tone="danger" message="Không vẽ được sóng âm" detail={waveErr} />
        ) : (
          <p className={`text-sm ${muted}`}>Đang đọc sóng âm…</p>
        )}
      </Card>

      {analysis && (
        <Card
          title={`Chỗ AI đề xuất cắt (${candidates.length})`}
          actions={
            candidates.length > 0 ? (
              <div className="flex gap-2">
                <Button variant="secondary" small onClick={() => setCut(candidates.map(() => true))}>
                  Chọn hết
                </Button>
                <Button variant="secondary" small onClick={() => setCut(candidates.map(() => false))}>
                  Bỏ hết
                </Button>
              </div>
            ) : undefined
          }
        >
          {candidates.length === 0 ? (
            <p className="text-sm">Không thấy từ đệm hay câu nói lại nào - chỉ cắt khoảng lặng.</p>
          ) : (
            <>
              <p className={`mb-3 text-meta ${muted}`}>
                Tick = cắt. Bấm nút nghe để phát đúng đoạn đó trong video gốc bên trái (kèm 1 giây trước).
                AI đã tick sẵn những chỗ nó chắc từ 70%.
              </p>
              <div className="flex flex-col gap-2">
                {candidates.map((c, i) => (
                  <CandidateRow
                    key={`${c.start}-${c.end}`}
                    c={c}
                    checked={!!cut[i]}
                    onToggle={(v) => setCut((arr) => arr.map((x, j) => (j === i ? v : x)))}
                    onPlay={() => onPlay(c.start, c.end)}
                  />
                ))}
              </div>
            </>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className={`text-meta ${muted}`}>
              Cắt = {autoSilence ? "khoảng lặng máy đo + " : ""}
              {pickedCount} chỗ nói thừa đã tick + {manual.length} đoạn bạn chọn. Không chạm vào file gốc.
            </span>
            <Button variant="primary" onClick={applyCut} disabled={busy || starting || analyzing}>
              <Scissors size={14} /> {report ? "Cắt lại" : "Cắt"}
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}

function CandidateRow({
  c,
  checked,
  onToggle,
  onPlay,
}: {
  c: DeadWeightCandidate;
  checked: boolean;
  onToggle: (v: boolean) => void;
  onPlay: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border p-3 ${
        checked ? "border-[var(--primary)]" : "border-[var(--border)]"
      }`}
    >
      <input
        type="checkbox"
        className="checkbox mt-1"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <IconButton
        label="Nghe đoạn này"
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          onPlay();
        }}
      >
        <Play size={14} />
      </IconButton>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="muted" dot={false} label={KIND_LABEL[c.kind] ?? c.kind} />
          <span className="text-meta tabular-nums">
            {ts(c.start)} → {ts(c.end)} · {(c.end - c.start).toFixed(1)}s
          </span>
          <Badge
            tone={c.confidence >= 0.8 ? "success" : "muted"}
            label={`AI chắc ${Math.round(c.confidence * 100)}%`}
          />
        </div>
        <p className="text-sm">“{c.text}”</p>
        {c.reason && <p className={`text-meta ${muted}`}>{c.reason}</p>}
        {c.context && <p className={`text-meta ${muted}`}>…{c.context}…</p>}
      </div>
    </label>
  );
}
