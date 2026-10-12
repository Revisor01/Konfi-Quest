// Vorgänge der Support-Ansicht (03.10.2026, docs/planung/support-vorgaenge.md).
//
// Simon: „Müsste da nicht jede Anfrage zwar der Gemeinde zugeordnet werden,
// aber immer in einem Vorgang landen?" -- Ein Vorgang ist ein Anliegen mit
// Nummer, Art, Bereich, Dringlichkeit, Status, Betreff, Gemeinde (sobald
// bekannt) und Verlauf. Er entsteht aus einer Anfrage (Formular der Homepage,
// Art „Neue Gemeinde"), aus dem Support-Formular der Homepage, aus einer Mail,
// durch den Support selbst oder beim Einsortieren einer Mail aus dem Posteingang.
//
// Hier steht, was Liste, Vorgang, Posteingang und Dialoge gemeinsam brauchen --
// rein, ohne Aufrufe, damit es sich einzeln pruefen laesst: die Auswahlwerte
// mit ihren Namen, das defensive Lesen der Antworten (ein Objekt der falschen
// Form ergibt null, fehlende Felder bekommen sichere Werte), Filter, Suche,
// Zaehler und die Koerper der Aufrufe. Die Seiten tragen nur Darstellung.
//
// Vertrag (Backend baut parallel genau danach, alles unter /api/support):
//   GET    /vorgaenge?filter=offen|neu|in_arbeit|wartet|erledigt|archiv&art=&gemeinde=&suche=
//   POST   /vorgaenge            { art, bereich?, dringlichkeit?, betreff, organization_id?, text?, an? }
//   GET    /vorgaenge/:id
//   PATCH  /vorgaenge/:id        { art?, bereich?, dringlichkeit?, status?, betreff?, organization_id?, notiz? }
//   POST   /vorgaenge/:id/antworten · /archivieren · /wiederherstellen,  DELETE /vorgaenge/:id
//   POST   /vorgaenge/sammel     { ids, aktion: archivieren|wiederherstellen|loeschen|status, status? }
//   POST   /mail/nachrichten/:id/einsortieren  { vorgang_id } | { neu: { art, bereich?, dringlichkeit?, betreff?, organization_id? } }
//   POST   /mail/nachrichten/:id/archivieren · /wiederherstellen,  DELETE /mail/nachrichten/:id
//   POST   /mail/sammel          { ids, aktion: archivieren|wiederherstellen|loeschen }

import type { GemeindeAnfrage, MailAnhang, MailEmpfaenger, MailNachricht, Postfach } from '../types/support';
import { laufzeitAngabe, limitTon, suchbegriff, suchTreffer, type PillTon } from './supportWeb';
import { istEmail } from './supportAnfragen';
import { POSTFACH_INFO, betreffKern, empfaengerLesen } from './supportMail';
import { lizenzFinden, lizenzText, type LizenzSchluessel } from './lizenzen';
import { lizenzZusatz, tarifAngabe } from './lizenzAendern';
import { datumKurz, datumUhrzeit, uhrzeit } from './dateUtils';
import { schluesselIn, wahlVon } from '../seiten/beschreibung';
import { VORGANG_STAENDE, type VorgangStand } from '../seiten/supportVorgaenge';
import {
  ANGABEN_TEXT, EINORDNEN_TEXT, LIZENZ_TEXT, MARKEN_TEXT, STAND_TEXT, kennzahlLabel,
} from '../seiten/supportDetail';
import {
  ICON_CHATS,
  ICON_FUNKELN,
  ICON_HILFE,
  ICON_KATEGORIE,
  ICON_ORGANISATION,
  ICON_SCHLUESSEL,
  ICON_SCHUTZ,
  ICON_WARNHINWEIS,
} from '../components/shared/icons';

// --- Auswahlwerte ---------------------------------------------------------------

/** Die acht Arten eines Vorgangs, in dieser Reihenfolge in jeder Auswahl. */
export type VorgangArt = 'neue_gemeinde' | 'frage' | 'fehler' | 'wunsch' | 'zugang' | 'lizenz' | 'datenschutz' | 'sonstiges';

export const ARTEN: ReadonlyArray<{ wert: VorgangArt; label: string; kurz: string }> = [
  { wert: 'neue_gemeinde', label: 'Neue Gemeinde', kurz: 'Neue Gemeinde' },
  { wert: 'frage', label: 'Frage zur Bedienung', kurz: 'Frage' },
  { wert: 'fehler', label: 'Fehler melden', kurz: 'Fehler' },
  { wert: 'wunsch', label: 'Wunsch oder Idee', kurz: 'Wunsch' },
  { wert: 'zugang', label: 'Zugang und Konten', kurz: 'Zugang' },
  { wert: 'lizenz', label: 'Lizenz und Abrechnung', kurz: 'Lizenz' },
  { wert: 'datenschutz', label: 'Datenschutz', kurz: 'Datenschutz' },
  { wert: 'sonstiges', label: 'Sonstiges', kurz: 'Sonstiges' },
];

/** Die zehn Bereiche der App. */
export type VorgangBereich = 'konfis' | 'termine' | 'punkte' | 'challenges' | 'chat' | 'badges' | 'material' | 'konten' | 'einstellungen' | 'sonstiges';

export const BEREICHE: ReadonlyArray<{ wert: VorgangBereich; label: string }> = [
  { wert: 'konfis', label: 'Konfis' },
  { wert: 'termine', label: 'Events' },
  { wert: 'punkte', label: 'Punkte und Anträge' },
  { wert: 'challenges', label: 'Challenges' },
  { wert: 'chat', label: 'Chat' },
  { wert: 'badges', label: 'Badges' },
  { wert: 'material', label: 'Material' },
  { wert: 'konten', label: 'Konten und Einladungen' },
  { wert: 'einstellungen', label: 'Einstellungen' },
  { wert: 'sonstiges', label: 'Sonstiges' },
];

export type Dringlichkeit = 'normal' | 'dringend';

export const DRINGLICHKEITEN: ReadonlyArray<{ wert: Dringlichkeit; label: string; hinweis?: string }> = [
  { wert: 'normal', label: 'Normal' },
  { wert: 'dringend', label: 'Dringend', hinweis: 'wir können gerade nicht weiterarbeiten' },
];

/**
 * Neu, in Arbeit, wartet auf Rückmeldung, erledigt. „Erledigt" legt den
 * Vorgang ins Archiv (Entscheidung 6); eine neue Mail holt ihn zurück.
 */
export type VorgangStatus = 'neu' | 'in_arbeit' | 'wartet' | 'erledigt';

export const VORGANG_STATUS: Record<VorgangStatus, { label: string; kurz: string; ton: PillTon }> = {
  neu: { label: 'Neu', kurz: 'Neu', ton: 'warnung' },
  in_arbeit: { label: 'In Arbeit', kurz: 'In Arbeit', ton: 'info' },
  wartet: { label: 'Wartet auf Rückmeldung', kurz: 'Wartet', ton: 'neutral' },
  erledigt: { label: 'Erledigt', kurz: 'Erledigt', ton: 'erfolg' },
};

/** Reihenfolge der Status in jeder Auswahl. */
export const STATUS_REIHE: readonly VorgangStatus[] = ['neu', 'in_arbeit', 'wartet', 'erledigt'];

/** Der Satz zu „Erledigt" -- steht dort, wo der Status gewaehlt wird. */
export const ERLEDIGT_HINWEIS = 'Erledigte Vorgänge liegen im Archiv. Eine neue Mail holt den Vorgang zurück.';

/** Woher der Vorgang kommt. */
export type VorgangQuelle = 'anfrage' | 'formular' | 'mail' | 'support';

export const QUELLEN: Record<VorgangQuelle, string> = {
  anfrage: 'Anfrage von der Homepage',
  formular: 'Support-Formular auf der Homepage',
  mail: 'Mail',
  support: 'Vom Support angelegt',
};

const ARTEN_WERTE = ARTEN.map((a) => a.wert) as readonly string[];
const BEREICH_WERTE = BEREICHE.map((b) => b.wert) as readonly string[];
const STATUS_WERTE = STATUS_REIHE as readonly string[];
const QUELLEN_WERTE = Object.keys(QUELLEN) as readonly string[];

export const artLabel = (art: VorgangArt): string => ARTEN.find((a) => a.wert === art)?.label ?? art;
export const artKurz = (art: VorgangArt): string => ARTEN.find((a) => a.wert === art)?.kurz ?? art;
export const bereichLabel = (bereich: VorgangBereich | null): string => (bereich ? BEREICHE.find((b) => b.wert === bereich)?.label ?? bereich : '');
export const dringlichkeitLabel = (d: Dringlichkeit): string => DRINGLICHKEITEN.find((x) => x.wert === d)?.label ?? d;

/** Frage, Fehler und Wunsch brauchen einen Bereich -- sonst laesst sich nicht sagen, wo es klemmt. */
export const bereichIstPflicht = (art: VorgangArt | ''): boolean => art === 'frage' || art === 'fehler' || art === 'wunsch';

/** „Vorgang 12" -- so steht die Nummer in der Ueberschrift; im Betreff einer Mail steht „[Vorgang 12]". */
export const vorgangName = (id: number): string => `Vorgang ${id}`;

// --- Antworten des Servers lesen ----------------------------------------------------

const istObjekt = (wert: unknown): wert is Record<string, unknown> => !!wert && typeof wert === 'object' && !Array.isArray(wert);
const textOderNull = (wert: unknown): string | null => (typeof wert === 'string' && wert.trim() ? wert : null);
const kennungOderNull = (wert: unknown): number | null => (typeof wert === 'number' && Number.isInteger(wert) && wert > 0 ? wert : null);
const zahlOderNull = (wert: unknown): number | null => (typeof wert === 'number' && Number.isFinite(wert) ? wert : null);
const zahlOderNull0 = (wert: unknown): number => (typeof wert === 'number' && Number.isFinite(wert) && wert > 0 ? wert : 0);

/** Ein Eintrag der Liste GET /support/vorgaenge. */
export interface Vorgang {
  id: number;
  art: VorgangArt;
  bereich: VorgangBereich | null;
  dringlichkeit: Dringlichkeit;
  status: VorgangStatus;
  betreff: string;
  quelle: VorgangQuelle;
  organization_id: number | null;
  gemeinde_name: string | null;
  anfrage_id: number | null;
  /** Ungelesene eingehende Mails des Vorgangs. */
  ungelesen: number;
  /** Letzte Mail oder Aenderung (ISO). */
  letzte_aktivitaet: string;
  created_at: string;
  /** Gesetzt: der Vorgang liegt im Archiv (auch jeder erledigte). */
  archiviert_am: string | null;
}

/** Ein Vorgang aus der Liste lesen; ohne Kennung: null. Unbekannte Auswahlwerte fallen auf sichere zurueck. */
export function vorgangLesen(roh: unknown): Vorgang | null {
  if (!istObjekt(roh)) return null;
  const id = kennungOderNull(roh.id);
  if (id === null) return null;
  const erstellt = typeof roh.created_at === 'string' ? roh.created_at : '';
  return {
    id,
    art: ARTEN_WERTE.includes(roh.art as string) ? (roh.art as VorgangArt) : 'sonstiges',
    bereich: BEREICH_WERTE.includes(roh.bereich as string) ? (roh.bereich as VorgangBereich) : null,
    dringlichkeit: roh.dringlichkeit === 'dringend' ? 'dringend' : 'normal',
    status: STATUS_WERTE.includes(roh.status as string) ? (roh.status as VorgangStatus) : 'neu',
    betreff: typeof roh.betreff === 'string' ? roh.betreff : '',
    quelle: QUELLEN_WERTE.includes(roh.quelle as string) ? (roh.quelle as VorgangQuelle) : 'support',
    organization_id: kennungOderNull(roh.organization_id),
    gemeinde_name: textOderNull(roh.gemeinde_name),
    anfrage_id: kennungOderNull(roh.anfrage_id),
    ungelesen: zahlOderNull0(roh.ungelesen),
    letzte_aktivitaet: typeof roh.letzte_aktivitaet === 'string' && roh.letzte_aktivitaet ? roh.letzte_aktivitaet : erstellt,
    created_at: erstellt,
    archiviert_am: textOderNull(roh.archiviert_am),
  };
}

/** GET /support/vorgaenge lesen; kein Array: null. Eintraege ohne Kennung fallen weg. */
export function vorgaengeLesen(daten: unknown): Vorgang[] | null {
  if (!Array.isArray(daten)) return null;
  return daten.map(vorgangLesen).filter((v): v is Vorgang => v !== null);
}

/** Die Gemeinde eines Vorgangs (GET /support/vorgaenge/:id, `gemeinde`). */
export interface VorgangGemeinde {
  id: number;
  name: string;
  display_name: string;
  is_active: boolean;
  is_trial: boolean;
  trial_ends_at: string | null;
  max_konfis: number | null;
  konfi_count: number | null;
  kirchenkreis: string | null;
  landeskirche: string | null;
  /**
   * Die Wunschlizenz der jüngsten Anfrage dieser Gemeinde -- der Wunsch bei
   * der Anmeldung, nicht der eines Anliegens (backend/routes/supportVorgaenge.js).
   * Bis 11.10.2026 verwarf der Leser das Feld.
   */
  wunsch_lizenz: LizenzSchluessel | null;
  kirchenkreis_id: number | null;
  /** Interne Gemeinde (Test, Support), zählt in keiner Statistik. */
  intern: boolean;
}

/** Eine Person der Gemeindeleitung (GET /support/vorgaenge/:id, `leitung`). */
export interface VorgangLeitung {
  id: number;
  display_name: string;
  username: string;
  email: string | null;
  is_active: boolean;
  last_login_at: string | null;
}

/** GET /support/vorgaenge/:id: der Vorgang mit allem, was die Seite braucht. */
export interface VorgangDetail extends Vorgang {
  /** Interne Notiz, nur der Support sieht sie. */
  notiz: string | null;
  /** Der Text aus dem Formular. */
  beschreibung: string | null;
  kontakt_name: string | null;
  kontakt_email: string | null;
  kontakt_funktion: string | null;
  /** Die Gemeinde, wie die Person sie im Formular nannte (Freitext). */
  gemeinde_angabe: string | null;
  verlauf: MailNachricht[];
  /** Die Anfrage, wenn der Vorgang aus der Homepage-Anfrage entstand. */
  anfrage: GemeindeAnfrage | null;
  gemeinde: VorgangGemeinde | null;
  leitung: VorgangLeitung[];
  /** Seit wann der Status gilt (ISO); ältere Server liefern es nicht. */
  status_seit: string | null;
  updated_at: string | null;
  /** Wer den Vorgang angelegt hat (Herkunft „vom Support angelegt"). */
  erstellt_von_name: string | null;
  /**
   * Die möglichen Empfänger einer Antwort, wie der Server sie liefert:
   * Absender eingehender Mails, Kontakt aus dem Formular, Adresse der Anfrage,
   * Gemeindeleitung und frühere Mails der Gemeinde. `herkunft` ist der
   * Schlüssel des Servers, die Reihenfolge der Vorrang.
   */
  empfaenger: MailEmpfaenger[];
}

const mailLesenRoh = (roh: unknown): MailNachricht | null => {
  if (!istObjekt(roh)) return null;
  const id = kennungOderNull(roh.id);
  if (id === null) return null;
  return {
    ...(roh as unknown as MailNachricht),
    id,
    postfach: roh.postfach === 'support' ? 'support' : 'moin',
    richtung: roh.richtung === 'aus' ? 'aus' : 'ein',
    von_adresse: typeof roh.von_adresse === 'string' ? roh.von_adresse : '',
    von_name: textOderNull(roh.von_name),
    gesendet_am: typeof roh.gesendet_am === 'string' ? roh.gesendet_am : '',
    gelesen_am: textOderNull(roh.gelesen_am),
    anhaenge: Array.isArray(roh.anhaenge) ? (roh.anhaenge as MailAnhang[]) : null,
  };
};

function gemeindeLesen(roh: unknown): VorgangGemeinde | null {
  if (!istObjekt(roh)) return null;
  const id = kennungOderNull(roh.id);
  if (id === null) return null;
  const name = typeof roh.name === 'string' ? roh.name : '';
  return {
    id,
    name,
    display_name: textOderNull(roh.display_name) ?? name,
    is_active: roh.is_active !== false,
    is_trial: roh.is_trial === true,
    trial_ends_at: textOderNull(roh.trial_ends_at),
    max_konfis: zahlOderNull(roh.max_konfis),
    konfi_count: zahlOderNull(roh.konfi_count),
    kirchenkreis: textOderNull(roh.kirchenkreis),
    landeskirche: textOderNull(roh.landeskirche),
    wunsch_lizenz: lizenzFinden(textOderNull(roh.wunsch_lizenz))?.schluessel ?? null,
    kirchenkreis_id: kennungOderNull(roh.kirchenkreis_id),
    intern: roh.intern === true,
  };
}

function leitungLesen(roh: unknown): VorgangLeitung | null {
  if (!istObjekt(roh)) return null;
  const id = kennungOderNull(roh.id);
  if (id === null) return null;
  return {
    id,
    display_name: typeof roh.display_name === 'string' ? roh.display_name : '',
    username: typeof roh.username === 'string' ? roh.username : '',
    email: textOderNull(roh.email),
    is_active: roh.is_active !== false,
    last_login_at: textOderNull(roh.last_login_at),
  };
}

/** GET /support/vorgaenge/:id lesen; kein Objekt oder ohne Kennung: null. */
export function vorgangDetailLesen(daten: unknown): VorgangDetail | null {
  const basis = vorgangLesen(daten);
  if (!basis || !istObjekt(daten)) return null;
  const anfrage = istObjekt(daten.anfrage) && kennungOderNull(daten.anfrage.id) !== null ? (daten.anfrage as unknown as GemeindeAnfrage) : null;
  return {
    ...basis,
    notiz: textOderNull(daten.notiz),
    beschreibung: textOderNull(daten.beschreibung),
    kontakt_name: textOderNull(daten.kontakt_name),
    kontakt_email: textOderNull(daten.kontakt_email),
    kontakt_funktion: textOderNull(daten.kontakt_funktion),
    gemeinde_angabe: textOderNull(daten.gemeinde_angabe),
    verlauf: (Array.isArray(daten.verlauf) ? daten.verlauf : []).map(mailLesenRoh).filter((m): m is MailNachricht => m !== null),
    anfrage,
    gemeinde: gemeindeLesen(daten.gemeinde),
    leitung: (Array.isArray(daten.leitung) ? daten.leitung : []).map(leitungLesen).filter((l): l is VorgangLeitung => l !== null),
    status_seit: textOderNull(daten.status_seit),
    updated_at: textOderNull(daten.updated_at),
    erstellt_von_name: textOderNull(daten.erstellt_von_name),
    // Dieselbe Prüfung wie bei GET /gemeinden/:id/empfaenger: nur mit „@", jede Adresse einmal.
    empfaenger: Array.isArray(daten.empfaenger) ? empfaengerLesen(daten.empfaenger) : [],
  };
}

// --- Kontakt ------------------------------------------------------------------------

/** Wer den Vorgang gestellt hat -- aus dem Formular oder, bei einer Anfrage, aus deren Angaben. */
export interface VorgangKontakt {
  name: string | null;
  email: string | null;
  funktion: string | null;
}

export function kontaktVon(
  v: Pick<VorgangDetail, 'kontakt_name' | 'kontakt_email' | 'kontakt_funktion' | 'anfrage'> & { verlauf?: readonly MailNachricht[] },
): VorgangKontakt {
  // Ein Vorgang aus einer Mail hat kein Formular: Kontakt ist dann, wer die
  // erste eingehende Mail schrieb (bis 11.10.2026 stand dort viermal „–").
  const erste = (v.verlauf ?? []).find((m) => m.richtung === 'ein' && m.von_adresse);
  const formular = Boolean(v.kontakt_name || v.kontakt_email || v.anfrage);
  return {
    name: v.kontakt_name ?? v.anfrage?.kontakt_name ?? (formular ? null : erste?.von_name ?? null),
    email: v.kontakt_email ?? v.anfrage?.email ?? (formular ? null : erste?.von_adresse ?? null),
    funktion: v.kontakt_funktion ?? v.anfrage?.funktion ?? null,
  };
}

/**
 * Ist der Vorgang einer Gemeinde zugeordnet? Nur `organization_id` sagt das,
 * nie `gemeinde_name`: Der Server liefert dort auch die Gemeinde einer
 * Anfrage und die Angabe im Formular, solange keine zugeordnet ist (COALESCE
 * in backend/routes/supportVorgaenge.js). Bis 11.10.2026 hielten Kopf, Listen
 * und Links den Freitext für eine Gemeinde (Fehler vorab 3).
 */
export const istZugeordnet = (v: Pick<Vorgang, 'organization_id'>): boolean => v.organization_id !== null;

/**
 * Was eine Listenzeile statt der Gemeinde nennt, solange keine zugeordnet ist:
 * bei einer Anfrage „Noch nicht angelegt" -- dasselbe Wort wie der Kopf, und
 * anlegen ist dort die Aufgabe --, sonst „Nicht zugeordnet".
 */
export const ohneGemeindeText = (v: Pick<Vorgang, 'anfrage_id'>): string =>
  (v.anfrage_id !== null && v.anfrage_id !== undefined ? MARKEN_TEXT.nichtAngelegt : MARKEN_TEXT.nichtZugeordnet);

/**
 * Die Gemeinde als Freitext, solange keine zugeordnet ist: aus dem Formular
 * (`gemeinde_angabe`) oder aus der Anfrage. Ohne Zuordnung steht er im Vorgang
 * ganz oben, damit der Support die Gemeinde zuordnen kann.
 */
export function gemeindeAngabeVon(v: Pick<VorgangDetail, 'gemeinde_angabe' | 'anfrage'>): string | null {
  return v.gemeinde_angabe ?? textOderNull(v.anfrage?.gemeinde) ?? null;
}

// --- Filter, Suche, Zaehler -----------------------------------------------------------

/**
 * Die Filter der Liste: „Offen" = neu, in Arbeit und wartet zusammen; Neu,
 * In Arbeit und Wartet je Status; Archiv = alles Archivierte, auch die
 * erledigten.
 */
export type VorgangFilter = VorgangStand;

/** Die Werte, die `?filter=` in der Adresse annimmt (seiten/supportVorgaenge.ts). */
export const VORGANG_FILTER: readonly VorgangFilter[] = schluesselIn(VORGANG_STAENDE, 'web');

/** Gehoert der Filter zur Liste der Archivierten (eigener Abruf)? */
export const istArchivFilter = (filter: VorgangFilter): boolean => filter === 'archiv';

export const istArchiviert = (v: Pick<Vorgang, 'archiviert_am' | 'status'>): boolean => v.archiviert_am !== null || v.status === 'erledigt';

/** Braucht Aufmerksamkeit: Status „Neu" oder ungelesene Mail -- dieselbe Regel wie die rote Zahl der Leiste. */
export const brauchtAufmerksamkeit = (v: Pick<Vorgang, 'status' | 'ungelesen' | 'archiviert_am'>): boolean =>
  v.archiviert_am === null && (v.status === 'neu' || v.ungelesen > 0);

/** Zahl je Filter aus der Liste der offenen Vorgaenge. */
export function vorgaengeZaehlen(offene: readonly Vorgang[]): Record<Exclude<VorgangFilter, 'archiv'>, number> {
  const zahl = (f: Exclude<VorgangFilter, 'archiv'>) => offene.filter((v) => wahlVon(VORGANG_STAENDE, f).passt?.(v) ?? true).length;
  return { offen: zahl('offen'), neu: zahl('neu'), in_arbeit: zahl('in_arbeit'), wartet: zahl('wartet') };
}

export interface VorgangAuswahl {
  filter: VorgangFilter;
  /** 'alle' oder eine Art. */
  art: VorgangArt | 'alle';
  /** 'alle' oder die Kennung der Gemeinde (als Text). */
  gemeinde: string;
  suche: string;
}

/** Die Felder eines Vorgangs, in denen gesucht wird: Nummer, Betreff, Gemeinde, Art, Bereich. */
export const vorgangSuchtexte = (v: Vorgang): string[] => [
  String(v.id), vorgangName(v.id), v.betreff, v.gemeinde_name ?? '', artLabel(v.art), bereichLabel(v.bereich),
];

const zeitpunkt = (iso: string | null | undefined): number => {
  const t = new Date(iso ?? '').getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** Die Vorgaenge nach letzter Aktivitaet, die juengste zuerst; bei gleicher Zeit die hoehere Nummer. */
export function vorgaengeSortieren<T extends Pick<Vorgang, 'id' | 'letzte_aktivitaet' | 'created_at'>>(vorgaenge: readonly T[]): T[] {
  const zeit = (v: T) => zeitpunkt(v.letzte_aktivitaet) || zeitpunkt(v.created_at);
  return [...vorgaenge].sort((a, b) => zeit(b) - zeit(a) || b.id - a.id);
}

/**
 * Status-Filter, Art, Gemeinde und Suche zusammen. `quelle` ist die Liste, die
 * zum Filter gehoert: die offenen Vorgaenge fuer Offen, Neu, In Arbeit und
 * Wartet, die archivierten fuer Archiv.
 */
export function vorgaengeFiltern(quelle: readonly Vorgang[], auswahl: VorgangAuswahl): Vorgang[] {
  const s = suchbegriff(auswahl.suche);
  const stand = wahlVon(VORGANG_STAENDE, auswahl.filter).passt;
  return quelle.filter((v) => {
    if (stand && !stand(v)) return false;
    if (auswahl.art !== 'alle' && v.art !== auswahl.art) return false;
    if (auswahl.gemeinde !== 'alle' && String(v.organization_id ?? '') !== auswahl.gemeinde) return false;
    return !s || vorgangSuchtexte(v).some((t) => suchTreffer(t, auswahl.suche).length > 0);
  });
}

/** Die Gemeinden, die in der Liste vorkommen -- fuer die Auswahl „Gemeinde", nach Namen. */
export function gemeindenAusVorgaengen(vorgaenge: readonly Vorgang[]): Array<{ id: number; name: string }> {
  const karte = new Map<number, string>();
  for (const v of vorgaenge) {
    if (v.organization_id !== null && !karte.has(v.organization_id)) karte.set(v.organization_id, v.gemeinde_name ?? `Gemeinde ${v.organization_id}`);
  }
  return [...karte.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Filter aus der Adresse (`?filter=…&art=…&gemeinde=…`); Unbekanntes und Fehlendes ergibt die Vorgabe. */
export function auswahlAusAdresse(search: string): { filter: VorgangFilter | null; art: VorgangArt | null; gemeinde: string | null } {
  const p = new URLSearchParams(search);
  const filter = p.get('filter');
  const art = p.get('art');
  const gemeinde = p.get('gemeinde');
  return {
    filter: filter !== null && (VORGANG_FILTER as readonly string[]).includes(filter) ? (filter as VorgangFilter) : null,
    art: art !== null && ARTEN_WERTE.includes(art) ? (art as VorgangArt) : null,
    gemeinde: gemeinde !== null && /^\d+$/.test(gemeinde) ? gemeinde : null,
  };
}

// --- Neuer Vorgang ------------------------------------------------------------------

/** Das Formular „Neuer Vorgang" (Dialog der Web-Fassung, Abschnitt der App). */
export interface NeuerVorgangFormular {
  art: VorgangArt | '';
  bereich: VorgangBereich | '';
  dringlichkeit: Dringlichkeit;
  betreff: string;
  /** Kennung der Gemeinde als Text; leer = keine. */
  organizationId: string;
  /** Erste Mail (optional): der Text. */
  text: string;
  /** Empfaenger der ersten Mail (Adresse). */
  an: string;
}

export const LEERER_VORGANG: NeuerVorgangFormular = {
  art: '', bereich: '', dringlichkeit: 'normal', betreff: '', organizationId: '', text: '', an: '',
};

/** Was am Formular fehlt, als ein Satz -- oder null, wenn es abgeschickt werden kann. */
export function neuerVorgangFehler(f: NeuerVorgangFormular): string | null {
  if (!f.art) return 'Bitte eine Art wählen';
  if (bereichIstPflicht(f.art) && !f.bereich) return 'Bitte einen Bereich wählen';
  if (!f.betreff.trim()) return 'Bitte einen Betreff eingeben';
  if (f.text.trim()) {
    if (!f.an.trim()) return f.organizationId ? 'Bitte wählen, an wen die Mail geht' : 'Bitte die E-Mail-Adresse eingeben, an die die Mail geht';
    if (!istEmail(f.an)) return 'Ungültige E-Mail-Adresse';
  }
  return null;
}

export interface NeuerVorgangDaten {
  art: VorgangArt;
  bereich?: VorgangBereich;
  dringlichkeit: Dringlichkeit;
  betreff: string;
  organization_id?: number;
  text?: string;
  an?: string;
}

/** Koerper fuer POST /support/vorgaenge: nur, was ausgefuellt ist; `an` nur mit Text. */
export function neuerVorgangKoerper(f: NeuerVorgangFormular): NeuerVorgangDaten {
  const koerper: NeuerVorgangDaten = {
    art: f.art as VorgangArt,
    dringlichkeit: f.dringlichkeit,
    betreff: f.betreff.trim(),
  };
  if (f.bereich) koerper.bereich = f.bereich;
  if (f.organizationId) koerper.organization_id = Number(f.organizationId);
  if (f.text.trim()) {
    koerper.text = f.text.replace(/\s+$/, '');
    if (f.an.trim()) koerper.an = f.an.trim();
  }
  return koerper;
}

// --- Einsortieren, Sammelaktionen ----------------------------------------------------

/** Ein neuer Vorgang aus einer Mail des Posteingangs (Art, Bereich, Gemeinde). */
export interface EinsortierenNeuFormular {
  art: VorgangArt | '';
  bereich: VorgangBereich | '';
  dringlichkeit: Dringlichkeit;
  betreff: string;
  organizationId: string;
}

/**
 * Vorbelegt mit dem Kern des Betreffs der Mail (ohne Kennung und Re:/AW:);
 * die Art muss gewaehlt werden. Beim Herauslösen aus einem Vorgang stand bis
 * 11.10.2026 roh „AW: [Vorgang 2] Re: …" als Betreff des neuen.
 */
export const einsortierenNeuVorbelegen = (betreff: string | null | undefined, organizationId = ''): EinsortierenNeuFormular => ({
  art: '', bereich: '', dringlichkeit: 'normal', betreff: betreffKern(betreff), organizationId,
});

export function einsortierenNeuFehler(f: EinsortierenNeuFormular): string | null {
  if (!f.art) return 'Bitte eine Art wählen';
  if (bereichIstPflicht(f.art) && !f.bereich) return 'Bitte einen Bereich wählen';
  if (!f.betreff.trim()) return 'Bitte einen Betreff eingeben';
  return null;
}

export type EinsortierenKoerper =
  | { vorgang_id: number }
  | { neu: { art: VorgangArt; bereich?: VorgangBereich; dringlichkeit: Dringlichkeit; betreff: string; organization_id?: number } };

export const einsortierenBestehendKoerper = (vorgangId: number): EinsortierenKoerper => ({ vorgang_id: vorgangId });

export function einsortierenNeuKoerper(f: EinsortierenNeuFormular): EinsortierenKoerper {
  const neu: { art: VorgangArt; bereich?: VorgangBereich; dringlichkeit: Dringlichkeit; betreff: string; organization_id?: number } = {
    art: f.art as VorgangArt,
    dringlichkeit: f.dringlichkeit,
    betreff: f.betreff.trim(),
  };
  if (f.bereich) neu.bereich = f.bereich;
  if (f.organizationId) neu.organization_id = Number(f.organizationId);
  return { neu };
}

/** Sammelaktionen der Vorgangsliste. */
export type VorgangSammelAktion = 'archivieren' | 'wiederherstellen' | 'loeschen' | 'status';
/** Sammelaktionen des Posteingangs. */
export type MailSammelAktion = 'archivieren' | 'wiederherstellen' | 'loeschen';

export interface VorgangSammelDaten { ids: number[]; aktion: VorgangSammelAktion; status?: VorgangStatus }

export function vorgangSammelKoerper(ids: readonly number[], aktion: VorgangSammelAktion, status?: VorgangStatus): VorgangSammelDaten {
  const koerper: VorgangSammelDaten = { ids: [...ids], aktion };
  if (aktion === 'status' && status) koerper.status = status;
  return koerper;
}

export interface MailSammelDaten { ids: number[]; aktion: MailSammelAktion }

export const mailSammelKoerper = (ids: readonly number[], aktion: MailSammelAktion): MailSammelDaten => ({ ids: [...ids], aktion });

/** „3 Vorgänge" / „1 Vorgang" */
export const vorgaengeText = (n: number): string => `${n} ${n === 1 ? 'Vorgang' : 'Vorgänge'}`;
export const mailsText = (n: number): string => `${n} ${n === 1 ? 'Mail' : 'Mails'}`;

// --- Antwort-Postfach und Empfaenger -------------------------------------------------

/** Von welchem Postfach und an wen ein Vorgang beantwortet wird. */
export type AntwortWeg =
  | { art: 'anfrage'; postfach: Postfach; an: string }
  | { art: 'gemeinde'; postfach: Postfach; organizationId: number; kontakt: string | null }
  | { art: 'adresse'; postfach: Postfach; an: string }
  | { art: 'keiner' };

/**
 * Der Weg einer Antwort: eine Anfrage antwortet moin@ an die Adresse der
 * Anfrage (wie bisher); sonst mit Gemeinde support@ an eine Adresse aus deren
 * Gemeindeleitung (der Kontakt des Formulars steht mit zur Wahl); ohne
 * Gemeinde an den Kontakt des Formulars bzw. den Absender der letzten
 * eingehenden Mail. Ohne all das gibt es niemanden, dem sich antworten liesse.
 */
export function antwortWegVon(v: Pick<VorgangDetail, 'anfrage' | 'organization_id' | 'kontakt_email' | 'verlauf'>): AntwortWeg {
  if (v.anfrage?.email) return { art: 'anfrage', postfach: 'moin', an: v.anfrage.email };
  if (v.organization_id !== null) return { art: 'gemeinde', postfach: 'support', organizationId: v.organization_id, kontakt: v.kontakt_email };
  if (v.kontakt_email) return { art: 'adresse', postfach: 'support', an: v.kontakt_email };
  const letzte = [...v.verlauf].reverse().find((m) => m.richtung === 'ein');
  if (letzte?.von_adresse) return { art: 'adresse', postfach: letzte.postfach, an: letzte.von_adresse };
  return { art: 'keiner' };
}

// =====================================================================================
// Detailseiten: Symbol, Zeit, Stand, Kennzahlen, Angaben, Einordnen
// (docs/planung/support-detailseiten.md, „Die gemeinsame Regel-Stelle").
// App und Browser zeigen nur an, was hier entschieden wird; die Sätze stehen in
// seiten/supportDetail.ts.
// =====================================================================================

/** Das Symbol je Art -- im Kreis vor dem Titel und in der Listenzeile. */
export const ART_SYMBOL: Readonly<Record<VorgangArt, string>> = {
  neue_gemeinde: ICON_ORGANISATION,
  frage: ICON_HILFE,
  fehler: ICON_WARNHINWEIS,
  wunsch: ICON_FUNKELN,
  zugang: ICON_SCHLUESSEL,
  lizenz: ICON_KATEGORIE,
  datenschutz: ICON_SCHUTZ,
  sonstiges: ICON_CHATS,
};

/**
 * Farbe des Kreises je Art: der Modifier von .app-icon-circle in der App
 * (theme/variables.css) und das Token --app-color-… im Browser
 * (web/WebVorgangTeile, VorgangKreis). Eine Stelle für beide: Bis 12.10.2026
 * stand die Zuordnung zweimal, als Tabelle der App und als Modifier in
 * theme/web/support.css.
 */
export type ArtFarbe = 'success' | 'info' | 'danger' | 'purple' | 'warning' | 'categories' | 'users' | 'neutral';

export const ART_FARBE: Readonly<Record<VorgangArt, ArtFarbe>> = {
  neue_gemeinde: 'success',
  frage: 'info',
  fehler: 'danger',
  wunsch: 'purple',
  zugang: 'warning',
  lizenz: 'categories',
  datenschutz: 'users',
  sonstiges: 'neutral',
};

/**
 * Eine Zeit im Stand-Satz: „heute, 12:23", „gestern, 14:05", im selben Jahr
 * „10.10., 14:05", sonst das Datum „10.10.2025". Zeitzone des Geräts, Formate
 * aus utils/dateUtils.ts. Ungültig: ''.
 */
export function standZeit(iso: string, jetzt: Date = new Date()): string {
  const dann = new Date(iso);
  if (Number.isNaN(dann.getTime())) return '';
  if (dann.toDateString() === jetzt.toDateString()) return `heute, ${uhrzeit(dann)}`;
  const gestern = new Date(jetzt);
  gestern.setDate(gestern.getDate() - 1);
  if (dann.toDateString() === gestern.toDateString()) return `gestern, ${uhrzeit(dann)}`;
  if (dann.getFullYear() === jetzt.getFullYear()) return datumUhrzeit(dann, { ohneJahr: true });
  return datumKurz(dann);
}

/**
 * Ganze Kalendertage von `von` bis `bis` (Zeitzone des Geräts), über Mittag
 * gerechnet wie tageBis (components/shared/eventFormatting.ts), damit eine
 * Zeitumstellung keinen Tag verschluckt. Nie negativ; Ungültiges zählt 0.
 */
function kalendertageZwischen(von: string | Date, bis: Date): number {
  const start = new Date(von);
  if (Number.isNaN(start.getTime()) || Number.isNaN(bis.getTime())) return 0;
  const mittag = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
  return Math.max(0, Math.round((mittag(bis) - mittag(start)) / (1000 * 60 * 60 * 24)));
}

/** Wie viele Tage der Vorgang offen ist bzw. war: vom Eingang bis heute oder bis zum Archivieren. */
export function tageOffen(v: Pick<Vorgang, 'created_at' | 'archiviert_am'>, jetzt: Date = new Date()): number {
  const ende = v.archiviert_am ? new Date(v.archiviert_am) : jetzt;
  return kalendertageZwischen(v.created_at, Number.isNaN(ende.getTime()) ? jetzt : ende);
}

// --- Stand -----------------------------------------------------------------------------

export type StandTon = 'erfolg' | 'hinweis' | 'warnung' | 'neutral';
export type StandAktion = 'antworten' | 'erledigt' | 'gemeinde_anlegen' | 'gemeinde_oeffnen'
  | 'wiederherstellen' | 'gemeinde_zuordnen' | 'ablehnen' | 'lizenz_aendern';
export type StandFall = '1a' | '1b' | '1c' | '2' | '3' | '4' | '5' | '6';

export interface StandMarke {
  schluessel: 'status' | 'dringend' | 'art' | 'bereich_fehlt' | 'keine_gemeinde' | 'nicht_angelegt';
  text: string;
  ton: PillTon;
  /** Antippen bzw. Klicken öffnet „Einordnen". */
  oeffnetEinordnen: boolean;
}

/** Das Ergebnis von vorgangStand. Der Name, weil `VorgangStand` die Stände der Liste sind (seiten/supportVorgaenge.ts). */
export interface StandAngabe {
  fall: StandFall;
  ton: StandTon;
  satz: string;
  /** Die Lizenz-Zeile (nur Art „Lizenz und Abrechnung"). */
  zusatz: { text: string; ton: StandTon } | null;
  marken: StandMarke[];
  haupt: StandAktion;
  neben: StandAktion[];
  /** Fall 2: Es gibt niemanden, dem sich antworten ließe. */
  antwortGesperrt: boolean;
}

/** Eine Nachricht, die für den Stand zählt. */
interface StandNachricht {
  zeit: string;
  vonAussen: boolean;
  /** Wer schrieb: Name oder Adresse; beim Support „Support". */
  wer: string;
  /** Das Support-Konto einer ausgehenden Mail. */
  konto: string | null;
}

/**
 * Was für den Stand zählt: der Anfang (Formular oder Anfrage) und die Mails --
 * ohne die automatische Bestätigung (ausgehend ohne `verfasst_von`). Eine
 * Antwort eines inzwischen gelöschten Kontos sieht genauso aus (verfasst_von
 * wird beim Löschen genullt, backend/utils/kontoLoeschen.js) und zählt
 * deshalb auch nicht -- selten, und der Satz nennt dann nur Tatsachen.
 * Älteste zuerst; bei gleicher Zeit der Anfang vor den Mails.
 */
function standNachrichten(v: VorgangDetail): StandNachricht[] {
  const liste: StandNachricht[] = [];
  const kontakt = kontaktVon(v);
  if (v.quelle === 'formular' || v.quelle === 'anfrage' || v.anfrage !== null) {
    liste.push({ zeit: v.anfrage?.created_at || v.created_at, vonAussen: true, wer: kontakt.name ?? kontakt.email ?? STAND_TEXT.jemand, konto: null });
  }
  for (const m of v.verlauf) {
    if (m.richtung === 'ein') {
      liste.push({ zeit: m.gesendet_am, vonAussen: true, wer: m.von_name?.trim() || m.von_adresse || STAND_TEXT.jemand, konto: null });
    } else if (m.verfasst_von !== null && m.verfasst_von !== undefined) {
      liste.push({ zeit: m.gesendet_am, vonAussen: false, wer: 'Support', konto: m.verfasst_von_name?.trim() || null });
    }
  }
  return liste
    .map((n, i) => ({ n, i }))
    .sort((a, b) => zeitpunkt(a.n.zeit) - zeitpunkt(b.n.zeit) || a.i - b.i)
    .map(({ n }) => n);
}

/**
 * Auf wen ein wartender Vorgang wartet: die Person, an die der Support zuletzt
 * schrieb (Name aus den Empfängern oder dem Verlauf), sonst der Kontakt, sonst
 * die Gemeinde.
 */
function gegenueber(v: VorgangDetail): string {
  const kontakt = kontaktVon(v);
  const letzteAus = [...v.verlauf].reverse().find((m) => m.richtung === 'aus' && (m.an_adressen?.length ?? 0) > 0);
  const roh = letzteAus?.an_adressen?.[0]?.trim();
  if (roh) {
    const adresse = roh.toLowerCase();
    const gleich = (a: string | null | undefined) => (a ?? '').trim().toLowerCase() === adresse;
    return v.empfaenger.find((e) => gleich(e.adresse) && e.name)?.name
      ?? v.verlauf.find((m) => m.richtung === 'ein' && gleich(m.von_adresse) && m.von_name?.trim())?.von_name?.trim()
      ?? (gleich(kontakt.email) ? kontakt.name : null)
      ?? v.leitung.find((l) => gleich(l.email) && l.display_name)?.display_name
      ?? roh;
  }
  return kontakt.name ?? kontakt.email ?? v.gemeinde?.display_name ?? STAND_TEXT.rueckmeldung;
}

function standMarken(v: VorgangDetail, anlegbar: boolean): StandMarke[] {
  const status = VORGANG_STATUS[v.status];
  const marken: StandMarke[] = [{ schluessel: 'status', text: status.kurz, ton: status.ton, oeffnetEinordnen: true }];
  if (v.dringlichkeit === 'dringend') marken.push({ schluessel: 'dringend', text: MARKEN_TEXT.dringend, ton: 'fehler', oeffnetEinordnen: true });
  // Bei einer Anfrage sagt der Kreis die Art; dort steht stattdessen, ob sie angelegt ist.
  if (v.anfrage === null) {
    marken.push({ schluessel: 'art', text: v.bereich ? `${artKurz(v.art)} › ${bereichLabel(v.bereich)}` : artKurz(v.art), ton: 'neutral', oeffnetEinordnen: true });
  }
  if (bereichIstPflicht(v.art) && !v.bereich) {
    marken.push({ schluessel: 'bereich_fehlt', text: MARKEN_TEXT.bereichFehlt, ton: 'warnung', oeffnetEinordnen: true });
  }
  if (v.anfrage !== null) {
    if (anlegbar) marken.push({ schluessel: 'nicht_angelegt', text: MARKEN_TEXT.nichtAngelegt, ton: 'warnung', oeffnetEinordnen: false });
  } else if (!istZugeordnet(v)) {
    marken.push({ schluessel: 'keine_gemeinde', text: MARKEN_TEXT.keineGemeinde, ton: 'neutral', oeffnetEinordnen: true });
  }
  return marken;
}

/**
 * Der Stand eines Vorgangs: wer dran ist und seit wann, und welcher Knopf
 * dazu der Hauptknopf ist (docs/planung/support-detailseiten.md, „Die
 * Stand-Regel"). Die Fälle in dieser Reihenfolge:
 *   1a Anfrage angelegt · 1b Anfrage abgelehnt (Archiv) · 1c sonst erledigt
 *   oder archiviert · 2 kein Antwortweg · 3 die jüngste Nachricht kam von
 *   außen · 4 Anfrage anlegbar, der Support schrieb zuletzt · 5 Status
 *   „Wartet" (ab 7 Tagen nachfassen) · 6 sonst.
 * „Von außen" ist der Anfang (Formular bzw. Anfrage) oder eine eingehende
 * Mail; eine ausgehende Mail ohne `verfasst_von` (die automatische
 * Bestätigung) zählt nicht. Bei der Art „Lizenz und Abrechnung" kommen die
 * Zeile `zusatz` und „Lizenz ändern" als Nebenknopf dazu (Fälle 3, 5, 6; ohne
 * Gemeinde steht dort „Gemeinde zuordnen").
 *
 * @param o.anlegbar  Die Anfrage ist noch nicht angelegt (useGemeindeAnlegen).
 * @param o.angelegtUsername  Benutzername direkt nach dem Anlegen; sonst der der ersten Gemeindeleitung.
 */
export function vorgangStand(v: VorgangDetail, o: { anlegbar: boolean; jetzt?: Date; angelegtUsername?: string | null }): StandAngabe {
  const jetzt = o.jetzt ?? new Date();
  const anfrage = v.anfrage;
  const zugeordnet = istZugeordnet(v);
  const lizenz = v.art === 'lizenz';
  const zusatz = lizenz ? lizenzZusatz(zugeordnet ? v.gemeinde : null, gemeindeAngabeVon(v), jetzt) : null;
  const lizenzKnopf: StandAktion = zugeordnet ? 'lizenz_aendern' : 'gemeinde_zuordnen';
  const marken = standMarken(v, o.anlegbar);
  const ergebnis = (fall: StandFall, ton: StandTon, satz: string, haupt: StandAktion, neben: StandAktion[], antwortGesperrt = false): StandAngabe => ({
    fall, ton, satz, zusatz, marken, haupt, neben, antwortGesperrt,
  });

  // 1: abgeschlossen. Direkt nach dem Anlegen steht der Benutzername schon da, auch vor dem Neuladen.
  // Meldet der Server die Anfrage schon als angelegt, entscheidet allein das Archiv: Der
  // Benutzername aus dem Anlegen bleibt stehen, solange die Seite steht -- auch nachdem der
  // Vorgang in derselben Sitzung wiederhergestellt ist oder eine neue Mail ihn zurückholt.
  const angelegt = anfrage !== null && (anfrage.status === 'angelegt' ? istArchiviert(v) : !!o.angelegtUsername);
  if (angelegt) {
    const benutzer = o.angelegtUsername || v.leitung[0]?.username || null;
    // Vor dem Neuladen ist der Vorgang noch offen: angelegt wurde eben, also heute.
    const datum = datumKurz(istArchiviert(v) ? v.status_seit ?? v.archiviert_am ?? jetzt : jetzt);
    return ergebnis('1a', 'erfolg', STAND_TEXT.angelegt(datum, benutzer), 'gemeinde_oeffnen', []);
  }
  if (istArchiviert(v)) {
    const seit = v.status_seit ?? v.archiviert_am ?? v.created_at;
    if (anfrage?.status === 'abgelehnt') {
      return ergebnis('1b', 'hinweis', STAND_TEXT.abgelehnt(datumKurz(seit)), 'wiederherstellen', o.anlegbar ? ['gemeinde_anlegen'] : []);
    }
    const satz = v.status === 'erledigt' ? STAND_TEXT.erledigt(datumKurz(seit)) : STAND_TEXT.archiv(datumKurz(v.archiviert_am ?? seit));
    return ergebnis('1c', 'hinweis', satz, 'wiederherstellen', []);
  }

  // 2: niemand, dem sich antworten ließe.
  if (antwortWegVon(v).art === 'keiner') {
    return ergebnis('2', 'warnung', STAND_TEXT.keinWeg(gemeindeAngabeVon(v)), 'gemeinde_zuordnen', [], true);
  }

  const nachrichten = standNachrichten(v);
  const juengste = nachrichten.length > 0 ? nachrichten[nachrichten.length - 1] : null;
  const anfrageOffen = anfrage !== null && o.anlegbar;

  // 3: Die jüngste Nachricht kam von außen -- wir sind dran.
  if (juengste?.vonAussen) {
    const neben: StandAktion[] = anfrageOffen ? ['gemeinde_anlegen', 'ablehnen'] : lizenz ? [lizenzKnopf, 'erledigt'] : ['erledigt'];
    return ergebnis('3', 'warnung', STAND_TEXT.wartetAufUns(juengste.wer, standZeit(juengste.zeit, jetzt)), 'antworten', neben);
  }

  // 4: Anfrage anlegbar, der Support schrieb zuletzt.
  if (anfrageOffen) {
    return ergebnis('4', 'hinweis', STAND_TEXT.anlegenOderAblehnen(standZeit(juengste?.zeit ?? v.created_at, jetzt)), 'gemeinde_anlegen', ['ablehnen', 'antworten']);
  }

  // 5: Wartet auf Rückmeldung; ab 7 Tagen ist Nachfassen der Hauptknopf. Gewartet wird ab dem
  // Status oder ab der jüngsten Mail des Supports, je nachdem, was später kam: Der Server setzt
  // status_seit nur bei einem Wechsel, und wer nachfasst, lässt „Wartet" meist stehen.
  if (v.status === 'wartet') {
    const statusSeit = v.status_seit ?? v.updated_at ?? v.letzte_aktivitaet;
    const letzteVomSupport = [...nachrichten].reverse().find((n) => !n.vonAussen)?.zeit ?? null;
    const seit = letzteVomSupport !== null && zeitpunkt(letzteVomSupport) > zeitpunkt(statusSeit) ? letzteVomSupport : statusSeit;
    const nachfassen = kalendertageZwischen(seit, jetzt) >= 7;
    const nebenBasis: StandAktion = nachfassen ? 'erledigt' : 'antworten';
    return ergebnis('5', 'neutral', STAND_TEXT.wartetAuf(standZeit(seit, jetzt), gegenueber(v), nachfassen),
      nachfassen ? 'antworten' : 'erledigt', lizenz ? [nebenBasis, lizenzKnopf] : [nebenBasis]);
  }

  // 6: Der Support schrieb zuletzt (oder es gibt noch keine Nachricht).
  const satz = juengste
    ? STAND_TEXT.geantwortet(juengste.konto, standZeit(juengste.zeit, jetzt))
    : STAND_TEXT.ohneNachricht(standZeit(v.created_at, jetzt), v.erstellt_von_name);
  return ergebnis('6', 'neutral', satz, 'erledigt', lizenz ? ['antworten', lizenzKnopf] : ['antworten']);
}

// --- Kennzahlen ---------------------------------------------------------------------------

export interface Kennzahl {
  schluessel: 'mails' | 'neu' | 'tage_offen' | 'konfis' | 'teamer' | 'anhaenge';
  label: string;
  /** Die Zahl als Text; ohne Angabe „–". */
  wert: string;
  zahl: number | null;
}

/** Eine Kennzahl mit ihrer Beschriftung aus seiten/supportDetail.ts. */
export const kennzahl = (schluessel: Kennzahl['schluessel'], zahl: number | null): Kennzahl => ({
  schluessel, label: kennzahlLabel(schluessel, zahl), wert: zahl === null ? '–' : String(zahl), zahl,
});

/**
 * Die drei Zahlen über einem Vorgang (App-Kacheln, WebKachel): bei einer
 * Anfrage Konfis · Teamer:innen · Mails, sonst -- auch bei der Lizenz --
 * Mails · Neu · Tage offen. `neu`: die Mails, die beim Öffnen ungelesen waren.
 */
export function vorgangKennzahlen(v: VorgangDetail, neu: number, jetzt: Date = new Date()): [Kennzahl, Kennzahl, Kennzahl] {
  // „Mails" zählt wie der Verlauf („6 Nachrichten") den Anfang mit -- das
  // Anliegen aus dem Formular bzw. die Nachricht der Anfrage (freigegebene
  // Skizze, Simon 11.10.2026: „6 MAILS" und „Verlauf 6").
  const mails = v.verlauf.length + (anfangText(v) ? 1 : 0);
  if (v.anfrage) {
    return [kennzahl('konfis', v.anfrage.anzahl_konfis ?? null), kennzahl('teamer', v.anfrage.anzahl_teamer ?? null), kennzahl('mails', mails)];
  }
  return [kennzahl('mails', mails), kennzahl('neu', neu), kennzahl('tage_offen', tageOffen(v, jetzt))];
}

/**
 * Der Text des Anfangs im Verlauf: das Anliegen aus dem Formular, sonst die
 * Nachricht der Anfrage. Leer bzw. null: Der Verlauf hat keinen Anfang (ein
 * reiner Mail-Vorgang).
 */
export function anfangText(v: Pick<VorgangDetail, 'beschreibung' | 'anfrage'>): string | null {
  return v.beschreibung ?? v.anfrage?.nachricht ?? null;
}

// --- Angaben ------------------------------------------------------------------------------

export type AngabeAktion = 'im_vorgang_antworten' | 'zuordnen' | 'lizenz_aendern' | 'kirchenkreis_anlegen';

export interface AngabeZeile {
  schluessel: string;
  label: string;
  wert: string;
  ton?: PillTon;
  /** Ausführlicher Satz (Tooltip). */
  titel?: string;
  /** mailto:, tel:, /admin/… */
  href?: string;
  aktion?: { art: AngabeAktion; label: string; adresse?: string };
}

export interface LeitungAngabe {
  id: number;
  name: string;
  benutzername: string;
  gesperrt: boolean;
  email: string | null;
  /** „zuletzt angemeldet 02.10.2026" bzw. „noch nicht angemeldet". */
  anmeldung: string;
}

export interface AngabenKarte {
  schluessel: 'lizenz' | 'anfrage' | 'kontakt' | 'gemeinde';
  titel: string;
  zeilen: AngabeZeile[];
  /** Gemeinde öffnen, Alle Vorgänge -- nur mit organization_id. */
  links: Array<{ label: string; href: string }>;
  leitung?: LeitungAngabe[];
  aktion?: { art: AngabeAktion; label: string; gesperrt: boolean };
}

function konfiZeile(g: VorgangGemeinde): AngabeZeile {
  const anzahl = g.konfi_count ?? 0;
  if (g.max_konfis === null || g.max_konfis <= 0) return { schluessel: 'konfis', label: ANGABEN_TEXT.konfis, wert: ANGABEN_TEXT.konfisOhneLimit(anzahl) };
  return { schluessel: 'konfis', label: ANGABEN_TEXT.konfis, wert: ANGABEN_TEXT.konfisVon(anzahl, g.max_konfis), ton: limitTon(anzahl / g.max_konfis) };
}

function laufzeitZeile(g: VorgangGemeinde, jetzt: Date): AngabeZeile {
  const l = laufzeitAngabe(g, jetzt);
  return { schluessel: 'laufzeit', label: ANGABEN_TEXT.laufzeit, wert: l.text, ton: l.ton, ...(l.titel ? { titel: l.titel } : {}) };
}

function lizenzKarte(v: VorgangDetail, zugeordnet: boolean, zuordnen: AngabeZeile, jetzt: Date): AngabenKarte {
  const karte = (zeilen: AngabeZeile[], gesperrt: boolean): AngabenKarte => ({
    schluessel: 'lizenz', titel: ANGABEN_TEXT.karte.lizenz, zeilen, links: [], aktion: { art: 'lizenz_aendern', label: LIZENZ_TEXT.kartenAktion, gesperrt },
  });
  if (!zugeordnet) return karte([zuordnen], true);
  const g = v.gemeinde;
  if (!g) return karte([{ schluessel: 'gemeinde_fehlt', label: ANGABEN_TEXT.gemeinde, wert: ANGABEN_TEXT.gemeindeFehlt }], true);
  const tarif = tarifAngabe(g.max_konfis);
  const zeilen: AngabeZeile[] = [
    { schluessel: 'tarif', label: ANGABEN_TEXT.tarif, wert: tarif.text },
    konfiZeile(g),
    laufzeitZeile(g, jetzt),
  ];
  const wunsch = lizenzFinden(g.wunsch_lizenz);
  if (wunsch) {
    const gleich = (wunsch.konfis ?? null) === g.max_konfis;
    zeilen.push({ schluessel: 'wunsch', label: ANGABEN_TEXT.wunschAnmeldung, wert: `${ANGABEN_TEXT.wunschMitPreis(lizenzText(wunsch), wunsch.euro)}${gleich ? ` · ${ANGABEN_TEXT.entsprichtTarif}` : ''}` });
  }
  if (!g.is_active) zeilen.push({ schluessel: 'zugang', label: ANGABEN_TEXT.zugang, wert: ANGABEN_TEXT.gesperrt, ton: 'fehler' });
  return karte(zeilen, false);
}

function anfrageKarte(a: GemeindeAnfrage, inStruktur: boolean | null): AngabenKarte {
  const zeilen: AngabeZeile[] = [{ schluessel: 'gemeinde', label: ANGABEN_TEXT.gemeinde, wert: ANGABEN_TEXT.angefragt(a.gemeinde) }];
  const kreis = [a.kirchenkreis, a.landeskirche].filter((x): x is string => typeof x === 'string' && x.trim() !== '').join(' › ');
  if (kreis) {
    const struktur = a.kirchenkreis && inStruktur !== null ? ` · ${inStruktur ? ANGABEN_TEXT.kreisInStruktur : ANGABEN_TEXT.kreisFehlt}` : '';
    zeilen.push({
      schluessel: 'kreis', label: ANGABEN_TEXT.kreis, wert: `${kreis}${struktur}`,
      ...(a.kirchenkreis && inStruktur === false && a.status !== 'angelegt' ? { aktion: { art: 'kirchenkreis_anlegen' as const, label: ANGABEN_TEXT.kirchenkreisAnlegen } } : {}),
    });
  }
  const wunsch = lizenzFinden(a.wunsch_lizenz);
  zeilen.push({ schluessel: 'wunsch', label: ANGABEN_TEXT.wunsch, wert: wunsch ? ANGABEN_TEXT.wunschMitPreis(lizenzText(wunsch), wunsch.euro) : ANGABEN_TEXT.wunschOffen });
  zeilen.push({ schluessel: 'eingang', label: ANGABEN_TEXT.eingang, wert: ANGABEN_TEXT.eingangHerkunft.anfrage });
  return { schluessel: 'anfrage', titel: ANGABEN_TEXT.karte.anfrage, zeilen, links: [] };
}

function eingangText(v: VorgangDetail): string {
  if (v.quelle === 'formular') return ANGABEN_TEXT.eingangHerkunft.formular;
  if (v.quelle === 'support') return ANGABEN_TEXT.eingangHerkunft.support;
  if (v.quelle === 'anfrage') return ANGABEN_TEXT.eingangHerkunft.anfrage;
  const erste = v.verlauf.find((m) => m.richtung === 'ein');
  return ANGABEN_TEXT.eingangHerkunft.mail(erste ? POSTFACH_INFO[erste.postfach].kurz : null);
}

function kontaktKarte(v: VorgangDetail, zuordnen: AngabeZeile | null): AngabenKarte {
  const kontakt = kontaktVon(v);
  const zeilen: AngabeZeile[] = [];
  if (kontakt.name) zeilen.push({ schluessel: 'person', label: ANGABEN_TEXT.person, wert: kontakt.funktion ? `${kontakt.name} (${kontakt.funktion})` : kontakt.name });
  if (kontakt.email) {
    zeilen.push({
      schluessel: 'email', label: ANGABEN_TEXT.email, wert: kontakt.email, href: `mailto:${kontakt.email}`,
      aktion: { art: 'im_vorgang_antworten', label: ANGABEN_TEXT.imVorgangAntworten, adresse: kontakt.email },
    });
  }
  const mobil = v.anfrage?.mobil?.trim();
  if (mobil) zeilen.push({ schluessel: 'mobil', label: ANGABEN_TEXT.mobil, wert: mobil, href: `tel:${mobil.replace(/[^\d+]/g, '')}` });
  if (zuordnen) zeilen.push(zuordnen);
  // Bei einer Anfrage steht der Eingang in der Karte „Anfrage" -- jede Angabe einmal.
  if (!v.anfrage) zeilen.push({ schluessel: 'eingang', label: ANGABEN_TEXT.eingang, wert: eingangText(v) });
  if (v.quelle === 'support' && v.erstellt_von_name) zeilen.push({ schluessel: 'angelegt_von', label: ANGABEN_TEXT.angelegtVon, wert: v.erstellt_von_name });
  return { schluessel: 'kontakt', titel: ANGABEN_TEXT.karte.kontakt, zeilen, links: [] };
}

function gemeindeKarte(v: VorgangDetail, lizenz: boolean, jetzt: Date): AngabenKarte {
  const id = v.organization_id as number;
  const g = v.gemeinde;
  const zeilen: AngabeZeile[] = [];
  // Im Lizenz-Vorgang stehen Laufzeit und Konfis in der Karte „Lizenz".
  if (g && !lizenz) zeilen.push(laufzeitZeile(g, jetzt), konfiZeile(g));
  const kreis = g ? [g.kirchenkreis, g.landeskirche].filter((x): x is string => !!x).join(' › ') : '';
  if (kreis) zeilen.push({ schluessel: 'kreis', label: ANGABEN_TEXT.kreis, wert: kreis });
  const leitung: LeitungAngabe[] = v.leitung.map((l) => ({
    id: l.id,
    name: l.display_name || l.username,
    benutzername: l.username,
    gesperrt: !l.is_active,
    email: l.email,
    anmeldung: l.last_login_at ? ANGABEN_TEXT.zuletztAngemeldet(datumKurz(l.last_login_at)) : ANGABEN_TEXT.nochNichtAngemeldet,
  }));
  return {
    schluessel: 'gemeinde',
    titel: g?.display_name ?? v.gemeinde_name ?? `${ANGABEN_TEXT.gemeinde} ${id}`,
    zeilen,
    links: [
      { label: ANGABEN_TEXT.gemeindeOeffnen, href: `/admin/organizations?gemeinde=${id}` },
      { label: ANGABEN_TEXT.alleVorgaenge, href: `/admin/support/vorgaenge?gemeinde=${id}` },
    ],
    leitung,
  };
}

/**
 * Die Angaben eines Vorgangs als Karten, in dieser Reihenfolge: Lizenz (nur
 * Art „Lizenz und Abrechnung"), Anfrage, Kontakt, Gemeinde (nur mit
 * organization_id). Keine Angabe steht doppelt: Der Eingang einer Anfrage
 * steht in „Anfrage", Laufzeit und Konfis im Lizenz-Vorgang in „Lizenz", die
 * Zeile „Nicht zugeordnet – laut Formular: X" in „Lizenz" bzw. „Kontakt" (bei
 * einer Anfrage nie: Dort heißt die Aufgabe anlegen).
 *
 * @param o.kirchenkreisInStruktur  Steht der Kirchenkreis der Anfrage in der Struktur? null: unbekannt.
 */
export function vorgangAngaben(v: VorgangDetail, o: { jetzt?: Date; kirchenkreisInStruktur?: boolean | null } = {}): AngabenKarte[] {
  const jetzt = o.jetzt ?? new Date();
  const zugeordnet = istZugeordnet(v);
  const lizenz = v.art === 'lizenz';
  const zuordnen: AngabeZeile = {
    schluessel: 'zuordnung', label: ANGABEN_TEXT.gemeinde, wert: ANGABEN_TEXT.nichtZugeordnet(gemeindeAngabeVon(v)), aktion: { art: 'zuordnen', label: ANGABEN_TEXT.zuordnen },
  };
  const karten: AngabenKarte[] = [];
  if (lizenz) karten.push(lizenzKarte(v, zugeordnet, zuordnen, jetzt));
  if (v.anfrage) karten.push(anfrageKarte(v.anfrage, o.kirchenkreisInStruktur ?? null));
  karten.push(kontaktKarte(v, zugeordnet || lizenz || v.anfrage ? null : zuordnen));
  if (zugeordnet) karten.push(gemeindeKarte(v, lizenz, jetzt));
  return karten;
}

// --- Einordnen ------------------------------------------------------------------------------

/** Höchstlänge eines Betreffs (backend/routes/supportVorgaenge.js, BETREFF_MAX). */
export const BETREFF_MAX = 300;

/** Was sich im Einordnen ändern lässt; ein PATCH mit genau den geänderten Feldern. */
export interface Einordnung {
  art?: VorgangArt;
  bereich?: VorgangBereich | null;
  dringlichkeit?: Dringlichkeit;
  status?: VorgangStatus;
  organization_id?: number | null;
  betreff?: string;
}

/** Der Entwurf des Dialogs „Einordnen": Gemeinde als Text ('' = keine), Bereich '' = keiner. */
export interface EinordnenEntwurf {
  status: VorgangStatus;
  art: VorgangArt;
  bereich: VorgangBereich | '';
  dringlichkeit: Dringlichkeit;
  gemeinde: string;
  betreff: string;
}

/** Der Betreff wie der Server ihn speichert: einzeilig, Leerraum zusammengezogen. */
const einzeilig = (text: string): string => text.replace(/\s+/g, ' ').trim();

export function einordnenVorbelegen(v: VorgangDetail): EinordnenEntwurf {
  return {
    status: v.status,
    art: v.art,
    bereich: v.bereich ?? '',
    dringlichkeit: v.dringlichkeit,
    gemeinde: v.organization_id === null ? '' : String(v.organization_id),
    betreff: v.betreff,
  };
}

/** Was am Entwurf fehlt, als ein Satz -- oder null: Pflicht-Bereich, leerer oder zu langer Betreff. */
export function einordnenFehler(e: EinordnenEntwurf): string | null {
  if (bereichIstPflicht(e.art) && !e.bereich) return EINORDNEN_TEXT.bereichFehlt;
  const betreff = einzeilig(e.betreff);
  if (!betreff) return EINORDNEN_TEXT.betreffFehlt;
  if (betreff.length > BETREFF_MAX) return EINORDNEN_TEXT.betreffLang(BETREFF_MAX);
  return null;
}

/** Nur die geänderten Felder -- leer, wenn sich nichts geändert hat. */
export function einordnenAenderung(v: VorgangDetail, e: EinordnenEntwurf): Einordnung {
  const teil: Einordnung = {};
  if (e.status !== v.status) teil.status = e.status;
  if (e.art !== v.art) teil.art = e.art;
  const bereich = e.bereich === '' ? null : e.bereich;
  if (bereich !== v.bereich) teil.bereich = bereich;
  if (e.dringlichkeit !== v.dringlichkeit) teil.dringlichkeit = e.dringlichkeit;
  const gemeinde = /^\d+$/.test(e.gemeinde) && Number(e.gemeinde) > 0 ? Number(e.gemeinde) : null;
  if (gemeinde !== v.organization_id) teil.organization_id = gemeinde;
  const betreff = einzeilig(e.betreff);
  if (betreff && betreff !== einzeilig(v.betreff)) teil.betreff = betreff;
  return teil;
}

/**
 * Der Hinweis beim Status „Erledigt": Bei einer Anfrage, die noch nicht
 * angelegt ist, lehnt Erledigt sie ab (backend/utils/supportVorgaenge.js,
 * statusSetzen); sonst der Satz zum Archiv. Ohne „Erledigt": null.
 */
export function einordnenHinweis(v: VorgangDetail, e: EinordnenEntwurf): string | null {
  if (e.status !== 'erledigt') return null;
  return v.anfrage !== null && v.anfrage.status !== 'angelegt' ? EINORDNEN_TEXT.erledigtAnfrage : ERLEDIGT_HINWEIS;
}

// --- Danach, nächster Eintrag, ?mail= ----------------------------------------------------------

/** Der Status nach dem Senden einer Antwort, wenn nichts anderes gewählt ist (Frage 3). */
export const DANACH_VORGABE: VorgangStatus = 'wartet';

/**
 * Die Wahlen für „Danach". Bei einer Anfrage, die noch nicht angelegt ist,
 * ohne „Erledigt" -- das lehnte sie ab; Ablehnen ist ein eigener Knopf mit
 * Rückfrage.
 *
 * Erledigt oder im Archiv (Stand 1b und 1c): keine Wahl, die Antwort lässt
 * den Status. Jeder gesetzte Status holte den Vorgang aus dem Archiv und eine
 * abgelehnte Anfrage still zurück in Arbeit -- samt ihrer Löschfrist
 * (backend/utils/supportVorgaenge.js, statusSetzen und anfrageFolgtVorgang).
 * Zurück holt ihn nur „Wiederherstellen".
 */
export function danachWahlen(v: Pick<VorgangDetail, 'anfrage' | 'status' | 'archiviert_am'>): readonly VorgangStatus[] {
  if (istArchiviert(v)) return [];
  return v.anfrage !== null && v.anfrage.status !== 'angelegt' ? ['wartet', 'in_arbeit'] : ['wartet', 'in_arbeit', 'erledigt'];
}

/**
 * Der Eintrag, der nach einem Abschluss geöffnet wird: der danach, sonst der
 * davor, sonst keiner. `ohne`: Einträge, die mit abgeschlossen sind (eine
 * Sammelaktion) -- sie werden übersprungen.
 */
export function naechsterEintrag(ids: readonly number[], id: number, ohne: readonly number[] = []): number | null {
  const i = ids.indexOf(id);
  if (i === -1) return null;
  const frei = (x: number) => x !== id && !ohne.includes(x);
  return ids.slice(i + 1).find(frei) ?? [...ids.slice(0, i)].reverse().find(frei) ?? null;
}

/** `?mail=5` aus der Adresse -- die Mail, die im Vorgang offen und hervorgehoben steht. */
export function mailAusAdresse(search: string): number | null {
  const wert = new URLSearchParams(search).get('mail');
  return wert !== null && /^\d+$/.test(wert) && Number(wert) > 0 ? Number(wert) : null;
}
