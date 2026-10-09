// Chat-Übersicht aller Rollen (/konfi/chat, /teamer/chat, /admin/chat): die Reiter über den Räumen.
// App: components/chat/ChatOverview.tsx. Web: components/chat/web/WebChatListe.tsx.
// Gefiltert wird für beide in components/chat/chatRaeume.ts (raeumeFiltern),
// das die Prädikate von hier liest; Zustand und Daten aus useChatUebersicht.
//
// Reihenfolge in beiden Fassungen: erst die Reiter, darunter die Suche --
// „dann filtert man erst und dann sucht man" (Simon, 06.09.2026).

import { wahlen } from './beschreibung';

/** Was ein Reiter von einem Raum wissen muss. */
export interface ChatEintrag {
  type: string;
  /** Ungelesene: die Zahl aus dem Kontext, sonst die des Servers -- dieselbe wie die rote Zahl am Raum. */
  ungelesen: number;
  /** Team-Chat (chatRaeume.ts: istTeamChat). */
  teamChat: boolean;
}

export const CHAT_REITER = wahlen([
  { schluessel: 'alle', label: 'Alle', passt: () => true },
  // „Wo muss ich ran?" -- genau die Räume mit roter Zahl.
  { schluessel: 'ungelesen', label: 'Ungelesen', passt: (r: ChatEintrag) => r.ungelesen > 0 },
  // Jahrgangs- und Gruppenchats mit Konfis, keine reinen Team-Gruppen.
  { schluessel: 'konfis', label: 'Konfis', passt: (r: ChatEintrag) => (r.type === 'jahrgang' || r.type === 'group') && !r.teamChat },
  // Nur für Team, Leitung und Gemeindeleitung (chatReiterFuer).
  { schluessel: 'team', label: 'Team', passt: (r: ChatEintrag) => r.teamChat },
]);

export type ChatReiter = (typeof CHAT_REITER)[number]['schluessel'];

/** Die Reiter dieser Person: „Team" gibt es nur, wer zum Team gehört -- in beiden Fassungen gleich. */
export const chatReiterFuer = (gehoertZumTeam: boolean) =>
  CHAT_REITER.filter((r) => r.schluessel !== 'team' || gehoertZumTeam);

export const CHAT_REITER_BESCHRIFTUNG = 'Chats filtern';

/** Der Vorlesesatz zur roten Zahl am Reiter „Ungelesen" (nur im Browser trägt der Chip die Summe). */
export const CHAT_UNGELESEN_ZAHLTEXT = 'ungelesene Nachrichten';

/** Leerzustände: keine Räume überhaupt -- oder keine in Suche und Reiter. */
export const CHAT_LEER = {
  keine: { titel: 'Noch keine Chats', text: 'Starte deinen ersten Chat.' },
  gefiltert: { titel: 'Keine Chats gefunden', text: 'Passe die Suche oder den Reiter an.' },
} as const;
