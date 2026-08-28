// frontend/src/__tests__/components/statuswortVerbucht.test.ts
//
// Entscheidung 28.08.2026: Die Leitungssicht sagt "Verbucht" statt
// "Genehmigt". Das Wort beschreibt, was passiert ist — die Punkte sind
// gutgeschrieben — statt einen Verwaltungsakt, und es steht in der App schon
// bei den Terminen ("Verbuchen"/"Verbucht") sowie im Handbuch.
//
// Die Vorlage aus der alten Notiz ("an die Konfi-Seite angleichen") gab es
// nicht mehr: Konfis lesen heute "Dein Team schaut es sich an" und "Punkte
// sind da". Es war also eine neue Entscheidung, keine Angleichung.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const lies = (pfad: string) =>
  readFileSync(join(process.cwd(), 'src', pfad), 'utf-8');

describe('Statuswort in der Leitungssicht', () => {
  const ansicht = lies('components/admin/ActivityRequestsView.tsx');

  it('sagt "Verbucht", nicht "Genehmigt"', () => {
    expect(ansicht).toContain("'Verbucht'");
    expect(ansicht).not.toContain("'Genehmigt'");
    expect(ansicht).not.toContain('>Genehmigt<');
  });

  it('nutzt das Wort an allen drei Stellen — Kachel, Reiter, Eintrag', () => {
    // Kachel und Filterreiter schalten auf denselben Filter; steht das Wort
    // nur an einer Stelle, widersprechen sich Reiter und Liste.
    const treffer = ansicht.match(/Verbucht/g) || [];
    expect(treffer.length).toBeGreaterThanOrEqual(3);
  });

  it('behaelt den technischen Statuswert "approved"', () => {
    // Nur die Anzeige aendert sich. Der Wert in der Datenbank und in der
    // Schnittstelle bleibt 'approved' — sonst braeche der Filter.
    expect(ansicht).toContain("'approved'");
  });
});

describe('Symbol-Zuordnung', () => {
  const badge = lies('components/shared/StatusBadge.tsx');

  it('kennt "Verbucht"', () => {
    // Stand schon vorher drin, fuer die Termine — dadurch tragen Termine und
    // Antraege jetzt dasselbe Wort mit demselben Symbol.
    expect(badge).toMatch(/'Verbucht':/);
  });

  it('kennt "Genehmigt" weiterhin', () => {
    // Das alte Wort kann in Screenshots und aelteren Ansichten auftauchen und
    // verloere sonst sein Symbol.
    expect(badge).toMatch(/'Genehmigt':/);
  });
});

describe('Icon der Antraege', () => {
  it('nutzt documentTextOutline wie die Termin-Detailansicht', () => {
    const ansicht = lies('components/admin/ActivityRequestsView.tsx');
    expect(ansicht).toContain('documentTextOutline');
    expect(ansicht).not.toContain('documentOutline');
  });

  it('laesst die Zertifikate in der Konfi-Liste unberuehrt', () => {
    // Dort steht documentOutline fuer ZERTIFIKATE — ein anderer Gegenstand,
    // der bewusst sein eigenes Symbol behaelt.
    const konfis = lies('components/admin/KonfisView.tsx');
    expect(konfis).toContain('documentOutline');
  });
});
