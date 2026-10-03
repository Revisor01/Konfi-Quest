// Ein Hinweis in der Web-Fassung: Symbol, Titel, Text -- in der Farbe seiner
// Art (hinweis, warnung, fehler, erfolg), mit den Flaechen-Tokens der App,
// im Dunkeln mit deren dunklen Werten. Fehler melden sich sofort
// (role="alert"), alles andere hoeflich (role="status").

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_INFO, ICON_WARNHINWEIS, ICON_ZUSAGE_GEFUELLT } from '../../shared/icons';

export interface WebHinweisProps {
  art: 'hinweis' | 'warnung' | 'fehler' | 'erfolg';
  titel?: string;
  children?: React.ReactNode;
  /** Vorgabe: alert bei Fehlern, sonst status. */
  rolle?: 'alert' | 'status';
}

const WebHinweis: React.FC<WebHinweisProps> = ({ art, titel, children, rolle }) => (
  <div className={`web-hinweis web-hinweis--${art}`} role={rolle ?? (art === 'fehler' ? 'alert' : 'status')}>
    <IonIcon
      icon={art === 'hinweis' ? ICON_INFO : art === 'erfolg' ? ICON_ZUSAGE_GEFUELLT : ICON_WARNHINWEIS}
      className="web-hinweis__symbol"
      aria-hidden="true"
    />
    <div className="web-hinweis__text">
      {titel && <strong className="web-hinweis__titel">{titel}</strong>}
      {children && <div>{children}</div>}
    </div>
  </div>
);

export default WebHinweis;
