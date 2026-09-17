import Link from "next/link";
import type { ReactNode } from "react";
import { Callout, PageTitle, Quote, Section } from "@/components/ui";

export const metadata = { title: "Cạm bẫy — SLP Blueprint" };

const DOMINO: { n: number; title: string; body: ReactNode; tone: "neutral" | "bad" }[] = [
  {
    n: 1,
    title: "Viết Test Trước",
    body: "TDD với Contract / Database chưa ổn định.",
    tone: "neutral",
  },
  {
    n: 2,
    title: "Minting API",
    body: (
      <>
        AI gặp ngõ cụt → tự &ldquo;bịa&rdquo; (Mint) ra các thuộc tính giả định. Ví dụ: thêm trường{" "}
        <code className="rounded bg-ink/60 px-1 py-0.5">point</code> vào bảng User.
      </>
    ),
    tone: "bad",
  },
  {
    n: 3,
    title: "Over-specifying",
    body: "AI bẻ cong code implement thực tế để thỏa mãn bài test giả định.",
    tone: "bad",
  },
  {
    n: 4,
    title: "Tech Debt Khổng Lồ",
    body: "Red test tự mint API. Sửa một dòng hỏng toàn bộ test suite.",
    tone: "bad",
  },
];

export default function Page() {
  return (
    <>
      <PageTitle
        kicker="Slide 11"
        title="The Danger Zone — cạm bẫy Minting API"
        lead="Slide mạnh nhất của tài liệu: một chuỗi domino tái lập được từng mắt, bắt đầu từ một việc nghe rất đúng đắn — viết test trước."
      />

      <Section title="Chuỗi domino">
        <div className="space-y-3">
          {DOMINO.map((d) => (
            <article
              key={d.n}
              className={
                d.tone === "bad"
                  ? "rounded-lg border border-warn/50 bg-warn/10 p-4"
                  : "rounded-lg border border-line bg-panel p-4"
              }
            >
              <h3 className={d.tone === "bad" ? "font-semibold text-warn" : "font-semibold text-body"}>
                {d.n}. {d.title}
              </h3>
              <p className="mt-2 text-sm">{d.body}</p>
            </article>
          ))}
        </div>
        <Quote cite="slide 11">
          QUY TẮC CỐT TỬ: Luôn yêu cầu AI định nghĩa rõ DB/API Contract TRƯỚC KHI cho phép sinh Unit
          Test.
        </Quote>
      </Section>

      <Section title="Vì sao slide này gánh cả tài liệu">
        <Callout tone="ok" title="Contract là dầm chịu lực của hai slide khác">
          <p>
            Không có contract thì prompt trung tính của slide 5 <em>không có gì để neo vào</em>, và
            lượt tự rà soát của slide 4 <em>không có oracle</em>. Cả hai rơi về đoán mò. Contract là
            thứ biến hai cơ chế kia từ mẹo prompt thành kiểm tra thật.
          </p>
        </Callout>
        <Callout tone="warn" title="Nhưng quy tắc như đã viết còn một lỗ hổng vòng lặp">
          <p>
            Quy tắc nói <strong>&ldquo;AI định nghĩa contract&rdquo;</strong>. Cùng một cơ chế bịa
            đặt vẫn áp dụng, chỉ lùi lên một tầng: model mint cái <em>contract</em> thay vì mint cái{" "}
            <em>test</em> — và bây giờ cả test lẫn implementation đều khớp nhau quanh một schema bịa.
            Trông còn thuyết phục hơn trước.
          </p>
          <p className="font-semibold">
            Đóng vòng bằng cách: contract phải <span className="text-ok">dẫn xuất từ schema/migration đang tồn tại</span>{" "}
            hoặc <span className="text-ok">được người duyệt</span>, và type phải được{" "}
            <span className="text-ok">sinh ra từ schema</span>, không viết tay.
          </p>
        </Callout>
      </Section>

      <Section title="Từ quy tắc prompt thành cơ chế tất định">
        <p>
          Quy tắc slide 11 hiện đang là một câu dặn trong prompt. Câu dặn sẽ trôi: prompt đổi, model
          đổi, người mới vào không biết. Cách làm nó không trôi được là biến thứ tự thành{" "}
          <strong>cấu trúc</strong>:
        </p>
        <ul className="space-y-2">
          <li>
            Một bước <code className="rounded bg-panel px-1 py-0.5">contract-freeze</code> phải xuất
            ra một file artifact.
          </li>
          <li>Bước sinh test bị chặn cho tới khi file đó tồn tại và đã được duyệt.</li>
          <li>Peer không có quyền ghi vào file schema — cần một lease riêng.</li>
        </ul>
        <p>
          Khi đó chuỗi domino chết vì <em>topology</em>, không vì agent có nhớ lời dặn hay không. Ví
          dụ đầy đủ ở{" "}
          <Link className="text-lead underline underline-offset-4" href="/vi-du/#minting-api">
            ví dụ 6
          </Link>
          .
        </p>
      </Section>

      <Section title="Dấu hiệu bạn đang ở trong cạm bẫy">
        <ul className="space-y-2">
          <li>
            Trong một diff, file test và file implementation được sửa cùng commit, và có một field
            xuất hiện ở cả hai mà không có trong migration nào.
          </li>
          <li>Sửa một dòng code làm đỏ hàng chục test không liên quan.</li>
          <li>
            Test kiểm tra đúng cái code vừa viết, chứ không kiểm tra cái hợp đồng đã thỏa thuận.
          </li>
        </ul>
      </Section>
    </>
  );
}
