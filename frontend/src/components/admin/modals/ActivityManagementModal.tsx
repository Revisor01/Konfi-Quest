import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonIcon,
  IonSpinner,
  IonList
} from '@ionic/react';
import { checkmark, close } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';

interface Activity {
  id: number;
  name: string;
  points: number;
  type: 'gottesdienst' | 'gemeinde';
  category?: string;
}

interface Category {
  id: number;
  name: string;
  description?: string;
  type: 'activity' | 'event' | 'both';
}

interface ActivityManagementModalProps {
  activity?: Activity | null;
  activityId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void;
}

const ActivityManagementModal: React.FC<ActivityManagementModalProps> = ({
  activity,
  activityId,
  onClose,
  onSuccess,
  dismiss
}) => {
  const { setSuccess, setError } = useApp();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(activity || null);

  const handleClose = () => {
    if (dismiss) {
      dismiss();
    } else {
      onClose();
    }
  };
  
  const [formData, setFormData] = useState({
    name: '',
    points: 1,
    type: 'gottesdienst' as 'gottesdienst' | 'gemeinde',
    category: ''
  });


  // Load activity by ID
  const loadActivity = async (id: number) => {
    try {
      const response = await api.get(`/activities/${id}`);
      const activityData = response.data;
      setCurrentActivity(activityData);
      setFormData({
        name: activityData.name,
        points: activityData.points,
        type: activityData.type,
        category: activityData.category || ''
      });
    } catch (error) {
      console.error('Error loading activity:', error);
      setError('Fehler beim Laden der Aktivität');
    }
  };

  useEffect(() => {
    loadCategories();
    
    // Load activity if activityId is provided
    if (activityId) {
      loadActivity(activityId);
    } else if (activity) {
      setCurrentActivity(activity);
      setFormData({
        name: activity.name,
        points: activity.points,
        type: activity.type,
        category: activity.category || ''
      });
    } else {
      // Reset form for new activity
      setCurrentActivity(null);
      setFormData({
        name: '',
        points: 1,
        type: 'gottesdienst',
        category: ''
      });
    }
  }, [activityId, activity]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      const filteredCategories = response.data.filter(
        (cat: Category) => cat.type === 'activity' || cat.type === 'both'
      );
      setCategories(filteredCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };


  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        points: formData.points,
        type: formData.type,
        category: formData.category.trim() || null
      };

      if (currentActivity) {
        await api.put(`/activities/${currentActivity.id}`, payload);
        setSuccess('Aktivität aktualisiert');
      } else {
        await api.post('/activities', payload);
        setSuccess('Aktivität erstellt');
      }
      
      onSuccess();
    } catch (error: any) {
      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Fehler beim Speichern der Aktivität');
      }
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formData.name.trim().length > 0;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            {currentActivity ? 'Aktivität bearbeiten' : 'Neue Aktivität'}
          </IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={handleClose} disabled={loading}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton 
              onClick={handleSubmit} 
              disabled={!isFormValid || loading}
              color="primary"
            >
              {loading ? (
                <IonSpinner name="crescent" />
              ) : (
                <IonIcon icon={checkmark} />
              )}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonList style={{ padding: '0' }}>
          <IonItem>
            <IonLabel position="stacked">Name *</IonLabel>
            <IonInput
              value={formData.name}
              onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
              placeholder="z.B. Sonntagsgottesdienst"
              disabled={loading}
              clearInput={true}
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Punkte *</IonLabel>
            <IonSelect
              value={formData.points}
              onIonChange={(e) => setFormData({ ...formData, points: e.detail.value })}
              placeholder="Punkte wählen"
              disabled={loading}
              interface="action-sheet"
              interfaceOptions={{
                header: 'Punkte auswählen'
              }}
            >
              <IonSelectOption value={1}>1 Punkt</IonSelectOption>
              <IonSelectOption value={2}>2 Punkte</IonSelectOption>
              <IonSelectOption value={3}>3 Punkte</IonSelectOption>
              <IonSelectOption value={4}>4 Punkte</IonSelectOption>
              <IonSelectOption value={5}>5 Punkte</IonSelectOption>
              <IonSelectOption value={10}>10 Punkte</IonSelectOption>
            </IonSelect>
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Typ *</IonLabel>
            <IonSelect
              value={formData.type}
              onIonChange={(e) => setFormData({ ...formData, type: e.detail.value })}
              placeholder="Typ wählen"
              disabled={loading}
              interface="action-sheet"
              interfaceOptions={{
                header: 'Typ auswählen'
              }}
            >
              <IonSelectOption value="gottesdienst">Gottesdienst</IonSelectOption>
              <IonSelectOption value="gemeinde">Gemeinde</IonSelectOption>
            </IonSelect>
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Kategorie</IonLabel>
            <IonSelect
              value={formData.category}
              onIonChange={(e) => setFormData({ ...formData, category: e.detail.value })}
              placeholder="Kategorie wählen"
              disabled={loading}
              interface="action-sheet"
              interfaceOptions={{
                header: 'Kategorie auswählen'
              }}
            >
              <IonSelectOption value="">Keine Kategorie</IonSelectOption>
              {categories.map((category) => (
                <IonSelectOption key={category.id} value={category.name}>
                  {category.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ActivityManagementModal;