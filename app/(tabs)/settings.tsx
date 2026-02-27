import { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Pressable,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import {
  Text,
  Button,
  Card,
  Switch,
  TextInput,
  Divider,
  Dialog,
  Portal,
  ActivityIndicator,
  Checkbox,
  List,
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
  const {
    isDark,
    colors,
    inputTheme,
    toggleTheme: ctxToggle,
    primaryColor,
    setPrimaryColor,
  } = useAppTheme();

  const PRESET_COLORS = [
    "#6366f1", // Indigo (Default)
    "#10b981", // Emerald
    "#f43f5e", // Rose
    "#f59e0b", // Amber
    "#3b82f6", // Blue
    "#8b5cf6", // Violet
  ];

  // 2FA state
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [showDisable2FADialog, setShowDisable2FADialog] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorSecret, setTwoFactorSecret] = useState("");
  const [twoFactorQrCode, setTwoFactorQrCode] = useState("");
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState("");

  // GitHub state
  const [confirmGithubDisconnect, setConfirmGithubDisconnect] = useState(false);

  // S3 state
  const [s3DialogOpen, setS3DialogOpen] = useState(false);

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

  // Account deletion
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Danger zone clear history
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearDays, setClearDays] = useState(30);

  const [emailOnDeploy, setEmailOnDeploy] = useState(false);
  const [emailOnFailure, setEmailOnFailure] = useState(true);
  const [emailOnSuccess, setEmailOnSuccess] = useState(false);

  const [pushOnDeploy, setPushOnDeploy] = useState(false);
  const [pushOnFailure, setPushOnFailure] = useState(true);
  const [pushOnSuccess, setPushOnSuccess] = useState(false);

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
          setEmailOnDeploy(
            settingsRes.data.emailOnDeploy !== undefined
              ? settingsRes.data.emailOnDeploy === "true" ||
                  settingsRes.data.emailOnDeploy === true
              : false,
          );
          setEmailOnFailure(
            settingsRes.data.emailOnFailure !== undefined
              ? settingsRes.data.emailOnFailure === "true" ||
                  settingsRes.data.emailOnFailure === true
              : true,
          );
          setEmailOnSuccess(
            settingsRes.data.emailOnSuccess !== undefined
              ? settingsRes.data.emailOnSuccess === "true" ||
                  settingsRes.data.emailOnSuccess === true
              : false,
          );
          setPushOnDeploy(
            settingsRes.data.pushOnDeploy !== undefined
              ? settingsRes.data.pushOnDeploy === "true" ||
                  settingsRes.data.pushOnDeploy === true
              : false,
          );
          setPushOnFailure(
            settingsRes.data.pushOnFailure !== undefined
              ? settingsRes.data.pushOnFailure === "true" ||
                  settingsRes.data.pushOnFailure === true
              : true,
          );
          setPushOnSuccess(
            settingsRes.data.pushOnSuccess !== undefined
              ? settingsRes.data.pushOnSuccess === "true" ||
                  settingsRes.data.pushOnSuccess === true
              : false,
          );
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
        pushOnDeploy,
        pushOnFailure,
        pushOnSuccess,
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
    setConfirmClear(true);
  };

  const handleClearHistory = async () => {
    try {
      await api.delete(`/settings/clear-history?days=${clearDays}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t("common.success") || "Success",
        t("settings.historyCleared"),
      );
      setConfirmClear(false);
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccountPassword) {
      Alert.alert(
        t("common.error"),
        t("auth.passwordRequired", "Password is required"),
      );
      return;
    }
    setDeletingAccount(true);
    try {
      await api.delete("/auth/account", {
        data: { password: deleteAccountPassword },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfirmDeleteAccount(false);
      logout();
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    } finally {
      setDeletingAccount(false);
    }
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

  const start2FASetup = async () => {
    try {
      setTwoFactorLoading(true);
      const res = await api.post("/auth/2fa/generate");
      setTwoFactorSecret(res.data.secret);
      setTwoFactorQrCode(res.data.qrCodeUrl);
      setShow2FADialog(true);
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const submitVerifyAndEnable2FA = async () => {
    if (twoFactorCode.length < 6) return;
    try {
      setTwoFactorLoading(true);
      await api.post("/auth/2fa/verify", {
        token: twoFactorCode,
        secret: twoFactorSecret, // Initial verification needs the secret
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t("common.success"),
        t("settings.twoFactorEnabled", "2FA Enabled"),
      );
      setShow2FADialog(false);
      setTwoFactorCode("");

      // Update local settings state
      setSettings({ ...settings, twoFactorEnabled: true });
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const submitDisable2FA = async () => {
    if (!disable2FAPassword) return;
    try {
      setTwoFactorLoading(true);
      await api.post("/auth/2fa/disable", {
        password: disable2FAPassword,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t("common.success"),
        t("settings.twoFactorDisabled", "2FA Disabled"),
      );
      setShowDisable2FADialog(false);
      setDisable2FAPassword("");

      // Update local settings
      setSettings({ ...settings, twoFactorEnabled: false });
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleGithubDisconnect = async () => {
    try {
      await api.delete("/auth/github/disconnect");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfirmGithubDisconnect(false);
      // Reload user or auth state if it stores Github connection

      Alert.alert(
        t("common.success"),
        t("settings.githubDisconnected", "GitHub Disconnected"),
      );
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    }
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

            <Divider style={{ marginVertical: 12 }} />

            <View style={styles.sectionTitleRow}>
              <SectionIcon name="palette" />
              <Text style={styles.sectionTitle}>
                {t("settings.primaryColor") || "Primary Color"}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 12,
                marginTop: 8,
              }}
            >
              {PRESET_COLORS.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => {
                    setPrimaryColor(color);
                    Haptics.selectionAsync();
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: color,
                    justifyContent: "center",
                    alignItems: "center",
                    borderWidth: primaryColor === color ? 2 : 0,
                    borderColor: colors.text,
                  }}
                >
                  {primaryColor === color && (
                    <MaterialCommunityIcons
                      name="check"
                      size={20}
                      color="#fff"
                    />
                  )}
                </Pressable>
              ))}
            </View>
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

        {/* Two-Factor Authentication (2FA) */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionTitleRow}>
              <SectionIcon name="two-factor-authentication" />
              <Text style={styles.sectionTitle}>
                {t("settings.twoFactor", "Two-Factor Authentication")}
              </Text>
            </View>
            <Text style={styles.settingDesc}>
              {t(
                "settings.twoFactorDesc",
                "Protect your account with an extra layer of security using Google Authenticator or Authy.",
              )}
            </Text>

            <View style={{ marginTop: 12 }}>
              {settings?.twoFactorEnabled ? (
                <View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 12,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="shield-check"
                      size={18}
                      color={Colors.success}
                    />
                    <Text style={{ color: Colors.success, fontWeight: "600" }}>
                      {t("settings.twoFactorEnabled", "2FA is Enabled")}
                    </Text>
                  </View>
                  <Button
                    mode="outlined"
                    textColor={Colors.error}
                    onPress={() => setShowDisable2FADialog(true)}
                    style={{ borderColor: Colors.error, borderRadius: 10 }}
                  >
                    {t("settings.disable2fa", "Disable 2FA")}
                  </Button>
                </View>
              ) : (
                <Button
                  mode="contained"
                  buttonColor={Colors.primary}
                  onPress={start2FASetup}
                  loading={twoFactorLoading}
                  style={{ borderRadius: 10 }}
                >
                  {t("settings.setup2fa", "Setup 2FA")}
                </Button>
              )}
            </View>
          </Card.Content>
        </Card>

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
          </Card.Content>
        </Card>

        {/* Email Notifications */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionTitleRow}>
              <SectionIcon name="email-outline" />
              <Text style={styles.sectionTitle}>
                {t("settings.emailNotifications") || "Email Notifications"}
              </Text>
            </View>
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

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionTitleRow}>
              <SectionIcon name="cellphone-message" />
              <Text style={styles.sectionTitle}>
                {t("settings.pushNotifications") || "Push Notifications"}
              </Text>
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                {t("settings.pushOnDeploy")}
              </Text>
              <Switch
                value={pushOnDeploy}
                onValueChange={setPushOnDeploy}
                color={Colors.primary}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                {t("settings.pushOnFailure")}
              </Text>
              <Switch
                value={pushOnFailure}
                onValueChange={setPushOnFailure}
                color={Colors.primary}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                {t("settings.pushOnSuccess")}
              </Text>
              <Switch
                value={pushOnSuccess}
                onValueChange={setPushOnSuccess}
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

        {/* Git Polling */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionTitleRow}>
              <SectionIcon name="git" />
              <Text style={styles.sectionTitle}>
                {t("settings.gitPolling")}
              </Text>
            </View>
            <Text style={styles.settingDesc}>{t("settings.pollingDesc")}</Text>
            <View style={[styles.channelRow, { marginTop: 12 }]}>
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

        {/* Webhook Information */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionTitleRow}>
              <SectionIcon name="webhook" />
              <Text style={styles.sectionTitle}>
                {t("settings.webhookIncoming") || "Incoming Webhook"}
              </Text>
            </View>
            <Text style={styles.settingDesc}>
              {t("settings.webhookDesc") ||
                "Configure this URL in your Git provider to trigger deployments automatically."}
            </Text>

            <View
              style={{
                backgroundColor: isDark ? "#161b22" : "#f6f8fa",
                padding: 12,
                borderRadius: 8,
                marginTop: 12,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text
                style={{
                  fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                  fontSize: 12,
                  color: isDark ? "#c9d1d9" : "#24292e",
                }}
              >
                POST {process.env.EXPO_PUBLIC_API_URL?.replace("/api", "")}
                /api/webhook/{"<projectId>"}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Deployment Defaults */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionTitleRow}>
              <SectionIcon name="console" />
              <Text style={styles.sectionTitle}>
                {t("settings.deploymentDefaults")}
              </Text>
            </View>
            <Text style={[styles.settingDesc, { marginBottom: 12 }]}>
              {t("settings.deploymentDefaultsDesc") ||
                "Default commands used when creating new projects."}
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

        {/* GitHub Integration */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionTitleRow}>
              <SectionIcon name="github" />
              <Text style={styles.sectionTitle}>
                {t("settings.connectedAccounts", "Connected Accounts")}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 8,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <MaterialCommunityIcons
                  name="github"
                  size={24}
                  color={Colors.text}
                />
                <View>
                  <Text
                    style={{
                      color: Colors.text,
                      fontWeight: "600",
                      fontSize: 16,
                    }}
                  >
                    GitHub
                  </Text>
                  {user?.githubUsername ? (
                    <Text style={{ color: Colors.success, fontSize: 13 }}>
                      {t("settings.connected", "Connected")} (
                      {user.githubUsername})
                    </Text>
                  ) : (
                    <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>
                      {t("settings.notConnected", "Not connected")}
                    </Text>
                  )}
                </View>
              </View>
              {user?.githubUsername ? (
                <Button
                  mode="outlined"
                  textColor={Colors.error}
                  onPress={() => setConfirmGithubDisconnect(true)}
                  style={{ borderColor: Colors.error, borderRadius: 8 }}
                  compact
                >
                  {t("common.disconnect", "Disconnect")}
                </Button>
              ) : (
                <Button
                  mode="contained"
                  buttonColor="#333"
                  onPress={() => {
                    /* Navigate or open OAuth url */
                    Alert.alert(
                      "Info",
                      "Connecting GitHub from mobile requires a browser redirect.",
                    );
                  }}
                  style={{ borderRadius: 8 }}
                  compact
                >
                  {t("common.connect", "Connect")}
                </Button>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* S3 Storage Settings */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionTitleRow}>
              <SectionIcon name="cloud-upload" />
              <Text style={styles.sectionTitle}>
                {t("settings.s3Backup", "Remote Backup Storage (S3)")}
              </Text>
            </View>
            <Text style={styles.settingDesc}>
              {t(
                "settings.s3BackupDesc",
                "Configure an S3-compatible service (AWS, Cloudflare R2, MinIO) to automatically upload database backups.",
              )}
            </Text>

            <View style={[styles.switchRow, { marginTop: 12 }]}>
              <Text style={[styles.switchLabel, { fontWeight: "600" }]}>
                {t("settings.enableS3", "Enable S3 Automation")}
              </Text>
              <Switch
                value={settings?.s3Storage?.enabled || false}
                onValueChange={(checked) =>
                  setSettings({
                    ...settings,
                    s3Storage: {
                      ...(settings?.s3Storage || {
                        accessKeyId: "",
                        secretAccessKey: "",
                        endpoint: "",
                        region: "",
                        bucketName: "",
                      }),
                      enabled: checked,
                    },
                  })
                }
                color={Colors.primary}
              />
            </View>

            {settings?.s3Storage?.enabled && (
              <Button
                mode="outlined"
                onPress={() => setS3DialogOpen(true)}
                icon="cog"
                textColor={Colors.primary}
                style={{
                  borderColor: Colors.primary,
                  borderRadius: 10,
                  marginTop: 8,
                }}
              >
                {t("settings.configureS3Credentials", "Configure Credentials")}
              </Button>
            )}
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
              onPress={() => setConfirmDeleteAccount(true)}
              icon="account-cancel"
              buttonColor={Colors.error}
              style={{ borderRadius: 10, marginBottom: 10 }}
            >
              {t("settings.deleteAccount", "Delete Account")}
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

        {/* --- DIALOGS --- */}
        <Portal>
          {/* Biometric Password Dialog */}
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

          {/* Setup 2FA Dialog */}
          <Dialog
            visible={show2FADialog}
            onDismiss={() => setShow2FADialog(false)}
            style={{ backgroundColor: Colors.card, borderRadius: 20 }}
          >
            <Dialog.Title style={{ color: Colors.text }}>
              {t("auth.twoFactorAuth", "Setup 2FA")}
            </Dialog.Title>
            <Dialog.Content>
              <ScrollView>
                <Text style={{ color: Colors.textSecondary, marginBottom: 14 }}>
                  {t(
                    "auth.scanQrCode",
                    "Scan this QR code with your authenticator app:",
                  )}
                </Text>
                {twoFactorQrCode ? (
                  <View style={{ alignItems: "center", marginVertical: 16 }}>
                    <Image
                      source={{ uri: twoFactorQrCode }}
                      style={{
                        width: 200,
                        height: 200,
                        marginBottom: 16,
                        backgroundColor: "white",
                        borderRadius: 10,
                      }}
                    />
                    <Text
                      style={{
                        textAlign: "center",
                        color: Colors.primary,
                        fontFamily:
                          Platform.OS === "ios" ? "Menlo" : "monospace",
                        fontSize: 16,
                        backgroundColor: Colors.surface,
                        padding: 8,
                        borderRadius: 8,
                        marginBottom: 10,
                        letterSpacing: 2,
                      }}
                    >
                      {twoFactorSecret}
                    </Text>
                    <Text
                      style={{
                        color: Colors.textSecondary,
                        fontSize: 12,
                        textAlign: "center",
                      }}
                    >
                      {t(
                        "auth.enterCodeManual",
                        "Or enter the secret code above manually into your app.",
                      )}
                    </Text>
                  </View>
                ) : (
                  <ActivityIndicator size="small" color={Colors.primary} />
                )}

                <TextInput
                  label={t("auth.twoFactorCode", "6-digit Code")}
                  value={twoFactorCode}
                  onChangeText={setTwoFactorCode}
                  mode="outlined"
                  keyboardType="numeric"
                  maxLength={6}
                  style={styles.input}
                  outlineColor={Colors.border}
                  activeOutlineColor={Colors.primary}
                  textColor={Colors.text}
                  theme={inputTheme}
                />
              </ScrollView>
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => setShow2FADialog(false)}
                textColor={Colors.textSecondary}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onPress={submitVerifyAndEnable2FA}
                loading={twoFactorLoading}
                disabled={twoFactorCode.length < 6 || twoFactorLoading}
                textColor={Colors.primary}
              >
                {t("settings.verifyAndEnable", "Verify & Enable")}
              </Button>
            </Dialog.Actions>
          </Dialog>

          {/* Disable 2FA Dialog */}
          <Dialog
            visible={showDisable2FADialog}
            onDismiss={() => {
              setShowDisable2FADialog(false);
              setDisable2FAPassword("");
            }}
            style={{ backgroundColor: Colors.card, borderRadius: 20 }}
          >
            <Dialog.Title style={{ color: Colors.text }}>
              {t("settings.disable2fa", "Disable 2FA")}
            </Dialog.Title>
            <Dialog.Content>
              <Text style={{ color: Colors.textSecondary, marginBottom: 14 }}>
                {t(
                  "settings.enterPasswordToDisable",
                  "Enter your password to disable 2FA.",
                )}
              </Text>
              <TextInput
                label={t("auth.password")}
                value={disable2FAPassword}
                onChangeText={setDisable2FAPassword}
                mode="outlined"
                secureTextEntry
                style={styles.input}
                outlineColor={Colors.border}
                activeOutlineColor={Colors.primary}
                textColor={Colors.text}
                theme={inputTheme}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => {
                  setShowDisable2FADialog(false);
                  setDisable2FAPassword("");
                }}
                textColor={Colors.textSecondary}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onPress={submitDisable2FA}
                loading={twoFactorLoading}
                disabled={!disable2FAPassword || twoFactorLoading}
                textColor={Colors.error}
              >
                {t("settings.confirmDisable", "Disable")}
              </Button>
            </Dialog.Actions>
          </Dialog>

          {/* S3 Configuration Dialog */}
          <Dialog
            visible={s3DialogOpen}
            onDismiss={() => setS3DialogOpen(false)}
            style={{ backgroundColor: Colors.card, borderRadius: 20 }}
          >
            <Dialog.Title style={{ color: Colors.text }}>
              {t("settings.s3Backup", "S3 Storage Settings")}
            </Dialog.Title>
            <Dialog.Content>
              <ScrollView style={{ maxHeight: 300 }}>
                <TextInput
                  label="Access Key ID"
                  value={settings?.s3Storage?.accessKeyId || ""}
                  onChangeText={(v) =>
                    setSettings({
                      ...settings,
                      s3Storage: { ...settings?.s3Storage, accessKeyId: v },
                    })
                  }
                  mode="outlined"
                  style={styles.input}
                  theme={inputTheme}
                  textColor={Colors.text}
                />
                <TextInput
                  label="Secret Access Key"
                  value={settings?.s3Storage?.secretAccessKey || ""}
                  onChangeText={(v) =>
                    setSettings({
                      ...settings,
                      s3Storage: { ...settings?.s3Storage, secretAccessKey: v },
                    })
                  }
                  mode="outlined"
                  secureTextEntry
                  style={styles.input}
                  theme={inputTheme}
                  textColor={Colors.text}
                />
                <TextInput
                  label="Endpoint URL (e.g., https://s3.amazonaws.com)"
                  value={settings?.s3Storage?.endpoint || ""}
                  onChangeText={(v) =>
                    setSettings({
                      ...settings,
                      s3Storage: { ...settings?.s3Storage, endpoint: v },
                    })
                  }
                  mode="outlined"
                  style={styles.input}
                  theme={inputTheme}
                  textColor={Colors.text}
                />
                <TextInput
                  label="Region (e.g., us-east-1)"
                  value={settings?.s3Storage?.region || ""}
                  onChangeText={(v) =>
                    setSettings({
                      ...settings,
                      s3Storage: { ...settings?.s3Storage, region: v },
                    })
                  }
                  mode="outlined"
                  style={styles.input}
                  theme={inputTheme}
                  textColor={Colors.text}
                />
                <TextInput
                  label="Bucket Name"
                  value={settings?.s3Storage?.bucketName || ""}
                  onChangeText={(v) =>
                    setSettings({
                      ...settings,
                      s3Storage: { ...settings?.s3Storage, bucketName: v },
                    })
                  }
                  mode="outlined"
                  style={styles.input}
                  theme={inputTheme}
                  textColor={Colors.text}
                />
              </ScrollView>
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => setS3DialogOpen(false)}
                textColor={Colors.textSecondary}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onPress={() => {
                  setS3DialogOpen(false);
                  saveNotifications();
                }}
                textColor={Colors.primary}
              >
                {t("common.save")}
              </Button>
            </Dialog.Actions>
          </Dialog>

          {/* GitHub Disconnect Dialog */}
          <Dialog
            visible={confirmGithubDisconnect}
            onDismiss={() => setConfirmGithubDisconnect(false)}
            style={{ backgroundColor: Colors.card, borderRadius: 20 }}
          >
            <Dialog.Title style={{ color: Colors.text }}>
              {t("settings.githubDisconnectTitle", "Disconnect GitHub")}
            </Dialog.Title>
            <Dialog.Content>
              <Text style={{ color: Colors.textSecondary, marginBottom: 14 }}>
                {t(
                  "settings.githubDisconnectConfirm",
                  "Are you sure you want to disconnect your GitHub account?",
                )}
              </Text>
              <Text style={{ color: Colors.error }}>
                {t(
                  "settings.githubDisconnectWarning",
                  "Automatic deployments will no longer work.",
                )}
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => setConfirmGithubDisconnect(false)}
                textColor={Colors.textSecondary}
              >
                {t("common.cancel")}
              </Button>
              <Button onPress={handleGithubDisconnect} textColor={Colors.error}>
                {t("common.disconnect", "Disconnect")}
              </Button>
            </Dialog.Actions>
          </Dialog>

          {/* Clear History Dialog */}
          <Dialog
            visible={confirmClear}
            onDismiss={() => setConfirmClear(false)}
            style={{ backgroundColor: Colors.card, borderRadius: 20 }}
          >
            <Dialog.Title style={{ color: Colors.text }}>
              {t("settings.clearConfirmTitle", "Clear History")}
            </Dialog.Title>
            <Dialog.Content>
              <Text style={{ color: Colors.textSecondary, marginBottom: 14 }}>
                {t(
                  "settings.deleteOlderThan",
                  "Delete deployment history older than:",
                )}
              </Text>
              {/* Quick buttons for days since Select is tricky to map cleanly here without extra libs */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[7, 14, 30, 60, 90].map((days) => (
                  <Button
                    key={days}
                    mode={clearDays === days ? "contained" : "outlined"}
                    onPress={() => setClearDays(days)}
                    compact
                    textColor={clearDays === days ? "#fff" : Colors.primary}
                    style={{ borderColor: Colors.primary }}
                  >
                    {days} days
                  </Button>
                ))}
              </View>
              <Text
                style={{ color: Colors.error, marginTop: 14, fontSize: 13 }}
              >
                {t("settings.cantUndo", "This action cannot be undone.")}
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => setConfirmClear(false)}
                textColor={Colors.textSecondary}
              >
                {t("common.cancel")}
              </Button>
              <Button onPress={handleClearHistory} textColor={Colors.error}>
                {t("common.delete")}
              </Button>
            </Dialog.Actions>
          </Dialog>

          {/* Delete Account Dialog */}
          <Dialog
            visible={confirmDeleteAccount}
            onDismiss={() => {
              setConfirmDeleteAccount(false);
              setDeleteAccountPassword("");
            }}
            style={{ backgroundColor: Colors.card, borderRadius: 20 }}
          >
            <Dialog.Title style={{ color: Colors.error }}>
              Delete Account
            </Dialog.Title>
            <Dialog.Content>
              <Text
                style={{
                  color: Colors.textSecondary,
                  marginBottom: 14,
                  lineHeight: 20,
                }}
              >
                Permanently delete your account and all associated data. This
                action cannot be undone. Enter your password to confirm.
              </Text>
              <TextInput
                label={t("auth.password")}
                value={deleteAccountPassword}
                onChangeText={setDeleteAccountPassword}
                mode="outlined"
                secureTextEntry
                style={styles.input}
                outlineColor={Colors.error}
                activeOutlineColor={Colors.error}
                textColor={Colors.text}
                theme={inputTheme}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => {
                  setConfirmDeleteAccount(false);
                  setDeleteAccountPassword("");
                }}
                textColor={Colors.textSecondary}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onPress={handleDeleteAccount}
                loading={deletingAccount}
                disabled={!deleteAccountPassword || deletingAccount}
                textColor={Colors.error}
              >
                Delete
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
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
