import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent
} from '@ionic/react';
import { calendar } from 'ionicons/icons';
import EmptyState from '../../shared/EmptyState';

const TeamerEventsPage: React.FC = () => {
  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Events</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Events</IonTitle>
          </IonToolbar>
        </IonHeader>

        <EmptyState
          icon={calendar}
          title="Events"
          message="Hier findest du bald Events, bei denen du als Teamer helfen kannst."
        />
      </IonContent>
    </IonPage>
  );
};

export default TeamerEventsPage;
