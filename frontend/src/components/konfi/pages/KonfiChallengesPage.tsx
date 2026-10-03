import React, { useCallback } from 'react';
import {
  IonPage,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  useIonRouter
} from '@ionic/react';
import { useApp } from '../../../contexts/AppContext';
import AppKopfzeile, { AppKopfzeileGross } from '../../shared/AppKopfzeile';
import { useBadge } from '../../../contexts/BadgeContext';
import { useModalPage } from '../../../contexts/ModalContext';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../../services/offlineCache';
import api from '../../../services/api';
import LoadingSpinner from '../../common/LoadingSpinner';
import ChallengesView from '../views/ChallengesView';
import { triggerPullHaptic } from '../../../utils/haptics';
import { konfiChallengeListe } from '../../../utils/challengeListen';
import { useBreitesLayout } from '../../../navigation/breitesLayout';
import WebKonfiChallenges from '../web/challenges/WebKonfiChallenges';
import type { KonfiChallenge, KonfiChallengesResponse } from '../../../types/challenges';

const EMPTY_RESPONSE: KonfiChallengesResponse = { active: [], archive: [], marks: [], offene_stempel: [] };

const KonfiChallengesPage: React.FC = () => {
  const { user } = useApp();
  // Neuigkeiten je Challenge aus derselben Quelle wie die Zahl am Reiter --
  // der Eintrag zeigt, WO es Neues gibt, der Reiter WIE VIEL insgesamt.
  const { challengeUpdatesByChallenge } = useBadge();
  const { pageRef } = useModalPage('konfi-challenges');
  const router = useIonRouter();

  // Schluessel in utils/challengeListen.ts: Die Seite einer Challenge liest
  // diese Liste ohne Netz mit.
  const { data, loading, refresh, refreshLive } = useOfflineQuery<KonfiChallengesResponse>(
    konfiChallengeListe(user),
    () => api.get('/challenges/konfi').then((r) => r.data),
    { ttl: CACHE_TTL.REQUESTS }
  );

  // Defensive: bei kaputten/alten Cache-Eintraegen auf leere Listen fallen.
  const response = data && typeof data === 'object' ? data : EMPTY_RESPONSE;
  const active = Array.isArray(response.active) ? response.active : [];
  const archive = Array.isArray(response.archive) ? response.archive : [];
  const marks = Array.isArray(response.marks) ? response.marks : [];
  // Noch nicht erhaltene Stempel (grau). Faellt still weg, wenn ein alter
  // Cache-Eintrag oder ein aelterer Server das Feld nicht traegt.
  const offeneStempel = Array.isArray(response.offene_stempel) ? response.offene_stempel : [];

  useLiveRefresh('challenges', refreshLive);

  // Eine Challenge oeffnet sich als eigene Seite, nicht mehr im Dialog
  // (2.4.0, Simon 02.10.2026: "challenge nicht in modal öffnen, sondern in
  // unterseite, damit man direkt auf die challenge linken kann aus einem
  // push"). Dieselbe Adresse fuehrt aus Push und Postfach hinein
  // (utils/pushNavigation.ts). Mitmachen und Gelesen-Melden stehen jetzt
  // dort (KonfiChallengeDetailPage).
  const handleSelectChallenge = useCallback((challenge: KonfiChallenge) => {
    router.push(`/konfi/challenges/${challenge.id}`);
  }, [router]);

  // Zwei Gesichter, eine Seite (docs/planung/web-alle-bereiche.md, Entscheidung
  // 1): im breiten Browserfenster (ab 992 px) die Web-Fassung -- Karten im
  // Raster mit Filtern --, sonst die Darstellung der App, unveraendert.
  const breit = useBreitesLayout();
  if (breit) {
    return (
      <WebKonfiChallenges
        active={active}
        archive={archive}
        marks={marks}
        offeneStempel={offeneStempel}
        neuigkeiten={challengeUpdatesByChallenge}
        loading={loading && !data}
        pageRef={pageRef}
      />
    );
  }

  return (
    <IonPage ref={pageRef}>
      <AppKopfzeile titel="Challenges" />

      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Challenges" />

        <IonRefresher
          slot="fixed"
          onIonRefresh={async (e) => {
            await refresh();
            e.detail.complete();
          }}
          onIonPull={triggerPullHaptic}
        >
          <IonRefresherContent />
        </IonRefresher>

        {loading && !data ? (
          <LoadingSpinner message="Challenges werden geladen..." />
        ) : (
          <ChallengesView
            active={active}
            archive={archive}
            marks={marks}
            offeneStempel={offeneStempel}
            neuigkeiten={challengeUpdatesByChallenge}
            onSelectChallenge={handleSelectChallenge}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default KonfiChallengesPage;
