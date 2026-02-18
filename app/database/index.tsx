import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  Chip,
  IconButton,
  Portal,
  Dialog,
  TextInput,
  SegmentedButtons,
  Menu,
  Divider,
} from "react-native-paper";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { documentDirectory, downloadAsync } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing"; // Use generic share for "download"
import { useServer } from "../../contexts/ServerContext";

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  type: "postgres" | "mysql" | "mongo" | "redis" | "unknown";
}

interface BackupFile {
  filename: string;
  size: string;
  date: string;
}

import CustomAlertDialog, {
  CustomAlertDialogRef,
} from "../../components/CustomAlertDialog";

export default function DatabaseManagerScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const { serverId: paramServerId } = useLocalSearchParams<{
    serverId: string;
  }>();
  const { selectedServer } = useServer();
  const serverId = paramServerId || selectedServer?._id;

  const [tab, setTab] = useState("containers"); // 'containers' | 'backups'
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Backup Dialog
  const [backupVisible, setBackupVisible] = useState(false);
  const [selectedContainer, setSelectedContainer] =
    useState<DockerContainer | null>(null);
  const [backupConfig, setBackupConfig] = useState({
    dbName: "",
    dbUser: "",
    dbPassword: "",
  });
  const [backingUp, setBackingUp] = useState(false);

  // Restore Dialog
  const [restoreVisible, setRestoreVisible] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupFile | null>(null);
  const [restoreConfig, setRestoreConfig] = useState({
    containerId: "",
    dbType: "",
    dbName: "",
    dbUser: "",
    dbPassword: "",
  });
  const [restoring, setRestoring] = useState(false);

  // Menu states
  const [backupMenuVisible, setBackupMenuVisible] = useState<string | null>(
    null,
  );

  const dialogRef = React.useRef<CustomAlertDialogRef>(null);

  const fetchData = useCallback(async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      if (tab === "containers") {
        const { data } = await api.get(`/database/${serverId}/containers`);
        setContainers(data);
      } else {
        const { data } = await api.get(`/database/${serverId}/backups`);
        setBackups(data);
      }
    } catch (err: any) {
      // console.error(err);
      // Optional: Toast or Alert on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serverId, tab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const statusColor = (status: string) => {
    if (status.includes("Up") || status.toLowerCase().includes("running"))
      return colors.success;
    if (status.includes("Exited")) return colors.error;
    return colors.warning;
  };

  const handleBackupPress = (container: DockerContainer) => {
    setSelectedContainer(container);
    setBackupConfig({ dbName: "", dbUser: "", dbPassword: "" });
    setBackupVisible(true);
  };

  const handleBackupSubmit = async () => {
    if (!serverId || !selectedContainer) return;
    setBackingUp(true);
    try {
      const { data } = await api.post(`/database/${serverId}/backup`, {
        containerId: selectedContainer.id,
        dbType: selectedContainer.type,
        ...backupConfig,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      dialogRef.current?.show(
        t("common.success"),
        `${t("database.backupCreated")}: ${data.path}`,
      );
      setBackupVisible(false);
      // Switch to backups tab to see it?
      // setTab("backups");
    } catch (err: any) {
      dialogRef.current?.show(
        "Error",
        err.response?.data?.message || t("database.backupFailed"),
      );
    } finally {
      setBackingUp(false);
    }
  };

  const handleDeleteBackup = (filename: string) => {
    dialogRef.current?.confirm(
      t("common.delete"),
      t("common.confirmDelete"),
      async () => {
        try {
          await api.delete(`/database/${serverId}/backups/${filename}`);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          fetchData();
        } catch (err: any) {
          dialogRef.current?.show(
            "Error",
            err.response?.data?.message || t("common.failed"),
          );
        }
      },
      t("common.delete"),
      true,
    );
  };

  const handleDownloadBackup = async (filename: string) => {
    if (!serverId) return;
    try {
      const fileUri = (documentDirectory || "") + filename;
      const downloadRes = await downloadAsync(
        `${api.defaults.baseURL}/database/${serverId}/backups/${filename}`,
        fileUri,
        {
          headers: {
            Authorization: api.defaults.headers.common[
              "Authorization"
            ] as string,
          },
        },
      );

      if (downloadRes.status === 200) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadRes.uri);
        } else {
          dialogRef.current?.show(
            t("common.success"),
            t("files.downloadSuccess"),
          );
        }
      } else {
        dialogRef.current?.show(
          t("common.error"),
          t("files.downloadFailed") + ": " + downloadRes.status,
        );
      }
    } catch (err: any) {
      dialogRef.current?.show(
        t("common.error"),
        t("files.downloadFailed") + ": " + err.message,
      );
    }
  };

  const handleRestorePress = (backup: BackupFile) => {
    setSelectedBackup(backup);
    setRestoreConfig({
      containerId: "",
      dbType: "",
      dbName: "",
      dbUser: "",
      dbPassword: "",
    });
    setRestoreVisible(true);
    setBackupMenuVisible(null);
  };

  const handleRestoreSubmit = async () => {
    if (!serverId || !selectedBackup) return;
    setRestoring(true);
    try {
      await api.post(`/database/${serverId}/restore`, {
        ...restoreConfig,
        filename: selectedBackup.filename,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      dialogRef.current?.show(
        t("common.success"),
        t("database.restoreSuccess"),
      );
      setRestoreVisible(false);
    } catch (err: any) {
      dialogRef.current?.show(
        "Error",
        err.response?.data?.message || t("database.restoreFailed"),
      );
    } finally {
      setRestoring(false);
    }
  };

  // Populate container options for restore
  // We need to fetch containers even if we are on backups tab when opening restore dialog
  // Ideally we should cache them or fetch when dialog opens.
  useEffect(() => {
    if (restoreVisible && containers.length === 0) {
      api
        .get(`/database/${serverId}/containers`)
        .then((res) => setContainers(res.data))
        .catch(() => {});
    }
  }, [restoreVisible, serverId]);

  if (!serverId) {
    return (
      <View style={styles.centered}>
        <Text>{t("servers.selectToBrowse")}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t("database.title") }} />
      <View style={styles.container}>
        <View style={{ padding: 12 }}>
          <SegmentedButtons
            value={tab}
            onValueChange={setTab}
            buttons={[
              {
                value: "containers",
                label: t("database.containers"),
                icon: "docker",
              },
              {
                value: "backups",
                label: t("database.backups"),
                icon: "backup-restore",
              },
            ]}
          />
        </View>

        {loading && !refreshing ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
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
            {tab === "containers" ? (
              containers.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons
                    name="database-off"
                    size={48}
                    color={colors.textSecondary}
                  />
                  <Text style={{ marginTop: 10, color: colors.textSecondary }}>
                    {t("database.noContainers")}
                  </Text>
                </View>
              ) : (
                containers.map((c) => (
                  <Card key={c.id} style={styles.card}>
                    <Card.Content>
                      <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{c.name}</Text>
                          <Text style={styles.cardSubtitle}>{c.image}</Text>
                        </View>
                        <Chip
                          mode="outlined"
                          textStyle={{
                            color: statusColor(c.status),
                            fontSize: 10,
                            fontWeight: "700",
                          }}
                          style={{ borderColor: statusColor(c.status) }}
                        >
                          {c.status.split(" ")[0]}
                        </Chip>
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          marginTop: 12,
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <Chip
                          icon="database"
                          compact
                          textStyle={{ fontSize: 11 }}
                        >
                          {c.type}
                        </Chip>
                        <Chip
                          icon="ethernet"
                          compact
                          textStyle={{ fontSize: 11 }}
                          style={{ flexShrink: 1 }}
                          ellipsizeMode="tail"
                        >
                          {c.ports || "No ports"}
                        </Chip>
                      </View>

                      <Divider style={{ marginVertical: 12 }} />

                      <Button
                        mode="contained"
                        icon="backup-restore"
                        onPress={() => handleBackupPress(c)}
                        disabled={c.type === "unknown" || c.type === "redis"}
                      >
                        {t("database.createBackup")}
                      </Button>
                    </Card.Content>
                  </Card>
                ))
              )
            ) : backups.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="backup-restore"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={{ marginTop: 10, color: colors.textSecondary }}>
                  {t("database.noBackups")}
                </Text>
              </View>
            ) : (
              backups.map((b) => (
                <Card key={b.filename} style={styles.card}>
                  <Card.Content>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {b.filename}
                        </Text>
                        <Text style={styles.cardSubtitle}>
                          {new Date(b.date).toLocaleString()} • {b.size}
                        </Text>
                      </View>
                      <Menu
                        visible={backupMenuVisible === b.filename}
                        onDismiss={() => setBackupMenuVisible(null)}
                        anchor={
                          <IconButton
                            icon="dots-vertical"
                            onPress={() => setBackupMenuVisible(b.filename)}
                          />
                        }
                      >
                        <Menu.Item
                          onPress={() => handleRestorePress(b)}
                          title={t("database.restore")}
                          leadingIcon="restore"
                        />
                        <Menu.Item
                          onPress={() => {
                            setBackupMenuVisible(null);
                            handleDownloadBackup(b.filename);
                          }}
                          title={t("database.download")}
                          leadingIcon="download"
                        />
                        <Divider />
                        <Menu.Item
                          onPress={() => {
                            setBackupMenuVisible(null);
                            handleDeleteBackup(b.filename);
                          }}
                          title={t("common.delete")}
                          leadingIcon="delete"
                          titleStyle={{ color: colors.error }}
                        />
                      </Menu>
                    </View>
                  </Card.Content>
                </Card>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* Backup Dialog */}
      <Portal>
        <Dialog
          visible={backupVisible}
          onDismiss={() => setBackupVisible(false)}
        >
          <Dialog.Title>
            {t("database.createBackup")} {selectedContainer?.name}
          </Dialog.Title>
          <Dialog.Content>
            <View style={{ gap: 12 }}>
              <TextInput
                label={t("database.dbName")}
                value={backupConfig.dbName}
                onChangeText={(t) =>
                  setBackupConfig({ ...backupConfig, dbName: t })
                }
                mode="outlined"
              />
              <TextInput
                label={t("database.dbUser")}
                value={backupConfig.dbUser}
                onChangeText={(t) =>
                  setBackupConfig({ ...backupConfig, dbUser: t })
                }
                mode="outlined"
              />
              <TextInput
                label={t("database.dbPassword")}
                value={backupConfig.dbPassword}
                onChangeText={(t) =>
                  setBackupConfig({ ...backupConfig, dbPassword: t })
                }
                mode="outlined"
                secureTextEntry
              />
              <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                {t("database.backupDefault")}
              </Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setBackupVisible(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onPress={handleBackupSubmit}
              loading={backingUp}
              disabled={backingUp}
            >
              {t("common.start")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Restore Dialog */}
      <Portal>
        <Dialog
          visible={restoreVisible}
          onDismiss={() => setRestoreVisible(false)}
        >
          <Dialog.Title>{t("database.restore")}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView
              contentContainerStyle={{ paddingVertical: 12, gap: 12 }}
            >
              <Text variant="bodyMedium">File: {selectedBackup?.filename}</Text>

              {/* Simple Dropdown for Container selection could be tricky in Dialog on native, simpler to use mapped buttons or proper dropdown component if available. 
                For cleanliness, let's list available valid containers as chips or radio buttons.
            */}
              <Text variant="titleSmall" style={{ marginTop: 8 }}>
                {t("database.selectContainer")}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {containers
                  .filter((c) => c.type !== "redis" && c.type !== "unknown")
                  .map((c) => (
                    <Chip
                      key={c.id}
                      selected={restoreConfig.containerId === c.id}
                      onPress={() => {
                        setRestoreConfig({
                          ...restoreConfig,
                          containerId: c.id,
                          dbType: c.type,
                        });
                      }}
                      showSelectedOverlay
                    >
                      {c.name}
                    </Chip>
                  ))}
              </ScrollView>

              <TextInput
                label={t("database.dbName")}
                value={restoreConfig.dbName}
                onChangeText={(t) =>
                  setRestoreConfig({ ...restoreConfig, dbName: t })
                }
                mode="outlined"
              />
              <TextInput
                label={t("database.dbUser")}
                value={restoreConfig.dbUser}
                onChangeText={(t) =>
                  setRestoreConfig({ ...restoreConfig, dbUser: t })
                }
                mode="outlined"
              />
              <TextInput
                label={t("database.dbPassword")}
                value={restoreConfig.dbPassword}
                onChangeText={(t) =>
                  setRestoreConfig({ ...restoreConfig, dbPassword: t })
                }
                mode="outlined"
                secureTextEntry
              />
              <Text style={{ color: colors.error, fontSize: 12 }}>
                {t("database.overwriteWarning")}
              </Text>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setRestoreVisible(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onPress={handleRestoreSubmit}
              loading={restoring}
              disabled={restoring || !restoreConfig.containerId}
              textColor={colors.warning}
            >
              {t("database.restore")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <CustomAlertDialog ref={dialogRef} />
    </>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    emptyState: { alignItems: "center", justifyContent: "center", padding: 40 },
    card: { marginBottom: 12, backgroundColor: colors.card, borderRadius: 12 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 2,
    },
    cardSubtitle: { fontSize: 13, color: colors.textSecondary },
  });
