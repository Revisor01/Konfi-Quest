import React, { useState, useEffect, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonButtons,
  IonMenuButton,
  IonIcon,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  useIonModal,
  IonRefresher,
  IonRefresherContent,
  IonProgressBar,
  IonNote,
  IonChip,
  IonCard,
  IonCardContent
} from '@ionic/react';
import { add, trophy, trash, create } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import LevelManagementModal from '../modals/LevelManagementModal';

interface Level {
  id: number;
  name: string;
  title: string;
  description?: string;
  points_required: number;
  icon?: string;
  color?: string;
  reward_type?: string;
  reward_value?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const AdminLevelsPage: React.FC = () => {
  const { setSuccess, setError } = useApp();
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const ionListRef = useRef<HTMLIonListElement>(null);
  const presentingElement = document.querySelector('.ion-page') as HTMLElement;
  const [editLevel, setEditLevel] = useState<Level | undefined>(undefined);

  const loadLevels = async () => {
    try {
      setLoading(true);
      const response = await api.get('/levels');
      setLevels(response.data);
    } catch (error: any) {
      console.error('Fehler beim Laden der Level:', error);
      setError(error.response?.data?.error || 'Fehler beim Laden der Level');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLevels();
  }, []);

  const [presentLevelModal, dismissLevelModal] = useIonModal(LevelManagementModal, {
    level: editLevel,
    onClose: () => dismissLevelModal(),
    onSuccess: () => {
      dismissLevelModal();
      loadLevels();
    }
  });

  const handleAdd = () => {
    setEditLevel(undefined);
    presentLevelModal({
      presentingElement: presentingElement || undefined
    });
  };

  const handleEdit = (level: Level) => {
    setEditLevel(level);
    presentLevelModal({
      presentingElement: presentingElement || undefined
    });
  };

  const handleDelete = async (level: Level) => {
    if (!confirm(`Level "${level.title}" wirklich löschen?`)) return;

    try {
      await api.delete(`/levels/${level.id}`);
      setSuccess('Level gelöscht');
      await loadLevels();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Fehler beim Löschen des Levels');
      ionListRef.current?.closeSlidingItems();
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await loadLevels();
    event.detail.complete();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>Level-System</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleAdd}>
              <IonIcon icon={add} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && <IonProgressBar type="indeterminate" />}

        <IonCard style={{ margin: '16px' }}>
          <IonCardContent style={{ padding: '8px 0' }}>
            {!loading && levels.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <IonIcon icon={trophy} style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '16px' }} />
                <IonNote>Noch keine Level vorhanden</IonNote>
              </div>
            ) : (
              <IonList ref={ionListRef} lines="none" style={{ background: 'transparent' }}>
                {levels.map((level) => (
                  <IonItemSliding key={level.id}>
                    <IonItem
                      button
                      onClick={() => handleEdit(level)}
                      detail={false}
                      style={{
                        '--min-height': '70px',
                        '--padding-start': '16px',
                        '--background': '#fbfbfb',
                        '--border-radius': '12px',
                        margin: '4px 8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        border: '1px solid #e0e0e0',
                        borderRadius: '12px'
                      }}
                    >
                      <div style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: level.color || '#3880ff',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '12px',
                        flexShrink: 0,
                        boxShadow: '0 2px 8px rgba(56, 128, 255, 0.3)'
                      }}>
                        <span style={{ fontSize: '1.2rem' }}>{level.icon || '🏆'}</span>
                      </div>
                      <IonLabel>
                        <h2 style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '4px' }}>
                          {level.title}
                        </h2>
                        <p style={{ fontSize: '0.85rem', color: '#666' }}>
                          {level.description || 'Keine Beschreibung'}
                        </p>
                      </IonLabel>
                      <IonChip style={{ marginRight: '8px' }}>
                        <IonLabel>{level.points_required} Punkte</IonLabel>
                      </IonChip>
                    </IonItem>
                    <IonItemOptions side="end" style={{ gap: '4px', '--ion-item-background': 'transparent' }}>
                      <IonItemOption
                        onClick={() => handleDelete(level)}
                        style={{
                          '--background': 'transparent',
                          '--background-activated': 'transparent',
                          '--background-focused': 'transparent',
                          '--background-hover': 'transparent',
                          '--color': 'transparent',
                          '--ripple-color': 'transparent',
                          padding: '0 2px',
                          paddingRight: '20px',
                          minWidth: '48px',
                          maxWidth: '68px'
                        }}
                      >
                        <div style={{
                          width: '44px',
                          height: '44px',
                          backgroundColor: '#dc3545',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(220, 53, 69, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
                        }}>
                          <IonIcon icon={trash} style={{ fontSize: '1.2rem', color: 'white' }} />
                        </div>
                      </IonItemOption>
                    </IonItemOptions>
                  </IonItemSliding>
                ))}
              </IonList>
            )}
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default AdminLevelsPage;
