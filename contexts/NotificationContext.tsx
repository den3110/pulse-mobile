import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { useAuth } from "./AuthContext";

export interface Notification {
  _id: string;
  type: "deploy_success" | "deploy_failed" | "deploy_started" | "health_alert";
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
  projectId?: {
    _id: string;
    name: string;
  };
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  fetchNotifications: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  clearAll: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

// Configure notification handler for foreground behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef<any>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      console.log("[NotificationContext] No user, skipping fetch");
      return;
    }
    try {
      console.log(
        "[NotificationContext] Fetching notifications for user:",
        user.id,
        user.email,
      );
      const { data } = await api.get("/notifications");
      // console.log("[NotificationContext] Fetched data:", data);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (error: any) {
      console.error(
        "[NotificationContext] Failed to fetch:",
        error.message,
        error.response?.data,
      );
    }
  }, [user]);

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        // Optimistic update
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, read: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));

        await api.put(`/notifications/${id}/read`);
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
        fetchNotifications(); // Revert on error
      }
    },
    [fetchNotifications],
  );

  const markAllAsRead = useCallback(async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      await api.put("/notifications/read-all");
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const clearAll = useCallback(async () => {
    try {
      setNotifications([]);
      setUnreadCount(0);
      await api.delete("/notifications");
    } catch (error) {
      console.error("Failed to clear notifications:", error);
      fetchNotifications();
    }
  }, [fetchNotifications]);

  // Register for push notifications (permissions only, mostly for iOS/Android)
  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        const { status: existingStatus } =
          await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") {
          console.log("Failed to get push token for push notification!");
          return;
        }
      }
    })();
  }, []);

  // Socket Listener
  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    const socket = getSocket();
    if (socket) {
      socketRef.current = socket;

      // Listen for new notifications
      socket.on("notification:new", async (newNotification: Notification) => {
        console.log("New Notification received:", newNotification);

        // Add to state
        setNotifications((prev) => [newNotification, ...prev]);
        setUnreadCount((prev) => prev + 1);

        // Trigger local push notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: newNotification.title,
            body: newNotification.message,
            data: { link: newNotification.link },
          },
          trigger: null, // Immediate
        });
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off("notification:new");
      }
    };
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
