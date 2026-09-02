/**
 * Tests fuer die Seitenauswahl des Jahresrueckblicks (Simons Dramaturgie).
 *
 * ACHTUNG BEIM LESEN: Gruene Tests hier bewiesen bis zum 03.09.2026 GAR
 * NICHTS ueber die App -- das Modul wurde von keinem Aufrufer benutzt.
 * Der Anschluss haengt in routes/wrapped.js (generateKonfiSnapshot, Feld
 * `kacheln`). Wer diese Datei aendert, prueft mit
 *   grep -rn "waehleKacheln" backend/ --exclude-dir=tests
 * ob es den Aufrufer noch gibt.
 */

const {
  waehleKacheln,
  waehleKategorieSeiten,
  FESTE_KACHELN,
  DRAMATURGIE,
  MAX_KACHELN,
  MAX_DATUM_SEITEN,
  MAX_KATEGORIE_SEITEN
} = require('../../utils/wrappedKacheln');

/** Eine sehr aktive Konfi -- Zahlen an Produktion angelehnt (User 62, Org 4). */
const aktiverSnapshot = () => ({
  chat: { nachrichten_gesendet: 18, reaktionen_bekommen: 12 },
  challenges: { beitraege: 4, top_challenge: { title: 'Foto' } },
  challenge_momente: [{}, {}, {}],
  zeitraum: { start: '2025-09-01', ende: '2026-04-12', konfirmation: '2026-04-12' },
  kategorie: {
    verteilung: [
      { kategorie: 'Gottesdienst', count: 8, seite: 'kategorie:gottesdienst' },
      { kategorie: 'Gemeinde', count: 5, seite: 'kategorie:gemeinde' },
      { kategorie: 'Kasualien', count: 3, seite: 'kategorie:kasualien' }
    ],
    top_kategorie: 'Gottesdienst'
  },
  termine_daten: [new Date(2026, 11, 24), new Date(2026, 11, 6), new Date(2026, 3, 5)]
});

/** Eine stille Konfi: fast nichts getan. */
const stillerSnapshot = () => ({
  chat: { nachrichten_gesendet: 1 },
  challenges: { beitraege: 0, top_challenge: null },
  challenge_momente: [],
  zeitraum: { start: '2025-09-01', ende: '2026-08-31', konfirmation: null },
  kategorie: { verteilung: [], top_kategorie: null },
  termine_daten: []
});

describe('Dramaturgie', () => {
  test('die festen Seiten erscheinen immer -- auch bei einer stillen Konfi', () => {
    const kacheln = waehleKacheln(stillerSnapshot());
    for (const fest of FESTE_KACHELN) expect(kacheln).toContain(fest);
  });

  test('der Abschluss ist immer die letzte Seite', () => {
    expect(waehleKacheln(aktiverSnapshot()).slice(-1)[0]).toBe('abschluss');
    expect(waehleKacheln(stillerSnapshot()).slice(-1)[0]).toBe('abschluss');
  });

  test('das Intro ist immer die erste Seite', () => {
    expect(waehleKacheln(aktiverSnapshot())[0]).toBe('intro');
    expect(waehleKacheln(stillerSnapshot())[0]).toBe('intro');
  });

  test('die Reihenfolge folgt Simons Erzaehlung', () => {
    const kacheln = waehleKacheln(aktiverSnapshot(), { chat: 10 });
    const pos = (k) => kacheln.indexOf(k);
    // Opener - Chat - Events - Kategorie - Challenges - Punkte - Badges - Abschluss
    expect(pos('intro')).toBeLessThan(pos('chat'));
    expect(pos('chat')).toBeLessThan(pos('events'));
    expect(pos('events')).toBeLessThan(pos('challenges'));
    expect(pos('challenges')).toBeLessThan(pos('challenge-momente'));
    expect(pos('challenge-momente')).toBeLessThan(pos('punkte'));
    expect(pos('punkte')).toBeLessThan(pos('badges'));
    expect(pos('badges')).toBeLessThan(pos('abschluss'));
  });

  test('eine aktive Konfi bekommt rund zehn Seiten, keine acht', () => {
    // Simons Korrektur am alten Modell ("4 fest + 4 dynamisch, Deckel 8").
    const anzahl = waehleKacheln(aktiverSnapshot(), { chat: 10 }).length;
    expect(anzahl).toBeGreaterThanOrEqual(10);
    expect(anzahl).toBeLessThanOrEqual(MAX_KACHELN);
  });

  test('eine stille Konfi bekommt keine leeren Seiten', () => {
    // "Eine Kachel mit einer Null darauf ist keine Erinnerung."
    const kacheln = waehleKacheln(stillerSnapshot());
    expect(kacheln).not.toContain('chat');
    expect(kacheln).not.toContain('challenges');
    expect(kacheln).not.toContain('challenge-momente');
    expect(kacheln).not.toContain('konfirmation');
    expect(kacheln).toEqual(FESTE_KACHELN);
  });

  test('jede Seite kommt hoechstens einmal vor', () => {
    const kacheln = waehleKacheln(aktiverSnapshot(), { chat: 10 });
    expect(new Set(kacheln).size).toBe(kacheln.length);
  });

  test('die Obergrenze wird eingehalten, der Abschluss bleibt trotzdem', () => {
    const viel = aktiverSnapshot();
    viel.termine_daten = [
      new Date(2026, 11, 24), new Date(2026, 11, 6), new Date(2026, 3, 5),
      new Date(2027, 0, 2), new Date(2026, 6, 15), new Date(2026, 9, 4)
    ];
    const kacheln = waehleKacheln(viel, { chat: 10 });
    expect(kacheln.length).toBeLessThanOrEqual(MAX_KACHELN);
    expect(kacheln.slice(-1)[0]).toBe('abschluss');
  });
});

describe('Chat-Seite (Simons Schwelle)', () => {
  test('wer wenig geschrieben hat, bekommt keine Chat-Seite', () => {
    const s = aktiverSnapshot();
    s.chat.nachrichten_gesendet = 4;
    expect(waehleKacheln(s)).not.toContain('chat');
  });

  test('ab fuenf Nachrichten erscheint sie', () => {
    const s = aktiverSnapshot();
    s.chat.nachrichten_gesendet = 5;
    expect(waehleKacheln(s)).toContain('chat');
  });

  test('unter dem Jahrgangsschnitt gibt es die Seite nicht', () => {
    // Vergleiche nur nach oben -- niemand bekommt einen mageren Vergleich.
    const s = aktiverSnapshot();
    s.chat.nachrichten_gesendet = 8;
    expect(waehleKacheln(s, { chat: 20 })).not.toContain('chat');
    expect(waehleKacheln(s, { chat: 5 })).toContain('chat');
  });
});

describe('Kategorie- und Datums-Seiten', () => {
  test('das Datum geht vor der Kategorie', () => {
    const seiten = waehleKategorieSeiten(aktiverSnapshot());
    const erstesDatum = seiten.findIndex(s => s.startsWith('datum:'));
    const ersteKategorie = seiten.findIndex(s => s.startsWith('kategorie:'));
    expect(erstesDatum).toBeGreaterThanOrEqual(0);
    expect(erstesDatum).toBeLessThan(ersteKategorie);
  });

  test('Datums-Seiten verdraengen die Kategorie-Seiten NICHT', () => {
    // Gemessen am 03.09.2026: Mit einem gemeinsamen Deckel von 3 fielen bei
    // drei Datums-Treffern alle Kategorie-Seiten heraus -- eine Konfi mit 8
    // Gottesdiensten sah davon keinen einzigen.
    const seiten = waehleKategorieSeiten(aktiverSnapshot());
    expect(seiten.some(s => s.startsWith('datum:'))).toBe(true);
    expect(seiten.some(s => s.startsWith('kategorie:'))).toBe(true);
  });

  test('die Kontingente werden eingehalten', () => {
    const seiten = waehleKategorieSeiten(aktiverSnapshot());
    expect(seiten.filter(s => s.startsWith('datum:')).length).toBeLessThanOrEqual(MAX_DATUM_SEITEN);
    expect(seiten.filter(s => s.startsWith('kategorie:')).length).toBeLessThanOrEqual(MAX_KATEGORIE_SEITEN);
  });

  test('fremde Kategorien fallen auf die allgemeine Seite', () => {
    // Simon: "Oder es wird allgemein: deine haeufigste Kategorie."
    const s = stillerSnapshot();
    s.kategorie = {
      verteilung: [{ kategorie: 'Sonntag', count: 5, seite: null },
                   { kategorie: 'Kreativ', count: 2, seite: null }],
      top_kategorie: 'Sonntag'
    };
    // 'Kreativ' IST eine Standardkategorie, 'Sonntag' nicht.
    const seiten = waehleKategorieSeiten(s);
    expect(seiten).toContain('kategorie:kreativ');
  });

  test('nur fremde Namen -> allgemeine Seite statt gar nichts', () => {
    const s = stillerSnapshot();
    s.kategorie = {
      verteilung: [{ kategorie: 'Sonntag', count: 5 },
                   { kategorie: 'Urlauberseelsorge', count: 2 }],
      top_kategorie: 'Sonntag'
    };
    expect(waehleKategorieSeiten(s)).toEqual(['kategorie-allgemein']);
  });

  test('eine geloeschte Kategorie bricht den Rueckblick nicht', () => {
    // Loescht eine Gemeinde eine Kategorie, verschwinden nur die
    // Zuordnungen (ON DELETE CASCADE). Der Snapshot ist dann leerer, aber
    // gueltig -- die Seite erscheint schlicht nicht.
    const s = aktiverSnapshot();
    s.kategorie = { verteilung: [], top_kategorie: null };
    const kacheln = waehleKacheln(s);
    expect(kacheln.some(k => k.startsWith('kategorie:'))).toBe(false);
    expect(kacheln).toContain('abschluss');
    expect(kacheln.length).toBeGreaterThanOrEqual(FESTE_KACHELN.length);
  });

  test('Teamtreff erscheint nicht im Konfi-Rueckblick', () => {
    const s = stillerSnapshot();
    s.kategorie = {
      verteilung: [{ kategorie: 'Teamtreff', count: 4 }],
      top_kategorie: 'Teamtreff'
    };
    expect(waehleKategorieSeiten(s)).not.toContain('kategorie:teamtreff');
  });
});

describe('Robustheit', () => {
  test('kaputte Eingaben liefern die feste Dramaturgie statt eines Fehlers', () => {
    expect(waehleKacheln(null)).toEqual(FESTE_KACHELN);
    expect(waehleKacheln(undefined)).toEqual(FESTE_KACHELN);
    expect(() => waehleKacheln({})).not.toThrow();
    expect(waehleKacheln({})).toEqual(FESTE_KACHELN);
  });

  test('kaputte Termindaten kippen nicht den ganzen Rueckblick', () => {
    const s = aktiverSnapshot();
    s.termine_daten = ['kein datum', null, undefined, new Date(2026, 11, 24)];
    const kacheln = waehleKacheln(s);
    expect(kacheln).toContain('datum:weihnachten');
    expect(kacheln).toContain('abschluss');
  });

  test('jede Seite der Dramaturgie ist erreichbar', () => {
    // Verhindert, dass ein Tippfehler in DRAMATURGIE eine Seite still
    // unerreichbar macht.
    const s = aktiverSnapshot();
    const kacheln = waehleKacheln(s, { chat: 1 });
    const erwartet = DRAMATURGIE.filter(k => k !== 'kategorie');
    for (const k of erwartet) expect(kacheln).toContain(k);
  });
});
