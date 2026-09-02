// Tests für die Kachel-Auswahl des Jahresrückblicks.
//
// Simons Vorgabe (02.09.2026): rund 20-25 Kacheln im Bestand, jede Person
// bekommt 8, davon 4 feste. "Wer nicht viel geschrieben hat, braucht keine
// Chat-Kachel."
//
// Der wichtigste Teil dieser Tests ist nicht, DASS Kacheln erscheinen,
// sondern dass die falschen WEGBLEIBEN: Eine Kachel mit einer Null darauf
// ist keine Erinnerung.
const {
  waehleKacheln,
  FESTE_KACHELN,
  KACHELN_PRO_PERSON,
  DYNAMISCHE_KACHELN
} = require('../../utils/wrappedKacheln');

// Eine Person, die in allem aktiv war -- damit lässt sich die Obergrenze
// prüfen (mehr Kandidaten als Plätze).
const vollerSnapshot = () => ({
  punkte: { gottesdienst: 40, gemeinde: 30, total: 70, bonus: 5 },
  events: {
    total_attended: 18,
    total_available: 24,
    lieblings_event: { name: 'Konfi-Freizeit Nordsee', date: '2026-10-02' }
  },
  badges: { total_earned: 7, total_available: 15, badges: [] },
  aktivster_monat: { monat: 3, monat_name: 'März', aktivitaeten: 12 },
  endspurt: { aktiv: false, fehlende_punkte: 0, ziel_total: 50, aktuell_total: 70 },
  zeitraum: { start: '2026-09-01', ende: '2027-05-01', konfirmation: '2027-05-01' },
  kategorie: { verteilung: [{ kategorie: 'Gottesdienst', count: 8 }, { kategorie: 'Gemeinde', count: 5 }], top_kategorie: 'Gottesdienst' },
  challenge_momente: [{ challenge_title: 'Dein Lieblingsort', badge_icon: 'heart', media_type: 'photo' }],
  highlight: { type: 'chat_star', wert: 342, jahrgangsschnitt: 120 },
  challenges: { beitraege: 14, top_challenge: { title: 'Dein Lieblingsort', badge_icon: 'heart', count: 3 } },
  verlaesslichkeit: { abmeldungen: 0, nie_abgesagt: true },
  chat: { nachrichten_gesendet: 342, reaktionen_gegeben: 40, reaktionen_bekommen: 89 },
  pflicht: { besucht: 5, gesamt: 6 }
});

// Eine stille Person: war ein paar Mal da, hat aber nichts geschrieben,
// keine Challenge eingereicht, keine Abzeichen.
const stillerSnapshot = () => ({
  punkte: { gottesdienst: 2, gemeinde: 0, total: 2, bonus: 0 },
  events: { total_attended: 2, total_available: 24, lieblings_event: null },
  badges: { total_earned: 0, total_available: 15, badges: [] },
  aktivster_monat: { monat: 10, monat_name: 'Oktober', aktivitaeten: 0 },
  endspurt: { aktiv: false, fehlende_punkte: 0, ziel_total: 0, aktuell_total: 2 },
  zeitraum: { start: '2026-09-01', ende: '2027-05-01', konfirmation: null },
  kategorie: { verteilung: [], top_kategorie: null },
  challenge_momente: [],
  challenges: { beitraege: 0, top_challenge: null },
  verlaesslichkeit: { abmeldungen: 0, nie_abgesagt: true },
  chat: { nachrichten_gesendet: 1, reaktionen_gegeben: 0, reaktionen_bekommen: 0 },
  pflicht: { besucht: 0, gesamt: 6 }
});

describe('Kachel-Auswahl im Jahresrückblick', () => {
  it('hält den Bestand bei 20 bis 25 Kacheln', () => {
    // Simons Zahl. Weniger wäre eintönig, mehr pflegt niemand mehr.
    const gesamt = DYNAMISCHE_KACHELN.length + FESTE_KACHELN.length;
    expect(gesamt).toBeGreaterThanOrEqual(20);
    expect(gesamt).toBeLessThanOrEqual(25);
  });

  it('gibt jeder Person genau 8 Kacheln, wenn genug Stoff da ist', () => {
    const kacheln = waehleKacheln(vollerSnapshot(), null);
    expect(kacheln).toHaveLength(KACHELN_PRO_PERSON);
  });

  it('zeigt die vier festen Kacheln immer, auch bei einer stillen Konfi', () => {
    const kacheln = waehleKacheln(stillerSnapshot(), null);
    for (const fest of FESTE_KACHELN) {
      expect(kacheln).toContain(fest);
    }
  });

  it('lässt die Chat-Kachel weg, wer kaum geschrieben hat', () => {
    // Simons Regel wörtlich. Eine einzelne Nachricht ist keine Geschichte.
    const kacheln = waehleKacheln(stillerSnapshot(), null);
    expect(kacheln).not.toContain('chat');
  });

  it('zeigt die Chat-Kachel, wer viel geschrieben hat', () => {
    const kacheln = waehleKacheln(vollerSnapshot(), null);
    expect(kacheln).toContain('chat');
  });

  it('lässt die Chat-Kachel weg, wer unter dem Jahrgangsschnitt liegt', () => {
    // Vergleiche laufen nur nach oben: Wer darunter liegt, bekommt die
    // Kachel gar nicht erst -- nicht die Kachel mit einem mageren Vergleich.
    const s = vollerSnapshot();
    s.chat.nachrichten_gesendet = 6;
    const kacheln = waehleKacheln(s, { chat: 120, events: 10 });
    expect(kacheln).not.toContain('chat');
  });

  it('zeigt keine Kachel zu etwas, das nicht stattgefunden hat', () => {
    const kacheln = waehleKacheln(stillerSnapshot(), null);
    expect(kacheln).not.toContain('challenge-momente');
    expect(kacheln).not.toContain('challenges');
    expect(kacheln).not.toContain('stempel');
    expect(kacheln).not.toContain('badges');
    expect(kacheln).not.toContain('lieblings-event');
    expect(kacheln).not.toContain('konfirmation');
  });

  it('nennt "nie abgesagt" nur, wer auch wirklich dabei war', () => {
    // Wer bei nichts war, hat auch nichts abgesagt. Das als Verlässlichkeit
    // zu feiern wäre Hohn.
    const kacheln = waehleKacheln(stillerSnapshot(), null);
    expect(kacheln).not.toContain('verlaesslich');

    const aktiv = vollerSnapshot();
    expect(waehleKacheln(aktiv, null)).toContain('verlaesslich');
  });

  it('zeigt nie Endspurt und Über-das-Ziel zusammen', () => {
    // Beides gleichzeitig wäre widersprüchlich: "fast geschafft" neben
    // "geschafft".
    const s = vollerSnapshot();
    s.endspurt = { aktiv: true, fehlende_punkte: 5, ziel_total: 50, aktuell_total: 50 };
    const kacheln = waehleKacheln(s, null);
    const beide = kacheln.filter(k => k === 'endspurt' || k === 'ueber-das-ziel');
    expect(beide.length).toBeLessThanOrEqual(1);
  });

  it('stellt die Momente vor die Zahlen', () => {
    // Ein Foto sagt mehr über ein Jahr als ein Punktestand. Bei begrenztem
    // Platz gewinnt das Persönliche.
    const kacheln = waehleKacheln(vollerSnapshot(), null);
    expect(kacheln).toContain('challenge-momente');
    expect(kacheln.indexOf('challenge-momente')).toBeLessThan(kacheln.indexOf('punkte'));
  });

  it('beginnt mit dem Intro und endet mit dem Abschluss', () => {
    for (const snapshot of [vollerSnapshot(), stillerSnapshot()]) {
      const kacheln = waehleKacheln(snapshot, null);
      expect(kacheln[0]).toBe('intro');
      expect(kacheln[kacheln.length - 1]).toBe('abschluss');
    }
  });

  it('enthält keine Kachel doppelt', () => {
    const kacheln = waehleKacheln(vollerSnapshot(), null);
    expect(new Set(kacheln).size).toBe(kacheln.length);
  });

  it('kommt mit fehlenden Daten zurecht, statt zu werfen', () => {
    // Alt-Snapshots (Version 1) haben viele Felder nicht.
    expect(() => waehleKacheln({}, null)).not.toThrow();
    expect(waehleKacheln(null, null)).toEqual(FESTE_KACHELN);
    expect(waehleKacheln(undefined, null)).toEqual(FESTE_KACHELN);
  });

  it('lässt sich auf eine andere Kachelzahl einstellen', () => {
    const kacheln = waehleKacheln(vollerSnapshot(), null, 6);
    expect(kacheln).toHaveLength(6);
    for (const fest of FESTE_KACHELN) {
      expect(kacheln).toContain(fest);
    }
  });

  it('streut die Kacheln über verschiedene Themen', () => {
    // Gemessen am 02.09.2026: Ohne Streuung gewannen die vier obersten
    // Plätze ALLE das Thema "challenges" (challenge-momente 100, stempel 90,
    // challenges 85) -- vier Kacheln über dasselbe, während Chat und
    // Verlässlichkeit ganz herausfielen.
    const kacheln = waehleKacheln(vollerSnapshot(), null);
    const dynamisch = kacheln.filter(k => !FESTE_KACHELN.includes(k));
    const themen = dynamisch.map(key => {
      const k = DYNAMISCHE_KACHELN.find(d => d.key === key);
      return k?.thema || key;
    });
    // Jedes Thema höchstens einmal, solange genug verschiedene da sind.
    expect(new Set(themen).size).toBe(themen.length);
  });

  it('gibt jeder dynamischen Kachel ein Thema', () => {
    // Ohne Thema fiele eine Kachel aus der Streuung heraus und könnte
    // wieder Dubletten erzeugen.
    for (const k of DYNAMISCHE_KACHELN) {
      expect(typeof k.thema).toBe('string');
      expect(k.thema.length).toBeGreaterThan(0);
    }
  });

  it('zeigt bei einer stillen Konfi nur die festen Kacheln', () => {
    // Gegenprobe zur Obergrenze: Wo nichts ist, wird nichts erfunden.
    const kacheln = waehleKacheln(stillerSnapshot(), null);
    expect(kacheln.length).toBeLessThanOrEqual(KACHELN_PRO_PERSON);
    expect(kacheln.length).toBeGreaterThanOrEqual(FESTE_KACHELN.length);
  });
});
