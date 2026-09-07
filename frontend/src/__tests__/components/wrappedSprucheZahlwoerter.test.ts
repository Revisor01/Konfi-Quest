import { describe, it, expect } from 'vitest';
import { TEXTE, stufeFuer } from '../../components/wrapped/slides/kategorieSeitenTexte';

/**
 * Der Slogan darf der Zahl darunter nicht widersprechen.
 *
 * BEFUND 07.09.2026 (Simon am Geraet): "habe ich jetzt dreimal Ostern
 * gesehen, und dann stand da aber viermal in der Karwoche." Auf EINER Seite
 * standen zwei verschiedene Zahlen.
 *
 * WARUM: Der Slogan kommt aus einer festen Stufe, der Nachsatz setzt die
 * echte Zahl ein. Die Stufen decken SPANNEN ab, nicht einzelne Zahlen:
 *
 *   stufen[0] >= 10   stufen[1] 5..9   stufen[2] 3..4   stufen[3] == 2   stufen[4] == 1
 *
 * Ein Zahlwort in einer SPANNEN-Stufe stimmt darum hoechstens fuer einen
 * Wert der Spanne. "Dreimal" in stufen[2] war bei einer 4 schlicht falsch;
 * "Vier Kerzen. Und du bei jeder dabei." stand in der Advent-Stufe 5..9.
 *
 * Die beiden EXAKTEN Stufen (== 2 und == 1) duerfen ihr Zahlwort behalten
 * und sollen es auch: "Zweimal mitgefeiert." bei genau zwei Malen ist
 * richtig und schoener als "Mehrfach".
 *
 * Dieser Test prueft die Regel fuer JEDE Seite, nicht nur fuer Ostern --
 * dieselbe Falle steckte in 19 von 19 Eintraegen.
 */

/**
 * Zahlwoerter, die eine konkrete Menge behaupten.
 *
 * OHNE die nackten Artikel "ein"/"eine": Im Deutschen sind sie vor einem
 * Substantiv der unbestimmte Artikel und zaehlen nichts. "Weihnachten ist
 * bei dir ein Marathon." behauptet keine Menge und ist bei zwoelf Terminen
 * genauso richtig wie bei zehn. Sie in die Liste zu nehmen hiess: ein Test,
 * der bei korrektem Text rot wird -- und der wird abgeschaltet statt
 * befolgt.
 *
 * "Ein Fest." und "Ein Konzert." stehen in der EXAKTEN 1er-Stufe, wo sie
 * ohnehin erlaubt waeren. Dort zaehlen sie tatsaechlich, aber sie stimmen
 * auch.
 */
const ZAHLWOERTER = [
  'einmal', 'zweimal', 'dreimal', 'viermal', 'fünfmal', 'sechsmal',
  'siebenmal', 'achtmal', 'neunmal', 'zehnmal',
  'zwei ', 'drei ', 'vier ', 'fünf ', 'sechs ', 'sieben ', 'acht ',
  'neun ', 'zehn '
];

const enthaeltZahlwort = (text: string) => {
  const flach = ' ' + text.replace(/\n/g, ' ').toLowerCase() + ' ';
  return ZAHLWOERTER.filter(z => flach.includes(' ' + z.trimEnd() + (z.endsWith(' ') ? ' ' : '')));
};

const SEITEN = Object.keys(TEXTE);

describe('Rueckblick-Sprueche: kein Zahlwort in einer Spannen-Stufe', () => {
  it('deckt alle Seiten ab', () => {
    // 13 Kategorie-Seiten + 6 Datums-Seiten + die allgemeine Seite.
    expect(SEITEN.length).toBe(20);
  });

  it.each(SEITEN)('%s: die Spannen-Stufen (>=10, 5-9, 3-4) nennen keine Menge', (seite) => {
    const stufen = TEXTE[seite].stufen;
    const spannen: Array<[string, string]> = [
      ['>=10', stufen[0]],
      ['5-9', stufen[1]],
      ['3-4', stufen[2]]
    ];
    const treffer = spannen
      .filter(([, text]) => enthaeltZahlwort(text).length > 0)
      .map(([grenze, text]) => `${grenze}: "${text.replace(/\n/g, ' ')}" (${enthaeltZahlwort(text).join(', ')})`);
    expect(treffer, `${seite} nennt in einer Spannen-Stufe eine Menge:\n${treffer.join('\n')}`).toEqual([]);
  });

  it.each(SEITEN)('%s: Slogan und Nachsatz widersprechen sich bei keiner Zahl von 1 bis 20', (seite) => {
    const { stufen, nachsatz } = TEXTE[seite];
    const widersprueche: string[] = [];
    for (let n = 1; n <= 20; n++) {
      const slogan = stufeFuer(stufen, n).replace(/\n/g, ' ');
      const gefunden = enthaeltZahlwort(slogan);
      if (gefunden.length === 0) continue;
      // Ein Zahlwort im Slogan ist nur erlaubt, wenn es GENAU die Zahl
      // meint, die der Nachsatz nennt.
      const erlaubt: Record<number, string[]> = {
        1: ['einmal'],
        2: ['zweimal', 'zwei ']
      };
      const passend = erlaubt[n] || [];
      const falsch = gefunden.filter(z => !passend.includes(z));
      if (falsch.length > 0) {
        widersprueche.push(`n=${n}: Slogan "${slogan}" nennt ${falsch.join(', ')}, Nachsatz sagt "${nachsatz(n)}"`);
      }
    }
    expect(widersprueche, `${seite}:\n${widersprueche.join('\n')}`).toEqual([]);
  });
});

/**
 * Der Text muss zum Datums-Fenster passen (Simons Punkt 2c).
 *
 * Die Fenster stehen im Backend (utils/wrappedKategorien.js, datumsFenster).
 * Sie sind hier bewusst als Klartext hinterlegt statt importiert: Der Test
 * soll rot werden, wenn jemand DAS FENSTER aendert und den Text vergisst --
 * ein Import wuerde beides gemeinsam verschieben und nichts merken.
 */
const FENSTER_KLARTEXT: Record<string, { spanne: string; verbotenImText: string[] }> = {
  // Aschermittwoch bis Ostermontag -- 48 Tage, die ganze Passionszeit.
  // Simons Entscheidung 07.09.2026: Das Fenster BLEIBT (die Passionszeit ist
  // theologisch eine Einheit), der Text wird richtiggestellt. "Karwoche" ist
  // EINE Woche und war damit die falsche Bezeichnung.
  'datum:ostern': { spanne: 'Aschermittwoch bis Ostermontag (48 Tage)', verbotenImText: ['karwoche'] },
  // 24. bis 26.12. -- drei Tage. "Heiligabend" waere nur der erste.
  'datum:weihnachten': { spanne: '24. bis 26. Dezember', verbotenImText: ['heiligabend'] },
  // 1. Advent bis 23.12. -- die Zahl der Kerzen haengt am Datum, nicht an
  // der Zahl der Besuche.
  'datum:advent': { spanne: '1. Advent bis 23. Dezember', verbotenImText: [] },
  'datum:jahreswechsel': { spanne: '27. Dezember bis 6. Januar', verbotenImText: [] },
  'datum:erntedank': { spanne: 'erster Sonntag im Oktober', verbotenImText: [] },
  'datum:sommer': { spanne: 'Juli und August', verbotenImText: [] }
};

describe('Datums-Seiten: der Text passt zum Fenster', () => {
  it('es gibt zu jeder Datums-Seite einen Eintrag', () => {
    const datumsSeiten = SEITEN.filter(s => s.startsWith('datum:'));
    expect(datumsSeiten.sort()).toEqual(Object.keys(FENSTER_KLARTEXT).sort());
  });

  it.each(Object.entries(FENSTER_KLARTEXT))(
    '%s nennt keinen Zeitraum, der enger ist als das Fenster',
    (seite, { verbotenImText }) => {
      const t = TEXTE[seite];
      const alleTexte = [t.auge, ...t.stufen, t.nachsatz(1), t.nachsatz(4), t.nachsatz(12)]
        .join(' ')
        .toLowerCase();
      const treffer = verbotenImText.filter(w => alleTexte.includes(w));
      expect(treffer, `${seite} nennt ${treffer.join(', ')} — enger als das Fenster`).toEqual([]);
    }
  );
});
