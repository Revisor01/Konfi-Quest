import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { checkAuth } from '../services/auth';
import api from '../services/api';
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
  const refreshChatNotifications = useCallback(async (skipBadgeUpdate = false) => {
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
        // Only update DEVICE badge if count actually changed AND skipBadgeUpdate is false
        const hasChanged = prev.totalUnreadCount !== totalUnread;
        
        // Badge logic removed - now handled by BadgeContext
        
        // ALWAYS update the state for tab badges, regardless of skipBadgeUpdate
        console.log('📊 Updating chat notifications state:', totalUnread);
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
    console.log('✅ Marking room as read:', roomId);
    setChatNotifications(prev => {
      const currentUnread = prev.unreadByRoom[roomId] || 0;
      const newTotalCount = prev.totalUnreadCount - currentUnread;
      
      console.log(`📊 Room ${roomId}: was ${currentUnread} unread, total going from ${prev.totalUnreadCount} to ${newTotalCount}`);
      
      // Badge logic removed - now handled by BadgeContext
      
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
    console.log('🔔 Adding unread message for room:', roomId, 'count:', count);
    setChatNotifications(prev => {
      const newTotalCount = prev.totalUnreadCount + count;
      
      // Badge logic removed - now handled by BadgeContext
      
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
      // Reset badge state on startup but keep loading true
      setChatNotifications({
        totalUnreadCount: 0,
        unreadByRoom: {}
      });
      setChatNotificationsLoading(true);
      
      // Load with 1 second delay to allow Tab Bar to fully initialize
      const loadInitial = async () => {
        console.log('🚀 Starting delayed chat notifications load for tab badge visibility');
        
        // Wait 1 second for Tab Bar to be fully ready
        setTimeout(async () => {
          console.log('⏰ 1 second delay complete - loading tab badge now');
          
          // Try to get device badge first for immediate display
          try {
            const { Badge } = await import('@capawesome/capacitor-badge');
            const result = await Badge.get();
            if (result.count > 0) {
              console.log('📱 Setting tab badge from device after delay:', result.count);
              setChatNotifications(prev => ({
                ...prev,
                totalUnreadCount: result.count
              }));
            }
          } catch (error) {
            console.log('📱 Could not load device badge for tabs:', error);
          }
          
          // Now get real data from server
          // refreshChatNotifications disabled - Badge Context handles updates
          
          // Ensure a final refresh for reliability
          setTimeout(() => {
            console.log('🔄 Final delayed refresh for tab badge reliability');
            // refreshChatNotifications disabled - Badge Context handles updates
          }, 300);
        }, 1000); // 1 second delay
      };
      
      loadInitial();
      
      // Auto-refresh notifications every 5 seconds for reliable badge sync
      // 5-second refresh disabled - Badge Context handles real-time updates
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
        // refreshChatNotifications disabled - Badge Context handles updates
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
          
          // Chat notifications are now handled by BadgeContext
          
          // Bei Badge Updates direkt Badge Count setzen ohne API Call
          if (notification.data?.type === 'badge_update') {
            const badgeCount = parseInt(notification.data.count || '0');
            console.log('📥 Badge update push:', badgeCount);
            setChatNotifications(prev => ({
              ...prev,
              totalUnreadCount: badgeCount
            }));
            
            // Badge logic removed - now handled by BadgeContext
          }
        });
        
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('📲 Push angeklickt:', action.notification);
          // Chat notifications refresh removed - handled by BadgeContext
          
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