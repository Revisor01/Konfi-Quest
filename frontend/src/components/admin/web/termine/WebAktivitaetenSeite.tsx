// /admin/activities in der Web-Fassung: der Katalog der Aktivitaeten als Seite
// unter Mehr, wie in der App (Simon, 06.10.2026: der Reiter unter Mitmachen
// heisst ueberall „Aktivitaeten" und zeigt die gemeldeten). Oben links fuehrt
// „Mehr" zurueck wie auf den anderen Seiten von Mehr; die Seite der App
// (AdminActivitiesPage) laedt und reicht herein.

import React from 'react';
import WebSeite from '../../../web/WebSeite';
import { WebFehler, WebLaden } from '../../../web/WebZustaende';
import type { useAktivitaetenVerwaltung } from '../../useAktivitaetenVerwaltung';
import { WebAktivitaetenTabelle } from './WebAktivitaeten';
import { KATALOG_TITEL, katalogUntertitel } from '../../../../seiten/aktivitaetenKatalog';

const ZURUECK = { href: '/admin/settings', text: 'Mehr' };

const WebAktivitaetenSeite: React.FC<{
  pageRef: React.Ref<HTMLElement>;
  verwaltung: ReturnType<typeof useAktivitaetenVerwaltung>;
}> = ({ pageRef, verwaltung: v }) => {
  return (
    <WebSeite bereich="Verwaltung" titel={KATALOG_TITEL} untertitel={katalogUntertitel(v.rolle)} zurueck={ZURUECK} pageRef={pageRef}>
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
