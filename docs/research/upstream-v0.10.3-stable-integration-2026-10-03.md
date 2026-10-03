# Tích hợp upstream Paseo v0.10.3 stable

## Kết luận

- Quyết định: `MERGE WITH ADAPTATION` exact annotated tag `v0.10.3`, peeled commit
  `b4af508e2a9e5a34a8b0ffb8dfaff6fd679da6c7`. Boundary gồm 62 upstream commit từ `v0.9.2`, qua bốn
  stable `v0.10.0`, `v0.10.1`, `v0.10.2`, `v0.10.3`.
- Baseline downstream là `0.9.2-paseo.60`, commit `b4ad1c042` (289 commit downstream kể từ `v0.9.2`).
  Merge commit `0f1647d4d` có đúng hai parent là baseline đó và upstream `v0.10.3`.
- Version activation là `0.10.3-paseo.61` tại release commit riêng `f455eded3`.
- License upstream vẫn Apache-2.0; downstream giữ AGPL-3.0.

Quy trình và resolution rules dùng lại cho lần sau nằm ở
[upstream-integration.md](../upstream-integration.md); các rule mới của lần này đã vào đó.

## Upstream delta

| Surface                            | Quyết định              | Nội dung nhận                                                                                                                                                                                                  |
| ---------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daemon password, relay (#5393)     | `MERGE`                 | Password đi trong `hello.auth`; CLI/desktop cùng máy dùng `local-credential` (0600) trong `PASEO_HOME`; relay không credential vẫn là owner qua `COMPAT(relayPasswordOptional)`. Hub giữ admission tường minh. |
| Pairing confirmation (#5753)       | `MERGE`                 | Hỏi lại trước khi pairing link nối host mới hoặc host đổi key/relay.                                                                                                                                           |
| Settings pages (#5459)             | `MERGE WITH ADAPTATION` | Lấy cấu trúc upstream; `ProjectSettingsScreen` mang lại `protocolRoot`. Row Topology/Rooms/Councils, Role và Peer delegation profile card, distribution update card còn nguyên.                                |
| Startup notices, history (#5338…)  | `MERGE`                 | Đọc history trước khi publish agent; `commitCompleteHistorySnapshot` của downstream chạy trước.                                                                                                                |
| `send_agent_prompt` (#5347, #5386) | `MERGE WITH ADAPTATION` | Finish notification khi blocking wait hết giờ, background chờ provider nhận turn. Role topology authorization của downstream chạy trước.                                                                       |
| Codex per-session CODEX_HOME       | `MERGE WITH ADAPTATION` | Prompts và skills đọc từ CODEX_HOME của session; skill config Foundation/product của downstream chuyển sang `this.codexHome`. Launch binding custom provider giữ nguyên.                                       |
| Claude provider config dir         | `MERGE`                 | Option `configDir` bỏ, config dir lấy từ env provider. `productSkillBundleRoot` của downstream giữ.                                                                                                            |
| Shutdown, log disk-full (#5445)    | `MERGE WITH ADAPTATION` | Xóa local credential là bước `attempt("local-credential")` đầu tiên trong stop của downstream.                                                                                                                 |
| OpenCode v2, Pi extensions         | `MERGE` (tắt)           | Code vào nhưng provider không thuộc shipped set; `isPaseoSupportedProvider` chặn, bridge không khởi động.                                                                                                      |

Primary source: release notes [v0.10.0](https://github.com/getpaseo/paseo/releases/tag/v0.10.0),
[v0.10.1](https://github.com/getpaseo/paseo/releases/tag/v0.10.1),
[v0.10.2](https://github.com/getpaseo/paseo/releases/tag/v0.10.2),
[v0.10.3](https://github.com/getpaseo/paseo/releases/tag/v0.10.3).

## Semantic ownership

Merge có 26 textual conflict (server 10, app 3, 12 manifest, lockfile, nix, changelog). Manifest chỉ
xung đột version và internal dependency; giải từng hunk về phía downstream để giữ dependency mới của
upstream (`@opencode/client`). Ngoài rule cố định, lần này quyết định thêm:

- `decodeRawMessagePayloadForError`: lấy bản upstream (không log payload inbound). Redaction
  `redactSensitiveWsPayload` của downstream thành code chết và bị xóa; test relay đổi sang kiểm secret
  không vào log và `errorName` có mặt.
- Hai constructor (`CodexAppServerAgentSession`, `VoiceAssistantWebSocketServer`) vượt complexity 20 khi
  gộp hai phía; tách `loadCodexRoleSkillPolicies` và `requireDaemonVersion`.
- `test:integration` của server bỏ đoạn OpenCode runtime e2e upstream thêm, vì OpenCode không ship.
- Audit: caller của `streamAgent`/`steerOrReplaceActiveTurn`/`tryRunOutOfBand` giống hệt `main`;
  `operation-permissions.ts` không đổi.
- Authority cần Human biết: khi daemon có password, mọi process cùng user đọc được
  `PASEO_HOME/local-credential` và vào với owner admission qua kết nối direct, kể cả shell của agent
  có role. Máy này chưa đặt password nên không đổi gì. `paseo run` từ trong agent mà `PASEO_AGENT_ID`
  không khớp agent nào giờ chạy như top-level (#5392).

## Review sau merge

Review độc lập trên hunk giải tay và các thay đổi auto-merge của upstream: không có lỗi mức cao hay
trung bình. Hai lỗi thấp đã sửa ở commit `95ab07278`: test redaction lỗi thời và đoạn OpenCode trong
`test:integration`.

## Source receipts

- Zero unmerged path, zero conflict marker. `npm run build:server`, typecheck toàn workspace, lint và
  format pass qua pre-commit gate trên merge, fix và release commit.
- `./scripts/upstream-integration.sh run-tests main` (75 file): app 338, client 154, protocol 90,
  desktop 4 pass; server 1461/1478 pass, CLI 34/47 pass.
- Server đỏ: 13 test OpenCode local e2e (`opencode` không cài, provider không ship); 2 test
  `claude-provider-config-dir-history.e2e` (`Provider 'claude-secondary' is disabled`: custom provider
  derive từ Claude không thuộc shipped set); 1 test startup notices trong `agent-manager.test.ts` đọc
  committed rows trước khi buffer durable của downstream flush, đã sửa test và chạy lại xanh (252 test
  cùng file relay).
- CLI đỏ: `lifecycle.e2e.test.ts` `DAEMON_NOT_READY` (Semble lạnh, xem Test đỏ giả). Các file unit trong
  `packages/cli/src`, kể cả lệnh chỉ downstream có (`chat`, `agent signal`, `update`), pass.

## Gates chưa chạy

Không có CI cho lần này. Chưa chạy: CLI `test:local`, Playwright e2e (gồm spec agent-profiles giữ cả
hai test), desktop e2e, website, portable qualification, server e2e ngoài các file merge đụng.
`nix/npm-deps.hash` còn là hash của `.60` vì máy không có `nix`.
