import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Text,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useAppTheme } from "../../../contexts/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io, Socket } from "socket.io-client";
import { IconButton, Surface } from "react-native-paper";

const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.8:5012/api"
).replace("/api", "");

export default function TerminalScreen() {
  const { id, path } = useLocalSearchParams<{ id: string; path: string }>();
  const { colors } = useAppTheme();
  const [token, setToken] = useState<string | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const [command, setCommand] = useState("");
  const [connected, setConnected] = useState(false);
  const [termTitle, setTermTitle] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  // Generate a unique ID for this session
  const termId = useRef(Math.floor(Math.random() * 1000000)).current;

  useEffect(() => {
    AsyncStorage.getItem("accessToken").then(setToken);
  }, []);

  useEffect(() => {
    if (!token || !id) return;

    // Initialize socket
    // Handle subpath deployments (e.g. example.com/backend)
    let socketUrl = API_URL;
    let socketPath = "/socket.io"; // Default

    try {
      const parsedUrl = new URL(API_URL);
      if (parsedUrl.pathname && parsedUrl.pathname !== "/") {
        socketPath = parsedUrl.pathname.replace(/\/$/, "") + "/socket.io";
        socketUrl = parsedUrl.origin;
      }
    } catch (e) {
      console.warn("Failed to parse API_URL for socket config", e);
    }

    const socket = io(socketUrl, {
      path: socketPath,
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setOutput((prev) => [...prev, "Connected to server..."]);
      // Start terminal session with unique ID
      socket.emit("terminal:start", {
        serverId: id,
        termId,
        rows: 24,
        cols: 80,
      });
    });

    socket.on("terminal:ready", (data: { termId: number }) => {
      if (data.termId === termId && path) {
        socket.emit("terminal:data", {
          termId,
          data: `cd "${path}"\n`,
        });
      }
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setOutput((prev) => [...prev, "Disconnected from server."]);
    });

    socket.on(
      "terminal:output",
      (data: { termId: number; data: string } | string) => {
        // Handle both formats (though backend sends object now)
        let text = "";
        if (typeof data === "string") {
          text = data;
        } else if (data.termId === termId) {
          text = data.data;
        } else {
          return; // Ignore data from other terms
        }

        // 1. Check for OSC 0 title sequence
        const titleMatch = text.match(/\x1b\]0;(.*?)\x07/);
        if (titleMatch) {
          setTermTitle(titleMatch[1]);
        }

        // Simple splitting
        const lines = text.split(/\r?\n/);
        setOutput((prev) => {
          const check = [...prev, ...lines].slice(-100);
          return check;
        });
      },
    );

    return () => {
      // Clean up specific session
      if (socket.connected) {
        socket.emit("terminal:close", { termId });
      }
      socket.disconnect();
    };
  }, [token, id, path]); // Added path to dependency to ensure it captures it

  useEffect(() => {
    // Auto-scroll
    setTimeout(
      () => scrollViewRef.current?.scrollToEnd({ animated: true }),
      100,
    );
  }, [output]);

  const sendCommand = () => {
    if (!command || !socketRef.current) return;
    // Emit with termId
    socketRef.current.emit("terminal:data", {
      termId: termId,
      data: command + "\n",
    });
    setCommand("");
  };

  // Helper to remove ANSI codes for display
  // Supports:
  // - CSI: \x1b[ ...
  // - OSC: \x1b] ... \x07
  const stripAnsi = (str: string) => {
    return str
      .replace(/\x1b\][0-9];.*?(?:\x07|\x1b\\)/g, "") // Strip OSC sequences
      .replace(/\x1b\[[?]?[0-9;]*[a-zA-Z]/g, ""); // Strip CSI sequences
  };

  if (!token) return <View style={{ flex: 1, backgroundColor: "#1e1e1e" }} />;

  return (
    <>
      <Stack.Screen
        options={{
          // Use parsed title or default
          title: termTitle || "Terminal",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontSize: 13,
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
          },
        }}
      />
      <View style={styles.container}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.outputContainer}
          contentContainerStyle={{ padding: 10, paddingBottom: 20 }}
        >
          {output.map((line, i) => (
            <Text key={i} style={styles.outputText}>
              {stripAnsi(line)}
            </Text>
          ))}
          {!connected && <Text style={{ color: "#666" }}>Connecting...</Text>}
        </ScrollView>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
          <Surface style={styles.inputContainer}>
            <Text style={styles.prompt}>$</Text>
            <TextInput
              style={styles.input}
              value={command}
              onChangeText={setCommand}
              onSubmitEditing={sendCommand}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter command..."
              placeholderTextColor="#666"
            />
            <IconButton
              icon="send"
              iconColor={colors.primary}
              size={20}
              onPress={sendCommand}
            />
          </Surface>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1e1e1e",
  },
  outputContainer: {
    flex: 1,
  },
  outputText: {
    color: "#d4d4d4",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#2d2d2d",
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  prompt: {
    color: "#22c55e",
    fontWeight: "bold",
    marginRight: 8,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  input: {
    flex: 1,
    color: "#fff",
    height: 40,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
