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
  IonSelect,
  IonSelectOption,
  IonCard,
  IonCardContent,
  IonSpinner
} from '@ionic/react';
import { closeOutline, checkmarkOutline, gift, calendar } from 'ionicons/icons';
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
    { value: 'gemeinde', label: 'Gemeinde-Bonuspunkte' },
    { value: 'gottesdienst', label: 'Gottesdienst-Bonuspunkte' }
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
        {/* SEKTION: Bonuspunkte Details */}
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
            Bonuspunkte Details
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

              <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0' }}>
                <IonLabel position="stacked">Punkte *</IonLabel>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '8px',
                  width: '100%'
                }}>
                  <IonButton
                    fill="solid"
                    size="small"
                    onClick={() => setPoints(Math.max(1, points - 1))}
                    style={{
                      width: '40px',
                      height: '40px',
                      '--padding-start': '0',
                      '--padding-end': '0'
                    }}
                  >
                    −
                  </IonButton>
                  <div style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: '1.5rem',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    {points}
                  </div>
                  <IonButton
                    fill="solid"
                    size="small"
                    onClick={() => setPoints(Math.min(20, points + 1))}
                    style={{
                      width: '40px',
                      height: '40px',
                      '--padding-start': '0',
                      '--padding-end': '0'
                    }}
                  >
                    +
                  </IonButton>
                </div>
              </IonItem>

              <IonItem lines="none" style={{ '--padding-start': '0', '--inner-padding-end': '0', marginTop: '16px' }}>
                <IonLabel position="stacked">Kategorie</IonLabel>
                <div style={{ width: '100%', marginTop: '12px' }}>
                  {bonusTypes.map(bonusType => (
                    <div
                      key={bonusType.value}
                      onClick={() => setType(bonusType.value)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        marginBottom: '8px',
                        borderRadius: '8px',
                        background: type === bonusType.value ? 'rgba(255, 152, 0, 0.1)' : '#f8f9fa',
                        border: `2px solid ${type === bonusType.value ? '#ff9800' : '#e0e0e0'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        border: `2px solid ${type === bonusType.value ? '#ff9800' : '#999'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {type === bonusType.value && (
                          <div style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: '#ff9800'
                          }} />
                        )}
                      </div>
                      <span style={{
                        fontSize: '0.95rem',
                        color: '#333',
                        fontWeight: type === bonusType.value ? '600' : '400'
                      }}>
                        {bonusType.label}
                      </span>
                    </div>
                  ))}
                </div>
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

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
            backgroundColor: '#007aff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0, 122, 255, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
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
      </IonContent>
    </IonPage>
  );
};

export default BonusModal;