import { describe, expect, test } from "vitest";

import type { AgentTimelineItem } from "./agent-sdk-types.js";
import { InMemoryAgentTimelineStore } from "./agent-timeline-store.js";
import { reconcileProviderHistory } from "./history-reconciliation.js";

const user = (text: string, id?: string) => ({
  type: "user_message" as const,
  text,
  ...(id ? { clientMessageId: id } : {}),
});

describe("reconcileProviderHistory", () => {
  test("puts missing provider prefix before a newer durable suffix while preserving suffix metadata", () => {
    const rows = reconcileProviderHistory(
      [
        {
          seq: 2,
          timestamp: "2026-01-02T00:00:00.000Z",
          item: user("suffix", "suffix"),
          turnId: "turn-1",
          providerMessageId: "p-suffix",
        },
      ],
      [
        { item: user("prefix"), timestamp: "2026-01-01T00:00:00.000Z" },
        { item: user("suffix"), timestamp: "2026-01-02T00:00:00.000Z" },
      ],
    );
    expect(rows).toMatchObject([
      { seq: 1, item: { text: "prefix" } },
      {
        seq: 2,
        turnId: "turn-1",
        providerMessageId: "p-suffix",
        item: { text: "suffix", clientMessageId: "suffix" },
      },
    ]);
  });

  test("pairs repeated identical user text by ordered occurrence", () => {
    const rows = reconcileProviderHistory(
      [
        {
          seq: 1,
          timestamp: "2026-01-01T00:00:00.000Z",
          item: user("same", "one"),
          turnId: "turn-1",
        },
        {
          seq: 2,
          timestamp: "2026-01-02T00:00:00.000Z",
          item: user("same", "two"),
          turnId: "turn-2",
        },
      ],
      [{ item: user("same") }, { item: user("same") }],
    );
    expect(
      rows.map((row) => [
        row.item.type === "user_message" ? row.item.clientMessageId : null,
        row.turnId,
      ]),
    ).toEqual([
      ["one", "turn-1"],
      ["two", "turn-2"],
    ]);
  });

  test("retains a canonical suffix when provider history is lagging", () => {
    const rows = reconcileProviderHistory(
      [
        {
          seq: 1,
          timestamp: "2026-01-01T00:00:00.000Z",
          item: user("initial", "initial"),
          turnId: "turn-1",
        },
        {
          seq: 2,
          timestamp: "2026-01-02T00:00:00.000Z",
          item: user("hello", "hello"),
          turnId: "turn-1",
        },
      ],
      [{ item: user("initial") }],
    );

    expect(rows).toMatchObject([
      { seq: 1, item: { text: "initial", clientMessageId: "initial" }, turnId: "turn-1" },
      { seq: 2, item: { text: "hello", clientMessageId: "hello" }, turnId: "turn-1" },
    ]);
  });

  test("does not transfer provider identity between ambiguous repeated prompts", () => {
    const rows = reconcileProviderHistory(
      [
        {
          seq: 1,
          timestamp: "2026-01-01T00:00:00.000Z",
          item: user("same", "one"),
          turnId: "turn-1",
        },
        {
          seq: 2,
          timestamp: "2026-01-02T00:00:00.000Z",
          item: user("same", "two"),
          turnId: "turn-2",
        },
      ],
      [{ item: { type: "user_message", text: "same", messageId: "provider-two" } }],
    );

    expect(rows).toMatchObject([
      { item: { clientMessageId: "one" }, turnId: "turn-1" },
      { item: { clientMessageId: "two" }, turnId: "turn-2" },
    ]);
    expect(rows.some((row) => row.providerMessageId === "provider-two")).toBe(false);
  });

  test("does not invent turn membership for provider-only rows", () => {
    expect(
      reconcileProviderHistory([], [{ item: { type: "assistant_message", text: "provider" } }])[0]
        ?.turnId,
    ).toBeUndefined();
  });

  test("clears unmatched rows for an authoritative forced history", () => {
    expect(
      reconcileProviderHistory(
        [{ seq: 1, timestamp: "now", item: user("old", "old"), turnId: "turn-1" }],
        [],
        { mode: "force" },
      ),
    ).toEqual([]);
  });
  test("reconciles projected rows so the next live sequence follows every retained row", () => {
    const timestamp = "2026-09-25T00:00:00.000Z";
    const toolCall = (status: "running" | "completed"): AgentTimelineItem => ({
      type: "tool_call",
      callId: "call-1",
      name: "Bash",
      status,
      detail: { type: "unknown", input: null, output: null },
      error: null,
    });
    const store = new InMemoryAgentTimelineStore();
    store.initialize("agent", {
      rows: [
        { seq: 1, timestamp, item: { type: "user_message", text: "hi", messageId: "m1" } },
        { seq: 2, timestamp, item: { type: "assistant_message", text: "Hel" } },
        { seq: 3, timestamp, item: { type: "assistant_message", text: "lo" } },
        { seq: 4, timestamp, item: toolCall("running") },
        { seq: 5, timestamp, item: toolCall("completed") },
        { seq: 6, timestamp, item: { type: "assistant_message", text: "done" } },
      ],
    });
    const projected = store.getRows("agent");

    const rows = reconcileProviderHistory(
      projected,
      projected.map((row) => ({ item: row.item, timestamp: row.timestamp })),
    );
    store.initialize("agent", { epoch: store.getEpoch("agent"), rows });
    const live = store.append("agent", { type: "user_message", text: "next" });

    for (const row of rows) expect(row).not.toHaveProperty("seqStart");
    expect(rows.map((row) => row.seq)).toEqual([1, 2, 3, 4]);
    expect(Math.max(...store.getRows("agent").map((row) => row.seqEnd))).toBe(live.seq);
  });
});
