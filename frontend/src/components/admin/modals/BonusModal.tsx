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
  IonTextarea,
  IonCard,
  IonCardContent,
  IonSpinner,
} from '@ionic/react';
import { closeOutline, checkmarkOutline, gift, calendar, removeOutline, addOutline, chatbubbleOutline } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import { writeQueue } from '../../../services/writeQueue';
import { networkMonitor } from '../../../services/networkMonitor';

interface BonusModalProps {
  konfiId: number;
  onClose: () => void;
  onSave: () => Promise<void>;
  dismiss?: () => void;
}

const BonusModal: React.FC<BonusModalProps> = ({ konfiId, onClose, onSave, dismiss }) => {
  const { isOnline } = useApp();
  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };
  const [name, setName] = useState('');
  const [points, setPoints] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [type, setType] = useState('gemeinde');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const { isSubmitting, guard } = useActionGuard();

  const handleSave = async () => {
    if (!name.trim() || points <= 0) return;

    const body = {
      points: points,
      type: type,
      description: `${name.trim()}${reason.trim() ? ': ' + reason.trim() : ''}`,
      completed_date: selectedDate
    };

    await guard(async () => {
      if (networkMonitor.isOnline) {
        try {
          await api.post(`/admin/konfis/${konfiId}/bonus-points`, body);
          await onSave();
          handleClose();
        } catch (err) {
          console.error('Error saving bonus points:', err);
        }
      } else {
        await writeQueue.enqueue({
          method: 'POST',
          url: `/admin/konfis/${konfiId}/bonus-points`,
          body,
          maxRetries: 5,
          hasFileUpload: false,
          metadata: {
            type: 'admin',
            clientId: crypto.randomUUID(),
            label: 'Bonus-Punkte vergeben'
          }
        });
        await onSave();
        handleClose();
      }
    });
  };

  const isValid = name.trim().length > 0 && points > 0;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Bonuspunkte hinzufügen</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={handleClose} disabled={isSubmitting} className="app-modal-close-btn">
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={!isValid || isSubmitting} className="app-modal-submit-btn app-modal-submit-btn--konfi">
              {isSubmitting ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Bonuspunkt Detail */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--purple">
              <IonIcon icon={gift} />
            </div>
            <IonLabel>Bonuspunkt Detail</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Bezeichnung *</IonLabel>
                  <IonInput
                    value={name}
                    onIonInput={(e) => setName(e.detail.value!)}
                    placeholder="z.B. Hilfe beim Aufräumen"
                    clearInput={true}
                    disabled={isSubmitting}
                  />
                </IonItem>

                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Datum *</IonLabel>
                  <IonInput
                    type="date"
                    value={selectedDate}
                    onIonInput={(e) => setSelectedDate(e.detail.value!)}
                    disabled={isSubmitting}
                  />
                </IonItem>

                <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
                  <IonLabel position="stacked" style={{ marginBottom: '8px' }}>Punkte *</IonLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                    <IonButton
                      fill="outline"
                      size="small"
                      disabled={isSubmitting || points <= 1}
                      onClick={() => setPoints(Math.max(1, points - 1))}
                      style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                    >
                      <IonIcon icon={removeOutline} />
                    </IonButton>
                    <IonInput
                      type="text"
                      inputMode="numeric"
                      value={points.toString()}
                      onIonInput={(e) => {
                        const value = e.detail.value!;
                        if (value === '') {
                          setPoints(1);
                        } else {
                          const num = parseInt(value);
                          if (!isNaN(num) && num >= 1 && num <= 50) {
                            setPoints(num);
                          }
                        }
                      }}
                      placeholder="1"
                      disabled={isSubmitting}
                      style={{ textAlign: 'center', flex: 1 }}
                    />
                    <IonButton
                      fill="outline"
                      size="small"
                      disabled={isSubmitting || points >= 50}
                      onClick={() => setPoints(Math.min(50, points + 1))}
                      style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                    >
                      <IonIcon icon={addOutline} />
                    </IonButton>
                  </div>
                </IonItem>
              </IonList>

              <div style={{ marginTop: '16px', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666' }}>Typ *</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  className="app-list-item"
                  onClick={() => !isSubmitting && setType('gemeinde')}
                  style={{
                    cursor: isSubmitting ? 'default' : 'pointer',
                    opacity: isSubmitting ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0',
                    borderLeftColor: '#059669',
                    backgroundColor: type === 'gemeinde' ? 'rgba(5, 150, 105, 0.1)' : undefined
                  }}
                >
                  <span style={{ fontWeight: '500', color: '#333' }}>Gemeinde</span>
                </div>
                <div
                  className="app-list-item"
                  onClick={() => !isSubmitting && setType('gottesdienst')}
                  style={{
                    cursor: isSubmitting ? 'default' : 'pointer',
                    opacity: isSubmitting ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0',
                    borderLeftColor: '#3b82f6',
                    backgroundColor: type === 'gottesdienst' ? 'rgba(59, 130, 246, 0.1)' : undefined
                  }}
                >
                  <span style={{ fontWeight: '500', color: '#333' }}>Gottesdienst</span>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Begründung (optional) */}
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--purple">
              <IonIcon icon={chatbubbleOutline} />
            </div>
            <IonLabel>Begründung (optional)</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Begründung</IonLabel>
                  <IonTextarea
                    value={reason}
                    onIonInput={(e) => setReason(e.detail.value!)}
                    placeholder="Warum werden diese Bonuspunkte vergeben?"
                    rows={3}
                    disabled={isSubmitting}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default BonusModal;
