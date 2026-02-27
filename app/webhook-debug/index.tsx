import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  Alert,
} from "react-native";
import {
  Text,
  ActivityIndicator,
  Button,
  Chip,
  Card,
  IconButton,
  Menu,
  List,
} from "react-native-paper";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { useAppTheme } from "../../contexts/ThemeContext";

interface WebhookEvent {
  id: string;
  headers: Record<string, string>;
  body: Record<string, any>;
  status: "success" | "failed" | "ignored";
  message: string;
  timestamp: string;
}

const statusColors: Record<string, string> = {
  success: "#22c55e",
  failed: "#ef4444",
  ignored: "#64748b",
};

export default function WebhookDebuggerScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const styles = createStyles(colors, isDark);

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [projectMenuVisible, setProjectMenuVisible] = useState(false);

  const [events, setEvents] = useState<WebhookEvent[]>([]);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data } = await api.get("/projects");
      setProjects(data || []);
      if (data && data.length > 0) {
        // We do NOT auto-select the first project in WebhookDebugger usually, but it saves an extra tap if we do
        setProjectId(data[0]._id);
      }
    } catch (error) {
      console.error("Failed to load projects", error);
      Alert.alert(t("common.error"), "Failed to load projects");
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchLogs = useCallback(async () => {
    if (!projectId) return;
    setLoadingLogs(true);
    try {
      const { data } = await api.get(`/webhook-debug/${projectId}/logs`);
      setEvents(data.logs || []);
    } catch {
      Alert.alert(t("common.error"), "Failed to fetch logs");
    } finally {
      setLoadingLogs(false);
      setRefreshing(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    if (projectId) {
      fetchLogs();
    }
  }, [projectId, fetchLogs]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  const clearLogs = async () => {
    if (!projectId) return;
    Alert.alert(
      t("webhookDebug.clear", "Clear Logs"),
      "Are you sure you want to clear all webhook logs for this project?",
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("common.clear", "Clear"),
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/webhook-debug/${projectId}/logs`);
              setEvents([]);
              Alert.alert(t("common.success"), "Logs cleared");
            } catch {
              Alert.alert(t("common.error"), "Failed to clear logs");
            }
          },
        },
      ],
    );
  };

  const sendTestWebhook = async () => {
    if (!projectId) return;
    try {
      await api.post(`/webhook-debug/${projectId}/test`);
      Alert.alert(t("common.success"), "Test event sent");
      fetchLogs();
    } catch {
      Alert.alert(t("common.error"), "Failed to send test ping");
    }
  };

  const selectedProject = projects.find((p) => p._id === projectId);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{ title: t("webhookDebug.title", "Webhook Debugger") }}
      />

      {/* Controls Container */}
      <View style={styles.controlsContainer}>
        <Menu
          visible={projectMenuVisible}
          onDismiss={() => setProjectMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              icon="chevron-down"
              contentStyle={{ flexDirection: "row-reverse" }}
              onPress={() => setProjectMenuVisible(true)}
              style={styles.projectSelector}
              loading={loadingProjects}
            >
              {selectedProject ? selectedProject.name : "Select Project"}
            </Button>
          }
        >
          {projects.map((p) => (
            <Menu.Item
              key={p._id}
              onPress={() => {
                setProjectId(p._id);
                setProjectMenuVisible(false);
              }}
              title={p.name}
            />
          ))}
        </Menu>

        <View style={styles.actionButtons}>
          <Button
            mode="contained-tonal"
            icon="refresh"
            onPress={fetchLogs}
            loading={loadingLogs}
            disabled={!projectId}
            style={styles.actionBtn}
            labelStyle={styles.actionBtnLabel}
          >
            {t("webhookDebug.refresh", "Refresh")}</Button>
          <Button
            mode="contained-tonal"
            icon="send"
            onPress={sendTestWebhook}
            disabled={!projectId}
            style={styles.actionBtn}
            labelStyle={styles.actionBtnLabel}
          >
            {t("webhookDebug.testPing", "Test Ping")}</Button>
          <Button
            mode="contained-tonal"
            icon="delete-sweep"
            onPress={clearLogs}
            disabled={!projectId}
            textColor={colors.error}
            style={styles.actionBtn}
            labelStyle={styles.actionBtnLabel}
          >
            {t("webhookDebug.clear", "Clear")}</Button>
        </View>
      </View>

      {/* Events List */}
      {!projectId ? (
        <View style={styles.emptyContainer}>
          <IconButton icon="bug" size={48} iconColor={colors.textSecondary} />
          <Text style={styles.emptyText}>
            {t("webhookDebug.selectAProjectTo", "Select a project to view webhook logs")}</Text>
        </View>
      ) : loadingLogs && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : events.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <IconButton
            icon="spider-web"
            size={64}
            iconColor={colors.textSecondary}
          />
          <Text style={styles.emptyText}>{t("webhookDebug.noWebhookEventsRecorded", "No webhook events recorded")}</Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {events.map((event) => (
            <Card
              key={event.id}
              style={[
                styles.eventCard,
                {
                  borderLeftColor: statusColors[event.status] || colors.border,
                },
              ]}
              mode="elevated"
              elevation={1}
            >
              <List.Accordion
                title={event.message}
                titleStyle={styles.eventTitle}
                titleNumberOfLines={2}
                description={
                  <View style={styles.eventSubtitle}>
                    <Chip
                      compact
                      textStyle={{
                        fontSize: 10,
                        marginVertical: 0,
                        marginHorizontal: 4,
                      }}
                      style={{
                        backgroundColor: `${statusColors[event.status]}20`,
                        marginRight: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: statusColors[event.status],
                          fontWeight: "bold",
                        }}
                      >
                        {event.status}
                      </Text>
                    </Chip>
                    {event.headers?.["x-github-event"] && (
                      <Chip
                        compact
                        mode="outlined"
                        textStyle={{
                          fontSize: 10,
                          marginVertical: 0,
                          marginHorizontal: 4,
                        }}
                        style={{ marginRight: 8 }}
                      >
                        {event.headers["x-github-event"]}
                      </Chip>
                    )}
                    <Text style={styles.timestampText}>
                      {new Date(event.timestamp).toLocaleString()}
                    </Text>
                  </View>
                }
                style={styles.accordionHeader}
              >
                <View style={styles.accordionBody}>
                  <Text style={styles.sectionHeader}>{t("webhookDebug.headers", "Headers")}</Text>
                  <ScrollView
                    style={styles.codeBox}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    <Text style={styles.codeText}>
                      {JSON.stringify(event.headers, null, 2)}
                    </Text>
                  </ScrollView>

                  <Text style={[styles.sectionHeader, { marginTop: 12 }]}>
                    {t("webhookDebug.body", "Body")}</Text>
                  <ScrollView
                    style={styles.codeBox}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    <Text style={styles.codeText}>
                      {JSON.stringify(event.body, null, 2)}
                    </Text>
                  </ScrollView>
                </View>
              </List.Accordion>
            </Card>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    controlsContainer: {
      padding: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    projectSelector: {
      width: "100%",
    },
    actionButtons: {
      flexDirection: "row",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 8,
    },
    actionBtn: {
      flexGrow: 1,
      minWidth: "30%",
      margin: 0,
      borderRadius: 8,
    },
    actionBtnLabel: {
      fontSize: 13,
      marginHorizontal: 8,
      letterSpacing: 0,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
      gap: 12,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 8,
    },
    eventCard: {
      backgroundColor: colors.surface,
      borderLeftWidth: 4,
      borderRadius: 8,
      overflow: "hidden",
    },
    accordionHeader: {
      backgroundColor: "transparent",
      paddingVertical: 4,
    },
    eventTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
    },
    eventSubtitle: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      marginTop: 4,
    },
    timestampText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    accordionBody: {
      padding: 16,
      paddingTop: 0,
      backgroundColor: isDark ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.02)",
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    sectionHeader: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 8,
      marginTop: 16,
    },
    codeBox: {
      backgroundColor: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.04)",
      padding: 12,
      borderRadius: 4,
      maxHeight: 250,
    },
    codeText: {
      fontFamily: "monospace",
      fontSize: 11,
      color: colors.text,
    },
  });
