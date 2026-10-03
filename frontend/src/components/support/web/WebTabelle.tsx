// Tabelle der Web-Fassung: echte <table> mit Kopfzeile (bleibt beim Scrollen
// oben stehen), Hover, rechtsbuendigen Zahlen (tabular-nums). Die Zellen
// liefert die Seite -- die Tabelle kennt nur Spalten und Zeilen.
//
// Zeilen, die sich oeffnen, tragen in der Zelle der ersten Spalte einen
// echten Link mit der Klasse `web-link--zeile`: sein Netz spannt sich ueber
// die ganze Zeile (theme/web-ansicht.css). So geht Mittelklick auch auf der
// Zeile, ohne dass hier ein Klick-Handler stehen muss.

import React from 'react';

export interface WebSpalte<T> {
  schluessel: string;
  kopf: string;
  zelle: (zeile: T, index: number) => React.ReactNode;
  /** Zahlen stehen rechts. */
  zahl?: boolean;
  /** Weicht auf schmaler Flaeche zuerst (unter 900 px Tabellenbreite). */
  optional?: boolean;
  /** Spaltenbreite als CSS-Wert, z. B. '16%' oder '120px'. */
  breite?: string;
  /** Kopf nur fuer Vorleseprogramme (z. B. Aktionen). */
  kopfVersteckt?: boolean;
  /** Eigene Klasse an Kopf und Zellen der Spalte (Breite im Stylesheet statt inline). */
  klasse?: string;
}

export interface WebTabelleProps<T> {
  /** Name der Tabelle fuer Vorleseprogramme. */
  beschriftung: string;
  spalten: ReadonlyArray<WebSpalte<T>>;
  zeilen: readonly T[];
  zeileSchluessel: (zeile: T) => string | number;
  /** Zusaetzliche Klasse je Zeile (z. B. web-ungelesen). */
  zeileKlasse?: (zeile: T) => string | undefined;
  /** Zellen mittig statt oben ausrichten. */
  mittig?: boolean;
  /**
   * Feste Spaltenbreiten (`breite` der Spalten): mehrere Tabellen untereinander
   * -- eine je Kirchenkreis -- halten so ihre Spalten auf einer Linie. Eine
   * Spalte ohne Breite nimmt den Rest.
   */
  fest?: boolean;
}

function WebTabelle<T>({ beschriftung, spalten, zeilen, zeileSchluessel, zeileKlasse, mittig = false, fest = false }: WebTabelleProps<T>): React.ReactElement {
  const zellKlasse = (s: WebSpalte<T>) => [s.zahl ? 'web-zahl' : '', s.optional ? 'web-optional' : '', s.klasse ?? ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="web-tabelle-huelle">
      <div className="web-tabelle-scroll">
        <table className={['web-tabelle', mittig ? 'web-tabelle--mittig' : '', fest ? 'web-tabelle--fest' : ''].filter(Boolean).join(' ')} aria-label={beschriftung}>
          <thead>
            <tr>
              {spalten.map((s) => (
                <th key={s.schluessel} scope="col" className={zellKlasse(s)} style={s.breite ? { width: s.breite } : undefined}>
                  {s.kopfVersteckt ? <span className="web-nur-vorlesen">{s.kopf}</span> : s.kopf}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zeilen.map((zeile, index) => (
              <tr key={zeileSchluessel(zeile)} className={['web-zeile', zeileKlasse?.(zeile) ?? ''].filter(Boolean).join(' ')}>
                {spalten.map((s) => (
                  <td key={s.schluessel} className={zellKlasse(s)}>{s.zelle(zeile, index)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default WebTabelle;
