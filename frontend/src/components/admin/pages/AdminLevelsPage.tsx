import React, { useState, useEffect, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonButton,
  IonButtons,
  IonIcon,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  useIonModal,
  IonRefresher,
  IonRefresherContent
} from '@ionic/react';
import {
  add,
  trophy,
  trash,
  arrowBack,
  star,
  medal,
  ribbon,
  checkmarkCircle,
  diamond,
  shield,
  flame,
  flash,
  rocket,
  sparkles,
  thumbsUp,
  heart,
  people,
  personAdd,
  chatbubbles,
  gift,
  book,
  school,
  construct,
  brush,
  colorPalette,
  sunny,
  moon,
  leaf,
  rose,
  calendar,
  today,
  time,
  timer,
  stopwatch,
  restaurant,
  fitness,
  bicycle,
  car,
  airplane,
  boat,
  camera,
  image,
  musicalNote,
  balloon,
  home,
  business,
  location,
  navigate,
  compass,
  pin,
  flag,
  informationCircle,
  helpCircle,
  alertCircle,
  hammer
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import LevelManagementModal from '../modals/LevelManagementModal';
import LoadingSpinner from '../../common/LoadingSpinner';
import { SectionHeader, ListSection } from '../../shared';

// Icon Mapping (same as in LevelManagementModal)
const LEVEL_ICONS: Record<string, any> = {
  trophy, medal, ribbon, star, checkmarkCircle, diamond, shield,
  flame, flash, rocket, sparkles, thumbsUp,
  heart, people, personAdd, chatbubbles, gift,
  book, school, construct, brush, colorPalette,
  sunny, moon, leaf, rose,
  calendar, today, time, timer, stopwatch,
  restaurant, fitness, bicycle, car, airplane, boat, camera, image, musicalNote, balloon,
  home, business, location, navigate, compass, pin, flag,
  informationCircle, helpCircle, alertCircle, hammer
};

const getIconFromString = (iconName: string) => {
  return LEVEL_ICONS[iconName] || trophy;
};

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
  const { pageRef, presentingElement } = useModalPage('admin-levels');
  const { user, setSuccess, setError } = useApp();
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const slidingRefs = useRef<Map<number, HTMLIonItemSlidingElement>>(new Map());
  const [editLevel, setEditLevel] = useState<Level | undefined>(undefined);

  const loadLevels = async () => {
    try {
      setLoading(true);
 console.log('Loading levels from API...');
      const response = await api.get('/levels');
 console.log('Levels loaded:', response.data);
      setLevels(response.data);
    } catch (error: any) {
 console.error('Fehler beim Laden der Level:', error);
 console.error('Error details:', error.response);
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
    presentLevelModal({ presentingElement });
  };

  const handleEdit = (level: Level) => {
    setEditLevel(level);
    presentLevelModal({ presentingElement });
  };

  const handleDelete = async (level: Level) => {
    if (!confirm(`Level "${level.title}" wirklich löschen?`)) return;

    const slidingElement = slidingRefs.current.get(level.id);

    try {
      await api.delete(`/levels/${level.id}`);
      setSuccess('Level gelöscht');
      await loadLevels();
    } catch (error: any) {
      if (slidingElement) {
        await slidingElement.close();
      }
      const errorMessage = error.response?.data?.error || 'Fehler beim Löschen des Levels';
      alert(errorMessage);
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await loadLevels();
    event.detail.complete();
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => window.history.back()}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Level</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleAdd}>
              <IonIcon icon={add} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Level</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent refreshingSpinner="crescent" />
        </IonRefresher>

        {loading ? (
          <LoadingSpinner message="Level werden geladen..." />
        ) : (
          <>
            <SectionHeader
              title="Level-System"
              subtitle="Punkte-Level und Belohnungen"
              icon={trophy}
              preset="konfis"
              stats={[
                { value: levels.length, label: 'GESAMT' }
              ]}
            />

            {/* Level List */}
            <ListSection
              icon={trophy}
              title="Level"
              count={levels.length}
              iconColorClass="level"
              emptyIcon={trophy}
              emptyTitle="Keine Level gefunden"
              emptyMessage="Noch keine Level angelegt"
              emptyIconColor="#5b21b6"
            >
                      {levels.map((level, index) => (
                        <IonItemSliding
                          key={level.id}
                          ref={(el) => {
                            if (el) {
                              slidingRefs.current.set(level.id, el);
                            } else {
                              slidingRefs.current.delete(level.id);
                            }
                          }}
                          style={{ marginBottom: index < levels.length - 1 ? '8px' : '0' }}
                        >
                          <IonItem
                            button
                            onClick={() => handleEdit(level)}
                            detail={false}
                            lines="none"
                            style={{
                              '--background': 'transparent',
                              '--padding-start': '0',
                              '--padding-end': '0',
                              '--inner-padding-end': '0',
                              '--inner-border-width': '0',
                              '--border-style': 'none',
                              '--min-height': 'auto'
                            }}
                          >
                            <div
                              className="app-list-item app-list-item--level"
                              style={{
                                width: '100%',
                                position: 'relative',
                                overflow: 'hidden',
                                borderLeftColor: level.color || '#5b21b6'
                              }}
                            >
                              {/* Corner Badge für Punkte */}
                              <div
                                className="app-corner-badge"
                                style={{ backgroundColor: level.color || '#5b21b6' }}
                              >
                                {level.points_required}P
                              </div>
                              <div className="app-list-item__row">
                                <div className="app-list-item__main">
                                  <div
                                    className="app-icon-circle app-icon-circle--lg"
                                    style={{ backgroundColor: level.color || '#5b21b6' }}
                                  >
                                    <IonIcon icon={getIconFromString(level.icon || 'trophy')} />
                                  </div>
                                  <div className="app-list-item__content">
                                    <div className="app-list-item__title" style={{ paddingRight: '50px' }}>
                                      {level.title}
                                    </div>
                                    {level.description && (
                                      <div className="app-list-item__meta">
                                        <span className="app-list-item__meta-item">
                                          {level.description}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </IonItem>

                          <IonItemOptions side="end" style={{ '--ion-item-background': 'transparent', border: 'none' }}>
                            <IonItemOption
                              onClick={() => handleDelete(level)}
                              style={{ '--background': 'transparent', '--color': 'transparent', padding: '0', minWidth: 'auto', '--border-width': '0' }}
                            >
                              <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                                <IonIcon icon={trash} />
                              </div>
                            </IonItemOption>
                          </IonItemOptions>
                        </IonItemSliding>
                      ))}
            </ListSection>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminLevelsPage;
