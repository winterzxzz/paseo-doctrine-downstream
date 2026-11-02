import {
  loadPersistedConfig,
  savePersistedConfigAsync,
  loadPersistedConfigAsync,
  type PersistedConfig,
} from "./persisted-config.js";
import { ProviderOverrideSchema } from "./agent/provider-launch-config.js";
import {
  MutableDaemonConfigSchema,
  MutableDaemonConfigPatchSchema,
  PeerDelegationModelRouteSchema,
} from "@getpaseo/protocol/messages";
import { resolvePeerDelegationProviderPriority } from "@getpaseo/protocol/peer-delegation-priority";
import { resolveFoundationCredentialFile } from "./foundation-credential-store.js";
import { validateRoleProfilePreferencesMap } from "./policy/bundled/slp/role-profiles.js";
import type { AgentSkillSelection } from "@getpaseo/protocol/messages";
import type { SpeechSettingsPatch } from "@getpaseo/protocol/speech/rpc-schemas";
import { mergeSpeechSettingsPatch, type SpeechSettingsOwner } from "./speech/speech-settings.js";

export type { MutableDaemonConfig, MutableDaemonConfigPatch } from "@getpaseo/protocol/messages";

type MutableDaemonConfig = import("@getpaseo/protocol/messages").MutableDaemonConfig;
type MutableDaemonConfigPatch = import("@getpaseo/protocol/messages").MutableDaemonConfigPatch;
type ProviderOverride = import("./agent/provider-launch-config.js").ProviderOverride;

interface SupportedMutableConfigPatch {
  relay?: { enabled?: boolean; requireProtectedSecurity?: boolean };
  mcp?: { injectIntoAgents?: boolean };
  browserTools?: { enabled?: boolean };
  beadsCentral?: MutableDaemonConfigPatch["beadsCentral"];
  providers?: MutableDaemonConfig["providers"];
  removeProviders?: string[];
  metadataGeneration?: MutableDaemonConfig["metadataGeneration"];
  autoArchiveAfterMerge?: boolean;
  defaultFastMode?: boolean;
  enableTerminalAgentHooks?: boolean;
  idleRuntimeCleanup?: boolean;
  appendSystemPrompt?: string;
  roleProfiles?: MutableDaemonConfigPatch["roleProfiles"];
  resetRoleProfiles?: MutableDaemonConfigPatch["resetRoleProfiles"];
  peerDelegation?: MutableDaemonConfigPatch["peerDelegation"];
  peerDelegationProfileIds?: MutableDaemonConfig["peerDelegationProfileIds"];
  peerDelegationProviderPriority?: MutableDaemonConfig["peerDelegationProviderPriority"];
  peerDelegationDefaultSubrole?: MutableDaemonConfig["peerDelegationDefaultSubrole"];
  leadRoutes?: MutableDaemonConfig["leadRoutes"];
  roleDefaults?: MutableDaemonConfig["roleDefaults"];
  terminalProfiles?: MutableDaemonConfig["terminalProfiles"];
  agentProfiles?: MutableDaemonConfig["agentProfiles"];
  skills?: MutableDaemonConfig["skills"];
  pluginsEnabled?: boolean;
  plugins?: MutableDaemonConfig["plugins"];
  features?: SpeechSettingsPatch;
}

const SPEECH_PERSISTED_PATHS = ["features.dictation", "features.voiceMode"];

interface LoggerLike {
  child(bindings: Record<string, unknown>): LoggerLike;
  info(...args: unknown[]): void;
}

export interface DaemonConfigChangeDetails {
  removedProviders: readonly string[];
}

export interface DaemonConfigReloadResult {
  appliedPaths: string[];
  restartRequiredPaths: string[];
  overrideControlledPaths: string[];
}

export interface DaemonConfigReloadSource {
  resolve(persisted: PersistedConfig): {
    mutable: MutableDaemonConfig;
    overrideControlledPaths: readonly string[];
  };
}

type ConfigListener = (config: MutableDaemonConfig, details: DaemonConfigChangeDetails) => void;
type ConfigApplyRollback = () => void;
type ConfigApplyListener = (
  config: MutableDaemonConfig,
  previous: MutableDaemonConfig,
  details: DaemonConfigChangeDetails,
) => ConfigApplyRollback;
type FieldChangeHandler = (value: unknown) => void;

interface AppliedFieldChange {
  handler: FieldChangeHandler;
  previousValue: unknown;
}

function getLogger(logger: LoggerLike | undefined): LoggerLike | undefined {
  return logger?.child({ module: "daemon-config-store" });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T extends Record<string, unknown>>(
  current: T,
  patch: Record<string, unknown>,
): T {
  const next: Record<string, unknown> = { ...current };

  for (const [key, patchValue] of Object.entries(patch)) {
    if (patchValue === undefined) {
      continue;
    }
    const currentValue = next[key];
    if (isRecord(currentValue) && isRecord(patchValue)) {
      next[key] = deepMerge(currentValue, patchValue);
      continue;
    }
    next[key] = patchValue;
  }

  return next as T;
}

function omitProvidersFromConfig<T extends { providers?: Record<string, unknown> }>(
  config: T,
  providers: readonly string[],
): T {
  if (providers.length === 0 || !config.providers) {
    return config;
  }

  let changed = false;
  const nextProviders = { ...config.providers };
  for (const provider of providers) {
    if (provider in nextProviders) {
      delete nextProviders[provider];
      changed = true;
    }
  }

  return changed ? ({ ...config, providers: nextProviders } as T) : config;
}

function omitMetadataGenerationProvidersFromConfig<
  T extends { metadataGeneration?: { providers?: Array<{ provider?: unknown }> } },
>(config: T, providers: readonly string[]): T {
  if (providers.length === 0 || !config.metadataGeneration?.providers) {
    return config;
  }

  const removedProviderIds = new Set(providers);
  const nextProviders = config.metadataGeneration.providers.filter((entry) => {
    return typeof entry.provider !== "string" || !removedProviderIds.has(entry.provider);
  });
  if (nextProviders.length === config.metadataGeneration.providers.length) {
    return config;
  }

  return {
    ...config,
    metadataGeneration: {
      ...config.metadataGeneration,
      providers: nextProviders,
    },
  } as T;
}

function omitProvidersFromOverrides(
  overrides: Record<string, ProviderOverride> | undefined,
  providers: readonly string[],
): Record<string, ProviderOverride> | undefined {
  if (!overrides) {
    return undefined;
  }

  const nextOverrides = { ...overrides };
  for (const provider of providers) {
    delete nextOverrides[provider];
  }

  return Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined;
}

function getValueAtPath(config: MutableDaemonConfig, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((value, segment) => (isRecord(value) ? value[segment] : undefined), config);
}

function isEqualValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function withCredentialFileEnvironment(
  config: MutableDaemonConfig,
  paseoHome: string,
): MutableDaemonConfig {
  const providers = Object.fromEntries(
    Object.entries(config.providers).map(([providerId, provider]) => {
      if (!provider.credentialRef) return [providerId, provider];
      const credentialFile = resolveFoundationCredentialFile(paseoHome, provider.credentialRef);
      return [
        providerId,
        {
          ...provider,
          env: {
            ...provider.env,
            PASEO_PROVIDER_CREDENTIAL_FILE: credentialFile,
            PASEO_CLIPROXY_AUTH_FILE: credentialFile,
          },
        },
      ];
    }),
  );
  return { ...config, providers };
}

const RELOADABLE_PATHS = [
  "daemon.relay.enabled",
  "daemon.relay.requireProtectedSecurity",
  "daemon.mcp.enabled",
  "daemon.mcp.injectIntoAgents",
  "daemon.browserTools.enabled",
  "daemon.beadsCentral",
  "daemon.hostnames",
  "daemon.cors.allowedOrigins",
  "daemon.trustedProxies",
  "daemon.git.maxProcessesPerSecond",
  "daemon.git.maxProcessConcurrency",
  "daemon.autoArchiveAfterMerge",
  "daemon.defaultFastMode",
  "daemon.enableTerminalAgentHooks",
  "daemon.appendSystemPrompt",
  "daemon.roleProfiles",
  "daemon.peerDelegation",
  "daemon.peerDelegationProfileIds",
  "daemon.peerDelegationProviderPriority",
  "daemon.peerDelegationDefaultSubrole",
  "daemon.leadRoutes",
  "daemon.roleDefaults",
  "daemon.terminalProfiles",
  "daemon.agentProfiles",
  "app.baseUrl",
  "agents.idleRuntimeCleanup",
  "agents.providers",
  "agents.catalogRefreshTimeoutMs",
  "agents.metadataGeneration",
  "agents.skills.selection",
  "pluginsEnabled",
] as const;

const PERSISTED_TO_MUTABLE_PATH = new Map<string, string>([
  ["daemon.relay.enabled", "relay.enabled"],
  ["daemon.relay.requireProtectedSecurity", "relay.requireProtectedSecurity"],
  ["daemon.mcp.enabled", "mcp.enabled"],
  ["daemon.mcp.injectIntoAgents", "mcp.injectIntoAgents"],
  ["daemon.browserTools.enabled", "browserTools.enabled"],
  ["daemon.beadsCentral", "beadsCentral"],
  ["daemon.hostnames", "hostnames"],
  ["daemon.cors.allowedOrigins", "cors.allowedOrigins"],
  ["daemon.trustedProxies", "trustedProxies"],
  ["daemon.git.maxProcessesPerSecond", "git.maxProcessesPerSecond"],
  ["daemon.git.maxProcessConcurrency", "git.maxProcessConcurrency"],
  ["daemon.autoArchiveAfterMerge", "autoArchiveAfterMerge"],
  ["daemon.defaultFastMode", "defaultFastMode"],
  ["daemon.enableTerminalAgentHooks", "enableTerminalAgentHooks"],
  ["daemon.appendSystemPrompt", "appendSystemPrompt"],
  ["daemon.roleProfiles", "roleProfiles"],
  ["daemon.peerDelegation", "peerDelegation"],
  ["daemon.peerDelegationProfileIds", "peerDelegationProfileIds"],
  ["daemon.peerDelegationProviderPriority", "peerDelegationProviderPriority"],
  ["daemon.peerDelegationDefaultSubrole", "peerDelegationDefaultSubrole"],
  ["daemon.leadRoutes", "leadRoutes"],
  ["daemon.roleDefaults", "roleDefaults"],
  ["daemon.terminalProfiles", "terminalProfiles"],
  ["daemon.agentProfiles", "agentProfiles"],
  ["app.baseUrl", "app.baseUrl"],
  ["agents.idleRuntimeCleanup", "idleRuntimeCleanup"],
  ["agents.providers", "providers"],
  ["agents.catalogRefreshTimeoutMs", "catalogRefreshTimeoutMs"],
  ["agents.metadataGeneration", "metadataGeneration"],
  ["agents.skills.selection", "skills.selection"],
  ["pluginsEnabled", "pluginsEnabled"],
]);

function pathBelongsTo(path: string, owner: string): boolean {
  return path === owner || path.startsWith(`${owner}.`);
}

function diffPaths(previous: unknown, next: unknown, prefix = ""): string[] {
  if (isEqualValue(previous, next)) return [];
  if (!isRecord(previous) || !isRecord(next)) {
    if (isRecord(previous)) return leafPaths(previous, prefix);
    if (isRecord(next)) return leafPaths(next, prefix);
    return prefix ? [prefix] : [];
  }

  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  return Array.from(keys).flatMap((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return diffPaths(previous[key], next[key], path);
  });
}

function leafPaths(record: Record<string, unknown>, prefix: string): string[] {
  return Object.entries(record).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return isRecord(value) ? leafPaths(value, path) : [path];
  });
}

function compactOwnedPaths(paths: readonly string[], owners: readonly string[]): string[] {
  const compacted = new Set<string>();
  for (const path of paths) {
    const owner = owners.find((candidate) => pathBelongsTo(path, candidate));
    compacted.add(owner ?? path);
  }
  return Array.from(compacted).sort();
}

function pickFoundationPatchFields(
  patch: MutableDaemonConfigPatch,
): Pick<
  SupportedMutableConfigPatch,
  | "beadsCentral"
  | "roleProfiles"
  | "resetRoleProfiles"
  | "peerDelegation"
  | "peerDelegationProfileIds"
  | "peerDelegationProviderPriority"
  | "peerDelegationDefaultSubrole"
  | "leadRoutes"
  | "roleDefaults"
> {
  return {
    ...(patch.beadsCentral !== undefined ? { beadsCentral: patch.beadsCentral } : {}),
    ...(patch.roleProfiles !== undefined ? { roleProfiles: patch.roleProfiles } : {}),
    ...(patch.resetRoleProfiles !== undefined
      ? { resetRoleProfiles: patch.resetRoleProfiles }
      : {}),
    ...(patch.peerDelegation !== undefined ? { peerDelegation: patch.peerDelegation } : {}),
    ...(patch.peerDelegationProfileIds !== undefined
      ? { peerDelegationProfileIds: patch.peerDelegationProfileIds }
      : {}),
    ...(patch.peerDelegationProviderPriority !== undefined
      ? { peerDelegationProviderPriority: patch.peerDelegationProviderPriority }
      : {}),
    ...(patch.peerDelegationDefaultSubrole !== undefined
      ? { peerDelegationDefaultSubrole: patch.peerDelegationDefaultSubrole }
      : {}),
    ...(patch.leadRoutes !== undefined ? { leadRoutes: patch.leadRoutes } : {}),
    ...(patch.roleDefaults !== undefined ? { roleDefaults: patch.roleDefaults } : {}),
  };
}

function resolvePeerDelegationProfileRoutes(
  profiles: MutableDaemonConfig["agentProfiles"],
  profileIds: readonly string[],
): NonNullable<MutableDaemonConfig["peerDelegation"]>["allowedModels"] {
  const selected = new Set(profileIds);
  const seen = new Set<string>();
  return (profiles ?? []).flatMap((profile) => {
    if (!selected.has(profile.id)) return [];
    const parsed = PeerDelegationModelRouteSchema.safeParse({
      provider: profile.provider,
      model: profile.model,
    });
    if (!parsed.success) return [];
    const key = `${parsed.data.provider}\u0000${parsed.data.model}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [parsed.data];
  });
}

function synchronizePeerDelegationProfilePatch(
  current: MutableDaemonConfig,
  patch: Omit<SupportedMutableConfigPatch, "removeProviders">,
): Omit<SupportedMutableConfigPatch, "removeProviders"> {
  if (
    patch.peerDelegationProfileIds === undefined &&
    patch.peerDelegationProviderPriority === undefined &&
    patch.agentProfiles === undefined &&
    patch.peerDelegation === undefined
  ) {
    return patch;
  }
  const profileIds = patch.peerDelegationProfileIds ?? current.peerDelegationProfileIds;
  if (profileIds === undefined) return patch;
  const profiles = patch.agentProfiles ?? current.agentProfiles;
  const synchronizedProfileIds =
    patch.agentProfiles === undefined
      ? profileIds
      : profileIds.filter((id) => patch.agentProfiles?.some((profile) => profile.id === id));
  return {
    ...patch,
    peerDelegationProfileIds: synchronizedProfileIds,
    peerDelegationProviderPriority: resolvePeerDelegationProviderPriority(
      profiles ?? [],
      synchronizedProfileIds,
      patch.peerDelegationProviderPriority ?? current.peerDelegationProviderPriority,
    ),
    peerDelegation: {
      enabled: current.peerDelegation?.enabled ?? false,
      runMode: current.peerDelegation?.runMode ?? "unattended",
      ...patch.peerDelegation,
      allowedModels: resolvePeerDelegationProfileRoutes(profiles, synchronizedProfileIds),
    },
  };
}

function pickRelayPatch(
  relay: MutableDaemonConfigPatch["relay"],
): Pick<SupportedMutableConfigPatch, "relay"> {
  const picked: NonNullable<SupportedMutableConfigPatch["relay"]> = {
    ...(relay?.enabled !== undefined ? { enabled: relay.enabled } : {}),
    ...(relay?.requireProtectedSecurity !== undefined
      ? { requireProtectedSecurity: relay.requireProtectedSecurity }
      : {}),
  };
  return Object.keys(picked).length > 0 ? { relay: picked } : {};
}

function pickSupportedPatchFields(patch: MutableDaemonConfigPatch): SupportedMutableConfigPatch {
  return {
    ...pickFoundationPatchFields(patch),
    ...pickRelayPatch(patch.relay),
    ...(patch.mcp?.injectIntoAgents !== undefined
      ? { mcp: { injectIntoAgents: patch.mcp.injectIntoAgents } }
      : {}),
    ...(patch.browserTools?.enabled !== undefined
      ? { browserTools: { enabled: patch.browserTools.enabled } }
      : {}),
    ...(patch.providers !== undefined ? { providers: patch.providers } : {}),
    ...(patch.removeProviders !== undefined ? { removeProviders: patch.removeProviders } : {}),
    ...(patch.metadataGeneration?.providers !== undefined
      ? { metadataGeneration: { providers: patch.metadataGeneration.providers } }
      : {}),
    ...(patch.autoArchiveAfterMerge !== undefined
      ? { autoArchiveAfterMerge: patch.autoArchiveAfterMerge }
      : {}),
    ...(patch.defaultFastMode !== undefined ? { defaultFastMode: patch.defaultFastMode } : {}),
    ...(patch.enableTerminalAgentHooks !== undefined
      ? { enableTerminalAgentHooks: patch.enableTerminalAgentHooks }
      : {}),
    ...(patch.idleRuntimeCleanup !== undefined
      ? { idleRuntimeCleanup: patch.idleRuntimeCleanup }
      : {}),
    ...(patch.appendSystemPrompt !== undefined
      ? { appendSystemPrompt: patch.appendSystemPrompt }
      : {}),
    ...(patch.terminalProfiles !== undefined ? { terminalProfiles: patch.terminalProfiles } : {}),
    ...(patch.agentProfiles !== undefined ? { agentProfiles: patch.agentProfiles } : {}),
    ...(patch.pluginsEnabled !== undefined ? { pluginsEnabled: patch.pluginsEnabled } : {}),
    ...(patch.plugins !== undefined ? { plugins: patch.plugins } : {}),
    ...(patch.features !== undefined ? { features: patch.features } : {}),
  };
}

export function applyMutableProviderConfigToOverrides(
  baseOverrides: Record<string, ProviderOverride> | undefined,
  mutableProviders: MutableDaemonConfig["providers"] | undefined,
): Record<string, ProviderOverride> | undefined {
  if (!baseOverrides && (!mutableProviders || Object.keys(mutableProviders).length === 0)) {
    return undefined;
  }

  const nextOverrides: Record<string, ProviderOverride> = { ...baseOverrides };
  for (const [providerId, providerConfig] of Object.entries(mutableProviders ?? {})) {
    const previousOverride = nextOverrides[providerId];
    const parsedOverride = ProviderOverrideSchema.strip().parse(providerConfig);
    nextOverrides[providerId] = {
      ...previousOverride,
      ...parsedOverride,
      ...(parsedOverride.paseoTools
        ? {
            paseoTools: {
              ...previousOverride?.paseoTools,
              ...parsedOverride.paseoTools,
            },
          }
        : {}),
    };
  }

  return nextOverrides;
}

export class DaemonConfigStore {
  private mutations: Promise<unknown> = Promise.resolve();
  private current: MutableDaemonConfig;
  private readonly paseoHome: string;
  private readonly logger: LoggerLike | undefined;
  private readonly changeListeners = new Set<ConfigListener>();
  private readonly applyListeners = new Set<ConfigApplyListener>();
  private readonly fieldChangeHandlers = new Map<string, Set<FieldChangeHandler>>();
  private readonly relayEnabledMutable: boolean;
  private readonly reloadSource: DaemonConfigReloadSource | undefined;
  private readonly startupPersisted: PersistedConfig;
  private readonly speechOwner: SpeechSettingsOwner | undefined;
  private lastKnownPersisted: PersistedConfig;

  constructor(
    paseoHome: string,
    initial: MutableDaemonConfig,
    logger?: LoggerLike,
    options: {
      relayEnabledMutable?: boolean;
      reloadSource?: DaemonConfigReloadSource;
      startupPersisted?: PersistedConfig;
      speech?: SpeechSettingsOwner;
    } = {},
  ) {
    this.paseoHome = paseoHome;
    this.logger = getLogger(logger);
    this.relayEnabledMutable = options.relayEnabledMutable ?? true;
    this.reloadSource = options.reloadSource;
    this.speechOwner = options.speech;
    this.startupPersisted = options.startupPersisted ?? loadPersistedConfig(paseoHome, this.logger);
    this.lastKnownPersisted = this.startupPersisted;
    this.current = MutableDaemonConfigSchema.parse({
      ...initial,
      relay: initial.relay ?? { enabled: true },
      ...this.readSpeech(this.startupPersisted),
    });
    this.current = withCredentialFileEnvironment(this.current, paseoHome);
  }

  public get(): MutableDaemonConfig {
    return this.current;
  }

  public getLeadRoutes(): readonly string[] | undefined {
    return this.current.leadRoutes;
  }

  public getRoleDefaults(): MutableDaemonConfig["roleDefaults"] {
    return this.current.roleDefaults;
  }

  public patch(
    partial:
      | MutableDaemonConfigPatch
      | ((current: MutableDaemonConfig) => MutableDaemonConfigPatch),
  ): Promise<MutableDaemonConfig> {
    return this.enqueue(() =>
      this.applySupportedPatch(
        pickSupportedPatchFields(
          MutableDaemonConfigPatchSchema.parse(
            typeof partial === "function" ? partial(this.current) : partial,
          ),
        ),
      ),
    );
  }

  public setAgentSkillSelection(selection: AgentSkillSelection): Promise<MutableDaemonConfig> {
    return this.enqueue(() => this.applySupportedPatch({ skills: { selection } }));
  }

  private async applySupportedPatch(
    parsedPatch: SupportedMutableConfigPatch,
  ): Promise<MutableDaemonConfig> {
    if (parsedPatch.relay?.enabled !== undefined && !this.relayEnabledMutable) {
      throw new Error(
        "Relay is controlled by a daemon launch override. Remove PASEO_RELAY_ENABLED or the relay CLI flag before changing it here.",
      );
    }
    const {
      removeProviders = [],
      roleProfiles: roleProfilePatch,
      resetRoleProfiles = [],
      ...patch
    } = parsedPatch;
    const { features: speechPatch, ...rawConfigPatch } = patch;
    const configPatch = synchronizePeerDelegationProfilePatch(this.current, rawConfigPatch);
    const removedProviders = Array.from(new Set(removeProviders));
    const { nextRoleProfiles, roleProfilesChanged } = patchRoleProfiles(
      this.current.roleProfiles,
      roleProfilePatch,
      resetRoleProfiles,
    );
    const merged = {
      ...deepMerge(this.current, configPatch),
      ...(roleProfilesChanged
        ? { roleProfiles: validateRoleProfilePreferencesMap(nextRoleProfiles) }
        : {}),
    };
    if (speechPatch !== undefined) Object.assign(merged, this.readPatchedSpeech(speechPatch));
    applySkillsAndPluginsPatch(merged, parsedPatch);
    applyLeadRoutesPatch(merged, parsedPatch.leadRoutes);
    applyRoleDefaultsPatch(merged, parsedPatch.roleDefaults);
    const parsedNext = MutableDaemonConfigSchema.parse(
      omitMetadataGenerationProvidersFromConfig(
        omitProvidersFromConfig(merged, removedProviders),
        removedProviders,
      ),
    );
    const next = withCredentialFileEnvironment(parsedNext, this.paseoHome);

    const configChanged = !isEqualValue(this.current, next);

    // A replaced API key leaves the speech view unchanged, so a speech patch always persists.
    if (!configChanged && removedProviders.length === 0 && speechPatch === undefined) {
      return this.current;
    }

    const persistencePatch = {
      ...configPatch,
      ...(speechPatch !== undefined ? { features: speechPatch } : {}),
      ...(roleProfilesChanged ? { roleProfiles: nextRoleProfiles } : {}),
    };
    const { previous: persistedBeforePatch, knownNext } = await this.persistConfig(
      persistencePatch,
      removedProviders,
    );
    const speechChanged = this.speechPersistedChanged(this.lastKnownPersisted, knownNext);
    if (configChanged) {
      try {
        this.applyReplacement(next, { removedProviders });
      } catch (error) {
        await savePersistedConfigAsync(this.paseoHome, persistedBeforePatch, this.logger);
        throw error;
      }
    }
    this.lastKnownPersisted = knownNext;
    if (speechChanged) this.speechOwner?.apply(knownNext);

    return this.current;
  }

  private readSpeech(
    persisted: PersistedConfig,
  ): Pick<MutableDaemonConfig, "features" | "envOverrides"> {
    return this.speechOwner ? this.speechOwner.read(persisted) : {};
  }

  private readPatchedSpeech(
    speechPatch: SpeechSettingsPatch,
  ): Pick<MutableDaemonConfig, "features" | "envOverrides"> {
    if (!this.speechOwner) {
      throw new Error("Speech settings are unavailable for this daemon instance");
    }
    return this.speechOwner.read(mergeSpeechSettingsPatch(this.lastKnownPersisted, speechPatch));
  }

  private speechPersistedChanged(previous: PersistedConfig, next: PersistedConfig): boolean {
    return diffPaths(previous, next).some((path) =>
      SPEECH_PERSISTED_PATHS.some((owner) => pathBelongsTo(path, owner)),
    );
  }

  public reload(): Promise<DaemonConfigReloadResult> {
    return this.enqueue(() => this.reloadPersisted());
  }

  private async reloadPersisted(): Promise<DaemonConfigReloadResult> {
    if (!this.reloadSource) {
      throw new Error("Daemon config reload is unavailable for this daemon instance");
    }

    const persisted = await loadPersistedConfigAsync(this.paseoHome, this.logger);
    const resolved = this.reloadSource.resolve(persisted);
    // Plugin source changes require the plugin lifecycle operation or a daemon
    // restart. The global switch is independently reloadable.
    const desired = withCredentialFileEnvironment(
      MutableDaemonConfigSchema.parse({
        ...resolved.mutable,
        plugins: this.current.plugins,
        ...this.readSpeech(persisted),
      }),
      this.paseoHome,
    );
    const changedSinceLastApply = diffPaths(this.lastKnownPersisted, persisted);
    const overrideControlledPaths = compactOwnedPaths(
      changedSinceLastApply.filter((path) =>
        resolved.overrideControlledPaths.some((owner) => pathBelongsTo(path, owner)),
      ),
      resolved.overrideControlledPaths,
    );
    const appliedPaths: string[] = RELOADABLE_PATHS.filter((persistedPath) => {
      if (resolved.overrideControlledPaths.some((owner) => pathBelongsTo(persistedPath, owner))) {
        return false;
      }
      const mutablePath = PERSISTED_TO_MUTABLE_PATH.get(persistedPath);
      return (
        mutablePath !== undefined &&
        !isEqualValue(
          getValueAtPath(this.current, mutablePath),
          getValueAtPath(desired, mutablePath),
        )
      );
    });
    const restartRequiredPaths = compactOwnedPaths(
      diffPaths(this.startupPersisted, persisted).filter((path) => {
        if (path === "$schema" || path === "version") return false;
        if (RELOADABLE_PATHS.some((owner) => pathBelongsTo(path, owner))) return false;
        if (this.speechOwner && SPEECH_PERSISTED_PATHS.some((owner) => pathBelongsTo(path, owner)))
          return false;
        return !resolved.overrideControlledPaths.some((owner) => pathBelongsTo(path, owner));
      }),
      [],
    );

    const removedProviders = Object.keys(this.current.providers).filter(
      (provider) => !(provider in desired.providers),
    );
    const speechChanged = this.speechPersistedChanged(this.lastKnownPersisted, persisted);
    this.applyReplacement(desired, { removedProviders });
    this.lastKnownPersisted = persisted;
    if (speechChanged && this.speechOwner) {
      this.speechOwner.apply(persisted);
      appliedPaths.push(
        ...SPEECH_PERSISTED_PATHS.filter((owner) =>
          changedSinceLastApply.some((path) => pathBelongsTo(path, owner)),
        ),
      );
    }

    return {
      appliedPaths: [...appliedPaths].sort(),
      restartRequiredPaths,
      overrideControlledPaths,
    };
  }

  private applyReplacement(
    next: MutableDaemonConfig,
    changeDetails: DaemonConfigChangeDetails,
  ): void {
    const changedFieldPaths = Array.from(this.fieldChangeHandlers.keys()).filter((path) => {
      return !isEqualValue(getValueAtPath(this.current, path), getValueAtPath(next, path));
    });
    if (isEqualValue(this.current, next) && changeDetails.removedProviders.length === 0) return;

    const previous = this.current;
    const appliedFieldChanges: AppliedFieldChange[] = [];
    const applyRollbacks: ConfigApplyRollback[] = [];
    this.current = next;
    try {
      for (const path of changedFieldPaths) {
        const handlers = this.fieldChangeHandlers.get(path);
        if (!handlers) {
          continue;
        }
        const value = getValueAtPath(next, path);
        const previousValue = getValueAtPath(previous, path);
        for (const handler of handlers) {
          appliedFieldChanges.push({ handler, previousValue });
          handler(value);
        }
      }
      for (const listener of this.applyListeners) {
        applyRollbacks.push(listener(next, previous, changeDetails));
      }
    } catch (error) {
      this.current = previous;
      const rollbackErrors: unknown[] = [];
      for (const rollback of applyRollbacks.toReversed()) {
        try {
          rollback();
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      for (const change of appliedFieldChanges.toReversed()) {
        try {
          change.handler(change.previousValue);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (rollbackErrors.length > 0) {
        const rollbackFailure = new Error(
          "Daemon config apply failed and one or more live owners could not roll back",
          { cause: error },
        );
        Object.assign(rollbackFailure, { rollbackErrors });
        throw rollbackFailure;
      }
      throw error;
    }

    for (const listener of this.changeListeners) {
      try {
        listener(next, changeDetails);
      } catch (error) {
        this.logger?.info({ error }, "Daemon config change notification failed");
      }
    }
  }

  public onFieldChange(path: string, handler: FieldChangeHandler): () => void {
    const handlers = this.fieldChangeHandlers.get(path) ?? new Set<FieldChangeHandler>();
    handlers.add(handler);
    this.fieldChangeHandlers.set(path, handlers);

    return () => {
      const currentHandlers = this.fieldChangeHandlers.get(path);
      if (!currentHandlers) {
        return;
      }
      currentHandlers.delete(handler);
      if (currentHandlers.size === 0) {
        this.fieldChangeHandlers.delete(path);
      }
    };
  }

  public onChange(listener: ConfigListener): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  public onApply(listener: ConfigApplyListener): () => void {
    // A live owner must either throw before changing its state or return a
    // rollback that restores the previous config. Notifications belong in
    // onChange so they run only after every live owner commits.
    this.applyListeners.add(listener);
    return () => {
      this.applyListeners.delete(listener);
    };
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutations.then(operation);
    this.mutations = result.catch(() => {});
    return result;
  }

  public readServicePorts(): Promise<NonNullable<PersistedConfig["worktrees"]>["servicePorts"]> {
    return this.enqueue(
      async () =>
        (await loadPersistedConfigAsync(this.paseoHome, this.logger)).worktrees?.servicePorts,
    );
  }

  private async persistConfig(
    patch: Omit<SupportedMutableConfigPatch, "removeProviders">,
    removeProviders: readonly string[],
  ): Promise<{ previous: PersistedConfig; knownNext: PersistedConfig }> {
    const persisted = await loadPersistedConfigAsync(this.paseoHome, this.logger);
    const merge = (source: PersistedConfig) =>
      mergeMutablePatchIntoPersistedConfig({
        persisted: source,
        patch,
        removeProviders,
        persistRelayEnabled: this.relayEnabledMutable,
      });
    const nextPersisted = merge(persisted);
    const knownNext = merge(this.lastKnownPersisted);
    await savePersistedConfigAsync(this.paseoHome, nextPersisted, this.logger);
    return { previous: persisted, knownNext };
  }
}

function mergeMutablePatchIntoPersistedConfig(params: {
  persisted: PersistedConfig;
  patch: Omit<SupportedMutableConfigPatch, "removeProviders">;
  removeProviders: readonly string[];
  persistRelayEnabled: boolean;
}): PersistedConfig {
  const { persisted, patch, removeProviders, persistRelayEnabled } = params;
  const daemon = mergeMutableDaemonPatch(persisted.daemon, patch, persistRelayEnabled);
  const agents = mergeMutableAgentPatch(persisted.agents, patch, removeProviders);
  const withSpeech = patch.features
    ? mergeSpeechSettingsPatch(persisted, patch.features)
    : persisted;
  return {
    ...withSpeech,
    ...(patch.pluginsEnabled !== undefined ? { pluginsEnabled: patch.pluginsEnabled } : {}),
    ...(patch.plugins !== undefined ? { plugins: patch.plugins } : {}),
    ...(daemon ? { daemon } : { daemon: undefined }),
    ...(agents ? { agents } : { agents: undefined }),
  } as PersistedConfig;
}

function mergeMutableAgentPatch(
  persistedAgents: PersistedConfig["agents"],
  patch: Omit<SupportedMutableConfigPatch, "removeProviders">,
  removeProviders: readonly string[],
): PersistedConfig["agents"] {
  if (
    patch.providers === undefined &&
    patch.metadataGeneration === undefined &&
    patch.skills === undefined &&
    patch.idleRuntimeCleanup === undefined &&
    removeProviders.length === 0
  ) {
    return persistedAgents;
  }

  const next = { ...persistedAgents } as Record<string, unknown>;
  const persistedProviderOverrides = omitProvidersFromOverrides(
    persistedAgents?.providers as Record<string, ProviderOverride> | undefined,
    removeProviders,
  );
  const providerOverrides = applyMutableProviderConfigToOverrides(
    persistedProviderOverrides,
    patch.providers,
  );
  if (providerOverrides) next["providers"] = providerOverrides;
  else delete next["providers"];

  if (patch.metadataGeneration?.providers !== undefined) {
    next["metadataGeneration"] = { providers: patch.metadataGeneration.providers };
  } else if (removeProviders.length > 0 && persistedAgents?.metadataGeneration?.providers) {
    const removed = new Set(removeProviders);
    next["metadataGeneration"] = {
      providers: persistedAgents.metadataGeneration.providers.filter(
        (entry) => !removed.has(entry.provider),
      ),
    };
  }

  if (patch.skills?.selection !== undefined) {
    next["skills"] = { selection: patch.skills.selection };
  }

  if (patch.idleRuntimeCleanup !== undefined) {
    next["idleRuntimeCleanup"] = patch.idleRuntimeCleanup;
  }

  return Object.keys(next).length > 0 ? (next as PersistedConfig["agents"]) : undefined;
}

type MutableRoleProfiles = NonNullable<MutableDaemonConfig["roleProfiles"]>;

function patchRoleProfiles(
  current: MutableDaemonConfig["roleProfiles"],
  roleProfilePatch: SupportedMutableConfigPatch["roleProfiles"],
  resetRoleProfiles: NonNullable<SupportedMutableConfigPatch["resetRoleProfiles"]>,
): { nextRoleProfiles: MutableRoleProfiles; roleProfilesChanged: boolean } {
  const nextRoleProfiles = { ...current };
  for (const [roleId, preferences] of Object.entries(roleProfilePatch ?? {})) {
    if (preferences) nextRoleProfiles[roleId as keyof typeof nextRoleProfiles] = preferences;
  }
  for (const roleId of new Set(resetRoleProfiles)) {
    delete nextRoleProfiles[roleId];
  }
  return {
    nextRoleProfiles,
    roleProfilesChanged: roleProfilePatch !== undefined || resetRoleProfiles.length > 0,
  };
}

function applySkillsAndPluginsPatch(
  target: Pick<MutableDaemonConfig, "skills" | "plugins">,
  patch: Pick<SupportedMutableConfigPatch, "skills" | "plugins">,
): void {
  if (patch.skills?.selection !== undefined) {
    target.skills = { selection: patch.skills.selection };
  }
  if (patch.plugins !== undefined) target.plugins = patch.plugins;
}

function applyPeerDelegationPatch(
  next: NonNullable<PersistedConfig["daemon"]>,
  patch: Omit<SupportedMutableConfigPatch, "removeProviders">,
): void {
  Object.assign(next, mergePeerDelegationPatch(next.peerDelegation, patch.peerDelegation));
  if (patch.peerDelegationProfileIds !== undefined) {
    next.peerDelegationProfileIds = patch.peerDelegationProfileIds;
  }
  if (patch.peerDelegationProviderPriority !== undefined) {
    next.peerDelegationProviderPriority = patch.peerDelegationProviderPriority;
  }
  if (patch.peerDelegationDefaultSubrole !== undefined) {
    next.peerDelegationDefaultSubrole = patch.peerDelegationDefaultSubrole;
  }
}

// An empty Lead route list clears the Human pin instead of persisting an invalid empty list.
function applyLeadRoutesPatch(
  target: { leadRoutes?: string[] },
  leadRoutes: readonly string[] | undefined,
): void {
  if (leadRoutes === undefined) return;
  if (leadRoutes.length > 0) target.leadRoutes = [...leadRoutes];
  else delete target.leadRoutes;
}

// Role defaults replace as a whole object (deepMerge would keep cleared fields); empty clears.
function applyRoleDefaultsPatch(
  target: { roleDefaults?: MutableDaemonConfig["roleDefaults"] },
  roleDefaults: MutableDaemonConfig["roleDefaults"] | undefined,
): void {
  if (roleDefaults === undefined) return;
  const compact = compactRoleDefaults(roleDefaults);
  if (compact) target.roleDefaults = compact;
  else delete target.roleDefaults;
}

function compactRoleDefaults(
  roleDefaults: NonNullable<MutableDaemonConfig["roleDefaults"]>,
): MutableDaemonConfig["roleDefaults"] {
  const next: NonNullable<MutableDaemonConfig["roleDefaults"]> = {};
  if (roleDefaults.defaultRole) next.defaultRole = roleDefaults.defaultRole;
  for (const roleId of ["supervisor", "lead"] as const) {
    const launch = roleDefaults[roleId];
    if (!launch) continue;
    const compactLaunch = {
      ...(launch.route ? { route: launch.route } : {}),
      ...(launch.thinkingOptionId ? { thinkingOptionId: launch.thinkingOptionId } : {}),
      ...(launch.assignmentEffect ? { assignmentEffect: launch.assignmentEffect } : {}),
      ...(roleId === "supervisor" && launch.permission ? { permission: launch.permission } : {}),
    };
    if (Object.keys(compactLaunch).length > 0) next[roleId] = compactLaunch;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function mergeMutableDaemonPatch(
  persistedDaemon: PersistedConfig["daemon"],
  patch: Omit<SupportedMutableConfigPatch, "removeProviders">,
  persistRelayEnabled: boolean,
): PersistedConfig["daemon"] {
  const next = { ...persistedDaemon } as NonNullable<PersistedConfig["daemon"]>;
  if (persistRelayEnabled && patch.relay?.enabled !== undefined) {
    next.relay = { ...next.relay, enabled: patch.relay.enabled };
  }
  if (patch.relay?.requireProtectedSecurity !== undefined) {
    next.relay = { ...next.relay, requireProtectedSecurity: patch.relay.requireProtectedSecurity };
  }
  if (patch.mcp?.injectIntoAgents !== undefined) {
    next.mcp = { ...next.mcp, injectIntoAgents: patch.mcp.injectIntoAgents };
  }
  if (patch.browserTools?.enabled !== undefined) {
    next.browserTools = { ...next.browserTools, enabled: patch.browserTools.enabled };
  }
  if (patch.beadsCentral !== undefined) {
    next.beadsCentral = { ...next.beadsCentral, ...patch.beadsCentral };
  }
  if (patch.autoArchiveAfterMerge !== undefined) {
    next.autoArchiveAfterMerge = patch.autoArchiveAfterMerge;
  }
  if (patch.enableTerminalAgentHooks !== undefined) {
    next.enableTerminalAgentHooks = patch.enableTerminalAgentHooks;
  }
  if (patch.defaultFastMode !== undefined) next.defaultFastMode = patch.defaultFastMode;
  if (patch.appendSystemPrompt !== undefined) next.appendSystemPrompt = patch.appendSystemPrompt;
  if (patch.roleProfiles !== undefined) {
    next.roleProfiles = validateRoleProfilePreferencesMap(patch.roleProfiles);
  }
  applyPeerDelegationPatch(next, patch);
  applyLeadRoutesPatch(next, patch.leadRoutes);
  applyRoleDefaultsPatch(next, patch.roleDefaults);
  if (patch.terminalProfiles !== undefined) next.terminalProfiles = patch.terminalProfiles;
  if (patch.agentProfiles !== undefined) next.agentProfiles = patch.agentProfiles;
  return Object.keys(next).length > 0 ? next : undefined;
}

function mergePeerDelegationPatch(
  current: NonNullable<PersistedConfig["daemon"]>["peerDelegation"],
  patch: SupportedMutableConfigPatch["peerDelegation"],
): Pick<NonNullable<PersistedConfig["daemon"]>, "peerDelegation"> | Record<string, never> {
  if (patch === undefined) return {};
  return {
    peerDelegation: {
      enabled: current?.enabled ?? false,
      allowedModels: current?.allowedModels ?? [],
      runMode: current?.runMode ?? "unattended",
      ...patch,
    },
  };
}
