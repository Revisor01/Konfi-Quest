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
import {
  ICON_CHAT,
  ICON_HAKEN,
  ICON_OFFLINE,
  ICON_SCHLIESSEN,
  ICON_TERMIN,
} from '../../shared/icons';

// Abmelden mit Grund (Konfi): „Abmelden", „Von der Warteliste abmelden" und
// am Pflicht-Event (`mandatory`, mindestens 5 Zeichen). Regeln, Texte und
// Absenden stehen seit 15.10.2026 in shared/useAbsageFormular.ts -- dieselben
// liest das Fenster des Browsers (shared/web/termine/WebAbsageDialog.tsx).
// Die Darstellung hier ist unveraendert.

interface UnregisterModalProps {
  eventName: string;
  mandatory?: boolean;
  onUnregister: (reason: string) => void;
  dismiss: (data?: string, role?: string) => void;
}

const UnregisterModal: React.FC<UnregisterModalProps> = ({
  eventName,
  mandatory,
  onUnregister,
  dismiss
}) => {
  const {
    texte, grund: reason, setGrund: setReason, gueltig: isValid, isSubmitting, absenden: handleSubmit, offlineGesperrt, zaehler,
  } = useAbsageFormular({
    rolle: 'konfi',
    pflicht: !!mandatory,
    onAbsage: (grund) => onUnregister(grund),
    onFertig: (grund) => dismiss(grund, 'confirm'),
  });
  const isOnline = !offlineGesperrt;

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
            <IonButton aria-label={texte.bestaetigen} className="app-modal-submit-btn app-modal-submit-btn--konfi" onClick={handleSubmit} disabled={!isValid || isSubmitting || !isOnline}>
              {!isOnline ? <><IonIcon icon={ICON_OFFLINE} /> Du bist offline</> : <IonIcon icon={ICON_HAKEN} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Event Info */}
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

        {/* Grund Sektion */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={ICON_CHAT} />
            </div>
            <IonLabel>{texte.grund}</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              {mandatory && (
                <p style={{ color: 'var(--ion-color-medium)', fontSize: 'var(--app-text-sekundaer)', margin: '0 0 var(--app-abstand-eng) 0', padding: '0 var(--app-abstand-mini)' }}>
                  {texte.erklaerung}
                  {' '}<strong>{texte.elternHinweis}</strong>
                </p>
              )}
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
              {zaehler && (
                <p style={{ color: 'var(--ion-color-danger)', fontSize: 'var(--app-text-klein)', margin: 'var(--app-abstand-mini) 0 0 var(--app-abstand-mini)' }}>
                  {zaehler}
                </p>
              )}
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default UnregisterModal;
