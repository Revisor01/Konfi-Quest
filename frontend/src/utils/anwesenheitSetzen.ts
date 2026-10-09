// Die Anwesenheit EINER Buchung setzen -- eine Stelle fuer beide Wege
// (09.10.2026, Simon: "zwei Wege, gleiches Ziel"):
//   - im Termin (admin/views/EventDetailView.tsx, Teilnehmerliste)
//   - in der Detailansicht der Person (admin/views/KonfiDetailView.tsx,
//     oben in der Eventliste)
// Beide rufen dieselbe Route, die Punkte, Abzeichen, Push und Zaehler
// ausloest (backend routes/events/anwesenheit.js), mit demselben Koerper und
// derselben anonymen Messung -- so kann der zweite Weg nicht anders verbuchen
// als der erste.

import api from '../services/api';
import { trackHandlung } from '../services/analytics';

export type AnwesenheitsStatus = 'present' | 'absent' | 'excused' | null;

export interface AnwesenheitTexte {
  excuse_reason?: string;
  attendance_note?: string;
}

/**
 * PUT /events/:eventId/participants/:buchungId/attendance.
 * `gruppe` nur fuer die Messung (Konfi oder Team). Wirft bei einem Fehler.
 */
export const anwesenheitSetzen = async (
  eventId: number | string,
  buchungId: number | string,
  status: AnwesenheitsStatus,
  { texte, gruppe }: { texte?: AnwesenheitTexte; gruppe: 'konfi' | 'teamer' }
): Promise<void> => {
  await api.put(`/events/${eventId}/participants/${buchungId}/attendance`, {
    attendance_status: status,
    ...(texte?.excuse_reason !== undefined ? { excuse_reason: texte.excuse_reason } : {}),
    ...(texte?.attendance_note !== undefined ? { attendance_note: texte.attendance_note } : {})
  });
  // Anonyme Messung NACH der erfolgreichen Antwort: die Anwesenheit ist
  // wirklich verbucht. Nur Umfang und Gruppe -- keine Person, kein Termin,
  // kein Status-Detail, kein Grund und keine Notiz.
  trackHandlung('anwesenheit-erfasst', { umfang: 'einzeln', gruppe });
};
