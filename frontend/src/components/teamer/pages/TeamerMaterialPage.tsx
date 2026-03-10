import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent
} from '@ionic/react';
import { document as documentIcon } from 'ionicons/icons';
import EmptyState from '../../shared/EmptyState';

const TeamerMaterialPage: React.FC = () => {
  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Material</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Material</IonTitle>
          </IonToolbar>
        </IonHeader>

        <EmptyState
          icon={documentIcon}
          title="Material"
          message="Hier findest du bald Materialien und Dokumente für deinen Jahrgang."
        />
      </IonContent>
    </IonPage>
  );
};

export default TeamerMaterialPage;
