import { readFileSync } from "node:fs";
import { join } from "node:path";
import GithubSlugger from "github-slugger";

/**
 * docs/overview.md is the single source of the content. The site only adds layout, so a fact
 * edited in the markdown shows up here on the next build and never drifts into a second copy.
 */
const OVERVIEW_PATH = join(process.cwd(), "..", "docs", "overview.md");

export const REPO_URL = "https://github.com/winterzxzz/paseo-doctrine-downstream";
const DOCS_BLOB_BASE = `${REPO_URL}/blob/main/docs/`;

export interface Page {
  slug: string;
  /** Short label for the nav. */
  label: string;
  /** Exact `## ` headings from overview.md, in order, that this page renders. */
  headings: string[];
  eyebrow: string;
  title: string;
  lede: string;
}

export const PAGES: Page[] = [
  {
    slug: "thanh-phan",
    label: "Thành phần",
    headings: ["Bản đồ thành phần", "Tác dụng của từng thành phần"],
    eyebrow: "Thành phần",
    title: "Mỗi phần làm một việc",
    lede: "Daemon ở giữa, client ở ngoài, provider chạy như process con. Xem ai làm gì và đọc tiếp ở đâu.",
  },
  {
    slug: "use-case",
    label: "Use case",
    headings: ["Use case"],
    eyebrow: "Use case",
    title: "Ai dùng Paseo cho việc gì",
    lede: "Human, Lead, Peer, Supervisor và các tích hợp bên ngoài, mỗi bên một nhóm việc.",
  },
  {
    slug: "workflow",
    label: "Workflow",
    headings: ["Workflow chính"],
    eyebrow: "Workflow",
    title: "Bảy luồng bạn cần nắm",
    lede: "Từ lúc daemon khởi động, chạy một agent, kết nối điện thoại, tới điều phối nhiều agent và vòng phát triển trong repo.",
  },
];

interface Section {
  heading: string;
  body: string;
}

function readSections(): { title: string; intro: string; sections: Section[] } {
  const source = readFileSync(OVERVIEW_PATH, "utf8");
  const lines = source.split("\n");
  const titleLine = lines.findIndex((line) => line.startsWith("# "));
  if (titleLine < 0) throw new Error(`${OVERVIEW_PATH} has no "# " title`);

  const sections: Section[] = [];
  const introLines: string[] = [];
  let current: Section | null = null;
  let inFence = false;
  for (const line of lines.slice(titleLine + 1)) {
    if (line.startsWith("```")) inFence = !inFence;
    if (!inFence && line.startsWith("## ")) {
      current = { heading: line.slice(3).trim(), body: "" };
      sections.push(current);
      continue;
    }
    if (current) current.body += `${line}\n`;
    else introLines.push(line);
  }
  return { title: lines[titleLine].slice(2).trim(), intro: introLines.join("\n").trim(), sections };
}

export function getOverview() {
  return readSections();
}

export function getSection(heading: string): string {
  const section = readSections().sections.find((s) => s.heading === heading);
  if (!section) throw new Error(`docs/overview.md has no "## ${heading}" section`);
  return section.body.trim();
}

/** Markdown for a page: each owned `##` section with its heading kept. */
export function getPageMarkdown(page: Page): string {
  return page.headings.map((h) => `## ${h}\n\n${getSection(h)}`).join("\n\n");
}

export interface TocEntry {
  id: string;
  text: string;
  depth: 2 | 3;
}

/** Same slugger rehype-slug uses, so TOC anchors match rendered heading ids. */
export function getToc(markdown: string): TocEntry[] {
  const slugger = new GithubSlugger();
  const entries: TocEntry[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (line.startsWith("```")) inFence = !inFence;
    if (inFence) continue;
    const match = /^(##|###) (.+)$/.exec(line);
    if (!match) continue;
    const text = match[2].replace(/`/g, "").trim();
    entries.push({ id: slugger.slug(text), text, depth: match[1].length as 2 | 3 });
  }
  return entries;
}

/** overview.md links are relative to docs/; on the site they point at the files on GitHub. */
export function resolveDocHref(href: string): string {
  if (/^[a-z]+:/i.test(href) || href.startsWith("#")) return href;
  return new URL(href, DOCS_BLOB_BASE).toString();
}
