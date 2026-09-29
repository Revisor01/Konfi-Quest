// backend/tests/services/losungOhneNodeFetch.test.js
// Die Tageslosung darf nicht an `node-fetch` haengen (Release-Audit 26.09.2026,
// Toolchain BF-05).
//
// Hintergrund: Der Dienst holte sich `fetch` per `import('node-fetch')`. Das
// Paket stand nie in backend/package.json -- es lag nur im Baum, weil
// firebase-admin einen OPTIONALEN Storage-Client mitbringt, der es seinerseits
// braucht. `npm ci --omit=optional`, ein fehlgeschlagener optionaler Build oder
// ein firebase-admin-Update, das die Kette kappt, und der Import wirft
// "Cannot find package" -- die Losung faellt aus, ohne dass am Code etwas
// geaendert wurde. Node >= 18 bringt `fetch` selbst mit.
//
// Der Test macht `node-fetch` fuer den Prozess unauffindbar (Resolve-Hook) und
// ersetzt das eingebaute `fetch` durch eine Attrappe -- es geht kein Byte ins
// Netz. Eine echte Datenbank braucht es nicht, die Abruflogik kommt mit einer
// Attrappe aus.
const { registerHooks } = require('node:module');

const DIENST = require.resolve('../../services/losungService');

const LOSUNG = {
  date: 'Dienstag, 29. September 2026',
  losung: { text: 'Losungstext', reference: 'Psalm 1,1', testament: 'AT' },
  lehrtext: { text: 'Lehrtext', reference: 'Johannes 1,1', testament: 'NT' },
};

function antwortMitLosung() {
  return new Response(JSON.stringify({ success: true, data: LOSUNG }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Kalter Cache: jeder SELECT liefert nichts, Schreibvorgaenge werden gemerkt.
function createFakeDb() {
  const queries = [];
  return {
    queries,
    query(sql, params) {
      queries.push({ sql, params });
      return Promise.resolve({ rows: [] });
    },
  };
}

describe('losungService: Abruf ohne node-fetch', () => {
  let hooks;
  let losungService;

  beforeEach(() => {
    process.env.LOSUNG_API_KEY = 'test-key';
    // Ohne Ueberschreibung: beide Endpunkte wie in Produktion (erst intern,
    // dann die oeffentliche Domain). Das Netz ist ohnehin durch die
    // fetch-Attrappe ersetzt.
    delete process.env.LOSUNG_API_BASE_URL;

    // node-fetch ist ab hier "nicht installiert" -- fuer require UND import().
    hooks = registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier === 'node-fetch' || specifier.startsWith('node-fetch/')) {
          const err = new Error(`Cannot find package 'node-fetch'`);
          err.code = 'ERR_MODULE_NOT_FOUND';
          throw err;
        }
        return nextResolve(specifier, context);
      },
    });

    // Frisch laden: die Endpunkte werden beim Laden aus der Umgebung gelesen.
    delete require.cache[DIENST];
    losungService = require(DIENST);
    losungService._resetNegativCache();
  });

  afterEach(() => {
    hooks.deregister();
    vi.unstubAllGlobals();
    delete require.cache[DIENST];
  });

  it('liefert die Tageslosung ueber das eingebaute fetch', async () => {
    const fetchAttrappe = vi.fn(async () => antwortMitLosung());
    vi.stubGlobal('fetch', fetchAttrappe);
    const db = createFakeDb();

    const ergebnis = await losungService.fetchTageslosung(db, 'LUT');

    expect(ergebnis).toEqual({ data: LOSUNG, translation: 'LUT', cached: false });

    // Genau ein Abruf, auf dem internen Weg, mit Zeitlimit als AbortSignal.
    expect(fetchAttrappe).toHaveBeenCalledTimes(1);
    const [url, optionen] = fetchAttrappe.mock.calls[0];
    expect(url).toBe('http://ketiv-api/api/?api_key=test-key&translation=LUT');
    expect(optionen.headers.Accept).toBe('application/json');
    expect(optionen.signal).toBeInstanceOf(AbortSignal);

    // Die Losung landet im Tages-Cache.
    const schreiben = db.queries.find(q => q.sql.startsWith('INSERT INTO daily_verses'));
    expect(schreiben.params[1]).toBe('LUT');
    expect(schreiben.params[2]).toEqual(LOSUNG);
  });

  it('bricht einen haengenden internen Abruf nach dem Zeitlimit ab und weicht auf die oeffentliche Domain aus', async () => {
    // Das eingebaute fetch kennt die Option `timeout` von node-fetch nicht --
    // sie wuerde still ignoriert, und ein haengender interner Container hielte
    // jede Anfrage unbegrenzt fest. Die Attrappe haengt deshalb so lange, bis
    // das mitgegebene Signal abbricht; ohne Signal endet der Test am
    // Test-Timeout.
    const fetchAttrappe = vi.fn((url, optionen) => {
      if (url.startsWith('http://ketiv-api/')) {
        return new Promise((_, reject) => {
          optionen.signal?.addEventListener('abort', () => reject(optionen.signal.reason));
        });
      }
      return Promise.resolve(antwortMitLosung());
    });
    vi.stubGlobal('fetch', fetchAttrappe);

    const start = Date.now();
    const ergebnis = await losungService.fetchTageslosung(createFakeDb(), 'BIGS');
    const dauer = Date.now() - start;

    expect(ergebnis).toEqual({ data: LOSUNG, translation: 'BIGS', cached: false });
    expect(fetchAttrappe).toHaveBeenCalledTimes(2);
    expect(fetchAttrappe.mock.calls[1][0]).toBe('https://ketiv.de/api/?api_key=test-key&translation=BIGS');
    // Zeitlimit intern: 2 s (TIMEOUT_INTERN_MS).
    expect(dauer).toBeGreaterThanOrEqual(1900);
    expect(dauer).toBeLessThan(3500);
  });
});
