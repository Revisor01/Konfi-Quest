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
  IonIcon,
  IonTextarea,
  IonCard,
  IonCardContent,
  IonSpinner,
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

  const handleSave = async () => {
    if (!name.trim() || points <= 0) return;

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
    }
  };

  const isValid = name.trim().length > 0 && points > 0;

  const bonusTypes = [
    { value: 'gemeinde', label: 'Gemeinde' },
    { value: 'gottesdienst', label: 'Gottesdienst' }
  ];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Bonuspunkte hinzufügen</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={handleClose} style={{
              '--background': '#f8f9fa',
              '--background-hover': '#e9ecef',
              '--color': '#6c757d',
              '--border-radius': '8px'
            }}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton
              onClick={handleSave}
              disabled={!isValid}
            >
              <IonIcon icon={checkmarkOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      
      <IonContent style={{ '--padding-top': '16px' }}>
        {/* SEKTION: Datum & Begründung */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#ff9800',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(255, 152, 0, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={calendar} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Datum & Begründung
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
              <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                <IonLabel position="stacked">Datum *</IonLabel>
                <IonInput
                  type="date"
                  value={selectedDate}
                  onIonInput={(e) => setSelectedDate(e.detail.value!)}
                />
              </IonItem>

              <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                <IonLabel position="stacked">Begründung</IonLabel>
                <IonTextarea
                  value={reason}
                  onIonInput={(e) => setReason(e.detail.value!)}
                  placeholder="Warum werden diese Bonuspunkte vergeben?"
                  rows={4}
                />
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

        {/* SEKTION: Bonuspunkt Detail */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#ff9800',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(255, 152, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
            flexShrink: 0
          }}>
            <IonIcon icon={gift} style={{ fontSize: '1rem', color: 'white' }} />
          </div>
          <h2 style={{
            fontWeight: '600',
            fontSize: '1.1rem',
            margin: '0',
            color: '#333'
          }}>
            Bonuspunkt Detail
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
              <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                <IonLabel position="stacked">Bezeichnung *</IonLabel>
                <IonInput
                  value={name}
                  onIonInput={(e) => setName(e.detail.value!)}
                  placeholder="z.B. Hilfe beim Aufräumen"
                  clearInput={true}
                />
              </IonItem>

              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
                <IonLabel position="stacked" style={{ marginBottom: '8px' }}>Punkte *</IonLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <IonButton
                    fill="outline"
                    size="small"
                    disabled={points <= 1}
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
                    style={{ textAlign: 'center', flex: 1 }}
                  />
                  <IonButton
                    fill="outline"
                    size="small"
                    disabled={points >= 50}
                    onClick={() => setPoints(Math.min(50, points + 1))}
                    style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                  >
                    <IonIcon icon={addOutline} />
                  </IonButton>
                </div>
              </IonItem>

              <IonItem lines="none" style={{ paddingBottom: '8px', paddingTop: '16px' }}>
                <IonLabel style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666' }}>Typ *</IonLabel>
              </IonItem>
              {bonusTypes.map(bonusType => (
                <IonItem
                  key={bonusType.value}
                  lines="none"
                  button
                  detail={false}
                  onClick={() => setType(bonusType.value)}
                  style={{
                    '--min-height': '56px',
                    '--padding-start': '16px',
                    '--background': '#fbfbfb',
                    '--border-radius': '12px',
                    margin: '6px 0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px'
                  }}
                >
                  <IonLabel>{bonusType.label}</IonLabel>
                  <IonCheckbox
                    slot="end"
                    checked={type === bonusType.value}
                  />
                </IonItem>
              ))}
            </IonList>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default BonusModal;