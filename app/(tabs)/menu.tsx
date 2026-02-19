import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { Text, Surface, IconButton, useTheme } from "react-native-paper";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MENU_ITEMS = [
  {
    id: "nginx",
    label: "Nginx",
    icon: "web",
    path: "/nginx",
    color: "#009639",
  },
  {
    id: "pm2",
    label: "PM2",
    icon: "console-line",
    path: "/pm2",
    color: "#2B037A",
  },
  {
    id: "ftp",
    label: "nav.ftp", // key for translation
    icon: "folder-network",
    path: "/ftp-selection", // specific path for mobile
    color: "#F5821F",
  },
  {
    id: "database",
    label: "nav.database",
    icon: "database",
    path: "/database",
    color: "#336791",
  },
  {
    id: "cron",
    label: "nav.cron",
    icon: "clock-outline",
    path: "/cron",
    color: "#607D8B",
  },
  {
    id: "activity",
    label: "nav.activity",
    icon: "history",
    path: "/activity", // it's a tab but can be navigated to
    color: "#9C27B0",
  },
  {
    id: "users",
    label: "nav.users",
    icon: "account-group",
    path: "/admin/users", // check path
    color: "#E91E63",
  },
  {
    id: "settings",
    label: "nav.settings",
    icon: "cog",
    path: "/settings", // check path
    color: "#795548",
  },
];

export default function MenuScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 80 },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("common.more")}</Text>
      </View>

      <View style={styles.grid}>
        {MENU_ITEMS.map((item) => (
          <Surface key={item.id} style={styles.card} elevation={1}>
            <Pressable
              style={({ pressed }) => [
                styles.cardContent,
                pressed && { backgroundColor: item.color + "15" },
              ]}
              onPress={() => router.push(item.path as any)}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: item.color + "20" },
                ]}
              >
                <MaterialCommunityIcons
                  name={item.icon as any}
                  size={32}
                  color={item.color}
                />
              </View>
              <Text style={styles.label}>
                {item.label.startsWith("nav.") ? t(item.label) : item.label}
              </Text>
            </Pressable>
          </Surface>
        ))}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
    },
    header: {
      marginBottom: 24,
      marginTop: Platform.OS === "android" ? 40 : 0,
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: "800",
      color: colors.text,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    card: {
      width: "48%", // approx 2 columns
      aspectRatio: 1.1,
      borderRadius: 20,
      backgroundColor: colors.card,
      overflow: "hidden",
    },
    cardContent: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    label: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      textAlign: "center",
    },
  });
