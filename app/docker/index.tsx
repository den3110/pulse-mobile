import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  Platform,
  Alert,
} from "react-native";
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  Chip,
  IconButton,
  Divider,
  Portal,
  Modal,
  Menu,
  Dialog,
  TextInput,
} from "react-native-paper";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useServer } from "../../contexts/ServerContext";
import CustomAlertDialog, {
  CustomAlertDialogRef,
} from "../../components/CustomAlertDialog";

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string;
  created: string;
  size: string;
  networks: string;
  command: string;
}

interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

interface ContainerStats {
  containerId: string;
  name: string;
  cpuPercent: string;
  memUsage: string;
  memPercent: string;
  netIO: string;
  blockIO: string;
  pids: string;
}

const stateColor: Record<string, string> = {
  running: "#22c55e",
  exited: "#ef4444",
  paused: "#eab308",
  restarting: "#eab308",
  created: "#6b7280",
  dead: "#ef4444",
};

export default function DockerManagerScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const styles = createStyles(colors);

  const { serverId: paramServerId } = useLocalSearchParams<{
    serverId: string;
  }>();
  const { selectedServer } = useServer();
  const serverId = paramServerId || selectedServer?._id;

  const [tab, setTab] = useState<"containers" | "images">("containers");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dockerInfo, setDockerInfo] = useState<{
    installed: boolean;
    version?: string;
  } | null>(null);

  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [stats, setStats] = useState<ContainerStats[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const dialogRef = useRef<CustomAlertDialogRef>(null);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);

  // Modals for Logs and Inspect
  const [logVisible, setLogVisible] = useState(false);
  const [logContent, setLogContent] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [currentContainerName, setCurrentContainerName] = useState("");

  const [inspectVisible, setInspectVisible] = useState(false);
  const [inspectContent, setInspectContent] = useState("");
  const [inspectLoading, setInspectLoading] = useState(false);

  // Pull Image Autocomplete
  const [pullVisible, setPullVisible] = useState(false);
  const [pullImage, setPullImage] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullSuggestions, setPullSuggestions] = useState<any[]>([]);
  const [pullSearchLoading, setPullSearchLoading] = useState(false);

  // Run Container
  const [runVisible, setRunVisible] = useState(false);
  const [runConfig, setRunConfig] = useState({
    image: "",
    name: "",
    restartPolicy: "always",
    ports: [] as { hostPort: string; containerPort: string }[],
    env: [] as { key: string; value: string }[],
  });

  // Debounce hook replacement
  useEffect(() => {
    const handler = setTimeout(() => {
      const fetchSuggestions = async () => {
        if (!pullImage || pullImage.length < 2) {
          setPullSuggestions([]);
          return;
        }
        setPullSearchLoading(true);
        try {
          const { data } = await api.get(`/docker/search?query=${pullImage}`);
          setPullSuggestions(data.results || []);
        } catch (error) {
          console.log("Docker search error", error);
          setPullSuggestions([]);
        } finally {
          setPullSearchLoading(false);
        }
      };

      // Only fetch if pull modal is open
      if (pullVisible) {
        fetchSuggestions();
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [pullImage, pullVisible]);

  const fetchData = useCallback(async () => {
    if (!serverId) return;
    try {
      const [infoRes, containersRes, imagesRes] = await Promise.all([
        api.get(`/docker/${serverId}/info`),
        api.get(`/docker/${serverId}/containers`),
        api.get(`/docker/${serverId}/images`),
      ]);
      setDockerInfo(infoRes.data);
      setContainers(containersRes.data.containers || []);
      setImages(imagesRes.data.images || []);

      // Fetch stats for running containers
      try {
        const statsRes = await api.get(`/docker/${serverId}/stats`);
        setStats(statsRes.data.stats || []);
      } catch {
        // silenly fail if no running containers or stats not available
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Server not found
      } else {
        setDockerInfo({ installed: false });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handlePullImage = async () => {
    if (!pullImage.trim() || !serverId) return;
    setPulling(true);
    try {
      await api.post(`/docker/${serverId}/pull`, { image: pullImage });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      dialogRef.current?.show(
        t("common.success", "Success"),
        t(
          "docker.pullSuccess",
          "Pull request has been sent successfully. Depending on the size, it may take some time.",
        ),
      );
      setPullVisible(false);
      setPullImage("");
      fetchData();
    } catch (err: any) {
      dialogRef.current?.show(
        t("common.error", "Error"),
        err.response?.data?.message || "Failed to pull image",
      );
    } finally {
      setPulling(false);
    }
  };

  const handleRunContainer = async () => {
    if (!serverId) return;
    setActionLoading("running");
    try {
      await api.post(`/docker/${serverId}/containers/run`, runConfig);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      dialogRef.current?.show(
        t("common.success", "Success"),
        "Container started successfully",
      );
      setRunVisible(false);
      setTab("containers");
      fetchData();
    } catch (err: any) {
      dialogRef.current?.show(
        t("common.error", "Error"),
        err.response?.data?.message || "Failed to start container",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleContainerAction = async (containerId: string, action: string) => {
    if (!serverId) return;

    const performAction = async () => {
      setActionLoading(`${containerId}-${action}`);
      setMenuVisible(null);
      try {
        await api.post(
          `/docker/${serverId}/containers/${containerId}/${action}`,
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchData();
      } catch (err: any) {
        dialogRef.current?.show(
          t("common.error"),
          err.response?.data?.message || `Failed to ${action}`,
        );
      } finally {
        setActionLoading(null);
      }
    };

    if (action === "remove") {
      Alert.alert(
        t("common.confirmDelete", "Confirm Delete"),
        t(
          "docker.confirmRemove",
          "Are you sure you want to remove this container?",
        ),
        [
          { text: t("common.cancel", "Cancel"), style: "cancel" },
          {
            text: t("common.delete", "Delete"),
            style: "destructive",
            onPress: performAction,
          },
        ],
      );
    } else {
      performAction();
    }
  };

  const handleRemoveImage = (imageId: string) => {
    if (!serverId) return;
    Alert.alert(
      t("common.confirmDelete", "Confirm Delete"),
      t(
        "docker.confirmRemoveImage",
        "Are you sure you want to remove this image?",
      ),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("common.delete", "Delete"),
          style: "destructive",
          onPress: async () => {
            setActionLoading(`${imageId}-remove`);
            try {
              await api.delete(`/docker/${serverId}/images/${imageId}`);
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              fetchData();
            } catch (err: any) {
              dialogRef.current?.show(
                t("common.error", "Error"),
                err.response?.data?.message || "Failed to remove image",
              );
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const openLogs = async (containerId: string, name: string) => {
    setMenuVisible(null);
    setCurrentContainerName(name);
    setLogContent("");
    setLogVisible(true);
    setLogLoading(true);
    try {
      const { data } = await api.get(
        `/docker/${serverId}/containers/${containerId}/logs?tail=300`,
      );
      setLogContent(data.logs || "No logs");
    } catch {
      setLogContent("Failed to load logs");
    } finally {
      setLogLoading(false);
    }
  };

  const openInspect = async (containerId: string, name: string) => {
    setMenuVisible(null);
    setCurrentContainerName(name);
    setInspectContent("");
    setInspectVisible(true);
    setInspectLoading(true);
    try {
      const { data } = await api.get(
        `/docker/${serverId}/containers/${containerId}/inspect`,
      );
      setInspectContent(JSON.stringify(data.data, null, 2));
    } catch {
      setInspectContent("Failed to inspect");
    } finally {
      setInspectLoading(false);
    }
  };

  const openImageInspect = async (imageId: string, name: string) => {
    setMenuVisible(null);
    setCurrentContainerName(name);
    setInspectContent("");
    setInspectVisible(true);
    setInspectLoading(true);
    try {
      const { data } = await api.get(
        `/docker/${serverId}/images/${imageId}/inspect`,
      );
      setInspectContent(JSON.stringify(data.data, null, 2));
    } catch {
      setInspectContent("Failed to inspect image");
    } finally {
      setInspectLoading(false);
    }
  };

  const getStats = (containerId: string) =>
    stats.find(
      (s) =>
        s.containerId === containerId || containerId.startsWith(s.containerId),
    );

  if (!serverId) {
    return (
      <View style={styles.centered}>
        <Text>{t("common.noData", "No Server Selected")}</Text>
      </View>
    );
  }

  if (loading && !containers.length) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (dockerInfo && !dockerInfo.installed) {
    return (
      <View style={styles.centered}>
        <MaterialCommunityIcons
          name="docker"
          size={64}
          color={colors.textSecondary}
        />
        <Text style={styles.emptyText}>
          {t("docker.notInstalled", "Docker is not installed on this server")}
        </Text>
      </View>
    );
  }

  const renderContainers = () => {
    if (containers.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="docker"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.emptyText}>
            {t("docker.noContainers", "No containers found")}
          </Text>
        </View>
      );
    }

    return containers.map((container) => {
      const cs = getStats(container.id);
      const isActionLoading = actionLoading?.startsWith(container.id);
      const statusColor = stateColor[container.state] || stateColor.created;

      return (
        <Card key={container.id} style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  flex: 1,
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: statusColor,
                    shadowColor: statusColor,
                    shadowOpacity: 0.6,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.procName}>{container.name}</Text>
                  <Text style={styles.procMeta} numberOfLines={1}>
                    {container.image}
                  </Text>
                </View>
              </View>

              <Menu
                visible={menuVisible === container.id}
                onDismiss={() => setMenuVisible(null)}
                anchor={
                  <IconButton
                    icon="dots-horizontal"
                    size={20}
                    onPress={() => setMenuVisible(container.id)}
                  />
                }
              >
                <Menu.Item
                  onPress={() => openLogs(container.id, container.name)}
                  title={t("deploy.logs", "Logs")}
                  leadingIcon="text-box-outline"
                />
                <Menu.Item
                  onPress={() => openInspect(container.id, container.name)}
                  title={t("common.details", "Inspect")}
                  leadingIcon="information-outline"
                />
                <Divider />
                {container.state === "running" ? (
                  <Menu.Item
                    onPress={() => handleContainerAction(container.id, "stop")}
                    title={t("common.stop", "Stop")}
                    leadingIcon="stop"
                    titleStyle={{ color: colors.warning }}
                  />
                ) : (
                  <Menu.Item
                    onPress={() => handleContainerAction(container.id, "start")}
                    title={t("common.start", "Start")}
                    leadingIcon="play"
                    titleStyle={{ color: colors.success }}
                  />
                )}
                <Menu.Item
                  onPress={() => handleContainerAction(container.id, "restart")}
                  title={t("common.restart", "Restart")}
                  leadingIcon="restart"
                />
                <Divider />
                <Menu.Item
                  onPress={() => handleContainerAction(container.id, "remove")}
                  title={t("common.delete", "Delete")}
                  leadingIcon="delete"
                  titleStyle={{ color: colors.error }}
                />
              </Menu>
            </View>

            <Divider style={{ marginVertical: 10 }} />

            <View style={styles.statsRow}>
              {cs && (
                <>
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons
                      name="cpu-64-bit"
                      size={14}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.statValue}>{cs.cpuPercent}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons
                      name="memory"
                      size={14}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.statValue}>{cs.memUsage}</Text>
                  </View>
                </>
              )}
              <View style={styles.statItem}>
                <Text
                  style={[styles.statValue, { color: colors.textSecondary }]}
                >
                  {container.status}
                </Text>
              </View>
              {container.ports && (
                <View style={[styles.statItem, { flex: 2 }]}>
                  <MaterialCommunityIcons
                    name="lan"
                    size={14}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.statValue} numberOfLines={1}>
                    {container.ports.length > 30
                      ? container.ports.substring(0, 30) + "..."
                      : container.ports}
                  </Text>
                </View>
              )}
            </View>

            {isActionLoading && (
              <View style={styles.overlayLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
          </Card.Content>
        </Card>
      );
    });
  };

  const renderImages = () => {
    if (images.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="folder-image"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.emptyText}>
            {t("docker.noImages", "No images found")}
          </Text>
        </View>
      );
    }

    return images.map((img) => {
      const isActionLoading = actionLoading === `${img.id}-remove`;

      return (
        <Card key={img.id} style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.procName}>{img.repository}</Text>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 6,
                    marginTop: 4,
                    alignItems: "center",
                  }}
                >
                  <Chip
                    mode="outlined"
                    style={{ height: 24, paddingVertical: 0 }}
                    textStyle={{
                      fontSize: 10,
                      lineHeight: 12,
                      marginVertical: 0,
                      paddingHorizontal: 4,
                    }}
                  >
                    {img.tag}
                  </Chip>
                  <Text style={styles.statValue}>{img.size}</Text>
                  <Text
                    style={[styles.statValue, { color: colors.textSecondary }]}
                  >
                    {img.id.substring(0, 12)}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <IconButton
                  icon="play"
                  size={20}
                  iconColor={colors.primary}
                  onPress={() => {
                    setRunConfig({
                      image: `${img.repository}:${img.tag}`,
                      name: "",
                      restartPolicy: "always",
                      ports: [],
                      env: [],
                    });
                    setRunVisible(true);
                  }}
                  disabled={isActionLoading}
                />
                <IconButton
                  icon="information-outline"
                  size={20}
                  onPress={() => openImageInspect(img.id, img.repository)}
                  disabled={isActionLoading}
                />
                <IconButton
                  icon="delete"
                  iconColor={colors.error}
                  size={20}
                  onPress={() => handleRemoveImage(img.id)}
                  disabled={isActionLoading}
                />
              </View>
            </View>
            {isActionLoading && (
              <View style={styles.overlayLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
          </Card.Content>
        </Card>
      );
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t("docker.title", "Docker Manager"),
        }}
      />

      <View style={styles.container}>
        <View style={styles.tabContainer}>
          <Button
            mode={tab === "containers" ? "contained" : "text"}
            onPress={() => setTab("containers")}
            style={styles.tabBtn}
          >
            {t("docker.containers", "Containers")} ({containers.length})
          </Button>
          <Button
            mode={tab === "images" ? "contained" : "text"}
            onPress={() => setTab("images")}
            style={styles.tabBtn}
          >
            {t("docker.images", "Images")} ({images.length})
          </Button>
          <IconButton
            icon="download"
            size={20}
            mode="contained-tonal"
            iconColor={colors.primary}
            onPress={() => setPullVisible(true)}
            style={{ margin: 0, marginLeft: 8 }}
          />
        </View>

        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        >
          {tab === "containers" ? renderContainers() : renderImages()}
        </ScrollView>
      </View>

      <CustomAlertDialog ref={dialogRef} />

      {/* Logs Modal - Full Screen */}
      <Portal>
        <Modal
          visible={logVisible}
          onDismiss={() => setLogVisible(false)}
          contentContainerStyle={{ flex: 1, margin: 0 }}
        >
          <SafeAreaView
            style={{ flex: 1, backgroundColor: isDark ? "#0d1117" : "#1e1e1e" }}
          >
            <View style={styles.logHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.logTitle}>
                  {currentContainerName} {t("docker.logs", "- Logs")}</Text>
              </View>
              <IconButton
                icon="close"
                iconColor="#fff"
                size={20}
                onPress={() => setLogVisible(false)}
              />
            </View>
            {logLoading && !logContent ? (
              <View style={styles.centered}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <ScrollView style={styles.logScroll}>
                <Text style={styles.logText}>
                  {logContent || "No logs found."}
                </Text>
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </SafeAreaView>
        </Modal>
      </Portal>

      {/* Inspect Modal - Full Screen */}
      <Portal>
        <Modal
          visible={inspectVisible}
          onDismiss={() => setInspectVisible(false)}
          contentContainerStyle={{ flex: 1, margin: 0 }}
        >
          <SafeAreaView
            style={{ flex: 1, backgroundColor: isDark ? "#0d1117" : "#1e1e1e" }}
          >
            <View style={styles.logHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.logTitle}>
                  {currentContainerName} {t("docker.inspect", "- Inspect")}</Text>
              </View>
              <IconButton
                icon="close"
                iconColor="#fff"
                size={20}
                onPress={() => setInspectVisible(false)}
              />
            </View>
            {inspectLoading && !inspectContent ? (
              <View style={styles.centered}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <ScrollView style={styles.logScroll}>
                <Text style={styles.logText}>
                  {inspectContent || "No data found."}
                </Text>
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </SafeAreaView>
        </Modal>
      </Portal>

      {/* Pull Image Dialog */}
      <Portal>
        <Dialog visible={pullVisible} onDismiss={() => setPullVisible(false)}>
          <Dialog.Title>{t("docker.pullImage", "Pull Image")}</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 12 }}>
              {t(
                "docker.pullDesc",
                "Enter the name and tag of the image to pull. (e.g., ubuntu:latest)",
              )}
            </Text>
            <TextInput
              label={t("docker.imageName", "Image Name")}
              value={pullImage}
              onChangeText={setPullImage}
              mode="outlined"
              placeholder="ubuntu:latest"
              autoCapitalize="none"
              autoCorrect={false}
              disabled={pulling}
              right={
                pullSearchLoading ? (
                  <TextInput.Icon
                    icon={() => <ActivityIndicator size="small" />}
                  />
                ) : null
              }
            />
            {pullSuggestions.length > 0 && (
              <ScrollView
                style={{
                  maxHeight: 150,
                  marginTop: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 4,
                }}
              >
                {pullSuggestions.map((s, idx) => (
                  <Button
                    key={idx}
                    mode="text"
                    onPress={() => {
                      setPullImage(s.repo_name);
                      setPullSuggestions([]);
                    }}
                    style={{ alignItems: "flex-start", borderRadius: 0 }}
                    labelStyle={{ color: colors.text }}
                  >
                    {s.repo_name}
                  </Button>
                ))}
              </ScrollView>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPullVisible(false)} disabled={pulling}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              mode="contained"
              onPress={handlePullImage}
              loading={pulling}
              disabled={pulling || !pullImage.trim()}
            >
              {t("common.start", "Start")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Run Container Dialog */}
      <Portal>
        <Dialog visible={runVisible} onDismiss={() => setRunVisible(false)}>
          <Dialog.Title>{t("docker.runContainer", "Run Container")}</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={{ maxHeight: 400 }}>
              <TextInput
                label="Container Name (Optional)"
                value={runConfig.name}
                onChangeText={(text) =>
                  setRunConfig({ ...runConfig, name: text })
                }
                mode="outlined"
                style={{ marginBottom: 12 }}
              />

              <Text
                style={{
                  marginTop: 8,
                  marginBottom: 4,
                  fontWeight: "600",
                  color: colors.text,
                }}
              >
                {t("docker.restartPolicy", "Restart Policy")}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                {["no", "always", "on-failure", "unless-stopped"].map(
                  (policy) => (
                    <Chip
                      key={policy}
                      selected={runConfig.restartPolicy === policy}
                      onPress={() =>
                        setRunConfig({ ...runConfig, restartPolicy: policy })
                      }
                      style={{ marginRight: 8 }}
                    >
                      {policy}
                    </Chip>
                  ),
                )}
              </ScrollView>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                <Text style={{ fontWeight: "600", color: colors.text }}>
                  {t("docker.portMappings", "Port Mappings")}</Text>
                <Button
                  mode="text"
                  onPress={() =>
                    setRunConfig({
                      ...runConfig,
                      ports: [
                        ...runConfig.ports,
                        { hostPort: "", containerPort: "" },
                      ],
                    })
                  }
                >
                  {t("docker.add", "+ Add")}</Button>
              </View>
              {runConfig.ports.map((port, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    marginBottom: 8,
                    alignItems: "center",
                  }}
                >
                  <TextInput
                    label="Host"
                    value={port.hostPort}
                    onChangeText={(text) => {
                      const newPorts = [...runConfig.ports];
                      newPorts[idx].hostPort = text;
                      setRunConfig({ ...runConfig, ports: newPorts });
                    }}
                    mode="outlined"
                    style={{ flex: 1, height: 40 }}
                  />
                  <TextInput
                    label="Container"
                    value={port.containerPort}
                    onChangeText={(text) => {
                      const newPorts = [...runConfig.ports];
                      newPorts[idx].containerPort = text;
                      setRunConfig({ ...runConfig, ports: newPorts });
                    }}
                    mode="outlined"
                    style={{ flex: 1, height: 40 }}
                  />
                  <IconButton
                    icon="delete"
                    iconColor={colors.error}
                    size={20}
                    onPress={() => {
                      const newPorts = runConfig.ports.filter(
                        (_, i) => i !== idx,
                      );
                      setRunConfig({ ...runConfig, ports: newPorts });
                    }}
                  />
                </View>
              ))}

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 16,
                }}
              >
                <Text style={{ fontWeight: "600", color: colors.text }}>
                  {t("docker.environmentVariables", "Environment Variables")}</Text>
                <Button
                  mode="text"
                  onPress={() =>
                    setRunConfig({
                      ...runConfig,
                      env: [...runConfig.env, { key: "", value: "" }],
                    })
                  }
                >
                  {t("docker.add", "+ Add")}</Button>
              </View>
              {runConfig.env.map((env, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    marginBottom: 8,
                    alignItems: "center",
                  }}
                >
                  <TextInput
                    label="Key"
                    value={env.key}
                    onChangeText={(text) => {
                      const newEnv = [...runConfig.env];
                      newEnv[idx].key = text;
                      setRunConfig({ ...runConfig, env: newEnv });
                    }}
                    mode="outlined"
                    style={{ flex: 1, height: 40 }}
                  />
                  <TextInput
                    label="Value"
                    value={env.value}
                    onChangeText={(text) => {
                      const newEnv = [...runConfig.env];
                      newEnv[idx].value = text;
                      setRunConfig({ ...runConfig, env: newEnv });
                    }}
                    mode="outlined"
                    style={{ flex: 1, height: 40 }}
                  />
                  <IconButton
                    icon="delete"
                    iconColor={colors.error}
                    size={20}
                    onPress={() => {
                      const newEnv = runConfig.env.filter((_, i) => i !== idx);
                      setRunConfig({ ...runConfig, env: newEnv });
                    }}
                  />
                </View>
              ))}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setRunVisible(false)}
              disabled={actionLoading === "running"}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              mode="contained"
              onPress={handleRunContainer}
              loading={actionLoading === "running"}
              disabled={actionLoading === "running"}
            >
              {t("docker.run", "Run")}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      padding: 40,
      marginTop: 40,
    },
    emptyText: {
      marginTop: 10,
      color: colors.textSecondary,
      fontSize: 16,
      textAlign: "center",
    },
    tabContainer: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabBtn: {
      flex: 1,
      marginHorizontal: 4,
    },
    card: {
      marginBottom: 12,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    procName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 2,
    },
    procMeta: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    statsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    statItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    statValue: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.text,
    },
    overlayLoading: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },
    logHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: "#30363d",
      backgroundColor: "#161b22",
    },
    logTitle: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    logScroll: {
      flex: 1,
      padding: 12,
    },
    logText: {
      color: "#e6edf3",
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 12,
      lineHeight: 18,
    },
  });
