import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useServer } from "../contexts/ServerContext";
import { Text, Surface, useTheme, Card, ProgressBar } from "react-native-paper";
import { Svg, Path, Defs, LinearGradient, Stop, Line } from "react-native-svg";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../contexts/ThemeContext";
import api from "../services/api";

const screenWidth = Dimensions.get("window").width;
const chartWidth = screenWidth - 64; // padding 16 * 2 + card padding 16 * 2
const chartHeight = 220;

interface BandwidthHistory {
  timestamp: string;
  rxRate: number;
  txRate: number;
}

interface ServerBandwidth {
  serverId: string;
  name: string;
  host: string;
  status: string;
  currentRx: number;
  currentTx: number;
  history: BandwidthHistory[];
}

const formatBytes = (bytes: number) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export default function BandwidthScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const { selectedServer } = useServer();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, isDark);

  const [data, setData] = useState<ServerBandwidth[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (silent = false) => {
    if (!selectedServer?._id) return;
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/analytics/bandwidth");
      setData(
        res.data.filter(
          (s: ServerBandwidth) => s.serverId === selectedServer._id,
        ),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setData([]);
    if (selectedServer?._id) {
      fetchData();
    }
    const interval = setInterval(() => {
      if (selectedServer?._id) {
        fetchData(true);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedServer?._id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const totalRx = useMemo(
    () => data.reduce((acc, curr) => acc + curr.currentRx, 0),
    [data],
  );
  const totalTx = useMemo(
    () => data.reduce((acc, curr) => acc + curr.currentTx, 0),
    [data],
  );

  const maxTotal = useMemo(() => {
    let m = 0;
    data.forEach((d) => {
      if (d.currentRx + d.currentTx > m) m = d.currentRx + d.currentTx;
    });
    return m;
  }, [data]);

  const chartPaths = useMemo(() => {
    if (!data[0] || !data[0].history || data[0].history.length === 0)
      return null;
    const history = data[0].history;
    const maxVal = Math.max(
      ...history.map((h) => Math.max(h.rxRate, h.txRate)),
      1,
    );
    const pdTopBtn = 20; // padding top and bottom
    const pdLeftRight = 0;
    const w = chartWidth - pdLeftRight * 2;
    const h = chartHeight - pdTopBtn * 2;
    const stepX = w / Math.max(history.length - 1, 1);

    const getPath = (key: "rxRate" | "txRate", isArea = false) => {
      let d = `M ${pdLeftRight} ${pdTopBtn + h - (history[0][key] / maxVal) * h}`;
      for (let i = 1; i < history.length; i++) {
        const x = pdLeftRight + i * stepX;
        const y = pdTopBtn + h - (history[i][key] / maxVal) * h;
        d += ` L ${x} ${y}`;
      }
      if (isArea) {
        d += ` L ${pdLeftRight + w} ${pdTopBtn + h} L ${pdLeftRight} ${pdTopBtn + h} Z`;
      }
      return d;
    };

    return {
      rxLine: getPath("rxRate"),
      rxArea: getPath("rxRate", true),
      txLine: getPath("txRate"),
      txArea: getPath("txRate", true),
      maxVal,
      count: history.length,
    };
  }, [data]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t("nav.bandwidth", "Bandwidth") }} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 80 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <MaterialCommunityIcons
            name="speedometer"
            size={32}
            color={colors.info}
          />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.headerTitle}>
              {t("nav.bandwidth", "Bandwidth")}
            </Text>
            <Text style={styles.headerSubtitle}>
              {t(
                "bandwidth.subtitle",
                "Network speeds and lifetime usage for " +
                  (selectedServer?.name || "this server"),
              )}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Surface
            style={[
              styles.statCard,
              { borderLeftColor: colors.info, borderLeftWidth: 4 },
            ]}
            elevation={1}
          >
            <Text style={styles.statLabel}>
              {t("bandwidth.totalDownload", "Total Download")}
            </Text>
            <Text style={[styles.statValue, { color: colors.info }]}>
              {formatBytes(totalRx)}
            </Text>
          </Surface>

          <Surface
            style={[
              styles.statCard,
              { borderLeftColor: colors.success, borderLeftWidth: 4 },
            ]}
            elevation={1}
          >
            <Text style={styles.statLabel}>
              {t("bandwidth.totalUpload", "Total Upload")}
            </Text>
            <Text style={[styles.statValue, { color: colors.success }]}>
              {formatBytes(totalTx)}
            </Text>
          </Surface>
        </View>

        <Card style={styles.chartCard} mode="contained">
          <Card.Content>
            <Text style={styles.sectionTitle}>
              📈 {t("bandwidth.liveSpeeds", "Live Speeds")}
            </Text>
            {chartPaths ? (
              <View style={{ alignItems: "center" }}>
                <Svg width={chartWidth} height={chartHeight}>
                  <Defs>
                    <LinearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop
                        offset="5%"
                        stopColor={colors.info}
                        stopOpacity="0.3"
                      />
                      <Stop
                        offset="95%"
                        stopColor={colors.info}
                        stopOpacity="0"
                      />
                    </LinearGradient>
                    <LinearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop
                        offset="5%"
                        stopColor={colors.success}
                        stopOpacity="0.3"
                      />
                      <Stop
                        offset="95%"
                        stopColor={colors.success}
                        stopOpacity="0"
                      />
                    </LinearGradient>
                  </Defs>

                  {/* Grid Lines */}
                  {[0, 0.5, 1].map((ratio) => (
                    <Line
                      key={ratio}
                      x1="0"
                      y1={20 + ratio * (chartHeight - 40)}
                      x2={chartWidth}
                      y2={20 + ratio * (chartHeight - 40)}
                      stroke={
                        isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
                      }
                      strokeDasharray="4,4"
                    />
                  ))}
                  <Text style={[styles.axisText, { top: 4 }]}>
                    {formatBytes(chartPaths.maxVal)}{t("bandwidth.s", "/s")}</Text>
                  <Text
                    style={[
                      styles.axisText,
                      { top: 20 + 0.5 * (chartHeight - 40) - 14 },
                    ]}
                  >
                    {formatBytes(chartPaths.maxVal / 2)}{t("bandwidth.s", "/s")}</Text>

                  {/* Areas */}
                  <Path d={chartPaths.rxArea} fill="url(#rxGrad)" />
                  <Path d={chartPaths.txArea} fill="url(#txGrad)" />

                  {/* Lines */}
                  <Path
                    d={chartPaths.rxLine}
                    fill="none"
                    stroke={colors.info}
                    strokeWidth="2"
                  />
                  <Path
                    d={chartPaths.txLine}
                    fill="none"
                    stroke={colors.success}
                    strokeWidth="2"
                  />
                </Svg>

                <View style={styles.chartLegend}>
                  <View style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: colors.info },
                      ]}
                    />
                    <Text style={styles.legendText}>
                      {t("bandwidth.rx", "Rx (")}{formatBytes(data[0]?.currentRx || 0)}{t("bandwidth.s", "/s)")}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: colors.success },
                      ]}
                    />
                    <Text style={styles.legendText}>
                      {t("bandwidth.tx", "Tx (")}{formatBytes(data[0]?.currentTx || 0)}{t("bandwidth.s", "/s)")}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View
                style={{
                  height: chartHeight,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={styles.emptyText}>
                  {t("bandwidth.noData", "Waiting for data...")}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Servers breakdown removed as we are only looking at the active server context */}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 24,
      backgroundColor: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.02)",
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 24,
      gap: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    statLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      textTransform: "uppercase",
      fontWeight: "600",
      marginBottom: 8,
    },
    statValue: {
      fontSize: 22,
      fontWeight: "700",
    },
    serversContainer: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 16,
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: "center",
      padding: 24,
    },
    serverRow: {
      marginBottom: 20,
    },
    serverHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    serverName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginLeft: 6,
    },
    serverTotal: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
    },
    progressBar: {
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
      marginBottom: 6,
    },
    serverDetails: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 16,
    },
    serverDetailText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    chartCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
      elevation: 0,
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
    axisText: {
      position: "absolute",
      right: 0,
      fontSize: 10,
      color: colors.textSecondary,
      opacity: 0.6,
    },
  });
