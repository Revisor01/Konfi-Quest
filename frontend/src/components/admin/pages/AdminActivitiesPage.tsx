import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
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
  IonSegment,
  IonSegmentButton,
  IonLabel,
  useIonModal,
  useIonAlert
} from '@ionic/react';
import { add, arrowBack } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
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
  const [selectedRole, setSelectedRole] = useState<'konfi' | 'teamer'>('konfi');

  // Modal state
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // Alert Hook für Bestätigungsdialoge
  const [presentAlert] = useIonAlert();

  // Modal mit useIonModal Hook
  const [presentActivityModalHook, dismissActivityModalHook] = useIonModal(ActivityManagementModal, {
    activity: selectedActivity,
    activityId: selectedActivity?.id || null,
    targetRole: selectedRole,
    onClose: () => dismissActivityModalHook(),
    onSuccess: () => {
      dismissActivityModalHook();
      loadActivities();
    }
  });

  // Memoized refresh function for live updates
  const refreshActivities = useCallback(() => {
    loadActivities();
  }, []);

  // Subscribe to live updates for activities
  useLiveRefresh('activities', refreshActivities);

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


  const loadActivities = async (role?: 'konfi' | 'teamer') => {
    setLoading(true);
    try {
      const targetRole = role || selectedRole;
      const response = await api.get(`/admin/activities?target_role=${targetRole}`);
      setActivities(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Aktivitäten');
      console.error('Error loading activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteActivity = async (activity: Activity) => {
    presentAlert({
      header: 'Aktivität löschen',
      message: `Aktivität "${activity.name}" wirklich löschen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/admin/activities/${activity.id}`);
              setSuccess(`Aktivität "${activity.name}" gelöscht`);
              await loadActivities();
            } catch (err: any) {
              const errorMessage = err.response?.data?.error || 'Fehler beim Löschen der Aktivität';
              setError(errorMessage);
            }
          }
        }
      ]
    });
  };

  const handleSelectActivity = (activity: Activity) => {
    setSelectedActivity(activity);
    presentActivityModalHook({ 
      presentingElement: presentingElement || pageRef.current || undefined 
    });
  };

  const presentActivityModal = () => {
    setSelectedActivity(null);
    presentActivityModalHook({
      presentingElement: presentingElement || pageRef.current || undefined
    });
  };

  const handleRoleChange = (role: 'konfi' | 'teamer') => {
    setSelectedRole(role);
    loadActivities(role);
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
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Aktivitäten</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadActivities();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* Konfi/Teamer Toggle */}
        <div className="app-segment-wrapper" style={{ padding: '8px 16px 0' }}>
          <IonSegment
            value={selectedRole}
            onIonChange={(e) => handleRoleChange(e.detail.value as 'konfi' | 'teamer')}
          >
            <IonSegmentButton value="konfi">
              <IonLabel>Konfis</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="teamer">
              <IonLabel>Teamer:innen</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>

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
            targetRole={selectedRole}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminActivitiesPage;