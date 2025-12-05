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
  IonIcon,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  useIonModal,
  IonRefresher,
  IonRefresherContent,
  IonNote,
  IonChip,
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol
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
      console.log('🔍 Loading levels from API...');
      const response = await api.get('/levels');
      console.log('✅ Levels loaded:', response.data);
      setLevels(response.data);
    } catch (error: any) {
      console.error('❌ Fehler beim Laden der Level:', error);
      console.error('❌ Error details:', error.response);
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
            {/* Header - Dashboard-Style */}
            <div style={{
              background: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
              borderRadius: '24px',
              padding: '0',
              margin: '16px',
              marginBottom: '16px',
              boxShadow: '0 20px 40px rgba(155, 89, 182, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '220px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Überschrift - groß und überlappend */}
              <div style={{
                position: 'absolute',
                top: '-5px',
                left: '12px',
                zIndex: 1
              }}>
                <h2 style={{
                  fontSize: '4rem',
                  fontWeight: '900',
                  color: 'rgba(255, 255, 255, 0.1)',
                  margin: '0',
                  lineHeight: '0.8',
                  letterSpacing: '-2px'
                }}>
                  LEVEL
                </h2>
              </div>

              {/* Content */}
              <div style={{
                position: 'relative',
                zIndex: 2,
                padding: '70px 24px 24px 24px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '16px 32px',
                    color: 'white',
                    textAlign: 'center'
                  }}>
                    <IonIcon
                      icon={trophy}
                      style={{
                        fontSize: '2rem',
                        color: 'rgba(255, 255, 255, 0.9)',
                        marginBottom: '8px',
                        display: 'block',
                        margin: '0 auto 8px auto'
                      }}
                    />
                    <div style={{ fontSize: '2rem', fontWeight: '800' }}>
                      {levels.length}
                    </div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                      Level
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Level List */}
            <IonCard style={{ margin: '16px' }}>
              <IonCardContent style={{ padding: '8px 0' }}>
                {levels.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px' }}>
                    <IonIcon
                      icon={trophy}
                      style={{
                        fontSize: '3rem',
                        color: '#9b59b6',
                        marginBottom: '16px',
                        display: 'block',
                        margin: '0 auto 16px auto'
                      }}
                    />
                    <h3 style={{ color: '#666', margin: '0 0 8px 0' }}>Keine Level gefunden</h3>
                    <p style={{ color: '#999', margin: '0' }}>Noch keine Level angelegt</p>
                  </div>
                ) : (
                  levels.map((level) => (
                    <IonItemSliding
                      key={level.id}
                      ref={(el) => {
                        if (el) {
                          slidingRefs.current.set(level.id, el);
                        } else {
                          slidingRefs.current.delete(level.id);
                        }
                      }}
                    >
                      <IonItem
                        button
                        onClick={() => handleEdit(level)}
                        detail={false}
                        style={{
                          '--min-height': '70px',
                          '--padding-start': '16px',
                          '--background': '#f5f5f5',
                          '--border-radius': '12px',
                          margin: '4px 8px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                          border: '1px solid #e0e0e0',
                          borderRadius: '12px'
                        }}
                      >
                        <IonLabel>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              backgroundColor: level.color || '#9b59b6',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 8px rgba(155, 89, 182, 0.3)',
                              flexShrink: 0
                            }}>
                              <IonIcon
                                icon={getIconFromString(level.icon || 'trophy')}
                                style={{ fontSize: '1.2rem', color: 'white' }}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <h2 style={{
                                fontWeight: '600',
                                fontSize: '0.95rem',
                                margin: '0 0 4px 0',
                                color: '#333'
                              }}>
                                {level.title}
                              </h2>
                              {level.description && (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <IonIcon icon={informationCircle} style={{ fontSize: '0.8rem', color: '#007aff' }} />
                                  <span style={{
                                    fontSize: '0.8rem',
                                    color: '#666'
                                  }}>
                                    {level.description}
                                  </span>
                                </div>
                              )}
                            </div>
                            <IonChip style={{ marginRight: '0' }}>
                              <IonLabel style={{ fontSize: '0.75rem' }}>{level.points_required} P</IonLabel>
                            </IonChip>
                          </div>
                        </IonLabel>
                      </IonItem>

                      <IonItemOptions side="end" style={{
                        gap: '4px',
                        '--ion-item-background': 'transparent'
                      }}>
                        <IonItemOption
                          onClick={() => handleDelete(level)}
                          style={{
                            '--background': 'transparent',
                            '--background-activated': 'transparent',
                            '--background-focused': 'transparent',
                            '--background-hover': 'transparent',
                            '--color': 'transparent',
                            '--ripple-color': 'transparent',
                            padding: '0 8px',
                            paddingRight: '20px',
                            minWidth: '56px',
                            maxWidth: '56px'
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
                  ))
                )}
              </IonCardContent>
            </IonCard>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default AdminLevelsPage;
