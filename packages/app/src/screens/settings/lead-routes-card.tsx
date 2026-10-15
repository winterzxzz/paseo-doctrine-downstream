import { useCallback, useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { ArrowDown, ArrowUp, X } from "lucide-react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import type { ProviderSnapshotEntry } from "@getpaseo/protocol/agent-types";
import { Button } from "@/components/ui/button";
import { SelectField, type SelectFieldOption } from "@/components/ui/select-field";
import { useDaemonConfig } from "@/hooks/use-daemon-config";
import { useProvidersSnapshot } from "@/hooks/use-providers-snapshot";
import { useHostFeature } from "@/runtime/host-features";
import { settingsStyles } from "@/styles/settings";
import { ICON_SIZE, type Theme } from "@/styles/theme";

const ThemedArrowUp = withUnistyles(ArrowUp);
const ThemedArrowDown = withUnistyles(ArrowDown);
const ThemedX = withUnistyles(X);
const mutedColorMapping = (theme: Theme) => ({ color: theme.colors.foregroundMuted });
const moveUpIcon = <ThemedArrowUp size={ICON_SIZE.sm} uniProps={mutedColorMapping} />;
const moveDownIcon = <ThemedArrowDown size={ICON_SIZE.sm} uniProps={mutedColorMapping} />;
const removeIcon = <ThemedX size={ICON_SIZE.sm} uniProps={mutedColorMapping} />;

const EMPTY_ROUTES: readonly string[] = [];

function splitRoute(route: string): { provider: string; model: string } {
  const slash = route.indexOf("/");
  return { provider: route.slice(0, slash), model: route.slice(slash + 1) };
}

function describeRoute(
  route: string,
  entries: readonly ProviderSnapshotEntry[] | undefined,
): { label: string; available: boolean } {
  const { provider, model } = splitRoute(route);
  const entry = entries?.find((candidate) => candidate.provider === provider);
  const definition = entry?.models?.find((candidate) => candidate.id === model);
  return {
    label: `${entry?.label ?? provider} · ${definition?.label ?? model}`,
    available: entry?.enabled !== false && entry?.status === "ready" && definition !== undefined,
  };
}

function LeadRouteRow({
  route,
  label,
  available,
  rank,
  isFirst,
  isLast,
  disabled,
  onMove,
  onRemove,
}: {
  route: string;
  label: string;
  available: boolean;
  rank: number;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  onMove: (route: string, offset: -1 | 1) => void;
  onRemove: (route: string) => void;
}) {
  const handleMoveUp = useCallback(() => onMove(route, -1), [onMove, route]);
  const handleMoveDown = useCallback(() => onMove(route, 1), [onMove, route]);
  const handleRemove = useCallback(() => onRemove(route), [onRemove, route]);
  return (
    <View style={styles.routeRow} testID={`lead-route-${route}`}>
      <Text style={styles.routeRank}>{rank}</Text>
      <View style={styles.routeCopy}>
        <Text style={styles.routeLabel}>{label}</Text>
        <Text style={styles.routeMeta}>
          {isFirst ? "Default" : "Fallback"} · {route}
        </Text>
        {available ? null : (
          <Text style={styles.unavailable}>Provider or model is unavailable</Text>
        )}
      </View>
      <View style={styles.routeActions}>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={moveUpIcon}
          onPress={handleMoveUp}
          disabled={disabled || isFirst}
          accessibilityLabel={`Move ${label} up in Lead routes`}
          testID={`lead-route-up-${route}`}
        />
        <Button
          variant="ghost"
          size="sm"
          leftIcon={moveDownIcon}
          onPress={handleMoveDown}
          disabled={disabled || isLast}
          accessibilityLabel={`Move ${label} down in Lead routes`}
          testID={`lead-route-down-${route}`}
        />
        <Button
          variant="ghost"
          size="sm"
          leftIcon={removeIcon}
          onPress={handleRemove}
          disabled={disabled}
          accessibilityLabel={`Remove ${label} from Lead routes`}
          testID={`lead-route-remove-${route}`}
        />
      </View>
    </View>
  );
}

export function LeadRoutesCard({ serverId }: { serverId: string }) {
  const { config, patchConfig } = useDaemonConfig(serverId);
  const { entries, isLoading } = useProvidersSnapshot(serverId, { cwd: null });
  const isSupported = useHostFeature(serverId, "leadRoutes");
  const [isSaving, setIsSaving] = useState(false);
  const routes = config?.leadRoutes ?? EMPTY_ROUTES;

  const addOptions = useMemo<SelectFieldOption<string>[]>(() => {
    const taken = new Set(routes);
    return (entries ?? []).flatMap((entry) => {
      if (entry.enabled === false || entry.status !== "ready") return [];
      return (entry.models ?? []).flatMap((model) => {
        const route = `${entry.provider}/${model.id}`;
        if (taken.has(route)) return [];
        return [
          {
            id: route,
            value: route,
            label: `${entry.label ?? entry.provider} · ${model.label}`,
            description: route,
            testID: `lead-route-option-${route}`,
          },
        ];
      });
    });
  }, [entries, routes]);

  const saveRoutes = useCallback(
    async (leadRoutes: string[]) => {
      setIsSaving(true);
      try {
        await patchConfig({ leadRoutes });
      } catch (error) {
        Alert.alert(
          "Could not save Lead model",
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setIsSaving(false);
      }
    },
    [patchConfig],
  );

  const handleAdd = useCallback(
    (route: string) => void saveRoutes([...routes, route]),
    [routes, saveRoutes],
  );

  const handleRemove = useCallback(
    (route: string) => void saveRoutes(routes.filter((candidate) => candidate !== route)),
    [routes, saveRoutes],
  );

  const handleMove = useCallback(
    (route: string, offset: -1 | 1) => {
      const index = routes.indexOf(route);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= routes.length) return;
      const next = [...routes];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      void saveRoutes(next);
    },
    [routes, saveRoutes],
  );

  if (!isSupported) {
    return (
      <View style={[settingsStyles.card, styles.card]} testID="lead-routes-card">
        <View style={settingsStyles.row}>
          <View style={settingsStyles.rowContent}>
            <Text style={settingsStyles.rowTitle}>Lead model</Text>
            <Text style={settingsStyles.rowHint}>
              Update the daemon to choose the model for agent-created Leads.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[settingsStyles.card, styles.card]} testID="lead-routes-card">
      <View style={settingsStyles.row}>
        <View style={settingsStyles.rowContent}>
          <Text style={settingsStyles.rowTitle}>Lead model</Text>
          <Text style={settingsStyles.rowHint}>
            Model used when a Supervisor or another agent launches a Lead. The first route is the
            default; later routes are fallbacks the caller must request by name. Empty means the
            Lead inherits the caller route.
          </Text>
        </View>
        <View style={styles.addControl}>
          <SelectField
            label="Add Lead model"
            value={null}
            selectedDisplay={null}
            options={addOptions}
            onChange={handleAdd}
            placeholder={routes.length === 0 ? "Choose model" : "Add fallback"}
            emptyText="No models available"
            loading={isLoading}
            disabled={isSaving}
            searchable
            searchPlaceholder="Search models"
            title="Lead model"
            size="sm"
            field={false}
            testID="lead-route-add-field"
            triggerTestID="lead-route-add-trigger"
          />
        </View>
      </View>
      {routes.length > 0 ? (
        <View style={styles.routeList} testID="lead-route-list">
          {routes.map((route, index) => {
            const { label, available } = describeRoute(route, entries);
            return (
              <LeadRouteRow
                key={route}
                route={route}
                label={label}
                available={available}
                rank={index + 1}
                isFirst={index === 0}
                isLast={index === routes.length - 1}
                disabled={isSaving}
                onMove={handleMove}
                onRemove={handleRemove}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: { overflow: "hidden" },
  addControl: {
    width: 230,
    maxWidth: "45%",
  },
  routeList: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  routeRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[3],
    paddingLeft: theme.spacing[4],
    paddingRight: theme.spacing[2],
    paddingVertical: theme.spacing[2],
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  routeRank: {
    width: theme.spacing[4],
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    textAlign: "center",
  },
  routeCopy: { flex: 1, minWidth: 0 },
  routeLabel: { color: theme.colors.foreground, fontSize: theme.fontSize.sm },
  routeMeta: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.xs },
  routeActions: { flexDirection: "row", alignItems: "center" },
  unavailable: {
    color: theme.colors.destructive,
    fontSize: theme.fontSize.xs,
    marginTop: theme.spacing[1],
  },
}));
