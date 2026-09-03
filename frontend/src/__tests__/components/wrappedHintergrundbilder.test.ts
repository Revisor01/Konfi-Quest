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

  it('JEDE Seite hat ein Bild — auch die Zahlen-Seiten', () => {
    // GEDREHT AM 03.09.2026 (Simon: "Wir wollten doch pro Seite ein
    // Hintergrundbild sehen. Ich verstehe das nicht: pro Wrapped-Seite.").
    //
    // Vorher blieben punkte, abschluss und challenge-momente bewusst ohne
    // Motiv — meine Begründung war, dass die große Zahl sonst mit dem Bild
    // konkurriert. Seit der Schleier abgestuft ist (unten dicht, oben
    // offen) trägt das nicht mehr: Die Zahl steht im abgedunkelten Bereich,
    // das Motiv darüber.
    for (const kachel of ['punkte', 'abschluss', 'challenge-momente',
      'endspurt', 'ueber-das-ziel', 'bonus', 'pflicht', 'seltenstes']) {
      expect(hintergrundFuer(kachel), `${kachel} ohne Hauptmotiv`).toBeTruthy();
      expect(zweitbildFuer(kachel), `${kachel} ohne Zweitmotiv`).toBeTruthy();
    }
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
