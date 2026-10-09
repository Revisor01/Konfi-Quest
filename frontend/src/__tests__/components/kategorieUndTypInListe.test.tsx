import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { zustand, zuruecksetzen, termin, oeffneListe, zeileVon } from './gerueste/teamerTerminSeite';
import { ionicNachtragen } from './gerueste/nachtragKopfzeileIonic';
import { kategorienText, zeigtPunkteart, punkteartText } from '../../components/shared/eventFormatting';
import type { Event } from '../../types/event';

// Nutzerhinweis 03.09.2026: In der Termin-GESAMTLISTE standen weder Kategorie
// noch Punkteart -- obwohl die Liste beides laengst mitliefert (GET /events
// gibt categories[] und category_names aus, point_type kommt ueber e.*).
// Im Detail waren beide Angaben da, in der Liste nicht.
//
// Die Fallen dabei:
//  1. "Typ" heisst im Detail point_type (Gottesdienst/Gemeinde), NICHT type
//     (Termin vs. Aktivitaet). Genau diese Verwechslung stand schon einmal
//     als Bug im Teamer-Detail und liess ueberall "Gemeinde" erscheinen.
//  2. Bei Pflicht-, Konfirmations- und reinen Team-Terminen gibt es keine
//     Konfi-Punkte. Das Detail blendet die Punkteart dort aus, sonst stand
//     dort irrefuehrend "Gemeinde". Die Liste muss dieselbe Regel anwenden.

// Seit 09.10.2026 gerendert (Audit Tests BF-02): Die drei Listen werden mit
// demselben Termin gezeichnet und ihre Zeilen gelesen. Bis dahin suchte
// dieser Test `kategorienText(event)` und Klassennamen im Quelltext; die
// Rueckgabe von GET /events prueft backend/tests/routes/terminlisteKategorien.test.js.

// Die Leitungsliste braucht zwei Ionic-Bausteine, die das Geruest nicht kennt.
type K = { children?: React.ReactNode };
await ionicNachtragen({
  IonSelect: ({ children }: K) => <div>{children}</div>,
  IonSelectOption: ({ children }: K) => <div>{children}</div>,
});

describe('kategorienText', () => {
  it('nimmt categories[] aus der Detail- und Listenantwort', () => {
    expect(kategorienText({ categories: [{ name: 'Freizeit' }, { name: 'Musik' }] }))
      .toBe('Freizeit, Musik');
  });

  it('faellt auf category_names zurueck, wenn categories fehlt', () => {
    expect(kategorienText({ category_names: 'Gottesdienst, Diakonie' }))
      .toBe('Gottesdienst, Diakonie');
  });

  it('bevorzugt categories[] gegenueber category_names', () => {
    expect(kategorienText({
      categories: [{ name: 'Freizeit' }],
      category_names: 'veraltet',
    })).toBe('Freizeit');
  });

  it('liefert leeren Text ohne Kategorien -- die Zeile entfaellt dann', () => {
    expect(kategorienText({})).toBe('');
    expect(kategorienText({ categories: [] })).toBe('');
    expect(kategorienText({ category_names: '   ' })).toBe('');
  });
});

describe('zeigtPunkteart -- gleiche Regel wie im Detail', () => {
  it('zeigt die Art bei einem normalen Termin mit Punkten', () => {
    expect(zeigtPunkteart({ points: 5 })).toBe(true);
  });

  it('verschweigt sie ohne Punkte', () => {
    expect(zeigtPunkteart({ points: 0 })).toBe(false);
    expect(zeigtPunkteart({})).toBe(false);
  });

  it('verschweigt sie bei Pflichtterminen', () => {
    expect(zeigtPunkteart({ points: 5, mandatory: true })).toBe(false);
  });

  it('verschweigt sie bei der Konfirmation', () => {
    expect(zeigtPunkteart({ points: 5, is_konfirmation: true })).toBe(false);
  });

  it('verschweigt sie bei reinen Team-Terminen', () => {
    expect(zeigtPunkteart({ points: 5, teamer_only: true })).toBe(false);
  });
});

describe('punkteartText', () => {
  it('nennt Gottesdienst beim Namen', () => {
    expect(punkteartText({ point_type: 'gottesdienst' })).toBe('Gottesdienst');
  });

  it('nennt Gemeinde beim Namen', () => {
    expect(punkteartText({ point_type: 'gemeinde' })).toBe('Gemeinde');
  });

  it('faellt ohne Angabe auf Gemeinde zurueck -- wie im Detail', () => {
    expect(punkteartText({})).toBe('Gemeinde');
  });
});

// --- Gerendert: die drei Listen ------------------------------------------------

/** Ein Termin mit Punkten, Ort und zwei Kategorien. Typ und Punkteart
 *  widersprechen sich absichtlich: Angezeigt werden muss die Punkteart. */
const mitAllem = (zusatz: Partial<Event> = {}): Event => termin({
  id: 31, name: 'Jugendgottesdienst', event_date: new Date(Date.now() + 5 * 864e5).toISOString(),
  points: 3, point_type: 'gemeinde', type: 'gottesdienst', location: 'St. Marien',
  categories: [{ id: 1, name: 'Freizeit' }, { id: 2, name: 'Musik' }],
  teamer_needed: false, teamer_only: false, mandatory: false, is_konfirmation: false,
  ...zusatz,
} as Partial<Event>);

const zeilenVon = (karte: HTMLElement) => [...karte.querySelectorAll('.app-list-item__meta')].map((z) => z.textContent?.replace(/\s+/g, ' ').trim() ?? '');

/** Was in der Punkte-Zeile direkt hinter "3P" steht (Eintraege der Zeile, in Reihenfolge). */
const hinterDenPunkten = (karte: HTMLElement) => [...karte.querySelectorAll('.app-list-item__meta')]
  .map((z) => [...z.querySelectorAll('.app-list-item__meta-item')].map((e) => e.textContent?.trim()))
  .filter((eintraege) => eintraege.includes('3P'))
  .map((eintraege) => eintraege[eintraege.indexOf('3P') + 1] ?? null);

const LISTEN: Array<[string, (e: Event) => Promise<HTMLElement>]> = [
  ['Leitung', async (e) => {
    const EventsView = (await import('../../components/admin/EventsView')).default;
    const { container } = render(<EventsView events={[e]} onSelectEvent={() => undefined} />);
    return container;
  }],
  ['Konfi', async (e) => {
    const EventsView = (await import('../../components/konfi/views/EventsView')).default;
    const { container } = render(<EventsView events={[e]} activeTab="alle" onTabChange={() => undefined} onSelectEvent={() => undefined} />);
    return container;
  }],
  ['Team', async (e) => {
    zustand.events = [e];
    await oeffneListe('alle');
    return zeileVon(e.name);
  }],
];

beforeEach(zuruecksetzen);

describe('Kategorie und Punkteart stehen in allen drei Listen', () => {
  it.each(LISTEN)('%s: die Liste zeigt die Kategorien, in einer Zeile nach dem Ort', async (_rolle, zeige) => {
    const zeilen = zeilenVon(await zeige(mitAllem()));
    const ort = zeilen.indexOf('St. Marien');
    const kategorie = zeilen.indexOf('Freizeit, Musik');
    expect(ort).toBeGreaterThan(-1);
    expect(kategorie).toBe(ort + 1);
  });

  it.each(LISTEN)('%s: ohne Kategorien entfaellt die Zeile', async (_rolle, zeige) => {
    const karte = await zeige(mitAllem({ categories: [] }));
    expect(karte.querySelector('.app-icon-color--category')).toBeNull();
  });

  it.each(LISTEN)('%s: die Punkteart steht direkt hinter den Punkten, aus point_type', async (_rolle, zeige) => {
    expect(hinterDenPunkten(await zeige(mitAllem()))).toEqual(['Gemeinde']);
  });

  it.each(LISTEN)('%s: Gottesdienst heisst Gottesdienst', async (_rolle, zeige) => {
    expect(hinterDenPunkten(await zeige(mitAllem({ point_type: 'gottesdienst', type: 'event' })))).toEqual(['Gottesdienst']);
  });

  it.each(LISTEN)('%s: beim Pflichttermin keine Punkteart (es gibt keine Konfi-Punkte)', async (_rolle, zeige) => {
    const zeilen = zeilenVon(await zeige(mitAllem({ mandatory: true, registration_status: 'mandatory' })));
    expect(zeilen.join(' | ')).not.toMatch(/Gemeinde|Gottesdienst/);
  });
});
