import { Tabs, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Platform, View, Pressable, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import {
  Portal,
  Modal,
  Text,
  List,
  Divider,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ActiveServerSelector from "../../components/ActiveServerSelector";
import { useNotifications } from "../../contexts/NotificationContext"; // Import
import NotificationIcon from "../../components/NotificationIcon";
import CommandPalette from "../../components/CommandPalette";
import { IconButton } from "react-native-paper";

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [paletteVisible, setPaletteVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications(); // Use hook

  // Menu items config
  const menuItems = [
    {
      title: "PM2 Manager",
      icon: "monitor-dashboard",
      route: "/pm2", // Todo
      color: colors.primary,
    },
    {
      title: "Cron Jobs",
      icon: "clock-outline",
      route: "/cron", // Todo
      color: colors.accent,
    },
    {
      title: "File Manager",
      icon: "folder-multiple",
      route: "/ftp",
      color: colors.info,
    },
    {
      title: t("nav.database", "Database Manager"),
      icon: "database",
      route: "/database",
      color: colors.warning,
    },
    {
      title: t("nav.nginx", "Nginx Manager"),
      icon: "server-network",
      route: "/nginx",
      color: colors.primary,
    },
    {
      title: t("nav.ports", "Port Manager"),
      icon: "lan",
      route: "/ports",
      color: colors.info,
    },
    {
      title: t("nav.docker", "Docker"),
      icon: "docker",
      route: "/docker",
      color: colors.primary,
    },
    {
      title: t("nav.infrastructure", "Infrastructure"),
      icon: "sitemap",
      route: "/infrastructure",
      color: colors.accent,
    },
    {
      title: t("nav.analytics", "Analytics"),
      icon: "chart-bar",
      route: "/analytics",
      color: colors.info,
    },
    {
      title: t("nav.bandwidth", "Bandwidth"),
      icon: "speedometer",
      route: "/bandwidth",
      color: colors.success,
    },
    {
      title: t("nav.logs", "Log Studio"),
      icon: "text-box-search",
      route: "/logs",
      color: colors.primary,
    },
    {
      title: t("nav.approvals", "Approvals"),
      icon: "shield-check-outline",
      route: "/approvals",
      color: colors.warning,
    },
    {
      title: t("nav.secrets", "Secrets"),
      icon: "key-outline",
      route: "/secrets",
      color: colors.primary,
    },
    {
      title: t("nav.webhookDebug", "Webhooks"),
      icon: "webhook",
      route: "/webhook-debug",
      color: colors.accent,
    },
    {
      title: t("nav.testRunner", "Test Runner"),
      icon: "test-tube",
      route: "/test-runner",
      color: colors.info,
    },
    {
      title: t("nav.pipelines", "Pipelines"),
      icon: "pipe",
      route: "/pipelines",
      color: colors.primary,
    },
    {
      title: t("nav.vpn", "VPN Server"),
      icon: "shield-lock-outline",
      route: "/vpn",
      color: colors.warning,
    },
    {
      title: t("nav.settings", "Settings"),
      icon: "cog",
      route: "/(tabs)/settings",
      color: colors.text,
    },
  ];

  const handleMenuPress = (route: string) => {
    setMenuVisible(false);
    if (route === "/(tabs)/settings") {
      router.push("/settings");
    } else {
      // For now, if route doesn't exist, maybe show alert or navigating to placeholder
      // For this task we just need the menu to exist
      router.push(route as any);
    }
  };

  return (
    <>
      <CommandPalette
        visible={paletteVisible}
        onDismiss={() => setPaletteVisible(false)}
      />
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.surface,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.border,
          },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "700", fontSize: 18 },
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 0.5,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom + 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
        }}
        screenListeners={{
          tabPress: () => {
            if (Platform.OS !== "web") {
              Haptics.selectionAsync();
            }
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("nav.dashboard"),
            headerTitle: () => <ActiveServerSelector />,
            headerRight: () => (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <IconButton
                  icon="magnify"
                  iconColor={colors.text}
                  onPress={() => setPaletteVisible(true)}
                  style={{ marginRight: -5 }}
                />
                <NotificationIcon />
              </View>
            ),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="view-dashboard"
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="servers"
          options={{
            title: t("nav.servers"),
            headerRight: () => (
              <IconButton
                icon="magnify"
                iconColor={colors.text}
                onPress={() => setPaletteVisible(true)}
              />
            ),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="server" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="projects"
          options={{
            title: t("nav.projects"),
            headerRight: () => (
              <IconButton
                icon="magnify"
                iconColor={colors.text}
                onPress={() => setPaletteVisible(true)}
              />
            ),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="folder" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: t("nav.activity"),
            headerRight: () => (
              <IconButton
                icon="magnify"
                iconColor={colors.text}
                onPress={() => setPaletteVisible(true)}
              />
            ),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="history" size={24} color={color} />
            ),
          }}
        />

        {/* Notifications Tab (Hidden from bottom bar, accessed via header) */}
        <Tabs.Screen
          name="notifications"
          options={{
            href: null,
            title: t("nav.notifications") || "Notifications",
          }}
        />

        {/* Hidden Pages to register routes without showing in tab bar */}
        <Tabs.Screen
          name="settings"
          options={{
            href: null, // Hide from tab bar
            title: t("nav.settings"),
          }}
        />

        {/* Fake "Menu" Tab */}
        <Tabs.Screen
          name="menu"
          options={{
            title: t("common.more"),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="dots-grid"
                size={24}
                color={color}
              />
            ),
          }}
          listeners={() => ({
            tabPress: (e) => {
              e.preventDefault(); // Don't navigate
              setMenuVisible(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            },
          })}
        />
      </Tabs>

      {/* Menu Modal (Bottom Sheet Style) */}
      <Portal>
        <Modal
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          contentContainerStyle={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            paddingBottom: insets.bottom + 20,
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: "85%", // Constrain height so it scrolls if too long
          }}
        >
          <View style={{ alignItems: "center", paddingBottom: 16 }}>
            <View
              style={{
                width: 40,
                height: 5,
                backgroundColor: colors.border,
                borderRadius: 3,
              }}
            />
          </View>
          <Text
            style={{
              textAlign: "center",
              fontSize: 18,
              fontWeight: "700",
              color: colors.text,
              marginBottom: 12,
            }}
          >
            {t("common.more", "Menu")}
          </Text>
          <Divider style={{ marginBottom: 8 }} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 10 }}
            bounces={false}
          >
            {menuItems.map((item, index) => (
              <List.Item
                key={index}
                title={item.title}
                left={(props) => (
                  <List.Icon {...props} icon={item.icon} color={item.color} />
                )}
                onPress={() => handleMenuPress(item.route)}
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 8,
                  borderRadius: 12,
                }}
                titleStyle={{ fontSize: 15, fontWeight: "600" }}
                rippleColor="rgba(0, 0, 0, 0.05)"
              />
            ))}
          </ScrollView>
        </Modal>
      </Portal>
    </>
  );
}
