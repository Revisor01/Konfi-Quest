// Die Reiter oben auf Mitmachen der Leitung -- Events und Aktivitaeten, wie in
// der App --, ueber die Adresse gewaehlt (`?segment=`, wie die Deep-Links der
// App); die orange Zahl zaehlt, was wartet. Der Katalog der Aktivitaeten steht
// wie in der App unter Mehr (Simon, 06.10.2026).

import React from 'react';
import { WebReiter } from '../../../shared/web/termine/WebTerminBausteine';
import type { LeitungSegment } from './typen';
import { LEITUNG_BEREICHE, LEITUNG_BEREICHE_BESCHRIFTUNG } from '../../../../seiten/mitmachenLeitung';

const WebLeitungReiter: React.FC<{
  segment: LeitungSegment;
  /** Events, die auf Verbuchung warten (BadgeContext). */
  wartendVerbuchen: number;
  /** Antraege, die auf eine Entscheidung warten (BadgeContext). */
  wartendeAntraege: number;
}> = ({ segment, wartendVerbuchen, wartendeAntraege }) => (
  <WebReiter
    beschriftung={LEITUNG_BEREICHE_BESCHRIFTUNG}
    // Beschriftung, Reihenfolge und Vorlesesatz aus der gemeinsamen Beschreibung (seiten/mitmachenLeitung.ts).
    eintraege={LEITUNG_BEREICHE.map((b) => {
      const zahl = b.schluessel === 'events' ? wartendVerbuchen : wartendeAntraege;
      return {
        schluessel: b.schluessel,
        label: b.label,
        href: b.schluessel === 'events' ? '/admin/events' : '/admin/events?segment=antraege',
        aktiv: segment === b.schluessel,
        zahl,
        zahlText: b.zahlText?.(zahl),
      };
    })}
  />
);

export default WebLeitungReiter;
