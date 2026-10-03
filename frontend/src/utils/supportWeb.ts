// Die Web-Fassung der Support-Ansicht (03.10.2026, docs/planung/support-web.md):
// Antwortformen der drei neuen Routen und alles Rechnen, das Uebersicht,
// Gemeinden, Posteingang und Anfragen gemeinsam brauchen -- rein, ohne
// Aufrufe, damit es sich einzeln pruefen laesst. Die Seiten tragen nur
// Darstellung und Aufrufe.
//
// Vertrag (Backend baut parallel genau danach):
//   GET /support/uebersicht                 -> SupportUebersicht
//   GET /support/gemeinden                  -> SupportGemeinde[]
//   GET /support/mail/eingang?zuordnung=alle -> MailEingangWeb[]
//
// Der Server darf nicht gebrochen werden und ein aelterer Server kennt die
// neuen Routen nicht: Alles, was hereinkommt, wird defensiv gelesen
// (fehlende Felder zaehlen 0 bzw. leer), ein Objekt der falschen Form ergibt
// null -- die Seite zeigt dann ihren Fehlerzustand statt zu stuerzen.

import type { AnfrageStatus, GemeindeAnfrage, MailEingangEintrag } from '../types/support';
import type { LizenzSchluessel } from './lizenzen';
import { datumKurz } from './dateUtils';
import { tageBis } from '../components/shared/eventFormatting';

// --- Kleine Helfer ---------------------------------------------------------------

const zahlOderNull = (wert: unknown): number => (typeof wert === 'number' && Number.isFinite(wert) ? wert : 0);
const textOderNull = (wert: unknown): string | null => (typeof wert === 'string' && wert.trim() ? wert : null);
const istObjekt = (wert: unknown): wert is Record<string, unknown> => !!wert && typeof wert === 'object' && !Array.isArray(wert);

/** Eine Reihe auf genau `laenge` Zahlen bringen (zu kurz: hinten 0, zu lang: gekappt). */
const reihe = (wert: unknown, laenge: number): number[] => {
  const quelle = Array.isArray(wert) ? wert : [];
  return Array.from({ length: laenge }, (_, i) => zahlOderNull(quelle[i]));
};

// --- Uebersicht (GET /support/uebersicht) -----------------------------------------

export interface UebersichtKennzahlen {
  gemeinden: { gesamt: number; testphase: number; lizenz: number; unbegrenzt: number; gesperrt: number };
  konten: { konfi: number; teamer: number; admin: number; org_admin: number };
  aktiv_30_tage: number;
  anfragen_offen: number;
  mails_ungelesen: number;
}

export interface UebersichtEntwicklung {
  /** '2025-11' ... '2026-10', aeltester zuerst. */
  monate: string[];
  gemeinden_neu: number[];
  konten_neu: { konfi: number[]; team: number[] };
  konten_gesamt: number[];
  anfragen_neu: number[];
}

export interface UebersichtAktivitaet {
  /** '2026-W29' ... '2026-W40', aelteste zuerst. */
  wochen: string[];
  antraege: number[];
  buchungen: number[];
  nachrichten: number[];
}

export interface UebersichtAnfrage {
  id: number;
  gemeinde: string;
  kontakt_name: string;
  status: AnfrageStatus;
  wunsch_lizenz: LizenzSchluessel | null;
  created_at: string;
  ungelesen: number;
}

/** Mail mit Zuordnung (Eingang mit `zuordnung=alle` und `neueste_mails` der Uebersicht). */
export interface MailEingangWeb extends Omit<MailEingangEintrag, 'auszug' | 'anhaenge'> {
  auszug?: string | null;
  anhaenge?: MailEingangEintrag['anhaenge'];
  anfrage_id: number | null;
  organization_id: number | null;
  gemeinde_name: string | null;
}

export interface UebersichtTestphase {
  id: number;
  display_name: string;
  trial_ends_at: string;
}

export interface SupportUebersicht {
  kennzahlen: UebersichtKennzahlen;
  entwicklung: UebersichtEntwicklung;
  aktivitaet: UebersichtAktivitaet;
  neueste_anfragen: UebersichtAnfrage[];
  neueste_mails: MailEingangWeb[];
  testphase_endet: UebersichtTestphase[];
}

const STATUS_WERTE: readonly AnfrageStatus[] = ['neu', 'in_arbeit', 'angelegt', 'abgelehnt'];
const alsStatus = (wert: unknown): AnfrageStatus => (STATUS_WERTE.includes(wert as AnfrageStatus) ? (wert as AnfrageStatus) : 'neu');
const alsPostfach = (wert: unknown): 'moin' | 'support' => (wert === 'support' ? 'support' : 'moin');
const idOderNull = (wert: unknown): number | null => (typeof wert === 'number' && Number.isInteger(wert) && wert > 0 ? wert : null);

/** Eine Mail aus dem Eingang oder der Uebersicht lesen; ohne Kennung: null. */
export function mailLesen(roh: unknown): MailEingangWeb | null {
  if (!istObjekt(roh)) return null;
  const id = idOderNull(roh.id);
  if (id === null) return null;
  return {
    id,
    postfach: alsPostfach(roh.postfach),
    von_adresse: typeof roh.von_adresse === 'string' ? roh.von_adresse : '',
    von_name: textOderNull(roh.von_name),
    betreff: textOderNull(roh.betreff),
    auszug: textOderNull(roh.auszug),
    gesendet_am: typeof roh.gesendet_am === 'string' ? roh.gesendet_am : '',
    gelesen_am: textOderNull(roh.gelesen_am),
    anhaenge: Array.isArray(roh.anhaenge) ? (roh.anhaenge as MailEingangEintrag['anhaenge']) : null,
    anfrage_id: idOderNull(roh.anfrage_id),
    organization_id: idOderNull(roh.organization_id),
    gemeinde_name: textOderNull(roh.gemeinde_name),
  };
}

/** GET /support/mail/eingang lesen (Liste); kein Array: null. */
export function eingangLesen(daten: unknown): MailEingangWeb[] | null {
  if (!Array.isArray(daten)) return null;
  return daten.map(mailLesen).filter((m): m is MailEingangWeb => m !== null);
}

/** GET /support/uebersicht lesen. Fehlen die Kennzahlen ganz, ist die Antwort unbrauchbar: null. */
export function uebersichtLesen(daten: unknown): SupportUebersicht | null {
  if (!istObjekt(daten) || !istObjekt(daten.kennzahlen)) return null;
  const k = daten.kennzahlen;
  const g = istObjekt(k.gemeinden) ? k.gemeinden : {};
  const ko = istObjekt(k.konten) ? k.konten : {};
  const e = istObjekt(daten.entwicklung) ? daten.entwicklung : {};
  const a = istObjekt(daten.aktivitaet) ? daten.aktivitaet : {};
  const monate = Array.isArray(e.monate) ? e.monate.filter((m): m is string => typeof m === 'string') : [];
  const wochen = Array.isArray(a.wochen) ? a.wochen.filter((w): w is string => typeof w === 'string') : [];
  const kn = istObjekt(e.konten_neu) ? e.konten_neu : {};

  const anfragen = (Array.isArray(daten.neueste_anfragen) ? daten.neueste_anfragen : [])
    .filter(istObjekt)
    .map((x): UebersichtAnfrage | null => {
      const id = idOderNull(x.id);
      if (id === null) return null;
      return {
        id,
        gemeinde: typeof x.gemeinde === 'string' ? x.gemeinde : '',
        kontakt_name: typeof x.kontakt_name === 'string' ? x.kontakt_name : '',
        status: alsStatus(x.status),
        wunsch_lizenz: (textOderNull(x.wunsch_lizenz) as LizenzSchluessel | null),
        created_at: typeof x.created_at === 'string' ? x.created_at : '',
        ungelesen: zahlOderNull(x.ungelesen),
      };
    })
    .filter((x): x is UebersichtAnfrage => x !== null);

  const testphasen = (Array.isArray(daten.testphase_endet) ? daten.testphase_endet : [])
    .filter(istObjekt)
    .map((x): UebersichtTestphase | null => {
      const id = idOderNull(x.id);
      if (id === null || typeof x.trial_ends_at !== 'string') return null;
      return { id, display_name: typeof x.display_name === 'string' ? x.display_name : '', trial_ends_at: x.trial_ends_at };
    })
    .filter((x): x is UebersichtTestphase => x !== null);

  return {
    kennzahlen: {
      gemeinden: {
        gesamt: zahlOderNull(g.gesamt), testphase: zahlOderNull(g.testphase), lizenz: zahlOderNull(g.lizenz),
        unbegrenzt: zahlOderNull(g.unbegrenzt), gesperrt: zahlOderNull(g.gesperrt),
      },
      konten: { konfi: zahlOderNull(ko.konfi), teamer: zahlOderNull(ko.teamer), admin: zahlOderNull(ko.admin), org_admin: zahlOderNull(ko.org_admin) },
      aktiv_30_tage: zahlOderNull(k.aktiv_30_tage),
      anfragen_offen: zahlOderNull(k.anfragen_offen),
      mails_ungelesen: zahlOderNull(k.mails_ungelesen),
    },
    entwicklung: {
      monate,
      gemeinden_neu: reihe(e.gemeinden_neu, monate.length),
      konten_neu: { konfi: reihe(kn.konfi, monate.length), team: reihe(kn.team, monate.length) },
      konten_gesamt: reihe(e.konten_gesamt, monate.length),
      anfragen_neu: reihe(e.anfragen_neu, monate.length),
    },
    aktivitaet: {
      wochen,
      antraege: reihe(a.antraege, wochen.length),
      buchungen: reihe(a.buchungen, wochen.length),
      nachrichten: reihe(a.nachrichten, wochen.length),
    },
    neueste_anfragen: anfragen,
    neueste_mails: (Array.isArray(daten.neueste_mails) ? daten.neueste_mails : []).map(mailLesen).filter((m): m is MailEingangWeb => m !== null),
    testphase_endet: testphasen,
  };
}

// --- Monate und Wochen -----------------------------------------------------------

const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'] as const;
const MONATE_LANG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'] as const;

const monatNummer = (schluessel: string): number | null => {
  const m = /^(\d{4})-(\d{2})$/.exec(schluessel);
  const n = m ? Number(m[2]) : 0;
  return n >= 1 && n <= 12 ? n : null;
};

/** '2026-10' -> 'Okt'. Ein unbekannter Schluessel bleibt, wie er ist. */
export function monatKurz(schluessel: string): string {
  const n = monatNummer(schluessel);
  return n === null ? schluessel : MONATE_KURZ[n - 1];
}

/** '2026-10' -> 'Oktober 2026'. */
export function monatLang(schluessel: string): string {
  const n = monatNummer(schluessel);
  return n === null ? schluessel : `${MONATE_LANG[n - 1]} ${schluessel.slice(0, 4)}`;
}

/** '2026-10' -> 'Oktober'. */
export function monatName(schluessel: string): string {
  const n = monatNummer(schluessel);
  return n === null ? schluessel : MONATE_LANG[n - 1];
}

/** '2026-W40' -> 'KW 40'. */
export function wocheKurz(schluessel: string): string {
  const m = /^\d{4}-W(\d{1,2})$/.exec(schluessel);
  return m ? `KW ${Number(m[1])}` : schluessel;
}

/** '2026-W40' -> 'Kalenderwoche 40, 2026'. */
export function wocheLang(schluessel: string): string {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(schluessel);
  return m ? `Kalenderwoche ${Number(m[2])}, ${m[1]}` : schluessel;
}

// --- Gemeinden (GET /support/gemeinden) ---------------------------------------------

export interface SupportLeitung {
  id: number;
  display_name: string;
  username: string;
  email: string | null;
  is_active: boolean;
  last_login_at: string | null;
}

export interface SupportGemeinde {
  id: number;
  name: string;
  display_name: string;
  is_active: boolean;
  is_trial: boolean;
  trial_ends_at: string | null;
  max_konfis: number | null;
  konfi_count: number;
  team_count: number;
  created_at: string;
  kirchenkreis_id: number | null;
  kirchenkreis: string | null;
  landeskirche_id: number | null;
  landeskirche: string | null;
  wunsch_lizenz: LizenzSchluessel | null;
  leitung: SupportLeitung[];
}

/** GET /support/gemeinden lesen; kein Array: null. Eintraege ohne Kennung fallen weg. */
export function gemeindenLesen(daten: unknown): SupportGemeinde[] | null {
  if (!Array.isArray(daten)) return null;
  const raus: SupportGemeinde[] = [];
  for (const x of daten) {
    if (!istObjekt(x)) continue;
    const id = idOderNull(x.id);
    if (id === null) continue;
    const name = typeof x.name === 'string' ? x.name : '';
    const leitung = (Array.isArray(x.leitung) ? x.leitung : []).filter(istObjekt).map((l): SupportLeitung | null => {
      const lid = idOderNull(l.id);
      if (lid === null) return null;
      return {
        id: lid,
        display_name: typeof l.display_name === 'string' ? l.display_name : '',
        username: typeof l.username === 'string' ? l.username : '',
        email: textOderNull(l.email),
        is_active: l.is_active !== false,
        last_login_at: textOderNull(l.last_login_at),
      };
    }).filter((l): l is SupportLeitung => l !== null);
    raus.push({
      id,
      name,
      display_name: textOderNull(x.display_name) ?? name,
      is_active: x.is_active !== false,
      is_trial: x.is_trial === true,
      trial_ends_at: textOderNull(x.trial_ends_at),
      max_konfis: typeof x.max_konfis === 'number' && Number.isFinite(x.max_konfis) ? x.max_konfis : null,
      konfi_count: zahlOderNull(x.konfi_count),
      team_count: zahlOderNull(x.team_count),
      created_at: typeof x.created_at === 'string' ? x.created_at : '',
      kirchenkreis_id: idOderNull(x.kirchenkreis_id),
      kirchenkreis: textOderNull(x.kirchenkreis),
      landeskirche_id: idOderNull(x.landeskirche_id),
      landeskirche: textOderNull(x.landeskirche),
      wunsch_lizenz: textOderNull(x.wunsch_lizenz) as LizenzSchluessel | null,
      leitung,
    });
  }
  return raus;
}

// --- Suche -----------------------------------------------------------------------

/**
 * Text fuer den Vergleich: klein, Umlaute als Umschreibung (ä -> ae, ß -> ss),
 * andere Akzente weg. Wer "buesum" tippt, findet "Büsum" -- und umgekehrt.
 */
const falten = (zeichen: string): string =>
  zeichen
    .toLocaleLowerCase('de')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/\p{M}/gu, '');

/** Der Suchbegriff in Vergleichsform; leer = keine Suche. */
export const suchbegriff = (eingabe: string): string => falten(eingabe.trim()).replace(/\s+/g, ' ');

/** Die Treffer eines Suchbegriffs im Text als [von, bis) im Originaltext. */
export function suchTreffer(text: string, eingabe: string): Array<[number, number]> {
  const s = suchbegriff(eingabe);
  if (!s) return [];
  let norm = '';
  const nachOriginal: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const f = falten(text[i]);
    for (let k = 0; k < f.length; k++) nachOriginal.push(i);
    norm += f;
  }
  const treffer: Array<[number, number]> = [];
  let ab = 0;
  for (;;) {
    const pos = norm.indexOf(s, ab);
    if (pos === -1) break;
    treffer.push([nachOriginal[pos], nachOriginal[pos + s.length - 1] + 1]);
    ab = pos + s.length;
  }
  return treffer;
}

/** Ein Text in Stuecke zerlegt: Treffer und Rest, zum Hervorheben. */
export function suchSegmente(text: string, eingabe: string): Array<{ text: string; treffer: boolean }> {
  const treffer = suchTreffer(text, eingabe);
  if (treffer.length === 0) return [{ text, treffer: false }];
  const stuecke: Array<{ text: string; treffer: boolean }> = [];
  let ab = 0;
  for (const [von, bis] of treffer) {
    // Zwei Treffer, die denselben Originalbuchstaben meinen (ß -> ss), nur einmal.
    if (von < ab) continue;
    if (von > ab) stuecke.push({ text: text.slice(ab, von), treffer: false });
    stuecke.push({ text: text.slice(von, bis), treffer: true });
    ab = bis;
  }
  if (ab < text.length) stuecke.push({ text: text.slice(ab), treffer: false });
  return stuecke;
}

/** Die Felder einer Gemeinde, in denen gesucht wird (Gemeinde, Kirchenkreis, Landeskirche, Gemeindeleitung). */
export function gemeindeSuchtexte(g: SupportGemeinde): string[] {
  return [
    g.display_name, g.name, g.kirchenkreis ?? '', g.landeskirche ?? '',
    ...g.leitung.flatMap((l) => [l.display_name, l.username, l.email ?? '']),
  ];
}

/** Passt die Gemeinde zur Suche? Ohne Suche: ja. */
export function gemeindePasst(g: SupportGemeinde, eingabe: string): boolean {
  const s = suchbegriff(eingabe);
  if (!s) return true;
  return gemeindeSuchtexte(g).some((t) => falten(t).includes(s));
}

// --- Gruppen: Landeskirche -> Kirchenkreis -> Gemeinde -----------------------------

export const OHNE_ZUORDNUNG = 'Ohne Zuordnung';
export const OHNE_LANDESKIRCHE_NAME = 'Ohne Landeskirche';
export const OHNE_KIRCHENKREIS_NAME = 'Ohne Kirchenkreis';

export interface KirchenkreisGruppe {
  /** Eindeutig im ganzen Baum -- React-Schluessel und Merker fuer Auf/Zu. */
  schluessel: string;
  /** null: Gemeinden ohne Kirchenkreis in einer Gruppe ohne Landeskirche -- die Tabelle steht direkt unter der Landeskirche. */
  name: string | null;
  gemeinden: SupportGemeinde[];
  konfis: number;
}

export interface LandeskircheGruppe {
  schluessel: string;
  name: string;
  /** Die Gruppe "Ohne Zuordnung" steht zuletzt. */
  ohneZuordnung: boolean;
  kirchenkreise: KirchenkreisGruppe[];
  gemeinden: number;
  konfis: number;
}

const nachName = (a: string, b: string) => a.localeCompare(b, 'de');

/**
 * Die Gemeinden als Baum Landeskirche -> Kirchenkreis, mit Zahlen je Gruppe.
 * Landeskirchen und Kirchenkreise alphabetisch, "Ohne Zuordnung" zuletzt;
 * Gemeinden nach Anzeigenamen. Gemeinden ohne Kirchenkreis und ohne
 * Landeskirche bilden die Gruppe "Ohne Zuordnung" ohne Kirchenkreis-Ebene.
 */
export function gemeindenGruppieren(gemeinden: readonly SupportGemeinde[]): LandeskircheGruppe[] {
  const lks = new Map<string, LandeskircheGruppe>();
  for (const g of gemeinden) {
    const lkOhne = g.landeskirche_id === null && !g.landeskirche;
    const lkSchluessel = lkOhne ? 'lk-ohne' : `lk-${g.landeskirche_id ?? g.landeskirche}`;
    const kkOhne = g.kirchenkreis_id === null && !g.kirchenkreis;
    let lk = lks.get(lkSchluessel);
    if (!lk) {
      lk = {
        schluessel: lkSchluessel,
        // Mit Kirchenkreis, aber ohne Landeskirche: "Ohne Landeskirche"; ganz ohne: "Ohne Zuordnung" (s. unten).
        name: lkOhne ? OHNE_LANDESKIRCHE_NAME : (g.landeskirche ?? OHNE_LANDESKIRCHE_NAME),
        ohneZuordnung: lkOhne,
        kirchenkreise: [],
        gemeinden: 0,
        konfis: 0,
      };
      lks.set(lkSchluessel, lk);
    }
    const kkSchluessel = kkOhne ? `kk-ohne-${lkSchluessel}` : `kk-${g.kirchenkreis_id ?? g.kirchenkreis}`;
    let kk = lk.kirchenkreise.find((k) => k.schluessel === kkSchluessel);
    if (!kk) {
      kk = {
        schluessel: kkSchluessel,
        name: kkOhne ? (lkOhne ? null : OHNE_KIRCHENKREIS_NAME) : (g.kirchenkreis ?? OHNE_KIRCHENKREIS_NAME),
        gemeinden: [],
        konfis: 0,
      };
      lk.kirchenkreise.push(kk);
    }
    kk.gemeinden.push(g);
    kk.konfis += g.konfi_count;
    lk.gemeinden += 1;
    lk.konfis += g.konfi_count;
  }
  const liste = [...lks.values()];
  for (const lk of liste) {
    // Die Gruppe ganz ohne Zuordnung hat keine eigene Kirchenkreis-Ebene mehr noetig, wenn nur sie darin steht.
    if (lk.ohneZuordnung && lk.kirchenkreise.some((k) => k.name !== null)) {
      lk.name = OHNE_LANDESKIRCHE_NAME;
      lk.ohneZuordnung = false;
    } else if (lk.ohneZuordnung) {
      lk.name = OHNE_ZUORDNUNG;
    }
    lk.kirchenkreise.sort((a, b) => (a.name === null ? 1 : 0) - (b.name === null ? 1 : 0)
      || (a.name?.startsWith(OHNE_KIRCHENKREIS_NAME) ? 1 : 0) - (b.name?.startsWith(OHNE_KIRCHENKREIS_NAME) ? 1 : 0)
      || nachName(a.name ?? '', b.name ?? ''));
    for (const kk of lk.kirchenkreise) kk.gemeinden.sort((a, b) => nachName(a.display_name, b.display_name));
  }
  return liste.sort((a, b) => (a.ohneZuordnung ? 1 : 0) - (b.ohneZuordnung ? 1 : 0)
    || (a.name === OHNE_LANDESKIRCHE_NAME ? 1 : 0) - (b.name === OHNE_LANDESKIRCHE_NAME ? 1 : 0)
    || nachName(a.name, b.name));
}

/** Alle Schluessel, die sich auf- und zuklappen lassen (Landeskirchen und benannte Kirchenkreise). */
export function gruppenSchluessel(gruppen: readonly LandeskircheGruppe[]): string[] {
  return gruppen.flatMap((lk) => [lk.schluessel, ...lk.kirchenkreise.filter((k) => k.name !== null).map((k) => k.schluessel)]);
}

// --- Laufzeit, Limit, Leitung ---------------------------------------------------------

export type PillTon = 'neutral' | 'info' | 'erfolg' | 'warnung' | 'fehler';

export interface StatusAngabe {
  text: string;
  ton: PillTon;
  /** Ausfuehrlicher Satz (Tooltip), z. B. mit der Zahl der Resttage. */
  titel?: string;
}

const tageText = (tage: number): string => (tage === 1 ? '1 Tag' : `${tage} Tage`);

/**
 * Laufzeit einer Gemeinde als Marke: Testphase bis TT.MM., Lizenz bis
 * TT.MM.JJJJ oder Unbegrenzt (kein Ende gesetzt) -- abgelaufen in Rot.
 * `jetzt` nur fuer Tests.
 */
export function laufzeitAngabe(g: Pick<SupportGemeinde, 'is_trial' | 'trial_ends_at'>, jetzt: Date = new Date()): StatusAngabe {
  const ende = g.trial_ends_at ? new Date(g.trial_ends_at) : null;
  if (!ende || Number.isNaN(ende.getTime())) {
    return g.is_trial ? { text: 'Testphase', ton: 'warnung' } : { text: 'Unbegrenzt', ton: 'neutral' };
  }
  const tage = tageBis(ende, jetzt);
  if (tage < 0) {
    return { text: g.is_trial ? 'Testphase abgelaufen' : 'Lizenz abgelaufen', ton: 'fehler', titel: `Seit ${datumKurz(ende)} abgelaufen` };
  }
  const rest = tage === 0 ? 'endet heute' : `noch ${tageText(tage)}`;
  return g.is_trial
    ? { text: `Testphase bis ${datumKurz(ende, { ohneJahr: true })}`, ton: tage <= 7 ? 'warnung' : 'info', titel: `Testphase bis ${datumKurz(ende)}, ${rest}` }
    : { text: `Lizenz bis ${datumKurz(ende)}`, ton: 'erfolg', titel: `Lizenz bis ${datumKurz(ende)}, ${rest}` };
}

/** Wie voll ist das Konfi-Limit (0 bis 1+)? null: kein Limit. */
export function limitAnteil(g: Pick<SupportGemeinde, 'konfi_count' | 'max_konfis'>): number | null {
  if (g.max_konfis === null || g.max_konfis <= 0) return null;
  return g.konfi_count / g.max_konfis;
}

/** Ton des Limit-Balkens: ab 90 % Warnung, ab 100 % Fehler. */
export function limitTon(anteil: number): PillTon {
  return anteil >= 1 ? 'fehler' : anteil >= 0.9 ? 'warnung' : 'info';
}

/** Status und Ton einer Anfrage (Marke in Listen). */
export const ANFRAGE_TON: Record<AnfrageStatus, PillTon> = {
  neu: 'warnung',
  in_arbeit: 'info',
  angelegt: 'erfolg',
  abgelehnt: 'neutral',
};

// --- Anfragen: Zaehler, Suche, Filter ---------------------------------------------------

/** "offen" = neu und in Arbeit zusammen (Aufgaben), "ungelesen" = mit ungelesenen Mails, gleich in welchem Status. */
export type AnfragenFilter = AnfrageStatus | 'alle' | 'offen' | 'ungelesen';

/** Alle Filter der Anfragen -- die Werte, die `?filter=` in der Adresse annimmt. */
export const ANFRAGEN_FILTER: readonly AnfragenFilter[] = ['alle', 'offen', 'neu', 'in_arbeit', 'angelegt', 'abgelehnt', 'ungelesen'];

/**
 * Ein Filter aus der Adresse (`?filter=offen`). Unbekanntes und Fehlendes
 * ergibt null -- dann gilt die Voreinstellung der Seite.
 */
export function filterAusAdresse<T extends string>(search: string, erlaubt: readonly T[]): T | null {
  const wert = new URLSearchParams(search).get('filter');
  return wert !== null && (erlaubt as readonly string[]).includes(wert) ? (wert as T) : null;
}

/** Ungelesene Mails einer Anfrage; aeltere Server liefern das Feld nicht (dann 0). */
export const ungelesenVonAnfrage = (a: Pick<GemeindeAnfrage, 'ungelesen'>): number =>
  typeof a.ungelesen === 'number' && a.ungelesen > 0 ? a.ungelesen : 0;

/** Zahl je Filter: je Status, alle und mit ungelesenen Mails. */
export function anfragenZaehlen(anfragen: readonly GemeindeAnfrage[]): Record<AnfragenFilter, number> {
  const z: Record<AnfragenFilter, number> = { neu: 0, in_arbeit: 0, angelegt: 0, abgelehnt: 0, alle: anfragen.length, offen: 0, ungelesen: 0 };
  for (const a of anfragen) {
    if (a.status in z) z[a.status] += 1;
    if (a.status === 'neu' || a.status === 'in_arbeit') z.offen += 1;
    if (ungelesenVonAnfrage(a) > 0) z.ungelesen += 1;
  }
  return z;
}

/** Die Felder einer Anfrage, in denen gesucht wird. */
export const anfrageSuchtexte = (a: GemeindeAnfrage): string[] =>
  [a.gemeinde, a.kontakt_name, a.funktion ?? '', a.email, a.kirchenkreis ?? '', a.landeskirche ?? ''];

/** Filter (Status, alle, ungelesen) und Suche zusammen. */
export function anfragenFiltern(anfragen: readonly GemeindeAnfrage[], filter: AnfragenFilter, eingabe: string): GemeindeAnfrage[] {
  const s = suchbegriff(eingabe);
  return anfragen.filter((a) => {
    if (!passtZumFilter(a, filter)) return false;
    return !s || anfrageSuchtexte(a).some((t) => falten(t).includes(s));
  });
}

const passtZumFilter = (a: GemeindeAnfrage, filter: AnfragenFilter): boolean => {
  switch (filter) {
    case 'alle': return true;
    case 'offen': return a.status === 'neu' || a.status === 'in_arbeit';
    case 'ungelesen': return ungelesenVonAnfrage(a) > 0;
    default: return a.status === filter;
  }
};

const zeitpunkt = (iso: string | null | undefined): number => {
  const t = new Date(iso ?? '').getTime();
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Die Anfragen nach Eingang, die neueste zuerst; bei gleicher Zeit die mit der
 * hoeheren Kennung. Die Tabelle verlaesst sich nicht auf die Reihenfolge des
 * Servers.
 */
export function anfragenSortieren<T extends Pick<GemeindeAnfrage, 'id' | 'created_at'>>(anfragen: readonly T[]): T[] {
  return [...anfragen].sort((a, b) => zeitpunkt(b.created_at) - zeitpunkt(a.created_at) || b.id - a.id);
}

// --- Posteingang: Filter ---------------------------------------------------------------

/** "offen" = nicht zugeordnet; "ungelesen" = alle ungelesenen, auch zugeordnete. */
export type EingangFilter = 'alle' | 'ungelesen' | 'offen' | 'moin' | 'support';

/** Alle Filter des Posteingangs -- die Werte, die `?filter=` in der Adresse annimmt. */
export const EINGANG_FILTER: readonly EingangFilter[] = ['alle', 'ungelesen', 'offen', 'moin', 'support'];

/** Ist die Mail keiner Anfrage und keiner Gemeinde zugeordnet? */
export const istNichtZugeordnet = (m: Pick<MailEingangWeb, 'anfrage_id' | 'organization_id'>): boolean =>
  m.anfrage_id === null && m.organization_id === null;

/** Zahl je Filter ("offen" = nicht zugeordnet). */
export function eingangZaehlen(mails: readonly MailEingangWeb[]): Record<EingangFilter, number> {
  return {
    alle: mails.length,
    ungelesen: mails.filter((m) => !m.gelesen_am).length,
    offen: mails.filter(istNichtZugeordnet).length,
    moin: mails.filter((m) => m.postfach === 'moin').length,
    support: mails.filter((m) => m.postfach === 'support').length,
  };
}

export function eingangFiltern(mails: readonly MailEingangWeb[], filter: EingangFilter): MailEingangWeb[] {
  switch (filter) {
    case 'ungelesen': return mails.filter((m) => !m.gelesen_am);
    case 'offen': return mails.filter(istNichtZugeordnet);
    case 'moin': return mails.filter((m) => m.postfach === 'moin');
    case 'support': return mails.filter((m) => m.postfach === 'support');
    default: return [...mails];
  }
}

/** Die Mails nach Sendezeit, die neueste zuerst; bei gleicher Zeit die mit der hoeheren Kennung. */
export function eingangSortieren<T extends Pick<MailEingangWeb, 'id' | 'gesendet_am'>>(mails: readonly T[]): T[] {
  return [...mails].sort((a, b) => zeitpunkt(b.gesendet_am) - zeitpunkt(a.gesendet_am) || b.id - a.id);
}

/**
 * Wohin gehoert die Mail? Anfrage -> ihre Seite, Gemeinde -> deren
 * Schriftwechsel, sonst nichts. Der Name kommt vom Server (`gemeinde_name`).
 */
export function zuordnungZiel(m: Pick<MailEingangWeb, 'anfrage_id' | 'organization_id' | 'gemeinde_name'>):
  { art: 'anfrage' | 'gemeinde'; pfad: string; text: string } | null {
  if (m.anfrage_id !== null) {
    return { art: 'anfrage', pfad: `/admin/support/anfragen/${m.anfrage_id}`, text: m.gemeinde_name ?? `Anfrage ${m.anfrage_id}` };
  }
  if (m.organization_id !== null) {
    return { art: 'gemeinde', pfad: `/admin/support/post/gemeinde/${m.organization_id}`, text: m.gemeinde_name ?? `Gemeinde ${m.organization_id}` };
  }
  return null;
}
