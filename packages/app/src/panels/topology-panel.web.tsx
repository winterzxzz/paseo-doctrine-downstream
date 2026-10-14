import { Network } from "lucide-react-native";
import { useMemo } from "react";
import { Text, View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { definePanel } from "@/panels/panel-registry";
import {
  TopologyGraph,
  summarizeTopologyStatuses,
  type TopologyHudProps,
} from "@/panels/topology-graph.web";
import { useTopologyPanelDescriptor, useTopologyPanelState } from "@/panels/use-topology-panel";
import type { Theme } from "@/styles/theme";

const ThemedNetwork = withUnistyles(Network);
const ThemedLoadingSpinner = withUnistyles(LoadingSpinner);
const mutedColorMapping = (theme: Theme) => ({
  color: theme.colors.foregroundMuted,
});

function TopologyPanel() {
  const {
    topology,
    hydrated,
    openAgent,
    issueById,
    grantedIssueCount,
    issuesLoading,
    issuesError,
    projectName,
  } = useTopologyPanelState();
  const hud = useMemo<TopologyHudProps>(() => {
    return {
      projectName,
      agentCount: topology.nodes.length,
      edgeCount: topology.edges.length,
      roleCounts: topology.counts,
      statusCounts: summarizeTopologyStatuses(topology.nodes),
      edgeKinds: [...new Set(topology.edges.map((edge) => edge.kind))].sort(),
      warningCount: topology.warnings.length,
      grantedIssueCount,
      issuesLoading,
      issuesUnavailable: Boolean(issuesError),
    };
  }, [grantedIssueCount, issuesError, issuesLoading, projectName, topology]);

  if (!hydrated) {
    return (
      <View style={styles.centered} testID="project-topology-loading">
        <ThemedLoadingSpinner size="large" uniProps={mutedColorMapping} />
      </View>
    );
  }
  if (topology.nodes.length === 0) {
    return (
      <View style={styles.centered} testID="project-topology-empty">
        <ThemedNetwork size={24} uniProps={mutedColorMapping} />
        <Text style={styles.emptyTitle}>No agents in topology</Text>
        <Text style={styles.emptyText}>Create role-bound agents to populate this topology.</Text>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <TopologyGraph
        nodes={topology.nodes}
        edges={topology.edges}
        issueById={issueById}
        hud={hud}
        testID="project-topology-panel"
        onOpenAgent={openAgent}
      />
    </View>
  );
}

export const topologyPanelRegistration = definePanel("topology", {
  component: TopologyPanel,
  useDescriptor: useTopologyPanelDescriptor,
});

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: theme.colors.surface0,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing[2],
    padding: theme.spacing[4],
    backgroundColor: theme.colors.surface0,
  },
  emptyTitle: { color: theme.colors.foreground, fontSize: theme.fontSize.base },
  emptyText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
  },
}));
