# Tích hợp upstream

Repository này là downstream của [getpaseo/paseo](https://github.com/getpaseo/paseo) và giữ nguyên
history upstream. Upstream được nhận bằng cách merge **stable tag**, không bao giờ merge `main`
hay beta tag. Mỗi lần tích hợp để lại một record tại `docs/research/upstream-vX.Y.Z-stable-integration-<ngày>.md`;
record mới nhất là nơi đọc quyết định của lần trước.

`scripts/upstream-integration.sh` lo phần cơ học: khảo sát tag, dry-run conflict, chạy test bị đụng.
Skill `upgrade-upstream` chạy toàn bộ quy trình này.

## Quy trình

1. **Khảo sát.** `./scripts/upstream-integration.sh survey vX.Y.Z` fetch tag về tên local
   `upstream-vX.Y.Z` (tránh đụng tag `paseo-v*` của downstream), in merge-base, số commit hai phía,
   version, license và số conflict theo package. Đọc release notes upstream của mọi stable nằm giữa
   base cũ và tag đích.
2. **Branch.** `git switch -c integrate-upstream-vX.Y.Z`, rồi
   `git merge --no-ff --no-commit upstream-vX.Y.Z`. Không làm trên `main`.
3. **Giải conflict theo thứ tự phụ thuộc:** `package.json`/lockfile/docs → `protocol` → `client` →
   `server` → `cli` → `app` → `desktop`/`website`. Áp dụng [Resolution rules](#resolution-rules).
4. **Lockfile.** Lấy `package-lock.json` phía downstream rồi chạy
   `npm install --workspaces --include-workspace-root` để npm tự dựng lại.
5. **Build trước khi tin typecheck.** `npm run build:server`, rồi `npm run typecheck`,
   `npm run lint`, `npm run format`. Git nhân đôi import khi cả hai phía cùng thêm một dòng; lỗi
   `Duplicate identifier` sau merge gần như luôn là trường hợp này.
6. **Test bị đụng.** `./scripts/upstream-integration.sh run-tests <base>` chạy mọi unit test file đổi
   so với base, mỗi package một lần gọi vitest, log nằm ở `.dev/upstream-integration/`. Đọc
   [Test đỏ giả](#test-đỏ-giả) trước khi sửa code vì một test đỏ.
7. **Provenance.** Sửa `paseoUpstream.commit` trong `foundation/sources.lock.json` thành peeled commit
   của tag (`git rev-parse upstream-vX.Y.Z^{commit}`).
8. **Commit merge**, message dạng `merge: integrate upstream vX.Y.Z with downstream contracts`.
   Merge commit có đúng hai parent.
9. **Release commit riêng** theo [release.md](release.md): version `X.Y.Z-paseo.N` với `X.Y.Z` là
   stable core của tag vừa merge và `N` tăng tiếp, `npm run version:sync-internal`, `npm install`,
   entry `CHANGELOG.md`. Base version phải theo upstream: plugin compatibility check so stable core
   của daemon với `requirements.paseo` của plugin, nên daemon `0.7.0-paseo.N` từ chối mọi plugin
   `>=0.8.0`.
10. **Record.** Viết `docs/research/upstream-vX.Y.Z-stable-integration-<ngày>.md` theo record trước và
    thêm row vào [README.md](README.md).
11. **Live.** `npm run build:daemon-web-ui` dựng lại WebUI; `build:server` không đụng bundle đó, và
    app cũ không load được plugin viết cho API mới. Sau đó chạy [Local completion gate](../CLAUDE.md#local-completion-gate).
    Restart daemon đang dùng là quyết định của Human.
12. **Merge vào `main`** bằng fast-forward sau khi review, rồi push.

## Resolution rules

Không chọn wholesale `ours` hay `theirs` cho vùng authority và lifecycle. Các quyết định đã cố định:

| Vùng                         | Quy tắc                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json` mọi workspace | Giữ downstream: `private: true`, internal dependency `*`, version downstream. Nhận dependency mới của upstream.                                                                                                                                                                                                                                                                             |
| License                      | Downstream giữ AGPL-3.0. Upstream đã chuyển Apache-2.0; text hiển thị license trong docs và website giữ AGPL.                                                                                                                                                                                                                                                                               |
| `CHANGELOG.md`               | Entry upstream đổi heading thành `## Upstream X.Y.Z - <ngày>`, nằm dưới entry downstream mới.                                                                                                                                                                                                                                                                                               |
| `README.md`                  | Giữ bản downstream.                                                                                                                                                                                                                                                                                                                                                                         |
| Provider set                 | Shipped: Claude, Codex, Cursor, Antigravity và custom provider derive từ Codex (`isPaseoSupportedProvider`). Không mở lại adapter khác qua test fixture.                                                                                                                                                                                                                                    |
| `AgentManager`               | Role binding, launch contract, role-scoped Paseo tool policy và các entrypoint `*Authorized` là authority. Hook và flow mới của upstream bọc quanh chúng. `buildLaunchContext` nhận `launchContract` trước descriptor `opening` của upstream. Khi flow upstream gỡ agent khỏi registry giữa chừng (reload), giữ role binding trong `roleBindingsAwaitingRegistration` tới khi đăng ký xong. |
| `ProviderSnapshotManager`    | Lấy cấu trúc upstream; gắn role-binding support vào entry và để thay đổi `roleBinding` override làm mới definition.                                                                                                                                                                                                                                                                         |
| Hub guided starter           | Fail-closed với `HUB_FOUNDATION_ADMISSION_REQUIRED`. Giữ nguyên `packages/cli/src/commands/hub/init-flow.test.ts` downstream; public Hub docs mô tả shape upstream là reference-only.                                                                                                                                                                                                       |
| Plugin                       | Giữ Human-only lifecycle guard và reservation cho bundled policy ID (`slp`); check reservation chạy trước compatibility check. Lệnh CLI upstream gỡ thì gỡ theo.                                                                                                                                                                                                                            |
| MCP                          | Downstream dùng `@modelcontextprotocol/server` và `/client` v2; giữ handler downstream, chỉ nhận thay đổi hành vi của upstream.                                                                                                                                                                                                                                                             |
| App: directory replica       | Foundation receipts và archived-detail preservation sống trong `runtime/directory-sync/internal/agent-store.ts`.                                                                                                                                                                                                                                                                            |
| App: sidebar                 | Row downstream (Topology, Rooms, Councils) là builtin trong `sidebar-nav/model.ts`, có label key ở mọi locale.                                                                                                                                                                                                                                                                              |
| App: create agent            | Mọi đường tạo agent phía app mang role fields qua `composer/draft/create-agent-request.ts`. Upstream thêm đường tạo mới thì nối role fields vào.                                                                                                                                                                                                                                            |
| Desktop updater              | `_layout.tsx` render `DistributionUpdateCalloutSource`, không render updater upstream.                                                                                                                                                                                                                                                                                                      |
| Protocol                     | Theo [protocol-compatibility.md](protocol-compatibility.md). Khi hai phía cùng thêm một schema, giữ bản là superset.                                                                                                                                                                                                                                                                        |

Sau khi giải xong, soát hai loại lỗi mà typecheck không bắt:

- Code mới của upstream tạo agent hoặc gửi prompt mà không qua entrypoint `*Authorized` hay thiếu
  role fields: `rg "\.(streamAgent|steerOrReplaceActiveTurn|tryRunOutOfBand)\(" packages/server/src`
  và so danh sách caller với `main`.
- Permission mở rộng: diff `packages/server/src/server/authorization/operation-permissions.ts` với
  `main` theo từng permission. Upstream 0.8 mở `hub.execute` từ 8 operation `hub.execution.*` lên
  toàn bộ agent lifecycle; downstream nhận nguyên trạng vì quyền đó tắt tới khi Human grant.

## Test đỏ giả

Bốn nguyên nhân môi trường đã gặp; loại chúng trước khi coi test đỏ là regression:

- `PASEO_FORCE_BYPASS` mặc định bật và đổi hành vi role/mode. Chạy server test với
  `PASEO_FORCE_BYPASS=0` (script đã đặt sẵn).
- Node 25 có `localStorage` built-in che bản của jsdom. Chạy app test với
  `NODE_OPTIONS=--no-experimental-webstorage` (script đã đặt sẵn).
- Test dựng daemon thật phải truyền `trustedSembleRuntime: null` vào `createPaseoDaemon`, nếu không
  daemon test cài semble qua mạng và treo khi offline.
- Test dựng `ProviderSnapshotManager` thật phải tắt mọi builtin của downstream, kể cả `omp` và
  `gemini-antigravity`. Test upstream chỉ tắt builtin của upstream, nên suite đi probe CLI thật trên
  máy: chạy hàng phút và timeout ngẫu nhiên. Test upstream dùng `pi` hoặc `opencode` làm provider
  thì đổi sang `gemini-antigravity` (catalog theo workspace) hoặc `codex` (catalog theo host).

`packages/cli/tests/*.test.ts` chạy bằng `tsx tests/run-all.ts`, không phải vitest. Trong
`scripts/*.test.mjs`, `merge-mac-manifest` và `validate-desktop-manifests` dùng vitest, phần còn lại
dùng `node --test`.

## Khi không có CI

Bước 5 và 6 là toàn bộ verification source-level. Ghi rõ trong record những suite không chạy được
local: CLI `test:local`, Playwright, desktop, website (`workerd`), portable qualification, Nix hash
(`./scripts/update-nix.sh` cần `nix`).
