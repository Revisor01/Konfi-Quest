// Status-Marke der Web-Fassung (neutral, info, erfolg, warnung, fehler) --
// Farben aus den Status-Tokens der App, im Dunkeln mit eigenen Werten.

import React from 'react';
import { IonIcon } from '@ionic/react';
import type { PillTon } from '../../utils/supportWeb';

export interface WebPillProps {
  ton?: PillTon;
  children: React.ReactNode;
  /** Kleiner Punkt vor dem Text (Zustand statt Etikett). */
  punkt?: boolean;
  /** Eckige Form fuer Postfaecher (moin@, support@). */
  postfach?: boolean;
  title?: string;
  /** Symbol vor dem Text (Merkmale eines Events: Pflicht, Team ...). */
  icon?: string;
  /** Eigene Farbe als Token (var(--app-color-events)); dann zart getoent mit farbigem Text. */
  farbe?: string;
}

const WebPill: React.FC<WebPillProps> = ({ ton = 'neutral', children, punkt = false, postfach = false, title, icon, farbe }) => {
  const klassen = [
    'web-pill',
    ton !== 'neutral' && !farbe ? `web-pill--${ton}` : '',
    postfach ? 'web-pill--postfach' : '',
    farbe ? 'web-pill--farbig' : '',
  ].filter(Boolean).join(' ');
  return (
    <span className={klassen} title={title} style={farbe ? ({ '--web-pill-farbe': farbe } as React.CSSProperties) : undefined}>
      {punkt && <span className="web-pill__punkt" aria-hidden="true" />}
      {icon && <IonIcon icon={icon} className="web-pill__icon" aria-hidden="true" />}
      {children}
    </span>
  );
};

export default WebPill;
