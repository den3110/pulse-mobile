import React from "react";
import { View, StyleSheet } from "react-native";
import { Modal, Portal, Text, List, Button, Divider } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../contexts/ThemeContext";

interface FileEntry {
  name: string;
  type: "directory" | "file" | "symlink" | "d" | "-" | "l";
  size: number;
  permissions: string;
  owner: string;
  group: string;
  modified: string;
}

interface FileActionSheetProps {
  visible: boolean;
  onDismiss: () => void;
  file: FileEntry | null;
  onRename: (file: FileEntry) => void;
  onDelete: (file: FileEntry) => void;
  onPermissions: (file: FileEntry) => void;
  onDownload?: (file: FileEntry) => void;
  onCopyPath: (file: FileEntry) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (file: FileEntry) => void;
  onMove?: (file: FileEntry) => void;
  onCopy?: (file: FileEntry) => void;
  onZip?: (file: FileEntry) => void;
  onUnzip?: (file: FileEntry) => void;
  onProperties?: (file: FileEntry) => void;
  onEdit?: (file: FileEntry) => void;
  onPreview?: (file: FileEntry) => void;
  onTerminal?: (file: FileEntry) => void;
}

export default function FileActionSheet({
  visible,
  onDismiss,
  file,
  onRename,
  onDelete,
  onPermissions,
  onDownload,
  onCopyPath,
  isBookmarked,
  onToggleBookmark,
  onMove,
  onCopy,
  onZip,
  onUnzip,
  onProperties,
  onEdit,
  onPreview,
  onTerminal,
}: FileActionSheetProps) {
  const { colors } = useAppTheme();

  if (!file) return null;

  const isDir = file.type === "d" || file.type === "directory";
  const isZip = file.name.toLowerCase().endsWith(".zip");

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modalContent,
          { backgroundColor: colors.surface },
        ]}
      >
        <View style={styles.header}>
          <MaterialCommunityIcons
            name={isDir ? "folder" : "file-outline"}
            size={24}
            color={isDir ? colors.primary : colors.text}
          />
          <Text style={styles.title} numberOfLines={1}>
            {file.name}
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {file.permissions} • {file.owner}:{file.group}
        </Text>

        <Divider style={{ marginVertical: 10 }} />

        <List.Item
          title="Rename"
          left={(props) => <List.Icon {...props} icon="pencil" />}
          onPress={() => {
            onDismiss();
            onRename(file);
          }}
        />

        {!isDir && (
          <>
            <List.Item
              title="Edit"
              left={(props) => (
                <List.Icon {...props} icon="file-document-edit-outline" />
              )}
              onPress={() => {
                onDismiss();
                onEdit && onEdit(file);
              }}
            />
            <List.Item
              title="Preview"
              left={(props) => <List.Icon {...props} icon="eye-outline" />}
              onPress={() => {
                onDismiss();
                onPreview && onPreview(file);
              }}
            />
          </>
        )}

        {!isDir && onDownload && (
          <List.Item
            title="Download"
            left={(props) => <List.Icon {...props} icon="download" />}
            onPress={() => {
              onDismiss();
              onDownload(file);
            }}
          />
        )}

        <List.Item
          title="Change Permissions (chmod)"
          left={(props) => <List.Icon {...props} icon="shield-account" />}
          onPress={() => {
            onDismiss();
            onPermissions(file);
          }}
        />

        <Divider style={{ marginVertical: 5 }} />

        <List.Item
          title="Move"
          left={(props) => <List.Icon {...props} icon="file-move" />}
          onPress={() => {
            onDismiss();
            onMove && onMove(file);
          }}
        />

        <List.Item
          title="Copy"
          left={(props) => <List.Icon {...props} icon="content-copy" />}
          onPress={() => {
            onDismiss();
            onCopy && onCopy(file);
          }}
        />

        <List.Item
          title={isDir ? "Compress (Zip)" : "Compress (Zip)"}
          left={(props) => <List.Icon {...props} icon="zip-box" />}
          onPress={() => {
            onDismiss();
            onZip && onZip(file);
          }}
        />

        {isZip && (
          <List.Item
            title="Extract (Unzip)"
            left={(props) => <List.Icon {...props} icon="folder-zip" />}
            onPress={() => {
              onDismiss();
              onUnzip && onUnzip(file);
            }}
          />
        )}

        <Divider style={{ marginVertical: 5 }} />

        <List.Item
          title="Copy Path"
          left={(props) => <List.Icon {...props} icon="content-copy" />}
          onPress={() => {
            onDismiss();
            onCopyPath(file);
          }}
        />

        <List.Item
          title={isBookmarked ? "Remove Bookmark" : "Add to Bookmarks"}
          left={(props) => (
            <List.Icon
              {...props}
              icon={isBookmarked ? "star-off" : "star"}
              color={isBookmarked ? colors.warning : undefined}
            />
          )}
          onPress={() => {
            onDismiss();
            onToggleBookmark && onToggleBookmark(file);
          }}
        />

        <Divider style={{ marginVertical: 5 }} />

        <List.Item
          title="Open Terminal Here"
          left={(props) => <List.Icon {...props} icon="console" />}
          onPress={() => {
            onDismiss();
            onTerminal && onTerminal(file);
          }}
        />

        <List.Item
          title="Properties"
          left={(props) => <List.Icon {...props} icon="information-outline" />}
          onPress={() => {
            onDismiss();
            onProperties && onProperties(file);
          }}
        />

        <Divider style={{ marginVertical: 5 }} />

        <List.Item
          title="Delete"
          titleStyle={{ color: colors.error }}
          left={(props) => (
            <List.Icon {...props} icon="delete" color={colors.error} />
          )}
          onPress={() => {
            onDismiss();
            onDelete(file);
          }}
        />

        <Button onPress={onDismiss} style={{ marginTop: 10 }}>
          Cancel
        </Button>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    padding: 20,
    margin: 20,
    borderRadius: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
  },
  subtitle: {
    fontSize: 12,
    marginLeft: 34,
  },
});
