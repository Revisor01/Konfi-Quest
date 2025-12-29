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
  IonList,
  IonListHeader,
  IonIcon,
  IonTextarea,
  IonCard,
  IonCardContent,
  IonCheckbox
} from '@ionic/react';
import { closeOutline, checkmarkOutline, gift, calendar, removeOutline, addOutline } from 'ionicons/icons';
import api from '../../../services/api';

interface BonusModalProps {
  konfiId: number;
  onClose: () => void;
  onSave: () => Promise<void>;
  dismiss?: () => void;
}

const BonusModal: React.FC<BonusModalProps> = ({ konfiId, onClose, onSave, dismiss }) => {
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
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || points <= 0) return;

    setLoading(true);
    try {
      await api.post(`/admin/konfis/${konfiId}/bonus-points`, {
        points: points,
        type: type,
        description: `${name.trim()}${reason.trim() ? ': ' + reason.trim() : ''}`,
        completed_date: selectedDate
      });
      await onSave();
      handleClose();
    } catch (err) {
      console.error('Error saving bonus points:', err);
    } finally {
      setLoading(false);
    }
  };

  const isValid = name.trim().length > 0 && points > 0;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Bonuspunkte hinzufügen</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={handleClose} disabled={loading}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={!isValid || loading}>
              <IonIcon icon={checkmarkOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Bonuspunkt Detail */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--bonus">
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
                    disabled={loading}
                  />
                </IonItem>

                <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
                  <IonLabel position="stacked" style={{ marginBottom: '8px' }}>Punkte *</IonLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                    <IonButton
                      fill="outline"
                      size="small"
                      disabled={loading || points <= 1}
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
                      disabled={loading}
                      style={{ textAlign: 'center', flex: 1 }}
                    />
                    <IonButton
                      fill="outline"
                      size="small"
                      disabled={loading || points >= 50}
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
                  onClick={() => !loading && setType('gemeinde')}
                  style={{
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0',
                    borderLeftColor: '#f97316',
                    backgroundColor: type === 'gemeinde' ? 'rgba(249, 115, 22, 0.1)' : undefined
                  }}
                >
                  <span style={{ fontWeight: '500', color: '#333' }}>Gemeinde</span>
                  <IonCheckbox
                    checked={type === 'gemeinde'}
                    disabled={loading}
                    style={{
                      '--checkbox-background-checked': '#f97316',
                      '--border-color-checked': '#f97316',
                      '--checkmark-color': 'white'
                    }}
                  />
                </div>
                <div
                  className="app-list-item"
                  onClick={() => !loading && setType('gottesdienst')}
                  style={{
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0',
                    borderLeftColor: '#f97316',
                    backgroundColor: type === 'gottesdienst' ? 'rgba(249, 115, 22, 0.1)' : undefined
                  }}
                >
                  <span style={{ fontWeight: '500', color: '#333' }}>Gottesdienst</span>
                  <IonCheckbox
                    checked={type === 'gottesdienst'}
                    disabled={loading}
                    style={{
                      '--checkbox-background-checked': '#f97316',
                      '--border-color-checked': '#f97316',
                      '--checkmark-color': 'white'
                    }}
                  />
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Datum & Begründung */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--bonus">
              <IonIcon icon={calendar} />
            </div>
            <IonLabel>Datum & Begründung</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <IonList style={{ background: 'transparent' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Datum *</IonLabel>
                  <IonInput
                    type="date"
                    value={selectedDate}
                    onIonInput={(e) => setSelectedDate(e.detail.value!)}
                    disabled={loading}
                  />
                </IonItem>

                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Begründung (optional)</IonLabel>
                  <IonTextarea
                    value={reason}
                    onIonInput={(e) => setReason(e.detail.value!)}
                    placeholder="Warum werden diese Bonuspunkte vergeben?"
                    rows={3}
                    disabled={loading}
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
