import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Simons Einwand vom 30.08.2026: "wie soll opt out gehen, wenn die event
// details nie geladen werden?"
//
// Der Widerspruch war groesser als gedacht: handleOptOut hatte einen
// vollstaendigen Warteschlangen-Pfad (Typ 'opt-out'), der Knopf darueber war
// aber `disabled={!isOnline}` — der Offline-Pfad wurde nie erreicht, war also
// toter Code. Die Warteschlange versprach etwas, das die Oberflaeche nicht
// zuliess. handleUnregister hatte gar keinen Offline-Pfad.
//
// Beide gehen jetzt offline in die Warteschlange. Das ist auch sachlich
// richtig: Eine Abmeldung gibt einen Platz FREI, da ist offline nichts zu
// pruefen. Das Anmelden bleibt gesperrt, weil die Plaetze begrenzt sind und
// die App offline nicht weiss, ob noch einer frei ist.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const konfiTermin = lies('src/components/konfi/views/EventDetailView.tsx');

const abschnitt = (start: string, laenge = 2000) => {
  const i = konfiTermin.indexOf(start);
  expect(i, `${start} nicht gefunden`).toBeGreaterThan(-1);
  return konfiTermin.slice(i, i + laenge);
};

describe('Abmelden geht offline', () => {
  it('handleOptOut legt die Abmeldung in die Warteschlange', () => {
    const f = abschnitt('const handleOptOut');
    expect(f).toContain('writeQueue.enqueue');
    expect(f).toContain("type: 'opt-out'");
  });

  it('handleUnregister ebenfalls — vorher hatte es gar keinen Offline-Weg', () => {
    const f = abschnitt('const handleUnregister');
    expect(f).toContain('writeQueue.enqueue');
    expect(f).toContain("type: 'opt-out'");
  });

  it('kein Abmelden-Knopf ist mehr offline gesperrt', () => {
    // Die Stelle, an der der Offline-Pfad ins Leere lief.
    const knoepfe = konfiTermin.split('Abmelden').length - 1;
    expect(knoepfe).toBeGreaterThan(0);
    expect(konfiTermin).not.toContain("/> Du bist offline</> : 'Abmelden'}");
  });

  it('die Knoepfe sagen, dass gesendet wird', () => {
    expect(konfiTermin).toContain('Abmelden (wird gesendet)');
  });
});

describe('Anmelden bleibt offline gesperrt — mit Grund', () => {
  it('Anmelden und Warteliste sind weiterhin disabled', () => {
    // Begrenzte Plaetze sind offline nicht pruefbar. Eine eingereihte
    // Anmeldung, die Stunden spaeter am vollen Termin scheitert, waere
    // schlechter als ein ehrliches Nein.
    expect(konfiTermin).toContain("`Anmelden (${eventData.registered_count}");
    expect(konfiTermin).toMatch(/disabled=\{!isOnline\}/);
  });
});
