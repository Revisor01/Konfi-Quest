import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Der Schalter darf NUR erscheinen, wenn das Geraet Biometrie eingerichtet hat.
// Ein Schalter, der ins Leere fuehrt, ist schlimmer als gar keiner — und im
// Browser gibt es ihn ueberhaupt nicht.

const mockVerfuegbar = vi.fn();
const mockIstAktiv = vi.fn();
const mockAktivieren = vi.fn();
const mockVergessen = vi.fn(async () => undefined);

vi.mock('../../services/biometrics', () => ({
  biometrieVerfuegbar: (...a: unknown[]) => mockVerfuegbar(...(a as [])),
  istBiometrieAktiv: (...a: unknown[]) => mockIstAktiv(...(a as [])),
  biometrieAktivieren: (...a: unknown[]) => mockAktivieren(...(a as [])),
  biometrieVergessen: (...a: unknown[]) => mockVergessen(...(a as [])),
  GESPEICHERTE_SITZUNG_MAX_TAGE: 14,
}));

const mockPresentAlert = vi.fn();
vi.mock('@ionic/react', async () => {
  const echt = await vi.importActual<any>('@ionic/react');
  return {
    ...echt,
    useIonAlert: () => [mockPresentAlert, vi.fn()],
  };
});

import BiometrieSchalter from '../../components/shared/BiometrieSchalter';

beforeEach(() => {
  vi.clearAllMocks();
  mockVerfuegbar.mockResolvedValue({
    verfuegbar: true,
    art: 'faceId',
    bezeichnung: 'Face ID',
  });
  mockIstAktiv.mockResolvedValue(false);
  mockAktivieren.mockResolvedValue(true);
});

describe('BiometrieSchalter', () => {
  it('zeigt den Eintrag mit der erkannten Biometrie-Art', async () => {
    render(<BiometrieSchalter variante="purple" />);
    expect(await screen.findByText('Anmelden mit Face ID')).toBeInTheDocument();
  });

  it('benennt Touch ID, wenn das Geraet Touch ID hat', async () => {
    mockVerfuegbar.mockResolvedValue({
      verfuegbar: true,
      art: 'touchId',
      bezeichnung: 'Touch ID',
    });
    render(<BiometrieSchalter variante="users" />);
    expect(await screen.findByText('Anmelden mit Touch ID')).toBeInTheDocument();
  });

  it('zeigt GAR NICHTS, wenn keine Biometrie eingerichtet ist', async () => {
    mockVerfuegbar.mockResolvedValue({
      verfuegbar: false,
      art: 'biometrie',
      bezeichnung: 'Biometrie',
    });
    const { container } = render(<BiometrieSchalter variante="teamer" />);

    await waitFor(() => expect(mockVerfuegbar).toHaveBeenCalled());
    expect(container.querySelector('ion-toggle')).toBeNull();
    expect(screen.queryByText(/Anmelden mit/)).toBeNull();
  });

  it('uebernimmt die Farbvariante der jeweiligen Rolle', async () => {
    const { container } = render(<BiometrieSchalter variante="teamer" />);
    await screen.findByText('Anmelden mit Face ID');
    expect(container.querySelector('.app-list-item--teamer')).not.toBeNull();
  });

  it('zeigt die Frist an, wenn die Anmeldung bereits gesichert ist', async () => {
    mockIstAktiv.mockResolvedValue(true);
    render(<BiometrieSchalter variante="purple" />);
    expect(await screen.findByText('Angemeldet bleiben für 14 Tage')).toBeInTheDocument();
  });

  it('zeigt den Hinweistext, solange die Anmeldung nicht gesichert ist', async () => {
    render(<BiometrieSchalter variante="purple" />);
    expect(await screen.findByText('Ohne Passwort in die App')).toBeInTheDocument();
  });
});
