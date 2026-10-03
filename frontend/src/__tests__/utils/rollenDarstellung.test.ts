import { describe, it, expect } from 'vitest';
import { personFarbe, rollenDarstellung } from '../../utils/rollenNamen';

/**
 * Eine Person -> Strich, Kreis, Eck-Marke, Schrift (02.10.2026, Paket 2.4.0,
 * Punkt 6). Simon: "aktuell ist es in der chat mitglieder liste nur im corner
 * badge, nicht vorne beim strich und kreis und da ist es auch noch falsch."
 *
 * Die Regel steht in utils/rollenNamen (rollenDarstellung); jede Personenliste
 * nimmt die Klassen von dort. Ob die Klassen die richtigen Tokens lesen, prueft
 * rollenFarben.test.ts gegen theme/variables.css.
 */

describe('rollenDarstellung: drei Rollen im Team, drei Farben an allen vier Stellen', () => {
  it('Gemeindeleitung: Indigo (--users)', () => {
    expect(rollenDarstellung({ role_name: 'org_admin' })).toEqual({
      farbe: 'users',
      strich: 'app-list-item--users',
      kreis: 'app-icon-circle--users',
      marke: 'app-corner-badge--users',
      schrift: 'app-rollen-schrift--users',
    });
  });

  it('Leitung: Petrol (--leitung)', () => {
    expect(rollenDarstellung({ role_name: 'admin' })).toEqual({
      farbe: 'leitung',
      strich: 'app-list-item--leitung',
      kreis: 'app-icon-circle--leitung',
      marke: 'app-corner-badge--leitung',
      schrift: 'app-rollen-schrift--leitung',
    });
  });

  it('Teamer:in: Beere (--teamer)', () => {
    expect(rollenDarstellung({ role_name: 'teamer' })).toEqual({
      farbe: 'teamer',
      strich: 'app-list-item--teamer',
      kreis: 'app-icon-circle--teamer',
      marke: 'app-corner-badge--teamer',
      schrift: 'app-rollen-schrift--teamer',
    });
  });

  it('Konfi: die Konfi-Klassen wie bisher', () => {
    expect(rollenDarstellung({ role_name: 'konfi' })).toEqual({
      farbe: 'konfis',
      strich: 'app-list-item--konfi',
      kreis: 'app-icon-circle--konfi',
      marke: 'app-corner-badge--konfi',
      schrift: 'app-rollen-schrift--konfis',
    });
  });

  it('keine zwei Team-Rollen teilen sich eine Klasse -- an keiner der vier Stellen', () => {
    const team = ['org_admin', 'admin', 'teamer'].map((r) => rollenDarstellung(r));
    for (const stelle of ['strich', 'kreis', 'marke', 'schrift'] as const) {
      expect(new Set(team.map((d) => d[stelle])).size, stelle).toBe(3);
    }
  });

  it('nimmt auch den Rollennamen direkt (Listen mit nur einer Rolle)', () => {
    expect(rollenDarstellung('org_admin')).toEqual(rollenDarstellung({ role_name: 'org_admin' }));
    expect(rollenDarstellung('admin').farbe).toBe('leitung');
  });
});

describe('personFarbe: die Rolle zuerst, der Typ nur ohne Rolle', () => {
  it('die Rolle schlaegt den Typ: Gemeindeleitung im Chat (user_type admin) bleibt Indigo', () => {
    expect(personFarbe({ role_name: 'org_admin', user_type: 'admin' })).toBe('users');
    expect(personFarbe({ role_name: 'admin', user_type: 'admin' })).toBe('leitung');
    expect(personFarbe({ role_name: 'teamer', type: 'admin' })).toBe('teamer');
  });

  it('ohne Rolle (aeltere Antwort): nach dem Typ -- admin ist Leitung, nicht mehr Beere', () => {
    expect(personFarbe({ user_type: 'admin' })).toBe('leitung');
    expect(personFarbe({ user_type: 'teamer' })).toBe('teamer');
    expect(personFarbe({ type: 'konfi' })).toBe('konfis');
    expect(personFarbe({ role_name: null, user_type: 'teamer' })).toBe('teamer');
  });

  it('weder Rolle noch bekannter Typ: neutral', () => {
    expect(personFarbe({})).toBe('neutral');
    expect(personFarbe({ type: 'gast' })).toBe('neutral');
    expect(rollenDarstellung(undefined).farbe).toBe('neutral');
    expect(rollenDarstellung(null).strich).toBe('app-list-item--neutral');
  });

  it('eine unbekannte Rolle faellt nicht auf den Typ zurueck: neutral', () => {
    expect(personFarbe({ role_name: 'super_admin', user_type: 'admin' })).toBe('neutral');
  });
});
