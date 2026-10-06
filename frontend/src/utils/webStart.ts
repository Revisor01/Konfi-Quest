// Rechenhilfen der Web-Fassung von Start, Badges und Profil (03.10.2026,
// docs/planung/web-alle-bereiche.md, Entscheidung 6). Reine Funktionen, damit
// die Web-Komponenten nur noch darstellen und die Regeln sich ohne Bildschirm
// prüfen lassen.
//
// Die Daten selbst kommen aus denselben Abrufen wie in der App; hier steht nur,
// wie sie fürs breite Fenster aufbereitet werden -- Restzeit einer Challenge,
// die Zeile eines Events, die Auswahl der Rangliste, Prozente von Zielen.

import { datumKurz, uhrzeit } from './dateUtils';
import { istAbgesagt, tageBis } from '../components/shared/eventFormatting';
import type { RankingEntry, RankingZeile } from '../types/dashboard';
import type { Event } from '../types/event';

/** Wie lange eine Challenge noch läuft: „noch 3 Tage", „noch 1 Stunde", „endet heute". */
export const challengeRestzeit = (endsAt: string | null | undefined, jetzt: number = Date.now()): string => {
  const diff = new Date(endsAt ?? '').getTime() - jetzt;
  if (Number.isNaN(diff) || diff <= 0) return 'Zeit abgelaufen';
  const tage = Math.floor(diff / 86_400_000);
  if (tage >= 1) return tage === 1 ? 'noch 1 Tag' : `noch ${tage} Tage`;
  const stunden = Math.floor(diff / 3_600_000);
  if (stunden >= 1) return stunden === 1 ? 'noch 1 Stunde' : `noch ${stunden} Stunden`;
  return 'endet heute';
};

/** Anteil eines Ziels in Prozent, ohne Obergrenze (über das Ziel hinaus sind es mehr als 100). Ohne Ziel: 0. */
export const zielProzent = (wert: number, ziel: number): number => {
  if (!(ziel > 0) || !Number.isFinite(wert)) return 0;
  return Math.max(0, Math.round((wert / ziel) * 100));
};

/** Ist etwas jünger als eine Woche? Maßstab für „neu" bei Badges des Teams. */
export const istNeu = (zeitpunkt: string | null | undefined, jetzt: number = Date.now()): boolean => {
  if (!zeitpunkt) return false;
  const t = new Date(zeitpunkt).getTime();
  return !Number.isNaN(t) && jetzt - t < 7 * 24 * 60 * 60 * 1000;
};

/** Ein Event so aufbereitet, wie es die Karte „Deine Events" zeigt. */
export interface StartEvent {
  id: number;
  titel: string;
  /** ISO-Zeitpunkt des Beginns (für den Datumsblock und die Sortierung). */
  beginn: string;
  /** „Mo., 14.09.2026" */
  datum: string;
  /** „16:00" oder „16:00 – 17:30" bei einem gebuchten Zeitfenster. */
  zeit: string;
  ort: string | null;
  mitbringen: string | null;
  status: 'dabei' | 'warteliste' | 'abgesagt';
  /** Platz auf der Warteliste, wenn bekannt. */
  wartePlatz: number | null;
  /** Der Grund einer Absage, wenn es einen gibt. */
  grund: string | null;
  /** Kalendertage bis zum Beginn (0 = heute); negativ, wenn schon begonnen. */
  tage: number;
}

export const startEvent = (event: Event, jetzt: Date = new Date()): StartEvent => {
  const beginn = event.event_date || event.date || '';
  const zeitfenster = event.booked_timeslot_start
    ? `${uhrzeit(event.booked_timeslot_start)}${event.booked_timeslot_end ? ` – ${uhrzeit(event.booked_timeslot_end)}` : ''}`
    : uhrzeit(beginn);
  const warteliste = event.booking_status === 'waitlist' || event.booking_status === 'pending';
  return {
    id: event.id,
    titel: event.title || event.name || '',
    beginn,
    datum: datumKurz(beginn, { mitWochentag: true }),
    zeit: zeitfenster,
    ort: event.location?.trim() || null,
    mitbringen: event.bring_items?.trim() || null,
    status: istAbgesagt(event) ? 'abgesagt' : warteliste ? 'warteliste' : 'dabei',
    wartePlatz: warteliste && typeof event.waitlist_position === 'number' ? event.waitlist_position : null,
    grund: event.cancelled_reason?.trim() || null,
    tage: beginn ? tageBis(new Date(beginn), jetzt) : 0,
  };
};

const MONATE_KURZ = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];

/**
 * Die drei Zeilen des Datumsblocks vor einem Event: „Mo.", „14", „Sept.". Das
 * Datum kommt wie überall aus datumKurz (utils/dateUtils.ts), nur der Monat
 * wird als Wort aus der Zahl gelesen.
 */
export const datumsBlock = (zeitpunkt: string): { wochentag: string; tag: string; monat: string } | null => {
  const treffer = /^(\S+),\s*(\d{2})\.(\d{2})\./.exec(datumKurz(zeitpunkt, { mitWochentag: true }));
  if (!treffer) return null;
  return { wochentag: treffer[1], tag: String(Number(treffer[2])), monat: MONATE_KURZ[Number(treffer[3]) - 1] ?? '' };
};

/** „heute", „morgen", „in 3 Tagen", „in 2 Wochen" -- die Nähe eines Events in einem Wort. */
export const naehe = (tage: number): string => {
  if (tage < 0) return 'läuft';
  if (tage === 0) return 'heute';
  if (tage === 1) return 'morgen';
  if (tage < 14) return `in ${tage} Tagen`;
  if (tage < 60) return `in ${Math.floor(tage / 7)} Wochen`;
  return `in ${Math.round(tage / 30)} Monaten`;
};

/**
 * Welche Plätze die Rangliste der Startseite zeigt -- dieselbe Auswahl wie die
 * Karte der App (DashboardSections, RankingSection): Platz 1 immer; steht man
 * auf Platz 1 bis 3, folgen die Plätze 2 und 3 aus der Liste des Servers;
 * steht man weiter hinten, folgen ein Trenner und der Platz davor, die eigene
 * Zeile und der Platz danach. Die Punkte der Nachbarn kennt der Server nicht,
 * dort steht nur der Platz.
 */
export const rangAuswahl = (opt: {
  ranking: readonly RankingEntry[];
  eigenerPlatz: number;
  gesamtImJahrgang: number;
  konfiId: number;
  konfiName: string;
  konfiPunkte: number;
  initialen: (name: string) => string;
}): RankingZeile[] => {
  const { ranking, eigenerPlatz, gesamtImJahrgang, konfiId, konfiName, konfiPunkte, initialen } = opt;
  const zeilen: RankingZeile[] = [];
  if (ranking.length > 0) zeilen.push({ ...ranking[0], actualRank: 1 });

  if (eigenerPlatz > 3) {
    zeilen.push({ separator: true });
    const von = Math.max(1, eigenerPlatz - 1);
    const bis = Math.min(gesamtImJahrgang || eigenerPlatz, eigenerPlatz + 1);
    for (let platz = von; platz <= bis; platz++) {
      if (platz === eigenerPlatz) {
        zeilen.push({
          id: konfiId, display_name: konfiName, points: konfiPunkte, initials: initialen(konfiName),
          actualRank: platz, isCurrentUser: true,
        });
      } else {
        zeilen.push({
          id: `neighbor-${platz}`, display_name: platz === von ? 'Konfi vor dir' : 'Konfi nach dir', points: null,
          initials: '', actualRank: platz, isNeighbor: true,
        });
      }
    }
  } else {
    for (let i = 1; i < Math.min(3, ranking.length); i++) zeilen.push({ ...ranking[i], actualRank: i + 1 });
  }
  return zeilen;
};
