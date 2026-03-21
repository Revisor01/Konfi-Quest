import React, { useState, useCallback, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  useIonModal
} from '@ionic/react';
import { useApp } from '../../../contexts/AppContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';
import DashboardView from '../views/DashboardView';
import PointsHistoryModal from '../modals/PointsHistoryModal';
import { Event } from '../../../types/event';

interface PointConfig {
  gottesdienst_enabled: boolean;
  gemeinde_enabled: boolean;
  target_gottesdienst: number;
  target_gemeinde: number;
}

interface DashboardConfig {
  show_konfirmation: boolean;
  show_events: boolean;
  show_losung: boolean;
  show_badges: boolean;
  show_ranking: boolean;
}

interface DashboardData {
  konfi: {
    id: number;
    display_name: string;
    jahrgang_name: string;
    gottesdienst_points: number;
    gemeinde_points: number;
    confirmation_date?: string;
    confirmation_location?: string;
  };
  total_points: number;
  recent_badges: any[];
  badge_count: number;
  recent_events: any[];
  event_count: number;
  ranking: any[];
  days_to_confirmation?: number;
  confirmation_date?: string;
  point_config?: PointConfig;
  dashboard_config?: DashboardConfig;
}

// Event-Typ importiert aus types/event

interface BadgeStats {
  totalAvailable: number;
  totalEarned: number;
  secretAvailable: number;
  secretEarned: number;
}

interface AllBadgesData {
  available: any[];
  earned: any[];
}

interface DailyVerse {
  losungstext: string;
  losungsvers: string;
  lehrtext: string;
  lehrtextvers: string;
  date?: string;
  translation?: string;
  fallback?: boolean;
  cached?: boolean;
}

const KonfiDashboardPage: React.FC = () => {
  const { user, setError } = useApp();
  const [showLehrtext, setShowLehrtext] = useState(false);
  const pageRef = useRef<HTMLElement>(null);

  // --- useOfflineQuery: Dashboard ---
  const { data: dashboardData, loading: dashLoading, refresh: refreshDashboard } = useOfflineQuery<DashboardData>(
    'konfi:dashboard:' + user?.id,
    () => api.get('/konfi/dashboard').then(r => r.data),
    { ttl: CACHE_TTL.DASHBOARD }
  );

  // --- useOfflineQuery: Tageslosung ---
  const { data: dailyVerse, refresh: refreshVerse } = useOfflineQuery<DailyVerse>(
    'konfi:tageslosung:' + new Date().toISOString().split('T')[0],
    async () => {
      try {
        const response = await api.get('/konfi/tageslosung');

        if (response.data.success && response.data.data) {
          const apiData = response.data.data;
          const useLosung = Math.random() > 0.5;
          const cleanText = (text: string) => text?.replace(/\[|\]/g, '') || '';

          setShowLehrtext(useLosung);

          return {
            losungstext: cleanText(apiData.losung?.text) || "Der HERR ist mein Hirte, mir wird nichts mangeln.",
            losungsvers: apiData.losung?.reference || "Psalm 23,1",
            lehrtext: cleanText(apiData.lehrtext?.text) || "Jesus spricht: Ich bin der gute Hirte.",
            lehrtextvers: apiData.lehrtext?.reference || "Johannes 10,11",
            date: apiData.date || new Date().toLocaleDateString('de-DE', { weekday: 'long' }),
            translation: apiData.translation?.name || 'Lutherbibel 2017',
            fallback: response.data.fallback || false,
            cached: response.data.cached || false
          };
        }
        throw new Error('Invalid API response');
      } catch (err) {
        console.warn('Tageslosung konnte nicht geladen werden, verwende Fallback:', err);
        setShowLehrtext(Math.random() > 0.5);
        return {
          losungstext: "Der HERR ist mein Hirte, mir wird nichts mangeln.",
          losungsvers: "Psalm 23,1",
          lehrtext: "Jesus spricht: Ich bin der gute Hirte. Der gute Hirte lässt sein Leben für die Schafe.",
          lehrtextvers: "Johannes 10,11",
          date: new Date().toLocaleDateString('de-DE', { weekday: 'long' }),
          translation: 'Lutherbibel 2017 (Offline)',
          fallback: true
        };
      }
    },
    { ttl: CACHE_TTL.TAGESLOSUNG }
  );

  // --- useOfflineQuery: Events ---
  const { data: upcomingEvents, refresh: refreshEvents } = useOfflineQuery<Event[]>(
    'konfi:events:' + user?.id,
    () => api.get('/konfi/events').then(r => r.data),
    {
      ttl: CACHE_TTL.EVENTS,
      select: (events) => events.filter((event: any) =>
        new Date(event.event_date || event.date) >= new Date() &&
        (event.is_registered || event.booking_status === 'confirmed' || event.booking_status === 'waitlist')
      )
    }
  );

  // --- useOfflineQuery: Badges ---
  const { data: badgesRaw, refresh: refreshBadges } = useOfflineQuery<any>(
    'konfi:badges:' + user?.id,
    () => api.get('/konfi/badges').then(r => r.data),
    { ttl: CACHE_TTL.BADGES }
  );

  // Derived state from badges
  const badgeStats: BadgeStats = (() => {
    if (!badgesRaw) return { totalAvailable: 0, totalEarned: 0, secretAvailable: 0, secretEarned: 0 };
    const { available, earned, stats } = badgesRaw;
    const visibleEarned = earned?.filter((badge: any) => !badge.is_hidden).length || 0;
    const visibleTotal = stats?.totalVisible || 0;
    const secretEarned = earned?.filter((badge: any) => badge.is_hidden === true).length || 0;
    const secretTotal = stats?.totalSecret || 0;
    return { totalAvailable: visibleTotal, totalEarned: visibleEarned, secretAvailable: secretTotal, secretEarned: secretEarned };
  })();

  const allBadges: AllBadgesData = {
    available: badgesRaw?.available || [],
    earned: badgesRaw?.earned || []
  };

  // Loading nur vom Dashboard-Query bestimmt
  const loading = dashLoading;

  // Points History Modal
  const [presentPointsHistoryModal, dismissPointsHistoryModal] = useIonModal(PointsHistoryModal, {
    onClose: () => dismissPointsHistoryModal(),
    pointConfig: dashboardData?.point_config
  });

  const openPointsHistory = () => {
    presentPointsHistoryModal({
      presentingElement: pageRef.current || undefined
    });
  };

  // Memoized refresh function for live updates
  const refreshAllData = useCallback(() => {
    refreshDashboard();
    refreshEvents();
    refreshBadges();
  }, [refreshDashboard, refreshEvents, refreshBadges]);

  // Subscribe to live updates for dashboard and events
  useLiveRefresh(['dashboard', 'events', 'badges'], refreshAllData);

  const handleRefresh = async (event: CustomEvent) => {
    await Promise.all([refreshDashboard(), refreshVerse(), refreshEvents(), refreshBadges()]);
    event.detail.complete();
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Konfi Quest wird geladen..." />;
  }

  if (!dashboardData) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Konfi Quest</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <p style={{ textAlign: 'center', marginTop: '50px' }}>
            Keine Dashboard-Daten verfügbar
          </p>
        </IonContent>
      </IonPage>
    );
  }

  const pointConfig = dashboardData.point_config;
  const targetGottesdienst = pointConfig?.target_gottesdienst || 10;
  const targetGemeinde = pointConfig?.target_gemeinde || 10;
  const gottesdienstEnabled = pointConfig?.gottesdienst_enabled !== false;
  const gemeindeEnabled = pointConfig?.gemeinde_enabled !== false;

  const dashboardConfig: DashboardConfig = {
    show_konfirmation: dashboardData.dashboard_config?.show_konfirmation !== false,
    show_events: dashboardData.dashboard_config?.show_events !== false,
    show_losung: dashboardData.dashboard_config?.show_losung !== false,
    show_badges: dashboardData.dashboard_config?.show_badges !== false,
    show_ranking: dashboardData.dashboard_config?.show_ranking !== false,
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Konfi Quest</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent
        fullscreen
        style={{
          '--background': '#f8f9fa'
        }}
      >
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">
              Konfi Quest
            </IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <DashboardView
          dashboardData={dashboardData}
          dailyVerse={dailyVerse}
          badgeStats={badgeStats}
          allBadges={allBadges}
          upcomingEvents={upcomingEvents || []}
          targetGottesdienst={targetGottesdienst}
          targetGemeinde={targetGemeinde}
          gottesdienstEnabled={gottesdienstEnabled}
          gemeindeEnabled={gemeindeEnabled}
          onOpenPointsHistory={openPointsHistory}
          dashboardConfig={dashboardConfig}
        />
      </IonContent>
    </IonPage>
  );
};

export default KonfiDashboardPage;
