import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type {
  CoordinationSignal,
  CoordinationSignalResolution,
} from "@getpaseo/protocol/coordination-signal";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { useSessionStore } from "@/stores/session-store";

const RESOLUTIONS: readonly CoordinationSignalResolution[] = [
  "acknowledged",
  "deferred",
  "declined",
  "completed",
];

// Bounded presentation only: daemon storage is never mutated or capped. Every pending
// signal is always shown; only the history list (already-resolved signals) is bounded.
const HISTORY_DISPLAY_LIMIT = 5;

function signalRecencyTimestamp(signal: CoordinationSignal): number {
  const value = signal.resolvedAt ?? signal.lastOccurredAt ?? signal.createdAt;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function selectVisibleSignals(signals: readonly CoordinationSignal[]): {
  visible: CoordinationSignal[];
  hiddenHistoryCount: number;
} {
  const pending = signals.filter((signal) => signal.status === "pending");
  const history = signals
    .filter((signal) => signal.status !== "pending")
    .slice()
    .sort((a, b) => signalRecencyTimestamp(b) - signalRecencyTimestamp(a));
  const visibleHistory = history.slice(0, HISTORY_DISPLAY_LIMIT);
  return {
    visible: [...pending, ...visibleHistory],
    hiddenHistoryCount: history.length - visibleHistory.length,
  };
}

function resolveStatusLabel(
  status: CoordinationSignal["status"],
  t: (key: string) => string,
): string {
  return t(`agentPanel.coordinationSignals.status.${status}`);
}

function resolveStatusVariant(status: CoordinationSignal["status"]): StatusBadgeVariant {
  if (status === "pending") return "warning";
  if (status === "declined") return "error";
  if (status === "acknowledged" || status === "completed") return "success";
  return "muted";
}

function resolveKindLabel(kind: CoordinationSignal["kind"], t: (key: string) => string): string {
  return t(`agentPanel.coordinationSignals.kind.${kind}`);
}

function pendingKeyFor(signalId: string, resolution: CoordinationSignalResolution): string {
  return `${signalId}:${resolution}`;
}

function useResolveCoordinationSignal(serverId: string) {
  const { t } = useTranslation();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [errorBySignalId, setErrorBySignalId] = useState<Record<string, string>>({});
  // Global dispatch guard: only one resolve mutation may be in flight at a time, across
  // every signal in this section. A ref (not state) is required because it must reject a
  // second dispatch synchronously, before the React state update from the first call
  // commits.
  const dispatchInFlightRef = useRef(false);

  const resolve = useCallback(
    async (input: {
      agentId: string;
      signalId: string;
      resolution: CoordinationSignalResolution;
    }) => {
      if (dispatchInFlightRef.current) {
        return;
      }
      dispatchInFlightRef.current = true;
      setPendingKey(pendingKeyFor(input.signalId, input.resolution));
      setErrorBySignalId((prev) => {
        if (!prev[input.signalId]) return prev;
        const next = { ...prev };
        delete next[input.signalId];
        return next;
      });
      try {
        const client = useSessionStore.getState().sessions[serverId]?.client;
        if (!client) {
          setErrorBySignalId((prev) => ({
            ...prev,
            [input.signalId]: t("common.errors.daemonClientUnavailable"),
          }));
          return;
        }
        await client.resolveCoordinationSignal(input);
      } catch (error) {
        setErrorBySignalId((prev) => ({
          ...prev,
          [input.signalId]: error instanceof Error ? error.message : String(error),
        }));
      } finally {
        dispatchInFlightRef.current = false;
        setPendingKey(null);
      }
    },
    [serverId, t],
  );

  return { resolve, pendingKey, errorBySignalId };
}

function CoordinationSignalResolveButton({
  agentId,
  signalId,
  resolution,
  resolve,
  isLoading,
  isRowBusy,
}: {
  agentId: string;
  signalId: string;
  resolution: CoordinationSignalResolution;
  resolve: (input: {
    agentId: string;
    signalId: string;
    resolution: CoordinationSignalResolution;
  }) => void;
  isLoading: boolean;
  isRowBusy: boolean;
}) {
  const { t } = useTranslation();

  const handlePress = useCallback(
    () => resolve({ agentId, signalId, resolution }),
    [resolve, agentId, signalId, resolution],
  );

  return (
    <Button
      size="sm"
      variant="outline"
      loading={isLoading}
      disabled={isRowBusy}
      onPress={handlePress}
      accessibilityLabel={t("agentPanel.coordinationSignals.resolveAccessibilityLabel", {
        resolution: t(`agentPanel.coordinationSignals.resolution.${resolution}`),
      })}
    >
      {t(`agentPanel.coordinationSignals.resolution.${resolution}`)}
    </Button>
  );
}

function CoordinationSignalResolveControls({
  agentId,
  signal,
  resolve,
  pendingKey,
}: {
  agentId: string;
  signal: CoordinationSignal;
  resolve: (input: {
    agentId: string;
    signalId: string;
    resolution: CoordinationSignalResolution;
  }) => void;
  pendingKey: string | null;
}) {
  // Resolve mutations are serialized globally (see useResolveCoordinationSignal): while
  // any disposition is in flight for any signal, every other disposition control across
  // every row is disabled, not just the ones on this row.
  const isAnyResolveInFlight = pendingKey !== null;

  return (
    <View style={styles.actions} accessibilityRole="none">
      {RESOLUTIONS.map((resolution) => (
        <CoordinationSignalResolveButton
          key={resolution}
          agentId={agentId}
          signalId={signal.id}
          resolution={resolution}
          resolve={resolve}
          isLoading={pendingKey === pendingKeyFor(signal.id, resolution)}
          isRowBusy={isAnyResolveInFlight}
        />
      ))}
    </View>
  );
}

function CoordinationSignalRow({
  signal,
  agentId,
  canResolve,
  resolve,
  pendingKey,
  errorMessage,
}: {
  signal: CoordinationSignal;
  agentId: string;
  canResolve: boolean;
  resolve: (input: {
    agentId: string;
    signalId: string;
    resolution: CoordinationSignalResolution;
  }) => void;
  pendingKey: string | null;
  errorMessage: string | undefined;
}) {
  const { t } = useTranslation();
  const evidenceRefs = signal.evidenceRefs;
  const evidenceEntries = signal.evidence ? Object.entries(signal.evidence) : [];
  const occurrenceCount = signal.occurrenceCount ?? 1;
  const showResolveControls = canResolve && signal.status === "pending";

  return (
    <View style={styles.row} testID={`coordination-signal-${signal.id}`}>
      <View style={styles.headerRow}>
        <Text style={styles.kind}>{resolveKindLabel(signal.kind, t)}</Text>
        <StatusBadge
          label={resolveStatusLabel(signal.status, t)}
          variant={resolveStatusVariant(signal.status)}
        />
      </View>
      <Text style={styles.reason}>
        {t("agentPanel.coordinationSignals.reasonLabel")}: {signal.reason}
      </Text>
      {signal.observation ? (
        <Text style={styles.detail}>
          {t("agentPanel.coordinationSignals.observationLabel")}: {signal.observation}
        </Text>
      ) : null}
      {signal.question ? (
        <Text style={styles.detail}>
          {t("agentPanel.coordinationSignals.questionLabel")}: {signal.question}
        </Text>
      ) : null}
      {evidenceRefs.length > 0 ? (
        <Text style={styles.evidence} numberOfLines={2}>
          {t("agentPanel.coordinationSignals.evidenceLabel")}: {evidenceRefs.join(", ")}
        </Text>
      ) : null}
      {evidenceEntries.length > 0 ? (
        <Text style={styles.evidence} numberOfLines={2}>
          {t("agentPanel.coordinationSignals.evidenceDetailLabel")}:{" "}
          {evidenceEntries.map(([key, value]) => `${key}=${String(value)}`).join(", ")}
        </Text>
      ) : null}
      <Text style={styles.meta}>
        {t("agentPanel.coordinationSignals.occurrenceCount", { count: occurrenceCount })}
        {signal.lastOccurredAt
          ? ` · ${t("agentPanel.coordinationSignals.lastOccurredAt", { time: signal.lastOccurredAt })}`
          : ""}
      </Text>
      {showResolveControls ? (
        <CoordinationSignalResolveControls
          agentId={agentId}
          signal={signal}
          resolve={resolve}
          pendingKey={pendingKey}
        />
      ) : null}
      {errorMessage ? (
        <Alert
          variant="error"
          title={t("agentPanel.coordinationSignals.resolveErrorLabel")}
          description={errorMessage}
          testID={`coordination-signal-${signal.id}-error`}
        />
      ) : null}
    </View>
  );
}

export function CoordinationSignalsSection({
  signals,
  agentId,
  serverId,
  canResolve = false,
}: {
  signals: readonly CoordinationSignal[] | undefined;
  agentId?: string;
  serverId?: string;
  canResolve?: boolean;
}) {
  const { t } = useTranslation();
  const featureEnabled = useSessionStore((state) =>
    serverId
      ? state.sessions[serverId]?.serverInfo?.features?.coordinationSignalResolution === true
      : false,
  );
  const hasClient = useSessionStore((state) =>
    serverId ? state.sessions[serverId]?.client != null : false,
  );
  const { resolve, pendingKey, errorBySignalId } = useResolveCoordinationSignal(serverId ?? "");

  if (!signals || signals.length === 0) return null;

  const resolveEnabled =
    canResolve && featureEnabled && hasClient && Boolean(agentId) && Boolean(serverId);
  const { visible, hiddenHistoryCount } = selectVisibleSignals(signals);

  return (
    <View style={styles.container} testID="coordination-signals-section">
      <Text style={styles.title} accessibilityRole="header">
        {t("agentPanel.coordinationSignals.title")}
      </Text>
      {visible.map((signal) => (
        <CoordinationSignalRow
          key={signal.id}
          signal={signal}
          agentId={agentId ?? ""}
          canResolve={resolveEnabled}
          resolve={resolve}
          pendingKey={pendingKey}
          errorMessage={errorBySignalId[signal.id]}
        />
      ))}
      {hiddenHistoryCount > 0 ? (
        <Text style={styles.meta} testID="coordination-signals-hidden-history-count">
          {t("agentPanel.coordinationSignals.hiddenHistoryCount", { count: hiddenHistoryCount })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
  title: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foregroundMuted,
  },
  row: {
    gap: theme.spacing[1],
    paddingVertical: theme.spacing[2],
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing[2],
  },
  kind: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  reason: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  detail: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  evidence: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  meta: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.foregroundExtraMuted,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing[2],
    marginTop: theme.spacing[1],
  },
}));
