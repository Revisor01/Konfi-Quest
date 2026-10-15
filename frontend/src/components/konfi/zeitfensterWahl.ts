// Die Wahl des Zeitfensters beim Anmelden (Konfi, /konfi/events/:id) -- als
// Logik ohne Darstellung. Die App zeigt sie als Aktionsmenü „Zeitslot
// auswählen" (konfi/views/EventDetailView, handleRegister), der Browser ab
// 992 px als Fenster (web/termine/WebZeitfensterDialog.tsx; Simon,
// 15.10.2026). Welche Zeitfenster wie heißen und welche gesperrt sind, steht
// nur hier:
//
//   frei                      „10:00 - 12:00 (3 frei)"
//   voll, Warteliste offen    „10:00 - 12:00 (voll — auf Warteliste, 2 warten)"
//                             -- buchbar, die Anmeldung landet auf der Warteliste
//   voll, ohne Warteliste     „10:00 - 12:00 (ausgebucht)" -- gesperrt
//
// Die Warteliste gilt je Zeitfenster: aktiv am Event (waitlist_enabled) und
// nicht voll (max_waitlist_size 0 = ohne Grenze).

import type { Event } from '../../types/event';
import { formatEventTime } from '../shared/eventFormatting';

/** Ein Zeitfenster mit Belegung, wie GET /konfi/events/:id/timeslots es liefert. */
export interface WahlZeitfenster {
  id: number;
  start_time: string;
  end_time: string;
  max_participants: number;
  registered_count: number;
  waitlist_count?: number;
}

export interface ZeitfensterOption {
  id: number;
  /** Der ganze Eintrag wie im Aktionsmenü der App. */
  text: string;
  /** „10:00 - 12:00". */
  zeit: string;
  /** „3 frei", „voll — auf Warteliste, 2 warten", „ausgebucht". */
  stand: string;
  /** Voll und ohne Platz auf der Warteliste. */
  gesperrt: boolean;
  /** Voll, aber die Warteliste nimmt noch auf. */
  warteliste: boolean;
}

/** Was erscheint, wenn ein gesperrtes Zeitfenster gewählt wird (App oben, Browser im Fenster). */
export const ZEITSLOT_AUSGEBUCHT = 'Dieser Zeitslot ist ausgebucht und hat keine Warteliste.';

/** Die Zeitfenster zur Wahl, in der Reihenfolge des Servers. */
export function zeitfensterOptionen(
  event: Pick<Event, 'waitlist_enabled' | 'max_waitlist_size'>,
  slots: readonly WahlZeitfenster[],
): ZeitfensterOption[] {
  const wartelisteAktiv = !!event.waitlist_enabled;
  const maxWarteliste = event.max_waitlist_size || 0;
  return slots.map((slot) => {
    const voll = slot.max_participants > 0 && parseInt(String(slot.registered_count || 0)) >= slot.max_participants;
    const wartend = parseInt(String(slot.waitlist_count || 0));
    // Auf einen vollen Slot kann man sich auf die Warteliste setzen, solange
    // die Warteliste aktiv und nicht voll ist. Nur dann bleibt der Slot
    // buchbar; sonst ist er wirklich dicht.
    const warteliste = voll && wartelisteAktiv && (maxWarteliste === 0 || wartend < maxWarteliste);
    const gesperrt = voll && !warteliste;
    const zeit = `${formatEventTime(slot.start_time)} - ${formatEventTime(slot.end_time)}`;
    const frei = Math.max(0, slot.max_participants - (slot.registered_count || 0));
    const stand = warteliste
      ? `voll — auf Warteliste${wartend > 0 ? `, ${wartend} warten` : ''}`
      : gesperrt ? 'ausgebucht' : `${frei} frei`;
    return { id: slot.id, text: `${zeit} (${stand})`, zeit, stand, gesperrt, warteliste };
  });
}
