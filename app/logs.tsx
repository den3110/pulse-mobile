import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import {
  Text,
  Surface,
  Button,
  IconButton,
  Menu,
  ActivityIndicator,
  Chip,
} from "react-native-paper";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../contexts/ThemeContext";
import { useServer } from "../contexts/ServerContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import EventSource from "react-native-sse";
import api from "../services/api";

type LogType = "docker" | "pm2" | "nginx" | "syslog" | "auth";

export default function LogStudioScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, isDark);

  const { selectedServer } = useServer();

  const [selectedType, setSelectedType] = useState<LogType | "">("");

  const [targets, setTargets] = useState<any[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [targetMenuVisible, setTargetMenuVisible] = useState(false);
  const [loadingTargets, setLoadingTargets] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const logTypes = [
    { type: "docker", label: "Docker", icon: "docker" },
    { type: "pm2", label: "PM2", icon: "console-line" },
    { type: "nginx", label: "Nginx", icon: "web" },
    { type: "syslog", label: "Syslog", icon: "text-box-outline" },
    { type: "auth", label: "Auth", icon: "shield-key-outline" },
  ];

  useEffect(() => {
    return () => stopStreaming();
  }, []);

  useEffect(() => {
    setTargets([]);
    setSelectedTarget("");

    if (
      selectedType === "nginx" ||
      selectedType === "syslog" ||
      selectedType === "auth"
    ) {
      setSelectedTarget(selectedType);
      return;
    }

    if (!selectedServer || !selectedType) return;

    const loadTargets = async () => {
      setLoadingTargets(true);
      try {
        if (selectedType === "docker") {
          const res = await api.get(`/docker/${selectedServer._id}/containers`);
          const data = Array.isArray(res.data)
            ? res.data
            : res.data?.containers || [];
          setTargets(
            data.map((c: any) => ({
              id: c.Names ? c.Names[0].replace("/", "") : c.Id.substring(0, 12),
              name: c.Names
                ? c.Names[0].replace("/", "")
                : c.Id.substring(0, 12),
            })),
          );
        } else if (selectedType === "pm2") {
          const res = await api.get(`/pm2/${selectedServer._id}/processes`);
          const data = Array.isArray(res.data)
            ? res.data
            : res.data?.processes || [];
          setTargets(
            data.map((p: any) => ({
              id: p.name,
              name: p.name,
            })),
          );
        }
      } catch (err) {
        console.error("Failed to load targets", err);
      } finally {
        setLoadingTargets(false);
      }
    };

    loadTargets();
  }, [selectedServer, selectedType]);

  const startStreaming = async () => {
    if (!selectedServer || !selectedType || !selectedTarget) return;

    stopStreaming();
    setLogs([
      `Connecting to ${selectedType} logs on ${selectedServer.name}...`,
    ]);
    setIsStreaming(true);

    const token = await AsyncStorage.getItem("accessToken");
    const targetQuery = selectedTarget ? `&target=${selectedTarget}` : "";
    const url = `${process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.10:5000"}/api/logs/stream?serverId=${selectedServer._id}&type=${selectedType}${targetQuery}&token=${token}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("message", (event: any) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          setLogs((prev) => [...prev, `[ERROR] ${data.error}`]);
          stopStreaming();
        } else if (data.content !== undefined) {
          setLogs((prev) => {
            const newLogs = [...prev, data.content];
            // Keep last 500 lines to prevent memory issues
            if (newLogs.length > 500)
              return newLogs.slice(newLogs.length - 500);
            return newLogs;
          });
        }
      } catch {
        setLogs((prev) => [...prev, event.data]);
      }
    });

    es.addEventListener("error", () => {
      setLogs((prev) => [
        ...prev,
        "[CONNECTION ERROR] Lost connection to stream.",
      ]);
      stopStreaming();
    });

    es.addEventListener("close", () => {
      setLogs((prev) => [...prev, "--- Stream closed by server ---"]);
      stopStreaming();
    });
  };

  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  };

  const getLogColor = (line: string) => {
    const lower = line.toLowerCase();
    if (lower.includes("error") || lower.includes("err!")) return colors.error;
    if (lower.includes("warn")) return colors.warning;
    if (lower.includes("info")) return colors.info;
    return "#d4d4d4";
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t("nav.logs", "Log Studio") }} />

      {/* Configuration Header */}
      <Surface style={styles.headerForm} elevation={0}>
        <View>
          <Text style={styles.serviceLabel}>{t("logs.serviceType", "Service Type")}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeScrollContent}
          >
            {logTypes.map((tItem) => {
              const objType = tItem.type as LogType;
              const isSelected = selectedType === objType;
              return (
                <Chip
                  key={objType}
                  selected={isSelected}
                  showSelectedOverlay
                  icon={tItem.icon}
                  style={[
                    styles.typeChip,
                    isSelected && {
                      backgroundColor: colors.primary + "20",
                      borderColor: colors.primary,
                    },
                  ]}
                  textStyle={[
                    { fontSize: 13 },
                    isSelected && { color: colors.primary, fontWeight: "700" },
                  ]}
                  onPress={() => setSelectedType(objType)}
                >
                  {tItem.label}
                </Chip>
              );
            })}
          </ScrollView>
        </View>

        {(selectedType === "docker" || selectedType === "pm2") && (
          <View style={{ marginTop: 12 }}>
            <Menu
              visible={targetMenuVisible}
              onDismiss={() => setTargetMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setTargetMenuVisible(true)}
                  style={styles.targetDropdownBtn}
                  contentStyle={{ height: 44, justifyContent: "space-between" }}
                  icon="menu-down"
                  disabled={
                    isStreaming || loadingTargets || targets.length === 0
                  }
                  loading={loadingTargets}
                  textColor={colors.text}
                >
                  {selectedTarget ||
                    (selectedType === "docker"
                      ? "Select Container"
                      : "Select Process")}
                </Button>
              }
            >
              {targets.map((tItem) => (
                <Menu.Item
                  key={tItem.id}
                  onPress={() => {
                    setSelectedTarget(tItem.id);
                    setTargetMenuVisible(false);
                  }}
                  title={tItem.name}
                />
              ))}
            </Menu>
          </View>
        )}
      </Surface>

      {/* Terminal View filling remaining space */}
      <View style={styles.terminalContainer}>
        <View style={styles.terminalHeader}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              flex: 1,
            }}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: !selectedServer
                    ? colors.border
                    : isStreaming
                      ? colors.success
                      : colors.error,
                },
              ]}
            />
            <Text style={styles.terminalTitle} numberOfLines={1}>
              {!selectedServer
                ? "No server selected"
                : isStreaming
                  ? `Streaming: ${selectedServer?.name} > ${selectedTarget}`
                  : "Disconnected"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <IconButton
              icon={isStreaming ? "stop" : "play"}
              size={20}
              iconColor={isStreaming ? colors.error : colors.success}
              onPress={isStreaming ? stopStreaming : startStreaming}
              disabled={!selectedServer || !selectedType || !selectedTarget}
              style={{ margin: 0 }}
            />
            <IconButton
              icon="delete-sweep"
              size={20}
              iconColor="#a0aec0"
              onPress={() => setLogs([])}
              style={{ margin: 0, marginLeft: 4 }}
            />
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.terminalScrollView}
          contentContainerStyle={styles.terminalContent}
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
          indicatorStyle="white"
        >
          {logs.length === 0 ? (
            <Text
              style={[
                styles.logLine,
                {
                  color: "#6b7280",
                  fontStyle: "italic",
                  textAlign: "center",
                  marginTop: 24,
                },
              ]}
            >
              {t("logs.readyToStreamLogs", "Ready to stream logs...")}</Text>
          ) : (
            <View style={{ paddingBottom: 24 }}>
              {logs.map((line, index) => (
                <Text
                  key={index}
                  style={[styles.logLine, { color: getLogColor(line) }]}
                >
                  {line}
                </Text>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerForm: {
      padding: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    serviceLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    typeScrollContent: {
      gap: 8,
      paddingRight: 16,
    },
    typeChip: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    targetDropdownBtn: {
      borderRadius: 10,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    terminalContainer: {
      flex: 1,
      backgroundColor: "#1e1e1e",
    },
    terminalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 6,
      backgroundColor: "#2d2d2d",
      borderBottomWidth: 1,
      borderBottomColor: "#404040",
      elevation: 4,
      zIndex: 10,
    },
    terminalTitle: {
      color: "#e0e0e0",
      fontSize: 13,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      fontWeight: "600",
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    terminalScrollView: {
      flex: 1,
    },
    terminalContent: {
      padding: 12,
      minHeight: "100%",
    },
    logLine: {
      color: "#d4d4d4",
      fontSize: 12,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      marginBottom: 2,
      lineHeight: 18,
    },
  });
