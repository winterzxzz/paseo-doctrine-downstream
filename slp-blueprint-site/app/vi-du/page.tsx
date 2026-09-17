import { EXAMPLES, MAPPING } from "@/content/examples";
import { Callout, PageTitle, Section, SlideRef, Table } from "@/components/ui";

export const metadata = { title: "Ví dụ thực chiến — SLP Blueprint" };

export default function Page() {
  return (
    <>
      <PageTitle
        kicker="12 ví dụ không có trong tài liệu gốc"
        title="Ví dụ thực chiến"
        lead="Mỗi ví dụ: tình huống cụ thể, prompt sai, prompt đúng, vì sao khác nhau, và dấu hiệu nhận biết mình đang làm sai."
      />

      <nav aria-label="Mục lục ví dụ" className="rounded-lg border border-line bg-panel p-4">
        <ol className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {EXAMPLES.map((ex) => (
            <li key={ex.id}>
              <a className="text-muted hover:text-lead" href={`#${ex.id}`}>
                {ex.n}. {ex.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {EXAMPLES.map((ex) => (
        <article key={ex.id} id={ex.id} className="mt-12 scroll-mt-28 border-t border-line pt-8">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm text-muted">Ví dụ {ex.n}</span>
            <SlideRef slide={ex.slide} />
            <span className="rounded border border-peer/40 bg-peer-soft/50 px-2 py-0.5 text-xs text-peer">
              {ex.topic}
            </span>
          </div>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">{ex.title}</h2>

          <p className="mt-4 leading-relaxed">
            <span className="font-semibold text-body">Tình huống. </span>
            {ex.situation}
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-warn/40 bg-warn/5 p-4">
              <p className="mb-2 text-sm font-semibold text-warn">✕ {ex.wrongLabel}</p>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-ink/70 p-3 font-mono text-xs leading-relaxed text-body">
                {ex.wrong}
              </pre>
            </div>
            <div className="rounded-lg border border-ok/40 bg-ok/5 p-4">
              <p className="mb-2 text-sm font-semibold text-ok">✓ {ex.rightLabel}</p>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-ink/70 p-3 font-mono text-xs leading-relaxed text-body">
                {ex.right}
              </pre>
            </div>
          </div>

          <p className="mt-5 leading-relaxed">
            <span className="font-semibold text-body">Vì sao khác nhau. </span>
            {ex.why}
          </p>

          <p className="mt-4 rounded-lg border border-line bg-panel p-4 text-sm">
            <span className="font-semibold text-sv">Dấu hiệu bạn đang làm sai. </span>
            {ex.tell}
          </p>
        </article>
      ))}

      <Section title="Ánh xạ sang công cụ thật">
        <p>
          Bảng này nối khái niệm của tài liệu với cơ chế tương ứng khi vận hành nhiều agent thật.
          Giữ ở mức cơ chế, không gắn với API của một sản phẩm cụ thể.
        </p>
        <Table
          head={["Khái niệm SLP", "Nguồn", "Cơ chế tương ứng khi vận hành thật"]}
          rows={MAPPING.map((m) => ({ key: m.concept, cells: [m.concept, m.slide, m.mechanism] }))}
        />
        <Callout tone="warn" title="Dòng cuối bảng là dòng quan trọng nhất">
          <p>
            <strong>Acceptance không có trong 15 slide.</strong> Cả tài liệu nói về giao thức giữa
            các agent — framing, pushback, hội tụ, attention — mà không định nghĩa &ldquo;xong&rdquo;
            là gì, ai chạy build/test, và điều gì xảy ra khi test đỏ. Chạy 7 tiếng không người mà
            không có gate máy kiểm được thì đó không phải tự vận hành, đó là trôi không phanh.
          </p>
        </Callout>
      </Section>
    </>
  );
}
