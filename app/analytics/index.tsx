import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  Dimensions,
} from "react-native";
import {
  Text,
  ActivityIndicator,
  Card,
  ProgressBar,
  Menu,
  Button,
} from "react-native-paper";
import { Svg, Path, Defs, LinearGradient, Stop, Line } from "react-native-svg";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// --- Interfaces ---
interface DoraMetrics {
  period: number;
  deployFrequency: number;
  totalDeploys: number;
  avgLeadTimeMinutes: number;
  changeFailureRate: number;
  failedDeploys: number;
  mttrMinutes: number;
  recoveryCount: number;
}

interface TrendDay {
  date: string;
  day: string;
  success: number;
  failed: number;
  total: number;
  avgDurationSeconds: number;
}

interface ProjectStat {
  projectId: string;
  name: string;
  status: string;
  total: number;
  success: number;
  failed: number;
  successRate: number;
  avgDurationSeconds: number;
  lastDeploy: string;
}

// --- Helper Components ---
const MetricCard = ({
  icon,
  label,
  value,
  sub,
  color,
  bgColor,
  styles,
}: any) => (
  <Card style={[styles.metricCard, { backgroundColor: bgColor }]}>
    <Card.Content style={styles.metricContent}>
      <View style={styles.metricHeader}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </Card.Content>
  </Card>
);

export default function AnalyticsScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const styles = createStyles(colors);

  const [days, setDays] = useState(30);
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [dora, setDora] = useState<DoraMetrics | null>(null);
  const [trends, setTrends] = useState<TrendDay[]>([]);
  const [heatmap, setHeatmap] = useState<number[][]>([]);
  const [projectStats, setProjectStats] = useState<ProjectStat[]>([]);

  // Dimensions for Chart
  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - 64; // padding 16 * 2 + card padding 16 * 2
  const chartHeight = 200;

  const fetchData = useCallback(async () => {
    try {
      const [doraRes, trendsRes, heatmapRes, projectsRes] = await Promise.all([
        api.get(`/analytics/dora?days=${days}`),
        api.get(`/analytics/trends?days=${days}`),
        api.get(`/analytics/heatmap?days=${days}`),
        api.get(`/analytics/projects?days=${days}`),
      ]);
      setDora(doraRes.data);
      setTrends(trendsRes.data.trends || []);
      setHeatmap(heatmapRes.data.heatmap || []);
      setProjectStats(projectsRes.data.stats || []);
    } catch (error) {
      console.error("Failed to fetch analytics", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // --- Chart Building Logic ---
  const chartPaths = useMemo(() => {
    if (!trends.length) return null;

    const maxVal = Math.max(
      ...trends.map((t) => Math.max(t.success, t.failed)),
      1,
    );
    const pdTopBtn = 10; // padding top and bottom
    const pdLeftRight = 0;
    const w = chartWidth - pdLeftRight * 2;
    const h = chartHeight - pdTopBtn * 2;
    const stepX = w / Math.max(trends.length - 1, 1);

    const getPath = (key: "success" | "failed", isArea = false) => {
      let d = `M ${pdLeftRight} ${pdTopBtn + h - (trends[0][key] / maxVal) * h}`;
      for (let i = 1; i < trends.length; i++) {
        const x = pdLeftRight + i * stepX;
        const y = pdTopBtn + h - (trends[i][key] / maxVal) * h;
        // Simple line To
        d += ` L ${x} ${y}`;
      }
      if (isArea) {
        d += ` L ${pdLeftRight + w} ${pdTopBtn + h} L ${pdLeftRight} ${pdTopBtn + h} Z`;
      }
      return d;
    };

    return {
      successLine: getPath("success"),
      successArea: getPath("success", true),
      failedLine: getPath("failed"),
      failedArea: getPath("failed", true),
      maxVal,
      count: trends.length,
    };
  }, [trends, chartWidth, chartHeight]);

  // --- Heatmap Logic ---
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const heatmapMax = Math.max(...heatmap.flat(), 1);

  const getHeatmapColor = (value: number) => {
    if (value === 0) return isDark ? "#1e293b" : "#f1f5f9";
    const intensity = Math.min(value / Math.max(heatmapMax, 1), 1);
    // Colors from light green to dark green
    if (intensity < 0.25) return "#bbf7d0";
    if (intensity < 0.5) return "#4ade80";
    if (intensity < 0.75) return "#22c55e";
    return "#16a34a";
  };

  const getDayLabel = (d: number) => {
    switch (d) {
      case 7:
        return t("analytics.last7days", "Last 7 days");
      case 14:
        return t("analytics.last14days", "Last 14 days");
      case 30:
        return t("analytics.last30days", "Last 30 days");
      case 60:
        return t("analytics.last60days", "Last 60 days");
      case 90:
        return t("analytics.last90days", "Last 90 days");
      default:
        return `${d} days`;
    }
  };

  if (loading && !dora) {
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
          title: t("analytics.title", "Analytics Dashboard"),
          headerRight: () => (
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <Button mode="text" onPress={() => setMenuVisible(true)}>
                  {getDayLabel(days)}
                </Button>
              }
            >
              {[7, 14, 30, 60, 90].map((d) => (
                <Menu.Item
                  key={d}
                  onPress={() => {
                    setDays(d);
                    setMenuVisible(false);
                  }}
                  title={getDayLabel(d)}
                />
              ))}
            </Menu>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* DORA Metrics */}
        {dora && (
          <View style={styles.gridContainer}>
            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <MetricCard
                  icon="speedometer"
                  label="Deploy Freq"
                  value={`${dora.deployFrequency}/d`}
                  sub={`${dora.totalDeploys} total`}
                  color="#3b82f6"
                  bgColor={colors.surface}
                  styles={styles}
                />
              </View>
              <View style={styles.gridCol}>
                <MetricCard
                  icon="timer-outline"
                  label="Lead Time"
                  value={
                    dora.avgLeadTimeMinutes > 60
                      ? `${Math.round(dora.avgLeadTimeMinutes / 60)}h`
                      : `${dora.avgLeadTimeMinutes}m`
                  }
                  sub="avg duration"
                  color="#8b5cf6"
                  bgColor={colors.surface}
                  styles={styles}
                />
              </View>
            </View>
            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <MetricCard
                  icon="alert-circle-outline"
                  label="Failure Rate"
                  value={`${dora.changeFailureRate}%`}
                  sub={`${dora.failedDeploys} failed`}
                  color={dora.changeFailureRate > 15 ? "#ef4444" : "#22c55e"}
                  bgColor={colors.surface}
                  styles={styles}
                />
              </View>
              <View style={styles.gridCol}>
                <MetricCard
                  icon="sync"
                  label="MTTR"
                  value={
                    dora.mttrMinutes > 60
                      ? `${Math.round(dora.mttrMinutes / 60)}h`
                      : `${dora.mttrMinutes}m`
                  }
                  sub={`${dora.recoveryCount} recoveries`}
                  color="#f59e0b"
                  bgColor={colors.surface}
                  styles={styles}
                />
              </View>
            </View>
          </View>
        )}

        {/* Deploy Trends Chart */}
        <Card style={styles.chartCard} mode="contained">
          <Card.Content>
            <Text style={styles.sectionTitle}>{t("analytics.deployTrends", "📈 Deploy Trends")}</Text>
            {chartPaths ? (
              <View style={{ alignItems: "center" }}>
                <Svg width={chartWidth} height={chartHeight}>
                  <Defs>
                    <LinearGradient
                      id="successGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <Stop offset="5%" stopColor="#22c55e" stopOpacity="0.3" />
                      <Stop offset="95%" stopColor="#22c55e" stopOpacity="0" />
                    </LinearGradient>
                    <LinearGradient id="failedGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="5%" stopColor="#ef4444" stopOpacity="0.3" />
                      <Stop offset="95%" stopColor="#ef4444" stopOpacity="0" />
                    </LinearGradient>
                  </Defs>

                  {/* Grid Lines */}
                  {[0, 0.5, 1].map((ratio) => (
                    <Line
                      key={ratio}
                      x1="0"
                      y1={10 + ratio * (chartHeight - 20)}
                      x2={chartWidth}
                      y2={10 + ratio * (chartHeight - 20)}
                      stroke={
                        isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
                      }
                      strokeDasharray="4,4"
                    />
                  ))}

                  {/* Areas */}
                  <Path d={chartPaths.successArea} fill="url(#successGrad)" />
                  <Path d={chartPaths.failedArea} fill="url(#failedGrad)" />

                  {/* Lines */}
                  <Path
                    d={chartPaths.successLine}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2"
                  />
                  <Path
                    d={chartPaths.failedLine}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                  />
                </Svg>

                {/* Legend & Summary */}
                <View style={styles.chartLegend}>
                  <View style={styles.legendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: "#22c55e" }]}
                    />
                    <Text style={styles.legendText}>{t("analytics.success", "Success")}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: "#ef4444" }]}
                    />
                    <Text style={styles.legendText}>{t("analytics.failed", "Failed")}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={[styles.centered, { height: chartHeight }]}>
                <Text style={styles.emptyText}>{t("analytics.noTrendData", "No trend data")}</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Heatmap */}
        <Card style={styles.chartCard} mode="contained">
          <Card.Content>
            <Text style={styles.sectionTitle}>{t("analytics.activityHeatmap", "🗓️ Activity Heatmap")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.heatmapGrid}>
                {/* Hours Row */}
                <View style={styles.heatmapRow}>
                  <View style={styles.heatmapLabelCol}></View>
                  {Array.from({ length: 24 }).map((_, h) => (
                    <Text key={h} style={styles.heatmapHourText}>
                      {h}
                    </Text>
                  ))}
                </View>

                {/* Days Rows */}
                {dayNames.map((day, dayIdx) => (
                  <View key={day} style={styles.heatmapRow}>
                    <View style={styles.heatmapLabelCol}>
                      <Text style={styles.heatmapDayText}>
                        {day.substring(0, 3)}
                      </Text>
                    </View>
                    {heatmap[dayIdx]?.map((count, hour) => (
                      <View
                        key={`${day}-${hour}`}
                        style={[
                          styles.heatmapCell,
                          { backgroundColor: getHeatmapColor(count) },
                        ]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </Card.Content>
        </Card>

        {/* Top Projects */}
        <Card style={[styles.chartCard, { marginBottom: 40 }]} mode="contained">
          <Card.Content>
            <Text style={styles.sectionTitle}>{t("analytics.topProjects", "🏆 Top Projects")}</Text>
            {projectStats.length === 0 ? (
              <Text style={[styles.emptyText, { paddingVertical: 20 }]}>
                {t("analytics.noDeploymentData", "No deployment data")}</Text>
            ) : (
              <View style={{ gap: 16, marginTop: 8 }}>
                {projectStats.slice(0, 8).map((p) => (
                  <View key={p.projectId}>
                    <View style={styles.projectHeaderRow}>
                      <Text style={styles.projectName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <View style={styles.miniLabel}>
                          <Text style={styles.miniLabelText}>{p.total}</Text>
                        </View>
                        <View
                          style={[
                            styles.miniLabel,
                            {
                              backgroundColor:
                                p.successRate >= 80
                                  ? "rgba(34,197,94,0.15)"
                                  : "rgba(239,68,68,0.15)",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.miniLabelText,
                              {
                                color:
                                  p.successRate >= 80 ? "#22c55e" : "#ef4444",
                              },
                            ]}
                          >
                            {p.successRate}%
                          </Text>
                        </View>
                      </View>
                    </View>
                    <ProgressBar
                      progress={p.successRate / 100}
                      color={p.successRate >= 80 ? "#22c55e" : "#f59e0b"}
                      style={styles.progressBar}
                    />
                  </View>
                ))}
              </View>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
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
    scrollContent: {
      padding: 16,
    },
    gridContainer: {
      gap: 12,
      marginBottom: 16,
    },
    gridRow: {
      flexDirection: "row",
      gap: 12,
    },
    gridCol: {
      flex: 1,
    },
    metricCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 0,
    },
    metricContent: {
      padding: 16,
    },
    metricHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 8,
    },
    metricLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    metricValue: {
      fontSize: 24,
      fontWeight: "800",
    },
    metricSub: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 4,
    },
    chartCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
      elevation: 0,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 16,
    },
    chartLegend: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 16,
      marginTop: 12,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    heatmapGrid: {
      gap: 2,
    },
    heatmapRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    heatmapLabelCol: {
      width: 30,
      justifyContent: "center",
    },
    heatmapHourText: {
      width: 14,
      textAlign: "center",
      fontSize: 8,
      color: colors.textSecondary,
    },
    heatmapDayText: {
      fontSize: 10,
      color: colors.textSecondary,
    },
    heatmapCell: {
      width: 14,
      height: 14,
      borderRadius: 2,
    },
    projectHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    projectName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      flex: 1,
      marginRight: 8,
    },
    miniLabel: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    miniLabelText: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.text,
    },
    progressBar: {
      height: 4,
      borderRadius: 2,
      backgroundColor: "rgba(128,128,128,0.2)",
    },
    emptyText: {
      textAlign: "center",
      color: colors.textSecondary,
      fontSize: 14,
    },
  });
