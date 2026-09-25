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
   Khi downstream chèn cả khối test giữa vùng upstream sửa, myers căn lệch hunk; dựng lại file từ
   ba stage bằng `git merge-file --diff-algorithm=histogram --zdiff3` (0.9: `agent-manager.test.ts`
   từ 10 xuống 3 conflict).
4. **Lockfile.** Lấy `package-lock.json` phía downstream rồi chạy
   `npm install --workspaces --include-workspace-root` để npm tự dựng lại.
5. **Build trước khi tin typecheck.** `npm run build:server`, rồi `npm run typecheck`,
   `npm run lint`, `npm run format`. Git nhân đôi import khi cả hai phía cùng thêm một dòng; lỗi
   `Duplicate identifier` sau merge gần như luôn là trường hợp này. `packages/cli/tsconfig.json`
   loại test khỏi typecheck, và lệnh CLI chỉ downstream có (`chat`, `agent signal`, `update`) không
   conflict nhưng vỡ khi upstream đổi connect API: chạy vitest trực tiếp cho các file đó.
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

| Vùng                         | Quy tắc                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json` mọi workspace | Giữ downstream: `private: true`, internal dependency `*`, version downstream. Nhận dependency mới của upstream.                                                                                                                                                                                                                                                                                                                                      |
| License                      | Downstream giữ AGPL-3.0. Upstream đã chuyển Apache-2.0; text hiển thị license trong docs và website giữ AGPL.                                                                                                                                                                                                                                                                                                                                        |
| `CHANGELOG.md`               | Entry upstream đổi heading thành `## Upstream X.Y.Z - <ngày>`, nằm dưới entry downstream mới.                                                                                                                                                                                                                                                                                                                                                        |
| `README.md`                  | Giữ bản downstream.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Provider set                 | Shipped: Claude, Codex, Cursor, Antigravity và custom provider derive từ Codex (`isPaseoSupportedProvider`). Không mở lại adapter khác qua test fixture.                                                                                                                                                                                                                                                                                             |
| `AgentManager`               | Role binding, launch contract, role-scoped Paseo tool policy và các entrypoint `*Authorized` là authority. Hook và flow mới của upstream bọc quanh chúng. `buildLaunchContext` nhận `launchContract` trước descriptor `opening` của upstream. Khi flow upstream gỡ agent khỏi registry giữa chừng (reload), giữ role binding trong `roleBindingsAwaitingRegistration` tới khi đăng ký xong.                                                          |
| `ProviderSnapshotManager`    | Lấy cấu trúc upstream; gắn role-binding support vào entry và để thay đổi `roleBinding` override làm mới definition.                                                                                                                                                                                                                                                                                                                                  |
| Hub guided starter           | Fail-closed với `HUB_FOUNDATION_ADMISSION_REQUIRED`. Giữ nguyên `packages/cli/src/commands/hub/init-flow.test.ts` downstream; public Hub docs mô tả shape upstream là reference-only.                                                                                                                                                                                                                                                                |
| Plugin                       | Giữ Human-only lifecycle guard và reservation cho bundled policy ID (`slp`); check reservation chạy trước compatibility check. Lệnh CLI upstream gỡ thì gỡ theo.                                                                                                                                                                                                                                                                                     |
| MCP                          | Downstream dùng `@modelcontextprotocol/server` và `/client` v2; giữ handler downstream, chỉ nhận thay đổi hành vi của upstream.                                                                                                                                                                                                                                                                                                                      |
| App: directory replica       | Foundation receipts và archived-detail preservation sống trong `runtime/directory-sync/internal/agent-store.ts`.                                                                                                                                                                                                                                                                                                                                     |
| App: sidebar                 | Row downstream (Topology, Rooms, Councils) là builtin trong `sidebar-nav/model.ts`, có label key ở mọi locale.                                                                                                                                                                                                                                                                                                                                       |
| App: create agent            | Mọi đường tạo agent phía app mang role fields qua `composer/draft/create-agent-request.ts`. Upstream thêm đường tạo mới thì nối role fields vào. Từ 0.9, launch có role tạo workspace trước rồi mới tạo agent (assignment cần thư mục workspace thật); launch không role dùng request gộp workspace + agent của upstream; retry mang theo role fields.                                                                                               |
| App: push router             | Event broadcast không thuộc event subscribable (`council.case.updated`) nằm trên `client.on` hẹp, không đi qua `observeEvents`.                                                                                                                                                                                                                                                                                                                      |
| App: layout persistence      | Role fields của draft và tab target `topology` nằm ở `stores/workspace-layout-storage.ts`.                                                                                                                                                                                                                                                                                                                                                           |
| Desktop updater              | `_layout.tsx` render `DistributionUpdateCalloutSource`, không render updater upstream.                                                                                                                                                                                                                                                                                                                                                               |
| Protocol                     | Theo [protocol-compatibility.md](protocol-compatibility.md). Khi hai phía cùng thêm một schema, giữ bản là superset. Schema upstream tách ra module riêng (`agent-profile.ts`, `terminal-profile.ts`) thì field downstream theo sang đó, `messages.ts` re-export. Module load config (`persisted-config.ts`) import leaf module (`agent-profile`, `foundation-config`, `plugin-config`), không import `messages.ts`; `exports.test.ts` chặn điều đó. |
| Daemon lifecycle (CLI)       | Lấy cấu trúc upstream (`daemon run`, config bền vững, `daemon-control`). Ghép lại: PATH có user agent bins, stop budget 35s, field readback của `daemon status --json` (`connected*`, `source*`, `providers` dạng `{label, path}` mà Foundation qualification đọc). Installer web-cli vẫn gọi `daemon start --foreground --listen … --web-ui`, nên giữ shim `COMPAT(legacyForegroundLaunchFlags)` tới khi installer chuyển sang `daemon run`.        |
| Session delivery             | Lấy `SessionDelivery` và owned subscriptions của upstream. Permission outbound của downstream: `emitForSource` gọi `allowsOutbound` trước `authorizeReply`, đường implicit delivery cũng lọc qua `allowsOutbound`. Output correlated chỉ downstream có mà tên không theo convention (`distribution.update.progress`) phải khai báo trong `session/owned-subscriptions/replies.ts`.                                                                   |
| Durable timeline             | In-memory store của upstream project ngay khi ghi (chunk gộp thành một row). `FileAgentTimelineStore` giữ mirror canonical riêng; chỉ `fetchCommitted` trả rows đã project. Reconcile history đối chiếu rows canonical từ durable store, không bao giờ từ projected rows, và snapshot ghi rows canonical. Reload + rehydrate bắt đầu in-memory rỗng rồi replay thuần; committed timeline chỉ bị thay khi replay xong.                                |

Sau khi giải xong, soát hai loại lỗi mà typecheck không bắt:

- Code mới của upstream tạo agent hoặc gửi prompt mà không qua entrypoint `*Authorized` hay thiếu
  role fields: `rg "\.(streamAgent|steerOrReplaceActiveTurn|tryRunOutOfBand)\(" packages/server/src`
  và so danh sách caller với `main`.
- Permission mở rộng: diff `packages/server/src/server/authorization/operation-permissions.ts` với
  `main` theo từng permission. Upstream 0.8 mở `hub.execute` từ 8 operation `hub.execution.*` lên
  toàn bộ agent lifecycle, 0.9 thêm `workspace.title.set`; downstream nhận nguyên trạng vì quyền đó
  tắt tới khi Human grant.

## Test đỏ giả

Các nguyên nhân môi trường đã gặp; loại chúng trước khi coi test đỏ là regression. E2e còn đỏ thì
chạy nó trên baseline trước khi sửa code: `git worktree add --detach <dir> main` (rồi `git checkout
upstream-vX.Y.Z` cho baseline upstream), `npm ci --ignore-scripts`, `npm run build:server`. Test đỏ ở
cả baseline không phải regression của merge.

- `PASEO_FORCE_BYPASS` mặc định bật và đổi hành vi role/mode. Chạy server test với
  `PASEO_FORCE_BYPASS=0` (script đã đặt sẵn).
- Node 25 có `localStorage` built-in che bản của jsdom. Chạy app test với
  `NODE_OPTIONS=--no-experimental-webstorage` (script đã đặt sẵn).
- Test dựng daemon thật phải truyền `trustedSembleRuntime: null` vào `createPaseoDaemon`, nếu không
  daemon test cài semble qua mạng và treo khi offline. Test spawn daemon thành process riêng
  (`packages/cli/src/commands/daemon/lifecycle.e2e.test.ts`) không inject được: mỗi home mới chuẩn bị
  Semble lạnh (~60s đo được lúc tích hợp 0.9.2) nên vượt deadline readiness 30s và báo
  `DAEMON_NOT_READY`.
- Test dựng `ProviderSnapshotManager` thật phải tắt mọi builtin của downstream, kể cả `omp` và
  `gemini-antigravity`. Test upstream chỉ tắt builtin của upstream, nên suite đi probe CLI thật trên
  máy: chạy hàng phút và timeout ngẫu nhiên. Test upstream dùng `pi` hoặc `opencode` làm provider
  thì đổi sang `gemini-antigravity` (catalog theo workspace) hoặc `codex` (catalog theo host).
- Suite chạy từ bên trong một Paseo agent thừa hưởng `PASEO_AGENT_ID` và vấp Human-only guard của
  plugin/Hub. Test của các guard đó đặt `PASEO_AGENT_ID=""`.

`packages/cli/tests/*.test.ts` chạy bằng `tsx tests/run-all.ts`, không phải vitest. Trong
`scripts/*.test.mjs`, `merge-mac-manifest` và `validate-desktop-manifests` dùng vitest, phần còn lại
dùng `node --test`.

## Khi không có CI

Bước 5 và 6 là toàn bộ verification source-level. Ghi rõ trong record những suite không chạy được
local: CLI `test:local`, Playwright, desktop, website (`workerd`), portable qualification, Nix hash
(`./scripts/update-nix.sh` cần `nix`).
