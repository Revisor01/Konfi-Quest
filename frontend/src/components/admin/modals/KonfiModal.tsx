import React, { useState } from 'react';
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
  IonSelect,
  IonSelectOption,
  IonList,
  IonIcon,
  IonCard,
  IonCardContent,
  IonSpinner
} from '@ionic/react';
import { close, checkmark, closeOutline, checkmarkOutline, personAdd, create } from 'ionicons/icons';

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
  const [name, setName] = useState('');
  const [jahrgang, setJahrgang] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !jahrgang) return;

    setLoading(true);
    try {
      const konfiData = {
        name: name.trim(),
        jahrgang_id: jahrgaenge.find(jg => jg.name === jahrgang)?.id || 1
      };

      await onSave(konfiData);
    } finally {
      setLoading(false);
    }
  };

  const isValid = name.trim().length > 0 && jahrgang;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Konfi erstellen</IonTitle>
          <IonButtons slot="start">
            <IonButton
              onClick={handleClose}
              disabled={loading}
              style={{
                '--background': '#f8f9fa',
                '--background-hover': '#e9ecef',
                '--color': '#6c757d',
                '--border-radius': '8px'
              }}
            >
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton
              onClick={handleSave}
              disabled={!isValid || loading}
              color="primary"
              style={{
                '--background': '#eb445a',
                '--background-hover': '#d73847',
                '--color': 'white',
                '--border-radius': '8px'
              }}
            >
              {loading ? (
                <IonSpinner name="crescent" />
              ) : (
                <IonIcon icon={checkmarkOutline} />
              )}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--padding-top': '16px' }}>
        {/* SEKTION HEADER */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#eb445a',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(235, 68, 90, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={create} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Konfi Daten
          </h2>
        </div>

        {/* SEKTION CARD */}
        <IonCard style={{
          margin: '0 16px 16px 16px',
          borderRadius: '12px',
          background: 'white',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e0e0e0'
        }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }}>
              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '8px' }}>
                <IonLabel position="stacked">Name *</IonLabel>
                <IonInput
                  value={name}
                  onIonInput={(e) => setName(e.detail.value!)}
                  placeholder="Vor- und Nachname"
                  disabled={loading}
                  clearInput={true}
                />
              </IonItem>

              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
                <IonLabel position="stacked">Jahrgang *</IonLabel>
                <IonSelect
                  value={jahrgang}
                  onIonChange={(e) => setJahrgang(e.detail.value)}
                  placeholder="Jahrgang wählen"
                  disabled={loading}
                  interface="action-sheet"
                  interfaceOptions={{
                    header: 'Jahrgang auswählen'
                  }}
                >
                  {jahrgaenge.map(jg => (
                    <IonSelectOption key={jg.id} value={jg.name}>
                      {jg.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default KonfiModal;