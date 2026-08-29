// backend/tests/utils/passwordUtils.test.js
//
// Die erzeugten Passwoerter sind Bibelstellen. Bis zum 28.08.2026 wurden
// Kapitel (1-50) und Vers (1-30) blind gewuerfelt, unabhaengig vom Buch:
// "Ruth47,29" war ein haeufiges Ergebnis, obwohl Rut nur 4 Kapitel hat.
// Ausserdem konnten sechs kurze Buecher Passwoerter unter acht Zeichen
// erzeugen ("Rut1,1") und damit die eigene Policy verletzen.
//
// Fuer die Erzeugung gab es bis dahin ueberhaupt keine Tests — deshalb fiel
// beides nie auf.
const { generateBiblicalPassword, validatePassword } = require('../../utils/passwordUtils');
const { VERSE_PRO_KAPITEL } = require('../../utils/bibelVerszaehlung');

// Zerlegt "1Korinther13,4" in { buch: '1Korinther', kapitel: 13, vers: 4 }.
// Nicht-gierig bis zur ersten Ziffernfolge vor dem Komma.
const zerlege = (passwort) => {
  const treffer = passwort.match(/^(.+?)(\d+),(\d+)$/);
  if (!treffer) return null;
  return { buch: treffer[1], kapitel: Number(treffer[2]), vers: Number(treffer[3]) };
};

describe('generateBiblicalPassword', () => {
  // 2000 Durchgaenge: genug, um jedes der 66 Buecher mehrfach zu treffen,
  // und schnell genug fuer einen Unit-Test.
  const PROBEN = 2000;
  let passwoerter;

  beforeAll(() => {
    passwoerter = Array.from({ length: PROBEN }, () => generateBiblicalPassword());
  });

  it('erzeugt ausschliesslich Stellen, die es wirklich gibt (der Befund)', () => {
    const erfunden = passwoerter.filter((p) => {
      const teile = zerlege(p);
      if (!teile) return true;
      const kapitelListe = VERSE_PRO_KAPITEL[teile.buch];
      if (!kapitelListe) return true;
      if (teile.kapitel < 1 || teile.kapitel > kapitelListe.length) return true;
      return teile.vers < 1 || teile.vers > kapitelListe[teile.kapitel - 1];
    });

    expect(erfunden).toEqual([]);
  });

  it('haelt die eigene Passwort-Policy ein', () => {
    // Sechs kurze Buecher (Jona, Rut, Joel, Amos, Esra, Hiob) konnten
    // Passwoerter unter acht Zeichen erzeugen. validatePassword haette sie
    // spaeter abgelehnt — das automatisch vergebene Passwort war also
    // eines, das man selbst nicht haette setzen duerfen.
    const beanstandet = passwoerter
      .map((p) => ({ p, fehler: validatePassword(p) }))
      .filter((x) => x.fehler !== null);

    expect(beanstandet).toEqual([]);
  });

  it('enthaelt nie ein Leerzeichen', () => {
    // iOS-Tastaturen fuegen beim Abtippen sichtbarer Passwoerter gern
    // Leerzeichen ein und brechen damit den spaeteren Login. Deshalb
    // "1Korinther13,4" und nicht "1. Korinther 13,4".
    expect(passwoerter.filter((p) => /\s/.test(p))).toEqual([]);
  });

  it('nutzt ueber viele Durchgaenge den ganzen Kanon', () => {
    // Gegenprobe zur alten Liste: Dort fehlten die Buecher mit Ordnungszahl
    // teilweise ganz ("Samuel" statt 1./2. Samuel), und "Johannes" stand
    // doppelt drin und hatte damit die doppelte Wahrscheinlichkeit.
    const getroffen = new Set(passwoerter.map((p) => zerlege(p).buch));

    // Bei 2000 Ziehungen aus 66 Buechern ist ein ungetroffenes Buch extrem
    // unwahrscheinlich; die Grenze laesst trotzdem Luft.
    expect(getroffen.size).toBeGreaterThanOrEqual(60);
    for (const buch of getroffen) {
      expect(VERSE_PRO_KAPITEL).toHaveProperty(buch);
    }
  });

  it('trifft auch die kurzen Buecher — sie fallen nicht stillschweigend raus', () => {
    // Zu kurze Stellen kommen gar nicht erst in den Topf. Das darf die kurzen
    // Buecher aber nicht komplett aussperren: "Jona3,10" ist lang genug, nur
    // "Jona1,1" nicht.
    const kurzeBuecher = ['Jona', 'Rut', 'Joel', 'Amos', 'Esra', 'Hiob'];
    const getroffen = new Set(passwoerter.map((p) => zerlege(p).buch));

    expect(kurzeBuecher.some((b) => getroffen.has(b))).toBe(true);
  });

  it('zieht gleichverteilt ueber alle Stellen', () => {
    // Diese Erwartung war zunaechst falsch angesetzt (1800 von 2000) und der
    // Test rot — nachgerechnet lag der Fehler in der Erwartung, nicht in den
    // Daten. Dabei fiel aber ein echter Befund auf: Die urspruengliche
    // Ziehung (erst Buch, dann Kapitel, dann Vers) war stark schief. Obadja
    // hat ein Kapitel mit 21 Versen, Psalm 150 Kapitel mit zusammen 2461 —
    // eine bestimmte Obadja-Stelle war damit rund 500-mal wahrscheinlicher
    // als ein bestimmter Psalmvers, und die effektive Vielfalt schrumpfte von
    // 31168 auf 6144. Jetzt wird flach ueber alle Stellen gezogen.
    //
    // Erwartungswert nach dem Geburtstagsparadoxon bei rund 31000 gleich
    // wahrscheinlichen Stellen und 2000 Ziehungen: etwa 1937 eindeutige.
    // Die Grenze laesst Luft nach unten, ohne die alte schiefe Ziehung
    // (die hier bei rund 1765 landete) durchzulassen.
    const eindeutige = new Set(passwoerter);
    expect(eindeutige.size).toBeGreaterThan(1900);
  });
});

describe('bibelVerszaehlung', () => {
  const buecher = Object.keys(VERSE_PRO_KAPITEL);

  it('enthaelt alle 66 Buecher des evangelischen Kanons', () => {
    expect(buecher.length).toBe(66);
  });

  it('bildet die deutsche Zaehlung ab, nicht die englische', () => {
    // Der Unterschied ist keine Kleinigkeit: Die KJV-Zaehlung gibt Joel drei
    // Kapitel und Maleachi vier, die deutsche Zaehlung genau umgekehrt.
    // Ein npm-Paket mit KJV-Zaehlung haette hier lauter Stellen erzeugt, die
    // in einer deutschen Bibel nicht stehen.
    expect(VERSE_PRO_KAPITEL['Joel'].length).toBe(4);
    expect(VERSE_PRO_KAPITEL['Maleachi'].length).toBe(3);
    // Psalmen: die deutsche Zaehlung zaehlt die Ueberschrift als Vers 1.
    expect(VERSE_PRO_KAPITEL['Psalm'][50]).toBe(21); // Psalm 51
  });

  it('stimmt bei den bekannten Eckwerten', () => {
    expect(VERSE_PRO_KAPITEL['Genesis'].length).toBe(50);
    expect(VERSE_PRO_KAPITEL['Psalm'].length).toBe(150);
    expect(VERSE_PRO_KAPITEL['Offenbarung'].length).toBe(22);
    expect(VERSE_PRO_KAPITEL['Rut'].length).toBe(4);
    expect(VERSE_PRO_KAPITEL['Obadja'].length).toBe(1);

    expect(VERSE_PRO_KAPITEL['Psalm'][116]).toBe(2);   // Psalm 117, kuerzestes Kapitel
    expect(VERSE_PRO_KAPITEL['Psalm'][118]).toBe(176); // Psalm 119, laengstes
    expect(VERSE_PRO_KAPITEL['Genesis'][0]).toBe(31);
  });

  it('zaehlt 1189 Kapitel', () => {
    const kapitel = buecher.reduce((summe, b) => summe + VERSE_PRO_KAPITEL[b].length, 0);
    expect(kapitel).toBe(1189);
  });

  it('hat keine leeren oder unmoeglichen Kapitel', () => {
    const kaputt = buecher.filter((b) =>
      VERSE_PRO_KAPITEL[b].some((v) => !Number.isInteger(v) || v <= 0)
    );
    expect(kaputt).toEqual([]);
  });

  it('nutzt Buchnamen ohne Punkt und Leerzeichen', () => {
    // Die Namen gehen direkt ins Passwort, deshalb "1Korinther" und nicht
    // "1. Korinther".
    expect(buecher.filter((b) => /[.\s]/.test(b))).toEqual([]);
  });

  it('schreibt echte Umlaute', () => {
    // Nicht transliteriert (Matthaeus), weil die Namen zu
    // bible_abbreviations.german_name in der ketiv-Datenbank und zu
    // konfsprueche.book passen sollen — damit die Stelle dort auffindbar ist.
    expect(buecher).toContain('Matthäus');
    expect(buecher).toContain('Römer');
    expect(buecher).toContain('Sprichwörter');
    expect(buecher).not.toContain('Matthaeus');
  });
});
