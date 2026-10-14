import type { AgentProfile, MutableDaemonConfig, PeerSubrole } from "@getpaseo/protocol/messages";
import {
  orderPeerDelegationProfiles,
  resolvePeerDelegationProviderPriority,
  selectPeerDelegationProfiles,
} from "@getpaseo/protocol/peer-delegation-priority";

/**
 * The Human-approved Peer launch roster: the profiles a Lead may route Peer work to,
 * highest provider priority first. A Supervisor reads the same roster to audit routing.
 */
export interface ApprovedPeerRoster {
  enabled: boolean;
  profiles: AgentProfile[];
  providerPriority: string[];
  defaultSubrole: PeerSubrole | null | undefined;
}

type PeerRosterConfig = Partial<
  Pick<
    MutableDaemonConfig,
    | "agentProfiles"
    | "peerDelegation"
    | "peerDelegationProfileIds"
    | "peerDelegationProviderPriority"
    | "peerDelegationDefaultSubrole"
  >
>;

/** Returns null when no Peer allowlist is configured at all. */
export function resolveApprovedPeerRoster(
  config: PeerRosterConfig | undefined,
): ApprovedPeerRoster | null {
  const profileIds = config?.peerDelegationProfileIds;
  if (profileIds === undefined) return null;
  const defaultSubrole = config?.peerDelegationDefaultSubrole;
  if (!config?.peerDelegation?.enabled) {
    return { enabled: false, profiles: [], providerPriority: [], defaultSubrole };
  }
  const allProfiles = config.agentProfiles ?? [];
  const providerPriority = resolvePeerDelegationProviderPriority(
    allProfiles,
    profileIds,
    config.peerDelegationProviderPriority,
  );
  const profiles = orderPeerDelegationProfiles(
    selectPeerDelegationProfiles(allProfiles, profileIds),
    providerPriority,
  );
  return { enabled: true, profiles, providerPriority, defaultSubrole };
}
