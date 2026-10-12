// Support-Mail in der Support-Ansicht (03.10.2026, docs/planung/support-mail.md).
//
// Simon: „Ich muss auch auf eine Anfrage reagieren können etc. Deren Antwort
// richtig sortiert werden." — „Gut wären ja auch automatische Versatzstücke
// für Mails. Und ein guter Footer wäre auch gut."
//
// Hier steht, was Posteingang, Anfrage, Schriftwechsel einer Gemeinde und
// Textbausteine gemeinsam brauchen -- rein, ohne Aufrufe, damit es sich
// einzeln pruefen laesst: Platzhalter fuellen, Zitate erkennen, Betreff einer
// Antwort, Vorschau mit Fusszeile, Auszug, und das Lesen der Antworten, deren
// Form der Vertrag offenlaesst. Die Seiten tragen nur Darstellung und Aufrufe.

import type {
  AbsenderBekannt,
  GemeindeKurz,
  MailAntwortDaten,
  MailBaustein,
  MailBausteinDaten,
  MailEmpfaenger,
  MailNachricht,
  MailVerlauf,
  MailZaehler,
  Platzhalter,
  Postfach,
} from '../types/support';
import { datumKurz } from './dateUtils';
// Nur Typen: supportVorgaenge liest zur Laufzeit von hier, nicht umgekehrt.
import type { Kennzahl, StandTon, VorgangStatus } from './supportVorgaenge';
import { MAIL_ARCHIV_SATZ, MAIL_DETAIL_TEXT, kennzahlLabel } from '../seiten/supportDetail';

// --- Postfaecher -------------------------------------------------------------

/** Kurzname und Aufgabe je Postfach (Vertrag: moin fuer Anfragen, support fuer Gemeinden). */
export const POSTFACH_INFO: Record<Postfach, { kurz: string; aufgabe: string }> = {
  moin: { kurz: 'moin@', aufgabe: 'Anfragen und Erstkontakt' },
  support: { kurz: 'support@', aufgabe: 'Hilfe für Gemeinden' },
};

/** Auswahl im Formular eines Bausteins; "beide" geht als null an den Server. */
export const POSTFACH_AUSWAHL: Array<{ wert: Postfach | 'beide'; label: string }> = [
  { wert: 'beide', label: 'Beide Postfächer' },
  { wert: 'moin', label: 'moin@ (Anfragen)' },
  { wert: 'support', label: 'support@ (Gemeinden)' },
];

// --- Platzhalter -------------------------------------------------------------

/** Die sechs Platzhalter des Vertrags, in dieser Reihenfolge auch in der Hilfe. */
export const PLATZHALTER: ReadonlyArray<{ schluessel: keyof Platzhalter; beschreibung: string }> = [
  { schluessel: 'name', beschreibung: 'Name der Ansprechperson' },
  { schluessel: 'gemeinde', beschreibung: 'Name der Gemeinde' },
  { schluessel: 'lizenz', beschreibung: 'Lizenz bzw. Wunschlizenz' },
  { schluessel: 'testphase_bis', beschreibung: 'Ende der Testphase' },
  { schluessel: 'benutzername', beschreibung: 'Benutzername der Gemeindeleitung' },
  { schluessel: 'absender', beschreibung: 'Absendername aus den Einstellungen' },
];

const BEKANNTE_PLATZHALTER = new Set<string>(PLATZHALTER.map((p) => p.schluessel));

/** "{{name}}" -- so steht ein Platzhalter im Baustein. */
export const platzhalterMarke = (schluessel: string): string => `{{${schluessel}}}`;

/**
 * Beispielwerte fuer die Vorschau eines Bausteins in der Web-Fassung --
 * erfunden und nur zur Ansicht; gesendet wird immer mit den Werten der
 * Anfrage bzw. Gemeinde. Der Absender fehlt hier: Er kommt aus den
 * Einstellungen daneben.
 */
export const PLATZHALTER_BEISPIEL: Platzhalter = {
  name: 'Anna Beispiel',
  gemeinde: 'Kirchengemeinde Musterdorf',
  lizenz: 'Standard',
  testphase_bis: '2026-11-02',
  benutzername: 'anna.beispiel',
  absender: null,
};

/** Ein Datum aus dem Server (ISO) als 14.09.2026; alles andere bleibt, wie es ist. */
function datumWennIso(wert: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(wert) ? datumKurz(wert) || wert : wert;
}

/**
 * Platzhalter im Text fuellen. Ersetzt wird nur, was zu den sechs
 * Platzhaltern gehoert UND einen Wert hat; alles andere bleibt sichtbar
 * stehen (Vertrag: „was sie nicht kennt, bleibt sichtbar stehen") -- so
 * faellt eine Luecke vor dem Senden auf, statt still zu verschwinden.
 * Leerzeichen in den Klammern ("{{ name }}") sind erlaubt.
 */
export function platzhalterFuellen(text: string, werte: Partial<Record<string, string | null | undefined>>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (ganz, name: string) => {
    if (!BEKANNTE_PLATZHALTER.has(name) || !Object.prototype.hasOwnProperty.call(werte, name)) return ganz;
    const wert = werte[name];
    if (typeof wert !== 'string' || wert.trim() === '') return ganz;
    return name === 'testphase_bis' ? datumWennIso(wert.trim()) : wert.trim();
  });
}

/** Die Platzhalter, die im Text noch ungefuellt stehen (bekannte wie unbekannte), ohne Dubletten. */
export function offenePlatzhalter(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]))];
}

// --- Zitate ------------------------------------------------------------------

/** Ein Stueck Text einer Mail: eigener Text oder Zitat (eingeklappt). */
export interface TextTeil {
  zitat: boolean;
  text: string;
}

/** "Am 02.10.2026 um 10:00 schrieb Anna <anna@example.org>:" / "On Fri, Oct 2, 2026, Anna wrote:" */
const ZITAT_KOPF = /^\s*(?:Am|On)\s.*\b(?:schrieb|wrote)\b.*:\s*$/;
/** Outlook und andere: Trennzeile vor der zitierten Mail. */
const ZITAT_TRENNER = /^\s*-{2,}\s*(?:Ursprüngliche Nachricht|Original Message)\s*-{2,}\s*$/i;

/**
 * Wie viele Zeilen ab `i` die Einleitung eines Zitats bilden: 0 (keine), 1
 * oder 2 -- manche Programme brechen die Zeile „Am … schrieb Name <adresse>:"
 * nach dem Namen um.
 */
function zitatKopfZeilen(zeilen: string[], i: number): number {
  const zeile = zeilen[i];
  if (ZITAT_TRENNER.test(zeile)) return 1;
  if (!/^\s*(?:Am|On)\s/.test(zeile)) return 0;
  if (ZITAT_KOPF.test(zeile)) return 1;
  const naechste = zeilen[i + 1];
  if (naechste !== undefined && naechste.trim() !== '' && ZITAT_KOPF.test(`${zeile} ${naechste}`)) return 2;
  return 0;
}

/** Leere Zeilen am Anfang und Ende eines Blocks weg. */
function blockTrimmen(zeilen: string[]): string[] {
  let von = 0;
  let bis = zeilen.length;
  while (von < bis && zeilen[von].trim() === '') von++;
  while (bis > von && zeilen[bis - 1].trim() === '') bis--;
  return zeilen.slice(von, bis);
}

/**
 * Den Text einer Mail in eigenen Text und Zitate teilen. Zitat ist
 *   - jede Zeile, die mit „>" beginnt (zusammenhaengende Zeilen sind ein Block),
 *   - alles ab „Am … schrieb …:" / „On … wrote:" (auch ueber zwei Zeilen)
 *     oder ab „-----Ursprüngliche Nachricht-----" bis zum Ende.
 * Leere Zeilen gehoeren zum Block davor; Bloecke ohne Inhalt fallen weg.
 */
export function zitateTrennen(text: string | null | undefined): TextTeil[] {
  const zeilen = (text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const bloecke: Array<{ zitat: boolean; zeilen: string[] }> = [];
  const anhaengen = (zitat: boolean, zeile: string) => {
    const letzter = bloecke[bloecke.length - 1];
    if (letzter && letzter.zitat === zitat) letzter.zeilen.push(zeile);
    else bloecke.push({ zitat, zeilen: [zeile] });
  };
  for (let i = 0; i < zeilen.length; i++) {
    if (zitatKopfZeilen(zeilen, i) > 0) {
      for (const rest of zeilen.slice(i)) anhaengen(true, rest);
      break;
    }
    const zeile = zeilen[i];
    if (zeile.trim() === '') {
      if (bloecke.length > 0) bloecke[bloecke.length - 1].zeilen.push(zeile);
      continue;
    }
    anhaengen(/^\s*>/.test(zeile), zeile);
  }
  const teile: TextTeil[] = [];
  for (const b of bloecke) {
    const inhalt = blockTrimmen(b.zeilen);
    if (inhalt.length === 0) continue;
    const letzter = teile[teile.length - 1];
    if (letzter && letzter.zitat === b.zitat) letzter.text += `\n${inhalt.join('\n')}`;
    else teile.push({ zitat: b.zitat, text: inhalt.join('\n') });
  }
  return teile;
}

/**
 * Kurzer Auszug fuer Listen: der eigene Text ohne Zitate, Leerraum
 * zusammengezogen, an einer Wortgrenze gekuerzt. Besteht die Mail nur aus
 * Zitat, steht dessen Anfang da.
 */
export function auszug(text: string | null | undefined, laenge = 140): string {
  const teile = zitateTrennen(text);
  const eigen = teile.filter((t) => !t.zitat).map((t) => t.text).join(' ');
  const roh = (eigen || teile.map((t) => t.text).join(' ')).replace(/\s+/g, ' ').trim();
  if (roh.length <= laenge) return roh;
  const schnitt = roh.slice(0, laenge);
  const wortgrenze = schnitt.lastIndexOf(' ');
  return `${(wortgrenze > laenge / 2 ? schnitt.slice(0, wortgrenze) : schnitt).trimEnd()}…`;
}

// --- Betreff, Vorschau, Koerper ------------------------------------------------

/**
 * Antwort- und Weiterleitungs-Vorsilben am Anfang: „Re:", „AW:", „Antw:",
 * „WG:", „FW:", „Fwd:", „Re[2]:" -- auch mehrfach hintereinander. Dieselbe
 * Liste wie der Server (backend/services/mailVersand.js, antwortBetreff).
 */
const ANTWORT_VORSILBEN = /^\s*(?:(?:re|aw|antw|wg|fw|fwd)(?:\[\d+\])?\s*:\s*)+/i;

/** Die Kennungen, die der Server in den Betreff setzt: „[Vorgang 4]", „[Anfrage 2]", „[Gemeinde 7]". */
const KENNUNGEN = /\s*\[(?:Vorgang|Anfrage|Gemeinde)\s+\d+\]/gi;

/**
 * Der Kern eines Betreffs: ohne die Kennungen des Servers und ohne die
 * Vorsilben. Erst fallen die Kennungen, dann die Vorsilben -- sonst bliebe
 * stehen, was hinter „AW: [Vorgang 2]" kommt („Re: AW: Re: …", Fehler vorab 1
 * in docs/planung/support-detailseiten.md). Leer bleibt leer. Die eine Stelle
 * für Gespräche (utils/mailGespraeche.ts) und Antworten.
 */
export function betreffKern(betreff: string | null | undefined): string {
  return (betreff ?? '').replace(KENNUNGEN, '').replace(ANTWORT_VORSILBEN, '').trim();
}

/**
 * Betreff einer Antwort: „Re: " vor den Kern des Betreffs der letzten Mail
 * („AW: [Vorgang 2] Re: Frage" -> „Re: Frage"). Die Kennung hängt der Server
 * beim Senden an (betreffMitKennung). Leer bleibt leer -- dann setzt der
 * Server den Betreff.
 */
export function standardBetreff(betreff: string | null | undefined): string {
  const kern = betreffKern(betreff);
  return kern ? `Re: ${kern}` : '';
}

/**
 * Betreff der automatischen Bestaetigung einer Anfrage
 * (backend/services/emailService.js). Gibt es noch keine Mail im Verlauf,
 * antwortet der Support darauf: „Re: Eure Anfrage bei Konfi Quest".
 */
export const ANFRAGE_BETREFF = 'Eure Anfrage bei Konfi Quest';

/** Trennzeile vor der Fusszeile (Signaturtrenner nach RFC 3676: zwei Striche, ein Leerzeichen). */
export const FUSSZEILEN_TRENNER = '-- ';

/**
 * So kommt die Antwort an: der Text, darunter „-- " und die Fusszeile.
 * Ohne Fusszeile nur der Text. Dieselbe Form setzt der Server beim Senden.
 */
export function vorschauText(text: string, fusszeile: string | null | undefined): string {
  const rumpf = text.replace(/\s+$/, '');
  const fuss = (fusszeile ?? '').replace(/\s+$/, '').replace(/^\s*\n/, '');
  return fuss.trim() ? `${rumpf}\n\n${FUSSZEILEN_TRENNER}\n${fuss}` : rumpf;
}

/** Text und Betreff des Antwortformulars. */
export interface AntwortEntwurf {
  betreff: string;
  text: string;
}

/**
 * Einen Baustein einfuegen: Platzhalter gefuellt, unter den schon
 * geschriebenen Text (nichts geht verloren). Den Betreff setzt der Baustein
 * nur, wenn das Feld leer ist oder noch auf dem Vorschlag steht -- einen
 * selbst getippten Betreff ueberschreibt er nicht.
 */
export function bausteinEinfuegen(
  stand: AntwortEntwurf,
  baustein: Pick<MailBaustein, 'betreff' | 'text'>,
  werte: Partial<Record<string, string | null | undefined>>,
  vorschlag: string
): AntwortEntwurf {
  const text = platzhalterFuellen(baustein.text, werte);
  const neuerText = stand.text.trim() ? `${stand.text.replace(/\s+$/, '')}\n\n${text}` : text;
  const betreffFrei = !stand.betreff.trim() || stand.betreff === vorschlag;
  const betreff = baustein.betreff?.trim() && betreffFrei ? platzhalterFuellen(baustein.betreff.trim(), werte) : stand.betreff;
  return { betreff, text: neuerText };
}

/** Was nur die Antwort im Vorgang mitschickt (additiv seit 12.10.2026). */
export interface AntwortZusatz {
  /** „Danach": der Status nach dem Senden. */
  status?: VorgangStatus | null;
  /** Die angezeigte, beantwortete Mail (ihre ID). */
  antwortAuf?: number | null;
}

/**
 * Koerper fuer POST …/antworten: Text ohne Leerraum am Ende, Betreff nur,
 * wenn einer dasteht (sonst setzt ihn der Server), `an` nur bei Gemeinden.
 * Im Vorgang dazu `status` („Danach") und `antwort_auf` (die beantwortete
 * Mail) -- jeweils nur, wenn es sie gibt; ältere Server übergehen beide.
 */
export function antwortKoerper(entwurf: AntwortEntwurf, an?: string | null, zusatz: AntwortZusatz = {}): MailAntwortDaten {
  const koerper: MailAntwortDaten = { text: entwurf.text.replace(/\s+$/, '') };
  const betreff = entwurf.betreff.trim();
  if (betreff) koerper.betreff = betreff;
  if (an) koerper.an = an;
  if (zusatz.status) koerper.status = zusatz.status;
  if (typeof zusatz.antwortAuf === 'number' && Number.isInteger(zusatz.antwortAuf) && zusatz.antwortAuf > 0) koerper.antwort_auf = zusatz.antwortAuf;
  return koerper;
}

/** Was vor dem Senden fehlt, als ein Satz -- oder null. */
export function antwortFehler(entwurf: AntwortEntwurf, empfaengerNoetig = false, an?: string | null): string | null {
  if (empfaengerNoetig && !an) return 'Bitte einen Empfänger wählen';
  if (!entwurf.text.trim()) return 'Bitte einen Text schreiben';
  return null;
}

/**
 * Warum das Senden scheiterte, aus Status und Text des Servers (Vertrag: 503
 * Postfach nicht eingerichtet, 502 Versand gescheitert; Nachtrag 03.10.2026:
 * 503 „Auf diesem Server ist der Versand aus." -- dann gilt der Text des
 * Servers). null: kein bekannter Fall, die allgemeine Meldung gilt.
 */
export type SendeProblem =
  | { art: 'nicht_eingerichtet' }
  | { art: 'server_aus'; text: string }
  | { art: 'versand_gescheitert' };

export function sendeProblem(status: number | undefined, serverText?: string | null): SendeProblem | null {
  if (status === 503) {
    const text = serverText?.trim();
    return text && /diesem Server/i.test(text) ? { art: 'server_aus', text } : { art: 'nicht_eingerichtet' };
  }
  if (status === 502) return { art: 'versand_gescheitert' };
  return null;
}

/** Beispieltext fuer die Vorschau der Fusszeile (Textbausteine). */
export const VORSCHAU_BEISPIEL = 'Hallo,\n\nhier steht der Text der Antwort.';

/** Der Hinweis zu einem Sendeproblem: Titel und Satz -- fuer App und Web gleich. */
export function sendeHinweisText(problem: SendeProblem, postfach: Postfach): { titel: string; text: string } {
  if (problem.art === 'nicht_eingerichtet') {
    return {
      titel: 'Postfach noch nicht eingerichtet',
      text: `Für ${POSTFACH_INFO[postfach].kurz} fehlen auf dem Server noch die Zugangsdaten. Die Antwort wurde nicht gesendet; dein Text bleibt hier stehen.`,
    };
  }
  if (problem.art === 'server_aus') {
    return { titel: 'Nicht gesendet', text: `${problem.text} Dein Text bleibt hier stehen.` };
  }
  return {
    titel: 'Versand gescheitert',
    text: 'Der Mailserver hat die Antwort nicht angenommen; gespeichert wurde nichts. Dein Text bleibt hier stehen — bitte später noch einmal senden.',
  };
}

/** Hinweis, wenn dieser Server ein Postfach nicht bedient (auf_diesem_server: false). */
export const SERVER_AUS_HINWEIS = 'Auf diesem Server aus – Versand und Abholen laufen auf dem Hauptserver';

/**
 * Bedient dieser Server das Postfach? Fehlt das Feld (aelterer Server) oder
 * der Zustand ganz, gilt ja -- dann entscheidet der Server beim Senden.
 */
export function aufDiesemServer(status: { auf_diesem_server?: boolean } | null | undefined): boolean {
  return status?.auf_diesem_server !== false;
}

// --- Liste und Faden -----------------------------------------------------------

/** "Anna Beispiel <anna@example.org>" -- oder nur die Adresse. */
export function absenderText(m: Pick<MailNachricht, 'von_name' | 'von_adresse'>): string {
  const name = m.von_name?.trim();
  return name ? `${name} <${m.von_adresse}>` : m.von_adresse;
}

/** Aelteste zuerst; bei gleicher Zeit nach Kennung. */
export function chronologisch<T extends Pick<MailNachricht, 'id' | 'gesendet_am'>>(liste: readonly T[]): T[] {
  const zeit = (m: T) => {
    const t = new Date(m.gesendet_am).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  return [...liste].sort((a, b) => zeit(a) - zeit(b) || a.id - b.id);
}

/** Kennungen der eingehenden Mails ohne Lesedatum -- die gehen an POST /mail/gelesen. */
export function ungeleseneIds(liste: ReadonlyArray<Pick<MailNachricht, 'id' | 'richtung' | 'gelesen_am'>>): number[] {
  return liste.filter((m) => m.richtung === 'ein' && !m.gelesen_am).map((m) => m.id);
}

/**
 * Der Faden einer Mail (GET /mail/nachrichten/:id): `verlauf` chronologisch,
 * die Mail selbst immer dabei -- auch wenn der Server sie im Verlauf
 * weglaesst.
 */
export function fadenAus(mail: MailNachricht & { verlauf?: MailNachricht[] | null }): MailNachricht[] {
  const verlauf = Array.isArray(mail.verlauf) ? mail.verlauf : [];
  const { verlauf: _weg, ...selbst } = mail;
  return chronologisch(verlauf.some((m) => m.id === mail.id) ? verlauf : [...verlauf, selbst]);
}

/** Bausteine nach Sortierung, dann Titel. */
export function bausteineSortiert(bausteine: readonly MailBaustein[]): MailBaustein[] {
  return [...bausteine].sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0) || a.titel.localeCompare(b.titel, 'de'));
}

/** Bausteine fuer ein Postfach: die dieses Postfachs und die fuer beide, nach Sortierung, dann Titel. */
export function bausteineFuer(bausteine: readonly MailBaustein[], postfach: Postfach): MailBaustein[] {
  return bausteineSortiert(bausteine.filter((b) => b.postfach === postfach || b.postfach === null));
}

/** Wofuer ein Baustein gilt, als Wort fuer die Liste. */
export const bausteinPostfachText = (postfach: Postfach | null): string =>
  postfach ? POSTFACH_INFO[postfach].kurz : 'Beide Postfächer';

// --- Bausteine verwalten -------------------------------------------------------

export interface BausteinFormular {
  titel: string;
  postfach: Postfach | 'beide';
  betreff: string;
  text: string;
}

export const LEERER_BAUSTEIN: BausteinFormular = { titel: '', postfach: 'beide', betreff: '', text: '' };

export function bausteinFormular(b: MailBaustein): BausteinFormular {
  return { titel: b.titel, postfach: b.postfach ?? 'beide', betreff: b.betreff ?? '', text: b.text };
}

export function bausteinFehler(f: BausteinFormular): string | null {
  return !f.titel.trim() || !f.text.trim() ? 'Titel und Text sind erforderlich' : null;
}

/** Koerper fuer POST /mail/bausteine und PUT /mail/bausteine/:id. */
export function bausteinKoerper(f: BausteinFormular): MailBausteinDaten {
  return {
    titel: f.titel.trim(),
    betreff: f.betreff.trim() || null,
    text: f.text.replace(/\s+$/, ''),
    postfach: f.postfach === 'beide' ? null : f.postfach,
  };
}

// --- Antworten des Servers lesen ----------------------------------------------

const positiveZahl = (wert: unknown): number => (typeof wert === 'number' && Number.isFinite(wert) && wert > 0 ? wert : 0);

const zahlenTabelle = (wert: unknown): Record<string, number> => {
  if (!wert || typeof wert !== 'object' || Array.isArray(wert)) return {};
  const raus: Record<string, number> = {};
  for (const [k, v] of Object.entries(wert as Record<string, unknown>)) {
    const n = positiveZahl(v);
    if (n > 0) raus[k] = n;
  }
  return raus;
};

/**
 * GET /support/mail/zaehler: die Zahlen der Mail (`anfragen`, `gemeinden`,
 * `eingang`, je Anfrage und Gemeinde -- aelter, bleiben) plus die zwei roten
 * Zahlen der Support-Ansicht seit den Vorgaengen (docs/planung/
 * support-vorgaenge.md): `vorgaenge` (nicht archivierte Vorgaenge mit Status
 * „Neu" oder ungelesener Mail) und `posteingang` (ungelesene, nicht
 * einsortierte, nicht archivierte Mails). Beide sind zusaetzliche Felder:
 * ein aelterer Server liefert sie nicht, dann zaehlen sie 0.
 */
export interface SupportZaehler extends MailZaehler {
  vorgaenge: number;
  posteingang: number;
}

/** GET /support/mail/zaehler lesen; fehlende oder falsche Felder zaehlen 0. Kein Objekt: null. */
export function zaehlerLesen(daten: unknown): SupportZaehler | null {
  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) return null;
  const d = daten as Record<string, unknown>;
  return {
    anfragen: positiveZahl(d.anfragen),
    gemeinden: positiveZahl(d.gemeinden),
    eingang: positiveZahl(d.eingang),
    je_anfrage: zahlenTabelle(d.je_anfrage),
    je_gemeinde: zahlenTabelle(d.je_gemeinde),
    vorgaenge: positiveZahl(d.vorgaenge),
    posteingang: positiveZahl(d.posteingang),
  };
}

const textOderNull = (wert: unknown): string | null => (typeof wert === 'string' && wert.trim() ? wert.trim() : null);

/**
 * GET /gemeinden/:id/empfaenger lesen. Der Vertrag nennt die Form nicht;
 * angenommen werden eine Liste (oder `{ empfaenger: [...] }`) aus
 * Zeichenketten oder Objekten mit `adresse`/`email` und optional
 * `name`/`display_name` und `herkunft`/`quelle`/`rolle`. Ohne „@" keine
 * Adresse; doppelte Adressen nur einmal (die erste gewinnt).
 */
export function empfaengerLesen(daten: unknown): MailEmpfaenger[] {
  const liste: unknown[] = Array.isArray(daten)
    ? daten
    : daten && typeof daten === 'object' && Array.isArray((daten as { empfaenger?: unknown }).empfaenger)
      ? (daten as { empfaenger: unknown[] }).empfaenger
      : [];
  const gesehen = new Set<string>();
  const raus: MailEmpfaenger[] = [];
  for (const eintrag of liste) {
    let e: MailEmpfaenger | null = null;
    if (typeof eintrag === 'string') {
      e = { adresse: eintrag.trim(), name: null, herkunft: null };
    } else if (eintrag && typeof eintrag === 'object') {
      const o = eintrag as Record<string, unknown>;
      const adresse = textOderNull(o.adresse) ?? textOderNull(o.email);
      if (adresse) {
        e = {
          adresse,
          name: textOderNull(o.name) ?? textOderNull(o.display_name),
          herkunft: textOderNull(o.herkunft) ?? textOderNull(o.quelle) ?? textOderNull(o.rolle),
        };
      }
    }
    if (!e || !e.adresse.includes('@')) continue;
    const schluessel = e.adresse.toLowerCase();
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    raus.push(e);
  }
  return raus;
}

/**
 * Woher eine mögliche Adresse stammt -- die Schlüssel des Servers, in dieser
 * Reihenfolge auch der Vorrang (backend/routes/supportVorgaenge.js,
 * empfaengerFuerVorgang; backend/routes/supportMail.js, empfaengerLaden).
 */
export type EmpfaengerHerkunft = 'absender' | 'kontakt' | 'anfrage' | 'leitung' | 'verlauf';

/** Das lesbare Etikett je Herkunft, für App und Web gleich. */
export const EMPFAENGER_ETIKETT: Readonly<Record<EmpfaengerHerkunft, string>> = {
  absender: 'schrieb uns',
  kontakt: 'Kontakt aus dem Formular',
  anfrage: 'aus der Anfrage',
  leitung: 'Gemeindeleitung',
  verlauf: 'aus früheren Mails',
};

/** Ein Schlüssel, wie der Server ihn schickt: nur Kleinbuchstaben, Ziffern und Unterstrich. */
const ROHER_SCHLUESSEL = /^[a-z0-9_]+$/;

/**
 * Das Etikett zur Herkunft einer Adresse. Ein bekannter Schlüssel wird zum
 * Etikett („verlauf" -> „aus früheren Mails"); ein unbekannter Schlüssel steht
 * nie roh da (null). Ein lesbarer Text -- ein älterer Server, ein Etikett, das
 * die Seite selbst setzt -- bleibt unverändert. Bis 11.10.2026 stand der
 * Schlüssel roh in der Empfängerwahl (Fehler vorab 4).
 */
export function empfaengerEtikett(herkunft: string | null): string | null {
  const wert = herkunft?.trim();
  if (!wert) return null;
  if (Object.prototype.hasOwnProperty.call(EMPFAENGER_ETIKETT, wert)) return EMPFAENGER_ETIKETT[wert as EmpfaengerHerkunft];
  return ROHER_SCHLUESSEL.test(wert) ? null : wert;
}

/** "Anna Beispiel <anna@example.org> · Gemeindeleitung" */
export function empfaengerText(e: MailEmpfaenger): string {
  const wer = e.name ? `${e.name} <${e.adresse}>` : e.adresse;
  const etikett = empfaengerEtikett(e.herkunft);
  return etikett ? `${wer} · ${etikett}` : wer;
}

/** Anzeigename einer Gemeinde. */
export const gemeindeName = (g: GemeindeKurz): string => (g.display_name?.trim() || g.name);

/** Gemeinden zur Auswahl, nach Namen. */
export function gemeindenSortiert(gemeinden: readonly GemeindeKurz[]): GemeindeKurz[] {
  return [...gemeinden].sort((a, b) => gemeindeName(a).localeCompare(gemeindeName(b), 'de'));
}

// --- Detailseite einer Mail (docs/planung/support-detailseiten.md, D und E) ----------

/**
 * GET /support/mail/nachrichten/:id mit den Feldern, die der Server zusätzlich
 * liefert: `vorgang_id` und `archiviert_am` (Migration 195), `absender_bekannt`
 * (additiv seit 12.10.2026; ältere Server liefern es nicht).
 */
export type MailMitVorgang = MailVerlauf & {
  vorgang_id?: number | null;
  archiviert_am?: string | null;
  absender_bekannt?: AbsenderBekannt | null;
};

const kennungOderNull = (wert: unknown): number | null => (typeof wert === 'number' && Number.isInteger(wert) && wert > 0 ? wert : null);

/**
 * `absender_bekannt` lesen. Fehlt das Feld (älterer Server) oder ist es
 * kaputt -- keine Gemeinde, kein Name, keine Zahl, eine Vorgangs-Kennung, die
 * keine ist --, dann null: Die Zeile „Absender gehört zu …" entfällt.
 */
export function absenderBekanntLesen(roh: unknown): AbsenderBekannt | null {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return null;
  const a = roh as Record<string, unknown>;
  const organizationId = kennungOderNull(a.organization_id);
  const name = textOderNull(a.gemeinde_name);
  const offene = a.offene_vorgaenge;
  if (organizationId === null || name === null || typeof offene !== 'number' || !Number.isInteger(offene) || offene < 0) return null;
  const vorgangId = a.vorgang_id === null || a.vorgang_id === undefined ? null : kennungOderNull(a.vorgang_id);
  if (vorgangId === null && a.vorgang_id !== null && a.vorgang_id !== undefined) return null;
  return { organization_id: organizationId, gemeinde_name: name, offene_vorgaenge: offene, vorgang_id: vorgangId };
}

/**
 * GET /support/mail/nachrichten/:id lesen: die Mail, wie der Server sie
 * schickt, mit `absender_bekannt` durch den Leser (immer da: Angabe oder
 * null). Ohne Kennung: null.
 */
export function mailMitVorgangLesen(daten: unknown): MailMitVorgang | null {
  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) return null;
  const roh = daten as MailMitVorgang & { absender_bekannt?: unknown };
  if (typeof roh.id !== 'number') return null;
  return { ...roh, absender_bekannt: absenderBekanntLesen(roh.absender_bekannt) };
}

/** Die Zeile „Absender gehört zu …" einer Mail im Posteingang (Frage 11). */
export interface MailAbsenderAngabe {
  /** „Absender gehört zu {Gemeinde} · 2 offene Vorgänge" bzw. „· kein offener Vorgang". */
  satz: string;
  organizationId: number;
  /** Der jüngste offene Vorgang der Gemeinde: Knopf „In Vorgang N einsortieren" und Vorbelegung; null ohne. */
  vorgangId: number | null;
}

/**
 * Was die Seite einer Mail über ihren Absender sagt: nur im Posteingang und
 * nur, wenn der Server die Gemeinde kennt (`absender_bekannt`, Regel-Stelle
 * gemeindeDesKontos im Server). Sonst null -- auch bei einem älteren Server.
 */
export function mailAbsenderAngabe(m: MailMitVorgang): MailAbsenderAngabe | null {
  const a = m.absender_bekannt ?? null;
  if (!a || !mailImPosteingang(m)) return null;
  return { satz: MAIL_DETAIL_TEXT.absender(a.gemeinde_name, a.offene_vorgaenge), organizationId: a.organization_id, vorgangId: a.vorgang_id };
}

/**
 * Liegt die Mail im Posteingang? Nur, wenn sie weder einem Vorgang noch einer
 * Anfrage noch einer Gemeinde zugeordnet ist -- dieselbe Regel wie der Server
 * (backend/routes/supportMail.js, IM_POSTEINGANG_SQL) und istNichtZugeordnet
 * (utils/supportWeb.ts). Sonst lehnt der Server Archivieren und Löschen mit
 * 409 ab.
 */
export function mailImPosteingang(m: Pick<MailNachricht, 'anfrage_id' | 'organization_id'> & { vorgang_id?: number | null }): boolean {
  return (m.vorgang_id ?? null) === null && m.anfrage_id === null && m.organization_id === null;
}

/**
 * Wohin eine Mail weiterleitet, die nicht im Posteingang liegt: in ihren
 * Vorgang mit der Mail offen (`?mail=`), ältere Server nennen nur Anfrage
 * oder Gemeinde. Im Posteingang: null.
 */
export function mailWeiterleitung(m: { id: number; vorgang_id?: number | null; anfrage_id: number | null; organization_id: number | null }): string | null {
  if (m.vorgang_id) return `/admin/support/vorgaenge/${m.vorgang_id}?mail=${m.id}`;
  if (m.anfrage_id !== null) return `/admin/support/anfragen/${m.anfrage_id}`;
  if (m.organization_id !== null) return `/admin/support/vorgaenge?gemeinde=${m.organization_id}`;
  return null;
}

/** Der Stand einer Mail: was die Detailseite zeigt und anbietet. */
export interface MailStandAngabe {
  imPosteingang: boolean;
  archiviert: boolean;
  /** Nur im Archiv: der Satz dazu. */
  satz: string | null;
  ton: StandTon | null;
  /** Im Posteingang ist Einsortieren der Hauptknopf; sonst gibt es keinen (die Seite leitet weiter). */
  haupt: 'einsortieren' | null;
  neben: Array<'antworten' | 'wiederherstellen'>;
  archivierbar: boolean;
  loeschbar: boolean;
  weiterleitung: string | null;
}

/**
 * Der Stand einer Mail. Im Posteingang: Einsortieren als Hauptknopf,
 * Antworten daneben; im Archiv Wiederherstellen daneben und der Satz, dass
 * Einsortieren sie zurückholt (der Server holt sie dabei selbst aus dem
 * Archiv). Archivieren und Löschen nur im Posteingang -- für Mails eines
 * Vorgangs antwortet der Server 409 (Fehler vorab 2); die leiten weiter.
 */
export function mailStand(m: MailMitVorgang, _o: { jetzt?: Date } = {}): MailStandAngabe {
  const imPosteingang = mailImPosteingang(m);
  const archiviert = !!m.archiviert_am;
  if (!imPosteingang) {
    return {
      imPosteingang, archiviert, satz: null, ton: null, haupt: null, neben: [], archivierbar: false, loeschbar: false,
      weiterleitung: mailWeiterleitung(m),
    };
  }
  return {
    imPosteingang,
    archiviert,
    satz: archiviert ? MAIL_ARCHIV_SATZ(datumKurz(m.archiviert_am)) : null,
    ton: archiviert ? 'hinweis' : null,
    haupt: 'einsortieren',
    neben: archiviert ? ['wiederherstellen'] : ['antworten'],
    archivierbar: !archiviert,
    loeschbar: true,
    weiterleitung: null,
  };
}

/** Die drei Zahlen einer Mail: Mails im Faden · Neu · Anhänge. */
export function mailKennzahlen(faden: readonly MailNachricht[], neu: number): [Kennzahl, Kennzahl, Kennzahl] {
  const zahl = (schluessel: Kennzahl['schluessel'], n: number): Kennzahl => ({ schluessel, label: kennzahlLabel(schluessel, n), wert: String(n), zahl: n });
  const anhaenge = faden.reduce((summe, m) => summe + (m.anhaenge?.length ?? 0), 0);
  return [zahl('mails', faden.length), zahl('neu', neu), zahl('anhaenge', anhaenge)];
}
