// „Einladung verlängern" auf /admin/settings/invite: die Rückfrage der App
// (useIonAlert mit Auswahlknöpfen) und das Fenster der Web-Fassung
// (web/leitung/WebEinladungVerlaengernDialog) im Vergleich (Simon,
// 15.10.2026: jedes Formular, das im Browser noch ein Fenster der App öffnet,
// bekommt ein kompaktes Fenster der Web-Fassung).
//
// Beide bieten dieselben Stufen (verlaengerungsOptionen, die erste
// vorgewählt) und senden über dieselbe Stelle der Seite (extendInvite): POST
// /auth/invite-codes/:id/extend mit `tage`, danach „Einladung gilt bis …" und
// die Liste neu. Jeder Ablauf läuft deshalb je Fassung mit denselben
// Erwartungen; Unterschied, ausdrücklich: ein Fehler steht in der App oben
// (setError), im Browser im Fenster.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, cleanup } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';
import { verlaengerungsOptionen } from '../../../utils/einladungsGueltigkeit';
import { OFFLINE_AKTION_MELDUNG } from '../../../utils/offlineAktion';

const h = vi.hoisted(() => ({
  breit: true,
  online: true,
  daten: {} as Record<string, unknown>,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
  apiPost: vi.fn(),
  refresh: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
}));

vi.mock('@ionic/react', async () => {
  const basis = await (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand);
  type K = { children?: React.ReactNode };
  return {
    ...basis,
    // Die Wisch-Aktionen der App als Knöpfe mit ihrem Namen.
    IonItemSliding: ({ children }: K) => <div>{children}</div>,
    IonItemOptions: ({ children }: K) => <div>{children}</div>,
    IonItemOption: ({ children, onClick, disabled, 'aria-label': name }: K & { onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) => (
      <button type="button" aria-label={name} disabled={disabled} onClick={onClick}>{children}</button>
    ),
  };
});
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../services/api', () => ({
  default: { get: vi.fn(async () => ({ data: [] })), post: (u: string, b?: unknown) => h.apiPost(u, b), delete: vi.fn() },
}));
vi.mock('../../../utils/slidingItems', () => ({ closeOpenSlidingItems: vi.fn() }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,QR') } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  // Der Schlüssel beginnt mit "admin:<was>:" -- die Daten stehen unter <was>.
  useOfflineQuery: (schluessel: string) => ({ data: h.daten[schluessel.split(':')[1]] ?? [], loading: false, refresh: h.refresh, refreshLive: vi.fn() }),
}));

import AdminInvitePage from '../../../components/admin/pages/AdminInvitePage';

const TAG = 24 * 60 * 60 * 1000;
const inTagen = (n: number) => new Date(Date.now() + n * TAG).toISOString();
const CODES = [
  { id: 1, invite_code: 'ABC123', jahrgang_id: 12, jahrgang_name: 'Jahrgang 2027', expires_at: inTagen(5), used_count: 4 },
  // Gilt schon so lange, wie es geht.
  { id: 2, invite_code: 'VOLL90', jahrgang_id: 12, jahrgang_name: 'Jahrgang 2027', expires_at: inTagen(90), used_count: 0 },
];

beforeEach(() => {
  vi.clearAllMocks();
  h.apiPost.mockReset();
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.online = true;
  h.user = konto('org_admin');
  h.daten = { jahrgaenge: [{ id: 12, name: 'Jahrgang 2027' }], 'invite-codes': CODES };
  h.apiPost.mockResolvedValue({ data: { expires_at: inTagen(19) } });
});
afterEach(() => cleanup());

type Fassung = 'app' | 'web';

const oeffnen = async (fassung: Fassung) => {
  h.breit = fassung === 'web';
  render(<AdminInvitePage onClose={vi.fn()} />);
  for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
};

/** Der Knopf „verlängern" an diesem Code: im Browser in der Tabelle, in der App als Wisch-Aktion. */
const verlaengernKnopf = (fassung: Fassung, code: string) => (fassung === 'web'
  ? screen.getByRole('button', { name: `Einladung ${code} verlängern` })
  : (() => {
    const index = CODES.findIndex((c) => c.invite_code === code);
    return screen.getAllByRole('button', { name: 'Einladung verlängern' })[index];
  })());

/** Die angebotenen Stufen: Wert und Text, in Reihenfolge. */
const stufen = (fassung: Fassung): Array<{ wert: string; text: string }> => {
  if (fassung === 'app') {
    const inputs = (h.stand.alert as unknown as { inputs: Array<{ value: number; label: string }> }).inputs;
    return inputs.map((i) => ({ wert: String(i.value), text: i.label }));
  }
  const auswahl = within(screen.getByRole('dialog', { name: 'Einladung verlängern' })).getByRole('combobox', { name: 'Um wie viele Tage?' }) as HTMLSelectElement;
  return [...auswahl.options].map((o) => ({ wert: o.value, text: o.textContent ?? '' }));
};

/** Wählt die Stufe und bestätigt mit „Verlängern". */
const verlaengern = async (fassung: Fassung, tage: number) => {
  if (fassung === 'app') {
    const knopf = h.stand.alert?.buttons?.find((b) => b.text === 'Verlängern') as { handler?: (w: unknown) => unknown };
    await act(async () => { await knopf.handler?.(tage); });
    return;
  }
  const dialog = screen.getByRole('dialog', { name: 'Einladung verlängern' });
  fireEvent.change(within(dialog).getByRole('combobox', { name: 'Um wie viele Tage?' }), { target: { value: String(tage) } });
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Verlängern' })); });
};

/** Die vorgewählte Stufe (genau eine), ohne dass jemand die Auswahl angefasst hat. */
const vorgewaehlt = (fassung: Fassung): string => {
  if (fassung === 'app') {
    const inputs = (h.stand.alert as unknown as { inputs: Array<{ value: number; checked?: boolean }> }).inputs;
    const an = inputs.filter((i) => i.checked === true);
    expect(an).toHaveLength(1);
    return String(an[0].value);
  }
  const auswahl = within(screen.getByRole('dialog', { name: 'Einladung verlängern' })).getByRole('combobox', { name: 'Um wie viele Tage?' }) as HTMLSelectElement;
  return auswahl.value;
};

/**
 * Bestätigt mit „Verlängern", ohne die Auswahl anzufassen. Die Rückfrage der
 * App gibt dem Knopf den Wert des angekreuzten Auswahlknopfs -- genau das
 * reicht der Test weiter; im Browser zählt, was im Auswahlfeld steht.
 */
const verlaengernWieVorgewaehlt = async (fassung: Fassung) => {
  if (fassung === 'app') {
    const inputs = (h.stand.alert as unknown as { inputs: Array<{ value: number; checked?: boolean }> }).inputs;
    const knopf = h.stand.alert?.buttons?.find((b) => b.text === 'Verlängern') as { handler?: (w: unknown) => unknown };
    await act(async () => { await knopf.handler?.(inputs.find((i) => i.checked === true)?.value); });
    return;
  }
  const dialog = screen.getByRole('dialog', { name: 'Einladung verlängern' });
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Verlängern' })); });
};

describe.each<Fassung>(['app', 'web'])('Einladung verlängern (%s): dieselbe Stelle in App und Browser', (fassung) => {
  it('bietet dieselben Stufen an und schickt erst nach „Verlängern" die gewählte an die Route', async () => {
    await oeffnen(fassung);
    fireEvent.click(verlaengernKnopf(fassung, 'ABC123'));
    if (fassung === 'web') {
      expect(h.stand.alert).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Einladung verlängern' })).toHaveAccessibleDescription('Einladungscode ABC123');
    } else {
      expect(h.stand.alert?.header).toBe('Einladung verlängern');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }
    const erwartet = verlaengerungsOptionen(new Date(CODES[0].expires_at)).map((o) => ({ wert: String(o.tage), text: o.text }));
    expect(stufen(fassung)).toEqual(erwartet);
    expect(stufen(fassung).map((s) => s.wert)).toEqual(['7', '14', '30', '60', '90']);
    expect(stufen(fassung)[4].text).toMatch(/^Bis .* — länger als 90 Tage geht nicht$/);
    expect(h.apiPost).not.toHaveBeenCalled();

    await verlaengern(fassung, 14);
    expect(h.apiPost.mock.calls).toEqual([['/auth/invite-codes/1/extend', { tage: 14 }]]);
    expect(h.setSuccess).toHaveBeenCalledWith(expect.stringMatching(/^Einladung gilt bis \d{2}\.\d{2}\.\d{4}$/));
    expect(h.refresh).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Einladung verlängern' })).not.toBeInTheDocument();
  });

  it('ohne die Auswahl anzufassen: die erste Stufe ist vorgewählt, „Verlängern" schickt genau sie', async () => {
    await oeffnen(fassung);
    fireEvent.click(verlaengernKnopf(fassung, 'ABC123'));
    const erste = verlaengerungsOptionen(new Date(CODES[0].expires_at))[0].tage;
    expect(erste).toBe(7);
    expect(vorgewaehlt(fassung)).toBe(String(erste));

    await verlaengernWieVorgewaehlt(fassung);
    expect(h.apiPost.mock.calls).toEqual([['/auth/invite-codes/1/extend', { tage: 7 }]]);
    expect(h.setSuccess).toHaveBeenCalledWith(expect.stringMatching(/^Einladung gilt bis \d{2}\.\d{2}\.\d{4}$/));
  });

  it('lehnt der Server ab, steht seine Begründung da', async () => {
    h.apiPost.mockRejectedValue({ response: { status: 410, data: { error: 'Der Code ist schon abgelaufen' } } });
    await oeffnen(fassung);
    fireEvent.click(verlaengernKnopf(fassung, 'ABC123'));
    await verlaengern(fassung, 7);
    expect(h.apiPost.mock.calls).toEqual([['/auth/invite-codes/1/extend', { tage: 7 }]]);
    expect(h.setSuccess).not.toHaveBeenCalled();
    if (fassung === 'app') {
      expect(h.setError).toHaveBeenLastCalledWith('Der Code ist schon abgelaufen');
    } else {
      // Im Fenster, das offen bleibt -- nicht oben.
      const dialog = screen.getByRole('dialog', { name: 'Einladung verlängern' });
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Der Code ist schon abgelaufen');
      expect(h.setError).not.toHaveBeenCalled();
    }
  });

  it('gilt der Code schon 90 Tage im Voraus, sagt es das -- und schickt nichts', async () => {
    await oeffnen(fassung);
    fireEvent.click(verlaengernKnopf(fassung, 'VOLL90'));
    const text = 'Der Code gilt schon 90 Tage im Voraus — länger geht es nicht.';
    if (fassung === 'app') {
      expect(h.stand.alert?.message).toBe(text);
    } else {
      const dialog = screen.getByRole('dialog', { name: 'Einladung verlängern' });
      expect(within(dialog).getByText(text)).toBeInTheDocument();
      expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('ohne Netz: keine Frage nach den Tagen, dieselbe Meldung', async () => {
    h.online = false;
    await oeffnen(fassung);
    fireEvent.click(verlaengernKnopf(fassung, 'ABC123'));
    expect(h.stand.alert).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(h.setError).toHaveBeenCalledWith(OFFLINE_AKTION_MELDUNG);
    expect(h.apiPost).not.toHaveBeenCalled();
  });
});

describe('Einladung verlängern (web): solange gesendet wird, bleibt das Fenster', () => {
  it('X, Abbrechen, Escape und ein Klick daneben schließen nicht; danach steht der Fehler im Fenster, dann schließt Escape', async () => {
    const ausgang: { ablehnen: (grund: unknown) => void } = { ablehnen: () => undefined };
    h.apiPost.mockReturnValue(new Promise((_ok, nein) => { ausgang.ablehnen = nein; }));
    await oeffnen('web');
    fireEvent.click(verlaengernKnopf('web', 'ABC123'));
    await verlaengern('web', 30);
    expect(h.apiPost.mock.calls).toEqual([['/auth/invite-codes/1/extend', { tage: 30 }]]);
    const dialog = screen.getByRole('dialog', { name: 'Einladung verlängern' });
    const knopf = (n: string) => within(dialog).getByRole('button', { name: n });
    expect(knopf('Schließen')).toBeDisabled();
    expect(knopf('Abbrechen')).toBeDisabled();
    expect(knopf('Verlängern')).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(screen.getByRole('dialog', { name: 'Einladung verlängern' })).toBe(dialog);

    await act(async () => { ausgang.ablehnen(new Error('Netzwerkfehler')); });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Fehler beim Verlängern des Codes');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
