import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";
import { Alert } from "react-native";
import { useAuth } from "./AuthContext";

export interface Server {
  _id: string;
  name: string;
  host: string;
  status: "online" | "offline" | "unknown";
}

interface ServerContextType {
  servers: Server[];
  selectedServer: Server | null;
  selectServer: (serverId: string) => void;
  loading: boolean;
  refreshServers: () => Promise<void>;
  setSelectedServer: (server: Server | null) => void;
}

const ServerContext = createContext<ServerContextType | undefined>(undefined);

export const ServerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();

  const fetchServers = useCallback(async () => {
    if (!user) {
      setServers([]);
      setSelectedServer(null);
      return;
    }
    try {
      const { data } = await api.get("/servers");
      setServers(data);

      if (data.length > 0) {
        // 1. Try to use user's active server from backend
        let targetServer = null;
        if (user?.activeServer) {
          targetServer = data.find((s: Server) => s._id === user.activeServer);
        }

        // 2. Fallback: Restore from storage if backend doesn't have it
        if (!targetServer) {
          const savedId = await AsyncStorage.getItem("selectedServerId");
          targetServer = data.find((s: Server) => s._id === savedId);
        }

        // 3. Fallback: Select first server if none selected
        if (!targetServer) {
          targetServer = data[0];
        }

        if (targetServer) {
          setSelectedServer(targetServer);
          await AsyncStorage.setItem("selectedServerId", targetServer._id);

          // If user logged in but didn't have active server set, update it now
          if (user && !user.activeServer) {
            api
              .put("/auth/active-server", { serverId: targetServer._id })
              .catch(console.error);
          }
        }
      } else {
        setSelectedServer(null);
        await AsyncStorage.removeItem("selectedServerId");
      }
    } catch (error) {
      console.error("Failed to load servers", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const selectServer = useCallback(
    async (serverId: string) => {
      const server = servers.find((s) => s._id === serverId);
      if (server) {
        setSelectedServer(server);
        await AsyncStorage.setItem("selectedServerId", server._id);

        // Update backend
        try {
          await api.put("/auth/active-server", { serverId: server._id });
        } catch (error) {
          console.error("Failed to update active server preference", error);
        }
      }
    },
    [servers],
  );

  return (
    <ServerContext.Provider
      value={{
        servers,
        selectedServer,
        selectServer,
        loading,
        refreshServers: fetchServers,
        setSelectedServer,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
};

export const useServer = () => {
  const context = useContext(ServerContext);
  if (context === undefined) {
    throw new Error("useServer must be used within a ServerProvider");
  }
  return context;
};
