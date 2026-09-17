import Link from "next/link";
import { Callout, ClaimBadge, OurNote, PageTitle, Quote, Section, Table } from "@/components/ui";

export const metadata = { title: "Supervisor — SLP Blueprint" };

const TRIGGERS = [
  {
    n: 1,
    title: "Lead đưa ra một quyết định kiến trúc hệ trọng",
    detail:
      "Đổi schema, đổi giao thức, đổi lớp auth, migration. Lead đang ở trong framing của chính nó; Supervisor có context sạch nên nhìn được chỗ Lead mù.",
  },
  {
    n: 2,
    title: "Peer đang vật lộn với khái niệm mơ hồ",
    detail:
      "Dấu hiệu thật không phải câu chữ do dự, mà là sửa lặp cùng một file, test fail dịch chỗ, thời gian trôi mà diff không hội tụ.",
  },
  {
    n: 3,
    title: "Luồng suy nghĩ phải đảo hướng đột ngột",
    detail:
      "Tiền đề khởi động hóa ra sai. Lead có quán tính bảo vệ hai tiếng đã đầu tư; Supervisor không mang theo sunk cost đó.",
  },
];

export default function Page() {
  return (
    <>
      <PageTitle
        kicker="Slide 3 · 9 · 10"
        title="Supervisor — cảm biến sự chú ý"
        lead="Lớp đắt nhất và hiếm chạy nhất. Nó không quản lý ai; nó phát hiện lúc luồng nghẽn rồi tiêm sự chú ý vào đúng chỗ."
      />

      <Section title="Đặc tính cốt lõi" slide="slide 9">
        <ul className="space-y-2">
          <li>
            Là &ldquo;cú đêm&rdquo; giám sát <strong>thụ động</strong> toàn bộ luồng làm việc với{" "}
            <strong>Clean Context</strong>.
          </li>
          <li>
            <strong>Tuyệt đối không can thiệp thủ công</strong> — không tự sửa code như con người.
          </li>
          <li>Không chạy liên tục. Chỉ nổ khi có biến.</li>
        </ul>
        <Callout tone="note" title="Vì sao Clean Context là điều kiện, không phải chi tiết">
          <p>
            Giá trị của Supervisor nằm ở chỗ nó <em>không</em> mang theo framing tích lũy của Lead.
            Một quan sát viên đã đọc hết hai tiếng lập luận của Lead sẽ thừa hưởng luôn điểm mù của
            Lead. Đây cũng là chỗ tài liệu tự mâu thuẫn — xem cảnh báo ở cuối trang.
          </p>
        </Callout>
      </Section>

      <Section title="Ba điều kiện kích hoạt" slide="slide 9">
        <div className="space-y-3">
          {TRIGGERS.map((t) => (
            <article key={t.n} className="rounded-lg border border-sv/40 bg-sv-soft/25 p-4">
              <h3 className="font-semibold text-sv">
                Trigger {t.n} — {t.title}
              </h3>
              <p className="mt-2 text-sm">{t.detail}</p>
            </article>
          ))}
        </div>
        <p>
          Hành động được cấp: <strong>tiêm sự chú ý</strong>, <strong>buộc họp hội đồng</strong>,
          hoặc <strong>hand-over cho con người</strong>. Cả ba đều là gửi thông điệp vào luồng — giữ
          nguyên tính chất &ldquo;không can thiệp thủ công&rdquo;.
        </p>
        <p>
          Ví dụ cụ thể cho từng trigger nằm ở{" "}
          <Link className="text-lead underline underline-offset-4" href="/vi-du/#sv-trigger-1">
            trang ví dụ số 7, 8, 9
          </Link>
          .
        </p>
      </Section>

      <Section title="Heartbeat vs Semantic Sensor" slide="slide 10">
        <Table
          head={["", "Heartbeat (cổ điển)", "Semantic Sensor (tối ưu)"]}
          rows={[
            {
              key: "cach-lam",
              cells: [
                "Cách làm",
                "Ping Supervisor mỗi 15 phút, đọc lại toàn bộ hội thoại",
                "Model cực nhỏ đọc ngữ nghĩa liên tục, chỉ báo động khi phát hiện nghẽn",
              ],
            },
            {
              key: "nhuoc-diem",
              cells: [
                "Nhược điểm tài liệu nêu",
                "Phình to context, lãng phí token, bỏ lỡ điểm gãy",
                "Tài liệu không nêu nhược điểm nào",
              ],
            },
            {
              key: "model",
              cells: [
                "Model",
                "Model lớn, mỗi 15 phút",
                <span key="model-sensor">
                  &ldquo;Flash/Ox, vài chục k params&rdquo; <ClaimBadge />
                </span>,
              ],
            },
            {
              key: "diem-gay",
              cells: [
                "Điểm gãy",
                <OurNote key="hb-gay">Điểm gãy rơi giữa hai nhịp thì bỏ lỡ</OurNote>,
                <OurNote key="ss-gay">Phụ thuộc hoàn toàn vào chất lượng tín hiệu được chọn</OurNote>,
              ],
            },
          ]}
        />
        <p className="text-sm text-muted">
          Tài liệu <strong>không đưa con số chi phí nào ở cả hai phía</strong> — không tỉ lệ, không
          bậc độ lớn. Hàng &ldquo;Điểm gãy&rdquo; là nhận xét của trang này, không phải nội dung
          slide 10.
        </p>
        <Callout tone="ok" title="Phần này của tài liệu đứng vững">
          <p>
            Kiến trúc cascade — bộ lọc rẻ chạy liên tục, model đắt chỉ nổ khi cần — là đóng góp kỹ
            thuật thật nhất của cả bộ slide. Heartbeat 15 phút đọc lại toàn bộ hội thoại tiêu tốn
            theo cả tần suất lẫn độ dài hội thoại, nên tài liệu bác nó có lý. Mức tiết kiệm cụ thể
            thì <strong>chưa ai đo</strong> — tài liệu không đưa con số, và trang này cũng không
            dựng ra con số thay nó.
          </p>
        </Callout>
        <Callout tone="warn" title="Nhưng lớp tín hiệu được chọn là lớp yếu nhất">
          <p>
            Marker được liệt kê là <code className="rounded bg-panel px-1 py-0.5">but…</code>,{" "}
            <code className="rounded bg-panel px-1 py-0.5">hold on…</code>,{" "}
            <code className="rounded bg-panel px-1 py-0.5">vật lộn</code>,{" "}
            <code className="rounded bg-panel px-1 py-0.5">mơ hồ</code>. Hai vấn đề:
          </p>
          <p>
            <strong>Base rate quá cao.</strong> &ldquo;but&rdquo; và &ldquo;hold on&rdquo; xuất hiện
            dày đặc trong suy luận trôi chảy bình thường. Ngưỡng thấp → bão báo động giả.
          </p>
          <p>
            <strong>Mù đúng lúc cần nhất.</strong> Cảm biến suy ra trạng thái nghẽn từ dấu hiệu do
            dự. Một agent sai <em>một cách tự tin</em> không do dự, nên không phát ra marker nào.
            Mà đó chính là ca slide 15 đem ra quảng cáo: agent sắp xóa DB vì tin chắc mình đúng.
            Cảm biến phản tương quan với sự kiện nghiêm trọng nhất nó được bán để bắt.
          </p>
          <p>
            Cách sửa nằm ở{" "}
            <Link className="text-lead underline underline-offset-4" href="/vi-du/#semantic-sensor">
              ví dụ 12
            </Link>
            : tín hiệu tiến triển tất định làm kênh chính, ngôn ngữ làm kênh phụ.
          </p>
        </Callout>
      </Section>

      <Section title="Mâu thuẫn cần biết trước khi áp dụng">
        <Callout tone="warn" title="Quan sát viên thụ động không CHẶN được">
          <p>
            Slide 9 định nghĩa Supervisor là thụ động, tuyệt đối không can thiệp thủ công. Slide 15
            lại cho Supervisor &ldquo;chặn đứng&rdquo; nguy cơ xóa DB lúc 06:00.
          </p>
          <p>
            Chặn là hành động <strong>đồng bộ, nằm trên đường thực thi</strong>: giữ lại lệnh phá
            hủy <em>trước khi</em> nó chạy. Một quan sát viên bất đồng bộ — phát hiện marker, nạp
            context, soạn thông điệp — mất từ một đến vài phút. <code className="rounded bg-panel px-1 py-0.5">DROP TABLE</code> xong trong mili-giây.
          </p>
          <p>
            Cơ chế duy nhất chặn được là một <strong>interceptor tất định</strong>: allowlist lệnh,
            deny cứng hành động phá hủy, sandbox không có credential production, hàng đợi người
            duyệt. Nó đứng trên đường thực thi, nên theo định nghĩa slide 9 nó không còn là
            Supervisor thụ động — và quan trọng hơn: <strong>nó không cần LLM</strong>.
          </p>
          <p className="font-semibold text-warn">
            Tách đôi hai vai. Supervisor lo hướng chất lượng. Interceptor tất định lo chặn phá hủy.
            Đừng để một model xác suất làm hàng phòng thủ cuối.
          </p>
        </Callout>
        <Callout tone="note" title="Clean Context vs Giữ toàn cục">
          <p>
            Slide 9 ghi Supervisor chạy <em>Clean Context</em>. Slide 12 ghi nhu cầu context của
            Supervisor là <em>&ldquo;Rất lớn (giữ toàn cục)&rdquo;</em>. Hai chế độ này loại trừ
            nhau. Cách gỡ khả dĩ: Supervisor không giữ transcript thô, mà giữ một khối state có cấu
            trúc, dung lượng cố định (quyết định đã chốt, invariant, cờ rủi ro); mỗi lần nổ thì nạp
            state đó cộng cửa sổ liên quan, trong một context sạch.
          </p>
        </Callout>
      </Section>

      <Section title="Khi nào KHÔNG cần Supervisor">
        <p>
          Task một luồng, scope nhỏ, thay đổi đảo ngược được, và có người ngồi trước màn hình. Lúc
          đó <strong>bạn</strong> là Supervisor: context sạch, nhìn toàn cục, can thiệp tức thì,
          chi phí bằng không. Thêm một tầng model chỉ thêm độ trễ và token.
        </p>
        <Quote cite="ma trận slide 12">
          Supervisor: model Large, event-triggered, context rất lớn. Đắt, và hiếm khi chạy — đó là
          thiết kế, không phải thiếu sót.
        </Quote>
      </Section>
    </>
  );
}
