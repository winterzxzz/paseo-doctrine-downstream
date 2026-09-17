import { Callout, PageTitle, RoleBadge, Section, Table } from "@/components/ui";

export const metadata = { title: "Ma trận chẩn đoán — SLP Blueprint" };

export default function Page() {
  return (
    <>
      <PageTitle
        kicker="Slide 12"
        title="Ma trận chẩn đoán kỹ thuật"
        lead="Bảng gán cỡ model, tần suất và nhu cầu context cho từng vai. Đọc kèm ba chỗ nó lệch với phần còn lại của tài liệu."
      />

      <Section title="Bảng gốc" slide="slide 12">
        <Table
          head={["Vai trò", "Chức năng lõi", "Cỡ model đề xuất", "Tần suất", "Nhu cầu context"]}
          rows={[
            {
              key: "supervisor",
              cells: [
                <RoleBadge key="sv" role="supervisor">
                  Supervisor
                </RoleBadge>,
                "Attention & Triggering",
                "Large — cao cấp, lý luận sâu",
                "Event-triggered — khi có biến",
                "Rất lớn — giữ toàn cục",
              ],
            },
            {
              key: "lead",
              cells: [
                <RoleBadge key="ld" role="lead">
                  Lead
                </RoleBadge>,
                "Framing & Convergence",
                "Medium-Large — logic tốt",
                "Continuous — theo phân đoạn",
                "Trung bình — nén gọn, hand-off",
              ],
            },
            {
              key: "peer",
              cells: [
                <RoleBadge key="pr" role="peer">
                  Peer
                </RoleBadge>,
                "Execution & Pushback",
                "Variable — tùy biến theo task",
                "Continuous — cày cuốc liên tục",
                "Nhỏ — tập trung sâu vào task",
              ],
            },
          ]}
        />
      </Section>

      <Section title="Ba chỗ bảng này lệch">
        <Callout tone="warn" title="1. Context của Supervisor mâu thuẫn trực tiếp với slide 9">
          <p>
            Bảng ghi <em>&ldquo;Rất lớn — giữ toàn cục&rdquo;</em>. Slide 9 ghi Supervisor giám sát
            với <em>Clean Context</em>. Hai chế độ loại trừ nhau, và điều này quan trọng: giá trị của
            Supervisor ở slide 9 nằm chính ở chỗ nó <strong>không</strong> mang bias tích lũy.
          </p>
          <p>
            Cách gỡ: không giữ transcript thô. Giữ một khối state có cấu trúc, dung lượng cố định —
            quyết định đã chốt, invariant, cờ rủi ro. Mỗi lần nổ thì nạp state đó cộng cửa sổ liên
            quan, trong một context sạch.
          </p>
        </Callout>
        <Callout tone="warn" title="2. Bảng thiếu hẳn Semantic Sensor">
          <p>
            Slide 10 giới thiệu một thành phần thứ tư với profile hoàn toàn riêng: cực nhỏ, chạy
            liên tục, context tối thiểu. Bảng tự xưng là ma trận chẩn đoán của SLP nhưng không có
            dòng cho nó. Nếu bạn dựng hệ theo bảng này, bạn sẽ quên mất bộ phận rẻ nhất và chạy
            nhiều nhất.
          </p>
        </Callout>
        <Callout tone="warn" title="3. Gradient năng lực chạy ngược Pushback Protocol">
          <p>
            Peer là <em>Variable</em>, nằm dưới Lead <em>Medium-Large</em>. Nhưng slide 8 yêu cầu Peer
            bác bỏ kiến trúc của Lead, và slide 4 yêu cầu Peer tự rà soát sâu. Model yếu hơn được
            giao việc lật model mạnh hơn. Về mặt cấu trúc, phản biện thật sẽ hiếm và phản biện diễn
            sẽ nhiều.
          </p>
        </Callout>
        <Callout tone="note" title="Và một cột bị thiếu: chi phí">
          <p>
            Slide 10 biện minh cho semantic sensor bằng &ldquo;phình context, lãng phí token&rdquo;
            của heartbeat. Nhưng Supervisor <em>Large</em> với context <em>rất lớn</em> được gọi mỗi
            lần sensor bắn, nhân với số project, có thể đắt hơn heartbeat 15 phút có compact. Tài
            liệu không đưa con số nào ở cả hai phía.
          </p>
          <p className="font-semibold">
            Sensor giảm <em>tần suất</em> đánh thức, không giảm <em>kích thước</em> context của
            Supervisor. Muốn giảm chi phí thật thì phải nhắm vào kích thước.
          </p>
        </Callout>
      </Section>

      <Section title="Cách đọc bảng cho đúng">
        <p>
          Bảng này hữu ích như một <strong>gợi ý phân bổ</strong>: đừng đặt model đắt nhất vào chỗ
          chạy liên tục, đừng đặt model rẻ nhất vào chỗ phải phán quyết. Nhưng đừng đưa nó vào lõi hạ
          tầng — chính slide 13 cấm điều đó: một lõi generic không được biết khái niệm &ldquo;vai nào
          dùng model cỡ nào&rdquo;. Đó là tri thức của plugin.
        </p>
      </Section>
    </>
  );
}
