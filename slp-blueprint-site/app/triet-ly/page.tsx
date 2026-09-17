import { Callout, ClaimBadge, OurNote, PageTitle, Quote, Section, Table } from "@/components/ui";

export const metadata = { title: "Triết lý — SLP Blueprint" };

export default function Page() {
  return (
    <>
      <PageTitle
        kicker="Slide 2 · 14"
        title="Triết lý"
        lead="Hai slide mang toàn bộ lập luận nền: tại sao phải đổi vai trò con người, và tư duy nào giữ cho việc đổi vai trò đó không thành buông tay."
      />

      <Section title="Sự chuyển dịch hệ hình" slide="slide 2">
        <Table
          head={["", "Mô hình cũ — Human in the Loop", "Mô hình mới — Human Intention"]}
          rows={[
            {
              key: "vong-lap",
              cells: [
                "Vòng lặp",
                "Viết prompt → chờ đợi → sửa lỗi → lặp lại",
                "Thiết lập ý định → hệ tự vận hành & vá lỗi → báo cáo",
              ],
            },
            {
              key: "vai-tro",
              cells: [
                "Vai trò người",
                "Điều khiển từng tác vụ",
                "Điều phối sự chú ý (Attention)",
              ],
            },
            {
              key: "nut-that",
              cells: [
                "Nút thắt",
                "Con người là cổ chai băng thông",
                <OurNote key="nut-that-moi">Cổ chai dời sang lúc thẩm định kết quả</OurNote>,
              ],
            },
            {
              key: "tran-nang-suat",
              cells: [
                "Trần năng suất",
                "1-2 dự án",
                <span key="tran-moi">
                  5-7 dự án <ClaimBadge /> <span className="text-muted">(slide 1 · 15)</span>
                </span>,
              ],
            },
          ]}
        />
        <p className="text-sm text-muted">
          Hai cột trên là nội dung slide 2, trừ hai ô được đánh dấu: ô &ldquo;nhận xét&rdquo; là cách
          đọc của trang này, còn con số 5-7 dự án đến từ slide 1 và slide 15 chứ không phải slide 2 —
          slide 2 chỉ nói trần của mô hình cũ là 1-2 dự án.
        </p>
        <Quote cite="slide 2">
          Không điều khiển từng tác vụ. Chúng ta điều phối sự chú ý (Attention).
        </Quote>
        <Callout tone="warn" title="Cổ chai không biến mất — nó bị dời và bị nén">
          <p>
            Slide 2 nói con người là cổ chai. Slide 14 lại đòi con người &ldquo;đủ năng lực thẩm
            định lại các kiến trúc phức tạp do Lead đề xuất&rdquo;. Hai điều này cùng tồn tại được
            về nguyên lý — băng thông và độ phân giải phán đoán là hai đại lượng khác nhau.
          </p>
          <p>
            Nhưng ở quy mô 5-7 project, số học không đóng lại: 6 project × 1-3 quyết định kiến
            trúc/đêm = 10-20 phiên audit mỗi sáng, trên 6 codebase khác nhau, và kênh duy nhất
            được cấp cho con người là một bản tóm tắt bằng giọng nói — thứ không quét được, không
            diff được. Muốn số học đóng lại thì phải chấp nhận <strong>lấy mẫu</strong>, tức chấp
            nhận cho kiến trúc chưa ai duyệt đi vào codebase. Đó có thể là đánh đổi hợp lý, nhưng
            tài liệu không nêu nó.
          </p>
        </Callout>
      </Section>

      <Section title="The Wolf Mindset" slide="slide 14">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-sv/40 bg-sv-soft/30 p-5">
            <h3 className="mb-3 font-semibold text-sv">Nghệ thuật &ldquo;Show, Don&rsquo;t Tell&rdquo;</h3>
            <ul className="space-y-2 text-sm">
              <li>Gài vấn đề / câu hỏi vào luồng, không mớm giải pháp sẵn.</li>
              <li>Kích thích agent tự tìm đường.</li>
            </ul>
            <Quote cite="slide 14">
              Phải làm Sói dẫn bầy Cừu. Đừng là Cừu đòi dẫn bầy Sói.
            </Quote>
          </div>
          <div className="rounded-lg border border-lead/40 bg-lead-soft/30 p-5">
            <h3 className="mb-3 font-semibold text-lead">Học tập liên tục</h3>
            <ul className="space-y-2 text-sm">
              <li>Chuyển từ tư duy viết code sang tư duy quản trị AI.</li>
              <li>Dùng LLM tự sinh tài liệu chuyên ngành để nâng kiến thức lõi.</li>
              <li>Đủ năng lực thẩm định (audit) lại kiến trúc do Lead đề xuất.</li>
            </ul>
          </div>
        </div>
        <Callout tone="note" title="Một vòng tròn cần để ý">
          <p>
            Dùng LLM tự sinh tài liệu <em>để</em> đủ sức thẩm định kiến trúc do LLM đề xuất — trong
            vòng này không có điểm neo sự thật nào nằm ngoài model. Điểm neo thật phải đến từ thứ
            chạy được: test, benchmark, production log, hoặc một người thứ hai.
          </p>
        </Callout>
      </Section>

      <Section title="Điều còn lại sau khi trừ đi phần quảng cáo">
        <p>
          Bỏ các con số chưa kiểm chứng, phần triết lý còn lại một ý đứng vững:{" "}
          <strong>đơn vị khan hiếm không phải token, cũng không phải năng lực coding — mà là sự
          chú ý biết phán xét.</strong> Mọi cơ chế còn lại trong tài liệu đều là cách phân phối
          đúng thứ khan hiếm đó: chia việc để không loãng, hỏi đúng cách để không nhiễu, và chỉ
          đánh thức tầng đắt khi thật sự có biến.
        </p>
      </Section>
    </>
  );
}
