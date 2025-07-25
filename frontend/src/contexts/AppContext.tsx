import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Device } from '@capacitor/device';
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
    if (!Capacitor.isNativePlatform()) {
      console.log('ℹ️ Push notifications not available on web');
      return;
    }
    
    try {
      console.log('🔔 Requesting push permissions after login...');
      
      // Check current permission status
      const permStatus = await PushNotifications.checkPermissions();
      console.log('📱 Current push permission status:', permStatus.receive);
      
      if (permStatus.receive === 'prompt') {
        // Request permissions
        const permResult = await PushNotifications.requestPermissions();
        setPushNotificationsPermission(permResult.receive);
        console.log('📱 Push permission result:', permResult.receive);
        
        if (permResult.receive === 'granted') {
          // Register for push notifications
          await PushNotifications.register();
          console.log('✅ Push notifications registered successfully');
          
          // TESTFLIGHT FIX: Force APNS registration via native plugin
          if (Capacitor.getPlatform() === 'ios') {
            try {
              // Use direct window access for custom plugins
              const FCMPlugin = (window as any).Capacitor?.Plugins?.FCM;
              if (FCMPlugin) {
                await FCMPlugin.forceAPNSRegistration();
                console.log('🔄 Forced iOS APNS registration via plugin');
                
                // Force FCM token retrieval after APNS registration
                setTimeout(async () => {
                  try {
                    await FCMPlugin.forceTokenRetrieval();
                    console.log('🔄 Forced FCM token retrieval via plugin');
                  } catch (error) {
                    console.warn('⚠️ Could not force FCM token retrieval:', error);
                  }
                }, 2000);
              } else {
                console.warn('⚠️ FCM Plugin not available');
              }
            } catch (error) {
              console.warn('⚠️ Could not force iOS APNS registration:', error);
            }
          }
        }
      } else if (permStatus.receive === 'granted') {
        setPushNotificationsPermission(permStatus.receive);
        // Already granted, just register
        await PushNotifications.register();
        console.log('✅ Push notifications already granted and registered');
        
        // TESTFLIGHT FIX: Force APNS registration for already granted permissions
        if (Capacitor.getPlatform() === 'ios') {
          try {
            const FCMPlugin = (window as any).Capacitor?.Plugins?.FCM;
            if (FCMPlugin) {
              await FCMPlugin.forceAPNSRegistration();
              console.log('🔄 Forced iOS APNS registration for existing permissions');
              
              // Force FCM token retrieval after APNS registration
              setTimeout(async () => {
                try {
                  await FCMPlugin.forceTokenRetrieval();
                  console.log('🔄 Forced FCM token retrieval for existing permissions');
                } catch (error) {
                  console.warn('⚠️ Could not force FCM token retrieval:', error);
                }
              }, 2000);
            } else {
              console.warn('⚠️ FCM Plugin not available for existing permissions');
            }
          } catch (error) {
            console.warn('⚠️ Could not force iOS APNS registration:', error);
          }
        }
      } else {
        console.log('❌ Push permissions denied or restricted');
        setPushNotificationsPermission(permStatus.receive);
      }
    } catch (error) {
      console.error('❌ Error requesting push permissions:', error);
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
  // NUR AUSFÜHREN, WENN EIN USER EINGELOGGT IST!
  if (!user) {
    return;
  }
  
  console.log('✅ User is logged in, setting up FCM token listener.');
  
  const handleNativeFCMToken = (event: any) => {
    const token = event.detail;
    
    if (token && token.length > 100) {
      console.log('📬 Received FCM token from native event:', token.substring(0, 20) + '...');
      
      // Echte Device ID via Capacitor Device Plugin abrufen
      Device.getId().then(deviceInfo => {
        const deviceId = deviceInfo.identifier;
        console.log('📱 Using Device ID:', deviceId.substring(0, 8) + '...');
        
        // Dieser API-Call hat jetzt den Auth-Header, weil 'user' existiert.
        api.post('/notifications/device-token', {
          token,
          platform: Capacitor.getPlatform(), // 'ios' oder 'android'
          device_id: deviceId
        })
        .then(() => {
          console.log('✅✅✅ FCM Token successfully sent to server via native event.');
        })
        .catch((err) => {
          console.error('❌ Error sending FCM token to server from native event:', err);
        });
      }).catch(err => {
        console.error('❌ Error getting device ID:', err);
        // Fallback zu localStorage
        const fallbackDeviceId = localStorage.getItem('device_id') || 
          `${Capacitor.getPlatform()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('device_id', fallbackDeviceId);
        
        api.post('/notifications/device-token', {
          token,
          platform: Capacitor.getPlatform(),
          device_id: fallbackDeviceId
        })
        .then(() => {
          console.log('✅ FCM Token sent with fallback device ID');
        })
        .catch((err) => {
          console.error('❌ Error sending FCM token with fallback:', err);
        });
      });
    }
  };
  
  window.addEventListener('fcmToken', handleNativeFCMToken);
  
  // WICHTIG: Nach dem Setup des Listeners manuell den Token abfragen,
  // falls er schon da ist (z.B. bei App-Start mit eingeloggtem User).
  // Deine AppDelegate-Logik sendet ihn bei App-Aktivierung ohnehin,
  // aber dies ist eine zusätzliche Sicherheit.
  if ((window as any).Capacitor?.Plugins?.App) {
      const { App } = (window as any).Capacitor.Plugins;
      // Dies simuliert, dass die App aktiv wird und triggert den Token-Send in Swift
      App.fireRestoredResult({
          methodName: "getLaunchUrl",
          data: {}
      });
      console.log('📱 Triggered token retrieval on listener setup.');
  }
  
  
  return () => {
    console.log('🧹 Cleaning up FCM token listener.');
    window.removeEventListener('fcmToken', handleNativeFCMToken);
  };
}, [user]); // <--- WICHTIGSTE ÄNDERUNG: Abhängigkeit von 'user'
  
  useEffect(() => {
    // Nur auf nativen Geräten ausführen und wenn ein User da ist
    if (user && Capacitor.isNativePlatform()) {
      console.log('✅ User eingeloggt - requesting Push Permissions');
      requestPushPermissions();
      
      // TESTFLIGHT FIX: Additional fallback für bereits gewährte Permissions
      if (Capacitor.getPlatform() === 'ios') {
        setTimeout(async () => {
          try {
            console.log('🔧 TestFlight fallback: Force APNS registration after login');
            const FCMPlugin = (window as any).Capacitor?.Plugins?.FCM;
            if (FCMPlugin) {
              await FCMPlugin.forceAPNSRegistration();
              
              setTimeout(async () => {
                await FCMPlugin.forceTokenRetrieval();
                console.log('🔧 TestFlight fallback: Force token retrieval completed');
              }, 3000);
            } else {
              console.warn('⚠️ FCM Plugin not available for fallback');
            }
          } catch (error) {
            console.warn('⚠️ TestFlight fallback failed:', error);
          }
        }, 5000); // 5 second delay for complete app startup
      }
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
  }, [user]); // Abhängigkeit ist korrekt

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