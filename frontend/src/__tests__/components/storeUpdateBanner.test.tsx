// Tests fuer den StoreUpdateBanner — den dezenten "Neue Version im Store"-
// Hinweis auf den drei Dashboards.
//
// Der Service (updateCheck) ist gemockt; hier geht es NUR um das Verhalten
// der Karte: sichtbar bei Update, unsichtbar ohne, X blendet aus und merkt
// das pro Version, Tippen oeffnet die Store-Seite (und blockiert nichts —
// eine Blockade waere ein Apple-Ablehnungsgrund, siehe StoreUpdateBanner.tsx).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react';

const halter = {
  update: null as { version: string; url: string } | null,
  weggeklickt: false,
  hintergrund: { zustand: 'nicht_moeglich', schluessel: null } as { zustand: string; schluessel: string | null },
};

const mockMerkeWeggeklickt = vi.fn(async (_version: string) => {});
const mockInstalliere = vi.fn(async () => true);

vi.mock('../../services/updateCheck', () => ({
  pruefeStoreUpdate: async () => halter.update,
  istHinweisWeggeklickt: async (_version: string) => halter.weggeklickt,
  merkeHinweisWeggeklickt: (version: string) => mockMerkeWeggeklickt(version),
  holeUpdateImHintergrund: async () => halter.hintergrund,
  installiereGeladenesUpdate: () => mockInstalliere(),
}));

import StoreUpdateBanner from '../../components/shared/StoreUpdateBanner';

describe('StoreUpdateBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    halter.update = { version: '2.2.0', url: 'https://apps.apple.com/de/app/konfi-quest/id6748016619' };
    halter.weggeklickt = false;
    halter.hintergrund = { zustand: 'nicht_moeglich', schluessel: null };
  });

  it('zeigt den Hinweis mit der Store-Version', async () => {
    const { findByText } = render(<StoreUpdateBanner />);
    expect(await findByText('Version 2.2.0 ist da')).toBeInTheDocument();
  });

  it('rendert NICHTS, wenn es kein Update gibt', async () => {
    halter.update = null;
    const { container } = render(<StoreUpdateBanner />);
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });

  it('rendert NICHTS, wenn der Hinweis fuer diese Version weggeklickt wurde', async () => {
    halter.weggeklickt = true;
    const { container } = render(<StoreUpdateBanner />);
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });

  it('Tippen oeffnet die Store-Seite', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const { findByRole } = render(<StoreUpdateBanner />);
    fireEvent.click(await findByRole('button', { name: /Version 2.2.0 ist verfügbar/ }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://apps.apple.com/de/app/konfi-quest/id6748016619',
      '_blank'
    );
    openSpy.mockRestore();
  });

  it('X blendet aus, merkt die Version und oeffnet NICHT den Store', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const { findByLabelText, container } = render(<StoreUpdateBanner />);
    fireEvent.click(await findByLabelText('Hinweis ausblenden'));
    await waitFor(() => expect(container.innerHTML).toBe(''));
    expect(mockMerkeWeggeklickt).toHaveBeenCalledWith('2.2.0');
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});

// Android (09.10.2026): Googles flexibles Update. Der Service entscheidet
// (androidInAppUpdate.test.ts); hier nur, was die Karte daraus macht.
describe('StoreUpdateBanner mit flexiblem Update (Android)', () => {
  const PLAY_URL = 'https://play.google.com/store/apps/details?id=de.godsapp.konfiquest';

  beforeEach(() => {
    vi.clearAllMocks();
    halter.update = { version: '2.5.0', url: PLAY_URL };
    halter.weggeklickt = false;
    halter.hintergrund = { zustand: 'bereit', schluessel: 'play-139' };
  });

  it('geladen: "Neustarten zum Aktualisieren", Tippen installiert und oeffnet NICHT die Store-Seite', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const { findByRole, getByText, queryByText } = render(<StoreUpdateBanner />);
    const knopf = await findByRole('button', { name: 'Das Update ist geladen. Neustarten zum Aktualisieren' });
    expect(getByText('Das Update ist geladen')).toBeInTheDocument();
    expect(getByText('Hier tippen: Neustarten zum Aktualisieren.')).toBeInTheDocument();
    // Nicht zwei Karten: die Store-Karte steht nicht daneben.
    expect(queryByText('Version 2.5.0 ist da')).toBeNull();
    fireEvent.click(knopf);
    await waitFor(() => expect(mockInstalliere).toHaveBeenCalledTimes(1));
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('geladen, auch wenn der Server keine neuere Version meldet (Play entscheidet)', async () => {
    halter.update = null;
    const { findByRole } = render(<StoreUpdateBanner />);
    expect(await findByRole('button', { name: /Das Update ist geladen/ })).toBeInTheDocument();
  });

  it('X blendet die geladene Karte aus und merkt das Update unter seinem Play-Schluessel', async () => {
    const { findByLabelText, container } = render(<StoreUpdateBanner />);
    fireEvent.click(await findByLabelText('Hinweis ausblenden'));
    await waitFor(() => expect(container.innerHTML).toBe(''));
    expect(mockMerkeWeggeklickt).toHaveBeenCalledWith('play-139');
    expect(mockInstalliere).not.toHaveBeenCalled();
  });

  for (const zustand of ['abgelehnt', 'weggeklickt']) {
    it(`${zustand}: keine Karte, auch nicht die mit Store-Link`, async () => {
      halter.hintergrund = { zustand, schluessel: 'play-139' };
      const { container } = render(<StoreUpdateBanner />);
      await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
      expect(container.innerHTML).toBe('');
    });
  }

  it('Google kann nicht: die bisherige Karte mit Store-Link', async () => {
    halter.hintergrund = { zustand: 'nicht_moeglich', schluessel: null };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const { findByRole } = render(<StoreUpdateBanner />);
    fireEvent.click(await findByRole('button', { name: 'Version 2.5.0 ist verfügbar. Im Store ansehen' }));
    expect(openSpy).toHaveBeenCalledWith(PLAY_URL, '_blank');
    expect(mockInstalliere).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});
