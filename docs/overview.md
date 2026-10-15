# Tổng quan dự án Paseo

Doc này là điểm vào cho người mới: Paseo làm gì, mỗi thành phần đảm nhận việc gì, ai dùng nó cho
việc gì, và các luồng chính chạy ra sao. Chi tiết của từng chủ đề nằm ở doc sở hữu chủ đề đó; doc
này chỉ nối chúng lại và link sang.

## Paseo là gì

Paseo cho bạn chạy, theo dõi và điều khiển coding agent (Claude Code, Codex, Cursor, Antigravity,
Factory Droid và custom provider dựa trên Codex) trên chính máy của bạn, từ desktop, điện thoại,
trình duyệt hoặc dòng lệnh. Code và credential ở lại trên máy bạn; Paseo không quản lý API key của
provider.

Repository này là bản downstream của upstream Paseo, gồm hai lớp:

| Lớp                  | Trả lời câu hỏi                                                             | Doc chính                                                                      |
| -------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Paseo Product**    | Agent chạy ở đâu, stream thế nào, client kết nối ra sao                     | [product.md](product.md), [architecture.md](architecture.md)                   |
| **Paseo Foundation** | Ai có quyền gì khi nhiều agent cùng làm một việc (Supervisor — Lead — Peer) | [foundation-doctrine.md](foundation-doctrine.md), [slp-usage.md](slp-usage.md) |

Thuật ngữ (Project, Workspace, Agent session, Host, …) theo [glossary.md](glossary.md).

## Bản đồ thành phần

```mermaid
flowchart LR
  subgraph Clients["Client"]
    direction TB
    APP["App (Expo)<br/>iOS · Android · Web"]
    DESK["Desktop (Electron)<br/>bọc App, tự quản daemon"]
    CLI["CLI<br/>paseo run / ls / logs"]
  end

  subgraph Remote["Từ xa (tùy chọn)"]
    direction TB
    RELAY["Relay<br/>mã hóa E2E"]
    HUB["Paseo Hub<br/>GitHub · Slack · Linear"]
  end

  DAEMON["Daemon<br/>packages/server<br/>lifecycle · WebSocket · tools"]

  subgraph Behind["Daemon quản lý"]
    direction TB
    PROV["Provider<br/>Claude · Codex · Cursor<br/>Antigravity · Droid"]
    BEADS["Beads Central sidecar<br/>127.0.0.1:6769"]
    HOME[("$PASEO_HOME<br/>agents · timelines · config")]
  end

  FOUND["foundation/dist<br/>role contract · skill"]

  APP -- "WebSocket trực tiếp" --> DAEMON
  APP -.-> RELAY
  DESK -- "subprocess + WebSocket" --> DAEMON
  CLI -- WebSocket --> DAEMON
  RELAY -. "daemon mở kết nối ra" .- DAEMON
  HUB -. "daemon mở kết nối ra" .- DAEMON
  FOUND -- "role binding lúc launch" --> DAEMON
  DAEMON --> PROV
  DAEMON -- "start / health / stop" --> BEADS
  DAEMON --> HOME
  PROV -. "gọi Paseo tools" .-> DAEMON
```

Daemon là trung tâm. Mọi client nói cùng một WebSocket protocol; provider chạy như process con của
daemon và gọi ngược lại daemon qua Paseo tool catalog để tạo agent, đọc room hoặc ghi Beads issue.

## Tác dụng của từng thành phần

### Packages trong monorepo

| Package                       | Tác dụng                                                                                                    | Ai dùng                         | Đọc thêm                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/server`             | Daemon: tạo/chạy/dừng/archive agent, stream timeline, terminal, git, schedule, room, council, Beads adapter | Mọi client, mọi agent           | [architecture.md](architecture.md#packagesserver--the-daemon)                           |
| `packages/protocol`           | Zod schema cho mọi WebSocket message và binary frame; hợp đồng chung giữa daemon và client                  | server, app, cli, client        | [protocol-compatibility.md](protocol-compatibility.md)                                  |
| `packages/client`             | Driver WebSocket cấp thấp và SDK `PaseoClient`/`PaseoApi`                                                   | app, cli, plugin, app bên ngoài | [architecture.md](architecture.md#packagesclient--daemon-client-library-and-sdk-facade) |
| `packages/app`                | Giao diện Expo cho iOS, Android, Web; desktop dùng lại UI này                                               | Human                           | [architecture.md](architecture.md#packagesapp--mobile--web-client-expo)                 |
| `packages/desktop`            | Electron: bọc App, spawn và quản daemon local, multi-window, in-app browser                                 | Human trên macOS/Linux/Windows  | [architecture.md](architecture.md#packagesdesktop--desktop-app-electron)                |
| `packages/cli`                | Lệnh kiểu Docker (`paseo run/ls/logs/wait`, `daemon`, `schedule`, `workspace`…)                             | Human, script, agent            | [development.md](development.md)                                                        |
| `packages/relay`              | Kênh mã hóa E2E (Curve25519 + NaCl box) để điện thoại tới daemon sau firewall                               | App khi ở xa                    | [SECURITY.md](../SECURITY.md)                                                           |
| `packages/plugin`             | SDK viết plugin: provider mới, usage source, panel, nút, theme                                              | Người viết plugin               | [plugins.md](plugins.md)                                                                |
| `packages/foundation-cli`     | `paseo-foundation`: cài, kiểm tra (`doctor`), rollback Foundation distribution trên máy                     | Operator                        | [foundation-product.md](foundation-product.md)                                          |
| `packages/highlight`          | Syntax highlighting cho file và diff hiển thị trong App                                                     | app                             | —                                                                                       |
| `packages/expo-two-way-audio` | Native module stream audio hai chiều cho voice mode                                                         | app                             | —                                                                                       |
| `packages/website`            | Trang marketing paseo.sh                                                                                    | Người dùng mới                  | —                                                                                       |

### Thư mục khác ở root

| Thư mục                 | Tác dụng                                                                                                                                | Đọc thêm                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `foundation/`           | Doctrine và role asset immutable, import từ một tag của repo Foundation; khóa bằng `manifest.json` + `sources.lock.json`. Không sửa tay | [foundation-product.md](foundation-product.md)                        |
| `skills/`               | Workflow skill bundle sẵn cho agent (`paseo`, `council`, `paseo-handoff`, …) và `role-admission.json`                                   | [skill-system.md](skill-system.md)                                    |
| `plugins/`              | Plugin first-party: Antigravity provider, các usage source (Claude, Codex, Cursor, Droid, …)                                            | [plugins.md](plugins.md)                                              |
| `plugin-examples/`      | Plugin mẫu để học cách viết plugin                                                                                                      | [plugins.md](plugins.md)                                              |
| `control-workspace/`    | Template thử nghiệm cho Control Workspace Home; mặc định không cài                                                                      | [foundation-product.md](foundation-product.md)                        |
| `public-docs/`          | Doc công khai cho người dùng cuối (web UI, CLI, Hub security)                                                                           | —                                                                     |
| `scripts/`              | Script dev/release, gồm `local-stack.sh` để build-install-restart stack local                                                           | [development.md](development.md)                                      |
| `WORKSPACE_PROTOCOL.md` | Luật riêng của repo cho agent role-bound: hotspot, routing, issue tracker, evidence                                                     | [foundation-doctrine.md](foundation-doctrine.md#ba-instruction-layer) |

### Ba vai trò của Foundation (SLP)

| Vai trò        | Việc chính                                                                                    | Không được làm                                         |
| -------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Human**      | Đặt mục tiêu, cấp lease, giữ các quyết định ngoài lease, chọn Supervisor                      | —                                                      |
| **Supervisor** | Làm rõ yêu cầu với Human, quan sát chất lượng điều phối, recovery khi Human cấp lease riêng   | Ra lệnh kỹ thuật cho Lead, viết code, accept thay Lead |
| **Lead**       | Sở hữu outcome của một project: chọn topology, giao việc cho Peer, tích hợp, ra verdict       | Tự implement rồi tự accept một thay đổi lớn            |
| **Peer**       | Làm một việc có biên giới rõ (scout, engineer, reviewer, architect) rồi handback kèm evidence | Điều phối agent khác, tự nới scope, close Beads issue  |

Runtime mode (full-access hay no-write) chỉ là khả năng kỹ thuật, không phải quyền. Quyền đến từ
assignment. Chi tiết ở [foundation-doctrine.md](foundation-doctrine.md) và
[native-role-binding.md](native-role-binding.md).

## Use case

```mermaid
flowchart LR
  H(["👤 Human"]) --> HU["Chạy agent cho một task<br/>Theo dõi agent từ điện thoại<br/>Duyệt permission request<br/>Xem diff, file, terminal, git<br/>Hẹn giờ agent: Schedule, Heartbeat<br/>Quản lý project, workspace, worktree<br/>Xem và tạo Beads issue trên WebUI<br/>Nhắn trong Room<br/>Mở rộng bằng plugin"]
  L(["🤖 Lead"]) --> LU["Giao việc cho Peer, nhận handback<br/>Tạo, cập nhật, close Beads issue<br/>Tạo Room, đọc và nhắn<br/>Mở Council cho quyết định lớn"]
  P(["🤖 Peer"]) --> PU["Làm một việc có biên giới<br/>Claim và cập nhật issue được giao<br/>Gửi báo cáo vào Room"]
  S(["🤖 Supervisor"]) --> SU["Làm rõ yêu cầu với Human<br/>Quan sát Lead, hỏi ở safe boundary<br/>Đọc Beads issue và Room"]
  X(["🔗 Hub"]) --> XU["Nhận event GitHub, Slack, Linear<br/>Tạo workspace và agent trên daemon"]
```

| Use case                       | Bạn làm gì                                                                                     | Bề mặt                      | Doc sở hữu                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------ |
| Chạy agent cho một task        | Chọn workspace, provider, model, mode; gõ prompt vào Composer                                  | App, CLI `paseo run`        | [agent-lifecycle.md](agent-lifecycle.md)   |
| Theo dõi từ điện thoại         | Bật pairing, quét QR, mở App ở bất kỳ đâu                                                      | App qua relay               | [SECURITY.md](../SECURITY.md)              |
| Duyệt permission request       | Agent xin chạy tool; bạn Allow/Deny                                                            | App, CLI `paseo permit`     | [permissions.md](permissions.md)           |
| Xem diff, file, terminal       | Mở Explorer sidebar, Changes, Terminal trong workspace                                         | App, Desktop                | [explorer-sidebar.md](explorer-sidebar.md) |
| Hẹn giờ agent                  | Schedule tạo agent mới theo cron; Heartbeat nhắc lại vào agent đang có                         | App, CLI, MCP               | [glossary.md](glossary.md)                 |
| Project / workspace / worktree | Thêm project, tạo workspace Local hoặc New worktree, archive                                   | App, CLI                    | [glossary.md](glossary.md)                 |
| Giao việc cho Peer             | Lead gọi `create_agent` với role `peer` và assignment có biên giới                             | Agent tool                  | [slp-usage.md](slp-usage.md)               |
| Theo dõi việc bằng Beads issue | Tạo, claim, cập nhật, close issue theo quyền của role                                          | WebUI Issues, agent tool    | [beads-central.md](beads-central.md)       |
| Trao đổi qua Room              | Human và Lead đọc, nhắn, mention `@agent` để đánh thức agent; Peer chỉ gửi; Supervisor chỉ đọc | WebUI Rooms, agent tool     | [rooms.md](rooms.md)                       |
| Council                        | Lead mở nhiều Peer độc lập viết báo cáo kín, rồi ra một verdict                                | Agent tool, skill `council` | [skill-system.md](skill-system.md)         |
| Kích hoạt từ tích hợp          | Hub nhận event GitHub/Slack/Linear, tạo workspace và agent trên daemon                         | Hub                         | [hub.md](hub.md)                           |
| Mở rộng bằng plugin            | Thêm provider, usage source, panel, nút                                                        | Plugin SDK                  | [plugins.md](plugins.md)                   |

## Workflow chính

Các sơ đồ dưới đây là bản rút gọn để bạn nắm luồng. Chi tiết đúng nằm ở doc được link dưới mỗi sơ đồ;
khi hai nơi lệch nhau, doc đó thắng.

### 1. Daemon khởi động

```mermaid
sequenceDiagram
  autonumber
  participant U as Human / Desktop / CLI
  participant SUP as Process supervisor của daemon
  participant W as Daemon worker
  participant B as Beads Central sidecar
  participant FS as $PASEO_HOME

  U->>SUP: paseo daemon start (hoặc Desktop tự spawn)
  SUP->>W: spawn worker
  W->>FS: đọc config.json, projects, agents
  W->>W: mở HTTP + WebSocket (mặc định 127.0.0.1:6767)
  W->>B: start sidecar trên 127.0.0.1:6769
  B-->>W: /health/ready
  Note over W,B: Sidecar lỗi thì daemon vẫn chạy,<br/>/api/health báo beads=degraded
  W-->>SUP: ready + endpoint
  SUP->>FS: ghi endpoint vào paseo.pid
```

Chỉ supervisor ghi endpoint vào `paseo.pid`; CLI tin record đó để tìm daemon. Xem
[architecture.md](architecture.md#storage) và [beads-central.md](beads-central.md#runtime-ownership).

### 2. Chạy một agent

```mermaid
sequenceDiagram
  autonumber
  participant C as Client (App / CLI)
  participant D as Daemon (Session)
  participant AM as AgentManager
  participant P as Provider
  participant S as Storage

  C->>D: hello (clientType, protocolVersion, capabilities)
  D-->>C: status.server_info (serverId, version, features)
  C->>D: create agent (cwd, provider, model, mode, prompt)
  D->>AM: create()
  AM->>P: khởi tạo provider session
  AM->>S: lưu agent record
  loop Mỗi turn
    P-->>AM: AgentStreamEvent
    AM->>S: append timeline row
    AM-->>C: agent_stream (broadcast tới mọi client đã subscribe)
  end
  P->>AM: xin quyền chạy tool
  AM-->>C: agent_permission_request
  C->>AM: Allow / Deny
  AM->>P: kết quả quyết định
  AM-->>C: agent_permission_resolved
```

Stream live chỉ để hiển thị nhanh; khi reconnect, client fetch timeline từ daemon làm nguồn đúng.
Xem [timeline-sync.md](timeline-sync.md).

### 3. Vòng đời agent

```mermaid
stateDiagram-v2
  [*] --> initializing
  initializing --> idle: provider session sẵn sàng
  idle --> running: nhận prompt
  running --> idle: xong turn
  initializing --> error
  idle --> error
  running --> error
  idle --> closed: archive / reload / shutdown
  error --> closed
  closed --> idle: mở lại hoặc gửi prompt (resume session)
```

`closed` không phải đã xóa: agent giữ identity, timeline và session để resume. Archive là thao tác
riêng, ẩn agent khỏi danh sách đang hoạt động. Xem [agent-lifecycle.md](agent-lifecycle.md).

### 4. Kết nối điện thoại qua relay

```mermaid
sequenceDiagram
  autonumber
  actor U as Bạn
  participant Ph as App trên điện thoại
  participant R as Relay
  participant D as Daemon

  U->>D: bật pairing (relay mặc định tắt tới khi bạn đồng ý)
  D->>R: mở kết nối outbound
  D-->>U: hiện QR / link pairing chứa public key của daemon
  U->>Ph: quét QR bằng camera (ngoài mạng, không qua relay)
  Ph->>R: kết nối
  Ph->>D: bắt tay Curve25519 qua relay
  Note over Ph,D: Mọi payload mã hóa bằng NaCl box.<br/>Relay chỉ chuyển byte, không đọc được
  Ph->>D: WebSocket protocol như kết nối trực tiếp
```

QR là nguồn tin cậy duy nhất cho public key, nên đừng chia sẻ nó công khai. Không cần mở port hay cấu hình VPN. Nếu bạn tự host, kết nối trực tiếp, SSH hoặc VPN vẫn dùng được.
Xem [SECURITY.md](../SECURITY.md).

### 5. Điều phối nhiều agent theo SLP

```mermaid
sequenceDiagram
  autonumber
  actor H as Human
  participant L as Lead
  participant BC as Beads Central
  participant E as Peer Engineer
  participant RV as Peer Reviewer

  H->>L: Objective + lease (scope ghi, external effect, evidence, stop)
  L->>L: đọc WORKSPACE_PROTOCOL.md
  L->>BC: beads_status (checkpoint bắt buộc)
  L->>BC: beads_create issue
  alt Việc nhỏ, rủi ro thấp
    L->>L: tự làm trong lease
  else Việc cần judgment riêng
    L->>E: create_agent(role=peer, assignment, beadsIssueIds)
    E->>BC: beads_claim + update
    E-->>L: handback: diff + evidence
  end
  L->>RV: create_agent(role=peer, reviewer, no-write)
  RV-->>L: findings kèm evidence
  L->>L: ra verdict dựa trên evidence
  L->>BC: update evidence, beads_close
  L-->>H: kết quả, unknown, rủi ro còn lại, trạng thái lease
```

Luật cốt lõi: mỗi scope đang thay đổi có đúng một writer; reviewer không có quyền ghi; status
`completed` hay test pass là tín hiệu, không phải acceptance. Chọn topology nhỏ nhất đủ an toàn theo
bảng trong [slp-usage.md](slp-usage.md#chọn-topology).

```mermaid
flowchart LR
  Q{"Việc thuộc loại nào?"}
  Q -->|"Nhỏ, rủi ro thấp"| T1["Human → Lead"]
  Q -->|"Cần judgment khi implement"| T2["Human → Lead → 1 Peer Owner"]
  Q -->|"Kết quả cần kiểm chứng độc lập"| T3["… → Owner → Peer Reviewer mới"]
  Q -->|"Nhạy cảm về kiến trúc"| T4["Lead → Architect, rồi Owner"]
  Q -->|"Nhiều project cần quan sát"| T5["Human → Supervisor quan sát các Lead"]
  Q -->|"Lead mất continuity"| T6["Human cấp recovery lease cho Supervisor"]
```

### 6. Vòng đời Beads issue

```mermaid
stateDiagram-v2
  [*] --> open: Lead beads_create
  open --> in_progress: Peer beads_claim (issue đã được grant)
  in_progress --> in_progress: beads_update (evidence)
  in_progress --> blocked: gặp blocker
  blocked --> in_progress
  in_progress --> closed: Lead beads_close sau verdict
  open --> closed: Lead tự làm và ra verdict
```

Mọi mutation cần `idempotencyKey`; Peer không close; Supervisor chỉ đọc. Xem
[beads-central.md](beads-central.md#authentication-và-authority).

### 7. Vòng phát triển trong repo này

```mermaid
flowchart TD
  A["Sửa code"] --> B["Test đúng file đã đổi<br/>npx vitest run file --bail=1"]
  B --> C["npm run typecheck<br/>npm run lint<br/>npm run format"]
  C --> D{"Đổi daemon/runtime?"}
  D -->|Không| Z["Xong"]
  D -->|Có| E["Bump version<br/>npm run version:sync-internal"]
  E --> F{"Không agent nào<br/>đang chạy?"}
  F -->|Chưa chắc / có| BL["BLOCKED: báo lại,<br/>không restart"]
  F -->|Đúng| G["./scripts/local-stack.sh --apply"]
  G --> H["./scripts/local-stack.sh<br/>exit 0 = daemon chạy đúng tree"]
  H --> I["Canary live cho hành vi đã đổi"]
```

Không chạy full test suite trên máy. Không sửa tay `foundation/dist`. Chi tiết ở
[development.md](development.md), [testing.md](testing.md) và mục Local completion gate trong
[CLAUDE.md](../CLAUDE.md#local-completion-gate).

## Đọc tiếp

| Bạn muốn                                 | Đọc                                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Hiểu kiến trúc sâu hơn                   | [architecture.md](architecture.md), [data-model.md](data-model.md)                                 |
| Thêm provider                            | [providers.md](providers.md), [custom-providers.md](custom-providers.md)                           |
| Sửa protocol mà không làm hỏng client cũ | [protocol-compatibility.md](protocol-compatibility.md)                                             |
| Làm UI trong App                         | [design.md](design.md), [platform-gating.md](platform-gating.md), [expo-router.md](expo-router.md) |
| Chạy Foundation lần đầu                  | [foundation-first-run.md](foundation-first-run.md)                                                 |
| Mọi doc khác                             | [README.md](README.md)                                                                             |
