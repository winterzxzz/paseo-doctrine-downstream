import Link from "next/link";
import { Markdown } from "@/components/markdown";
import { Words } from "@/components/words";
import { getOverview, getSection } from "@/lib/guide";

const CARDS = [
  {
    href: "/workflow/",
    title: "Workflow",
    caption: "Một assignment đi từ Human qua Lead, Peer, Reviewer tới verdict.",
    glow: "#e0a458",
    pills: ["Human", "Lead", "Peer", "Reviewer", "Verdict"],
    big: true,
  },
  {
    href: "/vai-tro/",
    title: "Vai trò",
    caption: "Ai giữ quyền gì, và không được làm gì.",
    glow: "#c06c9a",
    pills: ["Supervisor", "Lead", "Peer"],
  },
  {
    href: "/co-che/",
    title: "Cơ chế",
    caption: "Lease, handback, một writer, evidence, Council.",
    glow: "#7fa8bd",
    pills: ["Assignment", "Handback", "Beads", "Council"],
  },
] as const;

const STATS = [
  ["1", "write Owner cho mỗi scope đang thay đổi"],
  ["4", "verdict của Lead: ACCEPT, REOPEN, REJECT, UNKNOWN"],
  ["0", "lần tự làm rồi tự duyệt một thay đổi lớn"],
] as const;

export default function Home() {
  const { intro } = getOverview();

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="relative mx-auto max-w-[1080px] px-6 pt-24 pb-16 md:pt-32">
          <div className="mx-auto max-w-4xl text-center">
            <span className="fade-up inline-flex h-[38px] items-center gap-[7px] rounded-full bg-black pr-4 pl-[11px] shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <span className="font-hand relative top-[0.08em] text-[26px] leading-none text-white">SLP Docs</span>
            </span>
            <h1 className="font-display mx-auto mt-4 max-w-3xl text-balance text-[44px] leading-[1.06] md:text-[72px]">
              <Words text="Nhiều agent, một chuỗi quyền rõ ràng" />
            </h1>
            <p className="fade-up mx-auto mt-6 max-w-2xl text-lg leading-[1.45] text-muted [animation-delay:400ms] md:text-[20px]">
              SLP chia việc điều phối coding agent cho ba vai: Supervisor quan sát quy trình, Lead giữ quyết định
              của project, Peer làm một việc có biên giới. Human giữ quyền cuối cùng.
            </p>
            <div className="fade-up mt-16 flex flex-col items-center gap-4 [animation-delay:550ms]">
              <div className="relative flex flex-wrap justify-center gap-3">
                <p className="hand-note absolute bottom-[calc(100%+14px)] left-3 whitespace-nowrap text-[24px]">Đọc trong 10 phút</p>
                <Link
                  href="/workflow/"
                  className="inline-flex items-center rounded-full bg-fg px-6 py-3 text-[15px] font-medium text-bg transition-colors hover:bg-fg-soft"
                >
                  Xem workflow
                </Link>
                <Link
                  href="/vai-tro/"
                  className="inline-flex items-center rounded-full bg-surface px-6 py-3 text-[15px] font-medium text-fg transition-colors hover:bg-surface-2"
                >
                  Các vai trò
                </Link>
              </div>
              <span className="flex flex-wrap items-center justify-center gap-x-[11px] text-[13px] font-medium text-subtle">
                <span>Supervisor · Lead · Peer</span>
                <i aria-hidden="true">·</i>
                <span>Một writer mỗi scope</span>
                <i aria-hidden="true">·</i>
                <span>Evidence thay cho trạng thái</span>
              </span>
            </div>
          </div>

          <div className="fade-up mt-20 grid gap-4 [animation-delay:700ms] md:grid-cols-[1.3fr_1fr]">
            {CARDS.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className={`group relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-navy to-ink p-7 text-white ${
                  "big" in card && card.big ? "min-h-80 md:row-span-2 md:min-h-[460px]" : "min-h-56"
                }`}
              >
                <div className="absolute -right-16 -bottom-20 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: card.glow }} />
                <span className="text-sm text-white/70">{card.title}</span>
                <p className="font-display relative mt-2 max-w-sm text-2xl leading-snug md:text-[28px]">{card.caption}</p>
                <div className="absolute right-7 bottom-7 left-7 flex flex-wrap items-center gap-2 transition-transform duration-500 group-hover:-translate-y-1">
                  {card.pills.map((pill, i) => (
                    <span key={pill} className="flex items-center gap-2">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs ring-1 ring-white/15 backdrop-blur">{pill}</span>
                      {i < card.pills.length - 1 ? <span className="text-white/40">→</span> : null}
                    </span>
                  ))}
                </div>
                <span className="absolute top-7 right-7 text-sm text-white/70 transition-transform group-hover:translate-x-1">→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-bg-raised py-24">
        <div className="mx-auto max-w-[1080px] px-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-[17px] font-semibold tracking-[-0.01em] text-accent">Bắt đầu</p>
              <h2 className="font-display mt-4 text-balance text-4xl md:text-[52px] md:leading-[1.15]">SLP là gì</h2>
            </div>
            <div className="self-end text-lg leading-relaxed text-muted">
              <Markdown source={intro} />
            </div>
          </div>
          <div className="mx-auto mt-12 max-w-3xl">
            <Markdown source={getSection("SLP là gì")} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 py-24">
        <div className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-3">
          {STATS.map(([value, caption]) => (
            <div key={caption} className="bg-bg p-8">
              <p className="font-display text-6xl">{value}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{caption}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-6 pb-24">
        <p className="text-[17px] font-semibold tracking-[-0.01em] text-accent">Đọc tiếp</p>
        <h2 className="font-display mt-4 text-4xl md:text-[48px]">Đi sâu vào từng phần</h2>
        <div className="mt-10">
          <Markdown source={getSection("Đọc tiếp")} />
        </div>
      </section>
    </>
  );
}
