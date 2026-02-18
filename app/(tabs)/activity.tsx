import { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
} from "react-native";
import { Text, ActivityIndicator, Chip } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import api from "../../services/api";
import { Colors, statusColor } from "../../constants/theme";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const actionIcon: Record<string, string> = {
  deploy: "rocket-launch",
  stop: "stop-circle",
  restart: "restart",
  create: "plus-circle",
  delete: "delete",
  update: "pencil",
  login: "login",
  rollback: "history",
  test: "lan-connect",
  schedule: "clock-outline",
  clone: "content-copy",
  build: "wrench",
  install: "download",
  start: "play-circle",
};

const actionColor: Record<string, string> = {
  deploy: Colors.primary,
  stop: Colors.error,
  restart: Colors.warning,
  create: Colors.success,
  delete: Colors.error,
  update: Colors.info,
  login: Colors.accent,
  rollback: Colors.warning,
  success: Colors.success,
  failed: Colors.error,
  running: Colors.primary,
};

export default function ActivityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useAppTheme();
  const Colors = colors;
  const styles = createStyles(colors);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivities = async () => {
    try {
      const res = await api.get("/activity");
      const data = res.data;
      // Handle different API response formats
      if (Array.isArray(data)) {
        setActivities(data);
      } else if (data?.logs && Array.isArray(data.logs)) {
        setActivities(data.logs);
      } else if (data?.activities && Array.isArray(data.activities)) {
        setActivities(data.activities);
      } else {
        setActivities([]);
      }
    } catch (err) {
      console.error("Activity fetch error:", err);
      // Try fallback: fetch recent deployments as activity
      try {
        const deploysRes = await api.get("/deployments?limit=20");
        const deploys = deploysRes.data?.deployments || deploysRes.data || [];
        const mapped = deploys.map((d: any) => ({
          _id: d._id,
          action: "deploy",
          message: `${d.project?.name || "Project"} → ${d.status}`,
          status: d.status,
          createdAt: d.startedAt || d.createdAt,
          user: d.triggeredBy || d.user,
          target: d.project?.name,
          resourceType: "deployment",
          deploymentId: d._id,
          projectId: d.project?._id,
        }));
        setActivities(mapped);
      } catch {
        setActivities([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchActivities();
  }, []);

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const rawAction = item.action || "deploy";
    // Normalize: "Project.delete" -> "project_delete" for translation
    const actionKey = rawAction.toLowerCase().replace(/\./g, "_");
    // Suffix: "Project.delete" -> "delete" for generic icons/colors
    const shortAction =
      rawAction.split(".").pop()?.toLowerCase() || rawAction.toLowerCase();

    const icon =
      actionIcon[actionKey] || actionIcon[shortAction] || "information-outline";
    const color =
      actionColor[item.status] ||
      actionColor[actionKey] ||
      actionColor[shortAction] ||
      Colors.textSecondary;
    const time = new Date(item.createdAt || item.timestamp);
    const isToday = new Date().toDateString() === time.toDateString();
    const isLast = index === activities.length - 1;

    return (
      <View style={styles.item}>
        <View style={styles.timeline}>
          <View style={[styles.dot, { backgroundColor: color }]}>
            <MaterialCommunityIcons name={icon as any} size={12} color="#fff" />
          </View>
          {!isLast && <View style={styles.line} />}
        </View>
        <Pressable
          style={({ pressed }) => [styles.content, pressed && { opacity: 0.8 }]}
          onPress={() => {
            if (item.deploymentId) {
              router.push(`/deployment/${item.deploymentId}`);
            } else if (item.projectId) {
              router.push(`/project/${item.projectId}`);
            }
          }}
        >
          <View style={styles.contentHeader}>
            <Text style={[styles.action, { color }]} numberOfLines={1}>
              {t(`activity.action_${actionKey}`, {
                defaultValue:
                  rawAction.charAt(0).toUpperCase() + rawAction.slice(1),
              })}
            </Text>
            <Text style={styles.time}>
              {isToday
                ? time.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : time.toLocaleDateString([], {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
            </Text>
          </View>
          <Text style={styles.message} numberOfLines={2}>
            {item.message ||
              item.details ||
              `${rawAction} on ${item.target || item.resourceType || ""}`}
          </Text>
          {(item.user || item.status) && (
            <View style={styles.itemFooter}>
              {item.user && (
                <Text style={styles.user}>
                  {""}
                  {typeof item.user === "string"
                    ? item.user
                    : item.user?.username || ""}
                </Text>
              )}
              {item.status && (
                <Chip
                  compact
                  style={{
                    backgroundColor: statusColor(item.status) + "20",
                    height: 24,
                  }}
                  textStyle={{
                    color: statusColor(item.status),
                    fontSize: 10,
                    fontWeight: "700",
                  }}
                >
                  {item.status}
                </Chip>
              )}
            </View>
          )}
        </Pressable>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={activities}
        keyExtractor={(item, i) => item._id || String(i)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
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
              name="history"
              size={48}
              color={Colors.textSecondary}
            />
            <Text style={styles.emptyText}>{t("activity.noActivity")}</Text>
            <Text style={styles.emptyHint}>{t("activity.emptyHint")}</Text>
          </View>
        }
      />
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
    item: { flexDirection: "row", marginBottom: 2 },
    timeline: { alignItems: "center", width: 30, marginRight: 10 },
    dot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      marginTop: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    line: { flex: 1, width: 2, backgroundColor: Colors.border, marginTop: 2 },
    content: {
      flex: 1,
      backgroundColor: Colors.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    contentHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    action: {
      fontSize: 13,
      fontWeight: "700",
      flex: 1,
    },
    time: { fontSize: 11, color: Colors.textSecondary },
    message: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
    itemFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 8,
    },
    user: { fontSize: 11, color: Colors.textSecondary },
    empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
    emptyText: { color: Colors.textSecondary, fontSize: 14 },
    emptyHint: { color: Colors.textSecondary, fontSize: 12, opacity: 0.7 },
  });
