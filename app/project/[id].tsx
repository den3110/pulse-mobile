import { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Pressable,
  Share,
} from "react-native";
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  Chip,
  IconButton,
  Divider,
} from "react-native-paper";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { Colors, statusColor } from "../../constants/theme";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useIsFocused } from "@react-navigation/native";
import { connectSocket } from "../../services/socket";

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useAppTheme();
  const Colors = colors;
  const styles = createStyles(colors);
  const [project, setProject] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const isFocused = useIsFocused();

  const fetchData = async (background = false) => {
    try {
      if (!background) setLoading(true);
      const [projRes, histRes, whRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/deployments/${id}/history`).catch(() => ({ data: [] })),
        api.get(`/projects/${id}/webhook-url`).catch(() => ({ data: null })),
      ]);
      setProject(projRes.data);
      setHistory(histRes.data?.deployments || histRes.data || []);
      if (whRes.data?.url) setWebhookUrl(whRes.data.url);
    } catch (err) {
      console.error(err);
    } finally {
      if (!background) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Polling for updates
  useEffect(() => {
    if (!isFocused) return;
    const interval = setInterval(() => fetchData(true), 5000);
    return () => clearInterval(interval);
  }, [isFocused, id]);

  // Sync deploying state with status
  useEffect(() => {
    if (project) {
      const BUSY_STATUSES = [
        "pending",
        "cloning",
        "installing",
        "building",
        "starting",
        "deploying",
      ];
      if (BUSY_STATUSES.includes(project.status)) {
        setDeploying(true);
      } else if (
        ["running", "stopped", "failed", "success"].includes(project.status)
      ) {
        setDeploying(false);
      }
    }
  }, [project?.status]);

  // Socket for realtime status updates
  useEffect(() => {
    if (!project) return;

    // Only join socket if we have potential activity or just initially to be safe
    const setupSocket = async () => {
      try {
        const socket = await connectSocket();

        // Listen for deployment status changes
        const handleStatus = (data: any) => {
          // If this project is affected
          if (data.projectId === id) {
            console.log("[ProjectDetail] Realtime status update:", data.status);
            // Update local project state immediately
            setProject((prev: any) =>
              prev ? { ...prev, status: data.status } : prev,
            );

            // Update history list immediately
            if (data.deploymentId) {
              setHistory((prev) => {
                const exists = prev.find((d) => d._id === data.deploymentId);
                if (exists) {
                  return prev.map((d) =>
                    d._id === data.deploymentId
                      ? { ...d, status: data.status }
                      : d,
                  );
                } else {
                  // New deployment, prepend it
                  // We might need to fetch full details later, but for now add a placeholder
                  // or just rely on fetchData to fill it in shortly.
                  // Ideally we want to show it immediately.
                  const newDep = {
                    _id: data.deploymentId,
                    status: data.status,
                    createdAt: data.timestamp || new Date().toISOString(),
                    version: "new", // Placeholder
                  };
                  return [newDep, ...prev];
                }
              });
            }

            // Update deploying state based on status
            const BUSY_STATUSES = [
              "pending",
              "cloning",
              "installing",
              "building",
              "starting",
              "deploying",
            ];

            if (BUSY_STATUSES.includes(data.status)) {
              setDeploying(true);
            } else if (
              ["running", "success", "failed", "stopped"].includes(data.status)
            ) {
              setDeploying(false);
            }

            // Also refresh full data to get consistent state
            fetchData(true);
          }
        };

        socket.on("deployment:status", handleStatus);

        // Join the active deployment room if we know it?
        // Actually deployment:status might be broadcasted to user room or we need to join specific rooms.
        // Join project room to get status updates
        socket.emit("join:project", id);

        // We need to join the *latest* deployment room if it's active.
        const latestDep = history[0];
        if (
          latestDep &&
          [
            "pending",
            "cloning",
            "building",
            "installing",
            "deploying",
            "starting",
          ].includes(latestDep.status)
        ) {
          socket.emit("join:deployment", latestDep._id);
        }

        return () => {
          socket.off("deployment:status", handleStatus);
        };
      } catch (e) {
        console.log("Socket setup failed", e);
      }
    };

    setupSocket();
  }, [project?._id, history[0]?._id, history[0]?.status]); // Re-run if latest deployment changes state

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      await api.post(`/deployments/${id}/deploy`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Let polling/socket handle the update, but also force one now
      fetchData(true);
      router.push(`/deployment/${id}`);
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

  const handleDelete = () => {
    Alert.alert(
      t("common.delete"),
      t("projects.deleteConfirmTitle", { name: project?.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/projects/${id}`);
              router.back();
            } catch (err: any) {
              Alert.alert(
                t("common.error"),
                err.response?.data?.message || t("common.failed"),
              );
            }
          },
        },
      ],
    );
  };

  const copyWebhook = async () => {
    if (webhookUrl) {
      await Clipboard.setStringAsync(webhookUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("common.success"), t("projects.webhookCopied"));
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: Colors.textSecondary }}>
          {t("projects.notFound")}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: project.name,
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
                icon="pencil"
                iconColor={Colors.primary}
                size={20}
                style={{ marginVertical: 0 }}
                onPress={() => router.push(`/project/form?id=${id}`)}
              />
              <IconButton
                icon="delete"
                iconColor={Colors.error}
                size={20}
                style={{ marginVertical: 0 }}
                onPress={handleDelete}
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
        {/* Project Info */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.projectName}>{project.name}</Text>
                <Text style={styles.repoUrl} numberOfLines={2}>
                  {project.repoUrl}
                </Text>
              </View>
              <Chip
                compact
                style={{ backgroundColor: statusColor(project.status) + "20" }}
                textStyle={{
                  color: statusColor(project.status),
                  fontWeight: "700",
                }}
              >
                {t(`common.${project.status}`) ||
                  t(`deploy.status_${project.status}`) ||
                  project.status}
              </Chip>
            </View>

            <View style={styles.actions}>
              <Button
                mode="contained"
                onPress={handleDeploy}
                loading={deploying}
                disabled={
                  deploying || project?.status === "dmm_cai_nay_khong_can_block"
                }
                style={[
                  styles.actionBtn,
                  { flex: 2, backgroundColor: Colors.primary },
                ]}
                contentStyle={{ height: 48 }}
                icon="rocket-launch"
              >
                {deploying ? t("deploy.deploying") : t("deploy.deploy")}
              </Button>
            </View>

            <View style={[styles.actions, { marginTop: 8 }]}>
              <Button
                mode="outlined"
                onPress={handleStop}
                icon="stop"
                textColor={Colors.error}
                style={[styles.actionBtn, { borderColor: Colors.error }]}
                contentStyle={{ height: 40 }}
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
                contentStyle={{ height: 40 }}
                compact
              >
                {t("common.restart")}
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Details */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>ℹ️ {t("projects.details")}</Text>
            <InfoRow label={t("projects.branch")} value={project.branch} />
            <InfoRow
              label={t("projects.server")}
              value={project.server?.name || "—"}
            />
            <InfoRow
              label={t("projects.deployPath")}
              value={project.deployPath}
            />
            <InfoRow
              label={t("projects.installCommand")}
              value={project.installCommand || "—"}
            />
            <InfoRow
              label={t("projects.buildCommand")}
              value={project.buildCommand || "—"}
            />
            <InfoRow
              label={t("projects.startCommand")}
              value={project.startCommand || "—"}
            />
            <InfoRow
              label={t("projects.autoDeploy")}
              value={project.autoDeploy ? t("common.yes") : t("common.no")}
            />
          </Card.Content>
        </Card>

        {/* Env Vars */}
        {project.envVars && Object.keys(project.envVars).length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <MaterialCommunityIcons
                  name="shield-lock-outline"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.sectionTitle}>{t("projects.envVars")}</Text>
              </View>
              {Object.entries(project.envVars).map(([key, value]) => (
                <InfoRow
                  key={key}
                  label={key}
                  value={String(value).substring(0, 20) + "…"}
                />
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Webhook */}
        {webhookUrl ? (
          <Card style={styles.card}>
            <Card.Content>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <MaterialCommunityIcons
                  name="link-variant"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.sectionTitle}>
                  {t("projects.webhookUrl")}
                </Text>
              </View>
              <Pressable onPress={copyWebhook}>
                <Text style={styles.webhookUrl} numberOfLines={2}>
                  {webhookUrl}
                </Text>
                <Text style={styles.tapToCopy}>{t("common.tapToCopy")}</Text>
              </Pressable>
            </Card.Content>
          </Card>
        ) : null}

        {/* History */}
        <Card style={styles.card}>
          <Card.Content>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <MaterialCommunityIcons
                name="history"
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.sectionTitle}>
                {t("projects.deploymentHistory")}
              </Text>
            </View>
            {history.length === 0 ? (
              <Text style={styles.emptyText}>
                {t("projects.noDeployments")}
              </Text>
            ) : (
              history.slice(0, 10).map((dep: any) => (
                <Pressable
                  key={dep._id}
                  onPress={() => router.push(`/deployment/${dep._id}`)}
                  style={({ pressed }) => [
                    styles.historyItem,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyVersion}>
                      #{dep.version || dep._id.slice(-6)}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {new Date(
                        dep.startedAt || dep.createdAt,
                      ).toLocaleString()}
                    </Text>
                  </View>
                  <Chip
                    compact
                    textStyle={{
                      color: statusColor(dep.status),
                      fontSize: 10,
                      fontWeight: "700",
                    }}
                  >
                    {t(`common.${dep.status}`) ||
                      t(`deploy.status_${dep.status}`) ||
                      dep.status}
                  </Chip>
                </Pressable>
              ))
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}>
        {label}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: colors.text,
          fontWeight: "600",
          flex: 1,
          textAlign: "right",
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
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
    headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    projectName: { fontSize: 18, fontWeight: "800", color: Colors.text },
    repoUrl: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
    actions: { flexDirection: "row", gap: 8, marginTop: 14 },
    actionBtn: { borderRadius: 10, flex: 1 },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: Colors.text,
      marginBottom: 12,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: Colors.border,
    },
    infoLabel: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
    infoValue: {
      fontSize: 13,
      color: Colors.text,
      fontWeight: "600",
      flex: 1,
      textAlign: "right",
    },
    webhookUrl: {
      fontSize: 12,
      color: Colors.primary,
      fontFamily: "monospace",
      marginTop: 4,
    },
    tapToCopy: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
    historyItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: Colors.border,
    },
    historyVersion: { fontSize: 14, fontWeight: "600", color: Colors.text },
    historyMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
    emptyText: {
      color: Colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
      paddingVertical: 20,
    },
  });
