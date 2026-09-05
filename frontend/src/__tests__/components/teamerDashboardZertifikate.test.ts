import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Simon, 05.09.2026: "bei lasse im dashboard sehe ich noch das dash für
// zertifikate. aber er hat gar keine zertifikate. es soll bei allen teamern
// diesen block ausblenden wenn sie 0 haben und ansonsten auch nur eins
// zeigen wenn es nur eins gibt. sonst nimmt der block so viel platz weg."
//
// URSACHE: GET /teamer/dashboard liefert per LEFT JOIN ALLE aktiven
// Zertifikatstypen der Gemeinde, auch die nicht erworbenen ('not_earned').
// `certificates.length > 0` war deshalb nie falsch, sobald die Gemeinde
// ueberhaupt Typen fuehrt — der Block stand mit lauter Platzhaltern da.
//
// Auf Produktion nachgemessen (05.09.2026): 15 von 17 Teamer:innen haben
// null Zertifikate, genau eine Person hat eins. Beide Lasse haben 0 eigene
// bei 4 Typen in ihrer Gemeinde — also vier leere Platzhalter.
//
// Gefiltert wird im FRONTEND, nicht in der Route: Die Antwortform bleibt
// unveraendert, ausgelieferte App-Versionen zeigen ihre gewohnte Ansicht
// weiter (Regel "Ausgelieferte Apps nie brechen").

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const dashboard = lies('src/components/teamer/pages/TeamerDashboardPage.tsx');
const material = lies('src/components/teamer/pages/TeamerMaterialPage.tsx');

describe('Teamer-Dashboard: Zertifikate', () => {
  it('zaehlt nur die tatsaechlich erhaltenen', () => {
    expect(dashboard).toContain("filter(c => c.status !== 'not_earned')");
  });

  it('blendet den Block aus, wenn keins erhalten wurde', () => {
    // Vorher hing die Bedingung an dashboardData.certificates.length, das die
    // nicht erworbenen mitzaehlte.
    expect(dashboard).toContain('erhalteneZertifikate.length > 0');
    expect(dashboard).not.toContain('dashboardData.certificates.length > 0');
  });

  it('nutzt eine Spalte, wenn es genau eins gibt', () => {
    // Sonst stand die einzelne Karte auf halber Breite neben einer leeren
    // Haelfte.
    expect(dashboard).toContain("erhalteneZertifikate.length === 1 ? '1fr' : 'repeat(2, 1fr)'");
  });

  it('rendert nur die erhaltenen, nicht die Rohliste', () => {
    expect(dashboard).toContain('erhalteneZertifikate.map(');
    expect(dashboard).not.toContain('dashboardData.certificates.map(');
  });

  it('zeigt keinen sinnlosen Bruch wie "1/1"', () => {
    // Ohne die nicht erworbenen ist der Nenner gleich dem Zaehler, solange
    // nichts abgelaufen ist. Der Bruch bleibt nur fuer den Fall, in dem er
    // etwas aussagt.
    expect(dashboard).toContain("erhalteneZertifikate.some(c => c.status === 'expired')");
  });
});

describe('Teamer-Dashboard: Kopfbereich', () => {
  it('nutzt den gemeinsamen Teamer-Verlauf', () => {
    // Dritte Stelle mit eigenem, hellerem Rot (#e11d48) — nach Profil und
    // Wrapped-Kachel. Jetzt ziehen alle drei aus derselben Variablen.
    // Kommentare raus: Der alte Farbwert wird dort absichtlich genannt.
    const ohneKommentare = dashboard.replace(/^\s*\/\/.*$/gm, '');
    expect(ohneKommentare).not.toContain('#e11d48');
    const kopf = ohneKommentare.slice(ohneKommentare.indexOf('app-dashboard-header"'));
    expect(kopf.slice(0, 300)).toContain('var(--app-gradient-teamer)');
  });
});

describe('Material-Seite: kein Zurueck im eigenen Tab', () => {
  it('kennt den Unterschied zwischen Tab und Altroute', () => {
    // Die Seite haengt an '/teamer/profile/material' (Tab seit 04.09.2026)
    // UND '/teamer/material' (Altroute fuer Deep-Links und ausgelieferte
    // Apps). Im Tab springt window.history.back() aus dem Reiter heraus.
    expect(material).toContain('istEigenerTab');
    expect(material).toContain("pfad.startsWith('/teamer/profile/material')");
  });

  it('zeigt den Zurueck-Knopf der Liste nur ausserhalb des Tabs', () => {
    expect(material).toContain('{!istEigenerTab && (');
  });

  it('behaelt den Zurueck-Weg aus der Detailansicht', () => {
    // Der zweite Knopf ist ein anderer: Er fuehrt aus dem Material-Detail
    // zurueck in die Liste und muss bleiben — auch im Tab.
    expect(material).toContain('setSelectedMaterial(null)');
    expect(material).toContain('aria-label="Zurück zur Material-Liste"');
  });
});
