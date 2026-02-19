import { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Alert,
  ScrollView,
} from "react-native";
import {
  Text,
  Searchbar,
  FAB,
  ActivityIndicator,
  Chip,
  IconButton,
  Modal,
  Dialog,
  Portal,
  Button,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { Colors, statusColor } from "../../constants/theme";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useIsFocused } from "@react-navigation/native";
import { connectSocket } from "../../services/socket";
import { ProjectListSkeleton } from "../../components/Skeletons";

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.100:5000/api";
const WEBHOOK_BASE = API_BASE.replace(/\/api$/, "");

interface Project {
  _id: string;
  name: string;
  repoUrl: string;
  branch: string;
  server: { _id: string; name: string; host: string; status: string };
  deployPath: string;
  status: string;
  autoDeploy: boolean;
  lastDeployedAt?: string;
}

export default function ProjectsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useAppTheme();
  const Colors = colors;
  const styles = createStyles(colors);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const isFocused = useIsFocused();

  const fetchProjects = async () => {
    try {
      const res = await api.get("/projects");
      setProjects(res.data);
    } catch (err) {
      console.error("Failed to fetch projects", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Realtime updates
  useEffect(() => {
    let activeSocket: any = null;
    let isMounted = true;

    const handleStatusUpdate = (data: any) => {
      console.log(
        `[Projects] Received status update for ${data.projectId}: ${data.status}`,
      );
      if (data.projectId) {
        setProjects((prev) =>
          prev.map((p) =>
            p._id === data.projectId
              ? {
                  ...p,
                  status: data.status,
                  lastDeployedAt: data.timestamp || new Date().toISOString(),
                }
              : p,
          ),
        );

        // If status is "running" or "failed", background fetch strictly to ensure consistency using the API
        if (["running", "stopped", "failed", "success"].includes(data.status)) {
          fetchProjects();
        }
      }
    };

    const projectIds = projects.map((p) => p._id).join(",");

    if (isFocused && projects.length > 0) {
      connectSocket()
        .then((socket) => {
          if (!isMounted) return;
          activeSocket = socket;

          // Join all project rooms
          projects.forEach((p) => {
            socket.emit("join:project", p._id);
          });

          socket.on("deployment:status", handleStatusUpdate);
        })
        .catch((err) => {
          console.log("Socket connection failed in Projects", err);
        });
    }

    return () => {
      isMounted = false;
      if (activeSocket) {
        activeSocket.off("deployment:status", handleStatusUpdate);
        // We don't necessarily need to leave rooms as they are cleaned up on disconnect
        // or can be persisted.
      }
    };
  }, [isFocused, projects.map((p) => p._id).join(",")]); // Only re-run if project list IDs change

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProjects();
  }, []);

  const handleDeploy = async (projectId: string) => {
    try {
      await api.post(`/deployments/${projectId}/deploy`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push(`/deployment/${projectId}`);
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("deploy.deployFailed"),
      );
    }
  };

  const handleStop = async (projectId: string) => {
    try {
      await api.post(`/deployments/${projectId}/stop`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchProjects();
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/projects/${deleteTarget._id}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDeleteTarget(null);
      fetchProjects();
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    } finally {
      setDeleting(false);
    }
  };

  const filtered = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.repoUrl?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const renderProject = ({ item }: { item: Project }) => (
    <Pressable
      onPress={() => router.push(`/project/${item._id}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.projectName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.repoUrl} numberOfLines={1}>
            {item.repoUrl}
          </Text>
        </View>
        <IconButton
          icon="dots-vertical"
          iconColor={Colors.textSecondary}
          size={20}
          onPress={() => setMenuVisible(item._id)}
        />
      </View>

      {/* Chips row */}
      <View style={styles.chipRow}>
        <Chip
          style={[
            styles.statusChip,
            { backgroundColor: statusColor(item.status, colors) + "20" },
          ]}
          textStyle={{
            color: statusColor(item.status, colors),
            fontSize: 11,
            lineHeight: 16,
            fontWeight: "700",
          }}
        >
          {item.status}
        </Chip>
        <Chip
          icon="source-branch"
          style={styles.metaChip}
          textStyle={styles.metaChipText}
        >
          {item.branch}
        </Chip>
        {item.server?.name && (
          <Chip
            icon="server"
            style={styles.metaChip}
            textStyle={styles.metaChipText}
          >
            {item.server.name}
          </Chip>
        )}
        {item.autoDeploy && (
          <Chip
            icon="sync"
            style={[
              styles.metaChip,
              { backgroundColor: Colors.success + "15" },
            ]}
            textStyle={{ fontSize: 11, lineHeight: 16, color: Colors.success }}
          >
            Auto
          </Chip>
        )}
      </View>

      {/* Deploy path */}
      {item.deployPath ? (
        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="folder-outline"
            size={14}
            color={Colors.textSecondary}
          />
          <Text style={styles.infoText} numberOfLines={1}>
            {item.deployPath}
          </Text>
        </View>
      ) : null}

      {/* Last deployed */}
      {item.lastDeployedAt ? (
        <View style={styles.infoRow}>
          <MaterialCommunityIcons
            name="clock-outline"
            size={14}
            color={Colors.textSecondary}
          />
          <Text style={styles.infoText}>
            {t("projects.lastDeployed")}:{" "}
            {new Date(item.lastDeployedAt).toLocaleString()}
          </Text>
        </View>
      ) : null}

      {/* Webhook URL */}
      <Pressable
        style={styles.webhookRow}
        onPress={() => {
          Clipboard.setStringAsync(`${WEBHOOK_BASE}/api/webhook/${item._id}`);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(t("common.success"), t("projects.webhookCopied"));
        }}
      >
        <MaterialCommunityIcons
          name="link-variant"
          size={14}
          color={Colors.textSecondary}
        />
        <Text style={styles.webhookText} numberOfLines={1}>
          {WEBHOOK_BASE}/api/webhook/{item._id}
        </Text>
        <MaterialCommunityIcons
          name="content-copy"
          size={14}
          color={Colors.textSecondary}
        />
      </Pressable>

      {/* Action buttons — status-dependent */}
      <View style={styles.cardActions}>
        {[
          "running",
          "deploying",
          "building",
          "cloning",
          "installing",
          "starting",
        ].includes(item.status) ? (
          <>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: Colors.primary }]}
              onPress={() => router.push(`/deployment/${item._id}`)}
            >
              <MaterialCommunityIcons name="console" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>{t("projects.console")}</Text>
            </Pressable>
            <Pressable
              style={[
                styles.actionBtn,
                {
                  backgroundColor: Colors.error + "18",
                  borderWidth: 1,
                  borderColor: Colors.error,
                },
              ]}
              onPress={() => handleStop(item._id)}
              disabled={item.status !== "running"}
            >
              <MaterialCommunityIcons
                name="stop"
                size={16}
                color={Colors.error}
              />
              <Text style={[styles.actionBtnText, { color: Colors.error }]}>
                {t("common.stop")}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: Colors.primary }]}
              onPress={() => handleDeploy(item._id)}
            >
              <MaterialCommunityIcons
                name="rocket-launch"
                size={16}
                color="#fff"
              />
              <Text style={styles.actionBtnText}>{t("projects.deploy")}</Text>
            </Pressable>
            <Pressable
              style={[
                styles.actionBtn,
                {
                  backgroundColor: Colors.surface,
                  borderWidth: 1,
                  borderColor: Colors.border,
                },
              ]}
              onPress={() => router.push(`/deployment/${item._id}`)}
            >
              <MaterialCommunityIcons
                name="console"
                size={16}
                color={Colors.textSecondary}
              />
              <Text
                style={[styles.actionBtnText, { color: Colors.textSecondary }]}
              >
                {t("projects.logs")}
              </Text>
            </Pressable>
          </>
        )}
        <View style={{ flex: 1 }} />
        <IconButton
          icon="pencil"
          iconColor={Colors.textSecondary}
          size={18}
          onPress={() => router.push(`/project/form?id=${item._id}`)}
        />
        <IconButton
          icon="delete"
          iconColor={Colors.error}
          size={18}
          onPress={() => setDeleteTarget(item)}
        />
      </View>
    </Pressable>
  );

  // ... (inside component)

  if (loading) {
    return (
      <View style={styles.container}>
        <Searchbar
          placeholder={t("projects.searchPlaceholder")}
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
          inputStyle={{ color: Colors.text }}
          iconColor={Colors.textSecondary}
          placeholderTextColor={Colors.textSecondary}
        />
        <ProjectListSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder={t("projects.searchPlaceholder")}
        value={search}
        onChangeText={setSearch}
        style={styles.searchbar}
        inputStyle={{ color: Colors.text }}
        iconColor={Colors.textSecondary}
        placeholderTextColor={Colors.textSecondary}
      />
      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ gap: 8 }}
      >
        {(["all", "running", "stopped", "failed", "idle"] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => {
              Haptics.selectionAsync();
              setStatusFilter(f);
            }}
            style={[
              styles.filterChip,
              statusFilter === f && {
                backgroundColor: Colors.primary + "20",
                borderColor: Colors.primary,
              },
            ]}
          >
            {f !== "all" && (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: statusColor(f, colors),
                }}
              />
            )}
            <Text
              style={[
                styles.filterChipText,
                statusFilter === f && {
                  color: Colors.primary,
                  fontWeight: "700",
                },
              ]}
            >
              {t(`projects.${f}`)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        renderItem={renderProject}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="folder-open-outline"
              size={48}
              color={Colors.textSecondary}
            />
            <Text style={styles.emptyText}>{t("projects.noProjects")}</Text>
          </View>
        }
      />
      <FAB
        icon="plus"
        style={styles.fab}
        color="#fff"
        onPress={() => router.push("/project/form")}
      />

      {/* Action bottom sheet */}
      <Portal>
        <Modal
          visible={!!menuVisible}
          onDismiss={() => setMenuVisible(null)}
          contentContainerStyle={styles.bottomSheet}
        >
          <View style={styles.bottomSheetHandle} />
          <Pressable
            style={styles.bottomSheetItem}
            onPress={() => {
              const id = menuVisible;
              setMenuVisible(null);
              if (id) handleDeploy(id);
            }}
          >
            <MaterialCommunityIcons
              name="rocket-launch"
              size={22}
              color={Colors.primary}
            />
            <Text style={[styles.bottomSheetText, { color: Colors.primary }]}>
              {t("projects.deploy")}
            </Text>
          </Pressable>
          <Pressable
            style={styles.bottomSheetItem}
            onPress={() => {
              const id = menuVisible;
              setMenuVisible(null);
              if (id) router.push(`/project/form?id=${id}`);
            }}
          >
            <MaterialCommunityIcons
              name="pencil"
              size={22}
              color={Colors.text}
            />
            <Text style={styles.bottomSheetText}>{t("common.edit")}</Text>
          </Pressable>
          <Pressable
            style={styles.bottomSheetItem}
            onPress={() => {
              const prj = projects.find((p) => p._id === menuVisible);
              setMenuVisible(null);
              if (prj) setDeleteTarget(prj);
            }}
          >
            <MaterialCommunityIcons
              name="delete"
              size={22}
              color={Colors.error}
            />
            <Text style={[styles.bottomSheetText, { color: Colors.error }]}>
              {t("common.delete")}
            </Text>
          </Pressable>
        </Modal>
      </Portal>

      {/* Delete confirmation dialog */}
      <Portal>
        <Dialog
          visible={!!deleteTarget}
          onDismiss={() => setDeleteTarget(null)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>
            {t("common.delete")}
          </Dialog.Title>
          <Dialog.Content>
            <View style={styles.dialogIconRow}>
              <View style={styles.dialogIconCircle}>
                <MaterialCommunityIcons
                  name="folder-remove"
                  size={32}
                  color={Colors.error}
                />
              </View>
            </View>
            <Text style={styles.dialogText}>
              {t("projects.deleteConfirm") || "Are you sure you want to delete"}{" "}
              <Text style={{ fontWeight: "800", color: Colors.text }}>
                "{deleteTarget?.name}"
              </Text>
              ?
            </Text>
            <Text style={styles.dialogWarning}>
              {t("projects.deleteWarning")}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              onPress={() => setDeleteTarget(null)}
              textColor={Colors.textSecondary}
              style={styles.dialogBtn}
            >
              {t("common.cancel")}
            </Button>
            <Button
              mode="contained"
              onPress={confirmDelete}
              loading={deleting}
              buttonColor={Colors.error}
              textColor="#fff"
              style={styles.dialogBtn}
              icon="delete"
            >
              {t("common.delete")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
    searchbar: {
      margin: 12,
      backgroundColor: Colors.surface,
      borderRadius: 12,
      elevation: 0,
    },
    filterRow: {
      flexDirection: "row" as const,
      flexGrow: 0,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    filterChip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    filterChipText: {
      fontSize: 13,
      color: Colors.textSecondary,
      fontWeight: "500" as const,
    },
    card: {
      backgroundColor: Colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
    },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    projectName: { fontSize: 15, fontWeight: "700", color: Colors.text },
    repoUrl: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 10,
    },
    statusChip: {},
    metaChip: {
      backgroundColor: Colors.surfaceVariant,
    },
    metaChipText: {
      fontSize: 11,
      lineHeight: 16,
      color: Colors.textSecondary,
    },
    cardActions: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      marginTop: 10,
    },
    actionBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
    },
    actionBtnText: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: "#fff",
    },
    fab: {
      position: "absolute",
      bottom: 20,
      right: 20,
      backgroundColor: Colors.primary,
      borderRadius: 16,
    },
    empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
    emptyText: { color: Colors.textSecondary, fontSize: 14 },
    // Delete dialog styles
    dialog: {
      backgroundColor: Colors.card,
      borderRadius: 20,
    },
    dialogTitle: {
      color: Colors.error,
      fontWeight: "700",
      fontSize: 18,
      textAlign: "center",
    },
    dialogIconRow: {
      alignItems: "center",
      marginBottom: 16,
    },
    dialogIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: Colors.error + "15",
      alignItems: "center",
      justifyContent: "center",
    },
    dialogText: {
      color: Colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
    },
    dialogWarning: {
      color: Colors.error + "99",
      fontSize: 12,
      textAlign: "center",
      marginTop: 10,
      fontStyle: "italic",
    },
    dialogActions: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 8,
    },
    dialogBtn: {
      borderRadius: 10,
      flex: 1,
    },
    // Info rows
    infoRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      marginTop: 8,
      paddingHorizontal: 2,
    },
    infoText: {
      fontSize: 12,
      color: Colors.textSecondary,
      flex: 1,
      fontFamily: "monospace",
    },
    webhookRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: Colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    webhookText: {
      fontSize: 10,
      color: Colors.textSecondary,
      fontFamily: "monospace",
      flex: 1,
    },
    // Bottom sheet styles
    bottomSheet: {
      backgroundColor: Colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 16,
      paddingBottom: 32,
      position: "absolute" as const,
      bottom: 0,
      left: 0,
      right: 0,
    },
    bottomSheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.textSecondary + "40",
      alignSelf: "center" as const,
      marginBottom: 16,
    },
    bottomSheetItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 8,
    },
    bottomSheetText: {
      fontSize: 15,
      color: Colors.text,
      fontWeight: "500" as const,
    },
  });
