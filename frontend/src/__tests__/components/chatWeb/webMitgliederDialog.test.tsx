// „Mitglieder" eines Chats im Browser (components/chat/web/WebMitgliederDialog.tsx;
// Simon, 15.10.2026: „mitglieder modal ist noch app design"). Dieselbe Liste,
// dieselben Rechte, dieselben Personen zur Auswahl, dieselben Wege zum Server
// und dieselbe Rückfrage vor dem Entfernen wie das Modal der App
// (modals/MembersModal.tsx) -- beide lesen useChatMitglieder.
//
//   - Liste: Team zuerst, dann nach Namen; darunter Rolle bzw. „Konfi" und Jahrgang.
//   - Rechte: ansehen jedes Mitglied; hinzufügen und entfernen nur die
//     Leitung und nur in Gruppen (Jahrgangs-Chat: nur ansehen).
//   - Hinzufügen: Konfis der eigenen Jahrgänge und das Team, ohne die, die
//     schon dabei sind; je Person ein POST mit { user_id, user_type }.
//   - Entfernen: erst die Rückfrage, dann DELETE .../:user_id/:user_type.
//   - Fehler und offline: im Fenster, nichts geht hinaus.
//   - App und Browser: dieselben Personen zur Auswahl, dieselben Anfragen.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, waitFor, cleanup } from '@testing-library/react';
import { erwarteWebRueckfrage } from '../web/webRueckfrageErwartung';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  setError: vi.fn(),
  alert: vi.fn(),
  online: true,
  user: { id: 4, type: 'admin', role_name: 'admin', organization_id: 1 } as Record<string, unknown>,
}));

vi.mock('../../../services/api', () => ({
  default: {
    get: (u: string) => h.apiGet(u),
    post: (u: string, b?: unknown) => h.apiPost(u, b),
    delete: (u: string) => h.apiDelete(u),
  },
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: vi.fn(), isOnline: h.online }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn(), haptik: vi.fn() }));
// Für das Modal der App: Knöpfe und das Entfernen in der Wischaktion als
// <button>; die Rückfrage hält der Test fest, um ihren Knopf zu drücken.
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  IonButton: ({ children, onClick, disabled, 'aria-label': name }: {
    children?: React.ReactNode; onClick?: () => void; disabled?: boolean; 'aria-label'?: string;
  }) => <button type="button" aria-label={name} onClick={onClick} disabled={disabled}>{children}</button>,
  IonItemOption: ({ children, onClick, 'aria-label': name }: { children?: React.ReactNode; onClick?: () => void; 'aria-label'?: string }) => (
    <button type="button" aria-label={name} onClick={onClick}>{children}</button>
  ),
  IonInput: ({ value, onIonInput, 'aria-label': name }: { value?: string; onIonInput?: (e: { detail: { value: string } }) => void; 'aria-label'?: string }) => (
    <input aria-label={name} value={value ?? ''} onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />
  ),
  useIonAlert: () => [h.alert, vi.fn()],
}));

import WebMitgliederDialog from '../../../components/chat/web/WebMitgliederDialog';
import MembersModal from '../../../components/chat/modals/MembersModal';

// Die Mitglieder in der Reihenfolge des Servers -- nicht sortiert.
const MITGLIEDER = [
  { user_id: 22, user_type: 'konfi', name: 'Zoe Konfi', jahrgang_name: '2026/27', joined_at: '2026-09-01T10:00:00Z' },
  { user_id: 4, user_type: 'admin', name: 'Bert Leitung', role_name: 'admin', joined_at: '2026-09-01T10:00:00Z' },
  { user_id: 21, user_type: 'konfi', name: 'Anton Konfi', jahrgang_name: '2026/27', joined_at: '2026-09-01T10:00:00Z' },
  { user_id: 3, user_type: 'teamer', name: 'Anna Teamer', role_name: 'teamer', joined_at: '2026-09-01T10:00:00Z' },
];
// GET /users (Leitung und Team dieser Gemeinde), GET /admin/konfis, GET /users/me/jahrgaenge.
const TEAM = [
  { id: 4, display_name: 'Bert Leitung', username: 'bert', role_name: 'admin', role_display_name: 'Admin' },
  { id: 15, display_name: 'Greta Gemeindeleitung', username: 'greta', role_name: 'org_admin', role_display_name: 'Org-Admin' },
  { id: 13, display_name: 'Theo Teamer', username: 'theo', role_name: 'teamer', role_display_name: 'Teamer:in', role_title: 'Musik' },
];
const KONFIS = [
  { id: 21, name: 'Anton Konfi', jahrgang_id: 1, jahrgang_name: '2026/27' },
  { id: 23, name: 'Clara Konfi', jahrgang_id: 1, jahrgang_name: '2026/27' },
  // Ein fremder Jahrgang: steht für eine Leitung mit eigenen Jahrgängen nicht zur Auswahl.
  { id: 24, name: 'Dora Fremd', jahrgang_id: 2, jahrgang_name: '2025/26' },
];
const EIGENE_JAHRGAENGE = [{ id: 1, name: '2026/27' }];

const LEITUNG = { id: 4, type: 'admin', role_name: 'admin', organization_id: 1 };
const KONFI = { id: 21, type: 'konfi', role_name: 'konfi', organization_id: 1 };
const TEAMER = { id: 3, type: 'teamer', role_name: 'teamer', organization_id: 1 };

const warten = async () => {
  for (let i = 0; i < 5; i += 1) await act(async () => { await Promise.resolve(); });
};

const zeigen = async (roomType = 'group') => {
  const onGeaendert = vi.fn();
  const onSchliessen = vi.fn();
  render(<WebMitgliederDialog roomId={5} roomType={roomType} onGeaendert={onGeaendert} onSchliessen={onSchliessen} />);
  await warten();
  return { onGeaendert, onSchliessen };
};

const dialog = (name = 'Mitglieder') => screen.getByRole('dialog', { name });
const zeilen = () => within(within(dialog()).getByRole('list', { name: /^Mitglieder \(\d+\)$/ })).getAllByRole('listitem');
const abrufe = () => h.apiGet.mock.calls.map((c) => c[0]).sort();
/** Die Personen zur Auswahl im Browser, in ihrer Reihenfolge: Name der Zeile. */
const auswahlImBrowser = () => within(dialog('Mitglied hinzufügen')).queryAllByRole('checkbox')
  .map((kasten) => kasten.closest('label')?.querySelector('.web-wahl__titel')?.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  h.online = true;
  h.user = LEITUNG;
  h.apiGet.mockImplementation(async (url: string) => {
    if (url === '/chat/rooms/5/participants') return { data: MITGLIEDER };
    if (url === '/users') return { data: TEAM };
    if (url === '/admin/konfis') return { data: KONFIS };
    if (url === '/users/me/jahrgaenge') return { data: EIGENE_JAHRGAENGE };
    throw new Error(`unerwartet: ${url}`);
  });
  h.apiPost.mockResolvedValue({ data: {} });
  h.apiDelete.mockResolvedValue({ data: {} });
});
afterEach(() => cleanup());

describe('Web: die Liste', () => {
  it('Team zuerst, dann nach Namen; darunter die Rolle bzw. „Konfi" und der Jahrgang', async () => {
    await zeigen();
    expect(within(dialog()).getByRole('list', { name: 'Mitglieder (4)' })).toBeInTheDocument();
    expect(zeilen().map((z) => z.textContent?.replace(/^[A-Z?]{1,2}/, ''))).toEqual([
      expect.stringMatching(/^Anna TeamerTeamer:in/),
      expect.stringMatching(/^Bert LeitungLeitung/),
      expect.stringMatching(/^Anton KonfiKonfi · 2026\/27/),
      expect.stringMatching(/^Zoe KonfiKonfi · 2026\/27/),
    ]);
  });

  it('Fehler beim Laden: „Fehler beim Laden der Mitglieder" im Fenster', async () => {
    h.apiGet.mockImplementation(async (url: string) => {
      if (url === '/chat/rooms/5/participants') throw new Error('500');
      return { data: [] };
    });
    await zeigen();
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Fehler beim Laden der Mitglieder');
    expect(h.setError).not.toHaveBeenCalled();
  });
});

describe('Web: wer verwalten darf', () => {
  it.each([
    ['eine Konfi in der Gruppe', KONFI, 'group'],
    ['eine Teamer:in in der Gruppe', TEAMER, 'group'],
    ['die Leitung im Jahrgangs-Chat (Mitglieder ergeben sich von selbst)', LEITUNG, 'jahrgang'],
  ])('%s: nur ansehen -- kein Hinzufügen, kein Entfernen, keine Personenlisten', async (_wer, person, raum) => {
    h.user = person;
    await zeigen(raum);
    expect(zeilen()).toHaveLength(4);
    expect(within(dialog()).queryByRole('button', { name: 'Mitglieder hinzufügen' })).toBeNull();
    expect(within(dialog()).queryAllByRole('button', { name: / entfernen$/ })).toHaveLength(0);
    expect(abrufe()).toEqual(['/chat/rooms/5/participants']);
  });

  it('die Leitung in der Gruppe: Hinzufügen und Entfernen je Mitglied; die Listen zum Hinzufügen werden geladen', async () => {
    await zeigen();
    expect(within(dialog()).getByRole('button', { name: 'Mitglieder hinzufügen' })).toBeInTheDocument();
    expect(within(dialog()).getAllByRole('button', { name: / entfernen$/ }).map((k) => k.getAttribute('aria-label'))).toEqual([
      'Anna Teamer entfernen', 'Bert Leitung entfernen', 'Anton Konfi entfernen', 'Zoe Konfi entfernen',
    ]);
    expect(abrufe()).toEqual(['/admin/konfis', '/chat/rooms/5/participants', '/users', '/users/me/jahrgaenge']);
  });
});

describe('Web: hinzufügen', () => {
  const hinzufuegenOeffnen = async () => {
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Mitglieder hinzufügen' }));
    await warten();
  };

  it('zur Auswahl: das Team und die Konfis der eigenen Jahrgänge, ohne die, die schon dabei sind; Team zuerst', async () => {
    await zeigen();
    await hinzufuegenOeffnen();
    expect(within(dialog('Mitglied hinzufügen')).getByRole('group', { name: 'Verfügbare Personen (3)' })).toBeInTheDocument();
    // Bert und Anton sind schon dabei, Dora gehört zu einem fremden Jahrgang.
    expect(auswahlImBrowser()).toEqual(['Greta Gemeindeleitung', 'Theo Teamer', 'Clara Konfi']);
    // Darunter wie in der App: Rolle bzw. eigener Titel, bei Konfis „Konfi" und der Jahrgang.
    expect(within(dialog('Mitglied hinzufügen')).getAllByRole('checkbox')
      .map((k) => k.closest('label')?.querySelector('.web-wahl__beschreibung')?.textContent))
      .toEqual(['Gemeindeleitung', 'Musik', 'Konfi · 2026/27']);
  });

  it('die Suche grenzt ein; die Auswahl bleibt dabei stehen', async () => {
    await zeigen();
    await hinzufuegenOeffnen();
    fireEvent.click(within(dialog('Mitglied hinzufügen')).getByRole('checkbox', { name: /^Clara Konfi/ }));
    fireEvent.change(within(dialog('Mitglied hinzufügen')).getByRole('searchbox', { name: 'Person suchen' }), { target: { value: 'gre' } });
    expect(auswahlImBrowser()).toEqual(['Greta Gemeindeleitung']);
    expect(within(dialog('Mitglied hinzufügen')).getByRole('button', { name: 'Hinzufügen (1)' })).toBeEnabled();
  });

  it('zwei Personen: je ein POST mit { user_id, user_type }, danach Fenster zu und der Raum lädt neu', async () => {
    const { onGeaendert, onSchliessen } = await zeigen();
    await hinzufuegenOeffnen();
    const fenster = dialog('Mitglied hinzufügen');
    expect(within(fenster).getByRole('button', { name: 'Hinzufügen' })).toBeDisabled();
    fireEvent.click(within(fenster).getByRole('checkbox', { name: /^Theo Teamer/ }));
    fireEvent.click(within(fenster).getByRole('checkbox', { name: /^Clara Konfi/ }));
    fireEvent.click(within(fenster).getByRole('button', { name: 'Hinzufügen (2)' }));
    await waitFor(() => expect(onSchliessen).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls).toEqual([
      ['/chat/rooms/5/participants', { user_id: 13, user_type: 'admin' }],
      ['/chat/rooms/5/participants', { user_id: 23, user_type: 'konfi' }],
    ]);
    expect(onGeaendert).toHaveBeenCalledTimes(1);
  });

  it('Fehler beim Hinzufügen: „Fehler beim Hinzufügen der Mitglieder" im Fenster, die Auswahl bleibt', async () => {
    h.apiPost.mockRejectedValueOnce(new Error('403'));
    const { onGeaendert, onSchliessen } = await zeigen();
    await hinzufuegenOeffnen();
    fireEvent.click(within(dialog('Mitglied hinzufügen')).getByRole('checkbox', { name: /^Clara Konfi/ }));
    fireEvent.click(within(dialog('Mitglied hinzufügen')).getByRole('button', { name: 'Hinzufügen (1)' }));
    await waitFor(() => expect(within(dialog('Mitglied hinzufügen')).getByRole('alert')).toHaveTextContent('Fehler beim Hinzufügen der Mitglieder'));
    expect(within(dialog('Mitglied hinzufügen')).getByRole('checkbox', { name: /^Clara Konfi/ })).toBeChecked();
    expect(onGeaendert).not.toHaveBeenCalled();
    expect(onSchliessen).not.toHaveBeenCalled();
  });

  it('„Zurück" führt zur Liste, ohne Auswahl', async () => {
    await zeigen();
    await hinzufuegenOeffnen();
    fireEvent.click(within(dialog('Mitglied hinzufügen')).getByRole('checkbox', { name: /^Clara Konfi/ }));
    fireEvent.click(within(dialog('Mitglied hinzufügen')).getByRole('button', { name: 'Zurück' }));
    expect(zeilen()).toHaveLength(4);
    await hinzufuegenOeffnen();
    expect(within(dialog('Mitglied hinzufügen')).getByRole('checkbox', { name: /^Clara Konfi/ })).not.toBeChecked();
    expect(h.apiPost).not.toHaveBeenCalled();
  });
});

describe('Web: entfernen -- erst die Rückfrage', () => {
  it('die Rückfrage nennt die Person; „Abbrechen" schickt nichts, „Entfernen" schickt DELETE, dann Fenster zu und der Raum lädt neu', async () => {
    const { onGeaendert, onSchliessen } = await zeigen();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Zoe Konfi entfernen' }));
    let rueckfrage = screen.getByRole('dialog', { name: 'Mitglied entfernen' });
    expect(rueckfrage).toHaveAccessibleDescription('Zoe Konfi wirklich aus dem Chat entfernen?');
    erwarteWebRueckfrage(rueckfrage, 'loeschen', 'Entfernen');
    fireEvent.click(within(rueckfrage).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog', { name: 'Mitglied entfernen' })).toBeNull();
    expect(h.apiDelete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Zoe Konfi entfernen' }));
    rueckfrage = screen.getByRole('dialog', { name: 'Mitglied entfernen' });
    fireEvent.click(within(rueckfrage).getByRole('button', { name: 'Entfernen' }));
    await waitFor(() => expect(onSchliessen).toHaveBeenCalledTimes(1));
    expect(h.apiDelete.mock.calls).toEqual([['/chat/rooms/5/participants/22/konfi']]);
    expect(onGeaendert).toHaveBeenCalledTimes(1);
  });

  it('Fehler beim Entfernen: „Fehler beim Entfernen des Mitglieds" im Fenster, die Liste bleibt', async () => {
    h.apiDelete.mockRejectedValueOnce(new Error('500'));
    const { onGeaendert, onSchliessen } = await zeigen();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Anna Teamer entfernen' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Mitglied entfernen' })).getByRole('button', { name: 'Entfernen' }));
    await waitFor(() => expect(within(dialog()).getByRole('alert')).toHaveTextContent('Fehler beim Entfernen des Mitglieds'));
    expect(screen.queryByRole('dialog', { name: 'Mitglied entfernen' })).toBeNull();
    expect(h.apiDelete.mock.calls).toEqual([['/chat/rooms/5/participants/3/teamer']]);
    expect(zeilen()).toHaveLength(4);
    expect(onGeaendert).not.toHaveBeenCalled();
    expect(onSchliessen).not.toHaveBeenCalled();
  });

  it('offline: keine Rückfrage, die Meldung der App steht im Fenster, nichts geht hinaus', async () => {
    h.online = false;
    await zeigen();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Zoe Konfi entfernen' }));
    expect(screen.queryByRole('dialog', { name: 'Mitglied entfernen' })).toBeNull();
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Das geht nur mit Internetverbindung. Bitte versuche es später noch einmal.');
    expect(h.apiDelete).not.toHaveBeenCalled();
  });
});

describe('App und Browser: eine Logik (useChatMitglieder)', () => {
  it('dieselben Personen zur Auswahl, in derselben Reihenfolge', async () => {
    render(<MembersModal roomId={5} roomType="group" onClose={vi.fn()} onSuccess={vi.fn()} />);
    await warten();
    fireEvent.click(screen.getByRole('button', { name: 'Mitglieder hinzufügen' }));
    await warten();
    const inDerApp = screen.getAllByRole('button')
      .filter((k) => k.hasAttribute('aria-pressed'))
      .map((k) => k.querySelector('.app-list-item__title')?.textContent);
    cleanup();

    await zeigen();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Mitglieder hinzufügen' }));
    await warten();
    expect(auswahlImBrowser()).toEqual(inDerApp);
    expect(inDerApp).toEqual(['Greta Gemeindeleitung', 'Theo Teamer', 'Clara Konfi']);
  });

  it('dieselben Anfragen beim Hinzufügen und Entfernen', async () => {
    // App: Theo und Clara hinzufügen, dann Zoe entfernen (Rückfrage über Ionic).
    const onSuccess = vi.fn();
    render(<MembersModal roomId={5} roomType="group" onClose={vi.fn()} onSuccess={onSuccess} />);
    await warten();
    fireEvent.click(screen.getByRole('button', { name: 'Mitglieder hinzufügen' }));
    await warten();
    fireEvent.click(screen.getByText('Theo Teamer'));
    fireEvent.click(screen.getByText('Clara Konfi'));
    fireEvent.click(screen.getByRole('button', { name: 'Ausgewählte Mitglieder hinzufügen' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    const zoe = screen.getAllByRole('button', { name: 'Mitglied entfernen' })[3];
    fireEvent.click(zoe);
    const { header, message, buttons } = h.alert.mock.calls[0][0];
    expect([header, message]).toEqual(['Mitglied entfernen', 'Zoe Konfi wirklich aus dem Chat entfernen?']);
    await act(async () => { await buttons.find((b: { text: string }) => b.text === 'Entfernen').handler(); });
    expect(onSuccess).toHaveBeenCalledTimes(2);
    const app = { post: [...h.apiPost.mock.calls], delete: [...h.apiDelete.mock.calls] };
    cleanup();
    h.apiPost.mockClear();
    h.apiDelete.mockClear();

    // Browser: dasselbe.
    await zeigen();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Mitglieder hinzufügen' }));
    await warten();
    fireEvent.click(within(dialog('Mitglied hinzufügen')).getByRole('checkbox', { name: /^Theo Teamer/ }));
    fireEvent.click(within(dialog('Mitglied hinzufügen')).getByRole('checkbox', { name: /^Clara Konfi/ }));
    fireEvent.click(within(dialog('Mitglied hinzufügen')).getByRole('button', { name: 'Hinzufügen (2)' }));
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(2));
    cleanup();
    await zeigen();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Zoe Konfi entfernen' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Mitglied entfernen' })).getByRole('button', { name: 'Entfernen' }));
    await waitFor(() => expect(h.apiDelete).toHaveBeenCalledTimes(1));

    expect({ post: h.apiPost.mock.calls, delete: h.apiDelete.mock.calls }).toEqual(app);
    expect(app).toEqual({
      post: [
        ['/chat/rooms/5/participants', { user_id: 13, user_type: 'admin' }],
        ['/chat/rooms/5/participants', { user_id: 23, user_type: 'konfi' }],
      ],
      delete: [['/chat/rooms/5/participants/22/konfi']],
    });
  });
});
