// Tabelle der Web-Fassung: echte <table> mit Kopfzeile (bleibt beim Scrollen
// oben stehen), Hover, rechtsbuendigen Zahlen (tabular-nums). Die Zellen
// liefert die Seite -- die Tabelle kennt nur Spalten und Zeilen.
//
// Zeilen, die sich oeffnen, tragen in der Zelle der ersten Spalte einen
// echten Link mit der Klasse `web-link--zeile`: sein Netz spannt sich ueber
// die ganze Zeile (theme/web-ansicht.css). So geht Mittelklick auch auf der
// Zeile, ohne dass hier ein Klick-Handler stehen muss.
//
// Sortieren: Eine Spalte mit `sortWert` hat einen Kopf zum Anklicken -- erst
// aufsteigend, dann absteigend (Simon, 07.10.2026: „bitte alle listen
// sortierbar machen durch klick auf den spaltennamen"). Bis zum ersten Klick
// gilt die Reihenfolge der Seite. Der Zustand steht als aria-sort am Kopf.

import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AUFKLAPPEN, ICON_ZUKLAPPEN } from '../shared/icons';
import {
  ariaSortVon,
  naechsteSortierung,
  sortiereZeilen,
  type SortWert,
  type TabellenSortierung,
} from '../../utils/tabelleSortieren';

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
  /** Wonach die Spalte sortiert (Text, Zahl, Datum); ohne ihn ist der Kopf nicht anklickbar. */
  sortWert?: (zeile: T) => SortWert;
}

/** Der Kopf einer sortierbaren Spalte: der Name als Knopf, daneben der Pfeil. */
export const WebSortKopf: React.FC<{ kopf: string; aktiv: boolean; richtung?: 'auf' | 'ab'; onKlick: () => void }> = ({ kopf, aktiv, richtung, onKlick }) => (
  <button type="button" className="web-sortkopf" onClick={onKlick}>
    {kopf}
    <IonIcon
      icon={aktiv && richtung === 'auf' ? ICON_ZUKLAPPEN : ICON_AUFKLAPPEN}
      className={aktiv ? 'web-sortkopf__pfeil web-sortkopf__pfeil--aktiv' : 'web-sortkopf__pfeil'}
      aria-hidden="true"
    />
  </button>
);

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
  const [sortierung, setSortierung] = useState<TabellenSortierung | null>(null);
  const sortSpalte = sortierung ? spalten.find((s) => s.schluessel === sortierung.schluessel && s.sortWert) : undefined;
  const geordnet = useMemo(
    () => (sortierung && sortSpalte?.sortWert ? sortiereZeilen(zeilen, sortSpalte.sortWert, sortierung.richtung) : zeilen),
    [zeilen, sortierung, sortSpalte],
  );
  return (
    <div className="web-tabelle-huelle">
      <div className="web-tabelle-scroll">
        <table className={['web-tabelle', mittig ? 'web-tabelle--mittig' : '', fest ? 'web-tabelle--fest' : ''].filter(Boolean).join(' ')} aria-label={beschriftung}>
          <thead>
            <tr>
              {spalten.map((s) => (
                <th
                  key={s.schluessel}
                  scope="col"
                  className={zellKlasse(s)}
                  style={s.breite ? { width: s.breite } : undefined}
                  aria-sort={ariaSortVon(Boolean(s.sortWert), sortierung, s.schluessel)}
                >
                  {s.sortWert && !s.kopfVersteckt ? (
                    <WebSortKopf
                      kopf={s.kopf}
                      aktiv={sortierung?.schluessel === s.schluessel}
                      richtung={sortierung?.richtung}
                      onKlick={() => setSortierung((jetzt) => naechsteSortierung(jetzt, s.schluessel))}
                    />
                  ) : s.kopfVersteckt ? <span className="web-nur-vorlesen">{s.kopf}</span> : s.kopf}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {geordnet.map((zeile, index) => (
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
