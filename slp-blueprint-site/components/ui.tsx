import Link from "next/link";
import type { ReactNode } from "react";

type Role = "supervisor" | "lead" | "peer";

const ROLE_STYLE: Record<Role, { border: string; text: string; bg: string }> = {
  supervisor: { border: "border-sv/50", text: "text-sv", bg: "bg-sv-soft/40" },
  lead: { border: "border-lead/50", text: "text-lead", bg: "bg-lead-soft/40" },
  peer: { border: "border-peer/50", text: "text-peer", bg: "bg-peer-soft/50" },
};

export function PageTitle({ kicker, title, lead }: { kicker?: string; title: string; lead?: string }) {
  return (
    <header className="mb-10 border-b border-line pb-8">
      {kicker ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{kicker}</p>
      ) : null}
      <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">{title}</h1>
      {lead ? <p className="mt-4 max-w-2xl text-lg leading-relaxed text-body">{lead}</p> : null}
    </header>
  );
}

export function Section({
  id,
  title,
  slide,
  children,
}: {
  id?: string;
  title: string;
  slide?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-28">
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h2 className="text-xl font-semibold text-white sm:text-2xl">{title}</h2>
        {slide ? <SlideRef slide={slide} /> : null}
      </div>
      <div className="space-y-4 leading-relaxed">{children}</div>
    </section>
  );
}

export function SlideRef({ slide }: { slide: string }) {
  return (
    <span className="rounded border border-line bg-panel px-2 py-0.5 font-mono text-xs text-muted">
      {slide}
    </span>
  );
}

export function RoleBadge({ role, children }: { role: Role; children: ReactNode }) {
  const s = ROLE_STYLE[role];
  return (
    <span className={`rounded border ${s.border} ${s.bg} px-2 py-0.5 text-xs font-semibold ${s.text}`}>
      {children}
    </span>
  );
}

export function RoleCard({
  role,
  letter,
  name,
  subtitle,
  points,
}: {
  role: Role;
  letter: string;
  name: string;
  subtitle: string;
  points: string[];
}) {
  const s = ROLE_STYLE[role];
  return (
    <article className={`rounded-lg border ${s.border} ${s.bg} p-5`}>
      <div className="flex items-baseline gap-3">
        <span className={`font-mono text-2xl font-bold ${s.text}`}>{letter}</span>
        <div>
          <h3 className={`text-lg font-semibold ${s.text}`}>{name}</h3>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {points.map((point) => (
          <li key={point} className="flex gap-2">
            <span aria-hidden className={s.text}>
              ▸
            </span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function Callout({
  tone = "note",
  title,
  children,
}: {
  tone?: "note" | "warn" | "claim" | "ok";
  title: string;
  children: ReactNode;
}) {
  const tones = {
    note: "border-line bg-panel",
    warn: "border-warn/50 bg-warn/10",
    claim: "border-sv/40 bg-sv-soft/30",
    ok: "border-ok/40 bg-ok/10",
  } as const;
  const titleTone = {
    note: "text-body",
    warn: "text-warn",
    claim: "text-sv",
    ok: "text-ok",
  } as const;

  return (
    <aside className={`rounded-lg border ${tones[tone]} p-4`}>
      <p className={`mb-2 text-sm font-semibold ${titleTone[tone]}`}>{title}</p>
      <div className="space-y-2 text-sm leading-relaxed text-body">{children}</div>
    </aside>
  );
}

export function ClaimBadge({ children }: { children?: ReactNode }) {
  return (
    <span className="ml-2 whitespace-nowrap rounded border border-warn/50 bg-warn/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warn">
      {children ?? "Claim chưa kiểm chứng"}
    </span>
  );
}

export function Quote({ children, cite }: { children: ReactNode; cite?: string }) {
  return (
    <blockquote className="border-l-2 border-lead/60 pl-4 text-body italic">
      {children}
      {cite ? <footer className="mt-1 text-xs not-italic text-muted">— {cite}</footer> : null}
    </blockquote>
  );
}

export type TableRow = { key: string; cells: ReactNode[] };

export function Table({ head, rows }: { head: string[]; rows: TableRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="bg-panel text-left">
            {head.map((cell) => (
              <th key={cell} className="border-b border-line px-3 py-2 font-semibold text-white">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.key} className={rowIndex % 2 ? "bg-ink-soft/40" : undefined}>
              {row.cells.map((cell, cellIndex) => (
                <td
                  key={`${row.key}-${head[cellIndex] ?? cellIndex}`}
                  className="border-b border-line px-3 py-2 align-top"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Marks a table cell as the site's own reading, not something the source slide says. */
export function OurNote({ children }: { children: ReactNode }) {
  return (
    <span>
      <span className="mr-1.5 rounded border border-line bg-ink/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
        nhận xét
      </span>
      {children}
    </span>
  );
}

export function CardLink({ href, title, children }: { href: string; title: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-line bg-panel p-4 transition-colors hover:border-lead/60"
    >
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </Link>
  );
}
