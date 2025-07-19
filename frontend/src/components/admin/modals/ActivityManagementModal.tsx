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
  categories?: Category[];
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
    category_ids: [] as number[]
  });


  // Load activity by ID from all activities
  const loadActivity = async (id: number) => {
    try {
      const response = await api.get('/activities');
      const activities = response.data;
      const activityData = activities.find((act: Activity) => act.id === id);
      
      if (activityData) {
        setCurrentActivity(activityData);
        setFormData({
          name: activityData.name,
          points: activityData.points,
          type: activityData.type,
          category_ids: activityData.categories?.map((cat: Category) => cat.id) || []
        });
      } else {
        setError('Aktivität nicht gefunden');
      }
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
        category_ids: activity.categories?.map((cat: Category) => cat.id) || []
      });
    } else {
      // Reset form for new activity
      setCurrentActivity(null);
      setFormData({
        name: '',
        points: 1,
        type: 'gottesdienst',
        category_ids: []
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
        category_ids: formData.category_ids
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
            <IonInput
              type="number"
              value={formData.points}
              onIonInput={(e) => setFormData({ ...formData, points: parseInt(e.detail.value!) || 1 })}
              placeholder="Punkte eingeben"
              disabled={loading}
              min={1}
              max={50}
              clearInput={true}
            />
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
            <IonLabel position="stacked">Kategorien (mehrere möglich)</IonLabel>
            <IonSelect
              value={formData.category_ids}
              onIonChange={(e) => setFormData({ ...formData, category_ids: e.detail.value })}
              placeholder="Kategorien wählen"
              disabled={loading}
              multiple={true}
              interface="alert"
              interfaceOptions={{
                header: 'Kategorien auswählen'
              }}
            >
              {categories.map((category) => (
                <IonSelectOption key={category.id} value={category.id}>
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