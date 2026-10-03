// Die Lizenzen an einer Stelle (utils/lizenzen.js, 03.10.2026) -- und alle,
// die dieselbe Liste kennen, halten mit ihr Schritt: die Tarif-Stufen der
// Limit-Pruefung, der CHECK der Migration 192 und die Startseite (Preise und
// Auswahl im Anfrageformular). Die Oberflaeche prueft ihre Liste selbst
// gegen diese (frontend/src/__tests__/utils/lizenzen.test.ts).
const fs = require('fs');
const path = require('path');
const { LIZENZEN, LIZENZ_SCHLUESSEL } = require('../../utils/lizenzen');
const { TARIF_STUFEN } = require('../../utils/konfiLimit');

const lies = (...teile) => fs.readFileSync(path.join(__dirname, '..', '..', '..', ...teile), 'utf8');

describe('Lizenzen', () => {
  it('Klein 15, Standard 50, Plus 75, Groß 100, Verbund ohne feste Konfi-Zahl', () => {
    expect(LIZENZEN.map((l) => [l.schluessel, l.name, l.konfis, l.euro])).toEqual([
      ['klein', 'Klein', 15, 49],
      ['standard', 'Standard', 50, 99],
      ['plus', 'Plus', 75, 139],
      ['gross', 'Groß', 100, 179],
      ['verbund', 'Verbund', null, 390],
    ]);
  });

  it('die Konfi-Zahlen sind die Tarif-Stufen der Limit-Prüfung', () => {
    expect(LIZENZEN.filter((l) => l.konfis !== null).map((l) => l.konfis)).toEqual(TARIF_STUFEN);
  });

  it('der CHECK der Migration 192 nennt genau diese Schlüssel', () => {
    const sql = lies('backend', 'migrations', '192_anfrage_wunschlizenz.sql');
    const liste = sql.match(/wunsch_lizenz IN \(([^)]*)\)/)[1];
    expect([...liste.matchAll(/'([a-z]+)'/g)].map((m) => m[1])).toEqual(LIZENZ_SCHLUESSEL);
  });

  it('die Preisübersicht der Startseite nennt dieselben Namen, Grenzen und Preise', () => {
    const html = lies('frontend', 'public', 'landing.html');
    const karten = [...html.matchAll(/<div class="tier">([^<]+)<\/div><div class="scope">([^<]+)<\/div><div class="amt">(\d+)&nbsp;€<\/div>/g)]
      .map((m) => [m[1], m[2], Number(m[3])]);
    expect(karten).toEqual(LIZENZEN.map((l) => [l.name, l.konfis === null ? 'bis 4 Gemeinden' : `bis ${l.konfis} Konfis`, l.euro]));
  });

  it('das Anfrageformular bietet genau diese Lizenzen an, dazu „Noch offen“', () => {
    const html = lies('frontend', 'public', 'landing.html');
    const auswahl = html.match(/<select id="anfrage-lizenz" name="wunsch_lizenz"[^>]*>([\s\S]*?)<\/select>/)[1];
    const werte = [...auswahl.matchAll(/<option value="([a-z]*)"/g)].map((m) => m[1]);
    expect(werte).toEqual(['', ...LIZENZ_SCHLUESSEL]);
  });
});
