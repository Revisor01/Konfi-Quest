import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { checkAuth } from '../services/auth';
import api from '../services/api';
import { Badge } from '@capawesome/capacitor-badge';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';

export interface ChatNotifications {
  totalUnreadCount: number;
  unreadByRoom: Record<number, number>;
}

interface User {
  id: number;
  type: 'admin' | 'konfi' | 'user';
  display_name: string;
  username?: string;
  email?: string;
  organization?: string;
  organization_id?: number;
  roles?: string[];
  role_name?: string;
  jahrgang?: string;
  is_super_admin?: boolean;
  permissions?: string[];
}

interface AppContextType {
  user: User | null;
  loading: boolean;
  error: string;
  success: string;
  chatNotifications: ChatNotifications;
  chatNotificationsLoading: boolean;
  pushNotificationsPermission: string;
  setUser: (user: User | null) => void;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
  clearMessages: () => void;
  refreshChatNotifications: () => Promise<void>;
  markChatRoomAsRead: (roomId: number) => void;
  addUnreadChatMessage: (roomId: number, count?: number) => void;
  requestPushPermissions: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);


export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(checkAuth());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Chat notifications state
  const [chatNotifications, setChatNotifications] = useState<ChatNotifications>({
    totalUnreadCount: 0,
    unreadByRoom: {}
  });
  const [chatNotificationsLoading, setChatNotificationsLoading] = useState(true);

  // Push notifications state
  const [pushNotificationsPermission, setPushNotificationsPermission] = useState<string>('prompt');

  // Chat notification functions
  const refreshChatNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      setChatNotificationsLoading(true);
      const response = await api.get('/chat/rooms');
      const rooms = response.data;
      
      let totalUnread = 0;
      const unreadByRoom: Record<number, number> = {};
      
      rooms.forEach((room: any) => {
        const unreadCount = room.unread_count || 0;
        unreadByRoom[room.id] = unreadCount;
        totalUnread += unreadCount;
      });
      
      setChatNotifications({
        totalUnreadCount: totalUnread,
        unreadByRoom
      });
      
      // Update app icon badge
      try {
        if (totalUnread > 0) {
          await Badge.set({ count: totalUnread });
        } else {
          await Badge.clear();
        }
      } catch (badgeError) {
        console.log('Badge not available:', badgeError);
      }
    } catch (err) {
      console.error('Error loading chat notifications:', err);
    } finally {
      setChatNotificationsLoading(false);
    }
  }, [user]);

  const markChatRoomAsRead = (roomId: number) => {
    setChatNotifications(prev => {
      const currentUnread = prev.unreadByRoom[roomId] || 0;
      return {
        totalUnreadCount: prev.totalUnreadCount - currentUnread,
        unreadByRoom: {
          ...prev.unreadByRoom,
          [roomId]: 0
        }
      };
    });
  };

  const addUnreadChatMessage = (roomId: number, count: number = 1) => {
    setChatNotifications(prev => ({
      totalUnreadCount: prev.totalUnreadCount + count,
      unreadByRoom: {
        ...prev.unreadByRoom,
        [roomId]: (prev.unreadByRoom[roomId] || 0) + count
      }
    }));
  };

  // Push notifications functions
  const requestPushPermissions = useCallback(async () => {
    try {
      // Check current permission status
      const permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === 'prompt') {
        // Request permissions
        const permResult = await PushNotifications.requestPermissions();
        setPushNotificationsPermission(permResult.receive);
        
        if (permResult.receive === 'granted') {
          // Register for push notifications
          await PushNotifications.register();
          console.log('Push notifications registered successfully');
        }
      } else {
        setPushNotificationsPermission(permStatus.receive);
        
        if (permStatus.receive === 'granted') {
          // Already granted, just register
          await PushNotifications.register();
          console.log('Push notifications already granted and registered');
        }
      }
    } catch (error) {
      console.error('Error requesting push permissions:', error);
      setError('Push Notifications konnten nicht aktiviert werden');
    }
  }, []);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(clearMessages, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Load chat notifications when user changes
  useEffect(() => {
    if (user) {
      refreshChatNotifications();
      
      // Auto-refresh notifications every 30 seconds
      const interval = setInterval(refreshChatNotifications, 30000);
      return () => clearInterval(interval);
    } else {
      // Clear notifications when user logs out
      setChatNotifications({
        totalUnreadCount: 0,
        unreadByRoom: {}
      });
      setChatNotificationsLoading(false);
    }
  }, [user, refreshChatNotifications]);

  // App lifecycle events for background/foreground detection
  useEffect(() => {
    if (!user) return;

    let stateChangeListener: any = null;
    let resumeListener: any = null;

    // Setup listeners
    const setupListeners = async () => {
      // Refresh notifications when app comes to foreground
      stateChangeListener = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          console.log('App came to foreground - refreshing chat notifications');
          refreshChatNotifications();
        }
      });

      // Refresh notifications when app resumes from background
      resumeListener = await App.addListener('resume', () => {
        console.log('App resumed - refreshing chat notifications');
        refreshChatNotifications();
      });
    };

    setupListeners();

    // Cleanup listeners
    return () => {
      if (stateChangeListener) {
        stateChangeListener.remove();
      }
      if (resumeListener) {
        resumeListener.remove();
      }
    };
  }, [user, refreshChatNotifications]);

  // Push notifications setup and listeners
  useEffect(() => {
    if (!user) return;

    let pushReceivedListener: any = null;
    let pushActionListener: any = null;
    let pushRegistrationListener: any = null;
    let pushRegistrationErrorListener: any = null;

    const setupPushNotifications = async () => {
      try {
        // 👉 1. Erst Listener registrieren
        PushNotifications.addListener('registration', (token) => {
          console.log('✅ Push registration success, token:', token.value);
          
          // 👉 2. Token an dein Backend senden
          api.post('/notifications/device-token', {
            token: token.value,
            platform: 'ios'
          }).then(() => {
            console.log('✅ Token erfolgreich an Server gesendet');
          }).catch(err => {
            console.error('❌ Fehler beim Token-Senden:', err);
          });
        });
        
        PushNotifications.addListener('registrationError', (error) => {
          console.error('❌ Push registration error:', error);
        });
        
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('📥 Push received:', notification);
          refreshChatNotifications();
        });
        
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('📲 Push action performed:', notification);
          refreshChatNotifications();
        });
        
        // 👉 3. Jetzt Berechtigungen prüfen
        const permStatus = await PushNotifications.checkPermissions();
        setPushNotificationsPermission(permStatus.receive);
        
        // 👉 4. Jetzt registrieren – NICHT vorher
        if (permStatus.receive === 'granted') {
          await PushNotifications.register();
        } else if (permStatus.receive === 'prompt') {
          const permResult = await PushNotifications.requestPermissions();
          setPushNotificationsPermission(permResult.receive);
          if (permResult.receive === 'granted') {
            await PushNotifications.register();
          }
        }
      } catch (error) {
        console.error('❌ Fehler bei Push-Setup:', error);
      }
    };

    setupPushNotifications();

    // Cleanup push notification listeners
    return () => {
      if (pushReceivedListener) pushReceivedListener.remove();
      if (pushActionListener) pushActionListener.remove();
      if (pushRegistrationListener) pushRegistrationListener.remove();
      if (pushRegistrationErrorListener) pushRegistrationErrorListener.remove();
    };
  }, [user, refreshChatNotifications]);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!user?.permissions) return false;
    return user.permissions.includes(permission);
  }, [user]);

  const value: AppContextType = {
    user,
    loading,
    error,
    success,
    chatNotifications,
    chatNotificationsLoading,
    pushNotificationsPermission,
    setUser,
    setError,
    setSuccess,
    clearMessages,
    refreshChatNotifications,
    markChatRoomAsRead,
    addUnreadChatMessage,
    requestPushPermissions,
    hasPermission,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export default AppContext;