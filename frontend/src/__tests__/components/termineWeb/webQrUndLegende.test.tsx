// QR-Code zum Einchecken und die Legende der Events -- die Modale der App
// (shared/QRDisplayModal, shared/EventLegendModal) und die Fenster der
// Web-Fassung (WebQrDialog, WebLegendeDialog) im Vergleich (Simon,
// 15.10.2026: im Browser ab 992 px jedes Fenster kompakt).
//
// Der QR-Code liest in beiden denselben Hook (useQrAnzeige): derselbe Abruf
// des Codes, derselbe Zähler alle 10 Sekunden, dieselben Texte, dasselbe
// Drucken, „Erneut versuchen" nach einem Fehler. Die Legende liest in beiden
// dieselben Einträge (eventLegende.ts), je Rolle gefiltert -- und
// WebLegendeKnopf öffnet im Browser das Fenster, sonst das Modal der App.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  toDataURL: vi.fn(),
  online: true,
  breit: true,
  modal: vi.fn(),
}));

type K = { children?: React.ReactNode };
vi.mock('@ionic/react', () => {
  const durch = ({ children }: K) => <>{children}</>;
  return {
    IonPage: ({ children }: K) => <main>{children}</main>,
    IonHeader: durch, IonToolbar: durch, IonButtons: durch, IonContent: durch,
    IonTitle: ({ children }: K) => <h1>{children}</h1>,
    IonSpinner: () => <span role="progressbar" />,
    IonIcon: () => null,
    IonButton: ({ children, onClick, disabled, 'aria-label': label }: K & { onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) => (
      <button type="button" onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>
    ),
    useIonModal: (komponente: { name?: string }, props: Record<string, unknown>) => [
      (optionen?: unknown) => h.modal(komponente?.name, props, optionen),
      vi.fn(),
    ],
  };
});
vi.mock('qrcode', () => ({ default: { toDataURL: (...a: unknown[]) => h.toDataURL(...a) } }));
vi.mock('../../../services/api', () => ({
  default: { get: (u: string) => h.apiGet(u), post: (u: string, b?: unknown) => h.apiPost(u, b) },
}));
vi.mock('../../../contexts/AppContext', () => ({ useApp: () => ({ isOnline: h.online }) }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));

import QRDisplayModal from '../../../components/shared/QRDisplayModal';
import WebQrDialog from '../../../components/shared/web/termine/WebQrDialog';
import EventLegendModal from '../../../components/shared/EventLegendModal';
import WebLegendeDialog from '../../../components/shared/web/termine/WebLegendeDialog';
import WebLegendeKnopf from '../../../components/shared/web/termine/WebLegendeKnopf';

type Fassung = 'app' | 'web';
const zu = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  h.online = true;
  h.breit = true;
  h.apiPost.mockResolvedValue({ data: { qr_token: 'einchecken-7' } });
  h.apiGet.mockResolvedValue({ data: { checked_in: 3, total: 10 } });
  h.toDataURL.mockResolvedValue('data:image/png;base64,QR7');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// --- QR-Code -----------------------------------------------------------------------------
const qr = async (fassung: Fassung) => {
  const r = fassung === 'app'
    ? render(<QRDisplayModal eventId={7} eventName="Konfi-Freizeit" eventDate="2026-10-24T08:00:00Z" onClose={zu} />)
    : render(<WebQrDialog eventId={7} eventName="Konfi-Freizeit" eventDate="2026-10-24T08:00:00Z" onSchliessen={zu} />);
  for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
  return r;
};
const druckenKnopf = (fassung: Fassung) => screen.getByRole('button', { name: fassung === 'app' ? 'QR-Code drucken' : 'Drucken' });
const zaehlerAbrufe = () => h.apiGet.mock.calls.filter(([p]) => p === '/events/7/attendance-count').length;

describe.each<Fassung>(['app', 'web'])('QR-Code zum Einchecken (%s): dieselbe Logik in App und Browser', (fassung) => {
  it('derselbe Code (POST /events/7/generate-qr), dasselbe Bild, derselbe Zähler und Satz', async () => {
    await qr(fassung);
    expect(h.apiPost.mock.calls).toEqual([['/events/7/generate-qr', undefined]]);
    expect(h.toDataURL).toHaveBeenCalledWith('einchecken-7', expect.objectContaining({ width: 512, errorCorrectionLevel: 'H' }));
    expect(screen.getByRole('img', { name: 'QR-Code zum Einchecken' })).toHaveAttribute('src', 'data:image/png;base64,QR7');
    expect(screen.getByText('Konfi-Freizeit')).toBeInTheDocument();
    expect(screen.getByText('3 / 10 eingecheckt')).toBeInTheDocument();
    expect(screen.getByText('Konfis scannen diesen QR-Code mit der App zum Einchecken')).toBeInTheDocument();
  });

  it('der Zähler fragt alle 10 Sekunden nach -- nach dem Schließen nicht mehr', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const r = await qr(fassung);
    expect(zaehlerAbrufe()).toBe(1);
    h.apiGet.mockResolvedValue({ data: { checked_in: 5, total: 10 } });
    await act(async () => { vi.advanceTimersByTime(10_000); });
    expect(zaehlerAbrufe()).toBe(2);
    await waitFor(() => expect(screen.getByText('5 / 10 eingecheckt')).toBeInTheDocument());
    r.unmount();
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(zaehlerAbrufe()).toBe(2);
  });

  it('Drucken ruft den Druckdialog', async () => {
    const drucken = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    await qr(fassung);
    fireEvent.click(druckenKnopf(fassung));
    expect(drucken).toHaveBeenCalledTimes(1);
    drucken.mockRestore();
  });

  it('scheitert der Code, steht die Begründung da; „Erneut versuchen" holt ihn', async () => {
    h.apiPost.mockRejectedValueOnce({ response: { status: 403, data: { error: 'Kein Zugriff auf dieses Event' } } });
    await qr(fassung);
    expect(screen.getByText('Kein Zugriff auf dieses Event')).toBeInTheDocument();
    expect(druckenKnopf(fassung)).toBeDisabled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    expect(h.apiPost).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('img', { name: 'QR-Code zum Einchecken' })).toBeInTheDocument();
    expect(screen.queryByText('Kein Zugriff auf dieses Event')).toBe(null);
  });

  it('offline nach einem Fehler: kein erneuter Versuch', async () => {
    h.online = false;
    h.apiPost.mockRejectedValueOnce(new Error('Netz weg'));
    await qr(fassung);
    expect(screen.getByText('QR-Code konnte nicht generiert werden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Du bist offline/ })).toBeDisabled();
  });
});

describe('QR-Code im Browser: ein Fenster mit Namen, die Meldung als Alarm', () => {
  it('heißt „QR-Code zum Einchecken"; ein Fehler meldet sich als alert', async () => {
    h.apiPost.mockRejectedValueOnce(new Error('Netz weg'));
    await qr('web');
    expect(screen.getByRole('dialog', { name: 'QR-Code zum Einchecken' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('QR-Code konnte nicht generiert werden');
  });
});

// --- Legende -----------------------------------------------------------------------------
const ALLE = [
  'Anmeldung möglich', 'Anmeldung möglich (Team)', 'Nur zur Info', 'Angemeldet', 'Anwesend', 'Anmeldung bald',
  'Warteliste', 'Ausstehend', 'Verbuchen', 'Absage / Abmeldung', 'Ausgebucht', 'Vergangen', 'Team', 'Konfirmation', 'Pflicht',
];
/** Die Namen der Einträge in Anzeigereihenfolge: Elemente ohne Kinder, deren Text ein Name ist. */
const eintraege = (): string[] => [...document.body.querySelectorAll('*')]
  .filter((el) => el.children.length === 0 && ALLE.includes(el.textContent ?? ''))
  .map((el) => el.textContent ?? '');

const ERWARTET: Record<'konfi' | 'teamer' | 'admin', string[]> = {
  konfi: ['Anmeldung möglich', 'Angemeldet', 'Anwesend', 'Anmeldung bald', 'Warteliste', 'Ausstehend', 'Absage / Abmeldung', 'Ausgebucht', 'Vergangen', 'Konfirmation', 'Pflicht'],
  teamer: ['Anmeldung möglich (Team)', 'Nur zur Info', 'Angemeldet', 'Anwesend', 'Anmeldung bald', 'Ausstehend', 'Absage / Abmeldung', 'Vergangen', 'Team', 'Konfirmation', 'Pflicht'],
  admin: ['Anmeldung möglich', 'Angemeldet', 'Anmeldung bald', 'Warteliste', 'Verbuchen', 'Absage / Abmeldung', 'Ausgebucht', 'Vergangen', 'Team', 'Konfirmation', 'Pflicht'],
};

describe.each<Fassung>(['app', 'web'])('Legende (%s): dieselben Einträge je Rolle', (fassung) => {
  it.each(['konfi', 'teamer', 'admin'] as const)('%s', (rolle) => {
    if (fassung === 'app') render(<EventLegendModal variant={rolle} onClose={zu} />);
    else render(<WebLegendeDialog variante={rolle} onSchliessen={zu} />);
    expect(eintraege()).toEqual(ERWARTET[rolle]);
    expect(document.body).toHaveTextContent('Diese kleinen Symbole erscheinen oben rechts am Event');
  });
});

describe('Der Knopf „Legende": im Browser das Fenster, sonst das Modal der App', () => {
  it('breit: öffnet das Fenster „Farben & Symbole", kein Modal; Schließen schließt es', () => {
    render(<WebLegendeKnopf variante="admin" />);
    fireEvent.click(screen.getByRole('button', { name: /Legende/ }));
    expect(screen.getByRole('dialog', { name: 'Farben & Symbole' })).toBeInTheDocument();
    expect(h.modal).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBe(null);
  });

  it('schmal: öffnet das Modal der App mit der Rolle, kein Fenster', () => {
    h.breit = false;
    render(<WebLegendeKnopf variante="teamer" />);
    fireEvent.click(screen.getByRole('button', { name: /Legende/ }));
    expect(h.modal).toHaveBeenCalledTimes(1);
    expect(h.modal.mock.calls[0][0]).toBe('EventLegendModal');
    expect(h.modal.mock.calls[0][1]).toEqual(expect.objectContaining({ variant: 'teamer' }));
    expect(screen.queryByRole('dialog')).toBe(null);
  });
});
