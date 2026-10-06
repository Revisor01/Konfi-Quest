// Die erreichten Badges einer Person in der Detailseite der Leitung (Web-Fassung):
// ein Raster aus Kreis mit Symbol und Name. Geladen wird wie in der App
// (useKonfiBadges: eigene Route fuer Teamer:innen); der Text zu einem Badge
// steht als Hinweis am Kreis. Waehrend des Ladens steht nichts da -- kein
// Platzhalter, der aufblitzt.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { getIconFromString } from '../../../../utils/badgeIcons';
import { datumKurz } from '../../../../utils/dateUtils';
import WebKarte from '../../../web/WebKarte';
import { useKonfiBadges } from '../../views/useKonfiBadges';
import { getBadgeColor } from '../../views/KonfiBadgesSection';

const WebKonfiBadges: React.FC<{ konfiId: number; rolle: 'konfi' | 'teamer' }> = ({ konfiId, rolle }) => {
  const { erreicht, laedt } = useKonfiBadges(konfiId, rolle);
  if (laedt) return null;

  return (
    <WebKarte titel={`Badges (${erreicht.length})`} untertitel="Erreichte Auszeichnungen">
      {erreicht.length === 0 ? (
        <p className="web-karte__leer web-karte__leer--eng">Noch keine Badges erreicht.</p>
      ) : (
        <ul className="web-badges-raster">
          {erreicht.map((b) => (
            <li
              key={b.id}
              className="web-badge"
              title={[b.description, b.earned_at ? `erreicht am ${datumKurz(b.earned_at)}` : ''].filter(Boolean).join(' · ') || undefined}
            >
              {/* Die Farbe ist die gepflegte des Badges (Datenwert), das Symbol steht weiss darauf. */}
              <span className="web-badge__symbol" style={{ background: getBadgeColor(b) }} aria-hidden="true">
                <IonIcon icon={getIconFromString(b.icon)} />
              </span>
              <span className="web-badge__name">{b.name}</span>
            </li>
          ))}
        </ul>
      )}
    </WebKarte>
  );
};

export default WebKonfiBadges;
