import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "SLP Multi-Agent Blueprint — Giải thích chi tiết",
  description:
    "Đọc kỹ kiến trúc Supervisor · Lead · Peer: triết lý, từng cơ chế, ví dụ thực chiến, và một phiên tranh luận ba lane mù thẩm định lại chính tài liệu.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">
        <a
          href="#noi-dung"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-lead focus:px-4 focus:py-2 focus:text-ink"
        >
          Bỏ qua điều hướng
        </a>
        <SiteNav />
        <main id="noi-dung" className="mx-auto w-full max-w-4xl px-5 pb-24 pt-10 sm:px-8">
          {children}
        </main>
        <footer className="border-t border-line bg-ink-soft">
          <div className="mx-auto w-full max-w-4xl px-5 py-8 text-sm text-muted sm:px-8">
            <p>
              Trang này diễn giải tài liệu <em>SLP Multi-Agent Blueprint</em> (15 slide, watermark
              &ldquo;Gemini Notebook&rdquo;). Mọi con số trong tài liệu gốc là claim của tác giả,
              chưa có evidence tái lập.
            </p>
            <p className="mt-3">
              <Link className="text-lead underline underline-offset-4" href="/nguon/">
                Xem transcript nguồn đầy đủ
              </Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
