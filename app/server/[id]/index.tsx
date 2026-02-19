import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Pressable,
  Platform,
  TextInput as RNTextInput,
} from "react-native";
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  Chip,
  Divider,
  IconButton,
} from "react-native-paper";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../../services/api";
import { Colors, statusColor } from "../../../constants/theme";
import { useAppTheme } from "../../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useServer } from "../../../contexts/ServerContext";

import CustomAlertDialog, {
  CustomAlertDialogRef,
} from "../../../components/CustomAlertDialog";

export default function ServerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useAppTheme();
  const Colors = colors;
  const styles = createStyles(colors);
  const { setSelectedServer } = useServer();
  const [server, setServer] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [command, setCommand] = useState("");
  const [cmdOutput, setCmdOutput] = useState("");
  const [executing, setExecuting] = useState(false);

  const dialogRef = useRef<CustomAlertDialogRef>(null);

  const fetchData = async () => {
    try {
      const [serverRes, statsRes, projRes] = await Promise.all([
        api.get(`/servers/${id}`),
        api.get(`/servers/${id}/stats`).catch(() => ({ data: null })),
        api.get(`/servers/${id}/projects`).catch(() => ({ data: [] })),
      ]);
      setServer(serverRes.data);
      setSelectedServer(serverRes.data);
      setStats(statsRes.data?.stats || statsRes.data);
      setProjects(projRes.data || []);
    } catch (err) {
      console.error("Failed to fetch server", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const testConnection = async () => {
    setTesting(true);
    try {
      await api.post(`/servers/${id}/test`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      dialogRef.current?.show(
        t("common.success") || "Success",
        t("servers.connectionSuccess"),
      );
      fetchData();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      dialogRef.current?.show(
        t("common.error"),
        err.response?.data?.message || t("servers.connectionFailed"),
      );
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = () => {
    dialogRef.current?.confirm(
      t("common.delete"),
      t("servers.deleteConfirm"),
      async () => {
        try {
          await api.delete(`/servers/${id}`);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        } catch (err: any) {
          dialogRef.current?.show(
            t("common.error"),
            err.response?.data?.message || t("common.failed"),
          );
        }
      },
      t("common.delete"),
      true,
    );
  };

  const runCommand = async () => {
    if (!command.trim()) return;
    setExecuting(true);
    setCmdOutput("");
    try {
      const res = await api.post(`/servers/${id}/exec`, {
        command: command.trim(),
      });
      setCmdOutput(res.data.output || res.data.stdout || t("common.done"));
    } catch (err: any) {
      setCmdOutput(
        err.response?.data?.message ||
          err.response?.data?.stderr ||
          t("common.error"),
      );
    } finally {
      setExecuting(false);
    }
  };

  const parsePercent = (s: string) => parseFloat(s?.replace("%", "") || "0");

  const usageBar = (
    label: string,
    val: string | undefined,
    detail: string,
    color: string,
  ) => {
    const pct = parsePercent(val || "0");
    return (
      <View style={styles.usageItem}>
        <View style={styles.usageLabelRow}>
          <Text style={styles.usageLabel}>{label}</Text>
          <Text style={[styles.usageValue, { color }]}>{val || "—"}</Text>
        </View>
        <View style={styles.usageBarBg}>
          <View
            style={[
              styles.usageBarFill,
              { width: `${Math.min(pct, 100)}%`, backgroundColor: color },
            ]}
          />
        </View>
        {detail ? <Text style={styles.usageDetail}>{detail}</Text> : null}
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

  if (!server) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: Colors.textSecondary }}>
          {t("servers.noServers")}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: server.name,
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
                onPress={() => router.push(`/server/form?id=${id}`)}
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
        {/* Status Header */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.headerRow}>
              <View style={styles.serverIconLg}>
                <MaterialCommunityIcons
                  name="server"
                  size={28}
                  color={statusColor(server.status, colors)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.serverName}>{server.name}</Text>
                <Text style={styles.serverHost}>
                  {server.host}:{server.port || 22}
                </Text>
              </View>
              <Chip
                compact
                style={{
                  backgroundColor: statusColor(server.status, colors) + "20",
                }}
                textStyle={{
                  color: statusColor(server.status, colors),
                  fontWeight: "700",
                }}
              >
                {server.status}
              </Chip>
            </View>
            <Button
              mode="outlined"
              onPress={testConnection}
              loading={testing}
              disabled={testing}
              icon="connection"
              style={styles.testBtn}
              textColor={Colors.primary}
            >
              {t("servers.checkConnection")}
            </Button>
          </Card.Content>
        </Card>

        {/* Resource Usage */}
        {stats && (
          <Card style={styles.card}>
            <Card.Content>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <MaterialCommunityIcons
                  name="chart-bar"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.sectionTitle}>
                  {t("servers.resourceUsage")}
                </Text>
              </View>
              {usageBar(
                t("servers.cpuUsage"),
                stats.cpu,
                t("servers.load", { val: stats.loadAvg || "—" }),
                Colors.info,
              )}
              {usageBar(
                t("servers.memoryUsage"),
                stats.memory?.percent,
                `${stats.memory?.used || "—"} / ${stats.memory?.total || "—"}`,
                Colors.accent,
              )}
              {usageBar(
                t("servers.diskUsage"),
                stats.disk?.percent,
                `${stats.disk?.used || "—"} / ${stats.disk?.total || "—"}`,
                Colors.warning,
              )}
              {stats.uptime && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t("servers.uptime")}</Text>
                  <Text style={styles.infoValue}>{stats.uptime}</Text>
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Server Info */}
        <Card style={styles.card}>
          <Card.Content>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.sectionTitle}>{t("servers.serverInfo")}</Text>
            </View>
            <InfoRow label={t("servers.host")} value={server.host} />
            <InfoRow
              label={t("servers.port")}
              value={String(server.port || 22)}
            />
            <InfoRow
              label={t("servers.username")}
              value={server.username || "—"}
            />
            <InfoRow
              label={t("servers.authType")}
              value={server.authType || "password"}
            />
            {server.createdAt && (
              <InfoRow
                label={t("common.created")}
                value={new Date(server.createdAt).toLocaleDateString()}
              />
            )}
          </Card.Content>
        </Card>

        {/* Related Projects */}
        {projects.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <MaterialCommunityIcons
                  name="folder-outline"
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.sectionTitle}>
                  {t("servers.projectsWithCount", { count: projects.length })}
                </Text>
              </View>
              {projects.map((p: any) => (
                <Pressable
                  key={p._id}
                  onPress={() => router.push(`/project/${p._id}`)}
                  style={({ pressed }) => [
                    styles.projectItem,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.projectName}>{p.name}</Text>
                    <Text style={styles.projectPath}>{p.deployPath}</Text>
                  </View>
                  <Chip
                    compact
                    textStyle={{
                      fontSize: 10,
                      color: statusColor(p.status, colors),
                    }}
                  >
                    {p.status}
                  </Chip>
                </Pressable>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Nginx Manager */}
        <Card style={styles.card}>
          <Card.Content>
            <Pressable
              onPress={() => router.push(`/nginx?serverId=${id}`)}
              style={({ pressed }) => [
                styles.nginxLink,
                pressed && { opacity: 0.7 },
              ]}
            >
              <MaterialCommunityIcons
                name="server-network"
                size={24}
                color={Colors.primary}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.nginxTitle}>{t("nginx.title")}</Text>
                <Text style={styles.nginxDesc}>{t("nginx.desc")}</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={Colors.textSecondary}
              />
            </Pressable>
          </Card.Content>
        </Card>

        {/* File Manager */}
        <Card style={styles.card}>
          <Card.Content>
            <Pressable
              onPress={() => router.push(`/ftp?serverId=${id}`)}
              style={({ pressed }) => [
                styles.nginxLink,
                pressed && { opacity: 0.7 },
              ]}
            >
              <MaterialCommunityIcons
                name="folder-multiple"
                size={24}
                color={Colors.accent}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.nginxTitle}>
                  {t("dashboard.fileManager")}
                </Text>
                <Text style={styles.nginxDesc}>
                  {t("files.desc") || "Browse, edit, and manage files"}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={Colors.textSecondary}
              />
            </Pressable>
          </Card.Content>
        </Card>

        {/* PM2 Manager */}
        <Card style={styles.card}>
          <Card.Content>
            <Pressable
              onPress={() => router.push(`/pm2?serverId=${id}`)}
              style={({ pressed }) => [
                styles.nginxLink,
                pressed && { opacity: 0.7 },
              ]}
            >
              <MaterialCommunityIcons
                name="monitor-dashboard"
                size={24}
                color="#22c55e"
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.nginxTitle}>{t("pm2.title")}</Text>
                <Text style={styles.nginxDesc}>{t("pm2.desc")}</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={Colors.textSecondary}
              />
            </Pressable>
          </Card.Content>
        </Card>

        {/* Cron Job Manager */}
        <Card style={styles.card}>
          <Card.Content>
            <Pressable
              onPress={() => router.push(`/cron?serverId=${id}`)}
              style={({ pressed }) => [
                styles.nginxLink,
                pressed && { opacity: 0.7 },
              ]}
            >
              <MaterialCommunityIcons
                name="clock-outline"
                size={24}
                color={Colors.primary}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.nginxTitle}>{t("cron.title")}</Text>
                <Text style={styles.nginxDesc}>{t("cron.desc")}</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={Colors.textSecondary}
              />
            </Pressable>
          </Card.Content>
        </Card>

        {/* Database Manager */}
        <Card style={styles.card}>
          <Card.Content>
            <Pressable
              onPress={() => router.push(`/database?serverId=${id}`)}
              style={({ pressed }) => [
                styles.nginxLink,
                pressed && { opacity: 0.7 },
              ]}
            >
              <MaterialCommunityIcons
                name="database"
                size={24}
                color={Colors.info}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.nginxTitle}>{t("database.title")}</Text>
                <Text style={styles.nginxDesc}>{t("database.desc")}</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={Colors.textSecondary}
              />
            </Pressable>
          </Card.Content>
        </Card>

        {/* Remote Command */}
        <Card style={styles.card}>
          <Card.Content>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <MaterialCommunityIcons
                name="console"
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.sectionTitle}>
                {t("servers.remoteCommand")}
              </Text>
            </View>
            <View style={styles.cmdRow}>
              <RNTextInput
                value={command}
                onChangeText={setCommand}
                placeholder={t("servers.commandPlaceholder")}
                placeholderTextColor={Colors.textSecondary}
                style={styles.cmdInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={runCommand}
              />
              <Button
                mode="contained"
                onPress={runCommand}
                loading={executing}
                disabled={executing || !command.trim()}
                compact
                buttonColor={Colors.primary}
              >
                {t("servers.run")}
              </Button>
            </View>
            {cmdOutput ? (
              <ScrollView horizontal style={styles.cmdOutputContainer}>
                <Text style={styles.cmdOutput}>{cmdOutput}</Text>
              </ScrollView>
            ) : null}
          </Card.Content>
        </Card>
      </ScrollView>
      <CustomAlertDialog ref={dialogRef} />
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
      <Text style={{ fontSize: 14, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 14, color: colors.text, fontWeight: "600" }}>
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
    serverIconLg: {
      width: 50,
      height: 50,
      borderRadius: 14,
      backgroundColor: Colors.surfaceVariant,
      alignItems: "center",
      justifyContent: "center",
    },
    serverName: { fontSize: 18, fontWeight: "800", color: Colors.text },
    serverHost: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
    testBtn: { marginTop: 14, borderColor: Colors.primary, borderRadius: 12 },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: Colors.text,
      marginBottom: 14,
    },
    usageItem: { marginBottom: 14 },
    usageLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
      paddingRight: 4,
    },
    usageLabel: {
      fontSize: 13,
      color: Colors.textSecondary,
      fontWeight: "600",
    },
    usageValue: { fontSize: 13, fontWeight: "700" },
    usageDetail: { fontSize: 11, color: Colors.textSecondary, marginTop: 3 },
    usageBarBg: {
      height: 8,
      backgroundColor: Colors.surfaceVariant,
      borderRadius: 4,
      overflow: "hidden",
    },
    usageBarFill: { height: "100%", borderRadius: 4 },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: Colors.border,
      alignItems: "flex-start",
    },
    infoLabel: { fontSize: 14, color: Colors.textSecondary },
    infoValue: {
      fontSize: 14,
      color: Colors.text,
      fontWeight: "600",
      flex: 1,
      textAlign: "right",
      marginLeft: 16,
    },
    projectItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: Colors.border,
    },
    projectName: { fontSize: 14, fontWeight: "600", color: Colors.text },
    projectPath: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
    cmdRow: { flexDirection: "row", gap: 8, alignItems: "center" },
    cmdInput: {
      flex: 1,
      backgroundColor: Colors.surfaceVariant,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: Colors.text,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 13,
    },
    cmdOutputContainer: {
      marginTop: 10,
      backgroundColor: "#0d1117",
      borderRadius: 10,
      padding: 12,
      maxHeight: 200,
    },
    cmdOutput: {
      color: "#c9d1d9",
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 12,
      lineHeight: 18,
    },
    nginxLink: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 4,
    },
    nginxTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: Colors.text,
      marginBottom: 2,
    },
    nginxDesc: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 0,
    },
  });
