import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Teamer-Absage mit Grund (Anforderung 01.09.2026): Zu- und Absagen lassen
// sich jederzeit aendern, ein Grund ist freiwillig — AUSSER die Absage nimmt
// eine Zusage zurueck, dann ist er Pflicht. Durchgesetzt wird die Regel im
// Backend (400, error_code 'grund_erforderlich'); die Oberflaeche fragt den
// Grund im Absage-Dialog ab und erspart so den Fehlversuch.
//
// Geprueft wird die Quelle, nicht das gerenderte Bauteil — dasselbe Muster
// und dieselbe Begruendung wie in teamerBuchungOnlinePflicht.test.ts: Die
// Seite haengt an IonPage/Router/AppContext, ein Render-Test waere teurer
// als aussagekraeftig.

const seite = readFileSync(
  resolve(__dirname, '../../components/teamer/pages/TeamerEventsPage.tsx'),
  'utf-8'
);
const modal = readFileSync(
  resolve(__dirname, '../../components/teamer/modals/TeamerAbsageModal.tsx'),
  'utf-8'
);

describe('Teamer-Absage: Grund-Abfrage in der Oberflaeche', () => {
  it('eine Absage nach Zusage gilt ab confirmed UND waitlist (und Alt-Status pending)', () => {
    // Die Aussage "Ich bin dabei" zaehlt, nicht der zugeteilte Platz —
    // dieselbe Regel wie im Backend (setzeTeamerZusage).
    expect(seite).toContain("event.booking_status === 'confirmed'");
    const brauchtGrund = /absageBrauchtGrund[\s\S]{0,300}'waitlist'[\s\S]{0,120}'pending'/.test(seite);
    expect(brauchtGrund).toBe(true);
  });

  it('beide Absage-Knoepfe oeffnen den Dialog statt direkt zu senden', () => {
    // "Nicht mehr dabei" (nach Zusage) und "Ich bin nicht dabei" (aus offen)
    // laufen beide ueber oeffneAbsage -> TeamerAbsageModal.
    const oeffner = [...seite.matchAll(/onClick=\{oeffneAbsage\}/g)];
    expect(oeffner.length).toBe(2);
    // Kein Knopf sendet die Absage mehr ohne Dialog ab.
    expect(seite).not.toContain('handleZusage(selectedEvent, false)');
  });

  it('der Dialog sperrt das Absenden ohne Grund nur bei Grund-Pflicht', () => {
    expect(modal).toContain('const isValid = !grundPflicht || reason.trim().length > 0;');
    // Der Pflicht-Fall benennt, WARUM der Grund gebraucht wird.
    expect(modal).toContain('Du hattest zugesagt.');
    // Der freiwillige Fall sagt ausdruecklich, dass keiner noetig ist.
    expect(modal).toContain('du musst aber keinen angeben');
  });

  it('die Absage laeuft ueber die Zusage-Route und nimmt den Grund mit', () => {
    // handleZusage schickt den Grund als reason an /teamer/events/:id/zusage.
    const mitGrund = /handleZusage = async \(event: Event, dabei: boolean, reason\?: string\)/.test(seite);
    expect(mitGrund).toBe(true);
    expect(seite).toContain("{ dabei, reason: reason.trim() }");
  });
});
