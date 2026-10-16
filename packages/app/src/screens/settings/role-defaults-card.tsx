import { useCallback, useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { ProviderSnapshotEntry } from "@getpaseo/protocol/agent-types";
import type { MutableDaemonConfigPatch, RoleDefaults } from "@getpaseo/protocol/messages";
import type { PaseoRoleId } from "@getpaseo/protocol/role-binding";
import type { AssignmentEffectClass } from "@getpaseo/protocol/assignment-contract";
import { SelectField, type SelectFieldOption } from "@/components/ui/select-field";
import { useDaemonConfig } from "@/hooks/use-daemon-config";
import { useProvidersSnapshot } from "@/hooks/use-providers-snapshot";
import { useHostFeature } from "@/runtime/host-features";
import { settingsStyles } from "@/styles/settings";
import {
  defaultAssignmentEffectForRole,
  ordinaryAssignmentAuthorityOptionsForRole,
} from "@/workspace-protocol/assignment-authority";
import {
  resolveRoleDefaultRoute,
  withDefaultLeadRoute,
  withRoleLaunchDefaults,
} from "@/workspace-protocol/role-defaults";

const NONE = "__none__";

const DEFAULT_ROLE_OPTIONS: SelectFieldOption<string>[] = [
  { id: NONE, value: NONE, label: "No role", description: "Plain agent" },
  { id: "supervisor", value: "supervisor", label: "Supervisor" },
  { id: "lead", value: "lead", label: "Lead" },
  { id: "peer", value: "peer", label: "Peer" },
];

function findModel(entries: readonly ProviderSnapshotEntry[] | undefined, route: string) {
  const slash = route.indexOf("/");
  const provider = route.slice(0, slash);
  const modelId = route.slice(slash + 1);
  const entry = entries?.find((candidate) => candidate.provider === provider);
  return { entry, model: entry?.models?.find((candidate) => candidate.id === modelId) };
}

function routeLabel(entries: readonly ProviderSnapshotEntry[] | undefined, route: string): string {
  const { entry, model } = findModel(entries, route);
  return `${entry?.label ?? route.slice(0, route.indexOf("/"))} · ${model?.label ?? route.slice(route.indexOf("/") + 1)}`;
}

function buildModelOptions(
  entries: readonly ProviderSnapshotEntry[] | undefined,
  roleId: PaseoRoleId,
  noneLabel: string,
): SelectFieldOption<string>[] {
  const options = (entries ?? []).flatMap((entry) => {
    if (entry.enabled === false || entry.status !== "ready") return [];
    const roles = entry.roleBinding?.roleIds;
    if (roles && !roles.includes(roleId)) return [];
    return (entry.models ?? []).map((model) => {
      const route = `${entry.provider}/${model.id}`;
      return {
        id: route,
        value: route,
        label: `${entry.label ?? entry.provider} · ${model.label}`,
        description: route,
        testID: `role-default-${roleId}-model-${route}`,
      };
    });
  });
  return [{ id: NONE, value: NONE, label: noneLabel }, ...options];
}

function buildEffortOptions(
  entries: readonly ProviderSnapshotEntry[] | undefined,
  route: string | undefined,
): SelectFieldOption<string>[] {
  const thinking = route ? (findModel(entries, route).model?.thinkingOptions ?? []) : [];
  return [
    { id: NONE, value: NONE, label: "Model default" },
    ...thinking.map((option) => {
      const effort: SelectFieldOption<string> = {
        id: option.id,
        value: option.id,
        label: option.label,
      };
      if (option.description) effort.description = option.description;
      return effort;
    }),
  ];
}

function display(options: SelectFieldOption<string>[], value: string) {
  const option = options.find((candidate) => candidate.value === value);
  return option ? { label: option.label } : { label: value };
}

function RoleLaunchRow({
  roleId,
  title,
  hint,
  route,
  thinkingOptionId,
  assignmentEffect,
  entries,
  isLoading,
  disabled,
  onChangeRoute,
  onChangeThinking,
  onChangeAuthority,
}: {
  roleId: "supervisor" | "lead";
  title: string;
  hint: string;
  route: string | undefined;
  thinkingOptionId: string | undefined;
  assignmentEffect: AssignmentEffectClass | undefined;
  entries: readonly ProviderSnapshotEntry[] | undefined;
  isLoading: boolean;
  disabled: boolean;
  onChangeRoute: (route: string | null) => void;
  onChangeThinking: (thinkingOptionId: string | null) => void;
  onChangeAuthority: (assignmentEffect: AssignmentEffectClass) => void;
}) {
  const authorityOptions = useMemo<SelectFieldOption<AssignmentEffectClass>[]>(
    () =>
      ordinaryAssignmentAuthorityOptionsForRole(roleId).map((option) => ({
        id: option.id,
        value: option.id,
        label: option.label,
        description: option.description,
        testID: `role-default-${roleId}-authority-${option.id}`,
      })),
    [roleId],
  );
  const authorityValue = assignmentEffect ?? defaultAssignmentEffectForRole(roleId);
  const authorityDisplay = useMemo(
    () => ({
      label:
        authorityOptions.find((option) => option.value === authorityValue)?.label ?? authorityValue,
    }),
    [authorityOptions, authorityValue],
  );
  const modelOptions = useMemo(
    () => buildModelOptions(entries, roleId, roleId === "lead" ? "Inherit caller" : "No default"),
    [entries, roleId],
  );
  const effortOptions = useMemo(() => buildEffortOptions(entries, route), [entries, route]);
  const handleRoute = useCallback(
    (value: string) => onChangeRoute(value === NONE ? null : value),
    [onChangeRoute],
  );
  const handleThinking = useCallback(
    (value: string) => onChangeThinking(value === NONE ? null : value),
    [onChangeThinking],
  );
  const effortValue = thinkingOptionId ?? NONE;
  const modelDisplay = useMemo(
    () => (route ? { label: routeLabel(entries, route) } : display(modelOptions, NONE)),
    [entries, modelOptions, route],
  );
  const effortDisplay = useMemo(
    () => display(effortOptions, effortValue),
    [effortOptions, effortValue],
  );
  return (
    <View
      style={[settingsStyles.row, settingsStyles.rowBorder, styles.launchRow]}
      testID={`role-defaults-${roleId}`}
    >
      <View style={settingsStyles.rowContent}>
        <Text style={settingsStyles.rowTitle}>{title}</Text>
        <Text style={settingsStyles.rowHint}>{hint}</Text>
      </View>
      <View style={styles.controls}>
        <View style={styles.modelControl}>
          <SelectField
            label={`${title} model`}
            value={route ?? NONE}
            selectedDisplay={modelDisplay}
            options={modelOptions}
            onChange={handleRoute}
            placeholder="Choose model"
            emptyText="No models available"
            loading={isLoading}
            disabled={disabled}
            searchable
            searchPlaceholder="Search models"
            title={`${title} model`}
            size="sm"
            field={false}
            triggerTestID={`role-default-${roleId}-model-trigger`}
          />
        </View>
        <View style={styles.effortControl}>
          <SelectField
            label={`${title} effort`}
            value={effortValue}
            selectedDisplay={effortDisplay}
            options={effortOptions}
            onChange={handleThinking}
            placeholder="Effort"
            emptyText="This model has no effort levels"
            disabled={disabled || !route}
            title={`${title} effort`}
            size="sm"
            field={false}
            triggerTestID={`role-default-${roleId}-effort-trigger`}
          />
        </View>
        <View style={styles.authorityControl}>
          <SelectField
            label={`${title} authority`}
            value={authorityValue}
            selectedDisplay={authorityDisplay}
            options={authorityOptions}
            onChange={onChangeAuthority}
            placeholder="Authority"
            emptyText="No authority options"
            disabled={disabled}
            title={`${title} authority`}
            size="sm"
            field={false}
            triggerTestID={`role-default-${roleId}-authority-trigger`}
          />
        </View>
      </View>
    </View>
  );
}

export function RoleDefaultsCard({ serverId }: { serverId: string }) {
  const { config, patchConfig } = useDaemonConfig(serverId);
  const { entries, isLoading } = useProvidersSnapshot(serverId, { cwd: null });
  const isSupported = useHostFeature(serverId, "roleDefaults");
  const [isSaving, setIsSaving] = useState(false);
  const roleDefaults = config?.roleDefaults;

  const save = useCallback(
    async (patch: MutableDaemonConfigPatch) => {
      setIsSaving(true);
      try {
        await patchConfig(patch);
      } catch (error) {
        Alert.alert(
          "Could not save role defaults",
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setIsSaving(false);
      }
    },
    [patchConfig],
  );

  const saveRoleDefaults = useCallback(
    (next: RoleDefaults) => void save({ roleDefaults: next }),
    [save],
  );

  const handleDefaultRole = useCallback(
    (value: string) =>
      saveRoleDefaults({
        ...roleDefaults,
        defaultRole: value === NONE ? null : (value as PaseoRoleId),
      }),
    [roleDefaults, saveRoleDefaults],
  );

  const handleSupervisorRoute = useCallback(
    (route: string | null) =>
      saveRoleDefaults(
        withRoleLaunchDefaults(roleDefaults, "supervisor", { route, thinkingOptionId: null }),
      ),
    [roleDefaults, saveRoleDefaults],
  );
  const handleSupervisorThinking = useCallback(
    (thinkingOptionId: string | null) =>
      saveRoleDefaults(withRoleLaunchDefaults(roleDefaults, "supervisor", { thinkingOptionId })),
    [roleDefaults, saveRoleDefaults],
  );
  const handleLeadRoute = useCallback(
    (route: string | null) =>
      void save({
        leadRoutes: withDefaultLeadRoute(config?.leadRoutes, route),
        roleDefaults: withRoleLaunchDefaults(roleDefaults, "lead", { thinkingOptionId: null }),
      }),
    [config?.leadRoutes, roleDefaults, save],
  );
  const handleSupervisorAuthority = useCallback(
    (assignmentEffect: AssignmentEffectClass) =>
      saveRoleDefaults(withRoleLaunchDefaults(roleDefaults, "supervisor", { assignmentEffect })),
    [roleDefaults, saveRoleDefaults],
  );
  const handleLeadAuthority = useCallback(
    (assignmentEffect: AssignmentEffectClass) =>
      saveRoleDefaults(withRoleLaunchDefaults(roleDefaults, "lead", { assignmentEffect })),
    [roleDefaults, saveRoleDefaults],
  );
  const handleLeadThinking = useCallback(
    (thinkingOptionId: string | null) =>
      saveRoleDefaults(withRoleLaunchDefaults(roleDefaults, "lead", { thinkingOptionId })),
    [roleDefaults, saveRoleDefaults],
  );

  if (!isSupported) {
    return (
      <View style={settingsStyles.card} testID="role-defaults-card">
        <View style={settingsStyles.row}>
          <View style={settingsStyles.rowContent}>
            <Text style={settingsStyles.rowTitle}>Role defaults</Text>
            <Text style={settingsStyles.rowHint}>
              Update the daemon to choose the default role, model, and effort.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const defaultRoleValue = roleDefaults?.defaultRole ?? NONE;
  return (
    <View style={settingsStyles.card} testID="role-defaults-card">
      <View style={settingsStyles.row}>
        <View style={settingsStyles.rowContent}>
          <Text style={settingsStyles.rowTitle}>Default role</Text>
          <Text style={settingsStyles.rowHint}>Role preselected when you start a new agent.</Text>
        </View>
        <View style={styles.modelControl}>
          <SelectField
            label="Default role"
            value={defaultRoleValue}
            selectedDisplay={display(DEFAULT_ROLE_OPTIONS, defaultRoleValue)}
            options={DEFAULT_ROLE_OPTIONS}
            onChange={handleDefaultRole}
            placeholder="No role"
            emptyText="No roles"
            disabled={isSaving}
            title="Default role"
            size="sm"
            field={false}
            triggerTestID="role-default-role-trigger"
          />
        </View>
      </View>
      <RoleLaunchRow
        roleId="supervisor"
        title="Supervisor"
        hint="Used for new Supervisors. Model and effort also apply when another agent creates one."
        route={resolveRoleDefaultRoute(config, "supervisor")}
        thinkingOptionId={roleDefaults?.supervisor?.thinkingOptionId}
        assignmentEffect={roleDefaults?.supervisor?.assignmentEffect}
        entries={entries}
        isLoading={isLoading}
        disabled={isSaving}
        onChangeRoute={handleSupervisorRoute}
        onChangeThinking={handleSupervisorThinking}
        onChangeAuthority={handleSupervisorAuthority}
      />
      <RoleLaunchRow
        roleId="lead"
        title="Lead"
        hint="Used for new Leads. The model is the first route in Lead model below."
        route={resolveRoleDefaultRoute(config, "lead")}
        thinkingOptionId={roleDefaults?.lead?.thinkingOptionId}
        assignmentEffect={roleDefaults?.lead?.assignmentEffect}
        entries={entries}
        isLoading={isLoading}
        disabled={isSaving}
        onChangeRoute={handleLeadRoute}
        onChangeThinking={handleLeadThinking}
        onChangeAuthority={handleLeadAuthority}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  launchRow: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: theme.spacing[3],
  },
  controls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing[2],
  },
  modelControl: { width: 230, maxWidth: "100%" },
  effortControl: { width: 130 },
  authorityControl: { width: 170 },
}));
