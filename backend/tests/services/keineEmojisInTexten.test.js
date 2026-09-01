// backend/tests/services/keineEmojisInTexten.test.js
// Projektregel (CLAUDE.md, Punkt 3): KEINE Unicode-Emojis in Code, UI oder
// Texten — "das gilt für ALLE Dateien: .tsx, .ts, .js, .jsx, Kommentare,
// Strings, ÜBERALL". Erlaubt sind IonIcons und Icon-Fonts.
//
// Anlass: Am 31.08.2026 waren in den Push-Texten Emojis gelandet
// ("📷 Foto"). In einer Mitteilung gibt es keine IonIcons, also faellt so
// etwas leicht durch — deshalb dieser Waechter.
//
// Bewusst auf die Backend-Quellen begrenzt, die Nutzertexte erzeugen. Emojis
// als DATEN (etwa eine Reaktion, die jemand verschickt) sind kein Verstoss.

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..', '..');
const ORDNER = ['routes', 'services', 'utils'];

// Emoji-Bloecke, die als Symbol gerendert werden. Bewusst ohne die
// Variationsselektoren und ohne Zeichen wie "©", die in Lizenztexten stehen.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F0FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

function dateienSammeln(ordner) {
  const ergebnis = [];
  const lauf = (verzeichnis) => {
    for (const eintrag of fs.readdirSync(verzeichnis, { withFileTypes: true })) {
      const voll = path.join(verzeichnis, eintrag.name);
      if (eintrag.isDirectory()) lauf(voll);
      else if (eintrag.name.endsWith('.js')) ergebnis.push(voll);
    }
  };
  lauf(path.join(WURZEL, ordner));
  return ergebnis;
}

describe('Keine Unicode-Emojis in Backend-Texten', () => {
  it('routes, services und utils sind emojifrei', () => {
    const treffer = [];
    for (const ordner of ORDNER) {
      for (const datei of dateienSammeln(ordner)) {
        const zeilen = fs.readFileSync(datei, 'utf8').split('\n');
        zeilen.forEach((zeile, i) => {
          if (EMOJI.test(zeile)) {
            treffer.push(`${path.relative(WURZEL, datei)}:${i + 1}  ${zeile.trim().slice(0, 80)}`);
          }
        });
      }
    }
    expect(treffer, `Emojis gefunden:\n${treffer.join('\n')}`).toEqual([]);
  });
});
