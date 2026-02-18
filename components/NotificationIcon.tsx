import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Badge, IconButton, useTheme } from "react-native-paper";
import { useNotifications } from "../contexts/NotificationContext";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "../contexts/ThemeContext";

export default function NotificationIcon() {
  const { unreadCount } = useNotifications();
  const { colors } = useAppTheme();
  const router = useRouter();

  const handlePress = () => {
    Haptics.selectionAsync();
    router.push("/notifications");
  };

  return (
    <View style={styles.container}>
      <IconButton
        icon="bell-outline"
        size={24}
        onPress={handlePress}
        iconColor={colors.text}
      />
      {unreadCount > 0 && (
        <Badge
          size={16}
          style={[styles.badge, { backgroundColor: colors.error }]}
        >
          {unreadCount}
        </Badge>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: 8,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
  },
});
