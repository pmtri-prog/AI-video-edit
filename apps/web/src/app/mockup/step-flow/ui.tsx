"use client";

/**
 * MOCKUP - khối dựng nhỏ dùng chung cho các bước của luồng "duyệt từng bước".
 * Dữ liệu giả, chưa nối backend. Khi chốt giao diện thì những khối nào dùng
 * thật sẽ được nâng thành primitive trong components/.
 */

import { Check, Clock, Loader2, Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { BadgeTone } from "@/components/Badge";
import { Card } from "@/components/Card";
import { IconButton } from "@/components/IconButton";

/** Khung mô phỏng khung hình video (luôn tối, không theo theme). */
export function Frame({
  ratio = "9 / 16",
  children,
  className = "",
  selected = false,
  onClick,
}: {
  ratio?: string;
  children?: ReactNode;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const ring = selected
    ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)]"
    : "";
  const cls = `relative flex w-full items-center justify-center overflow-hidden rounded-[var(--radius)] bg-neutral-900 text-white ${ring} ${className}`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} style={{ aspectRatio: ratio }}>
        {children}
      </button>
    );
  }
  return (
    <div className={cls} style={{ aspectRatio: ratio }}>
      {children}
    </div>
  );
}

/** Một hàng thiết lập: nhãn (+ gợi ý) bên trái, điều khiển bên phải. */
export function Row({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      {/* Nhãn giữ tối thiểu 14rem; điều khiển rộng quá thì cả khối xuống dòng
          thay vì ép nhãn thành cột chữ hẹp */}
      <div className="min-w-56 flex-1">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-meta text-[var(--text-muted)]">{hint}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Danh sách hàng có kẻ ngang giữa các hàng. */
export function Rows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-[var(--border)]">{children}</div>;
}

/** Nút -/+ quanh một giá trị - chỉnh điểm cắt, độ lệch tiếng, thời lượng. */
export function Nudge({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center gap-1" aria-label={label}>
      <IconButton label={`${label}: giảm`} size="sm">
        <Minus size={14} />
      </IconButton>
      <span className="min-w-16 text-center text-sm tabular-nums">{value}</span>
      <IconButton label={`${label}: tăng`} size="sm">
        <Plus size={14} />
      </IconButton>
    </div>
  );
}

/** Ô màu lấy từ Style Design - màu là DỮ LIỆU của style nên đi qua style attr. */
export function Swatch({
  color,
  selected,
  onClick,
}: {
  color: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={color}
      aria-pressed={selected}
      className={`h-6 w-6 rounded-full border border-[var(--border)] ${
        selected ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)]" : ""
      }`}
      style={{ background: color }}
    />
  );
}

/** Chip có nút xóa - từ khóa, hashtag, từ điển. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-1 text-xs">
      {children}
      <span aria-hidden="true" className="text-[var(--text-muted)]">
        ×
      </span>
    </span>
  );
}

// ================================ Thanh bước ================================

export type StepStatus = "approved" | "review" | "running" | "stale" | "todo";

export const STEP_STATUS: Record<StepStatus, { tone: BadgeTone; label: string }> = {
  approved: { tone: "success", label: "Đã duyệt" },
  review: { tone: "running", label: "Chờ bạn duyệt" },
  running: { tone: "running", label: "AI đang làm" },
  stale: { tone: "danger", label: "Cần xem lại" },
  todo: { tone: "muted", label: "Chưa làm" },
};

/** Thanh bước bấm được - mỗi bước một trạng thái riêng (khác StepperBar chỉ có một mốc). */
export function Stepper({
  names,
  statuses,
  current,
  onSelect,
  firstNumber = 0,
}: {
  names: readonly string[];
  statuses: readonly StepStatus[];
  current: number;
  onSelect: (i: number) => void;
  /** Số hiện ở bước đầu - mockup đếm từ 0, luồng 4 lần duyệt đếm từ 1 */
  firstNumber?: number;
}) {
  return (
    <Card>
      <ol className="flex w-full items-start">
        {names.flatMap((name, i) => {
          const status = statuses[i];
          const active = i === current;
          const items = [];
          if (i > 0) {
            items.push(
              <li
                key={`c${i}`}
                aria-hidden="true"
                className={`mx-1 mt-4 h-px min-w-2 flex-1 ${
                  statuses[i - 1] === "approved" ? "bg-[var(--success)]" : "bg-[var(--border)]"
                }`}
              />,
            );
          }
          items.push(
            <li key={name} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={active ? "step" : undefined}
                className={`flex flex-col items-center gap-1 rounded-[var(--radius)] p-2 transition-colors hover:bg-[var(--bg-subtle)] ${
                  active ? "bg-[var(--bg-subtle)]" : ""
                }`}
              >
                <StepDot n={i + firstNumber} status={status} active={active} />
                <span
                  className={`whitespace-nowrap text-meta ${
                    active ? "font-semibold text-[var(--text)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  {i + firstNumber}. {name}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{STEP_STATUS[status].label}</span>
              </button>
            </li>,
          );
          return items;
        })}
      </ol>
    </Card>
  );
}

function StepDot({ n, status, active }: { n: number; status: StepStatus; active: boolean }) {
  const ring = active ? "ring-[3px] ring-[var(--primary-soft)]" : "";
  if (status === "approved") {
    return (
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full bg-[var(--success-bg)] text-[var(--success)] ${ring}`}
      >
        <Check size={14} strokeWidth={3} />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className={`flex h-6 w-6 items-center justify-center rounded-full ${ring}`}>
        <Loader2 size={16} className="animate-spin text-[var(--primary)]" />
      </span>
    );
  }
  const cls =
    status === "review"
      ? "bg-[var(--primary)] text-[var(--bg)]"
      : status === "stale"
        ? "bg-[var(--danger-bg)] text-[var(--danger)]"
        : "border border-[var(--border)] text-[var(--text-muted)]";
  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${cls} ${ring}`}
    >
      {status === "stale" ? <Clock size={13} /> : n}
    </span>
  );
}
