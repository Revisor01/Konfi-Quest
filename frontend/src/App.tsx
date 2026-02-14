import React, { useEffect } from 'react';
import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonBadge,
  setupIonicReact,
  isPlatform
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
// iOS26 Theme Animationen
import { iosTransitionAnimation, popoverEnterAnimation, popoverLeaveAnimation } from '@rdlabo/ionic-theme-ios26';
// Material Design 3 Animationen
import { mdTransitionAnimation } from '@rdlabo/ionic-theme-md3';
// Icons sind jetzt in MainTabs.tsx
import { AppProvider, useApp } from './contexts/AppContext';
import { BadgeProvider, useBadge } from './contexts/BadgeContext';
import { LiveUpdateProvider } from './contexts/LiveUpdateContext';
import { PushNotifications, PushNotificationSchema } from '@capacitor/push-notifications';
import LoginView from './components/auth/LoginView';
import KonfiRegisterPage from './components/auth/KonfiRegisterPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import ResetPasswordPage from './components/auth/ResetPasswordPage';
import LoadingSpinner from './components/common/LoadingSpinner';
import MainTabs from './components/layout/MainTabs';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode - DISABLED
 * -----------------------------------------------------
 * Dark Mode ist deaktiviert bis zur vollständigen Implementierung
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
/* import '@ionic/react/css/palettes/dark.system.css'; */

/* Theme variables */
import './theme/variables.css';

setupIonicReact({
  rippleEffect: true,
  inputBlurring: true,
  scrollPadding: true,
  backButtonText: '',
  backButtonIcon: 'arrow-back-outline',
  innerHTMLTemplatesEnabled: true,
  // Plattform-spezifische Theme-Animationen
  navAnimation: isPlatform('ios') ? iosTransitionAnimation : mdTransitionAnimation,
  popoverEnter: isPlatform('ios') ? popoverEnterAnimation : undefined,
  popoverLeave: isPlatform('ios') ? popoverLeaveAnimation : undefined
});


const AppContent: React.FC = () => {
  const { user, loading } = useApp();
  // Nur die Funktionen für Side-Effects, nicht den badgeCount selbst
  const { setBadgeCount, refreshFromAPI } = useBadge();

  // Setup badge logic when user is available
  useEffect(() => {
    if (!user) return;

 console.log('AppContent: User available, setting up badge logic');

    // 1. Initial badge load
    refreshFromAPI();

    // 2. Setup push notification listeners
    const setupListeners = async () => {
      // Remove existing listeners to avoid duplicates
      await PushNotifications.removeAllListeners();

      const pushListener = await PushNotifications.addListener('pushNotificationReceived', 
        (notification: PushNotificationSchema) => {
 console.log('AppContent: Push received:', notification);
          if (notification.data?.type === 'chat') {
            const badgeCountFromPush = notification.badge ?? parseInt(notification.data?.aps?.badge) ?? -1;
            if (badgeCountFromPush !== -1) {
 console.log('AppContent: Setting badge from push:', badgeCountFromPush);
              setBadgeCount(badgeCountFromPush);
            } else {
 console.log('AppContent: Incrementing badge as fallback');
              setBadgeCount(prev => prev + 1);
            }
          }
        }
      );

      const actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', 
        (action) => {
 console.log('AppContent: Push action performed:', action);
          refreshFromAPI(); 
        }
      );

      return () => {
 console.log('AppContent: Cleaning up listeners');
        pushListener.remove();
        actionListener.remove();
      };
    };

    const cleanupPromise = setupListeners();

    return () => {
      cleanupPromise.then(cleanup => {
        if (cleanup) cleanup();
      });
    };

  }, [user, setBadgeCount, refreshFromAPI]);

  // Auto-refresh every 30 seconds - DISABLED wegen Spam
  // useEffect(() => {
  //   if (!user) return;

 // console.log('AppContent: Starting auto-refresh every 30s');
  //   const interval = setInterval(refreshFromAPI, 30000);
  //   return () => {
 // console.log('AppContent: Stopping auto-refresh');
  //     clearInterval(interval);
  //   };
  // }, [user, refreshFromAPI]);

  if (loading) {
    return (
      <IonApp>
        <LoadingSpinner fullScreen message="Deine Quest wird vorbereitet..." />
      </IonApp>
    );
  }

  if (!user) {
    return (
      <IonApp>
        <IonReactRouter>
          <IonRouterOutlet>
            <Route path="/login" component={LoginView} exact />
            <Route path="/register" component={KonfiRegisterPage} exact />
            <Route path="/forgot-password" component={ForgotPasswordPage} exact />
            <Route path="/reset-password" component={ResetPasswordPage} exact />
            <Redirect exact from="/" to="/login" />
          </IonRouterOutlet>
        </IonReactRouter>
      </IonApp>
    );
  }

  // Die Render-Logik wird jetzt super einfach:
  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>
          {/* Anstatt die Tabs hier inline zu rendern, rendern wir nur noch eine Route auf MainTabs */}
          <Route path="/" component={MainTabs} />
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
};

const App: React.FC = () => (
  <AppProvider>
    <BadgeProvider>
      <LiveUpdateProvider>
        <AppContent />
      </LiveUpdateProvider>
    </BadgeProvider>
  </AppProvider>
);

export default App;
