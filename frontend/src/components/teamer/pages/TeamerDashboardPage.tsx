import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon
} from '@ionic/react';
import { home } from 'ionicons/icons';
import EmptyState from '../../shared/EmptyState';

const TeamerDashboardPage: React.FC = () => {
  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Start</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Start</IonTitle>
          </IonToolbar>
        </IonHeader>

        {/* Header Banner */}
        <div className="app-header-banner app-header-banner--teamer">
          <div className="app-header-banner__content">
            <div className="app-header-banner__icon-row">
              <IonIcon icon={home} className="app-header-banner__icon" />
              <span className="app-header-banner__title">Willkommen zurück!</span>
            </div>
          </div>
        </div>

        <EmptyState
          icon={home}
          title="Dein Dashboard"
          message="Hier siehst du bald deine Zertifikate, nächste Events und Badges."
        />
      </IonContent>
    </IonPage>
  );
};

export default TeamerDashboardPage;
