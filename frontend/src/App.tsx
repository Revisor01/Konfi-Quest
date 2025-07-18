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
  school
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
import ChatPage from './components/chat/ChatPage';
import KonfiDetailView from './components/admin/views/KonfiDetailView';
import EventDetailView from './components/admin/views/EventDetailView';

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
  const { user, loading } = useApp();

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
                  <Redirect exact path="/admin" to="/admin/konfis" />
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
                  <Route exact path="/admin/badges" render={() => (
                    <IonPage>
                      <IonHeader>
                        <IonToolbar>
                          <IonTitle>Badges</IonTitle>
                        </IonToolbar>
                      </IonHeader>
                      <IonContent>
                        <p>Badges (TODO: Implement)</p>
                      </IonContent>
                    </IonPage>
                  )} />
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
                            <IonCardTitle>Verwaltung</IonCardTitle>
                          </IonCardHeader>
                          <IonCardContent>
                            <IonItem button routerLink="/admin/categories">
                              <IonIcon icon={pricetag} slot="start" color="primary" />
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
                            <IonItem button onClick={() => {
                              if (window.confirm('Möchten Sie sich wirklich abmelden?')) {
                                localStorage.removeItem('konfi_token');
                                localStorage.removeItem('konfi_user');
                                window.location.reload();
                              }
                            }}>
                              <IonIcon icon={logOut} slot="start" color="danger" />
                              <IonLabel color="danger">
                                <h2>Abmelden</h2>
                                <p>Von Konfi Quest abmelden</p>
                              </IonLabel>
                            </IonItem>
                          </IonCardContent>
                        </IonCard>

                        <IonCard>
                          <IonCardHeader>
                            <IonCardTitle>App-Info</IonCardTitle>
                          </IonCardHeader>
                          <IonCardContent>
                            <IonItem>
                              <IonIcon icon={information} slot="start" color="primary" />
                              <IonLabel>
                                <h2>Konfi Quest</h2>
                                <p>Version 2.0 - Ionic 8</p>
                              </IonLabel>
                            </IonItem>
                          </IonCardContent>
                        </IonCard>
                      </IonContent>
                    </IonPage>
                  )} />
                  <Redirect exact from="/" to="/admin/konfis" />
                </IonRouterOutlet>

                <IonTabBar slot="bottom">
                  <IonTabButton tab="admin-konfis" href="/admin/konfis">
                    <IonIcon icon={people} />
                    <IonLabel>Konfis</IonLabel>
                  </IonTabButton>
                  <IonTabButton tab="admin-chat" href="/admin/chat">
                    <IonIcon icon={chatbubbles} />
                    <IonLabel>Chat</IonLabel>
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
                  <IonTabButton tab="admin-settings" href="/admin/settings">
                    <IonIcon icon={ellipsisHorizontal} />
                    <IonLabel>Mehr</IonLabel>
                  </IonTabButton>
                </IonTabBar>
                </IonTabs>
              </ModalProvider>
            ) : (
              // Konfi Tabs
              <IonTabs>
                <IonRouterOutlet>
                  <Redirect exact path="/konfi" to="/konfi/dashboard" />
                  <Route exact path="/konfi/dashboard" render={() => (
                    <IonPage>
                      <IonHeader>
                        <IonToolbar>
                          <IonTitle>Dashboard</IonTitle>
                        </IonToolbar>
                      </IonHeader>
                      <IonContent>
                        <p>Konfi Dashboard (TODO: Implement)</p>
                      </IonContent>
                    </IonPage>
                  )} />
                  <Route exact path="/konfi/badges" render={() => (
                    <IonPage>
                      <IonHeader>
                        <IonToolbar>
                          <IonTitle>Badges</IonTitle>
                        </IonToolbar>
                      </IonHeader>
                      <IonContent>
                        <p>Konfi Badges (TODO: Implement)</p>
                      </IonContent>
                    </IonPage>
                  )} />
                  <Route exact path="/konfi/chat" component={ChatPage} />
                  <Route exact path="/konfi/requests" render={() => (
                    <IonPage>
                      <IonHeader>
                        <IonToolbar>
                          <IonTitle>Anfragen</IonTitle>
                        </IonToolbar>
                      </IonHeader>
                      <IonContent>
                        <p>Konfi Requests (TODO: Implement)</p>
                      </IonContent>
                    </IonPage>
                  )} />
                  <Redirect exact from="/" to="/konfi/dashboard" />
                </IonRouterOutlet>

                <IonTabBar slot="bottom">
                  <IonTabButton tab="dashboard" href="/konfi/dashboard">
                    <IonIcon icon={home} />
                    <IonLabel>Dashboard</IonLabel>
                  </IonTabButton>
                  <IonTabButton tab="badges" href="/konfi/badges">
                    <IonIcon icon={star} />
                    <IonLabel>Badges</IonLabel>
                  </IonTabButton>
                  <IonTabButton tab="chat" href="/konfi/chat">
                    <IonIcon icon={chatbubbles} />
                    <IonLabel>Chat</IonLabel>
                  </IonTabButton>
                  <IonTabButton tab="requests" href="/konfi/requests">
                    <IonIcon icon={person} />
                    <IonLabel>Anfragen</IonLabel>
                  </IonTabButton>
                </IonTabBar>
              </IonTabs>
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
