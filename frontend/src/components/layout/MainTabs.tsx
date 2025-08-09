// MainTabs.tsx
import React, { useState, useEffect } from 'react';
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
  people, chatbubbles, calendar, star, ellipsisHorizontal,
  person, home, flash, pricetag, school, document, shield, business
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { useBadge } from '../../contexts/BadgeContext';
import api from '../../services/api';
import { ModalProvider } from '../../contexts/ModalContext'; // Behalten
import AdminKonfisPage from '../admin/pages/AdminKonfisPage';
import AdminActivitiesPage from '../admin/pages/AdminActivitiesPage';
import AdminEventsPage from '../admin/pages/AdminEventsPage';
import AdminCategoriesPage from '../admin/pages/AdminCategoriesPage';
import AdminJahrgaengeePage from '../admin/pages/AdminJahrgaengeePage';
import AdminBadgesPage from '../admin/pages/AdminBadgesPage';
import AdminRequestsPage from '../admin/pages/AdminRequestsPage';
import AdminUsersPage from '../admin/pages/AdminUsersPage';
import AdminRolesPage from '../admin/pages/AdminRolesPage';
import AdminOrganizationsPage from '../admin/pages/AdminOrganizationsPage';
import AdminProfilePage from '../admin/pages/AdminProfilePage';
import AdminSettingsPage from '../admin/pages/AdminSettingsPage';
import AdminLevelsPage from '../admin/pages/AdminLevelsPage';
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
          console.error('Error loading pending requests count:', error);
        }
      }
    };

    loadPendingRequestsCount();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadPendingRequestsCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (!user) {
    return null;
  }

  // Funktion, um zu prüfen, ob die Tab-Bar angezeigt werden soll
  const isTabBarHidden = (path: string) => {
    // Verstecke die Tab-Bar, wenn der Pfad ein Chat-Raum ist
    return path.startsWith('/admin/chat/room/') || path.startsWith('/konfi/chat/room/');
  };

  return user.type === 'admin' ? (
    // Admin Tabs
    <ModalProvider>
      <IonTabs>
        {/*
          Der IonRouterOutlet rendert die Inhalte der Tabs.
          Der Schlüssel ist, dass die Chat-Routen jetzt tiefer verschachtelt sind,
          aber immer noch innerhalb dieses Outlets.
          Ionic behandelt automatisch die Navigation und Transitionen innerhalb desselben Outlets flüssiger.
        */}
        <IonRouterOutlet>
          <Route exact path="/admin" render={() => <Redirect to="/admin/konfis" />} />
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
          <Route exact path="/admin/badges" component={AdminBadgesPage} />
          <Route exact path="/admin/requests" component={AdminRequestsPage} />
          <Route exact path="/admin/users" component={AdminUsersPage} />
          <Route exact path="/admin/roles" component={AdminRolesPage} />
          <Route exact path="/admin/organizations" component={AdminOrganizationsPage} />
          <Route exact path="/admin/settings" component={AdminSettingsPage} />
          <Route exact path="/admin/profile" component={AdminProfilePage} />
          <Route exact path="/" render={() => <Redirect to="/admin/konfis" />} />
        </IonRouterOutlet>

        {/* Die IonTabBar wird bedingt gerendert */}
        {!isTabBarHidden(location.pathname) && (
          <IonTabBar slot="bottom">
            <IonTabButton tab="admin-konfis" href="/admin/konfis">
              <IonIcon icon={people} />
              <IonLabel>Konfis</IonLabel>
            </IonTabButton>
            <IonTabButton tab="admin-chat" href="/admin/chat"> {/* HIER IST DER CHAT-TAB-BUTTON */}
              <IonIcon icon={chatbubbles} />
              <IonLabel>Chat</IonLabel>
              {badgeCount > 0 && (
                <IonBadge color="danger">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </IonBadge>
              )}
            </IonTabButton>
            <IonTabButton tab="admin-activities" href="/admin/activities">
              <IonIcon icon={calendar} />
              <IonLabel>Aktivitäten</IonLabel>
            </IonTabButton>
            <IonTabButton tab="admin-events" href="/admin/events">
              <IonIcon icon={flash} />
              <IonLabel>Events</IonLabel>
            </IonTabButton>
            <IonTabButton tab="admin-badges" href="/admin/badges">
              <IonIcon icon={star} />
              <IonLabel>Badges</IonLabel>
            </IonTabButton>
            <IonTabButton tab="admin-requests" href="/admin/requests">
              <IonIcon icon={document} />
              <IonLabel>Anträge</IonLabel>
              {pendingRequestsCount > 0 && (
                <IonBadge color="danger">
                  {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
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
                  {badgeCount > 99 ? '99+' : badgeCount}
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
            </IonTabButton>
            <IonTabButton tab="requests" href="/konfi/requests">
              <IonIcon icon={document} />
              <IonLabel>Anfragen</IonLabel>
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