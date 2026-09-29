// Das Betriebs-Dashboard zeigt keine Suchbegriffe, Namen oder Schluessel aus
// der URL (Audit Leitung BF-12, 29.09.2026).
//
// recentErrors[].url und fehlerGruppen[].beispielUrl hielten req.originalUrl
// roh: bei einem Fehler auf `search-users?q=<Name>` den Suchbegriff, auf
// `check-username/<name>` (etwa 429) den Benutzernamen eines Kindes, bei
// Video-Elementen im Chat den Anmeldeschluessel aus `?token=`. Dasselbe
// schrieb das Langsam-Log. Jetzt: Query-Werte geschwaerzt, Namen/Codes/
// Dateinamen im Pfad ersetzt; Zahlen-Kennungen bleiben.
const { EventEmitter } = require('events');
const { snapshot, apmMiddleware, urlFuersAnzeige } = require('../../utils/apm');

function messe(pfad, status, { dauerMs = 5 } = {}) {
  const res = new EventEmitter();
  res.statusCode = status;
  const req = { method: 'GET', originalUrl: pfad, url: pfad, readable: false };
  const start = process.hrtime.bigint();
  const uhr = vi.spyOn(process.hrtime, 'bigint')
    .mockReturnValueOnce(start)
    .mockReturnValueOnce(start + BigInt(Math.round(dauerMs * 1e6)));
  apmMiddleware(req, res, () => {});
  res.emit('finish');
  uhr.mockRestore();
}

const fehlerZu = (routeTeil) => snapshot().recentErrors.find((e) => e.route.includes(routeTeil));
const gruppeZu = (routeTeil) => snapshot().fehlerGruppen.find((g) => g.route.includes(routeTeil));

describe('APM: URLs im Fehlerprotokoll geschwaerzt', () => {
  it('VERBOTEN: der Suchbegriff aus der Query steht nicht im Fehlerprotokoll', () => {
    messe('/api/organizations/search-users?q=Emilia%20Mueller&limit=5', 403);
    const fehler = fehlerZu('/api/organizations/search-users');
    expect(fehler.url).toBe('/api/organizations/search-users?q=***&limit=***');
    expect(gruppeZu('/api/organizations/search-users').beispielUrl).toBe('/api/organizations/search-users?q=***&limit=***');
    expect(JSON.stringify(snapshot())).not.toContain('Emilia');
  });

  it('VERBOTEN: der Benutzername aus check-username steht nicht im Fehlerprotokoll', () => {
    messe('/api/auth/check-username/emilia.mueller', 429);
    expect(fehlerZu('/api/auth/check-username').url).toBe('/api/auth/check-username/:name');
    expect(JSON.stringify(snapshot())).not.toContain('emilia.mueller');
  });

  it('VERBOTEN: der Anmeldeschluessel aus ?token= steht nicht im Fehlerprotokoll', () => {
    const hex = 'ab'.repeat(32);
    messe(`/api/chat/files/${hex}?token=platzhalter-kein-echter-schluessel`, 401);
    const fehler = fehlerZu('/api/chat/files');
    expect(fehler.url).toBe('/api/chat/files/:datei?token=***');
    expect(JSON.stringify(snapshot())).not.toContain('platzhalter');
  });

  it('VERBOTEN: das Langsam-Log schreibt die geschwaerzte URL', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      messe('/api/organizations/search-users?q=Jonas%20Schmidt', 200, { dauerMs: 1500 });
      const zeilen = warn.mock.calls.map((a) => a.join(' ')).filter((z) => z.includes('[APM] LANGSAM'));
      expect(zeilen).toEqual(['[APM] LANGSAM 1500ms GET /api/organizations/search-users?q=*** -> 200']);
    } finally {
      warn.mockRestore();
    }
  });

  it('ERLAUBT: Zahlen-Kennungen und Pfade ohne Query bleiben lesbar', () => {
    messe('/api/events/123/participants', 404);
    expect(fehlerZu('/api/events/:id/participants').url).toBe('/api/events/123/participants');
    expect(urlFuersAnzeige('/api/material/files/17')).toBe('/api/material/files/17');
    expect(urlFuersAnzeige('/api/chat/rooms/7/messages?limit=100&offset=0'))
      .toBe('/api/chat/rooms/7/messages?limit=***&offset=***');
  });

  it('Parametername, der kein Name ist, wird ebenfalls ersetzt', () => {
    expect(urlFuersAnzeige('/api/x?Anna%20M%C3%BCller=1&=2')).toBe('/api/x??=***&?=***');
    expect(urlFuersAnzeige('/api/auth/validate-invite/849BF987')).toBe('/api/auth/validate-invite/:code');
    expect(urlFuersAnzeige('/api/events/550e8400-e29b-41d4-a716-446655440000')).toBe('/api/events/:uuid');
    expect(urlFuersAnzeige(undefined)).toBe('');
  });
});
