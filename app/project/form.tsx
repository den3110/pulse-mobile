import { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  Switch,
  ActivityIndicator,
  IconButton,
  SegmentedButtons,
} from "react-native-paper";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { Colors, inputTheme } from "../../constants/theme";
import { useAppTheme } from "../../contexts/ThemeContext";
import * as Haptics from "expo-haptics";

export default function ProjectFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, inputTheme: themeInput } = useAppTheme();
  const Colors = colors;
  const inputTheme = themeInput;
  const styles = createStyles(colors);
  const isEditing = !!id;

  const [name, setName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [serverId, setServerId] = useState("");
  const [deployPath, setDeployPath] = useState("");
  const [buildCommand, setBuildCommand] = useState("");
  const [installCommand, setInstallCommand] = useState("npm install");
  const [startCommand, setStartCommand] = useState("npm start");
  const [stopCommand, setStopCommand] = useState("");
  const [autoDeploy, setAutoDeploy] = useState(false);
  const [processManager, setProcessManager] = useState<"nohup" | "pm2">(
    "nohup",
  );
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const serversRes = await api.get("/servers");
        setServers(serversRes.data);

        if (isEditing) {
          const res = await api.get(`/projects/${id}`);
          const p = res.data;
          setName(p.name);
          setRepoUrl(p.repoUrl);
          setBranch(p.branch);
          setServerId(p.server?._id || p.server);
          setDeployPath(p.deployPath);
          setBuildCommand(p.buildCommand || "");
          setInstallCommand(p.installCommand || "npm install");
          setStartCommand(p.startCommand || "npm start");
          setStopCommand(p.stopCommand || "");
          setAutoDeploy(p.autoDeploy || false);
          setProcessManager(p.processManager || "nohup");
          if (p.envVars) {
            setEnvVars(
              Object.entries(p.envVars).map(([key, value]) => ({
                key,
                value: String(value),
              })),
            );
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    };
    init();
  }, [id]);

  const detectBranch = async () => {
    if (!repoUrl.trim()) return;
    setDetecting(true);
    try {
      const res = await api.post("/projects/detect-branch", { repoUrl });
      setBranch(res.data.branch || "main");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("projects.detectBranchFailed"),
      );
    } finally {
      setDetecting(false);
    }
  };

  const addEnvVar = () => setEnvVars([...envVars, { key: "", value: "" }]);
  const removeEnvVar = (i: number) =>
    setEnvVars(envVars.filter((_, idx) => idx !== i));
  const updateEnvVar = (i: number, field: "key" | "value", val: string) => {
    const updated = [...envVars];
    updated[i][field] = val;
    setEnvVars(updated);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !repoUrl.trim() || !serverId || !deployPath.trim()) {
      Alert.alert(t("common.error"), t("projects.fillRequired"));
      return;
    }
    setLoading(true);
    try {
      const envObj: Record<string, string> = {};
      envVars.forEach((e) => {
        if (e.key.trim()) envObj[e.key.trim()] = e.value;
      });

      const payload = {
        name: name.trim(),
        repoUrl: repoUrl.trim(),
        branch,
        server: serverId,
        deployPath: deployPath.trim(),
        buildCommand,
        installCommand,
        startCommand,
        stopCommand,
        autoDeploy,
        processManager,
        envVars: envObj,
      };

      if (isEditing) {
        await api.put(`/projects/${id}`, payload);
      } else {
        await api.post("/projects", payload);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditing
            ? t("projects.editProject")
            : t("projects.addProject"),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            label={t("projects.name") + " *"}
            value={name}
            onChangeText={setName}
            mode="outlined"
            left={<TextInput.Icon icon="folder" />}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            textColor={Colors.text}
            theme={inputTheme}
          />

          <TextInput
            label={t("projects.repoUrl") + " *"}
            value={repoUrl}
            onChangeText={setRepoUrl}
            mode="outlined"
            autoCapitalize="none"
            left={<TextInput.Icon icon="git" />}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            textColor={Colors.text}
            theme={inputTheme}
          />

          <View style={styles.branchRow}>
            <TextInput
              label={t("projects.branch")}
              value={branch}
              onChangeText={setBranch}
              mode="outlined"
              autoCapitalize="none"
              left={<TextInput.Icon icon="source-branch" />}
              style={[styles.input, { flex: 1 }]}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              textColor={Colors.text}
              theme={inputTheme}
            />
            <Button
              mode="outlined"
              onPress={detectBranch}
              loading={detecting}
              compact
              style={styles.detectBtn}
              textColor={Colors.primary}
            >
              {t("common.detect") || "Detect"}
            </Button>
          </View>

          {/* Server picker */}
          <Text style={styles.label}>{t("projects.server")} *</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 8 }}
          >
            {servers.map((s) => (
              <Pressable
                key={s._id}
                onPress={() => setServerId(s._id)}
                style={[
                  styles.serverChip,
                  serverId === s._id && styles.serverChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.serverChipText,
                    serverId === s._id && { color: "#fff" },
                  ]}
                >
                  {s.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <TextInput
            label={t("projects.deployPath") + " *"}
            value={deployPath}
            onChangeText={setDeployPath}
            mode="outlined"
            autoCapitalize="none"
            left={<TextInput.Icon icon="folder-open" />}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            textColor={Colors.text}
            theme={inputTheme}
            placeholder="/var/www/my-app"
          />

          <TextInput
            label={t("projects.installCommand")}
            value={installCommand}
            onChangeText={setInstallCommand}
            mode="outlined"
            autoCapitalize="none"
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            textColor={Colors.text}
            theme={inputTheme}
          />
          <TextInput
            label={t("projects.buildCommand")}
            value={buildCommand}
            onChangeText={setBuildCommand}
            mode="outlined"
            autoCapitalize="none"
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            textColor={Colors.text}
            theme={inputTheme}
          />
          <TextInput
            label={t("projects.startCommand")}
            value={startCommand}
            onChangeText={setStartCommand}
            mode="outlined"
            autoCapitalize="none"
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            textColor={Colors.text}
            theme={inputTheme}
          />
          <TextInput
            label={t("projects.stopCommand")}
            value={stopCommand}
            onChangeText={setStopCommand}
            mode="outlined"
            autoCapitalize="none"
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            textColor={Colors.text}
            theme={inputTheme}
          />

          <View style={{ marginVertical: 8 }}>
            <Text style={styles.label}>Process Manager</Text>
            <SegmentedButtons
              value={processManager}
              onValueChange={(val) => setProcessManager(val as "nohup" | "pm2")}
              buttons={[
                {
                  value: "nohup",
                  label: "Nohup",
                  showSelectedCheck: true,
                },
                {
                  value: "pm2",
                  label: "PM2",
                  showSelectedCheck: true,
                },
              ]}
              style={{ marginTop: 8 }}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t("projects.autoDeploy")}</Text>
            <Switch
              value={autoDeploy}
              onValueChange={setAutoDeploy}
              color={Colors.primary}
            />
          </View>

          {/* Env vars */}
          <View style={styles.envHeader}>
            <Text style={styles.label}>{t("projects.envVars")}</Text>
            <IconButton
              icon="plus"
              iconColor={Colors.primary}
              size={20}
              onPress={addEnvVar}
            />
          </View>
          {envVars.map((env, i) => (
            <View key={i} style={styles.envRow}>
              <TextInput
                label={t("projects.envKey")}
                value={env.key}
                onChangeText={(v) => updateEnvVar(i, "key", v)}
                mode="outlined"
                autoCapitalize="none"
                style={[styles.input, { flex: 1 }]}
                outlineColor={Colors.border}
                activeOutlineColor={Colors.primary}
                textColor={Colors.text}
                theme={inputTheme}
                dense
              />
              <TextInput
                label={t("projects.envValue")}
                value={env.value}
                onChangeText={(v) => updateEnvVar(i, "value", v)}
                mode="outlined"
                autoCapitalize="none"
                style={[styles.input, { flex: 1 }]}
                outlineColor={Colors.border}
                activeOutlineColor={Colors.primary}
                textColor={Colors.text}
                theme={inputTheme}
                dense
              />
              <IconButton
                icon="close"
                iconColor={Colors.error}
                size={18}
                onPress={() => removeEnvVar(i)}
              />
            </View>
          ))}

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={styles.submitBtn}
            contentStyle={{ paddingVertical: 6 }}
            labelStyle={{ fontWeight: "700", fontSize: 16 }}
            buttonColor={Colors.primary}
          >
            {isEditing ? t("common.save") : t("projects.addProject")}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const createStyles = (Colors: any) =>
  StyleSheet.create({
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.background,
    },
    form: { padding: 20, gap: 12, paddingBottom: 40 },
    input: { backgroundColor: Colors.surface },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textSecondary,
      marginTop: 4,
    },
    branchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    detectBtn: { borderColor: Colors.primary, borderRadius: 10, marginTop: 6 },
    serverChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: Colors.surfaceVariant,
      marginRight: 8,
    },
    serverChipSelected: { backgroundColor: Colors.primary },
    serverChipText: { color: Colors.text, fontWeight: "600", fontSize: 13 },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    switchLabel: { fontSize: 15, fontWeight: "600", color: Colors.text },
    envHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 8,
    },
    envRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    submitBtn: { marginTop: 12, borderRadius: 12 },
  });
