"use client";

/**
 * Duyệt 4 · Đóng gói - ảnh bìa, caption, xuất bản cuối. Dùng lại các endpoint
 * thật: POST /thumbnail, gói xuất bản (ProjectPublishCard), job assemble-final.
 *
 * Luật kênh (skill activos-tiktok 3.9 + guideline mục 6): ảnh bìa lấy từ cảnh
 * sự kiện thật, tiêu đề nên là câu hỏi; caption = câu móc + bộ hashtag cố định
 * (server ép). Ảnh bìa chỉ làm đẹp lưới trang kênh - câu móc mới quyết định view.
 */

import { Image as ImageIcon, Rocket } from "lucide-react";
import { useEffect, useState } from "react";
import {
  createJob,
  createThumbnail,
  mediaUrl,
  type ContentGateState,
  type Job,
  type ProjectDetail,
} from "@/lib/api";
import { Badge, JobBadge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { LinkButton } from "@/components/LinkButton";
import { ProjectPublishCard } from "@/components/ProjectPublishCard";
import { TagInput } from "@/components/TagInput";

const muted = "text-[var(--text-muted)]";

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function PackageGate({
  project,
  content,
  draftRel,
  finalJob,
  busy,
  onJob,
  onChanged,
}: {
  project: ProjectDetail;
  content: ContentGateState | null;
  /** Bản nháp đã duyệt ở Duyệt 3 - tính từ repo root */
  draftRel: string | null;
  finalJob: Job | undefined;
  busy: boolean;
  onJob: (j: Job) => void;
  onChanged: () => void;
}) {
  const id = project.id;
  const channel = content?.channel ?? null;
  const split = content?.review?.split ?? null;

  // Nguồn lấy frame: bản nháp (đã có cảnh sự kiện chèn) + video sự kiện trong assets
  const prefix = `video-projects/${id}/`;
  const sources = [
    ...(draftRel ? [{ rel: draftRel, label: "Bản nháp" }] : []),
    ...(content?.files ?? [])
      .filter((f) => f.kind === "video")
      .map((f) => ({ rel: prefix + f.rel, label: f.name })),
  ];

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [sourceRel, setSourceRel] = useState("");
  const [frameAt, setFrameAt] = useState("1");
  const [thumbBusy, setThumbBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (content?.decision.title) setTitle((t) => t || content.decision.title);
  }, [content]);
  useEffect(() => {
    if (!sourceRel && sources.length > 0) setSourceRel(sources[0].rel);
  }, [sources, sourceRel]);

  const isQuestion = /\?\s*$/.test(title.trim());

  async function makeThumb() {
    setThumbBusy(true);
    setError(null);
    try {
      const at = Number(frameAt);
      await createThumbnail(id, {
        title: title.trim(),
        tags,
        ...(sourceRel ? { sourceRel } : {}),
        ...(Number.isFinite(at) && at >= 0 ? { frameAt: at } : {}),
      });
      onChanged();
    } catch (e) {
      setError(errText(e));
    } finally {
      setThumbBusy(false);
    }
  }

  async function renderFinal() {
    setError(null);
    try {
      onJob(await createJob({ projectId: id, type: "assemble-final" }));
    } catch (e) {
      setError(errText(e));
    }
  }

  const thumbUrl = project.thumbnail
    ? `${mediaUrl(`${prefix}${project.thumbnail}`)}?v=${encodeURIComponent(project.updatedAt)}`
    : null;
  const finalRunning = finalJob && (finalJob.status === "queued" || finalJob.status === "running");

  return (
    <div className="flex flex-col gap-4">
      {error && <Banner tone="danger" message={error} />}

      {content?.decision.splitParts && split && (
        <Banner
          tone="info"
          message={`Đã chọn tách 2 phần tại ${Math.floor(split.at / 60)}:${String(Math.round(split.at % 60)).padStart(2, "0")}. Mỗi phần cần ảnh bìa và caption riêng.`}
          detail="Tạo Phần 1 / Phần 2 bằng mục Clip ở trang project cũ, rồi đóng gói từng phần."
        />
      )}

      <Card
        title="Ảnh bìa"
        actions={
          <Button small onClick={makeThumb} disabled={!title.trim() || thumbBusy || sources.length === 0}>
            <ImageIcon size={13} /> {thumbBusy ? "Đang tạo… (~1 phút)" : project.thumbnail ? "Tạo lại" : "Tạo ảnh bìa"}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <p className={`text-meta ${muted}`}>
            Ảnh bìa chỉ làm đẹp lưới trang kênh, câu móc mới quyết định view - đừng mất nhiều thời gian ở đây.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Tiêu đề"
              htmlFor="thumb-title"
              hint={isQuestion ? "Câu hỏi - không có dấu chấm đỏ." : "Nên là câu hỏi, kết bằng dấu ?"}
            >
              <input
                id="thumb-title"
                className="input"
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Nhãn dán (tối đa 3)" hint="Từ khóa ngắn ≤ 14 ký tự">
              <TagInput tags={tags} onChange={(t) => setTags(t.slice(0, 3))} />
            </Field>
            <Field label="Lấy khung hình từ" htmlFor="thumb-src" hint="Cảnh sự kiện thật, mắt nhìn ống kính">
              <select id="thumb-src" className="input" value={sourceRel} onChange={(e) => setSourceRel(e.target.value)}>
                {sources.map((s) => (
                  <option key={s.rel} value={s.rel}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ở giây" htmlFor="thumb-at">
              <input
                id="thumb-at"
                className="input"
                type="number"
                min={0}
                step={0.1}
                value={frameAt}
                onChange={(e) => setFrameAt(e.target.value)}
              />
            </Field>
          </div>
          {thumbUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt="Ảnh bìa"
              className="h-64 w-auto self-start rounded-[var(--radius)] border border-[var(--border)] object-contain"
            />
          )}
        </div>
      </Card>

      {channel && (
        <Card title="Luật caption của kênh">
          <div className="flex flex-col gap-2">
            <p className="text-sm">Câu đầu nhắc lại đúng câu móc, rồi bộ hashtag cố định:</p>
            <div className="flex flex-wrap gap-2">
              {channel.hashtags.map((h) => (
                <Badge key={h} tone="muted" label={h} />
              ))}
              <span className={`text-meta ${muted}`}>+ tối đa {channel.maxExtra} tag theo nội dung</span>
            </div>
            <p className={`text-meta ${muted}`}>Server tự ép bộ hashtag này khi soạn gói xuất bản bên dưới.</p>
          </div>
        </Card>
      )}

      <ProjectPublishCard projectId={id} version={project.updatedAt} />

      <Card
        title={
          <span className="flex items-center gap-2">
            Xuất bản cuối
            {finalJob && <JobBadge status={finalJob.status} />}
          </span>
        }
        actions={
          <Button onClick={renderFinal} disabled={busy || !draftRel || !!finalRunning}>
            <Rocket size={13} /> Render final
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            {draftRel
              ? "Render chất lượng cao từ đúng timeline của bản nháp đã duyệt. Project được giữ lại để sửa sau."
              : "Chưa có bản nháp - quay lại Duyệt 3."}
          </p>
          {project.output && (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-meta ${muted}`}>{project.output}</span>
              <LinkButton href={mediaUrl(project.output)}>Mở video</LinkButton>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
