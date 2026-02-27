import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Keyboard,
} from "react-native";
import { Modal, Portal, Text, IconButton, Divider } from "react-native-paper";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import api from "../services/api";

interface CommandPaletteProps {
  visible: boolean;
  onDismiss: () => void;
}

interface SearchItem {
  id: string;
  type: "server" | "project" | "route" | "action";
  label: string;
  subLabel?: string;
  icon: string;
  path: string;
  keywords?: string[];
}

export default function CommandPalette({
  visible,
  onDismiss,
}: CommandPaletteProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const styles = createStyles(colors, isDark);

  const [query, setQuery] = useState("");
  const [servers, setServers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setQuery("");
      // Add slight delay before focusing to let modal render completely
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);

      const fetchData = async () => {
        try {
          const [serversRes, projectsRes] = await Promise.all([
            api.get("/servers"),
            api.get("/projects"),
          ]);
          setServers(serversRes.data || []);
          setProjects(projectsRes.data || []);
        } catch (error) {
          console.error("Failed to fetch data for command palette", error);
        }
      };

      fetchData();
    } else {
      Keyboard.dismiss();
    }
  }, [visible]);

  // Static routes and actions
  const staticItems: SearchItem[] = useMemo(
    () => [
      {
        id: "route-dashboard",
        type: "route",
        label: t("nav.dashboard", "Dashboard"),
        path: "/",
        icon: "view-dashboard",
        keywords: ["home", "main", "stats"],
      },
      {
        id: "route-servers",
        type: "route",
        label: t("nav.servers", "Servers"),
        path: "/servers",
        icon: "server",
        keywords: ["vps", "host", "machine", "manage servers"],
      },
      {
        id: "route-projects",
        type: "route",
        label: t("nav.projects", "Projects"),
        path: "/projects",
        icon: "folder",
        keywords: ["app", "deployment", "manage projects"],
      },
      {
        id: "route-infra",
        type: "route",
        label: t("nav.infrastructure", "Infrastructure Map"),
        path: "/infrastructure",
        icon: "sitemap",
        keywords: ["map", "topology", "network", "diagram"],
      },
      {
        id: "route-vpn",
        type: "route",
        label: t("nav.vpn", "VPN Manager"),
        path: "/vpn",
        icon: "shield-lock",
        keywords: ["wireguard", "network", "secure"],
      },
      {
        id: "route-secrets",
        type: "route",
        label: t("nav.secrets", "Secret Vault"),
        path: "/secrets",
        icon: "key",
        keywords: ["env", "variables", "passwords", "keys"],
      },
      {
        id: "route-settings",
        type: "route",
        label: t("nav.settings", "Settings"),
        path: "/settings",
        icon: "cog",
        keywords: ["config", "preferences", "account", "profile"],
      },
    ],
    [t],
  );

  // Combine static and dynamic items
  const allItems: SearchItem[] = useMemo(() => {
    const dynamicServers: SearchItem[] = servers.map((s) => ({
      id: `server-${s._id}`,
      type: "server",
      label: s.name,
      subLabel: s.host,
      path: `/server/${s._id}`, // Mobile uses /server/ID usually
      icon: "server",
    }));

    const dynamicProjects: SearchItem[] = projects.map((p) => ({
      id: `project-${p._id}`,
      type: "project",
      label: p.name,
      subLabel: p.server?.name || "No Server",
      path: `/project/${p._id}`, // Mobile generic project route
      icon: "rocket-launch",
    }));

    return [...staticItems, ...dynamicServers, ...dynamicProjects];
  }, [staticItems, servers, projects]);

  const filteredItems = useMemo(() => {
    if (!query) return staticItems.slice(0, 8);

    const lowerQuery = query.toLowerCase();
    return allItems
      .filter((item) => {
        const matchLabel = item.label.toLowerCase().includes(lowerQuery);
        const matchSubLabel = item.subLabel?.toLowerCase().includes(lowerQuery);
        const matchKeywords = item.keywords?.some((k) =>
          k.toLowerCase().includes(lowerQuery),
        );
        return matchLabel || matchSubLabel || matchKeywords;
      })
      .slice(0, 10);
  }, [allItems, query, staticItems]);

  const handleSelect = (item: SearchItem) => {
    onDismiss();
    router.push(item.path as any);
  };

  const renderTypeBadge = (type: string) => {
    let bgColor = colors.primary + "20";
    let txtColor = colors.primary;
    let text = "Route";

    switch (type) {
      case "server":
        bgColor = colors.info + "20";
        txtColor = colors.info;
        text = "Server";
        break;
      case "project":
        bgColor = colors.accent + "20";
        txtColor = colors.accent;
        text = "Project";
        break;
      case "action":
        bgColor = colors.success + "20";
        txtColor = colors.success;
        text = "Action";
        break;
    }

    return (
      <View style={[styles.badge, { backgroundColor: bgColor }]}>
        <Text style={[styles.badgeText, { color: txtColor }]}>{text}</Text>
      </View>
    );
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContent}
        style={styles.modalWrapper}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "center" }}
        >
          <View style={styles.dialog}>
            <View style={styles.searchHeader}>
              <MaterialCommunityIcons
                name="magnify"
                size={24}
                color={colors.textSecondary}
              />
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder={t(
                  "common.searchPlaceholder",
                  "Search projects, servers...",
                )}
                placeholderTextColor={colors.textSecondary}
                value={query}
                onChangeText={setQuery}
                autoFocus={true}
                returnKeyType="search"
                autoCapitalize="none"
              />
              {query.length > 0 && (
                <IconButton
                  icon="close-circle"
                  size={20}
                  iconColor={colors.textSecondary}
                  onPress={() => setQuery("")}
                  style={{ margin: 0 }}
                />
              )}
            </View>

            <Divider style={{ backgroundColor: colors.border }} />

            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.list}
              contentContainerStyle={{ padding: 8 }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {t("common.noResultsFound", "No results found for")} "
                    {query}"
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.listItem}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.listIconBox}>
                    <MaterialCommunityIcons
                      name={item.icon as any}
                      size={24}
                      color={colors.textSecondary}
                    />
                  </View>
                  <View style={styles.listContent}>
                    <View style={styles.listTitleRow}>
                      <Text style={styles.listLabel} numberOfLines={1}>
                        {item.label}
                      </Text>
                      {renderTypeBadge(item.type)}
                    </View>
                    {item.subLabel && (
                      <Text style={styles.listSubLabel} numberOfLines={1}>
                        {item.subLabel}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    modalWrapper: {
      justifyContent: "flex-start",
      paddingTop: Platform.OS === "ios" ? 60 : 40,
      paddingHorizontal: 16,
    },
    modalContent: {
      flex: 1,
      justifyContent: "flex-start",
    },
    dialog: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      elevation: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      overflow: "hidden",
      maxHeight: "75%",
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.02)",
    },
    input: {
      flex: 1,
      color: colors.text,
      fontSize: 18,
      marginLeft: 12,
      paddingVertical: 4,
    },
    list: {
      maxHeight: 400,
    },
    emptyContainer: {
      padding: 32,
      alignItems: "center",
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: "center",
    },
    listItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 12,
      marginBottom: 4,
    },
    listIconBox: {
      width: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    listContent: {
      flex: 1,
      marginLeft: 8,
    },
    listTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    listLabel: {
      fontSize: 16,
      fontWeight: "500",
      color: colors.text,
      flexShrink: 1,
    },
    listSubLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: "700",
    },
  });
