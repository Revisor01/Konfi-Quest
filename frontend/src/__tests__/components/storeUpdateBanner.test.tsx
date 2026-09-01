// Tests fuer den StoreUpdateBanner — den dezenten "Neue Version im Store"-
// Hinweis auf den drei Dashboards.
//
// Der Service (updateCheck) ist gemockt; hier geht es NUR um das Verhalten
// der Karte: sichtbar bei Update, unsichtbar ohne, X blendet aus und merkt
// das pro Version, Tippen oeffnet die Store-Seite (und blockiert nichts —
// eine Blockade waere ein Apple-Ablehnungsgrund, siehe StoreUpdateBanner.tsx).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react';

const halter = {
  update: null as { version: string; url: string } | null,
  weggeklickt: false,
};

const mockMerkeWeggeklickt = vi.fn(async (_version: string) => {});

vi.mock('../../services/updateCheck', () => ({
  pruefeStoreUpdate: async () => halter.update,
  istHinweisWeggeklickt: async (_version: string) => halter.weggeklickt,
  merkeHinweisWeggeklickt: (version: string) => mockMerkeWeggeklickt(version),
}));

import StoreUpdateBanner from '../../components/shared/StoreUpdateBanner';

describe('StoreUpdateBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    halter.update = { version: '2.2.0', url: 'https://apps.apple.com/de/app/konfi-quest/id6748016619' };
    halter.weggeklickt = false;
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
