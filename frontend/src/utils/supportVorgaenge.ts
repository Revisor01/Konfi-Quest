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

import type { GemeindeAnfrage, MailAnhang, MailNachricht, Postfach } from '../types/support';
import { suchbegriff, suchTreffer, type PillTon } from './supportWeb';
import { istEmail } from './supportAnfragen';
import { schluesselIn, wahlVon } from '../seiten/beschreibung';
import { VORGANG_STAENDE, type VorgangStand } from '../seiten/supportVorgaenge';

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
  };
}

// --- Kontakt ------------------------------------------------------------------------

/** Wer den Vorgang gestellt hat -- aus dem Formular oder, bei einer Anfrage, aus deren Angaben. */
export interface VorgangKontakt {
  name: string | null;
  email: string | null;
  funktion: string | null;
}

export function kontaktVon(v: Pick<VorgangDetail, 'kontakt_name' | 'kontakt_email' | 'kontakt_funktion' | 'anfrage'>): VorgangKontakt {
  return {
    name: v.kontakt_name ?? v.anfrage?.kontakt_name ?? null,
    email: v.kontakt_email ?? v.anfrage?.email ?? null,
    funktion: v.kontakt_funktion ?? v.anfrage?.funktion ?? null,
  };
}

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

/** Vorbelegt mit dem Betreff der Mail; die Art muss gewaehlt werden. */
export const einsortierenNeuVorbelegen = (betreff: string | null | undefined, organizationId = ''): EinsortierenNeuFormular => ({
  art: '', bereich: '', dringlichkeit: 'normal', betreff: (betreff ?? '').trim(), organizationId,
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
