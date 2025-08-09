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
  IonBadge,
  IonNote,
  IonChip
} from '@ionic/react';
import { add, trophy, star, pencil, trash, sparkles } from 'ionicons/icons';
import axios from 'axios';
import LevelManagementModal from '../modals/LevelManagementModal';

interface Level {
  id: number;
  level_number: number;
  name: string;
  required_points: number;
  description?: string;
  color?: string;
  icon?: string;
  created_at: string;
  updated_at: string;
}

const AdminLevelsPage: React.FC = () => {
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const ionListRef = useRef<HTMLIonListElement>(null);
  const presentingElement = document.querySelector('.ion-page');

  const loadLevels = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/levels', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLevels(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Level:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLevels();
  }, []);

  const [presentLevelModal, dismissLevelModal] = useIonModal(LevelManagementModal, {
    onClose: () => dismissLevelModal(),
    onSuccess: () => {
      dismissLevelModal();
      loadLevels();
    }
  });

  const handleAdd = () => {
    presentLevelModal({
      presentingElement: presentingElement
    });
  };

  const handleEdit = (level: Level) => {
    presentLevelModal({
      level,
      presentingElement: presentingElement
    });
  };

  const handleDelete = async (level: Level) => {
    if (!confirm(`Level "${level.name}" wirklich löschen?`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/levels/${level.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadLevels();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Fehler beim Löschen des Levels');
      ionListRef.current?.closeSlidingItems();
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await loadLevels();
    event.detail.complete();
  };

  const getColorForLevel = (level: Level) => {
    if (level.color) return level.color;
    const colors = ['primary', 'secondary', 'tertiary', 'success', 'warning', 'danger'];
    return colors[(level.level_number - 1) % colors.length];
  };

  const getIconForLevel = (level: Level) => {
    if (level.icon) return level.icon;
    if (level.level_number === 1) return star;
    if (level.level_number <= 3) return sparkles;
    return trophy;
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

        <IonList ref={ionListRef}>
          {levels.map((level) => (
            <IonItemSliding key={level.id}>
              <IonItem>
                <IonIcon 
                  icon={getIconForLevel(level)} 
                  slot="start" 
                  color={getColorForLevel(level)}
                  style={{ fontSize: '24px' }}
                />
                <IonLabel>
                  <h2>Level {level.level_number}: {level.name}</h2>
                  <p>{level.description || 'Keine Beschreibung'}</p>
                </IonLabel>
                <IonChip color={getColorForLevel(level)} slot="end">
                  <IonLabel>{level.required_points} Punkte</IonLabel>
                </IonChip>
              </IonItem>
              <IonItemOptions side="end">
                <IonItemOption color="primary" onClick={() => handleEdit(level)}>
                  <IonIcon icon={pencil} />
                </IonItemOption>
                <IonItemOption color="danger" onClick={() => handleDelete(level)}>
                  <IonIcon icon={trash} />
                </IonItemOption>
              </IonItemOptions>
            </IonItemSliding>
          ))}
        </IonList>

        {!loading && levels.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <IonNote>Noch keine Level vorhanden</IonNote>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminLevelsPage;