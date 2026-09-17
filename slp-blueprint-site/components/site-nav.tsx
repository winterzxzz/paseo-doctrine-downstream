"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Tổng quan" },
  { href: "/triet-ly/", label: "Triết lý" },
  { href: "/supervisor/", label: "Supervisor" },
  { href: "/lead/", label: "Lead" },
  { href: "/peer/", label: "Peer" },
  { href: "/co-che/", label: "Cơ chế" },
  { href: "/cam-bay/", label: "Cạm bẫy" },
  { href: "/vi-du/", label: "Ví dụ" },
  { href: "/ma-tran/", label: "Ma trận" },
  { href: "/he-mo/", label: "Hệ mở" },
  { href: "/tranh-luan/", label: "Tranh luận" },
  { href: "/nguon/", label: "Nguồn" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur">
      <nav
        aria-label="Điều hướng chính"
        className="mx-auto w-full max-w-4xl px-5 py-3 sm:px-8"
      >
        <Link href="/" className="block text-sm font-semibold tracking-wide text-body">
          <span className="text-sv">S</span>
          <span className="text-muted">·</span>
          <span className="text-lead">L</span>
          <span className="text-muted">·</span>
          <span className="text-peer">P</span>
          <span className="ml-2 font-normal text-muted">Multi-Agent Blueprint</span>
        </Link>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "text-lead underline underline-offset-4"
                      : "text-muted transition-colors hover:text-body"
                  }
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
