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
  waehleTeamerKacheln,
  FESTE_TEAMER_KACHELN,
  TEAMER_DRAMATURGIE,
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
  aktivster_monat: { monat: 12, monat_name: 'Dezember', aktivitaeten: 5 },
  badges: {
    total_earned: 7,
    seltenstes: { name: 'Bonuspunkte-Gewinner', icon: 'trophy', color: '#f59e0b',
                  haben_es: 5, konfis: 13, prozent: 38 }
  },
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
  aktivster_monat: { monat: 0, monat_name: '', aktivitaeten: 0 },
  zeitraum: { start: '2025-09-01', ende: '2026-08-31', konfirmation: null },
  kategorie: { verteilung: [], top_kategorie: null },
  termine_daten: []
});

describe('Dramaturgie', () => {
  test('die festen Seiten erscheinen immer -- auch bei einer stillen Konfi', () => {
    const kacheln = waehleKacheln(stillerSnapshot());
    for (const fest of FESTE_KACHELN) expect(kacheln).toContain(fest);
  });

  test('die Einladung ins Team ist immer die letzte Seite', () => {
    // GEAENDERT AM 03.09.2026: Simon wollte "eine letzte Seite bei Konfis:
    // Werde Teamerin". Sie steht NACH dem Abschluss -- erst der Rueckblick,
    // dann der Blick nach vorn.
    expect(waehleKacheln(aktiverSnapshot()).slice(-1)[0]).toBe('werde-teamer');
    expect(waehleKacheln(stillerSnapshot()).slice(-1)[0]).toBe('werde-teamer');
  });

  test('der Abschluss steht direkt davor', () => {
    const k = waehleKacheln(aktiverSnapshot());
    expect(k[k.length - 2]).toBe('abschluss');
  });

  test('das Intro ist immer die erste Seite', () => {
    expect(waehleKacheln(aktiverSnapshot())[0]).toBe('intro');
    expect(waehleKacheln(stillerSnapshot())[0]).toBe('intro');
  });

  test('die Reihenfolge folgt Simons Erzaehlung', () => {
    const kacheln = waehleKacheln(aktiverSnapshot(), { chat: 10 });
    const pos = (k) => kacheln.indexOf(k);
    // Opener - Events - Kategorie - Challenges - Punkte - Badges - Abschluss
    expect(pos('intro')).toBeLessThan(pos('events'));
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
    expect(kacheln).not.toContain('challenges');
    expect(kacheln).not.toContain('aktivster-monat');
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
    // Abschluss und Einladung ueberleben den Deckel immer.
    expect(kacheln.slice(-2)).toEqual(['abschluss', 'werde-teamer']);
  });
});

// DIE CHAT-SEITE GAB ES NIE (Befund 06.09.2026): 'chat' stand in der
// DRAMATURGIE und hatte hier drei gruene Tests -- im Frontend gab es aber
// weder einen Renderer noch ueberhaupt eine Chat-Komponente. Die Seite
// wurde ausgewaehlt und blieb leer. Die Tests bewiesen nur, dass die
// Auswahl funktioniert, nicht dass irgendjemand die Seite je sah.
//
// Der Schluessel ist ersatzlos gestrichen: Die Chat-Zahlen haben bereits
// eine Seite (das persoenliche Highlight 'chat_star' / 'reaktions_magnet').
// Damit entfallen die drei Tests hier -- eine Schwelle fuer eine Seite, die
// es nicht gibt, ist nichts, was man pruefen kann.

describe('Challenges-Seite (Simons Schwelle)', () => {
  test('wer nie mitgemacht hat, bekommt keine Challenges-Seite', () => {
    const s = aktiverSnapshot();
    s.challenges.beitraege = 0;
    expect(waehleKacheln(s)).not.toContain('challenges');
  });

  test('ab dem ersten Beitrag erscheint sie', () => {
    const s = aktiverSnapshot();
    s.challenges.beitraege = 1;
    expect(waehleKacheln(s)).toContain('challenges');
  });
});

describe('Aktivster Monat (Zeit-/Rhythmus-Seite)', () => {
  // BEFUND 06.09.2026: Die Komponente, der Renderer und die Daten
  // (slides.aktivster_monat) gab es laengst -- nur stand 'aktivster-monat'
  // nicht in der DRAMATURGIE. Seit Version 3 das Backend die Seiten waehlt,
  // wurde die Seite deshalb NIE mehr gezeigt; allein der v2-Fallback im
  // Frontend kannte sie noch. Eine fertige Seite, die niemand je zu sehen
  // bekam.

  test('die Seite steht zwischen Punkten und Abzeichen', () => {
    const kacheln = waehleKacheln(aktiverSnapshot());
    const pos = (k) => kacheln.indexOf(k);
    expect(pos('punkte')).toBeLessThan(pos('aktivster-monat'));
    expect(pos('aktivster-monat')).toBeLessThan(pos('badges'));
  });

  test('ab zwei Aktivitaeten im Monat erscheint sie', () => {
    const s = aktiverSnapshot();
    s.aktivster_monat = { monat: 3, monat_name: 'Maerz', aktivitaeten: 2 };
    expect(waehleKacheln(s)).toContain('aktivster-monat');
  });

  test('bei einer einzigen Aktivitaet gibt es die Seite nicht', () => {
    // "Dein aktivster Monat: 1 Aktivitaet" ist keine Aussage ueber einen
    // Rhythmus, sondern der Monat, in dem zufaellig das Einzige stattfand.
    const s = aktiverSnapshot();
    s.aktivster_monat = { monat: 3, monat_name: 'Maerz', aktivitaeten: 1 };
    expect(waehleKacheln(s)).not.toContain('aktivster-monat');
  });

  test('ohne jede Aktivitaet gibt es die Seite nicht', () => {
    const s = aktiverSnapshot();
    s.aktivster_monat = { monat: 0, monat_name: '', aktivitaeten: 0 };
    expect(waehleKacheln(s)).not.toContain('aktivster-monat');
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

describe('Das seltenste Abzeichen (Simons Idee)', () => {
  test('erscheint, wenn das Backend eines bestimmt hat', () => {
    expect(waehleKacheln(aktiverSnapshot(), { chat: 1 })).toContain('seltenstes');
  });

  test('erscheint NICHT ohne bestimmtes Abzeichen', () => {
    // Das Backend liefert null, wenn die Gemeinde weniger als 5 Konfis hat --
    // "50 %" bei zwei Personen waere eine Zahl ohne Aussage.
    const s = aktiverSnapshot();
    s.badges = { total_earned: 7, seltenstes: null };
    expect(waehleKacheln(s, { chat: 1 })).not.toContain('seltenstes');
  });

  test('steht direkt nach der Badges-Seite', () => {
    // Die Reihenfolge traegt die Erzaehlung: erst die Sammlung, dann das
    // Besondere daraus.
    const kacheln = waehleKacheln(aktiverSnapshot(), { chat: 1 });
    expect(kacheln.indexOf('seltenstes')).toBe(kacheln.indexOf('badges') + 1);
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
    // 'kategorie' ist ein Platzhalter, 'konfirmation' braucht einen Termin --
    // beide werden in eigenen Tests geprueft.
    const erwartet = DRAMATURGIE.filter(k => k !== 'kategorie' && k !== 'konfirmation');
    for (const k of erwartet) expect(kacheln).toContain(k);
  });
});

// ====================================================================
// DER TEAMER-RUECKBLICK
// ====================================================================
//
// BEFUND 06.09.2026: Der Teamer-Rueckblick hatte SIEBEN fest verdrahtete
// Seiten ohne jede Bedingung -- das Handbuch hielt das sogar ausdruecklich
// fest ("immer genau sieben Seiten, ohne Bedingungen"). Simons Grundregel
// "Eine Kachel mit einer Null darauf ist keine Erinnerung" galt damit fuer
// Konfis, aber nicht fuers Team: Wer neu dabei war, bekam "0 Abzeichen",
// "0 Zertifikate" und "0 Konfis" als eigene Seiten hintereinander.

/** Eine erfahrene Teamer:in -- ueberall etwas vorzuweisen. */
const aktiverTeamer = () => ({
  events_geleitet: { total: 12, meiste_teilnehmer_event: { name: 'Konfifahrt', count: 24 } },
  konfis_betreut: { total_konfis: 13, jahrgaenge: ['2025/2026'] },
  badges: { total_earned: 4, badges: [{ name: 'Fleissig' }] },
  zertifikate: { total: 2, zertifikate: [{ name: 'Juleica' }] },
  engagement: { teamer_seit: '2021-09-01', jahre_aktiv: 4 },
  zeitraum: { year: 2026, start: '2025-09-01', ende: '2026-08-31' }
});

/** Neu im Team: erstes Jahr, noch nichts gesammelt. */
const neuerTeamer = () => ({
  events_geleitet: { total: 0, meiste_teilnehmer_event: null },
  konfis_betreut: { total_konfis: 0, jahrgaenge: [] },
  badges: { total_earned: 0, badges: [] },
  zertifikate: { total: 0, zertifikate: [] },
  engagement: { teamer_seit: null, jahre_aktiv: 0 },
  zeitraum: { year: 2026, start: '2025-09-01', ende: '2026-08-31' }
});

describe('Teamer-Dramaturgie', () => {
  test('eine erfahrene Teamer:in bekommt alle sieben Seiten', () => {
    expect(waehleTeamerKacheln(aktiverTeamer())).toEqual([
      'teamer-intro',
      'teamer-events',
      'teamer-konfis',
      'teamer-badges',
      'teamer-zertifikate',
      'teamer-jahre',
      'teamer-abschluss'
    ]);
  });

  test('eine neue Teamer:in bekommt keine Seite mit einer Null darauf', () => {
    // Genau der Befund: frueher standen hier sieben Seiten, fuenf davon
    // mit einer Null.
    const kacheln = waehleTeamerKacheln(neuerTeamer());
    expect(kacheln).toEqual(['teamer-intro', 'teamer-abschluss']);
  });

  test('die festen Seiten erscheinen immer', () => {
    for (const fest of FESTE_TEAMER_KACHELN) {
      expect(waehleTeamerKacheln(neuerTeamer())).toContain(fest);
    }
  });

  test('ohne Termine faellt die Termin-Seite weg', () => {
    const t = aktiverTeamer();
    t.events_geleitet = { total: 0, meiste_teilnehmer_event: null };
    expect(waehleTeamerKacheln(t)).not.toContain('teamer-events');
  });

  test('ohne betreute Konfis faellt die Konfi-Seite weg', () => {
    const t = aktiverTeamer();
    t.konfis_betreut = { total_konfis: 0, jahrgaenge: [] };
    expect(waehleTeamerKacheln(t)).not.toContain('teamer-konfis');
  });

  test('ohne Abzeichen faellt die Abzeichen-Seite weg', () => {
    const t = aktiverTeamer();
    t.badges = { total_earned: 0, badges: [] };
    expect(waehleTeamerKacheln(t)).not.toContain('teamer-badges');
  });

  test('ohne Zertifikate faellt die Zertifikats-Seite weg', () => {
    const t = aktiverTeamer();
    t.zertifikate = { total: 0, zertifikate: [] };
    expect(waehleTeamerKacheln(t)).not.toContain('teamer-zertifikate');
  });

  test('ohne Eintrittsdatum faellt die Jahre-Seite weg', () => {
    // Diese Pruefung stand bisher im Frontend -- eine Bedingung an der
    // falschen Stelle. Ohne teamer_since rechnet das Backend 0 Jahre, und
    // "0 Jahre als Teamer:in" ist eine Aussage ueber eine fehlende Angabe,
    // nicht ueber die Person.
    const t = aktiverTeamer();
    t.engagement = { teamer_seit: null, jahre_aktiv: 0 };
    expect(waehleTeamerKacheln(t)).not.toContain('teamer-jahre');
  });

  test('das Intro ist erste, der Abschluss letzte Seite', () => {
    for (const snap of [aktiverTeamer(), neuerTeamer()]) {
      const k = waehleTeamerKacheln(snap);
      expect(k[0]).toBe('teamer-intro');
      expect(k[k.length - 1]).toBe('teamer-abschluss');
    }
  });

  test('jede Seite kommt hoechstens einmal vor', () => {
    const k = waehleTeamerKacheln(aktiverTeamer());
    expect(new Set(k).size).toBe(k.length);
  });

  test('kaputte Daten liefern trotzdem einen Rueckblick', () => {
    // Ein Rueckblick, der gar nicht erst entsteht, ist schlimmer als einer
    // mit wenigen Seiten.
    expect(waehleTeamerKacheln(null)).toEqual([...FESTE_TEAMER_KACHELN]);
    expect(waehleTeamerKacheln(undefined)).toEqual([...FESTE_TEAMER_KACHELN]);
    expect(waehleTeamerKacheln({})).toEqual([...FESTE_TEAMER_KACHELN]);
  });

  test('jede Seite der Teamer-Dramaturgie ist erreichbar', () => {
    // Verhindert, dass ein Tippfehler eine Seite still unerreichbar macht --
    // derselbe Waechter wie bei den Konfis.
    const kacheln = waehleTeamerKacheln(aktiverTeamer());
    for (const k of TEAMER_DRAMATURGIE) expect(kacheln).toContain(k);
  });
});
