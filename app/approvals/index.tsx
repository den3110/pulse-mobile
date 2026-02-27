import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  Alert,
} from "react-native";
import {
  Text,
  ActivityIndicator,
  Portal,
  Dialog,
  Button,
  Chip,
  Card,
  TextInput,
  SegmentedButtons,
  FAB,
  IconButton,
  Avatar,
  Menu,
} from "react-native-paper";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface Approval {
  _id: string;
  title: string;
  description?: string;
  type: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: { _id: string; username: string; email: string };
  reviewedBy?: { _id: string; username: string };
  reviewedAt?: string;
  reviewComment?: string;
  project: { _id: string; name: string };
  createdAt: string;
}

const statusConfig: Record<
  string,
  { color: string; icon: string; label: string }
> = {
  pending: {
    color: "#f59e0b",
    icon: "timer-sand-empty",
    label: "Pending",
  },
  approved: {
    color: "#22c55e",
    icon: "check-circle",
    label: "Approved",
  },
  rejected: {
    color: "#ef4444",
    icon: "close-circle",
    label: "Rejected",
  },
};

const typeColors: Record<string, string> = {
  deploy: "#3b82f6",
  config_change: "#8b5cf6",
  rollback: "#f59e0b",
  delete: "#ef4444",
};

export default function ApprovalsScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const styles = createStyles(colors);

  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approvals, setApprovals] = useState<Approval[]>([]);

  // Dialog States
  const [createDialog, setCreateDialog] = useState(false);
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    id: string;
    action: string;
  }>({ open: false, id: "", action: "" });
  const [reviewComment, setReviewComment] = useState("");
  const [newApproval, setNewApproval] = useState({
    title: "",
    description: "",
    type: "deploy",
    projectId: "", // Not fully handling project selection in this simplified mobile view initially to avoid complex fetch requirements
  });

  const fetchApprovals = useCallback(async () => {
    try {
      const { data } = await api.get(`/approvals?status=${tab}`);
      setApprovals(data.approvals || []);
    } catch (error) {
      console.error("Failed to load approvals", error);
      Alert.alert(
        t("common.error"),
        t("approvals.failedToLoad", "Failed to load approvals"),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, t]);

  useEffect(() => {
    setLoading(true);
    fetchApprovals();
  }, [fetchApprovals]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchApprovals();
  };

  const handleCreateApproval = async () => {
    if (!newApproval.title) return;
    try {
      await api.post("/approvals", newApproval);
      setCreateDialog(false);
      setNewApproval({
        title: "",
        description: "",
        type: "deploy",
        projectId: "",
      });
      fetchApprovals();
    } catch (error: any) {
      Alert.alert(t("common.error"), error.response?.data?.message || "Failed");
    }
  };

  const handleReview = async () => {
    try {
      await api.post(`/approvals/${reviewDialog.id}/review`, {
        action: reviewDialog.action,
        comment: reviewComment,
      });
      setReviewDialog({ open: false, id: "", action: "" });
      setReviewComment("");
      fetchApprovals();
    } catch (error: any) {
      Alert.alert(t("common.error"), error.response?.data?.message || "Failed");
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      t("common.confirmDelete", "Are you sure?"),
      t(
        "approvals.deleteConfirmText",
        "This approval request will be permanently deleted.",
      ),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("common.delete", "Delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/approvals/${id}`);
              fetchApprovals();
            } catch (error: any) {
              Alert.alert(
                t("common.error"),
                error.response?.data?.message || "Failed",
              );
            }
          },
        },
      ],
    );
  };

  // Rendering Items
  const renderItem = (approval: Approval) => {
    const sConf = statusConfig[approval.status];
    const tCol = typeColors[approval.type] || "#64748b";

    return (
      <Card key={approval._id} style={[styles.card, { borderLeftColor: tCol }]}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {approval.title}
              </Text>
              <Chip
                compact
                style={{ backgroundColor: `${tCol}20` }}
                textStyle={{ color: tCol, fontSize: 10, marginVertical: 0 }}
              >
                {approval.type.replace("_", " ")}
              </Chip>
            </View>
            <Chip
              icon={sConf.icon}
              compact
              style={{ backgroundColor: `${sConf.color}15`, marginTop: 4 }}
              textStyle={{
                color: sConf.color,
                fontSize: 10,
                marginVertical: 0,
              }}
            >
              {sConf.label}
            </Chip>
          </View>

          {approval.description && (
            <Text style={styles.description} numberOfLines={2}>
              {approval.description}
            </Text>
          )}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>{t("approvals.project", "Project")}</Text>
              <Text style={styles.metaValue}>
                {approval.project?.name || "—"}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>{t("approvals.date", "Date")}</Text>
              <Text style={styles.metaValue}>
                {new Date(approval.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>

          <View style={styles.footerRow}>
            <View style={styles.requester}>
              <Avatar.Text
                size={20}
                label={
                  approval.requestedBy?.username?.[0]?.toUpperCase() || "?"
                }
              />
              <Text style={styles.requesterName}>
                {approval.requestedBy?.username}
              </Text>
            </View>

            <View style={styles.actions}>
              {approval.status === "pending" && (
                <>
                  <IconButton
                    icon="check-circle"
                    iconColor="#22c55e"
                    size={20}
                    style={styles.iconBtn}
                    onPress={() =>
                      setReviewDialog({
                        open: true,
                        id: approval._id,
                        action: "approve",
                      })
                    }
                  />
                  <IconButton
                    icon="close-circle"
                    iconColor="#ef4444"
                    size={20}
                    style={styles.iconBtn}
                    onPress={() =>
                      setReviewDialog({
                        open: true,
                        id: approval._id,
                        action: "reject",
                      })
                    }
                  />
                </>
              )}
              <IconButton
                icon="delete"
                iconColor={colors.textSecondary}
                size={20}
                style={styles.iconBtn}
                onPress={() => handleDelete(approval._id)}
              />
            </View>
          </View>

          {approval.reviewedBy && (
            <View style={styles.reviewBox}>
              <Text style={styles.reviewText}>
                {t("approvals.reviewedBy", "Reviewed by")}{" "}
                <Text style={{ fontWeight: "bold" }}>
                  {approval.reviewedBy.username}
                </Text>
                {approval.reviewComment ? ` — "${approval.reviewComment}"` : ""}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{ title: t("approvals.title", "Approval Center") }}
      />

      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={tab}
          onValueChange={setTab}
          buttons={[
            { value: "all", label: "All" },
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Apprv" },
            { value: "rejected", label: "Rej" },
          ]}
          density="small"
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : approvals.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <MaterialCommunityIcons
            name="timer-sand-empty"
            size={48}
            color={colors.textSecondary}
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.emptyText}>
            {t("approvals.noApprovals", "No approval requests")}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {approvals.map(renderItem)}
        </ScrollView>
      )}

      {/* FAB to Create */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: colors.primary }]}
        color={colors.background}
        onPress={() => setCreateDialog(true)}
      />

      {/* Create Dialog */}
      <Portal>
        <Dialog visible={createDialog} onDismiss={() => setCreateDialog(false)}>
          <Dialog.Title>
            {t("approvals.newRequest", "New Request")}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Title"
              mode="outlined"
              value={newApproval.title}
              onChangeText={(t) => setNewApproval((p) => ({ ...p, title: t }))}
              style={styles.input}
              dense
            />

            <View style={styles.input}>
              <Menu
                visible={typeMenuVisible}
                onDismiss={() => setTypeMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setTypeMenuVisible(true)}
                  >
                    {t("approvals.type", "Type:")}{newApproval.type}
                  </Button>
                }
              >
                <Menu.Item
                  onPress={() => {
                    setNewApproval((p) => ({ ...p, type: "deploy" }));
                    setTypeMenuVisible(false);
                  }}
                  title="deploy"
                />
                <Menu.Item
                  onPress={() => {
                    setNewApproval((p) => ({ ...p, type: "config_change" }));
                    setTypeMenuVisible(false);
                  }}
                  title="config_change"
                />
                <Menu.Item
                  onPress={() => {
                    setNewApproval((p) => ({ ...p, type: "rollback" }));
                    setTypeMenuVisible(false);
                  }}
                  title="rollback"
                />
                <Menu.Item
                  onPress={() => {
                    setNewApproval((p) => ({ ...p, type: "delete" }));
                    setTypeMenuVisible(false);
                  }}
                  title="delete"
                />
              </Menu>
            </View>

            <TextInput
              label="Description"
              mode="outlined"
              value={newApproval.description}
              onChangeText={(t) =>
                setNewApproval((p) => ({ ...p, description: t }))
              }
              style={styles.input}
              multiline
              numberOfLines={3}
              dense
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateDialog(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              mode="contained"
              onPress={handleCreateApproval}
              disabled={!newApproval.title}
            >
              {t("common.create", "Create")}
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Review Dialog */}
        <Dialog
          visible={reviewDialog.open}
          onDismiss={() => setReviewDialog({ open: false, id: "", action: "" })}
        >
          <Dialog.Title>
            {reviewDialog.action === "approve" ? "✅ Approve" : "❌ Reject"}{" "}
            {t("approvals.request", "Request")}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Comment (Optional)"
              mode="outlined"
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              numberOfLines={3}
              dense
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() =>
                setReviewDialog({ open: false, id: "", action: "" })
              }
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              mode="contained"
              buttonColor={
                reviewDialog.action === "approve" ? "#22c55e" : "#ef4444"
              }
              onPress={handleReview}
            >
              {reviewDialog.action === "approve" ? "Approve" : "Reject"}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
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
    },
    tabContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 80,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyText: {
      color: colors.textSecondary,
    },
    card: {
      marginBottom: 12,
      backgroundColor: colors.surface,
      borderLeftWidth: 4,
      elevation: 0,
      borderTopWidth: 1,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    cardContent: {
      padding: 12,
    },
    cardHeader: {
      alignItems: "flex-start",
      marginBottom: 8,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      marginBottom: 4,
    },
    title: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      flex: 1,
      marginRight: 8,
    },
    description: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    metaRow: {
      flexDirection: "row",
      gap: 16,
      marginBottom: 12,
    },
    metaItem: {
      flex: 1,
    },
    metaLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      textTransform: "uppercase",
    },
    metaValue: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.text,
      marginTop: 2,
    },
    footerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
    requester: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    requesterName: {
      fontSize: 12,
      color: colors.text,
    },
    actions: {
      flexDirection: "row",
      marginRight: -8,
    },
    iconBtn: {
      margin: 0,
    },
    reviewBox: {
      marginTop: 12,
      padding: 8,
      backgroundColor: "rgba(128,128,128,0.1)",
      borderRadius: 6,
    },
    reviewText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    fab: {
      position: "absolute",
      margin: 16,
      right: 0,
      bottom: 0,
    },
    input: {
      marginBottom: 12,
      backgroundColor: "transparent",
    },
  });
