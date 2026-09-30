// Teamer: Zusage- und Absage-Knöpfe im Termin -- gerendert (Audit Tests
// 26.09.2026, BF-02; vorher Quelltext-Test, 30.09.2026 umgestellt).
//
// Simons Regel vom 05.09.2026, wörtlich:
//
//   "wenn ich noch nichts gesagt habe, beide knoepfe einer rot einer gruen
//    in line. wenn ich dann gruen gewaehlt habe, dann machst du doch nur
//    einen button. und zwar einen roten ich bin doch nicht dabei und
//    andersrum auch ich bin doch dabei. und mach bitte die buttons immer als
//    line buttons. nie vollfarbe ... und immer immer immer nur line buttons."
//
// Also:
//   noch nichts gewählt -> zwei Knöpfe: "Dabei" (grün) / "Nicht dabei" (rot)
//   zugesagt            -> EIN Knopf, rot:   "Nicht mehr dabei"
//   abgesagt            -> EIN Knopf, grün:  "Doch dabei"
//
// Früher standen die Knöpfe viermal im JSX (Kontingent frei, Warteliste
// offen, kein Platz mehr, bereits angemeldet) und liefen auseinander: Im
// Warteliste-Zweig und bei "kein Platz mehr frei" fehlte der Absage-Knopf.
// Der Quelltext-Test zählte deshalb die Aufrufstellen. Hier wird jeder der
// vier Fälle gerendert und geprüft, was dasteht.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  zustand, zuruecksetzen, termin, oeffneTermin, oeffneListe, zeileVon, zusageKarte,
} from './gerueste/teamerTerminSeite';
import { within } from '@testing-library/react';
import type { Event } from '../../types/event';
import { getStatusIcon } from '../../components/shared/StatusBadge';
import { ICON_ABSAGE } from '../../components/shared/icons';
import { zusageBeschriftung, absageBeschriftung } from '../../utils/zusageKnoepfe';

beforeEach(zuruecksetzen);

interface Knopf { text: string; fill: string | null; farbe: string | null; gesperrt: boolean }

const knoepfe = (): Knopf[] =>
  within(zusageKarte()!).queryAllByRole('button').map((k) => ({
    text: k.textContent ?? '',
    fill: k.getAttribute('data-fill'),
    farbe: k.getAttribute('data-color'),
    gesperrt: (k as HTMLButtonElement).disabled,
  }));

const mitTermin = async (zusatz: Partial<Event>) => {
  zustand.events = [termin(zusatz)];
  await oeffneTermin();
  return knoepfe();
};

const DABEI = { text: 'Dabei', fill: 'outline', farbe: 'success', gesperrt: false };
const NICHT_DABEI = { text: 'Nicht dabei', fill: 'outline', farbe: 'danger', gesperrt: false };

/** Kontingent voll: zwei von zwei Plätzen im Team vergeben. */
const VOLL: Partial<Event> = { teamer_max_participants: 2, teamer_count: 2 };

describe('Teamer: Zusage- und Absage-Knöpfe', () => {
  it('noch nichts gewählt: beide Knöpfe nebeneinander, "Dabei" grün und "Nicht dabei" rot', async () => {
    expect(await mitTermin({})).toEqual([DABEI, NICHT_DABEI]);
  });

  it('nach einer Zusage nur noch die Absage: "Nicht mehr dabei", rot', async () => {
    expect(await mitTermin({ is_registered: true, booking_status: 'confirmed' })).toEqual([
      { text: 'Nicht mehr dabei', fill: 'outline', farbe: 'danger', gesperrt: false },
    ]);
  });

  it('nach einer Absage nur noch die Zusage: "Doch dabei", grün', async () => {
    expect(await mitTermin({ booking_status: 'opted_out' })).toEqual([
      { text: 'Doch dabei', fill: 'outline', farbe: 'success', gesperrt: false },
    ]);
  });

  it('Kontingent voll, Warteliste offen: die Zusage heißt "Warteliste (1/3)", die Absage steht daneben', async () => {
    expect(await mitTermin({
      ...VOLL, teamer_waitlist_enabled: true, teamer_max_waitlist_size: 3, teamer_waitlist_count: 1,
    })).toEqual([{ ...DABEI, text: 'Warteliste (1/3)' }, NICHT_DABEI]);
  });

  it('kein Platz mehr frei (Warteliste aus): Zusagen gesperrt, Absagen weiter möglich', async () => {
    expect(await mitTermin({ ...VOLL, teamer_waitlist_enabled: false })).toEqual([
      { ...DABEI, gesperrt: true },
      NICHT_DABEI,
    ]);
  });

  it('offline: die Zusage ist gesperrt und sagt warum, die Absage bleibt', async () => {
    zustand.online = false;
    expect(await mitTermin({})).toEqual([
      { ...DABEI, text: 'Du bist offline', gesperrt: true },
      NICHT_DABEI,
    ]);
  });

  it('nie vollfarbig: in keinem der Fälle steht ein Knopf ohne Outline', async () => {
    const faelle: Array<Partial<Event>> = [
      {}, { is_registered: true, booking_status: 'confirmed' }, { booking_status: 'opted_out' },
      { ...VOLL, teamer_waitlist_enabled: true, teamer_max_waitlist_size: 3 }, { ...VOLL },
    ];
    for (const fall of faelle) {
      zuruecksetzen();
      zustand.events = [termin(fall)];
      const { unmount } = await oeffneTermin();
      const fuellungen = knoepfe().map((k) => k.fill);
      expect(fuellungen.length, JSON.stringify(fall)).toBeGreaterThan(0);
      expect(fuellungen.every((f) => f === 'outline'), JSON.stringify(fall)).toBe(true);
      unmount();
    }
  });

  it('die Beschriftungen kommen aus der gemeinsamen Quelle (auch für die Leitungssicht)', () => {
    expect(zusageBeschriftung('opted_out')).toBe('Doch dabei');
    expect(zusageBeschriftung(null)).toBe('Dabei');
    expect(zusageBeschriftung(null, 'Warteliste (1/3)')).toBe('Warteliste (1/3)');
    expect(absageBeschriftung('confirmed')).toBe('Nicht mehr dabei');
    expect(absageBeschriftung(null)).toBe('Nicht dabei');
  });
});

describe('Eck-Zeichen der eigenen Absage', () => {
  it('zeigt ein Symbol statt des langen Textes, benannt für Vorlesehilfen', async () => {
    expect(getStatusIcon('Abgesagt von dir')).toBe(ICON_ABSAGE);
    zustand.events = [termin({ booking_status: 'opted_out' })];
    await oeffneListe('alle');
    const badge = within(zeileVon('Konfi-Freizeit')).getByRole('img', { name: 'Abgesagt von dir' });
    // Symbol-Badge: kein ausgeschriebener Text im Badge selbst.
    expect(badge.textContent).toBe('');
  });
});
