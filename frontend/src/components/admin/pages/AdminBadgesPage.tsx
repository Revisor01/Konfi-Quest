import React, { useState, useEffect, useRef } from 'react';
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
import { add } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import BadgesView from '../BadgesView';
import LoadingSpinner from '../../common/LoadingSpinner';
import BadgeManagementModal from '../modals/BadgeManagementModal';

interface Badge {
  id: number;
  name: string;
  icon: string;
  description?: string;
  criteria_type: string;
  criteria_value: number;
  criteria_extra?: string;
  is_active: boolean;
  is_hidden: boolean;
  earned_count: number;
  created_at: string;
}

const AdminBadgesPage: React.FC = () => {
  const { setSuccess, setError } = useApp();
  const { pageRef, presentingElement } = useModalPage('badges');
  
  // State
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [modalBadgeId, setModalBadgeId] = useState<number | null>(null);

  // Modal mit useIonModal Hook
  const [presentBadgeModalHook, dismissBadgeModalHook] = useIonModal(BadgeManagementModal, {
    badgeId: modalBadgeId,
    onClose: () => {
      dismissBadgeModalHook();
      setSelectedBadge(null);
      setModalBadgeId(null);
    },
    onSuccess: () => {
      dismissBadgeModalHook();
      setSelectedBadge(null);
      setModalBadgeId(null);
      loadBadges();
    }
  });

  useEffect(() => {
    loadBadges();
    
    // Event-Listener für Updates
    const handleBadgesUpdated = () => {
      loadBadges();
    };
    
    window.addEventListener('badges-updated', handleBadgesUpdated);
    
    return () => {
      window.removeEventListener('badges-updated', handleBadgesUpdated);
    };
  }, []);

  const loadBadges = async () => {
    setLoading(true);
    try {
      const response = await api.get('/badges');
      setBadges(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Badges');
      console.error('Error loading badges:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBadge = async (badge: Badge) => {
    if (!window.confirm(`Badge "${badge.name}" wirklich löschen?`)) return;

    try {
      await api.delete(`/badges/${badge.id}`);
      setSuccess(`Badge "${badge.name}" gelöscht`);
      // Sofortige Aktualisierung
      await loadBadges();
    } catch (err: any) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Fehler beim Löschen des Badges');
      }
    }
  };

  const handleSelectBadge = (badge: Badge) => {
    setSelectedBadge(badge);
    setModalBadgeId(badge.id);
    presentBadgeModalHook({
      presentingElement: presentingElement
    });
  };

  const presentBadgeModal = () => {
    setSelectedBadge(null);
    setModalBadgeId(null);
    presentBadgeModalHook({
      presentingElement: presentingElement
    });
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Badges</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={presentBadgeModal}>
              <IonIcon icon={add} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Badges</IonTitle>
          </IonToolbar>
        </IonHeader>
        
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadBadges();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>
        
        {loading ? (
          <LoadingSpinner message="Badges werden geladen..." />
        ) : (
          <BadgesView 
            badges={badges}
            onUpdate={loadBadges}
            onAddBadgeClick={presentBadgeModal}
            onSelectBadge={handleSelectBadge}
            onDeleteBadge={handleDeleteBadge}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminBadgesPage;