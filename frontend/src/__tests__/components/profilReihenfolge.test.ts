import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Simons Reihenfolge fuer die beiden Profile im Admin (03.09.2026):
//
//   Konfi:  Konfirmation, Rueckblick (wenn vorhanden), Bonus, Events,
//           Aktivitaeten, Badges, Rolle
//   Teamer: Konfirmation/Konfispruch (sofern uebernommen oder eingetragen)
//           samt "Teamer:in seit", Rueckblick (wenn vorhanden), Zertifikate,
//           Events, Aktivitaeten, Badges
//
// Beide Rollen teilen sich KonfiDetailView; welche Bloecke erscheinen,
// entscheidet isTeamer. Geprueft wird deshalb die Reihenfolge im Quelltext.

const quelle = readFileSync(
  resolve(process.cwd(), 'src/components/admin/views/KonfiDetailView.tsx'),
  'utf8'
);

// Position eines Abschnitts im Quelltext.
const pos = (marke: string): number => {
  const i = quelle.indexOf(marke);
  expect(i, `Abschnitt nicht gefunden: ${marke}`).toBeGreaterThan(-1);
  return i;
};

const KONFIRMATION = '{/* Konfirmation (Termin + Spruch';
const TEAMER_SEIT  = '{/* Teamer: Aktiv-seit bearbeiten';
const HISTORIE     = '{/* Konfi-Historie - nur für promoted Teamer */}';
const RUECKBLICK   = '{/* Jahresrueckblick der Konfi';
const ZERTIFIKATE  = '{/* Zertifikate - nur fuer Teamer, und nur wenn es welche gibt';
const BONUS        = '{/* Bonuspunkte - nur für Konfis */}';
const EVENTS_KONFI = '{/* Event Points - nur für Konfis */}';
const EVENTS_TEAM  = '{/* Teamer Events';
const AKTIVITAETEN = '{/* Aktivitäten - bei Teamer nur Teamer-Aktivitaeten */}';
const BADGES_KONFI = '{/* Badges — bei beiden Rollen';
const BADGES_TEAM  = '{/* Badges der Teamer:innen';
const ROLLE        = '{/* Teamer-Beförderung - nur für Konfis */}';

describe('Konfi-Profil: Reihenfolge der Abschnitte', () => {
  it('Konfirmation steht ganz oben', () => {
    expect(pos(KONFIRMATION)).toBeLessThan(pos(RUECKBLICK));
    expect(pos(KONFIRMATION)).toBeLessThan(pos(BONUS));
  });

  it('der Rueckblick kommt direkt nach der Konfirmation, vor dem Bonus', () => {
    expect(pos(RUECKBLICK)).toBeGreaterThan(pos(KONFIRMATION));
    expect(pos(RUECKBLICK)).toBeLessThan(pos(BONUS));
  });

  it('Bonus vor Events', () => {
    expect(pos(BONUS)).toBeLessThan(pos(EVENTS_KONFI));
  });

  it('Events vor Aktivitaeten', () => {
    expect(pos(EVENTS_KONFI)).toBeLessThan(pos(AKTIVITAETEN));
  });

  it('Aktivitaeten vor Badges', () => {
    expect(pos(AKTIVITAETEN)).toBeLessThan(pos(BADGES_KONFI));
  });

  it('die Rolle steht ganz unten', () => {
    expect(pos(ROLLE)).toBeGreaterThan(pos(BADGES_KONFI));
    expect(pos(ROLLE)).toBeGreaterThan(pos(AKTIVITAETEN));
  });
});

describe('Teamer-Profil: Reihenfolge der Abschnitte', () => {
  it('"Teamer:in seit" steht oben bei der Konfirmation, nicht unten', () => {
    expect(pos(TEAMER_SEIT)).toBeGreaterThan(pos(KONFIRMATION));
    expect(pos(TEAMER_SEIT)).toBeLessThan(pos(RUECKBLICK));
    // Frueher stand der Block hinter den Zertifikaten.
    expect(pos(TEAMER_SEIT)).toBeLessThan(pos(ZERTIFIKATE));
  });

  it('die Konfi-Historie gehoert zum Konfirmations-Bereich', () => {
    expect(pos(HISTORIE)).toBeGreaterThan(pos(TEAMER_SEIT));
    expect(pos(HISTORIE)).toBeLessThan(pos(RUECKBLICK));
  });

  it('der Rueckblick steht vor den Zertifikaten', () => {
    expect(pos(RUECKBLICK)).toBeLessThan(pos(ZERTIFIKATE));
  });

  it('Zertifikate vor den Events', () => {
    expect(pos(ZERTIFIKATE)).toBeLessThan(pos(EVENTS_TEAM));
  });

  it('Events vor Aktivitaeten, Aktivitaeten vor Badges', () => {
    expect(pos(EVENTS_TEAM)).toBeLessThan(pos(AKTIVITAETEN));
    expect(pos(AKTIVITAETEN)).toBeLessThan(pos(BADGES_TEAM));
  });
});

describe('Konfirmation erscheint auch bei uebernommenen Teamer:innen', () => {
  const block = quelle.slice(pos(KONFIRMATION), pos(TEAMER_SEIT));

  it('nicht mehr nur fuer Konfis', () => {
    // Vorher: {!isTeamer && currentKonfi?.role_name === 'konfi' && (
    expect(block).toContain('isTeamer &&');
    expect(block).toMatch(/konfspruch|confirmation_date/);
  });

  it('ohne Eintrag bleibt die Karte weg', () => {
    // Sonst stuende bei jeder Teamer:in eine leere Konfirmations-Karte.
    expect(block).toContain('currentKonfi?.konfspruch');
    expect(block).toContain('currentKonfi?.confirmation_date');
  });
});
