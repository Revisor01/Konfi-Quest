// backend/tests/utils/badgeProgress.test.js
const { berechneBadgeProgress, bedingungFehlt, liesCriteriaExtra } =
  require('../../utils/badgeProgress');

// Befund N2 Teil 2: Der Fortschritt wurde zweimal gerechnet — einmal in
// utils/konfiBadgeProgress.js, einmal 240 Zeilen inline in routes/teamer.js.
// Beim Zusammenlegen kamen drei echte Unterschiede heraus, die hier
// festgehalten sind. Der Kern braucht keine Datenbank: er rechnet aus
// fertigen Zaehlern.

const badge = (criteria_type, criteria_value, criteria_extra) =>
  ({ id: 1, criteria_type, criteria_value, criteria_extra });

describe('berechneBadgeProgress: Grundrechnung', () => {
  it('rechnet Anteil und deckelt bei 100 Prozent', () => {
    const p = berechneBadgeProgress(badge('event_count', 4), { events: 2 });
    expect(p).toEqual({ current: 2, target: 4, percentage: 50 });
  });

  it('mehr als das Ziel bleibt bei 100 Prozent', () => {
    const p = berechneBadgeProgress(badge('event_count', 2), { events: 9 });
    expect(p.current).toBe(9);
    expect(p.percentage).toBe(100);
  });

  it('gibt ungerundet zurueck, damit die Aufrufer selbst runden', () => {
    // Der Konfi-Pfad zeigt die Kommazahl, der Teamer-Pfad rundet auf ganze
    // Prozent. Vorher rechnete jeder Pfad anders — 1 von 3 war einmal
    // 33.333... und einmal 33.
    const p = berechneBadgeProgress(badge('event_count', 3), { events: 1 });
    expect(p.percentage).toBeCloseTo(33.3333, 3);
    expect(Math.round(p.percentage)).toBe(33);
  });

  it('ohne criteria_value gilt 1 als Ziel, nicht Division durch null', () => {
    const p = berechneBadgeProgress(badge('event_count', null), { events: 1 });
    expect(p.target).toBe(1);
    expect(p.percentage).toBe(100);
  });

  it('fehlende Zaehler gelten als 0', () => {
    const p = berechneBadgeProgress(badge('event_count', 5), {});
    expect(p.current).toBe(0);
    expect(p.percentage).toBe(0);
  });
});

describe('berechneBadgeProgress: kaputtes criteria_extra zerreisst nichts', () => {
  // Der eigentliche Befund: Im Teamer-Pfad stand das JSON.parse ohne
  // Auffangnetz. Ein einziger defekter Datensatz haette die GANZE
  // Abzeichen-Seite in den 500 laufen lassen. Der Konfi-Pfad fing es ab.
  it.each([
    'specific_activity',
    'category_activities',
    'activity_combination',
    'time_based'
  ])('%s mit unlesbarem criteria_extra ergibt 0 statt eines Fehlers', (typ) => {
    const p = berechneBadgeProgress(badge(typ, 5, '{kaputt'), {
      proAktivitaetsname: new Map([['Konfitag', 3]]),
      proKategorie: new Map([['Musik', 3]]),
      alleDaten: [new Date().toISOString()]
    });
    expect(p.current).toBe(0);
    expect(p.percentage).toBe(0);
  });

  it('criteria_extra als null ist kein Fehler', () => {
    const p = berechneBadgeProgress(badge('specific_activity', 2, null), {
      proAktivitaetsname: new Map([['Konfitag', 5]])
    });
    expect(p.current).toBe(0);
  });
});

describe('berechneBadgeProgress: Prototype-Namen zaehlen nicht mit', () => {
  // Der Teamer-Pfad benutzte ein Plain Object als Zaehler. Eine Kategorie
  // namens "constructor" haette dort eine Funktion statt einer Zahl
  // geliefert. Der Konfi-Pfad nutzte laengst eine Map.
  it.each(['__proto__', 'constructor', 'toString'])(
    'Kategorie "%s" ohne Eintrag zaehlt 0',
    (name) => {
      const p = berechneBadgeProgress(
        badge('category_activities', 3, { required_category: name }),
        { proKategorie: new Map() }
      );
      expect(p.current).toBe(0);
    }
  );

  it('eine Kategorie, die wirklich so heisst, zaehlt normal', () => {
    const p = berechneBadgeProgress(
      badge('category_activities', 4, { required_category: 'constructor' }),
      { proKategorie: new Map([['constructor', 2]]) }
    );
    expect(p.current).toBe(2);
    expect(p.percentage).toBe(50);
  });
});

describe('berechneBadgeProgress: was die Rollen unterscheidet', () => {
  it('activity_combination zaehlt Events nur mit, wenn der Aufrufer sie liefert', () => {
    // Der Teamer-Pfad zaehlt required_events mit (wie seine Wertung), der
    // Konfi-Pfad nicht. Das ist Absicht und darf beim Zusammenlegen nicht
    // verlorengehen.
    const b = badge('activity_combination', 3, {
      required_activities: ['Konfitag'],
      required_events: ['Freizeit', 'Nachtwanderung']
    });
    const zaehler = { proAktivitaetsname: new Map([['Konfitag', 1]]) };

    const ohneEvents = berechneBadgeProgress(b, zaehler);
    expect(ohneEvents.current).toBe(1);

    const mitEvents = berechneBadgeProgress(b, {
      ...zaehler,
      erfuellteEventTitel: new Set(['Freizeit', 'Nachtwanderung'])
    });
    expect(mitEvents.current).toBe(3);
  });

  it('both_categories: null heisst "gibt es fuer diese Rolle nicht"', () => {
    // Teamer:innen haben kein Punktekonto. null unterscheidet das von einer
    // echten 0 ("hat noch keine Punkte").
    const b = badge('both_categories', 10);
    expect(berechneBadgeProgress(b, { beideKategorien: null }).current).toBe(0);
    expect(berechneBadgeProgress(b, { beideKategorien: 4 }).current).toBe(4);
  });

  it('teamer_year kommt aus dem Zaehler, nicht aus einer Rollen-Abfrage', () => {
    expect(berechneBadgeProgress(badge('teamer_year', 3), { teamerJahre: 2 }).current).toBe(2);
    expect(berechneBadgeProgress(badge('teamer_year', 3), { teamerJahre: 0 }).current).toBe(0);
  });

  it('activity_count nimmt den Zaehler, wie der Aufrufer ihn gebildet hat', () => {
    // Die Namensfalle, die den Umbau noetig machte: Beide Pfade hatten eine
    // Variable `activityCount`. Beim Konfi sind Events NICHT enthalten
    // (er addiert sie), beim Teamer schon. Der Kern darf nicht selbst
    // addieren, sonst zaehlt eine Rolle doppelt.
    const p = berechneBadgeProgress(badge('activity_count', 10), {
      aktivitaetenUndEvents: 7,
      events: 3
    });
    expect(p.current).toBe(7);
  });
});

describe('berechneBadgeProgress: time_based', () => {
  const tageHer = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

  it('zaehlt nur Daten im Zeitfenster', () => {
    const p = berechneBadgeProgress(badge('time_based', 5, { days: 30 }), {
      alleDaten: [tageHer(1), tageHer(10), tageHer(29), tageHer(31), tageHer(400)]
    });
    expect(p.current).toBe(3);
  });

  it('weeks wird in Tage umgerechnet', () => {
    const p = berechneBadgeProgress(badge('time_based', 5, { weeks: 2 }), {
      alleDaten: [tageHer(3), tageHer(13), tageHer(20)]
    });
    expect(p.current).toBe(2);
  });

  it('ohne days und weeks bleibt es bei 0', () => {
    const p = berechneBadgeProgress(badge('time_based', 5, {}), {
      alleDaten: [tageHer(1), tageHer(2)]
    });
    expect(p.current).toBe(0);
  });
});

describe('berechneBadgeProgress: unbekannte Kriterien', () => {
  it.each(['collection', 'yearly', 'gibtesnicht'])(
    '%s ergibt 0 statt eines Fehlers',
    (typ) => {
      expect(berechneBadgeProgress(badge(typ, 5), {}).current).toBe(0);
    }
  );
});

describe('bedingungFehlt', () => {
  // Ein Abzeichen ohne hinterlegte Bedingung kann niemand erreichen: Die
  // Wertung prueft genau dieses Feld. In Org 1 standen so zehn aktive
  // Abzeichen, von denen keines je vergeben wurde.
  it.each([
    ['specific_activity', {}],
    ['specific_activity', { required_activity_name: '' }],
    ['category_activities', {}],
    ['category_activities', { required_category: null }],
    ['activity_combination', {}],
    ['activity_combination', { required_activities: [] }],
    ['activity_combination', { required_activities: 'kein Array' }]
  ])('%s ohne brauchbare Bedingung ist unerreichbar', (typ, extra) => {
    expect(bedingungFehlt(badge(typ, 3, extra))).toBe(true);
  });

  it.each([
    ['specific_activity', { required_activity_name: 'Konfitag' }],
    ['category_activities', { required_category: 'Musik' }],
    ['activity_combination', { required_activities: ['A', 'B'] }]
  ])('%s mit Bedingung ist erreichbar', (typ, extra) => {
    expect(bedingungFehlt(badge(typ, 3, extra))).toBe(false);
  });

  it('unlesbares criteria_extra gilt als unerreichbar', () => {
    expect(bedingungFehlt(badge('specific_activity', 3, '{kaputt'))).toBe(true);
  });

  it('Kriterien ohne Zusatzbedingung sind nie unerreichbar', () => {
    // streak, event_count und Konsorten brauchen kein criteria_extra.
    expect(bedingungFehlt(badge('streak', 3))).toBe(false);
    expect(bedingungFehlt(badge('event_count', 3, '{kaputt'))).toBe(true);
  });
});

describe('liesCriteriaExtra', () => {
  it('nimmt ein Objekt unveraendert', () => {
    const obj = { required_category: 'Musik' };
    expect(liesCriteriaExtra(obj)).toEqual({ extra: obj, kaputt: false });
  });

  it('liest JSON-Text', () => {
    expect(liesCriteriaExtra('{"days":7}')).toEqual({ extra: { days: 7 }, kaputt: false });
  });

  it('meldet kaputten Text, statt zu werfen', () => {
    expect(liesCriteriaExtra('{kaputt')).toEqual({ extra: {}, kaputt: true });
  });

  it('null und leerer Text sind leer, aber nicht kaputt', () => {
    expect(liesCriteriaExtra(null)).toEqual({ extra: {}, kaputt: false });
    expect(liesCriteriaExtra('')).toEqual({ extra: {}, kaputt: false });
  });
});
