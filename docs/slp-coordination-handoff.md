# SLP: coordination signal và adjacent-Lead handoff

Tài liệu này mô tả cách Supervisor, Lead và Peer dùng coordination signal và handoff trong Paseo.
Nó không thay thế role contracts, Human lease hoặc repository protocol.

## Mức trưởng thành hiện tại

| Slice                  | Trạng thái                                              | Đã có                                                                                                                      | Chưa được chứng minh                                                      |
| ---------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| P0 coordination signal | Source candidate; automatic bundled policy mặc định bật | protocol, persistence, idle-boundary delivery, CLI/client/tool, SLP-owned classifier/routing/re-arm và generic kernel host | release artifact, installed/live activation, multi-day operational effect |
| P1 manual handoff      | Pilot đã chạy                                           | predecessor packet, independent successor review, rejection evidence                                                       | multi-day operational effect                                              |
| P2 handoff artifact    | Candidate, integrated-runtime-qualified                 | immutable packet core, explicit ordered receipts, role/Human gates, write-lease enforcement, paid-provider release canary  | release activation, multi-day operational effect                          |

Historical owner note: SLP v1.0 (the `.45` generation, digest
`569c7f4633b7ffacb2e63c0ee3dda1ea882bc050bc456fdc8ac0c466f4f483f0`) was an untagged, dateless
compatibility bridge and has been removed intentionally (Phase 2A / F-04). Resolving that owner now
fails closed with `bundled_policy_pack_missing`; there is no frozen artifact, no migration, and no
alias to current semantics. Only the actively registered SLP generation resolves.

Không được gọi ba slice này là shipped production capability chỉ vì focused tests xanh.

F-06 Phase 2B attention remediation là source/test candidate: focused tests, generated validator và
bundled-generation digest chỉ là receipt của source/artifact consistency. Chúng không phải installed/live
daemon evidence, WebSocket canary hoặc proof về multi-day operational effect; các lớp đó phải được
readback riêng và vẫn `UNPROVEN` nếu chưa có receipt.

Default profile chỉ project surface tối thiểu: mọi role mặc định có thể nhận attention được resolve
signal của chính mình; Supervisor có thể hỏi một bounded attention question. Các surface tạo agent,
handoff, detach hoặc send rộng hơn vẫn opt-in/denied theo authority hiện có. Default projection là source
candidate, không phải installed/live endorsement.

## Coordination signal

Coordination signal là durable advisory attention. Nó không phải prompt điều khiển và không chuyển
authority.

- Human dùng paseo agent signal.
- Role-bound Lead dùng `signal_agent` cho handoff/detach recommendation trong lease.
- Role-bound Supervisor dùng `ask_attention_question` để gửi câu hỏi attention có cấu trúc tới
  role-bound Lead hoặc Peer. Human-facing CLI dùng cùng bounded request.
- Receiving role dùng resolve_agent_signal.
- Nếu target đang chạy, daemon persist signal ngay nhưng chờ idle boundary để delivery; active run
  không bị replace.
- Manual handoff/detach recommendation chỉ target role-bound Lead.
- Bundled SLP attention dùng provider telemetry, repeated terminal failures và classifier deterministic
  trên model-visible assistant output. Nó không đọc hidden chain of thought; missing/ambiguous target
  hoặc telemetry fail closed.
- Automatic SLP policy start mặc định qua bundled-policy contribution. Emergency rollback đặt exact
  `PASEO_DISABLE_SLP_ATTENTION_POLICY=1`; manual signal và pending safe-boundary delivery không phụ thuộc
  switch này.

Ví dụ:

    paseo agent signal <lead-id> --kind handoff --reason "Context dilution after repeated reopen"
    paseo agent signal <lead-id> --kind detach --related-agent <agent-id> --reason "Review whether this child should become independent"
    paseo agent signal <peer-id> --kind question --observation "The evidence conflicts with the current conclusion." --question "What evidence supports the current conclusion?" --evidence "timeline:item-42"

Attention question bắt buộc có observation, câu hỏi kết thúc bằng `?` và ít nhất một evidence reference.
Nó không phải command, decision, acceptance hoặc ownership transfer. Peer chỉ nhận và tự resolve signal;
surface này không cấp cho Peer quyền signal/orchestrate. Agent-scoped Supervisor và target phải cùng
exact workspace. Runtime chỉ nhận một observation clause và một clarification clause bounded tới 1000
ký tự mỗi phần; không có positive allowlist grammar cố định. Câu bổ sung, imperative, modal/second-person
request, wording mang authority/external-effect shape, hoặc routing/handoff-shaped phrasing hướng về một
role (ví dụ "đưa về Lead", "back to the Lead") đều fail closed, kể cả khi diễn đạt tự nhiên bằng tiếng Anh
hoặc tiếng Việt.

Detach recommendation không promote agent. Detach thật chỉ xóa parent label và vẫn cần exact
Human-facing lifecycle action.

## Routing SLP

- Peer failure lặp lại ba lần liên tiếp route attention tới owning Lead hoặc unique workspace Lead.
- Lead failure lặp lại ba lần liên tiếp chỉ route tới unique workspace Supervisor.
- Context pressure và provider compaction route về chính Lead để Lead tự đánh giá continuity.
- Semantic friction ở visible output của Lead hoặc Peer chỉ route tới unique workspace Supervisor; nếu
  không có đúng một Supervisor thì không phát signal.
- Một context-pressure hoặc compaction event có thể tạo một advisory attention để tránh bỏ lỡ tín hiệu
  quan trọng, nhưng riêng signal đó không đủ để trigger replacement, handoff hay authority change.
- Supervisor quan sát và khuyến nghị; không seize implementation ownership.
- Lead giữ routing, integration và engineering acceptance trong Human lease.
- Peer không signal, transition hoặc tạo handoff; Peer chỉ handback evidence cho Lead.

`turn_started` chỉ reset semantic state của turn mới; nó không xóa chuỗi terminal failure. Chỉ
`turn_completed` hoặc `turn_canceled` reset failure episode, và canceled turn không được tính là failure.
Context pressure phải xuống dưới threshold trước khi crossing sau re-arm. Automatic compaction mới và
semantic fingerprint mới, kể cả trong cùng turn sau disposition, có thể tạo episode mới. Một occurrence
mới của cùng fingerprint sau disposition cũng re-arm; chỉ khi exact episode còn pending thì occurrence
evidence được merge thay vì tạo signal khác.
Pending signal chỉ coalesce trong cùng exact rule/fingerprint lane; context pressure và compaction không
được nuốt lẫn nhau.

### Cooling và corroboration

- Human explicit action không có elapsed-time cooling window. Khi frozen packet đầy đủ, successor đã
  ACK và predecessor ở safe idle boundary, Human có thể authorize hoặc release ngay.
- Automated heuristic không được đổi authority. Một signal đơn chỉ là advisory; authority-changing
  correction chỉ được đề xuất sau repeated evidence hoặc corroboration từ independent runtime state,
  durable receipt, current bytes hay một episode khác.
- Repeated terminal failure hiện dùng ngưỡng ba lần liên tiếp. Context pressure và automatic compaction
  có thể cảnh báo ngay một lần, nhưng vẫn để Lead/Human quyết định có cần handoff hay không.
- Dù evidence đã corroborated, adjacent-Lead transfer vẫn cần exact Human authorization và final Human
  release; corroboration không tự cấp lease.

## Adjacent-Lead handoff

Handoff này khác ordinary task handoff và khác detach. Nó dùng một frozen packet trước khi successor
được authorize.

Packet bắt buộc có:

- objective, scope, current state và stop condition;
- current write Owner;
- accepted decisions;
- failed approaches và successful patterns;
- concrete evidence index;
- active risks/blockers;
- exact resume point.

State flow:

    packet_ready
      -> successor_authorized
      -> successor_acknowledged
      -> predecessor_released

Successor có thể reject packet thiếu hoặc sai trước authorization. Packet core không bị rewrite sau khi
persist; chỉ coordination metadata và receipts tiến theo transition.

Authority:

- Predecessor Lead gọi prepare_lead_handoff tại bounded stop point.
- Human-facing caller designate exact role-bound successor cùng workspace và record
  successor_authorized.
- Chỉ designated successor Lead được record successor_acknowledged hoặc rejection của chính nó.
- Chỉ Human-facing caller được record predecessor_released.

Các receipt trước final release không đổi authority. `predecessor_released` chỉ được ghi ở idle boundary;
transition này đóng predecessor runtime, giữ durable record, rồi chuyển `currentWriteOwnerAgentId` sang
successor. Nếu runtime closure lỗi thì transition không được persist và Owner không đổi. Sau release,
daemon từ chối mọi prompt mới hoặc unarchive-and-prompt cho predecessor bằng
`agent_write_lease_released`. Nó không detach, archive hoặc đổi role binding; durable packet, receipts và
timeline vẫn được giữ để audit. Final release lock cả predecessor lẫn successor theo stable identity
order và revalidate successor ngay trước transfer. Existing close được join thay vì bỏ qua; close failure
được nhớ tới daemon restart và không thể biến thành success bằng retry. Close wait bị bound ở 10 giây để
không giữ successor authority lock vô hạn. Timeline audit đọc durable store mà không resume provider
runtime; mỗi timeline batch ghi durable pending manifest trước các row files. Final release reconcile
pending manifests — kể cả sau daemon restart — rồi fail closed nếu durability vẫn lỗi. Nếu boundary 10
giây timeout trước khi close bắt đầu, abort signal ngăn continuation cũ đóng predecessor về sau. Lỗi xảy
ra trước lúc manifest được tạo vẫn nằm trong daemon repair ledger và chặn release/graceful shutdown;
per-agent drain được serialize và graceful shutdown attempt mọi known repair trước khi aggregate lỗi.
Hard process loss đúng interval đó là storage-failure boundary chưa qualified, không được claim recover.
Released predecessor identity không được tái dùng làm successor; một handoff quay lại cùng người/vai trò
phải tạo fresh role-bound Lead identity để historical revocation không nhập nhằng. Durable timeline
retention áp dụng cho handoff chạy sau khi file-backed store được activate; candidate receipts cũ hơn vẫn
giữ packet/receipts nhưng không được claim có timeline backfill. Nếu runtime tools chưa available, dừng ở
manual frozen packet và báo UNKNOWN; không dùng chat prose giả làm receipt.

### Human archive là release

Human archive hoặc close (app, CLI, MCP không gắn agent) một role-bound Lead/Peer cũng là release.
`archiveAgentCommand` với `initiator: "human"` ghi durable receipt `writeLeaseRelease`
(`reason: human_archive`, `actor: human`, `roleId`, `archivedAt`, `releasedAt`) lên record
(`recordHumanArchiveWriteLeaseRelease` trong `packages/server/src/server/agent/lead-handoffs.ts`).
Archive do agent gọi `archive_agent` hoặc auto-archive không ghi receipt và không mở rộng authority.
Re-archive một agent đã archive từ Human-facing caller vẫn ghi receipt còn thiếu.
Lead/Peer con cháu bị cascade-archive cùng root đó nhận receipt `reason: human_archive_cascade` với
`triggeredByAgentId` là root; con bị detach hoặc đã archive từ trước thì không. Cascade từ archive do
agent khởi tạo không ghi receipt.

Receipt là sticky: whole-record upsert cũ không xóa được nó, và unarchive không xóa nó. Sau đó
`hasReleasedAgentWriteLease` trả true nên agent đó giống released predecessor: không resume runtime,
prompt bị từ chối bằng `agent_write_lease_released`, không làm predecessor hoặc successor của handoff
mới. Muốn quay lại vai trò đó thì tạo fresh role-bound identity.

Successor kiểm tra qua `get_agent_status` hoặc `list_agents` (`includeArchived`): `archivedAt` cộng
`writeLeaseRelease` là break-before-make evidence hợp lệ; archive không có receipt thì không phải
release. `get_agent_activity` đọc timeline của agent archived hoặc released từ durable store, không
resume, và trả `archivedAt`, `writeLeaseRelease`, `timelineSource`. Snapshot của agent đang resident
lấy `archivedAt` từ durable record, và `list_agents` ẩn agent đó khi không có `includeArchived`.

## Skill usage

Skill paseo-handoff phân loại hai lane:

- Ordinary task transfer: tạo receiving agent với self-contained briefing; agent vẫn là subagent cho tới
  khi Human detach thủ công.
- Adjacent-Lead continuity: packet first, Human authorization, successor ACK, Human release.

Skill paseo-supervisor chỉ phát hiện friction, signal và đề xuất bounded correction theo mandate. Skill
không tự cấp replacement lease. Skill paseo là lifecycle/reference plane và vẫn là nơi resolve provider,
workspace, agent và runtime status.

## Evidence

P1 rejection, rationale, isolated P2 runtime qualification và integrated P0 callable-surface canary được
giữ tại docs/research/p1-adjacent-lead-handoff-pilot-2026-08-08.md. Candidate P2 trực tiếp bắt buộc các
field mà successor đã chỉ ra là thiếu. P0 canary chứng minh native tool invocation và durable state
readback trên paid Codex Lead. Fresh staged canary chứng minh successor ACK qua deferred native tool
discovery trên source `191e4eb9a`, rồi chứng minh exact candidate `1e39d396d` giữ durable ACK qua restart,
final runtime closure, predecessor prompt revocation và durable timeline readback sau daemon restart; nó
không chứng minh exact candidate tự tạo một ACK mới. P2 qualification chứng minh ordered workflow và
durable readback trong dev daemon cô lập. Runtime lease gate đã có focused race/boundary tests và
paid-provider end-to-end release canary trên candidate branch, nhưng chưa có production qualification
hoặc multi-day evidence.
