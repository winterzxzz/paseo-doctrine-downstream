import Link from "next/link";
import { Markdown } from "@/components/markdown";
import { Words } from "@/components/words";
import { getOverview, getSection } from "@/lib/overview";

const CARDS = [
  {
    href: "/workflow/",
    title: "Workflow",
    caption: "Bảy luồng chính, từ daemon khởi động tới điều phối Lead và Peer.",
    glow: "#2BBEFD",
    pills: ["Client", "Daemon", "AgentManager", "Provider", "Timeline"],
    big: true,
  },
  {
    href: "/thanh-phan/",
    title: "Thành phần",
    caption: "Mỗi package, mỗi thư mục, mỗi vai trò làm việc gì.",
    glow: "#0A8CFA",
    pills: ["server", "app", "cli", "relay", "protocol"],
  },
  {
    href: "/use-case/",
    title: "Use case",
    caption: "Human, Lead, Peer, Supervisor và Hub dùng Paseo cho việc gì.",
    glow: "#7c5cff",
    pills: ["Human", "Lead", "Peer", "Supervisor"],
  },
] as const;

const STATS = [
  ["6", "provider được hỗ trợ trong bản downstream"],
  ["4", "bề mặt client: desktop, điện thoại, web, CLI"],
  ["0", "telemetry của Paseo; relay mã hóa đầu cuối"],
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
              <span className="font-hand relative top-[0.08em] text-[26px] leading-none text-white">Paseo Docs</span>
            </span>
            <h1 className="font-display mx-auto mt-4 max-w-3xl text-balance text-[44px] leading-[1.06] md:text-[72px]">
              <Words text="Coding agent của bạn, trong túi bạn" />
            </h1>
            <p className="fade-up mx-auto mt-6 max-w-2xl text-lg leading-[1.45] text-muted [animation-delay:400ms] md:text-[20px]">
              Chạy, theo dõi và điều khiển Claude Code, Codex, Cursor và các agent khác ngay trên máy bạn, từ desktop,
              điện thoại, trình duyệt hay dòng lệnh. Code ở lại trên máy bạn.
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
                  href="/thanh-phan/"
                  className="inline-flex items-center rounded-full bg-surface px-6 py-3 text-[15px] font-medium text-fg transition-colors hover:bg-surface-2"
                >
                  Các thành phần
                </Link>
              </div>
              <span className="flex flex-wrap items-center justify-center gap-x-[11px] text-[13px] font-medium text-subtle">
                <span>Local-first</span>
                <i aria-hidden="true">·</i>
                <span>Relay mã hóa E2E</span>
                <i aria-hidden="true">·</i>
                <span>Supervisor · Lead · Peer</span>
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
        <div className="mx-auto grid max-w-[1080px] gap-10 px-6 md:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-[17px] font-semibold tracking-[-0.01em] text-accent">Bắt đầu</p>
            <h2 className="font-display mt-4 text-balance text-4xl md:text-[48px] md:leading-[1.15]">Paseo là gì</h2>
            <div className="mt-6 text-muted">
              <Markdown source={intro} />
            </div>
          </div>
          <div className="self-end">
            <Markdown source={getSection("Paseo là gì")} />
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
