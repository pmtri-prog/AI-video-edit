"use client";

/**
 * Bước 2 "Minh họa" CHẠY THẬT của luồng duyệt từng bước.
 *
 * Danh sách minh họa là dữ liệu có cấu trúc trong meta.json (`inserts`): AI đề
 * xuất một lần, người dùng sửa từng field ở đây (tự lưu), bấm "Dựng draft" là
 * server + Remotion dựng lại TẤT ĐỊNH - không gọi AI, không đụng Bước 1.
 */

import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Film,
  Image as ImageIcon,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  draftIllustrate,
  getIllustrate,
  mediaUrl,
  saveIllustrate,
  suggestIllustrate,
  uploadAsset,
  type IllustrateState,
  type InsertDisplay,
  type InsertItem,
  type InsertKind,
  type InsertRules,
  type InsertTransition,
  type Job,
  type MotionTemplate,
} from "@/lib/api";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { IconButton } from "@/components/IconButton";
import { Panel } from "@/components/Panel";
import { ProgressBar } from "@/components/ProgressBar";
import { Segmented } from "@/components/Segmented";
import { Row, Rows } from "@/app/mockup/step-flow/ui";

const muted = "text-[var(--text-muted)]";

const KIND_ICON = { video: Film, image: ImageIcon, motion: BarChart3 } as const;
const DISPLAY_LABEL: Record<InsertDisplay, string> = { full: "Toàn màn hình", top: "Nửa trên", pip: "Khung nhỏ" };
const TRANSITION_LABEL: Record<InsertTransition, string> = {
  cut: "Cắt thẳng",
  fade: "Mờ dần",
  slide: "Trượt",
  zoom: "Zoom",
};
const TEMPLATE_LABEL: Record<MotionTemplate, string> = {
  counter: "Đếm số",
  chapter: "Thẻ chương",
  list: "Danh sách",
  cta: "Kêu gọi",
};

const isActive = (j: Job | undefined | null) => !!j && (j.status === "queued" || j.status === "running");
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const ts = (sec: number) => {
  const m = Math.floor(sec / 60);
  return `${m}:${(sec - m * 60).toFixed(1).padStart(4, "0")}`;
};
const newId = () => `ins_${Math.random().toString(36).slice(2, 10)}`;

function playSfx(file: string) {
  void new Audio(mediaUrl(`assets/sound-effects/${file}`)).play();
}

export function IllustrateReal({
  id,
  busy,
  draftJob,
  onJob,
  onPlay,
  onShowDraft,
}: {
  id: string;
  busy: boolean;
  draftJob: Job | undefined;
  onJob: (j: Job) => void;
  /** Phát một đoạn của video nền (giây trên bản đã cắt) ở khung xem trước */
  onPlay: (start: number, end: number) => void;
  onShowDraft: () => void;
}) {
  const [st, setSt] = useState<IllustrateState | null>(null);
  const [inserts, setInserts] = useState<InsertItem[]>([]);
  const [rules, setRules] = useState<InsertRules | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<{ message: string; detail?: string } | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [oldFlow, setOldFlow] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ inserts?: InsertItem[]; rules?: InsertRules } | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getIllustrate(id);
      setSt(s);
      setInserts(s.inserts);
      setRules(s.rules);
    } catch (e) {
      setErr({ message: "Không tải được dữ liệu Bước 2", detail: errText(e) });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const flush = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const body = pending.current;
    pending.current = null;
    if (!body) return;
    setSaved("saving");
    try {
      const s = await saveIllustrate(id, body);
      // KHÔNG ghi đè danh sách đang sửa (người dùng có thể đang gõ) - chỉ làm mới phần phụ
      setSt((old) => (old ? { ...s, inserts: old.inserts } : s));
      setSaved("saved");
    } catch (e) {
      setErr({ message: "Không lưu được", detail: errText(e) });
      setSaved("idle");
    }
  }, [id]);

  function queueSave(body: { inserts?: InsertItem[]; rules?: InsertRules }) {
    pending.current = { ...(pending.current ?? {}), ...body };
    setSaved("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), 700);
  }

  // Rời bước giữa chừng vẫn lưu nốt
  useEffect(() => () => void flush(), [flush]);

  function update(insId: string, patch: Partial<InsertItem>) {
    setInserts((list) => {
      const next = list.map((x) => (x.id === insId ? { ...x, ...patch, origin: "user" as const } : x));
      queueSave({ inserts: next });
      return next;
    });
  }

  function remove(insId: string) {
    setInserts((list) => {
      const next = list.filter((x) => x.id !== insId);
      queueSave({ inserts: next });
      return next;
    });
  }

  function add() {
    if (!st) return;
    const lastEnd = inserts.reduce((m, x) => Math.max(m, x.end), 1);
    const start = Math.min(lastEnd + 1, Math.max(0, st.base.durationSec - 3));
    const item: InsertItem = {
      id: newId(),
      anchor: null,
      kind: "motion",
      start: Math.round(start * 10) / 10,
      end: Math.round(Math.min(start + 3, st.base.durationSec) * 10) / 10,
      display: "full",
      src: null,
      mediaStart: 0,
      transitionIn: rules?.defaultTransition ?? "fade",
      transitionOut: rules?.defaultTransition ?? "fade",
      sfx: rules?.defaultSfx ? { file: rules.defaultSfx, volume: 0.4 } : null,
      credit: "",
      motion: { template: "chapter", title: "Tiêu đề", value: "", label: "", items: [] },
      note: "",
      origin: "user",
    };
    setInserts((list) => {
      const next = [...list, item].sort((a, b) => a.start - b.start);
      queueSave({ inserts: next });
      return next;
    });
    setOpen(item.id);
  }

  async function suggest() {
    await flush();
    setSuggesting(true);
    setErr(null);
    try {
      const s = await suggestIllustrate(id);
      setSt(s);
      setInserts(s.inserts);
      setRules(s.rules);
    } catch (e) {
      setErr({ message: "AI chưa đề xuất được", detail: errText(e) });
    } finally {
      setSuggesting(false);
    }
  }

  async function draft(force = false) {
    await flush();
    setErr(null);
    try {
      const r = await draftIllustrate(id, force);
      setOldFlow(false);
      onJob(r.job);
    } catch (e) {
      if (e instanceof ApiError && e.code === "OLD_FLOW_TIMELINE") setOldFlow(true);
      else setErr({ message: "Không dựng draft được", detail: errText(e) });
    }
  }

  async function uploadFor(ins: InsertItem, file: File) {
    setErr(null);
    try {
      const info = await uploadAsset(file, "project", id);
      const rel = info.relPath.replace(`video-projects/${id}/`, "");
      update(ins.id, { src: rel, kind: info.kind === "image" ? "image" : "video" });
      const s = await getIllustrate(id);
      setSt((old) => (old ? { ...s, inserts: old.inserts } : s));
    } catch (e) {
      setErr({ message: "Tải file lên không được", detail: errText(e) });
    }
  }

  if (!st || !rules) {
    return err ? (
      <Banner tone="danger" message={err.message} detail={err.detail} />
    ) : (
      <Card>
        <p className={`text-sm ${muted}`}>Đang tải…</p>
      </Card>
    );
  }

  const dur = st.base.durationSec || 1;
  const covered = inserts.reduce((s, x) => s + (x.end - x.start), 0);
  const coverPct = Math.round((covered / dur) * 100);
  const drafting = isActive(draftJob);

  return (
    <>
      {err && <Banner tone="danger" message={err.message} detail={err.detail} />}
      {oldFlow && (
        <Banner
          tone="danger"
          message="Project này đã có timeline do luồng cũ (AI tự dựng một mạch) tạo: phụ đề, hiệu ứng âm thanh, nhạc của bản cũ. Dựng theo từng bước sẽ thay timeline đó bằng kết quả các bước. File video final cũ trong outputs/ vẫn giữ nguyên."
          actions={
            <Button variant="primary" small onClick={() => void draft(true)}>
              Đồng ý, dựng theo từng bước
            </Button>
          }
        />
      )}

      <Card
        title="Minh họa"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-meta ${muted}`}>
              {saved === "saving" ? "Đang lưu…" : saved === "saved" ? "Đã lưu" : ""}
            </span>
            <Button variant="secondary" onClick={suggest} disabled={suggesting || busy}>
              <Sparkles size={14} /> {suggesting ? "AI đang đọc lời nói…" : inserts.length ? "AI đề xuất lại" : "AI đề xuất"}
            </Button>
            <Button variant="primary" onClick={() => void draft()} disabled={busy || suggesting}>
              <Film size={14} /> Dựng draft
            </Button>
          </div>
        }
      >
        <p className="text-sm">
          Video nền: <span className="font-medium">{st.base.video.split("/").pop()}</span> ·{" "}
          {Math.round(dur)} giây · {st.segments.length} câu nói.{" "}
          {inserts.length === 0 && "Bấm AI đề xuất để AI đọc lời bạn nói và gợi ý chỗ nên chèn minh họa."}
        </p>
        {suggesting && (
          <p className={`mt-2 text-meta ${muted}`}>
            AI đang đọc từng câu nói - mất khoảng 30–90 giây. Minh họa bạn đã sửa tay được giữ nguyên.
          </p>
        )}
        {drafting && draftJob && (
          <div className="mt-3">
            <ProgressBar progress={draftJob.progress} step={draftJob.step} />
          </div>
        )}
        {!drafting && draftJob?.status === "done" && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className={`text-meta ${muted}`}>
              Draft dựng xong. Sửa tiếp thì bấm Dựng draft lại - chỉ Bước 2 dựng lại, Bước 1 giữ nguyên.
            </span>
            <Button variant="secondary" small onClick={onShowDraft}>
              <Play size={14} /> Xem draft
            </Button>
          </div>
        )}
        {!drafting && draftJob?.status === "failed" && (
          <div className="mt-3">
            <Banner tone="danger" message="Dựng draft lỗi - mở Render Queue xem log của job rồi gửi mình." />
          </div>
        )}
      </Card>

      <Card title="Quy tắc chung">
        <Rows>
          <Row label="Che người nói tối đa" hint="AI đề xuất không vượt mức này">
            <input
              type="number"
              min={0}
              max={100}
              className="input w-24"
              value={rules.maxCoverPct}
              onChange={(e) => {
                const next = { ...rules, maxCoverPct: Number(e.target.value) };
                setRules(next);
                queueSave({ rules: next });
              }}
            />
            <span className="text-sm">%</span>
          </Row>
          <Row label="Chuyển cảnh mặc định" hint="Áp cho minh họa mới thêm và đề xuất của AI">
            <select
              className="input"
              value={rules.defaultTransition}
              onChange={(e) => {
                const next = { ...rules, defaultTransition: e.target.value as InsertTransition };
                setRules(next);
                queueSave({ rules: next });
              }}
            >
              {Object.entries(TRANSITION_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Âm thanh mặc định khi hiện minh họa">
            <SfxSelect
              options={st.sfx}
              value={rules.defaultSfx}
              onChange={(f) => {
                const next = { ...rules, defaultSfx: f };
                setRules(next);
                queueSave({ rules: next });
              }}
            />
          </Row>
        </Rows>
      </Card>

      <Card
        title={`Danh sách minh họa (${inserts.length})`}
        actions={
          <Button variant="secondary" small onClick={add}>
            <Plus size={14} /> Thêm minh họa
          </Button>
        }
      >
        <div className="mb-3">
          <div className="relative h-6 overflow-hidden rounded-[var(--radius)] bg-[var(--bg-subtle)]">
            {inserts.map((x) => (
              <button
                type="button"
                key={x.id}
                title={`${ts(x.start)} → ${ts(x.end)}`}
                onClick={() => setOpen(x.id)}
                className="absolute inset-y-0 border-x border-[var(--primary)] bg-[var(--primary-soft)]"
                style={{ left: `${(x.start / dur) * 100}%`, width: `${((x.end - x.start) / dur) * 100}%` }}
              />
            ))}
          </div>
          <div className={`mt-1 flex justify-between text-meta ${muted}`}>
            <span>0:00</span>
            <span className={coverPct > rules.maxCoverPct ? "text-[var(--danger)]" : ""}>
              Đang che {coverPct}% thời lượng (tối đa {rules.maxCoverPct}%)
            </span>
            <span>{ts(dur)}</span>
          </div>
        </div>

        {inserts.length === 0 ? (
          <p className={`text-sm ${muted}`}>Chưa có minh họa nào.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {inserts.map((ins, i) => (
              <InsertEditor
                key={ins.id}
                n={i + 1}
                ins={ins}
                st={st}
                open={open === ins.id}
                onToggle={() => setOpen(open === ins.id ? null : ins.id)}
                onChange={(p) => update(ins.id, p)}
                onRemove={() => remove(ins.id)}
                onUpload={(f) => void uploadFor(ins, f)}
                onPlay={() => onPlay(ins.start, ins.end)}
                projectId={id}
              />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function SfxSelect({
  options,
  value,
  onChange,
}: {
  options: IllustrateState["sfx"];
  value: string | null;
  onChange: (file: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <select className="input w-56" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Không</option>
        {options.map((o) => (
          <option key={o.file} value={o.file}>
            {o.description ? `${o.description} (${o.file})` : o.file}
          </option>
        ))}
      </select>
      {value && (
        <IconButton label="Nghe thử" size="sm" onClick={() => playSfx(value)}>
          <Play size={14} />
        </IconButton>
      )}
    </div>
  );
}

function InsertEditor({
  n,
  ins,
  st,
  open,
  onToggle,
  onChange,
  onRemove,
  onUpload,
  onPlay,
  projectId,
}: {
  n: number;
  ins: InsertItem;
  st: IllustrateState;
  open: boolean;
  onToggle: () => void;
  onChange: (p: Partial<InsertItem>) => void;
  onRemove: () => void;
  onUpload: (f: File) => void;
  onPlay: () => void;
  projectId: string;
}) {
  const Icon = KIND_ICON[ins.kind];
  const fileRef = useRef<HTMLInputElement>(null);
  const needsFile = ins.kind !== "motion" && !ins.src;
  const title =
    ins.kind === "motion" && ins.motion
      ? `${TEMPLATE_LABEL[ins.motion.template]}: ${ins.motion.title || ins.motion.value || "(trống)"}`
      : (ins.src?.split("/").pop() ?? "Chưa có file");
  const files = st.files.filter((f) => f.kind === (ins.kind === "image" ? "image" : "video"));

  function setKind(kind: InsertKind) {
    onChange({
      kind,
      motion:
        kind === "motion"
          ? (ins.motion ?? { template: "chapter", title: "Tiêu đề", value: "", label: "", items: [] })
          : ins.motion,
    });
  }

  return (
    <div
      className={`rounded-[var(--radius)] border ${needsFile ? "border-[var(--danger)]" : "border-[var(--border)]"}`}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left">
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className={`w-6 shrink-0 text-meta ${muted}`}>#{n}</span>
        <Icon size={16} className={muted} />
        <span className="w-28 shrink-0 text-meta tabular-nums">
          {ts(ins.start)} → {ts(ins.end)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
        {needsFile && <Badge tone="danger" label="Cần file" />}
        <Badge tone={ins.origin === "ai" ? "muted" : "success"} label={ins.origin === "ai" ? "AI đề xuất" : "Bạn đã sửa"} />
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] p-3">
          {ins.note && <p className={`text-meta ${muted}`}>AI: {ins.note}</p>}

          <Field label="Neo vào câu nói">
            <select
              className="input"
              value={ins.anchor?.segment ?? ""}
              onChange={(e) => {
                const seg = st.segments[Number(e.target.value)];
                if (!seg) return;
                const start = Math.round((seg.start + 0.2) * 10) / 10;
                onChange({
                  anchor: { segment: seg.i, text: seg.text },
                  start,
                  end: Math.round(Math.min(seg.end, start + 4) * 10) / 10,
                });
              }}
            >
              <option value="" disabled>
                Chọn câu…
              </option>
              {st.segments.map((s) => (
                <option key={s.i} value={s.i}>
                  {ts(s.start)} · {s.text.length > 70 ? `${s.text.slice(0, 70)}…` : s.text}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              label="Loại minh họa"
              value={ins.kind}
              onChange={setKind}
              options={[
                { value: "video", label: "Video" },
                { value: "image", label: "Ảnh" },
                { value: "motion", label: "Motion graphic" },
              ]}
            />
            <Button variant="secondary" small onClick={onPlay}>
              <Play size={14} /> Nghe đoạn này
            </Button>
          </div>

          {ins.kind === "motion" && ins.motion ? (
            <Panel title="Nội dung motion graphic">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Mẫu">
                  <select
                    className="input"
                    value={ins.motion.template}
                    onChange={(e) =>
                      onChange({ motion: { ...ins.motion!, template: e.target.value as MotionTemplate } })
                    }
                  >
                    {Object.entries(TEMPLATE_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tiêu đề">
                  <input
                    className="input"
                    value={ins.motion.title}
                    onChange={(e) => onChange({ motion: { ...ins.motion!, title: e.target.value } })}
                  />
                </Field>
                {ins.motion.template === "counter" && (
                  <Field label="Con số" hint="Ghi đúng như lời nói, vd 26%, 12.000, 11,5 giờ">
                    <input
                      className="input"
                      value={ins.motion.value}
                      onChange={(e) => onChange({ motion: { ...ins.motion!, value: e.target.value } })}
                    />
                  </Field>
                )}
                {ins.motion.template !== "list" && (
                  <Field
                    label={
                      ins.motion.template === "chapter"
                        ? "Nhãn nhỏ (vd PHẦN 1)"
                        : ins.motion.template === "cta"
                          ? "Chữ trên nút"
                          : "Chú thích"
                    }
                  >
                    <input
                      className="input"
                      value={ins.motion.label}
                      onChange={(e) => onChange({ motion: { ...ins.motion!, label: e.target.value } })}
                    />
                  </Field>
                )}
              </div>
              {ins.motion.template === "list" && (
                <Field label="Các mục (mỗi dòng một mục, tối đa 6)" className="mt-3">
                  <textarea
                    className="input"
                    rows={4}
                    value={ins.motion.items.join("\n")}
                    onChange={(e) =>
                      onChange({ motion: { ...ins.motion!, items: e.target.value.split("\n").slice(0, 6) } })
                    }
                  />
                </Field>
              )}
            </Panel>
          ) : (
            <Panel
              title={ins.kind === "image" ? "Ảnh" : "Video"}
              actions={
                <Button variant="secondary" small onClick={() => fileRef.current?.click()}>
                  <Upload size={14} /> Tải lên
                </Button>
              }
            >
              <input
                ref={fileRef}
                type="file"
                accept={ins.kind === "image" ? "image/*" : "video/*,image/*"}
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap items-start gap-3">
                <select
                  className="input min-w-0 flex-1"
                  value={ins.src ?? ""}
                  onChange={(e) => onChange({ src: e.target.value || null })}
                >
                  <option value="">{files.length ? "Chọn file trong project…" : "Project chưa có file phù hợp - bấm Tải lên"}</option>
                  {files.map((f) => (
                    <option key={f.rel} value={f.rel}>
                      {f.name}
                    </option>
                  ))}
                </select>
                {ins.src &&
                  (ins.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaUrl(`video-projects/${projectId}/${ins.src}`)}
                      alt=""
                      className="h-24 rounded-[var(--radius)] object-cover"
                    />
                  ) : (
                    <video
                      src={mediaUrl(`video-projects/${projectId}/${ins.src}`)}
                      muted
                      controls
                      preload="metadata"
                      className="h-24 rounded-[var(--radius)]"
                    />
                  ))}
              </div>
              {ins.kind === "video" && ins.src && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  Bắt đầu từ giây
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    className="input w-24"
                    value={ins.mediaStart}
                    onChange={(e) => onChange({ mediaStart: Math.max(0, Number(e.target.value)) })}
                  />
                  của file
                </div>
              )}
            </Panel>
          )}

          <Rows>
            <Row label="Cách hiện">
              <Segmented
                label="Cách hiện"
                value={ins.display}
                onChange={(display) => onChange({ display })}
                options={(Object.keys(DISPLAY_LABEL) as InsertDisplay[]).map((v) => ({
                  value: v,
                  label: DISPLAY_LABEL[v],
                }))}
              />
            </Row>
            <Row label="Thời gian hiện (giây)" hint="Trên bản đã cắt ở Bước 1">
              <input
                type="number"
                step={0.1}
                min={0}
                className="input w-24"
                value={ins.start}
                onChange={(e) => onChange({ start: Number(e.target.value) })}
              />
              <span className="text-sm">→</span>
              <input
                type="number"
                step={0.1}
                min={0}
                className="input w-24"
                value={ins.end}
                onChange={(e) => onChange({ end: Number(e.target.value) })}
              />
            </Row>
            <Row label="Chuyển cảnh vào / ra">
              {(["transitionIn", "transitionOut"] as const).map((k) => (
                <select
                  key={k}
                  className="input w-32"
                  value={ins[k]}
                  onChange={(e) => onChange({ [k]: e.target.value as InsertTransition })}
                >
                  {Object.entries(TRANSITION_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              ))}
            </Row>
            <Row label="Hiệu ứng âm thanh">
              <SfxSelect
                options={st.sfx}
                value={ins.sfx?.file ?? null}
                onChange={(f) => onChange({ sfx: f ? { file: f, volume: ins.sfx?.volume ?? 0.4 } : null })}
              />
              {ins.sfx && (
                <input
                  type="range"
                  className="slider w-24"
                  min={0}
                  max={100}
                  value={Math.round(ins.sfx.volume * 100)}
                  aria-label="Âm lượng hiệu ứng"
                  onChange={(e) => onChange({ sfx: { ...ins.sfx!, volume: Number(e.target.value) / 100 } })}
                />
              )}
            </Row>
            <Row label="Ghi nguồn trên hình" hint="Bắt buộc với ảnh báo chí, số liệu lấy từ nơi khác">
              <input
                className="input w-56"
                value={ins.credit}
                placeholder="vd Ảnh: báo Thanh Niên"
                onChange={(e) => onChange({ credit: e.target.value })}
              />
            </Row>
          </Rows>

          <div className="flex justify-end">
            <Button variant="destructive" small onClick={onRemove}>
              <Trash2 size={14} /> Xóa minh họa
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
