// QR-Scanner liest Netz- und Scan-Zustand aktuell, nicht vom ersten Rendern
// (Audit 26.09.2026, Screens Konfi/Teamer BF-10)
//
// Der Rueckruf des QrScanners entstand im Mount-Effekt und hielt die
// handleScanResult-Fassung des ersten Renderns -- samt `isOnline` und
// `scanning` von damals. Ging das Geraet nach dem Oeffnen offline, griff die
// Pruefung nicht: Der Scan lief gegen das Netz und endete mit "QR-Code
// konnte nicht verarbeitet werden" statt "Du bist offline" (Handbuch
// 70-termine.md). Der `scanning`-Merker blieb fuer den Rueckruf immer false.
//
// Gerendert wird die echte Ansicht; QrScanner ist durch eine Attrappe
// ersetzt, die den Rueckruf festhaelt, damit der Test "scannen" kann.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';

const apiPost = vi.fn();
let online = true;
let scanRueckruf: ((ergebnis: { data: string }) => void) | null = null;
const scannerStart = vi.fn(() => Promise.resolve());
const scannerStop = vi.fn();

vi.mock('qr-scanner', () => {
  class QrScannerAttrappe {
    static WORKER_PATH = '';
    constructor(_video: unknown, rueckruf: (ergebnis: { data: string }) => void) {
      scanRueckruf = rueckruf;
    }
    start() { return scannerStart(); }
    stop() { scannerStop(); }
    destroy() { /* nichts */ }
  }
  return { default: QrScannerAttrappe };
});
vi.mock('qr-scanner/qr-scanner-worker.min.js?url', () => ({ default: 'worker.js' }));
vi.mock('@ionic/react', () => {
  const pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    IonPage: pass, IonHeader: pass, IonToolbar: pass, IonTitle: pass, IonContent: pass,
    IonButtons: pass,
    IonButton: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) =>
      <button type="button" onClick={onClick}>{children}</button>,
    IonIcon: () => null,
  };
});
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ isOnline: online }),
}));
vi.mock('../../services/api', () => ({
  default: { post: (...a: unknown[]) => apiPost(...a) },
}));

import QRScannerModal from '../../components/konfi/modals/QRScannerModal';

function scanne(daten = 'token-1') {
  act(() => { scanRueckruf?.({ data: daten }); });
}

beforeEach(() => {
  online = true;
  scanRueckruf = null;
  apiPost.mockReset();
  scannerStart.mockClear();
  scannerStop.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('QR-Scanner: aktueller Zustand im Scan-Rueckruf', () => {
  it('geht das Geraet nach dem Oeffnen offline, sagt der Scan "Du bist offline" und sendet nichts', async () => {
    apiPost.mockRejectedValue({ code: 'ERR_NETWORK' });
    const { rerender } = render(<QRScannerModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(scanRueckruf).not.toBeNull();

    online = false;
    rerender(<QRScannerModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    scanne();

    await waitFor(() => expect(screen.getByText('Du bist offline')).toBeTruthy());
    expect(apiPost).not.toHaveBeenCalled();
    expect(screen.queryByText('QR-Code konnte nicht verarbeitet werden')).toBeNull();
  });

  it('ist das Netz zurueck, geht der naechste Scan durch', async () => {
    apiPost.mockResolvedValue({ data: { event_id: 5, event_name: 'Sommerfest', already_checked_in: false } });
    const onSuccess = vi.fn();
    online = false;
    const { rerender } = render(<QRScannerModal onClose={vi.fn()} onSuccess={onSuccess} />);
    scanne();
    expect(apiPost).not.toHaveBeenCalled();

    online = true;
    rerender(<QRScannerModal onClose={vi.fn()} onSuccess={onSuccess} />);
    scanne();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(5, 'Sommerfest'));
    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost).toHaveBeenCalledWith('/events/qr-checkin', { token: 'token-1' });
  });

  it('zwei Treffer kurz hintereinander schicken einen Check-in, nicht zwei', async () => {
    let loese: (wert: unknown) => void = () => undefined;
    apiPost.mockImplementation(() => new Promise((r) => { loese = r; }));
    const onSuccess = vi.fn();
    render(<QRScannerModal onClose={vi.fn()} onSuccess={onSuccess} />);

    scanne();
    scanne();

    expect(apiPost).toHaveBeenCalledTimes(1);
    await act(async () => { loese({ data: { event_id: 5, event_name: 'Sommerfest', already_checked_in: false } }); });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('nach "bereits eingecheckt" laeuft der Scanner wieder, und ein neuer Scan geht durch', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    apiPost.mockResolvedValue({ data: { event_id: 5, event_name: 'Sommerfest', already_checked_in: true } });
    render(<QRScannerModal onClose={vi.fn()} onSuccess={vi.fn()} />);

    scanne();
    await waitFor(() => expect(screen.getByText('Du bist bereits eingecheckt')).toBeTruthy());
    await act(async () => { vi.advanceTimersByTime(2100); });
    expect(screen.queryByText('Du bist bereits eingecheckt')).toBeNull();

    scanne('token-2');
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(2));
    expect(apiPost).toHaveBeenLastCalledWith('/events/qr-checkin', { token: 'token-2' });
  });
});
