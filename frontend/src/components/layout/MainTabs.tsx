import React from 'react';
import { Redirect, Route } from 'react-router-dom';
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
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonBadge
} from '@ionic/react';
import { 
  people, 
  chatbubbles, 
  calendar, 
  star, 
  ellipsisHorizontal,
  person,
  home,
  logOut,
  settings,
  information,
  flash,
  pricetag,
  school,
  document,
  shield,
  business
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { useBadge } from '../../contexts/BadgeContext';
import { ModalProvider } from '../../contexts/ModalContext';
import AdminKonfisPage from '../admin/pages/AdminKonfisPage';
import AdminActivitiesPage from '../admin/pages/AdminActivitiesPage';
import AdminEventsPage from '../admin/pages/AdminEventsPage';
import AdminCategoriesPage from '../admin/pages/AdminCategoriesPage';
import AdminJahrgaengeePage from '../admin/pages/AdminJahrgaengeePage';
import AdminBadgesPage from '../admin/pages/AdminBadgesPage';
import AdminActivityRequestsPage from '../admin/pages/AdminActivityRequestsPage';
import AdminUsersPage from '../admin/pages/AdminUsersPage';
import AdminRolesPage from '../admin/pages/AdminRolesPage';
import AdminOrganizationsPage from '../admin/pages/AdminOrganizationsPage';
import AdminProfilePage from '../admin/pages/AdminProfilePage';
import ChatPage from '../chat/ChatPage';
import PushNotificationSettings from '../common/PushNotificationSettings';
import ChatPermissionsSettings from '../admin/settings/ChatPermissionsSettings';
import KonfiDetailView from '../admin/views/KonfiDetailView';
import EventDetailView from '../admin/views/EventDetailView';
import KonfiDashboardPage from '../konfi/pages/KonfiDashboardPage';
import KonfiEventsPage from '../konfi/pages/KonfiEventsPage';
import KonfiBadgesPage from '../konfi/pages/KonfiBadgesPage';
import KonfiRequestsPage from '../konfi/pages/KonfiRequestsPage';
import KonfiProfilePage from '../konfi/pages/KonfiProfilePage';

const MainTabs: React.FC = () => {
  const { user } = useApp();
  const { badgeCount } = useBadge(); // Badge Hook direkt hier!

  if (!user) {
    return null;
  }

  return user.type === 'admin' ? (
    // Admin Tabs
    <ModalProvider>
      <IonTabs>
        <IonRouterOutlet>
          <Route exact path="/admin" render={() => <Redirect to="/admin/konfis" />} />
          <Route exact path="/admin/konfis" component={AdminKonfisPage} />
          <Route path="/admin/konfis/:id" render={(props) => {
            const konfiId = parseInt(props.match.params.id);
            return <KonfiDetailView konfiId={konfiId} onBack={() => props.history.goBack()} />;
          }} />
          <Route exact path="/admin/chat" component={ChatPage} />
          <Route exact path="/admin/activities" component={AdminActivitiesPage} />
          <Route path="/admin/events/:id" render={(props) => {
            const eventId = parseInt(props.match.params.id);
            return <EventDetailView eventId={eventId} onBack={() => props.history.goBack()} />;
          }} />
          <Route exact path="/admin/events" component={AdminEventsPage} />
          <Route exact path="/admin/settings/categories" component={AdminCategoriesPage} />
          <Route exact path="/admin/settings/jahrgaenge" component={AdminJahrgaengeePage} />
          <Route exact path="/admin/badges" component={AdminBadgesPage} />
          <Route exact path="/admin/requests" component={AdminActivityRequestsPage} />
          <Route exact path="/admin/users" component={AdminUsersPage} />
          <Route exact path="/admin/roles" component={AdminRolesPage} />
          <Route exact path="/admin/organizations" component={AdminOrganizationsPage} />
          <Route exact path="/admin/settings" render={() => (
            <IonPage>
              <IonHeader>
                <IonToolbar>
                  <IonTitle>Mehr</IonTitle>
                </IonToolbar>
              </IonHeader>
              <IonContent className="ion-padding">
                {(user?.permissions?.includes('admin.users.view') || 
                  user?.permissions?.includes('admin.roles.view') || 
                  user?.permissions?.includes('admin.organizations.view')) && (
                  <IonCard>
                    <IonCardHeader>
                      <IonCardTitle>System-Verwaltung</IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      {user?.permissions?.includes('admin.users.view') && (
                        <IonItem 
                          button={user?.permissions?.includes('admin.users.edit')} 
                          routerLink={user?.permissions?.includes('admin.users.edit') ? "/admin/users" : undefined}
                          style={{ 
                            opacity: user?.permissions?.includes('admin.users.edit') ? 1 : 0.5,
                            cursor: user?.permissions?.includes('admin.users.edit') ? 'pointer' : 'not-allowed'
                          }}
                        >
                          <IonIcon icon={people} slot="start" color="primary" />
                          <IonLabel>
                            <h2>Benutzer</h2>
                            <p>Systembenutzer und Zugriffsrechte verwalten</p>
                          </IonLabel>
                        </IonItem>
                      )}
                      {user?.permissions?.includes('admin.roles.view') && (
                        <IonItem 
                          button={user?.permissions?.includes('admin.roles.edit')}
                          routerLink={user?.permissions?.includes('admin.roles.edit') ? "/admin/roles" : undefined}
                          style={{ 
                            opacity: user?.permissions?.includes('admin.roles.edit') ? 1 : 0.5,
                            cursor: user?.permissions?.includes('admin.roles.edit') ? 'pointer' : 'not-allowed'
                          }}
                        >
                          <IonIcon icon={shield} slot="start" color="tertiary" />
                          <IonLabel>
                            <h2>Rollen</h2>
                            <p>Benutzerrollen und Berechtigungen verwalten</p>
                          </IonLabel>
                        </IonItem>
                      )}
                      {user?.permissions?.includes('admin.organizations.view') && (
                        <IonItem 
                          button={user?.permissions?.includes('admin.organizations.edit')}
                          routerLink={user?.permissions?.includes('admin.organizations.edit') ? "/admin/organizations" : undefined}
                          style={{ 
                            opacity: user?.permissions?.includes('admin.organizations.edit') ? 1 : 0.5,
                            cursor: user?.permissions?.includes('admin.organizations.edit') ? 'pointer' : 'not-allowed'
                          }}
                        >
                          <IonIcon icon={business} slot="start" color="success" />
                          <IonLabel>
                            <h2>Organisationen</h2>
                            <p>Gemeinden und Organisationen verwalten</p>
                          </IonLabel>
                        </IonItem>
                      )}
                    </IonCardContent>
                  </IonCard>
                )}

                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>Inhalts-Verwaltung</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <IonItem button routerLink="/admin/settings/categories">
                      <IonIcon icon={pricetag} slot="start" color="warning" />
                      <IonLabel>
                        <h2>Kategorien</h2>
                        <p>Kategorien für Aktivitäten und Events verwalten</p>
                      </IonLabel>
                    </IonItem>
                    <IonItem button routerLink="/admin/settings/jahrgaenge">
                      <IonIcon icon={school} slot="start" color="primary" />
                      <IonLabel>
                        <h2>Jahrgänge</h2>
                        <p>Konfirmanden-Jahrgänge verwalten</p>
                      </IonLabel>
                    </IonItem>
                  </IonCardContent>
                </IonCard>

                <ChatPermissionsSettings />

                <PushNotificationSettings />

                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>Konto</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <IonItem button routerLink="/admin/profile">
                      <IonIcon icon={person} slot="start" color="primary" />
                      <IonLabel>
                        <h2>Profil</h2>
                        <p>Passwort und E-Mail ändern</p>
                      </IonLabel>
                    </IonItem>
                  </IonCardContent>
                </IonCard>
              </IonContent>
            </IonPage>
          )} />
          <Route exact path="/admin/profile" component={AdminProfilePage} />
          <Route exact path="/" render={() => <Redirect to="/admin/konfis" />} />
        </IonRouterOutlet>

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
          </IonTabButton>
          <IonTabButton tab="admin-settings" href="/admin/settings">
            <IonIcon icon={ellipsisHorizontal} />
            <IonLabel>Mehr</IonLabel>
          </IonTabButton>
        </IonTabBar>
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
          <Route exact path="/konfi/badges" component={KonfiBadgesPage} />
          <Route exact path="/konfi/chat" component={ChatPage} />
          <Route exact path="/konfi/requests" component={KonfiRequestsPage} />
          <Route exact path="/konfi/profile" component={KonfiProfilePage} />
          <Route exact path="/" render={() => <Redirect to="/konfi/dashboard" />} />
        </IonRouterOutlet>

        <IonTabBar slot="bottom">
          <IonTabButton tab="dashboard" href="/konfi/dashboard">
            <IonIcon icon={home} />
            <IonLabel>Dashboard</IonLabel>
          </IonTabButton>
          <IonTabButton tab="chat" href="/konfi/chat">
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
      </IonTabs>
    </ModalProvider>
  );
};

export default MainTabs;