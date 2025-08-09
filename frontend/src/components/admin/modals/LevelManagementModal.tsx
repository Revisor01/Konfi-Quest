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
  IonSelect,
  IonSelectOption,
  IonIcon
} from '@ionic/react';
import { close, checkmark, star, sparkles, trophy, ribbon, medal, diamond } from 'ionicons/icons';
import axios from 'axios';

interface Level {
  id?: number;
  level_number: number;
  name: string;
  required_points: number;
  description?: string;
  color?: string;
  icon?: string;
}

interface LevelManagementModalProps {
  level?: Level;
  onClose: () => void;
  onSuccess: () => void;
}

const LevelManagementModal: React.FC<LevelManagementModalProps> = ({ level, onClose, onSuccess }) => {
  const [formData, setFormData] = useState<Level>({
    level_number: 1,
    name: '',
    required_points: 0,
    description: '',
    color: 'primary',
    icon: 'star'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (level) {
      setFormData(level);
    }
  }, [level]);

  const handleSubmit = async () => {
    if (!formData.name || !formData.required_points) {
      alert('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (level?.id) {
        await axios.put(`/api/levels/${level.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post('/api/levels', formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      onSuccess();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  const availableColors = [
    { value: 'primary', label: 'Primär' },
    { value: 'secondary', label: 'Sekundär' },
    { value: 'tertiary', label: 'Tertiär' },
    { value: 'success', label: 'Erfolg' },
    { value: 'warning', label: 'Warnung' },
    { value: 'danger', label: 'Gefahr' }
  ];

  const availableIcons = [
    { value: 'star', label: 'Stern', icon: star },
    { value: 'sparkles', label: 'Funkeln', icon: sparkles },
    { value: 'trophy', label: 'Trophäe', icon: trophy },
    { value: 'ribbon', label: 'Band', icon: ribbon },
    { value: 'medal', label: 'Medaille', icon: medal },
    { value: 'diamond', label: 'Diamant', icon: diamond }
  ];

  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{level ? 'Level bearbeiten' : 'Neues Level'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonItem>
          <IonLabel position="stacked">Level-Nummer *</IonLabel>
          <IonInput
            type="number"
            value={formData.level_number}
            onIonInput={(e) => setFormData({...formData, level_number: parseInt(e.detail.value!) || 1})}
            min={1}
            required
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Name *</IonLabel>
          <IonInput
            value={formData.name}
            onIonInput={(e) => setFormData({...formData, name: e.detail.value!})}
            placeholder="z.B. Anfänger, Fortgeschritten"
            required
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Benötigte Punkte *</IonLabel>
          <IonInput
            type="number"
            value={formData.required_points}
            onIonInput={(e) => setFormData({...formData, required_points: parseInt(e.detail.value!) || 0})}
            min={0}
            required
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Beschreibung</IonLabel>
          <IonTextarea
            value={formData.description}
            onIonInput={(e) => setFormData({...formData, description: e.detail.value!})}
            placeholder="Optionale Beschreibung des Levels"
            rows={3}
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Farbe</IonLabel>
          <IonSelect
            value={formData.color}
            onIonChange={(e) => setFormData({...formData, color: e.detail.value})}
          >
            {availableColors.map(color => (
              <IonSelectOption key={color.value} value={color.value}>
                {color.label}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Icon</IonLabel>
          <IonSelect
            value={formData.icon}
            onIonChange={(e) => setFormData({...formData, icon: e.detail.value})}
          >
            {availableIcons.map(icon => (
              <IonSelectOption key={icon.value} value={icon.value}>
                {icon.label}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>

        <div style={{ marginTop: '20px' }}>
          <IonButton expand="block" onClick={handleSubmit} disabled={loading}>
            <IonIcon icon={checkmark} slot="start" />
            {level ? 'Speichern' : 'Erstellen'}
          </IonButton>
        </div>
      </IonContent>
    </>
  );
};

export default LevelManagementModal;