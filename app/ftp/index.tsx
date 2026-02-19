import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  RadioButton,
  List,
  Modal,
} from "react-native-paper";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import api from "../../services/api";
import { useAppTheme } from "../../contexts/ThemeContext";
import { useServer } from "../../contexts/ServerContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import { getFileIcon } from "../../utils/getFileIcon";

import FileActionSheet from "../../components/FileActionSheet";
import EditorModal from "../../components/EditorModal";
import ImagePreviewModal from "../../components/ImagePreviewModal";
import InputDialog from "../../components/InputDialog";
import FolderPicker from "../../components/FolderPicker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import CustomAlertDialog, {
  CustomAlertDialogRef,
} from "../../components/CustomAlertDialog";

interface FileEntry {
  name: string;
  type: "directory" | "file" | "symlink" | "d" | "-" | "l"; // Support both just in case, though backend sends "directory"
  size: number; // in bytes
  permissions: string;
  owner: string;
  group: string;
  modified: string;
}

export default function FTPScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const Colors = colors;
  const styles = createStyles(colors);

  const { selectedServer } = useServer();

  const [currentPath, setCurrentPath] = useState("/");
  const [rawFiles, setRawFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // View State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [sortField, setSortField] = useState<"name" | "size" | "date">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [sortVisible, setSortVisible] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  // Bookmarks & Recents
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [quickAccessVisible, setQuickAccessVisible] = useState(false);

  // Selection Mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Actions
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);

  // Modals
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorPath, setEditorPath] = useState("");

  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);

  const [renameVisible, setRenameVisible] = useState(false);
  const [mkdirVisible, setMkdirVisible] = useState(false);
  // const [mkdirVisible, setMkdirVisible] = useState(false); // FIXED: Removed duplicate
  const [chmodVisible, setChmodVisible] = useState(false);

  // Picker
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<"move" | "copy">("move");
  const [pickerSource, setPickerSource] = useState<FileEntry | null>(null);

  const dialogRef = useRef<CustomAlertDialogRef>(null);

  // Zip
  const [zipVisible, setZipVisible] = useState(false); // Using InputDialog for name

  // Properties
  const [propertiesVisible, setPropertiesVisible] = useState(false);
  const [propertiesFile, setPropertiesFile] = useState<FileEntry | null>(null);

  // FAB Group - REMOVED
  // const [fabOpen, setFabOpen] = useState(false);
  const [addMenuVisible, setAddMenuVisible] = useState(false);

  const isDirectory = (item: FileEntry) => {
    return item.type === "directory" || item.type === "d";
  };

  const fetchFiles = async (path: string) => {
    if (!selectedServer) return;
    setLoading(true);
    try {
      const res = await api.get(`/ftp/${selectedServer._id}/list`, {
        params: { path },
      });
      // Just set raw data, processing happens in useMemo
      setRawFiles(res.data.entries || (res.data as FileEntry[]));
      setCurrentPath(res.data.path || path);
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.response?.data?.message || "Failed to load files",
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

  // Derived State: Processed Files (Filter & Sort)
  const processedFiles = useMemo(() => {
    let result = [...rawFiles];

    // 1. Filter
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter((file) =>
        file.name.toLowerCase().includes(lowerQuery),
      );
    }

    // 2. Sort
    result.sort((a, b) => {
      const aIsDir = isDirectory(a);
      const bIsDir = isDirectory(b);

      // Directories always first
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;

      let cmp = 0;
      if (sortField === "size") cmp = a.size - b.size;
      if (sortField === "size") cmp = a.size - b.size;
      else if (sortField === "date")
        cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime();
      else cmp = a.name.localeCompare(b.name);

      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [rawFiles, searchQuery, sortField, sortDir]);

  useEffect(() => {
    if (selectedServer) {
      loadBookmarksAndRecents();
      fetchFiles("/");
    }
  }, [selectedServer?._id]);

  const loadBookmarksAndRecents = async () => {
    if (!selectedServer) return;
    try {
      const b = await AsyncStorage.getItem(`bookmarks_${selectedServer._id}`);
      if (b) setBookmarks(JSON.parse(b));

      const r = await AsyncStorage.getItem(`recents_${selectedServer._id}`);
      if (r) setRecentFiles(JSON.parse(r));
    } catch (e) {
      console.error("Failed to load bookmarks/recents", e);
    }
  };

  const toggleBookmark = async (path: string) => {
    if (!selectedServer) return;
    let newBookmarks;
    if (bookmarks.includes(path)) {
      newBookmarks = bookmarks.filter((b) => b !== path);
      // dialogRef.current?.show("Bookmark Removed", path);
    } else {
      newBookmarks = [...bookmarks, path];
      // dialogRef.current?.show("Bookmark Added", path);
    }
    setBookmarks(newBookmarks);
    await AsyncStorage.setItem(
      `bookmarks_${selectedServer._id}`,
      JSON.stringify(newBookmarks),
    );
  };

  const addToRecents = async (path: string) => {
    if (!selectedServer) return;
    let newRecents = [path, ...recentFiles.filter((p) => p !== path)].slice(
      0,
      10,
    ); // Keep last 10
    setRecentFiles(newRecents);
    await AsyncStorage.setItem(
      `recents_${selectedServer._id}`,
      JSON.stringify(newRecents),
    );
  };

  const navigateTo = (folderName: string) => {
    const newPath =
      currentPath === "/" ? `/${folderName}` : `${currentPath}/${folderName}`;
    setHistory([...history, currentPath]);
    addToRecents(newPath); // Add to recents
    fetchFiles(newPath);
  };

  const goUp = () => {
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedItems(new Set());
      return;
    }
    if (currentPath === "/") return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const newPath = "/" + parts.join("/");
    setHistory([...history, currentPath]);
    fetchFiles(newPath);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (selectedServer) fetchFiles(currentPath);
  }, [currentPath, selectedServer]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  /* --- Operations --- */

  const handleFilePress = (item: FileEntry) => {
    if (selectionMode) {
      toggleSelection(item.name);
    } else if (isDirectory(item)) {
      Haptics.selectionAsync();
      navigateTo(item.name);
    } else {
      // Open Editor/Preview
      setEditorPath((currentPath === "/" ? "" : currentPath) + "/" + item.name);
      setEditorVisible(true);
    }
  };

  const handleLongPress = (item: FileEntry) => {
    if (!selectionMode) {
      setSelectionMode(true);
      const newSet = new Set<string>();
      newSet.add(item.name);
      setSelectedItems(newSet);
      Haptics.selectionAsync();
    } else {
      toggleSelection(item.name);
    }
  };

  const toggleSelection = (name: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(name)) {
      newSet.delete(name);
      if (newSet.size === 0) setSelectionMode(false);
    } else {
      newSet.add(name);
    }
    setSelectedItems(newSet);
  };

  const handleRename = async (newName: string) => {
    if (!selectedFile || !selectedServer) return;
    try {
      const oldPath =
        (currentPath === "/" ? "" : currentPath) + "/" + selectedFile.name;
      const newPath = (currentPath === "/" ? "" : currentPath) + "/" + newName;
      await api.post(`/ftp/${selectedServer._id}/rename`, { oldPath, newPath });
      setRenameVisible(false);
      fetchFiles(currentPath);
    } catch (err: any) {
      dialogRef.current?.show(
        "Error",
        err.response?.data?.message || "Rename failed",
      );
    }
  };

  const handleDelete = async (item: FileEntry) => {
    if (!selectedServer) return;
    dialogRef.current?.confirm(
      "Delete",
      `Are you sure you want to delete ${item.name}?`,
      async () => {
        try {
          const path =
            (currentPath === "/" ? "" : currentPath) + "/" + item.name;
          await api.delete(`/ftp/${selectedServer._id}/file`, {
            data: {
              path,
              type: isDirectory(item) ? "directory" : "file",
            },
          });
          fetchFiles(currentPath);
        } catch (err: any) {
          dialogRef.current?.show(
            "Error",
            err.response?.data?.message || "Delete failed",
          );
        }
      },
      "Delete",
      true,
    );
  };

  const handleMkdir = async (name: string) => {
    if (!selectedServer) return;
    try {
      const path = (currentPath === "/" ? "" : currentPath) + "/" + name;
      await api.post(`/ftp/${selectedServer._id}/mkdir`, { path });
      setMkdirVisible(false);
      fetchFiles(currentPath);
    } catch (err: any) {
      dialogRef.current?.show(
        "Error",
        err.response?.data?.message || "Create folder failed",
      );
    }
  };

  const handleChmod = async (mode: string) => {
    if (!selectedFile || !selectedServer) return;
    try {
      const path =
        (currentPath === "/" ? "" : currentPath) + "/" + selectedFile.name;
      await api.post(`/ftp/${selectedServer._id}/chmod`, { path, mode });
      setChmodVisible(false);
      fetchFiles(currentPath);
    } catch (err: any) {
      dialogRef.current?.show(
        "Error",
        err.response?.data?.message || "Chmod failed",
      );
    }
  };

  const handleUpload = async () => {
    if (!selectedServer) return;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (res.canceled) return;

      setLoading(true);

      // Upload sequentially for now
      for (const file of res.assets) {
        const formData = new FormData();
        formData.append("file", {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || "application/octet-stream",
        } as any);
        formData.append("path", currentPath);

        await api.post(`/ftp/${selectedServer._id}/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      fetchFiles(currentPath);
      dialogRef.current?.show("Success", `Uploaded ${res.assets.length} items`);
    } catch (err: any) {
      dialogRef.current?.show(
        "Error",
        err.response?.data?.message || "Upload failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const initMoveOrCopy = (item: FileEntry, mode: "move" | "copy") => {
    setPickerSource(item);
    setPickerMode(mode);
    setPickerVisible(true);
  };

  const handleMoveOrCopySubmit = async (destPath: string) => {
    if (!selectedServer || !pickerSource) return;
    const sourcePath =
      (currentPath === "/" ? "" : currentPath) + "/" + pickerSource.name;
    const destinationPath =
      (destPath === "/" ? "" : destPath) + "/" + pickerSource.name;

    setPickerVisible(false);
    setLoading(true);

    try {
      if (pickerMode === "move") {
        await api.post(`/ftp/${selectedServer._id}/rename`, {
          oldPath: sourcePath,
          newPath: destinationPath,
        });
        dialogRef.current?.show("Success", `Moved to ${destPath}`);
      } else {
        await api.post(`/ftp/${selectedServer._id}/copy`, {
          sourcePath,
          destPath: destinationPath,
        });
        dialogRef.current?.show("Success", `Copied to ${destPath}`);
      }
      fetchFiles(currentPath);
    } catch (err: any) {
      dialogRef.current?.show(
        "Error",
        err.response?.data?.message || "Operation failed",
      );
    } finally {
      setLoading(false);
      setPickerSource(null);
    }
  };

  const initZip = (item: FileEntry) => {
    setSelectedFile(item);
    setZipVisible(true);
  };

  const handleZip = async (name: string) => {
    if (!selectedServer || !selectedFile) return;
    const archiveName = name.endsWith(".zip") ? name : name + ".zip";
    const basePath = currentPath;

    setZipVisible(false);
    setLoading(true);
    try {
      await api.post(`/ftp/${selectedServer._id}/zip`, {
        basePath,
        items: [selectedFile.name], // Currently only supporting single item zip from menu
        archiveName,
      });
      dialogRef.current?.show("Success", "Archive created");
      fetchFiles(currentPath);
    } catch (err: any) {
      dialogRef.current?.show(
        "Error",
        err.response?.data?.message || "Zip failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUnzip = async (item: FileEntry) => {
    if (!selectedServer) return;
    dialogRef.current?.confirm(
      "Unzip",
      `Extract ${item.name} here?`,
      async () => {
        setLoading(true);
        try {
          const archivePath =
            (currentPath === "/" ? "" : currentPath) + "/" + item.name;
          await api.post(`/ftp/${selectedServer._id}/unzip`, {
            archivePath,
            destPath: currentPath,
          });
          dialogRef.current?.show("Success", "Extracted successfully");
          fetchFiles(currentPath);
        } catch (err: any) {
          dialogRef.current?.show(
            "Error",
            err.response?.data?.message || "Unzip failed",
          );
        } finally {
          setLoading(false);
        }
      },
      "Extract",
    );
  };

  const handleDownload = async (item: FileEntry) => {
    if (!selectedServer) return;
    if (isDirectory(item)) {
      dialogRef.current?.show(
        "Notice",
        "Folder download not yet supported directly. Please zip it first.",
      );
      return;
    }

    setLoading(true);
    try {
      const filePath =
        (currentPath === "/" ? "" : currentPath) + "/" + item.name;
      const downloadRes = await api.get(`/ftp/${selectedServer._id}/download`, {
        params: { path: filePath },
        responseType: "arraybuffer", // Important for binary
      });

      // Expo FileSystem logic
      const fileUri =
        (FileSystem.documentDirectory || FileSystem.cacheDirectory) + item.name;
      // Write base64 or similar. Axios arraybuffer in RN needs handling
      // Actually, simplest way with Auth is just passing token in URL, but we have Bearer auth.
      // Better: Use FileSystem.downloadAsync with headers.

      const token = await AsyncStorage.getItem("accessToken"); // Need to get token.
      // AsyncStorage import is already there.

      // Construct API URL
      // We need generic API URL. api.defaults.baseURL might be set.
      // Assuming api.getUri() or we know the base.
      // Let's rely on api instance base URL if possible or hardcode/env.
      // For now, let's try writing the data we got from axios if small enough, but binary handling in JS bridge is slow.
      // Correct approach: FileSystem.downloadAsync

      // HACK: Reconstruct URL.
      // api.defaults.baseURL is usually set.
      const baseUrl = api.defaults.baseURL || "http://localhost:5000/api";
      const downloadUrl = `${baseUrl}/ftp/${selectedServer._id}/download?path=${encodeURIComponent(filePath)}`;

      const result = await FileSystem.downloadAsync(downloadUrl, fileUri, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (result.status === 200) {
        if (Platform.OS === "android" || Platform.OS === "ios") {
          await Sharing.shareAsync(result.uri);
        }
      } else {
        throw new Error("Download status " + result.status);
      }
    } catch (err: any) {
      console.error(err);
      dialogRef.current?.show("Error", "Download failed");
    } finally {
      setLoading(false);
    }
  };

  const handleProperties = (item: FileEntry) => {
    setPropertiesFile(item);
    setPropertiesVisible(true);
  };

  const handlePreview = (item: FileEntry) => {
    if (isDirectory(item)) return;

    const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"];
    const isImage = imageExtensions.some((ext) =>
      item.name.toLowerCase().endsWith(ext),
    );

    if (isImage) {
      setPreviewFile(item);
      setImagePreviewVisible(true);
    } else {
      // Fallback to editor for text files
      handleEdit(item);
    }
  };

  const handleEdit = (item?: FileEntry) => {
    const target = item || selectedFile;
    if (!target) return;

    setEditorPath((currentPath === "/" ? "" : currentPath) + "/" + target.name);
    setEditorVisible(true);
  };

  const handleBatchDelete = async () => {
    if (!selectedServer || selectedItems.size === 0) return;
    dialogRef.current?.confirm(
      "Delete",
      `Delete ${selectedItems.size} items?`,
      async () => {
        try {
          setLoading(true);
          // Requires backend support for batch delete or loop
          // Using loop for now if backend doesn't support batch
          // EDIT: Backend SftpService.ts has deleteItems method but API might not expose it yet.
          // Checking API implementation... assuming standard loop for safety or single batch endpoint if I added it.
          // Use a loop for now to be safe
          for (const name of Array.from(selectedItems)) {
            const item = processedFiles.find((f) => f.name === name);
            if (!item) continue;

            const path = (currentPath === "/" ? "" : currentPath) + "/" + name;
            // Send as query params for better compatibility with some backends/proxies for DELETE
            await api.delete(`/ftp/${selectedServer._id}/file`, {
              params: {
                path,
                type: isDirectory(item) ? "directory" : "file",
              },
            });
          }

          setSelectionMode(false);
          setSelectedItems(new Set());
          fetchFiles(currentPath);
        } catch (err: any) {
          dialogRef.current?.show("Error", "Failed to delete some items");
          fetchFiles(currentPath);
        } finally {
          setLoading(false);
        }
      },
      "Delete",
      true,
    );
  };

  const SelectAll = () => {
    const newSet = new Set(processedFiles.map((f) => f.name));
    setSelectedItems(newSet);
  };

  const renderItem = ({ item }: { item: FileEntry }) => {
    const isDir = isDirectory(item);
    const { name: icon, color } = getFileIcon(item.name, isDir);

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
          size={32} // Slightly larger for better visibility
          color={color}
          style={{ marginRight: 16 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.itemMeta}>
            {isDir ? "Directory" : formatSize(item.size)} • {item.permissions}
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
        contentContainerStyle={{ alignItems: "center" }}
        style={styles.breadcrumbScroll}
      >
        <Pressable
          onPress={() => {
            if (selectedServer) fetchFiles("/");
          }}
          style={[styles.breadcrumbItem, { paddingLeft: 0 }]}
        >
          <MaterialCommunityIcons
            name="home"
            size={22}
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
              size={18}
              color={Colors.textSecondary}
              style={{ marginHorizontal: 2 }}
            />
            <Pressable
              onPress={() => {
                if (selectedServer) {
                  const newPath = "/" + parts.slice(0, index + 1).join("/");
                  fetchFiles(newPath);
                }
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

  if (!selectedServer) {
    return (
      <View style={styles.centered}>
        <Text>Please select an active server first.</Text>
      </View>
    );
  }

  const handleOpenTerminal = (item?: FileEntry) => {
    if (!selectedServer) return;
    const path = item
      ? (currentPath === "/" ? "" : currentPath) + "/" + item.name
      : currentPath;

    router.push({
      pathname: `/server/${selectedServer._id}/terminal`,
      params: { path, id: selectedServer._id },
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: selectionMode
            ? `${selectedItems.size} selected`
            : "File Manager",
          headerLeft: selectionMode
            ? () => (
                <IconButton
                  icon="close"
                  onPress={() => {
                    setSelectionMode(false);
                    setSelectedItems(new Set());
                  }}
                />
              )
            : undefined,
          headerBackVisible: !selectionMode,
          headerBackTitle: "Back",
          headerRight: () =>
            selectionMode ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <IconButton icon="select-all" onPress={SelectAll} />
                <IconButton
                  icon="delete"
                  iconColor={Colors.error}
                  onPress={handleBatchDelete}
                />
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <IconButton
                  icon="console"
                  onPress={() => handleOpenTerminal()}
                />
                <Menu
                  visible={addMenuVisible}
                  onDismiss={() => setAddMenuVisible(false)}
                  anchor={
                    <IconButton
                      icon="plus"
                      onPress={() => setAddMenuVisible(true)}
                      iconColor={Colors.text}
                    />
                  }
                >
                  <Menu.Item
                    onPress={() => {
                      setAddMenuVisible(false);
                      handleUpload();
                    }}
                    title="Upload File"
                    leadingIcon="upload"
                  />
                  <Menu.Item
                    onPress={() => {
                      setAddMenuVisible(false);
                      setMkdirVisible(true);
                    }}
                    title="New Folder"
                    leadingIcon="folder-plus"
                  />
                </Menu>
                <IconButton
                  icon="sort"
                  onPress={() => setSortVisible(true)}
                  iconColor={Colors.text}
                />
                <IconButton
                  icon={isSearching ? "close" : "magnify"}
                  onPress={() => {
                    if (isSearching) {
                      setSearchQuery("");
                      setIsSearching(false);
                    } else {
                      setIsSearching(true);
                    }
                  }}
                  iconColor={Colors.text}
                />
                <IconButton
                  icon="star-outline"
                  onPress={() => setQuickAccessVisible(true)}
                  iconColor={Colors.text}
                />
              </View>
            ),
        }}
      />
      <View style={styles.container}>
        {/* Toolbar */}
        <View style={styles.toolbar}>
          {isSearching ? (
            <Searchbar
              placeholder="Search files..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              autoFocus
              style={styles.searchBar}
              inputStyle={styles.searchBarInput}
              iconColor={Colors.textSecondary}
              placeholderTextColor={Colors.textSecondary}
              elevation={0}
            />
          ) : (
            <>
              <IconButton
                icon="arrow-left"
                onPress={goUp}
                disabled={currentPath === "/"}
              />
              <View style={{ flex: 1, overflow: "hidden" }}>
                <PathBreadcrumbs />
              </View>
              <IconButton
                icon="refresh"
                onPress={() => fetchFiles(currentPath)}
              />
            </>
          )}
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={processedFiles}
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
                  Empty folder or Loading...
                </Text>
              </View>
            }
          />
        )}

        {/* FAB Removed in favor of Header Action */}

        {/* --- Modals & Sheets --- */}

        <FileActionSheet
          visible={actionSheetVisible}
          onDismiss={() => setActionSheetVisible(false)}
          file={selectedFile}
          onRename={() => setRenameVisible(true)}
          onDelete={() => selectedFile && handleDelete(selectedFile)}
          onPermissions={() => setChmodVisible(true)}
          onDownload={(file) => handleDownload(file)}
          onMove={(file) => initMoveOrCopy(file, "move")}
          onCopy={(file) => initMoveOrCopy(file, "copy")}
          onZip={(file) => initZip(file)}
          onUnzip={(file) => handleUnzip(file)}
          onProperties={(file) => handleProperties(file)}
          onPreview={(file) => handlePreview(file)}
          onEdit={(file) => handleEdit(file)}
          onTerminal={(file) => handleOpenTerminal(file)}
          onCopyPath={() => {
            /* Clipboard */ dialogRef.current?.show(
              "Copied",
              selectedFile?.name || "",
            );
          }}
          isBookmarked={
            !!selectedFile &&
            bookmarks.includes(
              (currentPath === "/" ? "" : currentPath) +
                "/" +
                selectedFile.name,
            )
          }
          onToggleBookmark={() => {
            if (selectedFile) {
              toggleBookmark(
                (currentPath === "/" ? "" : currentPath) +
                  "/" +
                  selectedFile.name,
              );
            }
          }}
        />

        <ImagePreviewModal
          visible={imagePreviewVisible}
          onDismiss={() => setImagePreviewVisible(false)}
          serverId={selectedServer._id}
          filePath={
            (currentPath === "/" ? "" : currentPath) +
            "/" +
            (previewFile?.name || "")
          }
          fileName={previewFile?.name || ""}
        />

        <EditorModal
          visible={editorVisible}
          onDismiss={() => setEditorVisible(false)}
          serverId={selectedServer._id}
          filePath={editorPath}
          onSaveSuccess={() => {
            /* Maybe refresh? */
          }}
        />

        <InputDialog
          visible={renameVisible}
          onDismiss={() => setRenameVisible(false)}
          title="Rename"
          label="New Name"
          initialValue={selectedFile?.name}
          onConfirm={handleRename}
        />

        <InputDialog
          visible={mkdirVisible}
          onDismiss={() => setMkdirVisible(false)}
          title="Create Folder"
          label="Folder Name"
          onConfirm={handleMkdir}
        />

        <InputDialog
          visible={chmodVisible}
          onDismiss={() => setChmodVisible(false)}
          title="Change Permissions (Octal)"
          label="Mode (e.g. 755)"
          initialValue={selectedFile?.permissions || "755"}
          onConfirm={handleChmod}
        />

        <InputDialog
          visible={zipVisible}
          onDismiss={() => setZipVisible(false)}
          title="Archive Name"
          label="Name (e.g. backup.zip)"
          initialValue={
            selectedFile ? `${selectedFile.name}.zip` : "archive.zip"
          }
          onConfirm={handleZip}
        />

        {/* Properties Dialog */}
        <Portal>
          <Dialog
            visible={propertiesVisible}
            onDismiss={() => setPropertiesVisible(false)}
            style={{ backgroundColor: Colors.surface }}
          >
            <Dialog.Title>Properties</Dialog.Title>
            <Dialog.Content>
              {propertiesFile && (
                <View>
                  <View style={styles.propertyRow}>
                    <Text style={styles.propertyLabel}>Name:</Text>
                    <Text style={styles.propertyValue} numberOfLines={1}>
                      {propertiesFile.name}
                    </Text>
                  </View>
                  <Divider style={{ marginVertical: 8 }} />
                  <View style={styles.propertyRow}>
                    <Text style={styles.propertyLabel}>Type:</Text>
                    <Text style={styles.propertyValue}>
                      {propertiesFile.type}
                    </Text>
                  </View>
                  <Divider style={{ marginVertical: 8 }} />
                  <View style={styles.propertyRow}>
                    <Text style={styles.propertyLabel}>Size:</Text>
                    <Text style={styles.propertyValue}>
                      {isDirectory(propertiesFile)
                        ? "Directory"
                        : formatSize(propertiesFile.size)}
                    </Text>
                  </View>
                  <Divider style={{ marginVertical: 8 }} />
                  <View style={styles.propertyRow}>
                    <Text style={styles.propertyLabel}>Permissions:</Text>
                    <Text style={styles.propertyValue}>
                      {propertiesFile.permissions}
                    </Text>
                  </View>
                  <Divider style={{ marginVertical: 8 }} />
                  <View style={styles.propertyRow}>
                    <Text style={styles.propertyLabel}>Owner:</Text>
                    <Text style={styles.propertyValue}>
                      {propertiesFile.owner}:{propertiesFile.group}
                    </Text>
                  </View>
                  <Divider style={{ marginVertical: 8 }} />
                  <View style={styles.propertyRow}>
                    <Text style={styles.propertyLabel}>Date:</Text>
                    <Text style={styles.propertyValue}>
                      {new Date(propertiesFile.modified).toLocaleString()}
                    </Text>
                  </View>
                </View>
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setPropertiesVisible(false)}>Close</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        <FolderPicker
          visible={pickerVisible}
          onDismiss={() => setPickerVisible(false)}
          serverId={selectedServer._id}
          initialPath={currentPath}
          title={pickerMode === "move" ? "Move to..." : "Copy to..."}
          actionLabel={pickerMode === "move" ? "Move Here" : "Copy Here"}
          onSelect={handleMoveOrCopySubmit}
        />

        {/* Sort Modal */}
        <Portal>
          <Modal
            visible={sortVisible}
            onDismiss={() => setSortVisible(false)}
            contentContainerStyle={[
              styles.modalContainer,
              { paddingTop: insets.top, paddingBottom: insets.bottom },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort Options</Text>
              <IconButton icon="close" onPress={() => setSortVisible(false)} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={styles.sectionTitle}>Sort By</Text>
              <RadioButton.Group
                onValueChange={(val) => setSortField(val as any)}
                value={sortField}
              >
                <List.Item
                  title="Name"
                  left={() => <List.Icon icon="format-title" />}
                  right={() => <RadioButton value="name" />}
                  onPress={() => setSortField("name")}
                />
                <List.Item
                  title="Size"
                  left={() => <List.Icon icon="scale" />}
                  right={() => <RadioButton value="size" />}
                  onPress={() => setSortField("size")}
                />
                <List.Item
                  title="Date"
                  left={() => <List.Icon icon="calendar" />}
                  right={() => <RadioButton value="date" />}
                  onPress={() => setSortField("date")}
                />
              </RadioButton.Group>

              <Divider style={{ marginVertical: 16 }} />

              <Text style={styles.sectionTitle}>Order</Text>
              <RadioButton.Group
                onValueChange={(val) => setSortDir(val as any)}
                value={sortDir}
              >
                <List.Item
                  title="Ascending (A-Z, 0-9)"
                  left={() => <List.Icon icon="sort-ascending" />}
                  right={() => <RadioButton value="asc" />}
                  onPress={() => setSortDir("asc")}
                />
                <List.Item
                  title="Descending (Z-A, 9-0)"
                  left={() => <List.Icon icon="sort-descending" />}
                  right={() => <RadioButton value="desc" />}
                  onPress={() => setSortDir("desc")}
                />
              </RadioButton.Group>
            </ScrollView>
            <View style={{ padding: 16 }}>
              <Button mode="contained" onPress={() => setSortVisible(false)}>
                Done
              </Button>
            </View>
          </Modal>
        </Portal>

        {/* Quick Access Modal */}
        <Portal>
          <Modal
            visible={quickAccessVisible}
            onDismiss={() => setQuickAccessVisible(false)}
            contentContainerStyle={[
              styles.modalContainer,
              { paddingTop: insets.top, paddingBottom: insets.bottom },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Quick Access</Text>
              <IconButton
                icon="close"
                onPress={() => setQuickAccessVisible(false)}
              />
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={styles.sectionTitle}>Bookmarks</Text>
              {bookmarks.length === 0 ? (
                <Text
                  style={{ color: Colors.textSecondary, fontStyle: "italic" }}
                >
                  No bookmarks yet.
                </Text>
              ) : (
                bookmarks.map((path, index) => (
                  <List.Item
                    key={index}
                    title={path}
                    left={(props) => (
                      <List.Icon
                        {...props}
                        icon="star"
                        color={Colors.warning}
                      />
                    )}
                    onPress={() => {
                      setQuickAccessVisible(false);
                      fetchFiles(path); // Assuming path is a directory for now
                      // If it's a file, we might need logic to check type or navigate to parent
                      // For simplicity, treating bookmarks as "locations" to navigate to
                      // If it's a file, fetchFiles will likely try to list it and fail or list parent
                      // Ideally we check if it is dir. But path doesn't say.
                      // Let's assume user bookmarks folders for navigation.
                    }}
                    right={(props) => (
                      <IconButton
                        icon="delete"
                        size={20}
                        onPress={() => toggleBookmark(path)}
                      />
                    )}
                  />
                ))
              )}

              <Divider style={{ marginVertical: 16 }} />

              <Text style={styles.sectionTitle}>Recent Locations</Text>
              {recentFiles.length === 0 ? (
                <Text
                  style={{ color: Colors.textSecondary, fontStyle: "italic" }}
                >
                  No recent history.
                </Text>
              ) : (
                recentFiles.map((path, index) => (
                  <List.Item
                    key={index}
                    title={path}
                    left={(props) => <List.Icon {...props} icon="history" />}
                    onPress={() => {
                      setQuickAccessVisible(false);
                      fetchFiles(path);
                    }}
                  />
                ))
              )}
            </ScrollView>
          </Modal>
        </Portal>
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
    modalContainer: {
      backgroundColor: Colors.surface,
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: Colors.text,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textSecondary,
      marginBottom: 8,
      marginTop: 8,
    },
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
      backgroundColor: Colors.surface,
      minHeight: 56,
    },
    searchBar: {
      flex: 1,
      backgroundColor: Colors.surfaceVariant,
      marginRight: 8,
      height: 48,
    },
    searchBarInput: {
      minHeight: 40,
    },
    breadcrumbScroll: { flex: 1, marginHorizontal: 4 },
    breadcrumbItem: {
      padding: 6,
      paddingHorizontal: 8,
      borderRadius: 4,
      justifyContent: "center",
      alignItems: "center",
    },
    breadcrumbText: { fontSize: 14, color: Colors.text, fontWeight: "500" },
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
    propertyRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    propertyLabel: {
      fontWeight: "bold",
      color: Colors.textSecondary,
      flex: 1,
    },
    propertyValue: {
      flex: 2,
      textAlign: "right",
      color: Colors.text,
    },
  });
