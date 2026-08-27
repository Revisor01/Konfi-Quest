// backend/tests/routes/dashboardDefaults.test.js
//
// Befund aus dem Dashboard/Profil-Durchgang (26.08.2026): Veraltete
// Fallback-Defaults in settings.js:82-83.
//
// Die Listen greifen nur, wenn der gespeicherte Wert KEIN gueltiges JSON ist
// -- also praktisch nie. Genau deshalb fiel nicht auf, dass sie veralteten:
// Es fehlten 'challenges' und 'konfispruch', beide laengst Teil der
// Dashboards. Wer in diesen Fall geriete, verloere sie stillschweigend.
//
// Massgeblich sind die Fallbacks der Dashboards selbst. Dieser Test haelt
// fest, dass beide Seiten DIESELBEN Abschnitte kennen -- welche Reihenfolge
// sie haben, ist Geschmackssache und wird bewusst NICHT festgeschrieben.
const { readFileSync } = require('fs');
const { resolve } = require('path');

const lies = (p) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

// Zieht eine String-Array-Literal-Liste aus dem Quelltext.
const listeNach = (quelle, marker) => {
  const start = quelle.indexOf(marker);
  expect(start, `Marker nicht gefunden: ${marker}`).toBeGreaterThan(-1);
  const klammerAuf = quelle.indexOf('[', start);
  const klammerZu = quelle.indexOf(']', klammerAuf);
  return quelle
    .slice(klammerAuf + 1, klammerZu)
    .split(',')
    .map((t) => t.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
};

describe('Dashboard-Fallbacks kennen dieselben Abschnitte', () => {
  const settings = lies('routes/settings.js');
  const konfi = lies('routes/konfi.js');
  const teamer = lies('routes/teamer.js');

  it('Konfi: settings.js deckt sich mit dem Dashboard', () => {
    const ausSettings = listeNach(settings, 'const DEFAULT_KONFI_ORDER');
    const ausDashboard = listeNach(konfi, 'section_order: sectionOrder ||');

    expect([...ausSettings].sort()).toEqual([...ausDashboard].sort());
    // Und die beiden Nachzuegler sind wirklich dabei:
    expect(ausSettings).toContain('challenges');
    expect(ausSettings).toContain('konfispruch');
  });

  it('Teamer: settings.js deckt sich mit dem Dashboard', () => {
    const ausSettings = listeNach(settings, 'const DEFAULT_TEAMER_ORDER');
    const ausDashboard = listeNach(teamer, 'config.section_order = teamerSectionOrder ||');

    expect([...ausSettings].sort()).toEqual([...ausDashboard].sort());
    expect(ausSettings).toContain('challenges');
    expect(ausSettings).toContain('konfispruch');
  });

  it('die beiden Rollen haben unterschiedliche Listen', () => {
    // Gegenprobe: Angleichen heisst nicht gleichmachen. Konfis haben
    // 'konfirmation' und 'ranking', Teamer:innen 'zertifikate'.
    const konfiListe = listeNach(settings, 'const DEFAULT_KONFI_ORDER');
    const teamerListe = listeNach(settings, 'const DEFAULT_TEAMER_ORDER');

    expect(konfiListe).toContain('konfirmation');
    expect(konfiListe).toContain('ranking');
    expect(teamerListe).toContain('zertifikate');
    expect(teamerListe).not.toContain('konfirmation');
  });
});
