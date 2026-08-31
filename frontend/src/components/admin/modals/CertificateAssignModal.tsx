import { fehlerText } from '../../../utils/fehler';
import React, { useState } from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon, IonList, IonListHeader, IonLabel, IonCard, IonCardContent, IonDatetimeButton, IonDatetime, IonModal, IonSpinner, IonRange } from '@ionic/react';
import { closeOutline, checkmarkOutline, ribbonOutline, calendar } from 'ionicons/icons';
import api from '../../../services/api';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
import { ICON_CHOICES } from '../../../utils/badgeIcons';


interface CertificateAssignModalProps {
  konfiId: number;
  availableTypes: Array<{ id: number; name: string; icon?: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

const CertificateAssignModal: React.FC<CertificateAssignModalProps> = ({
  konfiId,
  availableTypes,
  onClose,
  onSuccess
}) => {
  const { setError } = useApp();
  const { isSubmitting, guard } = useActionGuard();

  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(
    availableTypes.length > 0 ? availableTypes[0].id : null
  );
  const [issuedDate, setIssuedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [durationMonths, setDurationMonths] = useState<string>('');

  const handleSave = async () => {
    if (!selectedTypeId) {
      setError('Bitte wähle einen Zertifikat-Typ aus');
      return;
    }

    await guard(async () => {
      let expiryDate: string | null = null;
      if (durationMonths && parseInt(durationMonths) > 0) {
        const start = new Date(issuedDate);
        start.setMonth(start.getMonth() + parseInt(durationMonths));
        expiryDate = start.toISOString().split('T')[0];
      }

      try {
        await api.post(`/teamer/${konfiId}/certificates`, {
          certificate_type_id: selectedTypeId,
          issued_date: issuedDate,
          expiry_date: expiryDate
        });
        onSuccess();
      } catch (err) {
        setError(fehlerText(err, 'Fehler beim Zuweisen'));
      }
    });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen" onClick={onClose} disabled={isSubmitting}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonTitle>Zertifikat zuweisen</IonTitle>
          <IonButtons slot="end">
            <IonButton aria-label="Zertifikat zuweisen"
              onClick={handleSave}
              disabled={!selectedTypeId || isSubmitting}
            >
              {isSubmitting ? (
                <IonSpinner name="crescent" />
              ) : (
                <IonIcon icon={checkmarkOutline} />
              )}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {/* Sektion 1: Zertifikat-Typ */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--teamer">
              <IonIcon icon={ribbonOutline} />
            </div>
            <IonLabel>Zertifikat-Typ</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {availableTypes.map((ct, index) => {
                  const iconData = ct.icon ? ICON_CHOICES[ct.icon] : null;
                  const isSelected = selectedTypeId === ct.id;
                  return (
                    <div
                      key={ct.id}
                      className="app-list-item"
                      onClick={() => setSelectedTypeId(ct.id)}
                      style={{
                        borderLeftColor: '#db2777',
                        cursor: 'pointer',
                        marginBottom: index < availableTypes.length - 1 ? '8px' : '0',
                        background: isSelected ? 'rgba(219, 39, 119, 0.1)' : undefined
                      }}
                    >
                      <div className="app-list-item__row">
                        <div className="app-list-item__main">
                          <div className="app-icon-circle" style={{ backgroundColor: '#db2777' }}>
                            <IonIcon icon={iconData?.icon || ribbonOutline} />
                          </div>
                          <div className="app-list-item__content">
                            <div className="app-list-item__title">
                              {ct.name}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Sektion 2: Zeitraum */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--teamer">
              <IonIcon icon={calendar} />
            </div>
            <IonLabel>Zeitraum</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '16px' }}>
              <p className="app-text-sub" style={{ marginBottom: '4px' }}>Erhalten</p>
              <IonDatetimeButton datetime="cert-start-date" style={{ justifyContent: 'flex-start' }} />
              <IonModal keepContentsMounted={true}>
                <IonDatetime
                  id="cert-start-date"
                  presentation="date"
                  firstDayOfWeek={1}
                  value={issuedDate}
                  onIonChange={(e) => {
                    const val = e.detail.value;
                    if (typeof val === 'string') {
                      setIssuedDate(val.split('T')[0]);
                    }
                  }}
                  locale="de-DE"
                />
              </IonModal>
              <p className="app-text-sub" style={{ marginTop: '12px', marginBottom: '4px' }}>Laufzeit (Monate): {durationMonths || '0'}</p>
              <div style={{ padding: '0 16px' }}>
                <IonRange
                  min={0}
                  max={36}
                  step={1}
                  value={parseInt(durationMonths) || 0}
                  onIonInput={(e) => setDurationMonths(String(e.detail.value))}
                  style={{ '--bar-background': 'rgba(219, 39, 119, 0.2)', '--bar-background-active': '#db2777', '--knob-background': '#db2777' }}
                />
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default CertificateAssignModal;
