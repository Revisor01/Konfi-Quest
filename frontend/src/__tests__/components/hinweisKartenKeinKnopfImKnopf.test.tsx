import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht (Nachtrag 27.09.2026): Die Neuigkeiten-Karten
// (.app-whatsnew) waren selbst role="button" und trugen das X als zweiten
// Knopf IN sich -- Knopf im Knopf. Vorlesehilfen fassen eine Schaltflaeche als
// ein Blatt auf: Das X war in der Karte versteckt oder wurde doppelt
// angesagt. Und per Tastatur loeste Enter auf dem X ZUSAETZLICH die Karte aus:
// Der keydown stieg zur Karte auf, deren Handler nicht pruefte, wo die Taste
// fiel -- „Hinweis ausblenden" oeffnete zugleich den Walkthrough.
//
// Muster seitdem wie die 19 Stellen aus BF-03 (klickbareElementeBedienbar):
// Die Karte ist role="presentation" und nimmt nur den Finger an; Knopf fuer
// Tastatur und Vorlesehilfe ist ihr Text (role="button", tabIndex 0,
// tastaturKlick); das X steht daneben als eigener <button>.
//
// Drei Karten, dieselbe Form: „Was ist neu" (UpdateHinweisKarte), „Events und
// Aktivitaeten" (MitmachenHinweisKarte), „Version x ist da" (StoreUpdateBanner).
// ---------------------------------------------------------------------------

vi.mock('../../services/updateCheck', () => ({
  pruefeStoreUpdate: async () => ({ version: '2.4.0', url: 'https://apps.apple.com/de/app/konfi-quest/id6748016619' }),
  istHinweisWeggeklickt: async () => false,
  merkeHinweisWeggeklickt: vi.fn(),
}));

import UpdateHinweisKarte from '../../components/shared/UpdateHinweisKarte';
import MitmachenHinweisKarte from '../../components/shared/MitmachenHinweisKarte';
import StoreUpdateBanner from '../../components/shared/StoreUpdateBanner';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Interaktive Elemente, die in einem anderen interaktiven Element stecken.
const knopfImKnopf = (wurzel: HTMLElement): string[] => {
  const interaktiv = 'button, [role="button"], a[href], [tabindex="0"]';
  return [...wurzel.querySelectorAll<HTMLElement>(interaktiv)]
    .filter((el) => el.parentElement?.closest(interaktiv))
    .map((el) => el.getAttribute('aria-label') || el.textContent || el.tagName);
};

interface Karte {
  name: string;
  knopf: RegExp;
  rendern: (onOpen: () => void, onDismiss: () => void) => void;
}

const KARTEN: Karte[] = [
  {
    name: '„Was ist neu" (UpdateHinweisKarte)',
    knopf: /^Was ist neu in Version .+\? Die Neuerungen ansehen$/,
    rendern: (onOpen, onDismiss) => { render(<UpdateHinweisKarte onOpen={onOpen} onDismiss={onDismiss} />); },
  },
  {
    name: '„Events und Aktivitäten" (MitmachenHinweisKarte)',
    knopf: /^Events und Aktivitäten: So funktioniert der Mitmachen-Tab$/,
    rendern: (onOpen, onDismiss) => { render(<MitmachenHinweisKarte onOpen={onOpen} onDismiss={onDismiss} />); },
  },
];

describe('Neuigkeiten-Karten: Karte und X sind getrennte Knoepfe (kein Knopf im Knopf)', () => {
  for (const karte of KARTEN) {
    describe(karte.name, () => {
      const aufbauen = () => {
        const onOpen = vi.fn();
        const onDismiss = vi.fn();
        karte.rendern(onOpen, onDismiss);
        const knopf = screen.getByRole('button', { name: karte.knopf });
        const x = screen.getByRole('button', { name: 'Hinweis ausblenden' });
        return { onOpen, onDismiss, knopf, x };
      };

      it('kein interaktives Element steckt in einem anderen', () => {
        const { knopf } = aufbauen();
        expect(knopfImKnopf(document.body)).toEqual([]);
        // Die Karte selbst ist keine Schaltflaeche mehr, sondern der Rahmen.
        const rahmen = knopf.closest('.app-whatsnew')!;
        expect(rahmen.getAttribute('role')).toBe('presentation');
        expect(rahmen.contains(screen.getByRole('button', { name: 'Hinweis ausblenden' }))).toBe(true);
      });

      it('beide sind per Tab erreichbar: der Kartenknopf mit tabIndex 0, das X als echter <button>', () => {
        const { knopf, x } = aufbauen();
        expect(knopf.tabIndex).toBe(0);
        expect(x.tagName).toBe('BUTTON');
        expect(x.tabIndex).toBe(0);
        expect(knopf.contains(x)).toBe(false);
        expect(x.contains(knopf)).toBe(false);
      });

      it('Enter und Leertaste auf dem Kartenknopf oeffnen, ohne auszublenden', () => {
        const { onOpen, onDismiss, knopf } = aufbauen();
        fireEvent.keyDown(knopf, { key: 'Enter' });
        expect(onOpen).toHaveBeenCalledTimes(1);
        fireEvent.keyDown(knopf, { key: ' ' });
        expect(onOpen).toHaveBeenCalledTimes(2);
        expect(onDismiss).toHaveBeenCalledTimes(0);
      });

      it('Enter und Leertaste auf dem X oeffnen NICHT zusaetzlich die Karte', () => {
        const { onOpen, x } = aufbauen();
        fireEvent.keyDown(x, { key: 'Enter' });
        fireEvent.keyDown(x, { key: ' ' });
        expect(onOpen).toHaveBeenCalledTimes(0);
      });

      it('das X (Klick, wie ihn der Browser auch bei Enter/Leertaste auf einem <button> ausloest) blendet nur aus', () => {
        const { onOpen, onDismiss, x } = aufbauen();
        fireEvent.click(x);
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(onOpen).toHaveBeenCalledTimes(0);
      });

      it('ein Fingertipp irgendwo auf die Karte oeffnet wie bisher', () => {
        const { onOpen, knopf } = aufbauen();
        fireEvent.click(knopf.closest('.app-whatsnew')!);
        expect(onOpen).toHaveBeenCalledTimes(1);
      });
    });
  }

  describe('„Version x ist da" (StoreUpdateBanner)', () => {
    const aufbauen = async () => {
      const oeffnen = vi.spyOn(window, 'open').mockReturnValue(null);
      render(<StoreUpdateBanner />);
      const knopf = await screen.findByRole('button', { name: /^Version 2\.4\.0 ist verfügbar\. Im Store ansehen$/ });
      const x = screen.getByRole('button', { name: 'Hinweis ausblenden' });
      return { oeffnen, knopf, x };
    };

    it('kein Knopf im Knopf, beide per Tab erreichbar', async () => {
      const { knopf, x } = await aufbauen();
      expect(knopfImKnopf(document.body)).toEqual([]);
      expect(knopf.tabIndex).toBe(0);
      expect(x.tagName).toBe('BUTTON');
      expect(knopf.contains(x)).toBe(false);
    });

    it('Enter und Leertaste auf dem Kartenknopf oeffnen den Store', async () => {
      const { oeffnen, knopf } = await aufbauen();
      fireEvent.keyDown(knopf, { key: 'Enter' });
      fireEvent.keyDown(knopf, { key: ' ' });
      expect(oeffnen).toHaveBeenCalledTimes(2);
    });

    it('Enter und Leertaste auf dem X oeffnen den Store NICHT; der Klick blendet aus', async () => {
      const { oeffnen, x } = await aufbauen();
      fireEvent.keyDown(x, { key: 'Enter' });
      fireEvent.keyDown(x, { key: ' ' });
      expect(oeffnen).toHaveBeenCalledTimes(0);
      fireEvent.click(x);
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Hinweis ausblenden' })).toBeNull());
      expect(oeffnen).toHaveBeenCalledTimes(0);
    });
  });
});
