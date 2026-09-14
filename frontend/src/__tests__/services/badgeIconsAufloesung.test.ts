import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getIconFromIoniconsName, istEmojiIcon, ICON_MAP, ICON_CHOICES } from '../../utils/badgeIcons';

// Aufloesung gespeicherter Icon-Namen (14.09.2026).
//
// Vorher zog badgeIcons.ts mit `import * as alleIonicons from 'ionicons/icons'`
// ALLE 1389 Symbole ins Start-Bundle — gemessen 1.978.519 Bytes roh /
// 447.574 gzip, 38 % des gesamten JS, geladen bei JEDEM App-Start, gebraucht
// von genau EINER Wrapped-Folie. Nach dem Umbau auf feste Tabellen:
// 1.292.676 roh / 273.329 gzip.
//
// Der Datenvertrag ist die eigentliche Gefahr an dieser Aenderung: Die Namen
// stehen in der Datenbank (custom_badges.icon, challenges.badge_icon,
// certificate_types.icon) und werden von ausgelieferten Apps gelesen. Die
// Liste unten ist deshalb gegen PRODUKTION gemessen (14.09.2026), nicht
// geraten.

const BESTAND_AUS_PRODUKTION = [
  'airplane', 'balloon', 'bicycle', 'boat', 'book-outline', 'brush', 'business',
  'calendar', 'calendar-number-outline', 'calendar-outline', 'card', 'chatbubbles',
  'checkmark-done-outline', 'clipboard', 'color-palette-outline', 'compass',
  'compass-outline', 'diamond', 'diamond-outline', 'fitness', 'fitness-outline',
  'flag', 'flag-outline', 'flame', 'flame-outline', 'flash', 'flash-outline',
  'footsteps', 'footsteps-outline', 'gift', 'gift-outline', 'git-compare-outline',
  'hand-left-outline', 'heart', 'heart-outline', 'home-outline', 'leaf', 'location',
  'map', 'medal', 'medal-outline', 'medkit', 'musical-notes', 'musical-notes-outline',
  'musicalNote', 'people', 'people-circle', 'people-outline', 'person', 'ribbon',
  'ribbon-outline', 'rocket', 'school', 'sparkles', 'star', 'star-outline',
  'stats-chart-outline', 'sunny', 'sunny-outline', 'telescope-outline', 'today',
  'trophy', 'trophy-outline', 'walk-outline', 'water',
];

// Ebenfalls gemessen: In denselben Spalten stehen Emoji.
const EMOJI_AUS_PRODUKTION = ['⛪', '📖', '🏆', '🙏', '💎', '🤝', '⚖️', '🌈', '👑', '🎯'];

describe('Gespeicherte Icon-Namen bleiben aufloesbar (Datenvertrag)', () => {
  const trophaee = ICON_MAP.trophy;

  it.each(BESTAND_AUS_PRODUKTION)('loest %s auf', (name) => {
    const aufgeloest = getIconFromIoniconsName(name);
    expect(typeof aufgeloest).toBe('string');
    expect(aufgeloest.length).toBeGreaterThan(0);
    // Der Fallback waere hier ein stiller Anzeigefehler: statt des gewaehlten
    // Symbols erschiene ueberall die Trophaee.
    //
    // 'trophy-outline' ist ausgenommen, weil es WIRKLICH dasselbe Glyph ist:
    // Im Nur-Kontur-Modus (06.09.2026) ist `trophy` als trophyOutline
    // importiert. Gleichheit ist hier also richtig, nicht der Fallback.
    if (name !== 'trophy' && name !== 'trophy-outline') {
      expect(aufgeloest).not.toBe(trophaee);
    }
  });

  it('faellt bei unbekannten Namen weiterhin auf die Trophaee zurueck', () => {
    expect(getIconFromIoniconsName('gibtesnicht')).toBe(trophaee);
    expect(getIconFromIoniconsName('')).toBe(trophaee);
    expect(getIconFromIoniconsName(null)).toBe(trophaee);
    expect(getIconFromIoniconsName(undefined)).toBe(trophaee);
  });

  it('achtet den eigenen Rueckfall, wenn einer uebergeben wird', () => {
    expect(getIconFromIoniconsName('gibtesnicht', ICON_MAP.ribbon)).toBe(ICON_MAP.ribbon);
  });
});

describe('Emoji werden durchgereicht statt auf die Trophaee zu fallen', () => {
  it.each(EMOJI_AUS_PRODUKTION)('erkennt %s als Emoji', (zeichen) => {
    expect(istEmojiIcon(zeichen)).toBe(true);
    // Durchgereicht, nicht ersetzt — vorher zeigte jedes dieser Abzeichen
    // eine Trophaee.
    expect(getIconFromIoniconsName(zeichen)).toBe(zeichen);
  });

  it('haelt Ionicons-Namen NICHT fuer Emoji', () => {
    for (const name of ['trophy', 'ribbon-outline', 'people-circle']) {
      expect(istEmojiIcon(name)).toBe(false);
    }
  });

  it('haelt Leeres nicht fuer Emoji', () => {
    expect(istEmojiIcon('')).toBe(false);
    expect(istEmojiIcon(null)).toBe(false);
    expect(istEmojiIcon(undefined)).toBe(false);
  });
});

describe('Die Icon-Bibliothek liegt nicht mehr komplett im Bundle', () => {
  const quelle = readFileSync(
    resolve(process.cwd(), 'src/utils/badgeIcons.ts'), 'utf8'
  );

  it('hat keinen Namespace-Import mehr', () => {
    // Die Gegenprobe zum gemessenen Gewinn: Ein `import * as` zieht alle 1389
    // Symbole zurueck ins Start-Bundle, ohne dass ein Test es sonst merkt.
    //
    // Nur echte Anweisungen am Zeilenanfang pruefen — die Datei ERKLAERT den
    // frueheren Import in drei Kommentaren, und die sollen dort stehen bleiben.
    const anweisungen = quelle
      .split('\n')
      .filter(z => /^\s*import\s+\*\s+as\s+\w+\s+from\s+['"]ionicons/.test(z));
    expect(anweisungen).toEqual([]);
  });

  it('nennt die gemessenen Zahlen in der Begruendung', () => {
    // Damit die naechste Aenderung weiss, was auf dem Spiel steht.
    expect(quelle).toContain('1.978.519');
  });
});

describe('Die Wrapped-Folie stellt Emoji als Text dar', () => {
  const slide = readFileSync(
    resolve(process.cwd(), 'src/components/wrapped/slides/SeltenstesAbzeichenSlide.tsx'), 'utf8'
  );

  it('unterscheidet Emoji und Ionicon', () => {
    expect(slide).toContain('istEmojiIcon(abzeichen.icon)');
  });

  it('gibt das Emoji nicht an IonIcon weiter', () => {
    // IonIcon kann es nicht darstellen; als icon-Attribut bliebe die Kachel leer.
    expect(slide).toContain('<span className="selt-abzeichen-emoji">');
  });
});

describe('Die Auswahl fuer Badges und Stempel', () => {
  // Simon, 14.09.2026: "Es geht darum das fuer Badges und Stempel eine
  // groessere passende Auswahl da sein soll. Das man einfach mehr Vielfalt
  // hat." 54 -> 95, also 41 neue.
  //
  // Die Zahl steht hier fest, damit ein versehentliches Entfernen auffaellt —
  // dasselbe Muster wie bei den zentralen Icons (zentraleIcons.test.ts). Wer
  // ergaenzt, zieht sie mit und schreibt die Begruendung dazu.
  it('haelt 95 Symbole bereit', () => {
    expect(Object.keys(ICON_CHOICES).length).toBe(95);
  });

  it('hat keine doppelten Schluessel-Bedeutungen mit gleichem Namen', () => {
    const namen = Object.values(ICON_CHOICES).map(w => w.name);
    expect(new Set(namen).size).toBe(namen.length);
  });

  it('ordnet jedes Symbol einer Kategorie zu', () => {
    for (const [schluessel, wert] of Object.entries(ICON_CHOICES)) {
      expect(wert.category, schluessel).toBeTruthy();
      expect(wert.name, schluessel).toBeTruthy();
      expect(typeof wert.icon, schluessel).toBe('string');
    }
  });

  it('verteilt sich auf die neun Kategorien, keine bleibt leer', () => {
    // Die Auswahl-Dialoge gruppieren automatisch nach category; eine leere
    // Kategorie gaebe es dort gar nicht, eine ueberladene waere unbrauchbar.
    const kategorien = new Set(Object.values(ICON_CHOICES).map(w => w.category));
    expect(kategorien.size).toBe(9);
    for (const k of kategorien) {
      const anzahl = Object.values(ICON_CHOICES).filter(w => w.category === k).length;
      expect(anzahl, k).toBeGreaterThanOrEqual(5);
    }
  });

  it('bleibt bei den bisherigen Schluesseln — sie sind Datenvertrag', () => {
    // Umbenennen braeche die Anzeige in ausgelieferten Apps: In der Datenbank
    // steht der Schluessel, nicht das Glyph.
    for (const alt of ['trophy', 'medal', 'ribbon', 'star', 'heart', 'people',
                       'book', 'sunny', 'calendar', 'home', 'flag', 'medkit']) {
      expect(ICON_CHOICES[alt], alt).toBeDefined();
    }
  });
});
