import Link from "next/link";
import { Callout, ClaimBadge, PageTitle, Quote, Section } from "@/components/ui";

export const metadata = { title: "Peer — SLP Blueprint" };

export default function Page() {
  return (
    <>
      <PageTitle
        kicker="Slide 3 · 4 · 8"
        title="Peer — thực thi và kháng nghị"
        lead="Peer là lực lượng sản xuất lõi. Thứ làm nó khác một function gọi API là quyền từ chối phương án của cấp trên."
      />

      <Section title="Thuyết phân bổ năng lực" slide="slide 4">
        <Quote cite="slide 4">
          AI sinh Unit Test sai không phải vì mô hình kém. Nguyên nhân: chưa phân bổ đủ năng lực suy
          luận và sự chú ý vào trọng tâm nhiệm vụ.
        </Quote>
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-lg border border-line bg-panel p-5">
            <h3 className="font-semibold text-warn">Luồng A — chưa tối ưu</h3>
            <p className="mt-2 text-sm">
              Giao một task phức tạp → attention bị phân tán 25% × 4 → tỉ lệ lỗi 50%.
              <ClaimBadge />
            </p>
          </article>
          <article className="rounded-lg border border-peer/40 bg-peer-soft/40 p-5">
            <h3 className="font-semibold text-peer">Luồng B — tối ưu hóa</h3>
            <p className="mt-2 text-sm">
              Peer sinh code → Supervisor tiêm một câu hỏi rà soát → dồn 100% compute để rà soát →
              tự nhận ra lỗi và sửa. <ClaimBadge />
            </p>
          </article>
        </div>
        <Callout tone="warn" title="Đúng hướng, sai cơ chế, và con số là trang trí">
          <p>
            Transformer chuẩn hóa attention theo từng head, từng layer, từng token — không có một
            con số toàn cục để chia cho 4 subtask. Compute suy luận mỗi token là cố định theo kiến
            trúc; không tồn tại thao tác &ldquo;dồn 100% compute&rdquo;.{" "}
            <code className="rounded bg-panel px-1 py-0.5">25% × 4</code> là đẳng thức sổ sách (cộng
            lại bằng 100%), không phải phép đo, và từ nó không suy ra được 50%.
          </p>
          <p>
            <strong>Nhưng hiệu ứng thì có thật</strong>, vì lý do khác: nhiều ràng buộc cạnh tranh
            làm instruction-following suy giảm; context loãng; và một lượt rà soát riêng với context
            sạch cho phép kiểm tra đối chiếu. Đòn bẩy thật là <em>số token suy luận sinh ra</em>,{" "}
            <em>độ sạch của context</em>, và <em>số lần gọi</em> — không phải một cái núm phần trăm.
          </p>
          <p>
            Cảnh báo quan trọng: &ldquo;tự nhận ra lỗi và sửa chữa&rdquo; chỉ đáng tin khi có{" "}
            <strong>oracle ngoài</strong> — contract, test chạy thật, schema. Tự sửa lỗi nội sinh
            không oracle là điểm yếu đã biết của LLM, đôi khi biến đáp án đúng thành sai.
          </p>
        </Callout>
        <p>
          Cách chia pha cụ thể xem{" "}
          <Link className="text-lead underline underline-offset-4" href="/vi-du/#compute-allocation">
            ví dụ 5
          </Link>
          .
        </p>
      </Section>

      <Section title="Giao thức kháng nghị" slide="slide 8">
        <ol className="space-y-2">
          <li>
            <strong>1.</strong> Lead đưa ra phương án đóng khung — ép chọn A hoặc B.
          </li>
          <li>
            <strong>2.</strong> Peer từ chối cả A và B, đề xuất phương án C.
          </li>
          <li>
            <strong>3.</strong> Lead phân tích → rút lại quyết định → chấp thuận C.
          </li>
        </ol>
        <Quote cite="slide 8">
          Nếu Lead bắt Peer chọn A hoặc B và Peer ngoan ngoãn chọn → Peer đã trở thành một function
          vô tri. Một Instruction tốt phải trao cho Peer quyền bẻ gãy Framing của cấp trên.
        </Quote>
        <Callout tone="ok" title="Đây là một tiêu chí chẩn đoán dùng được">
          <p>
            Câu trên là thứ hiếm trong tài liệu: một dấu hiệu <strong>quan sát được từ bên ngoài</strong>,
            không cần nội quan. Bạn kiểm tra hệ của mình bằng cách ép một lựa chọn nhị phân sai và
            xem Peer có nhận ra không.
          </p>
        </Callout>
        <Callout tone="warn" title="Nhưng quyền phản biện do chính bên ra lệnh cấp">
          <p>
            &ldquo;Hãy độc lập&rdquo; trở thành một mục tiêu tuân thủ mới. Một model có xu hướng làm
            hài lòng sẽ thỏa mãn nó bằng cách <strong>diễn</strong> bất đồng — bịa ra phương án C để
            chứng tỏ mình độc lập. Nhìn từ ngoài, C-thật và C-diễn giống hệt nhau.
          </p>
          <p>
            Chú ý mâu thuẫn nội bộ: slide 5 cảnh báo prompt có thể khiến AI bịa ra vấn đề; slide 8
            lại dùng prompt để AI bác bỏ cấp trên. Cùng một lớp failure, ngược dấu, không được thừa
            nhận ở đâu cả.
          </p>
          <p>
            Cách đóng lỗ: bắt phương án C phải kèm <strong>bằng chứng Lead chưa có</strong>, phải{" "}
            <strong>sống sót qua test chạy thật</strong>, và phải ghi rõ{" "}
            <strong>đồng ý cũng là câu trả lời hợp lệ</strong>. Xem{" "}
            <Link className="text-lead underline underline-offset-4" href="/vi-du/#pushback">
              ví dụ 3
            </Link>{" "}
            để lấy nguyên văn instruction.
          </p>
        </Callout>
        <Callout tone="note" title="Gradient năng lực chạy ngược">
          <p>
            Ma trận slide 12 gán Peer model <em>Variable</em> nằm dưới Lead <em>Medium-Large</em>.
            Nhưng slide 8 lại yêu cầu Peer lật kiến trúc của Lead. Về mặt cấu trúc, điều này khiến
            phản biện thật hiếm đi và phản biện diễn nhiều lên. Nếu bạn thật sự muốn pushback có
            trọng lượng, đừng đặt model yếu hơn vào vai người phản biện.
          </p>
        </Callout>
      </Section>
    </>
  );
}
