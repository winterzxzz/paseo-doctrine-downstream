# Tích hợp upstream Paseo v0.15.0 stable

## Kết luận

- Quyết định: `MERGE WITH ADAPTATION` exact tag `v0.15.0`, peeled commit
  `8938fde3c713143f12eacbdd60c11fdfc0be0fb1`. Boundary gồm 104 upstream commit từ merge-base
  `8419c2122` (giữa 0.14.0 và 0.15.0).
- Baseline downstream là `0.14.0-paseo.100`, commit `b4ae30e84` (405 commit downstream kể từ merge-base).
  Merge commit có đúng hai parent là baseline đó và upstream `v0.15.0`.
- Version activation là `0.15.0-paseo.101` tại release commit riêng.
- License upstream vẫn Apache-2.0; downstream giữ AGPL-3.0.

Quy trình và resolution rules nằm ở [upstream-integration.md](../upstream-integration.md); rule mới của
lần này đã vào đó (Daemon shutdown, Launch env, Restart recovery).

## Upstream delta

| Surface                                            | Quyết định              | Nội dung nhận                                                                                                                                                                              |
| -------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Terminal worker giữ terminal qua restart           | `MERGE WITH ADAPTATION` | `stop({ keepTerminals })` ghép vào chuỗi `attempt(...)` của downstream; lỗi đóng terminal vẫn ném sau khi các bước khác xong.                                                              |
| Resume agent sau restart (#8127, #8619)            | `MERGE`                 | Mặc định tắt. Prompt resume đi qua `sendPromptToAgent` (có `assertAgentPromptLease`, `startAgentRun`); caller của `streamAgent`/`steerOrReplaceActiveTurn`/`tryRunOutOfBand` giống `main`. |
| Launch env bền (`launchEnv`)                       | `MERGE WITH ADAPTATION` | Env lúc tạo lưu vào record, dùng lại khi resume/reload; nối vào `buildLaunchContext` cùng `launchContract` và role binding của downstream.                                                 |
| Usage hiển thị mới, tắt usage check (#8181)        | `MERGE WITH ADAPTATION` | Sidebar giữ ring theo period của downstream; Usage modal lấy layout upstream (`UsageResetLine`) và vẫn tô màu bar theo period.                                                             |
| Plugin hook (`server.addHook`, tên `*.after`)      | `MERGE`                 | Lifecycle đổi tên event (`agent.created` → `agent.create.after`); emit của downstream đã đổi theo.                                                                                         |
| Codex: provider key `paseo:<id>`, `excludeTurns`   | `MERGE WITH ADAPTATION` | Ghép vào `buildThreadResumeRequest` của downstream; `modelProvider` của launch binding vẫn thắng.                                                                                          |
| Relay chunking, truncation timeline (#8302, #8274) | `MERGE`                 | `docs/timeline-sync.md` lấy mô tả budget mới của upstream.                                                                                                                                 |

Primary source: release notes [v0.15.0](https://github.com/getpaseo/paseo/releases/tag/v0.15.0).

## Semantic ownership

Merge có 49 textual conflict (server 15, app 9, docs 4, desktop 3, cli 3, manifest, lockfile, nix). Ngoài
rule cố định, lần này quyết định thêm:

- `scripts/upstream-integration.sh survey` fetch thẳng từ URL getpaseo: remote `upstream` của checkout này
  trỏ về một fork downstream khác.
- `curateAgentActivity` không còn được Codex provider dùng (upstream chuyển subagent activity sang panel riêng).
- Desktop `stopCapturedDaemon` giữ stop budget 35s của downstream.
- Test helper CLI để daemon tự chọn port (upstream) và vẫn gắn env Beads Central smoke của downstream.

## Downstream fix đi kèm

`gemini-antigravity` chỉ đưa câu trả lời cuối lên timeline: `handleStreamLine` bỏ qua mọi step `tool`
của `agy` và provider không echo prompt, nên agent chạy hàng phút mà Paseo không hiện gì (agent
`8d132ef4`: 129 row, toàn `assistant_message`, bắt đầu sau 6 phút). Sửa ở commit riêng: map step tool
(ACTIVE/DONE/ERROR cùng `callId`) thành `tool_call`, echo `user_message`, reset text theo từng step
response.

## Review sau merge

Review độc lập trên hunk giải tay không thấy lỗi authority hay mất hành vi. Đã sửa: lỗi đóng terminal bị
nuốt khi bước shutdown khác cũng lỗi; Antigravity khi `agy` không gửi `step_index` và state tool lạ.
Ghi nhận, không sửa: launch có role của custom Codex provider vẫn dùng key không tiền tố `paseo:` (đổi
sẽ vỡ launch contract đã lưu); resume sau restart không loại agent có role (tắt mặc định, vẫn qua lease).

## Source receipts

- `npm run build:server`, typecheck toàn workspace, lint và format pass qua pre-commit gate.
- `./scripts/upstream-integration.sh run-tests main` (181 file): app 983, client 241, plugin 69,
  protocol 82, desktop 10, cli 4 pass; server 3260/3304 lần đầu, sau triage mọi file còn đỏ đã sửa
  hoặc phân loại.
- Đỏ thật đã sửa: upstream #8132 bị mất khi ghép (`historyPrimed` của agent mở lại giờ theo
  `durableHistoryComplete`), hai test downstream theo history phân trang và key `paseo:`, test hang của
  supervisor vượt deadline vì grace 25s của downstream.
- Đỏ giả: `opencode-bridge.local.e2e` (không có `opencode`), `codex-custom-provider-import.local.e2e`
  (không có `codex`), `acp-startup-exit` và `headless-terminal` (Node 26 của Homebrew in deprecation
  vào stderr / buffer pool khác; bản ship chạy Node 22), `daemon-e2e/terminal.e2e` list terminals (code
  server/client giống hệt upstream, test upstream mong shape `{id, name}`).
- Website test không chạy được local (`workerd`).

## Gates chưa chạy

Không có CI. Chưa chạy: CLI `test:local`, Playwright e2e, desktop e2e, website (`workerd`), portable
qualification, test của các usage plugin trong `plugins/`, giao diện điện thoại. `nix/npm-deps.hash` còn
là hash cũ vì máy không có `nix`.
