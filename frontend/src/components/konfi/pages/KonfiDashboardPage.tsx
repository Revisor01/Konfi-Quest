import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';
import DashboardView from '../views/DashboardView';
import PointsHistoryModal from '../modals/PointsHistoryModal';

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
}

interface Event {
  id: number;
  title: string;
  event_date: string;
  date?: string;
  start_time?: string;
  location?: string;
  registered: boolean;
  is_registered?: boolean;
}

interface Settings {
  target_gottesdienst?: number;
  target_gemeinde?: number;
}

interface BadgeStats {
  totalAvailable: number;
  totalEarned: number;
  secretAvailable: number;
  secretEarned: number;
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
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [dailyVerse, setDailyVerse] = useState<DailyVerse | null>(null);
  const [showLehrtext, setShowLehrtext] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [badgeStats, setBadgeStats] = useState<BadgeStats>({ totalAvailable: 0, totalEarned: 0, secretAvailable: 0, secretEarned: 0 });
  const [loading, setLoading] = useState(true);
  const pageRef = useRef<HTMLElement>(null);

  // Points History Modal
  const [presentPointsHistoryModal, dismissPointsHistoryModal] = useIonModal(PointsHistoryModal, {
    onClose: () => dismissPointsHistoryModal()
  });

  const openPointsHistory = () => {
    presentPointsHistoryModal({
      presentingElement: pageRef.current || undefined
    });
  };


  // Memoized refresh function for live updates
  const refreshAllData = useCallback(() => {
    console.log('Live Update: Refreshing dashboard data...');
    loadDashboardData();
    loadUpcomingEvents();
    loadBadgeStats();
  }, []);

  // Subscribe to live updates for dashboard and events
  useLiveRefresh(['dashboard', 'events', 'badges'], refreshAllData);

  useEffect(() => {
    loadDashboardData();
    loadDailyVerse();
    loadUpcomingEvents();
    loadBadgeStats();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [dashboardResponse, settingsResponse] = await Promise.all([
        api.get('/konfi/dashboard'),
        api.get('/settings').catch(() => ({ data: {} }))
      ]);
      
      setDashboardData(dashboardResponse.data);
      setSettings(settingsResponse.data);
    } catch (err) {
      setError('Fehler beim Laden der Dashboard-Daten');
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDailyVerse = async () => {
    try {
      // Echte Tageslosung von API laden
      const response = await api.get('/konfi/tageslosung');
      
      if (response.data.success && response.data.data) {
        const apiData = response.data.data;
        
        // Random zwischen Losung und Lehrtext wählen
        const useLosung = Math.random() > 0.5;
        
        // Entferne eckige Klammern aus den Texten
        const cleanText = (text: string) => text?.replace(/\[|\]/g, '') || '';
        
        setDailyVerse({
          losungstext: cleanText(apiData.losung?.text) || "Der HERR ist mein Hirte, mir wird nichts mangeln.",
          losungsvers: apiData.losung?.reference || "Psalm 23,1",
          lehrtext: cleanText(apiData.lehrtext?.text) || "Jesus spricht: Ich bin der gute Hirte.",
          lehrtextvers: apiData.lehrtext?.reference || "Johannes 10,11",
          date: apiData.date || new Date().toLocaleDateString('de-DE', { weekday: 'long' }),
          translation: apiData.translation?.name || 'Lutherbibel 2017',
          fallback: response.data.fallback || false,
          cached: response.data.cached || false
        });
        
        setShowLehrtext(useLosung);
      } else {
        throw new Error('Invalid API response');
      }
    } catch (err) {
      console.log('Could not load daily verse from API, using fallback:', err);
      
      // Fallback-Daten wenn API nicht funktioniert
      const fallbackVerses = [
        {
          losungstext: "Der HERR ist mein Hirte, mir wird nichts mangeln.",
          losungsvers: "Psalm 23,1",
          lehrtext: "Jesus spricht: Ich bin der gute Hirte. Der gute Hirte lässt sein Leben für die Schafe.",
          lehrtextvers: "Johannes 10,11"
        }
      ];
      
      const randomVerse = fallbackVerses[0];
      setShowLehrtext(Math.random() > 0.5);
      
      setDailyVerse({
        ...randomVerse,
        date: new Date().toLocaleDateString('de-DE', { weekday: 'long' }),
        translation: 'Lutherbibel 2017 (Offline)',
        fallback: true
      });
    }
  };

  const loadUpcomingEvents = async () => {
    try {
      const response = await api.get('/konfi/events');
      // Show ALL upcoming events where konfi is registered or on waitlist (no limit!)
      const registeredEvents = response.data
        .filter((event: any) =>
          new Date(event.event_date || event.date) >= new Date() &&
          (event.is_registered || event.booking_status === 'confirmed' || event.booking_status === 'waitlist')
        );
      setUpcomingEvents(registeredEvents);
    } catch (err) {
      console.error('Error loading events:', err);
      // Events nicht kritisch für Dashboard
    }
  };

  const loadBadgeStats = async () => {
    try {
      const response = await api.get('/konfi/badges');
      const { available, earned, stats } = response.data;
      
      // Count visible badges earned vs available
      const visibleEarned = earned.filter((badge: any) => !badge.is_hidden).length;
      const visibleTotal = stats?.totalVisible || 0;
      
      // Count secret badges earned vs total secret
      const secretEarned = earned.filter((badge: any) => badge.is_hidden === true).length;
      const secretTotal = stats?.totalSecret || 0;
      
      setBadgeStats({
        totalAvailable: visibleTotal,
        totalEarned: visibleEarned, 
        secretAvailable: secretTotal,
        secretEarned: secretEarned
      });
    } catch (err) {
      console.error('Error loading badge stats:', err);
      // Badge stats nicht kritisch für Dashboard
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await Promise.all([loadDashboardData(), loadDailyVerse(), loadUpcomingEvents(), loadBadgeStats()]);
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

  const targetGottesdienst = settings.target_gottesdienst || 10;
  const targetGemeinde = settings.target_gemeinde || 10;

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
          <IonToolbar style={{ '--background': 'transparent', '--color': 'black' }}>
            <IonTitle size="large" style={{ color: 'black', fontWeight: '700' }}>
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
          upcomingEvents={upcomingEvents}
          targetGottesdienst={targetGottesdienst}
          targetGemeinde={targetGemeinde}
          onOpenPointsHistory={openPointsHistory}
        />
      </IonContent>
    </IonPage>
  );
};

export default KonfiDashboardPage;