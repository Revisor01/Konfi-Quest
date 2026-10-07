// Die erreichten Badges einer Person in der Detailseite der Leitung (Web-Fassung):
// ein Raster aus Kreis mit Symbol und Name wie bei den Stempeln
// (WebAuszeichnungen). Geladen wird wie in der App (useKonfiBadges: eigene
// Route fuer Teamer:innen); die Info zu einem Badge erscheint beim
// Darueberfahren und beim Fokus. Waehrend des Ladens steht nichts da -- kein
// Platzhalter, der aufblitzt.

import React from 'react';
import { getIconFromString } from '../../../../utils/badgeIcons';
import WebKarte from '../../../web/WebKarte';
import BadgePopoverContent from '../../../shared/BadgePopoverContent';
import { useKonfiBadges } from '../../views/useKonfiBadges';
import { getBadgeColor } from '../../views/KonfiBadgesSection';
import WebAuszeichnungen from './WebAuszeichnungen';

const WebKonfiBadges: React.FC<{ konfiId: number; rolle: 'konfi' | 'teamer' }> = ({ konfiId, rolle }) => {
  const { erreicht, laedt } = useKonfiBadges(konfiId, rolle);
  if (laedt) return null;

  return (
    <WebKarte titel={`Badges (${erreicht.length})`} untertitel="Erreichte Auszeichnungen">
      {erreicht.length === 0 ? (
        <p className="web-karte__leer web-karte__leer--eng">Noch keine Badges erreicht.</p>
      ) : (
        <WebAuszeichnungen
          beschriftung="Badges"
          eintraege={erreicht.map((b) => ({
            schluessel: `b-${b.id}`,
            name: b.name,
            icon: getIconFromString(b.icon),
            // Die gepflegte Farbe des Badges (Datenwert), das Symbol steht weiss darauf.
            farbe: getBadgeColor(b),
            erreicht: true,
            info: <BadgePopoverContent dataRef={{ current: { badge: b, isEarned: true } }} />,
          }))}
        />
      )}
    </WebKarte>
  );
};

export default WebKonfiBadges;
