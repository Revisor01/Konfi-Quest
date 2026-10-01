// Wiederkehrende Warnungen je Zeitfenster zaehlen statt jede Zeile schreiben
// (Entscheidung Simon, 01.10.2026: "Logs auf das noetige, sinnvolle Minimum").
//
// GEMESSEN (Produktion, Abend 30.09.2026): "Socket.io Engine connection_error:
// 3 Bad request" 37-mal in rund neun Stunden je Backend (21 % der Zeilen). Die
// Zeile ist Routine -- eine Abfrage, die nach einem Verbindungswechsel noch
// an der alten Sitzung haengt --, waechst aber mit jeder Person, die die App
// offen hat. Bei EKD-Groesse (Faktor ~110) waeren es rund 450 Zeilen je Stunde.
// Jetzt: hoechstens eine Zeile je Viertelstunde und Quelle, mit Anzahl je Grund.
// Faellt etwas wirklich aus, steht die Zahl darin; ein einzelner Fall geht
// nicht verloren.
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { Sammelzeile, FENSTER_MS } = require('../../utils/sammelzeile');

describe('Sammelzeile', () => {
  let zeilen;
  let s;

  beforeEach(() => {
    vi.useFakeTimers();
    zeilen = [];
    s = new Sammelzeile('Socket.io Engine connection_error', { ausgabe: (z) => zeilen.push(z) });
  });
  afterEach(() => {
    s.stopp();
    vi.useRealTimers();
  });

  it('das Fenster ist eine Viertelstunde', () => {
    expect(FENSTER_MS).toBe(15 * 60 * 1000);
  });

  it('37 gleiche Faelle: keine Zeile sofort, genau eine nach dem Fenster, mit der Zahl', () => {
    for (let i = 0; i < 37; i += 1) s.zaehle('3 Bad request');
    expect(zeilen).toEqual([]);
    vi.advanceTimersByTime(FENSTER_MS);
    expect(zeilen).toEqual(['Socket.io Engine connection_error (15 Min): 3 Bad request ×37']);
  });

  it('mehrere Gruende stehen in einer Zeile, der haeufigste zuerst', () => {
    s.zaehle('1 Session ID unknown');
    for (let i = 0; i < 4; i += 1) s.zaehle('3 Bad request');
    vi.advanceTimersByTime(FENSTER_MS);
    expect(zeilen).toEqual([
      'Socket.io Engine connection_error (15 Min): 3 Bad request ×4, 1 Session ID unknown ×1',
    ]);
  });

  it('ein ruhiges Fenster schreibt nichts, das naechste zaehlt neu', () => {
    s.zaehle('3 Bad request');
    vi.advanceTimersByTime(FENSTER_MS);
    vi.advanceTimersByTime(FENSTER_MS);
    s.zaehle('3 Bad request');
    s.zaehle('3 Bad request');
    vi.advanceTimersByTime(FENSTER_MS);
    expect(zeilen).toEqual([
      'Socket.io Engine connection_error (15 Min): 3 Bad request ×1',
      'Socket.io Engine connection_error (15 Min): 3 Bad request ×2',
    ]);
  });

  it('beim Herunterfahren geht der angefangene Stand nicht verloren', () => {
    s.zaehle('3 Bad request');
    s.stopp();
    expect(zeilen).toEqual(['Socket.io Engine connection_error (15 Min): 3 Bad request ×1']);
    s.stopp();
    expect(zeilen).toHaveLength(1);
  });

  it('ohne Fall kein Takt: der Prozess haelt nichts offen', () => {
    const takte = vi.getTimerCount();
    new Sammelzeile('leer', { ausgabe: (z) => zeilen.push(z) });
    expect(vi.getTimerCount()).toBe(takte);
  });
});

describe('Socket-Anmeldung: abgelehnte Tokens gebuendelt', () => {
  let warn;

  beforeEach(() => {
    vi.useFakeTimers();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    require('../../utils/socketAnmeldung').abgelehnteAnmeldungen.stopp();
    warn.mockRestore();
    vi.useRealTimers();
  });

  it('fuenf abgelaufene Tokens: keine Einzelzeile, eine Sammelzeile mit ×5', async () => {
    const { socketAnmeldung } = require('../../utils/socketAnmeldung');
    const pruefe = socketAnmeldung({ query: vi.fn() }, 'geheim');
    const abgelaufen = jwt.sign({ id: 1, exp: Math.floor(Date.now() / 1000) - 60 }, 'geheim');
    const fehler = [];
    for (let i = 0; i < 5; i += 1) {
      await pruefe({ handshake: { auth: { token: abgelaufen } } }, (err) => fehler.push(err && err.message));
    }
    expect(fehler).toEqual(Array(5).fill('Invalid token'));
    expect(warn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(FENSTER_MS);
    expect(warn.mock.calls.map((c) => c.join(' '))).toEqual([
      'Socket.io Auth fehlgeschlagen (15 Min): jwt expired ×5',
    ]);
  });
});

describe('server.js haengt die Engine-Fehler an die Sammelzeile', () => {
  const quelle = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');

  it('keine Einzelzeile je connection_error mehr', () => {
    expect(quelle).not.toMatch(/console\.warn\('Socket\.io Engine connection_error:'/);
    expect(quelle).toMatch(/io\.engine\.on\('connection_error',[\s\S]{0,200}engineFehler\.zaehle\(/);
  });

  it('der Shutdown schreibt die angefangenen Sammelzeilen noch aus', () => {
    expect(quelle).toMatch(/sammelzeilenAusgeben\(\)/);
  });
});
