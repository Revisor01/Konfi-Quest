import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonRefresher,
  IonRefresherContent
} from '@ionic/react';
import { arrowBack } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { normalisiereTeamerBadges } from '../teamerBadges';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import { useBadge } from '../../../contexts/BadgeContext';
import { CACHE_TTL } from '../../../services/offlineCache';
import LoadingSpinner from '../../common/LoadingSpinner';
import BadgesView from '../../konfi/views/BadgesView';
import { triggerPullHaptic } from '../../../utils/haptics';
import { writeQueue } from '../../../services/writeQueue';
import { networkMonitor } from '../../../services/networkMonitor';
import { safeUUID } from '../../../utils/uuid';

interface TeamerBadgeAPI {
  id: number;
  name: string;
  description?: string;
  icon: string;
  criteria_type: string;
  criteria_value: number;
  criteria_extra?: string;
  is_hidden: boolean;
  is_active: boolean;
  color?: string;
  earned: boolean;
  earned_at?: string;
  progress?: { current: number; target: number; percentage: number };
}

// Gleiche Antwortform wie GET /konfi/badges: { available, earned, stats }.
// Bis 28.08.2026 lieferte der Teamer-Pfad ein flaches Array plus Zaehler in
// Kopfzeilen — die gingen im Zwischenspeicher verloren und mussten an die
// Liste geheftet werden.
interface TeamerBadgeResponse {
  available: TeamerBadgeAPI[];
  earned: TeamerBadgeAPI[];
  stats: { totalVisible: number; totalSecret: number };
}

const TeamerBadgesPage: React.FC = () => {
  const { user } = useApp();
  const [selectedFilter, setSelectedFilter] = useState('alle');

  // Schluessel mit v2: Im Zwischenspeicher koennen noch flache Arrays der
  // alten Antwortform liegen — die sollen nicht als neue Form gelesen werden.
  const { data: badgesData, loading, refresh, refreshLive } = useOfflineQuery<TeamerBadgeResponse>(
    'teamer:badges:v2:' + user?.id,
    async () => {
      const res = await api.get('/teamer/badges');
      // Beide Antwortformen lesen — siehe teamerBadges.ts.
      return normalisiereTeamerBadges<TeamerBadgeAPI>(res.data, res.headers);
    },
    { ttl: CACHE_TTL.BADGES }
  );

  // Das Backend sendet 'badges' gezielt an Teamer:innen (routes/teamer.js:796),
  // es fehlte nur der Empfaenger (Befund 25.08.2026).
  useLiveRefresh(['badges'], useCallback(() => { refreshLive(); }, [refreshLive]));

  // Beim Oeffnen der Seite gelten die Abzeichen als gesehen -- damit
  // verschwindet der Zaehler am Reiter. Bis 27.08.2026 rief das niemand auf,
  // obwohl der Endpunkt seit jeher existiert (teamer.js:544): 'seen' blieb
  // fuer Teamer:innen dauerhaft false, ein neues Abzeichen wurde nie als neu
  // angezeigt (Befund H1).
  //
  // Anders als bei den Konfis liefert die Teamer-Liste kein 'seen' je Abzeichen
  // mit -- markiert wird deshalb pauschal beim Oeffnen, genau dafuer ist der
  // schlanke Endpunkt gedacht. Der Ref verhindert, dass jedes Neuladen
  // (Live-Update, Pull-to-Refresh) einen weiteren Aufruf ausloest.
  // Seit der Zaehler-Konsolidierung (27.08.2026) kommt die Zahl aus dem
  // BadgeContext -- refreshAllCounts() ist jetzt der richtige und einzige Weg.
  // Vorher brauchte es hier triggerRefresh('badges'), weil der Zaehler als
  // einziger an einem anderen Mechanismus hing.
  const { refreshAllCounts } = useBadge();
  const bereitsMarkiert = useRef(false);
  useEffect(() => {
    if (bereitsMarkiert.current) return;
    bereitsMarkiert.current = true;

    if (!networkMonitor.isOnline) {
      writeQueue.enqueue({
        method: 'PUT',
        url: '/teamer/badges/mark-seen',
        maxRetries: 3,
        hasFileUpload: false,
        metadata: { type: 'fire-and-forget', clientId: safeUUID(), label: 'Abzeichen gesehen' },
      });
      return;
    }
    api.put('/teamer/badges/mark-seen')
      .then(() => { refreshAllCounts(); })
      .catch((markError) => {
        console.warn('Abzeichen konnten nicht als gesehen markiert werden:', markError);
      });
  }, [refreshAllCounts]);

  // Wie beim Konfi: verdiente und offene Abzeichen kommen getrennt und
  // werden fuer die Ansicht zusammengefuehrt.
  const badges = [...(badgesData?.earned || []), ...(badgesData?.available || [])];

  // Normalisierung: API-Felder (earned/progress) auf BadgesView-Felder
  // (is_earned/progress_points) — identisch zum Konfi-Weg (KonfiBadgesPage).
  const processedBadges = badges.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    icon: b.icon,
    criteria_type: b.criteria_type,
    criteria_value: b.criteria_value,
    criteria_extra: b.criteria_extra,
    is_hidden: b.is_hidden,
    is_active: b.is_active,
    color: b.color,
    is_earned: b.earned,
    earned_at: b.earned_at,
    progress_points: b.progress?.current ?? 0,
    progress_percentage: b.progress?.percentage ?? 0
  }));

  // Direkt aus der Antwort statt selbst gezaehlt: Der Server kennt auch die
  // zurueckgehaltenen (unverdienten geheimen) Abzeichen.
  const badgeStats = badgesData?.stats || { totalVisible: 0, totalSecret: 0 };

  if (loading) {
    return <LoadingSpinner message="Badges werden geladen..." />;
  }

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => window.history.back()} aria-label="Zurück">
              <IonIcon icon={arrowBack} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>Teamer-Badges</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Teamer-Badges</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={async (e) => {
          await refresh();
          e.detail.complete();
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        <BadgesView
          badges={processedBadges}
          badgeStats={badgeStats}
          selectedFilter={selectedFilter}
          onFilterChange={setSelectedFilter}
        />
      </IonContent>
    </IonPage>
  );
};

export default TeamerBadgesPage;
