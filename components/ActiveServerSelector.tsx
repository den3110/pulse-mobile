import { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import {
  Text,
  Modal,
  Portal,
  Button,
  Divider,
  RadioButton,
} from "react-native-paper";
import { useServer } from "../contexts/ServerContext";
import { useAppTheme } from "../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { statusColor } from "../constants/theme";

export default function ActiveServerSelector() {
  const { servers, selectedServer, selectServer } = useServer();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [visible, setVisible] = useState(false);

  const showModal = () => {
    Haptics.selectionAsync();
    setVisible(true);
  };
  const hideModal = () => setVisible(false);

  const handleSelect = (id: string) => {
    selectServer(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    hideModal();
  };

  return (
    <>
      <Pressable onPress={showModal} style={styles.selectorBtn}>
        <View>
          <Text style={styles.label}>Active Server</Text>
          <View style={styles.valueRow}>
            <Text style={styles.value} numberOfLines={1}>
              {selectedServer ? selectedServer.name : "Select Server"}
            </Text>
            <MaterialCommunityIcons
              name="chevron-down"
              size={16}
              color={colors.textSecondary}
            />
          </View>
        </View>
      </Pressable>

      <Portal>
        <Modal
          visible={visible}
          onDismiss={hideModal}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Select Active Server</Text>
          <Text style={styles.modalSubtitle}>
            Dashboard stats will show data for this server
          </Text>
          <Divider style={{ marginVertical: 10 }} />

          <ScrollView style={{ maxHeight: 300 }}>
            {servers.length > 0 ? (
              servers.map((server) => {
                const isSelected = selectedServer?._id === server._id;
                return (
                  <Pressable
                    key={server._id}
                    onPress={() => handleSelect(server._id)}
                    style={[
                      styles.serverItem,
                      isSelected && { backgroundColor: colors.primary + "10" },
                    ]}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        flex: 1,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: statusColor(server.status, colors),
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.serverName,
                            isSelected && {
                              color: colors.primary,
                              fontWeight: "700",
                            },
                          ]}
                        >
                          {server.name}
                        </Text>
                        <Text style={styles.serverHost}>{server.host}</Text>
                      </View>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons
                        name="check"
                        size={20}
                        color={colors.primary}
                      />
                    )}
                  </Pressable>
                );
              })
            ) : (
              <Text
                style={{
                  textAlign: "center",
                  padding: 20,
                  color: colors.textSecondary,
                }}
              >
                No servers found
              </Text>
            )}
          </ScrollView>

          <Button onPress={hideModal} style={{ marginTop: 10 }}>
            Close
          </Button>
        </Modal>
      </Portal>
    </>
  );
}

const createStyles = (Colors: any) =>
  StyleSheet.create({
    selectorBtn: {
      paddingVertical: 4,
      // paddingHorizontal: 12, // maybe simpler
    },
    label: {
      fontSize: 10,
      color: Colors.textSecondary,
      textTransform: "uppercase",
      fontWeight: "600",
    },
    valueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    value: {
      fontSize: 16,
      fontWeight: "700",
      color: Colors.text,
      maxWidth: 150,
    },
    modalContent: {
      backgroundColor: Colors.surface,
      margin: 20,
      borderRadius: 14,
      padding: 20,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: Colors.text,
      textAlign: "center",
    },
    modalSubtitle: {
      fontSize: 13,
      color: Colors.textSecondary,
      textAlign: "center",
      marginTop: 4,
    },
    serverItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    serverName: {
      fontSize: 15,
      color: Colors.text,
      marginBottom: 2,
    },
    serverHost: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
  });
