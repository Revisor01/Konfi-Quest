import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// "Anmelden (null/4)" (16.09.2026).
//
// An einem Termin, zu dem sich noch niemand angemeldet hatte, stand auf dem
// Anmelde-Knopf in der Konfi-Detailansicht "Anmelden (null/4)".
//
// Die Ursache lag im Backend (die Zaehler kamen als null an) und ist dort
// behoben. Die Ansicht rechnete die Zahl aber ungeschuetzt in den
// Knopftext -- waehrend die Wartelisten-Zeile direkt darunter seit jeher
// `|| 0` schreibt. Ausgelieferte App-Fassungen lesen weiterhin aeltere
// Server-Staende, also muss auch die Ansicht die Luecke schliessen.
//
// Geprueft wird die Quelle, nicht das gerenderte Bauteil: Die Ansicht haengt
// an IonPage/Router/AppContext, ein Render-Test waere hier teurer als
// aussagekraeftig (dasselbe Vorgehen wie in teamerBuchungOnlinePflicht).

const quelle = readFileSync(
  resolve(__dirname, '../../components/konfi/views/EventDetailView.tsx'),
  'utf-8'
);

// Genau die Rechnung, die der Knopf anstellt -- einmal ungeschuetzt (so war
// es) und einmal abgesichert (so ist es).
const knopfTextAlt = (e: { registered_count: number | null; max_participants: number }) =>
  `Anmelden (${e.registered_count}/${e.max_participants})`;
const knopfText = (e: { registered_count: number | null; max_participants: number }) =>
  `Anmelden (${e.registered_count || 0}/${e.max_participants})`;

describe('Anmelde-Knopf an einem Termin ohne Buchung', () => {
  it('zeigt 0 statt null, wenn der Zaehler fehlt', () => {
    expect(knopfText({ registered_count: null, max_participants: 4 })).toBe('Anmelden (0/4)');
  });

  it('GEGENPROBE: ungeschuetzt entstuende genau der gemeldete Text', () => {
    expect(knopfTextAlt({ registered_count: null, max_participants: 4 })).toBe('Anmelden (null/4)');
  });

  it('laesst eine echte Zahl unveraendert', () => {
    expect(knopfText({ registered_count: 3, max_participants: 4 })).toBe('Anmelden (3/4)');
  });

  it('die Ansicht schreibt den Knopftext abgesichert', () => {
    expect(quelle).toContain('`Anmelden (${eventData.registered_count || 0}/${eventData.max_participants})`');
    // Die ungeschuetzte Fassung darf nicht zurueckkehren.
    expect(quelle).not.toContain('`Anmelden (${eventData.registered_count}/${eventData.max_participants})`');
  });

  it('auch die Bedingungen davor und danach lesen den Zaehler abgesichert', () => {
    // Bei null waere `null < 4` in JS true (null wird zu 0) -- der
    // Anmelde-Zweig wurde also betreten, und genau dort entstand der Text.
    expect(quelle).toContain('(eventData.registered_count || 0) < eventData.max_participants');
    expect(quelle).toContain('(eventData.registered_count || 0) >= eventData.max_participants');
  });

  it('die Wartelisten-Zeile bleibt abgesichert', () => {
    // Das Muster, dem der Knopf jetzt folgt -- es darf nicht verschwinden.
    expect(quelle).toContain('${eventData.waitlist_count || 0}');
  });
});
