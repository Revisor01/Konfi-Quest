// Die Challenges der Konfis in der Web-Fassung (Browser ab 992 px),
// /konfi/challenges: Karten im Raster mit dem Stempel als Bild, Status, Frist,
// Zielgruppe und der roten Zahl der Neuigkeiten -- wie am Eintrag der App.
// Filter (laufend, beendet, alle) und eine Live-Suche; darunter die eigenen
// Stempel, erhaltene und noch zu holende.
//
// Bewusst OHNE Zaehler, Fortschritt und Rangliste -- der Kern der Challenges
// ist die eigene Deutung, nicht die Menge (konfi/views/ChallengesView). Die
// Daten und die Zahlen kommen aus derselben Seite wie in der App
// (konfi/pages/KonfiChallengesPage); was ein Konfi sieht, entscheidet der
// Server.

import React, { useMemo, useState } from 'react';
import { ICON_CHALLENGE } from '../../../shared/icons';
import WebSeite from '../../../web/WebSeite';
import WebKnopf from '../../../web/WebKnopf';
import { WebLaden, WebLeer } from '../../../web/WebZustaende';
import WebChallengeKarte from '../../../shared/web/challenges/WebChallengeKarte';
import WebChallengeChips from '../../../shared/web/challenges/WebChallengeChips';
import WebChallengeStempel from '../../../shared/web/challenges/WebChallengeStempel';
import WebSuche from '../../../web/WebSuche';
import {
  FILTER_TEXT,
  KONFI_LISTEN_FILTER,
  OHNE_AUSWAHL,
  challengesFiltern,
  challengesZaehlen,
  konfiEintraege,
  type ListenAuswahl,
  type ListenFilter,
} from '../../../../utils/challengesWeb';
import { suchbegriff } from '../../../../utils/supportWeb';
import type { ChallengeMark, KonfiChallenge, OffenerStempel } from '../../../../types/challenges';
import '../../../../theme/web/challenges.css';

const LISTEN_PFAD = '/konfi/challenges';

/** Wortgleich mit der Liste der App (konfi/views/ChallengesView). Geplantes und Wartendes gibt es fuer Konfis nicht. */
const LEER: Record<string, { titel: string; text: string }> = {
  laufend: { titel: 'Gerade läuft keine Challenge', text: 'Sobald eine neue Challenge startet, findest du sie hier — und bekommst eine Nachricht.' },
  beendet: { titel: 'Noch nichts im Archiv', text: 'Beendete Challenges kannst du hier später in Ruhe nachlesen.' },
  alle: { titel: 'Noch keine Challenge', text: 'Sobald eine neue Challenge startet, findest du sie hier — und bekommst eine Nachricht.' },
};

export interface WebKonfiChallengesProps {
  active: KonfiChallenge[];
  archive: KonfiChallenge[];
  marks: ChallengeMark[];
  offeneStempel: OffenerStempel[];
  /** Neuigkeiten je Challenge seit dem letzten Oeffnen (BadgeContext): die rote Zahl. */
  neuigkeiten: Record<number, number>;
  /** Noch keine Antwort des Servers (und kein gespeicherter Stand). */
  loading: boolean;
  /** Fuer die Modale, die auf dieser Seite aufklappen (useModalPage). */
  pageRef?: React.Ref<HTMLElement>;
}

const WebKonfiChallenges: React.FC<WebKonfiChallengesProps> = ({ active, archive, marks, offeneStempel, neuigkeiten, loading, pageRef }) => {
  const [auswahl, setAuswahl] = useState<ListenAuswahl>({ ...OHNE_AUSWAHL, filter: 'laufend' });

  // Defensive wie die Liste der App: kaputte oder gecachte Antworten als leer behandeln.
  const eintraege = useMemo(
    () => konfiEintraege(Array.isArray(active) ? active : [], Array.isArray(archive) ? archive : []),
    [active, archive],
  );
  const zaehlen = useMemo(() => challengesZaehlen(eintraege, auswahl), [eintraege, auswahl]);
  const sichtbar = useMemo(() => challengesFiltern(eintraege, auswahl), [eintraege, auswahl]);
  const sucht = suchbegriff(auswahl.suche) !== '';

  let inhalt: React.ReactNode;
  if (loading) {
    inhalt = <WebLaden karten={3} text="Challenges werden geladen..." />;
  } else {
    inhalt = (
      <>
        {eintraege.length > 0 && (
          <div className="web-challenge-filter">
            <div className="web-challenge-filter__zeile">
              <WebChallengeChips<ListenFilter>
                beschriftung="Challenges nach Zustand"
                wert={auswahl.filter}
                onWert={(filter) => setAuswahl((a) => ({ ...a, filter }))}
                chips={KONFI_LISTEN_FILTER.map((wert) => ({ wert, label: FILTER_TEXT[wert], zahl: zaehlen[wert] }))}
              />
              <div className="web-werkzeuge__rechts">
                <WebSuche
                  beschriftung="Challenges durchsuchen"
                  platzhalter="Challenges suchen"
                  wert={auswahl.suche}
                  onWert={(suche) => setAuswahl((a) => ({ ...a, suche }))}
                />
              </div>
            </div>
          </div>
        )}

        {sichtbar.length > 0 ? (
          <ul className="web-challenge-raster" aria-label="Challenges">
            {sichtbar.map(({ challenge: c, status }) => (
              <WebChallengeKarte
                key={c.id}
                challenge={c}
                status={status}
                href={`${LISTEN_PFAD}/${c.id}`}
                suche={auswahl.suche}
                kugel={{ anzahl: neuigkeiten?.[c.id] ?? 0, text: 'Neuigkeiten' }}
                eingereicht={!!c.has_submission}
              />
            ))}
          </ul>
        ) : (
          <div className="web-karte">
            <WebLeer
              icon={ICON_CHALLENGE}
              titel={sucht ? 'Keine Treffer' : (LEER[auswahl.filter] ?? LEER.alle).titel}
              text={sucht ? 'In dieser Auswahl gibt es keine Challenge. Ändere den Filter oder die Suche.' : (LEER[auswahl.filter] ?? LEER.alle).text}
              aktion={sucht ? <WebKnopf onClick={() => setAuswahl((a) => ({ ...a, suche: '' }))}>Suche leeren</WebKnopf> : undefined}
            />
          </div>
        )}

        <WebChallengeStempel
          marks={marks}
          offeneStempel={offeneStempel}
          listenPfad={LISTEN_PFAD}
          leer="Für jede Challenge, bei der du mitmachst, bekommst du einen eigenen Stempel."
        />
      </>
    );
  }

  return (
    <WebSeite bereich="Challenges" titel="Challenges" untertitel="Mach mit, sei dabei" pageRef={pageRef}>
      {inhalt}
    </WebSeite>
  );
};

export default WebKonfiChallenges;
