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
  people, chatbubbles, star, ellipsisHorizontal,
  person, home, flash, document as documentIcon, calendar, business
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
import AdminActivityRequestsPage from '../admin/pages/AdminActivityRequestsPage';
import AdminUsersPage from '../admin/pages/AdminUsersPage';
// AdminRolesPage entfernt - Rollen sind jetzt hardcoded
import AdminOrganizationsPage from '../admin/pages/AdminOrganizationsPage';
import AdminProfilePage from '../admin/pages/AdminProfilePage';
import AdminSettingsPage from '../admin/pages/AdminSettingsPage';
import AdminMaterialPage from '../admin/pages/AdminMaterialPage';
import AdminCertificatesPage from '../admin/pages/AdminCertificatesPage';
import AdminDashboardSettingsPage from '../admin/pages/AdminDashboardSettingsPage';
import AdminLevelsPage from '../admin/pages/AdminLevelsPage';
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
import TeamerDashboardPage from '../teamer/pages/TeamerDashboardPage';
import TeamerEventsPage from '../teamer/pages/TeamerEventsPage';
import TeamerMaterialPage from '../teamer/pages/TeamerMaterialPage';

import TeamerProfilePage from '../teamer/pages/TeamerProfilePage';

const MainTabs: React.FC = () => {
  const { user } = useApp();
  const { chatUnreadTotal, pendingRequestsCount, pendingEventsCount } = useBadge();
  // super_admin bekommt eine eigene, reduzierte Navigation
  const isSuperAdmin = user?.role_name === 'super_admin';
  const [newBadgesCount, setNewBadgesCount] = useState(0);
  const location = useLocation(); // Hook, um den aktuellen Pfad zu erhalten

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
 console.warn('Badges konnten nicht geladen werden:', error);
        }
      }
    };

    loadNewBadgesCount();

    // Refresh every 60 seconds
    const interval = setInterval(loadNewBadgesCount, 60000);
    return () => clearInterval(interval);
  }, [user]);


  if (!user) {
    return null;
  }

  // Funktion, um zu prüfen, ob die Tab-Bar angezeigt werden soll
  const isTabBarHidden = (path: string) => {
    // Verstecke die Tab-Bar, wenn der Pfad ein Chat-Raum ist
    return path.startsWith('/admin/chat/room/') || path.startsWith('/konfi/chat/room/') || path.startsWith('/teamer/chat/room/');
  };

  return isSuperAdmin ? (
    // Super-Admin: Nur Organisationen-View ohne TabBar
    <ModalProvider>
      <IonRouterOutlet>
        <Route exact path="/admin" render={() => <Redirect to="/admin/organizations" />} />
        <Route exact path="/admin/organizations" component={AdminOrganizationsPage} />
        <Route exact path="/" render={() => <Redirect to="/admin/organizations" />} />
      </IonRouterOutlet>
    </ModalProvider>
  ) : user.type === 'admin' ? (
    // Admin Tabs (org_admin / teamer)
    <ModalProvider>
      <IonTabs>
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
          <Route exact path="/admin/settings/invite" component={AdminInvitePage} />
          <Route exact path="/admin/badges" component={AdminBadgesPage} />
          <Route exact path="/admin/requests" component={AdminActivityRequestsPage} />
          <Route exact path="/admin/users" component={AdminUsersPage} />
          <Route exact path="/admin/organizations" component={AdminOrganizationsPage} />
          <Route exact path="/admin/material" component={AdminMaterialPage} />
          <Route exact path="/admin/settings/certificates" component={AdminCertificatesPage} />
          <Route exact path="/admin/settings/dashboard" component={AdminDashboardSettingsPage} />
          <Route exact path="/admin/settings" component={AdminSettingsPage} />
          <Route exact path="/admin/profile" component={AdminProfilePage} />
          <Route exact path="/" render={() => <Redirect to="/admin/konfis" />} />
        </IonRouterOutlet>

        {/* Die IonTabBar wird bedingt gerendert (nur in Chat-Räumen versteckt) */}
        {!isTabBarHidden(location.pathname) && (
          <IonTabBar slot="bottom">
            <IonTabButton tab="admin-konfis" href="/admin/konfis">
              <IonIcon icon={people} />
              <IonLabel>User</IonLabel>
            </IonTabButton>
            <IonTabButton tab="admin-chat" href="/admin/chat">
              <IonIcon icon={chatbubbles} />
              <IonLabel>Chat</IonLabel>
              {chatUnreadTotal > 0 && (
                <IonBadge color="danger">
                  {chatUnreadTotal > 9 ? '9+' : chatUnreadTotal}
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
  ) : user.type === 'teamer' ? (
    // Teamer Tabs
    <ModalProvider>
      <IonTabs>
        <IonRouterOutlet>
          <Route exact path="/teamer" render={() => <Redirect to="/teamer/dashboard" />} />
          <Route exact path="/teamer/dashboard" component={TeamerDashboardPage} />
          <Route exact path="/teamer/chat" component={ChatOverviewPage} />
          <Route path="/teamer/chat/room/:roomId" render={(props) => {
            const roomId = parseInt(props.match.params.roomId);
            return <ChatRoomView roomId={roomId} onBack={() => props.history.goBack()} />;
          }} />
          <Route exact path="/teamer/events" component={TeamerEventsPage} />
          <Route exact path="/teamer/material" component={TeamerMaterialPage} />

          <Route exact path="/teamer/profile" component={TeamerProfilePage} />
          <Route exact path="/" render={() => <Redirect to="/teamer/dashboard" />} />
        </IonRouterOutlet>
        {!isTabBarHidden(location.pathname) && (
          <IonTabBar slot="bottom">
            <IonTabButton tab="teamer-dashboard" href="/teamer/dashboard">
              <IonIcon icon={home} />
              <IonLabel>Start</IonLabel>
            </IonTabButton>
            <IonTabButton tab="teamer-chat" href="/teamer/chat">
              <IonIcon icon={chatbubbles} />
              <IonLabel>Chat</IonLabel>
              {chatUnreadTotal > 0 && (
                <IonBadge color="danger">
                  {chatUnreadTotal > 9 ? '9+' : chatUnreadTotal}
                </IonBadge>
              )}
            </IonTabButton>
            <IonTabButton tab="teamer-events" href="/teamer/events">
              <IonIcon icon={calendar} />
              <IonLabel>Events</IonLabel>
            </IonTabButton>
            <IonTabButton tab="teamer-material" href="/teamer/material">
              <IonIcon icon={documentIcon} />
              <IonLabel>Material</IonLabel>
            </IonTabButton>
            <IonTabButton tab="teamer-profile" href="/teamer/profile">
              <IonIcon icon={person} />
              <IonLabel>Profil</IonLabel>
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
              <IonLabel>Start</IonLabel>
            </IonTabButton>
            <IonTabButton tab="chat" href="/konfi/chat"> {/* HIER IST DER CHAT-TAB-BUTTON */}
              <IonIcon icon={chatbubbles} />
              <IonLabel>Chat</IonLabel>
              {chatUnreadTotal > 0 && (
                <IonBadge color="danger">
                  {chatUnreadTotal > 9 ? '9+' : chatUnreadTotal}
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