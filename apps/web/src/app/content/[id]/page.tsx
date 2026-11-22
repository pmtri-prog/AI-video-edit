"use client";

import { ExternalLink, Images, Link2, Sparkles, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { CopyButton } from "@/components/CopyButton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Field } from "@/components/Field";
import { PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/Segmented";
import { Skeleton } from "@/components/Skeleton";
import { Workspace, WorkspaceBlock, WorkspaceColumn } from "@/components/Workspace";
import {
  applyContentToProject,
  deleteContent,
  deriveContent,
  getContent,
  getProjects,
  patchContent,
  pickContentMedia,
  type ContentChannel,
  type ContentItem,
  type ContentVariantStatus,
  type ProjectSummary,
} from "@/lib/api";
import { useT } from "@/lib/i18n";

const STATUSES: ContentVariantStatus[] = ["draft", "approved", "posted"];
const STATUS_TONE: Record<ContentVariantStatus, "muted" | "running" | "success"> = {
  draft: "muted",
  approved: "running",
  posted: "success",
};

/**
 * Một bản kênh: nội dung sửa tay được (lưu khi bấm Lưu), viết bằng AI, trạng
 * thái và link bài. Bản đã đăng thì khóa nút viết lại - server cũng chặn (409).
 */
function ChannelBlock({
  item,
  channel,
  onChange,
  onError,
}: {
  item: ContentItem;
  channel: ContentChannel;
  onChange: (next: ContentItem) => void;
  onError: (msg: string | null) => void;
}) {
  const { t } = useT();
  const v = item.variants[channel];
  const [text, setText] = useState(v?.text ?? "");
  const [scene, setScene] = useState(v?.sceneSheet ?? "");
  const [caption, setCaption] = useState(v?.caption ?? "");
  const [postUrl, setPostUrl] = useState(v?.postUrl ?? "");
  const [busy, setBusy] = useState<"derive" | "save" | null>(null);

  // Bản mới từ server (AI viết xong / đổi trạng thái) -> nạp lại ô nhập
  useEffect(() => {
    setText(v?.text ?? "");
    setScene(v?.sceneSheet ?? "");
    setCaption(v?.caption ?? "");
    setPostUrl(v?.postUrl ?? "");
  }, [v?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    !!v &&
    (text !== v.text ||
      postUrl !== (v.postUrl ?? "") ||
      (channel === "tiktok" && (scene !== (v.sceneSheet ?? "") || caption !== (v.caption ?? ""))));

  async function run<T>(kind: "derive" | "save", fn: () => Promise<{ item: ContentItem } & T>) {
    setBusy(kind);
    onError(null);
    try {
      onChange((await fn()).item);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const save = (extra?: { status?: ContentVariantStatus }) =>
    run("save", () =>
      patchContent(item.id, {
        variants: {
          [channel]: {
            text,
            postUrl: postUrl.trim() || null,
            ...(channel === "tiktok" ? { sceneSheet: scene, caption } : {}),
            ...extra,
          },
        },
      }),
    );

  const posted = v?.status === "posted";
  return (
    <WorkspaceBlock
      id={`content-${channel}`}
      title={t(`content.ch.${channel}`)}
      summary={v ? <Badge tone={STATUS_TONE[v.status]} label={t(`content.status.${v.status}`)} /> : null}
      actions={
        <Button
          small
          variant={v ? "secondary" : "primary"}
          disabled={!!busy || posted}
          onClick={() => run("derive", () => deriveContent(item.id, channel))}
        >
          <Sparkles size={14} aria-hidden="true" />
          {busy === "derive" ? t("content.deriving") : v ? t("content.rederive") : t("content.derive")}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-meta text-[var(--text-muted)]">{t(`content.ch-hint.${channel}`)}</p>
        {!v ? (
          <p className="text-sm text-[var(--text-muted)]">{t("content.empty-variant")}</p>
        ) : (
          <>
            <Field label={channel === "tiktok" ? t("content.script") : t("content.text")} htmlFor={`txt-${channel}`}>
              <div className="flex items-start gap-2">
                <textarea
                  id={`txt-${channel}`}
                  className="input"
                  rows={channel === "tiktok" ? 7 : 12}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <CopyButton value={text} label={t("content.text")} size="sm" />
              </div>
            </Field>
            {channel === "tiktok" && (
              <>
                <Field label={t("content.scene")} htmlFor="scene-tiktok">
                  <textarea
                    id="scene-tiktok"
                    className="input font-mono"
                    rows={8}
                    value={scene}
                    onChange={(e) => setScene(e.target.value)}
                  />
                </Field>
                <Field label={t("content.caption")} htmlFor="caption-tiktok">
                  <div className="flex items-start gap-2">
                    <textarea
                      id="caption-tiktok"
                      className="input"
                      rows={3}
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                    />
                    <CopyButton value={caption} label={t("content.caption")} size="sm" />
                  </div>
                </Field>
              </>
            )}
            <Field label={t("content.post-url")} htmlFor={`url-${channel}`}>
              <input
                id={`url-${channel}`}
                className="input"
                value={postUrl}
                placeholder="https://"
                onChange={(e) => setPostUrl(e.target.value)}
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Segmented
                label={t("content.status-label")}
                value={v.status}
                disabled={!!busy}
                onChange={(s) => save({ status: s })}
                options={STATUSES.map((s) => ({ value: s, label: t(`content.status.${s}`) }))}
              />
              <Button small disabled={!dirty || !!busy} onClick={() => save()}>
                {busy === "save" ? t("content.saving") : t("content.save")}
              </Button>
            </div>
          </>
        )}
      </div>
    </WorkspaceBlock>
  );
}

export default function ContentDetailPage() {
  const { t, tf } = useT();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<ContentItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState("");
  const [busy, setBusy] = useState<"story" | "media" | "apply" | "delete" | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** Lần chọn ảnh gần nhất không ra sự kiện nào - để nói rõ thay vì hiện lại câu mời chọn */
  const [pickedNone, setPickedNone] = useState(false);

  useEffect(() => {
    getContent(id)
      .then((r) => {
        setItem(r.item);
        setStory(r.item.story);
        setProjectId(r.item.variants.tiktok?.projectId ?? "");
      })
      .catch((e: Error) => setError(e.message));
    getProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [id]);

  async function act(kind: "story" | "media" | "apply", fn: () => Promise<{ item: ContentItem }>) {
    setBusy(kind);
    setError(null);
    try {
      const next = (await fn()).item;
      setItem(next);
      if (kind === "apply") setApplied(projectId);
      if (kind === "media") setPickedNone(next.mediaIds.length === 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      await deleteContent(id);
      router.push("/content");
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
      setConfirmDelete(false);
    }
  }

  if (!item) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t("nav.content")} />
        {error ? <ErrorBanner message={error} /> : <Skeleton className="h-64" />}
      </div>
    );
  }

  const media = item.media ?? [];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={item.title}
        actions={
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} aria-hidden="true" />
            {t("content.delete")}
          </Button>
        }
      />
      {error && <ErrorBanner message={error} />}

      <Workspace>
        <WorkspaceColumn role="source" title={t("content.col-source")}>
          <WorkspaceBlock id="content-story" title={t("content.story-label")}>
            <div className="flex flex-col gap-3">
              <Field label={t("content.story-label")} htmlFor="story" hint={t("content.story-hint")}>
                <textarea
                  id="story"
                  className="input"
                  rows={10}
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                />
              </Field>
              <div className="flex justify-end">
                <Button
                  small
                  disabled={story === item.story || !!busy}
                  onClick={() => act("story", () => patchContent(item.id, { story }))}
                >
                  {busy === "story" ? t("content.saving") : t("content.save")}
                </Button>
              </div>
            </div>
          </WorkspaceBlock>

          <WorkspaceBlock
            id="content-media"
            title={t("content.media")}
            icon={Images}
            actions={
              <Button
                small
                variant={media.length ? "secondary" : "primary"}
                disabled={!!busy}
                onClick={() => act("media", () => pickContentMedia(item.id))}
              >
                {busy === "media"
                  ? t("content.media-picking")
                  : media.length
                    ? t("content.media-repick")
                    : t("content.media-pick")}
              </Button>
            }
          >
            {media.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                {pickedNone ? t("content.media-none") : t("content.media-empty")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-meta text-[var(--text-muted)]">
                  {tf("content.media-event", { event: item.mediaEvent ?? "" })}
                </p>
                <ul className="flex flex-col gap-1">
                  {media.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{m.title}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {!m.localPath && <Badge tone="muted" dot={false} label={t("content.media-not-downloaded")} />}
                        {m.viewUrl && (
                          <a
                            href={m.viewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-meta text-[var(--text-muted)] hover:underline"
                          >
                            <ExternalLink size={12} aria-hidden="true" />
                            {t("content.media-open")}
                          </a>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </WorkspaceBlock>
        </WorkspaceColumn>

        <WorkspaceColumn role="setup" title={t("content.col-social")}>
          <ChannelBlock item={item} channel="linkedin" onChange={setItem} onError={setError} />
          <ChannelBlock item={item} channel="facebook" onChange={setItem} onError={setError} />
        </WorkspaceColumn>

        <WorkspaceColumn role="output" title={t("content.col-video")}>
          <ChannelBlock item={item} channel="tiktok" onChange={setItem} onError={setError} />
          <WorkspaceBlock id="content-apply" title={t("content.apply")} icon={Link2}>
            <div className="flex flex-col gap-3">
              <p className="text-meta text-[var(--text-muted)]">{t("content.apply-hint")}</p>
              <Field label={t("content.apply-select")} htmlFor="apply-project">
                <select
                  id="apply-project"
                  className="input"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">-</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex justify-end">
                <Button
                  small
                  disabled={!projectId || !item.variants.tiktok?.text || !!busy}
                  onClick={() => act("apply", () => applyContentToProject(item.id, projectId))}
                >
                  {t("content.apply-btn")}
                </Button>
              </div>
              {applied && (
                <Banner
                  tone="success"
                  message={tf("content.applied", {
                    project: projects.find((p) => p.id === applied)?.name ?? applied,
                  })}
                />
              )}
            </div>
          </WorkspaceBlock>
        </WorkspaceColumn>
      </Workspace>

      <ConfirmDeleteModal
        open={confirmDelete}
        description={tf("content.delete-desc", { title: item.title })}
        busy={busy === "delete"}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </div>
  );
}
