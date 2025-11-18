import React, { useState, useEffect } from 'react';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonIcon,
  IonPage,
  IonSpinner,
  IonCard,
  IonCardContent,
  IonList
} from '@ionic/react';
import { checkmarkOutline, closeOutline, create } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface Level {
  id?: number;
  name: string;
  title: string;
  description?: string;
  points_required: number;
  icon?: string;
  color?: string;
  reward_type?: string;
  reward_value?: number;
  is_active?: boolean;
}

interface LevelManagementModalProps {
  level?: Level;
  onClose: () => void;
  onSuccess: () => void;
}

const LevelManagementModal: React.FC<LevelManagementModalProps> = ({ level, onClose, onSuccess }) => {
  const { setSuccess, setError } = useApp();
  const [formData, setFormData] = useState<Level>({
    name: '',
    title: '',
    description: '',
    points_required: 0,
    icon: '🏆',
    color: '#3880ff',
    is_active: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (level) {
      setFormData(level);
    }
  }, [level]);

  const isFormValid = formData.name.trim().length > 0 &&
                      formData.title.trim().length > 0 &&
                      formData.points_required >= 0;

  const handleSubmit = async () => {
    if (!isFormValid) return;

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        title: formData.title.trim(),
        description: formData.description?.trim() || '',
        points_required: formData.points_required,
        icon: formData.icon || '🏆',
        color: formData.color || '#3880ff',
        reward_type: formData.reward_type || null,
        reward_value: formData.reward_value || null,
        is_active: formData.is_active !== false
      };

      if (level?.id) {
        await api.put(`/levels/${level.id}`, payload);
        setSuccess('Level aktualisiert');
      } else {
        await api.post('/levels', payload);
        setSuccess('Level erstellt');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{level ? 'Level bearbeiten' : 'Neues Level'}</IonTitle>
          <IonButtons slot="start">
            <IonButton
              onClick={onClose}
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
              onClick={handleSubmit}
              disabled={!isFormValid || loading}
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
        {/* SEKTION: Grunddaten */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 16px 12px 16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#3880ff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(56, 128, 255, 0.3)',
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
            Grunddaten
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
              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
                <IonLabel position="stacked">Interner Name *</IonLabel>
                <IonInput
                  value={formData.name}
                  onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
                  placeholder="z.B. level_1, beginner"
                  disabled={loading}
                  clearInput={true}
                />
              </IonItem>

              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
                <IonLabel position="stacked">Anzeige-Titel *</IonLabel>
                <IonInput
                  value={formData.title}
                  onIonInput={(e) => setFormData({ ...formData, title: e.detail.value! })}
                  placeholder="z.B. Anfänger, Bronze, Meister"
                  disabled={loading}
                  clearInput={true}
                />
              </IonItem>

              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
                <IonLabel position="stacked">Benötigte Punkte *</IonLabel>
                <IonInput
                  type="number"
                  value={formData.points_required}
                  onIonInput={(e) => setFormData({ ...formData, points_required: parseInt(e.detail.value!) || 0 })}
                  placeholder="0"
                  disabled={loading}
                  min={0}
                />
              </IonItem>

              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
                <IonLabel position="stacked">Beschreibung</IonLabel>
                <IonTextarea
                  value={formData.description}
                  onIonInput={(e) => setFormData({ ...formData, description: e.detail.value! })}
                  placeholder="Optionale Beschreibung..."
                  rows={3}
                  disabled={loading}
                />
              </IonItem>

              <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '12px' }}>
                <IonLabel position="stacked">Icon (Emoji)</IonLabel>
                <IonInput
                  value={formData.icon}
                  onIonInput={(e) => setFormData({ ...formData, icon: e.detail.value! })}
                  placeholder="🏆"
                  disabled={loading}
                  clearInput={true}
                />
              </IonItem>

              <IonItem lines="none" style={{ '--background': 'transparent' }}>
                <IonLabel position="stacked">Farbe (Hex)</IonLabel>
                <IonInput
                  value={formData.color}
                  onIonInput={(e) => setFormData({ ...formData, color: e.detail.value! })}
                  placeholder="#3880ff"
                  disabled={loading}
                  clearInput={true}
                />
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default LevelManagementModal;
