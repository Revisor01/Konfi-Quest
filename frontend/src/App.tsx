import React, { useEffect, useCallback } from 'react';
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
  isPlatform,
  useIonAlert
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
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import LoginView from './components/auth/LoginView';
import KonfiRegisterPage from './components/auth/KonfiRegisterPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import ResetPasswordPage from './components/auth/ResetPasswordPage';
import LoadingSpinner from './components/common/LoadingSpinner';
import MainTabs from './components/layout/MainTabs';
import ErrorBoundary from './components/common/ErrorBoundary';

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
  const { refreshAllCounts } = useBadge();

  // Setup badge logic when user is available
  useEffect(() => {
    if (!user) return;

    // Badge-Counts werden bereits vom BadgeContext initialisiert
    // Push-Listener für sofortiges Refresh bei eingehender Notification
    const setupListeners = async () => {
      if (!Capacitor.isNativePlatform()) return;
      await PushNotifications.removeAllListeners();

      const pushListener = await PushNotifications.addListener('pushNotificationReceived',
        () => {
          refreshAllCounts();
        }
      );

      const actionListener = await PushNotifications.addListener('pushNotificationActionPerformed',
        () => {
          refreshAllCounts();
        }
      );

      return () => {
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

  }, [user, refreshAllCounts]);

  // Generischer 429 Rate-Limit Alert-Handler
  const [presentAlert] = useIonAlert();

  const handleRateLimit = useCallback((event: Event) => {
    const detail = (event as CustomEvent).detail;
    presentAlert({
      header: 'Zu viele Anfragen',
      message: detail?.message || 'Bitte warte einen Moment und versuche es erneut.',
      buttons: ['OK']
    });
  }, [presentAlert]);

  useEffect(() => {
    window.addEventListener('rate-limit', handleRateLimit);
    return () => {
      window.removeEventListener('rate-limit', handleRateLimit);
    };
  }, [handleRateLimit]);

  // Re-Login-Dialog bei abgelaufenem Refresh-Token
  useEffect(() => {
    const handler = () => {
      const alert = document.createElement('ion-alert');
      alert.header = 'Sitzung abgelaufen';
      alert.message = 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.';
      alert.buttons = [{
        text: 'Anmelden',
        handler: () => {
          window.location.href = '/';
        }
      }];
      alert.backdropDismiss = false;
      document.body.appendChild(alert);
      (alert as HTMLIonAlertElement).present();
    };
    window.addEventListener('auth:relogin-required', handler);
    return () => window.removeEventListener('auth:relogin-required', handler);
  }, []);

  // Auto-refresh every 30 seconds - DISABLED wegen Spam
  // useEffect(() => {
  //   if (!user) return;
  //   const interval = setInterval(refreshFromAPI, 30000);
  //   return () => {
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
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </LiveUpdateProvider>
    </BadgeProvider>
  </AppProvider>
);

export default App;
