import Link from "next/link";
import { Callout, PageTitle, Quote, Section, Table } from "@/components/ui";

export const metadata = { title: "Ba lane thẩm định — SLP Blueprint" };

export default function Page() {
  return (
    <>
      <PageTitle
        kicker="Áp dụng chính slide 7 lên chính tài liệu"
        title="Phiên thẩm định ba lane mù"
        lead="Ba agent chạy độc lập, không thấy output của nhau, mỗi lane một trục thẩm định, đều được cấp quyền bẻ gãy framing của người giao việc. Dưới đây là kết quả và phán quyết hội tụ."
      />

      <Callout tone="warn" title="Công bố tiêu chí hội tụ TRƯỚC khi đọc kết quả">
        <p>
          Cả ba lane chạy cùng một họ model. Theo đúng cảnh báo ở{" "}
          <Link className="text-lead underline underline-offset-4" href="/co-che/">
            trang cơ chế
          </Link>
          , sự trùng khớp giữa ba báo cáo <strong>không phải bằng chứng độc lập</strong> — nó có thể
          chỉ là prior chung của một họ model.
        </p>
        <p>Vì vậy phán quyết dưới đây chỉ nâng trọng lượng cho một luận điểm khi:</p>
        <p>
          (a) nó tái lập được trực tiếp từ câu chữ của slide, hoặc (b) nó được kiểm chứng bằng thứ
          nằm ngoài model. Trùng khớp ba lane <em>tự nó</em> không nâng độ tin cậy.
        </p>
      </Callout>

      <Section title="Thiết lập phiên">
        <Table
          head={["Lane", "Trục thẩm định", "Quyền"]}
          rows={[
            {
              key: "lane-a",
              cells: ["A", "Tính đúng đắn kỹ thuật của từng cơ chế", "Read-only, không external effect"],
            },
            {
              key: "lane-b",
              cells: [
                "B",
                "Vận hành: chi phí, độ trễ, failure mode, an toàn",
                "Read-only, không external effect",
              ],
            },
            {
              key: "lane-c",
              cells: ["C", "So sánh với các topology thay thế", "Read-only, không external effect"],
            },
          ]}
        />
        <p className="text-sm text-muted">
          Mỗi lane chỉ được đọc bản transcript 15 slide, không lane nào biết hai lane kia tồn tại,
          không lane nào được gán sẵn lập trường.
        </p>
      </Section>

      <Section title="Kết luận từng lane">
        <article className="rounded-lg border border-line bg-panel p-5">
          <h3 className="font-semibold text-white">Lane A — kỹ thuật</h3>
          <Table
            head={["Cơ chế", "Verdict"]}
            rows={[
              {
                key: "compute",
                cells: [
                  "Compute Allocation Theory",
                  "PARTIALLY-SOUND — đúng hướng, sai cơ chế, con số là trang trí",
                ],
              },
              {
                key: "framing",
                cells: [
                  "Neutral Framing",
                  "PARTIALLY-SOUND — chẩn đoán đúng, gọi tên sai: cơ chế thật là groundedness",
                ],
              },
              {
                key: "sensor",
                cells: ["Semantic Sensor", "UNSOUND như đặc tả — nhưng pattern cascade thì đúng"],
              },
              {
                key: "blind",
                cells: ["Blind multi-lane", "PARTIALLY-SOUND — riêng chữ “hoàn toàn” là sai"],
              },
              {
                key: "pushback",
                cells: [
                  "Pushback Protocol",
                  "PARTIALLY-SOUND — thiếu tiêu chí phân biệt phản biện thật/diễn",
                ],
              },
              {
                key: "minting",
                cells: ["Minting API", "SOUND — slide mạnh nhất tài liệu"],
              },
              {
                key: "matrix",
                cells: [
                  "Ma trận slide 12",
                  "PARTIALLY-SOUND — 2 mâu thuẫn, 1 thiếu sót, 1 nghịch gradient",
                ],
              },
            ]}
          />
        </article>

        <article className="mt-4 rounded-lg border border-line bg-panel p-5">
          <h3 className="font-semibold text-white">Lane B — vận hành</h3>
          <p className="mt-2 text-sm">
            <strong className="text-warn">CHƯA KHẢ THI</strong> cho claim trung tâm (5-7 project,
            &gt;200k LOC, unattended 00:00→07:00).{" "}
            <strong className="text-ok">KHẢ THI CÓ ĐIỀU KIỆN</strong> cho phiên bản thu nhỏ: 1-2
            project, có người trực từ xa, có gate quyết định.
          </p>
          <p className="mt-2 text-sm">
            Lý do nặng nhất không phải chi phí, mà là <strong>vắng hẳn tầng verification</strong>:
            15/15 slide nói về giao thức xã hội giữa agent, không slide nào định nghĩa
            &ldquo;xong&rdquo; là gì, ai chạy build/test, repo 200k LOC nạp vào context bằng cách
            nào, merge ba lane ra sao, rollback ra sao.
          </p>
          <p className="mt-2 text-sm text-muted">
            Lane B cũng dựng một ước lượng chi phí có ghi rõ giả định, ra bậc độ lớn khoảng
            $400–$3.000 một đêm ở N=6. Con số đó là <em>dựng từ giả định, không phải đo</em> — đừng
            trích ra khỏi ngữ cảnh.
          </p>
        </article>

        <article className="mt-4 rounded-lg border border-line bg-panel p-5">
          <h3 className="font-semibold text-white">Lane C — topology</h3>
          <p className="mt-2 text-sm">
            Phát biểu lại bài toán: <em>SLP không giải bài toán chất lượng code. Nó giải bài toán duy
            trì sự chú ý có thẩm quyền trên nhiều codebase lớn trong khoảng thời gian con người vắng
            mặt.</em>
          </p>
          <p className="mt-3 text-sm">
            <strong className="text-ok">SLP đúng cho:</strong> bài toán chưa biết hình dạng (không
            viết được DAG trước); thiết kế có rủi ro framing bias cao; rà soát cần reviewer không
            mang context tác giả; triage attention xuyên nhiều project.
          </p>
          <p className="mt-2 text-sm">
            <strong className="text-warn">SLP sai cho:</strong> việc lặp lại đã biết hình dạng
            (release, migration, codemod); mọi thứ thảm khốc-không-đảo-ngược; task nhỏ; việc bị chặn
            ngân sách; việc cần audit sau sự cố; môi trường cần trung lập vendor.
          </p>
        </article>
      </Section>

      <Section title="Phán quyết hội tụ">
        <Callout tone="ok" title="Giữ — có thể dùng ngay, không cần dựng gì thêm">
          <p>
            <strong>1. Neo câu hỏi vào artifact</strong> (slide 5). Đúng, rẻ, dùng được cả khi bạn
            chỉ có một agent. Nhớ tên đúng của cơ chế: groundedness, không phải neutrality.
          </p>
          <p>
            <strong>2. Contract trước test</strong> (slide 11). Quy tắc hành động rõ nhất của cả bộ,
            và là dầm chịu lực cho hai cơ chế kia. Bổ sung: contract phải dẫn xuất từ schema thật
            hoặc có người duyệt.
          </p>
          <p>
            <strong>3. Cascade rẻ→đắt</strong> (slide 10). Đúng về kinh tế. Nhưng đổi lớp tín hiệu:
            tín hiệu tiến triển tất định làm kênh chính, ngôn ngữ làm kênh phụ.
          </p>
          <p>
            <strong>4. Blind lane + hand-off</strong> (slide 6, 7). Cơ chế decorrelation và chống
            tràn context đều đúng. Thêm phanh: depth cap, sổ ghi scope, và một bộ lọc tất định trước
            khi Lead phán.
          </p>
        </Callout>

        <Callout tone="warn" title="Sửa — không dùng nguyên văn">
          <p>
            <strong>1. Supervisor không được làm lưới an toàn.</strong> Cả ba lane độc lập chỉ ra
            cùng chỗ này, và nó tái lập trực tiếp từ câu chữ: slide 9 định nghĩa quan sát viên thụ
            động, slide 15 giao cho nó nhiệm vụ chặn. Tách đôi: Supervisor lo hướng chất lượng,
            interceptor tất định lo chặn phá hủy.
          </p>
          <p>
            <strong>2. Thẩm quyền bằng prompt phải thành thẩm quyền bằng capability.</strong> Một
            instruction &ldquo;~40 dòng&rdquo; không cưỡng chế được gì. Quyền ghi, quyền chạy lệnh,
            quyền chạm schema phải nằm ở tầng harness.
          </p>
          <p>
            <strong>3. Mọi vòng lặp phải có cap.</strong> Hand-off depth, pushback rounds,
            trigger/giờ, ngân sách token. Có người trực thì con người là bộ dừng ngầm; chạy không
            người thì không ai là bộ dừng.
          </p>
          <p>
            <strong>4. Thêm tầng acceptance.</strong> Đây là thứ tài liệu thiếu hẳn, không phải
            thiếu tinh chỉnh.
          </p>
        </Callout>

        <Callout tone="note" title="Bỏ — không đưa vào thiết kế">
          <p>
            Mọi con số của tài liệu: tỉ lệ lỗi 50%, attention 25%×4, &ldquo;vài chục k params&rdquo;,
            instruction ~40 dòng, 5-7 project &gt;200k LOC. Không cái nào có phép đo đi kèm. Chúng
            hữu ích như hình ảnh minh họa, vô dụng như tham số thiết kế.
          </p>
        </Callout>
      </Section>

      <Section title="Ba lane phản biện lại chính người giao việc">
        <p>
          Cả ba đều dùng quyền pushback được cấp, và cả ba đều đúng ở những chỗ khác nhau. Ghi lại
          đây vì đó là phần có giá trị nhất của phiên.
        </p>
        <Quote cite="Lane A">
          Brief này vi phạm chính slide 5 mà nó bảo tôi thẩm định — có câu mang tiền giả định rằng
          tồn tại phần giải thích sai cơ chế. Tôi vẫn kết luận có, nhưng vì tái lập được từ văn bản,
          không phải vì brief đã bảo thế.
        </Quote>
        <Quote cite="Lane A">
          Mọi &ldquo;trích dẫn exact slide&rdquo; trong báo cáo này là trích một bản chép, không phải
          artifact gốc. Với một bộ slide mà điểm yếu nặng nhất chính là các con số, một hop chép tay
          chưa xác minh là rủi ro vật chất.
        </Quote>
        <p className="rounded-lg border border-ok/40 bg-ok/10 p-4 text-sm">
          <strong className="text-ok">Đã xử lý.</strong> Ba con số bị treo —{" "}
          <code className="rounded bg-ink/60 px-1 py-0.5">vài chục k params</code>,{" "}
          <code className="rounded bg-ink/60 px-1 py-0.5">~40 dòng</code>,{" "}
          <code className="rounded bg-ink/60 px-1 py-0.5">25%</code> — đã được đọc lại trực tiếp từ
          ảnh gốc ở mức pixel. Cả ba khớp nguyên văn với transcript. Verdict của Lane A không còn
          treo vào mắt xích chép tay.
        </p>
        <Quote cite="Lane B">
          Tôi phản đối việc coi tài liệu này là spec. Nó là bài nói, không phải bản thiết kế. Rủi ro
          là output của chúng ta — ba báo cáo trang trọng — trở thành thứ khiến nó nghe như một spec
          đã được thẩm định.
        </Quote>
        <Quote cite="Lane C">
          Topology không phải biến chính. Hai sự kiện quyết định trên chính timeline của tài liệu là
          một interlock và một quy tắc thứ tự — cả hai đều hoạt động ở mọi topology. Câu hỏi đúng
          hơn: cơ chế nào phải là capability, cơ chế nào được phép là prompt?
        </Quote>
        <Quote cite="Lane C">
          Danh sách topology tôi được giao đều là topology <em>điều khiển</em>; không cái nào là
          topology <em>kiểm chứng</em> — N lần thử độc lập rồi chọn bằng oracle chạy được. Ở đâu có
          oracle, nó thắng cả năm cái kia, vì nó thay phán xét bằng đo đạc.
        </Quote>
        <Callout tone="note" title="Ghi nhận của người hội tụ">
          <p>
            Ba phản biện trên đều được chấp nhận. Riêng phản biện của Lane B đổi cách trình bày toàn
            bộ trang web này: mọi con số của tài liệu được dán nhãn claim, và trang chủ nói thẳng đây
            là một bài nói tốt chứ không phải bản thiết kế đã kiểm chứng.
          </p>
          <p>
            Phản biện của Lane C đổi phán quyết: câu hỏi &ldquo;topology nào tốt nhất&rdquo; là câu
            hỏi sai. Câu đúng là <strong>cơ chế nào phải cưỡng chế bằng hạ tầng, cơ chế nào được phép
            là quy ước prompt</strong> — và ranh giới đó chạy qua giữa slide 9 và slide 15.
          </p>
        </Callout>
      </Section>
    </>
  );
}
