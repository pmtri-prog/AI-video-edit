import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { StaleChunkGuard } from "@/components/StaleChunkGuard";
import { LanguageProvider } from "@/lib/i18n";
import { EventsProvider } from "@/lib/useEvents";

/** SVG nút play, nướng thẳng vào bundle dạng data URI */
const FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="rgb(26,26,26)"/><path d="M12 9l12 7-12 7z" fill="white"/></svg>',
  );

export const metadata: Metadata = {
  title: "AI Edit Video",
  description: "Edit video tự động bằng AI",
  // Favicon trung tính (nút play) - bản fork này không mang nhận diện noti.vn.
  icons: { icon: FAVICON },
};

/** Chống FOUC: áp data-theme trước khi paint. Mặc định light. */
const THEME_SCRIPT = `try{if(localStorage.getItem("theme")==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <StaleChunkGuard />
        <LanguageProvider>
          <EventsProvider>
            <Shell>{children}</Shell>
          </EventsProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
