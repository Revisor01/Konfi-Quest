import { describe, it, expect } from 'vitest';
import {
  formatEventDate,
  formatEventTime,
  formatEventDateLong,
} from '../../../components/shared/eventFormatting';

// Fixe Zeit fuer deterministische Erwartungen (lokale Zeitzone-unabhaengig
// pruefen wir nur Format/Stabilitaet, nicht exakte Uhrzeit-Verschiebung).
const ISO = '2026-06-14T18:30:00';

describe('formatEventDate', () => {
  it('formatiert TT.MM.JJJJ', () => {
    expect(formatEventDate(ISO)).toBe('14.06.2026');
  });
});

describe('formatEventTime', () => {
  it('formatiert HH:MM', () => {
    expect(formatEventTime(ISO)).toMatch(/^\d{2}:\d{2}$/);
  });
  it('liefert leeren String bei leerer Eingabe', () => {
    expect(formatEventTime('')).toBe('');
  });
  it('liefert leeren String bei ungueltiger Eingabe', () => {
    expect(formatEventTime('kein-datum')).toBe('');
  });
});

describe('formatEventDateLong', () => {
  it('enthaelt Wochentag und ausgeschriebenen Monat', () => {
    const out = formatEventDateLong(ISO);
    expect(out).toContain('Juni');
    // Wochentag (Sonntag) am Anfang
    expect(out).toMatch(/^[A-Za-zäöü]+,/);
  });
});
