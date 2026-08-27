import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund 28.08.2026, am Geraet nachgestellt: App geschlossen -> Zahl am Icon
// da und zaehlt sauber hoch. App geoeffnet -> kurz die richtige Zahl. App zu
// und wieder auf -> KEINE Zahl mehr, waehrend die Reiter in der App weiter
// richtig zaehlten.
//
// Ursache, zweiteilig:
//  1. AppContext ruft beim Aktiv-werden fuer Admins removeAllDelivered().
//     removeAllDeliveredNotifications() raeumt auf iOS nicht nur die
//     Mitteilungszentrale auf, es setzt auch die Zahl am App-Icon auf null.
//  2. Der Badge-Effekt in BadgeContext haengt an [totalBadgeCount] und feuert
//     NICHT, wenn sich der Wert nicht geaendert hat. Das Icon blieb also leer,
//     bis zufaellig eine andere Zahl hereinkam.
//
// Geprueft wird die Verdrahtung an der Quelle: ein Render-Test muesste
// Capacitor, das Badge-Plugin und den ganzen Context nachbauen und wuerde
// gerade die Kopplung nicht abdecken, um die es hier geht.

const lies = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf-8');

describe('Icon-Zahl ueberlebt das Aufraeumen der Mitteilungen', () => {
  it('AppContext meldet nach removeAllDelivered ein Resync', () => {
    const s = lies('contexts/AppContext.tsx');
    // Verbotener Fall: aufraeumen ohne Nachsetzen -- so war es vor dem Fix.
    expect(s).not.toMatch(/removeAllDelivered\(\);\s*\n\s*\}/);
    // Erlaubter Fall: das Signal geht raus, egal ob das Aufraeumen klappt.
    expect(s).toContain("removeAllDelivered().finally(");
    expect(s).toContain("new CustomEvent('badge:resync')");
  });

  it('BadgeContext hoert auf das Signal und setzt die Zahl neu', () => {
    const s = lies('contexts/BadgeContext.tsx');
    expect(s).toContain("window.addEventListener('badge:resync'");
    expect(s).toContain("window.removeEventListener('badge:resync'");
    // Die Setz-Logik liegt in einer eigenen Funktion, damit Effekt UND Signal
    // denselben Weg nehmen -- sonst laufen beide auseinander.
    expect(s).toContain('setzeGeraeteBadge');
  });

  it('das Aufraeumen bleibt auf Leitungskonten beschraenkt', () => {
    // Gegenprobe: Konfis und Teamer:innen duerfen ihre Erinnerungen behalten,
    // daran aendert der Fix nichts.
    const s = lies('contexts/AppContext.tsx');
    expect(s).toContain("if (user?.type === 'admin') {");
  });
});
