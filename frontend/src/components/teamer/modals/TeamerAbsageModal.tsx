import React, { useState } from 'react';
import { useActionGuard } from '../../../hooks/useActionGuard';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonItem,
  IonLabel,
  IonTextarea,
  IonIcon,
  IonCard,
  IonCardContent,
  IonList,
  IonListHeader
} from '@ionic/react';
import {
  closeOutline,
  checkmarkOutline,
  calendarOutline,
  chatbubbleOutline
} from 'ionicons/icons';

/**
 * Absage-Dialog fuer Teamer:innen ("Ich bin nicht dabei").
 *
 * Eigenes Bauteil statt einer Wiederverwendung von konfi/modals/
 * UnregisterModal: Das Konfi-Modal traegt den Eltern-Hinweis fuer
 * Pflichttermine, verlangt IMMER einen Grund (mind. 1 bzw. 5 Zeichen) und
 * sperrt den Sende-Knopf offline. Fuer Teamer:innen gilt anderes
 * (Anforderung 01.09.2026):
 *
 *   - Der Grund ist FREIWILLIG — ausser die Absage nimmt eine Zusage
 *     zurueck (grundPflicht=true). Dann verlangt schon der Dialog einen
 *     Grund; das Backend lehnt ihn ohne ohnehin ab (400,
 *     error_code 'grund_erforderlich') — der Dialog erspart nur den
 *     Fehlversuch.
 *   - Offline bleibt der Knopf NUTZBAR: Eine Absage gibt einen Platz frei,
 *     es gibt nichts, was offline unbekannt waere (dieselbe Begruendung wie
 *     bei der Konfi-Abmeldung seit 30.08.2026). Die Seite legt sie in die
 *     Warteschlange.
 */
interface TeamerAbsageModalProps {
  eventName: string;
  /** true: Absage nach Zusage — ohne Grund geht es nicht. */
  grundPflicht: boolean;
  onAbsage: (reason: string) => void;
  dismiss: (data?: string, role?: string) => void;
}

const TeamerAbsageModal: React.FC<TeamerAbsageModalProps> = ({
  eventName,
  grundPflicht,
  onAbsage,
  dismiss
}) => {
  const [reason, setReason] = useState('');
  const { isSubmitting, guard } = useActionGuard();

  const isValid = !grundPflicht || reason.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid) {
      return;
    }
    await guard(async () => {
      onAbsage(reason.trim());
      dismiss(reason.trim(), 'confirm');
    });
  };

  const handleClose = () => {
    dismiss(undefined, 'cancel');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Absage</IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen" className="app-modal-close-btn" onClick={handleClose}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton
              aria-label="Absage bestätigen"
              className="app-modal-submit-btn app-modal-submit-btn--teamer"
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
            >
              <IonIcon icon={checkmarkOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={calendarOutline} />
            </div>
            <IonLabel>Absage für</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#333' }}>
                {eventName}
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={chatbubbleOutline} />
            </div>
            <IonLabel>{grundPflicht ? 'Grund für die Absage' : 'Grund (freiwillig)'}</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <p style={{ color: 'var(--ion-color-medium)', fontSize: '0.85rem', margin: '0 0 8px 0', padding: '0 4px' }}>
                {grundPflicht
                  ? 'Du hattest zugesagt. Bitte gib einen Grund an, damit die Leitung umplanen kann.'
                  : 'Ein Grund hilft der Leitung beim Planen — du musst aber keinen angeben.'}
              </p>
              <IonList style={{ background: 'transparent', padding: '0' }}>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonTextarea
                    value={reason}
                    onIonInput={(e) => setReason(e.detail.value!)}
                    placeholder={grundPflicht ? 'Warum kannst du nicht?' : 'Grund (kannst du leer lassen)'}
                    rows={4}
                    autoGrow={true}
                  />
                </IonItem>
              </IonList>
              {grundPflicht && reason.trim().length === 0 && (
                <p style={{ color: 'var(--ion-color-danger)', fontSize: '0.75rem', margin: '4px 0 0 4px' }}>
                  Ohne Grund lässt sich eine Absage nach Zusage nicht speichern.
                </p>
              )}
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default TeamerAbsageModal;
