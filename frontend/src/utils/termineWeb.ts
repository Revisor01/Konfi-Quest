// Die Regeln hinter der Web-Fassung von Mitmachen (Events), 03.10.2026
// (docs/planung/web-alle-bereiche.md, Entscheidung 6).
//
// Die Web-Fassung zeigt dieselben Daten wie die App -- GET /events,
// /konfi/events, /events/:id --, nur breiter: Tabelle bei der Leitung, Karten
// im Raster bei Konfis und Team. Was ein Event im Status heisst, welche
// Zahlen auf einer Karte stehen und welche Angaben im Detail erscheinen,
// entscheiden in der App die drei Listen und drei Detailansichten (admin/
// EventsView, konfi/views/EventsView, TeamerEventsPage, jeweils mit ihrer
// Detailansicht) -- mitten im Render. Hier steht dieselbe Rechnung als
// Funktionen, damit die Web-Fassung sie ohne Render aufrufen und testen kann.
//
// Die Stellen der App bleiben unveraendert (Tests lesen ihren Quelltext). Dass
// beide nicht auseinanderlaufen, pruefen die Tests __tests__/components/
// termineWeb/web*WieApp.test.tsx: Sie rendern die App-Ansichten und die Web-
// Fassung fuer eine Matrix aus Zustaenden und vergleichen Status, Zahlen und
// Angaben.
//
// Ein bevorstehender Pflicht-Event heisst in App und Web "Pflicht" (bis
// 03.10.2026 sagte die App dort faelschlich "Geschlossen").

import type { Event, EventMaterial, Participant } from '../types/event';
import {
  istAbgesagt,
  istVergangen,
  kategorienText,
  punkteartText,
  zeigtPunkteart,
  zeitraumText,
  formatEventDate,
  formatEventTime,
} from '../components/shared/eventFormatting';
import { datumKurz } from './dateUtils';
import { suchTreffer, type PillTon } from './supportWeb';

// ---------------------------------------------------------------------------
// Status eines Events: Text, Farbe, Ton der Marke
// ---------------------------------------------------------------------------

/** Die Farb-Tokens der Status (variables.css) -- als Wert fuer var(), nicht als Farbwert. */
export const STATUS_FARBE = {
  danger: 'var(--app-color-danger)',
  success: 'var(--app-color-success)',
  bonus: 'var(--app-color-bonus)',
  info: 'var(--app-color-info)',
  konfis: 'var(--app-color-konfis)',
  events: 'var(--app-color-events)',
  teamer: 'var(--app-color-teamer)',
  vorbei: 'var(--app-color-neutral)',
  neutral: 'var(--app-color-neutral-hell)',
} as const;

export type StatusFarbe = (typeof STATUS_FARBE)[keyof typeof STATUS_FARBE];

export interface TerminStatus {
  /** Das Wort, wie es die App im Eck-Badge und im Kopf nennt ("Offen", "Abgesagt"). */
  text: string;
  farbe: StatusFarbe;
  /** Ton der Marke (WebPill). */
  ton: PillTon;
}

/** Ton der Marke aus der Farbe des Status: Rot fehler, Gruen erfolg, Orange warnung, Blau info, sonst neutral. */
export function statusTon(farbe: StatusFarbe): PillTon {
  switch (farbe) {
    case STATUS_FARBE.danger:
    case STATUS_FARBE.events:
      return 'fehler';
    case STATUS_FARBE.success:
    case STATUS_FARBE.teamer:
      return 'erfolg';
    case STATUS_FARBE.bonus:
      return 'warnung';
    case STATUS_FARBE.info:
    case STATUS_FARBE.konfis:
      return 'info';
    default:
      return 'neutral';
  }
}

const mitTon = (text: string, farbe: StatusFarbe): TerminStatus => ({ text, farbe, ton: statusTon(farbe) });

/** Ist der Termin voll? max_participants = 0 heisst unbegrenzt -- nie voll. */
const istVoll = (e: Pick<Event, 'max_participants' | 'registered_count'>): boolean =>
  (e.max_participants || 0) > 0 && (e.registered_count || 0) >= e.max_participants;

// --- Leitung, Liste (admin/EventsView.tsx) --------------------------------

export interface LeitungListeStatus extends TerminStatus {
  istVergangen: boolean;
  /** Vergangen und nichts mehr zu verbuchen: die Zeile steht gedaempft da. */
  gedaempft: boolean;
  /** Vergangen und es gibt noch Buchungen ohne Anwesenheit. */
  zuVerbuchen: boolean;
}

export function leitungListeStatus(event: Event, jetzt: Date = new Date()): LeitungListeStatus {
  const vorbei = istVergangen(event, jetzt);
  const abgesagt = istAbgesagt(event);
  const konfirmation = event.is_konfirmation === true;
  // Befund 3 (25.08.2026): Karte und Verbuchen-Reiter fragen dasselbe -- gibt
  // es hier Buchungen, und ist davon etwas offen?
  const hatBuchungen = (event.registered_count || 0) > 0 || (event.teamer_count || 0) > 0;
  const zuVerbuchen = vorbei && hatBuchungen && !!event.pending_bookings_count && event.pending_bookings_count > 0;
  const verbucht = vorbei && hatBuchungen && (!event.pending_bookings_count || event.pending_bookings_count === 0);
  const gedaempft = vorbei && !zuVerbuchen;
  const reg = event.registration_status;
  const anmeldbar = reg === 'open' || reg === 'mandatory';
  const voll = istVoll(event);

  let farbe: StatusFarbe;
  if (abgesagt) farbe = STATUS_FARBE.danger;
  else if (event.mandatory && vorbei && zuVerbuchen) farbe = STATUS_FARBE.info;
  else if (event.mandatory && vorbei) farbe = STATUS_FARBE.vorbei;
  else if (konfirmation && !vorbei) farbe = STATUS_FARBE.konfis;
  else if (verbucht) farbe = STATUS_FARBE.vorbei;
  else if (zuVerbuchen) farbe = STATUS_FARBE.info;
  else if (vorbei) farbe = STATUS_FARBE.vorbei;
  else if (anmeldbar && voll && event.waitlist_enabled) farbe = STATUS_FARBE.bonus;
  else if (anmeldbar && voll) farbe = STATUS_FARBE.danger;
  else if (anmeldbar) farbe = STATUS_FARBE.success;
  else if (reg === 'upcoming') farbe = STATUS_FARBE.bonus;
  else farbe = STATUS_FARBE.danger;

  let text: string;
  if (abgesagt) text = 'Abgesagt';
  else if (zuVerbuchen) text = 'Verbuchen';
  else if (verbucht) text = 'Verbucht';
  // Pflicht-Event, noch nicht vorbei (siehe oben).
  else if (reg === 'mandatory' && !vorbei) text = 'Pflicht';
  else if (reg === 'open' && voll && event.waitlist_enabled) text = 'Warteliste';
  else if (reg === 'open' && voll) text = 'Ausgebucht';
  else if (reg === 'open') text = 'Offen';
  else if (reg === 'upcoming') text = 'Bald';
  else text = 'Geschlossen';

  return { ...mitTon(text, farbe), istVergangen: vorbei, gedaempft, zuVerbuchen };
}

// --- Leitung, Detail (admin/views/EventDetailView.tsx) ---------------------

/** Das Kontingent, das zaehlt: bei Team-Events das der Teamer:innen, sonst registration_status. */
function leitungAnmeldeStatus(event: Event): Event['registration_status'] {
  const nurTeam = !!(event.teamer_only || event.teamer_needed);
  if (nurTeam && event.teamer_registration_status && event.teamer_registration_status !== 'none') {
    const t = event.teamer_registration_status;
    return t === 'waitlist' ? 'open' : t;
  }
  return event.registration_status;
}

export function leitungDetailStatus(
  event: Event,
  teilnehmende: readonly Pick<Participant, 'status' | 'attendance_status'>[],
  jetzt: Date = new Date(),
): TerminStatus {
  const vorbei = istVergangen(event, jetzt);
  const konfirmation = event.is_konfirmation;
  const abgesagt = istAbgesagt(event);
  const zuVerbuchen = vorbei && event.registered_count > 0
    && teilnehmende.some((p) => p.status === 'confirmed' && !p.attendance_status);
  const reg = leitungAnmeldeStatus(event);
  const voll = istVoll(event);

  let farbe: StatusFarbe;
  if (abgesagt) farbe = STATUS_FARBE.danger;
  else if (konfirmation && !vorbei) farbe = STATUS_FARBE.konfis;
  else if (zuVerbuchen) farbe = STATUS_FARBE.info;
  else if (vorbei) farbe = STATUS_FARBE.vorbei;
  else if (reg === 'mandatory') farbe = STATUS_FARBE.events;
  else if (voll && event.waitlist_enabled) farbe = STATUS_FARBE.bonus;
  else if (voll) farbe = STATUS_FARBE.danger;
  else if (reg === 'open') farbe = STATUS_FARBE.success;
  else if (reg === 'upcoming') farbe = STATUS_FARBE.bonus;
  else farbe = STATUS_FARBE.events;

  let text: string;
  if (abgesagt) text = 'Abgesagt';
  else if (konfirmation && !vorbei) text = 'Konfirmation';
  else if (zuVerbuchen) text = 'Verbuchen';
  else if (vorbei) text = 'Verbucht';
  else if (reg === 'mandatory') text = 'Pflicht-Event';
  else if (voll && event.waitlist_enabled) text = 'Warteliste';
  else if (voll) text = 'Ausgebucht';
  else if (reg === 'open') text = 'Offen';
  else if (reg === 'upcoming') text = 'Bald';
  else if (reg === 'closed') text = 'Geschlossen';
  // Kein Status vom Backend: neutral bleiben statt "Geschlossen" zu behaupten.
  else text = 'Event';

  return mitTon(text, farbe);
}

// --- Konfi, Liste (konfi/views/EventsView.tsx) ------------------------------

export interface KonfiListeStatus extends TerminStatus {
  istVergangen: boolean;
  /** Vergangen, nicht teilgenommen: die Karte steht gedaempft da. */
  gedaempft: boolean;
  /** Ein anderer Konfirmationstermin ist schon gebucht: dieser ist gesperrt. */
  gesperrt: boolean;
  /** Zeigt die Karte ihr Status-Zeichen? Vergangene ohne Teilnahme nicht. */
  zeigtStatus: boolean;
}

export function konfiListeStatus(event: Event, hatKonfirmationGebucht: boolean, jetzt: Date = new Date()): KonfiListeStatus {
  const vorbei = istVergangen(event, jetzt);
  const teilgenommen = vorbei && !!event.is_registered;
  const anwesenheit = event.attendance_status;
  // Warteliste: booking_status kann 'waitlist' oder 'pending' sein.
  const aufWarteliste = event.booking_status === 'waitlist' || event.booking_status === 'pending';
  const abgesagt = istAbgesagt(event);
  const konfirmation = event.is_konfirmation;
  const ausstehend = vorbei && !!event.is_registered && !aufWarteliste && !anwesenheit;
  const pflicht = event.mandatory;
  const abgemeldet = !!event.is_opted_out || event.booking_status === 'opted_out';
  // Von der Leitung abgemeldet (Migration 153).
  const ausgetragen = event.booking_status === 'excused' && !vorbei;
  const voll = istVoll(event);
  const reg = event.registration_status;

  let farbe: StatusFarbe;
  if (abgesagt) farbe = STATUS_FARBE.danger;
  else if (pflicht && abgemeldet) farbe = STATUS_FARBE.events;
  else if (ausgetragen) farbe = STATUS_FARBE.events;
  else if (pflicht && vorbei && anwesenheit === 'present') farbe = STATUS_FARBE.success;
  else if (pflicht && vorbei && anwesenheit === 'absent') farbe = STATUS_FARBE.danger;
  else if (pflicht && vorbei) farbe = STATUS_FARBE.bonus;
  else if (pflicht && !vorbei && (event.is_registered || teilgenommen)) farbe = STATUS_FARBE.info;
  else if (pflicht && !vorbei && voll && event.waitlist_enabled) farbe = STATUS_FARBE.bonus;
  else if (pflicht && !vorbei && voll) farbe = STATUS_FARBE.danger;
  else if (pflicht && !vorbei) farbe = STATUS_FARBE.success;
  else if (konfirmation && !vorbei) farbe = STATUS_FARBE.konfis;
  else if (teilgenommen && anwesenheit === 'present') farbe = STATUS_FARBE.success;
  else if (teilgenommen && anwesenheit === 'absent') farbe = STATUS_FARBE.danger;
  else if (ausstehend) farbe = STATUS_FARBE.bonus;
  else if (aufWarteliste) farbe = STATUS_FARBE.bonus;
  else if (event.is_registered && !vorbei) farbe = STATUS_FARBE.info;
  else if (vorbei) farbe = STATUS_FARBE.vorbei;
  else if (reg === 'open' && voll && event.waitlist_enabled) farbe = STATUS_FARBE.bonus;
  else if (reg === 'open' && voll) farbe = STATUS_FARBE.danger;
  else if (reg === 'open') farbe = STATUS_FARBE.success;
  else if (reg === 'upcoming') farbe = STATUS_FARBE.bonus;
  else farbe = STATUS_FARBE.danger;

  let text: string;
  if (abgesagt) text = 'Abgesagt';
  else if (pflicht && abgemeldet) text = 'Abgemeldet';
  else if (ausgetragen) text = 'Abgemeldet';
  else if (pflicht && vorbei && anwesenheit === 'present') text = 'Anwesend';
  else if (pflicht && vorbei && anwesenheit === 'absent') text = 'Gefehlt';
  else if (pflicht && vorbei) text = 'Ausstehend';
  else if (pflicht) text = 'Angemeldet';
  else if (konfirmation && !vorbei && event.is_registered) text = 'Angemeldet';
  else if (konfirmation && !vorbei) text = 'Offen';
  else if (teilgenommen && anwesenheit === 'present') text = 'Verbucht';
  else if (teilgenommen && anwesenheit === 'absent') text = 'Verpasst';
  else if (ausstehend) text = 'Ausstehend';
  else if (aufWarteliste) text = `Warteliste (${event.waitlist_position || '?'})`;
  else if (event.is_registered && !vorbei) text = 'Angemeldet';
  else if (reg === 'open' && voll && event.waitlist_enabled) text = 'Warteliste';
  else if (reg === 'open' && voll) text = 'Ausgebucht';
  else if (reg === 'open') text = 'Offen';
  else if (reg === 'upcoming') text = 'Bald';
  else if (vorbei) text = 'Vergangen';
  else text = 'Geschlossen';

  // Konfirmations-Sperre: ein anderer Konfirmationstermin ist schon gebucht.
  const gesperrt = !!konfirmation && hatKonfirmationGebucht && !event.is_registered && !vorbei;
  if (gesperrt) text = 'Anderer Termin';

  const gedaempft = vorbei && !teilgenommen && !ausstehend;
  const zeigtStatus = !vorbei || teilgenommen || abgesagt || abgemeldet || gesperrt;
  return { ...mitTon(text, farbe), istVergangen: vorbei, gedaempft, gesperrt, zeigtStatus };
}

// --- Konfi, Detail (konfi/views/EventDetailView.tsx) -------------------------

export function konfiDetailStatus(event: Event, jetzt: Date = new Date()): TerminStatus {
  const vorbei = istVergangen(event, jetzt);
  const konfirmation = event.is_konfirmation === true;
  const aufWarteliste = event.booking_status === 'waitlist' || event.booking_status === 'pending';
  const ausstehend = vorbei && !!event.is_registered && !aufWarteliste && !event.attendance_status;
  const voll = istVoll(event);
  const reg = event.registration_status;

  let farbe: StatusFarbe;
  if (istAbgesagt(event)) farbe = STATUS_FARBE.danger;
  else if (event.is_opted_out || event.booking_status === 'opted_out') farbe = STATUS_FARBE.events;
  else if (event.booking_status === 'excused' && !vorbei) farbe = STATUS_FARBE.events;
  else if (konfirmation && !vorbei) farbe = STATUS_FARBE.info;
  else if (vorbei && event.attendance_status === 'present') farbe = STATUS_FARBE.success;
  else if (vorbei && event.attendance_status === 'absent') farbe = STATUS_FARBE.danger;
  else if (ausstehend) farbe = STATUS_FARBE.bonus;
  else if (aufWarteliste) farbe = STATUS_FARBE.bonus;
  else if (event.is_registered && !vorbei) farbe = STATUS_FARBE.info;
  else if (vorbei) farbe = STATUS_FARBE.vorbei;
  else if (reg === 'open' && voll && event.waitlist_enabled) farbe = STATUS_FARBE.bonus;
  else if (reg === 'open' && voll) farbe = STATUS_FARBE.danger;
  else if (reg === 'open') farbe = STATUS_FARBE.success;
  else if (reg === 'upcoming') farbe = STATUS_FARBE.bonus;
  else farbe = STATUS_FARBE.events;

  let text: string;
  if (istAbgesagt(event)) text = 'Abgesagt';
  else if (event.is_opted_out || event.booking_status === 'opted_out') text = 'Abgemeldet';
  else if (event.booking_status === 'excused' && !vorbei) text = 'Abgemeldet';
  else if (konfirmation && !vorbei) text = event.is_registered ? 'Angemeldet' : 'Konfirmation';
  else if (vorbei && event.attendance_status === 'present') text = 'Verbucht';
  else if (vorbei && event.attendance_status === 'absent') text = 'Verpasst';
  else if (ausstehend) text = 'Ausstehend';
  else if (aufWarteliste) text = `Warteliste (${event.waitlist_position || '?'})`;
  else if (event.is_registered && !vorbei) text = 'Angemeldet';
  else if (vorbei) text = 'Vergangen';
  else if (reg === 'open' && voll && event.waitlist_enabled) text = 'Warteliste';
  else if (reg === 'open' && voll) text = 'Ausgebucht';
  else if (reg === 'open') text = 'Offen';
  else if (reg === 'upcoming') text = 'Bald';
  else text = 'Geschlossen';

  return mitTon(text, farbe);
}

// --- Team, Liste (teamer/pages/TeamerEventsPage.tsx, getEventStatusInfo) ------

export interface TeamListeStatus extends TerminStatus {
  istVergangen: boolean;
  gedaempft: boolean;
  zeigtStatus: boolean;
}

/** Darf sich das Team zu diesem Event anmelden? Nur bei "Team gesucht" und "Nur Team". */
export const teamKannSichAnmelden = (event: Pick<Event, 'teamer_needed' | 'teamer_only'>): boolean =>
  !!(event.teamer_needed || event.teamer_only);

export function teamListeStatus(event: Event, jetzt: Date = new Date()): TeamListeStatus {
  const vorbei = istVergangen(event, jetzt);
  const kannAnmelden = teamKannSichAnmelden(event);
  const aufWarteliste = event.booking_status === 'waitlist' || event.booking_status === 'pending';

  // Vorgabe: reines Konfi-Event, zu dem das Team sich NICHT anmelden kann --
  // neutral ("Nur Info"), damit keine Anmeldung nahegelegt wird.
  let status: TerminStatus = mitTon('Nur Info', STATUS_FARBE.neutral);
  if (istAbgesagt(event)) status = mitTon('Abgesagt', STATUS_FARBE.danger);
  else if (vorbei && event.is_registered) {
    if (event.attendance_status === 'present') status = mitTon('Anwesend', STATUS_FARBE.success);
    else if (event.attendance_status === 'absent') status = mitTon('Abwesend', STATUS_FARBE.danger);
    else status = mitTon('Ausstehend', STATUS_FARBE.bonus);
  } else if (aufWarteliste) status = mitTon('Warteliste', STATUS_FARBE.bonus);
  else if (event.is_registered && !vorbei) status = mitTon('Dabei', STATUS_FARBE.info);
  else if (vorbei) status = mitTon('Vergangen', STATUS_FARBE.vorbei);
  else if (event.booking_status === 'opted_out') status = mitTon('Abgesagt von dir', STATUS_FARBE.danger);
  else if (kannAnmelden && event.teamer_registration_status === 'closed') status = mitTon('Ausgebucht', STATUS_FARBE.danger);
  else if (kannAnmelden && event.teamer_registration_status === 'waitlist') status = mitTon('Warteliste offen', STATUS_FARBE.bonus);
  else if (kannAnmelden && event.teamer_registration_status === 'upcoming') status = mitTon('Noch nicht offen', STATUS_FARBE.neutral);
  else if (kannAnmelden) status = mitTon('Offen', STATUS_FARBE.teamer);

  return {
    ...status,
    istVergangen: vorbei,
    gedaempft: vorbei && !event.is_registered,
    zeigtStatus: !vorbei || !!event.is_registered,
  };
}

// --- Team, Detail (TeamerEventsPage, getStatusText/getStatusColors) ------------

export function teamDetailStatus(event: Event, jetzt: Date = new Date()): TerminStatus {
  const vorbei = istVergangen(event, jetzt);
  const aufWarteliste = event.booking_status === 'waitlist' || event.booking_status === 'pending';
  const kannAnmelden = teamKannSichAnmelden(event);

  let farbe: StatusFarbe;
  if (istAbgesagt(event)) farbe = STATUS_FARBE.danger;
  else if (vorbei && event.attendance_status === 'present') farbe = STATUS_FARBE.success;
  else if (vorbei && event.attendance_status === 'absent') farbe = STATUS_FARBE.danger;
  else if (vorbei && event.is_registered && !event.attendance_status) farbe = STATUS_FARBE.bonus;
  else if (aufWarteliste) farbe = STATUS_FARBE.bonus;
  else if (event.is_registered && !vorbei) farbe = STATUS_FARBE.info;
  else if (vorbei) farbe = STATUS_FARBE.vorbei;
  else if (event.booking_status === 'opted_out') farbe = STATUS_FARBE.danger;
  else if (event.registration_status === 'open') farbe = kannAnmelden ? STATUS_FARBE.teamer : STATUS_FARBE.neutral;
  else farbe = STATUS_FARBE.neutral;

  let text: string;
  if (istAbgesagt(event)) text = 'Abgesagt';
  else if (vorbei && event.attendance_status === 'present') text = 'Anwesend';
  else if (vorbei && event.attendance_status === 'absent') text = 'Abwesend';
  else if (vorbei && event.is_registered && !event.attendance_status) text = 'Ausstehend';
  else if (aufWarteliste) text = 'Warteliste';
  else if (event.is_registered && !vorbei) text = 'Dabei';
  else if (vorbei) text = 'Vergangen';
  else if (event.booking_status === 'opted_out') text = 'Abgesagt von dir';
  else if (event.registration_status === 'open') text = kannAnmelden ? 'Offen' : 'Nur Info';
  else text = 'Geschlossen';

  return mitTon(text, farbe);
}

// ---------------------------------------------------------------------------
// Zahlen und Angaben auf Karten und in Zeilen
// ---------------------------------------------------------------------------

export type FaktArt = 'plaetze' | 'team' | 'warteliste' | 'teamWarteliste' | 'punkte' | 'punkteart';

export interface Fakt {
  art: FaktArt;
  text: string;
  /** Bei art 'punkteart': Gottesdienst oder Gemeinde (das Symbol folgt daraus). */
  punkteart?: 'gottesdienst' | 'gemeinde';
}

const unendlich = '∞';
const maxText = (max: number | undefined | null): string => ((max || 0) > 0 ? String(max) : unendlich);

/** Leitung (admin/EventsView): Plaetze, Team, Warteliste, Punkte und Art. */
export function leitungFakten(event: Event): Fakt[] {
  const fakten: Fakt[] = [];
  if (!event.teamer_only) {
    fakten.push({
      art: 'plaetze',
      text: event.mandatory
        ? `${event.registered_count || 0} Konfis`
        : `${event.registered_count || 0}/${maxText(event.max_participants)}`,
    });
  }
  if (event.teamer_only || event.teamer_needed) {
    fakten.push({ art: 'team', text: `${event.teamer_count || 0}/${maxText(event.teamer_max_participants)} Team` });
  }
  if (event.waitlist_enabled && (event.waitlist_count ?? 0) > 0) {
    fakten.push({ art: 'warteliste', text: `${event.waitlist_count}/${event.max_waitlist_size || 10}` });
  }
  // Bei reinen Team-Events gibt es keine Punkte.
  if (event.points > 0 && !event.teamer_only) fakten.push({ art: 'punkte', text: `${event.points}P` });
  if (zeigtPunkteart(event)) {
    fakten.push({ art: 'punkteart', text: punkteartText(event), punkteart: event.point_type === 'gottesdienst' ? 'gottesdienst' : 'gemeinde' });
  }
  return fakten;
}

/** Konfi (konfi/views/EventsView): Plaetze, Warteliste, Punkte und Art. */
export function konfiFakten(event: Event): Fakt[] {
  const fakten: Fakt[] = [];
  if (!event.mandatory) {
    fakten.push({ art: 'plaetze', text: `${event.registered_count || 0}/${maxText(event.max_participants)}` });
  }
  if (event.waitlist_enabled && (event.waitlist_count ?? 0) > 0) {
    fakten.push({ art: 'warteliste', text: `${event.waitlist_count}/${event.max_waitlist_size || 10}` });
  }
  if (event.points > 0) fakten.push({ art: 'punkte', text: `${event.points}P` });
  if (zeigtPunkteart(event)) {
    fakten.push({ art: 'punkteart', text: punkteartText(event), punkteart: event.point_type === 'gottesdienst' ? 'gottesdienst' : 'gemeinde' });
  }
  return fakten;
}

/** Team (TeamerEventsPage): bei "Nur Team" erzaehlt die Karte vom Team, sonst von Konfis und Team. */
export function teamFakten(event: Event): Fakt[] {
  const fakten: Fakt[] = [];
  if (event.teamer_only) {
    fakten.push({ art: 'team', text: `${Math.max(0, event.teamer_count || 0)}/${maxText(event.teamer_max_participants)} Team` });
    if ((event.teamer_waitlist_count ?? 0) > 0) {
      fakten.push({
        art: 'teamWarteliste',
        text: `${event.teamer_waitlist_count}${(event.teamer_max_waitlist_size || 0) > 0 ? `/${event.teamer_max_waitlist_size}` : ''}`,
      });
    }
    return fakten;
  }
  fakten.push({ art: 'plaetze', text: `${Math.max(0, event.registered_count || 0)}/${maxText(event.max_participants)}` });
  if (event.teamer_count !== undefined && event.teamer_count > 0) {
    fakten.push({ art: 'team', text: `${event.teamer_count} Team` });
  }
  if ((event.teamer_waitlist_count ?? 0) > 0) {
    fakten.push({
      art: 'teamWarteliste',
      text: `${event.teamer_waitlist_count}${(event.teamer_max_waitlist_size || 0) > 0 ? `/${event.teamer_max_waitlist_size}` : ''} wartet`,
    });
  }
  if (event.points > 0) fakten.push({ art: 'punkte', text: `${event.points}P` });
  if (zeigtPunkteart(event)) {
    fakten.push({ art: 'punkteart', text: punkteartText(event), punkteart: event.point_type === 'gottesdienst' ? 'gottesdienst' : 'gemeinde' });
  }
  return fakten;
}

/**
 * Wann ein Event stattfindet, kurz: Datum mit Wochentag und die Uhrzeit.
 * Ein Event ueber mehrere Tage nennt das Ende mit Datum.
 *   Sa., 14.11.2026   10:00 – 12:00
 *   Fr., 20.11.2026   16:30 – So., 22.11.2026, 12:30
 */
export function zeitspanneKurz(event: Pick<Event, 'event_date' | 'event_end_time'>): { datum: string; zeit: string } {
  const datum = datumKurz(event.event_date, { mitWochentag: true });
  const beginn = formatEventTime(event.event_date);
  if (!event.event_end_time) return { datum, zeit: beginn };
  const endeTag = datumKurz(event.event_end_time, { mitWochentag: true });
  const ende = formatEventTime(event.event_end_time);
  if (endeTag === datum) return { datum, zeit: `${beginn} – ${ende}` };
  return { datum, zeit: `${beginn} – ${endeTag}, ${ende}` };
}

/** Der Zeitpunkt auf einer Karte: "14.11.2026" und "10:00". */
export const terminDatumUhrzeit = (event: Pick<Event, 'event_date'>): { datum: string; uhrzeit: string } => ({
  datum: formatEventDate(event.event_date),
  uhrzeit: formatEventTime(event.event_date),
});

// ---------------------------------------------------------------------------
// Detail: die Angaben (Datum, Anmeldung, Plaetze, Punkte, Ort ...)
// ---------------------------------------------------------------------------

export type AngabenRolle = 'leitung' | 'konfi' | 'team';

/** Eine Zeile der Angaben: Bezeichnung, ein oder mehrere Texte, ggf. ein Link (Ort, Material). */
export interface TerminAngabe {
  label: string;
  zeilen: string[];
  /** Der Ort fuehrt zur Karte. */
  ortLink?: string;
  /** Das Material springt zum Abschnitt (oder oeffnet das einzelne Material). */
  materialSprung?: boolean;
}

/** Das Zeitfenster eines Events mit Belegung (GET /events/:id, /events/:id/timeslots). */
export interface DetailZeitfenster {
  id?: number;
  start_time: string;
  end_time: string;
  max_participants: number;
  registered_count?: number;
  waitlist_count?: number;
}

/** Link zur Karte: die eingetragene Adresse, sonst die Suche nach dem Ort. Nur http(s) kommt in Frage. */
export function ortKartenLink(ort: { location?: string | null; location_maps_url?: string | null }): string | null {
  const eigener = (ort.location_maps_url || '').trim();
  if (/^https?:\/\//i.test(eigener)) return eigener;
  if (ort.location) return `https://maps.apple.com/?q=${encodeURIComponent(ort.location)}`;
  return null;
}

const zeitText = (wert: string | undefined): string => formatEventTime(wert || '');

/** "von 01.11.2026 – 10:00" / "bis ..." oder "Sofort möglich". */
function anmeldungZeilen(event: Pick<Event, 'registration_opens_at' | 'registration_closes_at'>): string[] {
  if (!event.registration_opens_at) return ['Sofort möglich'];
  const zeilen = [`von ${datumKurz(event.registration_opens_at)} – ${zeitText(event.registration_opens_at)}`];
  if (event.registration_closes_at) zeilen.push(`bis ${datumKurz(event.registration_closes_at)} – ${zeitText(event.registration_closes_at)}`);
  return zeilen;
}

function zeitfensterZeilen(slots: readonly DetailZeitfenster[]): string[] {
  return slots.map((s) => {
    const wartend = (s.waitlist_count || 0) > 0 ? ` · ${s.waitlist_count} Warteliste` : '';
    return `${zeitText(s.start_time)} – ${zeitText(s.end_time)} (${s.registered_count || 0}/${s.max_participants} TN${wartend})`;
  });
}

export interface AngabenKontext {
  rolle: AngabenRolle;
  /** Teilnehmerliste (nur Leitung): Zahlen von Konfis und Team. */
  teilnehmende?: readonly Participant[];
  zeitfenster?: readonly DetailZeitfenster[];
  materialien?: readonly Pick<EventMaterial, 'id' | 'title'>[];
}

/**
 * Die Angaben zu einem Event -- dieselben Zeilen in derselben Reihenfolge wie
 * die drei Detailansichten der App. Je Rolle gilt die Regel dieser Ansicht;
 * wo sich die Ansichten unterscheiden, steht es dabei.
 */
export function terminAngaben(event: Event & { jahrgaenge?: Array<{ name: string }> }, kontext: AngabenKontext): TerminAngabe[] {
  const { rolle } = kontext;
  const teilnehmende = kontext.teilnehmende ?? [];
  const zeitfenster = kontext.zeitfenster ?? [];
  const materialien = kontext.materialien ?? [];
  const zeilen: TerminAngabe[] = [];
  // Konfis sehen nie ein Event nur fuers Team; die Regel der Ansicht kennt dort keinen Zusatz.
  const keinePunkte = event.mandatory || (rolle !== 'konfi' && event.teamer_only) || event.is_konfirmation || (event.points || 0) <= 0;
  const teamErlaubt = !!(event.teamer_needed || event.teamer_only);

  zeilen.push({ label: 'Datum', zeilen: [zeitraumText({ event_date: event.event_date || '', event_end_time: event.event_end_time })] });

  // Das Team zaehlt das Kontingent vor den Zeitfenstern, Leitung und Konfi danach.
  if (rolle === 'team' && !event.teamer_only) {
    zeilen.push({ label: 'Teilnehmer:innen', zeilen: [`${event.registered_count || 0} / ${maxText(event.max_participants)}`] });
  }

  if (event.has_timeslots && zeitfenster.length > 0) {
    const eigene: string[] = zeitfensterZeilen(zeitfenster);
    if (rolle === 'konfi') {
      if (event.is_registered && event.booked_timeslot_start) {
        eigene.push(`Dein Slot: ${zeitText(event.booked_timeslot_start)}${event.booked_timeslot_end ? ` - ${zeitText(event.booked_timeslot_end)}` : ''}`);
      }
      if (event.booking_status === 'waitlist' && event.booked_timeslot_start) {
        eigene.push(`Auf der Warteliste für ${zeitText(event.booked_timeslot_start)}${event.booked_timeslot_end ? ` - ${zeitText(event.booked_timeslot_end)}` : ''}`);
      }
    }
    zeilen.push({ label: 'Zeitfenster', zeilen: eigene });
  }

  if (!event.mandatory) {
    const anmeldung = anmeldungZeilen(event);
    // Die Abmeldefrist steht nur bei der Leitung; nicht bei "Nur Team" (dort gibt es keine Konfis).
    if (rolle === 'leitung' && !event.teamer_only) anmeldung.push('Konfis können sich bis 2 Tage vorher selbst abmelden');
    zeilen.push({ label: 'Anmeldung', zeilen: anmeldung });
  }

  if (rolle === 'leitung') {
    const konfis = teilnehmende.filter((p) => p.role_name === 'konfi');
    const team = teilnehmende.filter((p) => p.role_name !== 'konfi');
    const teamBestaetigt = team.filter((p) => p.status === 'confirmed');
    const konfiBestaetigt = konfis.filter((p) => p.status === 'confirmed').length;
    const konfiAbgemeldet = konfis.filter((p) => p.status === 'opted_out').length;
    const konfiDa = konfis.filter((p) => p.attendance_status === 'present').length;
    const teamMax = event.teamer_max_participants || 0;
    const teamWartend = event.teamer_waitlist_count !== undefined
      ? event.teamer_waitlist_count
      : team.filter((p) => p.status === 'waitlist').length;

    if (!event.teamer_only) {
      zeilen.push({
        label: 'Teilnehmer:innen',
        zeilen: [event.mandatory
          ? `${konfiBestaetigt} / ${konfiBestaetigt + konfiAbgemeldet}`
          : `${konfiBestaetigt} / ${maxText(event.max_participants)}`],
      });
      // Anwesenheit als eigene Zeile, erst wenn jemand erfasst wurde.
      if (konfiDa > 0) zeilen.push({ label: 'Anwesend', zeilen: [`${konfiDa} / ${konfiBestaetigt}`] });
    }
    if (teamErlaubt) {
      zeilen.push({ label: 'Team', zeilen: [`${teamBestaetigt.length} / ${teamMax > 0 ? teamMax : unendlich}`] });
      if (event.teamer_waitlist_enabled && teamMax > 0) {
        zeilen.push({ label: 'Team-Warteliste', zeilen: [`${teamWartend} / ${event.teamer_max_waitlist_size || 10}`] });
      }
    }
    if (event.waitlist_enabled && !event.teamer_only && (event.max_participants || 0) > 0) {
      zeilen.push({
        label: 'Warteliste',
        zeilen: [`${konfis.filter((p) => p.status === 'waitlist').length} / ${event.max_waitlist_size || 10}`],
      });
    }
  } else if (rolle === 'konfi') {
    // Abgesagt: keine Platzzahlen (die Absage meldet alle ab), sondern wie viele der Termin erreicht hat.
    zeilen.push({
      label: 'Teilnehmer:innen',
      zeilen: [istAbgesagt(event)
        ? `${event.abgemeldet_count ?? 0} abgemeldet`
        : `${event.registered_count || 0} / ${maxText(event.max_participants)}`],
    });
    if (event.waitlist_enabled) {
      zeilen.push({
        label: 'Warteliste',
        zeilen: [`${event.waitlist_count || 0} / ${event.max_waitlist_size || 10}${event.waitlist_position ? ` (Du: Platz ${event.waitlist_position})` : ''}`],
      });
    }
  } else {
    // Team: eigenes Kontingent, Warteliste nur bei begrenzten Plaetzen.
    if (teamErlaubt) {
      zeilen.push({ label: 'Team', zeilen: [`${event.teamer_count || 0} / ${maxText(event.teamer_max_participants)}`] });
    }
    if ((event.teamer_max_participants || 0) > 0 && event.teamer_waitlist_enabled) {
      zeilen.push({ label: 'Team-Warteliste', zeilen: [`${event.teamer_waitlist_count || 0} / ${event.teamer_max_waitlist_size || 10}`] });
    }
  }

  // Punkte und Art: nur wenn es fuer die Konfis welche gibt.
  if (!keinePunkte) {
    zeilen.push({ label: 'Punkte', zeilen: [String(event.points || 0)] });
    zeilen.push({ label: 'Typ', zeilen: [punkteartText(event)] });
  }

  const kategorien = kategorienText(event);
  if (kategorien) zeilen.push({ label: 'Kategorien', zeilen: [kategorien] });

  if (event.location) {
    const link = ortKartenLink(event);
    zeilen.push({ label: 'Ort', zeilen: [event.location], ...(link ? { ortLink: link } : {}) });
  }

  if (event.mandatory) zeilen.push({ label: 'Pflicht-Event', zeilen: ['Teilnahme erforderlich'] });

  if (rolle === 'leitung') {
    // Team-Zugang: bei "Nur Team" immer, bei "Team gesucht" solange noch niemand zugesagt hat.
    const teamerBestaetigt = teilnehmende.filter((p) => p.role_name === 'teamer' && p.status === 'confirmed').length;
    if (event.teamer_only || (event.teamer_needed && teamerBestaetigt === 0)) {
      zeilen.push({ label: 'Team-Zugang', zeilen: [event.teamer_only ? 'Nur Team' : 'Team gesucht'] });
    }
  } else if (rolle === 'team' && teamErlaubt) {
    zeilen.push({ label: 'Team-Zugang', zeilen: [event.teamer_only ? 'Nur Team' : 'Team gesucht'] });
  }

  // Serie: Konfi und Team sehen nur, DASS es eine Reihe ist; die Leitung die weiteren Events (eigener Abschnitt).
  if (rolle !== 'leitung' && event.is_series) zeilen.push({ label: 'Event-Serie', zeilen: ['Teil einer Serie'] });

  if (event.checkin_window) {
    zeilen.push({ label: 'Check-in-Fenster', zeilen: [`QR-Code ${event.checkin_window} Min. (vor/nach Beginn)`] });
  }

  if (event.bring_items) zeilen.push({ label: 'Mitbringen', zeilen: [event.bring_items] });

  if (rolle !== 'konfi' && materialien.length > 0) {
    zeilen.push({
      label: 'Material',
      zeilen: [materialien.length === 1 ? materialien[0].title : `${materialien.length} Materialien`],
      materialSprung: true,
    });
  }

  if (rolle === 'leitung' && event.jahrgaenge && event.jahrgaenge.length > 0) {
    zeilen.push({ label: 'Jahrgänge', zeilen: [event.jahrgaenge.map((j) => j.name).join(', ')] });
  }

  return zeilen;
}

// ---------------------------------------------------------------------------
// Leitung, Detail: die Kennzahlen ueber dem Inhalt
// ---------------------------------------------------------------------------

export interface Kennzahl {
  wert: string;
  label: string;
}

/** Die drei Kacheln der Leitung (admin/views/EventDetailView): TN, Team oder Punkte, Warteliste. */
export function leitungKennzahlen(event: Event, teilnehmende: readonly Participant[]): Kennzahl[] {
  const konfis = teilnehmende.filter((p) => p.role_name === 'konfi');
  // Team-Seite: Teamer:innen UND zugeordnete Leitung.
  const team = teilnehmende.filter((p) => p.role_name !== 'konfi');
  const teamBestaetigt = team.filter((p) => p.status === 'confirmed').length;
  const teamWartend = team.filter((p) => p.status === 'waitlist').length;
  const teamMax = (event.teamer_max_participants || 0) > 0 ? String(event.teamer_max_participants) : unendlich;
  const da = konfis.filter((p) => p.attendance_status === 'present').length;
  const konfiBestaetigt = konfis.filter((p) => p.status === 'confirmed').length;
  // Wer sich selbst abgemeldet hat und von der Leitung verbucht wurde, zaehlt nicht mehr als abgemeldet.
  const konfiAbgemeldet = konfis.filter((p) => {
    if (p.attendance_status === 'present' || p.attendance_status === 'absent') return false;
    return p.attendance_status === 'excused' || p.status === 'excused' || p.status === 'opted_out';
  }).length;
  const k = (wert: number | string, label: string): Kennzahl => ({ wert: String(wert), label });

  if (event.teamer_only) {
    const teamDa = team.filter((p) => p.attendance_status === 'present').length;
    return [k(teamBestaetigt, `von ${teamMax} Team`), k(teamDa, 'Anwesend'), k(teamWartend, 'Warteliste')];
  }
  const hatTeam = !!event.teamer_needed;
  if (event.mandatory) {
    return [
      k(konfiBestaetigt, `von ${konfiBestaetigt + konfiAbgemeldet} TN`),
      k(da, 'Anwesend'),
      hatTeam ? k(teamBestaetigt, 'Team') : k(konfiAbgemeldet, 'Abgemeldet'),
    ];
  }
  const maxP = (event.max_participants || 0) > 0 ? String(event.max_participants) : unendlich;
  return [
    k(konfiBestaetigt, `von ${maxP} TN`),
    hatTeam
      ? k(teamBestaetigt, `von ${teamMax} Team`)
      : ((event.points || 0) > 0 ? k(event.points || 0, 'Punkte') : k(konfiAbgemeldet, 'Abgemeldet')),
    k(konfis.filter((p) => p.status === 'waitlist').length, 'Warteliste'),
  ];
}

/**
 * Eine Kennzahl als Kachel der Web-Fassung: die App stellt die Zahl gross und
 * das Wort darunter ("6" und "von 40 TN"); die Kachel steht umgekehrt (Wort
 * oben, Zahl darunter) und liest sich dann als Satz -- "Teilnehmer:innen 6 / 40".
 */
export function kennzahlAnzeige(k: Kennzahl): Kennzahl {
  const von = k.label.match(/^von (\S+) (TN|Team)$/);
  if (!von) return k;
  return { label: von[2] === 'TN' ? 'Teilnehmer:innen' : 'Team', wert: `${k.wert} / ${von[1]}` };
}

/** Konfi (konfi/views/EventDetailView): Frei, Punkte, Dabei -- abgesagt: wie viele abgemeldet. */
export function konfiKennzahlen(event: Event): Kennzahl[] {
  const unbegrenzt = (event.max_participants || 0) === 0;
  const angemeldet = event.registered_count || 0;
  const frei = unbegrenzt ? null : event.max_participants - angemeldet;
  const abgesagt = istAbgesagt(event);
  const zahlen: Kennzahl[] = [
    abgesagt
      ? { wert: String(event.abgemeldet_count ?? 0), label: 'Abgemeldet' }
      : { wert: unbegrenzt ? unendlich : String(Math.max(0, frei ?? 0)), label: 'Frei' },
  ];
  if ((event.points || 0) > 0 && !event.mandatory && !event.is_konfirmation) zahlen.push({ wert: String(event.points), label: 'Punkte' });
  zahlen.push({ wert: String(angemeldet), label: 'Dabei' });
  return zahlen;
}

/** Team (TeamerEventsPage): "Nur Team" erzaehlt vom Team, sonst Konfis, Team und ggf. Punkte. */
export function teamKennzahlen(event: Event): Kennzahl[] {
  const konfis = Math.max(0, event.registered_count || 0);
  const team = Math.max(0, event.teamer_count || 0);
  if (event.teamer_only) {
    return [
      { wert: String(team), label: 'Team' },
      { wert: String(Math.max(0, event.teamer_waitlist_count || 0)), label: 'Warteliste' },
    ];
  }
  const punkte = !event.teamer_only && !event.mandatory && !event.is_konfirmation && (event.points || 0) > 0;
  return [
    { wert: String(konfis), label: 'Konfis' },
    { wert: String(team), label: 'Team' },
    ...(punkte ? [{ wert: String(event.points), label: 'Punkte' }] : []),
  ];
}

// ---------------------------------------------------------------------------
// Konfi, Detail: was steht im Feld "Bist du dabei?"
// ---------------------------------------------------------------------------

export type AnmeldeAktion = 'anmelden' | 'wiederAnmelden' | 'abmelden' | 'pflichtAbmelden' | 'pflichtWiederAnmelden' | 'wartelisteAbmelden';

export interface AnmeldeZustand {
  /** Hinweis oder Zustand als Text (Pflicht-Event, abgesagt, Warteliste Platz 3 ...). */
  hinweis?: { text: string; art: 'info' | 'warnung' | 'fehler' | 'erfolg' };
  /** Der eine Knopf, der dazugehoert -- oder keiner. */
  knopf?: { aktion: AnmeldeAktion; text: string; sperrt: boolean; gefahr?: boolean; gruen?: boolean };
  /** Warum der Knopf gesperrt ist, wenn er nur erklaert ("Abmelden geht nur bis 2 Tage vorher"). */
  gesperrt?: { text: string };
}

export interface AnmeldeKontext {
  online: boolean;
  /** Eine Anmeldung laeuft gerade (Sperre gegen den Doppeltipp). */
  laeuft: boolean;
  /** Ein anderes Konfirmations-Event ist schon gebucht. */
  hatKonfirmationGebucht: boolean;
  jetzt?: Date;
}

/** Bis zwei Tage vorher darf sich abmelden, wer angemeldet ist. */
export const kannAbmelden = (event: Pick<Event, 'is_registered' | 'event_date'>, jetzt: Date = new Date()): boolean => {
  if (!event.is_registered) return false;
  const frist = new Date(new Date(event.event_date).getTime() - 2 * 24 * 60 * 60 * 1000);
  return jetzt < frist;
};

/**
 * Der Zustand des Feldes "Bist du dabei?" der Konfi-Detailansicht -- dieselbe
 * Entscheidungskette wie die der App (konfi/views/EventDetailView, "AN-/
 * ABMELDUNG"), als Daten: ein Hinweis, ein Knopf, eine Erklaerung.
 */
export function konfiAnmeldeZustand(event: Event, kontext: AnmeldeKontext): AnmeldeZustand {
  const { online, laeuft, hatKonfirmationGebucht } = kontext;
  const jetzt = kontext.jetzt ?? new Date();
  const abgesagt = istAbgesagt(event);
  const vorbei = istVergangen(event, jetzt);
  const abgemeldet = !!event.is_opted_out || event.booking_status === 'opted_out';
  const offline = 'Du bist offline';

  if (event.mandatory) {
    if (abgesagt) return { hinweis: { text: 'Dieses Event ist abgesagt', art: 'info' } };
    if (vorbei) return { hinweis: { text: 'Pflicht-Event (vergangen)', art: 'info' } };
    if (abgemeldet) {
      return {
        hinweis: { text: 'Du hast dich abgemeldet', art: 'fehler' },
        // Die Wiederanmeldung am Pflicht-Event ist nicht offline gesperrt (App: handleOptIn).
        knopf: { aktion: 'pflichtWiederAnmelden', text: 'Wieder anmelden', sperrt: false, gruen: true },
      };
    }
    if (event.booking_status === 'excused') {
      return {
        hinweis: { text: 'Von der Leitung abgemeldet', art: 'fehler' },
        knopf: { aktion: 'wiederAnmelden', text: online ? 'Wieder anmelden' : offline, sperrt: !online || laeuft, gruen: true },
      };
    }
    if (event.is_registered) {
      return {
        hinweis: { text: 'Du bist automatisch angemeldet', art: 'info' },
        knopf: { aktion: 'pflichtAbmelden', text: online ? 'Abmelden' : 'Abmelden (wird gesendet)', sperrt: false, gefahr: true },
      };
    }
    return { hinweis: { text: 'Pflicht-Event', art: 'info' } };
  }

  if (event.is_registered) {
    if (kannAbmelden(event, jetzt)) {
      return { knopf: { aktion: 'abmelden', text: online ? 'Abmelden' : 'Abmelden (wird gesendet)', sperrt: false, gefahr: true } };
    }
    return { gesperrt: { text: 'Abmelden geht nur bis 2 Tage vorher' } };
  }
  if (abgesagt) return { hinweis: { text: 'Dieses Event ist abgesagt', art: 'info' } };

  if (event.booking_status === 'waitlist' || event.booking_status === 'pending') {
    return {
      hinweis: { text: `Du stehst auf Platz ${event.waitlist_position || '?'} der Warteliste`, art: 'warnung' },
      knopf: {
        aktion: 'wartelisteAbmelden',
        text: online ? 'Von der Warteliste abmelden' : 'Von der Warteliste abmelden (wird gesendet)',
        sperrt: false,
        gefahr: true,
      },
    };
  }

  if (event.booking_status === 'excused') {
    const voll = istVoll(event);
    const wartelisteOffen = voll && !!event.waitlist_enabled;
    const darfZurueck = !!event.can_register && event.registration_status === 'open' && (!voll || wartelisteOffen);
    const hinweis = { text: 'Von der Leitung abgemeldet', art: 'fehler' as const };
    if (darfZurueck) {
      return {
        hinweis,
        knopf: {
          aktion: 'wiederAnmelden',
          text: !online ? offline : wartelisteOffen ? 'Wieder anmelden (Warteliste)' : 'Wieder anmelden',
          sperrt: !online || laeuft,
          gruen: true,
        },
      };
    }
    return {
      hinweis,
      gesperrt: {
        text: event.registration_status === 'open'
          ? 'Ausgebucht'
          : event.registration_status === 'upcoming' ? 'Anmeldung noch nicht offen' : 'Anmeldung geschlossen',
      },
    };
  }

  if (event.is_konfirmation === true && hatKonfirmationGebucht) {
    return { gesperrt: { text: 'Konfirmationstermin bereits gebucht' } };
  }

  const platz = (event.max_participants === 0 || (event.registered_count || 0) < event.max_participants);
  if (event.can_register && event.registration_status === 'open' && platz) {
    return {
      knopf: {
        aktion: 'anmelden',
        text: !online ? offline : `Anmelden (${event.registered_count || 0}/${event.max_participants})`,
        sperrt: !online || laeuft,
        gruen: true,
      },
    };
  }
  if (event.waitlist_enabled && event.max_participants > 0 && (event.registered_count || 0) >= event.max_participants && event.registration_status === 'open') {
    return {
      knopf: {
        aktion: 'anmelden',
        text: !online ? offline : `Warteliste offen (${event.waitlist_count || 0}/${event.max_waitlist_size || 0})`,
        sperrt: !online || laeuft,
      },
    };
  }
  return { gesperrt: { text: event.registration_status === 'closed' ? 'Anmeldung geschlossen' : 'Nicht verfügbar' } };
}

// ---------------------------------------------------------------------------
// Team (und Leitung): Zusage und Absage zur eigenen Teilnahme
// ---------------------------------------------------------------------------

export interface TeamZusageZustand {
  /** Hinweis statt Knoepfen (abgesagt, Anwesenheit, "Nur zur Info"). */
  hinweis?: { text: string; art: 'info' | 'warnung' | 'fehler' | 'erfolg' };
  /** Beschriftung der Warteliste, wenn das Kontingent voll ist, aber die Warteliste offen. */
  zusageText?: string;
  /** Zusagen geht nicht (Kontingent und Warteliste voll), absagen schon. */
  zusageMoeglich: boolean;
  /** Gibt es die Knoepfe ueberhaupt? */
  zeigtKnoepfe: boolean;
}

/**
 * Was die Karte "Bist du dabei?" des Teams zeigt (TeamerEventsPage, zusageKarteInhalt):
 * abgesagt schlaegt alles; vergangen nur der Anwesenheits-Stand, und nur
 * fuer Angemeldete; zugesagt oder anmeldbar die Knoepfe, sonst "Nur zur Info".
 * Gibt null zurueck, wenn die ganze Karte entfaellt.
 */
export function teamZusageZustand(event: Event, jetzt: Date = new Date()): TeamZusageZustand | null {
  if (istAbgesagt(event)) {
    return { hinweis: { text: 'Dieses Event ist abgesagt', art: 'info' }, zusageMoeglich: false, zeigtKnoepfe: false };
  }
  if (istVergangen(event, jetzt)) {
    if (!event.is_registered) return null;
    if (event.attendance_status === 'present') return { hinweis: { text: 'Anwesend', art: 'erfolg' }, zusageMoeglich: false, zeigtKnoepfe: false };
    if (event.attendance_status === 'absent') return { hinweis: { text: 'Abwesend', art: 'fehler' }, zusageMoeglich: false, zeigtKnoepfe: false };
    return { hinweis: { text: 'Anwesenheit ausstehend', art: 'warnung' }, zusageMoeglich: false, zeigtKnoepfe: false };
  }
  if (event.is_registered) return { zusageMoeglich: true, zeigtKnoepfe: true };
  if (!teamKannSichAnmelden(event)) {
    return { hinweis: { text: 'Nur zur Info - keine Anmeldung', art: 'info' }, zusageMoeglich: false, zeigtKnoepfe: false };
  }
  const max = event.teamer_max_participants || 0;
  const voll = max > 0 && (event.teamer_count || 0) >= max;
  if (!voll) return { zusageMoeglich: true, zeigtKnoepfe: true };
  const wartelisteMax = event.teamer_max_waitlist_size || 0;
  const wartelisteAnzahl = event.teamer_waitlist_count || 0;
  const wartelisteOffen = !!event.teamer_waitlist_enabled && (wartelisteMax === 0 || wartelisteAnzahl < wartelisteMax);
  if (wartelisteOffen) {
    return { zusageText: `Warteliste (${wartelisteAnzahl}/${wartelisteMax || unendlich})`, zusageMoeglich: true, zeigtKnoepfe: true };
  }
  return { zusageMoeglich: false, zeigtKnoepfe: true };
}

// ---------------------------------------------------------------------------
// Filter und Suche der Listen
// ---------------------------------------------------------------------------

/** Die Kategorien eines Events als Namen (GET /events liefert categories[] und category_names). */
export function kategorienNamen(event: Pick<Event, 'categories' | 'category_names'>): string[] {
  if (event.categories && event.categories.length > 0) return event.categories.map((c) => c.name);
  return (event.category_names || '').split(',').map((n) => n.trim()).filter(Boolean);
}

/** Gehoert das Event zu diesem Jahrgang? (jahrgang_ids ist eine Kommaliste.) */
export function terminImJahrgang(event: Pick<Event, 'jahrgang_ids'>, jahrgangId: number): boolean {
  if (!event.jahrgang_ids) return false;
  return event.jahrgang_ids.split(',').map((id) => parseInt(id.trim(), 10)).includes(jahrgangId);
}

/**
 * Die Suche der Listen: Name, Titel, Ort (bei Konfis auch die Beschreibung).
 * Gross- und Kleinschreibung zaehlen nicht, Umlaute sind austauschbar --
 * "gottesdienst" findet "Gottesdienst", "buesum" findet "Büsum" (wie die Suche
 * der Support-Ansicht, utils/supportWeb.ts).
 */
export function terminSuchtTreffer(event: Pick<Event, 'name' | 'title' | 'location' | 'description'>, eingabe: string, mitBeschreibung = false): boolean {
  if (!eingabe.trim()) return true;
  const felder = [event.name, event.title, event.location, ...(mitBeschreibung ? [event.description] : [])];
  return felder.some((f) => !!f && suchTreffer(f, eingabe).length > 0);
}

export type ArtFilter = 'alle' | 'pflicht' | 'konfirmation' | 'team';

/** Die Art eines Events: Pflicht, Konfirmation, nur fuers Team. */
export function terminHatArt(event: Pick<Event, 'mandatory' | 'is_konfirmation' | 'teamer_only'>, art: ArtFilter): boolean {
  switch (art) {
    case 'pflicht': return !!event.mandatory;
    case 'konfirmation': return !!event.is_konfirmation;
    case 'team': return !!event.teamer_only;
    default: return true;
  }
}

/**
 * Abgesagte Termine aus beiden Quellen: GET /events (registration_status) und
 * GET /events/cancelled (cancelled). Bevorstehende zuerst, nach Datum
 * aufsteigend -- die Leitung will wissen, was als Naechstes ausfaellt --, danach
 * die vergangenen, die juengsten voran.
 */
export function abgesagteTermine<T extends Pick<Event, 'id' | 'event_date' | 'event_end_time' | 'cancelled' | 'registration_status'>>(
  offen: readonly T[],
  abgesagt: readonly T[],
  jetzt: Date = new Date(),
): T[] {
  const nachId = new Map<number, T>();
  for (const e of [...offen, ...abgesagt]) if (istAbgesagt(e)) nachId.set(e.id, e);
  const alle = [...nachId.values()];
  const kommend = alle.filter((e) => !istVergangen(e, jetzt)).sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  const vorbei = alle.filter((e) => istVergangen(e, jetzt)).sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
  return [...kommend, ...vorbei];
}

/** Naechstes zuerst, vergangene danach -- wie die Konfi- und Team-Liste der App. */
export function kommendeZuerst<T extends Pick<Event, 'event_date'>>(termine: readonly T[], jetzt: Date = new Date()): T[] {
  return [...termine].sort((a, b) => {
    const da = new Date(a.event_date);
    const db = new Date(b.event_date);
    const vorbeiA = da < jetzt;
    const vorbeiB = db < jetzt;
    if (vorbeiA === vorbeiB) return da.getTime() - db.getTime();
    return vorbeiA ? 1 : -1;
  });
}
