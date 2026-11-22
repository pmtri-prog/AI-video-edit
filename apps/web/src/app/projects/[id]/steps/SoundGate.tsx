"use client";

/**
 * Duyệt 3 · Âm thanh - nhạc nền và hiệu ứng âm thanh, duyệt TRƯỚC khi dựng
 * bản nháp cuối:
 *   - Nhạc: không nhạc / một bài cả video / theo đoạn (mỗi đoạn một bài hoặc
 *     im lặng, biên giữa hai đoạn chuyển mượt 1 giây). Nhạc tự nhỏ lại khi
 *     đang có lời nói.
 *   - SFX: mỗi điểm (lúc hiện cảnh sự kiện, lúc hiện thẻ chữ) bật/tắt, đổi
 *     tiếng, nghe thử, chỉnh âm lượng.
 * Lưu xong server ghi luôn vào timeline; bấm duyệt là dựng bản nháp có âm thanh.
 */

import { Pause, Play, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  getSoundGate,
  mediaUrl,
  saveSoundGate,
  suggestSound,
  type SoundCue,
  type SoundGate as Gate,
  type SoundMode,
  type SoundState,
} from "@/lib/api";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { IconButton } from "@/components/IconButton";
import { LinkButton } from "@/components/LinkButton";
import { Segmented } from "@/components/Segmented";

const muted = "text-[var(--text-muted)]";

const MODE_OPTIONS: { value: SoundMode; label: string }[] = [
  { value: "none", label: "Không nhạc" },
  { value: "whole", label: "Một bài cả video" },
  { value: "sections", label: "Theo đoạn" },
];

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Chọn nhạc gửi lên server: file trong project giữ nguyên, bài thư viện là "library:<file>" */
function musicValue(st: SoundState, file: string | null): string {
  if (!file) return "";
  const lib = st.music.find((m) => m.value === `library:${file.replace(/^assets\/music\//, "")}`);
  return st.music.some((m) => m.value === file) ? file : (lib?.value ?? file);
}

export function SoundGate({
  id,
  version,
  onState,
  onPlayAt,
}: {
  id: string;
  /** project.updatedAt - đổi là tải lại (cảnh chèn mới ⇒ điểm SFX gợi ý mới) */
  version: string | undefined;
  onState: (s: SoundState) => void;
  /** Phát bản nháp quanh giây `at` */
  onPlayAt: (at: number) => void;
}) {
  const [st, setSt] = useState<SoundState | null>(null);
  const [gate, setGate] = useState<Gate | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "suggest" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function take(s: SoundState) {
    setSt(s);
    setGate(s.gate);
    setDirty(false);
    onState(s);
  }

  useEffect(() => {
    if (dirty) return; // đang sửa dở thì không ghi đè bằng bản server
    getSoundGate(id)
      .then(take)
      .catch((e) => setError(errText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, version]);

  useEffect(() => () => audioRef.current?.pause(), []);

  function listen(url: string) {
    audioRef.current?.pause();
    if (playing === url) {
      setPlaying(null);
      return;
    }
    const a = new Audio(mediaUrl(url));
    a.onended = () => setPlaying(null);
    audioRef.current = a;
    setPlaying(url);
    void a.play();
  }

  function edit(p: Partial<Gate>) {
    setGate((g) => (g ? { ...g, ...p } : g));
    setDirty(true);
  }
  function editCue(i: number, p: Partial<SoundCue>) {
    if (!gate) return;
    edit({ cues: gate.cues.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  }

  async function save() {
    if (!gate || !st) return;
    setBusy("save");
    setError(null);
    try {
      take(
        await saveSoundGate(id, {
          ...gate,
          file: gate.file ? musicValue(st, gate.file) : null,
          sections: gate.sections.map((s) => ({ ...s, file: s.file ? musicValue(st, s.file) : null })),
        }),
      );
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  }

  async function resuggest() {
    setBusy("suggest");
    setError(null);
    try {
      take(await suggestSound(id));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  }

  if (!st || !gate) {
    return error ? <Banner tone="danger" message="Không tải được bước Âm thanh" detail={error} /> : null;
  }

  const urlOf = (file: string | null) => {
    if (!file) return null;
    return st.music.find((m) => m.value === file || m.value === musicValue(st, file))?.url ?? `video-projects/${id}/${file}`;
  };

  const musicSelect = (value: string | null, onChange: (v: string | null) => void, emptyLabel: string, htmlId?: string) => {
    const v = value ? musicValue(st, value) : "";
    const url = urlOf(value);
    return (
      <div className="flex items-center gap-2">
        <select id={htmlId} className="input w-64" value={v} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">{emptyLabel}</option>
          {st.music.map((m) => (
            <option key={m.value} value={m.value}>
              {m.tags.length > 0 ? `${m.label} · ${m.tags.join(", ")}` : m.label}
            </option>
          ))}
        </select>
        {url && (
          <IconButton label={playing === url ? "Dừng" : "Nghe thử"} size="sm" onClick={() => listen(url)}>
            {playing === url ? <Pause size={14} /> : <Play size={14} />}
          </IconButton>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <Banner tone="danger" message={error} />}
      {!st.saved && (
        <Banner
          tone="info"
          message="Đây là gợi ý của máy, chưa lưu."
          detail="Chỉnh nhạc và SFX rồi bấm Lưu âm thanh. Duyệt bước này là dựng bản nháp có âm thanh."
        />
      )}

      <Card
        title="Nhạc nền"
        actions={
          <Segmented
            label="Kiểu nhạc nền"
            value={gate.mode}
            onChange={(mode) => edit({ mode })}
            options={MODE_OPTIONS}
          />
        }
      >
        <div className="flex flex-col gap-3">
          {st.music.length === 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-meta ${muted}`}>
                Thư viện nhạc đang trống. Thêm bài ở trang Sound Effects, mục Nhạc nền, rồi quay lại.
              </p>
              <LinkButton href="/sfx">Mở thư viện nhạc</LinkButton>
            </div>
          )}
          {st.brief.musicMode === "none" && gate.mode === "none" && (
            <p className={`text-meta ${muted}`}>Brief đang để không nhạc (vd video nguồn đã có sẵn nhạc).</p>
          )}

          {gate.mode === "whole" &&
            (st.music.length > 0 ? (
              <Field label="Bài cho cả video" htmlFor="music-whole" hint="Bài ngắn hơn video thì tự lặp lại.">
                {musicSelect(gate.file, (file) => edit({ file }), "Chọn bài…", "music-whole")}
              </Field>
            ) : null)}

          {gate.mode === "sections" && (
            <div className="flex flex-col gap-2">
              <p className={`text-meta ${muted}`}>
                Đoạn chia theo câu móc và từng ý đã chốt ở Duyệt 1. Biên giữa hai đoạn chuyển mượt 1 giây.
              </p>
              <div className="flex flex-col divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
                {gate.sections.map((s, i) => (
                  <div key={`${s.start}-${i}`} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <div className="min-w-32">
                      <p className="text-sm">{s.label}</p>
                      <p className={`text-meta ${muted}`}>
                        {clock(s.start)} – {clock(s.end)}
                      </p>
                    </div>
                    {musicSelect(
                      s.file,
                      (file) => edit({ sections: gate.sections.map((x, j) => (j === i ? { ...x, file } : x)) }),
                      "Im lặng",
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {gate.mode !== "none" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={`Âm lượng lúc không nói · ${Math.round(gate.volume * 100)}%`} htmlFor="music-vol">
                <input
                  id="music-vol"
                  type="range"
                  className="slider w-full"
                  min={0}
                  max={100}
                  value={Math.round(gate.volume * 100)}
                  onChange={(e) => edit({ volume: Number(e.target.value) / 100 })}
                />
              </Field>
              <Field
                label={`Âm lượng khi đang nói · ${Math.round(gate.duckVolume * 100)}%`}
                htmlFor="music-duck"
                hint="Nhạc tự nhỏ xuống mức này dưới lời nói."
              >
                <input
                  id="music-duck"
                  type="range"
                  className="slider w-full"
                  min={0}
                  max={100}
                  value={Math.round(gate.duckVolume * 100)}
                  onChange={(e) => edit({ duckVolume: Number(e.target.value) / 100 })}
                />
              </Field>
            </div>
          )}
        </div>
      </Card>

      <Card
        title="Hiệu ứng âm thanh"
        actions={
          <Button small variant="secondary" onClick={resuggest} disabled={!!busy}>
            <RotateCcw size={13} /> {busy === "suggest" ? "Đang gợi ý…" : "Gợi ý lại"}
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          <p className={`text-meta ${muted}`}>
            Mỗi điểm là lúc hiện cảnh sự kiện hoặc thẻ chữ. Tắt điểm nào thấy thừa, bấm giờ để nghe trên bản nháp.
          </p>
          {gate.cues.length === 0 && <p className="text-sm">Chưa có điểm nào.</p>}
          {gate.cues.length > 0 && (
            <div className="flex flex-col divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
              {gate.cues.map((c, i) => (
                <div key={c.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 ${c.enabled ? "" : "opacity-60"}`}>
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    aria-label={`Bật hiệu ứng ${c.label}`}
                    onChange={(e) => editCue(i, { enabled: e.target.checked })}
                  />
                  <button type="button" className="text-sm tabular-nums underline" onClick={() => onPlayAt(c.at)}>
                    {clock(c.at)}.{String(Math.round((c.at % 1) * 10))}
                  </button>
                  {c.source === "user" ? (
                    <input
                      type="number"
                      className="input w-20"
                      min={0}
                      max={st.durationSec}
                      step={0.1}
                      value={c.at}
                      aria-label="Giây"
                      onChange={(e) => editCue(i, { at: Number(e.target.value) })}
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-sm">{c.label || "Điểm tự thêm"}</span>
                  <select
                    className="input w-48"
                    value={c.file}
                    aria-label="Tiếng"
                    onChange={(e) => editCue(i, { file: e.target.value })}
                  >
                    {!st.sfx.some((o) => o.file === c.file) && <option value={c.file}>{c.file}</option>}
                    {st.sfx.map((o) => (
                      <option key={o.file} value={o.file}>
                        {o.description ? `${o.description} (${o.file})` : o.file}
                      </option>
                    ))}
                  </select>
                  <IconButton
                    label="Nghe thử"
                    size="sm"
                    onClick={() => listen(`assets/sound-effects/${c.file}`)}
                  >
                    <Play size={14} />
                  </IconButton>
                  <input
                    type="range"
                    className="slider w-20"
                    min={0}
                    max={100}
                    value={Math.round(c.volume * 100)}
                    aria-label="Âm lượng hiệu ứng"
                    onChange={(e) => editCue(i, { volume: Number(e.target.value) / 100 })}
                  />
                  {c.source === "user" && (
                    <IconButton
                      label="Xóa điểm"
                      size="sm"
                      tone="danger"
                      onClick={() => edit({ cues: gate.cues.filter((_, j) => j !== i) })}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  )}
                </div>
              ))}
            </div>
          )}
          <div>
            <Button
              small
              variant="secondary"
              onClick={() =>
                edit({
                  cues: [
                    ...gate.cues,
                    {
                      id: `user-${Date.now()}`,
                      at: 0,
                      label: "",
                      file: st.sfx.find((o) => o.file === "pop.mp3")?.file ?? st.sfx[0]?.file ?? "pop.mp3",
                      volume: 0.4,
                      enabled: true,
                      source: "user",
                    },
                  ],
                })
              }
            >
              <Plus size={13} /> Thêm điểm
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-2">
        {dirty && <span className={`text-meta ${muted}`}>Có thay đổi chưa lưu</span>}
        <Button variant="primary" onClick={save} disabled={busy !== null || (!dirty && st.saved)}>
          <Save size={14} /> {busy === "save" ? "Đang lưu…" : "Lưu âm thanh"}
        </Button>
      </div>
    </div>
  );
}
