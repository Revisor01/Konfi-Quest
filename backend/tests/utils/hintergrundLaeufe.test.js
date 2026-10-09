// backend/tests/utils/hintergrundLaeufe.test.js
//
// Laufzeiten im Hintergrund (Betrieb BF-10 Rest, 09.10.2026): je Job letzter
// Start, Dauer, Ergebnis; Dauer des Push-Versands je Weg; Protokollzeile mit
// Dauer. Gemessen wird mit einer eingespeisten Uhr, damit die Dauer ein
// fester Wert ist und nicht "irgendwas ueber 0".

const lauf = require('../../utils/hintergrundLaeufe');

const uhr = (...zeiten) => {
  const liste = [...zeiten];
  return () => liste.shift();
};
const T0 = Date.parse('2026-10-09T08:00:00.000Z');

describe('hintergrundLaeufe: messeLauf', () => {
  let log;
  let warnLog;
  let fehlerLog;

  beforeEach(() => {
    lauf._leeren();
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnLog = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fehlerLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    log.mockRestore();
    warnLog.mockRestore();
    fehlerLog.mockRestore();
  });

  const job = (name) => lauf.stand().jobs.find((j) => j.name === name);

  it('ein erfolgreicher Lauf: Start, Ende, Dauer, ok, Zaehler', async () => {
    const r = await lauf.messeLauf('push_tokens', async () => 7, { jetzt: uhr(T0, T0 + 250) });
    expect(r).toBe(7);
    expect(job('push_tokens')).toEqual({
      name: 'push_tokens',
      bezeichnung: 'Push-Geräte aufräumen',
      takt: 'alle 6 Stunden',
      letzterStart: '2026-10-09T08:00:00.000Z',
      letztesEnde: '2026-10-09T08:00:00.250Z',
      dauerMs: 250,
      ergebnis: 'ok',
      fehler: null,
      anzahl: 1,
      fehlerAnzahl: 0,
      maxDauerMs: 250,
      gesamtDauerMs: 250,
      mittelDauerMs: 250,
    });
  });

  it('ein Fehler geht weiter und steht als Fehler mit Text da', async () => {
    await expect(lauf.messeLauf('push_tokens', async () => { throw new Error('DB weg'); }, { jetzt: uhr(T0, T0 + 40) }))
      .rejects.toThrow('DB weg');
    const j = job('push_tokens');
    expect(j.ergebnis).toBe('fehler');
    expect(j.fehler).toBe('DB weg');
    expect(j.fehlerAnzahl).toBe(1);
    expect(j.dauerMs).toBe(40);
  });

  it('nach einem Fehler setzt der naechste gute Lauf das Ergebnis zurueck, die Zaehler bleiben', async () => {
    await lauf.messeLauf('push_tokens', async () => { throw new Error('x'); }, { jetzt: uhr(T0, T0 + 10) }).catch(() => {});
    await lauf.messeLauf('push_tokens', async () => null, { jetzt: uhr(T0 + 100, T0 + 400) });
    const j = job('push_tokens');
    expect(j).toMatchObject({ ergebnis: 'ok', fehler: null, anzahl: 2, fehlerAnzahl: 1, maxDauerMs: 300, gesamtDauerMs: 310, mittelDauerMs: 155 });
  });

  it('laufFehler: ein abgefangener Fehler macht den Lauf zum Fehler, ohne dass er wirft', async () => {
    const r = await lauf.messeLauf('testphase', async () => {
      lauf.laufFehler('testphase', new Error('Sperrung fehlgeschlagen'));
      return { locked: 0 };
    }, { jetzt: uhr(T0, T0 + 5) });
    expect(r).toEqual({ locked: 0 });
    expect(job('testphase')).toMatchObject({ ergebnis: 'fehler', fehler: 'Sperrung fehlgeschlagen', fehlerAnzahl: 1 });
    expect(job('testphase')).not.toHaveProperty('gemeldet');
  });

  it('laufFehler ausserhalb eines Laufs aendert nichts', async () => {
    await lauf.messeLauf('testphase', async () => null, { jetzt: uhr(T0, T0 + 5) });
    lauf.laufFehler('testphase', new Error('spaet'));
    expect(job('testphase')).toMatchObject({ ergebnis: 'ok', fehlerAnzahl: 0 });
  });

  it('Protokoll: taegliche und Zaehler-Jobs schreiben immer eine Zeile mit Dauer und Zusatz', async () => {
    await lauf.messeLauf('zaehler', async () => ({ updated: 40, total: 82 }), {
      jetzt: uhr(T0, T0 + 52),
      zusatz: (r) => `${r.updated} von ${r.total}`,
    });
    expect(log.mock.calls).toEqual([['Hintergrund: Zähler am App-Symbol in 52 ms, ok (40 von 82)']]);
  });

  it('Protokoll: Minuten-Jobs schweigen, wenn sie schnell und erfolgreich sind', async () => {
    await lauf.messeLauf('anmeldung_offen', async () => null, { jetzt: uhr(T0, T0 + 999) });
    expect(log).not.toHaveBeenCalled();
    expect(warnLog).not.toHaveBeenCalled();
    expect(fehlerLog).not.toHaveBeenCalled();
  });

  it('Protokoll: Minuten-Jobs schreiben ab einer Sekunde', async () => {
    await lauf.messeLauf('anmeldung_offen', async () => null, { jetzt: uhr(T0, T0 + 1000) });
    expect(log.mock.calls).toEqual([['Hintergrund: Push „Anmeldung möglich“ in 1000 ms, ok']]);
  });

  it('Protokoll: ein Fehler geht als Warnung mit Dauer, auch bei Minuten-Jobs -- die Fehlerzeile bleibt beim Aufrufer', async () => {
    await lauf.messeLauf('anmeldung_offen', async () => { throw new Error('x'); }, { jetzt: uhr(T0, T0 + 3) }).catch(() => {});
    expect(warnLog.mock.calls).toEqual([['Hintergrund: Push „Anmeldung möglich“ in 3 ms, Fehler']]);
    expect(log).not.toHaveBeenCalled();
    expect(fehlerLog).not.toHaveBeenCalled();
  });

  it('waehrend des Laufs steht er als "laeuft" da', async () => {
    let fertig;
    const p = lauf.messeLauf('auto_loeschung', () => new Promise((r) => { fertig = r; }));
    expect(job('auto_loeschung').ergebnis).toBe('laeuft');
    fertig();
    await p;
    expect(job('auto_loeschung').ergebnis).toBe('ok');
  });

  it('kuerzt lange Fehlertexte auf 200 Zeichen', async () => {
    await lauf.messeLauf('push_tokens', async () => { throw new Error('x'.repeat(500)); }, { jetzt: uhr(T0, T0) }).catch(() => {});
    expect(job('push_tokens').fehler).toHaveLength(200);
  });
});

describe('hintergrundLaeufe: Push-Versand', () => {
  let log;

  beforeEach(() => {
    lauf._leeren();
    log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => log.mockRestore());

  it('verbucht je Weg Anzahl, Empfaenger, Mittel und Maximum', () => {
    lauf.pushVerbuchen({ weg: 'viele', art: 'event_cancelled', empfaenger: 10, dauerMs: 300, zeit: new Date(T0) });
    lauf.pushVerbuchen({ weg: 'viele', art: 'event_cancelled', empfaenger: 4, dauerMs: 100, fehler: true, zeit: new Date(T0 + 1000) });
    const { pushVersand } = lauf.stand();
    expect(pushVersand.jeWeg.viele).toEqual({
      anzahl: 2, fehler: 1, empfaenger: 14, gesamtDauerMs: 400, maxDauerMs: 300,
      letzteDauerMs: 100, zuletzt: '2026-10-09T08:00:01.000Z', mittelDauerMs: 200,
    });
    expect(pushVersand.jeWeg.einzeln.anzahl).toBe(0);
    expect(pushVersand.jeWeg.einzeln.mittelDauerMs).toBe(null);
    expect(pushVersand.langsamster).toEqual({ weg: 'viele', art: 'event_cancelled', empfaenger: 10, dauerMs: 300, zeit: '2026-10-09T08:00:00.000Z' });
  });

  it('Protokoll: eine Zeile erst ab fuenf Sekunden, nicht darunter (auch nicht bei vielen Empfaenger:innen)', () => {
    lauf.pushVerbuchen({ weg: 'viele', art: 'event_cancelled', empfaenger: 15000, dauerMs: 4999 });
    lauf.pushVerbuchen({ weg: 'chat', art: 'chat', empfaenger: 3, dauerMs: 5 });
    expect(log).not.toHaveBeenCalled();
    lauf.pushVerbuchen({ weg: 'viele', art: 'event_cancelled', empfaenger: 20, dauerMs: 5000 });
    lauf.pushVerbuchen({ weg: 'chat', art: 'chat', empfaenger: 2, dauerMs: 6000, fehler: true });
    expect(log.mock.calls).toEqual([
      ['Push event_cancelled: 20 Empfänger:innen in 5000 ms'],
      ['Push chat: 2 Empfänger:innen in 6000 ms, Fehler'],
    ]);
  });

  it('Einzel-Pushes schreiben keine Zeile, auch langsame nicht', () => {
    lauf.pushVerbuchen({ weg: 'einzeln', art: 'x', empfaenger: 1, dauerMs: 5000 });
    expect(log).not.toHaveBeenCalled();
    expect(lauf.stand().pushVersand.jeWeg.einzeln.maxDauerMs).toBe(5000);
  });

  it('messePush misst und laesst Fehler durch', async () => {
    await expect(lauf.messePush({ weg: 'chat', art: 'chat', empfaenger: 2 }, async () => { throw new Error('FCM'); }))
      .rejects.toThrow('FCM');
    expect(lauf.stand().pushVersand.jeWeg.chat).toMatchObject({ anzahl: 1, fehler: 1, empfaenger: 2 });
  });
});

describe('hintergrundLaeufe: Zusammenfassen ueber Replicas', () => {
  const j = (name, start, extra = {}) => ({
    name, bezeichnung: name, takt: null, letzterStart: start, letztesEnde: start, dauerMs: 10,
    ergebnis: 'ok', fehler: null, anzahl: 1, fehlerAnzahl: 0, maxDauerMs: 10, gesamtDauerMs: 10, mittelDauerMs: 10, ...extra,
  });
  const push = (anzahl, gesamt, max, zuletzt) => ({
    jeWeg: {
      einzeln: { anzahl: 0, fehler: 0, empfaenger: 0, gesamtDauerMs: 0, maxDauerMs: 0, letzteDauerMs: null, zuletzt: null, mittelDauerMs: null },
      viele: { anzahl, fehler: 0, empfaenger: anzahl * 2, gesamtDauerMs: gesamt, maxDauerMs: max, letzteDauerMs: max, zuletzt, mittelDauerMs: null },
      chat: { anzahl: 0, fehler: 0, empfaenger: 0, gesamtDauerMs: 0, maxDauerMs: 0, letzteDauerMs: null, zuletzt: null, mittelDauerMs: null },
    },
    langsamster: anzahl ? { weg: 'viele', art: 'a', empfaenger: 2, dauerMs: max, zeit: zuletzt } : null,
  });

  it('Jobs: der juengste Lauf gewinnt, Zaehler addiert; Push je Weg addiert', () => {
    const ergebnis = lauf.zusammenfuehren([
      { replica: 'alt', stand: { jobs: [j('zaehler', '2026-10-09T07:00:00.000Z', { dauerMs: 80, maxDauerMs: 900, gesamtDauerMs: 900 })], pushVersand: push(1, 100, 100, '2026-10-09T07:00:00.000Z') } },
      { replica: 'neu', stand: { jobs: [j('zaehler', '2026-10-09T08:00:00.000Z', { dauerMs: 20, ergebnis: 'fehler', fehler: 'x', fehlerAnzahl: 1 })], pushVersand: push(3, 300, 250, '2026-10-09T08:00:00.000Z') } },
      null,
    ]);
    expect(ergebnis.jobs).toEqual([{
      ...j('zaehler', '2026-10-09T08:00:00.000Z', { dauerMs: 20, ergebnis: 'fehler', fehler: 'x' }),
      replica: 'neu', anzahl: 2, fehlerAnzahl: 1, maxDauerMs: 900, gesamtDauerMs: 910, mittelDauerMs: 455,
    }]);
    expect(ergebnis.pushVersand.jeWeg.viele).toEqual({
      anzahl: 4, fehler: 0, empfaenger: 8, gesamtDauerMs: 400, maxDauerMs: 250,
      letzteDauerMs: 250, zuletzt: '2026-10-09T08:00:00.000Z', mittelDauerMs: 100,
    });
    expect(ergebnis.pushVersand.langsamster.dauerMs).toBe(250);
  });

  it('ohne Staende: undefined (Feld fehlt im Gesamtbild)', () => {
    expect(lauf.zusammenfuehren([null, { replica: 'x', stand: undefined }])).toBe(undefined);
  });
});
