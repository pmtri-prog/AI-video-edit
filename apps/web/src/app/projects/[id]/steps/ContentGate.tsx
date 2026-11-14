"use client";

/**
 * Duyệt 1 · Nội dung - phần chấm nội dung, nằm dưới phần cắt thô.
 *
 * Câu móc chấm theo 7 công thức của skill activos-tiktok (mục 6.1), cảnh wow
 * 0–3 giây (không mở bằng mặt người nói), một video một ý (hai ý thì tách
 * Phần 1/Phần 2, không bỏ ý), tên riêng + con số cần soát. Máy KHÔNG viết lại
 * lời người nói: câu móc yếu thì chỉ gắn cờ, đổi câu móc là quay lại.
 */

import { Play, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  analyzeContentGate,
  getContentGate,
  saveContentDecision,
  type ContentDecision,
  type ContentGateState,
} from "@/lib/api";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { IconButton } from "@/components/IconButton";
import { Segmented } from "@/components/Segmented";

const muted = "text-[var(--text-muted)]";

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Giây → "1:05" */
function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Những việc còn thiếu trước khi duyệt - trang cha hiện ở thẻ tiêu đề bước */
export function contentGateWarnings(state: ContentGateState | null): string[] {
  if (!state) return [];
  const out: string[] = [];
  const r = state.review;
  if (!r) return ["Chưa chấm nội dung (câu móc, số ý)."];
  if (r.hook.weak) out.push("Câu móc yếu hoặc không khớp công thức nào - cân nhắc quay lại câu mở đầu.");
  if (state.channel && !state.decision.wow) out.push("Chưa chọn cảnh wow 0–3 giây - video sẽ mở bằng mặt người nói.");
  if (r.split && state.decision.splitParts === null) out.push("Video có từ 2 ý - chưa chọn tách 2 phần hay giữ 1 video.");
  if (state.channel && r.numbers.some((n) => n.note === "tiền")) out.push("Có con số tiền - kênh không nói tiền của nhãn, kiểm tra lại.");
  return out;
}

export function ContentGate({
  id,
  version,
  onPlay,
  onState,
}: {
  id: string;
  /** Đổi khi project đổi (cắt xong, sửa minh họa) - tải lại trạng thái */
  version?: string;
  /** Phát một đoạn trên video nền (bản đã cắt nếu có) */
  onPlay: (start: number, end: number) => void;
  onState: (s: ContentGateState) => void;
}) {
  const [state, setState] = useState<ContentGateState | null>(null);
  const [busy, setBusy] = useState<"analyze" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [wowSrc, setWowSrc] = useState("");
  const [wowStart, setWowStart] = useState("0");

  const apply = useCallback(
    (s: ContentGateState) => {
      setState(s);
      onState(s);
      setTitle(s.decision.title);
      setWowSrc(s.decision.wow?.src ?? "");
      setWowStart(String(s.decision.wow?.mediaStart ?? 0));
    },
    [onState],
  );

  useEffect(() => {
    getContentGate(id)
      .then(apply)
      .catch((e) => setError(errText(e)));
  }, [id, version, apply]);

  async function analyze() {
    setBusy("analyze");
    setError(null);
    try {
      apply(await analyzeContentGate(id));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  }

  async function save(decision: Partial<ContentDecision>) {
    setBusy("save");
    setError(null);
    try {
      apply(await saveContentDecision(id, decision));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  }

  if (!state) {
    return error ? <Banner tone="danger" message="Không tải được phần chấm nội dung" detail={error} /> : null;
  }

  const r = state.review;
  const formula = (n: number | null) => state.formulas.find((f) => f.id === n) ?? null;
  const wowChanged =
    wowSrc !== (state.decision.wow?.src ?? "") || Number(wowStart) !== (state.decision.wow?.mediaStart ?? 0);

  return (
    <div className="flex flex-col gap-4">
      {error && <Banner tone="danger" message={error} />}

      <Card
        title="Câu móc 3 giây đầu"
        actions={
          <Button
            variant={r ? "secondary" : "primary"}
            small
            onClick={analyze}
            disabled={!state.hasTranscript || busy !== null}
          >
            {r ? <RefreshCw size={13} /> : <Sparkles size={13} />}
            {busy === "analyze" ? "Đang chấm…" : r ? "Chấm lại" : "Chấm nội dung"}
          </Button>
        }
      >
        {!state.hasTranscript ? (
          <p className={`text-sm ${muted}`}>Bóc lời ở phần cắt thô trước, rồi chấm nội dung.</p>
        ) : !r ? (
          <p className={`text-sm ${muted}`}>
            AI đọc lời nói, chấm câu mở đầu theo 7 công thức và đếm video có mấy ý. Nên chấm sau khi cắt để mốc giây
            khớp bản cắt.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-[var(--radius)] bg-[var(--bg-subtle)] p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm">“{r.hook.text}”</p>
                <IconButton label="Nghe câu móc" onClick={() => onPlay(r.hook.start, r.hook.end)}>
                  <Play size={14} />
                </IconButton>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {r.hook.weak ? (
                  <Badge tone="danger" label="Câu móc yếu" />
                ) : (
                  <Badge tone="success" label={`Khớp công thức ${r.hook.formula}: ${formula(r.hook.formula)?.name}`} />
                )}
                {r.hook.weak && r.hook.suggestFormula && (
                  <span className={`text-meta ${muted}`}>
                    Gần nhất: công thức {r.hook.suggestFormula} · {formula(r.hook.suggestFormula)?.name}
                  </span>
                )}
              </div>
              {r.hook.reason && <p className={`mt-2 text-meta ${muted}`}>{r.hook.reason}</p>}
            </div>
            <ol className="flex flex-col gap-1">
              {state.formulas.map((f) => {
                const hit = f.id === r.hook.formula || (r.hook.weak && f.id === r.hook.suggestFormula);
                return (
                  <li
                    key={f.id}
                    className={`rounded-[var(--radius)] px-2 py-1 text-sm ${hit ? "bg-[var(--primary-soft)]" : ""}`}
                  >
                    {f.id}. {f.name}
                    {f.realOnly && <span className={`text-meta ${muted}`}> · chỉ khi có thật</span>}
                    <span className={`block text-meta ${muted}`}>{f.example}</span>
                  </li>
                );
              })}
            </ol>
            <p className={`text-meta ${muted}`}>
              Máy không viết lại lời anh. Đổi câu móc nghĩa là quay lại câu mở đầu - anh quyết.
            </p>
          </div>
        )}
      </Card>

      <Card title="Cảnh wow 0–3 giây & chữ tiêu đề">
        <div className="flex flex-col gap-3">
          {state.channel && (
            <Banner tone="info" message="Kênh này không mở bằng mặt người nói: 3 giây đầu là cảnh sự kiện thật, câu móc lồng tiếng đè lên." />
          )}
          {state.files.length === 0 ? (
            <p className={`text-sm ${muted}`}>
              Project chưa có cảnh quay sự kiện nào. Tải video sự kiện vào assets (hoặc lấy từ Kho TryOh) rồi chọn ở đây.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-end">
              <Field label="Cảnh mở đầu" htmlFor="wow-src">
                <select id="wow-src" className="input" value={wowSrc} onChange={(e) => setWowSrc(e.target.value)}>
                  <option value="">Không có - mở bằng người nói</option>
                  {state.files.map((f) => (
                    <option key={f.rel} value={f.rel}>
                      {f.name} ({f.kind === "video" ? "video" : "ảnh"})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Bắt đầu từ giây" htmlFor="wow-start">
                <input
                  id="wow-start"
                  className="input"
                  type="number"
                  min={0}
                  step={0.1}
                  value={wowStart}
                  disabled={!wowSrc}
                  onChange={(e) => setWowStart(e.target.value)}
                />
              </Field>
              <Button
                variant="secondary"
                disabled={!wowChanged || busy !== null}
                onClick={() =>
                  save({ wow: wowSrc ? { src: wowSrc, mediaStart: Math.max(0, Number(wowStart) || 0) } : null })
                }
              >
                Lưu cảnh mở đầu
              </Button>
            </div>
          )}
          {state.decision.wow && (
            <p className={`text-meta ${muted}`}>
              Đã ghi thành minh họa 0–3s ở Duyệt 2 (sửa tiếp được ở đó). Minh họa cũ đè lên 3 giây đầu đã được bỏ.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Field
              label="Chữ tiêu đề"
              htmlFor="hook-title"
              hint="Dùng làm tiêu đề ảnh bìa ở Duyệt 4. Nên là câu hỏi, kết bằng dấu ?"
            >
              <input
                id="hook-title"
                className="input"
                value={title}
                maxLength={120}
                placeholder="Hội chợ phát quà mà không biết ai nhận?"
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Button
              variant="secondary"
              disabled={title.trim() === state.decision.title || busy !== null}
              onClick={() => save({ title: title.trim() })}
            >
              Lưu tiêu đề
            </Button>
          </div>
        </div>
      </Card>

      {r && (
        <Card
          title={
            <span className="flex items-center gap-2">
              Một video = một ý
              <Badge tone={r.ideas.length > 1 ? "running" : "success"} label={`${r.ideas.length} ý`} />
            </span>
          }
        >
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-1">
              {r.ideas.map((idea, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    Ý {i + 1}: {idea.title}{" "}
                    <span className={`text-meta ${muted}`}>
                      {mmss(idea.start)}–{mmss(idea.end)}
                    </span>
                  </span>
                  <IconButton label={`Nghe ý ${i + 1}`} onClick={() => onPlay(idea.start, Math.min(idea.end, idea.start + 8))}>
                    <Play size={14} />
                  </IconButton>
                </li>
              ))}
            </ul>
            {r.split && (
              <div className="flex flex-col gap-2 rounded-[var(--radius)] bg-[var(--bg-subtle)] p-3">
                <p className="text-sm">
                  Đề xuất tách tại {mmss(r.split.at)}. Phần 1 kết bằng câu hỏi bỏ ngỏ:{" "}
                  <span className="font-medium">“{r.split.question}”</span>
                </p>
                <Segmented
                  label="Tách phần"
                  // Chưa quyết = không mục nào sáng (giá trị rỗng không khớp option nào)
                  value={
                    (state.decision.splitParts === null ? "" : state.decision.splitParts ? "split" : "one") as
                      | "split"
                      | "one"
                  }
                  onChange={(v) => save({ splitParts: v === "split" })}
                  options={[
                    { value: "split", label: "Tách 2 phần" },
                    { value: "one", label: "Giữ 1 video" },
                  ]}
                />
                <p className={`text-meta ${muted}`}>Không bỏ bớt ý thứ hai cho vừa một video.</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {r && (r.names.length > 0 || r.numbers.length > 0) && (
        <Card title="Tên riêng & con số cần soát">
          <div className="flex flex-col gap-3">
            {r.names.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {r.names.map((n) => (
                  <span key={n.text} title={n.note || undefined}>
                    <Badge tone={n.note ? "running" : "muted"} label={n.text} />
                  </span>
                ))}
              </div>
            )}
            {r.numbers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {r.numbers.map((n) => (
                  <Badge
                    key={n.text}
                    tone={n.note === "tiền" && state.channel ? "danger" : "muted"}
                    label={n.note === "tiền" ? `${n.text} · tiền` : n.text}
                  />
                ))}
              </div>
            )}
            <p className={`text-meta ${muted}`}>
              Tên viết sai thì sửa ở phụ đề. Con số chỉ dùng số đã duyệt trong guideline, không nói tiền của nhãn.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
