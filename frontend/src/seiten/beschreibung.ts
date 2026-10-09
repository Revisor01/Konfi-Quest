// Die gemeinsame Beschreibung einer Seite für App und Web-Fassung
// (Simon, 09.10.2026: „Filter ja. Wenn wir dann nur einen Ort haben prima").
//
// Jede Seite gibt es zweimal: die Darstellung der App (components/**/pages,
// views) und die Web-Fassung (components/**/web), eine Weiche
// (useBreitesLayout) wählt. Laden, Rechte und Zähler teilten sich beide schon;
// Reiter, Filter und Leertexte standen bis 09.10.2026 in beiden Fassungen
// eigens -- ein umbenannter Reiter musste zweimal nachgezogen werden und lief
// sonst auseinander.
//
// Jetzt beschreibt je Seite EINE Datei unter frontend/src/seiten/, was beide
// zeigen: Reiter und Filter mit Schlüssel, Beschriftung, Leertext und dem
// Satz zur Zahl. App und Web lesen daraus; ob ein Reiter als IonSegment oder
// als Chip erscheint, entscheidet die Fassung. Ein Eintrag, den es mit
// Absicht nur in einer Fassung gibt, trägt `nurIn` und den Grund in `warum`
// -- so steht der Unterschied an derselben Stelle wie das Gemeinsame.

/** Die zwei Darstellungen einer Seite. */
export type Fassung = 'app' | 'web';

interface WahlGrund<S extends string, T> {
  /** Der Wert im Code und in der Adresse (`?filter=`, `?segment=`). */
  schluessel: S;
  /** Die Beschriftung, in beiden Fassungen dieselbe. */
  label: string;
  /**
   * Kürzere Beschriftung für die Reiterleiste der App, wo drei oder vier
   * Reiter in die Breite eines Telefons passen müssen („GoDi" statt
   * „Gottesdienst"). Ein bewusster Unterschied; der Browser zeigt `label`.
   */
  kurz?: string;
  /** Gehört ein Eintrag zu dieser Wahl? Fehlt es, rechnet die Seite die Liste selbst (Grund am Eintrag). */
  passt?(eintrag: T): boolean;
  /** Was dasteht, wenn die Liste hinter dieser Wahl leer ist. */
  leer?: string;
  /**
   * Der Satz zur Zahl am Reiter für Vorleseprogramme, ohne die Zahl
   * („Events warten auf Verbuchung"). Fehlt er, hat der Reiter keine Zahl.
   */
  zahlText?: (anzahl: number) => string;
}

/**
 * Ein Reiter oder eine Filteroption einer Seite. Gibt es sie mit Absicht nur
 * in einer Fassung, nennt `nurIn` die Fassung und `warum` den Grund -- ohne
 * Grund baut es nicht.
 */
export type Wahl<S extends string = string, T = unknown> = WahlGrund<S, T> & (
  | { nurIn?: undefined; warum?: undefined }
  | { nurIn: Fassung; warum: string }
);

/**
 * Hält die Reihenfolge und die Schlüssel als Typ fest:
 * `wahlen([{ schluessel: 'a', ... }, { schluessel: 'b', ... }])` ergibt `Wahl<'a' | 'b'>[]`.
 */
export function wahlen<const S extends string, T = unknown>(liste: ReadonlyArray<Wahl<S, T>>): ReadonlyArray<Wahl<S, T>> {
  return liste;
}

/** Die Wahlen, die eine Fassung zeigt, in der beschriebenen Reihenfolge. */
export function inFassung<S extends string, T>(liste: ReadonlyArray<Wahl<S, T>>, fassung: Fassung): Array<Wahl<S, T>> {
  return liste.filter((w) => w.nurIn === undefined || w.nurIn === fassung);
}

/** Die Schlüssel, die eine Fassung kennt -- etwa die erlaubten Werte von `?filter=`. */
export function schluesselIn<S extends string, T>(liste: ReadonlyArray<Wahl<S, T>>, fassung: Fassung): S[] {
  return inFassung(liste, fassung).map((w) => w.schluessel);
}

/** Die Wahl zu einem Schlüssel. Ein unbekannter Schlüssel ist ein Fehler im Code, kein Zustand. */
export function wahlVon<S extends string, T>(liste: ReadonlyArray<Wahl<S, T>>, schluessel: S): Wahl<S, T> {
  const treffer = liste.find((w) => w.schluessel === schluessel);
  if (!treffer) throw new Error(`Unbekannte Wahl: ${schluessel}`);
  return treffer;
}

/** Die Beschriftung zu einem Schlüssel. */
export const labelVon = <S extends string, T>(liste: ReadonlyArray<Wahl<S, T>>, schluessel: S): string =>
  wahlVon(liste, schluessel).label;

/** Der Leertext zu einem Schlüssel (leer, wenn die Beschreibung keinen nennt). */
export const leerVon = <S extends string, T>(liste: ReadonlyArray<Wahl<S, T>>, schluessel: S): string =>
  wahlVon(liste, schluessel).leer ?? '';

/** Der Vorlesesatz zur Zahl eines Reiters (undefined, wenn er keine Zahl trägt). */
export const zahlTextVon = <S extends string, T>(liste: ReadonlyArray<Wahl<S, T>>, schluessel: S, anzahl: number): string | undefined =>
  wahlVon(liste, schluessel).zahlText?.(anzahl);

/** Einzahl oder Mehrzahl -- für die Sätze an den Zahlen. */
export const zahlwort = (einzahl: string, mehrzahl: string) => (anzahl: number): string =>
  anzahl === 1 ? einzahl : mehrzahl;
