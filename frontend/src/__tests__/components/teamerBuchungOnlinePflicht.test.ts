import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund H2 (Offline-Bericht 27.08.2026): Die Teamer-Buchung legte sich
// offline in die Warteschlange und verwarf die Server-Antwort. Genau darin
// steckt aber, ob der Platz sicher ist oder nur die Warteliste — der
// Online-Zweig liest `res.data.status === 'waitlist'` aus und sagt es.
// Nachgereicht erfuhr das niemand: Die App bestaetigte "wird gesendet", und
// wer auf der Warteliste landete, merkte es nicht.
//
// Die Konfi-Anmeldung loest das seit jeher ueber einen offline
// deaktivierten Knopf. Die Teamer-Seite macht es jetzt genauso.
//
// Geprueft wird die Quelle, nicht das gerenderte Bauteil: Die Seite haengt
// an IonPage/Router/AppContext, ein Render-Test waere hier teurer als
// aussagekraeftig.

const quelle = readFileSync(
  resolve(__dirname, '../../components/teamer/pages/TeamerEventsPage.tsx'),
  'utf-8'
);

describe('H2: Die Teamer-Buchung braucht eine Verbindung', () => {
  it('legt die Buchung NICHT mehr in die Warteschlange', () => {
    // Der alte Weg: enqueue auf /events/:id/book mit "wird gesendet".
    expect(quelle).not.toContain('Buchung wird gesendet sobald du wieder online bist');
    // Gezielt auf das POST-enqueue der Buchung. Zwei Nachbarn duerfen
    // ausdruecklich weiter offline laufen, weil bei ihnen nichts zu
    // verpassen ist:
    //   - die Zusage/Absage (/teamer/events/:id/zusage)
    //   - die Abmeldung (DELETE auf derselben Buchungs-URL)
    // Beide werten keine Server-Antwort aus; nur die Buchung tut das
    // (waitlist ja/nein).
    const buchungsEnqueue =
      /enqueue\(\{\s*method: 'POST',\s*url: `\/events\/\$\{event\.id\}\/book`/.test(quelle);
    expect(buchungsEnqueue).toBe(false);

    // Gegenprobe, damit der Test nicht auch dann gruen waere, wenn jemand
    // versehentlich ALLE Offline-Wege der Seite entfernt:
    expect(quelle).toContain('url: `/teamer/events/' + '${event.id}' + '/zusage`');
    const abmeldeEnqueue =
      /enqueue\(\{\s*method: 'DELETE',\s*url: `\/events\/\$\{event\.id\}\/book`/.test(quelle);
    expect(abmeldeEnqueue).toBe(true);
  });

  it('sagt offline, warum es nicht geht', () => {
    expect(quelle).toContain('Für die Buchung brauchst du eine Verbindung');
  });

  it('deaktiviert beide Buchungsknoepfe offline', () => {
    // "Ich bin dabei" und "Auf die Warteliste" haengen beide an handleBook.
    const knoepfe = [...quelle.matchAll(/onClick=\{\(\) => handleBook\(selectedEvent\)\}\s*\n\s*disabled=\{([^}]*)\}/g)];
    expect(knoepfe.length).toBe(2);
    for (const [, bedingung] of knoepfe) {
      expect(bedingung).toContain('!isOnline');
    }
  });

  it('die Warteliste-Rueckmeldung im Online-Zweig bleibt erhalten', () => {
    // Der Grund fuer den ganzen Befund: Diese Zeile darf nicht verschwinden.
    expect(quelle).toContain("res.data?.status === 'waitlist'");
    expect(quelle).toContain('Du stehst auf der Warteliste');
  });
});
