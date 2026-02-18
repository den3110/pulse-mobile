import React from "react";
import { View, StyleSheet } from "react-native";
import { Skeleton } from "./Skeleton";
import { useAppTheme } from "../contexts/ThemeContext";

export const ProjectListSkeleton = () => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((key) => (
        <View key={key} style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="60%" height={20} />
              <Skeleton width="40%" height={14} />
            </View>
            <Skeleton width={20} height={20} borderRadius={10} />
          </View>
          <View style={styles.chipRow}>
            <Skeleton width={60} height={24} borderRadius={12} />
            <Skeleton width={80} height={24} borderRadius={12} />
            <Skeleton width={50} height={24} borderRadius={12} />
          </View>
          <View style={{ marginTop: 12, gap: 8 }}>
            <Skeleton width="50%" height={14} />
            <Skeleton width="70%" height={14} />
          </View>

          <View style={styles.actions}>
            <Skeleton width={100} height={36} borderRadius={8} />
            <Skeleton width={100} height={36} borderRadius={8} />
            <View style={{ flex: 1 }} />
            <Skeleton width={24} height={24} borderRadius={12} />
            <Skeleton width={24} height={24} borderRadius={12} />
          </View>
        </View>
      ))}
    </View>
  );
};

export const ServerListSkeleton = () => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((key) => (
        <View key={key} style={styles.card}>
          <View style={styles.row}>
            <Skeleton
              width={10}
              height={10}
              borderRadius={5}
              style={{ marginRight: 10 }}
            />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="50%" height={18} />
              <Skeleton width="30%" height={12} />
            </View>
            <Skeleton width={20} height={20} borderRadius={10} />
          </View>
          <View style={styles.chipRow}>
            <Skeleton width={60} height={24} borderRadius={12} />
            <Skeleton width={80} height={24} borderRadius={12} />
          </View>
        </View>
      ))}
    </View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      padding: 12,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },
    chipRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 6,
    },
    actions: {
      flexDirection: "row",
      marginTop: 16,
      gap: 8,
      alignItems: "center",
    },
  });
