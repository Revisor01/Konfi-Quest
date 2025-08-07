import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent
} from '@ionic/react';
import { useApp } from '../../../contexts/AppContext';
import { useModalPage } from '../../../contexts/ModalContext';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';
import ProfileView from '../views/ProfileView';

interface KonfiProfile {
  id: number;
  username: string;
  display_name: string;
  email?: string;
  jahrgang_name: string;
  jahrgang_year: number;
  confirmation_date?: string;
  created_at: string;
  last_login_at?: string;
  bible_translation?: string;
  // Statistics
  total_points: number;
  badge_count: number;
  activity_count: number;
  event_count: number;
  pending_requests: number;
  rank_in_jahrgang?: number;
  total_in_jahrgang?: number;
  recent_activities: RecentActivity[];
  progress_overview: ProgressOverview;
}

interface RecentActivity {
  id: number;
  title: string;
  type: 'activity' | 'event' | 'badge' | 'request';
  points: number;
  date: string;
  icon?: string;
}

interface ProgressOverview {
  next_badge?: {
    name: string;
    points_needed: number;
    progress_percentage: number;
  };
  monthly_points: {
    month: string;
    points: number;
  }[];
  achievements: {
    total_activities: number;
    total_events: number;
    total_badges: number;
    streak_days?: number;
  };
}

const KonfiProfilePage: React.FC = () => {
  const { setError } = useApp();
  const { pageRef } = useModalPage('profile');
  
  const [profile, setProfile] = useState<KonfiProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await api.get('/konfi/profile');
      setProfile(response.data);
    } catch (err) {
      setError('Fehler beim Laden des Profils');
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
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

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Profil</IonTitle>
        </IonToolbar>
      </IonHeader>
      
      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black' }}>Profil</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadProfile();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        <ProfileView profile={profile} onReload={loadProfile} />
      </IonContent>
    </IonPage>
  );
};

export default KonfiProfilePage;