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
  GESCHUETZTE_KACHELN,
  ZEIT_SEITEN,
  MAX_ZEIT_SEITEN,
  MAX_DATUM_SEITEN,
  MAX_KATEGORIE_SEITEN,
  BEDINGUNGEN
} = require('../../utils/wrappedKacheln');

/** Eine sehr aktive Konfi -- Zahlen an Produktion angelehnt (User 62, Org 4). */
const aktiverSnapshot = () => ({
  chat: { nachrichten_gesendet: 18, reaktionen_bekommen: 12 },
  challenges: { beitraege: 4, top_challenge: { title: 'Foto' } },
  challenge_momente: [{}, {}, {}],
  aktivster_monat: { monat: 12, monat_name: 'Dezember', aktivitaeten: 5 },
  warteliste: { nachgerueckt: 2 },
  langer_atem: { erster: '2025-09-14', letzter: '2026-04-12', tage: 210, termine: 9 },
  wochentag: { tag: 0, name: 'Sonntag', anzahl: 6, gesamt: 9, anteil: 67 },
  medienarten: ['photo', 'text'],
  // Die drei Zahl-Seiten. Sie standen bis zum 07.09.2026 in FESTE_KACHELN
  // und brauchten deshalb keine Werte in dieser Fixture -- sie erschienen
  // ohnehin. Seit sie Bedingungen haben, muss die Fixture sagen, was diese
  // Konfi getan hat.
  events: { total_attended: 9, total_available: 14, lieblings_event: null, abgesagt: 0 },
  punkte: { gottesdienst: 12, gemeinde: 9, total: 21, bonus: 0 },
  badges: {
    total_earned: 7,
    total_available: 55,
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

/**
 * Eine stille Konfi: fast nichts getan. Sie hat NULL Termine, NULL Punkte
 * und NULL Abzeichen -- genau der Fall, der bis zum 07.09.2026 drei Seiten
 * mit einer Null darauf erzeugte.
 */
const stillerSnapshot = () => ({
  chat: { nachrichten_gesendet: 1 },
  events: { total_attended: 0, total_available: 14, lieblings_event: null, abgesagt: 0 },
  punkte: { gottesdienst: 0, gemeinde: 0, total: 0, bonus: 0 },
  badges: { total_earned: 0, total_available: 55, seltenstes: null },
  challenges: { beitraege: 0, top_challenge: null },
  challenge_momente: [],
  aktivster_monat: { monat: 0, monat_name: '', aktivitaeten: 0 },
  warteliste: { nachgerueckt: 0 },
  langer_atem: null,
  wochentag: null,
  medienarten: [],
  zeitraum: { start: '2025-09-01', ende: '2026-08-31', konfirmation: null },
  kategorie: { verteilung: [], top_kategorie: null },
  termine_daten: []
});

describe('Keine Seite mit einer Null darauf', () => {
  // BEFUND 07.09.2026, gemessen an Produktion (Org 1, Jahrgang 2026/27):
  // Eine echte Konfi bekam eine Abzeichen-Seite mit "0 von 55" darauf. Ihr
  // Jahrgang hat einen Konfirmationstermin im Mai 2027, der Zeitraum beginnt
  // deshalb am 01.09.2026 -- ihre 20 Abzeichen aus dem Sommer 2026 liegen
  // davor und fallen heraus. 'badges' stand in FESTE_KACHELN und hatte
  // keine Bedingung.
  //
  // Simons Grundregel steht im Kopf von wrappedKacheln.js: "Eine Kachel mit
  // einer Null darauf ist keine Erinnerung."

  test('die Abzeichen-Seite faellt weg, wenn im Zeitraum keine verdient wurden', () => {
    const s = aktiverSnapshot();
    s.badges = { total_earned: 0, total_available: 55, seltenstes: null };
    expect(waehleKacheln(s)).not.toContain('badges');
  });

  test('die Abzeichen-Seite erscheint schon beim ersten Abzeichen', () => {
    const s = aktiverSnapshot();
    s.badges = { total_earned: 1, total_available: 55, seltenstes: null };
    expect(waehleKacheln(s)).toContain('badges');
  });

  test('die Punkte-Seite faellt bei null Punkten weg, erscheint ab einem', () => {
    const ohne = aktiverSnapshot();
    ohne.punkte = { gottesdienst: 0, gemeinde: 0, total: 0, bonus: 0 };
    expect(waehleKacheln(ohne)).not.toContain('punkte');

    const mit = aktiverSnapshot();
    mit.punkte = { gottesdienst: 1, gemeinde: 0, total: 1, bonus: 0 };
    expect(waehleKacheln(mit)).toContain('punkte');
  });

  test('die Termin-Seite faellt bei null Terminen weg, erscheint ab einem', () => {
    const ohne = aktiverSnapshot();
    ohne.events = { total_attended: 0, total_available: 14, lieblings_event: null, abgesagt: 0 };
    expect(waehleKacheln(ohne)).not.toContain('events');

    const mit = aktiverSnapshot();
    mit.events = { total_attended: 1, total_available: 14, lieblings_event: null, abgesagt: 0 };
    expect(waehleKacheln(mit)).toContain('events');
  });

  test('eine Konfi ohne jede Zahl bekommt genau die drei tragenden Seiten', () => {
    // Kein leerer Rueckblick, aber auch keine drei Nullen: Intro (Name und
    // Jahrgang), Abschluss (Simons Botschaft) und die Einladung ins Team
    // (reiner Text) koennen gar keine Null tragen.
    expect(waehleKacheln(stillerSnapshot())).toEqual(['intro', 'abschluss', 'werde-teamer']);
  });

  test('fehlende slides ergeben denselben Mindestrueckblick', () => {
    expect(waehleKacheln(null)).toEqual(['intro', 'abschluss', 'werde-teamer']);
    expect(waehleKacheln({})).toEqual(['intro', 'abschluss', 'werde-teamer']);
  });

  test('keine der drei Zahl-Seiten steht noch bedingungslos in FESTE_KACHELN', () => {
    for (const zahlseite of ['events', 'punkte', 'badges']) {
      expect(FESTE_KACHELN).not.toContain(zahlseite);
      expect(Object.keys(BEDINGUNGEN)).toContain(zahlseite);
    }
  });

  test('die drei Zahl-Seiten bleiben trotzdem vor dem Deckel geschuetzt', () => {
    // Sie haben jetzt Bedingungen -- aber WENN sie etwas zu erzaehlen haben,
    // darf der Deckel sie nicht fressen. Genau das war der Befund vom
    // 07.09.2026 ("Der Deckel darf keine feste Seite fressen").
    for (const zahlseite of ['events', 'punkte', 'badges']) {
      expect(GESCHUETZTE_KACHELN).toContain(zahlseite);
    }
  });

  test('bei voller Dramaturgie ueberleben die Zahl-Seiten den Deckel', () => {
    const s = aktiverSnapshot();
    const kacheln = waehleKacheln(s, { chat: 1, events: 1 });
    expect(kacheln.length).toBeLessThanOrEqual(MAX_KACHELN);
    for (const zahlseite of ['events', 'punkte', 'badges']) {
      expect(kacheln, `${zahlseite} wurde weggekuerzt`).toContain(zahlseite);
    }
  });
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
    expect(kacheln).not.toContain('warteliste');
    expect(kacheln).not.toContain('langer-atem');
    expect(kacheln).not.toContain('wochentag');
    expect(kacheln).not.toContain('vielseitig');
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

describe('Der Deckel', () => {
  test('kuerzt niemals eine feste oder geschuetzte Seite weg', () => {
    // BEFUND 07.09.2026: Der Deckel schnitt positionsweise ab. Alles WEIT
    // HINTEN in der Dramaturgie fiel zuerst heraus -- erst 'badges' (fest),
    // dann 'seltenstes' und 'konfirmation'. Genau die Seiten, die eine
    // Konfi sich verdienen muss, verschwanden zugunsten einer weiteren
    // Kategorie-Kachel.
    const s = aktiverSnapshot();
    // Ein Maximalfall: viele Datums-Treffer, alles andere trifft auch zu.
    s.termine_daten = [
      new Date(2026, 11, 24), new Date(2026, 11, 6), new Date(2026, 3, 5),
      new Date(2027, 0, 2), new Date(2026, 6, 15), new Date(2026, 9, 4)
    ];
    const kacheln = waehleKacheln(s, { chat: 10 });
    expect(kacheln.length).toBeLessThanOrEqual(MAX_KACHELN);
    for (const fest of FESTE_KACHELN) {
      expect(kacheln, `${fest} wurde weggekuerzt`).toContain(fest);
    }
    for (const geschuetzt of GESCHUETZTE_KACHELN) {
      // Nur pruefen, was bei diesem Snapshot ueberhaupt zutrifft.
      if (geschuetzt === 'seltenstes' && !s.badges?.seltenstes?.name) continue;
      if (geschuetzt === 'konfirmation' && !s.zeitraum?.konfirmation) continue;
      expect(kacheln, `${geschuetzt} wurde weggekuerzt`).toContain(geschuetzt);
    }
  });
});

describe('Warteliste-Held:in', () => {
  test('wer nachgerueckt ist, bekommt die Seite', () => {
    expect(waehleKacheln(aktiverSnapshot())).toContain('warteliste');
  });

  test('ohne Nachruecken gibt es die Seite nicht', () => {
    const s = aktiverSnapshot();
    s.warteliste = { nachgerueckt: 0 };
    expect(waehleKacheln(s)).not.toContain('warteliste');
  });

  test('ein fehlendes Feld (Alt-Snapshot) ergibt keine Seite', () => {
    // Alt-Snapshots kennen 'warteliste' nicht -- sie duerfen davon nicht
    // ploetzlich eine Seite bekommen.
    const s = aktiverSnapshot();
    delete s.warteliste;
    expect(waehleKacheln(s)).not.toContain('warteliste');
  });
});

describe('Der lange Atem', () => {
  test('ab fuenf Terminen und genug Spanne erscheint die Seite', () => {
    expect(waehleKacheln(aktiverSnapshot())).toContain('langer-atem');
  });

  test('bei vier Terminen gibt es die Seite nicht', () => {
    // Zwei Termine im September und im Mai waeren rechnerisch auch 240 Tage
    // -- die Zahl erzaehlte dann das Gegenteil von "durchgehend dabei".
    const s = aktiverSnapshot();
    s.langer_atem = { erster: '2025-09-14', letzter: '2026-04-12', tage: 210, termine: 4 };
    expect(waehleKacheln(s)).not.toContain('langer-atem');
  });

  test('bei kurzer Spanne gibt es die Seite nicht', () => {
    const s = aktiverSnapshot();
    s.langer_atem = { erster: '2026-03-01', letzter: '2026-03-20', tage: 19, termine: 9 };
    expect(waehleKacheln(s)).not.toContain('langer-atem');
  });
});

describe('Dein Wochentag', () => {
  test('ein klar herausstechender Tag bekommt eine Seite', () => {
    // Die Zeit-Seiten teilen sich ein Kontingent von zwei; fuer diese
    // Pruefung stehen die beiden anderen still.
    const s = aktiverSnapshot();
    s.aktivster_monat = { monat: 0, monat_name: '', aktivitaeten: 0 };
    s.langer_atem = null;
    expect(waehleKacheln(s)).toContain('wochentag');
  });

  test('unter der Haelfte aller Termine gibt es die Seite nicht', () => {
    // Sonst waere "dein Wochentag" nur der Tag, der zufaellig einmal
    // oefter vorkam.
    const s = aktiverSnapshot();
    s.wochentag = { tag: 0, name: 'Sonntag', anzahl: 4, gesamt: 12, anteil: 33 };
    expect(waehleKacheln(s)).not.toContain('wochentag');
  });

  test('unter vier Terminen an dem Tag gibt es die Seite nicht', () => {
    const s = aktiverSnapshot();
    s.wochentag = { tag: 0, name: 'Sonntag', anzahl: 3, gesamt: 4, anteil: 75 };
    expect(waehleKacheln(s)).not.toContain('wochentag');
  });
});

describe('Kontingent der Zeit-/Rhythmus-Seiten', () => {
  test('hoechstens zwei Zeit-Seiten, auch wenn alle drei zutreffen', () => {
    // Drei Seiten, die alle "wann warst du da" beantworten, sind keine
    // Erzaehlung mehr, sondern eine Statistik.
    const k = waehleKacheln(aktiverSnapshot(), { chat: 10 });
    const zeit = k.filter(x => ZEIT_SEITEN.includes(x));
    expect(zeit.length).toBeLessThanOrEqual(MAX_ZEIT_SEITEN);
    expect(zeit.length).toBe(2);
  });

  test('die Reihenfolge der Dramaturgie entscheidet, welche zwei', () => {
    const k = waehleKacheln(aktiverSnapshot(), { chat: 10 });
    expect(k.filter(x => ZEIT_SEITEN.includes(x))).toEqual(['aktivster-monat', 'langer-atem']);
  });
});

describe('Der Vielseitige', () => {
  test('ab zwei Medienarten erscheint die Seite', () => {
    // BEWUSST 2 statt 3: allowed_media steht per Default auf
    // ["text","photo"] -- Audio ist oft gar nicht erlaubt.
    expect(waehleKacheln(aktiverSnapshot())).toContain('vielseitig');
  });

  test('bei nur einer Medienart gibt es die Seite nicht', () => {
    const s = aktiverSnapshot();
    s.medienarten = ['text'];
    expect(waehleKacheln(s)).not.toContain('vielseitig');
  });

  test('ohne Beitraege gibt es die Seite nicht', () => {
    const s = aktiverSnapshot();
    s.medienarten = [];
    expect(waehleKacheln(s)).not.toContain('vielseitig');
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
    // 'kategorie' ist ein Platzhalter, 'konfirmation' braucht einen Termin --
    // beide werden in eigenen Tests geprueft.
    const erwartet = DRAMATURGIE.filter(k => k !== 'kategorie' && k !== 'konfirmation');

    // EINZELN geprueft, nicht in einem Durchlauf: Die drei
    // Zeit-/Rhythmus-Seiten teilen sich ein Kontingent (MAX_ZEIT_SEITEN),
    // es koennen also nie alle drei zugleich erscheinen. Ein einzelner
    // Durchlauf wuerde deshalb faelschlich melden, eine davon sei
    // unerreichbar. Die Frage hier ist "kommt die Seite ueberhaupt vor",
    // und die beantwortet man je Seite.
    for (const k of erwartet) {
      const s = aktiverSnapshot();
      // Die anderen Zeit-Seiten stumm schalten, damit das Kontingent nicht
      // die gerade gepruefte verdraengt.
      if (ZEIT_SEITEN.includes(k)) {
        if (k !== 'aktivster-monat') s.aktivster_monat = { monat: 0, monat_name: '', aktivitaeten: 0 };
        if (k !== 'langer-atem') s.langer_atem = null;
        if (k !== 'wochentag') s.wochentag = null;
      }
      expect(waehleKacheln(s, { chat: 1 }), `${k} ist unerreichbar`).toContain(k);
    }
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
  anfang: { name: 'Konfifahrt', datum: '2025-09-20' },
  erstes_abzeichen: { name: 'Mutig', icon: 'flame', color: '#f00', datum: '2025-10-01' },
  team: { mitstreitende: 5 },
  moderation: { freigegeben: 18 },
  neu_dabei: { erstes_jahr: false, start_jahr: 2021 },
  chat: { antworten: 22 },
  konfi_zeit: { jahrgang: '2019/2020' },
  zeitraum: { year: 2026, start: '2025-09-01', ende: '2026-08-31' }
});

/** Neu im Team: erstes Jahr, noch nichts gesammelt. */
const neuerTeamer = () => ({
  events_geleitet: { total: 0, meiste_teilnehmer_event: null },
  konfis_betreut: { total_konfis: 0, jahrgaenge: [] },
  badges: { total_earned: 0, badges: [] },
  zertifikate: { total: 0, zertifikate: [] },
  engagement: { teamer_seit: null, jahre_aktiv: 0 },
  anfang: null,
  erstes_abzeichen: null,
  team: { mitstreitende: 0 },
  moderation: { freigegeben: 0 },
  neu_dabei: { erstes_jahr: false, start_jahr: null },
  chat: { antworten: 0 },
  konfi_zeit: null,
  zeitraum: { year: 2026, start: '2025-09-01', ende: '2026-08-31' }
});

describe('Teamer-Dramaturgie', () => {
  test('eine erfahrene Teamer:in bekommt alle sieben Seiten', () => {
    expect(waehleTeamerKacheln(aktiverTeamer())).toEqual([
      'teamer-intro',
      'teamer-anfang',
      'teamer-events',
      'teamer-konfis',
      'teamer-team',
      'teamer-badges',
      'teamer-erstes-abzeichen',
      'teamer-zertifikate',
      'teamer-moderation',
      'teamer-antworten',
      'teamer-jahre',
      'teamer-konfi-zeit',
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

  test('der Anfang steht VOR der Termin-Gesamtzahl', () => {
    // Erst der Moment, dann die Bilanz.
    const k = waehleTeamerKacheln(aktiverTeamer());
    expect(k.indexOf('teamer-anfang')).toBeLessThan(k.indexOf('teamer-events'));
  });

  test('ohne ersten Termin gibt es die Anfang-Seite nicht', () => {
    const t = aktiverTeamer();
    t.anfang = null;
    expect(waehleTeamerKacheln(t)).not.toContain('teamer-anfang');
  });

  test('das erste Abzeichen steht direkt nach der Abzeichen-Seite', () => {
    const k = waehleTeamerKacheln(aktiverTeamer());
    expect(k.indexOf('teamer-badges') + 1).toBe(k.indexOf('teamer-erstes-abzeichen'));
  });

  test('ohne Abzeichen gibt es auch die Erstes-Abzeichen-Seite nicht', () => {
    const t = aktiverTeamer();
    t.badges = { total_earned: 0, badges: [] };
    t.erstes_abzeichen = null;
    const k = waehleTeamerKacheln(t);
    expect(k).not.toContain('teamer-badges');
    expect(k).not.toContain('teamer-erstes-abzeichen');
  });

  test('ab fuenf Freigaben erscheint die Moderations-Seite', () => {
    const t = aktiverTeamer();
    t.moderation = { freigegeben: 5 };
    expect(waehleTeamerKacheln(t)).toContain('teamer-moderation');
  });

  test('bei vier Freigaben gibt es die Seite nicht', () => {
    const t = aktiverTeamer();
    t.moderation = { freigegeben: 4 };
    expect(waehleTeamerKacheln(t)).not.toContain('teamer-moderation');
  });

  test('das Team steht direkt nach den Konfis', () => {
    const k = waehleTeamerKacheln(aktiverTeamer());
    expect(k.indexOf('teamer-konfis') + 1).toBe(k.indexOf('teamer-team'));
  });

  test('ohne Mitstreitende gibt es die Team-Seite nicht', () => {
    const t = aktiverTeamer();
    t.team = { mitstreitende: 0 };
    expect(waehleTeamerKacheln(t)).not.toContain('teamer-team');
  });

  test('im ersten Jahr erscheint "Neu dabei" -- und NICHT "seit x Jahren"', () => {
    // Beide zugleich waeren dieselbe Auskunft zweimal, einmal mit einer 1.
    const t = aktiverTeamer();
    t.neu_dabei = { erstes_jahr: true, start_jahr: 2026 };
    const k = waehleTeamerKacheln(t);
    expect(k).toContain('teamer-neu-dabei');
    expect(k).not.toContain('teamer-jahre');
  });

  test('ab dem zweiten Jahr ist es umgekehrt', () => {
    const k = waehleTeamerKacheln(aktiverTeamer());
    expect(k).toContain('teamer-jahre');
    expect(k).not.toContain('teamer-neu-dabei');
  });

  test('ohne bekanntes Startjahr gibt es "Neu dabei" NICHT', () => {
    // "Unbekannt" ist nicht "neu": Wer seit Jahren dabei ist, aber kein
    // Eintrittsdatum hinterlegt hat, darf nicht als Neuling begruesst
    // werden.
    const t = aktiverTeamer();
    t.engagement = { teamer_seit: null, jahre_aktiv: 0 };
    t.neu_dabei = { erstes_jahr: false, start_jahr: null };
    const k = waehleTeamerKacheln(t);
    expect(k).not.toContain('teamer-neu-dabei');
    expect(k).not.toContain('teamer-jahre');
  });

  test('ab fuenf Antworten erscheint die Antworten-Seite', () => {
    const t = aktiverTeamer();
    t.chat = { antworten: 5 };
    expect(waehleTeamerKacheln(t)).toContain('teamer-antworten');
  });

  test('bei vier Antworten gibt es die Seite nicht', () => {
    // Eine Handvoll Antworten ist noch keine Geschichte.
    const t = aktiverTeamer();
    t.chat = { antworten: 4 };
    expect(waehleTeamerKacheln(t)).not.toContain('teamer-antworten');
  });

  test('wer selbst Konfi war, bekommt die Seite "Wie alles anfing"', () => {
    expect(waehleTeamerKacheln(aktiverTeamer())).toContain('teamer-konfi-zeit');
  });

  test('wer von aussen ins Team kam, bekommt sie NICHT', () => {
    // Eine erfundene Herkunft waere schlimmer als gar keine Seite.
    const t = aktiverTeamer();
    t.konfi_zeit = null;
    expect(waehleTeamerKacheln(t)).not.toContain('teamer-konfi-zeit');
  });

  test('die Konfi-Zeit steht nach den Jahren und vor dem Abschluss', () => {
    // Erst wie lange du dabei bist, dann wie es angefangen hat -- der
    // Rueckblick klingt auf dem persoenlichsten Punkt aus.
    const k = waehleTeamerKacheln(aktiverTeamer());
    expect(k.indexOf('teamer-jahre')).toBeLessThan(k.indexOf('teamer-konfi-zeit'));
    expect(k.indexOf('teamer-konfi-zeit')).toBeLessThan(k.indexOf('teamer-abschluss'));
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
    //
    // EINZELN geprueft: 'teamer-neu-dabei' und 'teamer-jahre' schliessen
    // einander AUS (erstes Jahr gegen "seit x Jahren"). In einem einzigen
    // Durchlauf koennen sie nie beide vorkommen -- ein solcher Test wuerde
    // faelschlich melden, eine davon sei unerreichbar. Die Frage hier ist
    // "kommt die Seite ueberhaupt vor", und die beantwortet man je Seite.
    for (const k of TEAMER_DRAMATURGIE) {
      const t = aktiverTeamer();
      if (k === 'teamer-neu-dabei') {
        t.neu_dabei = { erstes_jahr: true, start_jahr: 2026 };
      }
      expect(waehleTeamerKacheln(t), `${k} ist unerreichbar`).toContain(k);
    }
  });
});
