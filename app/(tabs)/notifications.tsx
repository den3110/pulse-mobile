import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import {
  Button,
  IconButton,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import {
  Notification,
  useNotifications,
} from "../../contexts/NotificationContext";
import { useAppTheme } from "../../contexts/ThemeContext";

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const {
    notifications,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotifications();
  const theme = useTheme<any>();
  const { colors } = theme;
  const isDark = theme.dark;
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications]),
  );

  const getIconData = (type: Notification["type"]) => {
    const success = "#22c55e";
    const error = "#ef4444";
    const info = "#3b82f6";
    const warning = "#f59e0b";
    const neutral = "#6b7280";

    switch (type) {
      case "deploy_success":
        return { icon: "check-circle", color: success };
      case "deploy_failed":
        return { icon: "alert-circle", color: error };
      case "deploy_started":
        return { icon: "rocket-launch", color: info };
      case "health_alert":
        return { icon: "heart-pulse", color: warning };
      default:
        return { icon: "bell", color: neutral };
    }
  };

  const handlePress = async (item: Notification) => {
    if (!item.read) {
      await markAsRead(item._id);
    }

    if (item.link) {
      let route = item.link;

      // Handle typical backend routes
      // Backend Link: /projects/67b.../deploy
      // App Route: /project/67b...

      if (route.includes("/projects/")) {
        const parts = route.split("/");
        // parts = ["", "projects", "ID", "deploy"]
        const idIndex = parts.indexOf("projects") + 1;
        if (idIndex > 0 && idIndex < parts.length) {
          const projectId = parts[idIndex];
          // Navigate to project detail
          route = `/project/${projectId}`;
        }
      } else if (route.includes("/deployments/")) {
        const parts = route.split("/");
        const idIndex = parts.indexOf("deployments") + 1;
        if (idIndex > 0 && idIndex < parts.length) {
          const deploymentId = parts[idIndex];
          route = `/deployment/${deploymentId}`;
        }
      }

      console.log("[Notification] Navigating to:", route);
      try {
        // Use router.push with as any to bypass strict typing if route is dynamic string
        router.push(route as any);
      } catch (e) {
        console.warn("[Notification] Navigation failed:", e);
      }
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const { icon, color } = getIconData(item.type);

    // For dark mode aesthetics
    // Use low opacity of the icon color for the container background
    const iconContainerBg = isDark ? `${color}15` : `${color}15`;

    // Text Colors
    // In dark mode, 'onSurface' should be white/light.
    // If it's failing (appearing black), we might have a theme issue.
    // We'll enforce high contrast if isDark is key.
    const titleColor = isDark ? "#E1E1E1" : colors.onSurface;
    const msgColor = isDark ? "#CBCBCB" : colors.onSurfaceVariant;
    const timeColor = isDark ? "#9CA3AF" : colors.outline;

    return (
      <Surface
        style={[
          styles.card,
          {
            backgroundColor: item.read
              ? isDark
                ? "#1E1E1E"
                : colors.surface
              : isDark
                ? "#2C2C2C"
                : colors.elevation.level2,
            borderColor: item.read ? "transparent" : colors.primaryContainer,
            borderWidth: item.read ? 0 : 1,
          },
        ]}
        elevation={item.read ? 0 : 2}
      >
        <TouchableRipple
          onPress={() => handlePress(item)}
          style={styles.touchable}
          rippleColor={colors.primaryContainer}
        >
          <View style={styles.cardRow}>
            {/* Icon Container */}
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: iconContainerBg },
              ]}
            >
              <MaterialCommunityIcons
                name={icon as any}
                size={24}
                color={color}
              />
            </View>

            {/* Content */}
            <View style={styles.contentContainer}>
              <View style={styles.headerRow}>
                <Text
                  style={[
                    styles.title,
                    {
                      color: titleColor,
                      fontWeight: item.read ? "500" : "700",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text style={{ color: timeColor, fontSize: 11, marginLeft: 8 }}>
                  {formatDistanceToNow(new Date(item.createdAt), {
                    addSuffix: true,
                  })}
                </Text>
              </View>

              <Text
                style={[styles.message, { color: msgColor }]}
                numberOfLines={2}
              >
                {item.message}
              </Text>
            </View>

            {/* Unread Indicator (Dot) */}
            {!item.read && (
              <View
                style={[styles.unreadDot, { backgroundColor: colors.primary }]}
              />
            )}
          </View>
        </TouchableRipple>
      </Surface>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t("notifications.title") || "Notifications",
          headerLeft: () => (
            <IconButton
              icon="arrow-left"
              onPress={() => router.back()}
              size={24}
              iconColor={colors.onSurface}
            />
          ),
          headerRight: () =>
            notifications.length > 0 && (
              <IconButton
                icon="check-all"
                size={22}
                iconColor={colors.primary}
                onPress={markAllAsRead}
              />
            ),
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {notifications.length > 0 && (
          <View style={styles.topActions}>
            <Text style={{ color: colors.outline, fontSize: 12 }}>
              {notifications.filter((n) => !n.read).length} unread
            </Text>
            <Button
              mode="text"
              onPress={clearAll}
              textColor={colors.error}
              compact
              labelStyle={{ fontSize: 12 }}
            >
              {t("notifications.clearAll") || "Clear all"}
            </Button>
          </View>
        )}

        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <MaterialCommunityIcons
                  name="bell-off-outline"
                  size={40}
                  color={colors.outline}
                />
              </View>
              <Text
                style={{
                  color: colors.onSurface,
                  marginTop: 16,
                  fontWeight: "600",
                  fontSize: 16,
                }}
              >
                {t("notifications.empty") || "No notifications"}
              </Text>
              <Text
                style={{ color: colors.outline, marginTop: 4, fontSize: 14 }}
              >
                We'll notify you when something happens.
              </Text>
            </View>
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  topActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  touchable: {
    padding: 16,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  contentContainer: {
    flex: 1,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    flex: 1,
    marginRight: 4,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
});
