import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';
import {
  hintergrundFuer,
  zweitbildFuer,
  alleMotive,
  KACHEL_MOTIV,
  KACHEL_ZWEITMOTIV,
  MOTIV_DATEI
} from '../../components/wrapped/hintergrundbilder';

// Simons Wunsch (02.09.2026): "Es sollten auch Stockbilder im Hintergrund
// sein. Mehr Bilder, mehr Design."
//
// Die Technik stammt aus seinem Entwurf: zwei weich maskierte, unscharfe
// Bildformen in gegenüberliegenden Ecken, darüber der Farbschleier der
// Seite. Nicht flächig -- ein Vollbild-Foto zwänge zu einer harten
// Abdunklung, und dann sähe man vom Bild ohnehin nichts mehr.

describe('Hintergrundbilder des Jahresrückblicks', () => {
  it('liefert für bebilderte Kacheln einen Pfad', () => {
    expect(hintergrundFuer('intro')).toBeTruthy();
    expect(hintergrundFuer('highlight')).toBeTruthy();
    expect(hintergrundFuer('events')).toBeTruthy();
  });

  it('lässt Zahlen-Kacheln bewusst ohne Bild', () => {
    // Dort trägt die große Zahl die Seite. Ein Bild würde mit ihr um
    // dieselbe Aufmerksamkeit konkurrieren.
    expect(hintergrundFuer('punkte')).toBeNull();
    expect(hintergrundFuer('abschluss')).toBeNull();
    // Die Momente-Seite zeigt echte Fotos der Konfis -- die brauchen keinen
    // zweiten Bildhintergrund.
    expect(hintergrundFuer('challenge-momente')).toBeNull();
  });

  it('gibt unbekannten Kacheln kein Bild, statt zu werfen', () => {
    expect(hintergrundFuer('gibt-es-nicht')).toBeNull();
    expect(zweitbildFuer('gibt-es-nicht')).toBeNull();
  });

  it('nimmt oben und unten nie dasselbe Motiv', () => {
    // Zweimal dasselbe Bild wirkt wie ein Fehler, nicht wie Absicht.
    for (const kachel of Object.keys(KACHEL_MOTIV)) {
      const oben = KACHEL_MOTIV[kachel];
      const unten = KACHEL_ZWEITMOTIV[kachel];
      if (oben && unten) {
        expect(unten, `Kachel "${kachel}"`).not.toBe(oben);
      }
    }
  });

  it('hat für jede bebilderte Kachel auch ein zweites Motiv', () => {
    // Der Entwurf legt immer zwei Formen übereinander. Fehlte die zweite,
    // wirkte die Seite gegenüber den anderen flach.
    for (const kachel of Object.keys(KACHEL_MOTIV)) {
      expect(zweitbildFuer(kachel), `Kachel "${kachel}"`).toBeTruthy();
    }
  });

  it('liefert nur Dateien, die auch wirklich ausgeliefert werden', () => {
    // Ein fehlendes Bild fiele erst auf dem Gerät auf -- als leere Fläche
    // hinter dem Text.
    for (const pfad of alleMotive()) {
      const datei = resolve(process.cwd(), 'public' + pfad);
      expect(existsSync(datei), `fehlt: ${pfad}`).toBe(true);
    }
  });

  it('benutzt WebP', () => {
    // 640 KB für alle sieben Motive statt 1,8 MB als JPEG (gemessen
    // 02.09.2026). Die Bilder gehen in jeden App-Build.
    for (const pfad of Object.values(MOTIV_DATEI)) {
      expect(pfad.endsWith('.webp')).toBe(true);
    }
  });

  it('liefert die Bilder aus der App, nicht aus dem Netz', () => {
    // Der Rückblick muss auch offline vollständig sein. Ein Bild von einem
    // fremden Server wäre im Funkloch eine leere Fläche -- und bei
    // Stock-Vorschau-URLs zusätzlich ein Lizenzproblem.
    for (const pfad of Object.values(MOTIV_DATEI)) {
      expect(pfad.startsWith('/assets/')).toBe(true);
      expect(pfad).not.toMatch(/^https?:/);
    }
  });
});
