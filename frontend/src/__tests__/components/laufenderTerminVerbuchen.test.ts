import { describe, it, expect } from 'vitest';
import {
  aktuelleTermine,
  zuVerbuchendeTermine,
  vergangeneTermine,
} from '../../components/shared/eventFormatting';

/**
 * EIN LAUFENDER TERMIN GEHOERT IN "VERBUCHEN" (26.09.2026, Simons Befund)
 *
 * WOERTLICH: "Ich habe in Hennstedt gerade Konfisamstag. Er zeigt mir auf
 * 'Mitmachen' jetzt gerade ein Badge, ein rotes Icon. Ich gehe auf
 * 'Mitmachen', aber unter 'Verbuchen' steht nirgendwo [etwas]. Warum ist da
 * gerade ein rotes Icon? Weil das Event gerade laeuft und ich jemanden
 * verbuchen musste, muesste es aber ja wechseln auf 'Verbuchen'."
 * Zum Weg: "also soll er es in verbuchen legen, das hilft mir."
 *
 * GEGEN PRODUKTION GEMESSEN: Termin 297 "Konfisamstag: Gebet", Org 2
 * (Hennstedt), 26.09.2026 von 10:00 bis 14:00. Um 10:59 stand am Reiter eine
 * rote Zahl, die Liste "Verbuchen" war leer.
 *
 * URSACHE -- zwei Regeln fuer dieselbe Frage:
 *   Zaehler (backend/routes/notifications.js, utils/appIconBadge.js):
 *     e.event_date < NOW()   -> der BEGINN
 *   Liste (zuVerbuchendeTermine):
 *     eventEnde(e) < jetzt   -> das ENDE
 *
 * Jetzt richten sich beide nach dem Beginn. Ein laufender Termin steht
 * dadurch in "Aktuell" UND in "Verbuchen" -- das ist gewollt: Er laeuft noch,
 * und es gibt schon etwas zu verbuchen.
 */

type Termin = {
  id: number;
  event_date: string;
  event_end_time?: string | null;
  pending_bookings_count?: number;
  registration_status?: string | null;
};

const stunden = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

/** Simons Lage: vor einer Stunde begonnen, laeuft noch drei, eine offene Buchung. */
const laufend: Termin = {
  id: 297,
  event_date: stunden(-1),
  event_end_time: stunden(3),
  pending_bookings_count: 1,
};

const beendet: Termin = {
  id: 2,
  event_date: stunden(-26),
  event_end_time: stunden(-24),
  pending_bookings_count: 1,
};

const kuenftig: Termin = {
  id: 3,
  event_date: stunden(24),
  event_end_time: stunden(26),
  pending_bookings_count: 1,
};

describe('Ein laufender Termin steht in "Verbuchen"', () => {
  it('der laufende Termin mit offener Buchung ist dabei', () => {
    const liste = zuVerbuchendeTermine([laufend]);
    expect(liste.map((e) => e.id)).toEqual([297]);
  });

  it('er steht zugleich weiter in "Aktuell" -- er laeuft ja noch', () => {
    const liste = aktuelleTermine([laufend], []);
    expect(liste.map((e) => e.id)).toEqual([297]);
  });

  it('ein Termin, der noch nicht begonnen hat, ist NICHT dabei', () => {
    // Die Gegenrichtung: Sonst stuenden kuenftige Termine zum Verbuchen an,
    // an denen noch niemand teilgenommen haben kann.
    expect(zuVerbuchendeTermine([kuenftig])).toEqual([]);
  });

  it('der beendete Termin mit offener Buchung bleibt dabei', () => {
    expect(zuVerbuchendeTermine([beendet]).map((e) => e.id)).toEqual([2]);
  });

  it('ohne offene Buchungen steht der laufende Termin nicht dort', () => {
    const ohne = { ...laufend, pending_bookings_count: 0 };
    expect(zuVerbuchendeTermine([ohne])).toEqual([]);
  });

  it('ein abgesagter laufender Termin steht nicht dort', () => {
    // An einem abgesagten Termin gibt es nichts zu verbuchen -- diese Regel
    // gilt unveraendert, auch waehrend er laeuft.
    const abgesagt = { ...laufend, registration_status: 'cancelled' };
    expect(zuVerbuchendeTermine([abgesagt])).toEqual([]);
  });

  it('Altbestand ohne Endzeit: der Beginn entscheidet', () => {
    // event_end_time ist nullable. Frueher fiel eventEnde auf event_date
    // zurueck; jetzt wird event_date ohnehin direkt gelesen -- fuer diese
    // Termine aendert sich also nichts.
    const alt: Termin = { id: 4, event_date: stunden(-2), event_end_time: null, pending_bookings_count: 1 };
    expect(zuVerbuchendeTermine([alt]).map((e) => e.id)).toEqual([4]);
  });

  it('"Vergangen" bleibt unberuehrt: es richtet sich weiter nach dem Ende', () => {
    // Der laufende Termin darf dort NICHT auftauchen, auch wenn er keine
    // offenen Buchungen mehr hat -- er ist schlicht noch nicht vorbei.
    const laufendVerbucht = { ...laufend, pending_bookings_count: 0 };
    expect(vergangeneTermine([laufendVerbucht], [])).toEqual([]);

    const beendetVerbucht = { ...beendet, pending_bookings_count: 0 };
    expect(vergangeneTermine([beendetVerbucht], []).map((e) => e.id)).toEqual([2]);
  });
});
