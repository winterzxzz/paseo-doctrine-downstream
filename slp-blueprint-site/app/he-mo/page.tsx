import { Callout, ClaimBadge, PageTitle, Quote, Section } from "@/components/ui";

export const metadata = { title: "Hệ mở & Master Blueprint — SLP" };

const TIMELINE = [
  {
    time: "00:00",
    title: "User Intent",
    body: "Kích hoạt SLP rồi đi ngủ. Chuyển giao nhiệm vụ cho Supervisor.",
    role: "supervisor" as const,
  },
  {
    time: "01:00 – 05:00",
    title: "Blind Design & Pushback",
    body: "Lead và Peer tranh luận, Supervisor quét ngữ nghĩa ngầm. Slide ghi đây là tương tác liên tục của cả ba lớp, không thuộc riêng lớp nào.",
    role: "all" as const,
  },
  {
    time: "06:00",
    title: "Event-driven Alert",
    body: "Phát hiện nguy cơ xóa DB → Supervisor chặn đứng & hand-off.",
    role: "supervisor" as const,
  },
  {
    time: "07:00",
    title: "Morning Report",
    body: "Gửi voice summary tình trạng đêm qua. Slide ghi báo cáo đến “từ hệ thống”, không gán cho lớp nào.",
    role: "all" as const,
  },
];

/** Only colour a step when slide 15 attributes it to one layer; "all" stays neutral. */
const ROLE_RING = {
  supervisor: "border-sv/50 bg-sv-soft/30",
  lead: "border-lead/50 bg-lead-soft/30",
  peer: "border-peer/50 bg-peer-soft/40",
  all: "border-line bg-panel",
};

export default function Page() {
  return (
    <>
      <PageTitle
        kicker="Slide 13 · 15"
        title="Hệ mở và bức tranh tổng thể"
        lead="Hai slide cuối: một nguyên tắc kiến trúc đáng giữ, và một timeline đêm lý tưởng cần đọc kỹ chỗ nào là quảng cáo."
      />

      <Section title="Thiết kế hệ mở" slide="slide 13">
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-lg border border-sv/40 bg-sv-soft/25 p-5">
            <h3 className="mb-3 font-semibold text-sv">Kiến trúc hệ sinh thái</h3>
            <ul className="space-y-2 text-sm">
              <li>Tránh hardcode cấu trúc SLP vào sâu trong lõi nền tảng.</li>
              <li>
                &ldquo;Bán phần cứng hạ tầng (như iPhone), không bán chết một loại giải pháp (như SIM
                thẻ)&rdquo;. Hệ thống phải generic.
              </li>
            </ul>
          </article>
          <article className="rounded-lg border border-peer/40 bg-peer-soft/40 p-5">
            <h3 className="mb-3 font-semibold text-peer">Phương pháp plugin</h3>
            <ul className="space-y-2 text-sm">
              <li>Mọi workflow — SLP hay DCM tương lai — phải là module switch-off được.</li>
              <li>
                Gỡ kiến trúc quản trị cũ và cắm cái mới mà không đập bỏ hạ tầng bên dưới.
              </li>
            </ul>
          </article>
        </div>
        <Callout tone="note" title="Ranh giới sống-chết của nguyên tắc này">
          <p>
            Ba cơ chế của SLP rò rỉ thành yêu cầu hạ tầng: blind lane cần cô lập config/session;
            semantic sensor cần một đường đọc xuyên mọi transcript; pushback cần điểm tiêm instruction
            cho từng agent.
          </p>
          <p>
            Dựng ba thứ đó ở dạng <strong>generic</strong> — session cô lập, event stream tap,
            instruction bundle per-agent — thì tuân thủ slide 13. Dựng thành &ldquo;SLP lane
            manager&rdquo;, &ldquo;SLP supervisor channel&rdquo; thì vi phạm ngay ở commit đầu tiên.
            Tài liệu không hề vẽ ranh giới này.
          </p>
          <p>
            Tương tự với ma trận slide 12: gán cỡ model theo vai là tri thức của plugin, không phải
            của lõi.
          </p>
        </Callout>
        <Callout tone="warn" title="Đa nguyên trang trí">
          <p>
            Lý do tồn tại của kiến trúc plugin là để <strong>đo A với B rồi tháo cái thua</strong>.
            Nhưng tài liệu không nêu một metric so sánh nào, không định nghĩa DCM — đối thủ duy nhất
            mà chính nó đặt tên — và tuyên bố người thắng trước khi cổng cắm tồn tại. Giữ hình thức
            lựa chọn, bỏ cơ chế lựa chọn.
          </p>
        </Callout>
      </Section>

      <Section title="Master Blueprint — một đêm vận hành" slide="slide 15">
        <div className="space-y-3">
          {TIMELINE.map((t) => (
            <article key={t.time} className={`rounded-lg border p-4 ${ROLE_RING[t.role]}`}>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-mono text-sm text-muted">{t.time}</span>
                <h3 className="font-semibold text-white">{t.title}</h3>
              </div>
              <p className="mt-2 text-sm">{t.body}</p>
            </article>
          ))}
        </div>
        <Quote cite="slide 15">
          Phá vỡ giới hạn. Cho phép vận hành đồng thời 5-7 project lớn (&gt;200.000 dòng code) mượt
          mà. Sự khởi đầu của Kỷ nguyên Tư duy Quản trị AI.
        </Quote>
        <Callout tone="claim" title="Đọc timeline này như một giai thoại, không như một đặc tả">
          <p>
            <ClaimBadge>Không có evidence</ClaimBadge> Không có đêm hỏng, không có tỉ lệ sự cố,
            không có định nghĩa &ldquo;mượt mà&rdquo;, không có chi phí. Một claim không sai được thì
            không thẩm định được tính khả thi — chỉ thẩm định được tính rỗng.
          </p>
        </Callout>
        <Callout tone="warn" title="Và mốc 06:00 là điểm yếu nhất, không phải điểm mạnh nhất">
          <p>
            Khoảnh khắc hero của cả bộ slide là một <strong>safety interlock</strong>, không phải một
            cơ chế năng suất. Nhưng kiến trúc slide 9 — quan sát viên thụ động, bất đồng bộ — không
            có năng lực chặn. Nếu ai đó triển khai đúng như tài liệu viết rồi chạy qua đêm trên repo
            thật với credential thật, lớp bảo vệ duy nhất đang là thiện chí của model.
          </p>
          <p className="font-semibold text-warn">
            Trước khi chạy không người trực: không credential production trong phiên đêm; interceptor
            tất định chặn trước thực thi; cô lập ghi cho mỗi tác nhân; gate acceptance máy kiểm được;
            và hard stop ngân sách. Thiếu một trong năm thứ đó thì đừng chạy qua đêm.
          </p>
        </Callout>
      </Section>
    </>
  );
}
