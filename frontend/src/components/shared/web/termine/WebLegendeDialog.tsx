// „Farben & Symbole" -- die Legende der Events als Fenster der Web-Fassung
// (Simon, 15.10.2026, Seiten-Inventar: im Browser ab 992 px jedes Fenster
// kompakt). Geöffnet über „Legende" über den Events der Leitung, des Teams und
// der Konfis (WebLegendeKnopf); unter 992 px und in den Apps bleibt das Modal
// der App (shared/EventLegendModal.tsx).
//
// Dieselben Einträge in derselben Reihenfolge wie in der App, nach Rolle
// gefiltert (eventLegende.ts): erst die Farben des Status, dann die kleinen
// Markierungen oben rechts am Event.

import React from 'react';
import { legendeFuer, type EventLegendVariant, type LegendEntry } from '../../eventLegende';
import WebDialog from '../../../web/WebDialog';
import WebKnopf from '../../../web/WebKnopf';
import WebKreis from '../../../web/WebKreis';
import '../../../../theme/web/termine.css';

export interface WebLegendeDialogProps {
  variante: EventLegendVariant;
  onSchliessen: () => void;
}

const Eintraege: React.FC<{ titel: string; eintraege: readonly LegendEntry[] }> = ({ titel, eintraege }) => (
  <ul className="web-legende-liste" aria-label={titel}>
    {eintraege.map((e) => (
      <li key={`${e.label}-${e.color}`} className="web-legende-liste__eintrag">
        <WebKreis icon={e.icon} farbe={e.color} />
        <span className="web-wahl__text">
          <span className="web-wahl__titel">{e.label}</span>
          <span className="web-wahl__beschreibung">{e.description}</span>
        </span>
      </li>
    ))}
  </ul>
);

const WebLegendeDialog: React.FC<WebLegendeDialogProps> = ({ variante, onSchliessen }) => {
  const { eintraege, markierungen } = legendeFuer(variante);
  return (
    <WebDialog
      titel="Farben & Symbole"
      beschreibung="Farbe und Symbol an jedem Event zeigen seinen Status."
      onSchliessen={onSchliessen}
      aktionen={<WebKnopf art="primaer" onClick={onSchliessen}>Schließen</WebKnopf>}
    >
      <div className="web-formular">
        <Eintraege titel="Status" eintraege={eintraege} />
        {markierungen.length > 0 && (
          <>
            <h3 className="web-gruppe">Zusätzliche Markierungen</h3>
            <p className="web-feld__hinweis">Diese kleinen Symbole erscheinen oben rechts am Event.</p>
            <Eintraege titel="Zusätzliche Markierungen" eintraege={markierungen} />
          </>
        )}
      </div>
    </WebDialog>
  );
};

export default WebLegendeDialog;
