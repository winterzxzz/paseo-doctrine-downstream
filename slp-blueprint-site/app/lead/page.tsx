import Link from "next/link";
import { Callout, PageTitle, Quote, Section } from "@/components/ui";

export const metadata = { title: "Lead — SLP Blueprint" };

export default function Page() {
  return (
    <>
      <PageTitle
        kicker="Slide 3 · 6"
        title="Lead — framing và hội tụ"
        lead="Lead là bộ não ra quyết định và là nơi giữ khung tư duy. Việc nó không làm: sinh code. Việc nó dễ làm sai: tự vá mọi thứ nó nhìn thấy."
      />

      <Section title="Chức năng" slide="slide 3 · 6">
        <ul className="space-y-2">
          <li>
            <strong>Lập luận (Ruling)</strong> — nhận phản biện, ra phán quyết có bằng chứng.
          </li>
          <li>
            <strong>Định hướng (Explore)</strong> — mở không gian phương án trước khi thu hẹp.
          </li>
          <li>
            <strong>Hội tụ</strong> — nhận nhiều bản thiết kế, phản biện chéo, chốt một.
          </li>
          <li>
            <strong>Giữ Framing</strong> — và đây vừa là chức năng vừa là rủi ro lớn nhất của nó.
          </li>
        </ul>
        <Quote cite="slide 6">
          Chức năng LEAD: Lập luận, Định hướng và Hội tụ quyết định. Không trực tiếp sinh code.
        </Quote>
      </Section>

      <Section title="Chống tràn ngữ cảnh" slide="slide 6">
        <p>
          Tình huống mẫu của tài liệu: Lead 1 đang chạy luồng tính năng A thì phát hiện thiếu
          Authentication. Nhánh bị gạch chéo là <strong>tự vá lỗi</strong> — vì nó làm context phình
          ra và làm Lead quên mất quyết định đã chốt ở đầu phiên.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-lg border border-lead/40 bg-lead-soft/30 p-5">
            <h3 className="font-semibold text-lead">Chiến thuật 1 — Compact</h3>
            <p className="mt-2 text-sm">
              Chủ động tổng hợp bộ nhớ: nén lịch sử thành các quyết định và invariant, bỏ phần dẫn
              dắt. Rẻ, làm tại chỗ. Điểm yếu: nén là mất mát, và cái bị mất thường là lý do đằng sau
              một quyết định.
            </p>
          </article>
          <article className="rounded-lg border border-lead/40 bg-lead-soft/30 p-5">
            <h3 className="font-semibold text-lead">Chiến thuật 2 — The Hand-off</h3>
            <p className="mt-2 text-sm">
              Chuyển hẳn phạm vi việc sang một luồng mới (Lead 2 xử lý Auth), kết quả hợp lưu về
              luồng chính. Mạnh hơn Compact vì nó chuyển <em>phạm vi việc</em> thay vì nén{" "}
              <em>lịch sử</em>.
            </p>
          </article>
        </div>
        <Callout tone="warn" title="Tài liệu thiếu phanh cho Hand-off">
          <p>
            Slide 6 chỉ vẽ &ldquo;Lead 1 → Lead 2&rdquo;. Không có depth cap, không có phát hiện chu
            trình, không có sổ ghi ai đang giữ scope nào. Thực tế: Lead 2 phát hiện thiếu migration →
            Lead 3; Lead 3 phát hiện phụ thuộc Auth → quay về Lead 1. Đêm 7 tiếng đủ dài để vòng đó
            chạy nhiều lần.
          </p>
          <p>
            Cần thêm: <strong>cap cứng</strong> (ví dụ độ sâu 3), <strong>sổ hand-off toàn cục</strong>,
            và <strong>một Owner ghi cho mỗi scope</strong> — không hai luồng cùng ghi một vùng.
          </p>
        </Callout>
        <p>
          Gói bàn giao cụ thể xem{" "}
          <Link className="text-lead underline underline-offset-4" href="/vi-du/#handoff">
            ví dụ 10
          </Link>
          .
        </p>
      </Section>

      <Section title="Lead là nút hội tụ — và là chỗ bias quay lại" slide="slide 7">
        <p>
          Kiến trúc ba lane mù đẩy bias ra khỏi các lane. Nhưng bước cuối —{" "}
          <em>&ldquo;Lead ra quyết định cuối cùng&rdquo;</em> — bơm bias của Lead trở lại. Kiến trúc
          này <strong>dời</strong> bias, không xóa bias.
        </p>
        <Callout tone="note" title="Cách làm việc hội tụ bớt phụ thuộc vào khẩu vị của Lead">
          <p>
            Đặt một bộ lọc tất định <em>trước</em> khi Lead phán: mỗi bản thiết kế phải pass schema,
            build, test, và phải sống sót qua các kịch bản hỏng do những bản khác nêu ra. Lead chỉ
            trọng tài giữa các bản còn sống. Nếu không có bộ lọc đó, Lead sẽ chọn theo{" "}
            <strong>bản viết thuyết phục nhất</strong> — và hệ thống khi ấy đang tối ưu cho sức
            thuyết phục, không phải cho tính đúng.
          </p>
        </Callout>
      </Section>
    </>
  );
}
