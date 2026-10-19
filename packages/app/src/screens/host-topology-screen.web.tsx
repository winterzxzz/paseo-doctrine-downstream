import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { router } from "expo-router";
import { ChevronRight, Network } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { MenuHeader } from "@/components/headers/menu-header";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  TOPOLOGY_ROLE_META,
  TopologyGraph,
  TopologyTheme,
  estimateTopologyGraphSize,
} from "@/panels/topology-graph.web";
import { buildHostTopology, type TopologyEdge, type TopologyNode } from "@/panels/topology-model";
import {
  ATTENTION_REASON_LABELS,
  PROJECT_STATE_LABELS,
  PROJECT_STATE_ORDER,
  buildAttentionInbox,
  compareProjectOverviews,
  describeLiveActivity,
  summarizeProject,
  type AttentionItem,
  type ProjectActivityState,
  type ProjectOverview,
} from "@/panels/topology-overview";
import { useSessionStore } from "@/stores/session-store";
import type { Theme } from "@/styles/theme";
import { buildHostAgentDetailRoute } from "@/utils/host-routes";
import { formatCompactTimeAgo } from "@/utils/time";

interface ProjectGroup {
  id: string;
  label: string;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  overview: ProjectOverview;
}

const MIN_GRAPH_HEIGHT = 220;
const MAX_GRAPH_HEIGHT = 1400;
const GRAPH_VERTICAL_PADDING = 72;

// The chip dot takes its color from the chip's state, not from text color.
const STATE_DOT_STYLE: CSSProperties = { color: "var(--tp-ov)" };

const ThemedNetwork = withUnistyles(Network);
const ThemedLoadingSpinner = withUnistyles(LoadingSpinner);
const mutedColorMapping = (theme: Theme) => ({
  color: theme.colors.foregroundMuted,
});

function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function ProjectGraph({
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
    <div className="tp-ov-graph" style={frameStyle}>
      <TopologyGraph nodes={group.nodes} edges={group.edges} embedded onOpenAgent={onOpenAgent} />
    </div>
  );
}

function LiveActivity({
  serverId,
  node,
  now,
}: {
  serverId: string;
  node: TopologyNode;
  now: Date;
}) {
  // Selected per agent so a streaming timeline re-renders only its own line.
  const tail = useSessionStore((state) => state.sessions[serverId]?.agentStreamTail.get(node.id));
  const activity = useMemo(
    () => describeLiveActivity(tail, node.turnStartedAt),
    [node.turnStartedAt, tail],
  );
  const runTime = node.turnStartedAt ? formatCompactTimeAgo(node.turnStartedAt, now) : null;
  return (
    <span className="tp-ov-activity">
      {runTime ? (
        <span className="tp-ov-activity-time" title="Time in the current turn">
          {runTime === "now" ? "<1m" : runTime}
        </span>
      ) : null}
      {activity ? (
        <span className="tp-ov-activity-label" title={activity.label}>
          {activity.label}
        </span>
      ) : null}
    </span>
  );
}

function FocusAgent({
  serverId,
  node,
  now,
  live,
  onOpenAgent,
}: {
  serverId: string;
  node: TopologyNode;
  now: Date;
  live: boolean;
  onOpenAgent: (agentId: string) => void;
}) {
  const handleClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      onOpenAgent(node.id);
    },
    [node.id, onOpenAgent],
  );
  return (
    <span
      className="tp-ov-agent"
      data-role={node.role}
      role="link"
      title={`Open ${node.title}`}
      onClick={handleClick}
    >
      {node.role === "unbound" ? null : (
        <span className="tp-ov-agent-role">{TOPOLOGY_ROLE_META[node.role].label}</span>
      )}
      <span className="tp-ov-agent-title">{node.title}</span>
      {live ? <LiveActivity serverId={serverId} node={node} now={now} /> : null}
    </span>
  );
}

function focusPool(overview: ProjectOverview): TopologyNode[] {
  if (overview.state === "working") return overview.running;
  if (overview.state === "needs-you") return overview.needsYou;
  if (overview.state === "review") return overview.toReview;
  return [];
}

function focusPrefix(state: ProjectActivityState): string | null {
  if (state === "needs-you") return "Waiting on you:";
  if (state === "review") return "Finished:";
  if (state === "idle" || state === "inactive") return "Last:";
  return null;
}

function ProjectOverviewRow({
  serverId,
  group,
  expanded,
  now,
  onToggle,
  onOpenAgent,
}: {
  serverId: string;
  group: ProjectGroup;
  expanded: boolean;
  now: Date;
  onToggle: (projectId: string) => void;
  onOpenAgent: (agentId: string) => void;
}) {
  const { overview } = group;
  const handleToggle = useCallback(() => onToggle(group.id), [group.id, onToggle]);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onToggle(group.id);
    },
    [group.id, onToggle],
  );
  const extraFocus = focusPool(overview).length - overview.focus.length;
  const prefix = focusPrefix(overview.state);
  const live = overview.state === "working";
  return (
    <div className="tp-ov-item" data-testid={`host-topology-project-${group.id}`}>
      <div
        className="tp-ov-row"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${group.label}: ${PROJECT_STATE_LABELS[overview.state]}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
      >
        <span className="tp-ov-state" data-state={overview.state}>
          <span className="tp-ov-state-dot" />
          {PROJECT_STATE_LABELS[overview.state]}
        </span>
        <span className="tp-ov-main">
          <span className="tp-ov-name">{group.label}</span>
          {overview.focus.length > 0 ? (
            <span className="tp-ov-focus" data-live={live || undefined}>
              {prefix ? <span className="tp-ov-more">{prefix}</span> : null}
              {overview.focus.map((node) => (
                <FocusAgent
                  key={node.id}
                  serverId={serverId}
                  node={node}
                  now={now}
                  live={live}
                  onOpenAgent={onOpenAgent}
                />
              ))}
              {extraFocus > 0 ? <span className="tp-ov-more">+{extraFocus}</span> : null}
            </span>
          ) : null}
        </span>
        <span className="tp-ov-counts">
          {overview.needsYou.length > 0 ? (
            <span className="tp-ov-count" data-tone="danger">
              <b>{overview.needsYou.length}</b> need you
            </span>
          ) : null}
          {overview.running.length > 0 ? (
            <span className="tp-ov-count" data-tone="running">
              <b>{overview.running.length}</b> running
            </span>
          ) : null}
          {overview.toReview.length > 0 ? (
            <span className="tp-ov-count" data-tone="warning">
              <b>{overview.toReview.length}</b> to review
            </span>
          ) : null}
          <span className="tp-ov-count">
            <b>{overview.openCount}</b> open
          </span>
        </span>
        <span className="tp-ov-time">
          {!live && overview.lastActivityAt
            ? formatCompactTimeAgo(overview.lastActivityAt, now)
            : ""}
        </span>
        <span className="tp-ov-chevron">
          <ChevronRight color="currentColor" size={14} />
        </span>
      </div>
      {expanded ? <ProjectGraph group={group} onOpenAgent={onOpenAgent} /> : null}
    </div>
  );
}

function AttentionInboxRow({
  item,
  now,
  onOpenAgent,
}: {
  item: AttentionItem;
  now: Date;
  onOpenAgent: (agentId: string) => void;
}) {
  const { node } = item;
  const handleOpen = useCallback(() => onOpenAgent(node.id), [node.id, onOpenAgent]);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onOpenAgent(node.id);
    },
    [node.id, onOpenAgent],
  );
  const waited = item.since ? formatCompactTimeAgo(item.since, now) : null;
  return (
    <div
      className="tp-inbox-row"
      role="link"
      tabIndex={0}
      aria-label={`${ATTENTION_REASON_LABELS[item.reason]}: ${node.title} in ${item.projectLabel}`}
      data-testid={`host-topology-inbox-${node.id}`}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
    >
      <span
        className="tp-ov-state"
        data-state={item.reason === "finished" ? "review" : "needs-you"}
      >
        <span className="tp-ov-state-dot" />
        {ATTENTION_REASON_LABELS[item.reason]}
      </span>
      <span className="tp-ov-main">
        <span className="tp-inbox-agent">
          <span className="tp-inbox-project">{item.projectLabel}</span>
          <span className="tp-ov-agent" data-role={node.role}>
            {node.role === "unbound" ? null : (
              <span className="tp-ov-agent-role">{TOPOLOGY_ROLE_META[node.role].label}</span>
            )}
            <span className="tp-ov-agent-title">{node.title}</span>
          </span>
        </span>
        {item.detail ? (
          <span className="tp-inbox-detail" title={item.detail}>
            {item.detail}
          </span>
        ) : null}
      </span>
      <span className="tp-ov-time" title="Waiting for">
        {waited && waited !== "now" ? `waiting ${waited}` : (waited ?? "")}
      </span>
      <span className="tp-ov-chevron">
        <ChevronRight color="currentColor" size={14} />
      </span>
    </div>
  );
}

function AttentionInbox({
  items,
  now,
  onOpenAgent,
}: {
  items: AttentionItem[];
  now: Date;
  onOpenAgent: (agentId: string) => void;
}) {
  return (
    <section className="tp-inbox" data-testid="host-topology-inbox">
      <span className="tp-inbox-title">
        Needs you <span className="tp-inbox-count">{items.length}</span>
      </span>
      <div className="tp-ov-list">
        {items.map((item) => (
          <AttentionInboxRow key={item.node.id} item={item} now={now} onOpenAgent={onOpenAgent} />
        ))}
      </div>
    </section>
  );
}

function ProjectOverviewList({
  serverId,
  groups,
  expanded,
  now,
  onToggle,
  onOpenAgent,
}: {
  serverId: string;
  groups: ProjectGroup[];
  expanded: ReadonlySet<string>;
  now: Date;
  onToggle: (projectId: string) => void;
  onOpenAgent: (agentId: string) => void;
}) {
  return (
    <div className="tp-ov-list">
      {groups.map((group) => (
        <ProjectOverviewRow
          key={group.id}
          serverId={serverId}
          group={group}
          expanded={expanded.has(group.id)}
          now={now}
          onToggle={onToggle}
          onOpenAgent={onOpenAgent}
        />
      ))}
    </div>
  );
}

export function HostTopologyScreen({ serverId }: { serverId: string }) {
  const session = useSessionStore((state) => state.sessions[serverId]);
  const topology = useMemo(() => buildHostTopology(session?.agents), [session?.agents]);
  const projectGroups = useMemo(() => {
    const workspaces = session?.workspaces;
    const grouped = new Map<string, Omit<ProjectGroup, "overview">>();
    const groupByNode = new Map<string, Omit<ProjectGroup, "overview">>();
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
    return [...grouped.values()]
      .map<ProjectGroup>((group) =>
        Object.assign(group, { overview: summarizeProject(group.nodes) }),
      )
      .sort(compareProjectOverviews);
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

  const now = useMinuteClock();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [showInactive, setShowInactive] = useState(false);
  const handleToggleProject = useCallback((projectId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);
  const handleToggleInactive = useCallback(() => setShowInactive((current) => !current), []);
  const activeGroups = useMemo(
    () => projectGroups.filter((group) => group.overview.state !== "inactive"),
    [projectGroups],
  );
  const inactiveGroups = useMemo(
    () => projectGroups.filter((group) => group.overview.state === "inactive"),
    [projectGroups],
  );
  const inbox = useMemo(() => buildAttentionInbox(projectGroups), [projectGroups]);
  const stateCounts = useMemo(() => {
    const counts = new Map<ProjectActivityState, number>();
    for (const group of projectGroups) {
      counts.set(group.overview.state, (counts.get(group.overview.state) ?? 0) + 1);
    }
    return PROJECT_STATE_ORDER.flatMap((state) => {
      const count = counts.get(state) ?? 0;
      return count > 0 ? [{ state, count }] : [];
    });
  }, [projectGroups]);

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
            <div className="tp-ov-head">
              <span className="tp-page-title">Projects</span>
              <div className="tp-ov-summary">
                {stateCounts.map(({ state, count }) => (
                  <span key={state} className="tp-ov-chip" data-state={state}>
                    <span className="tp-ov-state-dot" style={STATE_DOT_STYLE} />
                    <b>{count}</b>
                    {PROJECT_STATE_LABELS[state]}
                  </span>
                ))}
                <span className="tp-ov-chip">
                  <b>{topology.nodes.length}</b> agents
                </span>
              </div>
              {topology.counts.unbound > 0 ? (
                <span className="tp-warning">
                  {topology.counts.unbound} unbound agent
                  {topology.counts.unbound === 1 ? "" : "s"}; provider subagents are not Paseo
                  Peers.
                </span>
              ) : null}
            </div>
            {inbox.length > 0 ? (
              <AttentionInbox items={inbox} now={now} onOpenAgent={handleOpenAgent} />
            ) : null}
            {activeGroups.length > 0 ? (
              <ProjectOverviewList
                serverId={serverId}
                groups={activeGroups}
                expanded={expanded}
                now={now}
                onToggle={handleToggleProject}
                onOpenAgent={handleOpenAgent}
              />
            ) : null}
            {inactiveGroups.length > 0 ? (
              <>
                <div
                  className="tp-ov-group"
                  role="button"
                  tabIndex={0}
                  aria-expanded={showInactive}
                  onClick={handleToggleInactive}
                >
                  <span className="tp-ov-chevron">
                    <ChevronRight color="currentColor" size={14} />
                  </span>
                  Inactive · {inactiveGroups.length}
                </div>
                {showInactive ? (
                  <ProjectOverviewList
                    serverId={serverId}
                    groups={inactiveGroups}
                    expanded={expanded}
                    now={now}
                    onToggle={handleToggleProject}
                    onOpenAgent={handleOpenAgent}
                  />
                ) : null}
              </>
            ) : null}
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
