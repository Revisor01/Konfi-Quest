// Eingabefeld der Web-Fassung: sichtbare Beschriftung ueber dem Feld, ein
// Hinweis darunter. Ein echtes <input> mit <label for> -- der Name fuer
// Vorleseprogramme ist die Beschriftung, Pflichtfelder tragen aria-required
// (der Stern kommt aus dem Stylesheet, nicht aus dem Text). Die Schrift
// ist mindestens 1rem, sonst zoomt iOS beim Antippen heran.

import React, { useId } from 'react';

export interface WebFeldProps {
  label: string;
  wert: string;
  onWert: (wert: string) => void;
  pflicht?: boolean;
  typ?: 'text' | 'email' | 'tel' | 'number' | 'password';
  autocomplete?: 'off' | 'name' | 'email' | 'tel' | 'username' | 'new-password' | 'current-password';
  /** Erklaerung unter dem Feld. */
  hinweis?: string;
  deaktiviert?: boolean;
  /** Grauer Beispieltext im leeren Feld; der Name bleibt die Beschriftung. */
  platzhalter?: string;
  /** Grenzen und Schrittweite für Zahlen (typ="number"). */
  min?: number;
  max?: number;
  schritt?: number;
  /**
   * Kennung eines Elements außerhalb des Feldes, das es zusätzlich beschreibt
   * (aria-describedby), etwa die Anforderungen an ein neues Passwort.
   */
  beschriebenVon?: string;
}

const WebFeld: React.FC<WebFeldProps> = ({
  label, wert, onWert, pflicht = false, typ = 'text', autocomplete = 'off', hinweis, deaktiviert = false,
  platzhalter, min, max, schritt, beschriebenVon,
}) => {
  const id = useId();
  const hinweisId = `${id}-hinweis`;
  const beschreibung = [hinweis ? hinweisId : null, beschriebenVon ?? null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="web-feld">
      <label htmlFor={id} className={pflicht ? 'web-feld__label web-feld__label--pflicht' : 'web-feld__label'}>{label}</label>
      <input
        id={id}
        className="web-eingabe"
        type={typ}
        autoComplete={autocomplete}
        value={wert}
        placeholder={platzhalter}
        min={min}
        max={max}
        step={schritt}
        disabled={deaktiviert}
        aria-required={pflicht ? 'true' : undefined}
        aria-describedby={beschreibung}
        onChange={(e) => onWert(e.target.value)}
      />
      {hinweis && <p id={hinweisId} className="web-feld__hinweis">{hinweis}</p>}
    </div>
  );
};

export default WebFeld;
