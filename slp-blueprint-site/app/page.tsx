import Link from "next/link";
import { CardLink, Callout, ClaimBadge, PageTitle, RoleCard, Section } from "@/components/ui";

export default function HomePage() {
  return (
    <>
      <PageTitle
        kicker="Đặc tả kỹ thuật & quản trị hệ đa tác nhân"
        title="SLP — Supervisor · Lead · Peer"
        lead="Một kiến trúc ba lớp để vận hành nhiều agent lập trình cùng lúc. Trang này giải thích từng cơ chế của tài liệu gốc, thêm ví dụ thực chiến, và đặt cạnh đó một phiên thẩm định ba lane mù để bạn thấy chỗ nào vững, chỗ nào chưa."
      />

      <Callout tone="warn" title="Đọc trang này với đúng trọng lượng của nó">
        <p>
          Tài liệu gốc là 15 slide, toàn ảnh raster, watermark &ldquo;Gemini Notebook&rdquo;, không
          kèm số đo, không kèm triển khai tham chiếu. Nó là một <strong>bài nói tốt</strong> và một{" "}
          <strong>bộ từ vựng tốt</strong> — không phải bản thiết kế đã được kiểm chứng.
        </p>
        <p>
          Các con số trong tài liệu (tỉ lệ lỗi 50%, attention 25%×4, model &ldquo;vài chục k
          params&rdquo;, 5-7 project &gt;200k dòng code) được giữ nguyên văn trên trang này. Ở chỗ
          chúng được <em>giới thiệu</em>, chúng luôn mang nhãn <ClaimBadge />; trong các đoạn phê
          bình thì nhãn được lược đi cho đỡ rối, vì cả đoạn đã là phê bình.
        </p>
      </Callout>

      <Section title="Ba lớp" slide="slide 3">
        <div className="grid gap-4 sm:grid-cols-3">
          <RoleCard
            role="supervisor"
            letter="S"
            name="Supervisor"
            subtitle="Người giám sát"
            points={[
              "Cấp cao nhất, không trực tiếp viết mã",
              "Quản trị sự chú ý (Attention)",
              "Can thiệp qua event trigger, không chạy liên tục",
            ]}
          />
          <RoleCard
            role="lead"
            letter="L"
            name="Lead"
            subtitle="Người điều phối"
            points={[
              "Ra quyết định và giữ khung tư duy (Framing)",
              "Không làm việc nặng",
              "Điều hướng và hội tụ các phương án",
            ]}
          />
          <RoleCard
            role="peer"
            letter="P"
            name="Peer"
            subtitle="Người thực thi"
            points={[
              "Lực lượng sản xuất lõi: code, test",
              "Trực tiếp giải quyết bài toán",
              "Có quyền phản biện độc lập với Lead",
            ]}
          />
        </div>
      </Section>

      <Section title="Luận điểm trung tâm" slide="slide 2">
        <p>
          Mô hình cũ — <em>Human in the Loop</em> — đặt con người vào vòng lặp{" "}
          <code className="rounded bg-panel px-1.5 py-0.5 text-sm">
            viết prompt → chờ → sửa lỗi → lặp
          </code>
          . Con người trở thành cổ chai băng thông, trần năng suất ở 1-2 dự án.
        </p>
        <p>
          Mô hình mới — <em>Human Intention</em> — đổi vai trò con người từ người điều khiển từng
          tác vụ sang người <strong>điều phối sự chú ý</strong>. Đặt ý định, đi ngủ, hệ tự vận
          hành, sáng nhận báo cáo.
        </p>
        <Callout tone="claim" title="Đây là claim, không phải kết quả đo (slide 1 · 15)">
          <p>
            Con số dưới đây <strong>không nằm ở slide 2</strong> — slide 2 chỉ nói trần của mô hình
            cũ là 1-2 dự án. Nó đến từ badge slide 1 và dòng kết slide 15: chạy đồng thời{" "}
            <strong>5-7 project</strong> lớn (&gt;200.000 dòng code) <ClaimBadge />. Không có định
            nghĩa &ldquo;mượt mà&rdquo;, không có tỉ lệ sự cố, không có chi phí. Xem{" "}
            <Link className="text-lead underline underline-offset-4" href="/tranh-luan/">
              phiên tranh luận
            </Link>{" "}
            để biết điều kiện nào phải đúng trước khi claim này có nghĩa.
          </p>
        </Callout>
      </Section>

      <Section title="Đi tiếp">
        <div className="grid gap-3 sm:grid-cols-2">
          <CardLink href="/triet-ly/" title="Triết lý">
            Chuyển dịch hệ hình, và tư duy &ldquo;Sói dẫn bầy Cừu&rdquo;.
          </CardLink>
          <CardLink href="/supervisor/" title="Supervisor">
            Ba trigger, cơ chế event-driven, và chỗ tài liệu tự mâu thuẫn.
          </CardLink>
          <CardLink href="/lead/" title="Lead">
            Framing, hội tụ, và hai chiến thuật chống tràn ngữ cảnh.
          </CardLink>
          <CardLink href="/peer/" title="Peer">
            Thuyết phân bổ năng lực và giao thức kháng nghị.
          </CardLink>
          <CardLink href="/co-che/" title="Cơ chế ngang">
            Prompt trung tính và kiến trúc hội tụ ba lane mù.
          </CardLink>
          <CardLink href="/cam-bay/" title="Cạm bẫy">
            Minting API — chuỗi domino từ một test viết quá sớm.
          </CardLink>
          <CardLink href="/vi-du/" title="12 ví dụ thực chiến">
            Prompt sai, prompt đúng, và dấu hiệu nhận biết mình đang làm sai.
          </CardLink>
          <CardLink href="/tranh-luan/" title="Ba lane thẩm định">
            Kết quả một phiên debate mù về chính tài liệu này.
          </CardLink>
        </div>
      </Section>
    </>
  );
}
