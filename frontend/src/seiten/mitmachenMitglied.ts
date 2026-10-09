// Mitmachen der Konfis (/konfi/events) und des Teams (/teamer/events):
// Events und die eigenen gemeldeten Aktivitäten.
// App: components/konfi/pages/KonfiEventsPage.tsx mit konfi/views/EventsView.tsx,
// components/teamer/pages/TeamerEventsPage.tsx, beide mit konfi/views/RequestsView.tsx.
// Web: components/shared/web/termine/ (WebMitmachenMitglied, WebEigeneAntraege,
// terminFilter.ts), konfi/web/termine/WebKonfiEvents.tsx,
// teamer/web/termine/WebTeamEvents.tsx.

import { istVergangen, zaehltAlsMeiner } from '../components/shared/eventFormatting';
import { wahlen } from './beschreibung';

/** Die zwei Bereiche oben -- auch `?segment=antraege` in der Adresse. */
export const MITGLIED_BEREICHE = wahlen([
  { schluessel: 'events', label: 'Events' },
  { schluessel: 'antraege', label: 'Aktivitäten' },
]);
export const MITGLIED_BEREICHE_BESCHRIFTUNG = 'Bereiche von Mitmachen';

export const MITGLIED_EVENTS_UNTERTITEL = 'Gottesdienste, Konfi-Tage und Fahrten';
export const MITGLIED_ANTRAEGE_TITEL = 'Deine Aktivitäten';
export const MITGLIED_ANTRAEGE_UNTERTITEL = 'Was du gemeldet hast';

interface ListenEvent {
  event_date: string;
  event_end_time?: string | null;
  is_konfirmation?: boolean;
  is_registered?: boolean;
  booking_status?: string | null;
  teamer_needed?: boolean;
  teamer_only?: boolean;
}

/**
 * Die Events der Konfis: Alle, Meine, Konfirmation (Simon, 06.10.2026:
 * „angleichen") -- auch `?filter=` in der Adresse. „Meine" heißt: jede
 * Buchung, egal in welchem Zustand (zaehltAlsMeiner).
 */
export const KONFI_EVENTS = wahlen([
  {
    schluessel: 'alle', label: 'Alle', leer: 'Keine anstehenden Events',
    // Was noch kommt, ohne Konfirmation (die hat ihren eigenen Reiter). Ein
    // mehrtägiges Event bleibt bis zu seinem Ende drin (istVergangen).
    passt: (e: ListenEvent) => !e.is_konfirmation && !istVergangen(e),
  },
  { schluessel: 'meine', label: 'Meine', leer: 'Du bist noch für keine Events angemeldet', passt: (e: ListenEvent) => zaehltAlsMeiner(e) },
  {
    schluessel: 'konfirmation', label: 'Konfirmation', leer: 'Keine Konfirmationstermine verfügbar',
    // Seit 05.01.2026 in der App kurz: drei Reiter in der Breite eines Telefons.
    kurz: 'Konfi',
    passt: (e: ListenEvent) => !!e.is_konfirmation,
  },
]);
export const KONFI_EVENTS_LEER_TITEL = 'Keine Events gefunden';
export const KONFI_EVENTS_TITEL_APP = 'Deine Events';

/** Die Events des Teams: Alle, Meine, Team (sucht oder nur fürs Team) -- auch `?filter=`. */
export const TEAM_EVENTS = wahlen([
  { schluessel: 'alle', label: 'Alle', leer: 'Keine Events vorhanden', passt: () => true },
  { schluessel: 'meine', label: 'Meine', leer: 'Du bist noch bei keinem Event dabei', passt: (e: ListenEvent) => zaehltAlsMeiner(e) },
  { schluessel: 'team', label: 'Team', leer: 'Keine Events fürs Team verfügbar', passt: (e: ListenEvent) => !!(e.teamer_needed || e.teamer_only) },
]);
export const TEAM_EVENTS_LEER_TITEL = 'Keine Events';

/** Gemeinsame Beschriftung der Reiter über den Events (Konfis und Team). */
export const MITGLIED_EVENTS_BESCHRIFTUNG = 'Events anzeigen';

interface MitStatus { status: 'pending' | 'approved' | 'rejected' }

/**
 * Die Stände der eigenen Aktivitäten (Konfis und Team) -- auch `?filter=`.
 * „Angerechnet" an Reiter, Kachel und Marke (bis 09.10.2026 hieß die Kachel
 * der App „Erledigt").
 */
export const EIGENE_ANTRAG_STATUS = wahlen([
  { schluessel: 'offen', label: 'Offen', passt: (a: MitStatus) => a.status === 'pending' },
  { schluessel: 'angerechnet', label: 'Angerechnet', passt: (a: MitStatus) => a.status === 'approved' },
  { schluessel: 'abgelehnt', label: 'Abgelehnt', passt: (a: MitStatus) => a.status === 'rejected' },
  {
    schluessel: 'alle', label: 'Alle', passt: () => true,
    nurIn: 'web',
    warum: 'Die App zeigt über den drei Reitern die Zahl je Stand als Kacheln; im Browser stehen die Zahlen an den Chips, die Gesamtliste ist ein eigener Chip.',
  },
]);
export const EIGENE_ANTRAG_STATUS_BESCHRIFTUNG = 'Aktivitäten nach Status';
export const EIGENE_ANTRAEGE_LEER = { titel: 'Keine Aktivitäten gefunden', text: 'Noch keine Aktivitäten gemeldet' } as const;

/**
 * Womit die eigenen Aktivitäten starten. Konfis sehen zuerst die offenen.
 * Das Team sieht im Browser zuerst alle; in der App gibt es den Reiter
 * „Alle" nicht, dort startet auch das Team mit „Offen" (bis 09.10.2026
 * startete es auf einer Gesamtliste ohne Reiter, und kein Reiter war gewählt).
 */
export const EIGENE_ANTRAEGE_START = {
  konfi: { app: 'offen', web: 'offen' },
  team: { app: 'offen', web: 'alle' },
} as const;
