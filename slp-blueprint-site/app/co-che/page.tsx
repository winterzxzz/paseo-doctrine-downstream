import Link from "next/link";
import { Callout, PageTitle, Quote, Section } from "@/components/ui";

export const metadata = { title: "Cơ chế ngang — SLP Blueprint" };

export default function Page() {
  return (
    <>
      <PageTitle
        kicker="Slide 5 · 7"
        title="Hai cơ chế cắt ngang mọi vai"
        lead="Prompt trung tính và kiến trúc hội tụ ba lane. Cả hai không phụ thuộc vào việc bạn có dựng đủ ba tầng hay không — chúng dùng được ngay cả khi bạn chỉ có một agent."
      />

      <Section title="Prompt trung tính" slide="slide 5">
        <p className="text-muted">
          Lưu ý tâm lý của tài liệu: LLM có xu hướng muốn làm hài lòng người hỏi (people-pleasing).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-lg border border-warn/40 bg-warn/10 p-5">
            <h3 className="font-semibold text-warn">✕ Câu hỏi đóng</h3>
            <p className="mt-3 rounded bg-ink/60 p-3 font-mono text-sm">
              &ldquo;Mày có đang vi phạm anti-pattern nào không?&rdquo;
            </p>
            <p className="mt-3 text-sm">
              Hậu quả: đóng khung tư duy AI. Nó sẽ tự <em>bịa</em> ra lỗi để thỏa mãn câu hỏi, dù
              code đang chạy đúng.
            </p>
          </article>
          <article className="rounded-lg border border-ok/40 bg-ok/10 p-5">
            <h3 className="font-semibold text-ok">✓ Prompt trung tính</h3>
            <p className="mt-3 rounded bg-ink/60 p-3 font-mono text-sm">
              &ldquo;Mày có vừa làm sai contract nào đề ra không, hoặc bỏ qua doc nào không?&rdquo;
            </p>
            <p className="mt-3 text-sm">
              Kết quả: câu hỏi mở, AI tự rà soát một cách khách quan.
            </p>
          </article>
        </div>
        <Callout tone="note" title="Cơ chế thật là groundedness, không phải neutrality">
          <p>
            Để ý: <strong>cả hai ví dụ đều là câu hỏi yes/no</strong>. Vậy khác biệt không nằm ở
            &ldquo;đóng vs mở&rdquo;.
          </p>
          <p>
            Câu ✕ hỏi về <em>anti-pattern</em> — một phạm trù trừu tượng không có ground truth, nên
            model chỉ còn cách đoán, và vì muốn làm hài lòng nên nó đoán theo hướng có lỗi. Câu ✓ neo
            vào <strong>artifact kiểm chứng được</strong>: contract, doc. Có chỗ để đối chiếu, có chỗ
            để trích dẫn.
          </p>
          <p className="font-semibold">
            Quy tắc rút ra không phải &ldquo;hãy hỏi mềm hơn&rdquo;, mà là{" "}
            <span className="text-ok">&ldquo;hãy neo câu hỏi vào một thứ kiểm chứng được&rdquo;</span>.
            Nhầm chỗ này thì bạn sẽ đi làm mềm câu chữ và không thu được gì.
          </p>
        </Callout>
        <p>
          Hai ví dụ áp dụng:{" "}
          <Link className="text-lead underline underline-offset-4" href="/vi-du/#neutral-review">
            rà soát code (ví dụ 1)
          </Link>{" "}
          và{" "}
          <Link className="text-lead underline underline-offset-4" href="/vi-du/#neutral-perf">
            hỏi về hiệu năng (ví dụ 2)
          </Link>
          .
        </p>
      </Section>

      <Section title="Kiến trúc hội tụ — ba lane mù" slide="slide 7">
        <div className="rounded-lg border border-line bg-panel p-5">
          <p className="mb-4 text-sm font-semibold text-muted">Thiết kế mù</p>
          <div className="space-y-2">
            {["Lane 1 (Peer A)", "Lane 2 (Peer B)", "Lane 3 (Peer C)"].map((lane) => (
              <div key={lane} className="flex items-center gap-3">
                <div className="flex-1 rounded border border-peer/40 bg-peer-soft/50 px-3 py-2 text-sm text-peer">
                  {lane}
                </div>
                <span aria-hidden className="text-muted">
                  →
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Hoạt động độc lập (nhiệt độ / cấu hình khác nhau). KHÔNG chia sẻ Framing.
          </p>
          <div className="mt-5 rounded border border-lead/50 bg-lead-soft/40 p-4">
            <p className="font-semibold text-lead">LEAD — nút hội tụ</p>
            <ol className="mt-2 space-y-1 text-sm">
              <li>1. Nhận 3 bản thiết kế.</li>
              <li>2. Phản biện chéo ưu / nhược điểm.</li>
              <li>3. Ra quyết định cuối cùng.</li>
            </ol>
          </div>
        </div>
        <Quote cite="slide 7">
          Tận dụng sự ngẫu nhiên của LLM để quét tối đa giải pháp, loại bỏ hoàn toàn Framing Bias.
        </Quote>
        <Callout tone="warn" title="Ba đường rò mà chữ “hoàn toàn” bỏ qua">
          <p>
            <strong>1. Cùng họ model → lỗi tương quan.</strong> Chung pretraining, chung điểm mù.
            Đổi temperature làm tăng phương sai token ở nhánh xác suất thấp, chứ không tạo ra giả
            thuyết độc lập. Số lane <em>hiệu dụng</em> nhỏ hơn 3 khá nhiều.
          </p>
          <p>
            <strong>2. Đề bài chính là framing.</strong> Ba lane vẫn nhận một task statement do Lead
            soạn. Framing của Lead vào cả ba qua cửa trước; chỉ &ldquo;gợi ý giải pháp&rdquo; bị chặn.
          </p>
          <p>
            <strong>3. Lead hội tụ.</strong> Bước 3 bơm bias của Lead trở lại.
          </p>
          <p className="font-semibold text-warn">
            Hệ quả nguy hiểm nhất: lỗi tương quan cộng với hội tụ theo đa số tạo ra{" "}
            <em>đồng thuận sai một cách tự tin</em>. Ba lane cùng mù một chỗ thì sự trùng khớp bị
            đọc thành sự xác nhận. Quy tắc phải nhớ: <strong>đồng thuận không phải bằng chứng.</strong>
          </p>
        </Callout>
        <Callout tone="ok" title="Khi nào ba lane đáng tiền">
          <p>Cả ba điều kiện phải cùng đúng:</p>
          <p>
            (a) quyết định đắt khi đảo ngược; (b) không gian nghiệm thật sự đa mode, không có lời
            giải chuẩn; (c) <strong>tồn tại bộ phân định rẻ và khách quan</strong> — benchmark,
            prototype chạy được, test đối kháng.
          </p>
          <p>
            Thiếu (c) là ca tệ nhất: Lead không có tiêu chí khách quan sẽ chọn theo văn phong thuyết
            phục, và bạn trả 3× chi phí để có chất lượng bằng 1 lane cộng ảo giác đã cân nhắc kỹ.
            Với việc có một đáp án đúng kiểm được (fix bug, migration, refactor cơ học), ba lane là
            hai lane rác đã biết trước.
          </p>
        </Callout>
        <p>
          Cách dựng một phiên ba lane đúng:{" "}
          <Link className="text-lead underline underline-offset-4" href="/vi-du/#blind-lane">
            ví dụ 4
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
