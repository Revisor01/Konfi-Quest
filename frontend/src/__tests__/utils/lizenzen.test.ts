import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { resolve } from 'path';
import { LIZENZEN, TARIF_OPTIONEN, istTarif, lizenzFinden, lizenzLimit, lizenzText } from '../../utils/lizenzen';
import { TESTPHASE_KONFIS } from '../../utils/konfiLimitVorgabe';

// Die Lizenzen der Oberflaeche (utils/lizenzen.ts) sind dieselben wie die des
// Servers (backend/utils/lizenzen.js) -- dort haelt ein Test sie mit der
// Startseite, den Tarif-Stufen und dem CHECK der Migration 192 zusammen.

const require = createRequire(import.meta.url);
const server = require(resolve(process.cwd(), '../backend/utils/lizenzen.js')) as {
  LIZENZEN: Array<{ schluessel: string; name: string; konfis: number | null; euro: number }>;
};

describe('Lizenzen', () => {
  it('dieselbe Liste wie der Server', () => {
    expect(LIZENZEN.map((l) => ({ ...l }))).toEqual(server.LIZENZEN.map((l) => ({ ...l })));
  });

  it('lizenzFinden: ein Schlüssel oder null', () => {
    expect(lizenzFinden('plus')?.name).toBe('Plus');
    expect(lizenzFinden(null)).toBeNull();
    expect(lizenzFinden('unbegrenzt')).toBeNull();
  });

  it('lizenzText: Name und Grenze', () => {
    expect(lizenzText(lizenzFinden('gross')!)).toBe('Groß — bis 100 Konfis');
    expect(lizenzText(lizenzFinden('verbund')!)).toBe('Verbund — bis 4 Gemeinden');
  });

  it('lizenzLimit: Konfi-Zahl als Formularwert; ohne Lizenz und beim Verbund unbegrenzt', () => {
    expect(lizenzLimit('klein')).toBe('15');
    expect(lizenzLimit('standard')).toBe('50');
    expect(lizenzLimit('verbund')).toBe('');
    expect(lizenzLimit(null)).toBe('');
    expect(lizenzLimit(undefined)).toBe('');
  });
});

describe('Tarif-Auswahl', () => {
  it('mit Preis: Testphase, Klein, Standard, Plus, Groß, Unbegrenzt', () => {
    expect(TARIF_OPTIONEN.map((t) => [t.wert, t.text])).toEqual([
      ['5', 'Testphase — bis 5 Konfis · kostenlos, 30 Tage'],
      ['15', 'Klein — bis 15 Konfis · 49 € pro Jahr'],
      ['50', 'Standard — bis 50 Konfis · 99 € pro Jahr'],
      ['75', 'Plus — bis 75 Konfis · 139 € pro Jahr'],
      ['100', 'Groß — bis 100 Konfis · 179 € pro Jahr'],
      ['', 'Unbegrenzt — ohne Konfi-Grenze'],
    ]);
  });

  it('die Testphase passt zur Vorgabe der Regel', () => {
    expect(TARIF_OPTIONEN[0].wert).toBe(String(TESTPHASE_KONFIS));
  });

  it('istTarif: Tarife und Unbegrenzt ja, eigene Zahlen nein', () => {
    expect(istTarif('50')).toBe(true);
    expect(istTarif('')).toBe(true);
    expect(istTarif('5')).toBe(true);
    expect(istTarif('30')).toBe(false);
  });
});
