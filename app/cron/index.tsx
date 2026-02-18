import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  Text,
  Card,
  IconButton,
  FAB,
  Portal,
  Dialog,
  Button,
  TextInput,
  ActivityIndicator,
  SegmentedButtons,
  Divider,
  Menu,
  Switch,
  RadioButton,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { useServer } from "../../contexts/ServerContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../contexts/ThemeContext";
import CustomAlertDialog, {
  CustomAlertDialogRef,
} from "../../components/CustomAlertDialog";

interface CronJob {
  id: string; // generated uuid
  min: string;
  hour: string;
  dom: string;
  mon: string;
  dow: string;
  command: string;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export default function CronScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { selectedServer } = useServer();
  const dialogRef = useRef<CustomAlertDialogRef>(null);

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"visual" | "raw">("visual");

  // Data
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [rawLines, setRawLines] = useState<string[]>([]);
  const [cronContent, setCronContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");

  // Editor State
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);

  // Form Data
  const [formData, setFormData] = useState<CronJob>({
    id: "",
    min: "*",
    hour: "*",
    dom: "*",
    mon: "*",
    dow: "*",
    command: "",
  });

  // Simple Form State
  const [frequency, setFrequency] = useState("daily");
  const [simpleTime, setSimpleTime] = useState("00:00");
  const [simpleDayOfWeek, setSimpleDayOfWeek] = useState("1"); // 1=Mon
  const [simpleDayOfMonth, setSimpleDayOfMonth] = useState("1");
  const [simpleMinute, setSimpleMinute] = useState("0");

  useEffect(() => {
    if (selectedServer) {
      fetchCronJobs();
    }
  }, [selectedServer]);

  const fetchCronJobs = async () => {
    if (!selectedServer) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/cron/${selectedServer._id}`);
      const content = data.jobs || "";
      parseContent(content);
    } catch (err: any) {
      dialogRef.current?.show(
        "Error",
        err.response?.data?.message || "Failed to fetch cron jobs",
      );
    } finally {
      setLoading(false);
    }
  };

  const parseContent = (content: string) => {
    const lines = content.split("\n");
    const parsedJobs: CronJob[] = [];
    const others: string[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.includes("=")) {
        others.push(line);
        return;
      }

      const parts = trimmed.split(/\s+/);
      if (parts.length >= 6) {
        parsedJobs.push({
          id: generateId(),
          min: parts[0],
          hour: parts[1],
          dom: parts[2],
          mon: parts[3],
          dow: parts[4],
          command: parts.slice(5).join(" "),
        });
      } else {
        others.push(line);
      }
    });

    setJobs(parsedJobs);
    setRawLines(others);
  };

  const stringifyJobs = (currentJobs: CronJob[]) => {
    const jobLines = currentJobs.map(
      (j) => `${j.min} ${j.hour} ${j.dom} ${j.mon} ${j.dow} ${j.command}`,
    );

    const cleanRawLines = rawLines.filter((l) => l.trim() !== "");
    return [...cleanRawLines, ...jobLines].join("\n").trim() + "\n";
  };

  const saveCronJobs = async () => {
    if (!selectedServer) return;
    setLoading(true);
    const contentToSave = mode === "visual" ? stringifyJobs(jobs) : cronContent;

    try {
      await api.post(`/cron/${selectedServer._id}`, { jobs: contentToSave });
      setCronContent(contentToSave);
      if (mode === "visual") parseContent(contentToSave);
      dialogRef.current?.show(t("common.success"), t("cron.jobUpdated"));
    } catch (err: any) {
      dialogRef.current?.show(
        t("common.error"),
        err.response?.data?.message || t("cron.saveFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const detectFrequency = (job: CronJob) => {
    const { min, hour, dom, mon, dow } = job;
    if (
      min === "*" &&
      hour === "*" &&
      dom === "*" &&
      mon === "*" &&
      dow === "*"
    ) {
      setFrequency("everyMinute");
    } else if (hour === "*" && dom === "*" && mon === "*" && dow === "*") {
      setFrequency("hourly");
      setSimpleMinute(min === "*" ? "0" : min);
    } else if (dom === "*" && mon === "*" && dow === "*") {
      setFrequency("daily");
      setSimpleTime(`${hour.padStart(2, "0")}:${min.padStart(2, "0")}`);
    } else if (dom === "*" && mon === "*" && dow !== "*") {
      setFrequency("weekly");
      setSimpleTime(`${hour.padStart(2, "0")}:${min.padStart(2, "0")}`);
      setSimpleDayOfWeek(dow);
    } else if (dom !== "*" && mon === "*" && dow === "*") {
      setFrequency("monthly");
      setSimpleTime(`${hour.padStart(2, "0")}:${min.padStart(2, "0")}`);
      setSimpleDayOfMonth(dom);
    } else {
      setFrequency("custom");
    }
  };

  const updateFormDataFromSimple = (newFreq: string) => {
    const newData = { ...formData };
    switch (newFreq) {
      case "everyMinute":
        newData.min = "*";
        newData.hour = "*";
        newData.dom = "*";
        newData.mon = "*";
        newData.dow = "*";
        break;
      case "hourly":
        newData.min = simpleMinute;
        newData.hour = "*";
        newData.dom = "*";
        newData.mon = "*";
        newData.dow = "*";
        break;
      case "daily":
        const [dh, dm] = simpleTime.split(":");
        newData.min = parseInt(dm || "0").toString();
        newData.hour = parseInt(dh || "0").toString();
        newData.dom = "*";
        newData.mon = "*";
        newData.dow = "*";
        break;
      case "weekly":
        const [wh, wm] = simpleTime.split(":");
        newData.min = parseInt(wm || "0").toString();
        newData.hour = parseInt(wh || "0").toString();
        newData.dom = "*";
        newData.mon = "*";
        newData.dow = simpleDayOfWeek;
        break;
      case "monthly":
        const [mh, mm] = simpleTime.split(":");
        newData.min = parseInt(mm || "0").toString();
        newData.hour = parseInt(mh || "0").toString();
        newData.dom = simpleDayOfMonth;
        newData.mon = "*";
        newData.dow = "*";
        break;
    }
    setFormData(newData);
    setFrequency(newFreq);
  };

  const openDialog = (job?: CronJob) => {
    if (job) {
      setEditingJob(job);
      setFormData({ ...job });
      detectFrequency(job);
    } else {
      setEditingJob(null);
      setFormData({
        id: generateId(),
        min: "0",
        hour: "0",
        dom: "*",
        mon: "*",
        dow: "*",
        command: "",
      });
      setFrequency("daily");
      setSimpleTime("00:00");
      setSimpleDayOfWeek("1");
      setSimpleDayOfMonth("1");
      setSimpleMinute("0");
    }
    setDialogVisible(true);
  };

  const handleSaveJob = () => {
    if (frequency !== "custom") {
      updateFormDataFromSimple(frequency);
    }

    let finalJob = { ...formData };

    if (frequency !== "custom") {
      switch (frequency) {
        case "everyMinute":
          finalJob.min = "*";
          finalJob.hour = "*";
          finalJob.dom = "*";
          break;
        case "hourly":
          finalJob.min = simpleMinute;
          finalJob.hour = "*";
          break;
        case "daily":
          const [dh, dm] = simpleTime.split(":");
          finalJob.min = parseInt(dm || "0").toString();
          finalJob.hour = parseInt(dh || "0").toString();
          break;
        case "weekly":
          const [wh, wm] = simpleTime.split(":");
          finalJob.min = parseInt(wm || "0").toString();
          finalJob.hour = parseInt(wh || "0").toString();
          finalJob.dow = simpleDayOfWeek;
          break;
        case "monthly":
          const [mh, mm] = simpleTime.split(":");
          finalJob.min = parseInt(mm || "0").toString();
          finalJob.hour = parseInt(mh || "0").toString();
          finalJob.dom = simpleDayOfMonth;
          break;
      }
    }

    if (editingJob) {
      setJobs(jobs.map((j) => (j.id === editingJob.id ? finalJob : j)));
    } else {
      setJobs([...jobs, finalJob]);
    }
    setDialogVisible(false);
  };

  const deleteJob = (id: string) => {
    dialogRef.current?.confirm(
      t("common.delete"),
      t("common.confirmDelete"),
      () => setJobs(jobs.filter((j) => j.id !== id)),
      t("common.delete"),
      true,
    );
  };

  const describeCron = (job: CronJob) => {
    const { min, hour, dom, mon, dow } = job;
    if (
      min === "*" &&
      hour === "*" &&
      dom === "*" &&
      mon === "*" &&
      dow === "*"
    )
      return "Every minute";
    if (hour === "*" && dom === "*" && mon === "*" && dow === "*")
      return `Hourly at :${min.padStart(2, "0")}`;
    if (dom === "*" && mon === "*" && dow === "*")
      return `Daily at ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
    if (dom === "*" && mon === "*" && dow !== "*") {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      return `Weekly on ${days[parseInt(dow) || 0]} at ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
    }
    return `${min} ${hour} ${dom} ${mon} ${dow}`;
  };

  if (!selectedServer)
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.textSecondary }}>
          {t("servers.selectToBrowse")}
        </Text>
      </View>
    );

  return (
    <>
      <Stack.Screen
        options={{
          title: t("cron.title"),
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerRight: () => (
            <IconButton
              icon={mode === "visual" ? "code-tags" : "format-list-bulleted"}
              iconColor={colors.primary}
              onPress={() => {
                if (mode === "visual") setCronContent(stringifyJobs(jobs));
                else parseContent(cronContent);
                setMode(mode === "visual" ? "raw" : "visual");
              }}
            />
          ),
        }}
      />

      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        {loading && (
          <ActivityIndicator style={{ margin: 20 }} color={colors.primary} />
        )}

        {mode === "visual" ? (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {jobs.length === 0 && !loading && (
              <Text
                style={{
                  textAlign: "center",
                  color: colors.textSecondary,
                  marginTop: 20,
                }}
              >
                {t("cron.noJobs")}
              </Text>
            )}
            {jobs.map((job) => (
              <Card key={job.id} style={styles.card}>
                <Card.Content>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        variant="titleMedium"
                        style={{ fontWeight: "bold", color: colors.text }}
                      >
                        {describeCron(job)}
                      </Text>
                      <Text
                        variant="bodySmall"
                        style={{
                          fontFamily: "monospace",
                          color: colors.textSecondary,
                        }}
                      >
                        {job.min} {job.hour} {job.dom} {job.mon} {job.dow}
                      </Text>
                      <Text variant="bodyMedium" style={styles.commandText}>
                        {job.command}
                      </Text>
                    </View>
                    <View>
                      <IconButton
                        icon="pencil"
                        size={20}
                        iconColor={colors.primary}
                        onPress={() => openDialog(job)}
                      />
                      <IconButton
                        icon="delete"
                        size={20}
                        iconColor={colors.error}
                        onPress={() => deleteJob(job.id)}
                      />
                    </View>
                  </View>
                </Card.Content>
              </Card>
            ))}
            <Button
              mode="contained"
              onPress={saveCronJobs}
              disabled={loading}
              style={{ marginTop: 10 }}
              buttonColor={colors.primary}
            >
              {t("cron.saveChanges")}
            </Button>
          </ScrollView>
        ) : (
          <View style={{ flex: 1, padding: 16 }}>
            <TextInput
              mode="outlined"
              multiline
              value={cronContent}
              onChangeText={setCronContent}
              style={{ flex: 1, backgroundColor: colors.surface }}
              contentStyle={{
                fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                color: colors.text,
              }}
              textColor={colors.text}
            />
            <Button
              mode="contained"
              onPress={saveCronJobs}
              disabled={loading}
              style={{ marginTop: 10 }}
              buttonColor={colors.primary}
            >
              {t("cron.saveRaw")}
            </Button>
          </View>
        )}

        {mode === "visual" && (
          <FAB
            icon="plus"
            style={[styles.fab, { bottom: insets.bottom + 20 }]}
            color="white"
            onPress={() => openDialog()}
          />
        )}

        <Portal>
          <Dialog
            visible={dialogVisible}
            onDismiss={() => setDialogVisible(false)}
            style={{ maxHeight: "80%", backgroundColor: colors.surface }}
          >
            <Dialog.Title style={{ color: colors.text }}>
              {editingJob ? t("cron.editJob") : t("cron.addJob")}
            </Dialog.Title>
            <Dialog.ScrollArea>
              <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
                <Text
                  style={{
                    marginBottom: 8,
                    fontWeight: "bold",
                    color: colors.text,
                  }}
                >
                  {t("cron.frequency")}
                </Text>
                <RadioButton.Group
                  onValueChange={(val) => {
                    setFrequency(val);
                  }}
                  value={frequency}
                >
                  <View style={styles.radioRow}>
                    <RadioButton value="everyMinute" color={colors.primary} />
                    <Text style={{ color: colors.text }}>
                      {t("cron.everyMinute")}
                    </Text>
                  </View>
                  <View style={styles.radioRow}>
                    <RadioButton value="hourly" color={colors.primary} />
                    <Text style={{ color: colors.text }}>
                      {t("cron.hourly")}
                    </Text>
                  </View>
                  <View style={styles.radioRow}>
                    <RadioButton value="daily" color={colors.primary} />
                    <Text style={{ color: colors.text }}>
                      {t("cron.daily")}
                    </Text>
                  </View>
                  <View style={styles.radioRow}>
                    <RadioButton value="weekly" color={colors.primary} />
                    <Text style={{ color: colors.text }}>
                      {t("cron.weekly")}
                    </Text>
                  </View>
                  <View style={styles.radioRow}>
                    <RadioButton value="monthly" color={colors.primary} />
                    <Text style={{ color: colors.text }}>
                      {t("cron.monthly")}
                    </Text>
                  </View>
                  <View style={styles.radioRow}>
                    <RadioButton value="custom" color={colors.primary} />
                    <Text style={{ color: colors.text }}>
                      {t("cron.custom")}
                    </Text>
                  </View>
                </RadioButton.Group>

                <Divider style={{ marginVertical: 16 }} />

                {frequency !== "everyMinute" && frequency !== "custom" && (
                  <View style={{ marginBottom: 16 }}>
                    {frequency === "hourly" && (
                      <TextInput
                        label={t("cron.minute")}
                        value={simpleMinute}
                        onChangeText={setSimpleMinute}
                        keyboardType="numeric"
                        mode="outlined"
                        textColor={colors.text}
                        style={{ backgroundColor: colors.surface }}
                      />
                    )}
                    {(frequency === "daily" ||
                      frequency === "weekly" ||
                      frequency === "monthly") && (
                      <TextInput
                        label={t("cron.time")}
                        value={simpleTime}
                        onChangeText={setSimpleTime}
                        mode="outlined"
                        placeholder="00:00"
                        textColor={colors.text}
                        style={{ backgroundColor: colors.surface }}
                      />
                    )}
                    {frequency === "weekly" && (
                      <View style={{ marginTop: 10 }}>
                        <Text style={{ color: colors.text }}>
                          {t("cron.dayOfWeek")}
                        </Text>
                        <SegmentedButtons
                          value={simpleDayOfWeek}
                          onValueChange={setSimpleDayOfWeek}
                          buttons={[
                            { value: "1", label: "Mon" },
                            { value: "3", label: "Wed" },
                            { value: "5", label: "Fri" },
                            { value: "0", label: "Sun" },
                          ]}
                          style={{ marginTop: 5 }}
                          theme={{
                            colors: {
                              secondaryContainer: colors.primary,
                              onSecondaryContainer: "white",
                            },
                          }}
                        />
                        <TextInput
                          label={t("cron.dayOfWeek")}
                          value={simpleDayOfWeek}
                          onChangeText={setSimpleDayOfWeek}
                          keyboardType="numeric"
                          mode="outlined"
                          style={{
                            marginTop: 5,
                            backgroundColor: colors.surface,
                          }}
                          textColor={colors.text}
                        />
                      </View>
                    )}
                    {frequency === "monthly" && (
                      <TextInput
                        label={t("cron.dayOfMonth")}
                        value={simpleDayOfMonth}
                        onChangeText={setSimpleDayOfMonth}
                        keyboardType="numeric"
                        mode="outlined"
                        style={{
                          marginTop: 10,
                          backgroundColor: colors.surface,
                        }}
                        textColor={colors.text}
                      />
                    )}
                  </View>
                )}

                {frequency === "custom" && (
                  <View
                    style={{ flexDirection: "row", gap: 5, marginBottom: 16 }}
                  >
                    <TextInput
                      style={{ flex: 1, backgroundColor: colors.surface }}
                      label="Min"
                      value={formData.min}
                      onChangeText={(t) => setFormData({ ...formData, min: t })}
                      mode="outlined"
                      textColor={colors.text}
                    />
                    <TextInput
                      style={{ flex: 1, backgroundColor: colors.surface }}
                      label="Hr"
                      value={formData.hour}
                      onChangeText={(t) =>
                        setFormData({ ...formData, hour: t })
                      }
                      mode="outlined"
                      textColor={colors.text}
                    />
                    <TextInput
                      style={{ flex: 1, backgroundColor: colors.surface }}
                      label="Dom"
                      value={formData.dom}
                      onChangeText={(t) => setFormData({ ...formData, dom: t })}
                      mode="outlined"
                      textColor={colors.text}
                    />
                    <TextInput
                      style={{ flex: 1, backgroundColor: colors.surface }}
                      label="Mon"
                      value={formData.mon}
                      onChangeText={(t) => setFormData({ ...formData, mon: t })}
                      mode="outlined"
                      textColor={colors.text}
                    />
                    <TextInput
                      style={{ flex: 1, backgroundColor: colors.surface }}
                      label="Dow"
                      value={formData.dow}
                      onChangeText={(t) => setFormData({ ...formData, dow: t })}
                      mode="outlined"
                      textColor={colors.text}
                    />
                  </View>
                )}

                <TextInput
                  label={t("cron.command")}
                  value={formData.command}
                  onChangeText={(t) => setFormData({ ...formData, command: t })}
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                  style={{
                    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                    backgroundColor: colors.surface,
                  }}
                  textColor={colors.text}
                />
              </ScrollView>
            </Dialog.ScrollArea>
            <Dialog.Actions>
              <Button
                onPress={() => setDialogVisible(false)}
                textColor={colors.textSecondary}
              >
                {t("common.cancel")}
              </Button>
              <Button onPress={handleSaveJob} textColor={colors.primary}>
                {t("common.save")}
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
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    fab: {
      position: "absolute",
      margin: 16,
      right: 0,
      backgroundColor: colors.primary,
    },
    radioRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
    },
    card: {
      marginBottom: 16,
      backgroundColor: colors.card,
    },
    commandText: {
      marginTop: 8,
      fontFamily: "monospace",
      backgroundColor: colors.surfaceVariant,
      padding: 8,
      borderRadius: 4,
      color: colors.text,
      overflow: "hidden",
    },
  });
