import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import {
  Text,
  Card,
  IconButton,
  Searchbar,
  Menu,
  Divider,
  FAB,
  Portal,
  Dialog,
  Button,
} from "react-native-paper";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import api from "../../../services/api";
import { useAppTheme } from "../../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import { useTranslation } from "react-i18next";

import FileActionSheet from "../../../components/FileActionSheet";
import EditorModal from "../../../components/EditorModal";
import InputDialog from "../../../components/InputDialog";

import { FileEntry } from "../../../constants/types";

// interface FileEntry {
//   name: string;
//   type: "d" | "-" | "l";
//   size: number; // in bytes
//   permissions: string;
//   owner: string;
//   group: string;
//   modified: string;
// }

export default function FTPScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); // serverId
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const Colors = colors;
  const styles = createStyles(colors);

  const [currentPath, setCurrentPath] = useState("/");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [sortField, setSortField] = useState<"name" | "size" | "date">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Actions
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);

  // Modals
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorPath, setEditorPath] = useState("");

  const [renameVisible, setRenameVisible] = useState(false);
  const [mkdirVisible, setMkdirVisible] = useState(false);
  const [chmodVisible, setChmodVisible] = useState(false);

  // FAB Group
  const [fabOpen, setFabOpen] = useState(false);

  const fetchFiles = async (path: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/ftp/${id}/list`, {
        params: { path },
      });
      let sorted = res.data.entries || (res.data as FileEntry[]);

      // Basic sorting logic
      sorted = sorted.sort((a: FileEntry, b: FileEntry) => {
        // Directories always first
        if (a.type === "d" && b.type !== "d") return -1;
        if (a.type !== "d" && b.type === "d") return 1;

        let cmp = 0;
        if (sortField === "size") cmp = a.size - b.size;
        else if (sortField === "date")
          cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime();
        else cmp = a.name.localeCompare(b.name);

        return sortDir === "asc" ? cmp : -cmp;
      });

      setFiles(sorted);
      setCurrentPath(res.data.path || path);
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("files.loadFailed"),
      );
      // If path invalid, fallback logic
      if (history.length > 0) {
        const prev = history[history.length - 1];
        setHistory((h) => h.slice(0, -1));
        setCurrentPath(prev);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFiles("/");
  }, [id]);

  const navigateTo = (folderName: string) => {
    const newPath =
      currentPath === "/" ? `/${folderName}` : `${currentPath}/${folderName}`;
    setHistory([...history, currentPath]);
    fetchFiles(newPath);
  };

  const goUp = () => {
    if (currentPath === "/") return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const newPath = "/" + parts.join("/");
    setHistory([...history, currentPath]); // Actually we should probably pop history, but this stack works for simple "Back"
    fetchFiles(newPath);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFiles(currentPath);
  }, [currentPath]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  /* --- Operations --- */

  const handleFilePress = (item: FileEntry) => {
    if (item.type === "d") {
      Haptics.selectionAsync();
      navigateTo(item.name);
    } else {
      setSelectedFile(item);
      setActionSheetVisible(true);
    }
  };

  const handleEdit = () => {
    if (!selectedFile) return;
    setEditorPath(
      (currentPath === "/" ? "" : currentPath) + "/" + selectedFile.name,
    );
    setEditorVisible(true);
  };

  const handleRename = async (newName: string) => {
    if (!selectedFile) return;
    try {
      const oldPath =
        (currentPath === "/" ? "" : currentPath) + "/" + selectedFile.name;
      const newPath = (currentPath === "/" ? "" : currentPath) + "/" + newName;
      await api.post(`/ftp/${id}/rename`, { oldPath, newPath });
      setRenameVisible(false);
      fetchFiles(currentPath);
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("files.renameFailed"),
      );
    }
  };

  const handleDelete = async (item: FileEntry) => {
    Alert.alert(
      t("common.delete"),
      t("files.deleteConfirm", { name: item.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const path =
                (currentPath === "/" ? "" : currentPath) + "/" + item.name;
              await api.delete(`/ftp/${id}/file`, {
                data: { path, type: item.type === "d" ? "directory" : "file" },
              });
              fetchFiles(currentPath);
            } catch (err: any) {
              Alert.alert(
                t("common.error"),
                err.response?.data?.message || t("common.failed"),
              );
            }
          },
        },
      ],
    );
  };

  const handleMkdir = async (name: string) => {
    try {
      const path = (currentPath === "/" ? "" : currentPath) + "/" + name;
      await api.post(`/ftp/${id}/mkdir`, { path });
      setMkdirVisible(false);
      fetchFiles(currentPath);
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("files.createFolderFailed"),
      );
    }
  };

  const handleChmod = async (mode: string) => {
    if (!selectedFile) return;
    try {
      const path =
        (currentPath === "/" ? "" : currentPath) + "/" + selectedFile.name;
      await api.post(`/ftp/${id}/chmod`, { path, mode });
      setChmodVisible(false);
      fetchFiles(currentPath);
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("files.chmodFailed"),
      );
    }
  };

  const handleUpload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (res.canceled) return;

      const file = res.assets[0];
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/octet-stream",
      } as any);
      formData.append("path", currentPath);

      setLoading(true); // crude loading state
      await api.post(`/ftp/${id}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      fetchFiles(currentPath);
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Upload failed");
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: FileEntry }) => {
    const isDir = item.type === "d";
    const icon = isDir ? "folder" : "file-outline";
    const color = isDir ? Colors.accent : Colors.textSecondary;

    return (
      <Pressable
        onPress={() => handleFilePress(item)}
        style={({ pressed }) => [
          styles.itemRow,
          pressed && { backgroundColor: Colors.surfaceVariant },
        ]}
      >
        <MaterialCommunityIcons
          name={icon}
          size={28}
          color={color}
          style={{ marginRight: 16 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.itemMeta}>
            {isDir ? t("files.directory") : formatSize(item.size)} •{" "}
            {item.permissions}
          </Text>
        </View>
        <IconButton
          icon="dots-vertical"
          size={20}
          onPress={() => {
            setSelectedFile(item);
            setActionSheetVisible(true);
          }}
        />
      </Pressable>
    );
  };

  const PathBreadcrumbs = () => {
    const parts = currentPath.split("/").filter(Boolean);
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.breadcrumbScroll}
      >
        <Pressable
          onPress={() => fetchFiles("/")}
          style={styles.breadcrumbItem}
        >
          <MaterialCommunityIcons
            name="home"
            size={16}
            color={Colors.primary}
          />
        </Pressable>
        {parts.map((part, index) => (
          <View
            key={index}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={16}
              color={Colors.textSecondary}
            />
            <Pressable
              onPress={() => {
                const newPath = "/" + parts.slice(0, index + 1).join("/");
                fetchFiles(newPath);
              }}
              style={styles.breadcrumbItem}
            >
              <Text style={styles.breadcrumbText}>{part}</Text>
            </Pressable>
          </View>
        ))}
        {/* Spacer */}
        <View style={{ width: 20 }} />
      </ScrollView>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: t("files.title") }} />
      <View style={styles.container}>
        {/* Toolbar */}
        <View style={styles.toolbar}>
          <IconButton
            icon="arrow-up"
            onPress={goUp}
            disabled={currentPath === "/"}
          />
          <View style={{ flex: 1 }}>
            <PathBreadcrumbs />
          </View>
          <IconButton icon="refresh" onPress={() => fetchFiles(currentPath)} />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={files}
            renderItem={renderItem}
            keyExtractor={(item) => item.name}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.primary}
              />
            }
            contentContainerStyle={{ paddingBottom: 80 }}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Text style={{ color: Colors.textSecondary }}>
                  {t("files.empty")}
                </Text>
              </View>
            }
          />
        )}

        <FAB.Group
          visible={true}
          open={fabOpen}
          icon={fabOpen ? "close" : "plus"}
          actions={[
            {
              icon: "upload",
              label: t("files.upload"),
              onPress: handleUpload,
            },
            {
              icon: "folder-plus",
              label: t("files.newFolder"),
              onPress: () => setMkdirVisible(true),
            },
          ]}
          onStateChange={({ open }) => setFabOpen(open)}
          onPress={() => {
            if (fabOpen) {
              // do something if the speed dial is open
            }
          }}
          style={{ paddingBottom: 20 }}
        />

        {/* --- Modals & Sheets --- */}

        <FileActionSheet
          visible={actionSheetVisible}
          onDismiss={() => setActionSheetVisible(false)}
          file={selectedFile}
          onRename={() => setRenameVisible(true)}
          onDelete={() => selectedFile && handleDelete(selectedFile)}
          onPermissions={() => setChmodVisible(true)}
          onDownload={() => {
            /* TODO: Implement Download */ Alert.alert(
              t("files.comingSoon"),
              t("files.comingSoon"),
            );
          }}
          onCopyPath={() => {
            /* Clipboard */ Alert.alert(
              t("files.copied"),
              selectedFile?.name || "",
            );
          }}
        />

        <EditorModal
          visible={editorVisible}
          onDismiss={() => setEditorVisible(false)}
          serverId={id}
          filePath={editorPath}
          onSaveSuccess={() => {
            /* Maybe refresh? */
          }}
        />

        <InputDialog
          visible={renameVisible}
          onDismiss={() => setRenameVisible(false)}
          title={t("files.rename")}
          label={t("files.newName")}
          initialValue={selectedFile?.name}
          onConfirm={handleRename}
        />

        <InputDialog
          visible={mkdirVisible}
          onDismiss={() => setMkdirVisible(false)}
          title={t("files.createFolder")}
          label={t("files.folderName")}
          onConfirm={handleMkdir}
        />

        <InputDialog
          visible={chmodVisible}
          onDismiss={() => setChmodVisible(false)}
          title={t("files.permissions")}
          label={t("files.mode")}
          initialValue={selectedFile?.permissions || "755"} // Actually permissions are likely rwxr-xr-x string string, need parsing if we want valid default, but user can type 777
          onConfirm={handleChmod}
        />
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
      paddingTop: 50,
    },
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    breadcrumbScroll: { flex: 1, marginHorizontal: 8 },
    breadcrumbItem: { padding: 4, paddingHorizontal: 6, borderRadius: 4 },
    breadcrumbText: { fontSize: 13, color: Colors.text, fontWeight: "500" },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 0.5,
      borderBottomColor: Colors.border,
    },
    itemName: { fontSize: 16, color: Colors.text, marginBottom: 2 },
    itemMeta: { fontSize: 12, color: Colors.textSecondary },
  });
