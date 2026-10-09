import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

/*
 * Die Hinweiskarten im Profil tragen rechts KEINEN Pfeil (24.09.2026).
 *
 * Simons Befund am Geraet: "Bei den Info Buttons im Profil muss das Chevron
 * hinten rechts bei beiden raus, Versionshinweis und auch Events/Aktivitaeten."
 *
 * Gemeint sind die beiden farbigen Banner im Konfi-Profil: "Was ist neu in
 * Version ...?" (UpdateHinweisKarte) und "Events und Aktivitaeten"
 * (MitmachenHinweisKarte). Beide zeigten rechts ein `›`, wenn kein onDismiss
 * gesetzt war — im Profil ist das der Fall.
 *
 * Das X zum Ausblenden BLEIBT: Es hat eine Funktion, der Pfeil war reine
 * Zierde. Deshalb pruefen die Tests unten beides getrennt -- seit 09.10.2026
 * gerendert, mit und ohne onDismiss.
 */

// Das Symbol als lesbares Element: so ist pruefbar, WELCHES Icon steht.
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  IonIcon: ({ icon }: { icon?: string }) => <i data-icon={icon} />,
}));

import UpdateHinweisKarte from '../../../components/shared/UpdateHinweisKarte';
import MitmachenHinweisKarte from '../../../components/shared/MitmachenHinweisKarte';
import { ICON_FUNKELN, ICON_SCHLIESSEN, ICON_WEITER_GEFUELLT } from '../../../components/shared/icons';

afterEach(() => cleanup());

const KARTEN: Array<[string, typeof UpdateHinweisKarte]> = [
  ['UpdateHinweisKarte', UpdateHinweisKarte],
  ['MitmachenHinweisKarte', MitmachenHinweisKarte],
];

const symbole = (c: HTMLElement) => [...c.querySelectorAll('i[data-icon]')].map((i) => i.getAttribute('data-icon'));

describe('Hinweiskarten im Profil', () => {
  for (const [name, Karte] of KARTEN) {
    it(`${name} zeichnet keinen Pfeil mehr`, () => {
      // Im Profil (ohne onDismiss) und auf der Startseite (mit): nur das
      // Funkeln vorne, kein Pfeil hinten.
      const profil = render(<Karte onOpen={vi.fn()} />);
      expect(symbole(profil.container)).toEqual([ICON_FUNKELN]);
      expect(profil.container.querySelector('.app-whatsnew__chevron')).toBeNull();
      cleanup();
      const start = render(<Karte onOpen={vi.fn()} onDismiss={vi.fn()} />);
      expect(symbole(start.container)).not.toContain(ICON_WEITER_GEFUELLT);
      expect(start.container.querySelector('.app-whatsnew__chevron')).toBeNull();
    });

    it(`${name} behaelt das X zum Ausblenden`, () => {
      // Gegenprobe: Der Test oben darf nicht gruen sein, weil jemand das
      // ganze Ende der Komponente entfernt hat.
      const onOpen = vi.fn();
      const onDismiss = vi.fn();
      const { container } = render(<Karte onOpen={onOpen} onDismiss={onDismiss} />);
      expect(symbole(container)).toEqual([ICON_FUNKELN, ICON_SCHLIESSEN]);
      fireEvent.click(screen.getByRole('button', { name: 'Hinweis ausblenden' }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
      // Das X oeffnet die Karte nicht mit.
      expect(onOpen).not.toHaveBeenCalled();
    });

    it(`${name}: im Profil ohne X, die Karte oeffnet beim Tippen`, () => {
      const onOpen = vi.fn();
      const { container } = render(<Karte onOpen={onOpen} />);
      expect(screen.queryByRole('button', { name: 'Hinweis ausblenden' })).toBeNull();
      fireEvent.click(container.querySelector('.app-whatsnew')!);
      expect(onOpen).toHaveBeenCalledTimes(1);
    });
  }
});
