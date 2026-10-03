// Kleine Bausteine der Web-Fassung der Leitungs- und Verwaltungsseiten
// (docs/planung/web-alle-bereiche.md, Entscheidung 6): Kreis mit Initialen,
// Fortschrittsbalken, Filter-Auswahl ohne sichtbare Beschriftung, Zeilen, die
// sich per Knopf oeffnen, und der Weg nach draussen. Sie gehoeren zu diesem
// Bereich, bis die Koordination sie nach components/web/ zieht.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AUFKLAPPEN, ICON_BEARBEITEN, ICON_EXTERN_OEFFNEN, ICON_LOESCHEN } from '../../../shared/icons';
import WebKnopf from '../../../web/WebKnopf';
import { linkOeffnen } from '../../../../services/systemDialoge';
import { rollenFarbe, rollenName } from '../../../../utils/rollenNamen';
import '../../../../theme/web/leitung.css';

// --- Kreis mit Initialen ----------------------------------------------------------

export type AvatarFarbe = 'konfis' | 'erreicht' | 'teamer' | 'users' | 'leitung' | 'neutral';

/** Kreis mit zwei Buchstaben vor einem Namen; die Farbe ist die der Rolle bzw. des Standes. */
export const WebAvatar: React.FC<{ text: string; farbe?: AvatarFarbe; gross?: boolean }> = ({ text, farbe = 'konfis', gross = false }) => (
  <span className={`web-avatar web-avatar--${farbe}${gross ? ' web-avatar--gross' : ''}`} aria-hidden="true">{text}</span>
);

// --- Rolle als Marke ----------------------------------------------------------------

/**
 * Die Rolle einer Person als Marke in der Farbe der Rolle (utils/rollenNamen:
 * Gemeindeleitung, Leitung, Teamer:in -- dieselbe Farbe wie Strich und Kreis
 * in der App). Der Text ist das Wort der Rolle, die Farbe nie allein der Traeger.
 */
export const WebRolleMarke: React.FC<{ rolle?: string | null; text?: string }> = ({ rolle, text }) => (
  <span className={`web-rolle web-rolle--${rollenFarbe(rolle)}`}>{text ?? rollenName(rolle)}</span>
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
export const WebExternLink: React.FC<{
  href: string;
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
  title?: string;
  /** Statt linkOeffnen: die Seite oeffnet den Link selbst (Messung, Pruefung). */
  onOeffnen?: (href: string) => void;
}> = ({
  href, children, className, 'aria-label': ariaLabel, title, onOeffnen,
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
      if (onOeffnen) onOeffnen(href);
      else linkOeffnen(href);
    }}
  >
    {children}
  </a>
);

/** Das Symbol "oeffnet ausserhalb" als kleiner Zusatz hinter einem Namen. */
export const WebExternSymbol: React.FC = () => <IonIcon icon={ICON_EXTERN_OEFFNEN} className="web-extern-symbol" aria-hidden="true" />;

// --- Aktionen am Ende einer Zeile ---------------------------------------------------

/**
 * "Bearbeiten" und "Loeschen" am Ende einer Zeile. Der Name der Zeile steht in
 * den Beschriftungen fuer Vorleseprogramme ("Sport bearbeiten"): Ohne ihn
 * hiessen alle Knoepfe der Tabelle gleich. Was die Person nicht darf, fehlt.
 */
export const WebZeilenAktionen: React.FC<{
  name: string;
  onBearbeiten?: () => void;
  onLoeschen?: () => void;
  /** Das Wort hinter dem Namen im Namen des Loesch-Knopfs (Vorgabe "löschen"). */
  loeschenWort?: string;
  loeschenTitel?: string;
}> = ({ name, onBearbeiten, onLoeschen, loeschenWort = 'löschen', loeschenTitel = 'Löschen' }) => {
  if (!onBearbeiten && !onLoeschen) return null;
  return (
    <div className="web-zeilenaktionen">
      {onBearbeiten && (
        <WebKnopf klein vorn onClick={onBearbeiten} aria-label={`${name} bearbeiten`}>
          <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
          <span className="web-knopf__text">Bearbeiten</span>
        </WebKnopf>
      )}
      {onLoeschen && (
        <WebKnopf klein vorn art="gefahr" symbol onClick={onLoeschen} aria-label={`${name} ${loeschenWort}`} title={loeschenTitel}>
          <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
        </WebKnopf>
      )}
    </div>
  );
};

// --- Symbol im farbigen Kreis ------------------------------------------------------------

export type SymbolTon = 'categories' | 'level' | 'jahrgang' | 'teamer' | 'material' | 'wrapped' | 'users' | 'erfolg' | 'neutral';

/**
 * Das Symbol einer Zeile im farbigen Kreis (wie der Kreis der Liste in der App).
 * Die Farbe ist ein Ton der App; nur wo sie aus den Daten kommt (die Farbe eines
 * Levels), steht sie als CSS-Wert in `farbe`. Das Symbol ist Zierde: Der Name
 * steht immer daneben.
 */
export const WebSymbol: React.FC<{ icon: string; ton?: SymbolTon; farbe?: string; gross?: boolean }> = ({ icon, ton = 'neutral', farbe, gross = false }) => (
  <span
    className={`web-symbol web-symbol--${ton}${gross ? ' web-symbol--gross' : ''}`}
    style={farbe ? { background: farbe } : undefined}
    aria-hidden="true"
  >
    <IonIcon icon={icon} />
  </span>
);
