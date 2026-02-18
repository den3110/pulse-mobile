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
import NetworkMonitor from "../components/NetworkMonitor";

function RootLayoutNav() {
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
      </Stack>
    </>
  );
}

function ThemedApp() {
  const { paperTheme } = useAppTheme();
  return (
    <PaperProvider theme={paperTheme}>
      <AuthProvider>
        <ServerProvider>
          <NotificationProvider>
            <NetworkMonitor />
            <RootLayoutNav />
          </NotificationProvider>
        </ServerProvider>
      </AuthProvider>
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
