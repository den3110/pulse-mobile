import { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Alert,
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
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { Colors, statusColor } from "../../constants/theme";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ServerListSkeleton } from "../../components/Skeletons";

interface Server {
  _id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: "password" | "key";
  status: "online" | "offline" | "unknown";
  lastCheckedAt?: string;
}

export default function ServersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useAppTheme();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const Colors = colors;
  const styles = createStyles(colors);
  const [servers, setServers] = useState<Server[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Server | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "online" | "offline"
  >("all");

  const fetchServers = async () => {
    try {
      const res = await api.get("/servers");
      setServers(res.data);
    } catch (err) {
      console.error("Failed to fetch servers", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchServers();
  }, []);

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      await api.post(`/servers/${id}/test`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t("common.success") || "Success",
        t("servers.connectionSuccess"),
      );
      fetchServers();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Error",
        err.response?.data?.message || t("servers.connectionFailed"),
      );
    } finally {
      setTestingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/servers/${deleteTarget._id}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDeleteTarget(null);
      fetchServers();
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    } finally {
      setDeleting(false);
    }
  };

  const filtered = servers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.host.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { action } = useLocalSearchParams<{ action?: string }>();
  // ... existing code ...

  const renderServer = ({ item }: { item: Server }) => (
    <Pressable
      onPress={() => {
        if (action === "ftp") {
          router.push(`/server/${item._id}/ftp`);
        } else {
          router.push(`/server/${item._id}`);
        }
      }}
      style={({ pressed }) => [styles.serverCard, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.serverRow}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: statusColor(item.status) },
          ]}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.serverName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.serverHost}>
            {item.host}:{item.port || 22}
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
            { backgroundColor: statusColor(item.status) + "20" },
          ]}
          textStyle={{
            color: statusColor(item.status),
            fontSize: 11,
            lineHeight: 16,
            fontWeight: "700",
          }}
        >
          {item.status}
        </Chip>
        <Chip
          icon={item.authType === "key" ? "key" : "lock"}
          style={styles.metaChip}
          textStyle={styles.metaChipText}
        >
          {item.authType === "key" ? "SSH Key" : "Password"}
        </Chip>
        {item.username && (
          <Chip
            icon="account"
            style={styles.metaChip}
            textStyle={styles.metaChipText}
          >
            {item.username}
          </Chip>
        )}
      </View>
    </Pressable>
  );

  // ... (inside component)

  if (loading) {
    return (
      <View style={styles.container}>
        <Searchbar
          placeholder={
            action === "ftp"
              ? t("servers.selectToBrowse")
              : t("servers.searchPlaceholder")
          }
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
          inputStyle={{ color: Colors.text }}
          iconColor={Colors.textSecondary}
          placeholderTextColor={Colors.textSecondary}
        />
        <ServerListSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder={
          action === "ftp"
            ? t("servers.selectToBrowse")
            : t("servers.searchPlaceholder")
        }
        value={search}
        onChangeText={setSearch}
        style={styles.searchbar}
        inputStyle={{ color: Colors.text }}
        iconColor={Colors.textSecondary}
        placeholderTextColor={Colors.textSecondary}
      />
      {/* Status filter chips */}
      <View style={styles.filterRow}>
        {(["all", "online", "offline"] as const).map((f) => (
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
                  backgroundColor:
                    f === "online" ? Colors.success : Colors.error,
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
              {t(`servers.${f}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        renderItem={renderServer}
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
              name="server-off"
              size={48}
              color={Colors.textSecondary}
            />
            <Text style={styles.emptyText}>{t("servers.noServers")}</Text>
          </View>
        }
      />
      <FAB
        icon="plus"
        style={styles.fab}
        color="#fff"
        onPress={() => router.push("/server/form")}
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
              if (id) handleTest(id);
            }}
          >
            <MaterialCommunityIcons
              name="connection"
              size={22}
              color={Colors.text}
            />
            <Text style={styles.bottomSheetText}>
              {t("servers.checkConnection")}
            </Text>
          </Pressable>
          <Pressable
            style={styles.bottomSheetItem}
            onPress={() => {
              const id = menuVisible;
              setMenuVisible(null);
              if (id) router.push(`/server/form?id=${id}`);
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
              const srv = servers.find((s) => s._id === menuVisible);
              setMenuVisible(null);
              if (srv) setDeleteTarget(srv);
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
                  name="server-remove"
                  size={32}
                  color={Colors.error}
                />
              </View>
            </View>
            <Text style={styles.dialogText}>
              {t("servers.deleteConfirm") || "Are you sure you want to delete"}{" "}
              <Text style={{ fontWeight: "800", color: Colors.text }}>
                "{deleteTarget?.name}"
              </Text>
              ?
            </Text>
            <Text style={styles.dialogWarning}>
              {t("servers.deleteWarning")}
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
      gap: 8,
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
    serverCard: {
      backgroundColor: Colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
    },
    serverRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    serverName: { fontSize: 15, fontWeight: "700", color: Colors.text },
    serverHost: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 10,
      paddingLeft: 20,
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
    fab: {
      position: "absolute",
      bottom: 20,
      right: 20,
      backgroundColor: Colors.primary,
      borderRadius: 16,
    },
    empty: {
      alignItems: "center",
      paddingVertical: 60,
      gap: 12,
    },
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
