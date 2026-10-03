// Die Regeln der Raumliste (components/chat/chatRaeume.ts): Team-Chat, Farbe,
// Art, Anzeigename, Reiter, Reihenfolge, Zeit und letzte Nachricht. Die App-
// Uebersicht und die Raumliste der Web-Fassung lesen dieselben Funktionen.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { ChatRoomOverview } from '../../../types/chat';
import {
  bereinigeRaeume,
  istTeamChat,
  letzteNachrichtText,
  mitgliederText,
  raeumeFiltern,
  raumAnzeigeName,
  raumArt,
  raumArtMessenger,
  raumFarbe,
  zeitImMessenger,
  zeitKurz,
} from '../../../components/chat/chatRaeume';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

const raum = (id: number, name: string, zusatz: Partial<ChatRoomOverview> = {}): ChatRoomOverview => ({
  id, name, type: 'group', unread_count: 0, ...zusatz,
});
const um = (iso: string, zusatz = {}) => ({ content: 'Hallo', sender_name: 'Kim Muster', created_at: iso, ...zusatz });

const JAHRGANG = raum(1, 'Jahrgang 2026/27', { type: 'jahrgang' });
const TEAMGRUPPE = raum(2, 'Leitungsrunde', { type: 'admin' });
const REINE_TEAMGRUPPE = raum(3, 'Andachtsteam', { type: 'group', is_team_only: true });
const KONFIGRUPPE = raum(4, 'Packliste', { type: 'group' });
const DIREKT_TEAMER = raum(5, 'direkt', { type: 'direct', partner_user_type: 'teamer' });
const DIREKT_KONFI = raum(6, 'direkt', { type: 'direct', partner_user_type: 'konfi' });
const EVENT = raum(7, 'Konfi-Tag - Chat', { type: 'group', event_id: 12 });

describe('Team-Chat, Farbe und Art', () => {
  it('Team-Chats: ausdrueckliche Team-Gruppe, reine Team-Gruppe und Direktchat mit einer Teamer:in -- nie Event-Chats, nie Konfi-Chats', () => {
    expect([JAHRGANG, TEAMGRUPPE, REINE_TEAMGRUPPE, KONFIGRUPPE, DIREKT_TEAMER, DIREKT_KONFI, EVENT].map(istTeamChat))
      .toEqual([false, true, true, false, true, false, false]);
    // Auch ein Event-Chat mit Team-Typ bleibt ein Event-Chat.
    expect(istTeamChat(raum(8, 'x', { type: 'admin', event_id: 1 }))).toBe(false);
    // Direktchat mit der Leitung zaehlt zum Team.
    expect(istTeamChat(raum(9, 'direkt', { type: 'direct', partner_user_type: 'admin' }))).toBe(true);
  });

  it('die Farbe folgt der Art: Event rot, Jahrgang tuerkis, Team pink, Gruppe orange, Konfi-Direktchat lila', () => {
    expect([EVENT, JAHRGANG, TEAMGRUPPE, DIREKT_TEAMER, KONFIGRUPPE, DIREKT_KONFI].map(raumFarbe))
      .toEqual(['events', 'chat-jahrgang', 'team', 'team', 'group', 'konfi']);
  });

  it('die Art als Wort -- und in der Messenger-Fassung mit "Team" fuer Team-Chats', () => {
    expect([EVENT, JAHRGANG, TEAMGRUPPE, KONFIGRUPPE, DIREKT_KONFI].map(raumArt))
      .toEqual(['Event', 'Jahrgang', 'Gruppe', 'Gruppe', 'Direkt']);
    expect([EVENT, JAHRGANG, TEAMGRUPPE, REINE_TEAMGRUPPE, KONFIGRUPPE, DIREKT_TEAMER, DIREKT_KONFI].map(raumArtMessenger))
      .toEqual(['Event', 'Jahrgang', 'Team', 'Team', 'Gruppe', 'Team · Direkt', 'Direkt']);
  });
});

describe('Anzeigename', () => {
  it('Direktchat: der Name der anderen Person, nicht der eigene', () => {
    const direkt = raum(5, 'direkt-1-2', {
      type: 'direct',
      participants: [
        { user_id: 1, user_type: 'konfi', name: 'Ich' },
        { user_id: 40, user_type: 'teamer', name: 'tom', display_name: 'Tom Teamer' },
      ],
    });
    expect(raumAnzeigeName(direkt, 1)).toBe('Tom Teamer');
    expect(raumAnzeigeName(direkt, 40)).toBe('Ich');
    // Ohne geladene Teilnehmer der Raumname, ohne den auch ein Platzhalter.
    expect(raumAnzeigeName(raum(6, 'direkt-1-3', { type: 'direct' }), 1)).toBe('direkt-1-3');
    expect(raumAnzeigeName(raum(6, '', { type: 'direct' }), 1)).toBe('Direktchat');
  });

  it('Event-Chat: "Event: " und ohne das Anhaengsel " - Chat"; sonst der Raumname, notfalls "Chat"', () => {
    expect(raumAnzeigeName(EVENT, 1)).toBe('Event: Konfi-Tag');
    expect(raumAnzeigeName(JAHRGANG, 1)).toBe('Jahrgang 2026/27');
    expect(raumAnzeigeName(raum(9, ''), 1)).toBe('Chat');
  });
});

describe('Raeume bereinigen und filtern', () => {
  it('ein beschaedigter Cache legt die Liste nicht lahm: kein Array wird leer, kaputte Eintraege fallen weg, Felder bekommen Form', () => {
    expect(bereinigeRaeume(null as unknown as ChatRoomOverview[])).toEqual([]);
    expect(bereinigeRaeume({ foo: 1 } as unknown as ChatRoomOverview[])).toEqual([]);
    const raw = [null, { name: 'ohne id' }, { id: 3, name: 7, participant_count: -4, participants: 'x' }] as unknown as ChatRoomOverview[];
    expect(bereinigeRaeume(raw)).toEqual([{ id: 3, name: '', participant_count: 0, participants: [] }]);
    expect(bereinigeRaeume([{ ...JAHRGANG, participant_count: 38 }])[0].participant_count).toBe(38);
  });

  const alle = [
    { ...JAHRGANG, last_message: um('2026-10-03T08:00:00Z') },
    { ...TEAMGRUPPE, last_message: um('2026-10-03T10:00:00Z') },
    { ...DIREKT_TEAMER, last_message: um('2026-10-03T09:00:00Z') },
    { ...KONFIGRUPPE, last_message: um('2026-10-03T11:00:00Z') },
    { ...REINE_TEAMGRUPPE, last_message: um('2026-10-03T07:00:00Z') },
    raum(10, 'Ohne Nachricht', { type: 'group' }),
  ];
  const ids = (liste: ChatRoomOverview[]) => liste.map((r) => r.id);

  it('aktuellster Chat oben (nach letzter Nachricht), Raeume ohne Nachricht unten', () => {
    expect(ids(raeumeFiltern(alle, { suche: '', filter: 'alle', ungelesen: {} }))).toEqual([4, 2, 5, 1, 3, 10]);
  });

  it('Reiter Konfis: Jahrgang und Gruppen ohne reine Team-Gruppen; Reiter Team: Team-Gruppen und Direktchats mit dem Team', () => {
    expect(ids(raeumeFiltern(alle, { suche: '', filter: 'konfis', ungelesen: {} }))).toEqual([4, 1, 10]);
    expect(ids(raeumeFiltern(alle, { suche: '', filter: 'team', ungelesen: {} }))).toEqual([2, 5, 3]);
  });

  it('Reiter Ungelesen: genau die Raeume mit roter Zahl', () => {
    expect(ids(raeumeFiltern(alle, { suche: '', filter: 'ungelesen', ungelesen: { 1: 3, 5: 1, 4: 0 } }))).toEqual([5, 1]);
    expect(raeumeFiltern(alle, { suche: '', filter: 'ungelesen', ungelesen: {} })).toEqual([]);
  });

  it('die Suche ignoriert Gross- und Kleinschreibung und wirkt zusammen mit dem Reiter', () => {
    expect(ids(raeumeFiltern(alle, { suche: 'LEITUNG', filter: 'alle', ungelesen: {} }))).toEqual([2]);
    expect(ids(raeumeFiltern(alle, { suche: 'liste', filter: 'team', ungelesen: {} }))).toEqual([]);
    expect(ids(raeumeFiltern(alle, { suche: 'liste', filter: 'konfis', ungelesen: {} }))).toEqual([4]);
  });

  it('das Filtern aendert die Eingabe nicht (die Liste im Zustand bleibt, wie sie ist)', () => {
    const kopie = alle.map((r) => r.id);
    raeumeFiltern(alle, { suche: '', filter: 'alle', ungelesen: {} });
    expect(alle.map((r) => r.id)).toEqual(kopie);
  });
});

describe('Zeit der letzten Nachricht', () => {
  const jetzt = new Date('2026-10-03T10:30:00+02:00');

  it('App-Liste: Jetzt, Minuten, Stunden, Tage', () => {
    expect(zeitKurz('2026-10-03T10:29:40+02:00', jetzt)).toBe('Jetzt');
    expect(zeitKurz('2026-10-03T10:12:00+02:00', jetzt)).toBe('18m');
    expect(zeitKurz('2026-10-03T07:30:00+02:00', jetzt)).toBe('3h');
    expect(zeitKurz('2026-10-01T10:30:00+02:00', jetzt)).toBe('2d');
    expect(zeitKurz(undefined, jetzt)).toBe('');
    expect(zeitKurz('kein-datum', jetzt)).toBe('');
  });

  it('Messenger: heute die Uhrzeit, gestern "Gestern", sonst das Datum -- ohne Jahr im laufenden Jahr', () => {
    expect(zeitImMessenger('2026-10-03T08:10:00+02:00', jetzt)).toBe('08:10');
    expect(zeitImMessenger('2026-10-02T23:59:00+02:00', jetzt)).toBe('Gestern');
    expect(zeitImMessenger('2026-09-28T12:00:00+02:00', jetzt)).toBe('28.09.');
    expect(zeitImMessenger('2025-12-24T12:00:00+01:00', jetzt)).toBe('24.12.2025');
    expect(zeitImMessenger(undefined, jetzt)).toBe('');
    expect(zeitImMessenger('kein-datum', jetzt)).toBe('');
  });

  it('"Gestern" gilt auch ueber einen Monatswechsel', () => {
    expect(zeitImMessenger('2026-09-30T20:00:00+02:00', new Date('2026-10-01T09:00:00+02:00'))).toBe('Gestern');
  });
});

describe('letzte Nachricht in der Liste', () => {
  const mit = (letzte: ChatRoomOverview['last_message'], zusatz: Partial<ChatRoomOverview> = {}) => raum(1, 'x', { last_message: letzte, ...zusatz });

  it('App-Liste (ohne eigenen Namen): immer mit dem Namen des Absenders; Datei ohne Text zeigt den Dateinamen', () => {
    expect(letzteNachrichtText(mit(um('2026-10-03T08:00:00Z', { content: 'Bis morgen!' })))).toEqual({ absender: 'Kim Muster', text: 'Bis morgen!' });
    expect(letzteNachrichtText(mit(um('2026-10-03T08:00:00Z', { content: '', file_name: 'foto.png' })))).toEqual({ absender: 'Kim Muster', text: 'foto.png' });
  });

  it('Messenger: die eigene Nachricht als "Du", in Direktchats nur der Text der anderen Person', () => {
    const eigene = mit(um('2026-10-03T08:00:00Z', { sender_name: 'Alex Beispiel' }));
    expect(letzteNachrichtText(eigene, 'Alex Beispiel')).toEqual({ absender: 'Du', text: 'Hallo' });
    expect(letzteNachrichtText(mit(um('2026-10-03T08:00:00Z')), 'Alex Beispiel')).toEqual({ absender: 'Kim Muster', text: 'Hallo' });
    expect(letzteNachrichtText(mit(um('2026-10-03T08:00:00Z'), { type: 'direct' }), 'Alex Beispiel')).toEqual({ absender: '', text: 'Hallo' });
    // Auch im Direktchat bleibt die eigene Nachricht als "Du" kenntlich.
    expect(letzteNachrichtText(mit(um('2026-10-03T08:00:00Z', { sender_name: 'Alex Beispiel' }), { type: 'direct' }), 'Alex Beispiel')).toEqual({ absender: 'Du', text: 'Hallo' });
  });

  it('ohne Nachricht, oder ohne Text und Datei: nichts', () => {
    expect(letzteNachrichtText(raum(1, 'x'))).toBeNull();
    expect(letzteNachrichtText(mit(um('2026-10-03T08:00:00Z', { content: '' })))).toBeNull();
  });
});

describe('Mitglieder im Kopf des Raums', () => {
  const p = (id: number, name: string) => ({ user_id: id, user_type: 'konfi' as const, name, display_name: name });

  it('Direktchat: nur die Art; Gruppe: Namen der anderen und die Zahl der weiteren', () => {
    expect(mitgliederText({ type: 'direct' }, 1, 'Team · Direkt')).toBe('Team · Direkt');
    const viele = [p(1, 'Ich'), p(2, 'Kim'), p(3, 'Sam'), p(4, 'Robin'), p(5, 'Jules'), p(6, 'Lena')];
    expect(mitgliederText({ type: 'group', participants: viele, participant_count: 6 }, 1, 'Gruppe'))
      .toBe('Gruppe · Kim, Sam, Robin und 2 weitere');
    // Die Zahl aus der Liste gewinnt, wenn der Raum nur einen Teil der Teilnehmer mitbringt.
    expect(mitgliederText({ type: 'jahrgang', participants: viele.slice(0, 4), participant_count: 38 }, 1, 'Jahrgang'))
      .toBe('Jahrgang · Kim, Sam, Robin und 34 weitere');
  });

  it('wenige Mitglieder: alle genannt, ohne "und"; ohne Namen die Zahl, im Singular wo noetig', () => {
    expect(mitgliederText({ type: 'group', participants: [p(1, 'Ich'), p(2, 'Kim')], participant_count: 2 }, 1, 'Gruppe')).toBe('Gruppe · Kim');
    expect(mitgliederText({ type: 'group', participant_count: 24 }, 1, 'Gruppe')).toBe('Gruppe · 24 Mitglieder');
    expect(mitgliederText({ type: 'group', participant_count: 1 }, 1, 'Gruppe')).toBe('Gruppe · 1 Mitglied');
    expect(mitgliederText({ type: 'group' }, 1, 'Gruppe')).toBe('Gruppe');
  });
});
