// backend/tests/services/losungService.test.js
// Tests für den Negativ-Cache im Losung-Dienst (Audit 22.08.).
//
// Hintergrund: Faellt die Losungen-API aus, lief JEDE Anfrage erneut in beide
// Timeouts (2s interner Endpunkt + 5s oeffentlicher = bis zu 7s). Das Dashboard
// laedt die Losung beim Oeffnen, also traf das jede Nutzerin bei jedem Start.
// Der Negativ-Cache merkt sich den Fehlschlag und ueberspringt den externen Weg
// für eine Sperrfrist, sodass die aufrufende Route sofort ihren DB-Fallback
// zieht statt zu warten.
//
// Der Dienst wird bewusst OHNE echte DB getestet: die Sperrlogik ist reine
// In-Memory-Logik. Als "nicht erreichbare API" dient ein nicht aufloesbarer
// Host; gemessen wird die Antwortzeit, denn genau die Wartezeit war das Problem.

// heuteBerlin() statt toISOString(): Letzteres liefert IMMER den UTC-Tag.
// Zwischen Mitternacht und 02:00 Berliner Zeit ist das noch der Vortag --
// der Test schlug dann fehl, obwohl der Code (der heuteBerlin nutzt) richtig
// lag. Am 02.09.2026 um 00:27 genau so passiert: Der Test trug die Falle,
// gegen die er selbst schuetzen soll.
const { heuteBerlin } = require('../../utils/zeitformat');
const HEUTE = heuteBerlin();

// Fake-DB: Cache-Lookup liefert nichts (kalter Cache), Schreibvorgaenge no-op.
function createFakeDb() {
  const queries = [];
  return {
    queries,
    query(sql, params) {
      queries.push({ sql, params });
      // SELECT auf daily_verses -> leer, damit der externe Weg versucht wird.
      return Promise.resolve({ rows: [] });
    }
  };
}

describe('losungService: Negativ-Cache', () => {
  let losungService;

  beforeEach(() => {
    vi.resetModules();

    process.env.LOSUNG_API_KEY = 'test-key';
    // Nicht aufloesbarer Host: der Abruf scheitert zuverlaessig und ohne Netz.
    // Nur EIN Endpunkt, damit die Messung eindeutig ist.
    process.env.LOSUNG_API_BASE_URL = 'https://losung.invalid';

    losungService = require('../../services/losungService');
    losungService._resetNegativCache();
  });

  afterEach(() => {
    delete process.env.LOSUNG_API_BASE_URL;
  });

  it('meldet den Fehlschlag beim ersten Abruf nach aussen', async () => {
    const db = createFakeDb();

    await expect(losungService.fetchTageslosung(db, 'LUT'))
      .rejects.toThrow(/nicht erreichbar/);
  });

  it('antwortet nach einem Fehlschlag SOFORT statt erneut zu warten (Kernregression)', async () => {
    const db = createFakeDb();

    await expect(losungService.fetchTageslosung(db, 'LUT')).rejects.toThrow();

    // Genau darum geht es: der zweite Abruf darf nicht wieder in die Timeouts
    // laufen, sondern muss unmittelbar zurueckkommen.
    const start = Date.now();
    await expect(losungService.fetchTageslosung(db, 'LUT')).rejects.toThrow();
    const dauer = Date.now() - start;

    expect(dauer).toBeLessThan(100);
  });

  it('meldet bei aktiver Sperre einen Fehler, damit die Route ihren Fallback zieht', async () => {
    const db = createFakeDb();

    await expect(losungService.fetchTageslosung(db, 'LUT')).rejects.toThrow();

    await expect(losungService.fetchTageslosung(db, 'LUT'))
      .rejects.toThrow(/Sperrfrist/);
  });

  it('sperrt je Uebersetzung getrennt', async () => {
    const db = createFakeDb();

    await expect(losungService.fetchTageslosung(db, 'LUT')).rejects.toThrow();

    // Andere Uebersetzung -> eigener Schlüssel, also KEINE Sperre. Der Fehler
    // muss deshalb der Abruf-Fehler sein, nicht die Sperrmeldung.
    await expect(losungService.fetchTageslosung(db, 'BIGS'))
      .rejects.toThrow(/nicht erreichbar/);
  });

  it('liefert einen vorhandenen DB-Cache aus, ohne den externen Weg zu gehen', async () => {
    const db = {
      query() {
        return Promise.resolve({
          rows: [{ verse_data: { losung: { text: 'gecacht' } } }]
        });
      }
    };

    const ergebnis = await losungService.fetchTageslosung(db, 'LUT');

    expect(ergebnis.cached).toBe(true);
  });

  it('greift auch dann, wenn die Sperre vor dem Cache-Treffer gesetzt wurde', async () => {
    // Erst scheitern lassen (Sperre setzen), dann DB-Cache befuellen:
    // der Cache-Treffer muss VOR der Sperrpruefung greifen, sonst bliebe eine
    // inzwischen verfuegbare Losung während der Sperrfrist unerreichbar.
    const kalteDb = createFakeDb();
    await expect(losungService.fetchTageslosung(kalteDb, 'LUT')).rejects.toThrow();

    const warmeDb = {
      query() {
        return Promise.resolve({
          rows: [{ verse_data: { losung: { text: 'inzwischen da' } } }]
        });
      }
    };

    const ergebnis = await losungService.fetchTageslosung(warmeDb, 'LUT');
    expect(ergebnis.cached).toBe(true);
  });

  it('verwendet das heutige Datum als Teil des Sperrschluessels', async () => {
    const db = createFakeDb();

    await expect(losungService.fetchTageslosung(db, 'LUT')).rejects.toThrow();

    // Der Cache-Lookup muss mit dem heutigen Datum erfolgt sein.
    const lookup = db.queries.find(q => q.sql.includes('daily_verses'));
    expect(lookup.params[0]).toBe(HEUTE);
  });
});
