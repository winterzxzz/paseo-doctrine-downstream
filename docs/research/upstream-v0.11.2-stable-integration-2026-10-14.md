# Tích hợp upstream Paseo v0.11.2 stable

## Kết luận

- Quyết định: `MERGE WITH ADAPTATION` exact annotated tag `v0.11.2`, peeled commit
  `75953250959979b8f088bbca8dbd6ee61d0151b1`. Boundary gồm 247 upstream commit từ merge-base
  `c481ecf3e` (cut `0.10.0`), qua ba stable `v0.11.0`, `v0.11.1`, `v0.11.2`.
- Baseline downstream là `0.10.3-paseo.75`, commit `50f76dce0` (331 commit downstream kể từ merge-base).
  Merge commit `85ea72c43` có đúng hai parent là baseline đó và upstream `v0.11.2`.
- Version activation là `0.11.2-paseo.76` tại release commit riêng.
- License upstream vẫn Apache-2.0; downstream giữ AGPL-3.0 (text website sửa lại sau khi lấy bản upstream).

Quy trình và resolution rules dùng lại cho lần sau nằm ở
[upstream-integration.md](../upstream-integration.md); các rule mới của lần này đã vào đó
(Provider options, Usage sources, Codex env, bổ sung Provider set và App: sidebar).

## Upstream delta

| Surface                                 | Quyết định              | Nội dung nhận                                                                                                                                                      |
| --------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Usage (#5465 và các PR theo sau)        | `MERGE WITH ADAPTATION` | `services/quota-fetcher` bị xóa; usage là builtin plugin `plugins/*-usage-source`. Fetcher Factory Droid của downstream port thành `factory-droid-usage-source`.   |
| Plugin registry, SDK (#6224, #5685, …)  | `MERGE`                 | `paseo plugin add owner/slug` cài từ registry; vẫn đi qua `runPluginInstallCommand` nên Human-only guard áp dụng. Reservation ID chạy trước compatibility check.   |
| Antigravity (`agy`), Muse Code provider | `MERGE` (tắt)           | Ship dạng builtin plugin ở upstream; downstream loại khỏi `builtinPlugins`. Antigravity downstream vẫn là `gemini-antigravity`.                                    |
| Provider options (#5780)                | `MERGE WITH ADAPTATION` | `options` thay `params` (`COMPAT(providerParams)`); builtin vẫn qua `resolveProviderEnabled`; `forceStaticModels`, Droid contract, Cursor/Droid ACP detection giữ. |
| Claude mode (#6074, #6272, #5140)       | `MERGE WITH ADAPTATION` | `applyPermissionMode` của downstream nhận `queryRestartNeeded` và `ensureQuery(mode)`; `observePermissionMode` xóa `cachedRuntimeInfo`.                            |
| ACP context usage (#4848)               | `MERGE WITH ADAPTATION` | Guard và turn usage của upstream; vẫn trả event theo thứ tự sau pending user events và giữ `totalCostUsd`.                                                         |
| Codex per-session environment           | `MERGE WITH ADAPTATION` | `environment` tính một lần mang overlay cách ly credential theo `providerLaunchBinding`.                                                                           |
| Content width (#5680), Explorer tabs    | `MERGE WITH ADAPTATION` | Rooms screen dùng `theme.contentMaxWidth`; topology panel dùng `definePanel`.                                                                                      |
| Sidebar footer/header (#5903, #5805)    | `MERGE WITH ADAPTATION` | Model `header`/`footer`; Topology, Rooms, Councils nằm trong `header`.                                                                                             |
| Orchestration skills (#5827)            | `MERGE`                 | Không cài skill vào Codex skills dir. Test fixture downstream `paseo-mapper` giữ.                                                                                  |

Primary source: release notes [v0.11.0](https://github.com/getpaseo/paseo/releases/tag/v0.11.0),
[v0.11.1](https://github.com/getpaseo/paseo/releases/tag/v0.11.1),
[v0.11.2](https://github.com/getpaseo/paseo/releases/tag/v0.11.2).

## Semantic ownership

Merge có 72 textual conflict (server 26, app 13, website 9, 13 manifest, lockfile, nix, docs).
Manifest giải về downstream; nhận `lucide-react-native@^1.50.0` và `yaml` của upstream, giữ
`markdown-it@^14.3.1` (hardening) và `ws@^8.21.3` của downstream. Ngoài rule cố định, lần này quyết
định thêm:

- Ba hàm vượt complexity 20 khi gộp hai phía: tách `PiRpcAgentClient.prepareLaunchFiles`,
  `ACPAgentClient.prepareLaunch` và `resolveProviderErrorMessage`.
- `resolveAgentIdentifier` đã được downstream tách sang `agent/identifier.ts`; cờ `notFound` của
  upstream port vào đó.
- Audit: caller của `streamAgent`/`steerOrReplaceActiveTurn`/`tryRunOutOfBand` giống hệt `main`;
  `operation-permissions.ts` chỉ thêm `usage.list_reports.*` ở `daemon.read`, cùng mức RPC usage cũ.
- Authority cần Human biết: plugin provider (do Human cài) không qua support gate và bật mặc định;
  `antigravity-provider`/`muse-provider` không phải ID reserved nên Human vẫn cài local được.

## Review sau merge

Review độc lập trên hunk giải tay và thay đổi auto-merge của upstream: không có lỗi mức cao.
Một lỗi trung bình: builtin usage plugin yêu cầu `paseo >=0.11.0`, nên phải có release commit
`0.11.2-paseo.76` trước mọi build. Lỗi thấp ghi nhận, không sửa:

- Usage Factory Droid: shape lạ giờ ra card error (theo convention upstream) thay vì unavailable;
  agent ACP không có `usageSession()` nên chỉ có report global.
- Custom provider thiếu `extends` bị bỏ qua im lặng (ý định upstream cho plugin override).
- Codex role agent cần đọc skill Paseo từ `~/.agents/skills` hoặc product skill bundle, không còn từ
  Codex skills dir; chưa canary live.

## Source receipts

- Zero unmerged path, zero conflict marker. `npm run build:server`, typecheck toàn workspace, lint và
  format pass qua pre-commit gate trên merge commit.
- `./scripts/upstream-integration.sh run-tests main` (226 file): app 959, desktop 89, highlight 32,
  plugin 120, protocol 118, relay 1 pass; server 3181/3210, client 184/185, CLI 82/90 pass.
- Đỏ thật, đã sửa và chạy lại xanh: helper `terminalEvents` bị nhân đôi trong
  `opencode/v2/agent.test.ts` (cả hai phía cùng thêm); test shadow plugin provider dùng custom ACP
  (bị tắt trong provider set downstream) đổi sang `extends: "codex"`; fixture config của client thiếu
  `defaultFastMode` (feature downstream `11ebaa416`).
- Đỏ giả: 5 test OpenCode local e2e (`opencode` không cài); `claude-real` disabled (provider set);
  Antigravity real `agy` (`antigravity-provider` không ship); CLI `lifecycle.e2e` `DAEMON_NOT_READY`
  (Semble lạnh); `config.test.ts` (endpoint release smoke) và `worker-terminal-manager.test.ts` đỏ cả
  trên baseline `main`; `daemon-client.e2e` timeout chờ event (chưa loại trừ, cần chạy baseline);
  website cần `workerd`.
- `plugins/factory-droid-usage-source/server/usage.test.ts`: 2/2 pass (script không quét `plugins/`).

## Gates chưa chạy

Không có CI. Chưa chạy: CLI `test:local`, Playwright e2e, desktop e2e, website, portable
qualification, test của các usage plugin khác trong `plugins/`. `nix/npm-deps.hash` còn là hash của
`.75` vì máy không có `nix`. Daemon live chưa restart: đang có agent chạy, Human quyết định thời điểm
`./scripts/local-stack.sh --apply`.
