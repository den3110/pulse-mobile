import { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Text, TextInput, Button, HelperText } from "react-native-paper";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { Colors, inputTheme } from "../../constants/theme";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const { colors, inputTheme: themeInput } = useAppTheme();
  const Colors = colors;
  const inputTheme = themeInput;
  const styles = createStyles(colors);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password) return;
    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    if (password.length < 6) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await register(username.trim(), email.trim(), password);
    } catch (err: any) {
      setError(err.response?.data?.message || t("auth.registerFailed"));
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
            <Text style={styles.subtitle}>{t("auth.registerSubtitle")}</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              label={t("auth.username")}
              value={username}
              onChangeText={setUsername}
              mode="outlined"
              autoCapitalize="none"
              left={<TextInput.Icon icon="account" />}
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              textColor={Colors.text}
              theme={inputTheme}
            />
            <TextInput
              label={t("auth.email")}
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              autoCapitalize="none"
              keyboardType="email-address"
              left={<TextInput.Icon icon="email" />}
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
            <TextInput
              label={t("auth.confirmPassword")}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              left={<TextInput.Icon icon="lock-check" />}
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
              onPress={handleRegister}
              loading={loading}
              disabled={
                loading || !username.trim() || !email.trim() || !password
              }
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              buttonColor={Colors.primary}
            >
              {t("auth.signUp")}
            </Button>

            <View style={styles.linkRow}>
              <Text style={styles.linkText}>{t("auth.haveAccount")} </Text>
              <Link href="/(auth)/login" style={styles.link}>
                {t("auth.signIn")}
              </Link>
            </View>
          </View>
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
    subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 6 },
    form: { gap: 12 },
    input: { backgroundColor: Colors.surface },
    button: { marginTop: 8, borderRadius: 12 },
    buttonContent: { paddingVertical: 6 },
    buttonLabel: { fontSize: 16, fontWeight: "700" },
    linkRow: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
    linkText: { color: Colors.textSecondary, fontSize: 14 },
    link: { color: Colors.primary, fontSize: 14, fontWeight: "600" },
  });
