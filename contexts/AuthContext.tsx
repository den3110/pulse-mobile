import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import api, { setForceLogoutHandler } from "../services/api";

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  activeServer?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<void>;
  logout: () => void;
  loginWithBiometric: () => Promise<void>;
  enableBiometric: (email: string, password: string) => Promise<void>;
  disableBiometric: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const logout = useCallback(async () => {
    // Set flag so login screen won't auto-trigger biometric after intentional logout
    await AsyncStorage.setItem("skipBiometricOnce", "true");
    await AsyncStorage.multiRemove(["accessToken", "refreshToken"]);
    setUser(null);
  }, []);

  useEffect(() => {
    setForceLogoutHandler(logout);
  }, [logout]);

  // Check biometric availability and status on mount
  useEffect(() => {
    const init = async () => {
      // Check hardware availability
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);

      // Check if biometric is enabled by user
      const bioEnabled = await AsyncStorage.getItem("biometricEnabled");
      setBiometricEnabled(bioEnabled === "true");
    };
    init();
  }, []);

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      try {
        const token = await AsyncStorage.getItem("accessToken");
        const refreshToken = await AsyncStorage.getItem("refreshToken");

        if (token && refreshToken) {
          const { data } = await api.get("/auth/me");
          setUser(data);
        } else {
          // If one is missing, clear both to ensure clean state
          await AsyncStorage.multiRemove(["accessToken", "refreshToken"]);
        }
      } catch {
        await AsyncStorage.multiRemove(["accessToken", "refreshToken"]);
      } finally {
        setLoading(false);
      }
    };
    restore();
    restore();
  }, []);

  // Proactive Token Refresh (Every 5 minutes)
  // Proactive Token Refresh (Disabled to prevent race conditions)
  /*
  useEffect(() => {
    if (!user) return;

    const refreshSession = async () => {
      try {
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        if (!refreshToken) return;

        // Use axios directly to avoid interceptor loop, or simple api call
        // We can use the api instance, but we want to handle errors silently
        const { data } = await api.post("/auth/refresh", { refreshToken });

        await AsyncStorage.setItem("accessToken", data.accessToken);
        await AsyncStorage.setItem("refreshToken", data.refreshToken);
        console.log("[Auth] Session refreshed proactively");
      } catch (error) {
        console.warn("[Auth] Proactive refresh failed", error);
        // Optional: logout if refresh fails?
        // For now, let the interceptor handle 401s if they happen later
      }
    };

    // Run every 5 minutes
    const interval = setInterval(refreshSession, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);
  */

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    await AsyncStorage.setItem("accessToken", data.accessToken);
    await AsyncStorage.setItem("refreshToken", data.refreshToken);
    setUser(data.user);
  };

  const register = async (
    username: string,
    email: string,
    password: string,
  ) => {
    const { data } = await api.post("/auth/register", {
      username,
      email,
      password,
    });
    await AsyncStorage.setItem("accessToken", data.accessToken);
    await AsyncStorage.setItem("refreshToken", data.refreshToken);
    setUser(data.user);
  };

  // Save credentials to SecureStore and enable biometric
  const enableBiometric = async (email: string, password: string) => {
    // Verify biometric first
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Xác thực để bật đăng nhập sinh trắc học",
      fallbackLabel: "Dùng mật khẩu",
      cancelLabel: "Huỷ",
    });

    if (!result.success) {
      throw new Error("Biometric authentication failed");
    }

    // Save credentials securely
    await SecureStore.setItemAsync("bio_email", email);
    await SecureStore.setItemAsync("bio_password", password);
    await AsyncStorage.setItem("biometricEnabled", "true");
    setBiometricEnabled(true);
  };

  // Authenticate with biometric and login
  const loginWithBiometric = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Đăng nhập bằng sinh trắc học",
      fallbackLabel: "Dùng mật khẩu",
      cancelLabel: "Huỷ",
    });

    if (!result.success) {
      throw new Error("Biometric authentication cancelled");
    }

    const email = await SecureStore.getItemAsync("bio_email");
    const password = await SecureStore.getItemAsync("bio_password");

    if (!email || !password) {
      // Credentials were cleared, disable biometric
      await AsyncStorage.removeItem("biometricEnabled");
      setBiometricEnabled(false);
      throw new Error(
        "Saved credentials not found. Please login with password.",
      );
    }

    await login(email, password);
  };

  // Disable biometric and clear saved credentials
  const disableBiometric = async () => {
    await SecureStore.deleteItemAsync("bio_email");
    await SecureStore.deleteItemAsync("bio_password");
    await AsyncStorage.removeItem("biometricEnabled");
    setBiometricEnabled(false);
  };

  useEffect(() => {
    console.log("[AuthContext] User state changed:", user ? user.id : "null");
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        biometricEnabled,
        biometricAvailable,
        login,
        register,
        logout,
        loginWithBiometric,
        enableBiometric,
        disableBiometric,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
