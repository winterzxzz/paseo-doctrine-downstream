# Tích hợp upstream Paseo v0.14.0 stable

## Kết luận

- Quyết định: `MERGE WITH ADAPTATION` exact tag `v0.14.0`, peeled commit
  `8c6de842a3157530c26a7a94c78a3d647fb96ce9`. Boundary gồm 417 upstream commit từ merge-base
  `ab10a6694` (cut `0.11.1`), qua stable `v0.12.0`, `v0.13.0`, `v0.13.1`, `v0.13.2`, `v0.14.0`.
- Baseline downstream là `0.11.2-paseo.98`, commit `8dd877b38` (379 commit downstream kể từ merge-base).
  Merge commit `1bb7718f0` có đúng hai parent là baseline đó và upstream `v0.14.0`.
- Version activation là `0.14.0-paseo.99` tại release commit riêng `c348d8c4f`.
- License upstream vẫn Apache-2.0; downstream giữ AGPL-3.0 (website: `legal/terms*.md`, i18n
  `landing.plugins.license`, `llms.ts`, alternatives).

Quy trình và resolution rules nằm ở [upstream-integration.md](../upstream-integration.md); rule mới của
lần này đã vào đó (Lockfile khi upstream nâng nền tảng, Idle runtime collection, Finish subscriptions,
Connected hosts, Lint debt).

## Upstream delta

| Surface                                            | Quyết định              | Nội dung nhận                                                                                                                                                                        |
| -------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Expo 57 / RN 0.86 / React 19.2.3                   | `MERGE WITH ADAPTATION` | Lock lấy từ upstream rồi `npm update` các package có override bảo mật; override `shell-quote` nâng lên 1.12.0. `npm audit` critical 14 (main 16), high 39 (main 40).                 |
| Idle runtime collection (#7782)                    | `MERGE WITH ADAPTATION` | Mặc định tắt ở fork; role-bound agent bị loại khỏi candidate. Reload runtime bị thu hồi chạy trước authority lock (lock không re-entrant).                                           |
| Finish subscriptions bền (#7683, #7561)            | `MERGE WITH ADAPTATION` | Role child (Lead/Peer) là policy trong module; watch role khôi phục sau restart bỏ qua settle đã báo.                                                                                |
| Agent messages (#5164, #6373)                      | `MERGE`                 | `send_agent_prompt` xếp hàng qua `agentMessages`, mặc định steer; topology kiểm lúc enqueue, lease và `*Authorized` lúc dispatch.                                                    |
| Connected hosts (#7370)                            | `MERGE WITH ADAPTATION` | Tool nhận `serverId`; caller có role binding bị chặn fail-closed khi `serverId` là host khác. `hosts.add/update/remove` cần `tunnel.manage`.                                         |
| Plugin per-agent tools, session MCP (#7938, #7983) | `MERGE WITH ADAPTATION` | Đi qua `paseoToolPolicy`; `disabledTools` giờ chặn cả tên tool plugin (trước đó downstream bỏ qua tên ngoài manifest).                                                               |
| Markdown renderer, phone layout, explorer          | `MERGE WITH ADAPTATION` | Composer một hàng của downstream ghép vào `composer/input/presentation.tsx`; tab Topology vào `compact-workspace-header/tab-switcher.tsx`; panel `topology` có `compactSheet: null`. |
| Hoplite, MiniMax và provider plugin mới            | `MERGE` (tắt)           | Giữ trong catalog data, không ship (`SUPPORTED_ACP_PROVIDER_IDS` = cursor, factory-droid).                                                                                           |
| Claude close (23c4df481)                           | `MERGE`                 | Gửi `interrupt()` trước close nhưng không chờ, như upstream.                                                                                                                         |

Primary source: release notes [v0.12.0](https://github.com/getpaseo/paseo/releases/tag/v0.12.0),
[v0.13.0](https://github.com/getpaseo/paseo/releases/tag/v0.13.0),
[v0.13.1](https://github.com/getpaseo/paseo/releases/tag/v0.13.1),
[v0.13.2](https://github.com/getpaseo/paseo/releases/tag/v0.13.2),
[v0.14.0](https://github.com/getpaseo/paseo/releases/tag/v0.14.0).

## Semantic ownership

Merge có 99 textual conflict (server 34, app 29, website 9, manifest, lockfile, nix, docs). Ngoài rule
cố định, lần này quyết định thêm:

- `formatSystemNotificationPrompt` chuyển sang `agent/agent-messages`; `setupFinishNotification` bị
  xóa, hành vi role port vào `finish-subscriptions`.
- Plugin build chuyển vào compiler worker; timeout build + tree-kill của downstream port sang
  `plugins/preparation-build.ts`.
- `configurationEnvironment()` của upstream lọc env: thêm `PASEO_RELEASE_SMOKE` và
  `PASEO_BEADS_CENTRAL_SMOKE_ENDPOINT`.
- `FoundationCredentialStore` không còn throw khi `config.json` hỏng lúc dựng Session.
- 10 tool chỉ downstream có thêm presentation trong `protocol/paseo-tool-presentation/catalog.ts`.
- Rule lint mới: IO đồng bộ trong 12 module downstream allowlist theo file/API với TODO; Pressable trần
  trong 8 màn downstream đổi sang `PressHighlight` (không highlight style, giao diện giữ nguyên).
- Audit: caller của `streamAgent`/`steerOrReplaceActiveTurn`/`tryRunOutOfBand` giống `main` (thêm một
  lời gọi đệ quy private). `operation-permissions.ts` chỉ thêm `hosts.*`, `speech.local_models.*`,
  `workspace.setup.subscribe.*`.

## Review sau merge

Review độc lập trên hunk giải tay: một lỗi cao (deadlock khi prompt đua với idle collection) và một
lỗi trung bình (finished giả sau restart), cả hai đã sửa ở `81a04bfb2` kèm test. Ghi nhận, không sửa:
topology của `send_agent_prompt` chỉ kiểm lúc enqueue (cửa sổ ~2 giây).

## Source receipts

- `npm run build:server`, typecheck toàn workspace, lint và format pass qua pre-commit gate.
- `./scripts/upstream-integration.sh run-tests main`: cli 91, client 229, desktop 36, highlight 31,
  plugin 137, protocol 224, relay 47 pass; server 5066/5152 lần đầu, sau triage mọi file còn đỏ đã
  sửa hoặc phân loại; app `workspace-layout-store.test` 165/165 sau khi sửa.
- Đỏ thật đã sửa: deadlock/microtask ordering trong `*Authorized`; catalog label tool downstream;
  config env whitelist; credential store đọc config; `disabledTools` cho plugin tool; Claude close.
- Đỏ giả: `opencode-bridge.local.e2e` (không có `opencode`); Claude e2e dùng `claude-real` /
  `claude-secondary` (provider set); `claude/agent.env.test` khi chạy trong Claude Code session
  (`CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT` thừa hưởng; pass khi unset); `daemon-client.e2e` lifecycle và
  permission flow, `checkout-ship.e2e`, hai test `agent-mcp.e2e` về role agent khi
  `mcp.injectIntoAgents` tắt: đỏ cả trên `main`.
- `checkout-ship.e2e` tạo repo GitHub thật bằng `gh` của người chạy (`paseotmp-checkout-ship-*`); chạy
  nó trên máy dev để lại repo rác.

## Gates chưa chạy

Không có CI. Chưa chạy: CLI `test:local`, Playwright e2e, desktop e2e, website (`workerd`), portable
qualification, test của các usage plugin trong `plugins/`, kiểm tra giao diện composer và màn downstream
trên điện thoại. `nix/npm-deps.hash` còn là hash cũ vì máy không có `nix`.
