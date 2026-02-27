import { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
  FlatList,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  Switch,
  ActivityIndicator,
  IconButton,
  SegmentedButtons,
  Chip,
  Divider,
  Searchbar,
} from "react-native-paper";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { Colors, inputTheme } from "../../constants/theme";
import { useAppTheme } from "../../contexts/ThemeContext";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function ProjectFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, inputTheme: themeInput } = useAppTheme();
  const Colors = colors;
  const inputTheme = themeInput;
  const styles = createStyles(colors);
  const isEditing = !!id;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [serverId, setServerId] = useState("");
  const [deployPath, setDeployPath] = useState("");
  const [buildCommand, setBuildCommand] = useState("");
  const [installCommand, setInstallCommand] = useState("npm install");
  const [startCommand, setStartCommand] = useState("npm start");
  const [stopCommand, setStopCommand] = useState("");
  const [autoDeploy, setAutoDeploy] = useState(false);
  const [processManager, setProcessManager] = useState<"nohup" | "pm2">(
    "nohup",
  );
  const [repoFolder, setRepoFolder] = useState("");
  const [outputPath, setOutputPath] = useState("");
  const [buildOutputDir, setBuildOutputDir] = useState("");
  const [environment, setEnvironment] = useState<
    "node" | "python" | "static" | "docker-compose"
  >("node");
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [detecting, setDetecting] = useState(false);

  // ── Tabs ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"manual" | "github">("manual");

  // ── GitHub state ────────────────────────────────────────────────────────────
  const [repos, setRepos] = useState<any[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposPage, setReposPage] = useState(1);
  const [reposHasMore, setReposHasMore] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<any>(null);
  const [githubConnected, setGithubConnected] = useState(true);
  const [analyzingRepo, setAnalyzingRepo] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const serversRes = await api.get("/servers");
        setServers(serversRes.data);

        if (isEditing) {
          const res = await api.get(`/projects/${id}`);
          const p = res.data;
          setName(p.name);
          setRepoUrl(p.repoUrl);
          setBranch(p.branch);
          setServerId(p.server?._id || p.server);
          setDeployPath(p.deployPath);
          setBuildCommand(p.buildCommand || "");
          setInstallCommand(p.installCommand || "npm install");
          setStartCommand(p.startCommand || "npm start");
          setStopCommand(p.stopCommand || "");
          setAutoDeploy(p.autoDeploy || false);
          setProcessManager(p.processManager || "nohup");
          setRepoFolder(p.repoFolder || "");
          setOutputPath(p.outputPath || "");
          setBuildOutputDir(p.buildOutputDir || "");
          setEnvironment(p.environment || "node");
          if (p.envVars) {
            setEnvVars(
              Object.entries(p.envVars).map(([key, value]) => ({
                key,
                value: String(value),
              })),
            );
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    };
    init();
  }, [id]);

  // ── GitHub repo fetching ──────────────────────────────────────────────────
  const fetchRepos = useCallback(
    async (page: number, search: string, append = false) => {
      setReposLoading(true);
      try {
        const params: Record<string, any> = { page, per_page: 20 };
        if (search.trim()) params.search = search.trim();
        const { data } = await api.get("/auth/github/repos", { params });
        const newRepos: any[] = Array.isArray(data) ? data : data.repos || [];
        const hasMore: boolean = Array.isArray(data)
          ? data.length === 20
          : data.hasMore || false;
        setRepos((prev) => (append ? [...prev, ...newRepos] : newRepos));
        setReposHasMore(hasMore);
        setGithubConnected(true);
      } catch (error: any) {
        console.error("Failed to fetch repos", error);
        if (
          error.response?.status === 400 &&
          error.response?.data?.message === "GitHub not connected"
        ) {
          setGithubConnected(false);
        }
      } finally {
        setReposLoading(false);
      }
    },
    [],
  );

  // Fetch repos when GitHub tab is active
  useEffect(() => {
    if (activeTab !== "github" || selectedRepo || isEditing) return;
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(
      () => {
        setReposPage(1);
        setRepos([]);
        fetchRepos(1, repoSearch, false);
      },
      repoSearch ? 500 : 0,
    );
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [activeTab, repoSearch, selectedRepo, fetchRepos]);

  const loadMoreRepos = () => {
    if (reposHasMore && !reposLoading) {
      const nextPage = reposPage + 1;
      setReposPage(nextPage);
      fetchRepos(nextPage, repoSearch, true);
    }
  };

  // ── Select repo (analyze framework) ────────────────────────────────────────
  const handleSelectRepo = async (repo: any) => {
    setAnalyzingRepo(true);
    setSelectedRepo(repo);
    try {
      const ownerLogin = repo.owner?.login || repo.owner || "";
      const { data } = await api.post("/auth/github/detect-framework", {
        owner: ownerLogin,
        repo: repo.name,
        branch: repo.default_branch || repo.defaultBranch || "main",
      });
      setName(repo.name);
      setRepoUrl(repo.html_url || repo.htmlUrl || "");
      setBranch(repo.default_branch || repo.defaultBranch || "main");
      setBuildCommand(data.buildCommand || buildCommand);
      setStartCommand(data.startCommand || startCommand);
      setBuildOutputDir(data.outputDir || buildOutputDir);
      setAutoDeploy(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      // Basic info only
      setName(repo.name);
      setRepoUrl(repo.html_url || repo.htmlUrl || "");
      setBranch(repo.default_branch || repo.defaultBranch || "main");
      setAutoDeploy(true);
    } finally {
      setAnalyzingRepo(false);
    }
  };

  const handleBackToRepoList = () => {
    setSelectedRepo(null);
    setName("");
    setRepoUrl("");
    setBranch("main");
    setBuildCommand("");
    setInstallCommand("npm install");
    setStartCommand("npm start");
    setStopCommand("");
    setAutoDeploy(false);
    setBuildOutputDir("");
  };

  const detectBranch = async () => {
    if (!repoUrl.trim()) return;
    setDetecting(true);
    try {
      const res = await api.post("/projects/detect-branch", { repoUrl });
      setBranch(res.data.branch || "main");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("projects.detectBranchFailed"),
      );
    } finally {
      setDetecting(false);
    }
  };

  const addEnvVar = () => setEnvVars([...envVars, { key: "", value: "" }]);
  const removeEnvVar = (i: number) =>
    setEnvVars(envVars.filter((_, idx) => idx !== i));
  const updateEnvVar = (i: number, field: "key" | "value", val: string) => {
    const updated = [...envVars];
    updated[i][field] = val;
    setEnvVars(updated);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !repoUrl.trim() || !serverId || !deployPath.trim()) {
      Alert.alert(t("common.error"), t("projects.fillRequired"));
      return;
    }
    setLoading(true);
    try {
      const envObj: Record<string, string> = {};
      envVars.forEach((e) => {
        if (e.key.trim()) envObj[e.key.trim()] = e.value;
      });

      const payload = {
        name: name.trim(),
        repoUrl: repoUrl.trim(),
        branch,
        server: serverId,
        deployPath: deployPath.trim(),
        buildCommand,
        installCommand,
        startCommand,
        stopCommand,
        autoDeploy,
        processManager,
        repoFolder: repoFolder.trim(),
        outputPath: outputPath.trim(),
        buildOutputDir: buildOutputDir.trim(),
        environment,
        envVars: envObj,
      };

      if (isEditing) {
        await api.put(`/projects/${id}`, payload);
      } else {
        const { data: newProject } = await api.post("/projects", payload);

        // Auto-setup webhook if created via GitHub Integration
        if (activeTab === "github" && selectedRepo) {
          try {
            const ownerLogin =
              selectedRepo.owner?.login || selectedRepo.owner || "";
            await api.post("/auth/github/webhook", {
              owner: ownerLogin,
              repo: selectedRepo.name,
              projectId: newProject._id,
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (err) {
            console.error("Failed to setup webhook", err);
          }
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.response?.data?.message || t("common.failed"),
      );
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // ── GitHub Repo List ──────────────────────────────────────────────────────
  const renderRepoItem = ({ item: repo }: { item: any }) => (
    <Pressable style={styles.repoItem} onPress={() => handleSelectRepo(repo)}>
      <View style={styles.repoIcon}>
        <MaterialCommunityIcons name="github" size={24} color={Colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.repoName}>{repo.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Chip compact textStyle={{ fontSize: 10 }} style={styles.repoChip}>
            {repo.private ? "Private" : "Public"}
          </Chip>
          <Text style={styles.repoBranch}>
            {repo.default_branch || repo.defaultBranch || "main"}
          </Text>
        </View>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={Colors.textSecondary}
      />
    </Pressable>
  );

  const renderGitHubTab = () => {
    if (!githubConnected) {
      return (
        <View style={styles.githubNotConnected}>
          <MaterialCommunityIcons
            name="github"
            size={48}
            color={Colors.textSecondary}
          />
          <Text style={styles.githubNotConnectedTitle}>
            GitHub Not Connected
          </Text>
          <Text style={styles.githubNotConnectedDesc}>
            Connect your GitHub account in Settings to import repositories.
          </Text>
        </View>
      );
    }

    // Step 2: Configure form after selecting repo
    if (selectedRepo) {
      if (analyzingRepo) {
        return (
          <View style={styles.analyzingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.analyzingText}>
              Analyzing {selectedRepo.name}...
            </Text>
          </View>
        );
      }
      return (
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          {/* Selected repo banner */}
          <View style={styles.selectedRepoBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedRepoName}>{selectedRepo.name}</Text>
              <Text style={styles.selectedRepoMeta}>
                {selectedRepo.private ? "Private" : "Public"} ·{" "}
                {selectedRepo.full_name || selectedRepo.fullName}
              </Text>
            </View>
            <Button
              mode="outlined"
              compact
              onPress={handleBackToRepoList}
              textColor={Colors.primary}
              icon="arrow-left"
            >
              {t("common.change") || "Change"}
            </Button>
          </View>

          <Divider style={{ marginVertical: 8 }} />

          {renderConfigureForm()}
        </ScrollView>
      );
    }

    // Step 1: Repo list
    return (
      <View style={{ flex: 1 }}>
        <Searchbar
          placeholder={t("projects.searchRepos") || "Search repository..."}
          value={repoSearch}
          onChangeText={setRepoSearch}
          style={styles.searchBar}
          inputStyle={{ fontSize: 14, color: Colors.text }}
          iconColor={Colors.textSecondary}
          placeholderTextColor={Colors.textSecondary}
        />
        <FlatList
          data={repos}
          renderItem={renderRepoItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          onEndReached={loadMoreRepos}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            reposLoading ? (
              <ActivityIndicator
                size="small"
                color={Colors.primary}
                style={{ marginVertical: 16 }}
              />
            ) : !reposHasMore && repos.length > 0 ? (
              <Text style={styles.allLoadedText}>
                {t("projects.allReposLoaded") || "All repositories loaded"}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            !reposLoading ? (
              <Text style={styles.emptyText}>
                {repoSearch
                  ? t("projects.noMatchingRepos") ||
                    "No matching repositories found."
                  : t("projects.noReposFound") ||
                    "No repositories found for this account."}
              </Text>
            ) : null
          }
        />
      </View>
    );
  };

  // ── Shared Configure Form ─────────────────────────────────────────────────
  const renderConfigureForm = () => (
    <>
      {/* Name */}
      <TextInput
        label={t("projects.name") + " *"}
        value={name}
        onChangeText={setName}
        mode="outlined"
        left={<TextInput.Icon icon="folder" />}
        style={styles.input}
        outlineColor={Colors.border}
        activeOutlineColor={Colors.primary}
        textColor={Colors.text}
        theme={inputTheme}
      />

      {/* Repo URL */}
      <TextInput
        label={t("projects.repoUrl") + " *"}
        value={repoUrl}
        onChangeText={activeTab === "github" ? undefined : setRepoUrl}
        mode="outlined"
        autoCapitalize="none"
        left={<TextInput.Icon icon="git" />}
        style={styles.input}
        outlineColor={Colors.border}
        activeOutlineColor={Colors.primary}
        textColor={Colors.text}
        theme={inputTheme}
        editable={activeTab !== "github"}
      />

      {/* Branch */}
      <View style={styles.branchRow}>
        <TextInput
          label={t("projects.branch")}
          value={branch}
          onChangeText={setBranch}
          mode="outlined"
          autoCapitalize="none"
          left={<TextInput.Icon icon="source-branch" />}
          style={[styles.input, { flex: 1 }]}
          outlineColor={Colors.border}
          activeOutlineColor={Colors.primary}
          textColor={Colors.text}
          theme={inputTheme}
        />
        <Button
          mode="outlined"
          onPress={detectBranch}
          loading={detecting}
          compact
          style={styles.detectBtn}
          textColor={Colors.primary}
        >
          {t("common.detect") || "Detect"}
        </Button>
      </View>

      {/* Server picker */}
      <Text style={styles.label}>{t("projects.server")} *</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 8 }}
      >
        {servers.map((s) => (
          <Pressable
            key={s._id}
            onPress={() => setServerId(s._id)}
            style={[
              styles.serverChip,
              serverId === s._id && styles.serverChipSelected,
            ]}
          >
            <Text
              style={[
                styles.serverChipText,
                serverId === s._id && { color: "#fff" },
              ]}
            >
              {s.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Deploy Path */}
      <TextInput
        label={t("projects.deployPath") + " *"}
        value={deployPath}
        onChangeText={setDeployPath}
        mode="outlined"
        autoCapitalize="none"
        left={<TextInput.Icon icon="folder-open" />}
        style={styles.input}
        outlineColor={Colors.border}
        activeOutlineColor={Colors.primary}
        textColor={Colors.text}
        theme={inputTheme}
        placeholder="/var/www/my-app"
      />

      {/* Repo Folder */}
      <TextInput
        label={t("projects.repoFolder")}
        value={repoFolder}
        onChangeText={setRepoFolder}
        mode="outlined"
        autoCapitalize="none"
        left={<TextInput.Icon icon="folder-outline" />}
        style={styles.input}
        outlineColor={Colors.border}
        activeOutlineColor={Colors.primary}
        textColor={Colors.text}
        theme={inputTheme}
        placeholder="docs (optional)"
      />

      {/* Output Path */}
      <TextInput
        label={t("projects.outputPath")}
        value={outputPath}
        onChangeText={setOutputPath}
        mode="outlined"
        autoCapitalize="none"
        left={<TextInput.Icon icon="file-export-outline" />}
        style={styles.input}
        outlineColor={Colors.border}
        activeOutlineColor={Colors.primary}
        textColor={Colors.text}
        theme={inputTheme}
        placeholder="/var/www/my-app-dist"
      />

      {/* Build Output Dir */}
      <TextInput
        label={t("projects.buildOutput")}
        value={buildOutputDir}
        onChangeText={setBuildOutputDir}
        mode="outlined"
        autoCapitalize="none"
        left={<TextInput.Icon icon="folder-multiple-outline" />}
        style={styles.input}
        outlineColor={Colors.border}
        activeOutlineColor={Colors.primary}
        textColor={Colors.text}
        theme={inputTheme}
        placeholder="build or dist"
      />

      {/* Environment */}
      <View style={{ marginVertical: 8 }}>
        <Text style={styles.label}>
          {t("projects.environment", "Environment")}
        </Text>
        <SegmentedButtons
          value={environment}
          onValueChange={(val) => setEnvironment(val as any)}
          buttons={[
            { value: "node", label: "Node.js", showSelectedCheck: true },
            { value: "python", label: "Python", showSelectedCheck: true },
            { value: "static", label: "Static", showSelectedCheck: true },
            {
              value: "docker-compose",
              label: "Docker",
              showSelectedCheck: true,
            },
          ]}
          style={{ marginTop: 8 }}
        />
      </View>

      {/* Commands (hidden for docker-compose) */}
      {environment !== "docker-compose" && (
        <>
          <Text style={styles.sectionTitle}>
            {t("projects.commandsSection")}
          </Text>
          <TextInput
            label={t("projects.installCommand")}
            value={installCommand}
            onChangeText={setInstallCommand}
            mode="outlined"
            autoCapitalize="none"
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            textColor={Colors.text}
            theme={inputTheme}
          />
          <TextInput
            label={t("projects.buildCommand")}
            value={buildCommand}
            onChangeText={setBuildCommand}
            mode="outlined"
            autoCapitalize="none"
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            textColor={Colors.text}
            theme={inputTheme}
          />
          <TextInput
            label={t("projects.startCommand")}
            value={startCommand}
            onChangeText={setStartCommand}
            mode="outlined"
            autoCapitalize="none"
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            textColor={Colors.text}
            theme={inputTheme}
          />
          <TextInput
            label={t("projects.stopCommand")}
            value={stopCommand}
            onChangeText={setStopCommand}
            mode="outlined"
            autoCapitalize="none"
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            textColor={Colors.text}
            theme={inputTheme}
          />

          <View style={{ marginVertical: 8 }}>
            <Text style={styles.label}>Process Manager</Text>
            <SegmentedButtons
              value={processManager}
              onValueChange={(val) => setProcessManager(val as "nohup" | "pm2")}
              buttons={[
                { value: "nohup", label: "Nohup", showSelectedCheck: true },
                { value: "pm2", label: "PM2", showSelectedCheck: true },
              ]}
              style={{ marginTop: 8 }}
            />
          </View>
        </>
      )}

      {/* Auto Deploy */}
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t("projects.autoDeploy")}</Text>
        <Switch
          value={autoDeploy}
          onValueChange={setAutoDeploy}
          color={Colors.primary}
        />
      </View>

      {/* Env vars */}
      <View style={styles.envHeader}>
        <Text style={styles.label}>{t("projects.envVars")}</Text>
        <IconButton
          icon="plus"
          iconColor={Colors.primary}
          size={20}
          onPress={addEnvVar}
        />
      </View>
      {envVars.map((env, i) => (
        <View key={i} style={styles.envRow}>
          <TextInput
            label={t("projects.envKey")}
            value={env.key}
            onChangeText={(v) => updateEnvVar(i, "key", v)}
            mode="outlined"
            autoCapitalize="none"
            style={[styles.input, { flex: 1 }]}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            textColor={Colors.text}
            theme={inputTheme}
            dense
          />
          <TextInput
            label={t("projects.envValue")}
            value={env.value}
            onChangeText={(v) => updateEnvVar(i, "value", v)}
            mode="outlined"
            autoCapitalize="none"
            style={[styles.input, { flex: 1 }]}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
            textColor={Colors.text}
            theme={inputTheme}
            dense
          />
          <IconButton
            icon="close"
            iconColor={Colors.error}
            size={18}
            onPress={() => removeEnvVar(i)}
          />
        </View>
      ))}

      {/* Submit */}
      <Button
        mode="contained"
        onPress={handleSubmit}
        loading={loading}
        disabled={loading}
        style={styles.submitBtn}
        contentStyle={{ paddingVertical: 6 }}
        labelStyle={{ fontWeight: "700", fontSize: 16 }}
        buttonColor={Colors.primary}
      >
        {isEditing ? t("common.save") : t("projects.addProject")}
      </Button>
    </>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditing
            ? t("projects.editProject")
            : t("projects.addProject"),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Tabs — only show when creating */}
        {!isEditing && (
          <View style={styles.tabContainer}>
            <Pressable
              style={[styles.tab, activeTab === "manual" && styles.tabActive]}
              onPress={() => {
                setActiveTab("manual");
                setSelectedRepo(null);
              }}
            >
              <MaterialCommunityIcons
                name="pencil"
                size={16}
                color={
                  activeTab === "manual" ? Colors.primary : Colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "manual" && styles.tabTextActive,
                ]}
              >
                {t("projects.manual") || "Manual"}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === "github" && styles.tabActive]}
              onPress={() => setActiveTab("github")}
            >
              <MaterialCommunityIcons
                name="github"
                size={16}
                color={
                  activeTab === "github" ? Colors.primary : Colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "github" && styles.tabTextActive,
                ]}
              >
                {t("projects.githubIntegration") || "GitHub"}
              </Text>
              {selectedRepo && (
                <Chip
                  compact
                  textStyle={{ fontSize: 9, color: "#fff" }}
                  style={{
                    backgroundColor: Colors.success || "#4caf50",
                    height: 20,
                    marginLeft: 4,
                  }}
                >
                  {selectedRepo.name}
                </Chip>
              )}
            </Pressable>
          </View>
        )}

        {/* Manual tab */}
        {(isEditing || activeTab === "manual") && (
          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
          >
            {renderConfigureForm()}
          </ScrollView>
        )}

        {/* GitHub tab */}
        {!isEditing && activeTab === "github" && renderGitHubTab()}
      </KeyboardAvoidingView>
    </>
  );
}

const createStyles = (Colors: any) =>
  StyleSheet.create({
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.background,
    },
    form: { padding: 20, gap: 12, paddingBottom: 40 },
    input: { backgroundColor: Colors.surface },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textSecondary,
      marginTop: 4,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "bold",
      color: Colors.textSecondary,
      marginTop: 16,
      marginBottom: 8,
      textTransform: "uppercase",
    },
    branchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    detectBtn: { borderColor: Colors.primary, borderRadius: 10, marginTop: 6 },
    serverChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: Colors.surfaceVariant,
      marginRight: 8,
    },
    serverChipSelected: { backgroundColor: Colors.primary },
    serverChipText: { color: Colors.text, fontWeight: "600", fontSize: 13 },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    switchLabel: { fontSize: 15, fontWeight: "600", color: Colors.text },
    envHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 8,
    },
    envRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    submitBtn: { marginTop: 12, borderRadius: 12 },

    // ── Tab styles ──
    tabContainer: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      gap: 6,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabActive: {
      borderBottomColor: Colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textSecondary,
    },
    tabTextActive: {
      color: Colors.primary,
    },

    // ── GitHub styles ──
    searchBar: {
      margin: 16,
      marginBottom: 8,
      backgroundColor: Colors.surface,
      elevation: 0,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 12,
      height: 44,
    },
    repoItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 10,
      marginBottom: 8,
      backgroundColor: Colors.surface,
    },
    repoIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: Colors.surfaceVariant,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    repoName: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.text,
      marginBottom: 2,
    },
    repoChip: {
      height: 20,
      backgroundColor: Colors.surfaceVariant,
    },
    repoBranch: {
      fontSize: 11,
      color: Colors.textSecondary,
    },
    allLoadedText: {
      textAlign: "center",
      fontSize: 12,
      color: Colors.textSecondary,
      paddingVertical: 12,
    },
    emptyText: {
      textAlign: "center",
      fontSize: 14,
      color: Colors.textSecondary,
      paddingVertical: 40,
    },
    selectedRepoBanner: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      backgroundColor: Colors.surfaceVariant,
      borderRadius: 10,
      borderLeftWidth: 4,
      borderLeftColor: Colors.success || "#4caf50",
    },
    selectedRepoName: {
      fontSize: 15,
      fontWeight: "700",
      color: Colors.text,
    },
    selectedRepoMeta: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    githubNotConnected: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    githubNotConnectedTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: Colors.text,
      marginTop: 16,
    },
    githubNotConnectedDesc: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: "center",
      marginTop: 8,
      maxWidth: 280,
    },
    analyzingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 16,
    },
    analyzingText: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
  });
