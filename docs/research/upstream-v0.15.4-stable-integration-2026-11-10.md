# Tích hợp upstream Paseo v0.15.4 stable

## Kết luận

- Quyết định: `MERGE WITH ADAPTATION` exact tag `v0.15.4`, peeled commit
  `1c00b365c9e0b74c1580eba33d905d693125ae21`. Boundary gồm 19 upstream commit từ merge-base
  `8938fde3c` (tag 0.15.0).
- Baseline downstream là `0.15.0-paseo.102`, commit `3bf2f6419` (412 commit downstream kể từ merge-base).
  Merge commit `41cf579f9` có đúng hai parent là baseline đó và upstream `v0.15.4`.
- Version activation là `0.15.4-paseo.103` tại release commit riêng.
- License upstream vẫn Apache-2.0; downstream giữ AGPL-3.0.

Quy trình và resolution rules nằm ở [upstream-integration.md](../upstream-integration.md); rule mới của
lần này đã vào đó (App: theme picker, Control sizes, Setup orchestration).

## Upstream delta

| Surface                                          | Quyết định              | Nội dung nhận                                                                                                                       |
| ------------------------------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| First-run setup (#8363, #8824)                   | `MERGE WITH ADAPTATION` | `OnboardingHost` và màn chờ setup trong `_layout.tsx`; `DistributionUpdateCalloutSource` vẫn thay updater upstream.                 |
| Theme picker dạng lưới (#8363)                   | `MERGE WITH ADAPTATION` | `@/appearance/theme-picker` thành wrapper nối settings vào lưới downstream; Settings và setup dùng chung.                           |
| Hai cỡ control (#8363)                           | `MERGE WITH ADAPTATION` | `ControlSize = "sm" \| "md"`; Button chỉ downstream có đổi theo mapping của upstream.                                               |
| Gợi ý project (`project.suggestions.*`)          | `MERGE`                 | RPC chỉ đọc, `workspace.read`, gate `server_info.features.projectSuggestions`.                                                      |
| Claude Fable 5.2, Mythos 5.2 (#9233)             | `MERGE`                 | Model catalog và effort mặc định `medium`.                                                                                          |
| Daemon khởi động khi terminal worker lỗi (#8810) | `MERGE`                 | `worker-terminal-manager.ts` không conflict.                                                                                        |
| Bàn phím iOS 26+ (#8918)                         | `MERGE`                 | Không conflict.                                                                                                                     |
| Skeleton trong Providers settings                | `MERGE WITH ADAPTATION` | Menu provider của downstream (Configure tools) dời lên trước switch theo layout upstream; danh sách vẫn lọc qua `showProviderList`. |

Primary source: release notes [v0.15.1](https://github.com/getpaseo/paseo/releases/tag/v0.15.1) đến
[v0.15.4](https://github.com/getpaseo/paseo/releases/tag/v0.15.4).

## Semantic ownership

Merge có 24 textual conflict: 13 manifest (chỉ version và dependency nội bộ), lockfile, nix hash,
`CHANGELOG.md`, 8 file app. Không có dependency mới; lockfile downstream giữ nguyên sau
`npm install`. Quyết định ngoài rule cố định:

- Hai phía cùng thay dropdown theme bằng lưới. Lưới downstream giữ vì nó biết các theme cộng đồng và
  nhóm theme; picker upstream chỉ đọc `THEME_OPTIONS` dạng upstream. Font controls downstream (chọn font
  đã cài, −/+) thắng text field của upstream.
- `host-page.tsx`: `InjectPaseoToolsCard` của downstream thay bằng `PaseoToolsCard` của upstream (cùng
  config, cùng testID); role cards và `DefaultFastModeCard` giữ.
- `isolated-host-daemon.ts`: giữ cả `installPublishedServer` (downstream) và `withMutableRelay` (upstream).

## Authority audit

- Caller của `streamAgent`/`steerOrReplaceActiveTurn`/`tryRunOutOfBand` giống `main`.
- `operation-permissions.ts` chỉ thêm `project.suggestions.request/response` → `workspace.read`.
- Bước Providers của setup render đúng `ProvidersSection`, nên nhận cùng gate `isPaseoSupportedProvider`.
- Bước Orchestration của setup (`onboarding/internal/orchestration-setup.ts`) mở với mọi switch bật;
  Continue ghi `mcp.injectIntoAgents: true` dù host đang tắt. Hành vi upstream nguyên trạng, Human thấy
  switch; role check trong `paseo-tools.ts` vẫn áp dụng. Chờ Human quyết định có đổi về trạng thái
  host hiện tại hay không.

## Source receipts

- `npm run build:server`, typecheck toàn workspace, lint và format pass (cả pre-commit gate).
- `./scripts/upstream-integration.sh run-tests main` (10 file): app 78, server 289 pass.
- Thêm 7 file app quanh vùng giải tay (`providers-section`, `paseo-tools-policy-sheet`, onboarding
  model, appearance apply, font options, rooms model, composer state): 94 pass.
- Review độc lập trên hunk giải tay: không mất hành vi; một ghi nhận về bước Orchestration ở trên.

## Gates chưa chạy

Không có CI. Chưa chạy: CLI `test:local`, Playwright e2e (gồm luồng first-run setup), desktop e2e,
website (`workerd`), portable qualification, giao diện điện thoại. `nix/npm-deps.hash` còn hash cũ vì
máy không có `nix`. Local completion gate (`local-stack.sh --apply`, restart daemon, live canary) chờ
Human cho phép restart.
