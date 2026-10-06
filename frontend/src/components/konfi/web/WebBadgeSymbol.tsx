// Das runde Symbol eines Badges in der Web-Fassung: erreicht auf der Farbe
// des Badges (die Farbe kommt aus den Daten, wie in der App), offen als
// gestrichelter Kreis mit gedämpftem Symbol. Läuft ein Fortschritt, legt sich
// ein Ring darum; „neu" trägt einen grünen Punkt.
//
// Reine Darstellung: Das Symbol ist nie selbst bedienbar -- Karte oder Knopf
// darum nehmen den Klick und tragen den Namen für Vorleseprogramme.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_SPERRE_GEFUELLT } from '../../shared/icons';
import '../../../theme/web/start.css';

export interface WebBadgeSymbolProps {
  icon: string;
  /** Farbe des Badges (aus den Daten); nur für erreichte Badges sichtbar. */
  farbe: string;
  erreicht: boolean;
  /** Ein echtes Geheim-Badge, das noch nicht erreicht ist: nur ein Schloss. */
  maskiert?: boolean;
  neu?: boolean;
  /** Fortschritt in Prozent, solange das Badge noch offen ist. */
  fortschritt?: number;
  groesse?: 'klein' | 'mittel' | 'gross';
}

const RING_RADIUS = 21;
const UMFANG = 2 * Math.PI * RING_RADIUS;

const WebBadgeSymbol: React.FC<WebBadgeSymbolProps> = ({
  icon, farbe, erreicht, maskiert = false, neu = false, fortschritt = 0, groesse = 'mittel',
}) => {
  const klassen = [
    'web-abzeichen-symbol',
    `web-abzeichen-symbol--${groesse}`,
    erreicht ? '' : 'web-abzeichen-symbol--offen',
    neu ? 'web-abzeichen-symbol--neu' : '',
  ].filter(Boolean).join(' ');
  const laeuft = !erreicht && !maskiert && fortschritt > 0;
  return (
    <span className={klassen} style={erreicht ? { background: farbe } : undefined} aria-hidden="true">
      <IonIcon icon={maskiert ? ICON_SPERRE_GEFUELLT : icon} />
      {laeuft && (
        <svg className="web-abzeichen-symbol__ring" viewBox="0 0 50 50" focusable="false">
          <circle className="web-abzeichen-symbol__spur" cx="25" cy="25" r={RING_RADIUS} fill="none" strokeWidth="3" />
          <circle
            className="web-abzeichen-symbol__bogen"
            cx="25"
            cy="25"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(Math.min(fortschritt, 100) / 100) * UMFANG} ${UMFANG}`}
            transform="rotate(-90 25 25)"
          />
        </svg>
      )}
      {neu && <span className="web-abzeichen-symbol__punkt">!</span>}
    </span>
  );
};

export default WebBadgeSymbol;
