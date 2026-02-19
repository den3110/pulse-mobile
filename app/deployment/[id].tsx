import { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
  Share,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Pressable,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  Chip,
  IconButton,
  Divider,
  Portal,
  Modal,
} from "react-native-paper";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { Colors, statusColor } from "../../constants/theme";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { connectSocket, getSocket } from "../../services/socket";
import * as Haptics from "expo-haptics";

// Safe date formatting to avoid [invalid date]
const safeTime = (v: any): string => {
  if (!v) return "--:--:--";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "--:--:--" : d.toLocaleTimeString();
};

const safeDate = (v: any): string => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

interface LogEntry {
  log: string;
  type: "info" | "error" | "success" | "warning";
  timestamp: string;
}

export default function DeploymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useAppTheme();
  const Colors = colors;
  const styles = createStyles(colors);
  const logScrollRef = useRef<ScrollView>(null);

  const [deployment, setDeployment] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [command, setCommand] = useState("");
  const [cmdHistory, setCmdHistory] = useState<
    { command: string; stdout: string; stderr: string; code: number }[]
  >([]);
  const [executing, setExecuting] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const termScrollRef = useRef<ScrollView>(null);

  const eventSourceRef = useRef<any>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      let targetProjectId = id;
      let initialDeployment: any = null;

      // Logic: Try to verify if 'id' is a project ID or Deployment ID
      // We assume it's a Project ID first (common case from Dashboard)
      try {
        const projRes = await api.get(`/projects/${id}`);
        setProject(projRes.data);
        targetProjectId = id;
      } catch (e: any) {
        // If 404, it might be a Deployment ID
        if (e.response?.status === 404 || e.response?.status === 500) {
          try {
            const depRes = await api.get(`/deployments/${id}`);
            const dep = depRes.data;
            if (dep && dep.project) {
              setProject(dep.project); // The endpoint populates project
              setDeployment(dep);
              targetProjectId = dep.project._id || dep.project;
              initialDeployment = dep;
            }
          } catch (err) {
            console.error("Failed to load as deployment", err);
          }
        }
      }

      // 2. Fetch deployment history (using targetProjectId)
      if (targetProjectId) {
        try {
          const histRes = await api.get(
            `/deployments/${targetProjectId}/history`,
          );
          const historyData = histRes.data?.deployments || histRes.data || [];
          setHistory(historyData);

          // If we didn't start with a specific deployment, use the latest
          if (!initialDeployment && historyData.length > 0) {
            // Check if we already have a selected deployment (from state)
            // If so, update it with fresh data from history instead of resetting to latest
            if (deployment) {
              const updatedCurrent = historyData.find(
                (d: any) => d._id === deployment._id,
              );
              initialDeployment = updatedCurrent || deployment;
              // Only update state if data changed (optional, but good for refresh)
              setDeployment(initialDeployment);
            } else {
              // First load or no selection, default to latest
              initialDeployment = historyData[0];
              setDeployment(initialDeployment);
            }
          }
        } catch {}

        // 3. Fetch server stats
        // We can get server ID from project state if set above, or we need to wait?
        // setProject update is async batched, so we might need to rely on the data object
        // Actually we can just rely on the existing useEffect that watches [project?.server] logic
      }

      // 3. Load logs for the active deployment
      if (initialDeployment) {
        // If we already fetched deployment details, we might want to ensure we have logs
        try {
          const { data } = await api.get(
            `/deployments/${initialDeployment._id}/logs`,
          );
          setLogs(
            (data.logs || []).map((entry: any) => {
              // Backward compatibility for string logs
              if (typeof entry === "string") {
                return {
                  log: entry,
                  type:
                    initialDeployment.status === "failed" ? "error" : "info",
                  timestamp:
                    initialDeployment.startedAt || new Date().toISOString(),
                };
              }
              // New format: structured object
              return {
                log:
                  entry.log ||
                  entry.message ||
                  entry.text ||
                  JSON.stringify(entry),
                type: (entry.type ||
                  (initialDeployment.status === "failed"
                    ? "error"
                    : "info")) as LogEntry["type"],
                timestamp:
                  entry.timestamp ||
                  initialDeployment.startedAt ||
                  new Date().toISOString(),
              };
            }),
          );
        } catch {}

        // Auto-start stream if in progress
        const inProgress = [
          "pending",
          "cloning",
          "installing",
          "building",
          "starting",
          "deploying",
        ];
        // We rely on Socket.IO for realtime logs now, so no need for SSE which causes flickering/duplicates
        if (inProgress.includes(initialDeployment.status)) {
          setDeploying(true);
        }
      }
    } catch (err) {
      console.error(err);
      Alert.alert(t("common.error"), t("common.failedLoad"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // SSE logic removed in favor of Socket.IO
  // const startSSEStream = ...

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    // Setup socket
    let socketCleanup: (() => void) | undefined;
    (async () => {
      try {
        const socket = await connectSocket();

        // Join deployment room
        const depId = deployment?._id || (id && !project ? id : null);
        if (depId) {
          socket.emit("join:deployment", depId);
        }

        // Also join project room if we know it
        // This ensures we get updates even if we don't know the specific deployment ID yet
        // or if a new deployment starts while we are here.
        const pId = project?._id || (id && !depId ? id : null);
        if (pId) {
          socket.emit("join:project", pId);
        }

        // Listen for deployment updates
        // Listen for deployment updates
        socket.on("deployment:status", (data: any) => {
          console.log("[Mobile] Received deployment:status", data);

          const currentProjectId = project?._id || id;
          const isRelevant =
            data.projectId === currentProjectId ||
            data.deploymentId === id ||
            data.deploymentId === deployment?._id;

          if (isRelevant) {
            // Update deployment state
            setDeployment((prev: any) => {
              if (!prev) return prev;
              return { ...prev, status: data.status };
            });

            // Update project state if needed (for list views etc)
            setProject((prev: any) => {
              if (!prev) return prev;
              return { ...prev, status: data.status };
            });

            // Update history list locally
            setHistory((prev) =>
              prev.map((item: any) =>
                item._id === data.deploymentId
                  ? { ...item, status: data.status }
                  : item,
              ),
            );

            // If status is final or running, refresh data to get full details (end time, etc)
            if (
              ["success", "failed", "cancelled", "stopped", "running"].includes(
                data.status,
              )
            ) {
              fetchData();
            }

            // Haptic feedback
            if (data.status === "success" || data.status === "running") {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            } else if (data.status === "failed") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          }
        });

        socket.on("deployment:log", (data: any) => {
          const currentProjectId = project?._id || id;
          if (
            data.projectId === currentProjectId ||
            data.deploymentId === id ||
            data.deploymentId === deployment?._id
          ) {
            const newLog: LogEntry = {
              log:
                data.message || data.text || data.log || JSON.stringify(data),
              type: (data.type || "info") as LogEntry["type"],
              timestamp: data.timestamp || new Date().toISOString(),
            };
            setLogs((prev) => [...prev, newLog]);
          }
        });

        socketCleanup = () => {
          if (depId) socket.emit("leave:deployment", depId);
          if (pId) socket.emit("leave:project", pId);
          socket.off("deployment:status");
          socket.off("deployment:log");
        };
      } catch {}
    })();

    return () => {
      socketCleanup?.();
      if (eventSourceRef.current) {
        eventSourceRef.current.cancel?.();
      }
    };
  }, [id, project?._id, deployment?._id]);

  // Separate effect for Server Stats
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    if (project?.server) {
      const serverId = project.server._id || project.server;
      (async () => {
        try {
          const socket = await connectSocket();
          socket.emit("join:server", serverId);

          const handleStats = (data: any) => {
            if (data.serverId === serverId) {
              setStats(data.stats);
            }
          };

          socket.on("server:stats", handleStats);

          cleanup = () => {
            socket.emit("leave:server", serverId);
            socket.off("server:stats", handleStats);
          };
        } catch (e) {
          // console.log("Socket stats error", e);
        }
      })();
    }
    return () => {
      cleanup?.();
    };
  }, [project?.server]);

  // Auto-scroll logic moved to ScrollView onContentSizeChange

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      await api.post(`/deployments/${id}/deploy`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Pass the project ID explicitly if we have it, or let it fallback
      // startSSEStream(project?._id || id); // Removed in favor of Socket.IO
      fetchData();
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("deploy.deployFailed"),
      );
    } finally {
      setDeploying(false);
    }
  };

  const handleStop = async () => {
    try {
      await api.post(`/deployments/${id}/stop`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchData();
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    }
  };

  const handleRestart = async () => {
    try {
      await api.post(`/deployments/${id}/restart`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchData();
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    }
  };

  const handleRollback = async () => {
    Alert.alert(t("deploy.rollback"), t("deploy.rollbackConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("deploy.rollback"),
        onPress: async () => {
          try {
            await api.post(`/deployments/${id}/rollback`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchData();
          } catch (err: any) {
            Alert.alert(
              t("common.error"),
              err.response?.data?.message || t("deploy.rollbackFailed"),
            );
          }
        },
      },
    ]);
  };

  const handleCancel = async () => {
    try {
      await api.post(`/deployments/${id}/cancel`);
      fetchData();
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    }
  };

  const handleSchedule = async () => {
    try {
      await api.post(`/deployments/${id}/schedule`, {
        scheduledFor: scheduledDate.toISOString(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("common.success"), t("deploy.scheduled"));
      fetchData();
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    }
  };

  const handleCancelSchedule = async () => {
    try {
      await api.delete(`/deployments/${id}/schedule`);
      fetchData();
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    }
  };

  const exportLogs = async () => {
    try {
      await Share.share({
        message: logs.join("\n"),
        title: t("deploy.logsTitle", { name: project?.name || id }),
      });
    } catch {}
  };

  const fetchDiff = async () => {
    try {
      const res = await api.get(`/deployments/${id}/diff`);
      Alert.alert(t("deploy.gitDiff"), res.data?.diff || t("deploy.noDiff"), [
        { text: t("common.ok") },
      ]);
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    }
  };

  const handleSelectDeployment = async (dep: any) => {
    if (dep._id === deployment?._id) return;
    setDeployment(dep);
    setLoading(true);

    // Stop streaming if switching away from active
    setStreaming(false);

    try {
      const { data } = await api.get(`/deployments/${dep._id}/logs`);
      const savedLogs: string[] = data.logs || [];
      setLogs(
        savedLogs.map((entry: any) => {
          if (typeof entry === "string") {
            return {
              log: entry,
              type: dep.status === "failed" ? "error" : "info",
              timestamp: dep.startedAt,
            };
          }
          return {
            log:
              entry.log || entry.message || entry.text || JSON.stringify(entry),
            type: (entry.type ||
              (dep.status === "failed" ? "error" : "info")) as LogEntry["type"],
            timestamp:
              entry.timestamp || dep.startedAt || new Date().toISOString(),
          };
        }),
      );
    } catch (err: any) {
      Alert.alert(t("common.error"), t("deploy.loadLogsFailed"));
    } finally {
      setLoading(false);
    }
  };

  const runCommand = async () => {
    const cmd = command.trim();
    if (!cmd || !project?.server) return;
    setCommand("");
    setExecuting(true);
    try {
      const sId = project.server?._id || project.server;
      const deployPath = project.deployPath || "~";
      const res = await api.post(`/servers/${sId}/exec`, {
        command: `cd ${deployPath} && ${cmd}`,
      });
      setCmdHistory((prev) => [
        ...prev,
        {
          command: cmd,
          stdout: res.data.output || res.data.stdout || "",
          stderr: res.data.stderr || "",
          code: res.data.code ?? 0,
        },
      ]);
    } catch (err: any) {
      setCmdHistory((prev) => [
        ...prev,
        {
          command: cmd,
          stdout: "",
          stderr:
            err.response?.data?.message ||
            err.message ||
            t("deploy.connectionFailed"),
          code: 1,
        },
      ]);
    } finally {
      setExecuting(false);
      setTimeout(
        () => termScrollRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }
  };

  const parsePercent = (s: string) => parseFloat(s?.replace("%", "") || "0");

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const currentStatus = deployment?.status || project?.status || "unknown";

  return (
    <>
      <Stack.Screen
        options={{
          title: project?.name || t("common.deployment") || "Deployment",
          headerRight: () => (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginRight: -8,
                gap: -4,
              }}
            >
              <IconButton
                icon="file-document"
                iconColor={Colors.textSecondary}
                onPress={fetchDiff}
                size={20}
                style={{ marginVertical: 0 }}
              />
              <IconButton
                icon="share-variant"
                iconColor={Colors.textSecondary}
                onPress={exportLogs}
                size={20}
                style={{ marginVertical: 0 }}
              />
            </View>
          ),
        }}
      />
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
        {/* Status Card */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.statusRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.projectName}>
                  {project?.name || t("common.deployment")}
                </Text>
                <Text style={styles.meta}>
                  {project?.branch || "—"}
                  {deployment?.commitHash &&
                    ` • ${deployment.commitHash.slice(0, 7)}`}
                  {project?.server?.name && ` • ${project.server.name}`}
                </Text>
                {deployment?.commitMessage && (
                  <Text
                    style={[styles.meta, { fontSize: 12, marginTop: 2 }]}
                    numberOfLines={1}
                  >
                    {deployment.commitMessage}{" "}
                    {deployment.commitAuthor
                      ? `(${deployment.commitAuthor})`
                      : ""}
                  </Text>
                )}
              </View>
              <Chip
                compact
                style={{
                  backgroundColor: statusColor(currentStatus, colors) + "20",
                }}
                textStyle={{
                  color: statusColor(currentStatus, colors),
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                {t(`deploy.status_${currentStatus}`, {
                  defaultValue: currentStatus,
                })}
              </Chip>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <Button
                mode="contained"
                onPress={handleDeploy}
                loading={deploying}
                icon="rocket-launch"
                buttonColor={Colors.primary}
                style={styles.actionBtn}
                compact
              >
                {t("common.deploy")}
              </Button>
              <Button
                mode="outlined"
                onPress={handleStop}
                icon="stop"
                textColor={Colors.error}
                style={[styles.actionBtn, { borderColor: Colors.error }]}
                compact
              >
                {t("common.stop")}
              </Button>
              <Button
                mode="outlined"
                onPress={handleRestart}
                icon="restart"
                textColor={Colors.warning}
                style={[styles.actionBtn, { borderColor: Colors.warning }]}
                compact
              >
                {t("common.restart")}
              </Button>
            </View>
            <View style={styles.actions}>
              <Button
                mode="outlined"
                onPress={handleRollback}
                icon="history"
                textColor={Colors.info}
                style={[styles.actionBtn, { borderColor: Colors.info }]}
                compact
              >
                {t("deploy.rollback")}
              </Button>
              <Button
                mode="outlined"
                onPress={handleCancel}
                icon="cancel"
                textColor={Colors.textSecondary}
                style={[styles.actionBtn, { borderColor: Colors.border }]}
                compact
              >
                {t("common.cancel")}
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Server Monitor */}
        {stats && (
          <Card style={styles.card}>
            <Card.Content>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 12,
                }}
              >
                <MaterialCommunityIcons
                  name="chart-bar"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.sectionTitle}>
                  {t("deploy.serverMonitor")}
                </Text>
              </View>
              <View style={styles.monitorRow}>
                <MonitorGauge
                  label={t("common.cpu")}
                  value={stats.cpu}
                  color={Colors.info}
                />
                <MonitorGauge
                  label={t("common.ram")}
                  value={stats.memory?.percent}
                  color={Colors.accent}
                />
                <MonitorGauge
                  label={t("common.disk")}
                  value={stats.disk?.percent}
                  color={Colors.warning}
                />
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Schedule */}
        <Card style={styles.card}>
          <Card.Content>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: 12,
              }}
            >
              <MaterialCommunityIcons
                name="clock-outline"
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.sectionTitle}>
                {t("deploy.scheduleDeploy")}
              </Text>
            </View>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={styles.schedulePickerBtn}
            >
              <MaterialCommunityIcons
                name="calendar"
                size={20}
                color={Colors.primary}
              />
              <Text style={styles.schedulePickerText}>
                {scheduledDate.toLocaleString()}
              </Text>
            </Pressable>
            {/* Date Picker Bottom Sheet */}
            <Portal>
              <Modal
                visible={showDatePicker}
                onDismiss={() => setShowDatePicker(false)}
                contentContainerStyle={styles.pickerSheet}
              >
                <View style={styles.pickerSheetHeader}>
                  <Text style={styles.pickerSheetTitle}>
                    {t("deploy.selectDate") || "Select Date"}
                  </Text>
                  <Button
                    mode="text"
                    onPress={() => {
                      setShowDatePicker(false);
                      setShowTimePicker(true);
                    }}
                    textColor={Colors.primary}
                  >
                    {t("common.done") || "Done"}
                  </Button>
                </View>
                <DateTimePicker
                  value={scheduledDate}
                  mode="date"
                  display="spinner"
                  onChange={(_, date) => {
                    if (date) setScheduledDate(date);
                    if (Platform.OS === "android") {
                      setShowDatePicker(false);
                      if (date) setShowTimePicker(true);
                    }
                  }}
                  themeVariant="dark"
                  style={{ height: 200 }}
                />
              </Modal>
            </Portal>

            {/* Time Picker Bottom Sheet */}
            <Portal>
              <Modal
                visible={showTimePicker}
                onDismiss={() => setShowTimePicker(false)}
                contentContainerStyle={styles.pickerSheet}
              >
                <View style={styles.pickerSheetHeader}>
                  <Text style={styles.pickerSheetTitle}>
                    {t("deploy.selectTime") || "Select Time"}
                  </Text>
                  <Button
                    mode="text"
                    onPress={() => setShowTimePicker(false)}
                    textColor={Colors.primary}
                  >
                    {t("common.done") || "Done"}
                  </Button>
                </View>
                <DateTimePicker
                  value={scheduledDate}
                  mode="time"
                  display="spinner"
                  onChange={(_, time) => {
                    if (time) setScheduledDate(time);
                    if (Platform.OS === "android") {
                      setShowTimePicker(false);
                    }
                  }}
                  themeVariant="dark"
                  style={{ height: 200 }}
                />
              </Modal>
            </Portal>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Button
                mode="contained"
                onPress={handleSchedule}
                compact
                buttonColor={Colors.primary}
                style={{ flex: 1, borderRadius: 10 }}
                icon="clock-check"
              >
                {t("deploy.schedule")}
              </Button>
              <Button
                mode="outlined"
                onPress={handleCancelSchedule}
                compact
                textColor={Colors.error}
                style={{ borderColor: Colors.error, borderRadius: 10 }}
                icon="close"
              >
                {t("common.cancel")}
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Deployment Logs */}
        <Card style={styles.card}>
          {/* Header */}
          <View style={styles.logCardHeader}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text style={{ fontSize: 15 }}>📋</Text>
              <Text style={styles.sectionTitle}>{t("deploy.logs")}</Text>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <IconButton
                icon="download"
                iconColor={Colors.textSecondary}
                size={18}
                onPress={exportLogs}
                style={{ margin: 0 }}
                disabled={logs.length === 0}
              />
              <IconButton
                icon="delete-sweep"
                iconColor={Colors.textSecondary}
                size={18}
                onPress={() => setLogs([])}
                style={{ margin: 0 }}
              />
            </View>
          </View>

          {/* Search */}
          <View style={styles.logSearchRow}>
            <MaterialCommunityIcons
              name="magnify"
              size={16}
              color={Colors.textSecondary}
            />
            <RNTextInput
              value={logSearch}
              onChangeText={setLogSearch}
              placeholder="Search logs..."
              placeholderTextColor={Colors.textSecondary}
              style={styles.logSearchInput}
              autoCapitalize="none"
            />
          </View>

          {/* Terminal */}
          <View style={styles.logTerminal}>
            {/* Terminal header with dots */}
            <View style={styles.logTerminalHeader}>
              <View style={styles.logTerminalDots}>
                <View
                  style={[
                    styles.logTerminalDot,
                    { backgroundColor: "#ff5f57" },
                  ]}
                />
                <View
                  style={[
                    styles.logTerminalDot,
                    { backgroundColor: "#febc2e" },
                  ]}
                />
                <View
                  style={[
                    styles.logTerminalDot,
                    { backgroundColor: "#28c840" },
                  ]}
                />
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                {streaming ? (
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>{t("common.live")}</Text>
                  </View>
                ) : (
                  <Text style={{ color: "#8b949e", fontSize: 11 }}>
                    ○ {t("common.idle")}
                  </Text>
                )}
              </View>
            </View>

            {/* Log body */}
            <ScrollView
              ref={logScrollRef}
              style={styles.logContainer}
              contentContainerStyle={{ paddingBottom: 40 }}
              onContentSizeChange={() =>
                logScrollRef.current?.scrollToEnd({ animated: true })
              }
              nestedScrollEnabled
            >
              {logs.length === 0 ? (
                <Text style={styles.logTextDim}>{t("deploy.noLogsYet")}</Text>
              ) : (
                logs
                  .filter(
                    (entry) =>
                      !logSearch ||
                      entry.log.toLowerCase().includes(logSearch.toLowerCase()),
                  )
                  .map((entry, index) => {
                    const isStep = /^[📥📦🔨🚀⏹️🔧📂🎉❌⚙]/.test(entry.log);
                    let color = "#c9d1d9"; // Default text
                    if (entry.type === "error") color = "#f85149";
                    else if (entry.type === "success") color = "#3fb950";
                    else if (entry.type === "warning") color = "#eab308";

                    if (isStep) {
                      return (
                        <View
                          key={index}
                          style={{ marginTop: 8, marginBottom: 4 }}
                        >
                          <Text
                            style={{
                              color: color,
                              fontWeight: "bold",
                              fontSize: 13,
                              fontFamily:
                                Platform.OS === "ios" ? "Menlo" : "monospace",
                            }}
                          >
                            {entry.log}
                          </Text>
                        </View>
                      );
                    }

                    return (
                      <View
                        key={index}
                        style={{ flexDirection: "row", marginBottom: 2 }}
                      >
                        <Text
                          style={{
                            color: "#6b7280",
                            fontSize: 11,
                            marginRight: 8,
                            fontFamily:
                              Platform.OS === "ios" ? "Menlo" : "monospace",
                            minWidth: 60,
                          }}
                        >
                          {entry.timestamp
                            ? new Date(entry.timestamp).toLocaleTimeString([], {
                                hour12: false,
                              })
                            : "--:--:--"}
                        </Text>
                        <Text
                          style={{
                            color: color,
                            fontSize: 12,
                            fontFamily:
                              Platform.OS === "ios" ? "Menlo" : "monospace",
                            flex: 1,
                          }}
                        >
                          {entry.log}
                        </Text>
                      </View>
                    );
                  })
              )}
            </ScrollView>
          </View>
        </Card>

        {/* Remote Terminal */}
        <Card style={styles.card}>
          {/* Collapsible header */}
          <Pressable
            onPress={() => setTerminalOpen(!terminalOpen)}
            style={styles.termHeader}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <MaterialCommunityIcons
                name="console"
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.sectionTitle}>
                {t("deploy.remoteTerminal")}
              </Text>
              {project?.deployPath ? (
                <View style={styles.termPathChip}>
                  <Text style={styles.termPathText}>{project.deployPath}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
              {terminalOpen ? "▲" : "▼"}
            </Text>
          </Pressable>

          {terminalOpen && (
            <View style={styles.termBody}>
              {/* Terminal header dots */}
              <View style={styles.termDotRow}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <View
                    style={[styles.termDot, { backgroundColor: "#ff5f57" }]}
                  />
                  <View
                    style={[styles.termDot, { backgroundColor: "#ffbd2e" }]}
                  />
                  <View
                    style={[styles.termDot, { backgroundColor: "#28c840" }]}
                  />
                </View>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Text
                    style={{
                      color: "#8b949e",
                      fontSize: 11,
                      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                    }}
                  >
                    ssh · {project?.deployPath || "~"}
                  </Text>
                  <Pressable onPress={() => setCmdHistory([])}>
                    <MaterialCommunityIcons
                      name="delete-sweep"
                      size={16}
                      color="#8b949e"
                    />
                  </Pressable>
                </View>
              </View>

              {/* Output area */}
              <ScrollView
                ref={termScrollRef}
                style={styles.termOutput}
                contentContainerStyle={{ paddingBottom: 40 }}
                onContentSizeChange={() =>
                  termScrollRef.current?.scrollToEnd({ animated: true })
                }
                nestedScrollEnabled
              >
                {cmdHistory.length === 0 && (
                  <Text
                    style={{
                      color: "#6b7280",
                      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                      fontSize: 11,
                    }}
                  >
                    {t("servers.commandPlaceholder") ||
                      "Type a command and press Enter..."}
                  </Text>
                )}
                {cmdHistory.map((entry, i) => (
                  <View key={i} style={{ marginBottom: 12 }}>
                    <Text
                      style={{
                        color: "#79c0ff",
                        fontFamily:
                          Platform.OS === "ios" ? "Menlo" : "monospace",
                        fontSize: 12,
                      }}
                    >
                      <Text style={{ color: "#3fb950" }}>$ </Text>
                      {entry.command}
                    </Text>
                    {entry.stdout ? (
                      <Text
                        style={{
                          color: "#c9d1d9",
                          fontFamily:
                            Platform.OS === "ios" ? "Menlo" : "monospace",
                          fontSize: 11,
                          lineHeight: 18,
                        }}
                        selectable
                      >
                        {entry.stdout}
                      </Text>
                    ) : null}
                    {entry.stderr ? (
                      <Text
                        style={{
                          color: "#f85149",
                          fontFamily:
                            Platform.OS === "ios" ? "Menlo" : "monospace",
                          fontSize: 11,
                          lineHeight: 18,
                        }}
                        selectable
                      >
                        {entry.stderr}
                      </Text>
                    ) : null}
                    {entry.code !== 0 && (
                      <Text
                        style={{
                          color: "#f85149",
                          fontSize: 10,
                          fontFamily:
                            Platform.OS === "ios" ? "Menlo" : "monospace",
                        }}
                      >
                        exit code: {entry.code}
                      </Text>
                    )}
                  </View>
                ))}
                {executing && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <ActivityIndicator size={12} color="#6b7280" />
                    <Text
                      style={{
                        color: "#6b7280",
                        fontFamily:
                          Platform.OS === "ios" ? "Menlo" : "monospace",
                        fontSize: 11,
                      }}
                    >
                      {t("common.executing")}
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Input area */}
              <View style={styles.termInputRow}>
                <Text
                  style={{
                    color: "#3fb950",
                    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                    fontSize: 13,
                  }}
                >
                  $
                </Text>
                <RNTextInput
                  value={command}
                  onChangeText={setCommand}
                  placeholder="Enter command..."
                  placeholderTextColor="#6b7280"
                  style={styles.termInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={runCommand}
                  editable={!executing}
                />
                <Button
                  mode="contained"
                  onPress={runCommand}
                  loading={executing}
                  disabled={executing || !command.trim()}
                  compact
                  buttonColor={Colors.primary}
                  style={{ minWidth: 60, height: 28, borderRadius: 6 }}
                >
                  Run
                </Button>
              </View>
            </View>
          )}
        </Card>

        {/* History */}
        <Card style={styles.card}>
          <Card.Content>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: 12,
              }}
            >
              <MaterialCommunityIcons
                name="history"
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.sectionTitle}>
                {t("deploy.history")} ({history.length})
              </Text>
            </View>
            {history.slice(0, 10).map((dep: any) => {
              const isSelected = deployment?._id === dep._id;
              return (
                <Pressable
                  key={dep._id}
                  onPress={() => handleSelectDeployment(dep)}
                  style={({ pressed }) => [
                    styles.historyItem,
                    pressed && { backgroundColor: Colors.surfaceVariant },
                    isSelected && {
                      backgroundColor: Colors.primary + "10", // 10% opacity primary
                      borderLeftWidth: 3,
                      borderLeftColor: Colors.primary,
                      paddingLeft: 9, // adjust for border
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.historyVersion,
                        isSelected && { color: Colors.primary },
                      ]}
                    >
                      #{dep.version || dep._id.slice(-6)}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {safeDate(dep.startedAt || dep.createdAt)}
                    </Text>
                  </View>
                  <Chip
                    compact
                    textStyle={{
                      color: statusColor(dep.status, colors),
                      fontSize: 10,
                      fontWeight: "700",
                    }}
                  >
                    {t(`deploy.status_${dep.status}`, {
                      defaultValue: dep.status,
                    })}
                  </Chip>
                </Pressable>
              );
            })}
          </Card.Content>
        </Card>
      </ScrollView>
    </>
  );
}

function MonitorGauge({
  label,
  value,
  color,
}: {
  label: string;
  value?: string;
  color: string;
}) {
  const { colors } = useAppTheme();
  const pct = parseFloat(value?.replace("%", "") || "0");
  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      <View
        style={{
          width: 40,
          height: 80,
          backgroundColor: colors.surfaceVariant,
          borderRadius: 8,
          overflow: "hidden",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            width: "100%",
            borderRadius: 8,
            height: `${Math.min(pct, 100)}%`,
            backgroundColor: color,
          }}
        />
      </View>
      <Text style={{ fontSize: 14, fontWeight: "700", color }}>
        {value || "—"}
      </Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary }}>{label}</Text>
    </View>
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
    card: {
      marginHorizontal: 12,
      marginTop: 10,
      backgroundColor: Colors.card,
      borderRadius: 14,
    },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    projectName: { fontSize: 18, fontWeight: "800", color: Colors.text },
    meta: { fontSize: 13, color: Colors.textSecondary, marginTop: 3 },
    actions: { flexDirection: "row", gap: 8, marginTop: 10 },
    actionBtn: { borderRadius: 10, flex: 1 },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: Colors.text,
    },
    monitorRow: { flexDirection: "row", justifyContent: "space-around" },
    gaugeContainer: { alignItems: "center", gap: 6 },
    gaugeBg: {
      width: 40,
      height: 80,
      backgroundColor: Colors.surfaceVariant,
      borderRadius: 8,
      overflow: "hidden",
      justifyContent: "flex-end",
    },
    gaugeFill: { width: "100%", borderRadius: 8 },
    gaugeValue: { fontSize: 14, fontWeight: "700" },
    gaugeLabel: { fontSize: 12, color: Colors.textSecondary },
    scheduleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    scheduleInput: {
      flex: 1,
      backgroundColor: Colors.surfaceVariant,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: Colors.text,
      fontSize: 13,
    },
    logHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    logCardHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 8,
    },
    logSearchRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginHorizontal: 12,
      marginBottom: 8,
      backgroundColor: "rgba(255,255,255,0.06)",
      borderRadius: 8,
      paddingHorizontal: 10,
      gap: 6,
    },
    logSearchInput: {
      flex: 1,
      color: Colors.text,
      fontSize: 12,
      paddingVertical: 8,
    },
    logStepHeader: {
      backgroundColor: "rgba(255,255,255,0.03)",
      paddingVertical: 4,
      paddingHorizontal: 4,
      borderRadius: 4,
      marginTop: 8,
    },
    liveBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.error + "20",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      gap: 4,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: Colors.error,
    },
    liveText: {
      fontSize: 10,
      fontWeight: "800",
      color: Colors.error,
    },
    logTerminal: {
      borderRadius: 10,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "#30363d",
    },
    logTerminalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: "#161b22",
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
    },
    logTerminalDots: {
      flexDirection: "row",
      gap: 6,
    },
    logTerminalDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    logTerminalTitle: {
      color: "#8b949e",
      fontSize: 11,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    logContainer: {
      backgroundColor: "#0d1117",
      padding: 12,
      maxHeight: 350,
    },
    logLine: {
      flexDirection: "row",
      marginBottom: 1,
    },
    logLineNum: {
      color: "#484f58",
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 10,
      width: 28,
      textAlign: "right",
      marginRight: 10,
      lineHeight: 17,
    },
    logText: {
      flex: 1,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 11,
      lineHeight: 17,
    },
    logTextDim: {
      color: "#484f58",
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 11,
      lineHeight: 17,
      fontStyle: "italic",
    },
    termHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    termPathChip: {
      backgroundColor: Colors.surfaceVariant,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    termPathText: {
      fontSize: 10,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      color: Colors.textSecondary,
    },
    termBody: {
      borderTopWidth: 1,
      borderTopColor: Colors.border,
      backgroundColor: "#0d1117",
    },
    termDotRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: "rgba(255,255,255,0.02)",
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255,255,255,0.06)",
    },
    termDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    termOutput: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      maxHeight: 250,
    },
    termInputRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.06)",
      gap: 8,
    },
    termInput: {
      flex: 1,
      color: "#c9d1d9",
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 13,
      paddingHorizontal: 4,
      paddingVertical: 6,
      minHeight: 32,
    },
    historyItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: Colors.border,
    },
    historyVersion: { fontSize: 14, fontWeight: "600", color: Colors.text },
    historyMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
    schedulePickerBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: Colors.surfaceVariant,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    schedulePickerText: {
      fontSize: 14,
      color: Colors.text,
      flex: 1,
    },
    pickerSheet: {
      backgroundColor: Colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 30,
      paddingHorizontal: 16,
      position: "absolute" as const,
      bottom: 0,
      left: 0,
      right: 0,
    },
    pickerSheetHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingTop: 16,
      paddingBottom: 8,
    },
    pickerSheetTitle: {
      fontSize: 16,
      fontWeight: "700" as const,
      color: Colors.text,
    },
  });
