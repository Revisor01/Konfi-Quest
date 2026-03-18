import React, { useState, useEffect, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonRefresher,
  IonRefresherContent,
  IonCard,
  IonCardContent,
  IonIcon,
  IonList,
  IonListHeader,
  IonLabel,
  useIonModal
} from '@ionic/react';
import {
  trophy,
  flashOutline,
  schoolOutline,
  starOutline,
  calendarOutline,
  checkmark
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import PointsHistoryModal from '../../konfi/modals/PointsHistoryModal';
import LoadingSpinner from '../../common/LoadingSpinner';

interface KonfiData {
  gottesdienst_points: number;
  gemeinde_points: number;
  jahrgang_name: string;
  badges: Array<{
    badge_id: number;
    name: string;
    icon: string;
    color: string;
    awarded_date: string;
  }>;
}

import {
  medal,
  ribbon,
  star,
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

const BADGE_ICONS: Record<string, string> = {
  trophy, medal, ribbon, star, checkmarkCircle, diamond, shield,
  flame, flash, rocket, sparkles, thumbsUp, heart, people,
  personAdd, chatbubbles, gift, book, school, construct, brush,
  colorPalette, sunny, moon, leaf, rose, calendar, today, time,
  timer, stopwatch, restaurant, fitness, bicycle, car, airplane,
  boat, camera, image, musicalNote, balloon, home, business,
  location, navigate, compass, pin, flag, informationCircle,
  helpCircle, alertCircle, hammer
};

const getIconFromString = (iconName: string): string => {
  return BADGE_ICONS[iconName] || trophy;
};

const TeamerKonfiStatsPage: React.FC = () => {
  const { pageRef, presentingElement } = useModalPage('teamer-konfi-stats');
  const { setError } = useApp();
  const [konfiData, setKonfiData] = useState<KonfiData | null>(null);
  const [loading, setLoading] = useState(true);

  const [presentPointsModal, dismissPointsModal] = useIonModal(PointsHistoryModal, {
    onClose: () => dismissPointsModal(),
    pointConfig: { gottesdienst_enabled: true, gemeinde_enabled: true },
    apiEndpoint: '/teamer/konfi-history'
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/teamer/profile');
      setKonfiData(response.data.konfi_data);
    } catch (err) {
      setError('Fehler beim Laden der Konfi-Historie');
      console.error('Error loading konfi stats:', err);
    } finally {
      setLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <LoadingSpinner message="Konfi-Historie wird geladen..." />;
  }

  if (!konfiData) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/teamer/profile" text="" />
            </IonButtons>
            <IonTitle>Konfi-Historie</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div style={{ textAlign: 'center', marginTop: '80px' }}>
            <p>Keine Konfi-Daten vorhanden</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const totalPoints = (konfiData.gottesdienst_points || 0) + (konfiData.gemeinde_points || 0);

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/teamer/profile" text="" />
          </IonButtons>
          <IonTitle>Konfi-Historie</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Konfi-Historie</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadData().then(() => e.detail.complete());
        }}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Punkte-Header */}
        <div
          className="app-detail-header"
          style={{
            background: 'linear-gradient(135deg, #5b21b6 0%, #4c1d95 100%)',
            boxShadow: '0 20px 40px rgba(91, 33, 182, 0.3)',
            cursor: 'pointer'
          }}
          onClick={() => presentPointsModal({ presentingElement: presentingElement || undefined })}
        >
          <div className="app-detail-header__content" style={{ padding: '70px 24px 24px 24px', alignItems: 'center', textAlign: 'center' }}>
            <div className="app-icon-circle" style={{
              width: '64px', height: '64px',
              background: 'rgba(255, 255, 255, 0.2)',
              marginBottom: '12px',
              color: 'white', fontSize: '1.6rem', fontWeight: '600',
              border: '2px solid rgba(255, 255, 255, 0.3)'
            }}>
              <IonIcon icon={schoolOutline} />
            </div>
            <h1 className="app-detail-header__title">{totalPoints} Punkte</h1>
            <p className="app-detail-header__subtitle">
              {konfiData.jahrgang_name ? `Jahrgang ${konfiData.jahrgang_name}` : 'Konfi-Zeit'}
            </p>
            <div className="app-detail-header__info-row" style={{ justifyContent: 'center' }}>
              <div className="app-detail-header__info-chip" style={{ textAlign: 'center', flex: '1 1 0', padding: '10px 8px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>{konfiData.gottesdienst_points || 0}</div>
                <div style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>GOTTESDIENST</div>
              </div>
              <div className="app-detail-header__info-chip" style={{ textAlign: 'center', flex: '1 1 0', padding: '10px 8px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>{konfiData.gemeinde_points || 0}</div>
                <div style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: '600', letterSpacing: '0.3px' }}>GEMEINDE</div>
              </div>
            </div>
            <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.8rem', marginTop: '8px' }}>
              Tippe für Details
            </p>
          </div>
        </div>

        {/* Konfi-Badges */}
        {konfiData.badges.length > 0 && (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon" style={{ backgroundColor: '#f59e0b' }}>
                <IonIcon icon={trophy} />
              </div>
              <IonLabel>Konfi-Badges ({konfiData.badges.length})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: '16px' }}>
                {/* 3-Column Badge Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px'
                }}>
                  {konfiData.badges.map((badge) => {
                    const bColor = badge.color || '#f59e0b';
                    return (
                      <div
                        key={badge.badge_id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '12px 8px',
                          borderRadius: '16px',
                          background: `${bColor}10`,
                          border: `2px solid ${bColor}40`,
                          position: 'relative'
                        }}
                      >
                        {/* Badge Icon */}
                        <div style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: `linear-gradient(145deg, ${bColor} 0%, ${bColor}cc 100%)`,
                          boxShadow: `0 4px 12px ${bColor}40`,
                          position: 'relative',
                          marginBottom: '8px'
                        }}>
                          <IonIcon
                            icon={getIconFromString(badge.icon)}
                            style={{ fontSize: '1.8rem', color: 'white' }}
                          />
                          {/* Earned Checkmark */}
                          <div style={{
                            position: 'absolute',
                            bottom: '-2px',
                            right: '-2px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: '#22c55e',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid white'
                          }}>
                            <IonIcon icon={checkmark} style={{ fontSize: '0.7rem', color: 'white' }} />
                          </div>
                        </div>

                        {/* Badge Name */}
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: '#333',
                          textAlign: 'center',
                          lineHeight: '1.2',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {badge.name}
                        </span>

                        {/* Award Date */}
                        <span style={{
                          fontSize: '0.6rem',
                          color: '#888',
                          marginTop: '2px'
                        }}>
                          {new Date(badge.awarded_date).toLocaleDateString('de-DE', {
                            day: 'numeric',
                            month: 'short'
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        <div style={{ height: '32px' }} />
      </IonContent>
    </IonPage>
  );
};

export default TeamerKonfiStatsPage;
