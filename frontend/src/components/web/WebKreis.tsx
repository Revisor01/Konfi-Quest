// Der Kreis vor einem Namen in der Web-Fassung: zwei Buchstaben (Personen)
// oder ein Symbol (Kategorie, Level, Jahrgang ...) auf der Farbe der Rolle
// bzw. des Bereichs -- wie der Kreis der Liste in der App. EIN Baustein fuer
// Tabellenzeilen und Kopfbereiche (10.10.2026); bis dahin standen Initialen
// und Symbol als zwei Bausteine im Bereich der Leitung (WebAvatar, WebSymbol
// in admin/web/leitung/WebLeitungBausteine.tsx -- die heissen dort weiter so
// und reichen hierher durch).
//
// Der Kreis ist Zierde (aria-hidden): Der Name steht immer daneben.

import React from 'react';
import { IonIcon } from '@ionic/react';

/** Farben fuer Initialen: Rolle bzw. Stand einer Person. */
export type WebKreisPersonTon = 'konfis' | 'erreicht' | 'teamer' | 'users' | 'leitung' | 'neutral';
/** Farben fuer ein Symbol: der Bereich, zu dem die Zeile gehoert. */
export type WebKreisSymbolTon = 'categories' | 'level' | 'jahrgang' | 'teamer' | 'material' | 'wrapped' | 'users' | 'erfolg' | 'neutral';

export type WebKreisProps =
  | {
    /** Zwei Buchstaben einer Person. */
    text: string;
    icon?: undefined;
    ton?: WebKreisPersonTon;
    farbe?: undefined;
    gross?: boolean;
  }
  | {
    text?: undefined;
    icon: string;
    ton?: WebKreisSymbolTon;
    /** Nur wenn die Farbe aus den Daten kommt (Farbe eines Levels), als CSS-Wert. */
    farbe?: string;
    gross?: boolean;
  };

const WebKreis: React.FC<WebKreisProps> = (p) => {
  if (p.icon !== undefined) {
    const ton = p.ton ?? 'neutral';
    return (
      <span
        className={`web-symbol web-symbol--${ton}${p.gross ? ' web-symbol--gross' : ''}`}
        style={p.farbe ? { background: p.farbe } : undefined}
        aria-hidden="true"
      >
        <IonIcon icon={p.icon} />
      </span>
    );
  }
  const ton = p.ton ?? 'konfis';
  return <span className={`web-initialen web-initialen--${ton}${p.gross ? ' web-initialen--gross' : ''}`} aria-hidden="true">{p.text}</span>;
};

export default WebKreis;
