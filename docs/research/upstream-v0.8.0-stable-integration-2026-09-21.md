# Tích hợp upstream Paseo v0.8.0 stable

## Kết luận

- Quyết định: `MERGE WITH ADAPTATION` exact annotated tag `v0.8.0`, peeled commit
  `b8e24677e12b226c7c38c1c3a40649daa9f1152f`. Upstream `main` lúc đó đã ở `0.9.0-beta.2`; beta không
  được nhận.
- Baseline downstream là `0.7.0-paseo.57`, commit `0d305fc08`. Merge commit `cff43ebd3` có đúng hai
  parent là baseline đó và upstream `v0.8.0`; boundary gồm 92 upstream commit từ `v0.7.2`.
- Version activation là `0.8.0-paseo.58` tại release commit riêng `6d971a78a`. Base `0.8.0` là điều
  kiện chức năng: plugin compatibility check của 0.8 so stable core của daemon với
  `requirements.paseo`.
- Test/harness fix sau review nằm ở `dce2a5e00`. `main` được fast-forward và push cùng ngày.

Quy trình và resolution rules dùng lại cho lần sau nằm ở
[upstream-integration.md](../upstream-integration.md).

## Upstream delta

| Surface                   | Quyết định              | Nội dung nhận                                                                                                                                                                            |
| ------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugin runtime 0.8        | `MERGE WITH ADAPTATION` | Client/server entry riêng, lifecycle hooks, custom provider, header button, composer pill, settings, `requirements.paseo`. Reservation bundled policy ID chạy trước compatibility check. |
| `paseo plugin status`     | `MERGE`                 | Gộp vào `plugin ls`; `status` còn là hidden alias.                                                                                                                                       |
| Agent reload              | `MERGE WITH ADAPTATION` | Close-before-resume cho mọi provider. Role binding giữ trong `roleBindingsAwaitingRegistration` suốt reload để tool catalog không mất role.                                              |
| Provider snapshot         | `MERGE WITH ADAPTATION` | Generation model, chỉ reload provider đổi config. Role-binding support gắn vào generation entry; đổi `roleBinding` override làm mới definition.                                          |
| Agent requests            | `MERGE`                 | Idempotent create/send (`agentRequestReceipts`), đi qua `createAgentCommand` và prompt path đã authorized.                                                                               |
| Hub                       | `MERGE WITH ADAPTATION` | Organization triggers, follow-up tới agent có sẵn, `hub.execute` mở rộng. Guided starter vẫn fail-closed.                                                                                |
| App shell                 | `MERGE WITH ADAPTATION` | Sidebar nav sắp xếp/ẩn được, What's new sheet, Import session, mark unread. Row Topology/Rooms/Councils thành builtin của nav model.                                                     |
| App directory sync        | `MERGE WITH ADAPTATION` | `AgentStoreProjection`; Foundation receipts và archived-detail preservation chuyển vào đó.                                                                                               |
| New workspace             | `MERGE WITH ADAPTATION` | Background create path khi user rời màn hình; downstream nối role fields vào path này.                                                                                                   |
| Desktop updater, macOS 13 | `MERGE`                 | Upstream-only; downstream vẫn render distribution updater của mình.                                                                                                                      |
| Codex/Claude/Pi fixes     | `MERGE`                 | Active-writer fix, compaction rows, nested subagent parent, duplicate tool-call rows.                                                                                                    |

Primary source: [Release v0.8.0](https://github.com/getpaseo/paseo/releases/tag/v0.8.0).

## Semantic ownership

Merge có 69 textual conflict (server 23, app 14, cli 4, client 3, protocol 2, còn lại là
`package.json`, docs, scripts). Ngoài các rule cố định trong playbook, lần này quyết định thêm:

- Cả hai phía đã tự thêm Paseo tool policy. Giữ schema downstream vì là superset (`allowedTools` +
  `disabledTools`); test MCP giữ expectation của SDK v2 (call tool không tồn tại thì reject).
- `hub.execute` của upstream nay cho tạo, nhắn, cancel, archive agent thường trên toàn daemon. Nhận
  nguyên trạng: quyền tắt tới khi Human grant, và agent tạo qua đường đó vẫn qua role preflight.
- `session.ts`: chuỗi dispatch downstream (`dispatchWorkspaceDomainMessage`) nhận thêm handler
  workspace state/setup của upstream. Create thất bại vẫn rollback directory workspace rồi throw ra
  error path mới của upstream.
- Test upstream mới giả định provider downstream đã tắt (`pi`, `opencode`) được đổi sang
  `gemini-antigravity`; mọi override block tắt thêm `omp` và `gemini-antigravity`.
- Hub relationship harness nhận `trustedSembleRuntime: null` như các daemon test utility khác.
- Parser changelog trong app chấp nhận heading `Upstream X.Y.Z`.

## Source receipts

- Zero unmerged path, zero conflict marker.
- `npm run build:server`, full workspace typecheck, lint và format pass trên cả ba commit qua
  pre-commit gate.
- Mọi unit test file merge đụng tới đều pass local: protocol 164, client 159, plugin 76, CLI unit 98,
  server 66 file (hơn 2000 test, gồm Hub websocket 18/18 trên daemon thật), app 91 file (1368 test),
  scripts.
- Independent review trên combined diff của 69 file không tìm thấy defect. Review tay xác nhận
  upstream không thêm caller nào vòng qua entrypoint `*Authorized`.
- Live: daemon và CLI báo `0.8.0-paseo.58`, WebUI 200 sau `build:daemon-web-ui`, plugin
  `requirements.paseo: ">=0.8.0"` cài và đạt `running`.

## Gates chưa chạy

Không có CI cho lần này. Chưa chạy: CLI `test:local`, Playwright e2e, desktop suite (treo local),
website (`workerd`), portable qualification, `./scripts/local-stack.sh --apply` (thiếu
`PASEO_FOUNDATION_ROOT`). `nix/npm-deps.hash` còn là hash của `.57` vì máy không có `nix`. Canary
reload agent trên daemon thật chưa làm. Beads Central ở trạng thái `degraded` khi daemon chạy thẳng từ
checkout; trạng thái đó có từ trước merge.
