import Link from "next/link";
import { PAGES, REPO_URL } from "@/lib/overview";
import { Logo } from "./logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-bg/75 backdrop-blur-xl backdrop-saturate-[180%]">
      <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between px-5">
        <Link className="flex items-center gap-[9px]" href="/" aria-label="Paseo Docs — trang chủ">
          <Logo />
          <span className="text-[17px] font-medium tracking-[-0.025em]">Paseo Docs</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {PAGES.map((page) => (
            <Link
              key={page.slug}
              href={`/${page.slug}/`}
              className="inline-flex h-8 items-center rounded-lg px-2.5 text-[13.5px] tracking-[-0.01em] text-muted transition-colors hover:bg-fg/5 hover:text-fg"
            >
              {page.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-8 items-center rounded-full px-3.5 text-[13px] font-semibold text-muted transition-colors hover:bg-fg/5 hover:text-fg sm:inline-flex"
          >
            GitHub
          </a>
          <Link
            href="/workflow/"
            className="inline-flex h-8 items-center rounded-full bg-fg px-3.5 text-[13px] font-semibold text-bg transition-colors hover:bg-fg-soft"
          >
            Xem workflow
          </Link>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        {PAGES.map((page) => (
          <Link
            key={page.slug}
            href={`/${page.slug}/`}
            className="inline-flex h-8 shrink-0 items-center rounded-full bg-surface px-3 text-[13px] text-muted"
          >
            {page.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
