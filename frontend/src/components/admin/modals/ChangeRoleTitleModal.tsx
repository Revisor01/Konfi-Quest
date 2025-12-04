import React, { useState, useEffect } from 'react';
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
  IonSpinner,
  IonText
} from '@ionic/react';
import {
  closeOutline,
  checkmarkOutline,
  briefcaseOutline,
  informationCircleOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface ChangeRoleTitleModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialRoleTitle?: string;
}

const ChangeRoleTitleModal: React.FC<ChangeRoleTitleModalProps> = ({
  onClose,
  onSuccess,
  initialRoleTitle = ''
}) => {
  const { setSuccess, setError } = useApp();
  const [roleTitle, setRoleTitle] = useState(initialRoleTitle);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/auth/update-role-title', {
        role_title: roleTitle.trim()
      });
      setSuccess('Funktionsbeschreibung erfolgreich aktualisiert');
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Aktualisieren der Funktionsbeschreibung');
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Funktionsbeschreibung</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose} disabled={saving}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={saving}>
              {saving ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--padding-top': '16px' }}>
        {/* SEKTION: Funktionsbeschreibung */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#8b5cf6',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={briefcaseOutline} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Deine Funktion
          </h2>
        </div>

        <IonCard style={{
          margin: '0 16px 16px 16px',
          borderRadius: '12px',
          background: 'white',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e0e0e0'
        }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonList style={{ background: 'transparent' }} lines="none">
              <IonItem style={{ '--background': 'transparent', marginBottom: '8px' }}>
                <IonIcon icon={briefcaseOutline} slot="start" style={{ color: '#8b5cf6', marginRight: '12px' }} />
                <IonLabel position="stacked">Funktionsbeschreibung</IonLabel>
                <IonInput
                  value={roleTitle}
                  onIonInput={(e) => setRoleTitle(e.detail.value!)}
                  placeholder="z.B. Pastor, Diakonin, Jugendmitarbeiter"
                  disabled={saving}
                />
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* Info-Card */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#3b82f6',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={informationCircleOutline} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Hinweis
          </h2>
        </div>

        <IonCard style={{
          margin: '0 16px 16px 16px',
          borderRadius: '12px',
          background: 'rgba(59, 130, 246, 0.08)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          border: '1px solid rgba(59, 130, 246, 0.2)'
        }}>
          <IonCardContent style={{ padding: '16px' }}>
            <IonText color="primary">
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5' }}>
                Deine Funktionsbeschreibung wird anderen Nutzern im Chat und an anderen Stellen angezeigt.
                Sie ersetzt nicht deine Rolle (Admin, Teamer), sondern ergaenzt sie.
              </p>
              <p style={{ margin: '12px 0 0 0', fontSize: '0.85rem', fontStyle: 'italic' }}>
                Beispiele: Pastor, Diakonin, Jugendmitarbeiter, Gemeindediakon, Pfarrerin
              </p>
            </IonText>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default ChangeRoleTitleModal;
