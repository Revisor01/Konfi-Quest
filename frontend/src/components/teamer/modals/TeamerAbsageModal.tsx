import React from 'react';
import { useAbsageFormular } from '../../shared/useAbsageFormular';
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
import { ICON_CHAT, ICON_HAKEN, ICON_SCHLIESSEN, ICON_TERMIN } from '../../shared/icons';

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
 *
 * Regeln, Texte und Absenden stehen seit 15.10.2026 in
 * shared/useAbsageFormular.ts -- dieselben liest das Fenster des Browsers
 * (shared/web/termine/WebAbsageDialog.tsx). Die Darstellung hier ist
 * unveraendert.
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
  const {
    texte, grund: reason, setGrund: setReason, gueltig: isValid, isSubmitting, absenden: handleSubmit, fehltSichtbar,
  } = useAbsageFormular({
    rolle: 'team',
    pflicht: grundPflicht,
    onAbsage: (grund) => onAbsage(grund),
    onFertig: (grund) => dismiss(grund, 'confirm'),
  });

  const handleClose = () => {
    dismiss(undefined, 'cancel');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{texte.titel}</IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen" className="app-modal-close-btn" onClick={handleClose}>
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton
              aria-label={texte.bestaetigen}
              className="app-modal-submit-btn app-modal-submit-btn--teamer"
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
            >
              <IonIcon icon={ICON_HAKEN} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={ICON_TERMIN} />
            </div>
            <IonLabel>{texte.fuer}</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-basis)' }}>
              <div style={{ fontWeight: 'var(--app-schrift-halbfett)', fontSize: 'var(--app-text-betont)', color: 'var(--app-text-primary)' }}>
                {eventName}
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={ICON_CHAT} />
            </div>
            <IonLabel>{texte.grund}</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <p style={{ color: 'var(--ion-color-medium)', fontSize: 'var(--app-text-sekundaer)', margin: '0 0 var(--app-abstand-eng) 0', padding: '0 var(--app-abstand-mini)' }}>
                {texte.erklaerung}
              </p>
              <IonList style={{ background: 'transparent', padding: '0' }}>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonTextarea aria-label={texte.feld}
                    value={reason}
                    onIonInput={(e) => setReason(e.detail.value!)}
                    placeholder={texte.platzhalter}
                    rows={4}
                    autoGrow={true}
                  />
                </IonItem>
              </IonList>
              {fehltSichtbar && (
                <p style={{ color: 'var(--ion-color-danger)', fontSize: 'var(--app-text-klein)', margin: 'var(--app-abstand-mini) 0 0 var(--app-abstand-mini)' }}>
                  {texte.fehlt}
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
