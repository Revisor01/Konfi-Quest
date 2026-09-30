// Befund 12 aus dem Rollen-Bericht (26.08.2026): Die Mitgliederliste und der
// Umfrage-Knopf hingen am SELBEN isAdmin-Gate -- zwei verschiedene Rechte an
// einem Schalter.
//
// Das Backend gibt die Teilnehmerliste seit jeher JEDEM Raum-Mitglied frei
// (chat.js, geprueft wird nur darfRaumOeffnen), und das Handbuch verspricht
// sie den Konfis ausdruecklich: "In Gruppen siehst du, wer sonst noch dabei
// ist" (10-konfis.md). Nur die Oberflaeche versteckte sie -- Konfis und
// Teamer:innen sahen in Gruppen nicht, wer dabei ist.
//
// Wichtig beim Freigeben: Das Modal enthaelt AUCH Verwaltungsaktionen
// (Mitglied entfernen, hinzufuegen). Die haengen an einem eigenen Gate, das
// unabhaengig davon bestehen bleiben muss -- sonst haette das Oeffnen der
// Liste versehentlich die Verwaltung mit freigegeben.
//
// Gerendert: die Kopfzeile des Chatraums und das Mitglieder-Modal (Audit
// Tests 26.09.2026, BF-02; bis 30.09.2026 am Quelltext geprueft).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn(), delete: vi.fn() },
}));
let angemeldet: Record<string, unknown> = { id: 20, type: 'konfi', role_name: 'konfi', organization_id: 1 };
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: angemeldet, setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn(), haptik: vi.fn() }));
// Die Kopfzeile schlicht: was rechts steht, steht da.
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: ({ titel, rechts }: { titel?: string; rechts?: React.ReactNode }) => <header data-titel={titel}>{rechts}</header>,
  AppKopfzeileGross: () => null,
}));
// Knöpfe als <button>, damit sie über Rolle und Namen auffindbar sind.
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  IonButton: ({ children, onClick, disabled, 'aria-label': name }: {
    children?: React.ReactNode; onClick?: () => void; disabled?: boolean; 'aria-label'?: string;
  }) => <button type="button" aria-label={name} onClick={onClick} disabled={disabled}>{children}</button>,
  useIonAlert: () => [vi.fn(), vi.fn()],
}));

import { ChatHeader } from '../../components/chat/ChatRoomSections';
import MembersModal from '../../components/chat/modals/MembersModal';

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockImplementation(async (pfad: string) => {
    if (pfad === '/chat/rooms/5/participants') {
      return { data: [
        { user_id: 20, user_type: 'konfi', name: 'Emilia Test', joined_at: '2026-09-01T10:00:00Z' },
        { user_id: 4, user_type: 'admin', name: 'Anna Admin', role_name: 'admin', joined_at: '2026-09-01T10:00:00Z' },
      ] };
    }
    return { data: [] };
  });
});
afterEach(() => cleanup());

describe('Kopfzeile des Chatraums: Mitgliederliste und Umfrage sind getrennte Rechte', () => {
  const kopf = (roomType: string, isAdmin: boolean) => {
    const onOpenMembers = vi.fn();
    render(
      <ChatHeader roomName="Jahrgang 2026" roomType={roomType} isAdmin={isAdmin} canLeave={false} isOnline
        onBack={vi.fn()} onOpenMembers={onOpenMembers} onOpenPoll={vi.fn()} onLeaveChat={vi.fn()} />,
    );
    return { onOpenMembers };
  };
  const knopf = (name: string) => screen.queryByRole('button', { name });

  it('ohne Leitungsrecht: in der Gruppe die Mitgliederliste, aber keine Umfrage', () => {
    const { onOpenMembers } = kopf('group', false);
    fireEvent.click(knopf('Mitglieder anzeigen')!);
    expect(onOpenMembers).toHaveBeenCalledTimes(1);
    expect(knopf('Umfrage erstellen')).toBeNull();
  });

  it('auch im Jahrgangs-Chat sieht jedes Mitglied, wer dabei ist', () => {
    kopf('jahrgang', false);
    expect(knopf('Mitglieder anzeigen')).not.toBeNull();
  });

  it('die Leitung hat beides', () => {
    kopf('group', true);
    expect(knopf('Mitglieder anzeigen')).not.toBeNull();
    expect(knopf('Umfrage erstellen')).not.toBeNull();
  });

  it('in Einzelchats bleibt die Mitgliederliste weg -- dort weiss man, wer dabei ist', () => {
    kopf('direct', false);
    expect(knopf('Mitglieder anzeigen')).toBeNull();
  });
});

describe('Mitglieder-Modal: ansehen darf jedes Mitglied, verwalten nur die Leitung', () => {
  const oeffne = async (roomType = 'group') => {
    render(<MembersModal roomId={5} roomType={roomType} onClose={vi.fn()} onSuccess={vi.fn()} />);
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
  };
  const verwaltung = () => [
    document.querySelector('[aria-label="Mitglieder hinzufügen"]'),
    document.querySelectorAll('[aria-label="Mitglied entfernen"]').length,
  ];

  it('eine Konfi sieht die Mitglieder -- ohne Hinzufügen und Entfernen', async () => {
    angemeldet = { id: 20, type: 'konfi', role_name: 'konfi', organization_id: 1 };
    await oeffne();
    expect(screen.getByText('Emilia Test')).toBeInTheDocument();
    expect(screen.getByText('Anna Admin')).toBeInTheDocument();
    expect(verwaltung()).toEqual([null, 0]);
  });

  it('eine Teamer:in ebenso', async () => {
    angemeldet = { id: 30, type: 'teamer', role_name: 'teamer', organization_id: 1 };
    await oeffne();
    expect(screen.getByText('Emilia Test')).toBeInTheDocument();
    expect(verwaltung()).toEqual([null, 0]);
  });

  it('die Leitung verwaltet die Gruppe: Hinzufügen und Entfernen je Mitglied', async () => {
    angemeldet = { id: 4, type: 'admin', role_name: 'admin', organization_id: 1 };
    await oeffne();
    const [hinzufuegen, entfernen] = verwaltung();
    expect(hinzufuegen).not.toBeNull();
    expect(entfernen).toBe(2);
  });

  it('... aber nur in Gruppen, nicht im Jahrgangs-Chat', async () => {
    angemeldet = { id: 4, type: 'admin', role_name: 'admin', organization_id: 1 };
    await oeffne('jahrgang');
    expect(screen.getByText('Emilia Test')).toBeInTheDocument();
    expect(verwaltung()).toEqual([null, 0]);
  });
  // Die Personenlisten braucht nur das Hinzufuegen (30.09.2026, beim
  // Umstellen dieses Tests aufgefallen): Bis hierher holte das Modal beim
  // Oeffnen fuer JEDES Mitglied /admin/konfis, /users/me/jahrgaenge und
  // /users. Eine Konfi bekam auf /admin/konfis jedes Mal ein 403, in der
  // Konsole stand "Error loading users" -- sichtbar war nichts.
  const abrufe = () => apiGet.mock.calls.map((c) => c[0]).sort();

  it.each([
    ['eine Konfi in der Gruppe', { id: 20, type: 'konfi', role_name: 'konfi', organization_id: 1 }, 'group'],
    ['eine Teamer:in in der Gruppe', { id: 30, type: 'teamer', role_name: 'teamer', organization_id: 1 }, 'group'],
    ['die Leitung im Jahrgangs-Chat', { id: 4, type: 'admin', role_name: 'admin', organization_id: 1 }, 'jahrgang'],
  ])('%s lädt nur die Mitglieder, keine Personenlisten', async (_wer, person, raum) => {
    angemeldet = person;
    await oeffne(raum);
    expect(abrufe()).toEqual(['/chat/rooms/5/participants']);
  });

  it('die Leitung in der Gruppe lädt die Listen zum Hinzufügen', async () => {
    angemeldet = { id: 4, type: 'admin', role_name: 'admin', organization_id: 1 };
    await oeffne();
    expect(abrufe()).toEqual(['/admin/konfis', '/chat/rooms/5/participants', '/users', '/users/me/jahrgaenge']);
  });
});
