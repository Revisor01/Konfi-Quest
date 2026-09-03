import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Nutzerhinweis 03.09.2026: Die Zusage-Knoepfe ("Bin dabei" / "Bin nicht
// dabei") standen zu hoch im Verhaeltnis zu den anderen Knoepfen.
//
// Gemessen war nicht der Knopf (40px, genau wie "Event absagen"), sondern die
// Karte drumherum: 80px statt 72px. Ursache war doppelte Polsterung --
// 16px Padding der Karte PLUS Ionics eigener 4px-Rand am ion-button, oben
// und unten. Die Klasse app-button-row--in-card nimmt diesen Rand zurueck.
//
// Dieselbe Absicht verfolgt der aeltere app-event-detail__add-button-wrapper
// ("gleicht Ionic ion-button margin aus") -- nur fuer einen einzelnen Knopf
// statt fuer eine Reihe.
//
// Die Knoepfe bekommen bewusst KEIN app-action-button (48px): Die
// Nachbarknoepfe dieser Seiten sind 40px hoch, mit 48px waere die Reihe
// wieder aus der Reihe gefallen -- nur andersherum.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const css = lies('src/theme/variables.css');
const adminDetail = lies('src/components/admin/views/EventDetailView.tsx');
const teamerSeite = lies('src/components/teamer/pages/TeamerEventsPage.tsx');

describe('Button-Reihe in einer Karte polstert nicht doppelt', () => {
  it('die Ausgleichsklasse existiert', () => {
    expect(css).toContain('.app-button-row--in-card');
  });

  it('sie nimmt Ionics Button-Rand oben und unten zurueck', () => {
    const block = css.slice(
      css.indexOf('.app-button-row--in-card'),
      css.indexOf('}', css.indexOf('.app-button-row--in-card')) + 1
    );
    expect(block).toContain('margin-top: -4px');
    expect(block).toContain('margin-bottom: -4px');
  });

  it('die Zusage-Reihe der Leitung nutzt sie', () => {
    expect(adminDetail).toContain('app-button-row app-button-row--in-card');
  });

  it('die Zusage-Reihe des Teams nutzt sie', () => {
    expect(teamerSeite).toContain('app-button-row app-button-row--in-card');
  });
});

describe('Die Zusage-Knoepfe der Leitung bleiben auf Nachbar-Hoehe', () => {
  // Der Abschnitt zwischen "Bist du dabei?" und dem Ende der Karte.
  const abschnitt = adminDetail.slice(
    adminDetail.indexOf('Bist du dabei?'),
    adminDetail.indexOf('Bin nicht dabei') + 200
  );

  it('setzt kein app-action-button (das waere 48px statt 40px)', () => {
    // Auf die tatsaechliche Verwendung pruefen, nicht auf das blosse
    // Vorkommen des Wortes -- der Kommentar daneben nennt es absichtlich.
    expect(abschnitt).not.toContain('className="app-action-button"');
  });

  it('beide Knoepfe stehen weiterhin in der Reihe', () => {
    expect(abschnitt).toContain('Bin dabei');
    expect(abschnitt).toContain('Bin nicht dabei');
  });
});

describe('Beschreibung steht vor der Zusage-Karte', () => {
  // Simons Reihenfolge 03.09.2026: erst lesen, worum es geht, dann zusagen.
  // Vorher sass die Zusage direkt hinter den Eckdaten -- man sagte zu, bevor
  // die Beschreibung ueberhaupt sichtbar war.
  const konfiDetail = lies('src/components/konfi/views/EventDetailView.tsx');

  const reihenfolge = (quelle: string, beschreibung: string, zusage: string) => {
    const b = quelle.indexOf(beschreibung);
    const z = quelle.indexOf(zusage);
    expect(b, `Beschreibung nicht gefunden: ${beschreibung}`).toBeGreaterThan(-1);
    expect(z, `Zusage nicht gefunden: ${zusage}`).toBeGreaterThan(-1);
    return { b, z };
  };

  it('Leitung: Beschreibung vor "Bist du dabei?"', () => {
    const { b, z } = reihenfolge(adminDetail, '{/* Beschreibung */}', 'Bist du dabei?');
    expect(b).toBeLessThan(z);
  });

  it('Konfi: Beschreibung vor "Bist du dabei?"', () => {
    const { b, z } = reihenfolge(konfiDetail, '{/* Beschreibung - eigene Card', 'Bist du dabei?');
    expect(b).toBeLessThan(z);
  });

  it('Team: Beschreibung vor "Bist du dabei?"', () => {
    const { b, z } = reihenfolge(teamerSeite, '{/* Beschreibung - eigene Card', 'Bist du dabei?');
    expect(b).toBeLessThan(z);
  });
});
