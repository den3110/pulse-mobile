import { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  SegmentedButtons,
  ActivityIndicator,
} from "react-native-paper";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { Colors, inputTheme } from "../../constants/theme";
import { useAppTheme } from "../../contexts/ThemeContext";
import * as Haptics from "expo-haptics";

export default function ServerFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const { colors, inputTheme: themeInput } = useAppTheme();
  const Colors = colors;
  const inputTheme = themeInput;
  const styles = createStyles(colors);
  const router = useRouter();
  const isEditing = !!id;

  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("root");
  const [authType, setAuthType] = useState<string>("password");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);

  useEffect(() => {
    if (isEditing) {
      api
        .get(`/servers/${id}`)
        .then((res) => {
          setName(res.data.name);
          setHost(res.data.host);
          setPort(String(res.data.port || 22));
          setUsername(res.data.username || "root");
          setAuthType(res.data.authType || "password");
        })
        .catch(() => Alert.alert(t("common.error"), t("common.failed")))
        .finally(() => setFetching(false));
    }
  }, [id]);

  const handleSubmit = async () => {
    if (!name.trim() || !host.trim()) {
      Alert.alert("Error", t("servers.fillRequired"));
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        host: host.trim(),
        port: parseInt(port) || 22,
        username: username.trim(),
        authType,
        ...(authType === "password" ? { password } : { privateKey }),
      };
      if (isEditing) {
        await api.put(`/servers/${id}`, payload);
      } else {
        await api.post("/servers", payload);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.response?.data?.message || t("servers.saveFailed"),
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
          title: isEditing ? t("servers.editServer") : t("servers.addServer"),
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
            label={t("servers.name") + " *"}
            value={name}
            onChangeText={setName}
            mode="outlined"
            left={<TextInput.Icon icon="server" />}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            textColor={Colors.text}
            theme={inputTheme}
          />
          <TextInput
            label={t("servers.host") + " *"}
            value={host}
            onChangeText={setHost}
            mode="outlined"
            autoCapitalize="none"
            left={<TextInput.Icon icon="web" />}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            textColor={Colors.text}
            theme={inputTheme}
          />
          <TextInput
            label={t("servers.port")}
            value={port}
            onChangeText={setPort}
            mode="outlined"
            keyboardType="numeric"
            left={<TextInput.Icon icon="ethernet" />}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            textColor={Colors.text}
            theme={inputTheme}
          />
          <TextInput
            label={t("servers.username")}
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

          <Text style={styles.label}>{t("servers.authType")}</Text>
          <SegmentedButtons
            value={authType}
            onValueChange={setAuthType}
            buttons={[
              { value: "password", label: t("servers.password"), icon: "key" },
              { value: "key", label: t("servers.sshKey"), icon: "file-key" },
            ]}
            style={styles.segmented}
          />

          {authType === "password" ? (
            <TextInput
              label={t("servers.password")}
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry
              left={<TextInput.Icon icon="lock" />}
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              textColor={Colors.text}
              theme={inputTheme}
            />
          ) : (
            <TextInput
              label={t("servers.privateKey")}
              value={privateKey}
              onChangeText={setPrivateKey}
              mode="outlined"
              multiline
              numberOfLines={4}
              left={<TextInput.Icon icon="file-key" />}
              style={[styles.input, { minHeight: 100 }]}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              textColor={Colors.text}
              theme={inputTheme}
            />
          )}

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
            {isEditing ? t("common.save") : t("servers.addServer")}
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
    form: { padding: 20, gap: 14, paddingBottom: 40 },
    input: { backgroundColor: Colors.surface },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textSecondary,
      marginTop: 4,
    },
    segmented: { marginBottom: 4 },
    submitBtn: { marginTop: 8, borderRadius: 12 },
  });
