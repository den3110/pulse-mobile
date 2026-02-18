import { useEffect, useState, useRef } from "react";
import { useIsFocused } from "@react-navigation/native";
import { View, StyleSheet, Dimensions } from "react-native";
import {
  Text,
  Card,
  ActivityIndicator,
  ProgressBar,
  MD3Colors,
} from "react-native-paper";
import { useServer } from "../contexts/ServerContext";
import { useAppTheme } from "../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import api from "../services/api";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";

interface ServerStats {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  uptime: string;
}

export default function ServerResourceWidget() {
  const { selectedServer } = useServer();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [stats, setStats] = useState<ServerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ cpu: number; mem: number }[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStats = async () => {
    if (!selectedServer) return;
    try {
      const res = await api.get(`/servers/${selectedServer._id}/stats`);
      const data = res.data?.stats || res.data; // Handle potential nesting

      setStats({
        cpuUsage: data.cpuUsage || 0,
        memoryUsage: data.memoryUsage || 0,
        diskUsage: data.diskUsage || 0,
        uptime: data.uptime || "-",
      });

      // Add to history
      setHistory((prev) => {
        const next = [
          ...prev,
          { cpu: data.cpuUsage || 0, mem: data.memoryUsage || 0 },
        ];
        return next.slice(-20); // Keep last 20 points
      });
    } catch (err) {
      console.error("Failed to fetch server stats", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial history
  useEffect(() => {
    if (selectedServer) {
      api
        .get(`/servers/${selectedServer._id}/stats/history`)
        .then((res) => {
          if (res.data && Array.isArray(res.data)) {
            const hist = res.data.map((item: any) => ({
              cpu: item.cpu,
              mem: item.memory,
            }));
            setHistory(hist);
          }
        })
        .catch((err) => console.log("Failed to load stats history", err));
    }
  }, [selectedServer?._id]);

  // Fetch initial history
  useEffect(() => {
    if (selectedServer) {
      api
        .get(`/servers/${selectedServer._id}/stats/history`)
        .then((res) => {
          if (res.data && Array.isArray(res.data)) {
            const hist = res.data.map((item: any) => ({
              cpu: item.cpu,
              mem: item.memory,
            }));
            setHistory(hist);
          }
        })
        .catch((err) => console.log("Failed to load stats history", err));
    }
  }, [selectedServer?._id]);

  const isFocused = useIsFocused();

  useEffect(() => {
    if (selectedServer && isFocused) {
      // Only show loading on initial fetch if no stats
      if (!stats) setLoading(true);
      fetchStats();
      intervalRef.current = setInterval(fetchStats, 10000);
    } else {
      // Clear interval if lost focus or no server
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedServer?._id, isFocused]);

  if (!selectedServer) return null;

  // Simple Sparkline Logic
  const renderSparkline = (
    data: number[],
    color: string,
    height: number = 40,
  ) => {
    if (data.length < 2) return null;

    // Filter out NaNs or undefined, replace with 0
    const cleanData = data.map((d) =>
      isNaN(d) || d === undefined || d === null ? 0 : d,
    );

    const width = Dimensions.get("window").width - 80; // Approximate
    const max = 100;
    const step = width / Math.max(cleanData.length - 1, 1);

    // Build path
    let path = `M0,${height - (cleanData[0] / max) * height}`;
    for (let i = 1; i < cleanData.length; i++) {
      const val = cleanData[i];
      // Ensure val is not NaN again just in case, though map handled it
      const y = height - (val / max) * height;
      if (!isNaN(y)) {
        path += ` L${i * step},${y}`;
      }
    }

    return (
      <Svg height={height} width="100%" style={{ opacity: 0.8 }}>
        <Path d={path} fill="none" stroke={color} strokeWidth="2" />
      </Svg>
    );
  };

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons
              name="server-network"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.title}>{selectedServer.name}</Text>
          </View>
          <Text style={styles.uptime}>Up: {stats?.uptime || "-"}</Text>
        </View>

        {loading && !stats ? (
          <ActivityIndicator style={{ marginVertical: 20 }} />
        ) : (
          <View style={styles.statsContainer}>
            {/* CPU */}
            <View style={styles.statRow}>
              <View style={styles.statHeader}>
                <Text style={styles.statLabel}>CPU</Text>
                <Text style={styles.statValue}>
                  {stats?.cpuUsage?.toFixed(1)}%
                </Text>
              </View>
              <ProgressBar
                progress={(stats?.cpuUsage || 0) / 100}
                color={colors.primary}
                style={styles.bar}
              />
            </View>

            {/* RAM */}
            <View style={styles.statRow}>
              <View style={styles.statHeader}>
                <Text style={styles.statLabel}>RAM</Text>
                <Text style={styles.statValue}>
                  {stats?.memoryUsage?.toFixed(1)}%
                </Text>
              </View>
              <ProgressBar
                progress={(stats?.memoryUsage || 0) / 100}
                color={colors.accent}
                style={styles.bar}
              />
            </View>

            {/* DISK */}
            <View style={styles.statRow}>
              <View style={styles.statHeader}>
                <Text style={styles.statLabel}>DISK</Text>
                <Text style={styles.statValue}>
                  {stats?.diskUsage?.toFixed(1)}%
                </Text>
              </View>
              <ProgressBar
                progress={(stats?.diskUsage || 0) / 100}
                color={colors.textSecondary}
                style={styles.bar}
              />
            </View>

            {/* Mini Chart Area (Optional, implies history) */}
            <View style={{ marginTop: 10, height: 40, overflow: "hidden" }}>
              {renderSparkline(
                history.map((h) => h.cpu),
                colors.primary,
              )}
            </View>
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const createStyles = (Colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: Colors.card,
      borderRadius: 14,
      marginHorizontal: 12,
      marginTop: 10,
      marginBottom: 6,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: Colors.text,
    },
    uptime: {
      fontSize: 12,
      color: Colors.textSecondary,
      fontFamily: "System", // Monospace if possible
    },
    statsContainer: {
      gap: 12,
    },
    statRow: {
      gap: 6,
    },
    statHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    statLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: Colors.textSecondary,
    },
    statValue: {
      fontSize: 12,
      fontWeight: "700",
      color: Colors.text,
    },
    bar: {
      height: 6,
      borderRadius: 3,
      backgroundColor: Colors.surfaceVariant,
    },
  });
