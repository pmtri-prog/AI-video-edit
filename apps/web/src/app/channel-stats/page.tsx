"use client";

import { ChartLine, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getChannelStats,
  type ChannelMeasurement,
  type ChannelMilestone,
  type ChannelPlatform,
  type ChannelStats,
  type ChannelVideo,
} from "@/lib/api";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { RetentionChart, type RetentionSeries } from "@/components/RetentionChart";
import { Segmented } from "@/components/Segmented";
import { Skeleton } from "@/components/Skeleton";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";

/** Mục tiêu kênh - cùng con số với skill activos-tiktok. */
const GOAL_AVG_WATCH_SEC = 8;
const GOAL_RETENTION_S2 = 0.65;
const POSTED_MILESTONES = [10, 30, 50] as const;
const PILLARS = [
  { id: 1, key: "cs.pillars.p1", target: 0.35 },
  { id: 2, key: "cs.pillars.p2", target: 0.45 },
  { id: 3, key: "cs.pillars.p3", target: 0.2 },
] as const;
const MILESTONES: ChannelMilestone[] = ["24h", "7d", "30d"];

// Dưới 10% thì giữ một số lẻ: "xem hết" 0,5% và 3,5% mà làm tròn thành 1% / 4% là mất ý nghĩa
const pct = (v: number | null) =>
  v === null ? "–" : `${v < 0.1 ? Math.round(v * 1000) / 10 : Math.round(v * 100)}%`;
const nf = (v: number | null) => (v === null ? "–" : v.toLocaleString());
// Saves + shares per 1,000 views: "worth keeping or forwarding", comparable across view counts.
const keepRate = (m?: { views: number | null; saves: number | null; shares: number | null }) => {
  if (!m || !m.views || (m.saves === null && m.shares === null)) return null;
  return (((m.saves ?? 0) + (m.shares ?? 0)) / m.views) * 1000;
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

type Lookup = (videoId: string, platform: ChannelPlatform) => ChannelMeasurement | undefined;

function GoalBadge({ ok }: { ok: boolean | null }) {
  const { t } = useT();
  if (ok === null) return <Badge tone="muted" label={t("cs.goal-none")} dot={false} />;
  return ok ? (
    <Badge tone="success" label={t("cs.goal-met")} />
  ) : (
    <Badge tone="danger" label={t("cs.goal-miss")} />
  );
}

/** Ô KPI có thêm badge mục tiêu / thanh mốc - StatTile không có chỗ cho hai thứ đó. */
function KpiCard({
  label,
  value,
  sub,
  footer,
}: {
  label: string;
  value: string;
  sub: string;
  footer: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col gap-1">
      <p className="text-[28px] leading-tight font-bold tabular-nums">{value}</p>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-meta text-[var(--text-muted)]">{sub}</p>
      <div className="mt-2">{footer}</div>
    </div>
  );
}

/** Thanh tiến độ có vạch mốc 10 / 30 / 50 video. */
function MilestoneBar({ count }: { count: number }) {
  const max = POSTED_MILESTONES[POSTED_MILESTONES.length - 1];
  return (
    <div>
      <div className="relative h-1.5 rounded-full bg-[var(--bg-subtle)]">
        <div
          className="h-full rounded-full bg-[var(--primary)]"
          style={{ width: `${Math.min(100, (count / max) * 100)}%` }}
        />
        {POSTED_MILESTONES.slice(0, -1).map((m) => (
          <span
            key={m}
            className="absolute top-[-2px] h-2.5 w-0.5 bg-[var(--text-muted)]"
            style={{ left: `${(m / max) * 100}%` }}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="relative mt-1 h-4 text-meta text-[var(--text-muted)]">
        {POSTED_MILESTONES.map((m) => (
          <span
            key={m}
            className="absolute"
            style={{
              left: `${(m / max) * 100}%`,
              transform: m === max ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

function PillarRow({
  label,
  target,
  actual,
  count,
}: {
  label: string;
  target: number;
  actual: number;
  count: number;
}) {
  const { t, tf } = useT();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 text-sm font-medium">{label}</p>
        <p className="shrink-0 text-meta text-[var(--text-muted)]">
          {tf("cs.pillars.target", { pct: Math.round(target * 100) })}
        </p>
      </div>
      <div className="relative mt-2 h-1.5 rounded-full bg-[var(--bg-subtle)]">
        <div
          className="h-full rounded-full bg-[var(--primary)]"
          style={{ width: `${Math.round(actual * 100)}%` }}
        />
        <span
          className="absolute top-[-3px] h-3 w-0.5 bg-[var(--text)]"
          style={{ left: `${Math.round(target * 100)}%` }}
          aria-hidden="true"
        />
      </div>
      <p className="mt-1 text-meta text-[var(--text-muted)]">
        {tf("cs.pillars.actual", { pct: Math.round(actual * 100), n: count })}
      </p>
      {count === 0 && <p className="text-meta text-[var(--danger)]">{t("cs.pillars.empty-hint")}</p>}
    </div>
  );
}

function RetentionCell({ value, goal }: { value: number | null; goal?: number }) {
  if (value === null) return <span className="text-[var(--text-muted)]">–</span>;
  if (goal === undefined) return <span>{pct(value)}</span>;
  return <Badge tone={value >= goal ? "success" : "danger"} label={pct(value)} dot={false} />;
}

function VideoTable({
  videos,
  get,
}: {
  videos: ChannelVideo[];
  get: Lookup;
}) {
  const { t } = useT();
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>{t("cs.table.video")}</th>
            <th>{t("cs.table.pillar")}</th>
            <th>{t("cs.table.opens")}</th>
            <th>{t("cs.table.duration")}</th>
            <th>TikTok</th>
            <th>FB</th>
            <th>YT</th>
            <th>{t("cs.table.avg")}</th>
            <th>{t("cs.table.s2")}</th>
            <th>{t("cs.table.s5")}</th>
            <th>{t("cs.table.s10")}</th>
            <th>{t("cs.table.full")}</th>
            <th>{t("cs.table.keep")}</th>
            <th>{t("cs.table.follow")}</th>
          </tr>
        </thead>
        <tbody>
          {videos.map((v) => {
            const tt = get(v.id, "tiktok");
            const follows = (["tiktok", "fb", "yt"] as const)
              .map((p) => get(v.id, p)?.newFollowers ?? null)
              .filter((n): n is number => n !== null);
            return (
              <tr key={v.id}>
                <td className="min-w-64">
                  <p className="text-sm font-medium">{v.title}</p>
                  <p className="text-meta text-[var(--text-muted)]">{v.id}</p>
                </td>
                <td>{v.pillar ? <Badge tone="muted" dot={false} label={`P${v.pillar}`} /> : "–"}</td>
                <td className="whitespace-nowrap">
                  {v.opensWith ? (t(`cs.opens.${v.opensWith}`) === `cs.opens.${v.opensWith}` ? v.opensWith : t(`cs.opens.${v.opensWith}`)) : "–"}
                </td>
                <td className="whitespace-nowrap tabular-nums">
                  {v.durationSec === null ? "–" : `${v.durationSec}s`}
                </td>
                <td className="tabular-nums">{nf(get(v.id, "tiktok")?.views ?? null)}</td>
                <td className="tabular-nums">{nf(get(v.id, "fb")?.views ?? null)}</td>
                <td className="tabular-nums">{nf(get(v.id, "yt")?.views ?? null)}</td>
                <td className="whitespace-nowrap tabular-nums">
                  {tt?.avgWatchSec == null ? "–" : `${tt.avgWatchSec.toFixed(1)}s`}
                </td>
                <td>
                  <RetentionCell value={tt?.retention.s2 ?? null} goal={GOAL_RETENTION_S2} />
                </td>
                <td>
                  <RetentionCell value={tt?.retention.s5 ?? null} />
                </td>
                <td>
                  <RetentionCell value={tt?.retention.s10 ?? null} />
                </td>
                <td className="tabular-nums">{pct(tt?.fullWatch ?? null)}</td>
                <td
                  className="tabular-nums"
                  title={tt ? `${t("cs.table.saves")} ${tt.saves ?? "–"} · ${t("cs.table.shares")} ${tt.shares ?? "–"}` : undefined}
                >
                  {(() => {
                    const k = keepRate(tt);
                    return k === null ? "–" : k.toLocaleString(undefined, { maximumFractionDigits: 1 });
                  })()}
                </td>
                <td className="tabular-nums">
                  {follows.length ? follows.reduce((a, b) => a + b, 0) : "–"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const LESSON_TONE: Record<string, BadgeTone> = {
  testing: "running",
  confirmed: "success",
  dropped: "muted",
};

export default function ChannelStatsPage() {
  const { t, tf } = useT();
  const [data, setData] = useState<ChannelStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<ChannelMilestone>("24h");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getChannelStats()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const posted = data.videos.filter((v) => v.status === "posted");
    const at = data.measurements.filter((m) => m.milestone === milestone);
    const index = new Map(at.map((m) => [`${m.videoId}|${m.platform}`, m]));
    const get: Lookup = (id, p) => index.get(`${id}|${p}`);
    const tiktok = posted.map((v) => get(v.id, "tiktok")).filter((m): m is ChannelMeasurement => !!m);
    const views = tiktok.length ? tiktok.reduce((a, m) => a + (m.views ?? 0), 0) : null;
    const avgWatch = avg(tiktok.map((m) => m.avgWatchSec).filter((n): n is number => n !== null));
    const s2 = avg(tiktok.map((m) => m.retention.s2).filter((n): n is number => n !== null));
    const series: RetentionSeries[] = posted.flatMap((v) => {
      const r = get(v.id, "tiktok")?.retention;
      return r && (r.s2 !== null || r.s5 !== null || r.s10 !== null)
        ? [{ id: v.id, label: v.title, ...r }]
        : [];
    });
    const withPillar = posted.filter((v) => v.pillar !== null);
    const latest = data.measurements.reduce<string | null>(
      (best, m) => (best === null || Date.parse(m.measuredAt) > Date.parse(best) ? m.measuredAt : best),
      null,
    );
    return { posted, get, views, avgWatch, s2, series, withPillar, latest };
  }, [data, milestone]);

  const isEmpty = data !== null && data.videos.length === 0 && data.measurements.length === 0;

  const header = (
    <PageHeader
      title={t("cs.title")}
      subtitle={t("cs.subtitle")}
      actions={
        <>
          <Segmented
            label={t("cs.milestone-aria")}
            value={milestone}
            onChange={setMilestone}
            options={MILESTONES.map((m) => ({ value: m, label: t(`cs.milestone.${m}`) }))}
          />
          {view?.latest && (
            <span className="text-meta text-[var(--text-muted)]">
              {tf("cs.updated", { time: formatDateTime(view.latest) })}
            </span>
          )}
          <Button variant="primary" onClick={() => setHelpOpen(true)}>
            <RefreshCw size={15} strokeWidth={2} aria-hidden="true" />
            {t("cs.refresh")}
          </Button>
        </>
      }
    />
  );

  const helpModal = (
    <Modal
      title={t("cs.refresh-title")}
      open={helpOpen}
      onClose={() => setHelpOpen(false)}
      footer={
        <Button variant="secondary" onClick={() => setHelpOpen(false)}>
          {t("common.close")}
        </Button>
      }
    >
      <p className="text-sm">{t("cs.refresh-body")}</p>
    </Modal>
  );

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorBanner message={t("cs.title")} detail={error} />
        {helpModal}
      </div>
    );
  }

  if (!data || !view) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={132} />
          ))}
        </div>
        <Skeleton height={300} />
        {helpModal}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Card>
          <EmptyState icon={ChartLine} title={t("cs.empty-title")} description={t("cs.empty-body")} />
        </Card>
        {helpModal}
      </div>
    );
  }

  const { posted, get, views, avgWatch, s2, series, withPillar } = view;

  return (
    <div className="flex flex-col gap-4">
      {header}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("cs.kpi.posted")}
          value={String(posted.length)}
          sub={t("cs.kpi.posted-sub")}
          footer={<MilestoneBar count={posted.length} />}
        />
        <KpiCard
          label={t("cs.kpi.views")}
          value={nf(views)}
          sub={t("cs.kpi.views-sub")}
          footer={null}
        />
        <KpiCard
          label={t("cs.kpi.avg")}
          value={avgWatch === null ? "–" : `${avgWatch.toFixed(1)}s`}
          sub={t("cs.kpi.avg-sub")}
          footer={<GoalBadge ok={avgWatch === null ? null : avgWatch >= GOAL_AVG_WATCH_SEC} />}
        />
        <KpiCard
          label={t("cs.kpi.s2")}
          value={pct(s2)}
          sub={t("cs.kpi.s2-sub")}
          footer={<GoalBadge ok={s2 === null ? null : s2 >= GOAL_RETENTION_S2} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title={t("cs.chart.title")} className="h-full">
            {series.length ? (
              <RetentionChart series={series} goal={GOAL_RETENTION_S2} />
            ) : (
              <EmptyState icon={ChartLine} description={t("cs.chart.empty")} />
            )}
          </Card>
        </div>
        <Card title={t("cs.pillars.title")}>
          <div className="flex flex-col gap-4">
            {PILLARS.map((p) => {
              const n = withPillar.filter((v) => v.pillar === p.id).length;
              return (
                <PillarRow
                  key={p.id}
                  label={t(p.key)}
                  target={p.target}
                  actual={withPillar.length ? n / withPillar.length : 0}
                  count={n}
                />
              );
            })}
          </div>
        </Card>
      </div>

      <Card title={t("cs.table.title")}>
        {posted.length ? (
          <VideoTable videos={posted} get={get} />
        ) : (
          <EmptyState icon={ChartLine} description={t("cs.table.empty")} />
        )}
      </Card>

      <Card title={t("cs.lessons.title")}>
        {data.lessons.length ? (
          <ul className="flex flex-col gap-3">
            {data.lessons.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-sm">{l.text}</p>
                <Badge
                  tone={LESSON_TONE[l.status] ?? "muted"}
                  label={t(`cs.lesson.${l.status}`)}
                  dot={false}
                  className="shrink-0"
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">{t("cs.lessons.empty")}</p>
        )}
      </Card>

      {helpModal}
    </div>
  );
}
