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
  ICON_HAKEN,
  ICON_INFO,
  ICON_MAIL,
  ICON_OFFLINE,
  ICON_SCHLIESSEN,
} from './icons';
import { EMAIL_HINWEIS, useEmailAendern } from './useEmailAendern';

// Farbvariante der jeweiligen Rolle — dasselbe Muster wie AppSperreSchalter:
// EINE gemeinsame Komponente fuer alle drei Profil-Ansichten, die Seiten geben
// nur ihre Farbe mit. Vorher lag dieses Modal doppelt vor (admin/ und konfi/,
// das Teamer-Profil importierte quer aus dem Konfi-Baum) — funktional
// identisch, nur die CSS-Klassen unterschieden sich.
export type KontoModalVariante = 'users' | 'teamer' | 'purple';

export const KONTO_MODAL_STIL: Record<KontoModalVariante, { sectionIcon: string; submitBtn: string; infoBox: string }> = {
  users: { sectionIcon: 'app-section-icon--users', submitBtn: 'app-modal-submit-btn--settings', infoBox: 'app-info-box--blue' },
  teamer: { sectionIcon: 'app-section-icon--teamer', submitBtn: 'app-modal-submit-btn--teamer', infoBox: 'app-info-box--teamer' },
  purple: { sectionIcon: 'app-section-icon--purple', submitBtn: 'app-modal-submit-btn--konfi', infoBox: 'app-info-box--purple' },
};

interface ChangeEmailModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialEmail?: string;
  variante?: KontoModalVariante;
}

const ChangeEmailModal: React.FC<ChangeEmailModalProps> = ({
  onClose,
  onSuccess,
  initialEmail = '',
  variante = 'purple'
}) => {
  // Laden, Pruefen und Speichern: useEmailAendern -- dieselbe Logik wie im
  // Dialog der Web-Fassung (web/konto/WebEmailAendern).
  const { email, setEmail, laedt: loading, isSubmitting, isOnline, speichern: handleSave } = useEmailAendern({ initialEmail, onErfolg: onSuccess });
  const stil = KONTO_MODAL_STIL[variante];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>E-Mail ändern</IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen" className="app-modal-close-btn" onClick={onClose} disabled={isSubmitting}>
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton aria-label="E-Mail-Adresse speichern" className={`app-modal-submit-btn ${stil.submitBtn}`} onClick={handleSave} disabled={isSubmitting || loading || !isOnline}>
              {!isOnline ? <><IonIcon icon={ICON_OFFLINE} /> Du bist offline</> : isSubmitting ? <IonSpinner name="crescent" /> : <IonIcon icon={ICON_HAKEN} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* E-Mail-Adresse Sektion - iOS26 Pattern */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className={`app-section-icon ${stil.sectionIcon}`}>
              <IonIcon icon={ICON_MAIL} />
            </div>
            <IonLabel>E-Mail-Adresse</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent className="app-info-box">
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">E-Mail-Adresse (optional)</IonLabel>
                  {loading ? (
                    <div style={{ padding: 'var(--app-abstand-mittel) 0' }}>
                      <IonSpinner name="crescent" style={{ width: '20px', height: '20px' }} />
                    </div>
                  ) : (
                    <IonInput aria-label="E-Mail-Adresse (optional)"
                      type="email"
                      value={email}
                      onIonInput={(e) => setEmail(e.detail.value!)}
                      placeholder="deine@email.de"
                      disabled={isSubmitting}
                      clearInput={true}
                    />
                  )}
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Hinweis Sektion - iOS26 Pattern */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className={`app-section-icon ${stil.sectionIcon}`}>
              <IonIcon icon={ICON_INFO} />
            </div>
            <IonLabel>Hinweis</IonLabel>
          </IonListHeader>
          <IonCard className={`app-card ${stil.infoBox}`}>
            <IonCardContent className="app-info-box">
              <p style={{ margin: 0 }}>
                {EMAIL_HINWEIS}
              </p>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ChangeEmailModal;
