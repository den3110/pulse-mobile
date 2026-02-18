import { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
} from "react-native";
import {
  Text,
  Searchbar,
  ActivityIndicator,
  Chip,
  IconButton,
} from "react-native-paper";
import { useRouter, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { Colors, statusColor } from "../constants/theme";
import { useAppTheme } from "../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface Server {
  _id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: "password" | "key";
  status: "online" | "offline" | "unknown";
}

export default function FTPSelectionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const [servers, setServers] = useState<Server[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchServers = async () => {
    try {
      const res = await api.get("/servers");
      setServers(res.data);
    } catch (err) {
      console.error("Failed to fetch servers", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchServers();
  }, []);

  const filtered = servers.filter((s) => {
    return (
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.host.toLowerCase().includes(search.toLowerCase())
    );
  });

  const renderServer = ({ item }: { item: Server }) => (
    <Pressable
      onPress={() => router.push(`/server/${item._id}/ftp`)}
      style={({ pressed }) => [styles.serverCard, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.serverRow}>
        <MaterialCommunityIcons
          name="folder-network"
          size={28}
          color={Colors.accent}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.serverName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.serverHost}>
            {item.host}:{item.port || 22}
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color={Colors.textSecondary}
        />
      </View>
    </Pressable>
  );

  return (
    <>
      <Stack.Screen options={{ title: "Select Server" }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Browse Files</Text>
          <Text style={styles.headerSubtitle}>
            Select a server to access its file system
          </Text>
        </View>

        <Searchbar
          placeholder={t("servers.searchPlaceholder")}
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
          inputStyle={{ color: colors.text }}
          iconColor={colors.textSecondary}
          placeholderTextColor={colors.textSecondary}
        />

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item._id}
            renderItem={renderServer}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.centered}>
                <Text style={{ color: colors.textSecondary }}>
                  No servers found
                </Text>
              </View>
            }
          />
        )}
      </View>
    </>
  );
}

const createStyles = (Colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    header: {
      padding: 16,
      paddingBottom: 0,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: Colors.text,
    },
    headerSubtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginTop: 4,
    },
    searchbar: {
      margin: 12,
      backgroundColor: Colors.surface,
      borderRadius: 12,
      elevation: 0,
    },
    serverCard: {
      backgroundColor: Colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 10,
    },
    serverRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    serverName: { fontSize: 16, fontWeight: "700", color: Colors.text },
    serverHost: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  });
