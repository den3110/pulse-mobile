import { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Pressable,
  KeyboardAvoidingView,
} from "react-native";
import {
  Text,
  Card,
  Button,
  TextInput,
  Switch,
  ActivityIndicator,
  Divider,
  List,
  Dialog,
  Portal,
  Checkbox,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import { Colors, statusColor } from "../../constants/theme";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "../../services/i18n";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const {
    user,
    logout,
    biometricEnabled,
    biometricAvailable,
    enableBiometric,
    disableBiometric,
  } = useAuth();
  const router = useRouter();
  const { isDark, colors, inputTheme, toggleTheme: ctxToggle } = useAppTheme();

  // Biometric setup dialog
  const [showBioDialog, setShowBioDialog] = useState(false);
  const [bioEmail, setBioEmail] = useState("");
  const [bioPassword, setBioPassword] = useState("");
  const [enablingBio, setEnablingBio] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  const [settings, setSettings] = useState<any>(null);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [emailOnDeploy, setEmailOnDeploy] = useState(false);
  const [emailOnFailure, setEmailOnFailure] = useState(true);
  const [emailOnSuccess, setEmailOnSuccess] = useState(false);

  const [notifConfig, setNotifConfig] = useState({
    discord: { enabled: false, webhookUrl: "" },
    slack: { enabled: false, webhookUrl: "" },
    telegram: { enabled: false, botToken: "", chatId: "" },
    events: {
      deploymentStarted: true,
      deploymentSuccess: true,
      deploymentFailed: true,
      serverOffline: true,
      serverOnline: true,
    },
  });

  const [language, setLanguage] = useState(i18n.language || "vi");

  useEffect(() => {
    const init = async () => {
      try {
        const [settingsRes, sysRes, notifRes] = await Promise.all([
          api.get("/settings").catch(() => ({ data: null })),
          api.get("/settings/system-info").catch(() => ({ data: null })),
          api.get("/settings/notifications").catch(() => ({ data: null })),
        ]);
        if (settingsRes.data) {
          setSettings(settingsRes.data);
          setEmailOnDeploy(settingsRes.data.emailOnDeploy ?? false);
          setEmailOnFailure(settingsRes.data.emailOnFailure ?? true);
          setEmailOnSuccess(settingsRes.data.emailOnSuccess ?? false);
        }
        if (sysRes.data) setSystemInfo(sysRes.data);
        if (notifRes.data) setNotifConfig(notifRes.data);
      } catch {}
      setLoadingSettings(false);
    };
    init();
  }, []);

  const changePassword = async () => {
    if (!currentPw || !newPw) return;
    if (newPw !== confirmPw) {
      Alert.alert(t("common.error"), t("auth.passwordMismatch"));
      return;
    }
    if (newPw.length < 6) {
      Alert.alert(t("common.error"), t("auth.passwordTooShort"));
      return;
    }
    setChangingPw(true);
    try {
      await api.put("/auth/password", {
        currentPassword: currentPw,
        newPassword: newPw,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t("common.success") || "Success",
        t("settings.passwordChanged"),
      );
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    } finally {
      setChangingPw(false);
    }
  };

  const saveNotifications = async () => {
    try {
      await api.put("/settings", {
        emailOnDeploy,
        emailOnFailure,
        emailOnSuccess,
        ...settings, // Save other settings like pollingInterval, defaults
      });
      await api.put("/settings/notifications", notifConfig);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    }
  };

  const handleTestNotification = async (type: string) => {
    try {
      await api.post("/settings/notifications/test", { type });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("common.success"), "Test notification sent! 🔔");
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    }
  };

  const switchLanguage = async (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    await AsyncStorage.setItem("language", lang);
    Haptics.selectionAsync();
  };

  const handleToggleTheme = () => {
    ctxToggle();
    Haptics.selectionAsync();
  };

  const handleToggleBiometric = async () => {
    if (biometricEnabled) {
      Alert.alert(
        t("settings.disableBiometric"),
        t("settings.disableBiometricConfirm"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.confirm"),
            style: "destructive",
            onPress: async () => {
              await disableBiometric();
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            },
          },
        ],
      );
    } else {
      // Show dialog to enter password for verification
      setBioEmail(user?.email || "");
      setBioPassword("");
      setShowBioDialog(true);
    }
  };

  const confirmEnableBiometric = async () => {
    if (!bioEmail.trim() || !bioPassword.trim()) {
      Alert.alert(t("common.error"), t("settings.enterCredentials"));
      return;
    }
    setEnablingBio(true);
    try {
      await enableBiometric(bioEmail.trim(), bioPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowBioDialog(false);
      Alert.alert(
        t("common.success") || "Success",
        t("settings.biometricEnabled"),
      );
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.message || t("settings.biometricFailed"),
      );
    } finally {
      setEnablingBio(false);
    }
  };

  const clearHistory = () => {
    Alert.alert(t("settings.clearHistory"), t("settings.clearHistoryConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete("/settings/clear-history");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
              t("common.success") || "Success",
              t("settings.historyCleared"),
            );
          } catch (err: any) {
            Alert.alert(
              t("common.error"),
              err.response?.data?.message || t("common.failed"),
            );
          }
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert(t("settings.logout"), t("settings.logoutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.logout"),
        style: "destructive",
        onPress: () => logout(),
      },
    ]);
  };

  const Colors = colors; // alias for less diff
  const styles = createStyles(colors);
  const SectionIcon = ({ name, color }: { name: string; color?: string }) => (
    <MaterialCommunityIcons
      name={name as any}
      size={18}
      color={color || colors.primary}
      style={{ marginRight: 6 }}
    />
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile */}
        <Card style={[styles.card, { backgroundColor: colors.card }]}>
          <Card.Content>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <MaterialCommunityIcons
                  name="account"
                  size={32}
                  color={Colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.username}>{user?.username}</Text>
                <Text style={styles.email}>{user?.email}</Text>
                {user?.role && <Text style={styles.role}>{user.role}</Text>}
              </View>
            </View>
            {user?.role === "admin" && (
              <Button
                mode="outlined"
                onPress={() => router.push("/admin/users")}
                icon="account-group"
                textColor={Colors.primary}
                style={styles.adminBtn}
              >
                {t("settings.manageUsers")}
              </Button>
            )}
          </Card.Content>
        </Card>

        {/* Language */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionTitleRow}>
              <SectionIcon name="translate" />
              <Text style={styles.sectionTitle}>{t("settings.language")}</Text>
            </View>
            <View style={styles.langRow}>
              {[
                { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
                { code: "en", label: "English", flag: "🇬🇧" },
              ].map((l) => (
                <Button
                  key={l.code}
                  mode={language === l.code ? "contained" : "outlined"}
                  onPress={() => switchLanguage(l.code)}
                  buttonColor={language === l.code ? Colors.primary : undefined}
                  textColor={language === l.code ? "#fff" : Colors.text}
                  style={styles.langBtn}
                  compact
                >
                  {l.label}
                </Button>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Theme */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionTitleRow}>
              <SectionIcon name="palette-outline" />
              <Text style={styles.sectionTitle}>
                {t("settings.theme") || "Theme"}
              </Text>
            </View>
            <View style={styles.switchRow}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  flex: 1,
                }}
              >
                <MaterialCommunityIcons
                  name={isDark ? "weather-night" : "white-balance-sunny"}
                  size={22}
                  color={colors.primary}
                />
                <Text style={[styles.switchLabel, { color: colors.text }]}>
                  {isDark ? t("common.darkMode") : t("common.lightMode")}
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={handleToggleTheme}
                color={colors.primary}
              />
            </View>
            <Text style={styles.settingDesc}>{t("settings.themeDesc")}</Text>
          </Card.Content>
        </Card>

        {/* Biometric Security */}
        {biometricAvailable && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.sectionTitleRow}>
                <SectionIcon name="shield-lock-outline" />
                <Text style={styles.sectionTitle}>
                  {Platform.OS === "ios" ? "Face ID" : "Fingerprint"}
                </Text>
              </View>
              <Text style={styles.bioDescription}>
                {t("settings.biometricDescription")}
              </Text>
              <View style={styles.switchRow}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    flex: 1,
                  }}
                >
                  <MaterialCommunityIcons
                    name={
                      Platform.OS === "ios" ? "face-recognition" : "fingerprint"
                    }
                    size={24}
                    color={
                      biometricEnabled ? Colors.primary : Colors.textSecondary
                    }
                  />
                  <Text style={styles.switchLabel}>
                    {Platform.OS === "ios"
                      ? t("settings.enableFaceId")
                      : t("settings.enableFingerprint")}
                  </Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  color={Colors.primary}
                />
              </View>
              {biometricEnabled && (
                <View style={styles.bioActiveRow}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={16}
                    color={Colors.success}
                  />
                  <Text style={styles.bioStatus}>
                    {t("settings.biometricActive")}
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Biometric Password Dialog */}
        <Portal>
          <Dialog
            visible={showBioDialog}
            onDismiss={() => setShowBioDialog(false)}
            style={{ backgroundColor: Colors.card, borderRadius: 20 }}
          >
            <Dialog.Title style={{ color: Colors.text }}>
              {t("settings.setupBiometric")}
            </Dialog.Title>
            <Dialog.Content>
              <Text style={{ color: Colors.textSecondary, marginBottom: 14 }}>
                {t("settings.enterPasswordToEnable")}
              </Text>
              <TextInput
                label={t("auth.emailOrUsername")}
                value={bioEmail}
                onChangeText={setBioEmail}
                mode="outlined"
                autoCapitalize="none"
                style={styles.input}
                outlineColor={Colors.border}
                activeOutlineColor={Colors.primary}
                textColor={Colors.text}
                theme={inputTheme}
              />
              <TextInput
                label={t("auth.password")}
                value={bioPassword}
                onChangeText={setBioPassword}
                mode="outlined"
                secureTextEntry
                style={[styles.input, { marginTop: 8 }]}
                outlineColor={Colors.border}
                activeOutlineColor={Colors.primary}
                textColor={Colors.text}
                theme={inputTheme}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => setShowBioDialog(false)}
                textColor={Colors.textSecondary}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onPress={confirmEnableBiometric}
                loading={enablingBio}
                textColor={Colors.primary}
              >
                {t("common.confirm")}
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* Notifications */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionTitleRow}>
              <SectionIcon name="bell-outline" />
              <Text style={styles.sectionTitle}>
                {t("settings.notifications")}
              </Text>
            </View>
            {/* Discord */}
            <View style={styles.channelRow}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t("settings.discord")}</Text>
                <Switch
                  value={notifConfig.discord.enabled}
                  onValueChange={(v) =>
                    setNotifConfig({
                      ...notifConfig,
                      discord: { ...notifConfig.discord, enabled: v },
                    })
                  }
                  color={Colors.primary}
                />
              </View>
              {notifConfig.discord.enabled && (
                <TextInput
                  label={t("settings.webhookUrl")}
                  value={notifConfig.discord.webhookUrl}
                  onChangeText={(v) =>
                    setNotifConfig({
                      ...notifConfig,
                      discord: { ...notifConfig.discord, webhookUrl: v },
                    })
                  }
                  mode="outlined"
                  style={styles.inputSmall}
                  outlineColor={Colors.border}
                  activeOutlineColor={Colors.primary}
                  textColor={Colors.text}
                  theme={inputTheme}
                />
              )}
            </View>

            {/* Slack */}
            <View style={styles.channelRow}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t("settings.slack")}</Text>
                <Switch
                  value={notifConfig.slack.enabled}
                  onValueChange={(v) =>
                    setNotifConfig({
                      ...notifConfig,
                      slack: { ...notifConfig.slack, enabled: v },
                    })
                  }
                  color={Colors.primary}
                />
              </View>
              {notifConfig.slack.enabled && (
                <TextInput
                  label={t("settings.webhookUrl")}
                  value={notifConfig.slack.webhookUrl}
                  onChangeText={(v) =>
                    setNotifConfig({
                      ...notifConfig,
                      slack: { ...notifConfig.slack, webhookUrl: v },
                    })
                  }
                  mode="outlined"
                  style={styles.inputSmall}
                  outlineColor={Colors.border}
                  activeOutlineColor={Colors.primary}
                  textColor={Colors.text}
                  theme={inputTheme}
                />
              )}
            </View>

            {/* Telegram */}
            <View style={styles.channelRow}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t("settings.telegram")}</Text>
                <Switch
                  value={notifConfig.telegram.enabled}
                  onValueChange={(v) =>
                    setNotifConfig({
                      ...notifConfig,
                      telegram: { ...notifConfig.telegram, enabled: v },
                    })
                  }
                  color={Colors.primary}
                />
              </View>
              {notifConfig.telegram.enabled && (
                <View style={{ gap: 8 }}>
                  <TextInput
                    label={t("settings.botToken")}
                    value={notifConfig.telegram.botToken}
                    onChangeText={(v) =>
                      setNotifConfig({
                        ...notifConfig,
                        telegram: { ...notifConfig.telegram, botToken: v },
                      })
                    }
                    mode="outlined"
                    style={styles.inputSmall}
                    outlineColor={Colors.border}
                    activeOutlineColor={Colors.primary}
                    textColor={Colors.text}
                    theme={inputTheme}
                  />
                  <TextInput
                    label={t("settings.chatId")}
                    value={notifConfig.telegram.chatId}
                    onChangeText={(v) =>
                      setNotifConfig({
                        ...notifConfig,
                        telegram: { ...notifConfig.telegram, chatId: v },
                      })
                    }
                    mode="outlined"
                    style={styles.inputSmall}
                    outlineColor={Colors.border}
                    activeOutlineColor={Colors.primary}
                    textColor={Colors.text}
                    theme={inputTheme}
                  />
                  <Button
                    mode="outlined"
                    onPress={() => handleTestNotification("telegram")}
                    style={{ alignSelf: "flex-start", marginTop: 4 }}
                    compact
                  >
                    Test Telegram
                  </Button>
                </View>
              )}
            </View>

            <Divider style={{ marginVertical: 12 }} />

            <Text style={styles.subTitle}>{t("settings.triggerEvents")}</Text>
            <View style={styles.eventsContainer}>
              <Checkbox.Item
                label={t("settings.events.deployStart")}
                status={
                  notifConfig.events.deploymentStarted ? "checked" : "unchecked"
                }
                onPress={() =>
                  setNotifConfig({
                    ...notifConfig,
                    events: {
                      ...notifConfig.events,
                      deploymentStarted: !notifConfig.events.deploymentStarted,
                    },
                  })
                }
                color={Colors.primary}
                labelStyle={{ color: Colors.text, fontSize: 13 }}
                style={styles.checkboxItem}
              />
              <Checkbox.Item
                label={t("settings.events.deploySuccess")}
                status={
                  notifConfig.events.deploymentSuccess ? "checked" : "unchecked"
                }
                onPress={() =>
                  setNotifConfig({
                    ...notifConfig,
                    events: {
                      ...notifConfig.events,
                      deploymentSuccess: !notifConfig.events.deploymentSuccess,
                    },
                  })
                }
                color={Colors.primary}
                labelStyle={{ color: Colors.text, fontSize: 13 }}
                style={styles.checkboxItem}
              />
              <Checkbox.Item
                label={t("settings.events.deployFailed")}
                status={
                  notifConfig.events.deploymentFailed ? "checked" : "unchecked"
                }
                onPress={() =>
                  setNotifConfig({
                    ...notifConfig,
                    events: {
                      ...notifConfig.events,
                      deploymentFailed: !notifConfig.events.deploymentFailed,
                    },
                  })
                }
                color={Colors.primary}
                labelStyle={{ color: Colors.text, fontSize: 13 }}
                style={styles.checkboxItem}
              />
              <Checkbox.Item
                label={t("settings.events.serverOffline")}
                status={
                  notifConfig.events.serverOffline ? "checked" : "unchecked"
                }
                onPress={() =>
                  setNotifConfig({
                    ...notifConfig,
                    events: {
                      ...notifConfig.events,
                      serverOffline: !notifConfig.events.serverOffline,
                    },
                  })
                }
                color={Colors.primary}
                labelStyle={{ color: Colors.text, fontSize: 13 }}
                style={styles.checkboxItem}
              />
              <Checkbox.Item
                label={t("settings.events.serverOnline")}
                status={
                  notifConfig.events.serverOnline ? "checked" : "unchecked"
                }
                onPress={() =>
                  setNotifConfig({
                    ...notifConfig,
                    events: {
                      ...notifConfig.events,
                      serverOnline: !notifConfig.events.serverOnline,
                    },
                  })
                }
                color={Colors.primary}
                labelStyle={{ color: Colors.text, fontSize: 13 }}
                style={styles.checkboxItem}
              />
            </View>

            <Divider style={{ marginVertical: 12 }} />

            <Text style={styles.subTitle}>{t("settings.gitPolling")}</Text>
            <View style={styles.channelRow}>
              <Text style={styles.switchLabel}>
                {t("settings.pollingInterval")}
              </Text>
              <TextInput
                value={String(settings?.pollingInterval || "0")}
                onChangeText={(v) =>
                  setSettings({ ...settings, pollingInterval: Number(v) })
                }
                mode="outlined"
                keyboardType="numeric"
                style={styles.inputSmall}
                outlineColor={Colors.border}
                activeOutlineColor={Colors.primary}
                textColor={Colors.text}
                theme={inputTheme}
                right={<TextInput.Affix text="min" />}
              />
            </View>

            <Divider style={{ marginVertical: 12 }} />

            <Text style={styles.subTitle}>
              {t("settings.deploymentDefaults")}
            </Text>
            <TextInput
              label={t("settings.defaultInstallCommand")}
              value={settings?.defaultInstallCommand || ""}
              onChangeText={(v) =>
                setSettings({ ...settings, defaultInstallCommand: v })
              }
              mode="outlined"
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              textColor={Colors.text}
              theme={inputTheme}
            />
            <TextInput
              label={t("settings.defaultBuildCommand")}
              value={settings?.defaultBuildCommand || ""}
              onChangeText={(v) =>
                setSettings({ ...settings, defaultBuildCommand: v })
              }
              mode="outlined"
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              textColor={Colors.text}
              theme={inputTheme}
            />
            <TextInput
              label={t("settings.defaultStartCommand")}
              value={settings?.defaultStartCommand || ""}
              onChangeText={(v) =>
                setSettings({ ...settings, defaultStartCommand: v })
              }
              mode="outlined"
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              textColor={Colors.text}
              theme={inputTheme}
            />

            <Divider style={{ marginVertical: 12 }} />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                {t("settings.emailOnDeploy")}
              </Text>
              <Switch
                value={emailOnDeploy}
                onValueChange={setEmailOnDeploy}
                color={Colors.primary}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                {t("settings.emailOnFailure")}
              </Text>
              <Switch
                value={emailOnFailure}
                onValueChange={setEmailOnFailure}
                color={Colors.primary}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                {t("settings.emailOnSuccess")}
              </Text>
              <Switch
                value={emailOnSuccess}
                onValueChange={setEmailOnSuccess}
                color={Colors.primary}
              />
            </View>
            <Button
              mode="contained"
              onPress={saveNotifications}
              compact
              buttonColor={Colors.primary}
              style={{ marginTop: 8, borderRadius: 10 }}
            >
              {t("common.save")}
            </Button>
          </Card.Content>
        </Card>

        {/* Change Password */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionTitleRow}>
              <SectionIcon name="key-variant" />
              <Text style={styles.sectionTitle}>
                {t("settings.changePassword")}
              </Text>
            </View>
            <TextInput
              label={t("settings.currentPassword")}
              value={currentPw}
              onChangeText={setCurrentPw}
              mode="outlined"
              secureTextEntry
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              textColor={Colors.text}
              theme={inputTheme}
            />
            <TextInput
              label={t("settings.newPassword")}
              value={newPw}
              onChangeText={setNewPw}
              mode="outlined"
              secureTextEntry
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              textColor={Colors.text}
              theme={inputTheme}
            />
            <TextInput
              label={t("settings.confirmPassword")}
              value={confirmPw}
              onChangeText={setConfirmPw}
              mode="outlined"
              secureTextEntry
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              textColor={Colors.text}
              theme={inputTheme}
            />
            <Button
              mode="contained"
              onPress={changePassword}
              loading={changingPw}
              disabled={changingPw || !currentPw || !newPw}
              buttonColor={Colors.primary}
              style={{ marginTop: 8, borderRadius: 10 }}
            >
              {t("settings.changePassword")}
            </Button>
          </Card.Content>
        </Card>

        {/* System Info */}
        {systemInfo && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.sectionTitleRow}>
                <SectionIcon name="monitor" />
                <Text style={styles.sectionTitle}>
                  {t("settings.systemInfo")}
                </Text>
              </View>
              {Object.entries(systemInfo).map(([key, value]) => {
                // Flatten nested objects (e.g. memory: {used, total, percent})
                if (
                  value &&
                  typeof value === "object" &&
                  !Array.isArray(value)
                ) {
                  return Object.entries(value as Record<string, unknown>).map(
                    ([subKey, subVal]) => (
                      <View key={`${key}-${subKey}`} style={styles.infoRow}>
                        <Text style={styles.infoLabel}>
                          {key} ({subKey})
                        </Text>
                        <Text style={styles.infoValue} numberOfLines={1}>
                          {String(subVal ?? "—")}
                        </Text>
                      </View>
                    ),
                  );
                }
                return (
                  <View key={key} style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{key}</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>
                      {String(value ?? "—")}
                    </Text>
                  </View>
                );
              })}
            </Card.Content>
          </Card>
        )}

        {/* Danger Zone */}
        <Card
          style={[styles.card, { borderColor: Colors.error, borderWidth: 0.5 }]}
        >
          <Card.Content>
            <View style={styles.sectionTitleRow}>
              <SectionIcon name="alert-outline" color={Colors.error} />
              <Text style={[styles.sectionTitle, { color: Colors.error }]}>
                {t("settings.dangerZone")}
              </Text>
            </View>
            <Button
              mode="outlined"
              onPress={clearHistory}
              icon="delete-sweep"
              textColor={Colors.error}
              style={{
                borderColor: Colors.error,
                borderRadius: 10,
                marginBottom: 10,
              }}
            >
              {t("settings.clearHistory")}
            </Button>
            <Button
              mode="contained"
              onPress={handleLogout}
              icon="logout"
              buttonColor={Colors.error}
              style={{ borderRadius: 10 }}
            >
              {t("settings.logout")}
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (Colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    card: {
      marginHorizontal: 12,
      marginTop: 12,
      backgroundColor: Colors.card,
      borderRadius: 14,
    },
    profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: Colors.surfaceVariant,
      alignItems: "center",
      justifyContent: "center",
    },
    username: { fontSize: 18, fontWeight: "800", color: Colors.text },
    email: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
    role: {
      fontSize: 12,
      color: Colors.primary,
      fontWeight: "600",
      marginTop: 2,
    },
    adminBtn: { marginTop: 14, borderColor: Colors.primary, borderRadius: 10 },
    sectionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: Colors.text,
    },
    langRow: { flexDirection: "row", gap: 10 },
    langBtn: { flex: 1, borderRadius: 10 },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    switchLabel: { fontSize: 14, color: Colors.text },
    bioDescription: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginBottom: 12,
      lineHeight: 19,
    },
    bioActiveRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
    },
    bioStatus: {
      fontSize: 13,
      color: Colors.success,
      fontWeight: "600",
    },
    settingDesc: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 8,
      lineHeight: 17,
    },
    input: { backgroundColor: Colors.surface, marginBottom: 8 },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: Colors.border,
    },
    infoLabel: {
      fontSize: 13,
      color: Colors.textSecondary,
      textTransform: "capitalize",
    },
    infoValue: {
      fontSize: 13,
      color: Colors.text,
      fontWeight: "600",
      maxWidth: "60%",
    },
    channelRow: {
      marginBottom: 12,
    },
    inputSmall: {
      backgroundColor: Colors.surface,
      marginBottom: 8,
      height: 40,
    },
    subTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.text,
      marginBottom: 8,
    },
    eventsContainer: {
      marginLeft: -8, // Offset checkbox padding
    },
    checkboxItem: {
      paddingVertical: 4,
    },
  });
