import React, { useState, useMemo } from 'react';
import {
  IonPage,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonIcon,
  useIonRouter
} from '@ionic/react';
import { ICON_HINZUFUEGEN_GEFUELLT } from './icons';
import AppKopfzeile, { AppKopfzeileGross } from './AppKopfzeile';
import { useBadge } from '../../contexts/BadgeContext';
import { useModalPage } from '../../contexts/ModalContext';
import { useLiveRefresh } from '../../contexts/LiveUpdateContext';
import api from '../../services/api';
import { useOfflineQuery } from '../../hooks/useOfflineQuery';
import { useChallengeDelete } from '../../hooks/useChallengeDelete';
import { CACHE_TTL } from '../../services/offlineCache';
import LoadingSpinner from '../common/LoadingSpinner';
import ChallengesManageView, { getChallengeStatus } from '../admin/views/ChallengesManageView';
import { useChallengeFormular } from '../../hooks/useChallengeFormular';
import { triggerPullHaptic } from '../../utils/haptics';
import type { AdminChallenge, ChallengeMark } from '../../types/challenges';
import { mitBewahrtenStempeln } from '../../utils/bewahrteStempel';
import { useApp } from '../../contexts/AppContext';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import WebChallengesLeitung from './web/challenges/WebChallengesLeitung';

// Befund N7 (27.08.2026): Diese Seite lag zweimal im Baum —
// AdminChallengesPage und TeamerChallengesPage wichen in 24 von rund 197
// Zeilen voneinander ab, groesstenteils Kommentare. Echte Unterschiede waren
// nur Cache-Key, Modal-ID, Importpfade und der Komponentenname; View und
// Modals waren ohnehin schon geteilt. Jede kuenftige Aenderung an der Seite
// haette man von Hand spiegeln muessen — genau der Naehrboden der
// Drei-Ansichten-Fehlerklasse.
//
// Die beiden Dateien bleiben als duenne Huellen bestehen, damit Routen und
// Importpfade unveraendert sind.
interface ChallengesPageProps {
  // Trennt die Zwischenspeicher der Rollen. Die Teamer-Sicht haengt zusaetzlich
  // an der Person, weil das Backend nach zugewiesenen Jahrgaengen filtert —
  // zwei Teamer:innen derselben Organisation sehen NICHT dasselbe.
  cacheKey: string;
  // Eigene Modal-Seiten-ID je Rolle (useModalPage verwaltet den Stapel).
  modalPageId: string;
  // Pfad der Liste dieser Rolle ('/admin/challenges', '/teamer/challenges').
  // Eine Challenge oeffnet sich darunter als eigene Seite (2.4.0).
  listenPfad: string;
}

/**
 * Gehoert diese Challenge ueberhaupt ins Stempelraster? (Befund Simon,
 * 18.09.2026, woertlich: "er zeigt mir, zumindest im admin, challenge
 * stempel an, die noch auf entwurf oder geplant stehen. dass man die
 * erreichen koennte. stempel duerfen nur fuer laufende oder vergangene
 * angezeigt werden. ob erreicht oder nicht.")
 *
 * WIE DER FEHLER ENTSTAND: Die Ableitung darunter hat die Rechnung aus
 * GET /challenges/konfi uebernommen (`has_badge` -> erhalten, sonst mit
 * badge_name -> offen), aber nicht deren VORBEDINGUNG. Dort steht im SQL
 * `is_draft = false AND starts_at <= NOW()`; die Konfi-Ansicht bekommt also
 * nie einen Entwurf zu sehen. GET /challenges/admin liefert dagegen
 * absichtlich JEDE Challenge der Gemeinde -- die Verwaltung muss Entwuerfe
 * bearbeiten koennen. Dieselbe Datei zeigte eine Challenge damit oben
 * korrekt im Reiter "Geplant" und unten gleichzeitig als Stempel, den es zu
 * holen gaebe.
 *
 * 'active' | 'ended' ist genau das Gegenstueck zum SQL-WHERE: 'draft' und
 * 'scheduled' sind die einzigen anderen Werte (siehe deriveStatus im
 * Backend bzw. getChallengeStatus nebenan).
 */
export const gehoertInsStempelraster = (
  c: Pick<AdminChallenge, 'is_draft' | 'starts_at' | 'ends_at'>,
  jetzt: number = Date.now()
): boolean => {
  const status = getChallengeStatus(c as AdminChallenge, jetzt);
  return status === 'active' || status === 'ended';
};

const ChallengesPage: React.FC<ChallengesPageProps> = ({ cacheKey, modalPageId, listenPfad }) => {
  // pendingChallengesByChallenge: offene Freigaben je Challenge fuer das
  // orange Eck-Badge am Listeneintrag (25.09.2026) -- dieselbe Quelle wie
  // der Reiter, statt pending_count aus der nur bei Aktion neu geladenen Liste.
  // challengeNeueBeitraegeByChallenge: neue Beitraege seit dem letzten
  // Oeffnen, wartende eingeschlossen (29.09.2026) -- die rote Kugel am
  // Symbol; die Seite der Challenge (shared/ChallengeLeitungPage) setzt sie
  // beim Aufgehen und Verlassen zurueck. challengeUpdatesByChallenge (neue
  // freigegebene) nur noch fuer den Rueckfall, wenn der Server das neue Feld
  // nicht liefert.
  const {
    pendingChallengesByChallenge,
    challengeUpdatesByChallenge,
    challengeNeueBeitraegeByChallenge,
    challengeNeueWartendByChallenge
  } = useBadge();
  const { pageRef, presentingElement } = useModalPage(modalPageId);
  const { user } = useApp();
  const router = useIonRouter();

  // Admin/Teamer ohne Jahrgangs-Zuweisung bekommt vom Server eine leere
  // Liste -- gueltig (Simons Entscheidung 31.08.2026), aber ohne Erklaerung
  // sah das nach kaputter App aus. Der Server meldet den Grund per Header
  // (challenges.js GET /admin), dasselbe Muster wie die Konfi-Liste
  // (AdminKonfisPage). Offline aus dem Cache laeuft diese Funktion nicht,
  // der Hinweis erscheint dann bewusst nicht -- ein leerer Cache ist etwas
  // anderes als "kein Jahrgang".
  const [ohneJahrgang, setOhneJahrgang] = useState(false);

  const { data: challenges, loading, refresh: refreshChallenges, refreshLive: refreshChallengesLive } = useOfflineQuery<AdminChallenge[]>(
    cacheKey,
    async () => {
      const res = await api.get('/challenges/admin');
      setOhneJahrgang(res.headers?.['x-kein-jahrgang-zugewiesen'] === 'true');
      return res.data;
    },
    { ttl: CACHE_TTL.REQUESTS }
  );

  // Stempel aus Challenges, die es nicht mehr gibt (28.09.2026): Loescht die
  // Leitung einen Jahrgang, gehen seine Challenges mit -- die Stempel des
  // Teams daraus bewahrt der Server auf. In GET /challenges/admin stehen sie
  // nicht mehr (die Challenge ist weg), deshalb eine eigene, kleine Abfrage.
  // Ein aelterer Server kennt die Route nicht: dann bleibt es bei den
  // abgeleiteten Stempeln (mitBewahrtenStempeln nimmt alles Nicht-Array als
  // leer).
  const { data: bewahrteStempel, refreshLive: refreshBewahrteLive } = useOfflineQuery<ChallengeMark[]>(
    `challenges:bewahrte-stempel:${user?.organization_id}:${user?.id}`,
    async () => (await api.get('/challenges/bewahrte-stempel')).data,
    { ttl: CACHE_TTL.REQUESTS }
  );

  // Eigene Stempel aus der EINEN Liste ableiten: has_badge liefert
  // GET /challenges/admin seit der Zusammenlegung mit (11.08.) — dadurch
  // braucht es keinen zweiten Endpunkt für die Teilnehmer-Sicht.
  const abgeleiteteMarks = useMemo(
    () => (Array.isArray(challenges) ? challenges : [])
      .filter((c) => c.has_badge && gehoertInsStempelraster(c))
      .map((c) => ({
        challenge_id: c.id,
        badge_icon: c.badge_icon,
        badge_name: c.badge_name,
        title: c.title,
        // earned_at und description gehoeren zum Stempel, nicht nur zur
        // Kachel: Das Popover zeigt daraus "Erhalten am ..." und den Text.
        // Ohne sie stand dort eine leere Karte (16.09.2026).
        earned_at: c.earned_at ?? null,
        description: c.description ?? null
      })),
    [challenges]
  );
  const marks = useMemo(
    () => mitBewahrtenStempeln(abgeleiteteMarks, bewahrteStempel),
    [abgeleiteteMarks, bewahrteStempel]
  );

  // Die NOCH NICHT erhaltenen Stempel — dieselbe Rechnung wie in der
  // Konfi-Liste (backend/routes/challenges.js, GET /challenges/konfi:
  // `if (has_badge) marks.push(...) else if (badge_name) offene.push(...)`).
  //
  // WARUM HIER UND NICHT IM SERVER (16.09.2026, Simons Befund: "aber die
  // nicht erreichten sind nicht da, und bei klick gibt es keine infos,
  // obwohl wir das ja bei konfis und admins laengst haben, das darf doch
  // auch an nur einer stelle programmiert werden"): GET /challenges/admin
  // liefert bereits JEDE Challenge samt badge_name und status — die Angaben
  // sind da, sie wurden nur nie zu offenen Stempeln zusammengefasst. Ein
  // zweiter Endpunkt waere eine zweite Quelle fuer dieselbe Liste.
  //
  // Angezeigt wird das Ergebnis von ChallengeStempelSektion — DERSELBEN
  // Komponente, aus der auch Konfi-Ansicht (konfi/views/ChallengesView.tsx)
  // und Leitungs-Detailansicht (admin/views/KonfiDetailView.tsx) lesen.
  const offeneStempel = useMemo(
    () => (Array.isArray(challenges) ? challenges : [])
      .filter((c) => !c.has_badge && !!c.badge_name && gehoertInsStempelraster(c))
      .map((c) => ({
        challenge_id: c.id,
        badge_icon: c.badge_icon,
        badge_name: c.badge_name,
        title: c.title,
        description: c.description ?? null,
        status: c.status,
        ends_at: c.ends_at ?? null
      })),
    [challenges]
  );

  // Anlegen (Plus oben) und Bearbeiten (Wisch) -- dasselbe Formular wie auf
  // der Seite einer Challenge, samt Rueckfrage bei ungespeicherten
  // Aenderungen (hooks/useChallengeFormular).
  const { anlegen: openCreate, bearbeiten: openEdit } = useChallengeFormular({
    presentingElement: () => presentingElement,
    onGespeichert: () => { refreshChallenges(); }
  });

  useLiveRefresh('challenges', refreshChallengesLive);
  useLiveRefresh('challenges', refreshBewahrteLive);

  // Eine Challenge oeffnet sich als eigene Seite, nicht mehr im Dialog
  // (2.4.0, Simon 02.10.2026: "challenge nicht in modal öffnen, sondern in
  // unterseite, damit man direkt auf die challenge linken kann aus einem
  // push"). Dieselbe Adresse fuehrt aus Push und Postfach hinein
  // (utils/pushNavigation.ts). Gelesen-Melden, Moderation, eigener Beitrag
  // und Bearbeiten stehen jetzt dort (shared/ChallengeLeitungPage).
  const openChallenge = (challenge: AdminChallenge) => {
    router.push(`${listenPfad}/${challenge.id}`);
  };

  const { handleDelete } = useChallengeDelete({ onDeleted: refreshChallenges });

  // Zwei Gesichter, eine Seite (docs/planung/web-alle-bereiche.md, Entscheidung
  // 1): im breiten Browserfenster (ab 992 px) die Web-Fassung -- Karten im
  // Raster mit Filtern --, sonst die Darstellung der App, unveraendert. Beide
  // lesen dieselben Daten, Zaehler und Aktionen von hier.
  const breit = useBreitesLayout();
  if (breit) {
    return (
      <WebChallengesLeitung
        challenges={Array.isArray(challenges) ? challenges : []}
        loading={loading}
        ohneJahrgang={ohneJahrgang}
        marks={marks}
        offeneStempel={offeneStempel}
        stand={{
          offeneFreigaben: pendingChallengesByChallenge,
          neuigkeiten: challengeUpdatesByChallenge,
          neueBeitraege: challengeNeueBeitraegeByChallenge ?? undefined,
          neueWartend: challengeNeueWartendByChallenge,
        }}
        listenPfad={listenPfad}
        onNeu={openCreate}
        onBearbeiten={openEdit}
        onLoeschen={handleDelete}
        pageRef={pageRef}
      />
    );
  }

  return (
    <IonPage ref={pageRef}>
      <AppKopfzeile
        titel="Challenges"
        rechts={(
          <IonButton aria-label="Neue Challenge anlegen" onClick={openCreate} title="Neue Challenge">
            <IonIcon icon={ICON_HINZUFUEGEN_GEFUELLT} />
          </IonButton>
        )}
      />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Challenges" />

        <IonRefresher
          slot="fixed"
          onIonRefresh={(e) => { refreshChallenges(); e.detail.complete(); }}
          onIonPull={triggerPullHaptic}
        >
          <IonRefresherContent />
        </IonRefresher>

        {loading ? (
          <LoadingSpinner message="Challenges werden geladen..." />
        ) : (
          <ChallengesManageView
            challenges={challenges || []}
            ohneJahrgang={ohneJahrgang}
            marks={marks}
            offeneStempel={offeneStempel}
            offeneFreigaben={pendingChallengesByChallenge}
            neuigkeiten={challengeUpdatesByChallenge}
            neueBeitraege={challengeNeueBeitraegeByChallenge ?? undefined}
            neueWartend={challengeNeueWartendByChallenge}
            onSelectChallenge={openChallenge}
            onEditChallenge={openEdit}
            onDeleteChallenge={handleDelete}
            presentingElement={pageRef.current || presentingElement}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default ChallengesPage;
