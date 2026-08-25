// backend/tests/utils/nachAntwort.test.js
// Tests fuer den Helfer, der Seiteneffekte NACH der Antwort ausfuehrt.
//
// Hintergrund: Mehrere Termin-Routen senden bewusst erst `res.json()` und
// erledigen danach Push, Badges und Live-Updates. Im Testlauf riss das
// sporadisch den naechsten Test mit, weil supertest die Verbindung schliesst,
// waehrend der Handler noch schreibt ("Parse Error: Expected HTTP/, RTSP/ or
// ICE/", 1 von rund 1200, wechselnd welcher — belegt am 25.08.2026).
const { nachAntwort, warteAufNachwehen } = require('../../utils/nachAntwort');

/** Minimaler Ersatz fuer req: nur app.locals wird gebraucht. */
const machReq = (app) => ({ app });

describe('nachAntwort', () => {
  it('fuehrt die Arbeit aus', async () => {
    const app = { locals: {} };
    let gelaufen = false;
    await nachAntwort(machReq(app), () => { gelaufen = true; });
    expect(gelaufen).toBe(true);
  });

  it('wirft nicht, wenn die Arbeit scheitert', async () => {
    const app = { locals: {} };
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Der entscheidende Fall: Ein fehlgeschlagener Push darf die schon
    // gesendete Antwort nicht nachtraeglich zu einem Absturz machen.
    await expect(
      nachAntwort(machReq(app), async () => { throw new Error('Push kaputt'); })
    ).resolves.toBeUndefined();
    expect(fehler).toHaveBeenCalled();
    fehler.mockRestore();
  });

  it('meldet die Bezeichnung im Fehlertext', async () => {
    const app = { locals: {} };
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
    await nachAntwort(machReq(app), () => { throw new Error('x'); }, 'DELETE /events/:id');
    expect(fehler.mock.calls[0][0]).toBe('DELETE /events/:id fehlgeschlagen:');
    fehler.mockRestore();
  });

  describe('Abwartbarkeit im Test', () => {
    it('warteAufNachwehen wartet, bis die Arbeit wirklich durch ist', async () => {
      const app = { locals: {} };
      let fertig = false;
      // NICHT awaiten — genau so ruft eine Route den Helfer auf.
      nachAntwort(machReq(app), async () => {
        await new Promise((r) => setTimeout(r, 30));
        fertig = true;
      });
      expect(fertig).toBe(false);

      await warteAufNachwehen(app);
      expect(fertig).toBe(true);
    });

    it('wartet auch auf Arbeit, die waehrenddessen neue Arbeit anstoesst', async () => {
      const app = { locals: {} };
      let zweiteFertig = false;
      nachAntwort(machReq(app), async () => {
        await new Promise((r) => setTimeout(r, 10));
        nachAntwort(machReq(app), async () => {
          await new Promise((r) => setTimeout(r, 10));
          zweiteFertig = true;
        });
      });

      await warteAufNachwehen(app);
      expect(zweiteFertig).toBe(true);
    });

    it('raeumt erledigte Laeufe wieder ab', async () => {
      const app = { locals: {} };
      await nachAntwort(machReq(app), () => {});
      await warteAufNachwehen(app);
      expect(app.locals.offeneNachwehen.size).toBe(0);
    });

    it('kommt ohne angefangene Arbeit klar', async () => {
      await expect(warteAufNachwehen({ locals: {} })).resolves.toBeUndefined();
      await expect(warteAufNachwehen(undefined)).resolves.toBeUndefined();
    });
  });
});
