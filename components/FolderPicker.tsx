import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import {
  Modal,
  Portal,
  Text,
  Button,
  IconButton,
  List,
  Divider,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import api from "../services/api";
import { useAppTheme } from "../contexts/ThemeContext";

interface FolderPickerProps {
  visible: boolean;
  onDismiss: () => void;
  serverId: string;
  initialPath?: string;
  onSelect: (path: string) => void;
  title?: string;
  actionLabel?: string;
}

interface FileEntry {
  name: string;
  type: "directory" | "file" | "symlink" | "d" | "-" | "l";
}

export default function FolderPicker({
  visible,
  onDismiss,
  serverId,
  initialPath = "/",
  onSelect,
  title = "Select Folder",
  actionLabel = "Select Here",
}: FolderPickerProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [currentPath, setCurrentPath] = useState(initialPath);
  const [folders, setFolders] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setCurrentPath(initialPath);
      setHistory([]);
      fetchFolders(initialPath);
    }
  }, [visible, serverId]);

  const fetchFolders = async (path: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/ftp/${serverId}/list`, {
        params: { path },
      });
      // Filter only directories
      const allEntries: FileEntry[] = res.data.entries || res.data;
      const dirs = allEntries.filter(
        (e) => e.type === "directory" || e.type === "d",
      );
      // Sort: . always first (current), .. second (parent), then alphabetical
      dirs.sort((a, b) => a.name.localeCompare(b.name));

      setFolders(dirs);
      setCurrentPath(res.data.path || path);
    } catch (err) {
      console.error("Failed to load folders", err);
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (folderName: string) => {
    const newPath =
      currentPath === "/" ? `/${folderName}` : `${currentPath}/${folderName}`;
    setHistory([...history, currentPath]);
    fetchFolders(newPath);
  };

  const goUp = () => {
    if (currentPath === "/") return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const newPath = "/" + parts.join("/");
    setHistory([...history, currentPath]);
    fetchFolders(newPath);
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modalContainer,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <IconButton
              icon="close"
              onPress={onDismiss}
              iconColor={colors.text}
            />
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {title}
            </Text>
          </View>
          <Button
            mode="contained"
            onPress={() => onSelect(currentPath)}
            buttonColor={colors.primary}
            textColor={colors.surface}
          >
            {actionLabel}
          </Button>
        </View>

        <View
          style={[
            styles.pathContainer,
            { backgroundColor: colors.surfaceVariant },
          ]}
        >
          <IconButton
            icon="arrow-up"
            size={20}
            onPress={goUp}
            disabled={currentPath === "/"}
            iconColor={colors.text}
          />
          <Text
            style={[styles.pathText, { color: colors.text }]}
            numberOfLines={1}
          >
            {currentPath}
          </Text>
        </View>
        <Divider />

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {folders.length === 0 ? (
              <Text
                style={{
                  textAlign: "center",
                  color: colors.textSecondary,
                  marginTop: 20,
                }}
              >
                No subfolders
              </Text>
            ) : (
              folders.map((folder, index) => (
                <List.Item
                  key={index}
                  title={folder.name}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon="folder"
                      color={colors.primary}
                    />
                  )}
                  onPress={() => navigateTo(folder.name)}
                  style={{ paddingVertical: 4 }}
                  titleStyle={{ color: colors.text }}
                />
              ))
            )}
          </ScrollView>
        )}
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  pathContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pathText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
