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
  IonCheckbox,
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
  const [initializing, setInitializing] = useState(true);
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
      console.log('🔄 Loading activity with ID:', id);
      const response = await api.get('/admin/activities');
      const activities = response.data;
      const activityData = activities.find((act: Activity) => act.id === id);
      
      if (activityData) {
        console.log('📦 Activity data found:', activityData);
        console.log('🏷️ Activity categories:', activityData.categories);
        setCurrentActivity(activityData);
        const categoryIds = activityData.categories?.map((cat: Category) => cat.id) || [];
        console.log('🔢 Category IDs to set:', categoryIds);
        setFormData({
          name: activityData.name,
          points: activityData.points,
          type: activityData.type,
          category_ids: categoryIds
        });
      } else {
        console.error('❌ Activity not found with ID:', id);
        setError('Aktivität nicht gefunden');
      }
    } catch (error) {
      console.error('❌ Error loading activity:', error);
      setError('Fehler beim Laden der Aktivität');
    }
  };

  useEffect(() => {
    const initializeModal = async () => {
      setInitializing(true);
      console.log('🔄 Starting modal initialization...');
      
      try {
        // First load categories
        await loadCategories();
        
        // Then load activity if activityId is provided
        if (activityId) {
          await loadActivity(activityId);
        } else if (activity) {
          console.log('📋 Using provided activity:', activity);
          setCurrentActivity(activity);
          setFormData({
            name: activity.name,
            points: activity.points,
            type: activity.type,
            category_ids: activity.categories?.map((cat: Category) => cat.id) || []
          });
        } else {
          // Reset form for new activity
          console.log('🆕 Initializing for new activity');
          setCurrentActivity(null);
          setFormData({
            name: '',
            points: 1,
            type: 'gottesdienst',
            category_ids: []
          });
        }
      } catch (error) {
        console.error('❌ Error during initialization:', error);
        setError('Fehler beim Initialisieren des Modals');
      } finally {
        setInitializing(false);
        console.log('✅ Modal initialization completed');
      }
    };
    
    initializeModal();
  }, [activityId, activity]);

  const loadCategories = async () => {
    try {
      console.log('🔄 Loading categories...');
      const response = await api.get('/admin/categories');
      console.log('📦 Categories received:', response.data);
      
      // Don't filter - show ALL categories for activities
      // Categories with type=null should also be available for activities
      const allCategories = response.data;
      console.log('✅ Using ALL categories (no filtering):', allCategories);
      setCategories(allCategories);
      return allCategories;
    } catch (error) {
      console.error('❌ Error loading categories:', error);
      throw error;
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
        await api.put(`/admin/activities/${currentActivity.id}`, payload);
        setSuccess('Aktivität aktualisiert');
      } else {
        await api.post('/admin/activities', payload);
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
              onIonChange={(e: any) => setFormData({ ...formData, type: e.detail.value })}
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

          {initializing ? (
            <IonItem>
              <IonLabel color="medium">
                <p>Kategorien werden geladen...</p>
              </IonLabel>
            </IonItem>
          ) : categories.length > 0 ? (
            <>
              <IonItem lines="none" style={{ paddingBottom: '8px' }}>
                <IonLabel style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666' }}>
                  Kategorien (mehrere möglich) - {categories.length} verfügbar
                </IonLabel>
              </IonItem>
              <IonList style={{ padding: '0 16px', marginTop: '0' }}>
              {categories.map((category) => {
                const isChecked = formData.category_ids.includes(category.id);
                console.log(`🔘 Category "${category.name}" (ID: ${category.id}) - Checked: ${isChecked}`);
                return (
                  <IonItem key={category.id} lines="none">
                    <IonCheckbox
                      slot="start"
                      checked={isChecked}
                      onIonChange={(e) => {
                        const newChecked = e.detail.checked;
                        console.log(`🔄 Category "${category.name}" changed to: ${newChecked}`);
                        setFormData(prev => {
                          const newCategoryIds = newChecked 
                            ? [...prev.category_ids, category.id]
                            : prev.category_ids.filter(id => id !== category.id);
                          console.log('📝 New category_ids:', newCategoryIds);
                          return {
                            ...prev,
                            category_ids: newCategoryIds
                          };
                        });
                      }}
                      disabled={loading || initializing}
                    />
                    <IonLabel style={{ marginLeft: '12px' }}>
                      {category.name}
                    </IonLabel>
                  </IonItem>
                );
              })}
              </IonList>
            </>
          ) : (
            <IonItem>
              <IonLabel color="medium">
                <p>Keine Kategorien verfügbar</p>
              </IonLabel>
            </IonItem>
          )}
          
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ActivityManagementModal;