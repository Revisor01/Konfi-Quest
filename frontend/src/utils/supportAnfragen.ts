// Anfragen aus dem Formular der Homepage in der Support-Ansicht (Web-Version,
// Entscheidung 4, 02.10.2026): "Jede Anfrage landet in der Support-Ansicht und
// laesst sich dort mit wenigen Schritten in eine Gemeinde samt Zuordnung und
// erster Gemeindeleitung umwandeln."
//
// Hier steht, was Liste, Detail und Anlegen gemeinsam brauchen: die Namen der
// Status, die Vorbelegung des Formulars aus der Anfrage und die Pruefungen vor
// dem Absenden. Die Seiten selbst tragen nur Darstellung und Aufrufe.

import type { AnfrageAnlegenDaten, AnfrageStatus, GemeindeAnfrage, Kirchenkreis } from '../types/support';
import { systemnameAusAnzeigename, umlauteUmschreiben } from './gemeindeSystemname';
import { USERNAME_MAX_LENGTH, isValidUsername } from './usernameValidation';
import { TESTPHASE_KONFIS, limitNachUmschalten, limitVorgabe } from './konfiLimitVorgabe';

export const ANFRAGE_STATUS: Record<AnfrageStatus, { label: string; farbe: string }> = {
  neu: { label: 'Neu', farbe: 'var(--app-color-warning)' },
  in_arbeit: { label: 'In Arbeit', farbe: 'var(--app-color-info)' },
  angelegt: { label: 'Angelegt', farbe: 'var(--app-color-success)' },
  abgelehnt: { label: 'Abgelehnt', farbe: 'var(--app-color-neutral)' },
};

/** Reihenfolge im Filter der Liste; "alle" ohne Status-Parameter. */
export const STATUS_FILTER: Array<{ wert: AnfrageStatus | 'alle'; label: string }> = [
  { wert: 'neu', label: 'Neu' },
  { wert: 'in_arbeit', label: 'In Arbeit' },
  { wert: 'angelegt', label: 'Angelegt' },
  { wert: 'abgelehnt', label: 'Abgelehnt' },
  { wert: 'alle', label: 'Alle' },
];

/**
 * Status, die sich von Hand setzen lassen. "Angelegt" setzt allein das
 * Anlegen der Gemeinde (POST /support/anfragen/:id/anlegen) -- sonst stuende
 * eine Anfrage als erledigt da, zu der es keine Gemeinde gibt.
 */
export const STATUS_VON_HAND: AnfrageStatus[] = ['neu', 'in_arbeit', 'abgelehnt'];

/** Tage der Testphase beim Anlegen, wie im Formular "Gemeinde anlegen" (30 Tage). */
export const TESTPHASE_TAGE = 30;

/** Konfi-Limit in der Testphase -- die Regel steht in utils/konfiLimitVorgabe.ts. */
export { TESTPHASE_KONFIS };

/** Vergleichsform eines Namens: klein, Umlaute umgeschrieben, Leerraum vereinheitlicht. */
function vergleichsform(text: string): string {
  return umlauteUmschreiben(text.trim().toLowerCase()).replace(/\s+/g, ' ');
}

/** Wie vergleichsform, aber ohne vorangestelltes "Kirchenkreis"/"Ev.-Luth. Kirchenkreis". */
function kirchenkreisKern(text: string): string {
  return vergleichsform(text).replace(/^(ev\.?-?luth\.?\s+)?kirchenkreis\s+/, '').trim();
}

/**
 * Den Kirchenkreis aus der Anfrage (Freitext) in der Struktur finden.
 * "Dithmarschen" findet "Kirchenkreis Dithmarschen" und umgekehrt. Gibt es den
 * Namen in mehreren Landeskirchen, entscheidet die Landeskirche der Anfrage;
 * bleibt es mehrdeutig, wird nichts vorgewaehlt.
 */
export function kirchenkreisFinden(
  kirchenkreisText: string | null | undefined,
  landeskircheText: string | null | undefined,
  kirchenkreise: Kirchenkreis[]
): Kirchenkreis | null {
  const kern = kirchenkreisKern(kirchenkreisText ?? '');
  if (!kern) return null;
  const treffer = kirchenkreise.filter((k) => kirchenkreisKern(k.name) === kern);
  if (treffer.length === 1) return treffer[0];
  if (treffer.length === 0) return null;
  const lk = vergleichsform(landeskircheText ?? '');
  const passend = lk ? treffer.filter((k) => vergleichsform(k.landeskirche ?? '') === lk) : [];
  return passend.length === 1 ? passend[0] : null;
}

/** Die Landeskirche aus der Anfrage (Freitext) in der Struktur finden, ohne Gross/klein. */
export function landeskircheFinden<T extends { id: number; name: string }>(
  text: string | null | undefined,
  landeskirchen: T[]
): T | null {
  const gesucht = vergleichsform(text ?? '');
  if (!gesucht) return null;
  return landeskirchen.find((l) => vergleichsform(l.name) === gesucht) ?? null;
}

/**
 * Vorschlag fuer den Benutzernamen der ersten Gemeindeleitung: die letzten
 * beiden Woerter des Namens, klein, Umlaute umgeschrieben, mit Punkt
 * ("Pastorin Anna Müller" -> "anna.mueller"). Nur ein Vorschlag -- frei ist
 * er erst, wenn der Server ihn annimmt (systemweit eindeutig, sonst 409).
 */
export function benutzernameVorschlag(name: string): string {
  const woerter = umlauteUmschreiben(name)
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9-]/g, ''))
    .filter(Boolean);
  const vorschlag = woerter.slice(-2).join('.').slice(0, USERNAME_MAX_LENGTH);
  return isValidUsername(vorschlag) ? vorschlag : '';
}

/** Formular "Gemeinde anlegen" in der Detailansicht einer Anfrage. */
export interface AnlegenFormular {
  name: string;
  kirchenkreisId: number | null;
  kontaktName: string;
  kontaktEmail: string;
  kontaktTelefon: string;
  /** Leer = unbegrenzt. */
  maxKonfis: string;
  testphase: boolean;
  adminUsername: string;
  adminDisplayName: string;
  adminEmail: string;
  adminPassword: string;
}

/** Das Formular aus der Anfrage vorbelegen. Das Passwort bleibt leer. */
export function anlegenVorbelegen(anfrage: GemeindeAnfrage, kirchenkreise: Kirchenkreis[]): AnlegenFormular {
  const kk = kirchenkreisFinden(anfrage.kirchenkreis, anfrage.landeskirche, kirchenkreise);
  return {
    name: anfrage.gemeinde ?? '',
    kirchenkreisId: kk ? kk.id : null,
    kontaktName: anfrage.kontakt_name ?? '',
    kontaktEmail: anfrage.email ?? '',
    kontaktTelefon: anfrage.mobil ?? '',
    maxKonfis: limitVorgabe(true),
    testphase: true,
    adminUsername: benutzernameVorschlag(anfrage.kontakt_name ?? ''),
    adminDisplayName: anfrage.kontakt_name ?? '',
    adminEmail: anfrage.email ?? '',
    adminPassword: '',
  };
}

/**
 * Testphase an oder aus. Das Limit folgt der Vorgabe (Testphase 5, sonst
 * unbegrenzt), solange es noch darauf steht; ein gewaehlter Tarif bleibt.
 */
export function testphaseUmschalten(f: AnlegenFormular, testphase: boolean): AnlegenFormular {
  return { ...f, testphase, maxKonfis: limitNachUmschalten(f.maxKonfis, f.testphase, testphase) };
}

const EMAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Gueltige E-Mail-Adresse (dieselbe grobe Pruefung wie im Formular "Gemeinde"). */
export const istEmail = (wert: string): boolean => EMAIL_MUSTER.test(wert.trim());

/**
 * Die Passwortregel des Servers (backend/utils/passwordUtils.js,
 * validatePassword) -- vorab, damit die Ablehnung nicht erst vom Server kommt.
 * Dieselben Texte wie im Formular "Gemeinde anlegen".
 */
export function passwortRegelFehler(pw: string): string | null {
  if (pw.length < 8) return 'Das Passwort muss mindestens 8 Zeichen lang sein';
  if (/\s/.test(pw)) return 'Das Passwort darf keine Leerzeichen enthalten';
  if (!/[A-Z]/.test(pw)) return 'Das Passwort muss einen Großbuchstaben enthalten';
  if (!/[a-z]/.test(pw)) return 'Das Passwort muss einen Kleinbuchstaben enthalten';
  if (!/[0-9]/.test(pw)) return 'Das Passwort muss eine Zahl enthalten';
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/~`]/.test(pw)) return 'Das Passwort muss ein Sonderzeichen enthalten';
  return null;
}

/**
 * Was am Formular fehlt, als ein Satz -- oder null, wenn es abgeschickt
 * werden kann.
 */
export function anlegenFehler(f: AnlegenFormular): string | null {
  if (!f.name.trim()) return 'Name der Gemeinde ist erforderlich';
  if (f.kontaktEmail.trim() && !istEmail(f.kontaktEmail)) return 'Ungültige E-Mail-Adresse';
  if (!f.adminUsername.trim() || !f.adminDisplayName.trim() || !f.adminPassword) {
    return 'Alle Felder der Gemeindeleitung sind erforderlich';
  }
  if (!isValidUsername(f.adminUsername.trim())) {
    return 'Benutzername darf nur Buchstaben, Zahlen, Punkt (.) und Bindestrich (-) enthalten — keine Leerzeichen oder Umlaute';
  }
  if (f.adminEmail.trim() && !istEmail(f.adminEmail)) return 'Ungültige E-Mail-Adresse';
  const limit = f.maxKonfis.trim();
  if (limit !== '' && !/^\d+$/.test(limit)) return 'Das Konfi-Limit muss eine Zahl ab 0 oder leer sein';
  return passwortRegelFehler(f.adminPassword);
}

/**
 * Koerper fuer POST /support/anfragen/:id/anlegen. `name` ist der
 * Systemname, wie POST /organizations ihn erwartet; `jetzt` nur fuer Tests.
 */
export function anlegenKoerper(f: AnlegenFormular, jetzt: Date = new Date()): AnfrageAnlegenDaten {
  const anzeigename = f.name.trim();
  const limit = f.maxKonfis.trim();
  const ende = f.testphase ? new Date(jetzt.getTime() + TESTPHASE_TAGE * 24 * 60 * 60 * 1000).toISOString() : null;
  return {
    name: systemnameAusAnzeigename(anzeigename),
    display_name: anzeigename,
    kirchenkreis_id: f.kirchenkreisId,
    contact_name: f.kontaktName.trim() || null,
    contact_email: f.kontaktEmail.trim() || null,
    contact_phone: f.kontaktTelefon.trim() || null,
    max_konfis: limit === '' ? null : Number(limit),
    trial_ends_at: ende,
    is_trial: f.testphase,
    admin_username: f.adminUsername.trim(),
    admin_display_name: f.adminDisplayName.trim(),
    admin_email: f.adminEmail.trim() || null,
    admin_password: f.adminPassword,
  };
}
