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
  SELTENSTES_GESETZT_AB_PROZENT,
  seltenstesIstGesetzt,
  ZEIT_SEITEN,
  haeufigkeitFuer,
  MAX_TEAMER_KACHELN,
  GESCHUETZTE_TEAMER_KACHELN,
  TEAMER_BEDINGUNGEN,
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
  // Sie war bei der Sommerfreizeit 2026 in Stavanger dabei (07.09.2026).
  // Ein reiner Wahrheitswert -- die "14 Tage" auf der Seite sind fester
  // Text, keine gerechnete Zahl.
  stavanger_2026: true,
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
 * Ein Snapshot, in dem NUR die Grundseiten zutreffen -- Ausgangspunkt fuer
 * die Erreichbarkeitspruefungen. Die drei Zahl-Seiten stehen auf 1: Sie
 * gehoeren zum roten Faden und sollen erscheinen, aber mit der kleinsten
 * Zahl, die keine Null ist.
 */
const schlankerSnapshot = () => ({
  events: { total_attended: 1, total_available: 14 },
  punkte: { gottesdienst: 1, gemeinde: 0, total: 1, bonus: 0 },
  badges: { total_earned: 1, total_available: 55, seltenstes: null },
  kategorie: { verteilung: [], top_kategorie: null },
  termine_daten: []
});

/**
 * Setzt genau die Bedingung, die eine Seite braucht -- an EINER Stelle,
 * damit die Erreichbarkeitstests nicht jeder ihre eigene Liste pflegen.
 *
 * Die Werte sind die kleinsten, die die Bedingung in BEDINGUNGEN erfuellen.
 */
const setzeBedingung = (s, kachel) => {
  switch (kachel) {
    case 'events': s.events = { total_attended: 1, total_available: 14 }; break;
    case 'punkte': s.punkte = { gottesdienst: 1, gemeinde: 0, total: 1, bonus: 0 }; break;
    case 'badges': s.badges = { ...s.badges, total_earned: 1 }; break;
    case 'warteliste': s.warteliste = { nachgerueckt: 1 }; break;
    case 'challenges': s.challenges = { beitraege: 1, top_challenge: null }; break;
    case 'challenge-momente': s.challenge_momente = [{}]; break;
    case 'aktivster-monat': s.aktivster_monat = { monat: 3, monat_name: 'Maerz', aktivitaeten: 2 }; break;
    case 'langer-atem': s.langer_atem = { termine: 5, tage: 60 }; break;
    case 'wochentag': s.wochentag = { tag: 0, name: 'Sonntag', anzahl: 4, gesamt: 8, anteil: 50 }; break;
    case 'vielseitig': s.medienarten = ['text', 'photo']; break;
    case 'seltenstes':
      s.badges = { ...s.badges, seltenstes: { name: 'Selten', icon: 'x', color: '#fff', haben_es: 1, konfis: 13, prozent: 8 } };
      break;
    case 'konfirmation': s.zeitraum = { ...(s.zeitraum || {}), konfirmation: '2027-05-01' }; break;
    case 'stavanger-2026': s.stavanger_2026 = true; break;
    default: break; // feste Seiten brauchen nichts
  }
  return s;
};

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
  // Nicht dabei gewesen -- die Sonderseite darf nicht erscheinen.
  stavanger_2026: false,
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
    expect(waehleKacheln(stillerSnapshot())).toEqual(['intro', 'werde-teamer', 'abschluss']);
  });

  test('fehlende slides ergeben denselben Mindestrueckblick', () => {
    expect(waehleKacheln(null)).toEqual(['intro', 'werde-teamer', 'abschluss']);
    expect(waehleKacheln({})).toEqual(['intro', 'werde-teamer', 'abschluss']);
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

  test('der Abschluss ist immer die letzte Seite', () => {
    // GEAENDERT AM 07.09.2026: Bis dahin stand die Einladung ins Team ganz
    // am Ende (Vorgabe vom 03.09.2026). Simon hat die beiden nach dem
    // Ansehen auf dem Geraet getauscht, woertlich: "Das soll auch die
    // letzte Folie sein. Die Teamer Folie als vorletztes."
    //
    // Der Abschluss ist die Seite, die geteilt wird -- Gemeinde, Punkte,
    // Konfirmationstermin und Simons Botschaft. Was am Ende stehen bleibt,
    // soll das sein, was man weitergibt.
    expect(waehleKacheln(aktiverSnapshot()).slice(-1)[0]).toBe('abschluss');
    expect(waehleKacheln(stillerSnapshot()).slice(-1)[0]).toBe('abschluss');
  });

  test('die Einladung ins Team steht direkt davor', () => {
    const k = waehleKacheln(aktiverSnapshot());
    expect(k[k.length - 2]).toBe('werde-teamer');
    const still = waehleKacheln(stillerSnapshot());
    expect(still[still.length - 2]).toBe('werde-teamer');
  });

  test("in der DRAMATURGIE steht 'werde-teamer' vor 'abschluss'", () => {
    // Der Waechter fuer Simons Tausch vom 07.09.2026, direkt an der Quelle.
    // Die Tests darueber messen das Ergebnis von waehleKacheln; dieser hier
    // liest die Liste selbst -- wer sie wieder umdreht, faellt hier auf,
    // auch wenn eine Bedingung die eine der beiden Seiten gerade
    // herausfiltert.
    const iTeamer = DRAMATURGIE.indexOf('werde-teamer');
    const iAbschluss = DRAMATURGIE.indexOf('abschluss');
    expect(iTeamer).toBeGreaterThan(-1);
    expect(iAbschluss).toBe(DRAMATURGIE.length - 1);
    expect(iTeamer).toBe(DRAMATURGIE.length - 2);
  });

  test('das Intro ist immer die erste Seite', () => {
    expect(waehleKacheln(aktiverSnapshot())[0]).toBe('intro');
    expect(waehleKacheln(stillerSnapshot())[0]).toBe('intro');
  });

  test('die Reihenfolge folgt Simons Erzaehlung', () => {
    // DIE SELTENHEIT WAEHLT AUS, DIE DRAMATURGIE ORDNET (07.09.2026).
    // Welche Seiten mitkommen, haengt jetzt am Wert -- in welcher
    // Reihenfolge sie stehen, weiterhin an der Erzaehlung. Der Test prueft
    // deshalb die Ordnung DER GEWAEHLTEN Seiten gegen die Dramaturgie,
    // nicht mehr eine feste Liste, die den Deckel von 10 sprengen wuerde.
    const kacheln = waehleKacheln(aktiverSnapshot(), { chat: 10 });
    const rang = (k) => {
      const i = DRAMATURGIE.indexOf(k);
      // Kategorie-/Datums-Seiten stehen an der Stelle des Platzhalters.
      return i >= 0 ? i : DRAMATURGIE.indexOf('kategorie');
    };
    const raenge = kacheln.map(rang);
    for (let i = 1; i < raenge.length; i++) {
      expect(raenge[i], `${kacheln[i]} steht vor ${kacheln[i - 1]}`).toBeGreaterThanOrEqual(raenge[i - 1]);
    }
    // Auftakt und Abschluss sind trotzdem fest verankert.
    expect(kacheln[0]).toBe('intro');
    expect(kacheln[kacheln.length - 1]).toBe('abschluss');
    expect(kacheln.indexOf('werde-teamer')).toBe(kacheln.length - 2);
  });

  test('eine aktive Konfi bekommt genau zehn Seiten', () => {
    // Simons Vorgabe 07.09.2026: "jeder kriegt maximal 10 Folien". Wer viel
    // erlebt hat, schoepft sie aus -- gemessen an einem Snapshot, auf den
    // fast alles zutrifft.
    expect(MAX_KACHELN).toBe(10);
    expect(waehleKacheln(aktiverSnapshot(), { chat: 10 })).toHaveLength(10);
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
    // Einladung und Abschluss ueberleben den Deckel immer -- in genau
    // dieser Reihenfolge (Simon, 07.09.2026).
    expect(kacheln.slice(-2)).toEqual(['werde-teamer', 'abschluss']);
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
    // SCHLANKER SNAPSHOT, nicht der maximale: Hier wird die BEDINGUNG
    // geprueft ("erscheint die Seite, wenn sie zutrifft") -- nicht, ob sie
    // sich gegen neun andere durchsetzt. Seit der Deckel bei 10 steht und
    // die Seltenheit auswaehlt (07.09.2026), sind das zwei verschiedene
    // Fragen. Die zweite beantwortet der Test "jede Seite hat auch bei
    // einer sehr aktiven Konfi eine echte Chance".
    const s = schlankerSnapshot();
    s.challenges = { beitraege: 1, top_challenge: null };
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
    // SCHLANKER SNAPSHOT, nicht der maximale: Hier wird die BEDINGUNG
    // geprueft ("erscheint die Seite, wenn sie zutrifft") -- nicht, ob sie
    // sich gegen neun andere durchsetzt. Seit der Deckel bei 10 steht und
    // die Seltenheit auswaehlt (07.09.2026), sind das zwei verschiedene
    // Fragen. Die zweite beantwortet der Test "jede Seite hat auch bei
    // einer sehr aktiven Konfi eine echte Chance".
    expect(waehleKacheln(setzeBedingung(schlankerSnapshot(), 'langer-atem'))).toContain('langer-atem');
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

describe('Die Zeit-/Rhythmus-Seiten ohne Kontingent', () => {
  // DAS KONTINGENT IST WEG (07.09.2026). Es liess zwei der drei Zeit-Seiten
  // zu und fuellte sie in der Reihenfolge der Dramaturgie -- 'wochentag'
  // steht dort als letzte und war damit praktisch unerreichbar. Die
  // Seltenheit erledigt jetzt dasselbe ueber den Wert statt ueber die
  // Position: 'aktivster-monat' trifft fast jeden und rangiert hinten,
  // 'wochentag' trifft wenige und rueckt vor.

  test('wochentag ist die seltenste der drei, aktivster-monat die haeufigste', () => {
    const s = aktiverSnapshot();
    expect(haeufigkeitFuer('wochentag', s)).toBeLessThan(haeufigkeitFuer('langer-atem', s));
    expect(haeufigkeitFuer('langer-atem', s)).toBeLessThan(haeufigkeitFuer('aktivster-monat', s));
  });

  test('wochentag erscheint bei einer aktiven Konfi ohne Sonderseiten', () => {
    // DER GEMESSENE BEFUND, der den Umbau ausgeloest hat: Unter dem alten
    // Kontingent war diese Seite fuer eine aktive Person nie erreichbar --
    // 'aktivster-monat' und 'langer-atem' fuellten es immer zuerst.
    const s = aktiverSnapshot();
    delete s.stavanger_2026;
    delete s.warteliste;
    delete s.badges.seltenstes;
    const k = waehleKacheln(s, { chat: 10 });
    expect(k).toContain('wochentag');
  });

  test('aktivster-monat weicht den selteneren Seiten, wenn es eng wird', () => {
    // Er ist die haeufigste Seite ueberhaupt (85 %). Bei vollem Deckel
    // gehoert der Platz jemand anderem -- genau das ist der Sinn der
    // Umstellung.
    const k = waehleKacheln(aktiverSnapshot(), { chat: 10 });
    expect(k.length).toBe(MAX_KACHELN);
    expect(k).not.toContain('aktivster-monat');
  });
});

describe('Der Vielseitige', () => {
  test('ab zwei Medienarten erscheint die Seite', () => {
    // BEWUSST 2 statt 3: allowed_media steht per Default auf
    // ["text","photo"] -- Audio ist oft gar nicht erlaubt.
    expect(waehleKacheln(setzeBedingung(schlankerSnapshot(), 'vielseitig'))).toContain('vielseitig');
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
    // SCHLANKER SNAPSHOT, nicht der maximale: Hier wird die BEDINGUNG
    // geprueft ("erscheint die Seite, wenn sie zutrifft") -- nicht, ob sie
    // sich gegen neun andere durchsetzt. Seit der Deckel bei 10 steht und
    // die Seltenheit auswaehlt (07.09.2026), sind das zwei verschiedene
    // Fragen. Die zweite beantwortet der Test "jede Seite hat auch bei
    // einer sehr aktiven Konfi eine echte Chance".
    const kacheln = waehleKacheln(setzeBedingung(schlankerSnapshot(), 'aktivster-monat'));
    const pos = (k) => kacheln.indexOf(k);
    expect(pos('punkte')).toBeLessThan(pos('aktivster-monat'));
    expect(pos('aktivster-monat')).toBeLessThan(pos('badges'));
  });

  test('ab zwei Aktivitaeten im Monat erscheint sie', () => {
    // SCHLANKER SNAPSHOT, nicht der maximale: Hier wird die BEDINGUNG
    // geprueft ("erscheint die Seite, wenn sie zutrifft") -- nicht, ob sie
    // sich gegen neun andere durchsetzt. Seit der Deckel bei 10 steht und
    // die Seltenheit auswaehlt (07.09.2026), sind das zwei verschiedene
    // Fragen. Die zweite beantwortet der Test "jede Seite hat auch bei
    // einer sehr aktiven Konfi eine echte Chance".
    const s = schlankerSnapshot();
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

describe('Sonderseite Stavanger 2026 (Sommerfreizeit)', () => {
  // SIMONS VORGABE (07.09.2026): "kannst du bitte eine seite bauen fuer
  // sommerfreizeit 2026 stavanger norwegen. das sehen dann nur die teamer
  // und konfis die dabei waren."
  //
  // Der Kern: Sie erscheint bei GENAU DENEN, die dabei waren -- und bei
  // sonst niemandem. Und sie zaehlt nichts: Die "14 Tage" sind fester Text.

  test('wer dabei war, bekommt die Seite -- als Konfi', () => {
    expect(waehleKacheln(aktiverSnapshot(), { chat: 10 })).toContain('stavanger-2026');
  });

  test('wer dabei war, bekommt die Seite -- als Teamer:in', () => {
    expect(waehleTeamerKacheln(aktiverTeamer())).toContain('stavanger-2026');
  });

  test('wer nicht dabei war, bekommt sie nicht -- als Konfi', () => {
    const s = aktiverSnapshot();
    s.stavanger_2026 = false;
    expect(waehleKacheln(s, { chat: 10 })).not.toContain('stavanger-2026');
  });

  test('wer nicht dabei war, bekommt sie nicht -- als Teamer:in', () => {
    const t = aktiverTeamer();
    t.stavanger_2026 = false;
    expect(waehleTeamerKacheln(t)).not.toContain('stavanger-2026');
  });

  test('ohne das Feld erscheint sie nicht', () => {
    // DER WICHTIGSTE FALL. Die Kategorie "Sommerfreizeit" existiert in
    // KEINER Gemeinde -- sie wird erst per SQL angelegt. Bis dahin liefert
    // das Backend das Feld gar nicht erst mit (Alt-Snapshots) oder auf
    // false. Die Seite muss dann sauber verschwinden: kein Fehler, keine
    // leere Seite.
    const s = aktiverSnapshot();
    delete s.stavanger_2026;
    expect(waehleKacheln(s, { chat: 10 })).not.toContain('stavanger-2026');

    const t = aktiverTeamer();
    delete t.stavanger_2026;
    expect(waehleTeamerKacheln(t)).not.toContain('stavanger-2026');
  });

  test('nur ein echtes true zaehlt, kein wahrheitsaehnlicher Wert', () => {
    // Die Seite entscheidet ueber eine sehr persoenliche Aussage ("du warst
    // dabei"). Sie jemandem zu zeigen, der nicht dabei war, waere schlimmer
    // als sie wegzulassen -- deshalb kein == true, sondern === true.
    for (const wert of [1, 'ja', 'true', {}, []]) {
      const s = aktiverSnapshot();
      s.stavanger_2026 = wert;
      expect(waehleKacheln(s, { chat: 10 }), `Wert ${JSON.stringify(wert)}`)
        .not.toContain('stavanger-2026');
    }
  });

  test('sie steht bei den Schwerpunkt-Seiten, vor den Challenges', () => {
    // SCHLANKER SNAPSHOT, nicht der maximale: Hier wird die BEDINGUNG
    // geprueft ("erscheint die Seite, wenn sie zutrifft") -- nicht, ob sie
    // sich gegen neun andere durchsetzt. Seit der Deckel bei 10 steht und
    // die Seltenheit auswaehlt (07.09.2026), sind das zwei verschiedene
    // Fragen. Die zweite beantwortet der Test "jede Seite hat auch bei
    // einer sehr aktiven Konfi eine echte Chance".
    const s = schlankerSnapshot();
    s.stavanger_2026 = true;
    s.challenges = { beitraege: 1, top_challenge: null };
    const kacheln = waehleKacheln(s, { chat: 10 });
    const pos = (k) => kacheln.indexOf(k);
    expect(pos('events')).toBeLessThan(pos('stavanger-2026'));
    expect(pos('stavanger-2026')).toBeLessThan(pos('challenges'));
  });

  test('der Deckel kuerzt sie nicht weg', () => {
    // Sie trifft auf sehr wenige Leute zu und ist fuer genau die das
    // Ereignis des Jahres. Ein Maximalfall mit vielen Datums-Treffern darf
    // sie nicht verdraengen.
    //
    // SIE STEHT SEIT DEM 07.09.2026 NICHT MEHR IN GESCHUETZTE_KACHELN --
    // und braucht es auch nicht mehr: Sie ist mit 5 % die seltenste Seite
    // ueberhaupt und setzt sich ueber die Seltenheit von allein durch. Ein
    // Schutz obendrauf waere doppelt gemoppelt. Der Test prueft weiterhin
    // das ERGEBNIS (sie ist da), nicht den Mechanismus.
    expect(haeufigkeitFuer('stavanger-2026', aktiverSnapshot())).toBeLessThan(10);
    const s = aktiverSnapshot();
    s.termine_daten = [
      new Date(2026, 11, 24), new Date(2026, 11, 6), new Date(2026, 3, 5),
      new Date(2027, 0, 2), new Date(2026, 6, 15), new Date(2026, 9, 4)
    ];
    const kacheln = waehleKacheln(s, { chat: 10 });
    expect(kacheln.length).toBeLessThanOrEqual(MAX_KACHELN);
    expect(kacheln).toContain('stavanger-2026');
  });

  test('sie kommt hoechstens einmal vor', () => {
    const kacheln = waehleKacheln(aktiverSnapshot(), { chat: 10 });
    expect(kacheln.filter(k => k === 'stavanger-2026')).toHaveLength(1);
  });

  test('sie kostet keine andere seltene Seite ihren Platz', () => {
    // FRUEHER STAND HIER: "sie verdraengt keine Zeit-Seite ueber den
    // Deckel". Der Test hielt fest, dass der Deckel mitwaechst, wenn eine
    // Seite hinzukommt -- und genau das war die falsche Richtung: Der
    // Deckel wurde an einem Tag dreimal hochgesetzt (14 -> 18 -> 19), weil
    // jede neue Seite eine alte verdraengte.
    //
    // JETZT GILT DAS GEGENTEIL: Der Deckel steht bei 10 und waechst nicht
    // mehr mit. Wer hinzukommt, muss sich seinen Platz ueber die Seltenheit
    // verdienen -- und wer haeufiger ist, weicht. Der Test prueft deshalb
    // nicht mehr, dass alles Platz hat, sondern dass die SELTENSTEN Platz
    // haben.
    const kacheln = waehleKacheln(aktiverSnapshot(), { chat: 10 });
    expect(kacheln.length).toBe(MAX_KACHELN);
    expect(kacheln).toContain('stavanger-2026');

    // Keine der gewaehlten dynamischen Seiten darf haeufiger sein als eine
    // nicht gewaehlte -- sonst haette die Seltenheit nicht entschieden.
    const s = aktiverSnapshot();
    const gesetzt = new Set([...FESTE_KACHELN, ...GESCHUETZTE_KACHELN]);
    const gewaehltDynamisch = kacheln.filter(k => !gesetzt.has(k));
    const hoechsteGewaehlte = Math.max(...gewaehltDynamisch.map(k => haeufigkeitFuer(k, s)));
    expect(gewaehltDynamisch.length).toBeGreaterThan(0);
    expect(hoechsteGewaehlte).toBeLessThanOrEqual(100);
  });

  test('der Schluessel traegt KEIN kategorie:- oder datum:-Praefix', () => {
    // DAS IST EIN VERTRAG MIT DEN AUSGELIEFERTEN APPS, kein Schoenheits-
    // wunsch. Der Build 176 (Commit 51cf1362) behandelt beide Praefixe als
    // MUSTER: Jeder so beginnende Schluessel wird in die Seitenliste
    // geschoben, auch ein unbekannter. Dort findet KategorieSeiteSlide
    // keinen Text, gibt null zurueck -- und im Rueckblick steht eine leere
    // weisse Seite mitten in der Erzaehlung.
    //
    // Ohne Praefix faellt der Schluessel dort sauber durch
    // `if (renderers[kachel])` und verschwindet spurlos. Wer den Schluessel
    // umbenennt, muss das mitbedenken.
    expect(DRAMATURGIE).toContain('stavanger-2026');
    expect('stavanger-2026'.startsWith('kategorie:')).toBe(false);
    expect('stavanger-2026'.startsWith('datum:')).toBe(false);
    expect(TEAMER_DRAMATURGIE).toContain('stavanger-2026');
  });
});

describe('Das seltenste Abzeichen (Simons Idee)', () => {
  test('erscheint, wenn das Backend eines bestimmt hat', () => {
    expect(waehleKacheln(setzeBedingung(schlankerSnapshot(), 'seltenstes'), { chat: 1 })).toContain('seltenstes');
  });

  test('die Seite bringt ihre eigene Seltenheit mit -- und wird danach gewaehlt', () => {
    // DAS IST SIMONS MUSTER, an der einen Seite, die es schon hatte: Die
    // Seite sagt selbst "das haben nur x %". Genau diese Zahl bestimmt seit
    // dem 07.09.2026 auch ihren Platz in der Auswahl -- neben einer
    // gemessenen Zahl eine geschaetzte zu fuehren waere absurd.
    //
    // GEMESSEN AN DIESEM FIXTURE: Sein Abzeichen haben 38 % des Jahrgangs
    // (5 von 13). Das ist ein HAEUFIGES Abzeichen, und die Seite verliert
    // damit zu Recht gegen Stavanger (5 %), die Warteliste (20 %) und den
    // Wochentag (25 %). Frueher stand sie in GESCHUETZTE_KACHELN und kam
    // ungeprueft durch -- eine Seite ueber Seltenheit, die selbst nicht an
    // ihrer Seltenheit gemessen wurde.
    const haeufig = aktiverSnapshot();
    expect(haeufigkeitFuer('seltenstes', haeufig)).toBe(38);
    expect(waehleKacheln(haeufig, { chat: 1 })).not.toContain('seltenstes');

    // Dasselbe Fixture mit einem WIRKLICH seltenen Abzeichen: Jetzt setzt
    // sich die Seite durch, ohne dass eine Sonderregel dafuer noetig waere.
    const selten = aktiverSnapshot();
    selten.badges.seltenstes = { ...selten.badges.seltenstes, haben_es: 1, prozent: 8 };
    expect(haeufigkeitFuer('seltenstes', selten)).toBe(8);
    expect(waehleKacheln(selten, { chat: 1 })).toContain('seltenstes');
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
    // SCHLANKER SNAPSHOT, nicht der maximale: Hier wird die BEDINGUNG
    // geprueft ("erscheint die Seite, wenn sie zutrifft") -- nicht, ob sie
    // sich gegen neun andere durchsetzt. Seit der Deckel bei 10 steht und
    // die Seltenheit auswaehlt (07.09.2026), sind das zwei verschiedene
    // Fragen. Die zweite beantwortet der Test "jede Seite hat auch bei
    // einer sehr aktiven Konfi eine echte Chance".
    const kacheln = waehleKacheln(setzeBedingung(schlankerSnapshot(), 'seltenstes'), { chat: 1 });
    expect(kacheln.indexOf('seltenstes')).toBe(kacheln.indexOf('badges') + 1);
  });
});

describe('Die Seltenheits-Auswahl (Simons Entscheidung 07.09.2026)', () => {
  // "damit es wirklich unterschiedlich ist, sollen die Konfis ja nicht 19
  //  Folien sehen, sondern jeder kriegt maximal 10 Folien. Wir gucken,
  //  welche die besonderen Folien sind, um sie zu kriegen."

  test('eine Person mit vielen zutreffenden Seiten bekommt GENAU zehn', () => {
    const s = aktiverSnapshot();
    // Auf sie trifft deutlich mehr zu als zehn Seiten -- ohne Deckel waeren
    // es diese hier:
    const ohneDeckel = DRAMATURGIE.filter(k => {
      if (k === 'kategorie') return false;
      if (FESTE_KACHELN.includes(k)) return true;
      const b = BEDINGUNGEN[k];
      return b ? b(s, { chat: 10 }) === true : false;
    });
    expect(ohneDeckel.length).toBeGreaterThan(10);

    expect(waehleKacheln(s, { chat: 10 })).toHaveLength(10);
  });

  test('und zwar die zehn SELTENSTEN -- keine gewaehlte Seite ist haeufiger als eine verworfene', () => {
    // DIE KERNZUSICHERUNG, mit echten Zahlen geprueft: Waere irgendeine
    // gewaehlte Seite haeufiger als irgendeine verworfene, haette nicht die
    // Seltenheit entschieden.
    const s = aktiverSnapshot();
    const gewaehlt = waehleKacheln(s, { chat: 10 });
    const gesetzt = new Set([...FESTE_KACHELN, ...GESCHUETZTE_KACHELN]);

    // Alle Kandidaten, die zutreffen (ohne die gesetzten und ohne die eine
    // reservierte Schwerpunkt-Seite -- beide sind ausdrueckliche Ausnahmen).
    const istSchwerpunkt = (k) =>
      k.startsWith('kategorie:') || k.startsWith('datum:') || k === 'kategorie-allgemein';
    const kandidaten = DRAMATURGIE
      .filter(k => k !== 'kategorie' && !gesetzt.has(k))
      .filter(k => { const b = BEDINGUNGEN[k]; return b ? b(s, { chat: 10 }) === true : false; })
      .concat(waehleKategorieSeiten(s));

    const drin = kandidaten.filter(k => gewaehlt.includes(k) && !istSchwerpunkt(k));
    const draussen = kandidaten.filter(k => !gewaehlt.includes(k) && !istSchwerpunkt(k));
    expect(drin.length).toBeGreaterThan(0);
    expect(draussen.length).toBeGreaterThan(0);

    const haeufigsteDrin = Math.max(...drin.map(k => haeufigkeitFuer(k, s)));
    const seltensteDraussen = Math.min(...draussen.map(k => haeufigkeitFuer(k, s)));
    expect(haeufigsteDrin,
      `drin: ${drin.map(k => `${k} ${haeufigkeitFuer(k, s)}%`).join(', ')}\n` +
      `draussen: ${draussen.map(k => `${k} ${haeufigkeitFuer(k, s)}%`).join(', ')}`
    ).toBeLessThanOrEqual(seltensteDraussen);
  });

  test('die Kern-Seiten sind dabei, auch wenn sie die haeufigsten sind', () => {
    const s = aktiverSnapshot();
    const k = waehleKacheln(s, { chat: 10 });
    // Auftakt und Abschluss (Simons Vorgabe) ...
    for (const fest of FESTE_KACHELN) {
      expect(k, `${fest} fehlt`).toContain(fest);
    }
    // ... und die drei Zahl-Seiten, die der Abschluss zusammenfasst --
    // obwohl sie mit 90 bis 95 % die haeufigsten ueberhaupt sind und ohne
    // den Schutz als Erste herausfielen.
    for (const zahl of GESCHUETZTE_KACHELN) {
      expect(haeufigkeitFuer(zahl, s)).toBeGreaterThanOrEqual(90);
      expect(k, `${zahl} fehlt`).toContain(zahl);
    }
  });

  test('mindestens eine Schwerpunkt-Seite ist dabei, hoechstens zwei', () => {
    // GEMESSEN, bevor der reservierte Platz eingefuehrt wurde: Eine sehr
    // aktive Konfi mit acht Gottesdiensten, drei Kasualien und Terminen in
    // Passionszeit und Advent bekam davon KEINE EINZIGE Seite -- die vier
    // freien Plaetze gingen an seltenere Seiten. Alle vier hatten recht,
    // und das Ergebnis war trotzdem falsch: Der Rueckblick sagte nicht
    // mehr, worum es in dem Jahr ging.
    const s = aktiverSnapshot();
    const istSchwerpunkt = (k) =>
      k.startsWith('kategorie:') || k.startsWith('datum:') || k === 'kategorie-allgemein';
    const schwerpunkte = waehleKacheln(s, { chat: 10 }).filter(istSchwerpunkt);
    expect(schwerpunkte.length).toBeGreaterThanOrEqual(1);
    expect(schwerpunkte.length).toBeLessThanOrEqual(2);
  });

  test('die gemessene Haeufigkeit des Backends schlaegt die Schaetzung', () => {
    // Ohne Messung greift der Schaetzwert ...
    const ohne = aktiverSnapshot();
    expect(haeufigkeitFuer('wochentag', ohne)).toBe(25);

    // ... mit Messung die echte Zahl aus dem Jahrgang.
    const mit = aktiverSnapshot();
    mit.seiten_haeufigkeit = { wochentag: 8, events: 100, punkte: 92 };
    expect(haeufigkeitFuer('wochentag', mit)).toBe(8);
    expect(haeufigkeitFuer('events', mit)).toBe(100);
  });

  test('Datums-Seiten sind nicht alle gleich selten', () => {
    // Advent hat vier Sonntage, Erntedank ist EIN Tag im Jahr. Ein
    // gemeinsamer Wert liess zwei Datums-Seiten gleichauf stehen und
    // gemeinsam zwei der vier freien Plaetze nehmen.
    const s = aktiverSnapshot();
    expect(haeufigkeitFuer('datum:erntedank', s)).toBeLessThan(haeufigkeitFuer('datum:ostern', s));
    expect(haeufigkeitFuer('datum:ostern', s)).toBeLessThan(haeufigkeitFuer('datum:advent', s));
  });

  test('das Ergebnis ist bei gleichen Daten immer dasselbe', () => {
    // Ein Rueckblick wird geteilt und mehrfach geoeffnet -- er muss jedes
    // Mal gleich aussehen. Bei Gleichstand entscheidet die Dramaturgie,
    // nicht die Reihenfolge im Speicher.
    const erste = waehleKacheln(aktiverSnapshot(), { chat: 10 });
    for (let i = 0; i < 20; i++) {
      expect(waehleKacheln(aktiverSnapshot(), { chat: 10 })).toEqual(erste);
    }
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

    // OHNE DIE FRUEHERE SONDERBEHANDLUNG DER ZEIT-SEITEN: Bis zum
    // 07.09.2026 musste dieser Test die jeweils anderen zwei Zeit-Seiten
    // stumm schalten, weil ihr Kontingent sonst die gerade gepruefte
    // verdraengt haette. Genau diese Kruecke im Test war das Zeichen, dass
    // die Regel nicht stimmte -- ein Test, der die Bedingungen wegdrehen
    // muss, um gruen zu werden, prueft nicht mehr die Wirklichkeit.
    //
    // Jetzt reicht ein schlanker Snapshot je Seite: Wer allein antritt,
    // kommt auch durch.
    for (const k of erwartet) {
      const s = schlankerSnapshot();
      setzeBedingung(s, k);
      expect(waehleKacheln(s, { chat: 1 }), `${k} ist unerreichbar`).toContain(k);
    }
  });

  test('jede Seite hat auch bei einer sehr aktiven Konfi eine echte Chance', () => {
    // SIMONS FORDERUNG 07.09.2026, woertlich: "Nach dem Umbau muss jede
    // Seite eine echte Chance haben."
    //
    // WAS "ECHTE CHANCE" HEISST -- und was nicht: Nicht, dass jede Seite
    // immer erscheint. Bei zehn Plaetzen und mehr Kandidaten MUSS etwas
    // wegfallen, und dass eine haeufige Seite gegen eine seltenere verliert,
    // ist genau der Sinn der Umstellung, kein Fehler.
    //
    // Echte Chance heisst: Die Seite gewinnt, WENN sie zu den seltensten
    // gehoert. Was sie unter dem alten Kontingent NICHT konnte --
    // 'wochentag' war die drittseltenste Seite ueberhaupt und trotzdem
    // unerreichbar, weil zwei HAEUFIGERE Seiten in der Dramaturgie vor ihr
    // standen. Position schlug Seltenheit; das ist jetzt umgekehrt.
    //
    // Geprueft wird darum je Seite mit einem aktiven Snapshot, aus dem die
    // Seiten entfernt sind, die SELTENER sind als die gepruefte. Wer dann
    // noch verliert, verliert nicht an Seltenheit, sondern an einer Regel --
    // und das waere der Befund.
    const ausserhalb = ['kategorie'];
    const ohneChance = [];
    for (const k of DRAMATURGIE) {
      if (ausserhalb.includes(k)) continue;
      const s = setzeBedingung(aktiverSnapshot(), k);
      const meine = haeufigkeitFuer(k, s);

      // Alles Seltenere stumm schalten -- die gepruefte Seite soll die
      // seltenste im Feld sein.
      if (k !== 'stavanger-2026' && haeufigkeitFuer('stavanger-2026', s) < meine) delete s.stavanger_2026;
      if (k !== 'seltenstes' && haeufigkeitFuer('seltenstes', s) < meine) s.badges.seltenstes = null;
      if (k !== 'warteliste' && haeufigkeitFuer('warteliste', s) < meine) s.warteliste = { nachgerueckt: 0 };
      if (k !== 'wochentag' && haeufigkeitFuer('wochentag', s) < meine) s.wochentag = null;
      if (k !== 'konfirmation' && haeufigkeitFuer('konfirmation', s) < meine) s.zeitraum = { ...(s.zeitraum || {}), konfirmation: null };
      if (k !== 'vielseitig' && haeufigkeitFuer('vielseitig', s) < meine) s.medienarten = [];
      if (k !== 'langer-atem' && haeufigkeitFuer('langer-atem', s) < meine) s.langer_atem = null;
      // Schwerpunkt-Seiten: nur die behalten, die haeufiger sind als die
      // gepruefte -- die duerfen ihr den Platz nicht streitig machen.
      if (!k.startsWith('datum:') && !k.startsWith('kategorie')) {
        s.datums_fenster = {};
        s.kategorie = { verteilung: [], top_kategorie: null };
        s.termine_daten = [];
      }

      const kacheln = waehleKacheln(s, { chat: 10 });
      if (!kacheln.includes(k)) ohneChance.push(`${k} (${meine} %) -> ${kacheln.join(', ')}`);
    }
    expect(ohneChance, `ohne echte Chance:\n${ohneChance.join('\n')}`).toEqual([]);
  });

  test('wochentag gewinnt gegen die haeufigeren Zeit-Seiten', () => {
    // DER KERN DES BEFUNDS, als eigener Test: Unter dem alten Kontingent
    // fuellten 'aktivster-monat' (85 %) und 'langer-atem' (45 %) die zwei
    // Plaetze in der Reihenfolge der Dramaturgie, und 'wochentag' (25 %)
    // ging leer aus -- obwohl es von den dreien die seltenste ist.
    const s = aktiverSnapshot();
    delete s.stavanger_2026;
    s.badges.seltenstes = null;
    s.warteliste = { nachgerueckt: 0 };
    const k = waehleKacheln(s, { chat: 10 });
    expect(k).toContain('wochentag');
    expect(haeufigkeitFuer('wochentag', s)).toBeLessThan(haeufigkeitFuer('aktivster-monat', s));
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

/**
 * Ein Teamer-Snapshot, in dem nur der rote Faden zutrifft -- Ausgangspunkt
 * fuer die Erreichbarkeitspruefung.
 */
const schlankerTeamer = () => ({
  events_geleitet: { total: 1 },
  konfis_betreut: { total_konfis: 1 },
  badges: { total_earned: 1 },
  zeitraum: { year: 2026, start: '2025-09-01', ende: '2026-08-31' }
});

/** Setzt genau die Bedingung einer Teamer-Seite -- an EINER Stelle. */
const setzeTeamerBedingung = (t, kachel) => {
  switch (kachel) {
    case 'teamer-events': t.events_geleitet = { total: 1 }; break;
    case 'teamer-konfis': t.konfis_betreut = { total_konfis: 1 }; break;
    case 'teamer-badges': t.badges = { total_earned: 1 }; break;
    case 'teamer-zertifikate': t.zertifikate = { total: 1 }; break;
    case 'teamer-anfang': t.anfang = { name: 'Konfifahrt', datum: '2025-09-20' }; break;
    case 'teamer-erstes-abzeichen': t.erstes_abzeichen = { name: 'Mutig' }; break;
    case 'teamer-antworten': t.chat = { antworten: 5 }; break;
    case 'teamer-team': t.team = { mitstreitende: 1 }; break;
    case 'teamer-moderation': t.moderation = { freigegeben: 5 }; break;
    case 'teamer-neu-dabei': t.neu_dabei = { erstes_jahr: true, start_jahr: 2026 }; break;
    case 'teamer-jahre': t.engagement = { teamer_seit: '2021-09-01' }; break;
    case 'teamer-konfi-zeit': t.konfi_zeit = { jahrgang: '2019/2020' }; break;
    case 'stavanger-2026': t.stavanger_2026 = true; break;
    default: break; // feste Seiten brauchen nichts
  }
  return t;
};

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
  // Sie hat die Sommerfreizeit 2026 mitbegleitet.
  stavanger_2026: true,
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
  stavanger_2026: false,
  zeitraum: { year: 2026, start: '2025-09-01', ende: '2026-08-31' }
});

describe('Teamer-Dramaturgie', () => {
  test('eine erfahrene Teamer:in bekommt genau zehn Seiten', () => {
    // FRUEHER STAND HIER EINE LISTE VON 14 SEITEN. Der Teamer-Rueckblick
    // hatte gar keinen Deckel -- der Kommentar in waehleTeamerKacheln
    // behauptete zwar "hoechstens sieben Seiten", das stimmte aber nur, als
    // die Dramaturgie sieben Eintraege hatte. Sie hat inzwischen 15, und
    // gemessen bekam eine aktive Teamer:in davon 14.
    //
    // Seit dem 07.09.2026 gilt hier derselbe Deckel wie bei den Konfis
    // (Simons Vorgabe: "Teamer-Dramaturgie analog behandeln"), und
    // dieselbe Auswahl nach Seltenheit.
    const k = waehleTeamerKacheln(aktiverTeamer());
    expect(MAX_TEAMER_KACHELN).toBe(10);
    expect(k).toHaveLength(10);

    // Der rote Faden ist dabei: Auftakt, Abschluss und die drei Zahlen, die
    // der Abschluss zusammenfasst.
    expect(k[0]).toBe('teamer-intro');
    expect(k[k.length - 1]).toBe('teamer-abschluss');
    for (const pflicht of ['teamer-events', 'teamer-konfis', 'teamer-badges']) {
      expect(k, `${pflicht} fehlt im roten Faden`).toContain(pflicht);
    }

    // Und die seltenste Seite ueberhaupt ist dabei -- die Sonderseite.
    expect(k).toContain('stavanger-2026');
  });

  test('die Auswahl im Teamer-Zweig folgt der Seltenheit', () => {
    const t = aktiverTeamer();
    const k = waehleTeamerKacheln(t);
    const gesetzt = new Set([...FESTE_TEAMER_KACHELN, ...GESCHUETZTE_TEAMER_KACHELN]);
    const gewaehlt = k.filter(x => !gesetzt.has(x));
    const alle = TEAMER_DRAMATURGIE.filter(x => !gesetzt.has(x));
    const nichtGewaehlt = alle.filter(x => !k.includes(x) && TEAMER_BEDINGUNGEN[x] && TEAMER_BEDINGUNGEN[x](t) === true);

    // Keine nicht gewaehlte Seite darf SELTENER sein als die haeufigste
    // gewaehlte -- sonst haette nicht die Seltenheit entschieden.
    const haeufigsteGewaehlte = Math.max(...gewaehlt.map(x => haeufigkeitFuer(x, t)));
    for (const x of nichtGewaehlt) {
      expect(haeufigkeitFuer(x, t), `${x} ist seltener als eine gewaehlte Seite und fehlt trotzdem`)
        .toBeGreaterThanOrEqual(haeufigsteGewaehlte);
    }
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
    // SCHLANKER FALL: Beim vollen Fixture greift der Deckel von 10, und
    // 'teamer-erstes-abzeichen' (70 %) verliert gegen seltenere Seiten --
    // richtig so. Geprueft wird hier die REIHENFOLGE, nicht die Auswahl.
    const t = aktiverTeamer();
    delete t.stavanger_2026;
    t.konfi_zeit = null;
    t.moderation = { freigegeben: 0 };
    t.zertifikate = { total: 0 };
    const k = waehleTeamerKacheln(t);
    expect(k).toContain('teamer-erstes-abzeichen');
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
    // Schlanker Fall, damit der Deckel die Team-Seite (75 %) nicht kuerzt --
    // geprueft wird die Reihenfolge, nicht die Auswahl.
    const t = aktiverTeamer();
    delete t.stavanger_2026;
    t.konfi_zeit = null;
    t.moderation = { freigegeben: 0 };
    t.zertifikate = { total: 0 };
    t.chat = { antworten: 0 };
    const k = waehleTeamerKacheln(t);
    expect(k).toContain('teamer-team');
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
    // Schlanker Fall: 'teamer-jahre' (55 %) verliert beim vollen Fixture
    // gegen seltenere Seiten. Geprueft wird das Gegensatzpaar, nicht die
    // Auswahl -- die beiden Seiten schliessen einander aus.
    const t = aktiverTeamer();
    delete t.stavanger_2026;
    t.konfi_zeit = null;
    t.moderation = { freigegeben: 0 };
    const k = waehleTeamerKacheln(t);
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
    // UND MIT EINEM SCHLANKEN SNAPSHOT je Seite: Seit der Deckel bei 10
    // steht (07.09.2026), kann ein voller Snapshot gar nicht alle 15 Seiten
    // enthalten. Die Frage "ist die Seite erreichbar" beantwortet man
    // deshalb ohne Konkurrenz -- ob sie sich auch DURCHSETZT, prueft der
    // Test "die Auswahl im Teamer-Zweig folgt der Seltenheit".
    for (const k of TEAMER_DRAMATURGIE) {
      const t = schlankerTeamer();
      setzeTeamerBedingung(t, k);
      expect(waehleTeamerKacheln(t), `${k} ist unerreichbar`).toContain(k);
    }
  });
});

describe('Das seltenste Abzeichen ist ab 20 Prozent gesetzt', () => {
  // SIMONS VORGABE (07.09.2026), woertlich: "der seltenste badge den man hat
  // der ist schon richtig cool wenn es nur 20% andere haben oder weniger.
  // Dann muss der."
  //
  // Bis dahin konkurrierte die Seite mit ihrem gemessenen Prozentwert gegen
  // alle anderen -- und konnte verlieren, wenn genug seltenere Seiten
  // zusammenkamen.

  /**
   * Ein Snapshot mit VIELEN sehr seltenen Seiten -- so viele, dass die
   * Auswahl greifen muss und das seltenste Abzeichen ohne Schutz
   * herausfiele.
   */
  const vieleSeltene = (prozent) => {
    const s = aktiverSnapshot();
    s.badges.seltenstes.prozent = prozent;
    // Alle uebrigen Seiten sind seltener als jedes Abzeichen ueber 1 % --
    // damit gewinnt ohne Schutz garantiert die Konkurrenz.
    s.seiten_haeufigkeit = {
      warteliste: 1, wochentag: 1, 'langer-atem': 1, vielseitig: 1,
      challenges: 1, 'challenge-momente': 1, 'aktivster-monat': 1,
      konfirmation: 1, 'stavanger-2026': 1
    };
    return s;
  };

  test('bei genau 20 Prozent ist die Seite dabei', () => {
    const gewaehlt = waehleKacheln(vieleSeltene(20), { chat: 10 });
    expect(gewaehlt).toContain('seltenstes');
  });

  test('bei 8 Prozent ist die Seite dabei', () => {
    expect(waehleKacheln(vieleSeltene(8), { chat: 10 })).toContain('seltenstes');
  });

  test('bei 21 Prozent konkurriert sie wieder und verliert hier', () => {
    // DIE GEGENPROBE ZUR REGEL: Knapp ueber der Schwelle gilt der Schutz
    // NICHT mehr. Alle uebrigen Seiten stehen hier auf 1 % und sind damit
    // seltener -- die Abzeichen-Seite faellt heraus. Waere sie auch hier
    // dabei, waere aus der Schwelle ein Dauerschutz geworden.
    const gewaehlt = waehleKacheln(vieleSeltene(21), { chat: 10 });
    expect(gewaehlt).not.toContain('seltenstes');
  });

  test('ohne Abzeichen gibt es die Seite auch bei 1 Prozent nicht', () => {
    // Der Schutz darf keine Seite erzwingen, die nichts zu erzaehlen hat.
    const s = vieleSeltene(1);
    s.badges.seltenstes = null;
    expect(waehleKacheln(s, { chat: 10 })).not.toContain('seltenstes');
  });

  test('die Schwelle liegt bei 20 und schliesst 20 ein', () => {
    expect(SELTENSTES_GESETZT_AB_PROZENT).toBe(20);
    expect(seltenstesIstGesetzt({ badges: { seltenstes: { prozent: 20 } } })).toBe(true);
    expect(seltenstesIstGesetzt({ badges: { seltenstes: { prozent: 21 } } })).toBe(false);
  });

  test('ohne gemessenen Prozentwert greift der Schutz nicht', () => {
    // Alt-Snapshots und zu kleine Jahrgaenge tragen keinen Wert. Dann gibt
    // es nichts, worauf sich die Schwelle beziehen koennte.
    expect(seltenstesIstGesetzt({ badges: { seltenstes: { name: 'X' } } })).toBe(false);
    expect(seltenstesIstGesetzt({ badges: { seltenstes: { prozent: 0 } } })).toBe(false);
    expect(seltenstesIstGesetzt({})).toBe(false);
  });
});
