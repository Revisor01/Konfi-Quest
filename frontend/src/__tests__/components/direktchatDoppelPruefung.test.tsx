// Beim Typisieren aufgefallen (30.08.2026): SimpleCreateChatModal prüfte vor
// dem Anlegen eines Direktchats, ob schon einer existiert -- über
// `chat.participants` der Raumliste. GET /chat/rooms liefert dieses Feld aber
// gar nicht (nur participant_count). Die Prüfung war damit immer false, der
// Hinweis "Chat existiert bereits" erschien nie.
//
// Gebraucht wird sie auch nicht: POST /chat/direct gibt einen bestehenden Raum
// mit created:false zurück, und der Dialog öffnet einfach diesen Raum.
//
// Seit dem 09.10.2026 gerendert: Der Dialog lädt die Raumliste nicht, fragt
// nicht nach und öffnet den Raum, den der Server nennt. Die Server-Hälfte
// (Raumliste ohne Teilnehmerliste, bestehender Raum mit created:false, kein
// zweiter) prüft backend/tests/routes/chat.test.js an der Antwort.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { karteVon } from './rollenfarbePruefen';

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: (...a: unknown[]) => apiGet(...a), post: (...a: unknown[]) => apiPost(...a) },
}));
const setError = vi.fn();
let angemeldet: Record<string, unknown> = { id: 4, type: 'admin', role_name: 'admin', organization_id: 1 };
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: angemeldet, setError, setSuccess: vi.fn(), isOnline: true }),
}));
const zaehlerHolen = vi.fn(async () => {});
vi.mock('../../contexts/BadgeContext', () => ({ useBadge: () => ({ refreshFromAPI: zaehlerHolen }) }));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn(), haptik: vi.fn() }));
const presentAlert = vi.fn();
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  IonButton: ({ children, onClick, disabled, 'aria-label': name }: {
    children?: React.ReactNode; onClick?: () => void; disabled?: boolean; 'aria-label'?: string;
  }) => <button type="button" aria-label={name} onClick={onClick} disabled={disabled}>{children}</button>,
  useIonAlert: () => [presentAlert, vi.fn()],
}));

import SimpleCreateChatModal from '../../components/chat/modals/SimpleCreateChatModal';

const TEAM = [
  { id: 14, display_name: 'Lena Leitung', role_name: 'admin', role_description: 'Leitung' },
  { id: 13, display_name: 'Theo Teamer', role_name: 'teamer', role_description: 'Teamer:in' },
];
const KONTAKTE_DER_KONFI = {
  users: [
    { id: 14, name: 'Lena Leitung', type: 'admin', role_name: 'admin', role_description: 'Leitung', jahrgang_name: null },
  ],
  jahrgang: '2026',
};

const onSuccess = vi.fn();
const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  angemeldet = { id: 4, type: 'admin', role_name: 'admin', organization_id: 1 };
  apiGet.mockImplementation(async (pfad: string) => {
    if (pfad === '/chat/team-contacts') return { data: TEAM };
    if (pfad === '/admin/konfis') return { data: [] };
    if (pfad === '/users/me/jahrgaenge') return { data: [] };
    if (pfad === '/chat/available-users') return { data: KONTAKTE_DER_KONFI };
    // Die Raumliste: hier MIT einem bestehenden Direktchat samt Teilnehmern --
    // stuende die alte Pruefung noch, schlüge sie jetzt an.
    if (pfad === '/chat/rooms') return { data: [{ id: 99, type: 'direct', participants: [{ user_id: 14, user_type: 'admin' }] }] };
    return { data: [] };
  });
});
afterEach(() => cleanup());

const oeffne = async () => {
  render(<SimpleCreateChatModal onClose={onClose} onSuccess={onSuccess} />);
  for (let i = 0; i < 5; i += 1) await act(async () => { await Promise.resolve(); });
};
const antippen = async (name: string) => {
  await act(async () => { fireEvent.click(karteVon(name)); });
  for (let i = 0; i < 5; i += 1) await act(async () => { await Promise.resolve(); });
};

describe('Direktchat-Doppelpruefung im Chat-Anlegen-Dialog', () => {
  it('laedt die Raumliste nicht -- weder beim Oeffnen noch beim Antippen', async () => {
    apiPost.mockResolvedValue({ data: { room_id: 2, created: false } });
    await oeffne();
    await antippen('Lena Leitung');
    expect(apiGet.mock.calls.map(([pfad]) => pfad)).not.toContain('/chat/rooms');
  });

  it('bestehender Direktchat: kein "Chat existiert bereits", sondern der Raum des Servers oeffnet', async () => {
    apiPost.mockResolvedValue({ data: { room_id: 2, created: false } });
    await oeffne();
    await antippen('Lena Leitung');
    expect(presentAlert).not.toHaveBeenCalled();
    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost).toHaveBeenCalledWith('/chat/direct', { target_user_id: 14, target_user_type: 'admin' });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(2);
    expect(setError).not.toHaveBeenCalled();
  });

  it('neuer Direktchat: derselbe Weg, der neue Raum oeffnet', async () => {
    apiPost.mockResolvedValue({ data: { room_id: 41, created: true } });
    await oeffne();
    await antippen('Theo Teamer');
    expect(apiPost).toHaveBeenCalledWith('/chat/direct', { target_user_id: 13, target_user_type: 'teamer' });
    expect(onSuccess).toHaveBeenCalledWith(41);
    expect(zaehlerHolen).toHaveBeenCalledTimes(1);
  });

  it('auch als Konfi: kein Abgleich mit der Raumliste, kein Hinweis', async () => {
    angemeldet = { id: 1, type: 'konfi', role_name: 'konfi', organization_id: 1 };
    apiPost.mockResolvedValue({ data: { room_id: 2, created: false } });
    await oeffne();
    await antippen('Lena Leitung');
    expect(apiGet.mock.calls.map(([pfad]) => pfad)).not.toContain('/chat/rooms');
    expect(presentAlert).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(2);
  });
});
