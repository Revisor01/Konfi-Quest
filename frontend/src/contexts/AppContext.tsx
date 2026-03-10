import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { checkAuth } from '../services/auth';
import api from '../services/api';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';

// FCM Token wird über Window Events empfangen (siehe AppDelegate.swift)

// ANTI-SPAM: Verhindere mehrfache Push-Registrierung (Global Scope)
let pushRegistrationInProgress = false;
let pushAlreadyRegistered = false;

// Funktion, um Duplikate zu vermeiden
const sendTokenToServer = async (token: string) => {
  // ANTI-SPAM: Prüfe ob Token in letzten 10 Sekunden bereits gesendet wurde
  const lastSent = (window as any).fcmTokenLastSent || 0;
  const now = Date.now();
  if ((window as any).fcmTokenSent === token && (now - lastSent) < 10000) {
    return;
  }

  try {
    // Device ID via Capacitor Device Plugin abrufen
    const deviceInfo = await Device.getId();
    const deviceId = deviceInfo.identifier;

    await api.post('/notifications/device-token', {
      token,
      platform: Capacitor.getPlatform(),
      device_id: deviceId
    });

    (window as any).fcmTokenSent = token; // Markiere Token als gesendet
    (window as any).fcmTokenLastSent = now; // Timestamp setzen
  } catch (err) {
    console.error('Fehler beim Senden des FCM-Tokens:', err);

    // Fallback zu localStorage Device ID
    try {
      const fallbackDeviceId = localStorage.getItem('device_id') ||
        `${Capacitor.getPlatform()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('device_id', fallbackDeviceId);

      await api.post('/notifications/device-token', {
        token,
        platform: Capacitor.getPlatform(),
        device_id: fallbackDeviceId
      });

      (window as any).fcmTokenSent = token;
      (window as any).fcmTokenLastSent = now;
    } catch (fallbackErr) {
      console.error('Error sending FCM token with fallback:', fallbackErr);
    }
  }
};

interface User {
  id: number;
  type: 'admin' | 'konfi' | 'teamer' | 'user';
  display_name: string;
  username?: string;
  email?: string;
  organization?: string;
  organization_id?: number;
  roles?: string[];
  role_name?: string;
  jahrgang?: string;
  is_super_admin?: boolean;
  // permissions entfernt - jetzt rollen-basiert (role_name)
}

interface AppContextType {
  user: User | null;
  loading: boolean;
  error: string;
  success: string;
  pushNotificationsPermission: string;
  setUser: (user: User | null) => void;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
  clearMessages: () => void;
  requestPushPermissions: () => Promise<void>;
  // hasPermission entfernt - jetzt rollen-basiert (user.role_name prüfen)
}

const AppContext = createContext<AppContextType | undefined>(undefined);


export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(checkAuth());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Push notifications state
  const [pushNotificationsPermission, setPushNotificationsPermission] = useState<string>('prompt');

  // Badge sync through state updates only (no custom events)

  // Push notifications functions
  const requestPushPermissions = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    if (pushRegistrationInProgress || pushAlreadyRegistered) {
      return;
    }

    pushRegistrationInProgress = true;

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

          // TESTFLIGHT FIX: Force APNS registration via native plugin
          if (Capacitor.getPlatform() === 'ios') {
            try {
              // Use direct window access for custom plugins
              const FCMPlugin = (window as any).Capacitor?.Plugins?.FCM;
              if (FCMPlugin) {
                await FCMPlugin.forceAPNSRegistration();

                // Force FCM token retrieval after APNS registration
                setTimeout(async () => {
                  try {
                    await FCMPlugin.forceTokenRetrieval();
                  } catch (error) {
                    console.warn('Could not force FCM token retrieval:', error);
                  }
                }, 2000);
              } else {
                console.warn('FCM Plugin not available');
              }
            } catch (error) {
              console.warn('Could not force iOS APNS registration:', error);
            }
          }
        }
      } else if (permStatus.receive === 'granted') {
        setPushNotificationsPermission(permStatus.receive);
        // Already granted, just register
        await PushNotifications.register();

        // TESTFLIGHT FIX: Force APNS registration for already granted permissions
        if (Capacitor.getPlatform() === 'ios') {
          try {
            const FCMPlugin = (window as any).Capacitor?.Plugins?.FCM;
            if (FCMPlugin) {
              await FCMPlugin.forceAPNSRegistration();

              // Force FCM token retrieval after APNS registration
              setTimeout(async () => {
                try {
                  await FCMPlugin.forceTokenRetrieval();
                } catch (error) {
                  console.warn('Could not force FCM token retrieval:', error);
                }
              }, 2000);
            } else {
              console.warn('FCM Plugin not available for existing permissions');
            }
          } catch (error) {
            console.warn('Could not force iOS APNS registration:', error);
          }
        }
      } else {
        setPushNotificationsPermission(permStatus.receive);
      }

      pushAlreadyRegistered = true;
    } catch (error) {
      console.error('Error requesting push permissions:', error);
      setError('Push Notifications konnten nicht aktiviert werden');
    } finally {
      pushRegistrationInProgress = false;
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

useEffect(() => {
  // NUR AUSFUEHREN, WENN EIN USER EINGELOGGT IST!
  if (!user) {
    return;
  }

  const handleNativeFCMToken = (event: any) => {
    const token = event.detail;

    if (token && token.length > 100) {
      // ANTI-SPAM fuer native Events verwenden
      sendTokenToServer(token);
    }
  };

  window.addEventListener('fcmToken', handleNativeFCMToken);

  // WICHTIG: Nach dem Setup des Listeners manuell den Token abfragen,
  // falls er schon da ist (z.B. bei App-Start mit eingeloggtem User).
  // Deine AppDelegate-Logik sendet ihn bei App-Aktivierung ohnehin,
  // aber dies ist eine zusaetzliche Sicherheit.
  if ((window as any).Capacitor?.Plugins?.App) {
      const { App } = (window as any).Capacitor.Plugins;
      // Dies simuliert, dass die App aktiv wird und triggert den Token-Send in Swift
      App.fireRestoredResult({
          methodName: "getLaunchUrl",
          data: {}
      });
  }


  return () => {
    window.removeEventListener('fcmToken', handleNativeFCMToken);
  };
}, [user]); // <--- WICHTIGSTE AENDERUNG: Abhaengigkeit von 'user'

  useEffect(() => {
    // Nur EINMAL Push-Permissions anfordern nach Login
    if (user && Capacitor.isNativePlatform() && !pushAlreadyRegistered && !pushRegistrationInProgress) {
      requestPushPermissions();
    }
  }, [user, requestPushPermissions]);

  // App lifecycle events - simplified to avoid duplicate calls
  useEffect(() => {
    if (!user) return;

    let lastRefresh = 0;
    const minRefreshInterval = 5000; // Minimum 5s between refreshes

    const handleAppActive = async () => {
      const now = Date.now();
      if (now - lastRefresh > minRefreshInterval) {
        lastRefresh = now;

        // Token bei App-Resume erneuern (max alle 12 Stunden)
        if (Capacitor.isNativePlatform()) {
          const lastTokenRefresh = parseInt(localStorage.getItem('push_token_last_refresh') || '0');
          const twelveHours = 12 * 60 * 60 * 1000;
          if (now - lastTokenRefresh > twelveHours) {
            try {
              await PushNotifications.register();
              localStorage.setItem('push_token_last_refresh', now.toString());
            } catch (err) {
              console.warn('Token refresh failed:', err);
            }
          }
        }
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
  }, [user]);

  // Push notifications setup and listeners
  useEffect(() => {
    if (!user) return;

    const setupPushNotifications = async () => {
      if (!Capacitor.isNativePlatform()) return;
      try {
        // WICHTIG: Registration Listener fuer Android (und iOS Fallback)
        PushNotifications.addListener('registration', (token) => {
          // Token an Server senden
          sendTokenToServer(token.value);
        });

        PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
        });

        // Registriere Listener
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          // Chat notifications are now handled by BadgeContext

          // Badge Updates werden jetzt vom BadgeContext behandelt
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          // Chat notifications refresh removed - handled by BadgeContext

          const notificationType = action.notification.data?.type;
          const userType = user?.type || 'konfi';
          const routePrefix = userType === 'admin' ? '/admin' : userType === 'teamer' ? '/teamer' : '/konfi';

          // Use timeout to ensure navigation happens after app is fully loaded
          setTimeout(() => {
            let targetUrl = '';

            switch (notificationType) {
              case 'chat':
                // Navigate to specific chat room
                if (action.notification.data?.roomId) {
                  targetUrl = `${routePrefix}/chat?room=${action.notification.data.roomId}`;
                }
                break;

              case 'activity_request_status':
              case 'new_activity_request':
                // Navigate to requests page (Teamer hat keine Requests-Page, Dashboard stattdessen)
                targetUrl = userType === 'admin' ? '/admin/requests' : userType === 'teamer' ? '/teamer/dashboard' : '/konfi/requests';
                break;

              case 'badge_earned':
                // Navigate to badges page (Teamer hat keine Badges-Page, Profil stattdessen)
                targetUrl = userType === 'admin' ? '/admin/badges' : userType === 'teamer' ? '/teamer/profile' : '/konfi/badges';
                break;

              case 'event_registered':
              case 'event_unregistered':
              case 'waitlist_promotion':
              case 'new_event':
              case 'event_attendance':
              case 'event_reminder':
              case 'event_cancelled':
                // Navigate to events page
                targetUrl = `${routePrefix}/events`;
                break;

              case 'level_up':
              case 'activity_assigned':
              case 'bonus_points':
                // Navigate to dashboard (points/level related)
                targetUrl = userType === 'admin' ? '/admin/konfis' : `${routePrefix}/dashboard`;
                break;

              case 'event_unregistration':
              case 'events_pending_approval':
                // Navigate to events page (Admin: Event-Abmeldungen / ausstehende Verbuchungen)
                targetUrl = userType === 'admin' ? '/admin/events' : `${routePrefix}/events`;
                break;

              case 'new_konfi_registration':
                // Navigate to konfis page (Admin: neue Registrierung)
                targetUrl = userType === 'admin' ? '/admin/konfis' : `${routePrefix}/dashboard`;
                break;

              default:
                console.warn('Unbekannter Notification-Typ:', notificationType);
                break;
            }

            if (targetUrl) {
              window.location.href = targetUrl;
            }
          }, 100);
        });

        // Jetzt: Registrierung
        const permStatus = await PushNotifications.checkPermissions();
        setPushNotificationsPermission(permStatus.receive);

        if (permStatus.receive === 'granted') {
          await PushNotifications.register();
        } else if (permStatus.receive === 'prompt') {
          const result = await PushNotifications.requestPermissions();
          setPushNotificationsPermission(result.receive);
          if (result.receive === 'granted') {
            await PushNotifications.register();
          }
        }
      } catch (error) {
        console.error('Fehler bei Push-Setup:', error);
      }
    };

    setupPushNotifications();
  }, [user]); // Abhaengigkeit ist korrekt

  // hasPermission entfernt - Berechtigung jetzt ueber user.role_name pruefen

  const value: AppContextType = {
    user,
    loading,
    error,
    success,
    pushNotificationsPermission,
    setUser,
    setError,
    setSuccess,
    clearMessages,
    requestPushPermissions,
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
