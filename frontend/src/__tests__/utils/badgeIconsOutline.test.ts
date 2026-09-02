import { describe, it, expect } from 'vitest';
import { getIconFromString, ICON_MAP } from '../../utils/badgeIcons';
import { trophy } from 'ionicons/icons';

// Befund vom 02.09.2026 (Simon: "Die Badges-Seite sieht aus wie Müll, holt
// nicht die Icons"):
//
// 74 der 174 Abzeichen in der Datenbank heißen "sunny-outline",
// "musical-notes-outline" und so weiter. ICON_MAP kennt aber nur die
// Kurzform ("sunny"). Alle diese Abzeichen fielen deshalb stillschweigend auf
// die Trophäe zurück und sahen identisch aus — im Jahresrückblick wie in
// jeder anderen Liste. Kein Fehler im Log, nur ein falsches Bild.
//
// Korrigiert wird in getIconFromString, nicht in den Daten: Die Namen stehen
// in custom_badges über alle Gemeinden verteilt, und ausgelieferte
// App-Versionen lesen dieselben Werte.

describe('Abzeichen-Symbole: die -outline-Schreibweise', () => {
  it('findet das Symbol auch mit "-outline" am Ende', () => {
    const mitOutline = getIconFromString('sunny-outline');
    const ohne = getIconFromString('sunny');
    expect(mitOutline).toBe(ohne);
    expect(mitOutline).not.toBe(trophy);
  });

  it('funktioniert auch bei mehrteiligen Namen', () => {
    // Diese Schreibweise kommt in den echten Daten vor.
    expect(getIconFromString('musical-notes-outline')).toBe(getIconFromString('musical-notes'));
    expect(getIconFromString('color-palette-outline')).toBe(getIconFromString('color-palette'));
    expect(getIconFromString('stats-chart-outline')).toBe(getIconFromString('stats-chart'));
  });

  it('bleibt bei der Kurzform wie bisher', () => {
    // Gegenprobe: Der bisherige Weg darf sich nicht ändern.
    for (const name of Object.keys(ICON_MAP).slice(0, 10)) {
      expect(getIconFromString(name)).toBe(ICON_MAP[name]);
    }
  });

  it('nimmt die Trophäe nur, wenn es das Symbol wirklich nicht gibt', () => {
    expect(getIconFromString('gibt-es-nicht-outline')).toBe(trophy);
    expect(getIconFromString('gibt-es-nicht')).toBe(trophy);
    expect(getIconFromString(null)).toBe(trophy);
    expect(getIconFromString(undefined)).toBe(trophy);
  });

  it('erfindet kein Symbol, wenn nur der Rumpf zufällig passt', () => {
    // "-outline" wird abgeschnitten, sonst nichts. Ein Name, der ohne
    // Endung nicht in der Map steht, bleibt beim Fallback.
    expect(getIconFromString('sunny-solid')).toBe(trophy);
  });
});
