import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from "react-native";
import {
  Text,
  ActivityIndicator,
  Button,
  Chip,
  Card,
  IconButton,
  Menu,
  Portal,
  Dialog,
  TextInput,
  Switch,
  Divider,
} from "react-native-paper";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { useAppTheme } from "../../contexts/ThemeContext";
import EventSource from "react-native-sse";
import * as Clipboard from "expo-clipboard";

interface VpnClient {
  id: string;
  name: string;
  enabled: boolean;
  address: string;
  publicKey: string;
  transferRx: number;
  transferTx: number;
}

const formatBytes = (bytes: number) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export default function VpnManagerScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const styles = createStyles(colors, isDark);

  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<any[]>([]);
  const [serverId, setServerId] = useState<string>("");
  const [serverMenuVisible, setServerMenuVisible] = useState(false);

  const [status, setStatus] = useState<{
    installed: boolean;
    status: string;
    clients: VpnClient[];
  } | null>(null);

  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installSteps, setInstallSteps] = useState<string[]>([]);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [creating, setCreating] = useState(false);

  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrData, setQrData] = useState<{ name: string; config: string } | null>(
    null,
  );

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchServers();
  }, []);

  useEffect(() => {
    if (serverId) {
      fetchStatus();
      const interval = setInterval(() => fetchStatus(true), 10000);
      return () => clearInterval(interval);
    }
  }, [serverId]);

  const fetchServers = async () => {
    try {
      const { data } = await api.get("/servers");
      setServers(data || []);
      if (data && data.length > 0) {
        setServerId(data[0]._id);
      }
    } catch {
      Alert.alert(t("common.error"), "Failed to load servers");
    } finally {
      if (!serverId) setLoading(false);
    }
  };

  const fetchStatus = async (silent = false) => {
    if (!serverId) return;
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get(`/vpn/${serverId}/status`);
      setStatus(data);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        if (!silent)
          Alert.alert(t("common.error"), "Failed to load VPN status");
      } else {
        setStatus({ installed: false, status: "Not Installed", clients: [] });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    if (!serverId) return;
    setInstalling(true);
    setInstallSteps([]);
    const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:5000";
    let token = "";
    if (typeof localStorage !== "undefined") {
      token = localStorage.getItem("accessToken") || "";
    }

    const es = new EventSource(`${API_URL}/api/vpn/${serverId}/install`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        wgHost: servers.find((s) => s._id === serverId)?.host || "auto",
        wgPort: 51820,
        apiPort: 51821,
        wgDefaultAddress: "10.8.0.x",
        wgAllowedIps: "0.0.0.0/0, ::/0",
      }),
    }) as any;

    es.addEventListener("progress", (event: any) => {
      if (event.data) {
        try {
          const json = JSON.parse(event.data);
          setInstallSteps((prev) => [...prev, json.message]);
        } catch (e) {}
      }
    });

    es.addEventListener("complete", (event: any) => {
      es.close();
      setInstalling(false);
      setInstallDialogOpen(false);
      Alert.alert("Success", "VPN installed successfully!");
      fetchStatus();
    });

    es.addEventListener("error", (event: any) => {
      es.close();
      setInstalling(false);
      Alert.alert("Error", event.message || "Failed to install VPN");
    });
  };

  const executeAction = async (
    action: "start" | "stop" | "restart" | "remove",
  ) => {
    if (action === "remove") {
      Alert.alert(
        "Confirm Remove",
        "Are you sure you want to completely remove the VPN Server? All clients will be deleted.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              setActionLoading(action);
              try {
                await api.post(`/vpn/${serverId}/action`, { action });
                Alert.alert(t("common.success"), "Action successful");
                fetchStatus();
              } catch (error: any) {
                Alert.alert(
                  "Error",
                  error.response?.data?.message || "Action failed",
                );
              } finally {
                setActionLoading(null);
              }
            },
          },
        ],
      );
      return;
    }

    setActionLoading(action);
    try {
      await api.post(`/vpn/${serverId}/action`, { action });
      Alert.alert(t("common.success"), "Action successful");
      fetchStatus();
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    setCreating(true);
    try {
      await api.post(`/vpn/${serverId}/clients`, { name: newClientName });
      Alert.alert(t("common.success"), "Client created");
      setCreateDialogOpen(false);
      setNewClientName("");
      fetchStatus();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to create client",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClient = (clientId: string) => {
    Alert.alert("Confirm Delete", "Delete this VPN client?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/vpn/${serverId}/clients/${clientId}`);
            Alert.alert(t("common.success"), "Client deleted");
            fetchStatus();
          } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Failed");
          }
        },
      },
    ]);
  };

  const handleToggleClient = async (clientId: string, enabled: boolean) => {
    try {
      // Optimistic update
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              clients: prev.clients.map((c) =>
                c.id === clientId ? { ...c, enabled } : c,
              ),
            }
          : null,
      );
      await api.patch(`/vpn/${serverId}/clients/${clientId}`, { enabled });
    } catch (error: any) {
      Alert.alert("Error", "Failed to update client");
      fetchStatus(); // Revert
    }
  };

  const handleViewQr = async (clientId: string, name: string) => {
    try {
      const { data } = await api.get(`/vpn/${serverId}/clients/${clientId}/qr`);
      setQrData({ name, config: data.config });
      setQrDialogOpen(true);
    } catch (error: any) {
      Alert.alert("Error", "Failed to get client configuration");
    }
  };

  const selectedServerInfo = servers.find((s) => s._id === serverId);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "VPN Manager" }} />

      {/* Target Server Selector */}
      <View style={styles.topSelector}>
        <Menu
          visible={serverMenuVisible}
          onDismiss={() => setServerMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              icon="server"
              contentStyle={{ flexDirection: "row-reverse" }}
              onPress={() => setServerMenuVisible(true)}
              style={styles.serverBtn}
            >
              {selectedServerInfo ? selectedServerInfo.name : "Select Server"}
            </Button>
          }
        >
          {servers.map((s) => (
            <Menu.Item
              key={s._id}
              onPress={() => {
                setServerId(s._id);
                setServerMenuVisible(false);
              }}
              title={s.name}
            />
          ))}
        </Menu>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="large" style={{ marginTop: 40 }} />
        ) : !status?.installed ? (
          <View style={styles.emptyContainer}>
            <IconButton
              icon="shield-off-outline"
              size={64}
              iconColor={colors.textSecondary}
            />
            <Text style={styles.emptyText}>{t("vpn.vPNNotInstalled", "VPN Not Installed")}</Text>
            <Text style={styles.emptySubtext}>
              {t("vpn.wireGuardVPNIsNot", "WireGuard VPN is not installed on this server. Install it to               manage secure connections.")}</Text>
            <Button
              mode="contained"
              icon="download"
              onPress={() => setInstallDialogOpen(true)}
              style={{ marginTop: 24 }}
            >
              {t("vpn.installWireGuardVPN", "Install WireGuard VPN")}</Button>
          </View>
        ) : (
          <View>
            {/* Status Card */}
            <Card style={styles.statusCard}>
              <Card.Content>
                <View style={styles.statusHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <IconButton
                      icon={
                        status.status === "running"
                          ? "shield-check"
                          : "shield-alert"
                      }
                      iconColor={
                        status.status === "running"
                          ? colors.success
                          : colors.error
                      }
                      size={28}
                      style={{ margin: 0, marginRight: 8 }}
                    />
                    <View>
                      <Text style={styles.statusTitle}>{t("vpn.wireGuardVPN", "WireGuard VPN")}</Text>
                      <Text
                        style={{
                          color:
                            status.status === "running"
                              ? colors.success
                              : colors.error,
                          fontWeight: "bold",
                        }}
                      >
                        {status.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionRow}>
                    {status.status !== "running" && (
                      <IconButton
                        icon="play"
                        mode="contained-tonal"
                        iconColor={colors.success}
                        onPress={() => executeAction("start")}
                        disabled={actionLoading !== null}
                      />
                    )}
                    {status.status === "running" && (
                      <IconButton
                        icon="stop"
                        mode="contained-tonal"
                        iconColor={colors.error}
                        onPress={() => executeAction("stop")}
                        disabled={actionLoading !== null}
                      />
                    )}
                    <IconButton
                      icon="refresh"
                      mode="contained-tonal"
                      onPress={() => executeAction("restart")}
                      disabled={actionLoading !== null}
                    />
                    <IconButton
                      icon="delete"
                      mode="outlined"
                      iconColor={colors.error}
                      style={{ borderColor: colors.error }}
                      onPress={() => executeAction("remove")}
                      disabled={actionLoading !== null}
                    />
                  </View>
                </View>
              </Card.Content>
            </Card>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 24,
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                {t("vpn.peers", "Peers (")}{status.clients?.length || 0})
              </Text>
              <Button
                mode="contained"
                icon="account-plus"
                compact
                onPress={() => setCreateDialogOpen(true)}
              >
                {t("vpn.addPeer", "Add Peer")}</Button>
            </View>

            {/* Clients List */}
            {!status.clients || status.clients.length === 0 ? (
              <View style={[styles.emptyContainer, { paddingTop: 40 }]}>
                <Text style={{ color: colors.textSecondary }}>
                  {t("vpn.noPeersConnected", "No peers connected.")}</Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {status.clients.map((client) => (
                  <Card key={client.id} style={styles.clientCard}>
                    <Card.Content style={styles.clientContent}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: "bold", fontSize: 16 }}>
                            {client.name}
                          </Text>
                          <Text
                            style={{
                              fontFamily: "monospace",
                              fontSize: 11,
                              color: colors.textSecondary,
                              marginTop: 2,
                            }}
                          >
                            {client.address}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 16,
                              marginTop: 8,
                            }}
                          >
                            <Text
                              style={{ fontSize: 11, color: colors.success }}
                            >
                              ↓ {formatBytes(client.transferRx)}
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.info }}>
                              ↑ {formatBytes(client.transferTx)}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 8 }}>
                          <Switch
                            value={client.enabled}
                            onValueChange={(val) =>
                              handleToggleClient(client.id, val)
                            }
                            color={colors.primary}
                          />
                          <View style={{ flexDirection: "row" }}>
                            <IconButton
                              icon="qrcode"
                              size={20}
                              mode="contained-tonal"
                              style={{ margin: 2 }}
                              onPress={() =>
                                handleViewQr(client.id, client.name)
                              }
                            />
                            <IconButton
                              icon="delete"
                              size={20}
                              iconColor={colors.error}
                              mode="outlined"
                              style={{ margin: 2, borderColor: colors.error }}
                              onPress={() => handleDeleteClient(client.id)}
                            />
                          </View>
                        </View>
                      </View>
                    </Card.Content>
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Install Dialog */}
      <Portal>
        <Dialog
          visible={installDialogOpen}
          onDismiss={() => {
            if (!installing) setInstallDialogOpen(false);
          }}
          style={styles.dialog}
        >
          <Dialog.Title>{t("vpn.installWireGuard", "Install WireGuard")}</Dialog.Title>
          <Dialog.Content>
            {installing ? (
              <View>
                <ActivityIndicator style={{ marginBottom: 16 }} />
                <Text style={{ textAlign: "center", marginBottom: 8 }}>
                  {t("vpn.installingVPNOn", "Installing VPN on")}{selectedServerInfo?.name}...
                </Text>
                <View style={styles.logBox}>
                  <ScrollView style={{ maxHeight: 150 }}>
                    {installSteps.map((s, i) => (
                      <Text key={i} style={styles.logText}>
                        › {s}
                      </Text>
                    ))}
                  </ScrollView>
                </View>
              </View>
            ) : (
              <Text>
                {t("vpn.thisWillInstallA", "This will install a WireGuard UI container and set up the VPN                 server. Do you want to continue?")}</Text>
            )}
          </Dialog.Content>
          {!installing && (
            <Dialog.Actions>
              <Button onPress={() => setInstallDialogOpen(false)}>
                {t("vpn.cancel", "Cancel")}</Button>
              <Button onPress={handleInstall} mode="contained">
                {t("vpn.install", "Install")}</Button>
            </Dialog.Actions>
          )}
        </Dialog>
      </Portal>

      {/* Create Client Dialog */}
      <Portal>
        <Dialog
          visible={createDialogOpen}
          onDismiss={() => setCreateDialogOpen(false)}
          style={styles.dialog}
        >
          <Dialog.Title>{t("vpn.addNewPeer", "Add New Peer")}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Peer Name (e.g. My Phone)"
              mode="outlined"
              value={newClientName}
              onChangeText={setNewClientName}
              style={{ backgroundColor: colors.background }}
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateDialogOpen(false)}>{t("vpn.cancel", "Cancel")}</Button>
            <Button onPress={handleCreateClient} loading={creating}>
              {t("vpn.add", "Add")}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* QR/Config Dialog */}
      <Portal>
        <Dialog
          visible={qrDialogOpen}
          onDismiss={() => setQrDialogOpen(false)}
          style={styles.dialog}
        >
          <Dialog.Title>{qrData?.name} {t("vpn.configuration", "Configuration")}</Dialog.Title>
          <Dialog.ScrollArea style={{ paddingHorizontal: 0, maxHeight: 400 }}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={{ marginBottom: 8, color: colors.textSecondary }}>
                {t("vpn.copyTheConfigurationBelow", "Copy the configuration below and import it into the WireGuard                 app.")}</Text>
              <View style={styles.codeOutputBox}>
                <Text style={styles.codeOutput}>{qrData?.config}</Text>
                <IconButton
                  icon="content-copy"
                  iconColor={colors.primary}
                  style={{
                    position: "absolute",
                    right: 4,
                    top: 4,
                    backgroundColor: isDark
                      ? "rgba(0,0,0,0.5)"
                      : "rgba(255,255,0,0.8)",
                  }}
                  onPress={async () => {
                    await Clipboard.setStringAsync(qrData?.config || "");
                    Alert.alert("Success", "Configuration copied to clipboard");
                  }}
                />
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setQrDialogOpen(false)}>{t("vpn.close", "Close")}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topSelector: {
      padding: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    serverBtn: {
      width: "100%",
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 60,
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 8,
      fontSize: 16,
      fontWeight: "bold",
    },
    emptySubtext: {
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 4,
      fontSize: 12,
      maxWidth: 260,
    },
    statusCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
    },
    statusHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      flexWrap: "wrap",
      gap: 16,
    },
    statusTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.text,
    },
    actionRow: {
      flexDirection: "row",
      gap: 4,
    },
    clientCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
    },
    clientContent: {
      padding: 12,
    },
    dialog: {
      backgroundColor: colors.surface,
    },
    logBox: {
      backgroundColor: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.03)",
      padding: 8,
      borderRadius: 4,
      marginTop: 8,
    },
    logText: {
      fontFamily: "monospace",
      fontSize: 10,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    codeOutputBox: {
      position: "relative",
      backgroundColor: isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.04)",
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    codeOutput: {
      fontFamily: "monospace",
      fontSize: 10,
      color: isDark ? "#e2e8f0" : "#334155",
      lineHeight: 16,
    },
  });
