// Kennzahlen der Support-Ansicht, zusammengefasst je Landeskirche und
// Kirchenkreis (Web-Version, Entscheidungen 3 und 6, 02.10.2026).
//
// Simon: Kirchenkreis und Landeskirche sind Zuordnungen an der Gemeinde, "vor
// allem fuer Statistiken je Landeskirche, je Kirchenkreis und je Gemeinde".
// Der Server liefert die Zahlen je Gemeinde (GET /support/statistik); das
// Zusammenfassen geschieht hier, an EINER Stelle, damit Gesamtzeile, Baum und
// Zaehler "ohne Zuordnung" nicht auseinanderlaufen.
//
// Gezaehlt werden Konten je Gemeinde und Rolle. Ein Konto, das in zwei
// Gemeinden mitarbeitet, zaehlt in beiden -- die Summe ist die Zahl der
// Mitgliedschaften, nicht der Personen. Namen von Personen kommen nicht vor.

import type { GemeindeKennzahlen } from '../types/support';

export interface Summe {
  gemeinden: number;
  aktiveGemeinden: number;
  konfis: number;
  teamer: number;
  leitung: number;
  gemeindeleitung: number;
  /** Alle vier Rollen zusammen. */
  konten: number;
  /** Konten mit Anmeldung oder Nutzung in den letzten 30 Tagen. */
  aktiv30: number;
  jahrgaenge: number;
}

export interface KirchenkreisKnoten {
  /** Eindeutig im ganzen Baum, fuer React-Schluessel und Aufklappen. */
  schluessel: string;
  id: number | null;
  name: string;
  summe: Summe;
  gemeinden: GemeindeKennzahlen[];
}

export interface LandeskircheKnoten {
  schluessel: string;
  id: number | null;
  name: string;
  summe: Summe;
  kirchenkreise: KirchenkreisKnoten[];
}

export interface KennzahlenBaum {
  gesamt: Summe;
  landeskirchen: LandeskircheKnoten[];
  /** Gemeinden ohne Kirchenkreis (und damit ohne Landeskirche). */
  ohneZuordnung: number;
}

export const OHNE_LANDESKIRCHE = 'Ohne Landeskirche';
export const OHNE_KIRCHENKREIS = 'Ohne Kirchenkreis';

const leer = (): Summe => ({
  gemeinden: 0, aktiveGemeinden: 0, konfis: 0, teamer: 0, leitung: 0,
  gemeindeleitung: 0, konten: 0, aktiv30: 0, jahrgaenge: 0,
});

/** Zahl oder 0 -- ein fehlendes Feld darf keine Summe zu NaN machen. */
const alsZahl = (wert: unknown): number => (typeof wert === 'number' && Number.isFinite(wert) ? wert : 0);

/** Die Kennzahlen EINER Gemeinde als Summe. */
export function summeVon(gemeinde: GemeindeKennzahlen): Summe {
  const k = gemeinde.konten ?? { konfi: 0, teamer: 0, admin: 0, org_admin: 0 };
  const konfis = alsZahl(k.konfi);
  const teamer = alsZahl(k.teamer);
  const leitung = alsZahl(k.admin);
  const gemeindeleitung = alsZahl(k.org_admin);
  return {
    gemeinden: 1,
    aktiveGemeinden: gemeinde.is_active ? 1 : 0,
    konfis,
    teamer,
    leitung,
    gemeindeleitung,
    konten: konfis + teamer + leitung + gemeindeleitung,
    aktiv30: alsZahl(gemeinde.aktiv_30_tage),
    jahrgaenge: alsZahl(gemeinde.jahrgaenge),
  };
}

function addiere(ziel: Summe, dazu: Summe): void {
  for (const feld of Object.keys(ziel) as Array<keyof Summe>) ziel[feld] += dazu[feld];
}

const nachName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'de');

/** Gruppen ohne Zuordnung stehen hinten, sonst alphabetisch. */
const ohneZuletzt = <T extends { id: number | null; name: string }>(a: T, b: T) =>
  (a.id === null ? 1 : 0) - (b.id === null ? 1 : 0) || nachName(a, b);

/**
 * Baut aus der Gemeindeliste den Baum Landeskirche -> Kirchenkreis -> Gemeinde
 * samt Summen je Ebene. Gemeinden ohne Kirchenkreis stehen unter
 * "Ohne Landeskirche" / "Ohne Kirchenkreis".
 */
export function kennzahlenBaum(gemeinden: GemeindeKennzahlen[]): KennzahlenBaum {
  const gesamt = leer();
  const lks = new Map<string, LandeskircheKnoten>();
  let ohneZuordnung = 0;

  for (const g of gemeinden) {
    const summe = summeVon(g);
    addiere(gesamt, summe);
    if (g.kirchenkreis_id == null) ohneZuordnung += 1;

    const lkId = g.landeskirche_id ?? null;
    const lkSchluessel = lkId === null ? 'lk-ohne' : `lk-${lkId}`;
    let lk = lks.get(lkSchluessel);
    if (!lk) {
      lk = {
        schluessel: lkSchluessel,
        id: lkId,
        name: lkId === null ? OHNE_LANDESKIRCHE : (g.landeskirche || OHNE_LANDESKIRCHE),
        summe: leer(),
        kirchenkreise: [],
      };
      lks.set(lkSchluessel, lk);
    }
    addiere(lk.summe, summe);

    const kkId = g.kirchenkreis_id ?? null;
    const kkSchluessel = kkId === null ? `kk-ohne-${lkSchluessel}` : `kk-${kkId}`;
    let kk = lk.kirchenkreise.find((k) => k.schluessel === kkSchluessel);
    if (!kk) {
      kk = {
        schluessel: kkSchluessel,
        id: kkId,
        name: kkId === null ? OHNE_KIRCHENKREIS : (g.kirchenkreis || OHNE_KIRCHENKREIS),
        summe: leer(),
        gemeinden: [],
      };
      lk.kirchenkreise.push(kk);
    }
    addiere(kk.summe, summe);
    kk.gemeinden.push(g);
  }

  const landeskirchen = [...lks.values()].sort(ohneZuletzt);
  for (const lk of landeskirchen) {
    lk.kirchenkreise.sort(ohneZuletzt);
    for (const kk of lk.kirchenkreise) kk.gemeinden.sort(nachName);
  }
  return { gesamt, landeskirchen, ohneZuordnung };
}

/** Zahl in deutscher Schreibweise (1.234). */
export const zahl = (n: number): string => n.toLocaleString('de-DE');

/** "1 Gemeinde", "3 Gemeinden". */
export const mitEinheit = (n: number, eins: string, viele: string): string => `${zahl(n)} ${n === 1 ? eins : viele}`;

/** Eine Zeile Kennzahlen in Kurzform, fuer Baum und Gemeinde. */
export const summeKurz = (s: Summe): string => [
  mitEinheit(s.konfis, 'Konfi', 'Konfis'),
  `${zahl(s.teamer)} Team`,
  `${zahl(s.leitung + s.gemeindeleitung)} Leitung`,
  `${zahl(s.aktiv30)} aktiv`,
].join(' · ');
