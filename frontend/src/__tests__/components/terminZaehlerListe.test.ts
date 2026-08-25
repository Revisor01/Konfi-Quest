import { describe, it, expect } from 'vitest';

// Bugreport 25.08.2026 (Konfi-Fahrt): Die Terminliste der Leitung zeigte
// "15 Konfis, 4 Teamer" — tatsaechlich sind es 19 Konfis und 4 Teamer.
//
// Ursache: Das Frontend rechnete `registered_count - teamer_count`. Seit
// Migration 120 schliesst registered_count die Teamer aber bereits AUS
// (backend/routes/events.js:145: FILTER ... r_book.name <> 'teamer'), und
// teamer_count zaehlt sie getrennt. Die Subtraktion zog sie ein zweites Mal
// ab: 19 - 4 = 15.
//
// Die Subtraktion stand an neun Stellen in allen drei Komponentenbaeumen.

// So liefert das Backend die Zahlen (Konfi-Fahrt, Event 105):
const event = { registered_count: 19, teamer_count: 4, waitlist_count: 0 };

// FALSCH (Altlast vor Migration 120)
const alteRechnung = (e: typeof event) => e.registered_count - (e.teamer_count || 0);
// RICHTIG: registered_count IST die Konfi-Zahl
const konfiZahl = (e: typeof event) => e.registered_count || 0;

describe('Terminliste: Konfi-Zahl', () => {
  it('nimmt registered_count unveraendert', () => {
    expect(konfiZahl(event)).toBe(19);
  });

  it('zieht die Teamer NICHT ein zweites Mal ab', () => {
    expect(alteRechnung(event)).toBe(15); // der gemeldete Fehler
    expect(konfiZahl(event)).not.toBe(alteRechnung(event));
  });

  it('bleibt korrekt, wenn gar keine Teamer gebucht sind', () => {
    expect(konfiZahl({ registered_count: 19, teamer_count: 0, waitlist_count: 0 })).toBe(19);
  });

  it('bleibt korrekt, wenn teamer_count fehlt (Alt-Antworten)', () => {
    expect(konfiZahl({ registered_count: 7 } as any)).toBe(7);
  });

  it('faengt fehlendes registered_count ab', () => {
    expect(konfiZahl({} as any)).toBe(0);
  });
});
