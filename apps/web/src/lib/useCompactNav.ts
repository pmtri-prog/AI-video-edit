"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * "Chế độ gọn" của menu trái: ẩn các tab ít dùng để người chỉ làm một kiểu video
 * (raw -> cắt ngắn) không phải quét qua cả chục mục.
 *
 * Đây là gu giao diện của MỘT máy, không phải dữ liệu dự án, nên ở localStorage
 * chứ không lên server. Mặc định TẮT: người cài mới vẫn thấy đủ tính năng.
 * Chỉ ẩn khỏi menu, KHÔNG chặn route - gõ URL vẫn mở được trang bị ẩn.
 *
 * Shell và trang Cấu hình cùng dùng hook này; bật/tắt ở Cấu hình phải đổi menu
 * ngay mà không reload, nên ngoài sự kiện `storage` (chỉ bắn sang TAB KHÁC) còn
 * phát thêm một custom event cho chính tab hiện tại.
 */
const STORAGE_KEY = "aiev-compact-nav";
const CHANGE_EVENT = "aiev-compact-nav-change";

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false; // chế độ riêng tư / chặn storage -> coi như tắt
  }
}

export function useCompactNav(): [boolean, (next: boolean) => void] {
  // Server render không có localStorage: luôn bắt đầu bằng false rồi đọc sau
  // khi mount, tránh lệch hydrate.
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const sync = () => setCompact(readStored());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const update = useCallback((next: boolean) => {
    try {
      if (next) localStorage.setItem(STORAGE_KEY, "1");
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* không ghi được thì vẫn đổi trong phiên này */
    }
    setCompact(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [compact, update];
}
