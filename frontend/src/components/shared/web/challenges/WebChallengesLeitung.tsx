// Die Challenges von Team und Leitung in der Web-Fassung (Browser ab 992 px),
// /admin/challenges und /teamer/challenges: Karten im Raster mit Stempel als
// Bild, Status, Zeitraum, Zielgruppe, der roten Zahl der neuen Beitraege und
// dem orangen Feld fuer Beitraege, die auf Freigabe warten -- oder dieselben
// Challenges als Tabelle. Der Umschalter Liste | Kacheln steht rechts neben
// der Suche; der Browser merkt sich die Wahl, beim ersten Oeffnen startet die
// Leitung mit der Liste, das Team mit Kacheln (components/web/useAnsicht).
// Filter (Aktuell, Geplant, Archiv, Alle, Wartet auf Freigabe -- aus
// seiten/challengesLeitung.ts, wie die Reiter der App), Zielgruppe,
// Jahrgang und eine Live-Suche gelten in beiden Ansichten gleich; "Neue
// Challenge" oeffnet den Dialog der Web-Fassung (useChallengeFormular ->
// WebChallengeDialog, 15.10.2026).
//
// Rahmen, Werkzeugzeile und Zustaende stellt WebListenSeite (10.10.2026):
// Zustand als Reiter (Zahl nach Zielgruppe, Jahrgang und Suche; orange am
// Reiter "Wartet auf Freigabe"), Zielgruppe als Chips, Jahrgang als Auswahl.
// Spalten und Karte teilt die Seite mit den Konfis (challengeSpalten,
// challengeKarte); bis dahin stand die Werkzeugleiste in einer eigenen
// Datei (WebChallengeFilter).
//
// Dieselben Daten, dieselben Zaehler und dieselben Aktionen wie die Liste
// der App (shared/ChallengesPage reicht sie herein); die Reihenfolge ist die
// der Reiter (utils/challengesWeb.ts: leitungEintraege). Was jemand sieht,
// entscheidet der Server -- hier wird nur gefiltert, was er schickt.


import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_CHALLENGE_GEFUELLT, ICON_HINZUFUEGEN } from '../../icons';
import WebKnopf from '../../../web/WebKnopf';
import WebListenSeite, { type WebListenFilter } from '../../../web/WebListenSeite';
import type { WebAktion } from '../../../web/WebListe';
import { useApp } from '../../../../contexts/AppContext';
import { useJetztMitGrenzen } from '../../../../hooks/useJetztMitGrenzen';
import { ansichtVorgabe } from '../../../web/useAnsicht';
import { challengeKarte } from './WebChallengeKarte';
import { challengeSpalten, challengeZeileKlasse } from './WebChallengesTabelle';
import WebChallengeStempel from './WebChallengeStempel';
import { AUDIENCE_LABEL } from '../../../admin/views/ChallengesManageView';
import { wartenAufFreigabe } from '../../../../utils/challengeTexte';
import { darfChallengesLoeschen } from '../../../../utils/challengeRechte';
import {
  LISTEN_FILTER,
  OHNE_AUSWAHL,
  challengeSuchtexte,
  challengesZaehlen,
  jahrgaengeDerChallenges,
  kugelAmEintrag,
  leitungEintraege,
  passtZumFilter,
  zielgruppeVon,
  type ListenAuswahl,
  type ListenEintrag,
  type ListenFilter,
} from '../../../../utils/challengesWeb';
import { suchbegriff } from '../../../../utils/supportWeb';
import type { AdminChallenge, ChallengeAudience, ChallengeMark, OffenerStempel } from '../../../../types/challenges';
import '../../../../theme/web/challenges.css';
import { leerVon, zahlTextVon } from '../../../../seiten/beschreibung';
import {
  CHALLENGES_LEITUNG_LEER_TITEL,
  CHALLENGES_LEITUNG_REITER,
  CHALLENGES_LEITUNG_TITEL,
  CHALLENGES_LEITUNG_UNTERTITEL,
  CHALLENGES_OHNE_JAHRGANG,
  CHALLENGES_REITER_BESCHRIFTUNG,
} from '../../../../seiten/challengesLeitung';

const ZIELGRUPPEN_REIHE: readonly ChallengeAudience[] = ['konfis', 'konfis_und_team', 'nur_team'];

export interface WebChallengesLeitungProps {
  challenges: AdminChallenge[];
  loading: boolean;
  /** Der Server hat die leere Liste mit "kein Jahrgang zugewiesen" begruendet. */
  ohneJahrgang: boolean;
  marks: ChallengeMark[];
  offeneStempel: OffenerStempel[];
  /** Die Zaehler der Kugeln (BadgeContext), wie in der Liste der App. */
  stand: {
    offeneFreigaben?: Record<number, number>;
    neuigkeiten?: Record<number, number>;
    neueBeitraege?: Record<number, number>;
    neueWartend?: Record<number, number>;
  };
  /** Liste dieser Rolle (/admin/challenges); eine Challenge liegt darunter. */
  listenPfad: string;
  onNeu: () => void;
  onBearbeiten: (challenge: AdminChallenge) => void;
  onLoeschen: (challenge: AdminChallenge) => void;
  /** Fuer die Modale, die auf dieser Seite aufklappen (useModalPage). */
  pageRef?: React.Ref<HTMLElement>;
}


type Eintrag = ListenEintrag<AdminChallenge>;

const WebChallengesLeitung: React.FC<WebChallengesLeitungProps> = ({
  challenges,
  loading,
  ohneJahrgang,
  marks,
  offeneStempel,
  stand,
  listenPfad,
  onNeu,
  onBearbeiten,
  onLoeschen,
  pageRef,
}) => {
  const { user } = useApp();
  const darfLoeschen = darfChallengesLoeschen(user);
  const [auswahl, setAuswahl] = useState<ListenAuswahl>({ ...OHNE_AUSWAHL, filter: 'aktuell' });

  // Defensive wie die Liste der App: kaputte oder gecachte Antworten als leer behandeln.
  const liste = useMemo(() => (Array.isArray(challenges) ? challenges : []), [challenges]);
  // Laufend, geplant und beendet folgen der Uhr, auch bei offener Seite: Beginn
  // und Ende jeder Challenge stellen einen Wecker, der die Karten genau dann
  // umsortiert (wie bei der offenen Challenge, useJetztMitGrenzen).
  const grenzen = useMemo(
    () => liste.flatMap((c) => [new Date(c.starts_at).getTime(), new Date(c.ends_at).getTime() + 1]),
    [liste],
  );
  const jetzt = useJetztMitGrenzen(grenzen);
  const eintraege = useMemo(() => leitungEintraege(liste, jetzt, stand.offeneFreigaben ?? {}), [liste, jetzt, stand.offeneFreigaben]);
  // Die Zahl am Reiter folgt Zielgruppe, Jahrgang und Suche (utils/challengesWeb.ts).
  const zaehlen = useMemo(() => challengesZaehlen(eintraege, auswahl), [eintraege, auswahl]);
  // Der Zustand des Reiters; Zielgruppe, Jahrgang und Suche filtert die Huelle.
  const imReiter = useMemo(() => eintraege.filter((e) => passtZumFilter(e, auswahl.filter)), [eintraege, auswahl.filter]);

  const zielgruppen = useMemo(
    () => ZIELGRUPPEN_REIHE.filter((z) => liste.some((c) => zielgruppeVon(c) === z)),
    [liste],
  );
  const jahrgaenge = useMemo(() => jahrgaengeDerChallenges(liste), [liste]);

  const sucht = suchbegriff(auswahl.suche) !== '';
  const filtertEin = sucht || auswahl.zielgruppe !== 'alle' || auswahl.jahrgang !== 'alle';
  const wartendGesamt = eintraege.reduce((summe, e) => summe + (e.wartend ?? 0), 0);
  const laufend = eintraege.filter((e) => e.status === 'active').length;

  const untertitel = [
    `${liste.length} ${liste.length === 1 ? 'Challenge' : 'Challenges'}`,
    laufend > 0 ? `${laufend} ${laufend === 1 ? 'läuft' : 'laufen'} gerade` : null,
    wartendGesamt > 0 ? wartenAufFreigabe(wartendGesamt) : null,
  ].filter(Boolean).join(' · ');

  const setze = (teil: Partial<ListenAuswahl>) => setAuswahl((a) => ({ ...a, ...teil }));
  const zuruecksetzen = () => setze({ zielgruppe: 'alle', jahrgang: 'alle', suche: '' });

  // Reihen, die nichts zu waehlen haetten (nur eine Zielgruppe, nur ein Jahrgang), stehen nicht da.
  const filter: Array<WebListenFilter<Eintrag> | false> = [
    zielgruppen.length > 1 && {
      beschriftung: 'Zielgruppe',
      wahlen: [
        { schluessel: 'alle', label: 'Alle' },
        ...zielgruppen.map((z) => ({ schluessel: z, label: AUDIENCE_LABEL[z], passt: (e: Eintrag) => zielgruppeVon(e.challenge) === z })),
      ],
      wert: auswahl.zielgruppe,
      onWert: (w) => setze({ zielgruppe: w as ChallengeAudience | 'alle' }),
    },
    jahrgaenge.length > 1 && {
      beschriftung: 'Jahrgang',
      darstellung: 'auswahl',
      wahlen: [
        { schluessel: 'alle', label: 'Alle Jahrgänge' },
        ...jahrgaenge.map((j) => ({
          schluessel: String(j.id),
          label: j.name,
          passt: (e: Eintrag) => (e.challenge.jahrgaenge ?? []).some((cj) => cj.id === j.id),
        })),
      ],
      wert: auswahl.jahrgang,
      onWert: (w) => setze({ jahrgang: w }),
    },
  ];

  // Dieselben Funktionen und Rechte wie in der App: Loeschen nur die Leitung.
  const bearbeiten: WebAktion<Eintrag> = {
    onKlick: (e) => onBearbeiten(e.challenge),
    beschriftung: (e) => `Bearbeiten: ${e.challenge.title}`,
    titel: () => 'Bearbeiten',
  };
  const loeschen: WebAktion<Eintrag> | undefined = darfLoeschen ? {
    onKlick: (e) => onLoeschen(e.challenge),
    beschriftung: (e) => `Löschen: ${e.challenge.title}`,
    titel: () => 'Löschen',
  } : undefined;

  // Titel, Leertexte und Reiter aus der gemeinsamen Beschreibung (seiten/challengesLeitung.ts).
  const leer = ohneJahrgang && liste.length === 0
    ? CHALLENGES_OHNE_JAHRGANG
    : filtertEin
      ? { titel: 'Keine Treffer', text: 'In dieser Auswahl gibt es keine Challenge. Ändere den Filter oder die Suche.' }
      : { titel: CHALLENGES_LEITUNG_LEER_TITEL[auswahl.filter], text: leerVon(CHALLENGES_LEITUNG_REITER, auswahl.filter) };

  const href = (c: AdminChallenge) => `${listenPfad}/${c.id}`;
  const kugel = (id: number) => kugelAmEintrag(id, stand);
  // Eingereicht ist eingereicht, auch unmoderiert (Befund M3, 27.08.2026).
  const eingereicht = (c: AdminChallenge) => (c.own_submission_count ?? 0) > 0;

  return (
    <WebListenSeite<Eintrag, ListenFilter>
      bereich="Challenges"
      titel={CHALLENGES_LEITUNG_TITEL}
      untertitel={liste.length > 0 ? untertitel : CHALLENGES_LEITUNG_UNTERTITEL}
      pageRef={pageRef}
      aktionen={(
        <WebKnopf art="primaer" onClick={onNeu}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Neue Challenge
        </WebKnopf>
      )}
      laden={loading ? { text: 'Challenges werden geladen...', karten: 3 } : undefined}
      reiter={{
        beschriftung: CHALLENGES_REITER_BESCHRIFTUNG,
        wahlen: CHALLENGES_LEITUNG_REITER,
        wert: auswahl.filter,
        onWert: (f) => setze({ filter: f }),
        // Die Chips zaehlen Challenges; nur "Wartet auf Freigabe" zaehlt die wartenden
        // Beitraege, orange und mit Satz -- der Vorlesesatz der uebrigen gilt der App.
        zahlen: Object.fromEntries(LISTEN_FILTER.map((f) => [f, zaehlen[f]])),
        farbe: { wartet: 'orange' },
        zahlTexte: { wartet: zahlTextVon(CHALLENGES_LEITUNG_REITER, 'wartet', zaehlen.wartet) },
      }}
      filter={filter}
      suche={{
        beschriftung: 'Challenges durchsuchen',
        platzhalter: 'Challenges suchen',
        wert: auswahl.suche,
        onWert: (suche) => setze({ suche }),
        felder: (e) => challengeSuchtexte(e.challenge),
      }}
      // Ohne eine einzige Challenge gibt es nichts zu filtern oder umzuschalten.
      ohneWerkzeugzeile={liste.length === 0}
      ansicht={{ seite: 'challenges-leitung', vorgabe: ansichtVorgabe(user?.role_name) }}
      eintraege={imReiter}
      liste={{
        beschriftung: 'Challenges',
        spalten: challengeSpalten<AdminChallenge>({ suche: auswahl.suche, fuer: 'leitung', href, kugel, eingereicht }),
        zeileSchluessel: (e) => e.challenge.id,
        zeileKlasse: challengeZeileKlasse,
        mittig: true,
        fest: true,
        bearbeiten,
        loeschen,
      }}
      kacheln={{
        beschriftung: 'Challenges',
        schluessel: (e) => e.challenge.id,
        karte: ({ challenge: c, status }) => {
          const k = kugel(c.id);
          return challengeKarte({
            challenge: c,
            status,
            href: href(c),
            suche: auswahl.suche,
            kugel: k,
            wartend: k.wartend,
            eingereicht: eingereicht(c),
            mitBeitraegen: true,
          });
        },
        bearbeiten,
        loeschen,
      }}
      leer={{
        icon: ICON_CHALLENGE_GEFUELLT,
        titel: leer.titel,
        text: leer.text,
        aktion: filtertEin
          ? <WebKnopf onClick={zuruecksetzen}>Auswahl zurücksetzen</WebKnopf>
          : (liste.length === 0 && !ohneJahrgang ? <WebKnopf art="primaer" onClick={onNeu}>Neue Challenge</WebKnopf> : undefined),
      }}
    >
      <WebChallengeStempel
        marks={marks}
        offeneStempel={offeneStempel}
        listenPfad={listenPfad}
        leer="Mach selbst bei einer Challenge mit — öffne sie und reiche deinen Beitrag ein."
      />
    </WebListenSeite>
  );
};

export default WebChallengesLeitung;
