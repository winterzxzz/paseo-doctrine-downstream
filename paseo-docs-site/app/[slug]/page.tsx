import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { Toc } from "@/components/toc";
import { Words } from "@/components/words";
import { PAGES, getPageMarkdown, getToc } from "@/lib/overview";

export const dynamicParams = false;

export function generateStaticParams() {
  return PAGES.map((page) => ({ slug: page.slug }));
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES.find((p) => p.slug === slug);
  return { title: page ? `${page.label} — Paseo Docs` : "Paseo Docs" };
}

export default async function DocPage({ params }: { params: Params }) {
  const { slug } = await params;
  const index = PAGES.findIndex((p) => p.slug === slug);
  if (index < 0) notFound();
  const page = PAGES[index];
  const markdown = getPageMarkdown(page);
  const prev = PAGES[index - 1];
  const next = PAGES[index + 1];

  return (
    <>
      <section className="border-b border-line bg-bg-raised">
        <div className="mx-auto max-w-[1080px] px-6 pt-20 pb-14">
          <p className="fade-up text-[17px] font-semibold tracking-[-0.01em] text-accent">{page.eyebrow}</p>
          <h1 className="font-display mt-4 max-w-3xl text-balance text-4xl leading-[1.1] md:text-[56px]">
            <Words text={page.title} />
          </h1>
          <p className="fade-up mt-6 max-w-2xl text-lg leading-relaxed text-muted [animation-delay:300ms]">{page.lede}</p>
        </div>
      </section>
      <div className="mx-auto grid max-w-[1080px] gap-12 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_210px]">
        <article className="min-w-0">
          <Markdown source={markdown} />
          <div className="mt-20 grid gap-4 sm:grid-cols-2">
            <PagerLink href={prev ? `/${prev.slug}/` : "/"} label="Trước" title={prev ? prev.label : "Tổng quan"} />
            {next ? <PagerLink href={`/${next.slug}/`} label="Tiếp" title={next.label} alignEnd /> : null}
          </div>
        </article>
        <aside>
          <Toc entries={getToc(markdown)} />
        </aside>
      </div>
    </>
  );
}

function PagerLink({ href, label, title, alignEnd }: { href: string; label: string; title: string; alignEnd?: boolean }) {
  return (
    <Link
      href={href}
      className={`group rounded-3xl border border-line p-6 transition-colors hover:bg-bg-raised ${alignEnd ? "sm:col-start-2 sm:text-right" : ""}`}
    >
      <span className="text-xs font-medium text-subtle">{label}</span>
      <span className="font-display mt-1 block text-xl">
        {alignEnd ? null : <span className="mr-1 inline-block transition-transform group-hover:-translate-x-1">←</span>}
        {title}
        {alignEnd ? <span className="ml-1 inline-block transition-transform group-hover:translate-x-1">→</span> : null}
      </span>
    </Link>
  );
}
