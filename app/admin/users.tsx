import { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  ActivityIndicator,
  Chip,
  IconButton,
  FAB,
  Menu,
  Dialog,
  Portal,
} from "react-native-paper";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { Colors, inputTheme } from "../../constants/theme";
import { useAppTheme } from "../../contexts/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface User {
  _id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function UserManagementScreen() {
  const { t } = useTranslation();
  const { colors, inputTheme: themeInput } = useAppTheme();
  const Colors = colors;
  const inputTheme = themeInput;
  const styles = createStyles(colors);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formUsername, setFormUsername] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("user");
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUsers();
  }, []);

  const openCreateForm = () => {
    setEditingUser(null);
    setFormUsername("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("user");
    setShowForm(true);
  };

  const openEditForm = (user: User) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormEmail(user.email);
    setFormPassword("");
    setFormRole(user.role);
    setShowForm(true);
    setMenuVisible(null);
  };

  const handleSubmit = async () => {
    if (!formUsername.trim() || !formEmail.trim()) {
      Alert.alert(t("common.error"), t("admin.usernameEmailRequired"));
      return;
    }
    setSaving(true);
    try {
      if (editingUser) {
        await api.put(`/admin/users/${editingUser._id}`, {
          username: formUsername.trim(),
          email: formEmail.trim(),
          role: formRole,
        });
      } else {
        if (!formPassword) {
          Alert.alert(t("common.error"), t("admin.passwordRequired"));
          setSaving(false);
          return;
        }
        await api.post("/admin/users", {
          username: formUsername.trim(),
          email: formEmail.trim(),
          password: formPassword,
          role: formRole,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowForm(false);
      fetchUsers();
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (user: User) => {
    setMenuVisible(null);
    Alert.alert(
      t("admin.deleteUser"),
      t("admin.deleteUserConfirm", { username: user.username }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/admin/users/${user._id}`);
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              fetchUsers();
            } catch (err: any) {
              Alert.alert(
                t("common.error"),
                err.response?.data?.message || t("common.failed"),
              );
            }
          },
        },
      ],
    );
  };

  const handleResetPassword = (user: User) => {
    setMenuVisible(null);
    Alert.prompt?.(
      t("admin.resetPassword"),
      `${t("admin.newPasswordFor")} ${user.username}:`,
      async (newPassword: string) => {
        if (!newPassword || newPassword.length < 6) {
          Alert.alert(t("common.error"), t("admin.passwordMinLength"));
          return;
        }
        try {
          await api.post(`/admin/users/${user._id}/reset-password`, {
            newPassword,
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await api.post(`/admin/users/${user._id}/reset-password`, {
            newPassword,
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(t("common.success"), t("admin.passwordReset"));
        } catch (err: any) {
          Alert.alert(
            t("common.error"),
            err.response?.data?.message || t("common.failed"),
          );
        }
      },
    ) ?? Alert.alert(t("admin.resetPassword"), t("admin.resetPasswordWeb"));
  };

  const roleColor = (role: string) => {
    switch (role) {
      case "admin":
        return Colors.error;
      case "manager":
        return Colors.warning;
      default:
        return Colors.info;
    }
  };

  if (showForm) {
    return (
      <>
        <Stack.Screen
          options={{
            title: editingUser ? t("admin.editUser") : t("admin.createUser"),
          }}
        />
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: Colors.background }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
          >
            <TextInput
              label={t("auth.username") + " *"}
              value={formUsername}
              onChangeText={setFormUsername}
              mode="outlined"
              autoCapitalize="none"
              left={<TextInput.Icon icon="account" />}
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              textColor={Colors.text}
              theme={inputTheme}
            />
            <TextInput
              label={t("auth.email") + " *"}
              value={formEmail}
              onChangeText={setFormEmail}
              mode="outlined"
              autoCapitalize="none"
              keyboardType="email-address"
              left={<TextInput.Icon icon="email" />}
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              textColor={Colors.text}
              theme={inputTheme}
            />
            {!editingUser && (
              <TextInput
                label={t("auth.password") + " *"}
                value={formPassword}
                onChangeText={setFormPassword}
                mode="outlined"
                secureTextEntry
                left={<TextInput.Icon icon="lock" />}
                style={styles.input}
                outlineColor={Colors.border}
                activeOutlineColor={Colors.primary}
                textColor={Colors.text}
                theme={inputTheme}
              />
            )}

            <Text style={styles.label}>{t("admin.role")}</Text>
            <View style={styles.roleRow}>
              {["user", "manager", "admin"].map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setFormRole(r)}
                  style={[
                    styles.roleChip,
                    formRole === r && { backgroundColor: roleColor(r) },
                  ]}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      formRole === r && { color: "#fff" },
                    ]}
                  >
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.formActions}>
              <Button
                mode="outlined"
                onPress={() => setShowForm(false)}
                style={styles.formBtn}
                textColor={Colors.textSecondary}
              >
                {t("common.cancel")}
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={saving}
                buttonColor={Colors.primary}
                style={styles.formBtn}
              >
                {editingUser ? t("common.save") : t("common.create")}
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderUser = ({ item }: { item: User }) => (
    <View style={styles.userCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.userName}>{item.username}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
        <Text style={styles.userDate}>
          Joined: {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.userActions}>
        <Chip
          compact
          style={{ backgroundColor: roleColor(item.role) + "20" }}
          textStyle={{
            color: roleColor(item.role),
            fontSize: 11,
            fontWeight: "700",
          }}
        >
          {item.role}
        </Chip>
        <Menu
          visible={menuVisible === item._id}
          onDismiss={() => setMenuVisible(null)}
          anchor={
            <IconButton
              icon="dots-vertical"
              iconColor={Colors.textSecondary}
              size={20}
              onPress={() => setMenuVisible(item._id)}
            />
          }
          contentStyle={{ backgroundColor: Colors.surface }}
        >
          <Menu.Item
            onPress={() => openEditForm(item)}
            title={t("common.edit")}
            leadingIcon="pencil"
          />
          <Menu.Item
            onPress={() => handleResetPassword(item)}
            title={t("admin.resetPassword")}
            leadingIcon="lock-reset"
          />
          <Menu.Item
            onPress={() => handleDelete(item)}
            title={t("common.delete")}
            leadingIcon="delete"
            titleStyle={{ color: Colors.error }}
          />
        </Menu>
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{ title: `${t("admin.manageUsers")} (${users.length})` }}
      />
      <View style={styles.container}>
        <FlatList
          data={users}
          keyExtractor={(item) => item._id}
          renderItem={renderUser}
          contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons
                name="account-group"
                size={48}
                color={Colors.textSecondary}
              />
              <Text style={styles.emptyText}>{t("admin.noUsers")}</Text>
            </View>
          }
        />
        <FAB
          icon="plus"
          style={styles.fab}
          color="#fff"
          onPress={openCreateForm}
        />
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
      backgroundColor: Colors.background,
    },
    userCard: {
      flexDirection: "row",
      backgroundColor: Colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      alignItems: "center",
    },
    userName: { fontSize: 15, fontWeight: "700", color: Colors.text },
    userEmail: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
    userDate: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
    userActions: { alignItems: "center", gap: 4 },
    fab: {
      position: "absolute",
      bottom: 20,
      right: 20,
      backgroundColor: Colors.primary,
      borderRadius: 16,
    },
    empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
    emptyText: { color: Colors.textSecondary, fontSize: 14 },
    form: { padding: 20, gap: 14, paddingBottom: 40 },
    input: { backgroundColor: Colors.surface },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textSecondary,
      marginTop: 4,
    },
    roleRow: { flexDirection: "row", gap: 10 },
    roleChip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: Colors.surfaceVariant,
    },
    roleChipText: { color: Colors.text, fontWeight: "600", fontSize: 13 },
    formActions: { flexDirection: "row", gap: 10, marginTop: 16 },
    formBtn: { flex: 1, borderRadius: 10 },
  });
