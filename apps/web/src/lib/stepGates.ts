/**
 * Luồng 4 lần duyệt - tên cổng và cách đọc tiến độ, dùng chung cho trang các
 * bước và danh sách project. Chỉ số cổng đếm từ 0, khớp meta.stepGates ở server.
 */

export const GATE_NAMES = ["Nội dung & bìa", "Cảnh sự kiện", "Âm thanh", "Bản nháp"] as const;

export interface StepGates {
  approved: number[];
  stale: number[];
}

/** Cổng đang chờ: cổng đầu tiên chưa duyệt hoặc cần xem lại. null = đã duyệt hết. */
export function currentGate(g: StepGates): number | null {
  for (let i = 0; i < GATE_NAMES.length; i++) {
    if (!g.approved.includes(i) || g.stale.includes(i)) return i;
  }
  return null;
}
