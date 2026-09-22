import { describe, it, expect } from 'vitest';
import {
  apdexStufe,
  gesamtzustand,
  routenListe,
  tagesbilanz,
  vergleichHeuteGegenVortage,
  type RoutenRohzeile,
} from '../../utils/betriebsKennzahlen';

// ---------------------------------------------------------------------------
// DAS URTEIL IST DIE KENNZAHL, NICHT DIE ZAHL.
//
// Simon (22.09.2026): "das p95 hilft mir dann garnicht — welcher wert ist denn
// wirklich aussagekraeftig." Eine Millisekundenzahl allein beantwortet keine
// Frage. Geprueft wird deshalb, was die Seite daraus MACHT: die Ampel oben,
// die Einordnung des Apdex und der Vergleich mit den Vortagen.
//
// Alle drei sind reine Funktionen und genau deshalb hier herausgezogen.
// ---------------------------------------------------------------------------

const leererSnapshot = (ueberschreiben: Record<string, unknown> = {}) => ({
  uptimeSeconds: 3600,
  totalRequests: 1000,
  totalErrors: 0,
  errorRate: 0,
  inFlight: 0,
  maxInFlight: 3,
  rps: 1,
  routesSlowest: [],
  routesBusiest: [],
  recentErrors: [],
  timeline: [{ t: '2026-09-22T10:00:00.000Z', requests: 50, errors: 0, avgMs: 40 }],
  apdex: { wert: 1, zufrieden: 1000, toleriert: 0, frustriert: 0, schwelleMs: 500, toleriertBisMs: 2000 },
  ueber1s: { anzahl: 0, quote: 0, schwelleMs: 1000 },
  ...ueberschreiben,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any;

describe('Betriebs-Dashboard: Ampel oben', () => {
  it('meldet "Alles läuft", wenn es nichts zu melden gibt', () => {
    const z = gesamtzustand(leererSnapshot());
    expect(z.stufe).toBe('gut');
    expect(z.titel).toBe('Alles läuft');
  });

  it('meldet eine Störung, wenn gerade Fehler auflaufen', () => {
    const z = gesamtzustand(leererSnapshot({
      totalErrors: 4,
      timeline: [{ t: '2026-09-22T10:00:00.000Z', requests: 50, errors: 4, avgMs: 40 }],
    }));
    expect(z.stufe).toBe('stoerung');
    // Die Zahl muss im Satz stehen — sonst ist es kein Befund, sondern ein Gefuehl.
    expect(z.satz).toContain('4');
  });

  it('unterscheidet alte Fehler von laufenden', () => {
    // Fehler seit dem Start, aber in den letzten Minuten keine mehr: Das ist
    // kein Notfall. Die alte Seite haette bei totalErrors > 0 nur eine rote
    // Fehlerrate gezeigt, ohne diesen Unterschied.
    const z = gesamtzustand(leererSnapshot({
      totalErrors: 12,
      timeline: [{ t: '2026-09-22T10:00:00.000Z', requests: 50, errors: 0, avgMs: 40 }],
    }));
    expect(z.stufe).toBe('auffaellig');
    expect(z.satz).toContain('12');
  });

  it('meldet eine Störung, wenn der Apdex eingebrochen ist — auch ohne einen einzigen Fehler', () => {
    const z = gesamtzustand(leererSnapshot({
      apdex: { wert: 0.4, zufrieden: 100, toleriert: 0, frustriert: 400, schwelleMs: 500, toleriertBisMs: 2000 },
    }));
    expect(z.stufe).toBe('stoerung');
    expect(z.titel).toBe('Spürbar langsam');
  });

  it('meldet zähes Laufen zwischen 0,70 und 0,85', () => {
    const z = gesamtzustand(leererSnapshot({
      apdex: { wert: 0.8, zufrieden: 800, toleriert: 0, frustriert: 200, schwelleMs: 500, toleriertBisMs: 2000 },
    }));
    expect(z.stufe).toBe('auffaellig');
    expect(z.titel).toBe('Läuft, aber zäh');
  });

  it('weist auf Warten hin, wenn viel über einer Sekunde liegt, der Server aber schnell ist', () => {
    // Genau der Fall Foto-Upload ueber Mobilfunk: Server flink, Leitung lahm.
    const z = gesamtzustand(leererSnapshot({
      ueber1s: { anzahl: 80, quote: 8, schwelleMs: 1000 },
    }));
    expect(z.stufe).toBe('auffaellig');
    expect(z.satz).toContain('Verbindung');
  });
});

describe('Betriebs-Dashboard: Apdex einordnen', () => {
  it('gibt jeder Stufe eine Farbe und einen Rat', () => {
    expect(apdexStufe(0.99).text).toBe('ausgezeichnet');
    expect(apdexStufe(0.90).text).toBe('gut');
    expect(apdexStufe(0.75).text).toBe('ausreichend');
    expect(apdexStufe(0.60).text).toBe('dürftig');
    expect(apdexStufe(0.20).text).toBe('nicht hinnehmbar');
  });

  it('sagt bei fehlenden Daten "keine Daten" statt "nicht hinnehmbar"', () => {
    // null ist kein schlechter Wert, sondern gar keiner. Wuerde hier 0
    // stehen, leuchtete die Karte direkt nach jedem Neustart rot.
    expect(apdexStufe(null).text).toBe('noch keine Daten');
    expect(apdexStufe(undefined).text).toBe('noch keine Daten');
  });

  it('gibt bei guten Werten ausdrücklich "nichts zu tun" aus', () => {
    expect(apdexStufe(0.97).rat).toBe('Nichts zu tun.');
  });
});

describe('Betriebs-Dashboard: Tagesbilanz aus der Historie', () => {
  const d = (at: string, requests: number, errors: number, worstP95: number, worstRoute: string | null) =>
    ({ at, requests, errors, worstP95, worstRoute });

  it('summiert die Fünf-Minuten-Schritte je Tag', () => {
    const t = tagesbilanz([
      d('2026-09-20T08:00:00.000Z', 100, 1, 300, 'GET /a'),
      d('2026-09-20T09:00:00.000Z', 150, 0, 200, 'GET /b'),
      d('2026-09-21T08:00:00.000Z', 90, 2, 900, 'GET /c'),
    ]);
    expect(t).toHaveLength(2);
    expect(t[0].anfragen).toBe(250);
    expect(t[0].fehler).toBe(1);
    // Die schlimmste Route des Tages ist die mit dem hoechsten Wert, nicht die letzte.
    expect(t[0].schlimmsteMs).toBe(300);
    expect(t[0].schlimmsteRoute).toBe('GET /a');
    expect(t[1].anfragen).toBe(90);
    expect(t[1].schlimmsteRoute).toBe('GET /c');
  });

  it('gibt bei leerer Historie eine leere Liste zurück', () => {
    expect(tagesbilanz([])).toEqual([]);
  });
});

describe('Betriebs-Dashboard: heute gegen die Vortage', () => {
  const tag = (name: string, anfragen: number, fehler: number, ms: number) =>
    ({ tag: name, anfragen, fehler, schlimmsteMs: ms, schlimmsteRoute: 'GET /x' });

  it('verlangt mindestens zwei Tage', () => {
    expect(vergleichHeuteGegenVortage([])).toBeNull();
    expect(vergleichHeuteGegenVortage([tag('20.09.', 100, 0, 200)])).toBeNull();
  });

  it('rechnet den angebrochenen Tag auf die Stunde hoch statt roh zu vergleichen', () => {
    // Vortag: 2400 Anfragen auf 24 Stunden = 100 je Stunde.
    // Heute: 600 Anfragen in 6 Stunden = ebenfalls 100 je Stunde.
    // Ein roher Vergleich der Tagessummen ergaebe -75 % — und stuende jeden
    // Vormittag alarmierend da, obwohl sich nichts geaendert hat.
    const v = vergleichHeuteGegenVortage([tag('20.09.', 2400, 0, 200), tag('21.09.', 600, 0, 200)], 6);
    expect(v).not.toBeNull();
    expect(v!.anfragen.heute).toBe(100);
    expect(v!.anfragen.vorher).toBe(100);
    expect(v!.anfragen.delta).toBe(0);
  });

  it('erkennt einen echten Anstieg', () => {
    // Vortag 100 je Stunde, heute 200 je Stunde -> +100 %.
    const v = vergleichHeuteGegenVortage([tag('20.09.', 2400, 0, 200), tag('21.09.', 1200, 0, 200)], 6);
    expect(v!.anfragen.delta).toBe(100);
  });

  it('mittelt über mehrere Vortage statt nur den letzten zu nehmen', () => {
    const v = vergleichHeuteGegenVortage([
      tag('18.09.', 2400, 10, 200),
      tag('19.09.', 4800, 0, 400),
      tag('20.09.', 2400, 20, 300),
      tag('21.09.', 600, 5, 300),
    ], 6);
    expect(v!.vergleichstage).toBe(3);
    // (2400 + 4800 + 2400) / 3 = 3200 am Tag = 133,33 je Stunde.
    expect(v!.anfragen.vorher).toBeCloseTo(133.33, 1);
    // (10 + 0 + 20) / 3 = 10 Fehler am Tag im Schnitt.
    expect(v!.fehler.vorher).toBe(10);
  });

  it('vergleicht die langsamste Route ohne Hochrechnung', () => {
    // Eine Antwortzeit ist kein Zaehler: Sie haeuft sich ueber den Tag nicht
    // an und darf deshalb NICHT je Stunde gerechnet werden.
    const v = vergleichHeuteGegenVortage([tag('20.09.', 2400, 0, 200), tag('21.09.', 600, 0, 400)], 6);
    expect(v!.schlimmste.heute).toBe(400);
    expect(v!.schlimmste.vorher).toBe(200);
    expect(v!.schlimmste.delta).toBe(100);
  });

  it('gibt kein Delta aus, wenn es an den Vortagen nichts gab, wodurch zu teilen wäre', () => {
    // Null Fehler an allen Vortagen: "unendlich mehr" ist keine Aussage.
    const v = vergleichHeuteGegenVortage([tag('20.09.', 2400, 0, 200), tag('21.09.', 600, 3, 200)], 6);
    expect(v!.fehler.delta).toBeNull();
    expect(v!.fehler.heute).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// EINE LISTE, ZWEI SORTIERUNGEN.
//
// Simon (22.09.2026): "Wir haben Aufwand und die Routen. Ich verstehe nicht,
// warum du das gegeneinander trennst." Und zur Gesamtserverzeit: "Die gesamte
// Serverzeit muss ja auf die Anzahl der Anfragen gerechnet werden."
//
// Geprueft wird deshalb: dass die Zeit PRO ANFRAGE sortiert (nicht die Summe,
// nicht das p95), dass die Summe nur noch als Anteil erscheint, und dass die
// drei Backend-Listen ohne Dubletten zusammenfinden.
// ---------------------------------------------------------------------------

describe('Betriebs-Dashboard: Routenliste', () => {
  const zeile = (route: string, count: number, serverAvgMs: number, extra: Partial<RoutenRohzeile> = {}): RoutenRohzeile => ({
    route,
    count,
    errors: 0,
    avgMs: serverAvgMs,
    p95Ms: serverAvgMs * 2,
    maxMs: serverAvgMs * 3,
    serverAvgMs,
    serverP95Ms: serverAvgMs * 2,
    serverMaxMs: serverAvgMs * 3,
    serverP50Ms: serverAvgMs,
    serverZeitGesamtMs: serverAvgMs * count,
    ...extra,
  });

  it('sortiert nach der Zeit pro Anfrage, nicht nach der gesamten Serverzeit', () => {
    // /viel kostet insgesamt am meisten (3000 Aufrufe à 60 ms = 180 s),
    // ist pro Anfrage aber die schnellste Route. Oben gehoert /selten.
    const zeilen = routenListe([[
      zeile('GET /viel', 3000, 60),
      zeile('GET /selten', 3, 900),
      zeile('GET /mittel', 100, 300),
    ]], 'langsam');
    expect(zeilen.map(z => z.route)).toEqual(['GET /selten', 'GET /mittel', 'GET /viel']);
  });

  it('sortiert umschaltbar nach der Aufrufzahl', () => {
    const zeilen = routenListe([[
      zeile('GET /viel', 3000, 60),
      zeile('GET /selten', 3, 900),
      zeile('GET /mittel', 100, 300),
    ]], 'haeufig');
    expect(zeilen.map(z => z.route)).toEqual(['GET /viel', 'GET /mittel', 'GET /selten']);
  });

  it('rechnet die gesamte Serverzeit in einen Anteil um', () => {
    // 180000 ms + 2700 ms + 30000 ms = 212700 ms gesamt.
    const zeilen = routenListe([[
      zeile('GET /viel', 3000, 60),
      zeile('GET /selten', 3, 900),
      zeile('GET /mittel', 100, 300),
    ]], 'haeufig');
    const anteile = Object.fromEntries(zeilen.map(z => [z.route, z.anteilProzent]));
    expect(anteile['GET /viel']).toBe(85);
    expect(anteile['GET /mittel']).toBe(14);
    expect(anteile['GET /selten']).toBe(1);
    expect(zeilen.reduce((s, z) => s + z.anteilProzent, 0)).toBe(100);
  });

  it('nennt Median und Durchschnitt getrennt, damit Ausreißer sichtbar werden', () => {
    // Typisch 40 ms, im Schnitt 400 ms: Ein einzelner Ausreisser zieht den
    // Schnitt hoch, die Route selbst ist schnell. Genau das soll man sehen.
    const [z] = routenListe([[zeile('GET /wackelig', 50, 400, { serverP50Ms: 40, serverP95Ms: 3000 })]], 'langsam');
    expect(z.mitteMs).toBe(40);
    expect(z.schnittMs).toBe(400);
    expect(z.p95).toBe(3000);
  });

  it('führt dieselbe Route aus mehreren Backend-Listen nur einmal auf', () => {
    // routesPotenzial, routesSlowest und routesBusiest ueberschneiden sich.
    const a = zeile('GET /doppelt', 100, 300);
    const zeilen = routenListe([[a], [a], [a, zeile('GET /anderes', 10, 50)]], 'haeufig');
    expect(zeilen.map(z => z.route)).toEqual(['GET /doppelt', 'GET /anderes']);
    // Und der Anteil darf sich durch die Dubletten nicht verschieben.
    expect(zeilen[0].anteilProzent).toBe(98);
  });

  it('kommt ohne Serverzeiten aus und fällt auf die Gesamtzeit zurück', () => {
    // Aeltere Replicas liefern serverAvgMs/serverP50Ms noch nicht mit.
    const zeilen = routenListe([[
      { route: 'GET /alt', count: 10, errors: 0, avgMs: 120, p95Ms: 300, maxMs: 500 },
    ]], 'langsam');
    expect(zeilen[0].mitteMs).toBe(120);
    expect(zeilen[0].schnittMs).toBe(120);
    expect(zeilen[0].p95).toBe(300);
    expect(zeilen[0].anteilProzent).toBe(0);
  });

  it('liefert für leere Listen nichts und stürzt nicht ab', () => {
    expect(routenListe([undefined, []], 'langsam')).toEqual([]);
  });

  it('begrenzt die Liste auf die angegebene Zahl von Zeilen', () => {
    const viele = Array.from({ length: 30 }, (_, i) => zeile(`GET /r${i}`, 10, i + 1));
    expect(routenListe([viele], 'langsam')).toHaveLength(20);
    expect(routenListe([viele], 'langsam', 5)).toHaveLength(5);
  });
});
