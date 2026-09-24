import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/*
 * Die Hinweiskarten im Profil tragen rechts KEINEN Pfeil (24.09.2026).
 *
 * Simons Befund am Geraet: "Bei den Info Buttons im Profil muss das Chevron
 * hinten rechts bei beiden raus, Versionshinweis und auch Events/Aktivitaeten."
 *
 * Gemeint sind die beiden farbigen Banner im Konfi-Profil: "Was ist neu in
 * Version 2.2?" (UpdateHinweisKarte) und "Events und Aktivitaeten"
 * (MitmachenHinweisKarte). Beide zeigten rechts ein `›`, wenn kein onDismiss
 * gesetzt war — im Profil ist das der Fall.
 *
 * Das X zum Ausblenden BLEIBT: Es hat eine Funktion, der Pfeil war reine
 * Zierde. Deshalb pruefen die Tests unten beides getrennt.
 */

const lies = (name: string) =>
  readFileSync(resolve(__dirname, `../../../components/shared/${name}`), 'utf-8');

const KARTEN = ['UpdateHinweisKarte.tsx', 'MitmachenHinweisKarte.tsx'];

describe('Hinweiskarten im Profil', () => {
  for (const karte of KARTEN) {
    it(`${karte} zeichnet keinen Pfeil mehr`, () => {
      const quelle = lies(karte);
      expect(quelle, `${karte} rendert noch ICON_WEITER`).not.toContain('ICON_WEITER');
      expect(quelle, `${karte} hat noch die Pfeil-Klasse`).not.toContain('app-whatsnew__chevron');
    });

    it(`${karte} behaelt das X zum Ausblenden`, () => {
      // Gegenprobe: Der Test oben darf nicht gruen sein, weil jemand das
      // ganze Ende der Komponente entfernt hat.
      const quelle = lies(karte);
      expect(quelle).toContain('ICON_SCHLIESSEN');
      expect(quelle).toContain('Hinweis ausblenden');
    });
  }
});
