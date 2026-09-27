// Tests fuer utils/betriebshinweise.js — Mindestversion je Plattform und
// Wartungshinweis fuer GET /api/app-version (Feature-Empfehlung E-05,
// Entscheidung 27.09.2026).
//
// Die Werte kommen aus Umgebungsvariablen des Stacks. Geprueft wird ueber den
// env-Parameter (Muster wie smtpKonfiguration.test.js), ohne process.env
// anzufassen; das Lesen bei jeder Anfrage prueft tests/routes/appVersion.test.js.
//
// Verhaltensgarantien:
// 1. Nicht gesetzt oder leer: keine Mindestversion, kein Wartungshinweis.
// 2. Eine Mindestversion gilt nur in der Form x.y.z (Ziffern). Alles andere
//    wird ignoriert -- eine falsch getippte Variable darf nie alle Geraete
//    sperren -- und EINMAL je Wert ins Log geschrieben, nicht bei jeder
//    Anfrage (der Endpunkt laeuft bei jedem App-Start und jeder Rueckkehr).
// 3. Der Wartungshinweis ist der getrimmte Text; nur Leerzeichen zaehlt als leer.
const {
  betriebshinweise,
  _nurFuerTests_reset,
} = require('../../utils/betriebshinweise');

describe('betriebshinweise', () => {
  let warn;

  beforeEach(() => {
    _nurFuerTests_reset();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('ohne Variablen: keine Mindestversion, kein Wartungshinweis, keine Warnung', () => {
    expect(betriebshinweise({})).toEqual({
      minVersion: { ios: null, android: null },
      wartung: { aktiv: false, text: null },
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('leere oder nur aus Leerzeichen bestehende Werte zaehlen als nicht gesetzt', () => {
    expect(betriebshinweise({
      APP_MIN_VERSION_IOS: '',
      APP_MIN_VERSION_ANDROID: '   ',
      WARTUNG_HINWEIS: '  ',
    })).toEqual({
      minVersion: { ios: null, android: null },
      wartung: { aktiv: false, text: null },
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('liest die Mindestversion je Plattform getrennt, getrimmt', () => {
    expect(betriebshinweise({
      APP_MIN_VERSION_IOS: '2.3.0',
      APP_MIN_VERSION_ANDROID: ' 2.10.1 ',
    }).minVersion).toEqual({ ios: '2.3.0', android: '2.10.1' });
    expect(betriebshinweise({ APP_MIN_VERSION_ANDROID: '2.2.0' }).minVersion)
      .toEqual({ ios: null, android: '2.2.0' });
  });

  it('ungueltige Versionen werden ignoriert (null) und geloggt', () => {
    for (const wert of ['2.3', '2', 'abc', '2.3.0-beta', 'v2.3.0', '2.3.0.1', '2,3,0', '2.3.x']) {
      _nurFuerTests_reset();
      warn.mockClear();
      const ergebnis = betriebshinweise({ APP_MIN_VERSION_IOS: wert });
      expect(ergebnis.minVersion.ios, `Wert "${wert}"`).toBeNull();
      expect(warn, `Wert "${wert}"`).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('APP_MIN_VERSION_IOS');
      expect(warn.mock.calls[0][0]).toContain(`"${wert}"`);
    }
  });

  it('warnt je ungueltigem Wert nur einmal, nicht bei jeder Anfrage', () => {
    for (let i = 0; i < 5; i++) betriebshinweise({ APP_MIN_VERSION_ANDROID: '2.3' });
    expect(warn).toHaveBeenCalledTimes(1);
    // Ein anderer falscher Wert ist eine neue Lage und wird wieder gemeldet.
    betriebshinweise({ APP_MIN_VERSION_ANDROID: '2.4' });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('eine ungueltige Plattform laesst die andere unberuehrt', () => {
    expect(betriebshinweise({
      APP_MIN_VERSION_IOS: 'kaputt',
      APP_MIN_VERSION_ANDROID: '2.3.0',
    }).minVersion).toEqual({ ios: null, android: '2.3.0' });
  });

  it('Wartungshinweis: getrimmter Text und aktiv', () => {
    expect(betriebshinweise({ WARTUNG_HINWEIS: '  Heute ab 20 Uhr Wartung.  ' }).wartung)
      .toEqual({ aktiv: true, text: 'Heute ab 20 Uhr Wartung.' });
  });

  it('Wartungshinweis wird unveraendert als Text durchgereicht (Anzeige als Klartext ist Sache der App)', () => {
    expect(betriebshinweise({ WARTUNG_HINWEIS: '<b>Wartung</b> & mehr' }).wartung)
      .toEqual({ aktiv: true, text: '<b>Wartung</b> & mehr' });
  });
});
