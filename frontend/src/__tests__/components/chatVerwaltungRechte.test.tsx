// Verwaltung im Chatraum (useChatVerwaltung): wer exportieren, verlassen und
// den Team-Chat leeren darf -- als Verhalten des echten Hooks geprueft
// (Audit Tests 26.09.2026, BF-02). Ersetzt superAdminChatGate.test.ts, das
// dieselben Regeln als Zeichenketten im Quelltext suchte.
//
// Die Regeln:
//   - Export: Leitung, auch super_admin (organisationsuebergreifend).
//   - Team-Chat leeren: nur admin und org_admin -- NICHT super_admin. Der
//     Server laesst ihn nicht durch (chat.test.js, "super_admin (Rolle)
//     bekommt 403"); ein Muelleimer fuer ihn endete mit 403 (26.08.2026).
//   - Verlassen: nie fuer die Leitung; Konfis nicht aus Event-Chats; sonst
//     Gruppen- und Team-Chats, keine Jahrgangs- und Direktchats.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ChatRoomBase } from '../../types/chat';

interface Knopf { text: string; role?: string; handler?: () => unknown }
let blatt: { header?: string; buttons: Knopf[] } | null = null;
let alert: { header?: string; buttons: Knopf[] } | null = null;
vi.mock('@ionic/react', () => ({
  useIonActionSheet: () => [(o: typeof blatt) => { blatt = o; }],
  useIonAlert: () => [(o: typeof alert) => { alert = o; }],
}));
type Nutzer = { type: 'admin' | 'teamer' | 'konfi'; role_name: string };
let nutzer: Nutzer = { type: 'admin', role_name: 'org_admin' };
let online = true;
const setError = vi.fn();
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ user: nutzer, setError, isOnline: online }) }));
const apiDelete = vi.fn(async (_url: string) => ({ data: {} }));
vi.mock('../../services/api', () => ({ default: { delete: (url: string) => apiDelete(url) } }));
const exportieren = vi.fn(async () => undefined);
vi.mock('../../components/chat/chatTeilen', () => ({ chatVerlaufExportieren: () => exportieren() }));

import { useChatVerwaltung } from '../../components/chat/useChatVerwaltung';

const TEAMCHAT: ChatRoomBase = { id: 50, name: 'Team', type: 'admin', is_team_chat: true };
const onBack = vi.fn();
const setMessages = vi.fn();
const refreshMessagesCache = vi.fn();

const starte = (room: ChatRoomBase | null = TEAMCHAT) => renderHook(() => useChatVerwaltung({
  room, onBack, getDisplayRoomName: () => room?.name ?? '', setMessages, refreshMessagesCache,
})).result.current;
const texte = () => blatt?.buttons.map((b) => b.text);

beforeEach(() => {
  vi.clearAllMocks();
  blatt = null;
  alert = null;
  online = true;
  nutzer = { type: 'admin', role_name: 'org_admin' };
});

describe('Team-Chat leeren und exportieren je Rolle', () => {
  it.each([
    ['org_admin', true, true],
    ['admin', true, true],
    ['super_admin', false, true],
  ])('Leitung %s: leeren %s, exportieren %s', (rolle, leeren, export_) => {
    nutzer = { type: 'admin', role_name: rolle };
    const v = starte();
    expect(v.darfTeamChatLeeren).toBe(leeren);
    expect(v.istLeitung).toBe(export_);
    v.handleChatOptions();
    expect(texte()).toEqual(['Chat-Verlauf exportieren', 'Abbrechen']);
  });

  it.each(['teamer', 'konfi'] as const)('%s: weder leeren noch exportieren', (typ) => {
    nutzer = { type: typ, role_name: typ };
    const v = starte();
    expect(v.darfTeamChatLeeren).toBe(false);
    expect(v.istLeitung).toBe(false);
    v.handleChatOptions();
    expect(texte()).not.toContain('Chat-Verlauf exportieren');
  });

  it('Leeren fragt nach und loescht erst nach "Endgültig leeren"', async () => {
    const v = starte();
    v.handleClearChat();
    expect(alert?.header).toBe('Team-Chat leeren?');
    expect(apiDelete).not.toHaveBeenCalled();
    await act(async () => { await alert?.buttons.find((b) => b.text === 'Endgültig leeren')?.handler?.(); });
    expect(apiDelete).toHaveBeenCalledWith('/chat/rooms/50/messages');
    expect(setMessages).toHaveBeenCalledWith([]);
    expect(refreshMessagesCache).toHaveBeenCalledTimes(1);
  });

  it('offline wird nichts geleert und keine Rueckfrage geoeffnet', () => {
    online = false;
    const v = starte();
    v.handleClearChat();
    expect(alert).toBe(null);
    expect(setError).toHaveBeenCalledTimes(1);
  });

  it('der Export ruft den gemeinsamen Export', async () => {
    const v = starte();
    v.handleChatOptions();
    await act(async () => { await blatt?.buttons.find((b) => b.text === 'Chat-Verlauf exportieren')?.handler?.(); });
    expect(exportieren).toHaveBeenCalledTimes(1);
  });
});

describe('Chat verlassen', () => {
  const GRUPPE: ChatRoomBase = { id: 8, name: 'Freizeit', type: 'group' };
  const EVENTCHAT: ChatRoomBase = { id: 9, name: 'Ausflug - Chat', type: 'group', event_id: 3 };
  const JAHRGANG: ChatRoomBase = { id: 10, name: 'Jahrgang', type: 'jahrgang' };
  const DIREKT: ChatRoomBase = { id: 11, name: 'Kim', type: 'direct' };

  it.each([
    ['admin', 'org_admin', GRUPPE, false],
    ['teamer', 'teamer', GRUPPE, true],
    ['teamer', 'teamer', TEAMCHAT, true],
    ['teamer', 'teamer', EVENTCHAT, true],
    ['konfi', 'konfi', GRUPPE, true],
    ['konfi', 'konfi', EVENTCHAT, false],
    ['konfi', 'konfi', JAHRGANG, false],
    ['teamer', 'teamer', DIREKT, false],
  ] as const)('%s (%s) in %o: darf verlassen = %s', (typ, rolle, raum, darf) => {
    nutzer = { type: typ, role_name: rolle };
    const v = starte(raum);
    expect(v.canLeaveChat()).toBe(darf);
    v.handleChatOptions();
    expect(texte()?.includes('Chat verlassen')).toBe(darf);
  });

  it('Verlassen fragt nach, verlaesst den Raum und geht zurueck', async () => {
    nutzer = { type: 'teamer', role_name: 'teamer' };
    const v = starte(GRUPPE);
    v.handleChatOptions();
    act(() => { blatt?.buttons.find((b) => b.text === 'Chat verlassen')?.handler?.(); });
    expect(alert?.header).toBe('Chat verlassen');
    await act(async () => { await alert?.buttons.find((b) => b.text === 'Verlassen')?.handler?.(); });
    expect(apiDelete).toHaveBeenCalledWith('/chat/rooms/8/leave');
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
