// Teamer-Absage mit Grund (Anforderung 01.09.2026) -- gerendert (Audit
// Tests 26.09.2026, BF-02; vorher Quelltext-Test, 30.09.2026 umgestellt).
//
// Zu- und Absagen lassen sich jederzeit ändern, ein Grund ist freiwillig --
// AUSSER die Absage nimmt eine Zusage zurück, dann ist er Pflicht.
// Durchgesetzt wird die Regel im Backend (400, error_code
// 'grund_erforderlich'); die Oberfläche fragt den Grund im Absage-Dialog ab
// und erspart so den Fehlversuch.
//
// Gerendert werden die Seite (welcher Dialog mit welcher Pflicht aufgeht,
// was danach gesendet wird) und der echte Dialog (wann er sich absenden
// lässt).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, oeffneTermin, knopf, zuletztGeoeffnet, api,
} from './gerueste/teamerTerminSeite';
import type { Event } from '../../types/event';
import { absageBrauchtGrund } from '../../utils/zusageKnoepfe';

beforeEach(zuruecksetzen);

const absageOeffnen = async (zusatz: Partial<Event>, knopfText: string) => {
  zustand.events = [termin(zusatz)];
  await oeffneTermin();
  await act(async () => { fireEvent.click(knopf(knopfText)!); });
  return zuletztGeoeffnet('TeamerAbsageModal');
};

describe('Teamer-Absage: Grund-Abfrage in der Oberfläche', () => {
  it('die Regel: Pflicht nach Zusage (confirmed, waitlist, Alt-Status pending), sonst freiwillig', () => {
    expect(absageBrauchtGrund('confirmed')).toBe(true);
    expect(absageBrauchtGrund('waitlist')).toBe(true);
    expect(absageBrauchtGrund('pending')).toBe(true);
    expect(absageBrauchtGrund('opted_out')).toBe(false);
    expect(absageBrauchtGrund(null)).toBe(false);
  });

  it('nach einer Zusage öffnet "Nicht mehr dabei" den Dialog MIT Grund-Pflicht', async () => {
    const modal = await absageOeffnen({ is_registered: true, booking_status: 'confirmed' }, 'Nicht mehr dabei');
    expect(modal?.props.grundPflicht).toBe(true);
    expect(modal?.props.eventName).toBe('Konfi-Freizeit');
  });

  it('auf der Warteliste gilt die Zusage ebenfalls: Grund-Pflicht', async () => {
    const modal = await absageOeffnen({ booking_status: 'waitlist' }, 'Nicht dabei');
    expect(modal?.props.grundPflicht).toBe(true);
  });

  it('ohne vorherige Zusage öffnet "Nicht dabei" den Dialog OHNE Grund-Pflicht', async () => {
    const modal = await absageOeffnen({}, 'Nicht dabei');
    expect(modal?.props.grundPflicht).toBe(false);
  });

  it('jede Absage öffnet den Dialog statt direkt zu senden', async () => {
    await absageOeffnen({ is_registered: true, booking_status: 'confirmed' }, 'Nicht mehr dabei');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('die Absage läuft über die Zusage-Route und nimmt den Grund getrimmt mit', async () => {
    const modal = await absageOeffnen({ is_registered: true, booking_status: 'confirmed' }, 'Nicht mehr dabei');
    await act(async () => { (modal!.props.onAbsage as (g: string) => void)('  Bin krank  '); });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/teamer/events/77/zusage', { dabei: false, reason: 'Bin krank' });
  });

  it('eine Absage ohne Grund schickt kein leeres Grund-Feld', async () => {
    const modal = await absageOeffnen({}, 'Nicht dabei');
    await act(async () => { (modal!.props.onAbsage as (g: string) => void)('   '); });
    expect(api.post).toHaveBeenCalledWith('/teamer/events/77/zusage', { dabei: false });
  });
});

describe('Der Dialog selbst', () => {
  // Der echte Dialog, nicht die Attrappe aus dem Gerüst.
  const ladeDialog = async () =>
    (await vi.importActual<typeof import('../../components/teamer/modals/TeamerAbsageModal')>(
      '../../components/teamer/modals/TeamerAbsageModal'
    )).default;

  const zeige = async (grundPflicht: boolean) => {
    const Dialog = await ladeDialog();
    const onAbsage = vi.fn();
    const dismiss = vi.fn();
    render(<Dialog eventName="Konfi-Freizeit" grundPflicht={grundPflicht} onAbsage={onAbsage} dismiss={dismiss} />);
    return { onAbsage, dismiss, senden: () => screen.getByRole('button', { name: 'Absage bestätigen' }) as HTMLButtonElement };
  };

  it('mit Grund-Pflicht: sagt warum, und das Absenden ist ohne Grund gesperrt', async () => {
    const { senden } = await zeige(true);
    expect(screen.getByText(/^Du hattest zugesagt\./)).toBeInTheDocument();
    expect(screen.getByText('Ohne Grund lässt sich eine Absage nach Zusage nicht speichern.')).toBeInTheDocument();
    expect(senden().disabled).toBe(true);
  });

  it('mit Grund-Pflicht: nur Leerzeichen zählen nicht als Grund', async () => {
    const { senden } = await zeige(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Warum kannst du nicht?' }), { target: { value: '   ' } });
    expect(senden().disabled).toBe(true);
  });

  it('mit Grund-Pflicht: mit Grund lässt es sich absenden, der Grund geht getrimmt hinaus', async () => {
    const { senden, onAbsage, dismiss } = await zeige(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Warum kannst du nicht?' }), { target: { value: ' Krank ' } });
    expect(senden().disabled).toBe(false);
    await act(async () => { fireEvent.click(senden()); });
    expect(onAbsage).toHaveBeenCalledWith('Krank');
    expect(dismiss).toHaveBeenCalledWith('Krank', 'confirm');
  });

  it('ohne Pflicht: freiwillig, sofort absendbar, auch leer', async () => {
    const { senden, onAbsage } = await zeige(false);
    expect(screen.getByText(/du musst aber keinen angeben/)).toBeInTheDocument();
    expect(screen.queryByText(/^Du hattest zugesagt\./)).toBeNull();
    expect(senden().disabled).toBe(false);
    await act(async () => { fireEvent.click(senden()); });
    expect(onAbsage).toHaveBeenCalledWith('');
  });
});

// React wird für JSX in dieser Datei gebraucht.
void React;
