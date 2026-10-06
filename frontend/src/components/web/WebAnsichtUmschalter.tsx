// Der Umschalter Liste | Kacheln -- derselbe auf Events, Challenges und Konfis
// (useAnsicht.ts). Zwei Knoepfe mit Zeichen und Wort, der gewaehlte in der
// Rollenfarbe wie die gewaehlten Filter.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_LISTE, ICON_RASTER } from '../shared/icons';
import type { WebAnsicht } from './useAnsicht';

const KNOEPFE: ReadonlyArray<{ wert: WebAnsicht; label: string; icon: string }> = [
  { wert: 'liste', label: 'Liste', icon: ICON_LISTE },
  { wert: 'kacheln', label: 'Kacheln', icon: ICON_RASTER },
];

export interface WebAnsichtUmschalterProps {
  wert: WebAnsicht;
  onWert: (wert: WebAnsicht) => void;
}

const WebAnsichtUmschalter: React.FC<WebAnsichtUmschalterProps> = ({ wert, onWert }) => (
  <div className="web-ansicht-umschalter" role="group" aria-label="Ansicht">
    {KNOEPFE.map((k) => (
      <button
        key={k.wert}
        type="button"
        className="web-ansicht-umschalter__knopf"
        aria-pressed={k.wert === wert}
        onClick={() => onWert(k.wert)}
      >
        <IonIcon icon={k.icon} aria-hidden="true" />
        {k.label}
      </button>
    ))}
  </div>
);

export default WebAnsichtUmschalter;
