// MainTabs.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Redirect, Route, useLocation } from 'react-router-dom'; // useLocation importieren!
import {
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
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonBadge
} from '@ionic/react';
import {
  people, chatbubbles, star, ellipsisHorizontal,
  person, home, flash, document as documentIcon, calendar
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { useBadge } from '../../contexts/BadgeContext';
import { registerTabBarEffect } from '@rdlabo/ionic-theme-ios26';
import api from '../../services/api';
import { ModalProvider } from '../../contexts/ModalContext'; // Behalten
import AdminKonfisPage from '../admin/pages/AdminKonfisPage';
import AdminActivitiesPage from '../admin/pages/AdminActivitiesPage';
import AdminEventsPage from '../admin/pages/AdminEventsPage';
import AdminCategoriesPage from '../admin/pages/AdminCategoriesPage';
import AdminJahrgaengeePage from '../admin/pages/AdminJahrgaengeePage';
import AdminBadgesPage from '../admin/pages/AdminBadgesPage';
import AdminActivityRequestsPage from '../admin/pages/AdminActivityRequestsPage';
import AdminUsersPage from '../admin/pages/AdminUsersPage';
// AdminRolesPage entfernt - Rollen sind jetzt hardcoded
import AdminOrganizationsPage from '../admin/pages/AdminOrganizationsPage';
import AdminProfilePage from '../admin/pages/AdminProfilePage';
import AdminSettingsPage from '../admin/pages/AdminSettingsPage';
import AdminLevelsPage from '../admin/pages/AdminLevelsPage';
import AdminGoalsPage from '../admin/pages/AdminGoalsPage';
import AdminInvitePage from '../admin/pages/AdminInvitePage';
import ChatOverviewPage from '../chat/pages/ChatOverviewPage'; // Diese bleibt!
import ChatRoomView from '../chat/views/ChatRoomView'; // Diese bleibt!
import PushNotificationSettings from '../common/PushNotificationSettings';
import ChatPermissionsSettings from '../admin/settings/ChatPermissionsSettings';
import KonfiDetailView from '../admin/views/KonfiDetailView';
import EventDetailView from '../admin/views/EventDetailView';
import KonfiDashboardPage from '../konfi/pages/KonfiDashboardPage';
import KonfiEventsPage from '../konfi/pages/KonfiEventsPage';
import KonfiEventDetailPage from '../konfi/pages/KonfiEventDetailPage';
import KonfiBadgesPage from '../konfi/pages/KonfiBadgesPage';
import KonfiRequestsPage from '../konfi/pages/KonfiRequestsPage';
import KonfiProfilePage from '../konfi/pages/KonfiProfilePage';

const MainTabs: React.FC = () => {
  const { user } = useApp();
  const { badgeCount } = useBadge();
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [pendingEventsCount, setPendingEventsCount] = useState(0);
  const [newBadgesCount, setNewBadgesCount] = useState(0);
  const location = useLocation(); // Hook, um den aktuellen Pfad zu erhalten

  // Load pending requests count for admin
  useEffect(() => {
    const loadPendingRequestsCount = async () => {
      if (user?.type === 'admin') {
        try {
          const response = await api.get('/admin/activities/requests');
          const pendingCount = response.data.filter((req: any) => req.status === 'pending').length;
          setPendingRequestsCount(pendingCount);
        } catch (error) {
          // Ignoriere Fehler (z.B. wenn super_admin keinen Zugriff hat)
 console.log('Could not load pending requests:', error);
        }
      }
    };

    loadPendingRequestsCount();

    // Refresh every 30 seconds
    const interval = setInterval(loadPendingRequestsCount, 30000);

    // Event Listener für sofortige Aktualisierung bei Statusänderung
    const handleRequestStatusChanged = () => {
      loadPendingRequestsCount();
    };
    window.addEventListener('requestStatusChanged', handleRequestStatusChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener('requestStatusChanged', handleRequestStatusChanged);
    };
  }, [user]);

  // Load pending events count for admin (events that need attendance processing)
  useEffect(() => {
    const loadPendingEventsCount = async () => {
      if (user?.type === 'admin') {
        try {
          const response = await api.get('/events');
          const pendingCount = response.data.filter((event: any) =>
            event.unprocessed_count > 0 && new Date(event.event_date) < new Date()
          ).length;
          setPendingEventsCount(pendingCount);
        } catch (error) {
 console.log('Could not load pending events:', error);
        }
      }
    };

    loadPendingEventsCount();

    // Refresh every 60 seconds
    const interval = setInterval(loadPendingEventsCount, 60000);

    // Event Listener für sofortige Aktualisierung bei Attendance-Änderung
    const handleEventsUpdated = () => {
      loadPendingEventsCount();
    };
    window.addEventListener('events-updated', handleEventsUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('events-updated', handleEventsUpdated);
    };
  }, [user]);

  // Load new badges count for konfi (badges not yet seen)
  useEffect(() => {
    const loadNewBadgesCount = async () => {
      if (user?.type === 'konfi') {
        try {
          const response = await api.get('/konfi/badges');
          // earned array contains badges with the seen flag
          const newCount = response.data.earned?.filter((badge: any) => !badge.seen)?.length || 0;
          setNewBadgesCount(newCount);
        } catch (error) {
 console.log('Could not load badges:', error);
        }
      }
    };

    loadNewBadgesCount();

    // Refresh every 60 seconds
    const interval = setInterval(loadNewBadgesCount, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // iOS 26 Tab-Bar Animation Effect
  const tabBarEffectRef = useRef<ReturnType<typeof registerTabBarEffect>>(undefined);
  useEffect(() => {
    const timer = setTimeout(() => {
      tabBarEffectRef.current?.destroy();
      const tabBar = document.querySelector<HTMLElement>('ion-tab-bar');
      if (tabBar) {
        tabBarEffectRef.current = registerTabBarEffect(tabBar);
      }
    }, 100);
    return () => {
      clearTimeout(timer);
      tabBarEffectRef.current?.destroy();
    };
  }, [location.pathname]);

  if (!user) {
    return null;
  }

  // Funktion, um zu prüfen, ob die Tab-Bar angezeigt werden soll
  const isTabBarHidden = (path: string) => {
    // Verstecke die Tab-Bar, wenn der Pfad ein Chat-Raum ist
    return path.startsWith('/admin/chat/room/') || path.startsWith('/konfi/chat/room/');
  };

  // super_admin bekommt eine eigene, reduzierte Navigation
  const isSuperAdmin = user.role_name === 'super_admin';

  return user.type === 'admin' ? (
    // Admin Tabs
    <ModalProvider>
      <IonTabs>
        <IonRouterOutlet>
          {/* super_admin wird zu Organizations weitergeleitet, andere zu Konfis */}
          <Route exact path="/admin" render={() => <Redirect to={isSuperAdmin ? "/admin/organizations" : "/admin/konfis"} />} />
          <Route exact path="/admin/konfis" component={AdminKonfisPage} />
          <Route path="/admin/konfis/:id" render={(props) => {
            const konfiId = parseInt(props.match.params.id);
            return <KonfiDetailView konfiId={konfiId} onBack={() => props.history.goBack()} />;
          }} />

          {/* CHAT ROUTEN - Nach Konfis-Pattern */}
          <Route exact path="/admin/chat" component={ChatOverviewPage} />
          <Route path="/admin/chat/room/:roomId" render={(props) => {
            const roomId = parseInt(props.match.params.roomId);
            return <ChatRoomView roomId={roomId} onBack={() => props.history.goBack()} />;
          }} />

          <Route exact path="/admin/activities" component={AdminActivitiesPage} />
          <Route path="/admin/events/:id" render={(props) => {
            const eventId = parseInt(props.match.params.id);
            return <EventDetailView eventId={eventId} onBack={() => props.history.goBack()} />;
          }} />
          <Route exact path="/admin/events" component={AdminEventsPage} />
          <Route exact path="/admin/settings/categories" component={AdminCategoriesPage} />
          <Route exact path="/admin/settings/jahrgaenge" component={AdminJahrgaengeePage} />
          <Route exact path="/admin/settings/levels" component={AdminLevelsPage} />
          <Route exact path="/admin/settings/goals" component={AdminGoalsPage} />
          <Route exact path="/admin/settings/invite" component={AdminInvitePage} />
          <Route exact path="/admin/badges" component={AdminBadgesPage} />
          <Route exact path="/admin/requests" component={AdminActivityRequestsPage} />
          <Route exact path="/admin/users" component={AdminUsersPage} />
          <Route exact path="/admin/organizations" component={AdminOrganizationsPage} />
          <Route exact path="/admin/settings" component={AdminSettingsPage} />
          <Route exact path="/admin/profile" component={AdminProfilePage} />
          <Route exact path="/" render={() => <Redirect to={isSuperAdmin ? "/admin/organizations" : "/admin/konfis"} />} />
        </IonRouterOutlet>

        {/* Die IonTabBar wird bedingt gerendert (nur in Chat-Räumen versteckt) */}
        {!isTabBarHidden(location.pathname) && (
          <IonTabBar slot="bottom">
            <IonTabButton tab="admin-konfis" href="/admin/konfis">
              <IonIcon icon={people} />
              <IonLabel>Konfis</IonLabel>
            </IonTabButton>
            <IonTabButton tab="admin-chat" href="/admin/chat">
              <IonIcon icon={chatbubbles} />
              <IonLabel>Chat</IonLabel>
              {badgeCount > 0 && (
                <IonBadge color="danger">
                  {badgeCount > 9 ? '9+' : badgeCount}
                </IonBadge>
              )}
            </IonTabButton>
            <IonTabButton tab="admin-events" href="/admin/events">
              <IonIcon icon={flash} />
              <IonLabel>Events</IonLabel>
              {pendingEventsCount > 0 && (
                <IonBadge color="danger">
                  {pendingEventsCount > 9 ? '9+' : pendingEventsCount}
                </IonBadge>
              )}
            </IonTabButton>
            <IonTabButton tab="admin-badges" href="/admin/badges">
              <IonIcon icon={star} />
              <IonLabel>Badges</IonLabel>
            </IonTabButton>
            <IonTabButton tab="admin-requests" href="/admin/requests">
              <IonIcon icon={documentIcon} />
              <IonLabel>Anträge</IonLabel>
              {pendingRequestsCount > 0 && (
                <IonBadge color="danger">
                  {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                </IonBadge>
              )}
            </IonTabButton>
            <IonTabButton tab="admin-settings" href="/admin/settings">
              <IonIcon icon={ellipsisHorizontal} />
              <IonLabel>Mehr</IonLabel>
            </IonTabButton>
          </IonTabBar>
        )}
      </IonTabs>
    </ModalProvider>
  ) : (
    // Konfi Tabs
    <ModalProvider>
      <IonTabs>
        <IonRouterOutlet>
          <Route exact path="/konfi" render={() => <Redirect to="/konfi/dashboard" />} />
          <Route exact path="/konfi/dashboard" component={KonfiDashboardPage} />
          <Route exact path="/konfi/events" component={KonfiEventsPage} />
          <Route exact path="/konfi/events/:id" component={KonfiEventDetailPage} />
          <Route exact path="/konfi/badges" component={KonfiBadgesPage} />

          {/* CHAT ROUTEN - Nach Konfis-Pattern */}
          <Route exact path="/konfi/chat" component={ChatOverviewPage} />
          <Route path="/konfi/chat/room/:roomId" render={(props) => {
            const roomId = parseInt(props.match.params.roomId);
            return <ChatRoomView roomId={roomId} onBack={() => props.history.goBack()} />;
          }} />

          <Route exact path="/konfi/requests" component={KonfiRequestsPage} />
          <Route exact path="/konfi/profile" component={KonfiProfilePage} />
          <Route exact path="/" render={() => <Redirect to="/konfi/dashboard" />} />
        </IonRouterOutlet>

        {/* Die IonTabBar wird bedingt gerendert */}
        {!isTabBarHidden(location.pathname) && (
          <IonTabBar slot="bottom">
            <IonTabButton tab="dashboard" href="/konfi/dashboard">
              <IonIcon icon={home} />
              <IonLabel>Dashboard</IonLabel>
            </IonTabButton>
            <IonTabButton tab="chat" href="/konfi/chat"> {/* HIER IST DER CHAT-TAB-BUTTON */}
              <IonIcon icon={chatbubbles} />
              <IonLabel>Chat</IonLabel>
              {badgeCount > 0 && (
                <IonBadge color="danger">
                  {badgeCount > 9 ? '9+' : badgeCount}
                </IonBadge>
              )}
            </IonTabButton>
            <IonTabButton tab="events" href="/konfi/events">
              <IonIcon icon={calendar} />
              <IonLabel>Events</IonLabel>
            </IonTabButton>
            <IonTabButton tab="badges" href="/konfi/badges">
              <IonIcon icon={star} />
              <IonLabel>Badges</IonLabel>
              {newBadgesCount > 0 && (
                <IonBadge color="danger">
                  {newBadgesCount > 9 ? '9+' : newBadgesCount}
                </IonBadge>
              )}
            </IonTabButton>
            <IonTabButton tab="requests" href="/konfi/requests">
              <IonIcon icon={documentIcon} />
              <IonLabel>Aktivitäten</IonLabel>
            </IonTabButton>
            <IonTabButton tab="profile" href="/konfi/profile">
              <IonIcon icon={person} />
              <IonLabel>Profil</IonLabel>
            </IonTabButton>
          </IonTabBar>
        )}
      </IonTabs>
    </ModalProvider>
  );
};

export default MainTabs;