import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
} from "react-native";
import {
  Text,
  Searchbar,
  Card,
  Chip,
  ActivityIndicator,
  Divider,
  Portal,
  Modal,
  Button,
  Menu,
  IconButton,
  Switch,
} from "react-native-paper";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import Svg, { G, Path, Circle, Text as SvgText } from "react-native-svg";
import api from "../../services/api";
import { useServer } from "../../contexts/ServerContext";
import { useAppTheme } from "../../contexts/ThemeContext";

interface PortEntry {
  command: string;
  pid: string;
  user: string;
  fd: string;
  type: string;
  device: string;
  sizeOff: string;
  node: string;
  name: string;
  state?: string;
}

interface ProcessDetails {
  cpu: string;
  mem: string;
  start: string;
  time: string;
  cmd: string;
}

// Simple Pie Chart Component
const PieChart = ({
  data,
  size = 100,
  holeColor = "transparent",
}: {
  data: { value: number; color: string }[];
  size?: number;
  holeColor?: string;
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let startAngle = 0;

  if (total === 0) return null;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
        {data.map((item, index) => {
          if (item.value === 0) return null;

          const angle = (item.value / total) * 360;

          // Handle 100% case (Full Circle)
          if (angle >= 360) {
            return (
              <Circle
                key={index}
                cx={size / 2}
                cy={size / 2}
                r={size / 2}
                fill={item.color}
              />
            );
          }

          const endAngle = startAngle + angle;
          const x1 =
            size / 2 + (size / 2) * Math.cos((Math.PI * startAngle) / 180);
          const y1 =
            size / 2 + (size / 2) * Math.sin((Math.PI * startAngle) / 180);
          const x2 =
            size / 2 + (size / 2) * Math.cos((Math.PI * endAngle) / 180);
          const y2 =
            size / 2 + (size / 2) * Math.sin((Math.PI * endAngle) / 180);

          const d = `M${size / 2},${size / 2} L${x1},${y1} A${size / 2},${
            size / 2
          } 0 ${angle > 180 ? 1 : 0},1 ${x2},${y2} Z`;

          startAngle += angle;

          return <Path key={index} d={d} fill={item.color} />;
        })}
        {/* Donut hole */}
        <Circle cx={size / 2} cy={size / 2} r={size / 4} fill={holeColor} />
      </G>
    </Svg>
  );
};

export default function PortsScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const { selectedServer } = useServer();
  const [ports, setPorts] = useState<PortEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [protocolFilter, setProtocolFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [showCharts, setShowCharts] = useState(true);

  // Auto Refresh
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (autoRefresh && selectedServer) {
      interval = setInterval(fetchPorts, 5000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, selectedServer]);

  const handleExport = async () => {
    setMenuVisible(false);
    if (ports.length === 0) return;

    const csvContent = [
      "Command,PID,User,Protocol,Address,Device",
      ...ports.map(
        (p) =>
          `"${p.command}",${p.pid},"${p.user}","${p.node}","${p.name}","${p.device}"`,
      ),
    ].join("\n");

    const fileName = `ports_export_${new Date().getTime()}.csv`;
    // @ts-ignore
    const filePath = `${FileSystem.documentDirectory}${fileName}`;

    try {
      // @ts-ignore
      await FileSystem.writeAsStringAsync(filePath, csvContent, {
        // @ts-ignore
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath);
      } else {
        Alert.alert(
          t("common.error"),
          "Sharing is not available on this device",
        );
      }
    } catch (error) {
      console.error("Export failed", error);
      Alert.alert(t("common.error"), "Failed to export CSV");
    }
  };

  // Details Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProc, setSelectedProc] = useState<PortEntry | null>(null);
  const [procDetails, setProcDetails] = useState<ProcessDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchPorts = async () => {
    if (!selectedServer) return;
    try {
      const res = await api.get(`/ports/${selectedServer._id}`);
      setPorts(res.data);
    } catch (err: any) {
      console.error(err);
      // Toast or Alert
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedServer) {
      fetchPorts();
    }
  }, [selectedServer]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPorts();
  }, []);

  const handleKill = async (pid: string) => {
    if (!selectedServer) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      t("ports.killConfirmTitle", "Kill Process"),
      t("ports.killConfirmMsg", "Are you sure you want to kill this process?"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.kill"),
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/ports/${selectedServer._id}/kill/${pid}`);
              fetchPorts();
            } catch (err) {
              Alert.alert(t("common.error"), t("ports.killFailed"));
            }
          },
        },
      ],
    );
  };

  const handleInspect = async (port: PortEntry) => {
    setSelectedProc(port);
    setModalVisible(true);
    setDetailLoading(true);
    setProcDetails(null);
    try {
      const res = await api.get(
        `/ports/${selectedServer?._id}/process/${port.pid}`,
      );
      setProcDetails(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredPorts = useMemo(() => {
    let result = ports;

    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.command.toLowerCase().includes(lower) ||
          p.pid.includes(lower) ||
          p.name.toLowerCase().includes(lower) ||
          p.user.toLowerCase().includes(lower),
      );
    }

    if (protocolFilter !== "all") {
      result = result.filter((p) =>
        p.node.toLowerCase().includes(protocolFilter.toLowerCase()),
      );
    }

    return result;
  }, [ports, searchQuery, protocolFilter]);

  const stats = useMemo(() => {
    const tcp = ports.filter((p) =>
      p.node.toLowerCase().includes("tcp"),
    ).length;
    const udp = ports.filter((p) =>
      p.node.toLowerCase().includes("udp"),
    ).length;

    // Top Users
    const userMap: Record<string, number> = {};
    ports.forEach((p) => {
      userMap[p.user] = (userMap[p.user] || 0) + 1;
    });
    const topUsers = Object.entries(userMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, val]) => ({ name, value: val }));

    return { total: ports.length, tcp, udp, topUsers };
  }, [ports]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      padding: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      marginBottom: 1,
    },
    statBox: { alignItems: "center", flex: 1 },
    statValue: { fontSize: 18, fontWeight: "bold", color: colors.primary },
    statLabel: { fontSize: 12, color: colors.textSecondary },
    chartContainer: {
      flexDirection: "row",
      padding: 16,
      backgroundColor: colors.surface,
      marginTop: 16,
      marginHorizontal: 16,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "space-around",
      marginBottom: 16,
    },
    topUsersBox: { marginLeft: 16, flex: 1 },
    userRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    filterContainer: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 10,
      backgroundColor: colors.surface,
    },
    chipScroll: { gap: 8 },
    list: { padding: 16, gap: 12 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      marginBottom: 10,
    },
    cardContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 14,
    },
    cmd: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 2,
    },
    meta: { fontSize: 12, color: colors.textSecondary },
    protoBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 6,
      alignSelf: "flex-start",
    },
    protoText: { fontSize: 10, fontWeight: "700" },
    modalContent: {
      backgroundColor: colors.surface,
      margin: 20,
      borderRadius: 14,
      padding: 20,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
  });

  return (
    <>
      <Stack.Screen
        options={{
          title: t("ports.title", "Network Ports"),
          headerRight: () => (
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  onPress={() => setMenuVisible(true)}
                />
              }
            >
              <Menu.Item
                onPress={() => {
                  setAutoRefresh(!autoRefresh);
                  setMenuVisible(false);
                }}
                title={t("common.autoRefresh", "Auto Refresh")}
                trailingIcon={autoRefresh ? "check" : undefined}
              />
              <Menu.Item
                onPress={() => {
                  setShowCharts(!showCharts);
                  setMenuVisible(false);
                }}
                title={showCharts ? "Hide Charts" : "Show Charts"}
              />
              <Divider />
              <Menu.Item
                onPress={handleExport}
                title={t("common.exportCSV", "Export CSV")}
                leadingIcon="file-export"
              />
            </Menu>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        stickyHeaderIndices={[1]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Top Content (Stats & Charts) - Index 0 */}
        <View>
          <View style={styles.header}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>{t("ports.total")}</Text>
            </View>
            <View
              style={[
                styles.statBox,
                {
                  borderLeftWidth: 1,
                  borderRightWidth: 1,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.statValue, { color: colors.info }]}>
                {stats.tcp}
              </Text>
              <Text style={styles.statLabel}>{t("ports.tcp")}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.accent }]}>
                {stats.udp}
              </Text>
              <Text style={styles.statLabel}>{t("ports.udp")}</Text>
            </View>
          </View>

          {showCharts && stats.total > 0 && (
            <View style={styles.chartContainer}>
              <View style={{ alignItems: "center" }}>
                <PieChart
                  data={[
                    { value: stats.tcp, color: colors.info },
                    { value: stats.udp, color: colors.accent },
                  ]}
                  size={80}
                  holeColor={colors.surface}
                />
                <Text
                  style={{
                    fontSize: 10,
                    color: colors.textSecondary,
                    marginTop: 4,
                  }}
                >
                  {t("ports.protocol")}
                </Text>
              </View>
              <View style={styles.topUsersBox}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "bold",
                    marginBottom: 8,
                    color: colors.text,
                  }}
                >
                  {t("ports.topUsers")}
                </Text>
                {stats.topUsers.map((u, i) => (
                  <View key={i} style={styles.userRow}>
                    <Text style={{ fontSize: 11, color: colors.text }}>
                      {u.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "bold",
                        color: colors.primary,
                      }}
                    >
                      {u.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Filters - Index 1 (Sticky) */}
        <View style={styles.filterContainer}>
          <Searchbar
            placeholder={t("common.search")}
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={{
              backgroundColor: colors.background,
              height: 40,
              marginBottom: 12,
            }}
            inputStyle={{ minHeight: 40, alignSelf: "center" }}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroll}
          >
            {["all", "tcp", "udp", "ipv4", "ipv6"].map((p) => {
              const isActive = protocolFilter === p;
              return (
                <Chip
                  key={p}
                  selected={isActive}
                  onPress={() => setProtocolFilter(p)}
                  showSelectedOverlay
                  style={{
                    backgroundColor: isActive
                      ? colors.primary + "20"
                      : colors.background,
                  }}
                  textStyle={{
                    color: isActive ? colors.primary : colors.textSecondary,
                  }}
                >
                  {p.toUpperCase()}
                </Chip>
              );
            })}
          </ScrollView>
        </View>

        {/* List - Index 2 */}
        <View style={styles.list}>
          {loading && !refreshing ? (
            <ActivityIndicator
              style={{ marginTop: 20 }}
              color={colors.primary}
            />
          ) : filteredPorts.length === 0 ? (
            <Text
              style={{
                textAlign: "center",
                color: colors.textSecondary,
                marginTop: 40,
              }}
            >
              {t("common.noResults")}
            </Text>
          ) : (
            filteredPorts.map((item, idx) => (
              <Pressable
                key={`${item.pid}-${idx}`}
                onPress={() => handleInspect(item)}
                onLongPress={() => handleKill(item.pid)}
                delayLongPress={500}
                style={({ pressed }) => [
                  styles.card,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={styles.cardContent}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cmd} numberOfLines={1}>
                      {item.command}
                    </Text>
                    <Text style={styles.meta}>
                      PID: {item.pid} · User: {item.user}
                    </Text>
                    <Text
                      style={[
                        styles.meta,
                        { marginTop: 2, color: colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", paddingLeft: 10 }}>
                    <View
                      style={[
                        styles.protoBadge,
                        {
                          backgroundColor: item.node
                            .toLowerCase()
                            .includes("tcp")
                            ? colors.info + "20"
                            : colors.accent + "20",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.protoText,
                          {
                            color: item.node.toLowerCase().includes("tcp")
                              ? colors.info
                              : colors.accent,
                          },
                        ]}
                      >
                        {item.node}
                      </Text>
                    </View>
                    <Text style={[styles.meta, { marginTop: 6 }]}>
                      {item.state || "LISTEN"}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              marginBottom: 16,
              color: colors.text,
            }}
          >
            {selectedProc?.command}
          </Text>
          {detailLoading ? (
            <ActivityIndicator color={colors.primary} style={{ padding: 20 }} />
          ) : procDetails ? (
            <View>
              <View style={styles.detailRow}>
                <Text style={{ color: colors.textSecondary }}>PID</Text>
                <Text style={{ color: colors.text, fontWeight: "600" }}>
                  {selectedProc?.pid}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={{ color: colors.textSecondary }}>User</Text>
                <Text style={{ color: colors.text, fontWeight: "600" }}>
                  {selectedProc?.user}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={{ color: colors.textSecondary }}>CPU Usage</Text>
                <Text style={{ color: colors.text, fontWeight: "600" }}>
                  {procDetails.cpu}%
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={{ color: colors.textSecondary }}>Memory</Text>
                <Text style={{ color: colors.text, fontWeight: "600" }}>
                  {procDetails.mem}%
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={{ color: colors.textSecondary }}>Started</Text>
                <Text style={{ color: colors.text, fontWeight: "600" }}>
                  {procDetails.start}
                </Text>
              </View>
              <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                <Text style={{ color: colors.textSecondary }}>
                  Full Command
                </Text>
              </View>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "monospace",
                  fontSize: 12,
                  backgroundColor: colors.background,
                  padding: 8,
                  borderRadius: 6,
                }}
              >
                {procDetails.cmd}
              </Text>
            </View>
          ) : (
            <Text style={{ color: colors.error }}>Failed to load details</Text>
          )}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
            <Button
              mode="outlined"
              onPress={() => setModalVisible(false)}
              style={{ flex: 1 }}
            >
              {t("common.close")}
            </Button>
            <Button
              mode="contained"
              buttonColor={colors.error}
              onPress={() => {
                setModalVisible(false);
                if (selectedProc) handleKill(selectedProc.pid);
              }}
              style={{ flex: 1 }}
            >
              {t("common.kill")}
            </Button>
          </View>
        </Modal>
      </Portal>
    </>
  );
}
