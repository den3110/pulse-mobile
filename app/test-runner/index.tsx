import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
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
  ProgressBar,
  Portal,
  Dialog,
  Divider,
} from "react-native-paper";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { useAppTheme } from "../../contexts/ThemeContext";
import EventSource from "react-native-sse";

interface TestResult {
  name: string;
  status: "pass" | "fail" | "skip" | "running";
  duration?: number;
  output?: string;
  error?: string;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

const statusColors: Record<string, string> = {
  pass: "#22c55e",
  fail: "#ef4444",
  skip: "#64748b",
};

export default function TestRunnerScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const styles = createStyles(colors, isDark);

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [projectMenuVisible, setProjectMenuVisible] = useState(false);

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const [canDeploy, setCanDeploy] = useState<boolean | null>(null);

  // History state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<any>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data } = await api.get("/projects");
      setProjects(data || []);
      if (data && data.length > 0) {
        setProjectId(data[0]._id);
      }
    } catch (error) {
      console.error("Failed to load projects", error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchHistory = async () => {
    if (!projectId) return;
    setHistoryLoading(true);
    try {
      const { data } = await api.get(`/test-runner/${projectId}/history`);
      setHistory(data.history || []);
    } catch {
      Alert.alert(t("common.error"), "Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const runTests = async () => {
    if (!projectId) return;
    setRunning(true);
    setResults([]);
    setSummary(null);
    setCanDeploy(null);

    const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:5000";

    // We must manually fetch the token from localStorage/SecureStore if required
    // Assuming backend takes session cookie or token via URL/header.
    // react-native-sse allows custom headers:
    let token = "";
    if (typeof localStorage !== "undefined") {
      token = localStorage.getItem("accessToken") || "";
    } else {
      // On native, might need SecureStore or similar.
      // Fallback logic, modify as needed if not logged in
    }

    const es = new EventSource(`${API_URL}/api/test-runner/${projectId}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }) as any;

    es.addEventListener("progress", (event: any) => {
      if (event.data) {
        try {
          const json = JSON.parse(event.data);
          setResults((prev) => [
            ...prev.filter((r) => r.name !== json.name),
            { name: json.name, status: "running" },
          ]);
        } catch (e) {}
      }
    });

    es.addEventListener("result", (event: any) => {
      if (event.data) {
        try {
          const json = JSON.parse(event.data);
          setResults((prev) => [
            ...prev.filter((r) => r.name !== json.name),
            json,
          ]);
        } catch (e) {}
      }
    });

    es.addEventListener("complete", (event: any) => {
      if (event.data) {
        try {
          const json = JSON.parse(event.data) as {
            summary: TestSummary;
            canDeploy: boolean;
          };
          setSummary(json.summary);
          setCanDeploy(json.canDeploy);
          if (json.canDeploy) {
            Alert.alert("Success", "All checks passed! Ready to deploy.");
          } else {
            Alert.alert(
              "Failed",
              "Some checks failed. Review before deploying.",
            );
          }
        } catch (e) {}
      }
      es.close();
      setRunning(false);
    });

    es.addEventListener("error", (event: any) => {
      if (event.type === "error" && event.message) {
        Alert.alert("Error", event.message);
      }
      es.close();
      setRunning(false);
    });
  };

  const selectedProject = projects.find((p) => p._id === projectId);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: t("testRunner.title", "Test Runner") }} />

      {/* Controls Container */}
      <View style={styles.controlsContainer}>
        <View style={styles.topRow}>
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

          <IconButton
            icon="history"
            mode="contained-tonal"
            iconColor={colors.primary}
            onPress={() => {
              setHistoryOpen(true);
              fetchHistory();
            }}
            disabled={!projectId}
            style={styles.historyBtn}
          />
        </View>

        <View style={styles.actionRow}>
          <Button
            mode="contained"
            icon={running ? "stop-circle-outline" : "play"}
            onPress={runTests}
            loading={running}
            disabled={!projectId || running}
            style={styles.runBtn}
          >
            {running ? "Running..." : "Run Tests"}
          </Button>

          {canDeploy !== null && (
            <Chip
              icon={canDeploy ? "rocket-launch" : "alert-circle"}
              mode="outlined"
              style={[
                styles.statusChip,
                { borderColor: canDeploy ? colors.success : colors.error },
              ]}
              textStyle={{
                color: canDeploy ? colors.success : colors.error,
                fontWeight: "bold",
              }}
            >
              {canDeploy ? "Ready" : "Failed"}
            </Chip>
          )}
        </View>

        {running && (
          <ProgressBar
            indeterminate
            color={colors.primary}
            style={styles.progress}
          />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Summary Cards */}
        {summary && (
          <View style={styles.summaryContainer}>
            <Card
              style={[
                styles.summaryCard,
                { borderBottomColor: statusColors.pass },
              ]}
            >
              <Text style={[styles.summaryValue, { color: statusColors.pass }]}>
                {summary.passed}
              </Text>
              <Text style={styles.summaryLabel}>{t("testRunner.passed", "Passed")}</Text>
            </Card>
            <Card
              style={[
                styles.summaryCard,
                { borderBottomColor: statusColors.fail },
              ]}
            >
              <Text style={[styles.summaryValue, { color: statusColors.fail }]}>
                {summary.failed}
              </Text>
              <Text style={styles.summaryLabel}>{t("testRunner.failed", "Failed")}</Text>
            </Card>
            <Card
              style={[
                styles.summaryCard,
                { borderBottomColor: statusColors.skip },
              ]}
            >
              <Text style={[styles.summaryValue, { color: statusColors.skip }]}>
                {summary.skipped}
              </Text>
              <Text style={styles.summaryLabel}>{t("testRunner.skipped", "Skipped")}</Text>
            </Card>
          </View>
        )}

        {/* Results List */}
        {results.length === 0 && !running ? (
          <View style={styles.emptyContainer}>
            <IconButton
              icon="flask"
              size={64}
              iconColor={colors.textSecondary}
            />
            <Text style={styles.emptyText}>{t("testRunner.selectAProjectAnd", "Select a project and run tests")}</Text>
            <Text style={styles.emptySubtext}>
              {t("testRunner.checksGitNpmInstall", "Checks: git, npm install, tests, memory, ports")}</Text>
          </View>
        ) : (
          <View style={styles.resultsList}>
            {results.map((result, idx) => (
              <Card
                key={idx}
                style={[
                  styles.resultCard,
                  {
                    borderLeftColor:
                      result.status === "running"
                        ? colors.primary
                        : statusColors[result.status] || colors.border,
                  },
                ]}
              >
                <Card.Content style={styles.resultContent}>
                  <View style={styles.resultHeader}>
                    {result.status === "running" ? (
                      <ActivityIndicator
                        size="small"
                        style={{ marginRight: 8 }}
                      />
                    ) : (
                      <IconButton
                        icon={
                          result.status === "pass"
                            ? "check-circle"
                            : result.status === "fail"
                              ? "alert-circle"
                              : "skip-next"
                        }
                        iconColor={statusColors[result.status]}
                        size={20}
                        style={{ margin: 0, marginRight: 8 }}
                      />
                    )}
                    <Text style={styles.resultName}>{result.name}</Text>
                    <View style={{ flex: 1 }} />
                    {result.duration != null && (
                      <Text style={styles.durationText}>
                        {result.duration}{t("testRunner.ms", "ms")}</Text>
                    )}
                    <Chip
                      compact
                      style={{
                        backgroundColor:
                          result.status === "running"
                            ? `${colors.primary}20`
                            : `${statusColors[result.status] || colors.border}20`,
                        marginLeft: 8,
                      }}
                      textStyle={{
                        fontSize: 10,
                        fontWeight: "bold",
                        color:
                          result.status === "running"
                            ? colors.primary
                            : statusColors[result.status],
                      }}
                    >
                      {result.status.toUpperCase()}
                    </Chip>
                  </View>

                  {(result.output || result.error) && (
                    <View style={styles.outputBox}>
                      {result.output && (
                        <Text style={styles.outputText} numberOfLines={8}>
                          {result.output}
                        </Text>
                      )}
                      {result.error && (
                        <Text style={styles.errorText}>⚠️ {result.error}</Text>
                      )}
                    </View>
                  )}
                </Card.Content>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* History Modal */}
      <Portal>
        <Dialog
          visible={historyOpen}
          onDismiss={() => setHistoryOpen(false)}
          style={styles.dialog}
        >
          <Dialog.Title>{t("testRunner.runHistory", "Run History")}</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView contentContainerStyle={{ paddingVertical: 16 }}>
              {historyLoading ? (
                <ActivityIndicator style={{ marginVertical: 20 }} />
              ) : history.length === 0 ? (
                <Text
                  style={{ textAlign: "center", color: colors.textSecondary }}
                >
                  {t("testRunner.noHistoryFound", "No history found")}</Text>
              ) : (
                history.map((run) => (
                  <Card
                    key={run._id}
                    style={styles.historyCard}
                    onPress={() => setSelectedRun(run)}
                  >
                    <Card.Content style={styles.historyCardContent}>
                      <View>
                        <Text
                          style={{
                            fontWeight: "bold",
                            color:
                              run.status === "success"
                                ? colors.success
                                : colors.error,
                          }}
                        >
                          {run.status === "success" ? "Success" : "Failed"}
                        </Text>
                        <Text
                          style={{ fontSize: 11, color: colors.textSecondary }}
                        >
                          {new Date(run.createdAt).toLocaleString()}
                        </Text>
                      </View>
                      <Chip
                        compact
                        style={{
                          backgroundColor:
                            run.status === "success"
                              ? `${colors.success}20`
                              : `${colors.error}20`,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            color:
                              run.status === "success"
                                ? colors.success
                                : colors.error,
                            fontWeight: "bold",
                          }}
                        >
                          {run.summary?.passed || 0}/{run.summary?.total || 0}{" "}
                          {t("testRunner.passed", "Passed")}</Text>
                      </Chip>
                    </Card.Content>
                  </Card>
                ))
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setHistoryOpen(false)}>{t("testRunner.close", "Close")}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Selected Run Details Modal */}
      <Portal>
        <Dialog
          visible={!!selectedRun}
          onDismiss={() => setSelectedRun(null)}
          style={styles.dialog}
        >
          <Dialog.Title style={{ fontSize: 18 }}>{t("testRunner.testRunDetails", "Test Run Details")}</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView
              contentContainerStyle={{ paddingVertical: 16, gap: 12 }}
            >
              {selectedRun && selectedRun.summary && (
                <View style={[styles.summaryContainer, { marginBottom: 0 }]}>
                  <Card
                    style={[
                      styles.summaryCard,
                      {
                        borderBottomColor: statusColors.pass,
                        paddingVertical: 8,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.summaryValue,
                        { color: statusColors.pass, fontSize: 18 },
                      ]}
                    >
                      {selectedRun.summary.passed}
                    </Text>
                  </Card>
                  <Card
                    style={[
                      styles.summaryCard,
                      {
                        borderBottomColor: statusColors.fail,
                        paddingVertical: 8,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.summaryValue,
                        { color: statusColors.fail, fontSize: 18 },
                      ]}
                    >
                      {selectedRun.summary.failed}
                    </Text>
                  </Card>
                  <Card
                    style={[
                      styles.summaryCard,
                      {
                        borderBottomColor: statusColors.skip,
                        paddingVertical: 8,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.summaryValue,
                        { color: statusColors.skip, fontSize: 18 },
                      ]}
                    >
                      {selectedRun.summary.skipped}
                    </Text>
                  </Card>
                </View>
              )}

              <Divider style={{ marginVertical: 4 }} />

              {selectedRun?.results?.map((res: any, idx: number) => (
                <View key={idx} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ fontSize: 16, marginRight: 8 }}>
                      {res.status === "pass"
                        ? "✅"
                        : res.status === "fail"
                          ? "❌"
                          : "⏭️"}
                    </Text>
                    <Text style={{ fontWeight: "bold", flex: 1 }}>
                      {res.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      {res.duration}{t("testRunner.ms", "ms")}</Text>
                  </View>
                  {(res.output || res.error) && (
                    <View style={styles.outputBox}>
                      {res.output && (
                        <Text style={styles.outputText} numberOfLines={5}>
                          {res.output}
                        </Text>
                      )}
                      {res.error && (
                        <Text style={styles.errorText}>⚠️ {res.error}</Text>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setSelectedRun(null)}>{t("testRunner.back", "Back")}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
    topRow: {
      flexDirection: "row",
      gap: 12,
    },
    projectSelector: {
      flex: 1,
    },
    historyBtn: {
      margin: 0,
      borderRadius: 8,
    },
    actionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    runBtn: {
      flex: 1,
      borderRadius: 8,
    },
    statusChip: {
      marginLeft: 12,
      borderWidth: 2,
    },
    progress: {
      height: 4,
      borderRadius: 2,
      marginTop: 4,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    summaryContainer: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 16,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderBottomWidth: 4,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      alignItems: "center",
      paddingVertical: 12,
    },
    summaryValue: {
      fontSize: 24,
      fontWeight: "900",
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textSecondary,
      textTransform: "uppercase",
      marginTop: 4,
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 60,
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 8,
      fontSize: 16,
    },
    emptySubtext: {
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 4,
      fontSize: 12,
    },
    resultsList: {
      gap: 12,
    },
    resultCard: {
      backgroundColor: colors.surface,
      borderLeftWidth: 4,
      borderRadius: 8,
    },
    resultContent: {
      padding: 12,
      paddingBottom: 12,
    },
    resultHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    resultName: {
      fontSize: 14,
      fontWeight: "bold",
      color: colors.text,
    },
    durationText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    outputBox: {
      marginTop: 12,
      padding: 12,
      backgroundColor: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.04)",
      borderRadius: 6,
    },
    outputText: {
      fontFamily: "monospace",
      fontSize: 10,
      color: colors.textSecondary,
    },
    errorText: {
      fontSize: 11,
      color: colors.error,
      marginTop: 4,
      fontWeight: "bold",
    },
    dialog: {
      backgroundColor: colors.surface,
      maxHeight: "80%",
    },
    dialogScrollArea: {
      paddingHorizontal: 0,
      borderColor: colors.border,
    },
    historyCard: {
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: colors.background,
    },
    historyCardContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
    },
  });
