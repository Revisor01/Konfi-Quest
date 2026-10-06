// Die kleinen Teile, die Karte (WebChallengeKarte) und Zeile der Liste
// (WebChallengesTabelle) gemeinsam haben: der Stempel als Kreis mit der
// roten Zahl und die Marke "Du hast eingereicht". Liegen sie an einer Stelle,
// zeigen beide Ansichten dieselbe Zahl, denselben Satz fuer Vorleseprogramme
// und dieselbe Marke -- sie laufen nicht auseinander.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_SENDEN } from '../../icons';
import WebPill from '../../../web/WebPill';
import '../../../../theme/web/challenges.css';

export interface WebChallengeSymbolProps {
  /** Das Symbol des Stempels (getChallengeBadgeIcon). */
  icon: string;
  /** Die rote Zahl: neue Beitraege bzw. Neuigkeiten seit dem letzten Oeffnen. */
  kugel?: { anzahl: number; text: string };
  /** Kleiner, fuer die Zeile der Liste. */
  klein?: boolean;
}

/** Der Stempel der Challenge als Kreis; oben rechts die rote Zahl, ab 10 als 9+. */
export const WebChallengeSymbol: React.FC<WebChallengeSymbolProps> = ({ icon, kugel, klein = false }) => {
  const anzahl = kugel?.anzahl ?? 0;
  return (
    <span className={klein ? 'web-challenge-symbol web-challenge-symbol--klein' : 'web-challenge-symbol'}>
      <IonIcon icon={icon} aria-hidden="true" />
      {anzahl > 0 && kugel && (
        <span className="web-challenge-kugel" role="img" aria-label={`${anzahl} ${kugel.text}`}>
          {anzahl > 9 ? '9+' : anzahl}
        </span>
      )}
    </span>
  );
};

/**
 * Die Marke "Du hast eingereicht" -- Eingereicht ist eingereicht, auch
 * unmoderiert (Befund M3, 27.08.2026). `kompakt`: nur das Symbol, der Satz
 * steht fuer Vorleseprogramme und als Tooltip da (neben dem Status in der
 * schmalen Spalte der Liste).
 */
export const WebEingereichtPill: React.FC<{ kompakt?: boolean }> = ({ kompakt = false }) => (
  <WebPill ton="info" title="Du hast bereits eingereicht">
    <IonIcon icon={ICON_SENDEN} aria-hidden="true" />
    {kompakt ? <span className="web-nur-vorlesen">Du hast eingereicht</span> : 'Du hast eingereicht'}
  </WebPill>
);
