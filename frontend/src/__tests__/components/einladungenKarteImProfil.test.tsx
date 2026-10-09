// Gerüst zuerst: es registriert die Attrappen, bevor die Seiten geladen werden.
import { zuruecksetzen, profilOeffnen, mehrOeffnen, type Rolle } from './gerueste/profileDreiRollen';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { buildPushTargetUrl } from '../../utils/pushNavigation';

// Befund vom Geraet (Simon, 26.09.2026): Der Push zur Gemeinde-Einladung und
// der Eintrag im Postfach fuehrten bei der Leitung ins Profil -- die Karte mit
// der Einladung stand aber auf dem Reiter "Mehr". Wer dem Tipp folgte, fand
// nichts. Konfis und Team hatten die Karte laengst im Profil.
//
// Festgehalten wird deshalb beides zusammen: Das Ziel des Tipps ist fuer jede
// Rolle das Profil, und genau die Seite, die dort steht, traegt die Karte.
// Seit dem 09.10.2026 gerendert (vorher am Quelltext der Seiten).

beforeEach(zuruecksetzen);
afterEach(() => cleanup());

const profilSeiten: { rolle: string; userType: Rolle; ziel: string; variante: string }[] = [
  { rolle: 'Leitung', userType: 'admin', ziel: '/admin/profile', variante: 'users' },
  { rolle: 'Teamer:innen', userType: 'teamer', ziel: '/teamer/profile', variante: 'teamer' },
  { rolle: 'Konfis', userType: 'konfi', ziel: '/konfi/profile', variante: 'purple' },
];

describe('Gemeinde-Einladung: Tipp-Ziel und Karte liegen an derselben Stelle', () => {
  for (const { rolle, userType, ziel, variante } of profilSeiten) {
    it(`${rolle}: Push und Postfach fuehren nach ${ziel}`, () => {
      expect(buildPushTargetUrl('gemeinde_einladung', {}, userType)).toBe(ziel);
    });

    it(`${rolle}: die Profilseite traegt die Einladungskarte`, async () => {
      await profilOeffnen(userType);
      const karten = screen.getAllByTestId('einladungskarte');
      expect(karten).toHaveLength(1);
      expect(karten[0].getAttribute('data-variante')).toBe(variante);
    });
  }

  it('Leitung: auf dem Reiter "Mehr" steht die Karte nicht (mehr)', async () => {
    // Gegenprobe: Zwei Stellen waeren kein Fehler fuer die Nutzenden, aber der
    // Zustand vor dem 26.09.2026 war genau umgekehrt -- nur "Mehr", Profil leer.
    await mehrOeffnen();
    // Die Seite steht wirklich da (sonst pruefte das Fehlen der Karte nichts).
    expect(screen.getByText('App-Tour ansehen')).toBeTruthy();
    expect(screen.queryByTestId('einladungskarte')).toBeNull();
  });
});
