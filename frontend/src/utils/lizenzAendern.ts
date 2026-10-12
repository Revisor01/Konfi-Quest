// Die Lizenz einer Gemeinde im Vorgang „Lizenz und Abrechnung" ändern
// (docs/planung/support-detailseiten.md, Abschnitt „Lizenz-Vorgang"; Simon,
// 11.10.2026: „Antrag meint bitte um Lizenz").
//
// „Lizenz" ist keine eigene Spalte, sondern ergibt sich aus drei:
//   - Tarif = max_konfis: 5 Testphase, 15/50/75/100 Klein bis Groß, null
//     Unbegrenzt, jeder andere Wert ein eigenes Limit (utils/lizenzen.ts);
//   - Laufzeit = trial_ends_at (null = unbegrenzt);
//   - Testphase-Hinweis = is_trial (ohne Datum immer aus).
// Das Limit setzt der Server durch (backend/utils/konfiLimit.js): bis 5 Konfis
// darüber mit Bestätigung, danach gesperrt.
//
// Gespeichert wird nur über bestehende Routen, das Backend bleibt, wie es ist:
//   1. Tarif geändert: PATCH /organizations/:id/limit { max_konfis }.
//   2. Laufzeit oder Testphase geändert: GET /organizations/:id, dann
//      PUT /organizations/:id mit dem VOLLEN Körper (lizenzPutKoerper) -- PUT
//      schreibt description, contact_*, address, website_url und kirchenkreis
//      immer und verlangt name, slug, display_name; ein Teilkörper leerte
//      Stammdaten (backend/routes/organizations.js).
// Hier stehen nur die Regeln, rein und ohne Aufrufe; den Ablauf trägt
// components/support/useLizenzAendern.ts.

import type { StandTon, VorgangGemeinde } from './supportVorgaenge';
import { LIZENZEN, TARIF_OPTIONEN, istTarif, lizenzFinden, lizenzLimit, type Lizenz } from './lizenzen';
import { TESTPHASE_KONFIS, limitNachUmschalten } from './konfiLimitVorgabe';
import { laufzeitAngabe } from './supportWeb';
import { datumKurz } from './dateUtils';
import { kalendertag, tageBis } from '../components/shared/eventFormatting';
import { LIZENZ_TEXT } from '../seiten/supportDetail';

const TAG_MS = 24 * 60 * 60 * 1000;
/** Ein Jahr sind 365 Tage, wie in der Zeitraum-Auswahl des Gemeinde-Formulars (OrganizationManagementModal, ZEITRAUM_OPTIONEN). */
const JAHR_TAGE = 365;
const TESTPHASE_TAGE = 30;

/** Konfis über dem Limit, die der Server noch mit Bestätigung annimmt (backend/utils/konfiLimit.js, GRACE_BUFFER). */
export const KULANZ_KONFIS = 5;

const TESTPHASE_NAME = TARIF_OPTIONEN.find((o) => o.wert === String(TESTPHASE_KONFIS))?.name ?? 'Testphase';
const UNBEGRENZT = TARIF_OPTIONEN.find((o) => o.wert === '');

// --- Tarif ---------------------------------------------------------------------------

/** Ein Tarif mit Namen und Text, wie Karte, Dialog und Vorschau ihn zeigen. */
export interface TarifAngabe {
  name: string;
  /** „Standard — bis 50 Konfis · 99 € pro Jahr". */
  text: string;
  /** Preis im Jahr; 0 = kostenlos; null = ohne festen Preis (Unbegrenzt, eigenes Limit). */
  euro: number | null;
  konfis: number | null;
  lizenz: Lizenz | null;
  /** Ein Limit, das keinem Tarif entspricht. */
  eigen: boolean;
}

/** Der Tarif zu einem Konfi-Limit (max_konfis; null = unbegrenzt). */
export function tarifAngabe(maxKonfis: number | null): TarifAngabe {
  if (maxKonfis === null) {
    return { name: UNBEGRENZT?.name ?? 'Unbegrenzt', text: UNBEGRENZT?.text ?? 'Unbegrenzt', euro: null, konfis: null, lizenz: null, eigen: false };
  }
  if (maxKonfis === TESTPHASE_KONFIS) {
    return { name: TESTPHASE_NAME, text: LIZENZ_TEXT.tarif.testphase(TESTPHASE_NAME, TESTPHASE_KONFIS), euro: 0, konfis: TESTPHASE_KONFIS, lizenz: null, eigen: false };
  }
  const lizenz = LIZENZEN.find((l) => l.konfis === maxKonfis);
  if (lizenz) {
    return { name: lizenz.name, text: `${lizenz.name} — bis ${maxKonfis} Konfis · ${lizenz.euro}\u00a0€ pro Jahr`, euro: lizenz.euro, konfis: maxKonfis, lizenz, eigen: false };
  }
  return { name: LIZENZ_TEXT.tarif.eigenName, text: LIZENZ_TEXT.tarif.eigen(maxKonfis), euro: null, konfis: maxKonfis, lizenz: null, eigen: true };
}

// --- Bestand und Formular ----------------------------------------------------------------

/** Was der Vorgang über die Lizenz der Gemeinde weiß (GET /support/vorgaenge/:id, `gemeinde`). */
export type LizenzBestand = Pick<VorgangGemeinde, 'id' | 'display_name' | 'max_konfis' | 'is_trial' | 'trial_ends_at' | 'konfi_count' | 'wunsch_lizenz' | 'is_active'>;

export type LaufzeitWahl = 'unveraendert' | 'jahr_ab_heute' | 'jahr_ab_ende' | 'testphase' | 'unbegrenzt' | 'datum';

/** Der Entwurf des Dialogs „Lizenz ändern". */
export interface LizenzFormular {
  /** Konfi-Limit als Text: '5', '15', …, '' = unbegrenzt, beim eigenen Limit die Zahl. */
  tarif: string;
  eigenesLimit: boolean;
  laufzeit: LaufzeitWahl;
  /** JJJJ-MM-TT, nur bei „Eigenes Datum…" maßgeblich. */
  datum: string;
  testphase: boolean;
}

const endeVon = (b: Pick<LizenzBestand, 'trial_ends_at'>): Date | null => {
  if (!b.trial_ends_at) return null;
  const d = new Date(b.trial_ends_at);
  return Number.isNaN(d.getTime()) ? null : d;
};

const plusTage = (d: Date, tage: number): Date => new Date(d.getTime() + tage * TAG_MS);

/** Läuft die Lizenz noch (Ende nach jetzt)? */
const laeuftNoch = (b: Pick<LizenzBestand, 'trial_ends_at'>, jetzt: Date): boolean => {
  const ende = endeVon(b);
  return ende !== null && ende.getTime() > jetzt.getTime();
};

/** Das Datum für das Feld „Enddatum" (JJJJ-MM-TT im Kalender des Geräts). */
const datumFeld = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : kalendertag(d);
};

/** Die Wahlen der Laufzeit; „1 Jahr ab Laufzeitende" nur, solange die Lizenz noch läuft. */
export function laufzeitWahlen(b: LizenzBestand, jetzt: Date = new Date()): Array<{ wert: LaufzeitWahl; label: string }> {
  const l = LIZENZ_TEXT.laufzeit;
  const wahlen: Array<{ wert: LaufzeitWahl; label: string }> = [
    { wert: 'unveraendert', label: l.unveraendert(laufzeitAngabe(b, jetzt).text) },
    { wert: 'jahr_ab_heute', label: l.jahrAbHeute(datumKurz(plusTage(jetzt, JAHR_TAGE))) },
  ];
  const ende = endeVon(b);
  if (ende && laeuftNoch(b, jetzt)) wahlen.push({ wert: 'jahr_ab_ende', label: l.jahrAbEnde(datumKurz(plusTage(ende, JAHR_TAGE))) });
  wahlen.push(
    { wert: 'testphase', label: l.testphase(datumKurz(plusTage(jetzt, TESTPHASE_TAGE))) },
    { wert: 'unbegrenzt', label: l.unbegrenzt },
    { wert: 'datum', label: l.datum },
  );
  return wahlen;
}

/** Der Entwurf aus dem Bestand: nichts geändert. Ohne Datum ist die Testphase aus. */
export function lizenzVorbelegen(b: LizenzBestand): LizenzFormular {
  const tarif = b.max_konfis === null ? '' : String(b.max_konfis);
  return { tarif, eigenesLimit: !istTarif(tarif), laufzeit: 'unveraendert', datum: datumFeld(b.trial_ends_at), testphase: b.is_trial && endeVon(b) !== null };
}

/**
 * Ob „Wunschlizenz übernehmen" angeboten wird: Es gibt einen Wunsch, und er
 * weicht vom Tarif ab (dieselbe Regel wie die Zusatzzeile, lizenzZusatz) --
 * oder die Testphase läuft noch, dann macht der Knopf aus ihr die Lizenz. Gilt
 * der Wunsch schon, setzte der Knopf etwa einer unbegrenzten Lizenz bloß eine
 * Laufzeit von einem Jahr (bis 12.10.2026 stand er dann trotzdem da).
 */
export function wunschAnbieten(b: LizenzBestand): boolean {
  const wunsch = lizenzFinden(b.wunsch_lizenz);
  if (!wunsch) return false;
  return (wunsch.konfis ?? null) !== b.max_konfis || (b.is_trial && endeVon(b) !== null);
}

/**
 * „Wunschlizenz übernehmen": der Tarif des Wunsches bei der Anmeldung (Verbund
 * -> Unbegrenzt, wie lizenzLimit), Testphase aus, ein Jahr Laufzeit -- ab
 * heute oder, solange die Lizenz noch läuft, ab ihrem Ende. Ohne Wunsch: null.
 */
export function lizenzWunschUebernehmen(b: LizenzBestand, jetzt: Date = new Date()): LizenzFormular | null {
  const wunsch = lizenzFinden(b.wunsch_lizenz);
  if (!wunsch) return null;
  const ende = endeVon(b);
  const abEnde = ende !== null && laeuftNoch(b, jetzt);
  return {
    tarif: lizenzLimit(wunsch.schluessel),
    eigenesLimit: false,
    laufzeit: abEnde ? 'jahr_ab_ende' : 'jahr_ab_heute',
    datum: kalendertag(plusTage(abEnde ? (ende as Date) : jetzt, JAHR_TAGE)),
    testphase: false,
  };
}

/** Das Konfi-Limit des Entwurfs; '' ohne eigenes Limit = unbegrenzt. NaN bei ungültiger Eingabe. */
const neuesLimit = (f: LizenzFormular): number | null => {
  const wert = f.tarif.trim();
  if (wert === '' && !f.eigenesLimit) return null;
  return /^\d+$/.test(wert) ? Number(wert) : Number.NaN;
};

/** Das Laufzeitende des Entwurfs als ISO-Zeit (wie das Gemeinde-Formular es schickt); null = unbegrenzt. */
function neuesEnde(b: LizenzBestand, f: LizenzFormular, jetzt: Date): string | null {
  switch (f.laufzeit) {
    case 'unveraendert': return b.trial_ends_at;
    case 'jahr_ab_heute': return plusTage(jetzt, JAHR_TAGE).toISOString();
    case 'jahr_ab_ende': return plusTage(endeVon(b) ?? jetzt, JAHR_TAGE).toISOString();
    case 'testphase': return plusTage(jetzt, TESTPHASE_TAGE).toISOString();
    case 'unbegrenzt': return null;
    case 'datum': {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f.datum.trim());
      return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toISOString() : null;
    }
    default: return b.trial_ends_at;
  }
}

/** Was am Entwurf nicht stimmt, als ein Satz -- oder null. */
export function lizenzFehler(f: LizenzFormular): string | null {
  const limit = neuesLimit(f);
  if (limit !== null && (Number.isNaN(limit) || limit < 1)) return LIZENZ_TEXT.fehler.limit;
  if (!f.eigenesLimit && !istTarif(f.tarif)) return LIZENZ_TEXT.fehler.limit;
  if (f.laufzeit === 'datum' && !/^\d{4}-\d{2}-\d{2}$/.test(f.datum.trim())) return LIZENZ_TEXT.fehler.datum;
  return null;
}

/**
 * Den Schalter „Testphase" umlegen. Ohne Laufzeitende bleibt er aus; das
 * Limit folgt ihm, solange es noch auf der Vorgabe steht
 * (utils/konfiLimitVorgabe.ts, limitNachUmschalten), ein bewusst gewählter
 * Tarif bleibt.
 */
export function lizenzTestphaseSetzen(b: LizenzBestand, f: LizenzFormular, an: boolean, jetzt: Date = new Date()): LizenzFormular {
  const mitEnde = neuesEnde(b, f, jetzt) !== null;
  const testphase = an && mitEnde;
  const tarif = limitNachUmschalten(f.tarif, f.testphase, testphase, lizenzLimit(b.wunsch_lizenz));
  return { ...f, testphase, tarif, eigenesLimit: tarif === f.tarif ? f.eigenesLimit : !istTarif(tarif) };
}

/** Was sich ändert -- je Route ein Teil; leer, wenn nichts geändert ist. */
export interface LizenzAenderung {
  limit?: { max_konfis: number | null };
  laufzeit?: { trial_ends_at: string | null; is_trial: boolean };
}

/** Zwei Laufzeitenden am selben Kalendertag (oder beide unbegrenzt)? */
const gleichesEnde = (a: string | null, b: string | null): boolean => (a === null || b === null ? a === b : datumFeld(a) === datumFeld(b));

/**
 * Die Änderung des Entwurfs gegen den Bestand: `limit` für PATCH …/limit,
 * `laufzeit` für den PUT. Ohne Datum ist die Testphase immer aus. Ein
 * ungültiger Entwurf (lizenzFehler) ergibt keine Änderung am Limit.
 */
export function lizenzAenderung(b: LizenzBestand, f: LizenzFormular, jetzt: Date = new Date()): LizenzAenderung {
  const aenderung: LizenzAenderung = {};
  const limit = neuesLimit(f);
  if (!(limit !== null && Number.isNaN(limit)) && limit !== b.max_konfis) aenderung.limit = { max_konfis: limit };
  const ende = neuesEnde(b, f, jetzt);
  const isTrial = ende !== null && f.testphase;
  const bisherTrial = b.is_trial && endeVon(b) !== null;
  if (!gleichesEnde(ende, b.trial_ends_at) || isTrial !== bisherTrial) aenderung.laufzeit = { trial_ends_at: ende, is_trial: isTrial };
  return aenderung;
}

// --- Stammdaten für den PUT ---------------------------------------------------------------

/** Die Stammfelder einer Gemeinde, die PUT /organizations/:id immer schreibt bzw. verlangt. */
export interface GemeindeStamm {
  name: string;
  slug: string;
  display_name: string;
  description: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  website_url: string | null;
  kirchenkreis: string | null;
  kirchenkreis_id: number | null;
  is_active: boolean;
}

const istObjekt = (wert: unknown): wert is Record<string, unknown> => !!wert && typeof wert === 'object' && !Array.isArray(wert);
/** Unverändert übernehmen: eine Zeichenkette bleibt, wie sie ist; alles andere wird null. */
const textWieGeliefert = (wert: unknown): string | null => (typeof wert === 'string' ? wert : null);
const pflichtText = (wert: unknown): string | null => (typeof wert === 'string' && wert.trim() ? wert : null);

/**
 * GET /organizations/:id lesen (SELECT * der Gemeinde). Ohne name, slug oder
 * Anzeigename ist die Antwort für den PUT unbrauchbar: null -- dann bleibt die
 * Laufzeit im Dialog gesperrt und das Gemeinde-Formular ist der Weg.
 */
export function gemeindeStammLesen(daten: unknown): GemeindeStamm | null {
  if (!istObjekt(daten)) return null;
  const name = pflichtText(daten.name);
  const slug = pflichtText(daten.slug);
  const anzeigename = pflichtText(daten.display_name) ?? name;
  if (!name || !slug || !anzeigename) return null;
  const kreisId = daten.kirchenkreis_id;
  return {
    name,
    slug,
    display_name: anzeigename,
    description: textWieGeliefert(daten.description),
    contact_name: textWieGeliefert(daten.contact_name),
    contact_email: textWieGeliefert(daten.contact_email),
    contact_phone: textWieGeliefert(daten.contact_phone),
    address: textWieGeliefert(daten.address),
    website_url: textWieGeliefert(daten.website_url),
    kirchenkreis: textWieGeliefert(daten.kirchenkreis),
    kirchenkreis_id: typeof kreisId === 'number' && Number.isInteger(kreisId) && kreisId > 0 ? kreisId : null,
    is_active: daten.is_active !== false,
  };
}

/**
 * Der Körper für PUT /organizations/:id: alle Stammfelder unverändert aus der
 * frischen GET-Antwort, dazu Laufzeit und Testphase. `kirchenkreis_id` geht
 * nur mit, wenn sie gesetzt ist -- so bleibt die Zuordnung über den Zweig
 * des Super-Admins sicher (backend/routes/organizations.js). Ohne Datum ist
 * die Testphase aus.
 */
export function lizenzPutKoerper(s: GemeindeStamm, l: NonNullable<LizenzAenderung['laufzeit']>): Record<string, unknown> {
  return {
    name: s.name,
    slug: s.slug,
    display_name: s.display_name,
    description: s.description,
    contact_name: s.contact_name,
    contact_email: s.contact_email,
    contact_phone: s.contact_phone,
    address: s.address,
    website_url: s.website_url,
    kirchenkreis: s.kirchenkreis,
    is_active: s.is_active,
    ...(s.kirchenkreis_id !== null ? { kirchenkreis_id: s.kirchenkreis_id } : {}),
    trial_ends_at: l.trial_ends_at,
    is_trial: l.trial_ends_at === null ? false : l.is_trial,
  };
}

// --- Vorschau und Zusatzzeile -----------------------------------------------------------------

/**
 * Was nach dem Speichern gilt, als ein Satz („Danach: Standard — bis 50 Konfis
 * · 99 € pro Jahr · Lizenz bis 11.10.2027."), dazu die Warnung, wenn schon
 * mehr Konfis angelegt sind, als das neue Limit erlaubt, und `gesperrt`, wenn
 * die Gemeinde gesperrt ist: Das bleibt sie -- der PUT schreibt is_active,
 * wie es ist (nach Ablauf sperrt der nächtliche Lauf sie, backgroundService).
 */
export function lizenzVorschau(b: LizenzBestand, f: LizenzFormular, jetzt: Date = new Date()): { text: string; warnung: string | null; gesperrt: string | null } {
  const roh = neuesLimit(f);
  const limit = roh !== null && Number.isNaN(roh) ? b.max_konfis : roh;
  const ende = neuesEnde(b, f, jetzt);
  const laufzeit = ende === null ? LIZENZ_TEXT.laufzeitUnbegrenzt : laufzeitAngabe({ is_trial: f.testphase, trial_ends_at: ende }, jetzt).text;
  const text = LIZENZ_TEXT.danach(tarifAngabe(limit).text, laufzeit);
  const anzahl = b.konfi_count ?? 0;
  let warnung: string | null = null;
  if (limit !== null && anzahl >= limit) {
    const gesperrtAb = limit + KULANZ_KONFIS;
    warnung = anzahl >= gesperrtAb ? LIZENZ_TEXT.gesperrtLimit(anzahl, limit, gesperrtAb) : LIZENZ_TEXT.ueberLimit(anzahl, limit, gesperrtAb);
  }
  return { text, warnung, gesperrt: b.is_active ? null : LIZENZ_TEXT.bleibtGesperrt };
}

/**
 * Die Zeile `zusatz` im Stand eines Lizenz-Vorgangs: nur Namen, die Zahlen
 * stehen in der Karte. „Lizenz heute: Testphase bis 20.10. · bei der
 * Anmeldung gewünscht: Standard." -- der Wunsch nur, wenn er bekannt ist und
 * vom heutigen Tarif abweicht; „· Zugang gesperrt", wenn die Gemeinde
 * gesperrt ist. Abgelaufen oder gesperrt im Ton Warnung. Ohne Gemeinde der
 * Satz, dass erst eine zugeordnet sein muss.
 */
export function lizenzZusatz(b: LizenzBestand | null, gemeindeAngabe: string | null, jetzt: Date = new Date()): { text: string; ton: StandTon } {
  if (!b) return { text: LIZENZ_TEXT.ohneGemeinde(gemeindeAngabe), ton: 'hinweis' };
  const tarif = tarifAngabe(b.max_konfis);
  let lizenz = b.is_trial && tarif.name !== TESTPHASE_NAME ? `${tarif.name} (${LIZENZ_TEXT.testphaseHinweis})` : tarif.name;
  let ton: StandTon = 'neutral';
  const ende = endeVon(b);
  if (ende) {
    const datum = datumKurz(ende, { ohneJahr: ende.getFullYear() === jetzt.getFullYear() });
    if (tageBis(ende, jetzt) < 0) {
      lizenz += `, ${LIZENZ_TEXT.abgelaufen(datum)}`;
      ton = 'warnung';
    } else {
      lizenz += ` ${LIZENZ_TEXT.bis(datum)}`;
    }
  }
  const teile = [LIZENZ_TEXT.heute(lizenz)];
  const wunsch = lizenzFinden(b.wunsch_lizenz);
  if (wunsch && (wunsch.konfis ?? null) !== b.max_konfis) teile.push(LIZENZ_TEXT.gewuenscht(wunsch.name));
  if (!b.is_active) {
    teile.push(LIZENZ_TEXT.gesperrt);
    ton = 'warnung';
  }
  const text = teile.join(' · ');
  return { text: text.endsWith('.') ? text : `${text}.`, ton };
}
