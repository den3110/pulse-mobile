import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput as RNTextInput,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
} from "react-native";
import CustomAlertDialog, {
  CustomAlertDialogRef,
} from "../../components/CustomAlertDialog";
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  Chip,
  IconButton,
  FAB,
  Portal,
  Dialog,
  TextInput,
  Surface,
  Menu,
  Divider,
  Switch,
  HelperText,
} from "react-native-paper";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useServer } from "../../contexts/ServerContext";

interface PM2Process {
  pm_id: number;
  name: string;
  status: string;
  cpu: number;
  memory: number;
  uptime: number;
  restarts: number;
  mode: string;
  pid: number;
  interpreter: string;
  script: string;
  cwd: string;
  watching: boolean;
  instances: number;
}

const statusColors: Record<string, string> = {
  online: "#22c55e",
  stopping: "#eab308",
  stopped: "#6b7280",
  errored: "#ef4444",
  launching: "#3b82f6",
};

const formatMemory = (bytes: number): string => {
  if (!bytes || bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatUptime = (timestamp: number): string => {
  if (!timestamp) return "-";
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 0) return "-";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
};

export default function PM2ManagerScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  // Create local params and fallback to context if needed,
  // though typically this screen is opened with a serverId param or uses the context
  const { serverId: paramServerId } = useLocalSearchParams<{
    serverId: string;
  }>();
  const { selectedServer } = useServer();
  const serverId = paramServerId || selectedServer?._id;

  const [processes, setProcesses] = useState<PM2Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Start Process Dialog
  const [startVisible, setStartVisible] = useState(false);
  const [startForm, setStartForm] = useState({
    script: "",
    name: "",
    interpreter: "node",
    instances: "1",
    cwd: "",
    args: "",
    maxMemory: "",
    watch: false,
  });
  const [startLoading, setStartLoading] = useState(false);

  // Log Viewer
  const [logVisible, setLogVisible] = useState(false);
  const [logContent, setLogContent] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [currentLogProc, setCurrentLogProc] = useState<string>("");
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(false);

  // Menu visible state per process (using map for simplicity or single tracking)
  const [menuVisible, setMenuVisible] = useState<number | null>(null);

  const dialogRef = useRef<CustomAlertDialogRef>(null);

  const fetchProcesses = useCallback(async () => {
    if (!serverId) return;
    try {
      const { data } = await api.get(`/pm2/${serverId}/processes`);
      setProcesses(data);
    } catch (err: any) {
      console.error(err);
      // alert only on manual refresh?
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchProcesses();
    const interval = setInterval(fetchProcesses, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [fetchProcesses]);

  // Auto-refresh logs
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (logVisible && autoRefreshLogs && currentLogProc) {
      interval = setInterval(() => {
        handleViewLogs(currentLogProc, false);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [logVisible, autoRefreshLogs, currentLogProc]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProcesses();
  };

  const handleAction = async (
    name: string,
    action: "stop" | "restart" | "reload" | "delete",
  ) => {
    if (!serverId) return;
    setActionLoading(`${name}-${action}`);
    setMenuVisible(null);
    try {
      const { data } = await api.post(`/pm2/${serverId}/${name}/${action}`);
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchProcesses();
      } else {
        dialogRef.current?.show(
          t("common.error"),
          data.output || t("pm2.actionFailed"),
        );
      }
    } catch (err: any) {
      dialogRef.current?.show(
        "Error",
        err.response?.data?.message || "Action failed",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async (
    action: "restart-all" | "stop-all" | "save" | "startup" | "flush",
  ) => {
    if (!serverId) return;
    setActionLoading(`bulk-${action}`);
    try {
      const { data } = await api.post(`/pm2/${serverId}/${action}`);
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        dialogRef.current?.show(
          t("common.success"),
          data.message || t("pm2.actionSuccess"),
        );
        fetchProcesses();
      } else {
        dialogRef.current?.show(
          t("common.error"),
          data.output || t("pm2.actionFailed"),
        );
      }
    } catch (err: any) {
      dialogRef.current?.show(
        t("common.error"),
        err.response?.data?.message || t("pm2.actionFailed"),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleStart = async () => {
    if (!serverId || !startForm.script.trim()) return;
    setStartLoading(true);
    try {
      const { data } = await api.post(`/pm2/${serverId}/start`, {
        script: startForm.script,
        name: startForm.name || undefined,
        interpreter: startForm.interpreter || undefined,
        instances: parseInt(startForm.instances) || 1,
        cwd: startForm.cwd || undefined,
        args: startForm.args || undefined,
        maxMemory: startForm.maxMemory || undefined,
        watch: startForm.watch || undefined,
      });
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStartVisible(false);
        setStartForm({
          script: "",
          name: "",
          interpreter: "node",
          instances: "1",
          cwd: "",
          args: "",
          maxMemory: "",
          watch: false,
        });
        fetchProcesses();
      } else {
        dialogRef.current?.show(
          t("common.error"),
          data.output || t("pm2.actionFailed"),
        );
      }
    } catch (err: any) {
      dialogRef.current?.show(
        t("common.error"),
        err.response?.data?.message || t("pm2.actionFailed"),
      );
    } finally {
      setStartLoading(false);
    }
  };

  const handleViewLogs = async (name: string, showLoading = true) => {
    if (!serverId) return;
    if (name !== currentLogProc) {
      setCurrentLogProc(name);
      setLogContent("");
    }
    setMenuVisible(null);
    if (!logVisible) setLogVisible(true);

    if (showLoading) setLogLoading(true);
    try {
      // Fetch logs
      const { data } = await api.get(`/pm2/${serverId}/${name}/logs?lines=200`);
      setLogContent(data.out || data.err || "No logs available");
    } catch (err: any) {
      if (showLoading) {
        setLogContent(err.response?.data?.message || t("deploy.noLogs"));
      }
    } finally {
      if (showLoading) setLogLoading(false);
    }
  };

  // Helper to open bulk menu
  const [bulkMenuVisible, setBulkMenuVisible] = useState(false);

  if (!serverId) {
    return (
      <View style={styles.centered}>
        <Text>{t("common.noData")}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t("pm2.title"),
          headerRight: () => (
            <Menu
              visible={bulkMenuVisible}
              onDismiss={() => setBulkMenuVisible(false)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  iconColor={colors.primary}
                  onPress={() => setBulkMenuVisible(true)}
                />
              }
            >
              <Menu.Item
                onPress={() => {
                  setBulkMenuVisible(false);
                  handleBulkAction("save");
                }}
                title={t("pm2.saveList")}
                leadingIcon="content-save"
              />
              <Menu.Item
                onPress={() => {
                  setBulkMenuVisible(false);
                  handleBulkAction("restart-all");
                }}
                title={t("pm2.restartAll")}
                leadingIcon="restart"
              />
              <Menu.Item
                onPress={() => {
                  setBulkMenuVisible(false);
                  handleBulkAction("stop-all");
                }}
                title={t("pm2.stopAll")}
                leadingIcon="stop"
              />
              <Menu.Item
                onPress={() => {
                  setBulkMenuVisible(false);
                  handleBulkAction("flush");
                }}
                title={t("pm2.flushLogs")}
                leadingIcon="delete-sweep"
              />
              <Divider />
              <Menu.Item
                onPress={() => {
                  setBulkMenuVisible(false);
                  handleBulkAction("startup");
                }}
                title={t("pm2.generateStartup")}
                leadingIcon="power"
              />
            </Menu>
          ),
        }}
      />

      <View style={styles.container}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : processes.length === 0 ? (
          <ScrollView
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            contentContainerStyle={styles.emptyContainer}
          >
            <MaterialCommunityIcons
              name="server-network-off"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyText}>{t("pm2.noProcesses")}</Text>
            <Button
              mode="contained"
              onPress={() => setStartVisible(true)}
              style={{ marginTop: 20 }}
            >
              {t("pm2.startProcess")}
            </Button>
          </ScrollView>
        ) : (
          <ScrollView
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
          >
            {/* Status Summary */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{t("pm2.total")}</Text>
                <Text style={styles.summaryValue}>{processes.length}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{t("common.online")}</Text>
                <Text
                  style={[styles.summaryValue, { color: statusColors.online }]}
                >
                  {processes.filter((p) => p.status === "online").length}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{t("pm2.memory")}</Text>
                <Text style={styles.summaryValue}>
                  {formatMemory(
                    processes.reduce((sum, p) => sum + (p.memory || 0), 0),
                  )}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{t("pm2.cpu")}</Text>
                <Text style={styles.summaryValue}>
                  {processes
                    .reduce((sum, p) => sum + (p.cpu || 0), 0)
                    .toFixed(1)}
                  %
                </Text>
              </View>
            </View>

            {processes.map((proc) => {
              const isActionLoading = actionLoading?.startsWith(proc.name);
              const statusColor =
                statusColors[proc.status] || statusColors.stopped;

              return (
                <Card key={proc.pm_id} style={styles.card}>
                  <Card.Content>
                    <View style={styles.cardHeader}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          flex: 1,
                        }}
                      >
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: statusColor,
                            shadowColor: statusColor,
                            shadowOpacity: 0.6,
                            shadowRadius: 4,
                            elevation: 2,
                          }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.procName}>{proc.name}</Text>
                          <Text style={styles.procMeta}>
                            ID: {proc.pm_id} • PID: {proc.pid} • {proc.mode}
                          </Text>
                        </View>
                      </View>

                      <Menu
                        visible={menuVisible === proc.pm_id}
                        onDismiss={() => setMenuVisible(null)}
                        anchor={
                          <IconButton
                            icon="dots-horizontal"
                            size={20}
                            onPress={() => setMenuVisible(proc.pm_id)}
                          />
                        }
                      >
                        <Menu.Item
                          onPress={() => handleViewLogs(proc.name)}
                          title={t("pm2.viewLogs")}
                          leadingIcon="text-box-outline"
                        />
                        <Divider />
                        {proc.status === "online" ? (
                          <Menu.Item
                            onPress={() => handleAction(proc.name, "stop")}
                            title={t("common.stop")}
                            leadingIcon="stop"
                            titleStyle={{ color: colors.warning }}
                          />
                        ) : (
                          <Menu.Item
                            onPress={() => handleAction(proc.name, "restart")}
                            title={t("common.start")}
                            leadingIcon="play"
                            titleStyle={{ color: colors.success }}
                          />
                        )}
                        <Menu.Item
                          onPress={() => handleAction(proc.name, "restart")}
                          title={t("common.restart")}
                          leadingIcon="restart"
                        />
                        <Menu.Item
                          onPress={() => handleAction(proc.name, "reload")}
                          title={t("pm2.reload")}
                          leadingIcon="refresh"
                        />
                        <Divider />
                        <Menu.Item
                          onPress={() => handleAction(proc.name, "delete")}
                          title={t("common.delete")}
                          leadingIcon="delete"
                          titleStyle={{ color: colors.error }}
                        />
                      </Menu>
                    </View>

                    <Divider style={{ marginVertical: 10 }} />

                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <MaterialCommunityIcons
                          name="memory"
                          size={14}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.statValue}>
                          {formatMemory(proc.memory)}
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <MaterialCommunityIcons
                          name="cpu-64-bit"
                          size={14}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.statValue}>{proc.cpu}%</Text>
                      </View>
                      <View style={styles.statItem}>
                        <MaterialCommunityIcons
                          name="clock-outline"
                          size={14}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.statValue}>
                          {formatUptime(proc.uptime)}
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <MaterialCommunityIcons
                          name="restart"
                          size={14}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.statValue}>{proc.restarts}</Text>
                      </View>
                    </View>

                    {isActionLoading && (
                      <View style={styles.overlayLoading}>
                        <ActivityIndicator color={colors.primary} />
                      </View>
                    )}
                  </Card.Content>
                </Card>
              );
            })}
          </ScrollView>
        )}

        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: colors.primary }]}
          color="#fff"
          onPress={() => setStartVisible(true)}
        />
      </View>

      {/* Start Process Modal - Full Screen */}
      <Modal
        visible={startVisible}
        onRequestClose={() => setStartVisible(false)}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Button onPress={() => setStartVisible(false)}>
              {t("common.cancel")}
            </Button>
            <Text
              style={{ fontSize: 18, fontWeight: "bold", color: colors.text }}
            >
              {t("pm2.startProcess")}
            </Text>
            <Button
              mode="contained"
              onPress={handleStart}
              loading={startLoading}
              disabled={!startForm.script || startLoading}
            >
              {t("common.start")}
            </Button>
          </View>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <TextInput
                label={`${t("pm2.scriptPath")} *`}
                value={startForm.script}
                onChangeText={(t) => setStartForm({ ...startForm, script: t })}
                mode="outlined"
                placeholder={
                  t("pm2.scriptPlaceholder") || "e.g. index.js or npm start"
                }
                style={{ marginBottom: 16 }}
              />
              <TextInput
                label={t("pm2.name")}
                value={startForm.name}
                onChangeText={(t) => setStartForm({ ...startForm, name: t })}
                mode="outlined"
                style={{ marginBottom: 16 }}
              />
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                <TextInput
                  label={t("pm2.interpreter")}
                  value={startForm.interpreter}
                  onChangeText={(t) =>
                    setStartForm({ ...startForm, interpreter: t })
                  }
                  mode="outlined"
                  style={{ flex: 1 }}
                />
                <TextInput
                  label={t("pm2.instances")}
                  value={startForm.instances}
                  onChangeText={(t) =>
                    setStartForm({ ...startForm, instances: t })
                  }
                  mode="outlined"
                  keyboardType="numeric"
                  style={{ flex: 1 }}
                />
              </View>
              <TextInput
                label={t("pm2.cwd")}
                value={startForm.cwd}
                onChangeText={(t) => setStartForm({ ...startForm, cwd: t })}
                mode="outlined"
                style={{ marginBottom: 16 }}
              />
              <TextInput
                label={t("pm2.args")}
                value={startForm.args}
                onChangeText={(t) => setStartForm({ ...startForm, args: t })}
                mode="outlined"
                placeholder={t("pm2.argsPlaceholder") || "--port 3000"}
                style={{ marginBottom: 16 }}
              />
              <TextInput
                label={t("pm2.maxMemory")}
                value={startForm.maxMemory}
                onChangeText={(t) =>
                  setStartForm({ ...startForm, maxMemory: t })
                }
                mode="outlined"
                style={{ marginBottom: 16 }}
              />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: colors.surfaceVariant,
                  padding: 16,
                  borderRadius: 12,
                }}
              >
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: colors.text,
                      marginBottom: 4,
                    }}
                  >
                    {t("pm2.watchMode")}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    {t("pm2.watchModeDesc")}
                  </Text>
                </View>
                <Switch
                  value={startForm.watch}
                  onValueChange={(val) =>
                    setStartForm({ ...startForm, watch: val })
                  }
                  color={colors.primary}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Logs Modal - Full Screen */}
      <Modal
        visible={logVisible}
        onRequestClose={() => setLogVisible(false)}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0d1117" }}>
          <View style={styles.logHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logTitle}>{currentLogProc}</Text>
              <Text style={{ fontSize: 11, color: "#8b949e" }}>
                Showing last 200 lines
              </Text>
            </View>

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text style={{ color: "#c9d1d9", fontSize: 12 }}>
                  {t("pm2.autoRefresh")}
                </Text>
                <Switch
                  value={autoRefreshLogs}
                  onValueChange={setAutoRefreshLogs}
                  color={colors.primary}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </View>
              <IconButton
                icon="close"
                iconColor="#fff"
                size={20}
                onPress={() => setLogVisible(false)}
              />
            </View>
          </View>

          {logLoading && !logContent ? (
            <View style={styles.centered}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <ScrollView style={styles.logScroll}>
              <Text style={styles.logText}>
                {logContent || "No logs found."}
              </Text>
              <View style={{ height: 40 }} />
            </ScrollView>
          )}

          <View style={styles.logFooter}>
            <Button
              mode="contained"
              buttonColor="#21262d"
              textColor="#58a6ff"
              onPress={() => handleViewLogs(currentLogProc, true)}
              icon="refresh"
              loading={logLoading}
            >
              {t("common.refresh")}
            </Button>
          </View>
        </SafeAreaView>
      </Modal>
      <CustomAlertDialog ref={dialogRef} />
    </>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    emptyText: { marginTop: 10, fontSize: 16, color: colors.textSecondary },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
      backgroundColor: colors.card,
      padding: 12,
      borderRadius: 12,
    },
    summaryItem: { alignItems: "center", flex: 1 },
    summaryLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    summaryValue: { fontSize: 14, fontWeight: "bold", color: colors.text },
    card: {
      marginBottom: 12,
      backgroundColor: colors.card,
      borderRadius: 12,
      overflow: "hidden",
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    procName: { fontSize: 16, fontWeight: "700", color: colors.text },
    procMeta: { fontSize: 12, color: colors.textSecondary },
    statsRow: { flexDirection: "row", justifyContent: "space-between" },
    statItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    statValue: { fontSize: 12, color: colors.text, fontWeight: "600" },
    fab: { position: "absolute", margin: 16, right: 0, bottom: 0 },
    overlayLoading: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.3)",
      justifyContent: "center",
      alignItems: "center",
    },
    logContainer: { flex: 1 },
    logHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: "#30363d",
    },
    logTitle: { color: "#fff", fontSize: 16, fontWeight: "bold" },
    logScroll: { flex: 1, padding: 16 },
    logText: {
      color: "#c9d1d9",
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 12,
    },
    logFooter: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: "#30363d",
    },
  });
