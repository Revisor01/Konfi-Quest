import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IonPage } from '@ionic/react';
import ChallengeLeitungView from '../admin/views/ChallengeLeitungView';
import { getChallengeStatus } from '../admin/views/ChallengesManageView';
import ChallengeHinweis, { type ChallengeHinweisArt } from './ChallengeHinweis';
import { useApp } from '../../contexts/AppContext';
import { useBadge } from '../../contexts/BadgeContext';
import { useLiveRefresh, useLiveUpdate } from '../../contexts/LiveUpdateContext';
import { useChallengeFormular } from '../../hooks/useChallengeFormular';
import api from '../../services/api';
import { netzZuerstLaden } from '../../services/netzZuerst';
import { CACHE_TTL, offlineCache } from '../../services/offlineCache';
import { fehlerStatus, fehlerText } from '../../utils/fehler';
import { leitungChallengeListe } from '../../utils/challengeListen';
import type { AdminChallenge } from '../../types/challenges';

/**
 * Eine Challenge fuer Team und Leitung als eigene Seite
 * (/admin/challenges/:id, /teamer/challenges/:id).
 *
 * Simon, 02.10.2026, woertlich: "der umbau von challenges, so dass es analog
 * zu events funktioniert. also challenge nicht in modal öffnen, sondern in
 * unterseite, damit man direkt auf die challenge linken kann aus einem
 * push."
 *
 * Bis 2.3 ging die Challenge als Dialog aus der Liste auf und bekam ihre
 * Daten aus der Liste. Eine Seite mit eigener Adresse kann direkt aus einem
 * Push kommen, ohne dass die Liste je geladen war -- sie holt die Challenge
 * deshalb selbst: GET /challenges/admin/:id liefert genau den Eintrag der
 * Liste, mit derselben Sichtbarkeitsregel (backend/utils/
 * challengeLeitungSicht.js). Fremde Gemeinde oder geloescht: 404, nicht
 * zugewiesener Jahrgang: 403 -- beides mit Hinweis statt leerer Seite
 * (ChallengeHinweis).
 *
 * Ohne Netz zuerst der zuletzt geladene Stand dieser Challenge, sonst ihr
 * Eintrag aus der Leitungsliste -- so wie der Dialog sie aus der Liste
 * bekam. Die Beitraege laedt die Ansicht (admin/views/ChallengeLeitungView).
 *
 * Dieselbe Seite fuer Team und Leitung, wie die Liste (shared/ChallengesPage):
 * was jemand sieht und darf, entscheidet der Server.
 */
interface ChallengeLeitungPageProps {
  /** Aus der Adresse, als Zahl (MainTabs, ParamSeite). */
  challengeId: number;
  /** Zurueck: mit Verlauf zurueck, ohne (nach einem Push) auf die Liste. */
  onBack: () => void;
}

interface ChallengeLeitungInhaltProps extends ChallengeLeitungPageProps {
  /** Die IonPage der Seite -- fuer die Card-Optik der Modale. */
  seitenRef: React.RefObject<HTMLElement | null>;
}

const ChallengeLeitungInhalt: React.FC<ChallengeLeitungInhaltProps> = ({ challengeId, onBack, seitenRef }) => {
  const { user, setError } = useApp();
  const { markChallengeAsRead, refreshAllCounts } = useBadge();
  const { triggerRefresh } = useLiveUpdate();

  const [challenge, setChallenge] = useState<AdminChallenge | null>(null);
  const [hinweis, setHinweis] = useState<ChallengeHinweisArt | null>('laedt');
  // Der zuletzt gezeigte Stand -- fuer das Gelesen-Melden beim Verlassen und
  // um bei einem gescheiterten Nachladen ohne Netz nicht zu verlieren, was
  // schon da ist.
  const challengeRef = useRef<AdminChallenge | null>(null);

  const benutzerId = user?.id;
  const listenSchluessel = leitungChallengeListe(user);

  const uebernehmen = useCallback((neu: AdminChallenge | null) => {
    challengeRef.current = neu;
    setChallenge(neu);
  }, []);

  const laden = useCallback(async () => {
    try {
      const { daten } = await netzZuerstLaden<AdminChallenge>(
        `leitung:challenge:${benutzerId}:${challengeId}`,
        () => api.get(`/challenges/admin/${challengeId}`).then((res) => res.data),
        CACHE_TTL.REQUESTS
      );
      if (daten && typeof daten === 'object' && !Array.isArray(daten) && daten.id === challengeId) {
        uebernehmen(daten);
        setHinweis(null);
      } else {
        uebernehmen(null);
        setHinweis('weg');
      }
    } catch (err) {
      const status = fehlerStatus(err);
      if (status === undefined) {
        // Ohne Netz und ohne eigenen Stand: der Eintrag aus der Liste. Hat
        // die Seite schon etwas, bleibt es stehen.
        if (challengeRef.current) return;
        const liste = await offlineCache.get<AdminChallenge[]>(listenSchluessel).catch(() => null);
        const ausListe = Array.isArray(liste?.data) ? liste!.data.find((c) => c.id === challengeId) : undefined;
        if (ausListe) {
          uebernehmen(ausListe);
          setHinweis(null);
        } else {
          setHinweis('offline');
        }
      } else if (status === 404) {
        uebernehmen(null);
        setHinweis('weg');
      } else if (status === 403) {
        // Kein Fehler der App, sondern eine Antwort mit Grund (wie beim
        // Termin): Die Challenge gehoert zu keinem zugewiesenen Jahrgang
        // (error_code 'jahrgang_nicht_zugewiesen', challenges.js). Kein roter
        // Kasten, die Seite nennt den Grund.
        uebernehmen(null);
        setHinweis('jahrgang');
      } else {
        setError(fehlerText(err, 'Fehler beim Laden der Challenge'));
        if (!challengeRef.current) setHinweis('fehler');
      }
    }
  }, [challengeId, benutzerId, listenSchluessel, setError, uebernehmen]);

  useEffect(() => {
    void laden();
  }, [laden]);

  // Aenderungen anderer (Bearbeiten, Loeschen, neue Beitraege) kommen als
  // Live-Ereignis 'challenges' -- wie bei der Liste. Wird die Challenge
  // geloescht, waehrend sie offen ist, steht danach der Hinweis.
  useLiveRefresh('challenges', laden);

  // GELESEN beim Aufgehen und beim Verlassen -- wie der Dialog beim Oeffnen
  // und Schliessen (und wie der Chat beim Betreten und Verlassen eines
  // Raums). Was waehrend des Ansehens hereinkam, hat man gesehen. Entwuerfe
  // und geplante haben keine Beitraege; dort gibt es nichts zu melden, und
  // der Server kennt sie fuer mark-read nicht (404).
  // Die Funktionen ueber Refs: Das Melden beim Verlassen laeuft im Abbau
  // und braucht den neuesten Stand, ohne dass ein Wechsel der Funktion den
  // Abbau-Effekt vorzeitig ausloest (er wuerde sonst schon beim Neuzeichnen
  // "verlassen" melden).
  const markRef = useRef(markChallengeAsRead);
  const zaehlerRef = useRef(refreshAllCounts);
  useEffect(() => {
    markRef.current = markChallengeAsRead;
    zaehlerRef.current = refreshAllCounts;
  }, [markChallengeAsRead, refreshAllCounts]);

  const gesehen = useCallback(async (c: AdminChallenge) => {
    const status = getChallengeStatus(c);
    if (status !== 'active' && status !== 'ended') return;
    await markRef.current(c.id);
    void zaehlerRef.current();
  }, []);

  const gemeldetRef = useRef(false);
  useEffect(() => {
    if (!challenge || gemeldetRef.current) return;
    gemeldetRef.current = true;
    void gesehen(challenge);
  }, [challenge, gesehen]);

  useEffect(() => () => {
    if (gemeldetRef.current && challengeRef.current) void gesehen(challengeRef.current);
  }, [gesehen]);

  // Nach jeder Aenderung (Moderation, eigener Beitrag, Bearbeiten): Zaehler
  // nachziehen und die Liste dahinter neu laden. Das Live-Ereignis laedt
  // dabei auch diese Seite neu.
  const geaendert = () => {
    void refreshAllCounts();
    triggerRefresh('challenges');
  };

  // Bearbeiten-Knopf in der Leiste: dasselbe Formular wie in der Liste.
  const { bearbeiten } = useChallengeFormular({
    presentingElement: () => seitenRef.current || undefined,
    // Das Live-Ereignis laedt Liste und diese Seite neu (useLiveRefresh oben).
    onGespeichert: () => { triggerRefresh('challenges'); }
  });

  if (!challenge) {
    return (
      <ChallengeHinweis
        art={hinweis ?? 'laedt'}
        onBack={onBack}
        onNochmal={() => { setHinweis('laedt'); void laden(); }}
      />
    );
  }

  return (
    <ChallengeLeitungView
      challenge={challenge}
      onBack={onBack}
      onEdit={bearbeiten}
      onChanged={geaendert}
      seitenRef={seitenRef}
    />
  );
};

// EINE IonPage fuer alle Zustaende -- laedt, Hinweis, Challenge. Der
// IonRouterOutlet registriert die IonPage beim Einhaengen; tauschte die Seite
// sie spaeter gegen eine andere, bliebe die neue weiss (MainTabs.tsx,
// SeiteMitChunk; Test keinTauschImOutlet). Getauscht wird deshalb nur der
// Inhalt darin.
//
// Der Inhalt beginnt je Challenge frisch (key): Fuehrt ein Link von einer
// Challenge zur naechsten, steht wieder "laedt" da, und die neue wird als
// gelesen gemeldet -- wie die Huelle des frueheren Dialogs.
const ChallengeLeitungPage: React.FC<ChallengeLeitungPageProps> = ({ challengeId, onBack }) => {
  const seitenRef = useRef<HTMLElement | null>(null);
  return (
    <IonPage ref={seitenRef}>
      <ChallengeLeitungInhalt key={challengeId} challengeId={challengeId} onBack={onBack} seitenRef={seitenRef} />
    </IonPage>
  );
};

export default ChallengeLeitungPage;
