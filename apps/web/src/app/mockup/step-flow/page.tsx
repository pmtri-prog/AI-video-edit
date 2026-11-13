"use client";

/**
 * MOCKUP - luồng edit "duyệt từng bước". Dữ liệu giả, chưa nối backend.
 * Mục đích duy nhất: xem giao diện có ổn không trước khi code thật.
 * Mở ở /mockup/step-flow.
 */

import { Check, Play, RotateCcw, Send, Sparkles, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProject } from "@/lib/api";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/Segmented";
import { ShellRightPanel } from "@/components/Shell";
import {
  CutStep,
  IllustrateStep,
  InputStep,
  MusicStep,
  PublishStep,
  SubtitleStep,
  ThumbnailStep,
  type SubPreset,
  type ThumbLayout,
} from "./steps";
import { Frame, STEP_STATUS, Stepper, type StepStatus } from "./ui";

type Status = StepStatus;
const STATUS = STEP_STATUS;

const STEPS = [
  {
    name: "Đầu vào",
    did: "Kịch bản 7 câu, 2 file video, 1 file mic rời. Khung 9:16 cho TikTok, Style Design TryOh!.",
    preview: "File thô · 6:17",
  },
  {
    name: "Cắt thô",
    did: "AI chọn take khớp kịch bản nhất cho 7/7 câu, bỏ 41 khoảng lặng và 23 từ đệm, khớp mic rời vào hình. 6:17 → 1:28.",
    preview: "Bản cắt thô · 1:28",
  },
  {
    name: "Minh họa",
    did: "AI đề xuất 7 minh họa (3 video Kho TryOh, 1 ảnh báo chí, 2 motion graphic, 1 quay web) kèm chuyển cảnh và hiệu ứng âm thanh. Che 31% thời lượng.",
    preview: "Draft có minh họa · 1:28",
  },
  {
    name: "Phụ đề & chữ",
    did: "AI tạo 38 dòng phụ đề từ transcript đã sửa ở Bước 1, chọn 5 từ khóa nhấn, viết hook 3 giây đầu.",
    preview: "Draft có phụ đề",
  },
  {
    name: "Nhạc nền",
    did: "AI đề xuất 3 bài không bản quyền theo mood nội dung, tự hạ nhạc khi có lời nói.",
    preview: "Draft có nhạc",
  },
  {
    name: "Thumbnail",
    did: "AI chọn 6 khung hình mặt rõ, nhìn thẳng camera; dựng 3 phương án theo mẫu series.",
    preview: "Thumbnail",
  },
  {
    name: "Duyệt & xuất bản",
    did: "Bản draft hoàn chỉnh đã qua kiểm tra tự động. Còn 1 cảnh báo âm lượng.",
    preview: "Draft toàn bài · 1:28",
  },
];

const INITIAL: Status[] = ["approved", "approved", "review", "todo", "todo", "todo", "todo"];

export default function StepFlowMockup() {
  const [statuses, setStatuses] = useState<Status[]>(INITIAL);
  const [current, setCurrent] = useState(2);
  const [mode, setMode] = useState<"step" | "auto">("step");
  const [redo, setRedo] = useState(false);
  // State dùng chung giữa editor và khung xem trước
  const [subPreset, setSubPreset] = useState<SubPreset>("pop");
  const [hl, setHl] = useState("#ffd23f");
  const [thumbFrame, setThumbFrame] = useState(1);
  const [thumbLayout, setThumbLayout] = useState<ThumbLayout>("bottom");

  const st = statuses[current];
  const step = STEPS[current];

  function approve() {
    setStatuses((s) =>
      s.map((x, i) => (i === current ? "approved" : i === current + 1 && x === "todo" ? "review" : x)),
    );
    setRedo(false);
    if (current < STEPS.length - 1) setCurrent(current + 1);
  }

  function reopen() {
    // Mở lại một bước đã duyệt: các bước SAU đã làm chuyển "cần xem lại", không xóa.
    setStatuses((s) =>
      s.map((x, i) =>
        i === current ? "review" : i > current && (x === "approved" || x === "review") ? "stale" : x,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Demo · 3 sai lầm khi phát mẫu thử"
        subtitle="1080×1920 · 30fps · bản mockup, dữ liệu giả"
        actions={
          <Segmented
            label="Chế độ chạy"
            size="md"
            value={mode}
            onChange={setMode}
            options={[
              { value: "step", label: "Duyệt từng bước" },
              { value: "auto", label: "Tự chạy hết" },
            ]}
          />
        }
      />

      <Banner
        tone="info"
        message="Đây là bản mockup để duyệt giao diện. Bấm vào từng bước trên thanh để xem các mục chỉnh sửa. Chưa có gì được lưu hay gửi cho AI."
      />

      <TryRealCard />

      <Stepper
        names={STEPS.map((s) => s.name)}
        statuses={statuses}
        current={current}
        onSelect={(i) => {
          setCurrent(i);
          setRedo(false);
        }}
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Cột trái: xem trước kết quả của BƯỚC ĐANG MỞ */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-4">
          <Card title="Xem trước">
            <Preview
              step={current}
              status={st}
              label={step.preview}
              subPreset={subPreset}
              hl={hl}
              thumbFrame={thumbFrame}
              thumbLayout={thumbLayout}
            />
            <div className="mt-3 flex items-center justify-between gap-2">
              <select className="input" defaultValue="v2" aria-label="Phiên bản">
                <option value="v2">v2 · bạn sửa 3 mục · 10:42</option>
                <option value="v1">v1 · AI làm · 10:31</option>
              </select>
            </div>
            <p className="mt-2 text-meta text-[var(--text-muted)]">
              Mỗi lần AI làm lại hay bạn sửa là một phiên bản. Quay về bản cũ được, không mất gì.
            </p>
          </Card>
        </div>

        {/* Cột phải: thanh hành động của bước + các mục chỉnh sửa */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card
            title={
              <span className="flex items-center gap-2">
                Bước {current} · {step.name}
                <Badge tone={STATUS[st].tone} label={STATUS[st].label} />
              </span>
            }
            actions={
              <div className="flex flex-wrap gap-2">
                {st === "approved" ? (
                  <Button variant="secondary" onClick={reopen}>
                    <RotateCcw size={14} /> Mở lại để sửa
                  </Button>
                ) : (
                  <>
                    <Button variant="secondary" onClick={() => setRedo((v) => !v)}>
                      <Sparkles size={14} /> AI làm lại bước này
                    </Button>
                    <Button variant="primary" onClick={approve} disabled={st === "todo"}>
                      <Check size={14} />
                      {current < STEPS.length - 1 ? ` Duyệt, sang Bước ${current + 1}` : " Duyệt"}
                    </Button>
                  </>
                )}
              </div>
            }
          >
            <p className="text-sm">{step.did}</p>
            {st === "approved" && current < STEPS.length - 1 && (
              <p className="mt-2 text-meta text-[var(--text-muted)]">
                Mở lại để sửa thì các bước sau đã làm chuyển sang &quot;Cần xem lại&quot;, không bị
                xóa. Mục nào neo vào phần bạn không đổi thì giữ nguyên.
              </p>
            )}
            {st === "todo" && (
              <p className="mt-2 text-meta text-[var(--text-muted)]">
                Bước này chưa chạy. Bên dưới là giao diện sẽ thấy khi AI làm xong.
              </p>
            )}
            {redo && (
              <div className="mt-3 flex flex-col gap-2">
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Muốn AI đổi gì? Vd: ít minh họa hơn, ưu tiên ảnh sự kiện thật, bỏ quay màn hình web…"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-meta text-[var(--text-muted)]">
                    Chỉ bước này chạy lại. Mục bạn đã sửa tay được giữ, trừ khi bạn ghi rõ.
                  </span>
                  <Button variant="primary" small>
                    <Send size={14} /> Gửi AI
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {current === 0 && <InputStep />}
          {current === 1 && <CutStep />}
          {current === 2 && <IllustrateStep />}
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

      <ShellRightPanel title={`AI · Bước ${current} ${step.name}`}>
        <div className="flex flex-col gap-3 p-4">
          <Banner
            tone="muted"
            message={`Chat ở đây chỉ sửa Bước ${current}. Các bước đã duyệt giữ nguyên.`}
          />
          <div className="ml-auto max-w-[85%] rounded-[var(--radius)] bg-[var(--primary-soft)] p-3 text-sm">
            Minh họa ở câu 4 lấy cảnh đông người ở trung tâm thương mại nhé
          </div>
          <div className="max-w-[85%] rounded-[var(--radius)] bg-[var(--bg-subtle)] p-3 text-sm">
            Đã đổi #5 sang mall-popup/crowd-01.mp4 (Kho TryOh). Bước 0–1 không đổi, Bước 3–6 chưa
            làm.
          </div>
          <textarea className="input" rows={3} placeholder={`Nhắn AI về Bước ${current}…`} />
          <div className="flex justify-end">
            <Button variant="primary" small>
              <Send size={14} /> Gửi
            </Button>
          </div>
        </div>
      </ShellRightPanel>
    </div>
  );
}

/** Khung xem trước - mô phỏng nội dung từng bước trên khung hình video. */
function Preview({
  step,
  status,
  label,
  subPreset,
  hl,
  thumbFrame,
  thumbLayout,
}: {
  step: number;
  status: Status;
  label: string;
  subPreset: SubPreset;
  hl: string;
  thumbFrame: number;
  thumbLayout: ThumbLayout;
}) {
  // Mockup: bước chưa chạy vẫn hiện mô phỏng để xem được giao diện, kèm nhãn
  const sim = status === "todo" && (
    <span className="absolute left-2 top-2 rounded-full bg-neutral-700 px-2 py-1 text-xs">
      Mô phỏng
    </span>
  );

  if (step === 5) {
    const textTop = thumbLayout !== "right";
    return (
      <Frame>
        {sim}
        <UserRound
          size={150}
          strokeWidth={1.2}
          className={`absolute opacity-80 ${
            thumbLayout === "right" ? "bottom-0 right-0" : "bottom-0 left-1/2 -translate-x-1/2"
          }`}
        />
        <div
          className={`absolute flex flex-col gap-1 p-4 ${
            textTop ? "inset-x-0 top-6 items-center text-center" : "left-0 top-1/3 w-2/3"
          }`}
        >
          <span className="text-xl font-bold leading-tight">
            3 <span style={{ color: "#ffd23f" }}>SAI LẦM</span> KHI SAMPLING
          </span>
          <span className="text-sm opacity-80">Phí 12.000 mẫu thử</span>
        </div>
        <span className="absolute bottom-2 left-2 text-xs opacity-60">khung {thumbFrame + 1}</span>
      </Frame>
    );
  }

  return (
    <Frame>
      {sim}
      {step === 2 ? (
        <div className="absolute inset-x-0 top-0 flex h-1/2 items-center justify-center bg-neutral-700 text-sm">
          Minh họa #4 · đếm số 26%
        </div>
      ) : null}
      <UserRound size={120} strokeWidth={1.2} className={`opacity-80 ${step === 2 ? "mt-[50%]" : ""}`} />
      {step >= 3 && (
        <div className="absolute inset-x-0 bottom-[22%] px-4 text-center text-xl font-extrabold leading-tight">
          {subPreset === "line" ? (
            <>
              Nhưng sai lầm đầu tiên là phát mẫu mà <span style={{ color: hl }}>không thu</span> được
              dữ liệu gì.
            </>
          ) : subPreset === "karaoke" ? (
            <>
              Nhưng <span style={{ color: hl }}>sai lầm</span> đầu tiên là
            </>
          ) : (
            <span style={{ color: hl }}>SAI LẦM</span>
          )}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-2 text-xs">
        <Play size={14} />
        <span className="h-1 flex-1 rounded-full bg-neutral-600">
          <span className="block h-1 w-1/4 rounded-full bg-white" />
        </span>
        <span className="opacity-80">{label}</span>
      </div>
    </Frame>
  );
}

/** Tạo một video project 9:16 thật rồi mở luồng duyệt từng bước (Bước 0–1 chạy thật). */
function TryRealCard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      const p = await createProject({ name: name.trim(), width: 1080, height: 1920, fps: 30 });
      router.push(`/projects/${encodeURIComponent(p.id)}/steps`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Card title="Dựng thử với video thật">
      <p className="mb-3 text-sm">
        Tạo một project 9:16 mới, tải video tự quay lên. Bước 0–2 (đầu vào, cắt thô, minh họa) chạy thật,
        Bước 3–6 vẫn là mô phỏng.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          className="input max-w-sm"
          placeholder="Tên video, vd: Nói ngẫu hứng về sampling"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim() && !busy) void create();
          }}
        />
        <Button variant="primary" onClick={create} disabled={!name.trim() || busy}>
          Tạo và bắt đầu
        </Button>
      </div>
      {err && (
        <div className="mt-3">
          <Banner tone="danger" message="Không tạo được project" detail={err} />
        </div>
      )}
    </Card>
  );
}
