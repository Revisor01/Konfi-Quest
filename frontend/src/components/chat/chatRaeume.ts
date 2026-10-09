import type { ChatParticipant, ChatRoomOverview } from '../../types/chat';
import { istTeamTyp } from '../../utils/chatRoles';
import { datumKurz, uhrzeit } from '../../utils/dateUtils';
import {
  ICON_CHATS_GEFUELLT,
  ICON_EINSTELLUNGEN_GEFUELLT,
  ICON_GRUPPE_GEFUELLT,
  ICON_PERSON_GEFUELLT,
  ICON_TERMIN_GEFUELLT,
} from '../shared/icons';
import { CHAT_REITER } from '../../seiten/chats';

/**
 * Die Regeln der Raumliste (beim Anlegen der Web-Fassung des Chats aus
 * ChatOverview.tsx hierher gezogen, Verhalten unveraendert): welcher Raum ein
 * Team-Chat ist, welche Farbe und Art er traegt, wie er heisst, welche Raeume
 * ein Reiter zeigt und in welcher Reihenfolge. Die App-Uebersicht und die
 * Raumliste der Web-Fassung lesen dieselben Funktionen -- ein Raum steht in
 * beiden unter demselben Reiter und mit derselben Farbe.
 */

/** Die Reiter der Raumliste. */
export type RaumFilter = 'alle' | 'ungelesen' | 'konfis' | 'team';

/** Farbklasse eines Raums (die Namen der app-Klassen: app-icon-circle--<farbe>). */
export type RaumFarbe = 'events' | 'chat-jahrgang' | 'team' | 'group' | 'konfi';

/**
 * Ist das ein Team-Chat (= pink, gehoert in den Reiter "Team")?
 * - Event-Chats nie
 * - Direktchat: Partner gehoert zum Team (partner_user_type 'admin' ODER 'teamer')
 * - type='admin': ausdrueckliche Team-Gruppe
 * - type='group': reiner Team-Gruppenchat (alle Teilnehmer Teamer:innen)
 * Konfi-Direktchats und gemischte/Konfi-Gruppen sind KEINE Team-Chats.
 *
 * chat_participants.user_type speichert 'teamer' als eigenen Wert (nicht als
 * 'admin'). Die Pruefung nur auf 'admin' sortierte Direktchats mit
 * Teamer:innen in den falschen Reiter.
 */
export const istTeamChat = (room: ChatRoomOverview): boolean => {
  if (room.event_id) return false;
  if (room.type === 'admin') return true;
  if (room.type === 'direct') return istTeamTyp(room.partner_user_type);
  if (room.type === 'group') return room.is_team_only === true;
  return false;
};

export const raumFarbe = (room: ChatRoomOverview): RaumFarbe => {
  if (room.event_id) return 'events';
  if (room.type === 'jahrgang') return 'chat-jahrgang';
  // Team-Chats (Team-Gruppe / Team-DM / reine Team-group) -> pink
  if (istTeamChat(room)) return 'team';
  switch (room.type) {
    case 'group': return 'group'; // gemischte/Konfi-Gruppe -> orange
    case 'direct': return 'konfi'; // Konfi-DM -> lila
    default: return 'konfi';
  }
};

/** Die Art eines Raums als Wort: Event, Jahrgang, Gruppe, Direkt. */
export const raumArt = (room: ChatRoomOverview): string => {
  if (room.event_id) return 'Event';
  if (room.type === 'jahrgang') return 'Jahrgang';
  if (room.type === 'admin' || room.type === 'group') return 'Gruppe';
  if (room.type === 'direct') return 'Direkt';
  return '';
};

/** Das Symbol im Kreis des Raums (gefuellte Fassung). */
export const raumSymbol = (room: ChatRoomOverview): string => {
  if (room.event_id) return ICON_TERMIN_GEFUELLT;
  switch (room.type) {
    case 'admin': return ICON_EINSTELLUNGEN_GEFUELLT;
    case 'jahrgang': return ICON_GRUPPE_GEFUELLT;
    case 'group': return ICON_CHATS_GEFUELLT;
    case 'direct': return ICON_PERSON_GEFUELLT;
    default: return ICON_CHATS_GEFUELLT;
  }
};

/**
 * Der Name, unter dem der Raum in der Liste steht. Direktchats zeigen den
 * Partner (nicht den eigenen Namen), Event-Chats tragen das Praefix.
 */
export const raumAnzeigeName = (room: ChatRoomOverview, userId: number | undefined): string => {
  if (room.type === 'direct') {
    // Den Partner per user_id finden, nicht per user_type: chat_participants.
    // user_type kennt drei Werte ('admin', 'teamer', 'konfi'); ein Vergleich
    // darauf ginge fehl.
    const partner = room.participants?.find(p => p.user_id !== userId);
    if (partner) return partner.display_name || partner.name || 'Unbekannt';
    // Fallback: room.name, wenn keine Teilnehmer geladen sind
    return room.name || 'Direktchat';
  }
  if (room.event_id) {
    const name = room.name?.replace(/ - Chat$/, '') || 'Event';
    return `Event: ${name}`;
  }
  return room.name || 'Chat';
};

/**
 * Defensiver Transform (Incident 13.06.2026): gecachte rooms-Responses koennen
 * kaputt/unplausibel sein (z.B. nach der Teilnehmer-Explosion oder bei einem
 * korrupten Cache-Eintrag). Statt beim Rendern zu crashen normalisieren wir:
 * kein Array -> [], jeder Eintrag bekommt garantiert name/type/
 * participant_count in sinnvoller Form. So kann kein einzelner Datensatz die
 * ganze Chat-Liste (und damit per ErrorBoundary die ganze App) lahmlegen.
 */
export const bereinigeRaeume = (raw: ChatRoomOverview[]): ChatRoomOverview[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(room => room && typeof room === 'object' && room.id != null)
    .map(room => ({
      ...room,
      name: typeof room.name === 'string' ? room.name : '',
      // participant_count defensiv: nur plausible Zahlen, sonst 0.
      // Verhindert, dass eine absurd grosse Zahl (Explosion) durchschlaegt.
      participant_count:
        typeof room.participant_count === 'number' && room.participant_count >= 0
          ? room.participant_count
          : 0,
      // participants-Array bleibt nur, wenn es wirklich ein Array ist
      participants: Array.isArray(room.participants) ? room.participants : [],
    }));
};

/** Ungelesene eines Raums: die Zahl des Kontexts, sonst die des Servers -- dieselbe wie die rote Zahl am Raum. */
export const ungelesenVonRaum = (room: Pick<ChatRoomOverview, 'id' | 'unread_count'>, ungelesen: Record<number, number>): number =>
  ungelesen[room.id] ?? room.unread_count ?? 0;

const zeitpunkt = (iso: string | undefined): number =>
  iso ? new Date(iso).getTime() : 0;

/**
 * Die Raeume eines Reiters nach Suchbegriff, aktuellster Chat oben (nach
 * letzter Nachricht) -- KEINE Gruppierung nach Team/Konfis; die Reiter
 * uebernehmen die Trennung, wenn man sie braucht.
 *
 * - ungelesen: "wo muss ich ran?" -- Raeume mit roter Zahl. Nach Chat-ART zu
 *   filtern hilft beim Wiederfinden kaum; dafuer gibt es die Suche.
 * - konfis: Jahrgangs-/Gruppenchats mit Konfis, KEINE reinen Team-Gruppen.
 * - team: Team-Gruppen, reine Team-group und Direktchats mit Teamer:innen.
 */
export const raeumeFiltern = (
  raeume: ChatRoomOverview[],
  { suche, filter, ungelesen }: { suche: string; filter: string; ungelesen: Record<number, number> },
): ChatRoomOverview[] =>
  raeume
    .filter(room => {
      if (!(room.name || '').toLowerCase().includes(suche.toLowerCase())) return false;
      // Die Praedikate stehen am Reiter (seiten/chats.ts). "Ungelesen" zaehlt
      // wie die rote Zahl am Raum: der Kontext, sonst die Zahl des Servers --
      // bis 09.10.2026 nur der Kontext, ein Raum mit roter Zahl fehlte dann im Reiter.
      const reiter = CHAT_REITER.find((r) => r.schluessel === filter);
      return reiter?.passt?.({ type: room.type, ungelesen: ungelesenVonRaum(room, ungelesen), teamChat: istTeamChat(room) }) ?? true;
    })
    .sort((a, b) => zeitpunkt(b.last_message?.created_at) - zeitpunkt(a.last_message?.created_at));

/** Zeit der letzten Nachricht in der App-Liste: Jetzt, 5m, 3h, 2d. */
export const zeitKurz = (dateString: string | undefined, jetzt: Date = new Date()): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const diffInHours = Math.floor((jetzt.getTime() - date.getTime()) / (1000 * 60 * 60));
  if (diffInHours < 1) {
    const diffInMinutes = Math.floor((jetzt.getTime() - date.getTime()) / (1000 * 60));
    return diffInMinutes < 1 ? 'Jetzt' : `${diffInMinutes}m`;
  }
  if (diffInHours < 24) return `${diffInHours}h`;
  return `${Math.floor(diffInHours / 24)}d`;
};

/**
 * Zeit der letzten Nachricht in der Raumliste der Web-Fassung, wie in einem
 * Messenger: heute die Uhrzeit, gestern "Gestern", sonst das Datum (ohne
 * Jahr, solange es das laufende ist).
 */
export const zeitImMessenger = (dateString: string | undefined, jetzt: Date = new Date()): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  if (date.toDateString() === jetzt.toDateString()) return uhrzeit(date);
  const gestern = new Date(jetzt);
  gestern.setDate(jetzt.getDate() - 1);
  if (date.toDateString() === gestern.toDateString()) return 'Gestern';
  return datumKurz(date, { ohneJahr: date.getFullYear() === jetzt.getFullYear() });
};

/**
 * Was in der Raumliste unter dem Namen steht: der Absender und der Text bzw.
 * der Dateiname der letzten Nachricht.
 *
 * App-Liste: immer mit Absendernamen. Messenger-Fassung (`eigenerName` gesetzt):
 * die eigene Nachricht als "Du", in Direktchats nur der Text der anderen Person
 * -- dort steht der Name ohnehin darueber.
 */
export const letzteNachrichtText = (
  room: ChatRoomOverview,
  eigenerName?: string,
): { absender: string; text: string } | null => {
  const letzte = room.last_message;
  if (!letzte || !(letzte.content || letzte.file_name)) return null;
  const text = letzte.content || letzte.file_name || 'Datei';
  if (eigenerName === undefined) return { absender: letzte.sender_name, text };
  if (eigenerName !== '' && letzte.sender_name === eigenerName) return { absender: 'Du', text };
  return { absender: room.type === 'direct' ? '' : letzte.sender_name, text };
};

/**
 * Die Art eines Raums in der Raumliste der Web-Fassung: Team-Chats tragen das
 * Wort "Team" (ein Team-Direktchat "Team · Direkt"), alle anderen ihre Art.
 * So sind Gruppen, Direktchats und Team auf einen Blick zu unterscheiden --
 * nicht nur an der Farbe des Kreises.
 */
export const raumArtMessenger = (room: ChatRoomOverview): string => {
  if (istTeamChat(room)) return room.type === 'direct' ? 'Team · Direkt' : 'Team';
  return raumArt(room);
};

/**
 * Die Zeile unter dem Namen im Kopf des Raums: die Art und wer dabei ist --
 * "Gruppe · Kim, Sam, Robin und 11 weitere". Ohne Namen (sie kommen nicht
 * mit jeder Antwort) steht die Zahl da; Direktchats nennen keine
 * Mitglieder, dort weiss man, mit wem man schreibt.
 */
export const mitgliederText = (
  room: { type: string; participants?: ChatParticipant[]; participant_count?: number },
  userId: number | undefined,
  art: string,
): string => {
  if (room.type === 'direct') return art;
  const andere = (room.participants ?? []).filter(p => p.user_id !== userId);
  const gesamt = Math.max(room.participant_count ?? 0, (room.participants ?? []).length);
  if (andere.length === 0) {
    return gesamt > 0 ? `${art} · ${gesamt} ${gesamt === 1 ? 'Mitglied' : 'Mitglieder'}` : art;
  }
  const namen = andere.slice(0, 3).map(p => p.display_name || p.name || 'Unbekannt');
  // Wer fehlt in der Aufzaehlung: die uebrigen anderen plus man selbst.
  const weitere = gesamt - namen.length - 1;
  return `${art} · ${namen.join(', ')}${weitere > 0 ? ` und ${weitere} weitere` : ''}`;
};
