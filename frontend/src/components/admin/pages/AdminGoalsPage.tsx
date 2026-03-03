import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonListHeader,
  IonCard,
  IonCardContent,
  IonLabel,
  IonButton,
  IonButtons,
  IonIcon,
  IonSpinner,
  IonItem,
  IonInput
} from '@ionic/react';
import {
  closeOutline,
  checkmarkOutline,
  home,
  people,
  addOutline,
  removeOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface AdminGoalsModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  dismiss?: () => void;
}

const AdminGoalsPage: React.FC<AdminGoalsModalProps> = ({ onClose, onSuccess, dismiss }) => {
  const { setSuccess, setError } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    target_gottesdienst: 10,
    target_gemeinde: 10
  });

  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/settings');
      setFormData({
        target_gottesdienst: response.data.target_gottesdienst || 10,
        target_gemeinde: response.data.target_gemeinde || 10
      });
    } catch (error: unknown) {
      setError('Fehler beim Laden der Einstellungen');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/settings', formData);
      setSuccess('Punkte-Ziele gespeichert');
      handleClose();
    } catch (error: unknown) {
      setError((error as any)?.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={handleClose} disabled={saving}>
              <IonIcon icon={closeOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>Punkte-Ziele</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={saving || loading}>
              {saving ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} slot="icon-only" />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <>
            {/* Gottesdienst-Ziel */}
            <IonList inset={true} className="app-segment-wrapper">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--activities">
                  <IonIcon icon={home} />
                </div>
                <IonLabel>Gottesdienst-Punkte</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent style={{ padding: '16px' }}>
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                      <IonButton
                        fill="outline"
                        size="small"
                        disabled={saving || formData.target_gottesdienst <= 0}
                        onClick={() => setFormData({ ...formData, target_gottesdienst: Math.max(0, formData.target_gottesdienst - 1) })}
                        style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                      >
                        <IonIcon icon={removeOutline} />
                      </IonButton>
                      <IonInput
                        type="text"
                        inputMode="numeric"
                        value={formData.target_gottesdienst.toString()}
                        onIonInput={(e) => {
                          const val = parseInt(e.detail.value || '0', 10);
                          if (!isNaN(val) && val >= 0) {
                            setFormData({ ...formData, target_gottesdienst: val });
                          }
                        }}
                        disabled={saving}
                        style={{ textAlign: 'center', flex: 1, fontSize: '1.5rem', fontWeight: '700' }}
                      />
                      <IonButton
                        fill="outline"
                        size="small"
                        disabled={saving}
                        onClick={() => setFormData({ ...formData, target_gottesdienst: formData.target_gottesdienst + 1 })}
                        style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                      >
                        <IonIcon icon={addOutline} />
                      </IonButton>
                    </div>
                  </IonItem>
                  <p className="app-settings-item__subtitle" style={{ textAlign: 'center', margin: '8px 0 0 0' }}>
                    Ziel-Punkte für Gottesdienste
                  </p>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* Gemeinde-Ziel */}
            <IonList inset={true} className="app-segment-wrapper">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--activities">
                  <IonIcon icon={people} />
                </div>
                <IonLabel>Gemeinde-Punkte</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent style={{ padding: '16px' }}>
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                      <IonButton
                        fill="outline"
                        size="small"
                        disabled={saving || formData.target_gemeinde <= 0}
                        onClick={() => setFormData({ ...formData, target_gemeinde: Math.max(0, formData.target_gemeinde - 1) })}
                        style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                      >
                        <IonIcon icon={removeOutline} />
                      </IonButton>
                      <IonInput
                        type="text"
                        inputMode="numeric"
                        value={formData.target_gemeinde.toString()}
                        onIonInput={(e) => {
                          const val = parseInt(e.detail.value || '0', 10);
                          if (!isNaN(val) && val >= 0) {
                            setFormData({ ...formData, target_gemeinde: val });
                          }
                        }}
                        disabled={saving}
                        style={{ textAlign: 'center', flex: 1, fontSize: '1.5rem', fontWeight: '700' }}
                      />
                      <IonButton
                        fill="outline"
                        size="small"
                        disabled={saving}
                        onClick={() => setFormData({ ...formData, target_gemeinde: formData.target_gemeinde + 1 })}
                        style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                      >
                        <IonIcon icon={addOutline} />
                      </IonButton>
                    </div>
                  </IonItem>
                  <p className="app-settings-item__subtitle" style={{ textAlign: 'center', margin: '8px 0 0 0' }}>
                    Ziel-Punkte für Gemeindeaktivitäten
                  </p>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* Info */}
            <IonList inset={true} className="app-segment-wrapper">
              <IonCard className="app-card app-info-box--neutral">
                <IonCardContent className="app-info-box">
                  <p style={{ margin: 0 }}>
                    Diese Ziele werden in den Activity Rings der Konfi-Details angezeigt.
                    Bei Erreichen des Ziels füllt sich der Ring zu 100%.
                  </p>
                </IonCardContent>
              </IonCard>
            </IonList>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminGoalsPage;
