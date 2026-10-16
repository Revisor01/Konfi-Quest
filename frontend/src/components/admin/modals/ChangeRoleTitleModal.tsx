// Das Modal der App für die Funktionsbeschreibung (Team und Leitung). Die
// Logik -- Speichern, Warteschlange ohne Netz, Texte -- steht in
// shared/useFunktionsbeschreibung und gilt ebenso für den Dialog des Browsers
// (shared/web/konto/WebFunktionDialog).
import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonIcon,
  IonButton,
  IonButtons,
  IonInput,
  IonList,
  IonListHeader,
  IonSpinner
} from '@ionic/react';
import {
  ICON_AKTENTASCHE,
  ICON_HAKEN,
  ICON_INFO,
  ICON_OFFLINE,
  ICON_SCHLIESSEN,
} from '../../shared/icons';
import {
  FUNKTION_BEISPIELE,
  FUNKTION_HINWEIS,
  FUNKTION_PLATZHALTER,
  useFunktionsbeschreibung,
} from '../../shared/useFunktionsbeschreibung';

interface ChangeRoleTitleModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialRoleTitle?: string;
  sectionIconClass?: string;
  submitBtnClass?: string;
  infoBoxClass?: string;
}

const ChangeRoleTitleModal: React.FC<ChangeRoleTitleModalProps> = ({
  onClose,
  onSuccess,
  initialRoleTitle = '',
  sectionIconClass = 'app-section-icon--users',
  submitBtnClass = 'app-modal-submit-btn--settings',
  infoBoxClass = 'app-info-box--blue'
}) => {
  const { roleTitle, setRoleTitle, isSubmitting, isOnline, speichern } = useFunktionsbeschreibung({
    initialRoleTitle,
    onErfolg: onSuccess,
  });
  const handleSave = () => { void speichern(); };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Funktionsbeschreibung</IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen" onClick={onClose} disabled={isSubmitting} className="app-modal-close-btn">
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton aria-label="Rollentitel speichern" onClick={handleSave} disabled={isSubmitting || !isOnline} className={`app-modal-submit-btn ${submitBtnClass}`}>
              {!isOnline ? <><IonIcon icon={ICON_OFFLINE} /> Du bist offline</> : isSubmitting ? <IonSpinner name="crescent" /> : <IonIcon icon={ICON_HAKEN} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Funktionsbeschreibung Sektion - iOS26 Pattern */}
        <IonList inset={true} className="app-segment-wrapper" style={{ marginTop: 'var(--app-abstand-eng)' }}>
          <IonListHeader>
            <div className={`app-section-icon ${sectionIconClass}`}>
              <IonIcon icon={ICON_AKTENTASCHE} />
            </div>
            <IonLabel>Deine Funktion</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent className="app-info-box">
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Funktionsbeschreibung</IonLabel>
                  <IonInput aria-label="Funktionsbeschreibung"
                    value={roleTitle}
                    onIonInput={(e) => setRoleTitle(e.detail.value!)}
                    placeholder={FUNKTION_PLATZHALTER}
                    disabled={isSubmitting}
                    clearInput={true}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Hinweis Sektion - iOS26 Pattern */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className={`app-section-icon ${sectionIconClass}`}>
              <IonIcon icon={ICON_INFO} />
            </div>
            <IonLabel>Hinweis</IonLabel>
          </IonListHeader>
          <IonCard className={`app-card ${infoBoxClass}`}>
            <IonCardContent className="app-info-box">
              <p style={{ margin: 0 }}>
                {FUNKTION_HINWEIS}
              </p>
              <p style={{ margin: 'var(--app-abstand-mittel) 0 0 0', fontSize: 'var(--app-text-sekundaer)', fontStyle: 'italic' }}>
                {FUNKTION_BEISPIELE}
              </p>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ChangeRoleTitleModal;
