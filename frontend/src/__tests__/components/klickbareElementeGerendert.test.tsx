import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht BF-03 -- gerenderte Gegenprobe zum
// Quelltext-Scan (klickbareElementeBedienbar.test.ts): Drei klickbare
// Nicht-Knoepfe werden gerendert und wie eine Tastatur bedient. Enter und
// Leertaste muessen dasselbe tun wie ein Fingertipp; Tab muss sie erreichen
// (tabIndex 0); die Vorlesehilfe muss „Schaltflaeche" hoeren (role).
//
//   - Abzeichen-Kachel (KachelRaster): nur mit Klick-Handler ein Knopf.
//   - Termin-Karte auf der Konfi-Startseite (EventCard).
//   - Zeile „App sperren" im Profil (AppSperreSchalter): oeffnet die Auswahl.
// ---------------------------------------------------------------------------

const mockVerfuegbar = vi.fn();
const mockLesen = vi.fn();
const mockBiometrie = vi.fn();
vi.mock('../../services/appSperre', async () => {
  const echt = await vi.importActual<typeof import('../../services/appSperre')>('../../services/appSperre');
  return {
    ...echt,
    sperreVerfuegbar: (...a: unknown[]) => mockVerfuegbar(...(a as [])),
    sperreLesen: (...a: unknown[]) => mockLesen(...(a as [])),
    sperreSpeichern: vi.fn(async () => undefined),
    sperreOeffnen: vi.fn(async () => 'ok'),
  };
});
vi.mock('../../services/biometrics', () => ({
  biometrieVerfuegbar: (...a: unknown[]) => mockBiometrie(...(a as [])),
}));
const mockAuswahl = vi.fn();
vi.mock('@ionic/react', async () => {
  const echt = await vi.importActual<typeof import('@ionic/react')>('@ionic/react');
  return { ...echt, useIonActionSheet: () => [mockAuswahl, vi.fn()] };
});

import KachelRaster from '../../components/shared/KachelRaster';
import { EventCard } from '../../components/konfi/views/DashboardSections';
import AppSperreSchalter from '../../components/shared/AppSperreSchalter';
import { ICON_STERN } from '../../components/shared/icons';
import type { DashboardEvent } from '../../types/dashboard';

beforeEach(() => {
  vi.clearAllMocks();
  mockVerfuegbar.mockResolvedValue(true);
  mockLesen.mockResolvedValue('aus');
  mockBiometrie.mockResolvedValue({ verfuegbar: true, art: 'faceId', bezeichnung: 'Face ID', sinnbild: 'gesicht' });
});
afterEach(cleanup);

const kacheln = [{ schluessel: 'a', name: 'Erster Stempel', titel: 'Erster Stempel', icon: ICON_STERN, farbe: '#123456' }];

describe('Klickbare Nicht-Knoepfe per Tastatur (UI BF-03)', () => {
  it('Abzeichen-Kachel: mit Klick-Handler ein fokussierbarer Knopf, Enter und Leertaste loesen ihn aus', () => {
    const klick = vi.fn();
    const { container } = render(<KachelRaster eintraege={kacheln} onKachelClick={klick} />);
    const kachel = container.querySelector<HTMLElement>('.app-kachel')!;
    expect(kachel.getAttribute('role')).toBe('button');
    expect(kachel.tabIndex).toBe(0);
    kachel.focus();
    expect(document.activeElement).toBe(kachel);
    fireEvent.keyDown(kachel, { key: 'Enter' });
    fireEvent.keyDown(kachel, { key: ' ' });
    fireEvent.keyDown(kachel, { key: 'Tab' });
    expect(klick).toHaveBeenCalledTimes(2);
    expect(klick.mock.calls[0][0]).toBe('a');
  });

  it('Abzeichen-Kachel ohne Klick-Handler ist KEIN Knopf (keine leere Schaltflaeche fuer die Vorlesehilfe)', () => {
    const { container } = render(<KachelRaster eintraege={kacheln} />);
    const kachel = container.querySelector<HTMLElement>('.app-kachel')!;
    expect(kachel.hasAttribute('role')).toBe(false);
    expect(kachel.hasAttribute('tabindex')).toBe(false);
  });

  it('Termin-Karte auf der Startseite: role=button, Enter oeffnet den Termin', () => {
    const oeffnen = vi.fn();
    const event = {
      id: 7, name: 'Konfi-Freizeit', event_date: '2026-10-03T10:00:00', booking_status: 'confirmed',
    } as unknown as DashboardEvent;
    const { container } = render(<EventCard event={event} onClick={oeffnen} />);
    const karte = container.querySelector<HTMLElement>('.app-dashboard-glass-card')!;
    expect(karte.getAttribute('role')).toBe('button');
    expect(karte.tabIndex).toBe(0);
    fireEvent.keyDown(karte, { key: 'Enter' });
    expect(oeffnen).toHaveBeenCalledTimes(1);
  });

  it('Zeile „App sperren": Enter oeffnet dieselbe Auswahl wie ein Fingertipp', async () => {
    render(<AppSperreSchalter variante="konfi" />);
    const titel = await screen.findByText('App sperren');
    const zeile = titel.closest<HTMLElement>('[role="button"]')!;
    expect(zeile).not.toBeNull();
    expect(zeile.classList.contains('app-list-item')).toBe(true);
    expect(zeile.tabIndex).toBe(0);
    fireEvent.keyDown(zeile, { key: 'Enter' });
    await waitFor(() => expect(mockAuswahl).toHaveBeenCalledTimes(1));
  });

  it('Enter auf einem Knopf IN der Zeile loest die Zeile nicht mit aus', async () => {
    render(<AppSperreSchalter variante="konfi" />);
    const titel = await screen.findByText('App sperren');
    const zeile = titel.closest<HTMLElement>('[role="button"]')!;
    const kind = document.createElement('button');
    zeile.appendChild(kind);
    fireEvent.keyDown(kind, { key: 'Enter' });
    expect(mockAuswahl).not.toHaveBeenCalled();
  });
});
