import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Modal,
  TextInput as RNTextInput,
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
  FAB,
  Menu,
  Divider,
  Appbar,
  SegmentedButtons,
  Snackbar,
} from "react-native-paper";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useServer } from "../../contexts/ServerContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface NginxConfig {
  name: string;
  enabled: boolean;
  size: string;
  modified: string;
}

import CustomAlertDialog, {
  CustomAlertDialogRef,
} from "../../components/CustomAlertDialog";

interface NginxStatus {
  active: boolean;
  output: string;
}

const DEFAULT_TEMPLATE = `server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}`;

export default function NginxManagerScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();

  const { serverId: paramServerId } = useLocalSearchParams<{
    serverId: string;
  }>();
  const { selectedServer } = useServer();
  const serverId = paramServerId || selectedServer?._id;

  const [configs, setConfigs] = useState<NginxConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<NginxStatus | null>(null);

  // Editor State
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorFilename, setEditorFilename] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [isNewFile, setIsNewFile] = useState(false);

  // Log Viewer State
  const [logVisible, setLogVisible] = useState(false);
  const [logType, setLogType] = useState<"access" | "error">("access");
  const [logContent, setLogContent] = useState("");
  const [logLoading, setLogLoading] = useState(false);

  // Test/Reload Output
  const [outputDialogVisible, setOutputDialogVisible] = useState(false);
  const [actionOutput, setActionOutput] = useState<{
    success: boolean;
    output: string;
  } | null>(null);

  // Custom Dialog Ref
  const dialogRef = useRef<CustomAlertDialogRef>(null);

  const fetchData = useCallback(async () => {
    if (!serverId) return;
    try {
      const [configsRes, statusRes] = await Promise.all([
        api.get(`/nginx/${serverId}/configs`),
        api.get(`/nginx/${serverId}/status`),
      ]);
      setConfigs(configsRes.data);
      setStatus(statusRes.data);
    } catch (err: any) {
      // console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleTest = async () => {
    if (!serverId) return;
    try {
      const { data } = await api.post(`/nginx/${serverId}/test`);
      setActionOutput(data);
      setOutputDialogVisible(true);
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      dialogRef.current?.show("Error", err.message);
    }
  };

  const handleReload = async () => {
    if (!serverId) return;
    try {
      const { data } = await api.post(`/nginx/${serverId}/reload`);
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchData();
        dialogRef.current?.show("Success", "Nginx reloaded successfully");
      } else {
        setActionOutput({
          success: false,
          output: data.output || "Reload failed",
        });
        setOutputDialogVisible(true);
      }
    } catch (err: any) {
      dialogRef.current?.show("Error", err.message);
    }
  };

  const handleToggle = async (config: NginxConfig) => {
    if (!serverId) return;
    try {
      const action = config.enabled ? "disable" : "enable";
      await api.post(`/nginx/${serverId}/configs/${config.name}/${action}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      fetchData();
    } catch (err: any) {
      dialogRef.current?.show(
        "Error",
        err.response?.data?.message || "Failed to toggle",
      );
    }
  };

  const handleDelete = (config: NginxConfig) => {
    if (!serverId) return;
    dialogRef.current?.confirm(
      "Delete Config",
      `Are you sure you want to delete ${config.name}?`,
      async () => {
        try {
          await api.delete(`/nginx/${serverId}/configs/${config.name}`);
          fetchData();
        } catch (err: any) {
          dialogRef.current?.show(
            "Error",
            err.response?.data?.message || "Delete failed",
          );
        }
      },
      "Delete",
      true,
    );
  };

  const handleOpenEditor = async (filename?: string) => {
    if (!serverId) return;
    setEditorVisible(true);
    if (filename) {
      setIsNewFile(false);
      setEditorFilename(filename);
      setEditorLoading(true);
      try {
        const { data } = await api.get(
          `/nginx/${serverId}/configs/${filename}`,
        );
        setEditorContent(data.content);
      } catch (err: any) {
        dialogRef.current?.show("Error", "Failed to load config");
        setEditorVisible(false);
      } finally {
        setEditorLoading(false);
      }
    } else {
      setIsNewFile(true);
      setEditorFilename("");
      setEditorContent(DEFAULT_TEMPLATE);
      setEditorLoading(false);
    }
  };

  const handleSave = async (reload: boolean = false) => {
    if (!serverId || !editorFilename) return;
    setEditorSaving(true);
    try {
      if (reload) {
        const { data } = await api.post(
          `/nginx/${serverId}/configs/${editorFilename}/save-reload`,
          { content: editorContent },
        );
        if (data.success) {
          dialogRef.current?.show("Success", "Saved and Reloaded Nginx");
          setEditorVisible(false);
          fetchData();
        } else {
          setActionOutput({ success: false, output: data.output });
          setOutputDialogVisible(true);
        }
      } else {
        await api.post(`/nginx/${serverId}/configs/${editorFilename}`, {
          content: editorContent,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setEditorVisible(false);
        fetchData();
      }
    } catch (err: any) {
      dialogRef.current?.show(
        "Error",
        err.response?.data?.message || "Save failed",
      );
    } finally {
      setEditorSaving(false);
    }
  };

  const handleViewLogs = async (type: "access" | "error") => {
    if (!serverId) return;
    setLogType(type);
    setLogVisible(true);
    setLogLoading(true);
    try {
      const { data } = await api.get(
        `/nginx/${serverId}/logs/${type}?lines=100`,
      );
      setLogContent(data.content);
    } catch (err: any) {
      setLogContent(`Failed to load log: ${err.message}`);
    } finally {
      setLogLoading(false);
    }
  };

  if (!serverId)
    return (
      <View style={styles.centered}>
        <Text>{t("common.noData")}</Text>
      </View>
    );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Nginx Manager",
          headerRight: () => (
            <View style={{ flexDirection: "row" }}>
              <IconButton
                icon="file-document-outline"
                onPress={() => handleViewLogs("access")}
              />
              <IconButton
                icon="alert-circle-outline"
                iconColor={colors.error}
                onPress={() => handleViewLogs("error")}
              />
            </View>
          ),
        }}
      />
      <View style={styles.container}>
        {/* Status Bar */}
        <View style={styles.statusBar}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons
              name="server-network"
              size={24}
              color={colors.primary}
            />
            <View>
              <Text style={{ fontWeight: "bold" }}>{t("nginx.status")}</Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: status?.active
                      ? colors.success
                      : colors.error,
                  }}
                />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {status?.active ? "Active & Running" : "Inactive"}
                </Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: "row" }}>
            <Button compact onPress={handleTest}>
              {t("nginx.test")}
            </Button>
            <Button compact onPress={handleReload}>
              {t("nginx.reload")}
            </Button>
          </View>
        </View>

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
          {loading && !refreshing ? (
            <ActivityIndicator style={{ marginTop: 20 }} size="large" />
          ) : configs.length === 0 ? (
            <View style={styles.centered}>
              <Text style={{ color: colors.textSecondary }}>
                {t("nginx.noConfigs")}
              </Text>
            </View>
          ) : (
            configs.map((config) => (
              <Card key={config.name} style={styles.card}>
                <Card.Content>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{config.name}</Text>
                      <Text style={styles.cardSubtitle}>
                        {config.size} • {config.modified}
                      </Text>
                    </View>
                    <Chip
                      mode="outlined"
                      icon={config.enabled ? "check" : "close"}
                      style={{
                        borderColor: config.enabled
                          ? colors.success
                          : colors.textSecondary,
                      }}
                      textStyle={{
                        color: config.enabled
                          ? colors.success
                          : colors.textSecondary,
                      }}
                    >
                      {config.enabled
                        ? t("nginx.enabled")
                        : t("nginx.disabled")}
                    </Chip>
                  </View>
                  <Divider style={{ marginVertical: 12 }} />
                  <View style={styles.actionRow}>
                    <Button
                      mode="text"
                      compact
                      icon="pencil"
                      onPress={() => handleOpenEditor(config.name)}
                    >
                      {t("common.edit")}
                    </Button>
                    <Button
                      mode="text"
                      compact
                      icon={config.enabled ? "stop" : "play"}
                      textColor={
                        config.enabled ? colors.warning : colors.success
                      }
                      onPress={() => handleToggle(config)}
                    >
                      {config.enabled
                        ? t("common.disable")
                        : t("common.enable")}
                    </Button>
                    <Button
                      mode="text"
                      compact
                      icon="delete"
                      textColor={colors.error}
                      onPress={() => handleDelete(config)}
                      disabled={config.name === "default"}
                    >
                      {t("common.delete")}
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            ))
          )}
        </ScrollView>

        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: colors.primary }]}
          color="white"
          onPress={() => handleOpenEditor()}
        />

        {/* Editor Modal */}
        <Modal
          visible={editorVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setEditorVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Appbar.Header statusBarHeight={0}>
              <Appbar.Action
                icon="close"
                onPress={() => setEditorVisible(false)}
              />
              <Appbar.Content
                title={isNewFile ? t("nginx.newConfig") : editorFilename}
                subtitle={isNewFile ? "New File" : "Editing..."}
              />
            </Appbar.Header>

            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === "ios" ? 44 : 0}
            >
              {editorLoading ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" />
                </View>
              ) : (
                <View style={{ flex: 1 }}>
                  <ScrollView
                    contentContainerStyle={{ flexGrow: 1, padding: 16 }}
                  >
                    {isNewFile && (
                      <TextInput
                        label={
                          t("nginx.filenamePlaceholder") ||
                          "Filename (e.g. my-app)"
                        }
                        value={editorFilename}
                        onChangeText={setEditorFilename}
                        style={{ marginBottom: 16 }}
                        mode="outlined"
                      />
                    )}
                    <RNTextInput
                      style={[
                        styles.editorInput,
                        { color: colors.text, textAlignVertical: "top" },
                      ]}
                      multiline
                      value={editorContent}
                      onChangeText={setEditorContent}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="// Nginx Config"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </ScrollView>

                  {/* Bottom Action Bar */}
                  <Divider />
                  <View
                    style={{
                      padding: 12,
                      flexDirection: "row",
                      gap: 8,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Button
                      mode="outlined"
                      onPress={() => setEditorVisible(false)}
                      style={{ flex: 1 }}
                      compact
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      mode="contained"
                      onPress={() => handleSave(false)}
                      loading={editorSaving}
                      disabled={editorSaving}
                      style={{ flex: 1 }}
                      compact
                    >
                      {t("common.save")}
                    </Button>
                    <Button
                      mode="contained"
                      onPress={() => handleSave(true)}
                      loading={editorSaving}
                      disabled={editorSaving}
                      buttonColor={colors.accent}
                      textColor="#ffffff"
                      style={{ flex: 1.2 }}
                      compact
                    >
                      Save & Reload
                    </Button>
                  </View>
                </View>
              )}
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* Log Viewer Modal */}
        <Modal
          visible={logVisible}
          animationType="slide"
          onRequestClose={() => setLogVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: "#0d1117" }}>
            <Appbar.Header style={{ backgroundColor: "#161b22" }}>
              <Appbar.Action
                icon="close"
                color="white"
                onPress={() => setLogVisible(false)}
              />
              <Appbar.Content
                title={`${logType === "access" ? t("nginx.viewAccessLog") : t("nginx.viewErrorLog")}`}
                titleStyle={{ color: "white" }}
              />
            </Appbar.Header>
            {logLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator color="white" />
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                <Text
                  style={{
                    color: "#c9d1d9",
                    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                    fontSize: 12,
                  }}
                >
                  {logContent || t("deploy.noLogs")}
                </Text>
              </ScrollView>
            )}
          </View>
        </Modal>

        {/* Output Dialog */}
        <Portal>
          <Dialog
            visible={outputDialogVisible}
            onDismiss={() => setOutputDialogVisible(false)}
          >
            <Dialog.Title>
              {actionOutput?.success ? "Success" : "Error"}
            </Dialog.Title>
            <Dialog.ScrollArea>
              <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
                <Text
                  style={{
                    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                    fontSize: 12,
                  }}
                >
                  {actionOutput?.output}
                </Text>
              </ScrollView>
            </Dialog.ScrollArea>
            <Dialog.Actions>
              <Button onPress={() => setOutputDialogVisible(false)}>
                Close
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        <CustomAlertDialog ref={dialogRef} />
      </View>
    </>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    statusBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 12,
      backgroundColor: colors.surfaceVariant,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
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
    actionRow: { flexDirection: "row", justifyContent: "flex-end", gap: 4 },
    fab: {
      position: "absolute",
      margin: 16,
      right: 0,
      bottom: 0,
    },
    editorInput: {
      flex: 1,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 14,
      minHeight: 300,
    },
  });
