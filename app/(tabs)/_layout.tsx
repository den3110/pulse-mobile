import { Tabs, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Platform, View, Pressable } from "react-native";
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

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
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
      title: "Database Manager",
      icon: "database",
      route: "/database",
      color: colors.warning,
    },
    {
      title: "Nginx Manager",
      icon: "server-network",
      route: "/nginx",
      color: colors.primary,
    },
    {
      title: t("nav.settings"),
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
            headerRight: () => <NotificationIcon />,
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
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="server" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="projects"
          options={{
            title: t("nav.projects"),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="folder" size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: t("nav.activity"),
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

        {/* Hidden Settings Tab (still accessible via router but hidden from tab bar) */}
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
            title: "Menu",
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

      {/* Menu Modal */}
      <Portal>
        <Modal
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          contentContainerStyle={{
            backgroundColor: colors.surface,
            margin: 20,
            borderRadius: 14,
            paddingVertical: 10,
            paddingBottom: 20,
            position: "absolute",
            bottom: 60 + insets.bottom + 20, // Position above tab bar
            left: 0,
            right: 0,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}
        >
          <View style={{ alignItems: "center", paddingVertical: 10 }}>
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: colors.border,
                borderRadius: 2,
              }}
            />
          </View>
          <Text
            style={{
              textAlign: "center",
              fontSize: 16,
              fontWeight: "700",
              color: colors.text,
              marginBottom: 10,
            }}
          >
            Quick Actions
          </Text>
          <Divider style={{ marginBottom: 5 }} />

          {menuItems.map((item, index) => (
            <List.Item
              key={index}
              title={item.title}
              left={(props) => (
                <List.Icon {...props} icon={item.icon} color={item.color} />
              )}
              onPress={() => handleMenuPress(item.route)}
              style={{ paddingVertical: 4 }}
              titleStyle={{ fontSize: 15, fontWeight: "600" }}
            />
          ))}
        </Modal>
      </Portal>
    </>
  );
}
