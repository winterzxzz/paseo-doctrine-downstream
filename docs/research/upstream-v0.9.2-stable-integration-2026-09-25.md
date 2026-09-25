# Tích hợp upstream Paseo v0.9.2 stable

## Kết luận

- Quyết định: `MERGE WITH ADAPTATION` exact annotated tag `v0.9.2`, peeled commit
  `c67b7158b441bb09026b38d86ae335cc4b49190a`. Boundary gồm 139 upstream commit từ `v0.8.0`, qua ba
  stable `v0.9.0`, `v0.9.1`, `v0.9.2`.
- Baseline downstream là `0.8.0-paseo.59`, commit `ed1646ed7` (284 commit downstream kể từ `v0.8.0`).
  Merge commit `83187a03f` có đúng hai parent là baseline đó và upstream `v0.9.2`.
- Version activation là `0.9.2-paseo.60` tại release commit riêng. Base `0.9.2` giữ plugin
  compatibility check so đúng stable core của upstream.

Quy trình và resolution rules dùng lại cho lần sau nằm ở
[upstream-integration.md](../upstream-integration.md); các rule mới của lần này đã vào đó.

## Upstream delta

| Surface                       | Quyết định              | Nội dung nhận                                                                                                                                                                                                               |
| ----------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daemon lifecycle (#4575)      | `MERGE WITH ADAPTATION` | `daemon start` đọc config bền vững, `daemon run` cho foreground + env override, `daemon-control` export. Installer web-cli vẫn gọi `start --foreground --listen … --web-ui` qua shim `COMPAT(legacyForegroundLaunchFlags)`. |
| Owned subscriptions, delivery | `MERGE WITH ADAPTATION` | `SessionDelivery`, subscription độc lập cho agent updates, timeline, checkout diff, terminals. Permission outbound theo source của downstream vẫn áp trên mọi đường gửi.                                                    |
| CreationService               | `MERGE WITH ADAPTATION` | Tạo workspace/agent idempotent qua `agent.create.request` và `workspace.create.request`. Mọi đường tạo agent vẫn qua `createSessionAgent` → role preflight.                                                                 |
| Projected timeline (#4838)    | `MERGE WITH ADAPTATION` | Store giữ item đã project, không giữ payload trung gian. `FileAgentTimelineStore` có mirror canonical riêng cho Lead handoff.                                                                                               |
| History replay (#5286)        | `MERGE WITH ADAPTATION` | Replay thất bại không xóa committed timeline; reload không xóa durable timeline trước replay.                                                                                                                               |
| Archived resume, residency    | `MERGE`                 | Resume quyết định `history`/`interactive` từ record trong lifecycle lane; runtime được giữ khi provider close lỗi.                                                                                                          |
| Plugins 0.9                   | `MERGE WITH ADAPTATION` | Cài từ npm, `plugin update` có preview/apply, host SDK mới. Human-only guard phủ cả 7 lifecycle entrypoint.                                                                                                                 |
| Codex archived history        | `MERGE`                 | `history` purpose đọc lịch sử qua app-server tạm, không resume thread; thay option `applyRuntimeOverrides` của downstream.                                                                                                  |
| Cursor catalog, Claude launch | `MERGE`                 | Cursor model catalog qua `cursor/list_available_models`; Claude rewind SDK. Role capsule và Cursor MCP shadow của downstream giữ nguyên.                                                                                    |
| App: Find, composer, create   | `MERGE WITH ADAPTATION` | Find trong chat/file/terminal, request tạo gộp. Launch có role tạo workspace trước để assignment có thư mục thật.                                                                                                           |
| Desktop updater, memory       | `MERGE`                 | Daemon manager dùng `startDaemonInstance`; env Beads Central bundled vẫn được truyền. Surface updater upstream vẫn ẩn.                                                                                                      |

Primary source: release notes [v0.9.0](https://github.com/getpaseo/paseo/releases/tag/v0.9.0),
[v0.9.1](https://github.com/getpaseo/paseo/releases/tag/v0.9.1),
[v0.9.2](https://github.com/getpaseo/paseo/releases/tag/v0.9.2).

## Semantic ownership

Merge có 81 textual conflict (server 24, cli 16, app 16, desktop 4, client 3, protocol 2, còn lại là
manifest, docs, CI, nix). Ngoài rule cố định, lần này quyết định thêm:

- `paseo daemon status --json` giữ readback mà Foundation qualification đọc: `connected*`,
  `source*`, `builtAt`, và `providers` dạng `{label, path}` (upstream trả `{provider, available}`).
- Installer preflight nhận thêm trạng thái `not_ready` của upstream bên cạnh `running`.
- `daemon start` nền bỏ qua env setting (`PASEO_DICTATION_ENABLED`…); `docs/dev-pilot.md` chuyển sang
  `paseo daemon config set`.
- `ensureUnarchivedAgentLoaded` chờ lifecycle lane sau khi load dùng chung trả về, vì
  `ensureAgentLoaded` của downstream join lượt resume đang chạy trước khi chờ lane.
- `distribution.update.progress` được khai báo trong reply map của owned subscriptions.
- Test markdown của upstream viết theo Markdown-It 10; renderer downstream được inject Markdown-It 14
  (vá bảo mật `86c1717ba`), nên assertion escaped-space đổi theo parser thật.
- Permission: `workspace.title.set` nhận thêm `hub.execute` (upstream #5302). Nhận nguyên trạng như
  các quyền `hub.execute` khác. Caller của `streamAgent`/`steerOrReplaceActiveTurn`/`tryRunOutOfBand`
  giống hệt `main`.
- Read-only của Codex giữ `approvalPolicy: "never"` (no-write lease, `b24deada0`); upstream #5239 chỉ
  thêm reviewer `user` vào preset. Session Codex `history` là snapshot chỉ đọc; unarchive resume một
  session interactive mới, nên test downstream "dùng lại history session cho turn" được thu lại.
- `paseo daemon config set/unset` (mới của upstream) có Human-only guard như plugin lifecycle, vì
  config mang quyền plugin, Hub, role profile và peer delegation.
- Desktop stop chờ 35s như CLI, vì supervisor cho worker 25s để tắt.
- App: retry sau một launch không role mà nay có role thì tạo agent trực tiếp trong workspace đã có;
  setup dialog nhớ workspace đã tạo kể cả khi bước agent lỗi.

## Review sau merge

Review độc lập trên combined diff tìm ra một lỗi nghiêm trọng và bảy lỗi nhỏ hơn. Đã sửa trong commit
fix riêng sau merge:

- Reconcile history nhận projected rows (chunk đã gộp, `seqStart`/`seqEnd` cũ) nên đánh số `seq` sai,
  nhân đôi transcript sau restart (`persistence.e2e`) và làm durable write xung đột. Sửa: reconcile
  đối chiếu rows canonical của durable store, snapshot ghi rows canonical, so khớp item bỏ qua field
  `undefined` mà projection sinh ra, rehydrate bắt đầu in-memory rỗng. Regression test ở
  `agent-manager.test.ts` và `history-reconciliation.test.ts`, đã kiểm đỏ khi gỡ bản sửa.
- Stop deadline desktop, Human-only guard của `daemon config`, retry có role trong app, tag `COMPAT`.

Còn lại, mức thấp: bật role sau khi background create có role thất bại vẫn ném "Workspace creation
returned no agent" (upstream có cùng lỗi với launch rỗng); `workspace.create.request` có role chạy
role preflight sau khi tạo workspace, nên assignment sai vẫn bị từ chối nhưng để lại workspace.

## Source receipts

- Zero unmerged path, zero conflict marker. `npm run build:server`, typecheck toàn workspace, lint và
  format pass qua pre-commit gate trên merge commit `83187a03f` và commit fix sau review.
- `./scripts/upstream-integration.sh run-tests main` (272 file): client 226, desktop 97, plugin 32,
  protocol 115 pass; app 1404/1405, test đỏ duy nhất là assertion Markdown-It 10 nói trên.
- Sau commit fix: server unit (không e2e) 3478 pass trên 217 file; app draft/components/screens 939;
  CLI 134 + guard; desktop daemon-manager; scripts contract 42.
- Server e2e đối chiếu baseline trên máy này. Đỏ ở cả `main` lẫn upstream `v0.9.2` thuần, nên không
  phải regression: `daemon-client.e2e` (lifecycle, permission, session actions), `terminal.e2e` (7
  test), `agent-mcp.e2e` (worktree setup), `agent-refresh-rehydrates-timeline`. Đỏ sẵn trên `main`:
  hai test role-bound của `agent-mcp.e2e`, `agent-operations` setAgentMode, `wait-for-idle`,
  `project-becomes-git`, `worktree-autoarchive`, `workspace-same-cwd-isolation`. Chỉ đỏ sau merge và
  đã sửa: `persistence`, `selective-timeline-delivery`, `plugin-paseo-api`, `exports`,
  `relay-reconnect` (mock thiếu method host-machine từ `51e2d465b`, đỏ sẵn trên `main`), upload.
- `packages/cli` `lifecycle.e2e.test.ts` đỏ 6 test vì Semble lạnh ~61s mỗi home mới (đo được),
  vượt deadline 30s; xem Test đỏ giả trong playbook.

## Gates chưa chạy

Không có CI cho lần này. Chưa chạy: CLI `test:local`, Playwright e2e, desktop e2e, website (runner
`workerd` lỗi startup local), portable qualification, `./scripts/local-stack.sh --apply` (thiếu
`PASEO_FOUNDATION_ROOT`; cài qua artifact theo recipe local). `nix/npm-deps.hash` còn là hash của
`.59` vì máy không có `nix`. `local-daemon` e2e chỉ chạy được khi Semble cache ấm.
