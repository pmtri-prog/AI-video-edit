"use client";

/**
 * MOCKUP - nội dung chỉnh sửa của từng bước. Dữ liệu giả, mọi điều khiển chỉ
 * giữ state cục bộ để thấy được cảm giác bấm, chưa ghi đi đâu.
 */

import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Film,
  Globe,
  Image as ImageIcon,
  Monitor,
  Music,
  Newspaper,
  Pin,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CheckboxField, Field, SwitchField } from "@/components/Field";
import { IconButton } from "@/components/IconButton";
import { OptionCard, OptionCardGroup } from "@/components/OptionCard";
import { Panel } from "@/components/Panel";
import { Segmented } from "@/components/Segmented";
import { StatTile } from "@/components/StatTile";
import { Chip, Frame, Nudge, Row, Rows, Swatch } from "./ui";

// ================================ Dữ liệu giả ================================

export const SCRIPT = [
  "Năm ngoái tại một ngày hội làm đẹp, bọn mình phát hơn 12.000 mẫu thử chỉ trong hai ngày.",
  "Nhưng sai lầm đầu tiên là phát mẫu mà không thu được dữ liệu gì.",
  "Một khảo sát cho thấy chỉ khoảng 1/4 người nhận mẫu nhớ tên nhãn hàng sau một tuần.",
  "Sai lầm thứ hai là chọn sai điểm đặt: đông người chưa chắc đã đúng người.",
  "Sai lầm thứ ba là không có bước chăm sóc sau khi khách nhận mẫu.",
  "Với TryOh!, mỗi mẫu thử đi kèm một lượt đồng ý dữ liệu và một tin nhắn chăm sóc sau 3 ngày.",
  "Nếu bạn đang chuẩn bị một chiến dịch sampling, nhắn mình để xem số liệu thật.",
];

const STYLE_COLORS = ["#ffffff", "#ffd23f", "#ed3c47", "#1d3557", "#2ec4b6"];

const muted = "text-[var(--text-muted)]";

// =============================== Bước 0 · Đầu vào ===============================

const FILES = [
  { name: "take-01.mp4", kind: "Video", dur: "4:12", note: "Camera chính · 3840×2160" },
  { name: "take-02.mp4", kind: "Video", dur: "2:05", note: "Quay lại câu 3–5" },
  { name: "mic-rode.wav", kind: "Âm thanh rời", dur: "6:30", note: "Tự khớp vào video ở Bước 1" },
];

const STEP_NAMES = ["Cắt thô", "Minh họa", "Phụ đề & chữ", "Nhạc nền", "Thumbnail"];

export function InputStep() {
  const [aspect, setAspect] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [platform, setPlatform] = useState<"tiktok" | "reels" | "youtube">("tiktok");
  const [autoApprove, setAutoApprove] = useState<boolean[]>([false, false, false, true, false]);

  return (
    <>
      <Card
        title="Kịch bản"
        actions={
          <Button variant="secondary" small>
            <Upload size={14} /> Nhập từ .docx / Google Docs
          </Button>
        }
      >
        <textarea className="input" rows={7} defaultValue={SCRIPT.join("\n")} />
        <p className={`mt-2 text-meta ${muted}`}>
          Mỗi dòng là một câu. AI dùng kịch bản để chọn take đúng ở Bước 1 và để sửa chính tả phụ
          đề. Không có kịch bản thì AI chỉ cắt khoảng lặng và câu lặp.
        </p>
      </Card>

      <Card
        title="File thô"
        actions={
          <Button variant="secondary" small>
            <Upload size={14} /> Tải thêm
          </Button>
        }
      >
        <table className="table">
          <thead>
            <tr>
              <th>Tên file</th>
              <th>Loại</th>
              <th>Thời lượng</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {FILES.map((f) => (
              <tr key={f.name}>
                <td className="text-sm">{f.name}</td>
                <td>
                  <Badge tone="muted" dot={false} label={f.kind} />
                </td>
                <td className="text-meta tabular-nums">{f.dur}</td>
                <td className={`text-meta ${muted}`}>{f.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Thiết lập chung">
        <Rows>
          <Row label="Khung hình">
            <Segmented
              label="Khung hình"
              value={aspect}
              onChange={setAspect}
              options={[
                { value: "9:16", label: "9:16 dọc" },
                { value: "16:9", label: "16:9 ngang" },
                { value: "1:1", label: "1:1" },
              ]}
            />
          </Row>
          <Row label="Nền tảng đăng" hint="Quyết định vùng an toàn của phụ đề và kích thước thumbnail">
            <Segmented
              label="Nền tảng"
              value={platform}
              onChange={setPlatform}
              options={[
                { value: "tiktok", label: "TikTok" },
                { value: "reels", label: "Reels" },
                { value: "youtube", label: "YouTube" },
              ]}
            />
          </Row>
          <Row label="Style Design" hint="Màu, font, logo - áp cho mọi bước">
            <select className="input" defaultValue="tryoh">
              <option value="tryoh">TryOh!</option>
              <option value="noti">noti.vn</option>
            </select>
          </Row>
          <Row label="Font chữ chính" hint="Dùng cho phụ đề, chữ trên hình và thumbnail">
            <select className="input" defaultValue="nunito">
              <option value="nunito">Nunito Sans</option>
              <option value="inter">Inter</option>
            </select>
          </Row>
          <Row label="Độ dài mong muốn" hint="Chỉ để tham khảo - AI không cắt lời của bạn để cho đủ số">
            <input className="input w-28" defaultValue="60–90 giây" />
          </Row>
        </Rows>
      </Card>

      <Card title="Cách duyệt">
        <p className={`mb-3 text-meta ${muted}`}>
          Bước nào tick &quot;tự duyệt&quot; thì AI làm xong sẽ đi tiếp luôn, không dừng chờ bạn. Tick
          hết = chạy một mạch như bản cũ.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STEP_NAMES.map((name, i) => (
            <CheckboxField
              key={name}
              id={`auto-${i}`}
              label={`Bước ${i + 1} · ${name}: tự duyệt`}
              checked={autoApprove[i]}
              onChange={(v) => setAutoApprove((a) => a.map((x, j) => (j === i ? v : x)))}
            />
          ))}
        </div>
      </Card>
    </>
  );
}

// =============================== Bước 1 · Cắt thô ===============================

interface Take {
  id: string;
  src: string;
  match: number;
  note: string;
}

const TAKES: { takes: Take[]; pick: string; warn?: string }[] = [
  {
    takes: [
      { id: "T1", src: "take-01 · 00:08", match: 97, note: "Trơn tru" },
      { id: "T2", src: "take-01 · 00:31", match: 91, note: "Vấp ở “mẫu thử”" },
    ],
    pick: "T1",
  },
  {
    takes: [{ id: "T1", src: "take-01 · 00:52", match: 95, note: "Trơn tru" }],
    pick: "T1",
  },
  {
    takes: [
      { id: "T1", src: "take-01 · 01:20", match: 82, note: "Đọc sai số “3/4”" },
      { id: "T2", src: "take-01 · 01:41", match: 90, note: "Ngập ngừng 1,2 s" },
      { id: "T3", src: "take-02 · 00:05", match: 98, note: "Trơn tru" },
    ],
    pick: "T3",
  },
  {
    takes: [
      { id: "T1", src: "take-02 · 00:24", match: 96, note: "Trơn tru" },
      { id: "T2", src: "take-02 · 00:40", match: 94, note: "Nói nhanh" },
    ],
    pick: "T1",
  },
  {
    takes: [{ id: "T1", src: "take-02 · 01:02", match: 74, note: "Thiếu “sau khi khách nhận mẫu”" }],
    pick: "T1",
    warn: "Không có take nói đủ câu",
  },
  {
    takes: [{ id: "T1", src: "take-01 · 03:10", match: 93, note: "Trơn tru" }],
    pick: "T1",
  },
  {
    takes: [
      { id: "T1", src: "take-01 · 03:44", match: 88, note: "Cười giữa câu" },
      { id: "T2", src: "take-01 · 03:58", match: 97, note: "Trơn tru" },
    ],
    pick: "T2",
  },
];

function matchTone(m: number): BadgeTone {
  return m >= 95 ? "success" : m >= 85 ? "muted" : "danger";
}

export function CutStep() {
  const [picks, setPicks] = useState(TAKES.map((t) => t.pick));
  const [open, setOpen] = useState<number | null>(2);
  const [adlib, setAdlib] = useState<"keep" | "drop">("drop");
  const [level, setLevel] = useState<"light" | "default" | "tight">("default");
  const [audioSrc, setAudioSrc] = useState<"mic" | "cam">("mic");
  const [denoise, setDenoise] = useState<"off" | "light" | "strong">("light");
  const [loud, setLoud] = useState(true);
  const [reframe, setReframe] = useState(true);
  const [punch, setPunch] = useState<"none" | "some" | "many">("some");
  const [filler, setFiller] = useState(true);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label="Thời lượng" value="1:28" sub="từ 6:17 file thô" />
        <StatTile label="Câu kịch bản có take" value="7/7" sub="1 câu nói thiếu chữ" />
        <StatTile label="Khoảng lặng đã bỏ" value="41" sub="tổng 2:10" />
        <StatTile label="Từ đệm đã bỏ" value="23" sub="ừm, à, kiểu, thì là" />
      </div>

      <Card title="Đối chiếu kịch bản và take">
        <p className={`mb-3 text-meta ${muted}`}>
          AI tìm mọi lần bạn nói từng câu, chấm mức khớp với kịch bản và chọn lần nói trơn nhất. Bấm
          một câu để nghe từng take, đổi take, sửa chữ hoặc chỉnh điểm cắt.
        </p>
        <div className="flex flex-col gap-2">
          {SCRIPT.map((line, i) => {
            const row = TAKES[i];
            const take = row.takes.find((t) => t.id === picks[i]) ?? row.takes[0];
            const isOpen = open === i;
            return (
              <div key={i} className="rounded-[var(--radius)] border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center gap-3 p-3 text-left"
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className={`w-6 shrink-0 text-meta ${muted}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{line}</span>
                  {row.warn && <Badge tone="danger" label={row.warn} />}
                  <Badge tone="muted" dot={false} label={`${take.id} · ${row.takes.length} take`} />
                  <Badge tone={matchTone(take.match)} label={`Khớp ${take.match}%`} />
                </button>
                {isOpen && (
                  <div className="flex flex-col gap-3 border-t border-[var(--border)] p-3">
                    <div className="flex flex-col gap-2">
                      {row.takes.map((t) => (
                        <label
                          key={t.id}
                          className="flex cursor-pointer items-center gap-3 text-sm"
                        >
                          <input
                            type="radio"
                            className="checkbox"
                            name={`take-${i}`}
                            checked={picks[i] === t.id}
                            onChange={() =>
                              setPicks((p) => p.map((x, j) => (j === i ? t.id : x)))
                            }
                          />
                          <IconButton label={`Nghe ${t.id}`} size="sm">
                            <Play size={14} />
                          </IconButton>
                          <span className="w-8 font-medium">{t.id}</span>
                          <span className={`w-32 text-meta ${muted}`}>{t.src}</span>
                          <Badge tone={matchTone(t.match)} label={`${t.match}%`} />
                          <span className={`text-meta ${muted}`}>{t.note}</span>
                        </label>
                      ))}
                    </div>
                    <Field label="Chữ thật sự đã nói (sửa ở đây thì phụ đề Bước 3 dùng luôn)">
                      <input className="input" defaultValue={line} />
                    </Field>
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-2 text-sm">
                        Điểm vào <Nudge value="01:20.40" label="Điểm vào" />
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        Điểm ra <Nudge value="01:25.85" label="Điểm ra" />
                      </div>
                      <Button variant="secondary" small>
                        <Trash2 size={14} /> Bỏ câu này
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-dashed border-[var(--border)] p-3">
            <Badge tone="muted" dot={false} label="Ngoài kịch bản" />
            <span className="min-w-0 flex-1 text-sm">
              “À mà nói thêm là bên mình có làm cả ở tỉnh nữa nha.”
            </span>
            <span className={`text-meta ${muted}`}>take-01 · 02:40</span>
            <Segmented
              label="Câu ngoài kịch bản"
              value={adlib}
              onChange={setAdlib}
              options={[
                { value: "keep", label: "Giữ" },
                { value: "drop", label: "Bỏ" },
              ]}
            />
          </div>
        </div>
      </Card>

      <Card title="Khoảng lặng và từ đệm">
        <Rows>
          <Row label="Mức cắt" hint="Gắt = nhịp nhanh kiểu TikTok, nhẹ = giữ nhịp nói tự nhiên">
            <Segmented
              label="Mức cắt"
              value={level}
              onChange={setLevel}
              options={[
                { value: "light", label: "Nhẹ" },
                { value: "default", label: "Vừa" },
                { value: "tight", label: "Gắt" },
              ]}
            />
          </Row>
          <Row label="Cắt khoảng lặng dài hơn">
            <Nudge value="350 ms" label="Ngưỡng khoảng lặng" />
          </Row>
          <Row label="Giữ hơi thở trước / sau mỗi câu" hint="Đủ để câu không bị cụt đầu, cụt đuôi">
            <Nudge value="120 ms" label="Trước câu" />
            <Nudge value="200 ms" label="Sau câu" />
          </Row>
          <Row label="Bỏ từ đệm" hint="23 chỗ: ừm (9), à (7), kiểu (4), thì là (3)">
            <button
              type="button"
              role="switch"
              aria-checked={filler}
              aria-label="Bỏ từ đệm"
              className="switch"
              onClick={() => setFiller((v) => !v)}
            />
          </Row>
        </Rows>
      </Card>

      <Card title="Âm thanh">
        <Rows>
          <Row label="Nguồn tiếng">
            <Segmented
              label="Nguồn tiếng"
              value={audioSrc}
              onChange={setAudioSrc}
              options={[
                { value: "mic", label: "Mic rời (mic-rode.wav)" },
                { value: "cam", label: "Tiếng camera" },
              ]}
            />
          </Row>
          <Row label="Đồng bộ mic với hình" hint="Tự khớp theo sóng âm - lệch đo được +0,42 s">
            <Nudge value="+0,42 s" label="Độ lệch tiếng" />
            <Button variant="secondary" small>
              <Play size={14} /> Nghe thử
            </Button>
          </Row>
          <Row label="Khử ồn">
            <Segmented
              label="Khử ồn"
              value={denoise}
              onChange={setDenoise}
              options={[
                { value: "off", label: "Tắt" },
                { value: "light", label: "Nhẹ" },
                { value: "strong", label: "Mạnh" },
              ]}
            />
          </Row>
          <Row label="Cân bằng âm lượng" hint="Đưa về -14 LUFS, mức chuẩn của TikTok và YouTube">
            <button
              type="button"
              role="switch"
              aria-checked={loud}
              aria-label="Cân bằng âm lượng"
              className="switch"
              onClick={() => setLoud((v) => !v)}
            />
          </Row>
        </Rows>
      </Card>

      <Card title="Hình">
        <Rows>
          <Row label="Đưa khung 16:9 về 9:16 theo mặt" hint="Khung tự bám theo mặt người nói">
            <button
              type="button"
              role="switch"
              aria-checked={reframe}
              aria-label="Reframe theo mặt"
              className="switch"
              onClick={() => setReframe((v) => !v)}
            />
          </Row>
          <Row label="Zoom nhấn ở câu quan trọng" hint="Đổi cỡ khung để đỡ đơn điệu, không đổi nội dung">
            <Segmented
              label="Zoom nhấn"
              value={punch}
              onChange={setPunch}
              options={[
                { value: "none", label: "Không" },
                { value: "some", label: "Vừa" },
                { value: "many", label: "Nhiều" },
              ]}
            />
          </Row>
          <Row label="Chỉnh màu">
            <select className="input" defaultValue="skin">
              <option value="none">Giữ nguyên</option>
              <option value="skin">Sáng da, tươi</option>
              <option value="warm">Ấm</option>
              <option value="saved">Preset đã lưu: Studio TryOh</option>
            </select>
          </Row>
        </Rows>
      </Card>
    </>
  );
}

// =============================== Bước 2 · Minh họa ===============================

type InsertKind = "video" | "image" | "motion" | "web";
type InsertSource = "drive" | "press" | "web" | "upload" | "ai";

interface Insert {
  line: number;
  time: string;
  kind: InsertKind;
  source: InsertSource;
  file: string;
  display: "full" | "top" | "pip";
  state: "ai" | "edited" | "stale";
  credit?: string;
  motion?: { type: string; title: string; data: [string, string][]; src: string };
}

const INSERTS: Insert[] = [
  {
    line: 0,
    time: "00:00 → 00:04",
    kind: "video",
    source: "drive",
    file: "event-media/beauty-fest/booth-wide-02.mp4",
    display: "full",
    state: "ai",
  },
  {
    line: 0,
    time: "00:04 → 00:07",
    kind: "image",
    source: "press",
    file: "Bài báo về ngày hội (ảnh 2/5)",
    display: "top",
    state: "ai",
    credit: "Ảnh: báo Thanh Niên",
  },
  {
    line: 1,
    time: "00:08 → 00:10",
    kind: "motion",
    source: "ai",
    file: "Thẻ chương",
    display: "full",
    state: "ai",
    motion: { type: "Thẻ chương", title: "SAI LẦM #1", data: [], src: "" },
  },
  {
    line: 2,
    time: "00:15 → 00:20",
    kind: "motion",
    source: "web",
    file: "Đếm số",
    display: "top",
    state: "ai",
    motion: {
      type: "Đếm số",
      title: "Nhớ tên nhãn sau 1 tuần",
      data: [["Nhớ tên", "26%"], ["Không nhớ", "74%"]],
      src: "Khảo sát 2025 (AI tìm, chờ bạn xác nhận link)",
    },
  },
  {
    line: 3,
    time: "00:24 → 00:28",
    kind: "video",
    source: "drive",
    file: "event-media/mall-popup/crowd-03.mp4",
    display: "full",
    state: "stale",
  },
  {
    line: 5,
    time: "00:34 → 00:40",
    kind: "web",
    source: "web",
    file: "tryoh.vn · màn hình đồng ý dữ liệu",
    display: "pip",
    state: "edited",
  },
  {
    line: 6,
    time: "01:20 → 01:28",
    kind: "motion",
    source: "ai",
    file: "Thẻ kêu gọi",
    display: "top",
    state: "ai",
    motion: { type: "Kêu gọi", title: "Nhắn mình để xem số liệu thật", data: [], src: "" },
  },
];

const KIND_LABEL: Record<InsertKind, string> = {
  video: "Video",
  image: "Ảnh",
  motion: "Motion graphic",
  web: "Quay màn hình web",
};
const KIND_ICON = { video: Film, image: ImageIcon, motion: BarChart3, web: Monitor };
const SOURCE_LABEL: Record<InsertSource, string> = {
  drive: "Kho TryOh (Drive)",
  press: "Ảnh báo chí",
  web: "Tìm trên web",
  upload: "Tải lên",
  ai: "AI dựng",
};
const STATE: Record<Insert["state"], { tone: BadgeTone; label: string }> = {
  ai: { tone: "muted", label: "AI đề xuất" },
  edited: { tone: "success", label: "Bạn đã sửa" },
  stale: { tone: "danger", label: "Cần xem lại" },
};

/** Vị trí từng minh họa trên trục 88 giây - dựng dải phủ. */
const COVER = [
  [0, 7],
  [8, 10],
  [15, 20],
  [24, 28],
  [34, 40],
  [80, 88],
];

export function IllustrateStep() {
  const [open, setOpen] = useState<number | null>(3);
  const [allow, setAllow] = useState({ drive: true, press: true, web: true, capture: true, ai: false });

  return (
    <>
      <Banner
        tone="danger"
        message="Bạn đã đổi take câu 4 ở Bước 1 sau khi AI làm bước này. Minh họa #5 neo vào câu đó bị lệch 0,8 s nên được đánh dấu Cần xem lại. Các minh họa khác giữ nguyên."
        actions={
          <Button variant="secondary" small>
            Tự căn lại theo câu
          </Button>
        }
      />

      <Card title="Quy tắc chung">
        <Rows>
          <Row label="Nguồn được phép dùng" hint="Bỏ tick nguồn nào thì AI không được lấy từ nguồn đó">
            <div className="flex flex-wrap gap-4">
              {(
                [
                  ["drive", "Kho TryOh"],
                  ["press", "Ảnh báo chí"],
                  ["web", "Số liệu trên web"],
                  ["capture", "Quay màn hình web"],
                  ["ai", "Ảnh AI"],
                ] as const
              ).map(([k, label]) => (
                <CheckboxField
                  key={k}
                  id={`allow-${k}`}
                  label={label}
                  checked={allow[k]}
                  onChange={(v) => setAllow((a) => ({ ...a, [k]: v }))}
                />
              ))}
            </div>
          </Row>
          <Row label="Che người nói tối đa" hint="Phần trăm thời lượng bị minh họa phủ kín">
            <Nudge value="40%" label="Che tối đa" />
          </Row>
          <Row label="Chuyển cảnh mặc định">
            <select className="input" defaultValue="fade">
              <option value="cut">Cắt thẳng</option>
              <option value="fade">Mờ dần 0,3 s</option>
              <option value="slide">Trượt lên</option>
              <option value="zoom">Zoom</option>
              <option value="whip">Lia nhanh</option>
            </select>
          </Row>
          <Row label="Âm thanh khi vào minh họa">
            <select className="input" defaultValue="whoosh">
              <option value="none">Không</option>
              <option value="whoosh">whoosh-soft</option>
              <option value="pop">pop-click</option>
            </select>
          </Row>
        </Rows>
      </Card>

      <Card
        title={`Danh sách minh họa (${INSERTS.length})`}
        actions={
          <Button variant="secondary" small>
            <Plus size={14} /> Thêm minh họa tại câu…
          </Button>
        }
      >
        <div className="mb-3">
          <div className="relative h-6 overflow-hidden rounded-[var(--radius)] bg-[var(--bg-subtle)]">
            {COVER.map(([a, b], i) => (
              <span
                key={i}
                className="absolute inset-y-0 border-x border-[var(--primary)] bg-[var(--primary-soft)]"
                style={{ left: `${(a / 88) * 100}%`, width: `${((b - a) / 88) * 100}%` }}
              />
            ))}
          </div>
          <div className={`mt-1 flex justify-between text-meta ${muted}`}>
            <span>00:00</span>
            <span>Đang che 31% thời lượng · còn lại là người nói</span>
            <span>01:28</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {INSERTS.map((it, i) => (
            <InsertRow
              key={i}
              n={i + 1}
              it={it}
              open={open === i}
              onToggle={() => setOpen(open === i ? null : i)}
            />
          ))}
        </div>
      </Card>
    </>
  );
}

function InsertRow({
  n,
  it,
  open,
  onToggle,
}: {
  n: number;
  it: Insert;
  open: boolean;
  onToggle: () => void;
}) {
  const [kind, setKind] = useState<InsertKind>(it.kind);
  const [display, setDisplay] = useState(it.display);
  const [pick, setPick] = useState(0);
  const Icon = KIND_ICON[kind];
  const st = STATE[it.state];

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)]">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left">
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className={`w-6 shrink-0 text-meta ${muted}`}>#{n}</span>
        <Icon size={16} className={muted} />
        <span className="w-32 shrink-0 text-meta tabular-nums">{it.time}</span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {it.motion ? `${it.motion.type}: ${it.motion.title}` : it.file}
        </span>
        <Badge tone="muted" dot={false} label={SOURCE_LABEL[it.source]} />
        <Badge tone={st.tone} label={st.label} />
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] p-3">
          <p className={`text-meta ${muted}`}>
            Neo vào câu {it.line + 1}: “{SCRIPT[it.line]}”
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              label="Loại minh họa"
              value={kind}
              onChange={setKind}
              options={[
                { value: "video", label: "Video" },
                { value: "image", label: "Ảnh" },
                { value: "motion", label: "Motion graphic" },
                { value: "web", label: "Quay web" },
              ]}
            />
            <select className="input w-48" defaultValue={it.source}>
              {(Object.keys(SOURCE_LABEL) as InsertSource[]).map((s) => (
                <option key={s} value={s} disabled={s === "ai" && kind !== "motion"}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          {kind === "motion" && it.motion ? (
            <Panel title="Nội dung motion graphic">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Kiểu">
                  <select className="input" defaultValue={it.motion.type}>
                    <option>Đếm số</option>
                    <option>Thanh so sánh</option>
                    <option>Danh sách</option>
                    <option>Mốc thời gian</option>
                    <option>Thẻ chương</option>
                    <option>Kêu gọi</option>
                  </select>
                </Field>
                <Field label="Tiêu đề">
                  <input className="input" defaultValue={it.motion.title} />
                </Field>
                {it.motion.data.map(([k, v], j) => (
                  <Field key={j} label={`Số liệu ${j + 1}`}>
                    <div className="flex gap-2">
                      <input className="input" defaultValue={k} />
                      <input className="input w-24" defaultValue={v} />
                    </div>
                  </Field>
                ))}
              </div>
              {it.motion.src && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone="danger" label="Nguồn chưa xác nhận" />
                  <span className="text-meta">{it.motion.src}</span>
                  <Button variant="secondary" small>
                    <Globe size={14} /> Mở link nguồn
                  </Button>
                </div>
              )}
            </Panel>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm">Chọn phương án</span>
                <div className="flex gap-2">
                  <Button variant="secondary" small>
                    <Search size={14} /> Tìm phương án khác
                  </Button>
                  <Button variant="secondary" small>
                    <Upload size={14} /> Tải lên
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((k) => (
                  <div key={k} className="flex flex-col gap-1">
                    <Frame ratio="16 / 9" selected={pick === k} onClick={() => setPick(k)}>
                      {kind === "image" ? <Newspaper size={24} /> : <Film size={24} />}
                    </Frame>
                    <span className={`truncate text-meta ${muted}`}>
                      {k === 0 ? it.file.split("/").pop() : `phương án ${k + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Rows>
            <Row label="Cách hiện">
              <Segmented
                label="Cách hiện"
                value={display}
                onChange={setDisplay}
                options={[
                  { value: "full", label: "Toàn màn hình" },
                  { value: "top", label: "Nửa trên" },
                  { value: "pip", label: "Khung nhỏ" },
                ]}
              />
            </Row>
            <Row label="Thời gian hiện" hint="Neo theo câu - sửa Bước 1 thì tự dời theo">
              <Nudge value={it.time.split(" → ")[0]} label="Bắt đầu" />
              <Nudge value={it.time.split(" → ")[1]} label="Kết thúc" />
            </Row>
            <Row label="Chuyển cảnh vào / ra">
              <select className="input w-36" defaultValue="fade">
                <option value="cut">Cắt thẳng</option>
                <option value="fade">Mờ dần</option>
                <option value="slide">Trượt lên</option>
                <option value="zoom">Zoom</option>
              </select>
              <select className="input w-36" defaultValue="cut">
                <option value="cut">Cắt thẳng</option>
                <option value="fade">Mờ dần</option>
                <option value="slide">Trượt xuống</option>
              </select>
            </Row>
            <Row label="Hiệu ứng âm thanh">
              <select className="input w-40" defaultValue="whoosh">
                <option value="none">Không</option>
                <option value="whoosh">whoosh-soft</option>
                <option value="pop">pop-click</option>
                <option value="ding">ding-bright</option>
              </select>
              <IconButton label="Nghe thử" size="sm">
                <Play size={14} />
              </IconButton>
              <input type="range" className="slider w-24" defaultValue={60} aria-label="Âm lượng SFX" />
            </Row>
            {(it.source === "press" || it.credit) && (
              <Row label="Ghi nguồn trên hình" hint="Bắt buộc với ảnh báo chí và số liệu">
                <input className="input w-48" defaultValue={it.credit ?? ""} />
              </Row>
            )}
          </Rows>

          <div className="flex justify-end">
            <Button variant="destructive" small>
              <Trash2 size={14} /> Xóa minh họa
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================== Bước 3 · Phụ đề & chữ ===============================

const SUB_LINES = [
  ["00:00.2", "Năm ngoái tại một ngày hội làm đẹp", "ngày hội"],
  ["00:02.1", "bọn mình phát hơn 12.000 mẫu thử", "12.000"],
  ["00:04.0", "chỉ trong hai ngày.", ""],
  ["00:08.3", "Nhưng sai lầm đầu tiên là", "sai lầm"],
  ["00:10.1", "phát mẫu mà không thu được dữ liệu gì.", "dữ liệu"],
];

export type SubPreset = "karaoke" | "pop" | "line";

export function SubtitleStep({
  preset,
  setPreset,
  hl,
  setHl,
}: {
  preset: SubPreset;
  setPreset: (p: SubPreset) => void;
  hl: string;
  setHl: (c: string) => void;
}) {
  const [weight, setWeight] = useState<"700" | "800" | "900">("800");
  const [outline, setOutline] = useState<"stroke" | "shadow" | "box">("stroke");
  const [pos, setPos] = useState<"top" | "mid" | "bottom">("bottom");
  const [caps, setCaps] = useState<"keep" | "upper">("keep");
  const [autoKw, setAutoKw] = useState(true);

  return (
    <>
      <Card title="Kiểu phụ đề">
        <OptionCardGroup label="Kiểu phụ đề" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <OptionCard
            selected={preset === "karaoke"}
            onSelect={() => setPreset("karaoke")}
            title="Karaoke từng chữ"
            description="Chữ đang đọc đổi màu, cả câu đứng yên"
          />
          <OptionCard
            selected={preset === "pop"}
            onSelect={() => setPreset("pop")}
            title="Bật từng cụm 2–3 chữ"
            description="Kiểu CapCut, nhịp nhanh - AI chọn cho video này"
          />
          <OptionCard
            selected={preset === "line"}
            onSelect={() => setPreset("line")}
            title="Câu đầy đủ 2 dòng"
            description="Dễ đọc, hợp video dài trên YouTube"
          />
        </OptionCardGroup>
      </Card>

      <Card title="Định dạng chữ">
        <Rows>
          <Row label="Font" hint="Lấy theo Bước 0 - đổi ở đây chỉ áp cho phụ đề">
            <select className="input" defaultValue="nunito">
              <option value="nunito">Nunito Sans</option>
              <option value="inter">Inter</option>
            </select>
            <Segmented
              label="Độ đậm"
              value={weight}
              onChange={setWeight}
              options={[
                { value: "700", label: "Đậm" },
                { value: "800", label: "Rất đậm" },
                { value: "900", label: "Đen" },
              ]}
            />
          </Row>
          <Row label="Cỡ chữ">
            <Nudge value="64 px" label="Cỡ chữ" />
          </Row>
          <Row label="Màu chữ nhấn" hint="Chữ đang đọc và từ khóa - màu lấy từ Style Design">
            <div className="flex gap-2">
              {STYLE_COLORS.map((c) => (
                <Swatch key={c} color={c} selected={hl === c} onClick={() => setHl(c)} />
              ))}
            </div>
          </Row>
          <Row label="Viền / nền chữ">
            <Segmented
              label="Viền chữ"
              value={outline}
              onChange={setOutline}
              options={[
                { value: "stroke", label: "Viền đen" },
                { value: "shadow", label: "Bóng mờ" },
                { value: "box", label: "Hộp nền" },
              ]}
            />
          </Row>
          <Row label="Chữ hoa">
            <Segmented
              label="Chữ hoa"
              value={caps}
              onChange={setCaps}
              options={[
                { value: "keep", label: "Giữ nguyên" },
                { value: "upper", label: "IN HOA" },
              ]}
            />
          </Row>
          <Row label="Vị trí" hint="Cách đáy 420 px để không bị nút TikTok che">
            <Segmented
              label="Vị trí phụ đề"
              value={pos}
              onChange={setPos}
              options={[
                { value: "top", label: "Trên" },
                { value: "mid", label: "Giữa" },
                { value: "bottom", label: "Dưới" },
              ]}
            />
            <Nudge value="420 px" label="Cách đáy" />
          </Row>
          <Row label="Tối đa mỗi dòng">
            <Nudge value="16 ký tự" label="Ký tự mỗi dòng" />
          </Row>
        </Rows>
      </Card>

      <Card title="Từ khóa nhấn">
        <SwitchField
          id="auto-kw"
          label="AI tự chọn thêm từ khóa theo nội dung"
          checked={autoKw}
          onChange={setAutoKw}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {["12.000", "sai lầm", "dữ liệu", "đúng người", "TryOh!"].map((k) => (
            <Chip key={k}>{k}</Chip>
          ))}
          <input className="input w-40" placeholder="Thêm từ khóa…" />
        </div>
      </Card>

      <Card title="Chữ trên màn hình (ngoài phụ đề)">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Hook 3 giây đầu" hint="Câu chữ to ngay khi mở video, giữ người xem lại">
            <input className="input" defaultValue="3 sai lầm làm phí 12.000 mẫu thử" />
          </Field>
          <Field label="Key chính (dải trên)" hint="Chủ đề cố định cả video">
            <input className="input" defaultValue="SAMPLING CÓ DỮ LIỆU" />
          </Field>
        </div>
        <Field label="Key phụ theo đoạn (dải dưới)" className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip>00:08 · Sai lầm 1: không có dữ liệu</Chip>
            <Chip>00:24 · Sai lầm 2: sai điểm đặt</Chip>
            <Chip>00:31 · Sai lầm 3: không chăm sóc</Chip>
          </div>
        </Field>
      </Card>

      <Card title="Sửa từng dòng phụ đề">
        <table className="table">
          <thead>
            <tr>
              <th>Thời điểm</th>
              <th>Nội dung</th>
              <th>Từ nhấn</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {SUB_LINES.map(([t, text, kw]) => (
              <tr key={t}>
                <td className="text-meta tabular-nums">{t}</td>
                <td>
                  <input className="input" defaultValue={text} />
                </td>
                <td>{kw && <Chip>{kw}</Chip>}</td>
                <td>
                  <div className="flex gap-1">
                    <IconButton label="Nghe đoạn này" size="sm">
                      <Play size={14} />
                    </IconButton>
                    <IconButton label="Xóa dòng" size="sm" tone="danger">
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// =============================== Bước 4 · Nhạc nền ===============================

const TRACKS = [
  { id: "a", name: "Bright Steps", mood: "Năng động · tích cực", bpm: 104, dur: "2:31", lic: "Pixabay License" },
  { id: "b", name: "Morning Pitch", mood: "Tự tin · corporate", bpm: 98, dur: "3:05", lic: "CC BY 4.0 - cần ghi tên tác giả" },
  { id: "c", name: "Small Wins", mood: "Nhẹ · lofi", bpm: 90, dur: "2:12", lic: "CC0" },
];

export function MusicStep() {
  const [track, setTrack] = useState("a");
  const [split, setSplit] = useState(false);

  return (
    <>
      <Card
        title="AI gợi ý nhạc theo nội dung"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" small>
              <RefreshCw size={14} /> Gợi ý bài khác
            </Button>
            <Button variant="secondary" small>
              <Upload size={14} /> Nhạc của bạn
            </Button>
          </div>
        }
      >
        <p className={`mb-3 text-meta ${muted}`}>
          AI đọc nội dung: B2B, giọng tự tin, nhịp nói vừa → tìm nhạc mood Năng động / Tích cực,
          95–110 BPM, không lời.
        </p>
        <OptionCardGroup label="Bài nhạc" className="flex flex-col gap-2">
          {TRACKS.map((t) => (
            <OptionCard
              key={t.id}
              selected={track === t.id}
              onSelect={() => setTrack(t.id)}
              icon={Music}
              title={`${t.name} · ${t.dur} · ${t.bpm} BPM`}
              description={t.mood}
              badge={<Badge tone="muted" dot={false} label={t.lic} />}
            />
          ))}
        </OptionCardGroup>
      </Card>

      <Card title="Mix âm thanh">
        <Rows>
          {(
            [
              ["Âm lượng nhạc", "-18 dB", 40],
              ["Tự hạ nhạc khi có lời nói", "-10 dB", 55],
              ["Âm lượng hiệu ứng (SFX)", "-6 dB", 70],
            ] as const
          ).map(([label, v, d]) => (
            <Row key={label} label={label}>
              <input type="range" className="slider w-48" defaultValue={d} aria-label={label} />
              <span className="w-14 text-right text-sm tabular-nums">{v}</span>
            </Row>
          ))}
          <Row label="Bắt đầu từ đoạn nào của bài" hint="Bỏ phần intro dài của bài nhạc">
            <Nudge value="00:12" label="Điểm bắt đầu bài" />
            <IconButton label="Nghe từ đây" size="sm">
              <Play size={14} />
            </IconButton>
          </Row>
          <Row label="Fade vào / ra">
            <Nudge value="1,0 s" label="Fade vào" />
            <Nudge value="2,0 s" label="Fade ra" />
          </Row>
          <Row label="Đổi nhạc theo đoạn" hint="Vd: phần kêu gọi cuối dùng bài khác hoặc tắt nhạc">
            <button
              type="button"
              role="switch"
              aria-checked={split}
              aria-label="Đổi nhạc theo đoạn"
              className="switch"
              onClick={() => setSplit((v) => !v)}
            />
          </Row>
        </Rows>
      </Card>

      <Banner
        tone="muted"
        message="Chỉ hiện bài có giấy phép rõ trong thư viện. Bài CC BY sẽ tự thêm dòng ghi tên tác giả vào caption ở Bước 6."
      />
    </>
  );
}

// =============================== Bước 5 · Thumbnail ===============================

const FRAMES = [
  { t: "00:09", eye: true, light: 94, sharp: 91 },
  { t: "00:23", eye: true, light: 90, sharp: 95 },
  { t: "00:31", eye: false, light: 88, sharp: 90 },
  { t: "00:47", eye: true, light: 82, sharp: 86 },
  { t: "01:02", eye: true, light: 92, sharp: 80 },
  { t: "01:21", eye: false, light: 95, sharp: 93, closed: true },
];

export type ThumbLayout = "right" | "bottom" | "center";

export function ThumbnailStep({
  frame,
  setFrame,
  layout,
  setLayout,
}: {
  frame: number;
  setFrame: (i: number) => void;
  layout: ThumbLayout;
  setLayout: (l: ThumbLayout) => void;
}) {
  const [cutout, setCutout] = useState(true);
  const [glow, setGlow] = useState(true);
  const [save, setSave] = useState(true);
  const [variants, setVariants] = useState<"1" | "2" | "3">("3");

  return (
    <>
      <Card
        title="Chọn khung hình người nói"
        actions={
          <Button variant="secondary" small>
            <Upload size={14} /> Dùng ảnh riêng
          </Button>
        }
      >
        <p className={`mb-3 text-meta ${muted}`}>
          AI chấm từng khung: mắt nhìn thẳng camera, mặt đủ sáng, ảnh nét, không nhắm mắt, không
          há miệng giữa chữ.
        </p>
        <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
          {FRAMES.map((f, i) => (
            <div key={f.t} className="flex flex-col gap-1">
              <Frame selected={frame === i} onClick={() => setFrame(i)}>
                <UserRound size={40} strokeWidth={1.5} />
              </Frame>
              <span className="text-meta tabular-nums">{f.t}</span>
              <div className="flex flex-wrap gap-1">
                {f.closed ? (
                  <Badge tone="danger" label="Nhắm mắt" />
                ) : (
                  <Badge
                    tone={f.eye ? "success" : "muted"}
                    label={f.eye ? "Nhìn camera" : "Nhìn lệch"}
                  />
                )}
                <Badge tone="muted" dot={false} label={`Sáng ${f.light}`} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Chữ, icon, logo">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tiêu đề chính" hint="Tối đa 6 chữ - đọc được khi ảnh nhỏ bằng ngón tay">
            <input className="input" defaultValue="3 SAI LẦM KHI SAMPLING" />
          </Field>
          <Field label="Dòng phụ">
            <input className="input" defaultValue="Phí 12.000 mẫu thử" />
          </Field>
          <Field label="Chữ đổi màu nhấn">
            <input className="input" defaultValue="SAI LẦM" />
          </Field>
          <Field label="Logo / icon" hint="Logo chỉ lấy từ thư viện logo, không vẽ">
            <div className="flex flex-wrap items-center gap-2">
              <Chip>Icon: cảnh báo</Chip>
              <Chip>Logo TryOh!</Chip>
              <Button variant="secondary" small>
                <Plus size={14} /> Thêm
              </Button>
            </div>
          </Field>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <SwitchField id="cutout" label="Tách nền người nói" checked={cutout} onChange={setCutout} />
          <SwitchField id="glow" label="Viền sáng quanh người" checked={glow} onChange={setGlow} />
        </div>
      </Card>

      <Card title="Bố cục và tính nhất quán">
        <OptionCardGroup label="Bố cục" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <OptionCard
            selected={layout === "right"}
            onSelect={() => setLayout("right")}
            title="Người phải · chữ trái"
            description="Hợp tiêu đề dài 2–3 dòng"
          />
          <OptionCard
            selected={layout === "bottom"}
            onSelect={() => setLayout("bottom")}
            title="Người dưới · chữ trên"
            description="Mẫu đang dùng cho series"
          />
          <OptionCard
            selected={layout === "center"}
            onSelect={() => setLayout("center")}
            title="Người giữa · chữ hai bên"
            description="Hợp tiêu đề ngắn 1 dòng"
          />
        </OptionCardGroup>
        <div className="mt-3">
          <Rows>
            <Row label="Font" hint="Cố định cho cả series">
              <Badge tone="muted" dot={false} label="Nunito Sans · Black 900" />
            </Row>
            <Row label="Bảng màu" hint="Theo Style Design TryOh!">
              <div className="flex gap-2">
                {STYLE_COLORS.map((c) => (
                  <Swatch key={c} color={c} />
                ))}
              </div>
            </Row>
            <Row label="Số phương án tạo ra">
              <Segmented
                label="Số phương án"
                value={variants}
                onChange={setVariants}
                options={[
                  { value: "1", label: "1" },
                  { value: "2", label: "2" },
                  { value: "3", label: "3" },
                ]}
              />
            </Row>
          </Rows>
          <div className="mt-3">
            <CheckboxField
              id="save-tpl"
              label="Lưu bố cục này làm mẫu cho các video sau cùng series"
              checked={save}
              onChange={setSave}
            />
          </div>
        </div>
      </Card>

      <Card title="Kích thước xuất">
        <div className="flex flex-wrap gap-6">
          <CheckboxField id="sz-1" label="1080×1920 · ảnh bìa TikTok / Reels" checked onChange={() => {}} />
          <CheckboxField id="sz-2" label="1280×720 · YouTube" checked onChange={() => {}} />
          <CheckboxField id="sz-3" label="1080×1080 · Facebook" checked={false} onChange={() => {}} />
        </div>
      </Card>
    </>
  );
}

// =============================== Bước 6 · Duyệt & xuất bản ===============================

const NOTES = [
  { t: "00:05", text: "Ảnh báo chí hơi mờ, tìm ảnh khác", to: "Bước 2 · minh họa #2" },
  { t: "00:41", text: "Phụ đề che chữ trên áo", to: "Bước 3 · vị trí phụ đề" },
];

const QC = [
  { ok: true, text: "Không có chữ tiếng Việt mất dấu" },
  { ok: true, text: "Phụ đề nằm trong vùng an toàn của TikTok" },
  { ok: false, text: "Âm lượng đỉnh -0,6 dB tại 00:41 - dễ rè trên loa điện thoại", to: "Bước 4" },
  { ok: true, text: "Không có khung đen hay khung đứng hình" },
  { ok: true, text: "Mọi ảnh báo chí và số liệu đã ghi nguồn" },
];

export function PublishStep() {
  const [quality, setQuality] = useState<"standard" | "high">("standard");

  return (
    <>
      <Card title="Ghi chú duyệt">
        <p className={`mb-3 text-meta ${muted}`}>
          Xem bản draft bên trái, ghim ghi chú tại thời điểm. AI tự xếp mỗi ghi chú về đúng bước và
          chỉ chạy lại bước đó.
        </p>
        <div className="flex flex-col gap-2">
          {NOTES.map((n) => (
            <div key={n.t} className="flex flex-wrap items-center gap-3">
              <Pin size={14} className="text-[var(--primary)]" />
              <span className="w-12 text-meta tabular-nums">{n.t}</span>
              <span className="min-w-0 flex-1 text-sm">{n.text}</span>
              <Badge tone="running" label={`→ ${n.to}`} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input className="input" placeholder="Ghi chú tại 00:00…" />
          <Button variant="secondary">
            <Pin size={14} /> Ghim
          </Button>
        </div>
      </Card>

      <Card title="Kiểm tra tự động">
        <ul className="flex flex-col gap-2">
          {QC.map((q) => (
            <li key={q.text} className="flex items-center gap-2 text-sm">
              {q.ok ? (
                <Check size={16} className="text-[var(--success)]" />
              ) : (
                <AlertTriangle size={16} className="text-[var(--danger)]" />
              )}
              <span className="flex-1">{q.text}</span>
              {q.to && (
                <Button variant="secondary" small>
                  Sửa ở {q.to}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Nội dung đăng">
        <div className="flex flex-col gap-3">
          <Field label="Tiêu đề">
            <input className="input" defaultValue="3 sai lầm khiến chiến dịch sampling phí tiền" />
          </Field>
          <Field label="Caption">
            <textarea
              className="input"
              rows={3}
              defaultValue="Phát 12.000 mẫu thử mà không biết ai nhận, nhận xong có nhớ mình không? Đây là 3 sai lầm mình thấy nhiều nhất."
            />
          </Field>
          <Field label="Hashtag">
            <div className="flex flex-wrap items-center gap-2">
              {["#sampling", "#marketing", "#tryoh", "#fmcg"].map((h) => (
                <Chip key={h}>{h}</Chip>
              ))}
            </div>
          </Field>
          <Field label="Nguồn trích dẫn" hint="Tự gom từ ảnh báo chí, số liệu (Bước 2) và nhạc CC BY (Bước 4)">
            <textarea
              className="input"
              rows={2}
              defaultValue={"Ảnh: báo Thanh Niên\nSố liệu: khảo sát 2025 (link)"}
            />
          </Field>
        </div>
      </Card>

      <Card title="Render bản final">
        <Rows>
          <Row label="Chất lượng">
            <Segmented
              label="Chất lượng"
              value={quality}
              onChange={setQuality}
              options={[
                { value: "standard", label: "Tiêu chuẩn" },
                { value: "high", label: "Cao" },
              ]}
            />
          </Row>
          <Row label="Tên file">
            <span className="text-meta">outputs/sampling-3-sai-lam-v1.mp4</span>
          </Row>
        </Rows>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className={`text-meta ${muted}`}>Chỉ mở khi Bước 1–5 đã duyệt và QC không còn lỗi.</span>
          <Button variant="primary">Render final</Button>
        </div>
      </Card>
    </>
  );
}
