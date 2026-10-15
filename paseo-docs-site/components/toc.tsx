import type { TocEntry } from "@/lib/guide";

export function Toc({ entries }: { entries: TocEntry[] }) {
  return (
    <nav aria-label="Trong trang này" className="sticky top-24 hidden max-h-[calc(100vh-8rem)] overflow-y-auto lg:block">
      <p className="text-xs font-medium text-subtle">Trong trang này</p>
      <ul className="mt-4 space-y-2.5 border-l border-line text-[13.5px]">
        {entries.map((entry) => (
          <li key={entry.id} className={entry.depth === 3 ? "pl-6" : "pl-4"}>
            <a href={`#${entry.id}`} className="-ml-px block border-l border-transparent text-muted transition-colors hover:border-fg hover:text-fg">
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
