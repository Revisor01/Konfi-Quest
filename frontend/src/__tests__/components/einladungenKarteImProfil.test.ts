import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildPushTargetUrl } from '../../utils/pushNavigation';

// Befund vom Geraet (Simon, 26.09.2026): Der Push zur Gemeinde-Einladung und
// der Eintrag im Postfach fuehrten bei der Leitung ins Profil -- die Karte mit
// der Einladung stand aber auf dem Reiter "Mehr". Wer dem Tipp folgte, fand
// nichts. Konfis und Team hatten die Karte laengst im Profil.
//
// Festgehalten wird deshalb beides zusammen: Das Ziel des Tipps ist fuer jede
// Rolle das Profil, und genau die Seite, die dort steht, traegt die Karte.

const wurzel = resolve(__dirname, '../../..');
const lies = (datei: string) => readFileSync(resolve(wurzel, datei), 'utf-8');

const profilSeiten: { rolle: string; userType: 'admin' | 'teamer' | 'konfi'; ziel: string; datei: string }[] = [
  { rolle: 'Leitung', userType: 'admin', ziel: '/admin/profile', datei: 'src/components/admin/pages/AdminProfilePage.tsx' },
  { rolle: 'Teamer:innen', userType: 'teamer', ziel: '/teamer/profile', datei: 'src/components/teamer/pages/TeamerProfilePage.tsx' },
  { rolle: 'Konfis', userType: 'konfi', ziel: '/konfi/profile', datei: 'src/components/konfi/views/ProfileView.tsx' },
];

describe('Gemeinde-Einladung: Tipp-Ziel und Karte liegen an derselben Stelle', () => {
  for (const { rolle, userType, ziel, datei } of profilSeiten) {
    it(`${rolle}: Push und Postfach fuehren nach ${ziel}`, () => {
      expect(buildPushTargetUrl('gemeinde_einladung', {}, userType)).toBe(ziel);
    });

    it(`${rolle}: die Profilseite traegt die Einladungskarte`, () => {
      const inhalt = lies(datei);
      expect(inhalt).toMatch(/import EinladungenKarte from '\.\.\/\.\.\/shared\/EinladungenKarte'/);
      expect(inhalt).toMatch(/<EinladungenKarte variante="/);
    });
  }

  it('Leitung: auf dem Reiter "Mehr" steht die Karte nicht (mehr)', () => {
    // Gegenprobe: Zwei Stellen waeren kein Fehler fuer die Nutzenden, aber der
    // Zustand vor dem 26.09.2026 war genau umgekehrt -- nur "Mehr", Profil leer.
    const inhalt = lies('src/components/admin/pages/AdminSettingsPage.tsx');
    expect(inhalt).not.toMatch(/<EinladungenKarte/);
    expect(inhalt).not.toMatch(/import EinladungenKarte/);
  });
});
