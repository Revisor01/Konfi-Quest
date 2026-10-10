// Kleine Bausteine der Web-Fassung der Leitungs- und Verwaltungsseiten
// (docs/planung/web-alle-bereiche.md, Entscheidung 6): Kreis mit Initialen,
// Punktebalken, Karte einer Person im Raster, Filter-Auswahl ohne sichtbare
// Beschriftung, Zeilen, die sich per Knopf oeffnen, und der Weg nach draussen.
// Sie gehoeren zu diesem Bereich, bis die Koordination sie nach components/web/
// zieht. Kreis und Filter-Auswahl stehen seit 10.10.2026 dort (WebKreis,
// WebFilterAuswahl); hier bleiben ihre Namen fuer die Seiten, die sie schon nutzen.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_BEARBEITEN, ICON_EXTERN_OEFFNEN, ICON_HAKEN_GEFUELLT, ICON_LOESCHEN } from '../../../shared/icons';
import WebKnopf from '../../../web/WebKnopf';
import WebKreis, { type WebKreisPersonTon, type WebKreisSymbolTon } from '../../../web/WebKreis';
import { linkOeffnen } from '../../../../services/systemDialoge';
import { rollenFarbe, rollenName } from '../../../../utils/rollenNamen';
import type { KennzahlSymbol } from '../../../web/kennzahlSymbole';
import '../../../../theme/web/leitung.css';

// --- Kreis mit Initialen ----------------------------------------------------------

export type AvatarFarbe = WebKreisPersonTon;

/** Kreis mit zwei Buchstaben vor einem Namen (der allgemeine Baustein: components/web/WebKreis.tsx). */
export const WebAvatar: React.FC<{ text: string; farbe?: AvatarFarbe; gross?: boolean }> = ({ text, farbe = 'konfis', gross = false }) => (
  <WebKreis text={text} ton={farbe} gross={gross} />
);

// --- Rolle als Marke ----------------------------------------------------------------

/**
 * Die Rolle einer Person als Marke in der Farbe der Rolle (utils/rollenNamen:
 * Gemeindeleitung, Leitung, Teamer:in -- dieselbe Farbe wie Strich und Kreis
 * in der App). Der Text ist das Wort der Rolle, die Farbe nie allein der Traeger.
 */
export const WebRolleMarke: React.FC<{ rolle?: string | null; text?: string }> = ({ rolle, text }) => (
  <span className={`web-rollenmarke web-rollenmarke--${rollenFarbe(rolle)}`}>{text ?? rollenName(rolle)}</span>
);

// --- Punktebalken ------------------------------------------------------------------

export interface WebFortschrittProps {
  wert: number;
  ziel: number;
  /** Die Farbe der Punkteart. */
  art: 'gottesdienst' | 'gemeinde' | 'gesamt';
  /** Name fuer Vorleseprogramme: "Gottesdienst-Punkte". */
  name: string;
  /** Sichtbar links ueber dem Balken (Karten); in der Tabelle steht sie im Spaltenkopf. */
  beschriftung?: string;
  /** Prozent hinter der Zahl, wenn es mehr als das Ziel gibt. */
  prozent?: number;
  /** Der Jahrgang zaehlt diese Punkteart nicht: Strich statt Balken. */
  abgeschaltet?: boolean;
}

/**
 * "7 / 10" ueber einem Balken, dazu ein Haken, sobald das Ziel erreicht ist.
 * Der Balken ist ein `progressbar` mit Name, Prozentwert und Text ("7 von 10");
 * die Zahl darueber ist fuer Sehende und fuer Vorleseprogramme ueberfluessig.
 * Die Farben der Punktarten sind die der Liste in der App.
 */
export const WebFortschritt: React.FC<WebFortschrittProps> = ({ wert, ziel, art, name, beschriftung, prozent, abgeschaltet = false }) => {
  const klassen = ['web-punktebalken', `web-punktebalken--${art}`, beschriftung ? 'web-punktebalken--beschriftet' : ''];
  if (abgeschaltet) {
    return (
      <span className={[...klassen, 'web-punktebalken--aus'].filter(Boolean).join(' ')}>
        <span className="web-punktebalken__kopf" aria-hidden="true">
          {beschriftung && <span className="web-punktebalken__name">{beschriftung}</span>}
          <span className="web-punktebalken__wert" title="Für diesen Jahrgang abgeschaltet">–</span>
        </span>
        <span className="web-nur-vorlesen">{name}: für diesen Jahrgang abgeschaltet</span>
      </span>
    );
  }
  const anteil = ziel > 0 ? Math.min(100, Math.round((wert / ziel) * 100)) : 0;
  const erreicht = ziel > 0 && wert >= ziel;
  if (erreicht) klassen.push('web-punktebalken--erreicht');
  return (
    <span className={klassen.filter(Boolean).join(' ')}>
      <span className="web-punktebalken__kopf" aria-hidden="true">
        {beschriftung && <span className="web-punktebalken__name">{beschriftung}</span>}
        <span className="web-punktebalken__wert">
          <span>{wert} / {ziel}</span>
          {(erreicht || (prozent !== undefined && prozent > 100)) && (
            <span className="web-punktebalken__zusatz">
              {prozent !== undefined && prozent > 100 && <span className="web-punktebalken__prozent">{prozent} %</span>}
              {erreicht && <span className="web-punktebalken__haken" aria-hidden="true"><IonIcon icon={ICON_HAKEN_GEFUELLT} /></span>}
            </span>
          )}
        </span>
      </span>
      <span
        className="web-punktebalken__spur"
        role="progressbar"
        aria-label={name}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={anteil}
        aria-valuetext={`${wert} von ${ziel}${erreicht ? ', Ziel erreicht' : ''}`}
      >
        <span className="web-punktebalken__fuellung" style={{ width: `${anteil}%` }} />
      </span>
    </span>
  );
};

// --- Auswahl fuer die Werkzeugleiste ----------------------------------------------

// Steht seit 10.10.2026 bei den allgemeinen Bausteinen (components/web/WebFilterAuswahl.tsx).
export { default as WebFilterAuswahl, type WebFilterOption } from '../../../web/WebFilterAuswahl';

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

export type SymbolTon = WebKreisSymbolTon;

/**
 * Das Symbol einer Zeile im farbigen Kreis (der allgemeine Baustein:
 * components/web/WebKreis.tsx). Die Farbe ist ein Ton der App; nur wo sie aus
 * den Daten kommt (die Farbe eines Levels), steht sie als CSS-Wert in `farbe`.
 */
export const WebSymbol: React.FC<{ icon: string; ton?: SymbolTon; farbe?: string; gross?: boolean }> = ({ icon, ton = 'neutral', farbe, gross = false }) => (
  <WebKreis icon={icon} ton={ton} farbe={farbe} gross={gross} />
);

// --- Zahl mit Symbol in einer Tabellenzelle -----------------------------------------------

/**
 * Eine Zahl mit dem Symbol ihrer Kennzahl (Badges, Zertifikate) in einer
 * Tabellenzelle -- dasselbe Symbol in derselben Bereichsfarbe wie auf der
 * Karte und der Kennzahl-Kachel (KENNZAHL_SYMBOL).
 */
export const WebZahlMitSymbol: React.FC<{ symbol: KennzahlSymbol; zahl: number; title: string }> = ({ symbol, zahl, title }) => (
  <span className="web-zahl-mit-symbol" title={title}>
    <IonIcon icon={symbol.icon} className="web-zahl-mit-symbol__symbol" style={{ color: symbol.farbe }} aria-hidden="true" />
    {zahl}
  </span>
);

// --- Karte einer Person im Raster ------------------------------------------------------

