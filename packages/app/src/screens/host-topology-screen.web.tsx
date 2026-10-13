import { useCallback, useMemo, type CSSProperties } from "react";
import { router } from "expo-router";
import { Network } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { MenuHeader } from "@/components/headers/menu-header";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  TOPOLOGY_ROLE_META,
  TOPOLOGY_ROLE_ORDER,
  TOPOLOGY_STATUS_LABELS,
  TopologyGraph,
  TopologyTheme,
  estimateTopologyGraphSize,
  summarizeTopologyStatuses,
} from "@/panels/topology-graph.web";
import {
  buildHostTopology,
  type TopologyEdge,
  type TopologyNode,
  type TopologyRole,
} from "@/panels/topology-model";
import { useSessionStore } from "@/stores/session-store";
import type { Theme } from "@/styles/theme";
import { buildHostAgentDetailRoute } from "@/utils/host-routes";

interface ProjectGroup {
  id: string;
  label: string;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

const MIN_GRAPH_HEIGHT = 220;
const MAX_GRAPH_HEIGHT = 1400;
const GRAPH_VERTICAL_PADDING = 72;

const ThemedNetwork = withUnistyles(Network);
const ThemedLoadingSpinner = withUnistyles(LoadingSpinner);
const mutedColorMapping = (theme: Theme) => ({
  color: theme.colors.foregroundMuted,
});

function countRoles(nodes: readonly TopologyNode[]): Record<TopologyRole, number> {
  const counts: Record<TopologyRole, number> = { supervisor: 0, lead: 0, peer: 0, unbound: 0 };
  for (const node of nodes) counts[node.role] += 1;
  return counts;
}

function TopologyStats({ nodes }: { nodes: readonly TopologyNode[] }) {
  const roleCounts = useMemo(() => countRoles(nodes), [nodes]);
  const statusCounts = useMemo(() => summarizeTopologyStatuses(nodes), [nodes]);
  return (
    <>
      <div className="tp-hud-row">
        {TOPOLOGY_ROLE_ORDER.filter((role) => roleCounts[role] > 0).map((role) => (
          <span key={role} className="tp-hud-stat" data-role={role}>
            <span className="tp-swatch" />
            <b>{roleCounts[role]}</b>
            {roleCounts[role] === 1
              ? TOPOLOGY_ROLE_META[role].label
              : TOPOLOGY_ROLE_META[role].plural}
          </span>
        ))}
      </div>
      <div className="tp-hud-row">
        {statusCounts.map(({ status, count }) => (
          <span key={status} className="tp-hud-stat" data-status={status}>
            <span className="tp-dot" />
            <b>{count}</b>
            {TOPOLOGY_STATUS_LABELS[status]}
          </span>
        ))}
      </div>
    </>
  );
}

function ProjectTopologySection({
  group,
  onOpenAgent,
}: {
  group: ProjectGroup;
  onOpenAgent: (agentId: string) => void;
}) {
  const frameStyle = useMemo<CSSProperties>(() => {
    const { height } = estimateTopologyGraphSize(group.nodes, group.edges);
    return {
      height: Math.min(
        MAX_GRAPH_HEIGHT,
        Math.max(MIN_GRAPH_HEIGHT, height + GRAPH_VERTICAL_PADDING),
      ),
    };
  }, [group.edges, group.nodes]);
  return (
    <section className="tp-project" data-testid={`host-topology-project-${group.id}`}>
      <div className="tp-project-head">
        <span className="tp-project-name">{group.label}</span>
        <TopologyStats nodes={group.nodes} />
      </div>
      <div className="tp-frame" style={frameStyle}>
        <TopologyGraph nodes={group.nodes} edges={group.edges} embedded onOpenAgent={onOpenAgent} />
      </div>
    </section>
  );
}

export function HostTopologyScreen({ serverId }: { serverId: string }) {
  const session = useSessionStore((state) => state.sessions[serverId]);
  const topology = useMemo(() => buildHostTopology(session?.agents), [session?.agents]);
  const projectGroups = useMemo(() => {
    const workspaces = session?.workspaces;
    const grouped = new Map<string, ProjectGroup>();
    const groupByNode = new Map<string, ProjectGroup>();
    for (const node of topology.nodes) {
      const workspace = node.workspaceId ? workspaces?.get(node.workspaceId) : undefined;
      const key = workspace?.projectId ?? "unassigned";
      const group = grouped.get(key) ?? {
        id: key,
        label: workspace?.projectDisplayName ?? "Unassigned agents",
        nodes: [],
        edges: [],
      };
      group.nodes.push(node);
      grouped.set(key, group);
      groupByNode.set(node.id, group);
    }
    // A relationship that crosses projects has no single graph to live in.
    for (const edge of topology.edges) {
      const group = groupByNode.get(edge.source);
      if (group && group === groupByNode.get(edge.target)) group.edges.push(edge);
    }
    return [...grouped.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [session?.workspaces, topology.edges, topology.nodes]);
  const workspaceByAgent = useMemo(
    () => new Map(topology.nodes.map((node) => [node.id, node.workspaceId])),
    [topology.nodes],
  );
  const handleOpenAgent = useCallback(
    (agentId: string) => {
      router.push(
        buildHostAgentDetailRoute(serverId, agentId, workspaceByAgent.get(agentId) ?? undefined),
      );
    },
    [serverId, workspaceByAgent],
  );

  let content;
  if (!session?.hasHydratedAgents) {
    content = (
      <View style={styles.centered}>
        <ThemedLoadingSpinner size="large" uniProps={mutedColorMapping} />
      </View>
    );
  } else if (projectGroups.length === 0) {
    content = (
      <View style={styles.centered}>
        <ThemedNetwork size={28} uniProps={mutedColorMapping} />
        <Text style={styles.emptyTitle}>No agents in topology</Text>
        <Text style={styles.emptyText}>Create role-bound agents to populate project topology.</Text>
      </View>
    );
  } else {
    content = (
      <ScrollView contentContainerStyle={styles.content}>
        <TopologyTheme>
          <div className="tp-page">
            <div className="tp-page-head">
              <span className="tp-page-title">All projects</span>
              <span className="tp-hud-sub">
                {topology.nodes.length} agents · {topology.edges.length} exact relationship
                {topology.edges.length === 1 ? "" : "s"}
              </span>
              <TopologyStats nodes={topology.nodes} />
              {topology.counts.unbound > 0 ? (
                <span className="tp-warning">
                  {topology.counts.unbound} unbound agent
                  {topology.counts.unbound === 1 ? "" : "s"}; provider subagents are not Paseo
                  Peers.
                </span>
              ) : null}
            </div>
            {projectGroups.map((group) => (
              <ProjectTopologySection key={group.id} group={group} onOpenAgent={handleOpenAgent} />
            ))}
          </div>
        </TopologyTheme>
      </ScrollView>
    );
  }

  return (
    <View style={styles.screen} testID="host-topology-screen">
      <MenuHeader title="Project topology" />
      {content}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.surface0 },
  content: { padding: theme.spacing[6] },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: theme.spacing[2] },
  emptyTitle: { color: theme.colors.foreground, fontSize: theme.fontSize.lg },
  emptyText: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.sm },
}));
