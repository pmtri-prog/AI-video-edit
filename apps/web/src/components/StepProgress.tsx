import { GATE_NAMES, currentGate, type StepGates } from "@/lib/stepGates";

/**
 * Tiến độ luồng 4 lần duyệt gọn trong một ô bảng: 4 vạch (xanh = đã duyệt,
 * đỏ = cổng đang chờ, cam = cần xem lại, xám = chưa tới) + tên cổng đang chờ.
 */
export function StepProgress({ gates }: { gates: StepGates }) {
  const cur = currentGate(gates);
  const label =
    cur === null ? `Đã duyệt đủ ${GATE_NAMES.length} bước` : `Bước ${cur + 1}/${GATE_NAMES.length} · ${GATE_NAMES[cur]}`;
  return (
    <div className="flex flex-col gap-1" title={label}>
      <div className="flex w-28 gap-1" aria-hidden="true">
        {GATE_NAMES.map((name, i) => {
          const tone = gates.stale.includes(i)
            ? "bg-[var(--danger)]"
            : gates.approved.includes(i)
              ? "bg-[var(--success)]"
              : i === cur
                ? "bg-[var(--primary)]"
                : "bg-[var(--border)]";
          return <span key={name} className={`h-1.5 flex-1 rounded-full ${tone}`} />;
        })}
      </div>
      <span className="text-meta text-[var(--text-muted)]">{label}</span>
    </div>
  );
}
