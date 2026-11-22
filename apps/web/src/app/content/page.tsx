"use client";

import { Megaphone, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { TableSkeleton } from "@/components/Skeleton";
import {
  CONTENT_CHANNELS,
  createContent,
  getContentList,
  type ContentItem,
  type ContentVariantStatus,
} from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { useT } from "@/lib/i18n";

const STATUS_TONE: Record<ContentVariantStatus, "muted" | "running" | "success"> = {
  draft: "muted",
  approved: "running",
  posted: "success",
};

export default function ContentListPage() {
  const { t, tf } = useT();
  const router = useRouter();
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getContentList()
      .then((r) => setItems(r.items))
      .catch((e: Error) => setError(e.message));
  }, []);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const { item } = await createContent({ title, story });
      router.push(`/content/${encodeURIComponent(item.id)}`);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("nav.content")}
        hint={{ titleKey: "content.hint-title", bodyKey: "content.hint-body" }}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            {t("content.new")}
          </Button>
        }
      />
      {error && <ErrorBanner message={error} />}
      <Card title={tf("content.count", { n: items?.length ?? 0 })}>
        {items === null ? (
          <TableSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={t("content.empty-title")}
            description={t("content.empty-desc")}
            action={<Button onClick={() => setOpen(true)}>{t("content.new")}</Button>}
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("content.title-label")}</th>
                {CONTENT_CHANNELS.map((ch) => (
                  <th key={ch}>{t(`content.ch.${ch}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <Link href={`/content/${encodeURIComponent(it.id)}`} className="text-sm font-medium hover:underline">
                      {it.title}
                    </Link>
                    <div className="text-meta text-[var(--text-muted)]">
                      {tf("content.updated", { time: formatRelative(it.updatedAt) })}
                    </div>
                  </td>
                  {CONTENT_CHANNELS.map((ch) => {
                    const v = it.variants[ch];
                    return (
                      <td key={ch}>
                        {v ? (
                          <Badge tone={STATUS_TONE[v.status]} label={t(`content.status.${v.status}`)} />
                        ) : (
                          <span className="text-meta text-[var(--text-muted)]">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        title={t("content.new")}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <Button onClick={create} disabled={creating || !title.trim()}>
            {t("content.create")}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label={t("content.title-label")} htmlFor="content-title" required>
            <input
              id="content-title"
              className="input"
              value={title}
              placeholder={t("content.title-placeholder")}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label={t("content.story-label")} htmlFor="content-story" hint={t("content.story-hint")}>
            <textarea
              id="content-story"
              className="input"
              rows={8}
              value={story}
              placeholder={t("content.story-placeholder")}
              onChange={(e) => setStory(e.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
