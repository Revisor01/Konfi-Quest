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
  IonInput,
  IonList,
  IonListHeader,
  IonIcon,
  IonCard,
  IonCardContent,
  IonSpinner
} from '@ionic/react';
import { closeOutline, checkmarkOutline, personOutline, informationCircleOutline, cloudOfflineOutline, schoolOutline, checkmark } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';

interface Jahrgang {
  id: number;
  name: string;
}

interface KonfiModalProps {
  jahrgaenge: Jahrgang[];
  onClose: () => void;
  onSave: (konfiData: any) => void;
  dismiss?: () => void;
}

const KonfiModal: React.FC<KonfiModalProps> = ({ jahrgaenge, onClose, onSave, dismiss }) => {
  const { isOnline } = useApp();
  const [name, setName] = useState('');
  const [jahrgangId, setJahrgangId] = useState<number | null>(null);
  const { isSubmitting, guard } = useActionGuard();

  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!name.trim() || jahrgangId === null) return;

    await guard(async () => {
      const konfiData = {
        name: name.trim(),
        jahrgang_id: jahrgangId
      };

      await onSave(konfiData);
    });
  };

  const isValid = name.trim().length > 0 && jahrgangId !== null;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Konfi erstellen</IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen" onClick={handleClose} disabled={isSubmitting} className="app-modal-close-btn">
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton aria-label="Konfi speichern" onClick={handleSave} disabled={!isValid || isSubmitting || !isOnline} className="app-modal-submit-btn app-modal-submit-btn--konfi">
              {!isOnline ? <><IonIcon icon={cloudOfflineOutline} /> Du bist offline</> : isSubmitting ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Name Sektion - iOS26 Pattern */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--purple">
              <IonIcon icon={personOutline} />
            </div>
            <IonLabel>Konfi Daten</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Name *</IonLabel>
                  <IonInput
                    value={name}
                    onIonInput={(e) => setName(e.detail.value!)}
                    placeholder="Vor- und Nachname"
                    disabled={isSubmitting}
                    clearInput={true}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Jahrgang - als antippbare Liste wie beim Anlegen von Teamer:innen.
            Anders als dort ist es eine EINFACH-Auswahl: Ein Konfi gehoert zu
            genau einem Jahrgang (jahrgang_id). */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--purple">
              <IonIcon icon={schoolOutline} />
            </div>
            <IonLabel>Jahrgang *</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              {jahrgaenge.length === 0 ? (
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel style={{ textAlign: 'center' }}>
                    <p style={{ color: '#999', margin: 0 }}>Keine Jahrgänge verfügbar</p>
                  </IonLabel>
                </IonItem>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {jahrgaenge.map((jg, index) => {
                    const isSelected = jahrgangId === jg.id;

                    return (
                      <div
                        key={jg.id}
                        className={`app-list-item app-list-item--purple${isSelected ? ' app-list-item--selected' : ''}`}
                        onClick={() => !isSubmitting && setJahrgangId(jg.id)}
                        style={{
                          cursor: isSubmitting ? 'default' : 'pointer',
                          opacity: isSubmitting ? 0.6 : 1,
                          position: 'relative',
                          overflow: 'hidden',
                          marginBottom: index < jahrgaenge.length - 1 ? '8px' : '0'
                        }}
                      >
                        {isSelected && (
                          <div className="app-corner-badges">
                            <div
                              className="app-corner-badge"
                              style={{ backgroundColor: 'var(--app-color-konfis)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px' }}
                              title="Ausgewählt"
                            >
                              <IonIcon icon={checkmark} style={{ color: '#fff', fontSize: '0.85rem' }} />
                            </div>
                          </div>
                        )}
                        <div className="app-list-item__row">
                          <div className="app-list-item__main">
                            <div className="app-list-item__content">
                              <div className="app-list-item__title" style={{ paddingRight: isSelected ? '40px' : '0' }}>{jg.name}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Hinweis Sektion - iOS26 Pattern in Lila */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--purple">
              <IonIcon icon={informationCircleOutline} />
            </div>
            <IonLabel>Hinweis</IonLabel>
          </IonListHeader>
          <IonCard className="app-card" style={{ background: 'rgba(91, 33, 182, 0.08)', border: '1px solid rgba(91, 33, 182, 0.2)' }}>
            <IonCardContent style={{ padding: '16px' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--app-color-konfis)' }}>
                Benutzername und Passwort werden automatisch generiert. Du kannst das Passwort später in der Detailansicht einsehen oder zurücksetzen.
              </p>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default KonfiModal;