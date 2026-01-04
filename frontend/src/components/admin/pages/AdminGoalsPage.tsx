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
  IonSpinner
} from '@ionic/react';
import {
  arrowBack,
  statsChart,
  checkmarkOutline,
  sunnyOutline,
  peopleOutline,
  addOutline,
  removeOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';

const AdminGoalsPage: React.FC = () => {
  const { pageRef } = useModalPage('admin-goals');
  const { setSuccess, setError } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    target_gottesdienst: 10,
    target_gemeinde: 10
  });

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
    } catch (error: any) {
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
    } catch (error: any) {
      setError(error.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => window.history.back()}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Punkte-Ziele</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleSave} disabled={saving || loading} color="success">
              {saving ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Punkte-Ziele</IonTitle>
          </IonToolbar>
        </IonHeader>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <>
            {/* Gottesdienst-Ziel */}
            <IonList inset={true} style={{ margin: '16px' }}>
              <IonListHeader>
                <div className="app-section-icon" style={{ backgroundColor: '#3b82f6' }}>
                  <IonIcon icon={sunnyOutline} />
                </div>
                <IonLabel>Gottesdienst-Punkte</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    padding: '8px 0'
                  }}>
                    <IonButton
                      fill="clear"
                      onClick={() => setFormData({ ...formData, target_gottesdienst: Math.max(0, formData.target_gottesdienst - 1) })}
                      style={{
                        '--color': '#3b82f6',
                        width: '48px',
                        height: '48px'
                      }}
                    >
                      <IonIcon icon={removeOutline} style={{ fontSize: '1.5rem' }} />
                    </IonButton>
                    <div style={{
                      fontSize: '2.5rem',
                      fontWeight: '700',
                      color: '#3b82f6',
                      minWidth: '80px',
                      textAlign: 'center'
                    }}>
                      {formData.target_gottesdienst}
                    </div>
                    <IonButton
                      fill="clear"
                      onClick={() => setFormData({ ...formData, target_gottesdienst: formData.target_gottesdienst + 1 })}
                      style={{
                        '--color': '#3b82f6',
                        width: '48px',
                        height: '48px'
                      }}
                    >
                      <IonIcon icon={addOutline} style={{ fontSize: '1.5rem' }} />
                    </IonButton>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#8e8e93', margin: '8px 0 0 0', textAlign: 'center' }}>
                    Ziel-Punkte für Gottesdienste
                  </p>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* Gemeinde-Ziel */}
            <IonList inset={true} style={{ margin: '16px' }}>
              <IonListHeader>
                <div className="app-section-icon" style={{ backgroundColor: '#059669' }}>
                  <IonIcon icon={peopleOutline} />
                </div>
                <IonLabel>Gemeinde-Punkte</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    padding: '8px 0'
                  }}>
                    <IonButton
                      fill="clear"
                      onClick={() => setFormData({ ...formData, target_gemeinde: Math.max(0, formData.target_gemeinde - 1) })}
                      style={{
                        '--color': '#059669',
                        width: '48px',
                        height: '48px'
                      }}
                    >
                      <IonIcon icon={removeOutline} style={{ fontSize: '1.5rem' }} />
                    </IonButton>
                    <div style={{
                      fontSize: '2.5rem',
                      fontWeight: '700',
                      color: '#059669',
                      minWidth: '80px',
                      textAlign: 'center'
                    }}>
                      {formData.target_gemeinde}
                    </div>
                    <IonButton
                      fill="clear"
                      onClick={() => setFormData({ ...formData, target_gemeinde: formData.target_gemeinde + 1 })}
                      style={{
                        '--color': '#059669',
                        width: '48px',
                        height: '48px'
                      }}
                    >
                      <IonIcon icon={addOutline} style={{ fontSize: '1.5rem' }} />
                    </IonButton>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#8e8e93', margin: '8px 0 0 0', textAlign: 'center' }}>
                    Ziel-Punkte für Gemeindeaktivitäten
                  </p>
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* Info */}
            <IonList inset={true} style={{ margin: '16px' }}>
              <IonCard className="app-card" style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <IonCardContent style={{ padding: '16px' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#3b82f6', lineHeight: '1.5' }}>
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
