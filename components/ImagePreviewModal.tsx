import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Modal, Portal, IconButton, Text, Button } from "react-native-paper";
import { useAppTheme } from "../contexts/ThemeContext";
import api from "../services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ImagePreviewModalProps {
  visible: boolean;
  onDismiss: () => void;
  serverId: string;
  filePath: string;
  fileName: string;
}

export default function ImagePreviewModal({
  visible,
  onDismiss,
  serverId,
  filePath,
  fileName,
}: ImagePreviewModalProps) {
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && serverId && filePath) {
      loadImage();
    } else {
      setImageUrl(null);
      setError(null);
    }
  }, [visible, serverId, filePath]);

  const loadImage = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl =
        api.defaults.baseURL ||
        process.env.EXPO_PUBLIC_API_URL ||
        "http://192.168.1.100:5000/api";
      // Ensure no double slash if baseUrl ends with /
      const cleanBaseUrl = baseUrl.endsWith("/")
        ? baseUrl.slice(0, -1)
        : baseUrl;
      const url = `/ftp/${serverId}/download?path=${encodeURIComponent(filePath)}`;

      console.log("Fetching image via API:", url);

      // Use api instance to handle auth and refresh tokens automatically
      const response = await api.get(url, { responseType: "blob" });

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result;
        if (typeof base64data === "string") {
          setImageUrl(base64data);
        } else {
          setError("Failed to convert image");
        }
        setLoading(false);
      };
      reader.onerror = () => {
        setError("Failed to read image blob");
        setLoading(false);
      };
      reader.readAsDataURL(response.data);
    } catch (err: any) {
      console.error("Image fetch failed:", err);
      setError(
        "Failed to load image: " +
          (err.response?.status === 401 ? "Unauthorized" : err.message),
      );
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modalContent,
          { backgroundColor: "black" },
        ]} // Full screen black background
      >
        <View style={styles.header}>
          <Text style={{ color: "white", flex: 1 }} numberOfLines={1}>
            {fileName}
          </Text>
          <IconButton icon="close" iconColor="white" onPress={onDismiss} />
        </View>

        <View style={styles.imageContainer}>
          {loading && (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={StyleSheet.absoluteFill}
            />
          )}
          {error ? (
            <Text style={{ color: "white" }}>{error}</Text>
          ) : imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="contain"
              // onLoadStart/End are handled by the fetch logic now, but Image needs them for rendering phase
              // actually we already loaded the data.
            />
          ) : null}
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    flex: 1,
    margin: 0,
    justifyContent: "center",
  },
  header: {
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  image: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
});
