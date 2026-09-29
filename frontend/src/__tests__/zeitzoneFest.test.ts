// Die Frontend-Tests laufen in einer festen Zeitzone (Audit Tests 26.09.2026,
// BF-15; gesetzt in vite.config.ts unter test.env).
//
// Vorher lief die Suite in der Zone des Rechners (CI: UTC). Gemessen am
// 29.09.2026: unter TZ=Pacific/Kiritimati (UTC+14) fielen 13 Tests, die
// unter Berlin und UTC gruen waren -- etwa Datumszeilen der Anwesenheit
// ("13.09." statt "14.09."), Einladungen ("eingeladen am") und
// Abzeichen-Daten. Sie rechnen mit festen UTC-Zeitpunkten und erwarten den
// Kalendertag in Deutschland.
//
// Dieser Test haelt fest, dass die Zone wirklich greift -- auch wenn der Lauf
// aus einer Shell mit anderer TZ gestartet wird.
import { describe, it, expect } from 'vitest';

describe('Zeitzone des Testlaufs', () => {
  it('ist Europe/Berlin', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Berlin');
  });

  it('rechnet Kalendertage wie ein Geraet in Deutschland (Sommerzeit)', () => {
    // 22:30 UTC am 29.09. ist 00:30 am 30.09. in Berlin.
    const spaet = new Date('2026-09-29T22:30:00Z');
    expect(spaet.getDate()).toBe(30);
    expect(spaet.getHours()).toBe(0);
    expect(spaet.getTimezoneOffset()).toBe(-120);
  });

  it('und im Winter eine Stunde Versatz', () => {
    expect(new Date('2026-12-01T12:00:00Z').getTimezoneOffset()).toBe(-60);
  });
});
