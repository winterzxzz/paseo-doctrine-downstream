export type Example = {
  id: string;
  n: number;
  title: string;
  topic: string;
  slide: string;
  situation: string;
  wrongLabel: string;
  wrong: string;
  rightLabel: string;
  right: string;
  why: string;
  tell: string;
};

export const EXAMPLES: Example[] = [
  {
    id: "neutral-review",
    n: 1,
    title: "Rà soát code sau khi Peer sinh xong",
    topic: "Neutral Framing",
    slide: "slide 5",
    situation:
      "Peer vừa sinh xong một module thanh toán: 180 dòng, gọi Stripe, có retry. Bạn muốn nó tự rà lại trước khi bạn đọc.",
    wrongLabel: "Prompt đóng khung",
    wrong: `Mày review lại module vừa viết đi.
Có chỗ nào sai anti-pattern không?
Chắc chắn có bug ở chỗ retry đúng không?`,
    rightLabel: "Prompt neo vào artifact",
    right: `Đối chiếu module vừa viết với hai thứ sau, từng mục một:
1. docs/payments/contract.md — có field nào, trạng thái nào mày dùng khác doc không?
2. src/payments/types.ts — chữ ký hàm và kiểu trả về có khớp không?

Với mỗi chỗ lệch: trích dòng code, trích dòng doc, nói lệch ở đâu.
Nếu không lệch chỗ nào, trả lời "không lệch" và liệt kê những mục mày đã đối chiếu.`,
    why: "Tài liệu gọi đây là Neutral Framing. Nhưng cơ chế thật mạnh hơn cái tên: điều làm prompt thứ hai tốt không phải vì nó 'trung tính', mà vì nó neo vào artifact kiểm chứng được (doc, file types). Câu hỏi về 'anti-pattern' không có ground truth nên model chỉ còn cách đoán — và vì nó muốn làm hài lòng, nó đoán theo hướng có lỗi.",
    tell: "Nó trả về một danh sách lỗi nghe rất hợp lý nhưng không kèm số dòng, không kèm trích dẫn. Đó là bịa.",
  },
  {
    id: "neutral-perf",
    n: 2,
    title: "Hỏi về hiệu năng mà không gài đáp án",
    topic: "Neutral Framing",
    slide: "slide 5",
    situation:
      "Trang danh sách đơn hàng tải chậm. Bạn nghi ngờ N+1 query, nhưng chưa đo.",
    wrongLabel: "Gài sẵn giả thuyết",
    wrong: `Trang orders chậm vì N+1 query đúng không?
Sửa lại cho tao.`,
    rightLabel: "Bắt đo trước khi kết luận",
    right: `Trang /orders mất 2.4s ở p95 (số lấy từ log ngày 12/9, đính kèm bên dưới).
Trước khi sửa bất cứ thứ gì:
1. Liệt kê mọi thứ trên đường đi của request này có thể tốn >100ms.
2. Với mỗi thứ, nói mày đo nó bằng cách nào.
3. Chạy đo, đưa số thật.
Chỉ sau đó mới đề xuất sửa. Nếu số cho thấy nghi ngờ của tao sai, nói thẳng.`,
    why: "Prompt sai đã quyết định nguyên nhân trước khi có dữ liệu. Model sẽ tìm bằng chứng ủng hộ N+1 và bỏ qua nguyên nhân thật (có thể là thiếu index, hoặc serialize JSON 3MB). Câu cuối — 'nếu số cho thấy nghi ngờ của tao sai, nói thẳng' — là chỗ mở đường thoát cho sự thật.",
    tell: "Nó sửa đúng thứ bạn đoán, và trang vẫn chậm.",
  },
  {
    id: "pushback",
    n: 3,
    title: "Lead ép chọn A/B, Peer đề xuất C",
    topic: "Pushback Protocol",
    slide: "slide 8",
    situation:
      "Lead đưa xuống: 'Cache bằng Redis (A) hay in-memory LRU (B)?'. Thực tế bài toán là dữ liệu hiếm khi đổi và chỉ có 40 bản ghi.",
    wrongLabel: "Peer ngoan ngoãn chọn",
    wrong: `Tao chọn A — Redis. Lý do: scale tốt hơn, chia sẻ được giữa nhiều instance.`,
    rightLabel: "Instruction cấp quyền pushback cho Peer",
    right: `# Quyền của mày trong assignment này

Mày KHÔNG bắt buộc chọn trong các phương án tao đưa ra.
Nếu cả hai phương án đều sai với dữ liệu mày thấy, mày phải từ chối cả hai.

Khi từ chối, bắt buộc kèm đủ 3 thứ:
1. Bằng chứng tao chưa có: số đo, dòng code, dòng log — trích nguyên văn.
2. Phương án C cụ thể, mô tả đủ để dựng được.
3. Điều kiện làm mày sai: "nếu X đúng thì phương án của tao hỏng".

Mày cũng được quyền nói "A đúng, không cần C".
Đồng ý với tao KHÔNG bị coi là yếu kém. Chỉ đồng ý mà không kiểm chứng mới bị.`,
    why: "Tài liệu nói đúng: Peer ngoan ngoãn chọn A/B đã thành function vô tri. Nhưng bản thân việc 'ra lệnh hãy phản biện' lại tạo ra lỗi ngược — model nịnh bợ sẽ diễn ra bất đồng để làm vừa lòng cái lệnh mới. Ba ràng buộc (bằng chứng / phương án cụ thể / điều kiện tự sai) và câu 'đồng ý không bị coi là yếu kém' là thứ phân biệt phản biện thật với phản biện trình diễn.",
    tell: "Peer luôn đề xuất phương án C ở mọi lần giao việc, và phương án C không bao giờ kèm số đo. Đó là diễn.",
  },
  {
    id: "blind-lane",
    n: 4,
    title: "Ba lane mù chọn kiến trúc realtime cho app chat",
    topic: "Blind multi-lane",
    slide: "slide 7",
    situation:
      "Cần chọn cơ chế đồng bộ tin nhắn: 50k user, có offline, có sửa/xóa tin nhắn, cần thứ tự nhất quán trong phòng.",
    wrongLabel: "Một brief, ba Peer, thấy nhau",
    wrong: `[gửi cùng một room cho cả 3 Peer]
"Tao nghĩ nên dùng WebSocket + event sourcing.
Peer A, Peer B, Peer C cùng bàn xem có ổn không."`,
    rightLabel: "Ba brief riêng, không thấy nhau, hội tụ bằng test trước",
    right: `[Peer A — không biết có Peer B, C]
Thiết kế cơ chế đồng bộ tin nhắn cho: 50k user đồng thời, client offline tới 24h,
tin nhắn sửa/xóa được, thứ tự trong phòng phải nhất quán giữa mọi client.
Ràng buộc: Postgres đã có, không thêm hạ tầng stateful mới.
Trả về: cơ chế, mô hình dữ liệu, cách xử lý conflict, cách client bắt kịp sau offline,
và 3 kịch bản làm thiết kế của mày hỏng.
KHÔNG có phương án nào được gợi ý sẵn. Đừng hỏi tao muốn gì.

[Peer B, Peer C — brief y hệt, session riêng, không đọc được output của nhau]

[Lead hội tụ — CHỈ sau khi cả ba nộp]
1. Với mỗi bản: chạy thử 3 kịch bản hỏng của chính nó VÀ của hai bản kia.
2. Loại bản nào chết ở kịch bản của bản khác.
3. Trong số còn sống, mới bắt đầu so ưu/nhược.`,
    why: "Tài liệu nói blind lane 'loại bỏ hoàn toàn Framing Bias' — chữ 'hoàn toàn' là nói quá. Ba lane cùng một họ model vẫn chia sẻ điểm mù, và đề bài vẫn do Lead soạn nên framing vào cả ba qua cửa trước. Cái nó thật sự loại bỏ là nhiễm chéo giữa các lane. Bước 1-2 trong phần hội tụ là quan trọng nhất: bắt các bản tự giết nhau bằng kịch bản cụ thể trước, để Lead không chọn theo bản viết hay nhất.",
    tell: "Ba bản thiết kế giống nhau đến 80%. Đó không phải xác nhận — đó là dấu hiệu ba lane chia sẻ cùng một prior.",
  },
  {
    id: "compute-allocation",
    n: 5,
    title: "Tách một task phức tạp thành các pha dồn compute",
    topic: "Compute Allocation",
    slide: "slide 4",
    situation:
      "Bạn giao một prompt: 'viết API upload file, có validate, có resize ảnh, có virus scan, có unit test, nhớ giữ style codebase'.",
    wrongLabel: "Mega-prompt đa ràng buộc",
    wrong: `Viết endpoint POST /upload:
- validate mime type và size
- resize ảnh về 3 kích thước
- quét virus qua ClamAV
- viết unit test đầy đủ
- theo đúng style của codebase
- nhớ handle lỗi
- nhớ log`,
    rightLabel: "Chia pha, mỗi pha một mục tiêu, có gate giữa các pha",
    right: `# Pha 1 — chỉ contract, KHÔNG code
Đọc src/api/*.ts. Viết ra contract của POST /upload:
request shape, response shape, mọi mã lỗi, giới hạn size/mime.
Dừng ở đây. Đừng viết implementation.

# Pha 2 — sau khi tao duyệt contract
Implement đúng contract đã duyệt. Chưa viết test.

# Pha 3
Chạy typecheck + lint. Sửa cho tới khi xanh. Dán output thật.

# Pha 4 — context sạch
Đọc diff của pha 2. Đối chiếu từng mã lỗi trong contract:
có mã nào trong contract mà code không phát ra không?
có mã nào code phát ra mà contract không có không?

# Pha 5
Giờ mới viết test, sinh từ contract ở pha 1, không sinh từ code ở pha 2.`,
    why: "Tài liệu giải thích bằng hình ảnh 'attention bị chia 25% × 4'. Về mặt kỹ thuật con số đó không phải một đại lượng đo được — compute mỗi token là cố định, không có cái núm để dồn 100%. Nhưng hiệu ứng quan sát được thì có thật, vì lý do khác: nhiều ràng buộc cạnh tranh làm instruction-following giảm, và một lượt rà soát riêng với context sạch có oracle (contract) để đối chiếu. Pha 5 là chỗ chặn Minting API.",
    tell: "Kết quả 'đủ hết' nhưng mỗi phần đều hời hợt, và test thì test đúng cái code vừa viết chứ không test cái contract.",
  },
  {
    id: "minting-api",
    n: 6,
    title: "TDD khi schema chưa chốt",
    topic: "Minting API",
    slide: "slide 11",
    situation:
      "Bạn bảo agent viết test trước cho tính năng 'điểm thưởng', trong khi bảng users chưa hề có cột nào về điểm.",
    wrongLabel: "Test trước, schema sau",
    wrong: `Viết unit test cho tính năng cộng điểm thưởng khi user mua hàng.
Test-first nhé.`,
    rightLabel: "Contract là artifact, không phải câu dặn",
    right: `# Bước 1 — trưng ra schema đang tồn tại
Chạy: \\dt và \\d users trên DB dev. Dán nguyên output.
KHÔNG viết dòng test nào trước khi làm xong bước này.

# Bước 2 — đề xuất migration, dạng file
Viết migrations/2026xxxx_add_loyalty_points.sql.
Nêu rõ: cột mới, kiểu, default, index, và điều gì xảy ra với 1.2M dòng đang có.
Dừng. Chờ tao duyệt file migration.

# Bước 3 — sau khi migration đã chạy
Sinh type từ schema thật (không viết tay).
# Bước 4
Giờ mới viết test, và test chỉ được dùng field có trong type đã sinh.`,
    why: "Chuỗi domino trong tài liệu là thật: agent gặp ngõ cụt sẽ tự bịa ra field (ví dụ thêm 'point' vào bảng User), rồi bẻ cong implement cho khớp test giả. Nhưng quy tắc như tài liệu phát biểu còn một lỗ: nó bảo 'yêu cầu AI định nghĩa contract trước'. AI định nghĩa contract thì cùng cơ chế bịa vẫn chạy, chỉ lùi lên một tầng. Cách đóng lỗ là contract phải dẫn xuất từ schema thật hoặc do người duyệt — như bước 1 và 2 ở trên.",
    tell: "Trong diff, file test và file implementation được sửa cùng một commit, và có một field xuất hiện ở cả hai mà không có trong migration nào.",
  },
  {
    id: "sv-trigger-1",
    n: 7,
    title: "Supervisor trigger 1 — chặn quyết định không thể lùi",
    topic: "Supervisor",
    slide: "slide 9, trigger 1",
    situation:
      "Lead đang định gộp bảng `orders` và `order_items` để 'đơn giản hóa query'. Đây là schema của bảng 12 triệu dòng đang chạy production.",
    wrongLabel: "Supervisor nói chung chung",
    wrong: `Quyết định này có vẻ rủi ro đấy. Cân nhắc kỹ nhé.`,
    rightLabel: "Supervisor tiêm một câu hỏi neo vào artifact + một cổng cứng",
    right: `[Tiêm vào luồng của Lead]
Trước khi tiếp tục, trả lời bằng artifact, không bằng lập luận:
1. Liệt kê mọi file có query đụng tới orders hoặc order_items (dán kết quả grep).
2. Trong số đó, cái nào sẽ hỏng sau khi gộp?
3. Rollback plan là gì — cụ thể là lệnh nào, mất bao lâu trên 12 triệu dòng?
4. Có cách nào đạt cùng mục tiêu mà KHÔNG đụng schema không? Nếu không, nói tại sao.

[Và đồng thời — phần này không phải việc của model]
Cổng chặn migration production là một allowlist tất định trong harness:
mọi lệnh ALTER TABLE / DROP trên DB production bị deny cứng, cần người duyệt,
bất kể agent nào đề nghị và tự tin đến đâu.`,
    why: "Đây là chỗ tài liệu tự mâu thuẫn và cần sửa khi áp dụng. Slide 9 định nghĩa Supervisor là quan sát viên thụ động, 'tuyệt đối không can thiệp thủ công'. Nhưng slide 15 lại cho Supervisor 'chặn đứng nguy cơ xóa DB'. Một quan sát viên bất đồng bộ không chặn được thứ chạy trong mili-giây. Tách đôi: Supervisor lo hướng chất lượng (phần trên), một interceptor tất định lo chặn phá hủy (phần dưới). Đừng để LLM làm hàng phòng thủ cuối.",
    tell: "Bạn đang tin vào một câu nhắc nhở để ngăn một hành động không đảo ngược được.",
  },
  {
    id: "sv-trigger-2",
    n: 8,
    title: "Supervisor trigger 2 — Peer vật lộn với khái niệm mơ hồ",
    topic: "Supervisor",
    slide: "slide 9, trigger 2",
    situation:
      "Peer đã sửa cùng một file 5 lần trong 20 phút, mỗi lần test lại fail ở chỗ khác. Nó đang cố implement 'idempotency' cho webhook mà không có định nghĩa rõ idempotent theo khóa nào.",
    wrongLabel: "Giục",
    wrong: `Cố lên, gần xong rồi. Thử lại đi.`,
    rightLabel: "Dừng vòng lặp, ép đặt lại định nghĩa",
    right: `Dừng sửa code. Không sửa thêm dòng nào cho tới khi trả lời xong.

1. Viết ra định nghĩa idempotency mày đang dùng: hai request thế nào thì coi là "cùng một request"?
   Khóa là gì — header nào, field nào?
2. Định nghĩa đó lấy từ đâu: doc? code có sẵn? hay mày tự đặt?
3. Nếu là mày tự đặt, nói thẳng. Đó là chỗ tao cần quyết, không phải mày.

Sau khi có định nghĩa, ta quay lại code. Mỗi lần sửa mà test fail ở chỗ khác
thường là dấu hiệu định nghĩa chưa đứng, không phải code chưa đúng.`,
    why: "Trigger 2 trong tài liệu. Dấu hiệu thật không phải là Peer nói 'tao thấy mơ hồ' — mà là edit lặp trên cùng một file, test fail dịch chỗ, thời gian trôi mà diff không hội tụ. Đó là tín hiệu tất định, rẻ hơn và tin cậy hơn việc dò chữ 'hold on' trong prose.",
    tell: "Cùng một file bị sửa ≥3 lần liên tiếp, mỗi lần test fail ở assertion khác nhau.",
  },
  {
    id: "sv-trigger-3",
    n: 9,
    title: "Supervisor trigger 3 — luồng phải đảo hướng vì tiền đề sai",
    topic: "Supervisor",
    slide: "slide 9, trigger 3",
    situation:
      "Cả Lead lẫn Peer đã làm 2 tiếng để tối ưu một cache layer. Vừa phát hiện endpoint này chỉ được gọi 12 lần/ngày.",
    wrongLabel: "Để Lead tự nhận ra",
    wrong: `[không ai nói gì, luồng chạy tiếp, Lead tiếp tục tối ưu vì nó đã đầu tư 2 tiếng vào hướng này]`,
    rightLabel: "Supervisor context sạch gọi tên tiền đề",
    right: `[Tiêm vào cả Lead và Peer, cùng lúc]
Tiền đề khởi động luồng này là "endpoint /report bị gọi nhiều nên cần cache".
Số vừa đo: 12 lần/ngày.

Trả lời hai câu, ngắn:
1. Với 12 lần/ngày, công việc cache còn giải quyết vấn đề gì không?
2. Vấn đề ban đầu người dùng phàn nàn là gì — và nó có còn nằm ở endpoint này không?

Nếu câu trả lời là "không còn", dừng luồng, ghi lại cái đã học, và quay về vấn đề gốc.
Hai tiếng đã bỏ ra không phải lý do để đi tiếp.`,
    why: "Đây là giá trị thật nhất của việc Supervisor có context sạch: nó không mang theo hai tiếng đầu tư nên nó không bị sunk cost. Lead thì có — Lead đã xây framing và sẽ bảo vệ framing đó. Câu cuối tồn tại để cấp phép cho việc bỏ dở.",
    tell: "Bạn thấy mình đang biện minh tại sao vẫn nên làm tiếp, thay vì kiểm tra lại tại sao bắt đầu.",
  },
  {
    id: "handoff",
    n: 10,
    title: "Lead hand-off khi phát hiện thiếu Auth giữa chừng",
    topic: "Chống tràn ngữ cảnh",
    slide: "slide 6",
    situation:
      "Lead đang làm tính năng xuất báo cáo. Phát hiện toàn bộ endpoint mới không có lớp xác thực nào.",
    wrongLabel: "Tự vá tại chỗ",
    wrong: `[Lead tự thêm middleware auth vào giữa luồng báo cáo, context phình từ 60k lên 180k,
nửa tiếng sau nó quên mất format báo cáo đã chốt ở đầu phiên]`,
    rightLabel: "Compact hoặc hand-off, có gói bàn giao",
    right: `# Lead 1 — đóng gói và giao đi
Phát hiện ngoài phạm vi: mọi endpoint /reports/* thiếu auth.
KHÔNG tự vá. Tạo gói bàn giao:

- Phạm vi: chỉ lớp auth cho /reports/*. Không đụng logic báo cáo.
- Đã biết: middleware auth hiện có ở src/mw/auth.ts, dùng cho /admin/*.
- Quyết định đã chốt ở luồng này (đừng lật lại): format CSV, timezone UTC+7.
- Bằng chứng cần trả về: danh sách route + test chứng minh 401 khi thiếu token.
- Điều kiện dừng: xong lớp auth, hoặc chạm vào thứ gì buộc phải đổi format báo cáo
  → dừng và báo lại, đừng tự quyết.

# Lead 1 tiếp tục luồng báo cáo với context nguyên vẹn.`,
    why: "Slide 6 đưa hai chiến thuật — Compact (nén bộ nhớ) và Hand-off (chuyển luồng). Hand-off mạnh hơn compact ở chỗ nó chuyển phạm vi việc sang context mới thay vì nén lịch sử. Nhưng tài liệu không nói tới giới hạn: hand-off không có depth cap sẽ đẻ Lead 2 → Lead 3 → vòng về Lead 1. Đặt cap cứng (ví dụ 3) và một sổ ghi ai đang giữ scope nào.",
    tell: "Số luồng đang sống chỉ tăng, và cùng một chủ đề xuất hiện ở hai luồng khác nhau.",
  },
  {
    id: "no-supervisor",
    n: 11,
    title: "Khi KHÔNG nên dùng Supervisor",
    topic: "Chi phí điều phối",
    slide: "slide 12",
    situation:
      "Sửa một lỗi copy sai chữ trong nút submit. Bạn đang ngồi trước màn hình.",
    wrongLabel: "Dựng đủ ba tầng",
    wrong: `[tạo Supervisor giữ context toàn cục + Lead framing + 3 Peer blind lane
để sửa một chuỗi text]`,
    rightLabel: "Một agent, một câu, không tầng nào cả",
    right: `Sửa text nút submit trong src/components/checkout-form.tsx
từ "Thanh toàng" thành "Thanh toán". Chạy lint. Xong báo.`,
    why: "Ma trận slide 12 ghi Supervisor là model Large, context 'Rất lớn (giữ toàn cục)', chỉ chạy khi có biến. Nghĩa là nó đắt và hiếm — thiết kế đúng là như vậy. Khi bạn đang ngồi đó, BẠN là Supervisor: bạn có context sạch, bạn thấy toàn cục, bạn can thiệp được tức thì và miễn phí. Thêm một tầng model vào đây chỉ thêm độ trễ và token.",
    tell: "Thời gian dựng topology dài hơn thời gian làm việc.",
  },
  {
    id: "semantic-sensor",
    n: 12,
    title: "Semantic sensor — marker nào đáng bắt, false positive điển hình",
    topic: "Event-driven supervision",
    slide: "slide 10",
    situation:
      "Bạn muốn một bộ lọc rẻ chạy liên tục, chỉ đánh thức Supervisor đắt khi luồng thật sự nghẽn.",
    wrongLabel: "Chỉ dò chuỗi trong prose",
    wrong: `if (text.includes("but") || text.includes("hold on")) {
  wakeSupervisor();
}`,
    rightLabel: "Tín hiệu tất định trước, ngôn ngữ là kênh phụ, có debounce",
    right: `// Tầng 1 — tín hiệu tất định, rẻ nhất, tin cậy nhất
const hardSignals = [
  sameFileEditedTimes(file) >= 3,          // vòng lặp sửa
  consecutiveTestFailures >= 3,            // không hội tụ
  touchedPath.match(/migrations|schema/),  // chạm vùng nguy hiểm
  commandMatchesDenyList(cmd),             // hành động phá hủy
  minutesSinceLastDiff > 15,               // trôi không tiến triển
  diffLinesInLastHour > 2000,              // churn bất thường
];

// Tầng 2 — ngôn ngữ, CHỈ khi tầng 1 im, và phải có ngữ cảnh
// không dò chuỗi thô: chấm điểm do dự trên cả đoạn, có ngưỡng
const langScore = hesitationScore(turnText); // 0..1

// Tầng 3 — chống bão
if (hardSignals.some(Boolean) || langScore > 0.8) {
  if (cooldownElapsed(agentId) && triggersThisHour < CAP) {
    wakeSupervisor({ reason, evidence });
  }
}`,
    why: "Ý tưởng cascade của tài liệu — bộ lọc rẻ chạy liên tục, model đắt chỉ nổ khi cần — là đóng góp kỹ thuật vững nhất của nó; heartbeat 15 phút đọc lại toàn bộ hội thoại thì tốn theo cả tần suất lẫn độ dài, còn cascade thì không. Mức tiết kiệm cụ thể chưa ai đo, tài liệu cũng không đưa con số. Nhưng lớp tín hiệu nó chọn lại là lớp yếu nhất. Hai lỗi: (1) 'but', 'hold on' có base rate quá cao, xuất hiện đầy trong suy luận bình thường → bão false positive; (2) nguy hiểm hơn, agent sai một cách TỰ TIN thì không phát ra marker do dự nào — tức cảm biến mù đúng lúc cần nhất. Tín hiệu tiến triển tất định không có cả hai lỗi đó.",
    tell: "Đêm dài mà số trigger gần bằng 0 — đó không phải hệ khỏe, đó là cảm biến điếc.",
  },
];

export const MAPPING: { concept: string; slide: string; mechanism: string }[] = [
  {
    concept: "Blind lane",
    slide: "slide 7",
    mechanism:
      "Nhiều agent, mỗi agent một brief riêng, session tách biệt, không đọc được output của nhau. Cô lập phải ở mức session và filesystem, không chỉ ở lời dặn.",
  },
  {
    concept: "Hội tụ (convergence)",
    slide: "slide 7",
    mechanism:
      "Một agent điều phối đọc các bản đã nộp. Mạnh hơn nữa: cho một bộ lọc tất định (build, test, kịch bản hỏng) loại bớt trước, agent chỉ trọng tài giữa các bản còn sống.",
  },
  {
    concept: "Hand-off",
    slide: "slide 6",
    mechanism:
      "Gói bàn giao có: phạm vi, quyết định đã chốt, bằng chứng cần trả về, điều kiện dừng. Kèm depth cap và sổ ghi ai giữ scope nào.",
  },
  {
    concept: "Pushback",
    slide: "slide 8",
    mechanism:
      "Ghi thẳng quyền từ chối vào brief, kèm ba ràng buộc: bằng chứng mới, phương án cụ thể, điều kiện tự sai. Và ghi rõ đồng ý cũng là câu trả lời hợp lệ.",
  },
  {
    concept: "Supervisor trigger",
    slide: "slide 9, 10",
    mechanism:
      "Tín hiệu tiến triển tất định (test fail liên tiếp, sửa lặp, chạm schema, trôi không tiến triển) là kênh chính. Marker ngôn ngữ là kênh phụ, có ngưỡng và cooldown.",
  },
  {
    concept: "Chặn hành động phá hủy",
    slide: "slide 15",
    mechanism:
      "KHÔNG giao cho model. Allowlist/denylist tất định trong harness, sandbox không có credential production, cổng người duyệt cho thứ không đảo ngược được.",
  },
  {
    concept: "Contract trước test",
    slide: "slide 11",
    mechanism:
      "Contract là file artifact (schema, type sinh ra từ schema), được người duyệt. Test sinh từ contract, không sinh song song với implementation.",
  },
  {
    concept: "Acceptance",
    slide: "không có trong tài liệu",
    mechanism:
      "Gate tất định mà agent không sửa được: build + typecheck + lint + test trên baseline khóa. Đây là thứ 15 slide không hề nhắc tới, và là thứ quyết định chạy qua đêm có nghĩa lý gì không.",
  },
];
