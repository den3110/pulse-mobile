import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Appbar, useTheme, Snackbar, Button } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";

interface EditorModalProps {
  visible: boolean;
  onDismiss: () => void;
  serverId: string;
  filePath: string;
  onSaveSuccess: () => void;
}

export default function EditorModal({
  visible,
  onDismiss,
  serverId,
  filePath,
  onSaveSuccess,
}: EditorModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && filePath) {
      loadFile();
    }
  }, [visible, filePath]);

  const loadFile = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/ftp/${serverId}/read`, {
        params: { path: filePath },
      });
      setContent(data.content);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load file");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`/ftp/${serverId}/write`, {
        path: filePath,
        content: content,
      });
      onSaveSuccess();
      onDismiss();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save file");
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Appbar.Header statusBarHeight={0}>
          <Appbar.Action icon="close" onPress={onDismiss} />
          <Appbar.Content
            title={filePath.split("/").pop()}
            subtitle={filePath}
          />
          <View style={{ marginRight: 8 }}>
            <Button
              mode="contained"
              onPress={handleSave}
              loading={saving}
              disabled={loading || saving}
              compact
            >
              Save
            </Button>
          </View>
        </Appbar.Header>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <TextInput
                style={[
                  styles.editor,
                  {
                    color: theme.colors.onSurface,
                    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  },
                ]}
                multiline
                value={content}
                onChangeText={setContent}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        <Snackbar
          visible={!!error}
          onDismiss={() => setError(null)}
          action={{ label: "Retry", onPress: loadFile }}
        >
          {error}
        </Snackbar>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { flexGrow: 1, padding: 16 },
  editor: {
    fontSize: 14,
    textAlignVertical: "top",
    minHeight: "100%",
  },
});
