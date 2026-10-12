// Mails als Verlauf lesen (Simon, 11.10.2026: „Ordentliche eingeklappte
// Ansichten … Wie in einem guten Mail Client."). Reine Regeln ohne
// Darstellung -- App und Web zeigen sie mit demselben Baustein
// (components/support/MailGespraeche.tsx).
//
// Worauf eine Mail antwortet, sagen ihre Kopfzeilen: In-Reply-To und
// References zeigen auf die Message-ID einer früheren Mail (vorgaengerVon).
// Seit 11.10.2026 steht der Verlauf überall flach (verlaufReihe, unten); der
// Baum mit Einrückung und Gesprächstiteln (gespraecheBilden, anfangsOffen,
// mailAbsender, MAX_TIEFE) ist entfallen.

import type { MailNachricht } from '../types/support';
import { auszug, betreffKern, zitateTrennen, type TextTeil } from './supportMail';
import { datumKurz, datumUhrzeit, uhrzeit } from './dateUtils';
import { VERLAUF_TEXT } from '../seiten/supportDetail';

// Der Kern eines Betreffs steht in utils/supportMail.ts -- eine Stelle für
// Gespräche und Antworten (supportMail importiert nichts von hier, so
// entsteht kein Kreis).
export { betreffKern };

const zeit = (m: Pick<MailNachricht, 'gesendet_am'>) => {
  const t = Date.parse(m.gesendet_am);
  return Number.isNaN(t) ? 0 : t;
};

const frueher = (a: MailNachricht, b: MailNachricht) => zeit(a) - zeit(b) || a.id - b.id;

/**
 * Worauf jede Mail antwortet: erst In-Reply-To, dann die References von
 * hinten (der nächste Vorgänger zuerst). Ein Vorgänger zählt nur, wenn er in
 * der Liste steht und früher kam -- so entsteht aus fehlerhaften Kopfzeilen
 * nie ein Kreis. Mails ohne Vorgänger fehlen in der Karte.
 */
export function vorgaengerVon(mails: readonly MailNachricht[]): Map<number, MailNachricht> {
  const sortiert = [...mails].sort(frueher);
  const rang = new Map(sortiert.map((m, i) => [m.id, i]));
  const nachKennung = new Map<string, MailNachricht>();
  for (const m of sortiert) {
    if (m.message_id && !nachKennung.has(m.message_id)) nachKennung.set(m.message_id, m);
  }
  const vorgaenger = new Map<number, MailNachricht>();
  for (const m of sortiert) {
    const kandidaten = [m.in_reply_to, ...[...(m.referenzen ?? [])].reverse()];
    for (const k of kandidaten) {
      const v = k ? nachKennung.get(k) : undefined;
      if (v && v.id !== m.id && (rang.get(v.id) ?? 0) < (rang.get(m.id) ?? 0)) {
        vorgaenger.set(m.id, v);
        break;
      }
    }
  }
  return vorgaenger;
}

/** Signaturtrenner nach RFC 3676 („-- "), auch ohne das Leerzeichen. */
const SIGNATUR_TRENNER = /^--\s?$/;

export interface MailTextZerlegt {
  /** Eigener Text und Zitate, ohne Signatur. */
  teile: TextTeil[];
  /** Alles ab dem Signaturtrenner bis zum nächsten Zitat; null ohne Trenner. */
  signatur: string | null;
}

/**
 * Text einer Mail in eigenen Text, Zitate und Signatur zerlegen. Die
 * Signatur ist der Teil nach dem ersten Trenner „-- " im eigenen Text --
 * bei den Mails des Supports die Fußzeile, die in jeder Mail gleich ist.
 */
export function mailTextZerlegen(text: string | null | undefined): MailTextZerlegt {
  const teile: TextTeil[] = [];
  let signatur: string | null = null;
  for (const teil of zitateTrennen(text)) {
    if (teil.zitat || signatur !== null) {
      teile.push(teil);
      continue;
    }
    const zeilen = teil.text.split('\n');
    const ab = zeilen.findIndex((z) => SIGNATUR_TRENNER.test(z));
    if (ab === -1) {
      teile.push(teil);
      continue;
    }
    const davor = zeilen.slice(0, ab).join('\n').trimEnd();
    const danach = zeilen.slice(ab + 1).join('\n').trim();
    if (davor) teile.push({ zitat: false, text: davor });
    signatur = danach;
  }
  return { teile, signatur };
}

/** Eine Zeile Vorschau: der eigene Text ohne Zitate und ohne Signatur. */
export function mailVorschau(text: string | null | undefined, laenge = 160): string {
  const { teile } = mailTextZerlegen(text);
  const eigen = teile.filter((t) => !t.zitat).map((t) => t.text).join(' ');
  return auszug(eigen || teile.map((t) => t.text).join(' '), laenge);
}

/** Bis zu zwei Anfangsbuchstaben für den Kreis vor einer Mail. */
export function initialen(name: string | null | undefined, adresse?: string | null): string {
  const quelle = (name ?? '').trim() || (adresse ?? '').split('@')[0] || '';
  const woerter = quelle.split(/[\s._-]+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const buchstaben = woerter.slice(0, 2).map((w) => [...w.replace(/[^\p{L}\p{N}]/gu, '')][0] ?? '').join('');
  return (buchstaben || '?').toUpperCase();
}

/**
 * Zeit einer Mail wie in einem Mailprogramm: heute nur die Uhrzeit, gestern
 * „gestern, 14:05", im selben Jahr „10.10., 14:05", sonst das ganze Datum.
 * Die Formate kommen aus utils/dateUtils.ts, die Zeitzone ist die des Geräts.
 */
export function mailZeit(iso: string, jetzt: Date = new Date()): string {
  const dann = new Date(iso);
  if (Number.isNaN(dann.getTime())) return '';
  if (dann.toDateString() === jetzt.toDateString()) return uhrzeit(dann);
  const gestern = new Date(jetzt);
  gestern.setDate(gestern.getDate() - 1);
  if (dann.toDateString() === gestern.toDateString()) return `gestern, ${uhrzeit(dann)}`;
  if (dann.getFullYear() === jetzt.getFullYear()) return datumUhrzeit(dann, { ohneJahr: true });
  return datumKurz(dann);
}

// =====================================================================================
// Der flache Verlauf (docs/planung/support-detailseiten.md; Simon, 11.10.2026,
// Frage 2: „ja"): überall flach, das Älteste oben, keine Treppe. Offen sind
// die jüngste Nachricht und jede neue; Gelesenes ist eine Zeile; ab drei
// eingeklappten Mails in Folge ein Stapel „N frühere Mails". Antwortet eine
// Mail nicht auf die direkt davor, steht „Antwort auf {Name}, {Zeit}" dabei.
// =====================================================================================

/** Der Anfang eines Vorgangs: das Formular bzw. die Anfrage, vor der ersten Mail. */
export interface VerlaufAnfang {
  marke: 'Formular' | 'Anfrage';
  name: string | null;
  adresse: string | null;
  datum: string;
  text: string;
}

export type VerlaufEintrag =
  /** kurz: zwei Zeilen und „ganz lesen" -- sobald der Support geantwortet hat. */
  | { art: 'anfang'; schluessel: 'anfang'; anfang: VerlaufAnfang; offen: boolean; kurz: boolean }
  | {
    art: 'mail'; schluessel: string; mail: MailNachricht; offen: boolean; neu: boolean; ausgehend: boolean;
    absender: string; konto: string | null; kreis: string;
    /** Antwortet die Mail nicht auf die direkt davor: auf wen und wann. */
    antwortAuf: { name: string; zeit: string } | null;
    /** Der Kern ihres Betreffs, wenn er vom Titel abweicht; sonst null. */
    betreffAbweichend: string | null;
  }
  | { art: 'stapel'; schluessel: string; ids: number[]; anzahl: number; absender: string[]; anhaenge: number };

export interface VerlaufOptionen {
  /** Zusätzlich aufgeklappte Mails. */
  offen?: ReadonlySet<number>;
  /** Aufgelöste Stapel (ihr Schlüssel); die Mails stehen dann einzeln eingeklappt da. */
  stapelOffen?: ReadonlySet<string>;
  /** Der Kern des Titels (Vorgangsbetreff bzw. Betreff der Mail); null: kein Vergleich. */
  titelKern?: string | null;
  /** „Alle aufklappen": alles offen, kein Stapel, der Anfang ganz. */
  alleOffen?: boolean;
  jetzt?: Date;
}

/** Ab so vielen eingeklappten Mails in Folge steht statt ihrer ein Stapel. */
export const STAPEL_AB = 3;

/**
 * Wer eine Mail schrieb, für ihre Zeile: eingehend Name (sonst Adresse) und
 * Initialen; ausgehend einheitlich „Support" mit dem Kreis „KQ" und dem Konto
 * klein daneben -- ohne Konto (automatische Bestätigung) nur „Support".
 */
export function absenderZeile(m: MailNachricht): { name: string; konto: string | null; kreis: string; ausgehend: boolean } {
  if (m.richtung === 'aus') {
    return { name: VERLAUF_TEXT.support, konto: m.verfasst_von_name?.trim() || null, kreis: VERLAUF_TEXT.supportKreis, ausgehend: true };
  }
  return { name: m.von_name?.trim() || m.von_adresse, konto: null, kreis: initialen(m.von_name, m.von_adresse), ausgehend: false };
}

/** Eine Mail, die noch niemand gelesen hat (eingehend, ohne Lesedatum). */
const ungelesen = (m: MailNachricht): boolean => m.richtung === 'ein' && !m.gelesen_am;

/**
 * Der Verlauf als flache Reihe, das Älteste zuerst: der Anfang (offen,
 * solange keine Antwort des Supports folgt -- die automatische Bestätigung
 * ohne Konto zählt nicht --, danach kurz), dann die Mails. Offen sind die
 * jüngste, jede neue und die in `o.offen`. Ab STAPEL_AB eingeklappten Mails
 * in Folge steht ein Stapel; Ungelesenes und Neues wird nie gestapelt.
 */
export function verlaufReihe(
  mails: readonly MailNachricht[],
  anfang: VerlaufAnfang | null,
  neu: ReadonlySet<number>,
  o: VerlaufOptionen = {},
): VerlaufEintrag[] {
  const jetzt = o.jetzt ?? new Date();
  const alle = !!o.alleOffen;
  const sortiert = [...mails].sort(frueher);
  const vorgaenger = vorgaengerVon(sortiert);
  const juengste = sortiert[sortiert.length - 1];
  const titel = o.titelKern ? betreffKern(o.titelKern).toLowerCase() : null;
  const reihe: VerlaufEintrag[] = [];

  if (anfang) {
    const geantwortet = sortiert.some((m) => m.richtung === 'aus' && m.verfasst_von !== null && m.verfasst_von !== undefined);
    const offen = alle || !geantwortet;
    reihe.push({ art: 'anfang', schluessel: 'anfang', anfang, offen, kurz: !offen });
  }

  const mailEintraege = sortiert.map((m, i): Extract<VerlaufEintrag, { art: 'mail' }> => {
    const zeile = absenderZeile(m);
    const v = vorgaenger.get(m.id);
    const davor = i > 0 ? sortiert[i - 1] : null;
    const kern = betreffKern(m.betreff);
    return {
      art: 'mail',
      schluessel: `mail-${m.id}`,
      mail: m,
      offen: alle || m.id === juengste.id || neu.has(m.id) || !!o.offen?.has(m.id),
      neu: neu.has(m.id),
      ausgehend: zeile.ausgehend,
      absender: zeile.name,
      konto: zeile.konto,
      kreis: zeile.kreis,
      antwortAuf: v && v.id !== davor?.id ? { name: absenderZeile(v).name, zeit: mailZeit(v.gesendet_am, jetzt) } : null,
      betreffAbweichend: titel !== null && kern && kern.toLowerCase() !== titel ? kern : null,
    };
  });

  // Stapel: Läufe eingeklappter Mails, unterbrochen von allem, was offen, neu oder ungelesen ist.
  let lauf: Array<Extract<VerlaufEintrag, { art: 'mail' }>> = [];
  const abschliessen = () => {
    const schluessel = lauf.length > 0 ? `stapel-${lauf[0].mail.id}` : '';
    if (lauf.length >= STAPEL_AB && !o.stapelOffen?.has(schluessel)) {
      reihe.push({
        art: 'stapel',
        schluessel,
        ids: lauf.map((e) => e.mail.id),
        anzahl: lauf.length,
        absender: [...new Set(lauf.map((e) => e.absender))],
        anhaenge: lauf.reduce((summe, e) => summe + (e.mail.anhaenge?.length ?? 0), 0),
      });
    } else {
      reihe.push(...lauf);
    }
    lauf = [];
  };
  for (const e of mailEintraege) {
    if (!e.offen && !e.neu && !ungelesen(e.mail)) {
      lauf.push(e);
      continue;
    }
    abschliessen();
    reihe.push(e);
  }
  abschliessen();
  return reihe;
}

/** „6 Nachrichten, 1 neu" -- mit `mitAnfang` zählt das Formular bzw. die Anfrage mit. */
export function verlaufZaehler(mails: readonly MailNachricht[], neu: ReadonlySet<number>, mitAnfang = false): string {
  const anzahl = mails.length + (mitAnfang ? 1 : 0);
  const neue = mails.filter((m) => neu.has(m.id)).length;
  return neue > 0 ? `${VERLAUF_TEXT.nachrichten(anzahl)}, ${VERLAUF_TEXT.neu(neue)}` : VERLAUF_TEXT.nachrichten(anzahl);
}
