// Die drei Zustaende einer Web-Seite ausser "Daten da": leer, Fehler, Laden.
// Eigene Bausteine statt der App-Karten (EmptyState, Ladefehler), damit die
// Web-Fassung ohne Ionic-Karten und -Spinner auskommt.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_WARNHINWEIS } from '../../shared/icons';
import WebKnopf from './WebKnopf';

/** Leerer Zustand: Symbol, Titel, ein Satz -- optional mit Aktion. */
export const WebLeer: React.FC<{ icon: string; titel: string; text: string; aktion?: React.ReactNode }> = ({ icon, titel, text, aktion }) => (
  <div className="web-leer">
    <IonIcon icon={icon} className="web-leer__symbol" aria-hidden="true" />
    <h3 className="web-leer__titel">{titel}</h3>
    <p className="web-leer__text">{text}</p>
    {aktion}
  </div>
);

/** "Konnte nicht geladen werden" mit erneutem Versuch. */
export const WebFehler: React.FC<{ text: string; onErneut: () => void }> = ({ text, onErneut }) => (
  <div className="web-fehler" role="alert">
    <IonIcon icon={ICON_WARNHINWEIS} aria-hidden="true" />
    <p className="web-fehler__text">{text}</p>
    <WebKnopf onClick={onErneut}>Erneut versuchen</WebKnopf>
  </div>
);

/**
 * Ladezustand: graue Platzhalter in der Form des Inhalts, ohne Bewegung.
 * `kacheln` und `karten` sind Zahlen der Platzhalter; der Bereich meldet sich
 * Vorleseprogrammen als "wird geladen".
 */
export const WebLaden: React.FC<{ kacheln?: number; karten?: number; text: string }> = ({ kacheln = 0, karten = 0, text }) => (
  <div role="status" aria-live="polite">
    <span className="web-nur-vorlesen">{text}</span>
    {kacheln > 0 && (
      <div className="web-raster web-raster--kacheln" aria-hidden="true">
        {Array.from({ length: kacheln }, (_, i) => <span key={i} className="web-skelett web-skelett--kachel" />)}
      </div>
    )}
    {karten > 0 && (
      <div className="web-raster web-raster--zwei" style={{ marginTop: kacheln > 0 ? 'var(--app-abstand-basis)' : 0 }} aria-hidden="true">
        {Array.from({ length: karten }, (_, i) => <span key={i} className="web-skelett web-skelett--karte" />)}
      </div>
    )}
  </div>
);
