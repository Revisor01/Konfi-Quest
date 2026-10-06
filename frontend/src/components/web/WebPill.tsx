// Status-Marke der Web-Fassung (neutral, info, erfolg, warnung, fehler) --
// Farben aus den Status-Tokens der App, im Dunkeln mit eigenen Werten.

import React from 'react';
import type { PillTon } from '../../utils/supportWeb';

export interface WebPillProps {
  ton?: PillTon;
  children: React.ReactNode;
  /** Kleiner Punkt vor dem Text (Zustand statt Etikett). */
  punkt?: boolean;
  /** Eckige Form fuer Postfaecher (moin@, support@). */
  postfach?: boolean;
  title?: string;
}

const WebPill: React.FC<WebPillProps> = ({ ton = 'neutral', children, punkt = false, postfach = false, title }) => {
  const klassen = ['web-pill', ton !== 'neutral' ? `web-pill--${ton}` : '', postfach ? 'web-pill--postfach' : ''].filter(Boolean).join(' ');
  return (
    <span className={klassen} title={title}>
      {punkt && <span className="web-pill__punkt" aria-hidden="true" />}
      {children}
    </span>
  );
};

export default WebPill;
