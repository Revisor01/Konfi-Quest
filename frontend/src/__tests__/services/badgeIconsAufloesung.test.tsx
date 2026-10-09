import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getIconFromIoniconsName, getIconFromString, istEmojiIcon, ICON_MAP, ICON_CHOICES } from '../../utils/badgeIcons';

// IonIcon sichtbar machen: Welches Symbol bekommt es?
vi.mock('@ionic/react', async () => {
  const echt = await vi.importActual<Record<string, unknown>>('@ionic/react');
  return { ...echt, IonIcon: ({ icon }: { icon?: string }) => <i className="symbol" data-icon={icon} /> };
});

import SeltenstesAbzeichenSlide from '../../components/wrapped/slides/SeltenstesAbzeichenSlide';
import BadgesSlide from '../../components/wrapped/slides/BadgesSlide';

afterEach(() => { cleanup(); vi.useRealTimers(); });

/** Aktiv rendern und die Hochzaehl-Animation bis zum Ende laufen lassen. */
async function aktivGerendert(element: React.ReactElement) {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  const r = render(element);
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  return r;
}

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

// WAECHTER (bewusst Quelltext): Bundle-Groesse. Ein Namespace-Import aendert
// kein Verhalten, nur das Gewicht jedes App-Starts -- das sieht nur die Quelle.
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
  const abzeichen = (icon: string) => ({ name: 'Notenschluessel', icon, color: '#123456', haben_es: 2, konfis: 40, prozent: 5 });

  it('unterscheidet Emoji und Ionicon', async () => {
    const { container } = await aktivGerendert(<SeltenstesAbzeichenSlide isActive abzeichen={abzeichen('ribbon-outline')} />);
    expect(container.querySelector('.selt-abzeichen-emoji')).toBeNull();
    expect(container.querySelector('.selt-abzeichen .symbol')!.getAttribute('data-icon')).toBe(getIconFromIoniconsName('ribbon-outline'));
  });

  it('gibt das Emoji nicht an IonIcon weiter -- es steht als Text in der Kachel', async () => {
    // IonIcon kann es nicht darstellen; als icon-Attribut bliebe die Kachel leer.
    const { container } = await aktivGerendert(<SeltenstesAbzeichenSlide isActive abzeichen={abzeichen('⛪')} />);
    expect(container.querySelector('.selt-abzeichen-emoji')!.textContent).toBe('⛪');
    expect(container.querySelectorAll('.selt-abzeichen .symbol')).toHaveLength(0);
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

// Emoji-Abzeichen im Jahresrückblick (Befund 18.09.2026)
//
// DER CHANGELOG VERSPRICHT ZU VIEL: "Abzeichen, für die ein Emoji gewählt
// wurde, zeigen im Rückblick das Emoji statt einer Trophäe." Beim Faktencheck
// der Änderungsanzeige kam heraus, dass das nur für EINE der beiden
// Abzeichen-Seiten gilt. SeltenstesAbzeichenSlide prüft mit istEmojiIcon und
// rendert das Zeichen als Text; BadgesSlide — ausgerechnet die Seite, auf der
// die gesammelten Abzeichen stehen — ruft getIconFromString auf, das Emojis
// gar nicht kennt und auf die Trophäe zurückfällt.
//
// Gerendert wird, was auf beiden Seiten in der Kachel steht: das Emoji als
// Text, ein Ionicon-Name als das gewaehlte Symbol.
describe('Emoji-Abzeichen im Rückblick', () => {
  it('getIconFromString kann keine Emojis — das ist der Grund für den Fehler', () => {
    // Kein Vorwurf an die Funktion: Sie liefert Ionicon-Namen. Der Test hält
    // fest, WARUM die Seiten den Emoji-Fall selbst behandeln müssen.
    expect(getIconFromString('🎸')).toBe(getIconFromString('gibt-es-nicht'));
  });

  it('istEmojiIcon erkennt Emoji und lässt Ionicon-Namen in Ruhe', () => {
    expect(istEmojiIcon('🎸')).toBe(true);
    expect(istEmojiIcon('⭐')).toBe(true);
    expect(istEmojiIcon('musical-notes')).toBe(false);
    expect(istEmojiIcon('sunny-outline')).toBe(false);
    expect(istEmojiIcon('')).toBe(false);
    expect(istEmojiIcon(null)).toBe(false);
  });

  it('BadgesSlide behandelt den Emoji-Fall — nicht nur die Seltenstes-Seite', async () => {
    const { container } = await aktivGerendert(
      <BadgesSlide isActive badges={{
        total_earned: 3,
        total_available: 10,
        badges: [
          { name: 'Gitarre', icon: '🎸', color: '#111111' },
          { name: 'Kirche', icon: '⛪', color: '#222222' },
          { name: 'Band', icon: 'ribbon', color: '#333333' },
        ],
      }} />,
    );
    const kacheln = Array.from(container.querySelectorAll('.w-abzeichen'));
    expect(kacheln.map((k) => k.getAttribute('title'))).toEqual(['Gitarre', 'Kirche', 'Band']);
    expect(kacheln.map((k) => k.querySelector('.w-abzeichen-emoji')?.textContent ?? null)).toEqual(['🎸', '⛪', null]);
    // Nur das Ionicon geht an IonIcon -- und zwar das gewaehlte, nicht die Trophaee.
    const symbole = container.querySelectorAll('.w-abzeichen .symbol');
    expect(symbole).toHaveLength(1);
    expect(symbole[0].getAttribute('data-icon')).toBe(getIconFromString('ribbon'));
  });

  it('SeltenstesAbzeichenSlide behandelt ihn weiterhin', async () => {
    const { container } = await aktivGerendert(
      <SeltenstesAbzeichenSlide isActive abzeichen={{ name: 'Gitarre', icon: '🎸', color: '#111111', haben_es: 1, konfis: 30, prozent: 3 }} />,
    );
    expect(container.querySelector('.selt-abzeichen')!.textContent).toBe('🎸');
  });
});
