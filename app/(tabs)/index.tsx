import { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from "react-native";
import { Text, Card, ActivityIndicator, Chip } from "react-native-paper";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import { Colors, statusColor } from "../../constants/theme";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { connectSocket, disconnectSocket } from "../../services/socket";
import * as Haptics from "expo-haptics";
import ServerResourceWidget from "../../components/ServerResourceWidget";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Path,
  Circle,
  Line,
  Rect,
  Text as SvgText,
} from "react-native-svg";

interface Stats {
  servers: { total: number; online: number; offline: number };
  projects: { total: number; running: number; stopped: number };
  deployments: {
    total: number;
    today: number;
    success: number;
    failed: number;
  };
  deployChart?: {
    date: string;
    day: string;
    success: number;
    failed: number;
    total: number;
  }[];
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  value: number;
  sub?: string;
  color: string;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: colors.card,
          borderRadius: 14,
          width: "47%" as any,
          flexGrow: 1,
          padding: 14,
        },
        { borderLeftColor: color, borderLeftWidth: 3 },
        pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
            backgroundColor: color + "20",
          }}
        >
          <MaterialCommunityIcons name={icon as any} size={22} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>
            {value}
          </Text>
          <Text
            style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}
          >
            {label}
          </Text>
          {sub ? (
            <Text
              style={{
                fontSize: 10,
                color: colors.textSecondary,
                marginTop: 1,
              }}
            >
              {sub}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function DeployChart({
  data,
  t,
}: {
  data: { date: string; success: number; failed: number }[];
  t: (key: string) => string;
}) {
  const { colors } = useAppTheme();
  const [selected, setSelected] = useState<number | null>(null);

  if (!data?.length) return null;

  const items = data.slice(-7);
  const maxVal = Math.max(
    ...items.map((d) => Math.max(d.success, d.failed)),
    1,
  );

  // Chart dimensions
  const W = 320;
  const H = 180;
  const padL = 28;
  const padR = 8;
  const padT = 28;
  const padB = 24;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const xStep = items.length > 1 ? chartW / (items.length - 1) : chartW;

  const toX = (i: number) => padL + i * xStep;
  const toY = (v: number) => padT + chartH - (v / maxVal) * chartH;

  // Build smooth path (monotone-like)
  const buildPath = (values: number[], closed: boolean) => {
    if (values.length < 2) {
      const x = toX(0);
      const y = toY(values[0] || 0);
      return closed
        ? `M${padL},${padT + chartH} L${x},${y} L${x},${padT + chartH} Z`
        : `M${x},${y}`;
    }

    let path = `M${toX(0)},${toY(values[0])}`;
    for (let i = 1; i < values.length; i++) {
      const x0 = toX(i - 1);
      const y0 = toY(values[i - 1]);
      const x1 = toX(i);
      const y1 = toY(values[i]);
      const cpx = (x0 + x1) / 2;
      path += ` C${cpx},${y0} ${cpx},${y1} ${x1},${y1}`;
    }

    if (closed) {
      path += ` L${toX(values.length - 1)},${padT + chartH} L${padL},${padT + chartH} Z`;
    }
    return path;
  };

  const successVals = items.map((d) => d.success);
  const failedVals = items.map((d) => d.failed);

  // Y-axis ticks (4 ticks)
  const yTicks = [
    0,
    Math.round(maxVal / 3),
    Math.round((maxVal * 2) / 3),
    maxVal,
  ];

  const handleTap = (i: number) => {
    Haptics.selectionAsync();
    setSelected(selected === i ? null : i);
  };

  return (
    <Card
      style={{
        marginHorizontal: 12,
        marginTop: 10,
        backgroundColor: colors.card,
        borderRadius: 14,
      }}
    >
      <Card.Content>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <MaterialCommunityIcons
              name="chart-areaspline"
              size={18}
              color={colors.primary}
            />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: colors.text,
                marginBottom: 4,
              }}
            >
              {t("dashboard.deploymentsChart")}
            </Text>
          </View>
          {/* Legend */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.success,
                }}
              />
              <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                {t("common.success")}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.error,
                }}
              />
              <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                {t("common.failed")}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ position: "relative" }}>
          <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
            <Defs>
              <SvgLinearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0%"
                  stopColor={colors.success}
                  stopOpacity={0.35}
                />
                <Stop
                  offset="100%"
                  stopColor={colors.success}
                  stopOpacity={0.02}
                />
              </SvgLinearGradient>
              <SvgLinearGradient id="failedGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={colors.error} stopOpacity={0.35} />
                <Stop
                  offset="100%"
                  stopColor={colors.error}
                  stopOpacity={0.02}
                />
              </SvgLinearGradient>
            </Defs>

            {/* Grid lines */}
            {yTicks.map((tick) => (
              <Line
                key={`grid-${tick}`}
                x1={padL}
                y1={toY(tick)}
                x2={W - padR}
                y2={toY(tick)}
                stroke={colors.border}
                strokeDasharray="4,4"
              />
            ))}

            {/* Y-axis labels */}
            {yTicks.map((tick) => (
              <SvgText
                key={`y-${tick}`}
                x={padL - 6}
                y={toY(tick) + 3}
                textAnchor="end"
                fill={colors.textSecondary}
                fontSize={9}
              >
                {tick}
              </SvgText>
            ))}

            {/* Success area fill */}
            <Path d={buildPath(successVals, true)} fill="url(#successGrad)" />
            {/* Success line */}
            <Path
              d={buildPath(successVals, false)}
              fill="none"
              stroke={colors.success}
              strokeWidth={2}
            />

            {/* Failed area fill */}
            <Path d={buildPath(failedVals, true)} fill="url(#failedGrad)" />
            {/* Failed line */}
            <Path
              d={buildPath(failedVals, false)}
              fill="none"
              stroke={colors.error}
              strokeWidth={2}
            />

            {/* Selected vertical line */}
            {selected !== null && (
              <Line
                x1={toX(selected)}
                y1={padT}
                x2={toX(selected)}
                y2={padT + chartH}
                stroke={colors.primary}
                strokeWidth={1}
                strokeDasharray="3,3"
                opacity={0.6}
              />
            )}

            {/* Data points - Success */}
            {successVals.map((v, i) => (
              <Circle
                key={`s-${i}`}
                cx={toX(i)}
                cy={toY(v)}
                r={selected === i ? 5 : 3}
                fill={colors.success}
                stroke={selected === i ? colors.card : "none"}
                strokeWidth={selected === i ? 2 : 0}
              />
            ))}

            {/* Data points - Failed */}
            {failedVals.map((v, i) => (
              <Circle
                key={`f-${i}`}
                cx={toX(i)}
                cy={toY(v)}
                r={selected === i ? 5 : 3}
                fill={colors.error}
                stroke={selected === i ? colors.card : "none"}
                strokeWidth={selected === i ? 2 : 0}
              />
            ))}

            {/* X-axis labels */}
            {items.map((d, i) => (
              <SvgText
                key={`x-${i}`}
                x={toX(i)}
                y={H - 4}
                textAnchor="middle"
                fill={selected === i ? colors.text : colors.textSecondary}
                fontSize={10}
                fontWeight={selected === i ? "bold" : "normal"}
              >
                {new Date(d.date).toLocaleDateString(undefined, {
                  weekday: "narrow",
                })}
              </SvgText>
            ))}

            {/* Tooltip bubble */}
            {selected !== null &&
              (() => {
                const item = items[selected];
                const tx = toX(selected);
                const tooltipW = 90;
                const tooltipH = 42;
                // Keep tooltip inside chart bounds
                const tooltipX = Math.max(
                  padL,
                  Math.min(tx - tooltipW / 2, W - padR - tooltipW),
                );
                const tooltipY = padT - tooltipH + 2;
                return (
                  <>
                    <Rect
                      x={tooltipX}
                      y={tooltipY < 0 ? 0 : tooltipY}
                      width={tooltipW}
                      height={tooltipH}
                      rx={8}
                      fill={colors.surfaceVariant}
                      stroke={colors.border}
                      strokeWidth={1}
                    />
                    <SvgText
                      x={tooltipX + tooltipW / 2}
                      y={(tooltipY < 0 ? 0 : tooltipY) + 14}
                      textAnchor="middle"
                      fill={colors.text}
                      fontSize={10}
                      fontWeight="bold"
                    >
                      {new Date(item.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </SvgText>
                    <SvgText
                      x={tooltipX + tooltipW / 2 - 18}
                      y={(tooltipY < 0 ? 0 : tooltipY) + 28}
                      textAnchor="middle"
                      fill={colors.success}
                      fontSize={9}
                    >
                      ✓ {item.success}
                    </SvgText>
                    <SvgText
                      x={tooltipX + tooltipW / 2 + 18}
                      y={(tooltipY < 0 ? 0 : tooltipY) + 28}
                      textAnchor="middle"
                      fill={colors.error}
                      fontSize={9}
                    >
                      ✕ {item.failed}
                    </SvgText>
                  </>
                );
              })()}
          </Svg>

          {/* Invisible tap targets overlay */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              flexDirection: "row",
            }}
          >
            {items.map((_, i) => (
              <Pressable
                key={`tap-${i}`}
                onPress={() => handleTap(i)}
                style={{ flex: 1, height: "100%" }}
              />
            ))}
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useAppTheme();
  const Colors = colors;
  const styles = createStyles(colors);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentDeploys, setRecentDeploys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [statsRes, deploysRes] = await Promise.all([
        api.get("/stats"),
        api.get("/deployments?limit=5"),
      ]);
      setStats(statsRes.data);
      setRecentDeploys(deploysRes.data?.deployments || deploysRes.data || []);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
      connectSocket();
    }
    return () => disconnectSocket();
  }, [user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
    >
      <View style={styles.statsGrid}>
        <StatCard
          icon="server"
          label={t("dashboard.servers")}
          value={stats?.servers?.total || 0}
          sub={t("dashboard.onlineCount", {
            count: stats?.servers?.online || 0,
          })}
          color={Colors.info}
          onPress={() => router.push("/(tabs)/servers")}
        />
        <StatCard
          icon="folder-multiple"
          label={t("dashboard.projects")}
          value={stats?.projects?.total || 0}
          sub={t("dashboard.runningCount", {
            count: stats?.projects?.running || 0,
          })}
          color={Colors.accent}
          onPress={() => router.push("/(tabs)/projects")}
        />
        <StatCard
          icon="rocket-launch"
          label={t("dashboard.deployments")}
          value={stats?.deployments?.total || 0}
          color={Colors.success}
          onPress={() => router.push("/(tabs)/activity")}
        />
        <StatCard
          icon="check-circle"
          label={t("dashboard.runningServices")}
          value={stats?.projects?.running || 0}
          color="#f59e0b"
          onPress={() => router.push("/(tabs)/projects")}
        />
      </View>

      {/* Active Server Stats */}
      <ServerResourceWidget />

      {/* Quick Actions */}
      <Card style={styles.card}>
        <Card.Content>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: 14,
            }}
          >
            <MaterialCommunityIcons
              name="lightning-bolt"
              size={18}
              color={Colors.primary}
            />
            <Text style={styles.sectionTitle}>
              {t("dashboard.quickActions")}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.push("/server/form");
              }}
              style={({ pressed }) => [
                styles.quickActionBtn,
                { borderColor: Colors.info + "40" },
                pressed && { opacity: 0.7 },
              ]}
            >
              <MaterialCommunityIcons
                name="plus"
                size={16}
                color={Colors.info}
              />
              <Text style={[styles.quickActionText, { color: Colors.info }]}>
                {t("dashboard.addServer")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.push("/project/form");
              }}
              style={({ pressed }) => [
                styles.quickActionBtn,
                { borderColor: Colors.accent + "40" },
                pressed && { opacity: 0.7 },
              ]}
            >
              <MaterialCommunityIcons
                name="plus"
                size={16}
                color={Colors.accent}
              />
              <Text style={[styles.quickActionText, { color: Colors.accent }]}>
                {t("dashboard.newProject")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.push("/ftp");
              }}
              style={({ pressed }) => [
                styles.quickActionBtn,
                { borderColor: Colors.warning + "40" },
                pressed && { opacity: 0.7 },
              ]}
            >
              <MaterialCommunityIcons
                name="folder"
                size={16}
                color={Colors.warning}
              />
              <Text style={[styles.quickActionText, { color: Colors.warning }]}>
                {t("dashboard.fileManager")}
              </Text>
            </Pressable>
          </View>
        </Card.Content>
      </Card>

      <DeployChart data={stats?.deployChart || []} t={t} />

      <Card style={styles.card}>
        <Card.Content>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: 14,
            }}
          >
            <MaterialCommunityIcons
              name="rocket-launch"
              size={18}
              color={Colors.primary}
            />
            <Text style={styles.sectionTitle}>
              {t("dashboard.recentDeploys")}
            </Text>
          </View>
          {recentDeploys.length === 0 ? (
            <Text style={styles.emptyText}>{t("dashboard.noDeployments")}</Text>
          ) : (
            recentDeploys.map((dep: any) => (
              <Pressable
                key={dep._id}
                onPress={() => router.push(`/deployment/${dep._id}`)}
                style={({ pressed }) => [
                  styles.deployItem,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.deployProject} numberOfLines={1}>
                    {dep.project?.name ||
                      dep.projectName ||
                      t("common.unknown")}
                  </Text>
                  <Text style={styles.deployMeta}>
                    {dep.server?.name ? `${dep.server.name} · ` : ""}
                    {dep.branch || "main"} ·{" "}
                    {dep.triggeredBy ? `${dep.triggeredBy} · ` : ""}
                    {new Date(dep.startedAt || dep.createdAt).toLocaleString()}
                  </Text>
                </View>
                <Chip
                  compact
                  style={{
                    backgroundColor: statusColor(dep.status, colors) + "20",
                  }}
                  textStyle={{
                    color: statusColor(dep.status, colors),
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {dep.status}
                </Chip>
              </Pressable>
            ))
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const createStyles = (Colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.background,
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      padding: 12,
      gap: 10,
    },
    statCard: {
      backgroundColor: Colors.card,
      borderRadius: 14,
      width: "47%",
      flexGrow: 1,
      padding: 14,
    },
    statContent: {
      flexDirection: "row",
      alignItems: "center",
    },
    statIconBox: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    statValue: { fontSize: 22, fontWeight: "800", color: Colors.text },
    statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
    card: {
      marginHorizontal: 12,
      marginTop: 10,
      backgroundColor: Colors.card,
      borderRadius: 14,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: Colors.text,
    },
    chartContainer: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "flex-end",
      height: 130,
    },
    chartCol: { alignItems: "center", flex: 1 },
    chartBar: {
      width: 22,
      borderRadius: 4,
      overflow: "hidden",
      justifyContent: "flex-end",
    },
    chartBarSuccess: { borderRadius: 4 },
    chartBarFailed: { borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
    chartLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 4 },
    chartCount: {
      fontSize: 10,
      color: Colors.textSecondary,
      marginBottom: 2,
      fontWeight: "600",
    },
    deployItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: Colors.border,
    },
    deployProject: { fontSize: 14, fontWeight: "600", color: Colors.text },
    deployMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
    emptyText: {
      color: Colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
      paddingVertical: 20,
    },
    quickActionBtn: {
      flex: 1,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      backgroundColor: Colors.surface,
    },
    quickActionText: {
      fontSize: 13,
      fontWeight: "600" as const,
    },
  });
