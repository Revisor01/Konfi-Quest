import { describe, it, expect } from 'vitest';
import {
  istPunkteartAktiv,
  aktivePunktearten,
  ersteAktivePunkteart,
  PUNKTEART_NAME,
} from '../../utils/punktearten';

describe('punktearten', () => {
  describe('istPunkteartAktiv', () => {
    it('erkennt eine abgeschaltete Art', () => {
      const flags = { gottesdienst_enabled: false, gemeinde_enabled: true };
      expect(istPunkteartAktiv(flags, 'gottesdienst')).toBe(false);
      expect(istPunkteartAktiv(flags, 'gemeinde')).toBe(true);
    });

    it('erkennt eine aktive Art', () => {
      const flags = { gottesdienst_enabled: true, gemeinde_enabled: false };
      expect(istPunkteartAktiv(flags, 'gottesdienst')).toBe(true);
      expect(istPunkteartAktiv(flags, 'gemeinde')).toBe(false);
    });

    // Der wichtigste Fall: Fehlt das Feld, gilt die Art als AKTIV. Sonst
    // verschwaenden bei unvollstaendig geladenen Daten stillschweigend
    // Auswahlmoeglichkeiten, ohne dass es jemand merkt.
    it('behandelt fehlende Felder als aktiv', () => {
      expect(istPunkteartAktiv({}, 'gottesdienst')).toBe(true);
      expect(istPunkteartAktiv({}, 'gemeinde')).toBe(true);
      expect(istPunkteartAktiv(undefined, 'gottesdienst')).toBe(true);
      expect(istPunkteartAktiv(null, 'gemeinde')).toBe(true);
    });

    it('behandelt nur das jeweils fehlende Feld als aktiv', () => {
      const nurGemeindeGesetzt = { gemeinde_enabled: false };
      expect(istPunkteartAktiv(nurGemeindeGesetzt, 'gottesdienst')).toBe(true);
      expect(istPunkteartAktiv(nurGemeindeGesetzt, 'gemeinde')).toBe(false);
    });
  });

  describe('aktivePunktearten', () => {
    it('liefert beide, wenn beide aktiv sind', () => {
      expect(
        aktivePunktearten({ gottesdienst_enabled: true, gemeinde_enabled: true })
      ).toEqual(['gottesdienst', 'gemeinde']);
    });

    it('laesst die abgeschaltete Art weg', () => {
      expect(
        aktivePunktearten({ gottesdienst_enabled: false, gemeinde_enabled: true })
      ).toEqual(['gemeinde']);
      expect(
        aktivePunktearten({ gottesdienst_enabled: true, gemeinde_enabled: false })
      ).toEqual(['gottesdienst']);
    });

    it('haelt die Reihenfolge Gottesdienst vor Gemeinde ein', () => {
      expect(aktivePunktearten({})).toEqual(['gottesdienst', 'gemeinde']);
    });

    it('liefert eine leere Liste, wenn beide abgeschaltet sind', () => {
      // Sollte nicht vorkommen (das Backend erzwingt seit 24.08.2026 eine
      // aktive Art), muss aber definiert sein statt zu werfen.
      expect(
        aktivePunktearten({ gottesdienst_enabled: false, gemeinde_enabled: false })
      ).toEqual([]);
    });
  });

  describe('ersteAktivePunkteart', () => {
    it('nimmt den Wunsch, wenn dessen Art aktiv ist', () => {
      const flags = { gottesdienst_enabled: true, gemeinde_enabled: true };
      expect(ersteAktivePunkteart(flags, 'gemeinde')).toBe('gemeinde');
      expect(ersteAktivePunkteart(flags, 'gottesdienst')).toBe('gottesdienst');
    });

    // Der Fall, der die Modale betraf: Vorbelegung 'gemeinde', aber Gemeinde
    // ist abgeschaltet -- vorher stand die verbotene Art im Feld.
    it('weicht auf die aktive Art aus, wenn der Wunsch abgeschaltet ist', () => {
      expect(
        ersteAktivePunkteart(
          { gottesdienst_enabled: true, gemeinde_enabled: false },
          'gemeinde'
        )
      ).toBe('gottesdienst');
    });

    it('nimmt ohne Angabe Gemeinde, solange die aktiv ist', () => {
      expect(ersteAktivePunkteart({})).toBe('gemeinde');
    });

    it('liefert null, wenn keine Art aktiv ist', () => {
      expect(
        ersteAktivePunkteart({
          gottesdienst_enabled: false,
          gemeinde_enabled: false,
        })
      ).toBeNull();
    });
  });

  describe('PUNKTEART_NAME', () => {
    it('nennt beide Arten so, wie sie in der Oberflaeche heissen', () => {
      expect(PUNKTEART_NAME.gottesdienst).toBe('Gottesdienst');
      expect(PUNKTEART_NAME.gemeinde).toBe('Gemeinde');
    });
  });
});
