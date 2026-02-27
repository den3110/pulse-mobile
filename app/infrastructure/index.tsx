import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  Dimensions,
  Platform,
} from "react-native";
import {
  Text,
  ActivityIndicator,
  Portal,
  Dialog,
  Button,
  Chip,
} from "react-native-paper";
import {
  Svg,
  Circle,
  Line,
  Text as SvgText,
  Defs,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { useAppTheme } from "../../contexts/ThemeContext";

interface TopologyNode {
  id: string;
  type: "server" | "project";
  label: string;
  status: string;
  meta: Record<string, any>;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface TopologyEdge {
  source: string;
  target: string;
  label?: string;
}

const STATUS_COLORS: Record<string, string> = {
  online: "#4ade80",
  running: "#4ade80",
  stopped: "#ef4444",
  failed: "#ef4444",
  offline: "#ef4444",
  idle: "#94a3b8",
  deploying: "#fbbf24",
  building: "#fbbf24",
  unknown: "#64748b",
};

export default function InfrastructureMapScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nodes, setNodes] = useState<TopologyNode[]>([]);
  const [edges, setEdges] = useState<TopologyEdge[]>([]);

  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);

  // SVG Canvas dimensions
  const canvasWidth = 1200;
  const canvasHeight = 1200;

  const fetchData = useCallback(async () => {
    try {
      const { data } = await api.get("/topology");
      const rawNodes = data.nodes || [];
      const rawEdges = data.edges || [];

      // Initial layout seed
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      const serverNodes = rawNodes.filter((n: any) => n.type === "server");
      const projectNodes = rawNodes.filter((n: any) => n.type === "project");

      let initializedNodes: TopologyNode[] = [];

      serverNodes.forEach((n: any, i: number) => {
        const angle = (2 * Math.PI * i) / Math.max(serverNodes.length, 1);
        const radius = 150;
        initializedNodes.push({
          ...n,
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
          vx: 0,
          vy: 0,
        });
      });

      projectNodes.forEach((n: any) => {
        const edge = rawEdges.find((e: any) => e.source === n.id);
        const serverNode = edge
          ? initializedNodes.find((s) => s.id === edge.target)
          : null;
        const baseX = serverNode ? serverNode.x : centerX;
        const baseY = serverNode ? serverNode.y : centerY;
        initializedNodes.push({
          ...n,
          x: baseX + (Math.random() - 0.5) * 120,
          y: baseY + (Math.random() - 0.5) * 120,
          vx: 0,
          vy: 0,
        });
      });

      // Synchronous layout calculation
      const maxIterations = 200;
      const damping = 0.85;
      const repulsion = 2000;
      const attraction = 0.01;
      const idealLength = 150;

      for (let iteration = 0; iteration < maxIterations; iteration++) {
        // Repulsion
        for (let i = 0; i < initializedNodes.length; i++) {
          for (let j = i + 1; j < initializedNodes.length; j++) {
            const dx = initializedNodes[j].x - initializedNodes[i].x;
            const dy = initializedNodes[j].y - initializedNodes[i].y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const force = repulsion / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            initializedNodes[i].vx -= fx;
            initializedNodes[i].vy -= fy;
            initializedNodes[j].vx += fx;
            initializedNodes[j].vy += fy;
          }
        }

        // Attraction
        for (const edge of rawEdges) {
          const source = initializedNodes.find((n) => n.id === edge.source);
          const target = initializedNodes.find((n) => n.id === edge.target);
          if (!source || !target) continue;

          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const force = attraction * (dist - idealLength);
          const fx = (dx / Math.max(dist, 1)) * force;
          const fy = (dy / Math.max(dist, 1)) * force;

          source.vx += fx;
          source.vy += fy;
          target.vx -= fx;
          target.vy -= fy;
        }

        // Apply and damp
        for (const node of initializedNodes) {
          node.vx *= damping;
          node.vy *= damping;

          node.x += node.vx;
          node.y += node.vy;

          // Keep strictly mostly bounded
          node.x = Math.max(50, Math.min(canvasWidth - 50, node.x));
          node.y = Math.max(50, Math.min(canvasHeight - 50, node.y));
        }
      }

      setNodes(initializedNodes);
      setEdges(rawEdges);
    } catch (err) {
      console.error("Failed to fetch topology", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleNodePress = (node: TopologyNode) => {
    setSelectedNode(node);
  };

  const handleNodeAction = () => {
    if (!selectedNode) return;
    if (selectedNode.type === "server") {
      router.push(`/server/${selectedNode.meta._id}`);
    } else {
      router.push(`/project/${selectedNode.meta._id}`);
    }
    setSelectedNode(null);
  };

  if (loading && nodes.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: t("infra.title", "Infrastructure Map"),
        }}
      />

      {nodes.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <Text style={styles.emptyText}>
            {t("infra.noData", "No infrastructure data")}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          horizontal
          bounces={false}
          showsHorizontalScrollIndicator={true}
        >
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={true}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: canvasWidth,
                height: canvasHeight,
                backgroundColor: isDark ? "rgba(0,0,0,0.15)" : "#f8fafc",
                alignSelf: "center",
              }}
            >
              <Svg
                width={canvasWidth}
                height={canvasHeight}
                viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              >
                <Defs>
                  {/* Creating radial gradients for each status color might be excessive, we'll use simple fill for mobile performance */}
                </Defs>

                {/* Edges */}
                {edges.map((edge, i) => {
                  const source = nodes.find((n) => n.id === edge.source);
                  const target = nodes.find((n) => n.id === edge.target);
                  if (!source || !target) return null;

                  return (
                    <Line
                      key={`edge-${i}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={
                        isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"
                      }
                      strokeWidth={2}
                    />
                  );
                })}

                {/* Nodes */}
                {nodes.map((node) => {
                  const color =
                    STATUS_COLORS[node.status] || STATUS_COLORS.unknown;
                  const radius = node.type === "server" ? 28 : 20;
                  const emoji = node.type === "server" ? "🖥️" : "📦";

                  return (
                    <React.Fragment key={node.id}>
                      <Circle
                        cx={node.x}
                        cy={node.y}
                        r={radius}
                        fill={`${color}30`}
                        stroke={color}
                        strokeWidth={2}
                        onPress={() => handleNodePress(node)}
                      />
                      <SvgText
                        x={node.x}
                        y={node.y + 4} // slight adjustment for vertical center
                        fontSize={node.type === "server" ? "18" : "14"}
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        onPress={() => handleNodePress(node)}
                      >
                        {emoji}
                      </SvgText>
                      <SvgText
                        x={node.x}
                        y={node.y + radius + 14}
                        fontSize="12"
                        fill={isDark ? "#e2e8f0" : "#334155"}
                        textAnchor="middle"
                        onPress={() => handleNodePress(node)}
                      >
                        {node.label}
                      </SvgText>
                    </React.Fragment>
                  );
                })}
              </Svg>
            </View>
          </ScrollView>
        </ScrollView>
      )}

      {/* Node Details Dialog */}
      <Portal>
        <Dialog
          visible={!!selectedNode}
          onDismiss={() => setSelectedNode(null)}
        >
          {selectedNode && (
            <>
              <Dialog.Title>
                {selectedNode.type === "server" ? "🖥️ " : "📦 "}
                {selectedNode.label}
              </Dialog.Title>
              <Dialog.Content>
                <View style={{ flexDirection: "row", marginBottom: 16 }}>
                  <Chip
                    textStyle={{
                      color:
                        STATUS_COLORS[selectedNode.status] ||
                        STATUS_COLORS.unknown,
                    }}
                    style={{
                      backgroundColor: `${STATUS_COLORS[selectedNode.status] || STATUS_COLORS.unknown}20`,
                    }}
                  >
                    {selectedNode.status.toUpperCase()}
                  </Chip>
                </View>

                {selectedNode.type === "server" && (
                  <Text
                    style={{
                      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                      color: colors.textSecondary,
                    }}
                  >
                    {t("infrastructure.host", "Host:")}{selectedNode.meta.host}
                  </Text>
                )}

                {selectedNode.type === "project" && (
                  <>
                    <Text
                      style={{ marginBottom: 4, color: colors.textSecondary }}
                    >
                      {t("infrastructure.branch", "Branch:")}{selectedNode.meta.branch}
                    </Text>
                    <Text
                      style={{
                        fontFamily:
                          Platform.OS === "ios" ? "Menlo" : "monospace",
                        fontSize: 12,
                        color: colors.textSecondary,
                      }}
                    >
                      {selectedNode.meta.repoUrl}
                    </Text>
                  </>
                )}
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={() => setSelectedNode(null)}>
                  {t("common.close", "Close")}
                </Button>
                <Button mode="contained" onPress={handleNodeAction}>
                  {t("common.details", "Details")}
                </Button>
              </Dialog.Actions>
            </>
          )}
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 16,
    },
  });
