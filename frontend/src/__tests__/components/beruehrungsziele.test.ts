import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht BF-13: Beruehrungsziele unter 44 px -- das Auge
// am Passwortfeld (19 px), das X der Neuigkeiten-Karte (32 px), die
// Chat-Knoepfe (38 px). Apple HIG und WCAG 2.5.5 verlangen 44 px.
//
// Loesung ohne Optik-Aenderung: .app-beruehrungsziel legt ein unsichtbares
// ::after von mindestens 44 x 44 px mittig ueber den Knopf; Treffer darauf
// gehen an den Knopf. Gemessen mit Playwright/Chromium gegen Vite bei 393 px
// (elementFromPoint, Schrittweite 1 px): Auge 20 x 20 -> 44 x 45, X 32 x 32
// -> 44 x 44, Chat-Anhang 24 x 48 -> 44 x 48, Chat-Senden 39 x 48 -> 44 x 48,
// Fehler-X 12 x 21 -> 44 x 44; die Layout-Boxen blieben unveraendert.
//
// jsdom rechnet kein Layout -- dieser Test haelt fest, dass die Regel steht
// und jede der Stellen die Klasse traegt. Faellt die Klasse an einer Stelle
// weg, wird sie wieder klein, ohne dass es jemand sieht.
// ---------------------------------------------------------------------------

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

describe('Beruehrungsziele mindestens 44 px (UI BF-13)', () => {
  const css = lies('src/theme/barrierefreiheit.css');

  it('die Regel: unsichtbares ::after von max(100%, 44px), mittig, absolut', () => {
    expect(css).toMatch(/\.app-beruehrungsziel\s*\{[^}]*position:\s*relative/);
    const after = css.match(/\.app-beruehrungsziel::after\s*\{([^}]*)\}/);
    expect(after).not.toBeNull();
    const regel = after![1];
    expect(regel).toMatch(/content:\s*''/);
    expect(regel).toMatch(/position:\s*absolute/);
    expect(regel).toMatch(/width:\s*max\(100%,\s*44px\)/);
    expect(regel).toMatch(/height:\s*max\(100%,\s*44px\)/);
    expect(regel).toMatch(/transform:\s*translate\(-50%,\s*-50%\)/);
  });

  it('Auge und Fehler-X auf allen Anmeldeseiten tragen die Klasse', () => {
    for (const datei of ['LoginView', 'KonfiRegisterPage', 'ResetPasswordPage']) {
      const quelle = lies(`src/components/auth/${datei}.tsx`);
      const knoepfe = quelle.match(/className="app-auth-(?:input__toggle|error__close)[^"]*"/g) ?? [];
      expect(knoepfe.length).toBeGreaterThan(0);
      const ohne = knoepfe.filter((k) => !k.includes('app-beruehrungsziel'));
      expect(ohne, datei).toEqual([]);
    }
  });

  it('das X der Neuigkeiten-Karte traegt die Klasse', () => {
    expect(lies('src/components/shared/UpdateHinweisKarte.tsx')).toContain('className="app-whatsnew__close app-beruehrungsziel"');
  });

  it('Anhaengen und Senden im Chat tragen die Klasse', () => {
    const quelle = lies('src/components/chat/ChatRoomSections.tsx');
    expect(quelle).toContain('<IonButton aria-label="Datei anhängen" className="app-beruehrungsziel"');
    // Der Senden-Knopf: das IonButton unmittelbar vor dem onPointerDown-Schutz.
    const senden = quelle.slice(quelle.lastIndexOf('<IonButton', quelle.indexOf('onPointerDown={(e) => e.preventDefault()}')));
    expect(senden.startsWith('<IonButton className="app-beruehrungsziel"')).toBe(true);
  });

  it('zehn Stellen insgesamt -- die Liste aus dem Bericht plus die Fehler-Kreuze', () => {
    const dateien = [
      'src/components/auth/LoginView.tsx', 'src/components/auth/KonfiRegisterPage.tsx', 'src/components/auth/ResetPasswordPage.tsx',
      'src/components/shared/UpdateHinweisKarte.tsx', 'src/components/chat/ChatRoomSections.tsx',
    ];
    const summe = dateien.reduce((n, d) => n + (lies(d).match(/app-beruehrungsziel/g) ?? []).length, 0);
    expect(summe).toBe(10);
  });
});
