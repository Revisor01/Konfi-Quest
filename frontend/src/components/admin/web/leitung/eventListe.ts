// Die EINE Eventliste der Detailseite einer Person im Browser (Simon,
// Seiten-Interview 13.10.2026: „ich sehe events die angemeldeten, dann
// nochmal eine zuordnung mit teilgenommenen events -- das soll eine liste
// sein, pflicht events sollten da auch gekennzeichnet sein").
//
// Bis dahin standen oben die offenen und anstehenden Termine (`termine`) und
// darunter eine Tabelle -- bei Konfis die Event-Punkte, bei Teamer:innen ihre
// uebrigen Buchungen. Jetzt ist es eine Tabelle, in dieser Ordnung:
//
//   1. zu verbuchen (begonnen, angemeldet, Anwesenheit offen), neueste zuerst
//   2. anstehend (angemeldet oder Warteliste), naechste zuerst
//   3. alles andere nach Eventdatum, neueste zuerst
//
// Quellen:
//   Konfi       `alleTermine` (GET /admin/konfis/:id, seit 13.10.2026) --
//               jede Buchung mit Pflicht, Punkten und darf_verbuchen. Fehlt
//               das Feld (gemerkter Stand von vorher, aelterer Server), wie
//               bisher `termine` und die Event-Punkte, ohne Pflicht.
//   Teamer:in   `teamerEvents` (alle Buchungen mit Anwesenheit) und
//               `termine` (welche zu verbuchen sind, mit Recht).
//
// Hier steht nur Rechnung -- die Tabelle zeichnet WebKonfiKarten
// (EventListeKarte).

import { teilnahmeDarstellung, type TeilnahmeDarstellung } from '../../../../utils/teilnahmeStatus';
import { punkteAnzeigeDatum } from '../../../../utils/punkteDatum';
import type { PillTon } from '../../../../utils/supportWeb';
import type { EventPunkteEintrag } from '../../../../types/user';
import type { PersonTermin } from '../../views/KonfiDetailSections';
import type { AlleTermineEintrag, TeamerTermin } from './konfiDetailTypen';

/** Eine Zeile der Eventliste einer Person. */
export interface EventZeile {
  schluessel: string;
  event_id: number;
  name: string;
  /** Datum des Termins (bei Event-Punkten ohne Termin das Verbuchungsdatum). */
  datum: string;
  pflicht: boolean;
  konfirmation: boolean;
  abgesagt: boolean;
  art: 'verbuchen' | 'anstehend' | 'erledigt';
  booking_status: string | null;
  attendance_status: string | null;
  /** Event-Punkte der Person an diesem Termin; 0 ohne. */
  punkte: number;
  punkteArt: string | null;
  /** Wer die Punkte vergeben hat. */
  von: string | null;
  /** Fuer "Anwesend / Nicht anwesend": die Buchung mit dem Recht daran; null ohne Buchung. */
  termin: PersonTermin | null;
}

/** Der Stand einer Zeile als Wort und Farbe der Marke. */
export interface EventStand {
  text: string;
  ton: PillTon;
}

const STAND_TON: Record<TeilnahmeDarstellung['farbe'], PillTon> = {
  success: 'erfolg', danger: 'fehler', warning: 'warnung', info: 'info', neutral: 'neutral',
};

/**
 * Der Stand einer Zeile. Grundlage ist DIESELBE Regel wie in der
 * Teilnehmerliste eines Events (teilnahmeDarstellung); drei Woerter sind
 * kuerzer, weil die Spalte so schmal ist wie "Eingetragen von" darueber:
 *   - zu verbuchen: "Ausstehend" (die Knoepfe stehen in der Zeile)
 *   - von der Leitung nachgetragene Abmeldung: "Entschuldigt" statt
 *     "Abgemeldet (nachgetragen)"
 *   - abgesagter Termin: "Abgesagt"
 * Event-Punkte ohne Buchung waren da: "Anwesend".
 */
export const eventStand = (z: Pick<EventZeile, 'abgesagt' | 'art' | 'booking_status' | 'attendance_status'>): EventStand => {
  if (z.abgesagt) return { text: 'Abgesagt', ton: 'neutral' };
  if (z.art === 'verbuchen') return { text: 'Ausstehend', ton: 'warnung' };
  if (!z.booking_status) return { text: 'Anwesend', ton: 'erfolg' };
  const d = teilnahmeDarstellung({ status: z.booking_status, attendance_status: z.attendance_status });
  if (d.istNachgetragen) return { text: 'Entschuldigt', ton: 'neutral' };
  return { text: d.statusText, ton: STAND_TON[d.farbe] };
};

const zeit = (iso: string): number => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const RANG: Record<EventZeile['art'], number> = { verbuchen: 0, anstehend: 1, erledigt: 2 };

/** Offenes oben, Anstehendes darunter (naechstes zuerst), dann der Rest nach Datum absteigend. */
export const eventZeilenOrdnen = (zeilen: readonly EventZeile[]): EventZeile[] =>
  [...zeilen].sort((a, b) => {
    if (a.art !== b.art) return RANG[a.art] - RANG[b.art];
    return a.art === 'anstehend' ? zeit(a.datum) - zeit(b.datum) : zeit(b.datum) - zeit(a.datum);
  });

/** Eine Zeile aus `alleTermine` (Konfi). */
const ausAllenTerminen = (t: AlleTermineEintrag): EventZeile => ({
  schluessel: t.booking_id != null ? `b-${t.booking_id}` : `p-${t.event_id}`,
  event_id: t.event_id,
  name: t.event_name,
  datum: t.event_date,
  pflicht: !!t.mandatory,
  konfirmation: !!t.is_konfirmation,
  abgesagt: !!t.cancelled,
  art: t.art,
  booking_status: t.booking_status ?? null,
  attendance_status: t.attendance_status ?? null,
  punkte: Number(t.points) || 0,
  punkteArt: t.point_type ?? null,
  von: t.points_von ?? null,
  termin: t.booking_id != null ? {
    booking_id: t.booking_id,
    event_id: t.event_id,
    event_name: t.event_name,
    event_date: t.event_date,
    location: t.location ?? null,
    booking_status: t.booking_status ?? 'confirmed',
    art: t.art === 'anstehend' ? 'anstehend' : 'verbuchen',
    darf_verbuchen: t.darf_verbuchen === true,
  } : null,
});

/** Eine Zeile aus `termine` (offen oder anstehend). */
const ausTermin = (t: PersonTermin): EventZeile => ({
  schluessel: `b-${t.booking_id}`,
  event_id: t.event_id,
  name: t.event_name,
  datum: t.event_date,
  pflicht: false,
  konfirmation: false,
  abgesagt: false,
  art: t.art,
  booking_status: t.booking_status,
  attendance_status: null,
  punkte: 0,
  punkteArt: null,
  von: null,
  termin: t,
});

/**
 * Die Eventliste einer Konfi. Mit `alleTermine` daraus; sonst wie bisher aus
 * `termine` (oben) und den Event-Punkten (verbucht), ohne Pflicht.
 */
export function konfiEventZeilen(
  alleTermine: readonly AlleTermineEintrag[] | null | undefined,
  termine: readonly PersonTermin[],
  eventPunkte: readonly EventPunkteEintrag[],
): EventZeile[] {
  if (Array.isArray(alleTermine)) return eventZeilenOrdnen(alleTermine.map(ausAllenTerminen));
  const offen = new Set(termine.map((t) => t.event_id));
  const verbucht: EventZeile[] = eventPunkte
    .filter((e) => !offen.has(e.event_id))
    .map((e) => ({
      schluessel: `p-${e.id}`,
      event_id: e.event_id,
      name: e.event_name || 'Event',
      datum: punkteAnzeigeDatum(e),
      pflicht: false,
      konfirmation: false,
      abgesagt: false,
      art: 'erledigt',
      booking_status: null,
      attendance_status: null,
      punkte: e.points || 0,
      punkteArt: e.point_type ?? null,
      von: e.admin_name ?? null,
      termin: null,
    }));
  return eventZeilenOrdnen([...termine.map(ausTermin), ...verbucht]);
}

/**
 * Die Eventliste einer Teamer:in: alle Buchungen (`teamerEvents`), offene und
 * anstehende mit Buchung und Recht aus `termine`. Was in `termine` steht,
 * gilt fuer die Art; sonst ist ein kuenftiger Termin mit Buchung anstehend.
 */
export function teamerEventZeilen(
  teamerEvents: readonly TeamerTermin[],
  termine: readonly PersonTermin[],
  jetzt: number = Date.now(),
): EventZeile[] {
  const jeEvent = new Map(termine.map((t) => [t.event_id, t]));
  const zeilen: EventZeile[] = teamerEvents.map((e) => {
    const termin = jeEvent.get(e.id) ?? null;
    const kuenftig = zeit(e.event_date) >= jetzt;
    const art: EventZeile['art'] = termin
      ? termin.art
      : kuenftig && ['confirmed', 'waitlist', 'pending'].includes(e.booking_status) ? 'anstehend' : 'erledigt';
    return {
      schluessel: `e-${e.id}`,
      event_id: e.id,
      name: e.name,
      datum: e.event_date,
      pflicht: false,
      konfirmation: false,
      abgesagt: false,
      art,
      booking_status: e.booking_status,
      attendance_status: e.attendance_status ?? null,
      punkte: 0,
      punkteArt: null,
      von: null,
      termin,
    };
  });
  // Ein Termin aus `termine`, der in teamerEvents fehlt (gemerkter Stand), steht trotzdem da.
  const bekannt = new Set(teamerEvents.map((e) => e.id));
  for (const t of termine) if (!bekannt.has(t.event_id)) zeilen.push(ausTermin(t));
  return eventZeilenOrdnen(zeilen);
}
