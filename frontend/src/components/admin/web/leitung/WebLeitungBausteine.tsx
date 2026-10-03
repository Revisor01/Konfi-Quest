// Kleine Bausteine der Web-Fassung der Leitungs- und Verwaltungsseiten
// (docs/planung/web-alle-bereiche.md, Entscheidung 6): Kreis mit Initialen,
// Fortschrittsbalken, Filter-Auswahl ohne sichtbare Beschriftung, Zeilen, die
// sich per Knopf oeffnen, und der Weg nach draussen. Sie gehoeren zu diesem
// Bereich, bis die Koordination sie nach components/web/ zieht.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AUFKLAPPEN, ICON_EXTERN_OEFFNEN } from '../../../shared/icons';
import { linkOeffnen } from '../../../../services/systemDialoge';
import '../../../../theme/web/leitung.css';

// --- Kreis mit Initialen ----------------------------------------------------------

export type AvatarFarbe = 'konfis' | 'erreicht' | 'teamer' | 'users' | 'leitung' | 'neutral';

/** Kreis mit zwei Buchstaben vor einem Namen; die Farbe ist die der Rolle bzw. des Standes. */
export const WebAvatar: React.FC<{ text: string; farbe?: AvatarFarbe; gross?: boolean }> = ({ text, farbe = 'konfis', gross = false }) => (
  <span className={`web-avatar web-avatar--${farbe}${gross ? ' web-avatar--gross' : ''}`} aria-hidden="true">{text}</span>
);

// --- Fortschritt -----------------------------------------------------------------

export interface WebFortschrittProps {
  wert: number;
  ziel: number;
  /** Die Farbe der Punkteart. */
  art: 'gottesdienst' | 'gemeinde' | 'gesamt';
  /** Das Ziel ist erreicht: der Balken wird gruen. */
  erreicht?: boolean;
  /** Was gezaehlt wird, fuer Vorleseprogramme ("Punkte"). */
  einheit?: string;
  /** Prozent hinter der Zahl, wenn es mehr als das Ziel gibt. */
  prozent?: number;
}

/** "7 / 10" mit schmalem Balken darunter. Der Balken ist Zierde, der Satz steht fuer Vorleseprogramme da. */
export const WebFortschritt: React.FC<WebFortschrittProps> = ({ wert, ziel, art, erreicht = false, einheit = 'Punkte', prozent }) => {
  const anteil = ziel > 0 ? Math.min(100, Math.round((wert / ziel) * 100)) : 0;
  return (
    <span className={`web-fortschritt web-fortschritt--${art}${erreicht ? ' web-fortschritt--erreicht' : ''}`}>
      <span className="web-fortschritt__text" aria-hidden="true">
        <span>{wert} / {ziel}</span>
        {prozent !== undefined && prozent > 100 && <span className="web-fortschritt__prozent">{prozent} %</span>}
      </span>
      <span className="web-nur-vorlesen">{wert} von {ziel} {einheit}</span>
      <span className="web-fortschritt__spur" aria-hidden="true">
        <span className="web-fortschritt__fuellung" style={{ width: `${anteil}%` }} />
      </span>
    </span>
  );
};

// --- Auswahl fuer die Werkzeugleiste ----------------------------------------------

export interface WebFilterOption {
  wert: string;
  label: string;
}

/** Eine Auswahl neben der Suche: ein echtes <select>, der Name steht als aria-label (kein Beschriftungstext darueber). */
export const WebFilterAuswahl: React.FC<{
  label: string;
  wert: string;
  onWert: (wert: string) => void;
  optionen: ReadonlyArray<WebFilterOption>;
}> = ({ label, wert, onWert, optionen }) => (
  <div className="web-auswahl web-filterauswahl">
    <select className="web-eingabe web-eingabe--auswahl" aria-label={label} value={wert} onChange={(e) => onWert(e.target.value)}>
      {optionen.map((o) => <option key={o.wert} value={o.wert}>{o.label}</option>)}
    </select>
    <IonIcon icon={ICON_AUFKLAPPEN} className="web-auswahl__pfeil" aria-hidden="true" />
  </div>
);

// --- Zeile, die sich per Knopf oeffnet --------------------------------------------

/**
 * Der Name in der ersten Zelle einer Zeile, die ein Fenster oeffnet statt auf
 * eine andere Seite zu fuehren: ein Knopf, dessen Netz sich ueber die ganze
 * Zeile spannt (wie `web-link--zeile` bei Links). Mit der Tastatur erreichbar,
 * Enter und Leertaste oeffnen.
 */
export const WebZeilenKnopf: React.FC<{ children: React.ReactNode; onClick: () => void; 'aria-label'?: string }> = ({ children, onClick, 'aria-label': ariaLabel }) => (
  <button type="button" className="web-zeilenknopf" onClick={onClick} aria-label={ariaLabel}>{children}</button>
);

// --- Weg nach draussen -------------------------------------------------------------

/**
 * Ein Link auf eine fremde Seite. Geoeffnet wird ueber linkOeffnen
 * (services/systemDialoge.ts): Die Huelle meldet den Abstecher bei der
 * App-Sperre an -- die Leitplanke "Links nach draussen" (linkOeffnen.test.ts)
 * verlangt das fuer jeden target="_blank". Der href bleibt fuer Mittelklick,
 * Rechtsklick und Vorleseprogramme.
 */
export const WebExternLink: React.FC<{ href: string; children: React.ReactNode; className?: string; 'aria-label'?: string; title?: string }> = ({
  href, children, className, 'aria-label': ariaLabel, title,
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className={className}
    aria-label={ariaLabel}
    title={title}
    onClick={(e) => {
      // Strg- und Umschalt-Klick, Mittelklick: der Browser macht es selbst.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      linkOeffnen(href);
    }}
  >
    {children}
  </a>
);

/** Das Symbol "oeffnet ausserhalb" als kleiner Zusatz hinter einem Namen. */
export const WebExternSymbol: React.FC = () => <IonIcon icon={ICON_EXTERN_OEFFNEN} className="web-extern-symbol" aria-hidden="true" />;
