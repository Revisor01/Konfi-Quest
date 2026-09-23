// backend/tests/utils/apmPfadNormalisierung.test.js
//
// Tests fuer normalizePath aus utils/apm.js — die Funktion, die aus einem
// Anfragepfad den Metrik-Schluessel macht.
//
// Warum das zaehlt: Die Map `stats` in apm.js wird NIE getrimmt (anders als
// buckets, recentErrors und nutzerProMinute, die alle eine Grenze haben). Jeder
// Schluessel bleibt bis zum Neustart des Containers liegen. Solange nur Zahlen
// und UUIDs im Pfad stehen, ist die Zahl der Schluessel durch die Zahl der
// Routen begrenzt — bei freiem Text im Pfad aber nicht.
//
// Drei Pfadarten tragen keine ID, sondern Inhalt:
//   /api/auth/check-username/<beliebiger Name>   (Namenspruefung beim
//       Registrieren, laeuft mit 300 ms Verzoegerung bei jedem Tastendruck —
//       eine Anmeldung erzeugt also mehrere Varianten desselben Namens)
//   /api/auth/validate-invite/<Einladungscode>   (8 Hexzeichen, gross)
//   /api/chat/files/<64 Hexzeichen>              (dito material, challenges)
//
// Gemessen am 24.09.2026: Ein Schluessel mit vollem Stichprobenfenster
// (2 x 200 Werte) kostet 3.959 Bytes, ein frischer 294 Bytes. Bei 138 Konten
// faellt das nicht auf; beim Ausbau auf ueber 15.000 traegt der Container
// (512 MB) es nicht mehr.
const { EventEmitter } = require('events');
const {
  normalizePath, snapshot, apmMiddleware, routeSchluessel, _statsLeeren, MAX_ROUTE_KEYS,
} = require('../../utils/apm');

describe('normalizePath: Pfade ohne Platzhalter waeren je ein eigener Schluessel', () => {
  it('normalisiert Zahlen-IDs (Bestandsverhalten)', () => {
    expect(normalizePath('/api/admin/konfis/42')).toBe('/api/admin/konfis/:id');
  });

  it('normalisiert UUIDs mit fuehrendem Buchstaben (Bestandsverhalten)', () => {
    expect(normalizePath('/api/events/abcd8400-e29b-41d4-a716-446655440000'))
      .toBe('/api/events/:uuid');
  });

  it('normalisiert UUIDs mit fuehrender ZIFFER', () => {
    // Beim Schreiben der Tests aufgefallen: Die UUID-Regel stand HINTER der
    // Zahlen-Regel und war damit wirkungslos, sobald eine UUID mit einer
    // Ziffer beginnt. Aus dieser hier wurde
    // '/api/events/:ide8400-e29b-41d4-a716-446655440000' — je UUID ein
    // eigener, nie aufgeraeumter Schluessel.
    expect(normalizePath('/api/events/550e8400-e29b-41d4-a716-446655440000'))
      .toBe('/api/events/:uuid');
  });

  it('fasst 500 UUIDs mit gemischtem Anfangszeichen zu EINEM Schluessel zusammen', () => {
    const zeichen = '0123456789abcdef';
    const schluessel = new Set();
    for (let i = 0; i < 500; i++) {
      const erst = zeichen[i % 16];
      schluessel.add(normalizePath(`/api/events/${erst}50e8400-e29b-41d4-a716-4466554400${(i % 100).toString().padStart(2, '0')}`));
    }
    expect(schluessel.size).toBe(1);
    expect([...schluessel][0]).toBe('/api/events/:uuid');
  });

  it('schneidet den Query-Teil ab (Bestandsverhalten)', () => {
    expect(normalizePath('/api/chat/rooms/7/messages?limit=100&offset=0'))
      .toBe('/api/chat/rooms/:id/messages');
  });

  describe('Namenspruefung beim Registrieren', () => {
    it('fasst verschiedene Namen zu EINEM Schluessel zusammen', () => {
      expect(normalizePath('/api/auth/check-username/emilia.mueller'))
        .toBe('/api/auth/check-username/:name');
      expect(normalizePath('/api/auth/check-username/jonas-schmidt'))
        .toBe('/api/auth/check-username/:name');
    });

    it('fasst die Tippvarianten EINES Namens zusammen', () => {
      // Der 300-ms-Debounce in KonfiRegisterPage feuert waehrend des Tippens:
      // Aus einer einzigen Registrierung entstehen mehrere Anfragen.
      const varianten = ['emi', 'emil', 'emili', 'emilia', 'emilia.m', 'emilia.mueller'];
      const schluessel = new Set(
        varianten.map(v => normalizePath(`/api/auth/check-username/${v}`))
      );
      expect(schluessel.size).toBe(1);
      expect([...schluessel][0]).toBe('/api/auth/check-username/:name');
    });
  });

  describe('Einladungscode', () => {
    it('fasst verschiedene Codes zu EINEM Schluessel zusammen', () => {
      // Produktion 24.09.2026 nachgemessen: 8 Hexzeichen in Grossschreibung
      // (crypto.randomBytes(4), auth.js:734) — z. B. 849BF987.
      expect(normalizePath('/api/auth/validate-invite/849BF987'))
        .toBe('/api/auth/validate-invite/:code');
      expect(normalizePath('/api/auth/validate-invite/2743A550'))
        .toBe('/api/auth/validate-invite/:code');
    });

    it('nimmt auch klein geschriebene Codes (die Route rechnet mit beidem)', () => {
      // validate-invite macht selbst code.toUpperCase() — kleingeschrieben
      // eingetippte Codes funktionieren also und duerfen keinen eigenen
      // Schluessel bekommen.
      expect(normalizePath('/api/auth/validate-invite/849bf987'))
        .toBe('/api/auth/validate-invite/:code');
    });
  });

  describe('Dateinamen (Chat, Material, Challenges)', () => {
    const hex64 = 'd9f76ff3a1b2c4d5e6f708192a3b4c5d6e7f80912a3b4c5d6e7f8091a2b3c4d5';

    it('fasst Chat-Dateien zu EINEM Schluessel zusammen', () => {
      expect(normalizePath(`/api/chat/files/${hex64}`)).toBe('/api/chat/files/:datei');
    });

    it('fasst Material-Dateien zu EINEM Schluessel zusammen', () => {
      expect(normalizePath(`/api/material/files/${hex64}`)).toBe('/api/material/files/:datei');
    });

    it('fasst Challenge-Dateien zu EINEM Schluessel zusammen', () => {
      expect(normalizePath(`/api/challenges/files/${hex64}`)).toBe('/api/challenges/files/:datei');
    });

    it('laesst DELETE /material/files/:fileId als Zahl-ID stehen', () => {
      // Dieselbe Pfadform, aber numerisch: Die Loeschroute nimmt die
      // Datensatz-ID, nicht den gespeicherten Namen. Sie war schon vorher
      // abgedeckt und muss es bleiben.
      expect(normalizePath('/api/material/files/17')).toBe('/api/material/files/:id');
    });
  });

  it('haelt die Zahl der Schluessel bei 1000 verschiedenen Anfragen bei 3', () => {
    // Die Kernaussage in einer Zahl: Ohne die Platzhalter waeren das 3000
    // Schluessel, die bis zum Neustart liegen bleiben.
    const schluessel = new Set();
    for (let i = 0; i < 1000; i++) {
      schluessel.add(normalizePath(`/api/auth/check-username/nutzer.nummer${i}`));
      schluessel.add(normalizePath(`/api/auth/validate-invite/${i.toString(16).toUpperCase().padStart(8, 'A')}`));
      schluessel.add(normalizePath(`/api/chat/files/${i.toString(16).padStart(64, 'a')}`));
    }
    expect(schluessel.size).toBe(3);
  });
});

// ================================================================
// Obergrenze der stats-Map — zweite Verteidigungslinie
// ================================================================
//
// Die Platzhalter oben sind die erste Linie. Diese Grenze fängt den Fall auf,
// dass jemand spaeter einen Pfad mit freiem Text ergaenzt und normalizePath
// nicht mitpflegt: Der Speicher darf dadurch nicht mehr unbegrenzt wachsen.
describe('Obergrenze fuer die Zahl der Route-Schluessel', () => {
  // `stats` ist Modul-Zustand und ueberlebt sonst von einem Test in den
  // naechsten — dieselbe Falle wie bei chatSyncCache.clear() in chat.test.js.
  beforeEach(() => {
    _statsLeeren();
  });

  /**
   * Schickt eine Anfrage durch apmMiddleware, ohne Express oder Datenbank.
   * Die Middleware haengt sich an 'finish'/'close' des Response — hier wird
   * 'finish' von Hand ausgeloest.
   */
  function messe(pfad) {
    const res = new EventEmitter();
    res.statusCode = 200;
    const req = { method: 'GET', originalUrl: pfad, url: pfad, readable: false };
    apmMiddleware(req, res, () => {});
    res.emit('finish');
  }

  it('verwirft bei Ueberschreitung die SELTENSTEN Schluessel, nicht die aeltesten', () => {
    // Eine echte Route mit vielen Aufrufen — genau die soll bleiben. Sie wird
    // ZUERST angelegt und ist damit auch die aelteste: Wuerde nach Alter
    // geraeumt, fiele sie als erste raus.
    for (let i = 0; i < 50; i++) messe('/api/pruefpfad-vielgenutzt');

    // Jetzt ein Schwall Schluessel mit je einem Aufruf, wie ihn ein
    // vergessener Platzhalter erzeugen wuerde.
    for (let i = 0; i < MAX_ROUTE_KEYS + 50; i++) {
      messe(`/api/pruefpfad-schwall/text-ohne-platzhalter-${i}`);
    }

    const stand = snapshot().routeSchluessel;
    // Die Grenze hat gegriffen …
    expect(stand.anzahl).toBeLessThanOrEqual(MAX_ROUTE_KEYS);
    expect(stand.grenze).toBe(MAX_ROUTE_KEYS);
    // … und zwar um genau ein Viertel der Grenze je Durchlauf.
    expect(stand.verworfen).toBe(Math.ceil(MAX_ROUTE_KEYS / 4));

    // Der Kern: Die vielgenutzte Route steht noch da, mit allen 50 Aufrufen.
    const vielgenutzt = routeSchluessel().find(r => r.route === 'GET /api/pruefpfad-vielgenutzt');
    expect(vielgenutzt).not.toBe(undefined);
    expect(vielgenutzt.count).toBe(50);
  });

  it('zaehlt ohne Ueberschreitung nichts als verworfen', () => {
    // Gegenstueck: Solange normalizePath vollstaendig ist, bleibt die Zahl 0 —
    // sonst waere `verworfen` als Warnsignal nutzlos.
    for (let i = 0; i < 20; i++) messe(`/api/pruefpfad-wenige/e-${i}`);

    const stand = snapshot().routeSchluessel;
    expect(stand.anzahl).toBe(20);
    expect(stand.verworfen).toBe(0);
  });

  it('verwirft NICHT den Schluessel der laufenden Anfrage', () => {
    // Beim Raeumen steht der frisch angelegte Schluessel auf count 0 und waere
    // damit der erste Kandidat der Sortierung — die Messung, die das Raeumen
    // ausloest, darf nicht verlorengehen.
    //
    // Jeder andere Schluessel bekommt ZWEI Aufrufe. Bei nur einem waere die
    // Reihenfolge unter Gleichstand beliebig und der Test manchmal gruen,
    // obwohl der Schutz fehlt.
    //
    // Genau BIS AN die Grenze fuellen, nicht darueber: Das Raeumen laeuft nur
    // beim Anlegen eines neuen Schluessels. Wer ueberfuellt, loest es mit einem
    // Schluessel aus der Mitte des Schwalls aus — nicht mit dem, den der Test
    // danach nachsieht.
    for (let i = 0; i < MAX_ROUTE_KEYS; i++) {
      const pfad = `/api/pruefpfad-voll/eintrag-${i}`;
      messe(pfad);
      messe(pfad);
    }
    expect(routeSchluessel()).toHaveLength(MAX_ROUTE_KEYS);

    // Dieser Aufruf legt den 601. Schluessel an und loest damit das Raeumen aus.
    const letzter = '/api/pruefpfad-letzte-anfrage/eintrag-xyz';
    messe(letzter);

    // Geraeumt wurde tatsaechlich …
    expect(routeSchluessel().length).toBe(MAX_ROUTE_KEYS + 1 - Math.ceil(MAX_ROUTE_KEYS / 4));
    // … und der ausloesende Schluessel hat es ueberlebt, mit seiner Messung.
    const eintrag = routeSchluessel().find(r => r.route === `GET ${letzter}`);
    expect(eintrag).not.toBe(undefined);
    expect(eintrag.count).toBe(1);
  });
});
