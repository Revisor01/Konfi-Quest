// Sortieren einer Tabelle der Web-Fassung nach einer Spalte (Simon,
// 07.10.2026: „bitte alle listen sortierbar machen durch klick auf den
// spaltennamen"). Jede Spalte nennt ihren Sortierwert (`sortWert`): Text,
// Zahl oder Datum. Texte nach deutscher Ordnung (Umlaute, Gross/klein egal,
// Zahlen im Text natuerlich: "Gruppe 2" vor "Gruppe 10"); leere Werte stehen
// in beiden Richtungen unten. Gleiche Werte behalten die Reihenfolge der Seite.

export type SortWert = string | number | Date | null | undefined;
export type SortRichtung = 'auf' | 'ab';

export interface TabellenSortierung {
  schluessel: string;
  richtung: SortRichtung;
}

const VERGLEICH = new Intl.Collator('de', { sensitivity: 'base', numeric: true });

const leer = (w: SortWert): boolean => w === null || w === undefined || w === '' || (typeof w === 'number' && Number.isNaN(w));

const alsZahl = (w: Date | number): number => (w instanceof Date ? w.getTime() : w);

/** Vergleicht zwei Sortierwerte aufsteigend; leere Werte zaehlen hier nicht. */
export function vergleiche(a: SortWert, b: SortWert): number {
  if (typeof a === 'string' || typeof b === 'string') return VERGLEICH.compare(String(a), String(b));
  return alsZahl(a as Date | number) - alsZahl(b as Date | number);
}

/** Die Zeilen nach `sortWert` in der Richtung, stabil; leere Werte immer unten. */
export function sortiereZeilen<T>(zeilen: readonly T[], sortWert: (zeile: T) => SortWert, richtung: SortRichtung): T[] {
  return zeilen
    .map((zeile, index) => ({ zeile, index, wert: sortWert(zeile) }))
    .sort((x, y) => {
      const xLeer = leer(x.wert);
      const yLeer = leer(y.wert);
      if (xLeer || yLeer) return xLeer === yLeer ? x.index - y.index : xLeer ? 1 : -1;
      const v = vergleiche(x.wert, y.wert);
      if (v !== 0) return richtung === 'auf' ? v : -v;
      return x.index - y.index;
    })
    .map((e) => e.zeile);
}

/** Erster Klick auf eine Spalte: aufsteigend; erneuter Klick dreht die Richtung. */
export function naechsteSortierung(jetzt: TabellenSortierung | null, schluessel: string): TabellenSortierung {
  if (jetzt?.schluessel === schluessel) return { schluessel, richtung: jetzt.richtung === 'auf' ? 'ab' : 'auf' };
  return { schluessel, richtung: 'auf' };
}

/** aria-sort einer Spalte: nur sortierbare Spalten tragen es. */
export function ariaSortVon(sortierbar: boolean, sortierung: TabellenSortierung | null | undefined, schluessel: string): 'ascending' | 'descending' | 'none' | undefined {
  if (!sortierbar) return undefined;
  if (sortierung?.schluessel !== schluessel) return 'none';
  return sortierung.richtung === 'auf' ? 'ascending' : 'descending';
}

/**
 * Sortierwert einer Status-Spalte: die Stelle des Status in seiner fachlichen
 * Reihe (Offenes zuerst), nicht das angezeigte Wort (Simon, 08.10.2026).
 * Alphabetisch stuende „Abgelehnt – Offen – Verbucht" da, nach der Reihe
 * „Offen – Verbucht – Abgelehnt". Ein Wert, der in der Reihe fehlt, steht
 * hinter allen bekannten; ein leerer (null) wie jeder leere Wert unten.
 * Absteigend dreht `sortiereZeilen` die Reihe um. Die Reihen selbst stehen
 * gesammelt in utils/statusReihenfolge.ts.
 */
export function nachReihe<S>(reihe: readonly S[]): (wert: S | null | undefined) => number | null {
  return (wert) => {
    if (wert === null || wert === undefined) return null;
    const stelle = reihe.indexOf(wert);
    return stelle === -1 ? reihe.length : stelle;
  };
}
