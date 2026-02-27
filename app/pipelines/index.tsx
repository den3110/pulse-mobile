import React, { useEffect, useState } from "react";
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
  Portal,
  Dialog,
  TextInput,
  Divider,
} from "react-native-paper";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { useAppTheme } from "../../contexts/ThemeContext";

interface PipelineStep {
  name: string;
  type: "command" | "test" | "deploy" | "approval" | "notify";
  command?: string;
  onFailure?: "stop" | "continue" | "rollback";
  timeout?: number;
}

interface Pipeline {
  _id: string;
  name: string;
  description?: string;
  project: { _id: string; name: string; status: string };
  steps: PipelineStep[];
  isActive: boolean;
  lastRunAt?: string;
  lastRunStatus?: string;
  createdAt: string;
}

const stepTypeColors: Record<string, string> = {
  command: "#3b82f6",
  test: "#8b5cf6",
  deploy: "#22c55e",
  approval: "#f59e0b",
  notify: "#06b6d4",
};

const stepTypeIcons: Record<string, string> = {
  command: "console",
  test: "flask-outline",
  deploy: "rocket-launch-outline",
  approval: "check-decagram-outline",
  notify: "bell-outline",
};

export default function PipelineBuilderScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const styles = createStyles(colors, isDark);

  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const [createDialog, setCreateDialog] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runResultsOpen, setRunResultsOpen] = useState(false);
  const [runResults, setRunResults] = useState<any>(null);

  // Create Form State
  const [newPipeline, setNewPipeline] = useState({
    name: "",
    description: "",
    projectId: "",
    steps: [
      {
        name: "Install",
        type: "command",
        command: "npm install",
        onFailure: "stop",
      },
    ] as PipelineStep[],
  });

  const [projectMenuVisible, setProjectMenuVisible] = useState(false);
  const [stepTypeMenuVisible, setStepTypeMenuVisible] = useState<number | null>(
    null,
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pipeRes, projRes] = await Promise.all([
        api.get("/pipelines"),
        api.get("/projects"),
      ]);
      setPipelines(pipeRes.data.pipelines || []);
      setProjects(projRes.data || []);

      if (projRes.data && projRes.data.length > 0 && !newPipeline.projectId) {
        setNewPipeline((prev) => ({ ...prev, projectId: projRes.data[0]._id }));
      }
    } catch {
      Alert.alert(t("common.error"), "Failed to load pipelines");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newPipeline.name || !newPipeline.projectId) {
      Alert.alert(
        "Validation Error",
        "Please provide a name and select a project.",
      );
      return;
    }
    try {
      await api.post("/pipelines", newPipeline);
      Alert.alert(t("common.success"), "Pipeline created successfully!");
      setCreateDialog(false);
      setNewPipeline({
        name: "",
        description: "",
        projectId: projects.length > 0 ? projects[0]._id : "",
        steps: [
          {
            name: "Install",
            type: "command",
            command: "npm install",
            onFailure: "stop",
          },
        ],
      });
      fetchData();
    } catch (error: any) {
      Alert.alert(
        t("common.error"),
        error.response?.data?.message || "Failed to create pipeline",
      );
    }
  };

  const handleRun = async (id: string) => {
    setRunningId(id);
    setRunResults(null);
    try {
      const { data } = await api.post(`/pipelines/${id}/run`);
      setRunResults(data);
      setRunResultsOpen(true);
      fetchData();
    } catch (error: any) {
      Alert.alert(
        t("common.error"),
        error.response?.data?.message || "Failed to run pipeline",
      );
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      "Delete Pipeline",
      "Are you sure you want to delete this pipeline?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/pipelines/${id}`);
              Alert.alert(t("common.success"), "Pipeline deleted");
              fetchData();
            } catch (error: any) {
              Alert.alert(
                t("common.error"),
                error.response?.data?.message || "Failed to delete pipeline",
              );
            }
          },
        },
      ],
    );
  };

  const addStep = () => {
    setNewPipeline((p) => ({
      ...p,
      steps: [
        ...p.steps,
        {
          name: `Step ${p.steps.length + 1}`,
          type: "command" as const,
          command: "echo hello",
          onFailure: "stop" as const,
        },
      ],
    }));
  };

  const updateStep = (index: number, field: string, value: string) => {
    setNewPipeline((p) => ({
      ...p,
      steps: p.steps.map((s, i) =>
        i === index ? { ...s, [field]: value } : s,
      ),
    }));
  };

  const removeStep = (index: number) => {
    setNewPipeline((p) => ({
      ...p,
      steps: p.steps.filter((_, i) => i !== index),
    }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Pipeline Builder" }} />

      {/* Top Banner */}
      <View style={styles.topBanner}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <IconButton
            icon="transit-connection-variant"
            size={28}
            iconColor={colors.primary}
          />
          <View>
            <Text style={{ fontWeight: "bold", fontSize: 18 }}>
              {t("pipelines.cICDPipelines", "CI/CD Pipelines")}</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              {pipelines.length} {t("pipelines.activePipelines", "Active Pipelines")}</Text>
          </View>
        </View>
        <Button
          mode="contained"
          icon="plus"
          onPress={() => setCreateDialog(true)}
          style={{ borderRadius: 8 }}
        >
          {t("pipelines.create", "Create")}</Button>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" style={{ marginTop: 40 }} />
        ) : pipelines.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconButton
              icon="source-branch"
              size={64}
              iconColor={colors.textSecondary}
            />
            <Text style={styles.emptyText}>{t("pipelines.noPipelinesConfigured", "No pipelines configured")}</Text>
            <Text style={styles.emptySubtext}>
              {t("pipelines.createMultistageDeploymentsTo", "Create multi-stage deployments to automate your workflow")}</Text>
            <Button
              mode="outlined"
              onPress={() => setCreateDialog(true)}
              style={{ marginTop: 16 }}
            >
              {t("pipelines.createFirstPipeline", "Create First Pipeline")}</Button>
          </View>
        ) : (
          pipelines.map((pipeline) => (
            <Card key={pipeline._id} style={styles.pipelineCard}>
              <Card.Content>
                <View style={styles.pipelineHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pipelineName}>{pipeline.name}</Text>
                    {pipeline.description && (
                      <Text style={styles.pipelineDesc}>
                        {pipeline.description}
                      </Text>
                    )}
                    <View style={styles.projectTag}>
                      <IconButton
                        icon="folder"
                        size={12}
                        style={{ margin: 0, width: 14, height: 14 }}
                        iconColor={colors.textSecondary}
                      />
                      <Text
                        style={{ fontSize: 10, color: colors.textSecondary }}
                      >
                        {pipeline.project?.name || "Unknown"}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Chip
                      compact
                      style={{
                        backgroundColor:
                          pipeline.lastRunStatus === "success"
                            ? `${colors.success}20`
                            : pipeline.lastRunStatus === "failed"
                              ? `${colors.error}20`
                              : pipeline.lastRunStatus === "running"
                                ? `${colors.primary}20`
                                : `${colors.border}50`,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "bold",
                          color:
                            pipeline.lastRunStatus === "success"
                              ? colors.success
                              : pipeline.lastRunStatus === "failed"
                                ? colors.error
                                : pipeline.lastRunStatus === "running"
                                  ? colors.primary
                                  : colors.textSecondary,
                        }}
                      >
                        {pipeline.lastRunStatus
                          ? pipeline.lastRunStatus.toUpperCase()
                          : "NEVER RUN"}
                      </Text>
                    </Chip>
                    {pipeline.lastRunAt && (
                      <Text
                        style={{
                          fontSize: 10,
                          color: colors.textSecondary,
                          marginTop: 4,
                        }}
                      >
                        {new Date(pipeline.lastRunAt).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Steps Visualizer */}
                <View style={styles.stepsVisualizer}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                      alignItems: "center",
                      paddingVertical: 8,
                    }}
                  >
                    {pipeline.steps.map((step, idx) => (
                      <View
                        key={idx}
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <View
                          style={[
                            styles.stepCircle,
                            {
                              borderColor:
                                stepTypeColors[step.type] || colors.border,
                            },
                          ]}
                        >
                          <IconButton
                            icon={stepTypeIcons[step.type] || "cog"}
                            iconColor={stepTypeColors[step.type] || colors.text}
                            size={16}
                            style={{ margin: 0 }}
                          />
                        </View>
                        {idx < pipeline.steps.length - 1 && (
                          <View style={styles.stepConnector} />
                        )}
                      </View>
                    ))}
                  </ScrollView>
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.textSecondary,
                      textAlign: "center",
                    }}
                  >
                    {pipeline.steps.length}{" "}
                    {pipeline.steps.length === 1 ? "stage" : "stages"}:{" "}
                    {pipeline.steps.map((s) => s.name).join(" → ")}
                  </Text>
                </View>

                <View style={styles.pipelineActions}>
                  <Button
                    mode="contained-tonal"
                    icon="play"
                    onPress={() => handleRun(pipeline._id)}
                    loading={runningId === pipeline._id}
                    disabled={runningId !== null}
                    style={{ flex: 1, borderRadius: 8 }}
                  >
                    {runningId === pipeline._id ? "Running..." : "Run"}
                  </Button>
                  <IconButton
                    icon="delete-outline"
                    iconColor={colors.error}
                    mode="outlined"
                    onPress={() => handleDelete(pipeline._id)}
                    style={{ borderRadius: 8, borderColor: colors.error }}
                  />
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Create Pipeline Dialog */}
      <Portal>
        <Dialog
          visible={createDialog}
          onDismiss={() => setCreateDialog(false)}
          style={styles.dialog}
        >
          <Dialog.Title>{t("pipelines.createPipeline", "Create Pipeline")}</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView
              contentContainerStyle={{ paddingVertical: 16, gap: 12 }}
            >
              <TextInput
                label="Pipeline Name"
                mode="outlined"
                value={newPipeline.name}
                onChangeText={(text) =>
                  setNewPipeline({ ...newPipeline, name: text })
                }
                style={styles.input}
              />

              <TextInput
                label="Description"
                mode="outlined"
                value={newPipeline.description}
                onChangeText={(text) =>
                  setNewPipeline({ ...newPipeline, description: text })
                }
                style={styles.input}
              />

              {/* Project Selector */}
              <View>
                <Text
                  style={{
                    fontSize: 12,
                    marginBottom: 4,
                    color: colors.textSecondary,
                  }}
                >
                  {t("pipelines.targetProject", "Target Project")}</Text>
                <Menu
                  visible={projectMenuVisible}
                  onDismiss={() => setProjectMenuVisible(false)}
                  anchor={
                    <Button
                      mode="outlined"
                      icon="chevron-down"
                      contentStyle={{ flexDirection: "row-reverse" }}
                      onPress={() => setProjectMenuVisible(true)}
                      style={{ borderRadius: 4 }}
                    >
                      {projects.find((p) => p._id === newPipeline.projectId)
                        ?.name || "Select Project"}
                    </Button>
                  }
                >
                  {projects.map((p) => (
                    <Menu.Item
                      key={p._id}
                      onPress={() => {
                        setNewPipeline({ ...newPipeline, projectId: p._id });
                        setProjectMenuVisible(false);
                      }}
                      title={p.name}
                    />
                  ))}
                </Menu>
              </View>

              <Divider style={{ marginVertical: 8 }} />

              {/* Steps Builder */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "bold", fontSize: 16 }}>{t("pipelines.stages", "Stages")}</Text>
                <Button mode="text" icon="plus" onPress={addStep} compact>
                  {t("pipelines.addStage", "Add Stage")}</Button>
              </View>

              {newPipeline.steps.map((step, idx) => (
                <View key={idx} style={styles.stepBuilderCard}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ fontWeight: "bold", color: colors.primary }}>
                      {t("pipelines.stage", "Stage")}{idx + 1}
                    </Text>
                    {newPipeline.steps.length > 1 && (
                      <IconButton
                        icon="close"
                        size={16}
                        onPress={() => removeStep(idx)}
                        style={{ margin: 0 }}
                      />
                    )}
                  </View>

                  <TextInput
                    label="Stage Name"
                    mode="outlined"
                    value={step.name}
                    onChangeText={(text) => updateStep(idx, "name", text)}
                    style={[styles.input, { height: 40, marginBottom: 8 }]}
                    dense
                  />

                  {/* Step Type Selector */}
                  <Menu
                    visible={stepTypeMenuVisible === idx}
                    onDismiss={() => setStepTypeMenuVisible(null)}
                    anchor={
                      <Button
                        mode="outlined"
                        icon="chevron-down"
                        contentStyle={{ flexDirection: "row-reverse" }}
                        onPress={() => setStepTypeMenuVisible(idx)}
                        style={{ borderRadius: 4, marginBottom: 8 }}
                        labelStyle={{ fontSize: 12 }}
                        compact
                      >
                        {t("pipelines.type", "Type:")}{step.type.toUpperCase()}
                      </Button>
                    }
                  >
                    {["command", "test", "deploy", "approval", "notify"].map(
                      (type) => (
                        <Menu.Item
                          key={type}
                          onPress={() => {
                            updateStep(idx, "type", type);
                            setStepTypeMenuVisible(null);
                          }}
                          title={type.toUpperCase()}
                        />
                      ),
                    )}
                  </Menu>

                  {(step.type === "command" || step.type === "test") && (
                    <TextInput
                      label="Command"
                      mode="outlined"
                      value={step.command}
                      onChangeText={(text) => updateStep(idx, "command", text)}
                      style={[styles.input, { height: 40, marginBottom: 8 }]}
                      dense
                    />
                  )}

                  {/* On Failure behavior simplified to toggle for now */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      {t("pipelines.onFailure", "On Failure:")}</Text>
                    <Chip
                      compact
                      selected={step.onFailure === "stop"}
                      onPress={() => updateStep(idx, "onFailure", "stop")}
                    >
                      {t("pipelines.stop", "Stop")}</Chip>
                    <Chip
                      compact
                      selected={step.onFailure === "continue"}
                      onPress={() => updateStep(idx, "onFailure", "continue")}
                    >
                      {t("pipelines.continue", "Continue")}</Chip>
                  </View>
                </View>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setCreateDialog(false)}>{t("pipelines.cancel", "Cancel")}</Button>
            <Button onPress={handleCreate}>{t("pipelines.create", "Create")}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Run Results Modal */}
      <Portal>
        <Dialog
          visible={runResultsOpen}
          onDismiss={() => setRunResultsOpen(false)}
          style={styles.dialog}
        >
          <Dialog.Title>{t("pipelines.pipelineResult", "Pipeline Result")}</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView
              contentContainerStyle={{
                paddingVertical: 16,
                paddingHorizontal: 16,
              }}
            >
              {runResults ? (
                <View>
                  <View style={{ alignItems: "center", marginBottom: 16 }}>
                    <IconButton
                      icon={
                        runResults.success ? "check-circle" : "alert-circle"
                      }
                      iconColor={
                        runResults.success ? colors.success : colors.error
                      }
                      size={64}
                    />
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: "bold",
                        color: runResults.success
                          ? colors.success
                          : colors.error,
                      }}
                    >
                      {runResults.success
                        ? "Pipeline Succeeded"
                        : "Pipeline Failed"}
                    </Text>
                  </View>

                  {runResults.results?.map((res: any, idx: number) => (
                    <View
                      key={idx}
                      style={{
                        marginBottom: 12,
                        backgroundColor: isDark
                          ? "rgba(0,0,0,0.3)"
                          : "rgba(0,0,0,0.03)",
                        padding: 12,
                        borderRadius: 8,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ marginRight: 8 }}>
                          {res.status === "success" ? "✅" : "❌"}
                        </Text>
                        <Text style={{ fontWeight: "bold" }}>{res.step}</Text>
                      </View>
                      {res.output && (
                        <Text style={styles.codeOutput} numberOfLines={10}>
                          {res.output}
                        </Text>
                      )}
                      {res.error && (
                        <Text
                          style={{
                            color: colors.error,
                            fontSize: 11,
                            marginTop: 4,
                          }}
                        >
                          {res.error}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <ActivityIndicator style={{ marginVertical: 40 }} />
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setRunResultsOpen(false)}>{t("pipelines.close", "Close")}</Button>
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
    topBanner: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
      gap: 16,
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
      fontWeight: "bold",
    },
    emptySubtext: {
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 4,
      fontSize: 12,
      maxWidth: 250,
    },
    pipelineCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
    },
    pipelineHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    pipelineName: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.text,
    },
    pipelineDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    projectTag: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
      alignSelf: "flex-start",
      paddingRight: 8,
      borderRadius: 4,
    },
    stepsVisualizer: {
      marginVertical: 16,
      backgroundColor: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.02)",
      padding: 12,
      borderRadius: 8,
    },
    stepCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.surface,
    },
    stepConnector: {
      width: 24,
      height: 2,
      backgroundColor: colors.border,
    },
    pipelineActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
    },
    dialog: {
      backgroundColor: colors.surface,
      maxHeight: "85%",
    },
    dialogScrollArea: {
      paddingHorizontal: 16,
      borderColor: colors.border,
    },
    input: {
      backgroundColor: colors.background,
    },
    stepBuilderCard: {
      backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    codeOutput: {
      fontFamily: "monospace",
      fontSize: 10,
      color: colors.textSecondary,
      backgroundColor: "rgba(0,0,0,0.5)",
      padding: 8,
      borderRadius: 4,
    },
  });
