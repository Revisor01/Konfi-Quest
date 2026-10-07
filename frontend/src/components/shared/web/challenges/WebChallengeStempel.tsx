// Die Challenge-Stempel einer Person in der Web-Fassung: dasselbe Raster aus
// Kreis und Name wie auf der Seite einer Person (WebAuszeichnungen; Simon,
// 07.10.2026: „unter challenges muss stempel genau wie in der konfi ansicht
// aussehen") -- erhaltene in der Farbe der Challenges, noch nicht erhaltene
// grau und gestrichelt. Beim Darueberfahren und beim Fokus zeigt ein Stempel
// dieselbe Info wie das Popover der App: Challenge, "Erhalten" mit Datum bzw.
// was zu tun ist. Ein Klick fuehrt zur Challenge, solange es sie gibt.
//
// Wie in der App ohne Zaehler und ohne Fortschritt: ein Stempel belegt, dass
// jemand dabei war, er ist keine Sammelmenge. Die Karte entfaellt, wenn es
// weder erhaltene noch offene Stempel gibt -- ausser die Seite gibt einen
// Text fuer den leeren Zustand mit (`leer`): Wie in der App steht die Karte
// dann trotzdem da, damit man sieht, dass es Stempel ueberhaupt gibt.

import React from 'react';
import { ICON_ABZEICHEN, ICON_CHALLENGE_GEFUELLT } from '../../icons';
import WebKarte from '../../../web/WebKarte';
import WebAuszeichnungen, { type WebAuszeichnung } from '../../../web/WebAuszeichnungen';
import { WebLeer } from '../../../web/WebZustaende';
import StempelInfo from '../../../web/StempelInfo';
import { getIconFromString } from '../../../../utils/badgeIcons';
import type { ChallengeMark, OffenerStempel } from '../../../../types/challenges';
import '../../../../theme/web/challenges.css';

export interface WebChallengeStempelProps {
  marks: ChallengeMark[];
  offeneStempel?: OffenerStempel[];
  /** Liste der Rolle (/konfi/challenges): eine Kachel fuehrt darunter zur Challenge. */
  listenPfad: string;
  /** Ueberschrift; in der Ansicht auf eine ANDERE Person waere "Deine" falsch. */
  titel?: string;
  /** Satz fuer den leeren Zustand; ohne ihn entfaellt die Karte, wenn es nichts zu zeigen gibt. */
  leer?: string;
}

const WebChallengeStempel: React.FC<WebChallengeStempelProps> = ({ marks, offeneStempel = [], listenPfad, titel = 'Deine Stempel', leer }) => {
  if (marks.length === 0 && offeneStempel.length === 0) {
    return leer ? (
      <WebKarte titel={titel}>
        <WebLeer icon={ICON_ABZEICHEN} titel="Noch keine Stempel" text={leer} />
      </WebKarte>
    ) : null;
  }

  const untertitel = [
    marks.length > 0 ? `${marks.length} erhalten` : null,
    offeneStempel.length > 0 ? `${offeneStempel.length} noch zu holen` : null,
  ].filter(Boolean).join(' · ');

  // Stempel tragen immer die Challenge-Farbe, nie eine eigene (wie in der App).
  const eintraege: WebAuszeichnung[] = [
    ...marks.map((m) => ({
      schluessel: `erhalten-${m.challenge_id}`,
      name: m.badge_name,
      icon: getIconFromString(m.badge_icon, ICON_CHALLENGE_GEFUELLT),
      farbe: 'var(--app-color-challenges)',
      erreicht: true,
      info: <StempelInfo stempel={m} />,
      // Eine geloeschte Challenge hat keine Seite mehr; der Stempel bleibt.
      href: m.bewahrt ? undefined : `${listenPfad}/${m.challenge_id}`,
    })),
    ...offeneStempel.map((o) => ({
      schluessel: `offen-${o.challenge_id}`,
      name: o.badge_name,
      icon: getIconFromString(o.badge_icon, ICON_CHALLENGE_GEFUELLT),
      farbe: 'var(--app-color-challenges)',
      erreicht: false,
      info: <StempelInfo stempel={o} offen />,
      href: `${listenPfad}/${o.challenge_id}`,
    })),
  ];

  return (
    <WebKarte titel={titel} untertitel={untertitel}>
      <WebAuszeichnungen beschriftung="Stempel" eintraege={eintraege} />
    </WebKarte>
  );
};

export default WebChallengeStempel;
