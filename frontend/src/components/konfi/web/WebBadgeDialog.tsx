// Die Einzelheiten eines Badges im Dialog der Web-Fassung -- das Gegenstück zum
// Popover der App (shared/BadgePopoverContent.tsx), mit denselben Aussagen:
// Name und Beschreibung, erreicht (mit Datum), in Arbeit (mit Fortschritt) oder
// noch nicht erreicht, und bei zeitbasierten Badges der Zeitraum, der zählt.
// Echte Geheim-Badges bleiben unkenntlich, solange sie nicht erreicht sind.

import React from 'react';
import { datumKurz } from '../../../utils/dateUtils';
import { getIconFromString } from '../../../utils/badgeIcons';
import { getBadgeColor, getTimeWindowHint, type BadgePopoverBadge } from '../../shared/BadgePopoverContent';
import WebDialog from '../../web/WebDialog';
import WebKnopf from '../../web/WebKnopf';
import WebPill from '../../web/WebPill';
import WebAngaben from '../../web/WebAngaben';
import WebHinweis from '../../web/WebHinweis';
import WebBadgeSymbol from './WebBadgeSymbol';
import WebFortschritt from './WebFortschritt';
import '../../../theme/web/start.css';

export interface WebBadgeDialogProps {
  badge: BadgePopoverBadge;
  /** Hat die Person das Badge? Überschreibt die Angaben am Badge selbst. */
  erreicht: boolean;
  /** Fortschritt und Zeitraum zeigen -- nur, wo die Daten sie wirklich tragen (Badge-Seite). */
  zeigeFortschritt?: boolean;
  onSchliessen: () => void;
}

const WebBadgeDialog: React.FC<WebBadgeDialogProps> = ({ badge, erreicht, zeigeFortschritt = false, onSchliessen }) => {
  const maskiert = Boolean(badge.is_hidden) && !erreicht;
  const farbe = getBadgeColor(badge);
  const datum = badge.earned_at || badge.awarded_date;
  const fortschritt = zeigeFortschritt ? (badge.progress_percentage || 0) : 0;
  const zeitfenster = zeigeFortschritt ? getTimeWindowHint(badge) : null;

  const status = erreicht
    ? <WebPill ton="erfolg" punkt>Erreicht</WebPill>
    : fortschritt > 0
      ? <WebPill ton="info" punkt>In Arbeit</WebPill>
      : <WebPill>Noch nicht erreicht</WebPill>;

  return (
    <WebDialog
      titel={maskiert ? '???' : badge.name}
      onSchliessen={onSchliessen}
      aktionen={<WebKnopf onClick={onSchliessen}>Schließen</WebKnopf>}
    >
      <div className="web-abzeichen-detail">
        <WebBadgeSymbol
          icon={getIconFromString(badge.icon)}
          farbe={farbe}
          erreicht={erreicht}
          maskiert={maskiert}
          fortschritt={fortschritt}
          groesse="gross"
        />
        <p className="web-abzeichen-detail__text">
          {maskiert ? 'Bleibt geheim, bis du es hast' : (badge.description || 'Keine Beschreibung')}
        </p>
      </div>
      <WebAngaben
        angaben={[
          { label: 'Status', wert: status },
          { label: 'Erreicht am', wert: erreicht && datum ? datumKurz(datum) : null },
          {
            label: 'Fortschritt',
            wert: !erreicht && fortschritt > 0
              ? (
                <span className="web-abzeichen-detail__fortschritt">
                  <WebFortschritt prozent={fortschritt} beschriftung="Fortschritt" ton="level" wertText={`${badge.progress_points || 0} von ${badge.criteria_value}`} />
                  <span>{badge.progress_points || 0} / {badge.criteria_value}</span>
                </span>
              )
              : null,
          },
        ].filter((a) => a.label === 'Status' || a.wert !== null)}
      />
      {zeitfenster && <WebHinweis art="hinweis">{zeitfenster}</WebHinweis>}
    </WebDialog>
  );
};

export default WebBadgeDialog;
