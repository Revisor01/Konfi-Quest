import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { 
  IonPage, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonRefresher,
  IonRefresherContent,
  IonButtons,
  IonButton,
  IonIcon,
  useIonModal
} from '@ionic/react';
import { add, arrowBack } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import ActivitiesView from '../ActivitiesView';
import LoadingSpinner from '../../common/LoadingSpinner';
import ActivityManagementModal from '../modals/ActivityManagementModal';

interface Activity {
  id: number;
  name: string;
  description?: string;
  points: number;
  type: 'gottesdienst' | 'gemeinde';
  category?: string;
  created_at: string;
}

const AdminActivitiesPage: React.FC = () => {
  const { user, setSuccess, setError } = useApp();
  const { pageRef, presentingElement, cleanupModals } = useModalPage('admin-activities');
  
  // State
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // Modal mit useIonModal Hook 
  const [presentActivityModalHook, dismissActivityModalHook] = useIonModal(ActivityManagementModal, {
    activity: selectedActivity,
    activityId: selectedActivity?.id || null,
    onClose: () => dismissActivityModalHook(),
    onSuccess: () => {
      dismissActivityModalHook();
      loadActivities();
    }
  });

  useEffect(() => {
    loadActivities();
    
    // Event-Listener für Updates
    const handleActivitiesUpdated = () => {
      loadActivities();
    };
    
    window.addEventListener('activities-updated', handleActivitiesUpdated);
    
    return () => {
      window.removeEventListener('activities-updated', handleActivitiesUpdated);
    };
  }, []);


  const loadActivities = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/activities');
      setActivities(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Aktivitäten');
      console.error('Error loading activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteActivity = async (activity: Activity) => {
    if (!window.confirm(`Aktivität "${activity.name}" wirklich löschen?`)) return;

    try {
      await api.delete(`/admin/activities/${activity.id}`);
      setSuccess(`Aktivität "${activity.name}" gelöscht`);
      // Sofortige Aktualisierung
      await loadActivities();
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Fehler beim Löschen der Aktivität';
      alert(errorMessage);
      // Re-throw error damit ActivitiesView weiß, dass es einen Fehler gab
      throw err;
    }
  };

  const handleSelectActivity = (activity: Activity) => {
    console.log('🎯 AdminActivitiesPage: Opening edit modal with presentingElement:', presentingElement);
    console.log('🎯 AdminActivitiesPage: pageRef.current:', pageRef.current);
    setSelectedActivity(activity);
    presentActivityModalHook({ 
      presentingElement: presentingElement || pageRef.current || undefined 
    });
  };

  const presentActivityModal = () => {
    console.log('🎯 AdminActivitiesPage: Opening create modal with presentingElement:', presentingElement);
    console.log('🎯 AdminActivitiesPage: pageRef.current:', pageRef.current);
    setSelectedActivity(null);
    presentActivityModalHook({ 
      presentingElement: presentingElement || pageRef.current || undefined 
    });
  };

  // Rollen-basierte Berechtigungen (org_admin und admin duerfen alles)
  const isAdmin = ['org_admin', 'admin'].includes(user?.role_name || '');
  const canCreate = isAdmin;
  const canEdit = isAdmin;
  const canDelete = isAdmin;


  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => window.history.back()}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Aktivitäten</IonTitle>
          {canCreate && (
            <IonButtons slot="end">
              <IonButton onClick={presentActivityModal}>
                <IonIcon icon={add} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Aktivitäten</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadActivities();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>
        
        {loading ? (
          <LoadingSpinner message="Aktivitäten werden geladen..." />
        ) : (
          <ActivitiesView 
            activities={activities}
            onUpdate={loadActivities}
            onAddActivityClick={presentActivityModal}
            onSelectActivity={handleSelectActivity}
            onDeleteActivity={handleDeleteActivity}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminActivitiesPage;