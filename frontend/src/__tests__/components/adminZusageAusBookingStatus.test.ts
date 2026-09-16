// DIE EIGENE ZUSAGE DER LEITUNG LIEST DENSELBEN WERT WIE DAS TEAM
// (17.09.2026, Simons Befund)
//
// WOERTLICH: "Die Logik ist bei Teamer und Admin nicht gleich unter bist du
// dabei. Nachdem man sich als Teamer einmal entschieden hat kommt ein groesser
// Button entweder in rot doch nicht dabei oder in gruen doch dabei oder so
// aehnlich. So will ich es auch beim Admin."
//
// GEGEN PRODUKTION GEMESSEN, nicht vermutet: Nach einer Zusage der Leitung
// ueber POST /teamer/events/:id/zusage liefert GET /events/:id
//
//   booking_status: 'confirmed'   <- richtig
//   participants:   []            <- LEER
//
// Die Leitung taucht in participants also gar nicht auf, auch nicht nach einer
// Absage (dort ebenfalls leer, booking_status: 'opted_out'). Die Seite las
// aber genau daraus:
//
//   const eigeneTeilnahme = participants.find(p => p.user_id === user?.id);
//   welcheKnoepfe(eigeneTeilnahme?.status)   // -> undefined -> 'beide'
//
// Ergebnis: Die Leitung sah IMMER beide Knoepfe, egal was sie gewaehlt hatte.
// Die Teamer-Seite liest event.booking_status und macht es deshalb richtig.
//
// Der gemeinsame Helfer utils/zusageKnoepfe.ts war also nie das Problem --
// er bekam nur auf der einen Seite den falschen Wert. Geprueft wird hier
// beides: dass der Helfer stimmt UND dass die Seite die richtige Quelle liest.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { welcheKnoepfe, zusageBeschriftung, absageBeschriftung } from '../../utils/zusageKnoepfe';

const quelle = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const ADMIN_SEITE = 'src/components/admin/views/EventDetailView.tsx';

describe('Der Helfer entscheidet fuer beide Rollen gleich', () => {
  it('nach einer Zusage steht NUR der rote Weg zurueck', () => {
    expect(welcheKnoepfe('confirmed')).toBe('absage');
    expect(absageBeschriftung('confirmed')).toBe('Nicht mehr dabei');
  });

  it('nach einer Absage steht NUR der gruene Weg zurueck', () => {
    expect(welcheKnoepfe('opted_out')).toBe('zusage');
    expect(zusageBeschriftung('opted_out')).toBe('Doch dabei');
  });

  it('auch von der Warteliste aus gilt die Zusage als getroffen', () => {
    expect(welcheKnoepfe('waitlist')).toBe('absage');
  });

  it('solange nichts entschieden ist, stehen beide da', () => {
    expect(welcheKnoepfe(null)).toBe('beide');
    expect(welcheKnoepfe(undefined)).toBe('beide');
  });
});

describe('Die Leitungsseite liest den Buchungsstatus des Termins', () => {
  it('nicht mehr aus der Teilnehmerliste', () => {
    // DER FEHLER: participants enthaelt die Leitung nicht -- gemessen an der
    // echten API, in BEIDEN Zustaenden (nach Zusage und nach Absage).
    //
    // Geprueft wird die ZUWEISUNG, nicht das blosse Vorkommen der Zeile: Der
    // Kommentar an der Fundstelle zitiert den alten Ausdruck absichtlich,
    // damit niemand versehentlich dorthin zurueckbaut. Ein toContain ueber
    // die ganze Datei wuerde daran haengenbleiben.
    const code = quelle(ADMIN_SEITE);
    expect(code).not.toMatch(/const\s+eigeneTeilnahme\s*=/);
    expect(code).not.toMatch(/=\s*participants\.find\(/);
  });

  it('sondern aus eventData.booking_status, wie die Teamer-Seite', () => {
    const code = quelle(ADMIN_SEITE);
    expect(code).toContain('eventData?.booking_status');
  });

  it('und uebergibt genau diesen Wert an den Helfer', () => {
    // Nicht nur irgendwo im File -- der Helfer muss den neuen Wert bekommen.
    const code = quelle(ADMIN_SEITE);
    expect(code).toContain('welcheKnoepfe(eigeneZusage)');
    expect(code).toContain('zusageBeschriftung(eigeneZusage)');
    expect(code).toContain('absageBeschriftung(eigeneZusage)');
  });

  it('auch die Grundpflicht haengt an diesem Wert', () => {
    // absageBrauchtGrund entscheidet, ob das Modal einen Grund verlangt.
    // Mit dem alten undefined haette es NIE einen verlangt -- auch nicht,
    // wenn die Absage eine Zusage zuruecknimmt.
    const code = quelle(ADMIN_SEITE);
    expect(code).toContain('absageBrauchtGrund(eigeneZusage)');
  });
});

describe('GEGENPROBE: der alte Weg lieferte immer beide Knoepfe', () => {
  it('ein nicht gefundener Eintrag sieht aus wie "noch nichts entschieden"', () => {
    // Genau das passierte: find() gab undefined, und undefined heisst
    // "beide" -- ununterscheidbar von "hat sich noch nicht geaeussert".
    const nichtGefunden = undefined;
    expect(welcheKnoepfe(nichtGefunden)).toBe('beide');

    // Waehrend der Termin sehr wohl wusste, was Sache ist:
    expect(welcheKnoepfe('confirmed')).toBe('absage');
    expect(welcheKnoepfe('opted_out')).toBe('zusage');
  });
});
