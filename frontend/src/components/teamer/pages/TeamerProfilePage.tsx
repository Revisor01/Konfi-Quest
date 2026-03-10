import React, { useState, useEffect, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonList,
  IonListHeader,
  IonItem,
  IonLabel,
  IonIcon,
  IonCard,
  IonCardContent
} from '@ionic/react';
import { person, trophy, star, flash } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';

interface TeamerProfile {
  user: {
    display_name: string;
    username: string;
    organization_name: string;
  };
  konfi_data: {
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
  };
}

const TeamerProfilePage: React.FC = () => {
  const { setError } = useApp();
  const { pageRef } = useModalPage('profile');
  const [profile, setProfile] = useState<TeamerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/teamer/profile');
      setProfile(response.data);
    } catch (err) {
      setError('Fehler beim Laden des Profils');
      console.error('Error loading teamer profile:', err);
    } finally {
      setLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return <LoadingSpinner message="Profil wird geladen..." />;
  }

  if (!profile) {
    return (
      <IonPage>
        <IonContent>
          <p style={{ textAlign: 'center', marginTop: '50px' }}>
            Fehler beim Laden des Profils
          </p>
        </IonContent>
      </IonPage>
    );
  }

  const { user, konfi_data } = profile;

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Profil</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Profil</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadProfile();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* Header Banner */}
        <div className="app-header-banner app-header-banner--teamer">
          <div className="app-header-banner__content">
            <div className="app-header-banner__icon-row">
              <IonIcon icon={person} className="app-header-banner__icon" />
              <span className="app-header-banner__title">{user.display_name}</span>
            </div>
            <div className="app-header-banner__stats-row">
              <span className="app-header-banner__stat">@{user.username}</span>
              <span className="app-header-banner__stat">{user.organization_name}</span>
            </div>
          </div>
        </div>

        {/* Konfi-Badges */}
        <IonList className="app-section-inset" inset={true}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--badges">
              <IonIcon icon={trophy} />
            </div>
            <IonLabel>Konfi-Badges ({konfi_data.badges.length})</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent className="app-card-content">
              {konfi_data.badges.length === 0 ? (
                <div className="app-empty-state">
                  <p className="app-empty-state__text">Keine Konfi-Badges vorhanden</p>
                </div>
              ) : (
                <IonList className="app-list-inner" lines="none">
                  {konfi_data.badges.map((badge) => (
                    <IonItem key={badge.badge_id} className="app-item-transparent" lines="none">
                      <div className="app-list-item">
                        <div className="app-list-item__row">
                          <div className="app-list-item__main">
                            <div
                              className="app-icon-circle"
                              style={{ backgroundColor: badge.color || '#e11d48' }}
                            >
                              <IonIcon icon={star} />
                            </div>
                            <div className="app-list-item__content">
                              <div className="app-list-item__title">{badge.name}</div>
                              <div className="app-list-item__meta">
                                <span className="app-list-item__meta-item">
                                  {formatDate(badge.awarded_date)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </IonItem>
                  ))}
                </IonList>
              )}
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Konfi-Punkte */}
        <IonList className="app-section-inset" inset={true} style={{ marginBottom: '32px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--activities">
              <IonIcon icon={flash} />
            </div>
            <IonLabel>Konfi-Punkte</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent className="app-card-content">
              {konfi_data.jahrgang_name ? (
                <>
                  <IonItem className="app-item-transparent" lines="none">
                    <IonLabel>Jahrgang</IonLabel>
                    <IonLabel slot="end" style={{ textAlign: 'right' }}>{konfi_data.jahrgang_name}</IonLabel>
                  </IonItem>
                  <IonItem className="app-item-transparent" lines="none">
                    <IonLabel>Gottesdienst-Punkte</IonLabel>
                    <IonLabel slot="end" style={{ textAlign: 'right', fontWeight: '600' }}>
                      {konfi_data.gottesdienst_points || 0}
                    </IonLabel>
                  </IonItem>
                  <IonItem className="app-item-transparent" lines="none">
                    <IonLabel>Gemeinde-Punkte</IonLabel>
                    <IonLabel slot="end" style={{ textAlign: 'right', fontWeight: '600' }}>
                      {konfi_data.gemeinde_points || 0}
                    </IonLabel>
                  </IonItem>
                </>
              ) : (
                <div className="app-empty-state">
                  <p className="app-empty-state__text">Keine Konfi-Historie vorhanden</p>
                </div>
              )}
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default TeamerProfilePage;
