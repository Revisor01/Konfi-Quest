// Die fachliche Reihenfolge der Status-Spalten in den Tabellen der
// Web-Fassung (Simon, 08.10.2026: „umsetzen"). Ein Klick auf den Kopf einer
// Status-Spalte ordnet nach dem Ablauf, Offenes zuerst -- nicht nach dem
// angezeigten Wort. Vorbild waren Support (Vorgaenge, Gemeinden) und
// Rueckblick, die das schon taten; hier stehen die Reihen aller uebrigen
// Status-Spalten an EINER Stelle, damit Liste und Kachel derselben Sache
// nicht auseinanderlaufen und ein neues Wort nur hier eingeordnet wird.
//
// Jede Reihe gilt aufsteigend; der zweite Klick dreht sie um. Ein Wort, das
// (noch) in keiner Reihe steht, landet hinter den bekannten statt die Liste
// zu kippen (`nachReihe`).

import type { ChallengeStatus } from '../types/challenges';
import { nachReihe } from './tabelleSortieren';
import type { TeilnahmeStatusText } from './teilnahmeStatus';
import { STATUS_REIHE as VORGANG_STATUS_REIHE } from './supportVorgaenge';

/** Gemeldete Aktivitaeten (Antraege): offen, dann angerechnet/verbucht, dann abgelehnt. */
export const ANTRAG_STATUS_REIHE = ['pending', 'approved', 'rejected'] as const;
export const antragStatusRang = nachReihe<string>(ANTRAG_STATUS_REIHE);

/**
 * Status eines Events in den Listen von Leitung, Konfis und Team (die Woerter
 * aus utils/termineWeb.ts). Erst was zu tun ist (verbuchen), dann was offen
 * steht oder bevorsteht, dann was gelaufen ist, zuletzt Abgemeldetes und
 * Abgesagtes. Ein neues Wort in termineWeb.ts gehoert hier eingeordnet; der
 * Test statusReihenfolge.test.ts faellt sonst.
 */
export const TERMIN_STATUS_REIHE: readonly string[] = [
  'Verbuchen',
  'Offen',
  'Warteliste offen',
  'Warteliste',
  'Pflicht',
  'Pflicht-Event',
  'Konfirmation',
  'Angemeldet',
  'Dabei',
  'Ausstehend',
  'Bald',
  'Noch nicht offen',
  'Nur Info',
  'Event',
  'Ausgebucht',
  'Anderer Termin',
  'Geschlossen',
  'Anwesend',
  'Verbucht',
  'Gefehlt',
  'Abwesend',
  'Verpasst',
  'Vergangen',
  'Abgemeldet',
  'Abgesagt von dir',
  'Abgesagt',
];
export const terminStatusRang = nachReihe(TERMIN_STATUS_REIHE);

/** Zeitfenster eines Events: frei vor voll. */
export const ZEITFENSTER_STATUS_REIHE = ['Frei', 'Voll'] as const;
export const zeitfensterStatusRang = nachReihe<string>(ZEITFENSTER_STATUS_REIHE);

/**
 * Eine Zeile der Teilnehmerliste (utils/teilnahmeStatus.ts): erst ohne
 * verbuchte Anwesenheit (gebucht, Warteliste, selbst abgemeldet), dann
 * verbucht (anwesend, abwesend, Abmeldung nachgetragen).
 */
export const TEILNAHME_STATUS_REIHE: readonly TeilnahmeStatusText[] = [
  'Gebucht',
  'Warteliste',
  'Abgemeldet',
  'Anwesend',
  'Abwesend',
  'Abgemeldet (nachgetragen)',
];
export const teilnahmeStatusRang = nachReihe(TEILNAHME_STATUS_REIHE);

/** Events der Konfi-Zeit (utils/konfiZeit.ts): wie die Teilnahme, Abgesagtes zuletzt. */
export const KONFI_ZEIT_STATUS_REIHE: readonly string[] = [
  'Angemeldet',
  'Warteliste',
  'Dabei',
  'Punkte erhalten',
  'Nicht da',
  'Abgemeldet',
  'Abgesagt',
];
export const konfiZeitStatusRang = nachReihe(KONFI_ZEIT_STATUS_REIHE);

/** Challenges: laeuft, geplant, Entwurf, beendet. */
export const CHALLENGE_STATUS_REIHE: readonly ChallengeStatus[] = ['active', 'scheduled', 'draft', 'ended'];
export const challengeStatusRang = nachReihe(CHALLENGE_STATUS_REIHE);

/** Konten (Benutzer:innen der Gemeinde, Konten im Support): aktiv vor gesperrt. */
export const kontoStatusRang = (aktiv: boolean | null | undefined): number => (aktiv === false ? 1 : 0);

/** Badges: aktiv vor inaktiv, darin sichtbar vor geheim. */
export const badgeStatusRang = (b: { is_active?: boolean | null; is_hidden?: boolean | null }): number =>
  (b.is_active ? 0 : 2) + (b.is_hidden ? 1 : 0);

/** Konfispruch eines Jahrgangs: frei vor gesperrt. */
export const konfispruchStatusRang = (frei: boolean): number => (frei ? 0 : 1);

/** Support-Vorgaenge: die Reihe aller Auswahlen (neu, in Arbeit, wartet, erledigt). */
export const vorgangStatusRang = nachReihe<string>(VORGANG_STATUS_REIHE);
