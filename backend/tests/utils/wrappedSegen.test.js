const { SEGENSWORTE, waehleSegen } = require('../../utils/wrappedSegen');

// SIMON, 09.09.2026: "Dann soll der was bekommen aber keinen Rueckblick und
// kein wir vermissen dich. Eher ein Segen, ein positiver Zuspruch."
describe('Der Zuspruch statt eines leeren Rueckblicks', () => {
  test('derselbe Mensch bekommt im selben Jahr immer denselben Zuspruch', () => {
    // Ein Rueckblick laesst sich beliebig oft wieder oeffnen. Wechselte der
    // Text dabei, waere er Dekoration statt Zuspruch.
    const erst = waehleSegen(42, 2022);
    for (let i = 0; i < 20; i++) {
      expect(waehleSegen(42, 2022)).toEqual(erst);
    }
  });

  test('verschiedene Jahre koennen verschiedene Zusprueche tragen', () => {
    const jahre = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027];
    const texte = new Set(jahre.map(j => waehleSegen(42, j).text));
    expect(texte.size).toBeGreaterThan(1);
  });

  test('verschiedene Menschen bekommen nicht alle denselben', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const texte = new Set(ids.map(id => waehleSegen(id, 2026).text));
    expect(texte.size).toBeGreaterThan(1);
  });

  test('es kommt immer ein vollstaendiger Zuspruch heraus', () => {
    // Auch bei Unsinn als Eingabe: Die Seite wird gerendert, sie darf nie
    // leer bleiben.
    for (const [id, jahr] of [[0, 0], [-5, 2026], [null, null], [undefined, 2026], ['x', 'y']]) {
      const segen = waehleSegen(id, jahr);
      expect(SEGENSWORTE).toContain(segen);
      expect(segen.text.length).toBeGreaterThan(10);
      expect(segen.quelle.length).toBeGreaterThan(0);
    }
  });

  test('kein Text macht das Fehlen zum Thema', () => {
    // Der Punkt der ganzen Sache: kein "wir vermissen dich", kein "leider",
    // nichts, was auf die leere Bilanz zeigt.
    //
    // GEPRUEFT WIRD DIE AUSSAGE, NICHT DAS WORT: "mir wird nichts mangeln"
    // (Psalm 23) enthaelt "nichts" und sagt das genaue Gegenteil von
    // Mangel. Verboten sind deshalb die Wendungen, die ueber die Person
    // und ihr Jahr urteilen -- nicht einzelne Vokabeln.
    const verboten = [
      /vermiss/i,
      /\bleider\b/i,
      /\bschade\b/i,
      /\btrotzdem\b/i,
      /\bdennoch\b/i,
      /du (hast|warst|konntest) (dieses|in diesem|letztes)/i,
      /(kaum|wenig|nichts) (getan|gemacht|dabei|erlebt)/i,
      /\bleeres? (Jahr|Rueckblick|Rückblick)/i
    ];
    for (const { text } of SEGENSWORTE) {
      for (const muster of verboten) {
        expect(text).not.toMatch(muster);
      }
    }
  });

  test('der Filter faengt, wofuer er da ist', () => {
    // Gegenprobe: Der Test oben ist nur etwas wert, wenn er einen echten
    // Fehlgriff auch ablehnen wuerde.
    const fehlgriffe = [
      'Wir vermissen dich im Team.',
      'Leider war dieses Jahr wenig los.',
      'Du hast dieses Jahr kaum etwas gemacht — trotzdem: sei gesegnet.'
    ];
    const verboten = [
      /vermiss/i,
      /\bleider\b/i,
      /\btrotzdem\b/i,
      /du (hast|warst|konntest) (dieses|in diesem|letztes)/i
    ];
    for (const satz of fehlgriffe) {
      expect(verboten.some(m => m.test(satz))).toBe(true);
    }
  });

  test('jeder Zuspruch nennt seine Quelle', () => {
    for (const { text, quelle } of SEGENSWORTE) {
      expect(typeof text).toBe('string');
      expect(typeof quelle).toBe('string');
      expect(quelle.trim().length).toBeGreaterThan(0);
    }
  });

  test('echte Umlaute, keine ae/oe/ue-Schreibung', () => {
    // Nutzertext -- er wird gelesen.
    for (const { text, quelle } of SEGENSWORTE) {
      expect(text).not.toMatch(/\b(ae|oe|ue)[a-z]/);
      expect(quelle).not.toMatch(/\b(ae|oe|ue)[a-z]/);
    }
  });
});
