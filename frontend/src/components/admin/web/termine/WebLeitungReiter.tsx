// Die Reiter oben auf Mitmachen der Leitung -- Events und Aktivitaeten, wie in
// der App --, ueber die Adresse gewaehlt (`?segment=`, wie die Deep-Links der
// App); die orange Zahl zaehlt, was wartet. Der Katalog der Aktivitaeten steht
// wie in der App unter Mehr (Simon, 06.10.2026).

import React from 'react';
import { WebReiter } from '../../../shared/web/termine/WebTerminBausteine';
import type { LeitungSegment } from './typen';

const WebLeitungReiter: React.FC<{
  segment: LeitungSegment;
  /** Events, die auf Verbuchung warten (BadgeContext). */
  wartendVerbuchen: number;
  /** Antraege, die auf eine Entscheidung warten (BadgeContext). */
  wartendeAntraege: number;
}> = ({ segment, wartendVerbuchen, wartendeAntraege }) => (
  <WebReiter
    beschriftung="Bereiche von Mitmachen"
    eintraege={[
      {
        schluessel: 'events',
        label: 'Events',
        href: '/admin/events',
        aktiv: segment === 'events',
        zahl: wartendVerbuchen,
        zahlText: wartendVerbuchen === 1 ? 'Event wartet auf Verbuchung' : 'Events warten auf Verbuchung',
      },
      {
        schluessel: 'antraege',
        label: 'Aktivitäten',
        href: '/admin/events?segment=antraege',
        aktiv: segment === 'antraege',
        zahl: wartendeAntraege,
        zahlText: wartendeAntraege === 1 ? 'Antrag wartet auf Entscheidung' : 'Anträge warten auf Entscheidung',
      },
    ]}
  />
);

export default WebLeitungReiter;
