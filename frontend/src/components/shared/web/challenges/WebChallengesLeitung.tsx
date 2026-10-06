// Die Challenges von Team und Leitung in der Web-Fassung (Browser ab 992 px),
// /admin/challenges und /teamer/challenges: Karten im Raster mit Stempel als
// Bild, Status, Zeitraum, Zielgruppe, der roten Zahl der neuen Beitraege und
// dem orangen Feld fuer Beitraege, die auf Freigabe warten -- oder dieselben
// Challenges als Tabelle. Der Umschalter Liste | Kacheln steht rechts neben
// der Suche; der Browser merkt sich die Wahl, beim ersten Oeffnen startet die
// Leitung mit der Liste, das Team mit Kacheln (components/web/useAnsicht).
// Filter (laufend, geplant, beendet, wartet auf Freigabe), Zielgruppe,
// Jahrgang und eine Live-Suche gelten in beiden Ansichten gleich; "Neue
// Challenge" oeffnet das Formular der App (useChallengeFormular ->
// ChallengeManageModal).
//
// Dieselben Daten, dieselben Zaehler und dieselben Aktionen wie die Liste
// der App (shared/ChallengesPage reicht sie herein); die Reihenfolge ist die
// der Reiter (utils/challengesWeb.ts: leitungEintraege). Was jemand sieht,
// entscheidet der Server -- hier wird nur gefiltert, was er schickt.

import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_BEARBEITEN, ICON_CHALLENGE_GEFUELLT, ICON_HINZUFUEGEN, ICON_LOESCHEN } from '../../icons';
import WebSeite from '../../../web/WebSeite';
import WebKnopf from '../../../web/WebKnopf';
import { WebLaden, WebLeer } from '../../../web/WebZustaende';
import { useApp } from '../../../../contexts/AppContext';
import { useJetztMitGrenzen } from '../../../../hooks/useJetztMitGrenzen';
import { ansichtVorgabe, useAnsicht } from '../../../web/useAnsicht';
import WebChallengeKarte from './WebChallengeKarte';
import WebChallengeFilter from './WebChallengeFilter';
import WebChallengesTabelle from './WebChallengesTabelle';
import WebChallengeStempel from './WebChallengeStempel';
import { wartenAufFreigabe } from '../../../../utils/challengeTexte';
import { darfChallengesLoeschen } from '../../../../utils/challengeRechte';
import {
  LISTEN_FILTER,
  OHNE_AUSWAHL,
  challengesFiltern,
  challengesZaehlen,
  jahrgaengeDerChallenges,
  kugelAmEintrag,
  leitungEintraege,
  zielgruppeVon,
  type ListenAuswahl,
  type ListenFilter,
} from '../../../../utils/challengesWeb';
import { suchbegriff } from '../../../../utils/supportWeb';
import type { AdminChallenge, ChallengeAudience, ChallengeMark, OffenerStempel } from '../../../../types/challenges';
import '../../../../theme/web/challenges.css';

/** Wortgleich mit der Liste der App (ChallengesManageView): derselbe Grund, dieselben Worte. */
const OHNE_JAHRGANG = {
  titel: 'Kein Jahrgang zugewiesen',
  text: 'Dir ist noch kein Jahrgang zugewiesen, deshalb siehst du hier keine Challenges. Die Gemeindeleitung kann das in den Einstellungen ändern.',
};

const LEER: Record<ListenFilter, { titel: string; text: string }> = {
  laufend: { titel: 'Gerade läuft keine Challenge', text: 'Lege eine Challenge an, damit deine Konfis eigene Beiträge einreichen können' },
  geplant: { titel: 'Nichts in Planung', text: 'Entwürfe und Challenges mit einem Startdatum in der Zukunft erscheinen hier' },
  beendet: { titel: 'Noch nichts im Archiv', text: 'Beendete Challenges sammeln sich hier — mit allen Beiträgen zum Nachlesen' },
  alle: { titel: 'Noch keine Challenge', text: 'Lege eine Challenge an, damit deine Konfis eigene Beiträge einreichen können' },
  wartet: { titel: 'Nichts wartet auf Freigabe', text: 'Beiträge, die du freigeben sollst, erscheinen hier — mit der Challenge, zu der sie gehören.' },
};

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
  const [ansicht, setAnsicht] = useAnsicht('challenges-leitung', ansichtVorgabe(user?.role_name));
  const [auswahl, setAuswahl] = useState<ListenAuswahl>({ ...OHNE_AUSWAHL, filter: 'laufend' });

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
  const zaehlen = useMemo(() => challengesZaehlen(eintraege, auswahl), [eintraege, auswahl]);
  const sichtbar = useMemo(() => challengesFiltern(eintraege, auswahl), [eintraege, auswahl]);

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

  const zuruecksetzen = () => setAuswahl((a) => ({ ...a, zielgruppe: 'alle', jahrgang: 'alle', suche: '' }));

  let inhalt: React.ReactNode;
  if (loading) {
    inhalt = <WebLaden karten={3} text="Challenges werden geladen..." />;
  } else {
    const leer = ohneJahrgang && liste.length === 0
      ? OHNE_JAHRGANG
      : filtertEin
        ? { titel: 'Keine Treffer', text: 'In dieser Auswahl gibt es keine Challenge. Ändere den Filter oder die Suche.' }
        : LEER[auswahl.filter];
    inhalt = (
      <>
        {liste.length > 0 && (
          <WebChallengeFilter
            chips={LISTEN_FILTER.map((wert) => (wert === 'wartet'
              ? { wert, zahl: zaehlen[wert], ton: 'orange' as const, zahlText: 'Beiträge warten auf Freigabe' }
              : { wert, zahl: zaehlen[wert] }))}
            filter={auswahl.filter}
            onFilter={(filter) => setAuswahl((a) => ({ ...a, filter }))}
            suche={auswahl.suche}
            onSuche={(suche) => setAuswahl((a) => ({ ...a, suche }))}
            ansicht={ansicht}
            onAnsicht={setAnsicht}
            zielgruppen={zielgruppen}
            zielgruppe={auswahl.zielgruppe}
            onZielgruppe={(zielgruppe) => setAuswahl((a) => ({ ...a, zielgruppe }))}
            jahrgaenge={jahrgaenge}
            jahrgang={auswahl.jahrgang}
            onJahrgang={(jahrgang) => setAuswahl((a) => ({ ...a, jahrgang }))}
          />
        )}

        {sichtbar.length === 0 ? (
          <div className="web-karte">
            <WebLeer
              icon={ICON_CHALLENGE_GEFUELLT}
              titel={leer.titel}
              text={leer.text}
              aktion={filtertEin
                ? <WebKnopf onClick={zuruecksetzen}>Auswahl zurücksetzen</WebKnopf>
                : (liste.length === 0 && !ohneJahrgang ? <WebKnopf art="primaer" onClick={onNeu}>Neue Challenge</WebKnopf> : undefined)}
            />
          </div>
        ) : ansicht === 'liste' ? (
          <div className="web-karte">
            <WebChallengesTabelle
              eintraege={sichtbar}
              suche={auswahl.suche}
              fuer="leitung"
              href={(c) => `${listenPfad}/${c.id}`}
              kugel={(id) => kugelAmEintrag(id, stand)}
              eingereicht={(c) => (c.own_submission_count ?? 0) > 0}
              // Dieselben Funktionen und Rechte wie die Knoepfe der Karte.
              aktionen={(c) => (
                <>
                  <WebKnopf klein symbol vorn aria-label={`Bearbeiten: ${c.title}`} title="Bearbeiten" onClick={() => onBearbeiten(c)}>
                    <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
                  </WebKnopf>
                  {darfLoeschen && (
                    <WebKnopf klein symbol vorn art="gefahr" aria-label={`Löschen: ${c.title}`} title="Löschen" onClick={() => onLoeschen(c)}>
                      <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
                    </WebKnopf>
                  )}
                </>
              )}
            />
          </div>
        ) : (
          <ul className="web-challenge-raster" aria-label="Challenges">
            {sichtbar.map(({ challenge: c, status }) => {
              const kugel = kugelAmEintrag(c.id, stand);
              return (
                <WebChallengeKarte
                  key={c.id}
                  challenge={c}
                  status={status}
                  href={`${listenPfad}/${c.id}`}
                  suche={auswahl.suche}
                  kugel={kugel}
                  wartend={kugel.wartend}
                  // Eingereicht ist eingereicht, auch unmoderiert (Befund M3, 27.08.2026).
                  eingereicht={(c.own_submission_count ?? 0) > 0}
                  mitBeitraegen
                  fuss={(
                    <>
                      <WebKnopf klein vorn aria-label={`Bearbeiten: ${c.title}`} onClick={() => onBearbeiten(c)}>
                        <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
                        Bearbeiten
                      </WebKnopf>
                      {darfLoeschen && (
                        <WebKnopf klein vorn art="gefahr" aria-label={`Löschen: ${c.title}`} onClick={() => onLoeschen(c)}>
                          <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
                          Löschen
                        </WebKnopf>
                      )}
                    </>
                  )}
                />
              );
            })}
          </ul>
        )}

        <WebChallengeStempel
          marks={marks}
          offeneStempel={offeneStempel}
          listenPfad={listenPfad}
          leer="Mach selbst bei einer Challenge mit — öffne sie und reiche deinen Beitrag ein."
        />
      </>
    );
  }

  return (
    <WebSeite
      bereich="Challenges"
      titel="Challenges"
      untertitel={liste.length > 0 ? untertitel : 'Anlegen, begleiten, mitmachen'}
      pageRef={pageRef}
      aktionen={(
        <WebKnopf art="primaer" onClick={onNeu}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Neue Challenge
        </WebKnopf>
      )}
    >
      {inhalt}
    </WebSeite>
  );
};

export default WebChallengesLeitung;
