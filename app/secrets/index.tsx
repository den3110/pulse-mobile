import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  Alert,
} from "react-native";
import {
  Text,
  ActivityIndicator,
  Portal,
  Dialog,
  Button,
  Chip,
  Card,
  TextInput,
  FAB,
  IconButton,
  Menu,
  Appbar,
  Searchbar,
} from "react-native-paper";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { useAppTheme } from "../../contexts/ThemeContext";
import * as Clipboard from "expo-clipboard";

interface SecretItem {
  _id: string;
  name: string;
  type: string;
  description?: string;
  project?: { _id: string; name: string };
  server?: { _id: string; name: string };
  tags: string[];
  lastAccessedAt?: string;
  lastRotatedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

const typeIcons: Record<string, string> = {
  env: "wrench",
  key: "key",
  token: "ticket",
  password: "lock",
  certificate: "certificate",
  other: "package-variant",
};

export default function SecretsScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const styles = createStyles(colors);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [secrets, setSecrets] = useState<SecretItem[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);

  // Creation/Interaction States
  const [createDialog, setCreateDialog] = useState(false);
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>(
    {},
  );
  const [revealLoading, setRevealLoading] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState({
    name: "",
    value: "",
    type: "env",
    description: "",
    tags: "",
  });

  const fetchSecrets = useCallback(async () => {
    try {
      const params = typeFilter !== "all" ? `?type=${typeFilter}` : "";
      const { data } = await api.get(`/secrets${params}`);
      setSecrets(data.secrets || []);
    } catch (error) {
      console.error("Failed to load secrets", error);
      Alert.alert(
        t("common.error"),
        t("secrets.failedToLoad", "Failed to load secrets"),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [typeFilter, t]);

  useEffect(() => {
    setLoading(true);
    fetchSecrets();
  }, [fetchSecrets]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSecrets();
  };

  const handleCreate = async () => {
    if (!newSecret.name || !newSecret.value) return;
    try {
      await api.post("/secrets", {
        ...newSecret,
        tags: newSecret.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setCreateDialog(false);
      setNewSecret({
        name: "",
        value: "",
        type: "env",
        description: "",
        tags: "",
      });
      fetchSecrets();
      Alert.alert(t("common.success"), "Secret created successfully");
    } catch (error: any) {
      Alert.alert(t("common.error"), error.response?.data?.message || "Failed");
    }
  };

  const handleReveal = async (id: string) => {
    if (revealedValues[id]) {
      // Toggle off manually
      setRevealedValues((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    setRevealLoading(id);
    try {
      const { data } = await api.get(`/secrets/${id}/reveal`);
      setRevealedValues((prev) => ({ ...prev, [id]: data.value }));

      // Auto-hide after 30s
      setTimeout(() => {
        setRevealedValues((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 30000);
    } catch (error) {
      console.error(error);
      Alert.alert(t("common.error"), "Failed to reveal secret");
    } finally {
      setRevealLoading(null);
    }
  };

  const handleCopy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert(t("common.success"), "Copied to clipboard!");
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      t("common.confirmDelete", "Are you sure?"),
      t(
        "secrets.deleteConfirmText",
        "This secret will be permanently deleted.",
      ),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("common.delete", "Delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/secrets/${id}`);
              fetchSecrets();
            } catch (error: any) {
              Alert.alert(
                t("common.error"),
                error.response?.data?.message || "Failed",
              );
            }
          },
        },
      ],
    );
  };

  const filtered = secrets.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description || "").toLowerCase().includes(search.toLowerCase()),
  );

  const getTypeName = (type: string) => {
    if (type === "all") return t("common.all", "All");
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: t("secrets.title", "Secret Vault"),
          headerRight: () => (
            <Menu
              visible={filterMenuVisible}
              onDismiss={() => setFilterMenuVisible(false)}
              anchor={
                <IconButton
                  icon="filter-variant"
                  onPress={() => setFilterMenuVisible(true)}
                  iconColor={
                    typeFilter !== "all" ? colors.primary : colors.text
                  }
                />
              }
            >
              <Menu.Item
                onPress={() => {
                  setTypeFilter("all");
                  setFilterMenuVisible(false);
                }}
                title="All Types"
              />
              <Menu.Item
                onPress={() => {
                  setTypeFilter("env");
                  setFilterMenuVisible(false);
                }}
                title="Env"
              />
              <Menu.Item
                onPress={() => {
                  setTypeFilter("key");
                  setFilterMenuVisible(false);
                }}
                title="Key"
              />
              <Menu.Item
                onPress={() => {
                  setTypeFilter("token");
                  setFilterMenuVisible(false);
                }}
                title="Token"
              />
              <Menu.Item
                onPress={() => {
                  setTypeFilter("password");
                  setFilterMenuVisible(false);
                }}
                title="Password"
              />
              <Menu.Item
                onPress={() => {
                  setTypeFilter("certificate");
                  setFilterMenuVisible(false);
                }}
                title="Certificate"
              />
              <Menu.Item
                onPress={() => {
                  setTypeFilter("other");
                  setFilterMenuVisible(false);
                }}
                title="Other"
              />
            </Menu>
          ),
        }}
      />

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder={t("common.search", "Search...")}
          onChangeText={setSearch}
          value={search}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          elevation={0}
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <IconButton
            icon="lock-outline"
            size={48}
            iconColor={colors.textSecondary}
          />
          <Text style={styles.emptyText}>
            {t("secrets.noSecrets", "No secrets stored")}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {filtered.map((secret) => (
            <Card key={secret._id} style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <IconButton
                    icon={typeIcons[secret.type] || "package-variant"}
                    size={24}
                    style={styles.typeIcon}
                    iconColor={colors.primary}
                  />
                  <View style={styles.headerTextCol}>
                    <Text style={styles.title} numberOfLines={1}>
                      {secret.name}
                    </Text>
                    {secret.description ? (
                      <Text style={styles.description} numberOfLines={2}>
                        {secret.description}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.secretValueBox}>
                  {revealedValues[secret._id] ? (
                    <Text selectable style={styles.revealedText}>
                      {revealedValues[secret._id]}
                    </Text>
                  ) : (
                    <Text style={styles.hiddenText}>••••••••••••</Text>
                  )}
                </View>

                {secret.tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    {secret.tags.map((tag) => (
                      <Chip
                        key={tag}
                        compact
                        style={styles.tag}
                        textStyle={{ fontSize: 10, marginVertical: 0 }}
                      >
                        {tag}
                      </Chip>
                    ))}
                  </View>
                )}

                {(secret.project || secret.server) && (
                  <Text style={styles.scopeText}>
                    {secret.project ? `📦 ${secret.project.name}  ` : ""}
                    {secret.server ? `🖥️ ${secret.server.name}` : ""}
                  </Text>
                )}

                <View style={styles.actionsRow}>
                  <Button
                    mode="text"
                    icon={revealedValues[secret._id] ? "eye-off" : "eye"}
                    onPress={() => handleReveal(secret._id)}
                    loading={revealLoading === secret._id}
                    disabled={revealLoading === secret._id}
                    textColor={colors.primary}
                    style={styles.actionBtn}
                  >
                    {revealedValues[secret._id]
                      ? t("common.hide", "Hide")
                      : t("common.reveal", "Reveal")}
                  </Button>

                  {revealedValues[secret._id] && (
                    <Button
                      mode="text"
                      icon="content-copy"
                      onPress={() => handleCopy(revealedValues[secret._id])}
                      textColor={colors.textSecondary}
                      style={styles.actionBtn}
                    >
                      {t("common.copy", "Copy")}
                    </Button>
                  )}

                  <View style={{ flex: 1 }} />

                  <IconButton
                    icon="delete"
                    iconColor={colors.error}
                    size={20}
                    onPress={() => handleDelete(secret._id)}
                    style={{ margin: 0 }}
                  />
                </View>
              </Card.Content>
            </Card>
          ))}
        </ScrollView>
      )}

      {/* FAB to Create */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: colors.primary }]}
        color={colors.background}
        onPress={() => setCreateDialog(true)}
      />

      {/* Create Dialog */}
      <Portal>
        <Dialog visible={createDialog} onDismiss={() => setCreateDialog(false)}>
          <Dialog.Title>{t("secrets.add", "Add Secret")}</Dialog.Title>
          <Dialog.Content>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ paddingBottom: 8 }}>
                <TextInput
                  label="Name"
                  placeholder="e.g. DATABASE_URL, API_KEY"
                  mode="outlined"
                  value={newSecret.name}
                  onChangeText={(t) => setNewSecret((p) => ({ ...p, name: t }))}
                  style={styles.input}
                  dense
                />

                <TextInput
                  label="Value"
                  secureTextEntry
                  mode="outlined"
                  value={newSecret.value}
                  onChangeText={(t) =>
                    setNewSecret((p) => ({ ...p, value: t }))
                  }
                  style={styles.input}
                  dense
                />

                <View style={styles.input}>
                  <Menu
                    visible={typeMenuVisible}
                    onDismiss={() => setTypeMenuVisible(false)}
                    anchor={
                      <Button
                        mode="outlined"
                        onPress={() => setTypeMenuVisible(true)}
                      >
                        {t("secrets.type", "Type:")}{newSecret.type}
                      </Button>
                    }
                  >
                    <Menu.Item
                      onPress={() => {
                        setNewSecret((p) => ({ ...p, type: "env" }));
                        setTypeMenuVisible(false);
                      }}
                      title="Env"
                    />
                    <Menu.Item
                      onPress={() => {
                        setNewSecret((p) => ({ ...p, type: "key" }));
                        setTypeMenuVisible(false);
                      }}
                      title="Key"
                    />
                    <Menu.Item
                      onPress={() => {
                        setNewSecret((p) => ({ ...p, type: "token" }));
                        setTypeMenuVisible(false);
                      }}
                      title="Token"
                    />
                    <Menu.Item
                      onPress={() => {
                        setNewSecret((p) => ({ ...p, type: "password" }));
                        setTypeMenuVisible(false);
                      }}
                      title="Password"
                    />
                    <Menu.Item
                      onPress={() => {
                        setNewSecret((p) => ({ ...p, type: "certificate" }));
                        setTypeMenuVisible(false);
                      }}
                      title="Certificate"
                    />
                    <Menu.Item
                      onPress={() => {
                        setNewSecret((p) => ({ ...p, type: "other" }));
                        setTypeMenuVisible(false);
                      }}
                      title="Other"
                    />
                  </Menu>
                </View>

                <TextInput
                  label="Description (Optional)"
                  mode="outlined"
                  value={newSecret.description}
                  onChangeText={(t) =>
                    setNewSecret((p) => ({ ...p, description: t }))
                  }
                  style={styles.input}
                  dense
                />

                <TextInput
                  label="Tags (comma separated)"
                  placeholder="production, database"
                  mode="outlined"
                  value={newSecret.tags}
                  onChangeText={(t) => setNewSecret((p) => ({ ...p, tags: t }))}
                  style={styles.input}
                  dense
                />
              </View>
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateDialog(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              mode="contained"
              onPress={handleCreate}
              disabled={!newSecret.name || !newSecret.value}
            >
              {t("common.save", "Save")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    searchContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    searchbar: {
      backgroundColor: "rgba(128,128,128,0.1)",
      height: 40,
    },
    searchInput: {
      minHeight: 40,
      fontSize: 14,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 80,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyText: {
      color: colors.textSecondary,
    },
    card: {
      marginBottom: 12,
      backgroundColor: colors.surface,
      elevation: 0,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardContent: {
      padding: 16,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    typeIcon: {
      margin: 0,
      marginRight: 12,
      backgroundColor: "rgba(128,128,128,0.1)",
    },
    headerTextCol: {
      flex: 1,
      marginTop: 2,
    },
    title: {
      fontSize: 14,
      fontWeight: "700",
      fontFamily: "monospace",
      color: colors.text,
      marginBottom: 2,
    },
    description: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    secretValueBox: {
      backgroundColor: "rgba(128,128,128,0.05)",
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
      minHeight: 48,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    hiddenText: {
      color: colors.textSecondary,
      letterSpacing: 4,
      fontSize: 14,
      textAlign: "center",
    },
    revealedText: {
      fontFamily: "monospace",
      fontSize: 12,
      color: colors.text,
    },
    tagsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 12,
    },
    tag: {
      backgroundColor: "rgba(128,128,128,0.1)",
    },
    scopeText: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    actionsRow: {
      flexDirection: "row",
      alignItems: "center",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 8,
      marginLeft: -8,
      marginRight: -8,
    },
    actionBtn: {
      margin: 0,
    },
    fab: {
      position: "absolute",
      margin: 16,
      right: 0,
      bottom: 0,
    },
    input: {
      marginBottom: 12,
      backgroundColor: "transparent",
    },
  });
