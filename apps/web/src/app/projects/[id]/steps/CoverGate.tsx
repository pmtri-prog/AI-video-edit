"use client";

/**
 * Ảnh bìa + caption (Duyệt 1) và kết quả xuất bản (Duyệt 4).
 *
 * Bìa và caption đi cùng câu móc: cùng một quyết định nội dung, nên duyệt ở
 * Duyệt 1 chứ không đợi tới cuối. Luật kênh (skill activos-tiktok 3.9 +
 * guideline mục 6): ảnh bìa lấy từ cảnh sự kiện thật, tiêu đề nên là câu hỏi;
 * caption = câu móc + bộ hashtag cố định (server ép). Ảnh bìa chỉ làm đẹp lưới
 * trang kênh - câu móc mới quyết định view.
 */

import { Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
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
import { ProgressBar } from "@/components/ProgressBar";
import { ProjectPublishCard } from "@/components/ProjectPublishCard";
import { TagInput } from "@/components/TagInput";

const muted = "text-[var(--text-muted)]";

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const thumbUrlOf = (project: ProjectDetail) =>
  project.thumbnail
    ? `${mediaUrl(`video-projects/${project.id}/${project.thumbnail}`)}?v=${encodeURIComponent(project.updatedAt)}`
    : null;

export function CoverCaption({
  project,
  content,
  onChanged,
}: {
  project: ProjectDetail;
  content: ContentGateState | null;
  onChanged: () => void;
}) {
  const id = project.id;
  const channel = content?.channel ?? null;
  const split = content?.review?.split ?? null;

  // Nguồn: ảnh và video sự kiện trong assets (ảnh trước - bìa nên là cảnh sự kiện thật)
  const prefix = `video-projects/${id}/`;
  const files = content?.files ?? [];
  const sources = [
    ...files.filter((f) => f.kind === "image").map((f) => ({ rel: prefix + f.rel, label: `Ảnh · ${f.name}`, image: true })),
    ...files.filter((f) => f.kind === "video").map((f) => ({ rel: prefix + f.rel, label: `Video · ${f.name}`, image: false })),
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
  const pickedImage = sources.find((s) => s.rel === sourceRel)?.image ?? false;

  async function makeThumb() {
    setThumbBusy(true);
    setError(null);
    try {
      const at = Number(frameAt);
      await createThumbnail(id, {
        title: title.trim(),
        tags,
        ...(sourceRel ? { sourceRel } : {}),
        ...(!pickedImage && Number.isFinite(at) && at >= 0 ? { frameAt: at } : {}),
      });
      onChanged();
    } catch (e) {
      setError(errText(e));
    } finally {
      setThumbBusy(false);
    }
  }

  const thumbUrl = thumbUrlOf(project);

  return (
    <div className="flex flex-col gap-4">
      {error && <Banner tone="danger" message={error} />}

      {content?.decision.splitParts && split && (
        <Banner
          tone="info"
          message={`Đã chọn tách 2 phần tại ${Math.floor(split.at / 60)}:${String(Math.round(split.at % 60)).padStart(2, "0")}. Mỗi phần cần ảnh bìa và caption riêng.`}
          detail="Tạo Phần 1 / Phần 2 bằng mục Clip ở trang project cũ, rồi làm bìa cho từng phần."
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
          {sources.length === 0 && (
            <p className="text-sm">Chưa có ảnh hay video sự kiện trong project - tải lên ở Duyệt 2 hoặc trang project.</p>
          )}
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
            <Field label="Ảnh nền" htmlFor="thumb-src" hint="Cảnh sự kiện thật, mắt nhìn ống kính">
              <select id="thumb-src" className="input" value={sourceRel} onChange={(e) => setSourceRel(e.target.value)}>
                {sources.map((s) => (
                  <option key={s.rel} value={s.rel}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            {!pickedImage && (
              <Field label="Lấy khung ở giây" htmlFor="thumb-at">
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
            )}
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
    </div>
  );
}

/** Duyệt 4 sau khi bấm "Duyệt & xuất bản": tiến độ render final, rồi video + bìa để đăng. */
export function PublishResult({ project, finalJob }: { project: ProjectDetail; finalJob: Job | undefined }) {
  const running = finalJob && (finalJob.status === "queued" || finalJob.status === "running");
  const thumbUrl = thumbUrlOf(project);
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Bản xuất bản
          {finalJob && <JobBadge status={finalJob.status} />}
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        {running && finalJob && <ProgressBar progress={finalJob.progress} step={finalJob.step} />}
        {finalJob?.status === "failed" && (
          <Banner tone="danger" message="Render final lỗi - mở Render Queue xem log, sửa rồi bấm Xuất bản lại." />
        )}
        {!running && project.output ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-meta ${muted}`}>{project.output}</span>
              <LinkButton href={mediaUrl(project.output)}>Mở video</LinkButton>
            </div>
            <div className="flex flex-wrap items-start gap-4">
              <video
                src={`${mediaUrl(project.output)}?v=${encodeURIComponent(project.updatedAt)}`}
                controls
                playsInline
                preload="metadata"
                className="h-80 w-auto rounded-[var(--radius)] bg-black"
              />
              {thumbUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbUrl}
                  alt="Ảnh bìa"
                  className="h-80 w-auto rounded-[var(--radius)] border border-[var(--border)] object-contain"
                />
              )}
            </div>
            <p className={`text-meta ${muted}`}>
              Caption và hashtag ở thẻ bên dưới. Máy không tự đăng lên kênh.
            </p>
          </>
        ) : (
          !running && <p className="text-sm">Chưa có bản final. Bấm Duyệt & xuất bản để render.</p>
        )}
      </div>
    </Card>
  );
}
