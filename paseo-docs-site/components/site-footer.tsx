import Link from "next/link";
import { PAGES, REPO_URL } from "@/lib/guide";
import { Logo } from "./logo";

const DOC_LINKS = [
  ["Role Contracts", "foundation/dist/docs/ROLE_CONTRACTS.md"],
  ["Demonthorn Deep Dive", "foundation/dist/references/demonthorn-agent-orchestration-deep-dive.md"],
  ["Assignment và Handback", "foundation/dist/docs/ASSIGNMENT_AND_HANDBACK.md"],
  ["SLP usage", "docs/slp-usage.md"],
  ["Coordination và handoff", "docs/slp-coordination-handoff.md"],
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-bg-sunken text-muted">
      <div className="mx-auto grid max-w-[1080px] gap-12 px-6 py-16 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo className="h-6 w-6" />
            <span className="font-display text-xl text-fg">SLP Docs</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-subtle">
            Nội dung lấy từ <code className="text-fg">docs/slp-guide.md</code>. Sửa file đó, build lại, site cập nhật theo.
          </p>
        </div>
        <div>
          <h2 className="text-xs font-medium text-subtle">Trang</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link className="hover:text-fg" href="/">
                Tổng quan
              </Link>
            </li>
            {PAGES.map((page) => (
              <li key={page.slug}>
                <Link className="hover:text-fg" href={`/${page.slug}/`}>
                  {page.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-xs font-medium text-subtle">Doc chi tiết</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {DOC_LINKS.map(([label, file]) => (
              <li key={file}>
                <a className="hover:text-fg" href={`${REPO_URL}/blob/main/${file}`} target="_blank" rel="noopener noreferrer">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1080px] flex-wrap justify-between gap-4 border-t border-line px-6 py-6 text-xs text-subtle">
        <span>Supervisor · Lead · Peer</span>
        <a className="hover:text-fg" href={REPO_URL} target="_blank" rel="noopener noreferrer">
          winterzxzz/paseo-doctrine-downstream
        </a>
      </div>
    </footer>
  );
}
