// /admin/activities in der Web-Fassung: dieselben Aktivitaeten wie der Reiter
// unter Mitmachen, nur als eigene Seite -- die Adresse bleibt, ueber die die
// App sie erreicht ("Mehr"). Die Reiter oben fuehren in die Events und die
// Antraege; die Seite der App (AdminActivitiesPage) laedt und reicht herein.

import React from 'react';
import WebSeite from '../../../web/WebSeite';
import { WebFehler, WebLaden } from '../../../web/WebZustaende';
import { useBadge } from '../../../../contexts/BadgeContext';
import type { useAktivitaetenVerwaltung } from '../../useAktivitaetenVerwaltung';
import WebLeitungReiter from './WebLeitungReiter';
import { WebAktivitaetenTabelle } from './WebAktivitaeten';

const WebAktivitaetenSeite: React.FC<{
  pageRef: React.Ref<HTMLElement>;
  verwaltung: ReturnType<typeof useAktivitaetenVerwaltung>;
}> = ({ pageRef, verwaltung: v }) => {
  const { pendingEventsCount, pendingRequestsCount } = useBadge();
  return (
    <WebSeite bereich="Mitmachen" titel="Aktivitäten" untertitel="Hier legst du fest, wofür es Punkte gibt" pageRef={pageRef}>
      <WebLeitungReiter segment="aktivitaeten" wartendVerbuchen={pendingEventsCount} wartendeAntraege={pendingRequestsCount} />
      {v.loading ? (
        <WebLaden karten={1} text="Die Aktivitäten werden geladen." />
      ) : !v.aktivitaeten ? (
        <WebFehler text="Die Aktivitäten konnten nicht geladen werden." onErneut={() => { void v.refresh(); }} />
      ) : (
        <WebAktivitaetenTabelle
          aktivitaeten={v.aktivitaeten}
          rolle={v.rolle}
          onRolle={v.setRolle}
          darfAnlegen={v.darfAnlegen}
          darfBearbeiten={v.darfBearbeiten}
          darfLoeschen={v.darfLoeschen}
          onAnlegen={v.anlegen}
          onBearbeiten={v.bearbeiten}
          onLoeschen={(a) => { void v.loeschen(a); }}
        />
      )}
    </WebSeite>
  );
};

export default WebAktivitaetenSeite;
