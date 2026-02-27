import { useEffect } from "react";
// if (__DEV__) {
//   require("../ReactotronConfig");
// }
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { ThemeProvider, useAppTheme } from "../contexts/ThemeContext";
import { ServerProvider } from "../contexts/ServerContext";
import { NotificationProvider } from "../contexts/NotificationContext";
import "../services/i18n";
import { useTranslation } from "react-i18next";
import NetworkMonitor from "../components/NetworkMonitor";

function RootLayoutNav() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "700", fontSize: 17 },
          headerShadowVisible: false,
          headerBackTitle: "",
          contentStyle: { backgroundColor: colors.background },
          gestureEnabled: true,
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="server/[id]"
          options={{ title: "Server", headerBackTitle: "Servers" }}
        />
        <Stack.Screen
          name="server/form"
          options={{
            title: "Server",
            presentation: "modal",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="project/[id]"
          options={{ title: "Project", headerBackTitle: "Projects" }}
        />
        <Stack.Screen
          name="project/form"
          options={{
            title: "Project",
            presentation: "modal",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="deployment/[id]"
          options={{ title: "Deployment", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="nginx/[serverId]"
          options={{ title: "Nginx Manager", headerBackTitle: "Server" }}
        />
        <Stack.Screen
          name="admin/users"
          options={{ title: "User Management", headerBackTitle: "Settings" }}
        />
        {/* New Stack Screens moved from tabs */}
        <Stack.Screen
          name="bandwidth"
          options={{ title: t("nav.bandwidth") || "Bandwidth" }}
        />
        <Stack.Screen
          name="logs"
          options={{ title: t("nav.logs") || "Log Studio" }}
        />
        <Stack.Screen
          name="analytics"
          options={{ title: t("nav.analytics") || "Analytics" }}
        />
        <Stack.Screen
          name="approvals"
          options={{ title: t("nav.approvals") || "Approvals" }}
        />
        <Stack.Screen
          name="docker"
          options={{ title: t("nav.docker") || "Docker" }}
        />
        <Stack.Screen
          name="infrastructure"
          options={{ title: t("nav.infrastructure") || "Infrastructure" }}
        />
        <Stack.Screen
          name="pipelines"
          options={{ title: t("nav.pipelines") || "Pipelines" }}
        />
        <Stack.Screen
          name="secrets"
          options={{ title: t("nav.secrets") || "Secrets Vault" }}
        />
        <Stack.Screen
          name="test-runner"
          options={{ title: t("nav.testRunner") || "Test Runner" }}
        />
        <Stack.Screen
          name="vpn"
          options={{ title: t("nav.vpn") || "VPN Manager" }}
        />
        <Stack.Screen
          name="webhook-debug"
          options={{ title: t("nav.webhookDebug") || "Webhook Debug" }}
        />
      </Stack>
    </>
  );
}

import {
  ThemeProvider as NavThemeProvider,
  DarkTheme,
  DefaultTheme,
} from "@react-navigation/native";

import * as SystemUI from "expo-system-ui";

function ThemedApp() {
  const { paperTheme, isDark, colors } = useAppTheme();

  // Update system background color to match theme
  // This prevents white flashes on navigation transitions
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  // Adapt our custom theme to React Navigation theme
  const navigationTheme = {
    dark: isDark,
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.error,
    },
    fonts: isDark ? DarkTheme.fonts : DefaultTheme.fonts,
  };

  return (
    <PaperProvider theme={paperTheme}>
      <NavThemeProvider value={navigationTheme}>
        <AuthProvider>
          <ServerProvider>
            <NotificationProvider>
              <NetworkMonitor />
              <RootLayoutNav />
            </NotificationProvider>
          </ServerProvider>
        </AuthProvider>
      </NavThemeProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
