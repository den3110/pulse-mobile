import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from "react-native";
import { Text, TextInput, Button, HelperText } from "react-native-paper";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { Colors, inputTheme } from "../../constants/theme";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

export default function LoginScreen() {
  const { t } = useTranslation();
  const { login, biometricEnabled, biometricAvailable, loginWithBiometric } =
    useAuth();
  const { colors, inputTheme: themeInput } = useAppTheme();
  const Colors = colors;
  const inputTheme = themeInput;
  const styles = createStyles(colors);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-trigger biometric on mount if enabled (but NOT right after logout)
  useEffect(() => {
    const tryBiometric = async () => {
      const skip = await AsyncStorage.getItem("skipBiometricOnce");
      if (skip === "true") {
        await AsyncStorage.removeItem("skipBiometricOnce");
        return; // user just logged out, don't auto-trigger
      }
      if (biometricEnabled && biometricAvailable) {
        handleBiometricLogin();
      }
    };
    tryBiometric();
  }, [biometricEnabled, biometricAvailable]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      await login(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      console.error("Login error:", err);
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.message;
      setError(`[${status || "Error"}] ${msg}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await loginWithBiometric();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setError(err.message || t("auth.biometricFailed"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <MaterialCommunityIcons
                name="rocket-launch"
                size={36}
                color="#fff"
              />
            </View>
            <Text style={styles.appName}>Pulse</Text>
            <Text style={styles.subtitle}>{t("auth.loginSubtitle")}</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              label={t("auth.emailOrUsername")}
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              autoCapitalize="none"
              keyboardType="email-address"
              left={<TextInput.Icon icon="account" />}
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              textColor={Colors.text}
              theme={inputTheme}
            />

            <TextInput
              label={t("auth.password")}
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              left={<TextInput.Icon icon="lock" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? "eye-off" : "eye"}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              textColor={Colors.text}
              theme={inputTheme}
            />

            {error ? (
              <HelperText type="error" visible>
                {error}
              </HelperText>
            ) : null}

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading || !email.trim() || !password.trim()}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              buttonColor={Colors.primary}
            >
              {t("auth.signIn")}
            </Button>

            <View style={styles.linkRow}>
              <Text style={styles.linkText}>{t("auth.noAccount")} </Text>
              <Link href="/(auth)/register" style={styles.link}>
                {t("auth.signUp")}
              </Link>
            </View>
          </View>

          {/* Biometric Login - Compact at bottom */}
          {biometricEnabled && biometricAvailable && (
            <View style={styles.biometricSection}>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>
                  {t("auth.orLoginWithPassword") || "or"}
                </Text>
                <View style={styles.dividerLine} />
              </View>
              <Pressable
                onPress={handleBiometricLogin}
                style={({ pressed }) => [
                  styles.biometricBtn,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
                ]}
              >
                <MaterialCommunityIcons
                  name={
                    Platform.OS === "ios" ? "face-recognition" : "fingerprint"
                  }
                  size={22}
                  color={Colors.primary}
                />
                <Text style={styles.biometricText}>
                  {Platform.OS === "ios"
                    ? t("auth.loginWithFaceId")
                    : t("auth.loginWithFingerprint")}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (Colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingVertical: 32,
    },
    logoContainer: { alignItems: "center", marginBottom: 32 },
    logoCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 8,
    },
    appName: {
      fontSize: 28,
      fontWeight: "800",
      color: Colors.primary,
      letterSpacing: 0.5,
    },
    subtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginTop: 6,
    },
    biometricSection: { alignItems: "center", marginTop: 24 },
    biometricBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 24,
      backgroundColor: Colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Colors.primary + "30",
    },
    biometricText: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.primary,
    },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
      gap: 12,
      width: "100%",
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: Colors.border,
    },
    dividerText: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    form: { gap: 12 },
    input: { backgroundColor: Colors.surface },
    button: { marginTop: 8, borderRadius: 12 },
    buttonContent: { paddingVertical: 6 },
    buttonLabel: { fontSize: 16, fontWeight: "700" },
    linkRow: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 16,
    },
    linkText: { color: Colors.textSecondary, fontSize: 14 },
    link: { color: Colors.primary, fontSize: 14, fontWeight: "600" },
  });
