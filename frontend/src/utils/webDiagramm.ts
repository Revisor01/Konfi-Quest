// Rechnen fuer die Diagramme der Web-Fassung (03.10.2026): runde Teilstriche,
// Pfade fuer Balken und Linien. Rein, ohne DOM -- die Diagramme in
// components/support/web/ zeichnen nur, was hier berechnet ist.

/** Zahl in deutscher Schreibweise (1.234), fuer Achsen und Tooltips. */
export const zahlText = (n: number): string => n.toLocaleString('de-DE');

export interface Skala {
  /** Obergrenze der Achse -- ein Vielfaches des Schritts, nie unter dem groessten Wert. */
  max: number;
  schritt: number;
  /** 0, schritt, 2*schritt, ... max */
  ticks: number[];
}

const SCHRITTE = [1, 2, 2.5, 5, 10];

/**
 * Eine Achse mit wenigen, runden Teilstrichen (0, 25, 50, 75, 100 statt 0, 23,
 * 46 ...). `ziel` ist die ungefaehre Zahl der Abschnitte. Die Werte sind
 * Zaehlungen: der Schritt ist nie kleiner als 1, und nie ein Bruch ausser
 * 2,5 mal einer Zehnerpotenz ab 10 (also 25, 250 ...).
 */
export function schoeneSkala(hoechster: number, ziel = 4): Skala {
  const max = Number.isFinite(hoechster) && hoechster > 0 ? hoechster : 0;
  if (max === 0) return { max: ziel, schritt: 1, ticks: Array.from({ length: ziel + 1 }, (_, i) => i) };
  const roh = max / ziel;
  const potenz = 10 ** Math.floor(Math.log10(roh));
  let schritt = SCHRITTE.map((s) => s * potenz).find((s) => s >= roh) ?? 10 * potenz;
  // Zaehlungen kennen keinen halben Schritt: 2,5 bleibt nur, wenn das Ergebnis ganzzahlig ist.
  if (schritt < 1) schritt = 1;
  if (!Number.isInteger(schritt)) schritt = Math.ceil(schritt);
  const obergrenze = Math.ceil(max / schritt) * schritt;
  const ticks: number[] = [];
  for (let t = 0; t <= obergrenze + schritt / 1000; t += schritt) ticks.push(Math.round(t * 1000) / 1000);
  return { max: obergrenze, schritt, ticks };
}

/**
 * Pfad eines Balkens mit gerundetem oberen Ende (Radius `r`) und gerader Kante
 * unten am Boden. Zu niedrige Balken runden nur so weit, wie sie hoch sind.
 */
export function balkenPfad(x: number, y: number, breite: number, hoehe: number, r = 4): string {
  if (hoehe <= 0 || breite <= 0) return '';
  const rr = Math.max(0, Math.min(r, breite / 2, hoehe));
  const f = (n: number) => Math.round(n * 100) / 100;
  return [
    `M${f(x)},${f(y + hoehe)}`,
    `V${f(y + rr)}`,
    rr > 0 ? `Q${f(x)},${f(y)} ${f(x + rr)},${f(y)}` : `L${f(x)},${f(y)}`,
    `H${f(x + breite - rr)}`,
    rr > 0 ? `Q${f(x + breite)},${f(y)} ${f(x + breite)},${f(y + rr)}` : `L${f(x + breite)},${f(y)}`,
    `V${f(y + hoehe)}`,
    'Z',
  ].join('');
}

/** Pfad einer Linie durch die Punkte (gerade Strecken). */
export function linienPfad(punkte: ReadonlyArray<readonly [number, number]>): string {
  const f = (n: number) => Math.round(n * 100) / 100;
  return punkte.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${f(x)},${f(y)}`).join('');
}

/** Pfad der Flaeche unter einer Linie bis zum Boden `bodenY`. */
export function flaechenPfad(punkte: ReadonlyArray<readonly [number, number]>, bodenY: number): string {
  if (punkte.length === 0) return '';
  const f = (n: number) => Math.round(n * 100) / 100;
  const erster = punkte[0];
  const letzter = punkte[punkte.length - 1];
  return `${linienPfad(punkte)}L${f(letzter[0])},${f(bodenY)}L${f(erster[0])},${f(bodenY)}Z`;
}

export interface Segment {
  /** Index der Reihe. */
  reihe: number;
  /** Oberkante und Hoehe im Plot (Pixel), nach der Lueckenabzug. */
  y: number;
  hoehe: number;
  wert: number;
}

/**
 * Die Segmente eines gestapelten Balkens, von unten nach oben. Zwischen zwei
 * Segmenten bleibt `luecke` Pixel Flaechenfarbe (kein Rand um die Marken).
 * Segmente mit Wert 0 fehlen.
 */
export function stapelSegmente(werte: readonly number[], pixelProWert: number, bodenY: number, luecke = 2): Segment[] {
  const raus: Segment[] = [];
  let hoehe = 0;
  werte.forEach((wert, reihe) => {
    if (!(wert > 0)) return;
    const voll = wert * pixelProWert;
    const oben = bodenY - hoehe - voll;
    // Die Luecke sitzt UNTEN am Segment, zum Nachbarn darunter hin: Die Oberkante bleibt, wo
    // der Wert sie hinlegt, nur die Hoehe schrumpft. Das unterste Segment braucht keine.
    const abzug = raus.length > 0 ? Math.min(luecke, voll / 2) : 0;
    raus.push({ reihe, y: oben, hoehe: voll - abzug, wert });
    hoehe += voll;
  });
  return raus;
}
