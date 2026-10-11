// Mails als Gespräche lesen (Simon, 11.10.2026: „Ordentliche eingeklappte
// Ansichten … Konversationsbäume ordentlich. Wie in einem guten Mail
// Client."). Reine Regeln ohne Darstellung -- App und Web zeigen sie mit
// demselben Baustein (components/support/MailGespraeche.tsx).
//
// Ein Gespräch sind die Mails, die über ihre Kopfzeilen zusammenhängen:
// In-Reply-To und References zeigen auf die Message-ID einer früheren Mail.
// Wer worauf antwortet, ergibt den Baum; eingerückt wird nach der Tiefe, aber
// höchstens MAX_TIEFE Stufen, sonst wandert ein langer Wechsel aus dem Bild.
// Mails ohne Bezug (eine neue Mail, eine Antwort des Supports ohne
// Vorgänger) beginnen ein eigenes Gespräch.

import type { MailNachricht } from '../types/support';
import { auszug, zitateTrennen, type TextTeil } from './supportMail';
import { datumKurz, datumUhrzeit, uhrzeit } from './dateUtils';

/** Tiefste Einrückung im Baum. */
export const MAX_TIEFE = 3;

export interface MailImBaum {
  mail: MailNachricht;
  /** 0 = Anfang des Gesprächs, gedeckelt auf MAX_TIEFE. */
  tiefe: number;
}

export interface Gespraech {
  /** Stabiler Schlüssel: die Kennung der ersten Mail. */
  schluessel: string;
  /** Betreff ohne „Re:"/„AW:" -- der der ersten Mail mit Betreff. */
  betreff: string;
  /** Die Mails in Lesereihenfolge: jede Antwort direkt unter ihrem Vorgänger. */
  mails: MailImBaum[];
  /** Zeitpunkt der jüngsten Mail. */
  letzte: string;
}

const ANTWORT_VORSILBEN = /^\s*(?:(?:re|aw|antw|wg|fw|fwd)(?:\[\d+\])?\s*:\s*)+/i;

/** Die Kennungen, die der Server in den Betreff setzt: „[Vorgang 4]", „[Anfrage 2]", „[Gemeinde 7]". */
const KENNUNGEN = /\s*\[(?:Vorgang|Anfrage|Gemeinde)\s+\d+\]/gi;

/**
 * Betreff ohne Antwort- und Weiterleitungs-Vorsilben und ohne die Kennung
 * des Servers -- so lautet er über dem Gespräch. Leer bleibt leer.
 */
export const betreffKern = (betreff: string | null | undefined): string =>
  (betreff ?? '').replace(ANTWORT_VORSILBEN, '').replace(KENNUNGEN, '').trim();

const zeit = (m: Pick<MailNachricht, 'gesendet_am'>) => {
  const t = Date.parse(m.gesendet_am);
  return Number.isNaN(t) ? 0 : t;
};

const frueher = (a: MailNachricht, b: MailNachricht) => zeit(a) - zeit(b) || a.id - b.id;

/**
 * Die Mails einer Liste als Gespräche, ältestes zuerst. Jede Mail kommt genau
 * einmal vor. Ein Vorgänger zählt nur, wenn er früher kam -- so entsteht aus
 * fehlerhaften Kopfzeilen nie ein Kreis.
 */
export function gespraecheBilden(mails: readonly MailNachricht[]): Gespraech[] {
  const sortiert = [...mails].sort(frueher);
  const rang = new Map(sortiert.map((m, i) => [m.id, i]));
  const nachKennung = new Map<string, MailNachricht>();
  for (const m of sortiert) {
    if (m.message_id && !nachKennung.has(m.message_id)) nachKennung.set(m.message_id, m);
  }

  // Vorgänger: erst In-Reply-To, dann die References von hinten (der nächste zuerst).
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

  // Zusammenhang: über den Vorgänger und über gemeinsame Kennungen in den
  // Kopfzeilen (zwei Antworten auf eine Mail, die hier fehlt).
  const wurzel = new Map<number, number>(sortiert.map((m) => [m.id, m.id]));
  const finde = (id: number): number => {
    let w = id;
    while (wurzel.get(w) !== w) w = wurzel.get(w) as number;
    wurzel.set(id, w);
    return w;
  };
  const verbinde = (a: number, b: number) => {
    const wa = finde(a);
    const wb = finde(b);
    if (wa === wb) return;
    // Die ältere Mail bleibt Wurzel: der Schlüssel des Gesprächs ist stabil.
    if ((rang.get(wa) ?? 0) < (rang.get(wb) ?? 0)) wurzel.set(wb, wa);
    else wurzel.set(wa, wb);
  };
  for (const [id, v] of vorgaenger) verbinde(id, v.id);
  const ersteMitKennung = new Map<string, number>();
  for (const m of sortiert) {
    for (const k of [m.message_id, m.in_reply_to, ...(m.referenzen ?? [])]) {
      if (!k) continue;
      const schon = ersteMitKennung.get(k);
      if (schon === undefined) ersteMitKennung.set(k, m.id);
      else verbinde(m.id, schon);
    }
  }

  const gruppen = new Map<number, MailNachricht[]>();
  for (const m of sortiert) {
    const w = finde(m.id);
    gruppen.set(w, [...(gruppen.get(w) ?? []), m]);
  }

  const gespraeche: Gespraech[] = [];
  for (const gruppe of gruppen.values()) {
    const kinder = new Map<number, MailNachricht[]>();
    const anfaenge: MailNachricht[] = [];
    for (const m of gruppe) {
      const v = vorgaenger.get(m.id);
      if (v) kinder.set(v.id, [...(kinder.get(v.id) ?? []), m]);
      else anfaenge.push(m);
    }
    const reihe: MailImBaum[] = [];
    const absteigen = (m: MailNachricht, tiefe: number) => {
      reihe.push({ mail: m, tiefe: Math.min(tiefe, MAX_TIEFE) });
      for (const k of kinder.get(m.id) ?? []) absteigen(k, tiefe + 1);
    };
    for (const a of anfaenge) absteigen(a, 0);
    const mitBetreff = gruppe.find((m) => betreffKern(m.betreff));
    gespraeche.push({
      schluessel: `gespraech-${gruppe[0].id}`,
      betreff: mitBetreff ? betreffKern(mitBetreff.betreff) : '',
      mails: reihe,
      letzte: gruppe[gruppe.length - 1].gesendet_am,
    });
  }
  return gespraeche.sort((a, b) => frueher(a.mails[0].mail, b.mails[0].mail));
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
 * Wer eine Mail geschrieben hat, für die Zeile im Gespräch: bei eingehenden
 * Name oder Adresse, bei ausgehenden das Support-Konto, das sie verfasst hat
 * (sonst der Absendername).
 */
export function mailAbsender(m: MailNachricht & { verfasst_von_name?: string | null }): string {
  if (m.richtung === 'aus') {
    // „Gesendet" steht daneben; der Name sagt, wer im Support geschrieben hat.
    return m.verfasst_von_name?.trim() || m.von_name?.trim() || 'Support';
  }
  return m.von_name?.trim() || m.von_adresse;
}

/**
 * Welche Mails beim Öffnen aufgeklappt sind: die jüngste und alle, die noch
 * ungelesen waren. Der Rest steht eingeklappt mit einer Zeile Vorschau da.
 */
export function anfangsOffen(mails: readonly MailNachricht[], neu?: ReadonlySet<number>): Set<number> {
  const offen = new Set<number>(neu ?? []);
  const juengste = [...mails].sort(frueher).pop();
  if (juengste) offen.add(juengste.id);
  return offen;
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
