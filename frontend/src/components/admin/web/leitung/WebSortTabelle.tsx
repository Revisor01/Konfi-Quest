// Tabelle der Web-Fassung der Leitung mit Spalten, die sich sortieren lassen:
// dieselbe Tabelle wie components/web/WebTabelle.tsx (gleiche Klassen, damit
// Kopf, Hover und schmale Flaeche gleich aussehen), nur dass der Kopf einer
// sortierbaren Spalte ein Knopf ist. Der Zustand der Sortierung (aria-sort)
// steht am Kopf, der Pfeil daneben ist nur Zierde.
//
// Seit 07.10.2026 sortiert auch WebTabelle selbst (Spalten mit `sortWert`).
// Diese Tabelle bleibt fuer die Seiten, die die Ordnung selbst halten
// (`sortierung`/`onSortieren`: Konfi- und Team-Liste, dieselbe Ordnung fuer
// Liste und Kacheln); ohne `onSortieren` sortiert sie wie WebTabelle.

import React, { useMemo, useState } from 'react';
import { WebSortKopf, type WebSpalte } from '../../../web/WebTabelle';
import { ariaSortVon, naechsteSortierung, sortiereZeilen, type TabellenSortierung } from '../../../../utils/tabelleSortieren';
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
  /** Zusaetzliche Klasse an der Tabelle. */
  klasse?: string;
  sortierung?: WebSortierung;
  /** Ein Klick auf den Kopf einer sortierbaren Spalte (Schluessel der Spalte). */
  onSortieren?: (schluessel: string) => void;
}

function WebSortTabelle<T>({
  beschriftung, spalten, zeilen, zeileSchluessel, zeileKlasse, mittig = false, fest = false, klasse, sortierung, onSortieren,
}: WebSortTabelleProps<T>): React.ReactElement {
  const zellKlasse = (s: WebSortSpalte<T>) =>
    [s.zahl ? 'web-zahl' : '', s.optional ? 'web-optional' : '', s.klasse ?? ''].filter(Boolean).join(' ') || undefined;
  // Ohne `onSortieren` sortiert die Tabelle selbst nach `sortWert` (wie WebTabelle);
  // mit `onSortieren` sortiert die Seite (Konfi- und Team-Liste: dieselbe
  // Ordnung gilt fuer Liste und Kacheln).
  const [eigene, setEigene] = useState<TabellenSortierung | null>(null);
  const aussen = Boolean(onSortieren);
  const aktuell = aussen ? sortierung ?? null : eigene;
  const sortierbar = (s: WebSortSpalte<T>) => (aussen ? Boolean(s.sortierbar) : Boolean(s.sortWert));
  const sortSpalte = !aussen && eigene ? spalten.find((s) => s.schluessel === eigene.schluessel && s.sortWert) : undefined;
  const geordnet = useMemo(
    () => (!aussen && eigene && sortSpalte?.sortWert ? sortiereZeilen(zeilen, sortSpalte.sortWert, eigene.richtung) : zeilen),
    [aussen, zeilen, eigene, sortSpalte],
  );
  const klick = (schluessel: string) => {
    if (onSortieren) onSortieren(schluessel);
    else setEigene((jetzt) => naechsteSortierung(jetzt, schluessel));
  };
  return (
    <div className="web-tabelle-huelle">
      <div className="web-tabelle-scroll">
        <table className={['web-tabelle', mittig ? 'web-tabelle--mittig' : '', fest ? 'web-tabelle--fest' : '', klasse ?? ''].filter(Boolean).join(' ')} aria-label={beschriftung}>
          <thead>
            <tr>
              {spalten.map((s) => (
                <th key={s.schluessel} scope="col" className={zellKlasse(s)} style={s.breite ? { width: s.breite } : undefined} aria-sort={ariaSortVon(sortierbar(s), aktuell, s.schluessel)}>
                  {sortierbar(s) && !s.kopfVersteckt ? (
                    <WebSortKopf kopf={s.kopf} aktiv={aktuell?.schluessel === s.schluessel} richtung={aktuell?.richtung} onKlick={() => klick(s.schluessel)} />
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

export default WebSortTabelle;
