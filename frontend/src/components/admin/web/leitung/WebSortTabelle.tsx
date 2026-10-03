// Tabelle der Web-Fassung der Leitung mit Spalten, die sich sortieren lassen:
// dieselbe Tabelle wie components/web/WebTabelle.tsx (gleiche Klassen, damit
// Kopf, Hover und schmale Flaeche gleich aussehen), nur dass der Kopf einer
// sortierbaren Spalte ein Knopf ist. Der Zustand der Sortierung (aria-sort)
// steht am Kopf, der Pfeil daneben ist nur Zierde.
//
// Warum eine eigene Tabelle statt WebTabelle: Der allgemeine Baustein kennt nur
// Texte im Kopf. Wird die Sortierung spaeter in WebTabelle aufgenommen, faellt
// diese Datei weg.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AUFKLAPPEN, ICON_ZUKLAPPEN } from '../../../shared/icons';
import type { WebSpalte } from '../../../web/WebTabelle';
import '../../../../theme/web/leitung.css';

export interface WebSortSpalte<T> extends WebSpalte<T> {
  /** Der Kopf ist ein Knopf, der nach dieser Spalte ordnet. */
  sortierbar?: boolean;
}

export interface WebSortierung {
  schluessel: string;
  richtung: 'auf' | 'ab';
}

export interface WebSortTabelleProps<T> {
  beschriftung: string;
  spalten: ReadonlyArray<WebSortSpalte<T>>;
  zeilen: readonly T[];
  zeileSchluessel: (zeile: T) => string | number;
  zeileKlasse?: (zeile: T) => string | undefined;
  mittig?: boolean;
  fest?: boolean;
  sortierung?: WebSortierung;
  /** Ein Klick auf den Kopf einer sortierbaren Spalte (Schluessel der Spalte). */
  onSortieren?: (schluessel: string) => void;
}

function WebSortTabelle<T>({
  beschriftung, spalten, zeilen, zeileSchluessel, zeileKlasse, mittig = false, fest = false, sortierung, onSortieren,
}: WebSortTabelleProps<T>): React.ReactElement {
  const zellKlasse = (s: WebSortSpalte<T>) =>
    [s.zahl ? 'web-zahl' : '', s.optional ? 'web-optional' : '', s.klasse ?? ''].filter(Boolean).join(' ') || undefined;
  const ariaSort = (s: WebSortSpalte<T>): 'ascending' | 'descending' | 'none' | undefined => {
    if (!s.sortierbar) return undefined;
    if (sortierung?.schluessel !== s.schluessel) return 'none';
    return sortierung.richtung === 'auf' ? 'ascending' : 'descending';
  };
  return (
    <div className="web-tabelle-huelle">
      <div className="web-tabelle-scroll">
        <table className={['web-tabelle', mittig ? 'web-tabelle--mittig' : '', fest ? 'web-tabelle--fest' : ''].filter(Boolean).join(' ')} aria-label={beschriftung}>
          <thead>
            <tr>
              {spalten.map((s) => (
                <th key={s.schluessel} scope="col" className={zellKlasse(s)} style={s.breite ? { width: s.breite } : undefined} aria-sort={ariaSort(s)}>
                  {s.sortierbar && onSortieren ? (
                    <button type="button" className="web-sortkopf" onClick={() => onSortieren(s.schluessel)}>
                      {s.kopf}
                      <IonIcon
                        icon={sortierung?.schluessel === s.schluessel && sortierung.richtung === 'auf' ? ICON_ZUKLAPPEN : ICON_AUFKLAPPEN}
                        className={sortierung?.schluessel === s.schluessel ? 'web-sortkopf__pfeil web-sortkopf__pfeil--aktiv' : 'web-sortkopf__pfeil'}
                        aria-hidden="true"
                      />
                    </button>
                  ) : s.kopfVersteckt ? <span className="web-nur-vorlesen">{s.kopf}</span> : s.kopf}
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

export default WebSortTabelle;
