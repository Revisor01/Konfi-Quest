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
  IonIcon,
  IonSpinner,
  IonList,
  IonListHeader,
  IonCard,
  IonCardContent
} from '@ionic/react';
import { checkmarkOutline, closeOutline, create, pricetag, addOutline, removeOutline, checkmarkCircle } from 'ionicons/icons';
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
 console.log('Loading activity with ID:', id);
      const response = await api.get('/admin/activities');
      const activities = response.data;
      const activityData = activities.find((act: Activity) => act.id === id);

      if (activityData) {
 console.log('Activity data found:', activityData);
 console.log('Activity categories:', activityData.categories);
        setCurrentActivity(activityData);
        const categoryIds = activityData.categories?.map((cat: Category) => cat.id) || [];
 console.log('Category IDs to set:', categoryIds);
        setFormData({
          name: activityData.name,
          points: activityData.points,
          type: activityData.type,
          category_ids: categoryIds
        });
      } else {
 console.error('Activity not found with ID:', id);
        setError('Aktivität nicht gefunden');
      }
    } catch (error) {
 console.error('Error loading activity:', error);
      setError('Fehler beim Laden der Aktivität');
    }
  };

  useEffect(() => {
    const initializeModal = async () => {
      setInitializing(true);
 console.log('Starting modal initialization...');

      try {
        // First load categories
        await loadCategories();

        // Then load activity if activityId is provided
        if (activityId) {
          await loadActivity(activityId);
        } else if (activity) {
 console.log('Using provided activity:', activity);
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
 console.error('Error during initialization:', error);
        setError('Fehler beim Initialisieren des Modals');
      } finally {
        setInitializing(false);
 console.log('Modal initialization completed');
      }
    };

    initializeModal();
  }, [activityId, activity]);

  const loadCategories = async () => {
    try {
 console.log('Loading categories...');
      const response = await api.get('/admin/categories');
 console.log('Categories received:', response.data);

      // Don't filter - show ALL categories for activities
      // Categories with type=null should also be available for activities
      const allCategories = response.data;
 console.log('Using ALL categories (no filtering):', allCategories);
      setCategories(allCategories);
      return allCategories;
    } catch (error) {
 console.error('Error loading categories:', error);
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
            <IonButton
              onClick={handleClose}
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

      <IonContent className="app-gradient-background">
        {/* SEKTION: Grunddaten */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--success">
              <IonIcon icon={create} />
            </div>
            <IonLabel>Grunddaten</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              <IonList style={{ background: 'transparent', padding: '0' }}>
                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked">Name *</IonLabel>
                  <IonInput
                    value={formData.name}
                    onIonInput={(e) => setFormData({ ...formData, name: e.detail.value! })}
                    placeholder="z.B. Sonntagsgottesdienst"
                    disabled={loading}
                    clearInput={true}
                  />
                </IonItem>

                <IonItem lines="full" style={{ '--background': 'transparent' }}>
                  <IonLabel position="stacked" style={{ marginBottom: '8px' }}>Punkte *</IonLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '8px 0' }}>
                    <IonButton
                      fill="outline"
                      size="small"
                      disabled={loading || formData.points <= 1}
                      onClick={() => setFormData({ ...formData, points: Math.max(1, formData.points - 1) })}
                      style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                    >
                      <IonIcon icon={removeOutline} />
                    </IonButton>
                    <IonInput
                      type="text"
                      inputMode="numeric"
                      value={formData.points.toString()}
                      onIonInput={(e) => {
                        const value = e.detail.value!;
                        if (value === '') {
                          setFormData({ ...formData, points: 1 });
                        } else {
                          const num = parseInt(value);
                          if (!isNaN(num) && num >= 1 && num <= 50) {
                            setFormData({ ...formData, points: num });
                          }
                        }
                      }}
                      placeholder="1"
                      disabled={loading}
                      style={{ textAlign: 'center', flex: 1 }}
                    />
                    <IonButton
                      fill="outline"
                      size="small"
                      disabled={loading || formData.points >= 50}
                      onClick={() => setFormData({ ...formData, points: Math.min(50, formData.points + 1) })}
                      style={{ '--border-radius': '8px', minWidth: '40px', height: '40px' }}
                    >
                      <IonIcon icon={addOutline} />
                    </IonButton>
                  </div>
                </IonItem>

                <IonItem lines="none" style={{ '--background': 'transparent', paddingTop: '8px' }}>
                  <IonLabel style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666' }}>Typ *</IonLabel>
                </IonItem>
              </IonList>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  onClick={() => !loading && setFormData({ ...formData, type: 'gottesdienst' })}
                  style={{
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    borderTop: '1px solid rgba(0,0,0,0.06)',
                    borderRight: '1px solid rgba(0,0,0,0.06)',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    borderLeft: '3px solid #007aff',
                    background: formData.type === 'gottesdienst' ? 'rgba(0, 122, 255, 0.1)' : 'white'
                  }}
                >
                  <span style={{ fontWeight: '500', color: '#333' }}>Gottesdienst</span>
                  <IonCheckbox
                    checked={formData.type === 'gottesdienst'}
                    disabled={loading}
                    style={{
                      '--checkbox-background-checked': '#007aff',
                      '--border-color-checked': '#007aff',
                      '--border-color': '#007aff',
                      '--checkmark-color': 'white'
                    }}
                  />
                </div>
                <div
                  onClick={() => !loading && setFormData({ ...formData, type: 'gemeinde' })}
                  style={{
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    borderTop: '1px solid rgba(0,0,0,0.06)',
                    borderRight: '1px solid rgba(0,0,0,0.06)',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    borderLeft: '3px solid #059669',
                    background: formData.type === 'gemeinde' ? 'rgba(5, 150, 105, 0.1)' : 'white'
                  }}
                >
                  <span style={{ fontWeight: '500', color: '#333' }}>Gemeinde</span>
                  <IonCheckbox
                    checked={formData.type === 'gemeinde'}
                    disabled={loading}
                    style={{
                      '--checkbox-background-checked': '#059669',
                      '--border-color-checked': '#059669',
                      '--border-color': '#059669',
                      '--checkmark-color': 'white'
                    }}
                  />
                </div>
              </div>
            </IonCardContent>
        </IonCard>
      </IonList>

        {/* SEKTION: Kategorien */}
        <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--success">
              <IonIcon icon={pricetag} />
            </div>
            <IonLabel>Kategorien</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
            {initializing ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <IonSpinner name="crescent" />
              </div>
            ) : categories.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {categories.map((category) => {
                  const isChecked = formData.category_ids.includes(category.id);
                  return (
                    <div
                      key={category.id}
                      className={`app-list-item app-list-item--activities ${isChecked ? 'app-list-item--selected' : ''}`}
                      onClick={() => {
                        if (!loading) {
                          setFormData(prev => ({
                            ...prev,
                            category_ids: prev.category_ids.includes(category.id)
                              ? prev.category_ids.filter(id => id !== category.id)
                              : [...prev.category_ids, category.id]
                          }));
                        }
                      }}
                      style={{
                        cursor: loading ? 'default' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span style={{ fontWeight: '500', color: '#333' }}>{category.name}</span>
                      <IonCheckbox
                        checked={isChecked}
                        disabled={loading}
                        style={{
                          '--checkbox-background-checked': '#059669',
                          '--border-color-checked': '#059669',
                          '--checkmark-color': 'white'
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#666'
              }}>
                <IonIcon icon={pricetag} style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '16px' }} />
                <p style={{ margin: '0', fontSize: '1rem' }}>Keine Kategorien verfügbar</p>
              </div>
            )}
          </IonCardContent>
        </IonCard>
      </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ActivityManagementModal;
