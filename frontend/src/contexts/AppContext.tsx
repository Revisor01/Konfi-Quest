import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { checkAuth } from '../services/auth';
import api from '../services/api';
import { Badge } from '@capawesome/capacitor-badge';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';

// FCM Token wird über Window Events empfangen (siehe AppDelegate.swift)

// Funktion, um Duplikate zu vermeiden
const sendTokenToServer = async (token: string) => {
  // Statische Variable, um zu prüfen, ob der Token schon gesendet wurde.
  if ((window as any).fcmTokenSent === token) {
    console.log('Token bereits gesendet, überspringe.');
    return;
  }
  try {
    await api.post('/notifications/device-token', {
      token,
      platform: Capacitor.getPlatform(),
    });
    console.log('✅✅✅ Echter FCM-Token erfolgreich an Server gesendet:', token);
    (window as any).fcmTokenSent = token; // Markiere Token als gesendet
  } catch (err) {
    console.error('❌ Fehler beim Senden des FCM-Tokens:', err);
  }
};

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
  
  // Badge sync through state updates only (no custom events)

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
      
      setChatNotifications(prev => {
        // Only update badge if count actually changed
        const hasChanged = prev.totalUnreadCount !== totalUnread;
        
        if (hasChanged) {
          // Update app icon badge only when count changes
          try {
            if (totalUnread > 0) {
              Badge.set({ count: totalUnread });
              console.log('📱 Badge updated to:', totalUnread);
            } else {
              Badge.clear();
              console.log('📱 Badge cleared');
            }
          } catch (badgeError) {
            console.log('Badge not available:', badgeError);
          }
        }
        
        return {
          totalUnreadCount: totalUnread,
          unreadByRoom
        };
      });
    } catch (err) {
      console.error('Error loading chat notifications:', err);
    } finally {
      setChatNotificationsLoading(false);
    }
  }, [user]);

  const markChatRoomAsRead = (roomId: number) => {
    setChatNotifications(prev => {
      const currentUnread = prev.unreadByRoom[roomId] || 0;
      const newTotalCount = prev.totalUnreadCount - currentUnread;
      
      // Only update badge if count actually changed
      if (prev.totalUnreadCount !== newTotalCount) {
        try {
          if (newTotalCount > 0) {
            Badge.set({ count: newTotalCount });
            console.log('📱 Badge updated to:', newTotalCount);
          } else {
            Badge.clear();
            console.log('📱 Badge cleared');
          }
        } catch (badgeError) {
          console.log('Badge not available:', badgeError);
        }
      }
      
      return {
        totalUnreadCount: newTotalCount,
        unreadByRoom: {
          ...prev.unreadByRoom,
          [roomId]: 0
        }
      };
    });
  };

  const addUnreadChatMessage = (roomId: number, count: number = 1) => {
    setChatNotifications(prev => {
      const newTotalCount = prev.totalUnreadCount + count;
      
      // Update icon badge immediately (always when adding)
      try {
        Badge.set({ count: newTotalCount });
        console.log('📱 Badge updated to:', newTotalCount);
      } catch (badgeError) {
        console.log('Badge not available:', badgeError);
      }
      
      return {
        totalUnreadCount: newTotalCount,
        unreadByRoom: {
          ...prev.unreadByRoom,
          [roomId]: (prev.unreadByRoom[roomId] || 0) + count
        }
      };
    });
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
      // Reset badge state on startup
      setChatNotifications({
        totalUnreadCount: 0,
        unreadByRoom: {}
      });
      
      // Load immediately on app start - no delay
      refreshChatNotifications();
      
      // Auto-refresh notifications every 5 seconds for reliable badge sync
      const interval = setInterval(refreshChatNotifications, 5000);
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

useEffect(() => {
  const handleNativeFCMToken = (event: any) => {
    const token = event.detail;
    
    if (token && token.length > 100) {
      api.post('/notifications/device-token', {
        token,
        platform: 'ios',
      })
      .then(() => {
        console.log('✅ FCM Token an Server gesendet');
      })
      .catch((err) => {
        console.error('❌ Fehler beim Senden des FCM Tokens:', err);
      });
    }
  };
  
  window.addEventListener('fcmToken', handleNativeFCMToken);
  return () => window.removeEventListener('fcmToken', handleNativeFCMToken);
}, []);
  
  useEffect(() => {
    // Nur auf nativen Geräten ausführen und wenn ein User da ist
    if (user && Capacitor.isNativePlatform()) {
      // Das Window Event System funktioniert bereits perfekt
      console.log('✅ FCM Token System bereit (Window Event basiert)');
    }
  }, [user]);
  
  // App lifecycle events - simplified to avoid duplicate calls
  useEffect(() => {
    if (!user) return;

    let lastRefresh = 0;
    const minRefreshInterval = 5000; // Minimum 5s between refreshes

    const handleAppActive = () => {
      const now = Date.now();
      if (now - lastRefresh > minRefreshInterval) {
        console.log('App became active - refreshing chat notifications');
        refreshChatNotifications();
        lastRefresh = now;
      }
    };

    let stateChangeListener: any = null;

    // Setup single listener for app state changes
    const setupListener = async () => {
      stateChangeListener = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          handleAppActive();
        }
      });
    };

    setupListener();

    // Cleanup
    return () => {
      if (stateChangeListener) {
        stateChangeListener.remove();
      }
    };
  }, [user, refreshChatNotifications]);

  // Push notifications setup and listeners
  useEffect(() => {
    if (!user) return;
    
    const setupPushNotifications = async () => {
      try {
        // ✅ Registriere Listener
        PushNotifications.addListener('registration', async (token) => {
          console.log('✅ Push registration success, token:', token.value);
          console.log('✅ Token length:', token.value?.length);
          
          // Nur speichern, wenn der Token wie ein echter FCM-Token aussieht
          if (token.value && token.value.length > 100) {
            try {
              await api.post('/notifications/device-token', {
                token: token.value,
                platform: 'ios',
              });
              console.log('✅ FCM-Token erfolgreich an Server gesendet');
            } catch (err) {
              console.error('❌ Fehler beim Token-Senden:', err);
            }
          } else {
            console.warn('⚠️ Token ignoriert – sieht nach APNs aus:', token.value);
          }
        });
        
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('📥 Push empfangen:', notification);
          console.log('📥 Push data:', notification.data);
          
          // Bei Chat-Notifications Badge Count aktualisieren
          if (notification.data?.type === 'chat') {
            console.log('📥 Chat Push - refreshing notifications');
            
            // Refresh von Server holen für genaue Counts
            refreshChatNotifications();
          }
          
          // Bei Badge Updates direkt Badge Count setzen ohne API Call
          if (notification.data?.type === 'badge_update') {
            const badgeCount = parseInt(notification.data.count || '0');
            console.log('📥 Badge update push:', badgeCount);
            setChatNotifications(prev => ({
              ...prev,
              totalUnreadCount: badgeCount
            }));
            
            // App Icon Badge aktualisieren
            try {
              if (badgeCount > 0) {
                Badge.set({ count: badgeCount });
              } else {
                Badge.clear();
              }
            } catch (badgeError) {
              console.log('Badge update error:', badgeError);
            }
          }
        });
        
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('📲 Push angeklickt:', action.notification);
          refreshChatNotifications();
          
          // Navigate to chat if roomId is provided
          if (action.notification.data?.type === 'chat' && action.notification.data?.roomId) {
            const roomId = action.notification.data.roomId;
            const userType = user?.type || 'konfi';
            const chatUrl = userType === 'admin' ? '/admin/chat' : '/konfi/chat';
            
            // Use timeout to ensure navigation happens after app is fully loaded
            setTimeout(() => {
              console.log('📲 Navigating to chat room:', roomId);
              window.location.href = `${chatUrl}?room=${roomId}`;
            }, 100);
          }
        });
        
        // ✅ Jetzt: Registrierung
        const permStatus = await PushNotifications.checkPermissions();
        setPushNotificationsPermission(permStatus.receive);
        
        if (permStatus.receive === 'granted') {
          console.log('📣 Berechtigung erteilt – registriere...');
          await PushNotifications.register();
        } else if (permStatus.receive === 'prompt') {
          const result = await PushNotifications.requestPermissions();
          setPushNotificationsPermission(result.receive);
          if (result.receive === 'granted') {
            console.log('📣 Berechtigung nach Anfrage – registriere...');
            await PushNotifications.register();
          }
        }
      } catch (error) {
        console.error('❌ Fehler bei Push-Setup:', error);
      }
    };
    
    setupPushNotifications();
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