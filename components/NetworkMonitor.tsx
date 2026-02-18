import React, { useEffect, useState } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { Snackbar, Portal } from "react-native-paper";
import { StyleSheet, View } from "react-native";
import { useAppTheme } from "../contexts/ThemeContext";

export default function NetworkMonitor() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const { colors } = useAppTheme();

  // Initial check
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const offline = state.isConnected === false;

      if (offline && !isOffline) {
        // Went offline
        setMessage("No internet connection");
        setVisible(true);
        setIsOffline(true);
      } else if (!offline && isOffline) {
        // Back online
        setMessage("Back online");
        setVisible(true);
        setIsOffline(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOffline]);

  const onDismiss = () => setVisible(false);

  return (
    <Portal>
      <Snackbar
        visible={visible}
        onDismiss={onDismiss}
        duration={3000}
        style={{
          backgroundColor: isOffline ? colors.error : colors.primary,
          marginBottom: 20,
        }}
        action={{
          label: "Dismiss",
          onPress: onDismiss,
          textColor: colors.surface,
        }}
      >
        {message}
      </Snackbar>
    </Portal>
  );
}
