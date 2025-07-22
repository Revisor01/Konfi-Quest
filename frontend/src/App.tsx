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
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
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
import { AppProvider, useApp } from './contexts/AppContext';
import { ModalProvider } from './contexts/ModalContext';
import LoginView from './components/auth/LoginView';
import LoadingSpinner from './components/common/LoadingSpinner';
import AdminKonfisPage from './components/admin/pages/AdminKonfisPage';
import AdminActivitiesPage from './components/admin/pages/AdminActivitiesPage';
import AdminEventsPage from './components/admin/pages/AdminEventsPage';
import AdminCategoriesPage from './components/admin/pages/AdminCategoriesPage';
import AdminJahrgaengeePage from './components/admin/pages/AdminJahrgaengeePage';
import AdminBadgesPage from './components/admin/pages/AdminBadgesPage';
import AdminActivityRequestsPage from './components/admin/pages/AdminActivityRequestsPage';
import AdminUsersPage from './components/admin/pages/AdminUsersPage';
import AdminRolesPage from './components/admin/pages/AdminRolesPage';
import AdminOrganizationsPage from './components/admin/pages/AdminOrganizationsPage';
import AdminProfilePage from './components/admin/pages/AdminProfilePage';
import ChatPage from './components/chat/ChatPage';
import KonfiDetailView from './components/admin/views/KonfiDetailView';
import EventDetailView from './components/admin/views/EventDetailView';
import KonfiDashboardPage from './components/konfi/pages/KonfiDashboardPage';
import KonfiEventsPage from './components/konfi/pages/KonfiEventsPage';
import KonfiBadgesPage from './components/konfi/pages/KonfiBadgesPage';
import KonfiRequestsPage from './components/konfi/pages/KonfiRequestsPage';
import KonfiProfilePage from './components/konfi/pages/KonfiProfilePage';

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
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact({
  rippleEffect: false,
  mode: 'ios',
  swipeBackEnabled: true,
  inputBlurring: true,
  scrollPadding: true,
  hardwareBackButton: false,
  backButtonText: '',
  backButtonIcon: 'arrow-back-outline',
  innerHTMLTemplatesEnabled: true,
  spinner: 'lines'
});


const AppContent: React.FC = () => {
  const { user, loading, chatNotifications } = useApp();

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
            <Redirect exact from="/" to="/login" />
          </IonRouterOutlet>
        </IonReactRouter>
      </IonApp>
    );
  }

  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>
          {/* Tab Routes */}
          <Route render={() => (
            user.type === 'admin' ? (
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
                  <Route exact path="/admin/categories" component={AdminCategoriesPage} />
                  <Route exact path="/admin/jahrgaenge" component={AdminJahrgaengeePage} />
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
                        <IonCard>
                          <IonCardHeader>
                            <IonCardTitle>System-Verwaltung</IonCardTitle>
                          </IonCardHeader>
                          <IonCardContent>
                            <IonItem button routerLink="/admin/users">
                              <IonIcon icon={people} slot="start" color="primary" />
                              <IonLabel>
                                <h2>Benutzer</h2>
                                <p>Systembenutzer und Zugriffsrechte verwalten</p>
                              </IonLabel>
                            </IonItem>
                            <IonItem button routerLink="/admin/roles">
                              <IonIcon icon={shield} slot="start" color="tertiary" />
                              <IonLabel>
                                <h2>Rollen</h2>
                                <p>Benutzerrollen und Berechtigungen verwalten</p>
                              </IonLabel>
                            </IonItem>
                            <IonItem button routerLink="/admin/organizations">
                              <IonIcon icon={business} slot="start" color="success" />
                              <IonLabel>
                                <h2>Organisationen</h2>
                                <p>Gemeinden und Organisationen verwalten</p>
                              </IonLabel>
                            </IonItem>
                          </IonCardContent>
                        </IonCard>

                        <IonCard>
                          <IonCardHeader>
                            <IonCardTitle>Inhalts-Verwaltung</IonCardTitle>
                          </IonCardHeader>
                          <IonCardContent>
                            <IonItem button routerLink="/admin/categories">
                              <IonIcon icon={pricetag} slot="start" color="warning" />
                              <IonLabel>
                                <h2>Kategorien</h2>
                                <p>Kategorien für Aktivitäten und Events verwalten</p>
                              </IonLabel>
                            </IonItem>
                            <IonItem button routerLink="/admin/jahrgaenge">
                              <IonIcon icon={school} slot="start" color="primary" />
                              <IonLabel>
                                <h2>Jahrgänge</h2>
                                <p>Konfirmanden-Jahrgänge verwalten</p>
                              </IonLabel>
                            </IonItem>
                          </IonCardContent>
                        </IonCard>

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
                    {chatNotifications.totalUnreadCount > 0 && (
                      <IonBadge color="danger">
                        {chatNotifications.totalUnreadCount > 99 ? '99+' : chatNotifications.totalUnreadCount}
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
                    {chatNotifications.totalUnreadCount > 0 && (
                      <IonBadge color="danger">
                        {chatNotifications.totalUnreadCount > 99 ? '99+' : chatNotifications.totalUnreadCount}
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
            )
          )} />
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
};

const App: React.FC = () => (
  <AppProvider>
    <AppContent />
  </AppProvider>
);

export default App;
