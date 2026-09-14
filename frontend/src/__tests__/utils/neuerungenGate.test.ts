import { describe, it, expect } from 'vitest';
import { aufMinorKuerzen, entscheideNeuerungen } from '../../utils/neuerungenGate';

// Die Kernentscheidung der Aenderungsanzeige, ohne Speicher und ohne React.
// Der Hook-Test (hooks/useOnboardingWithUpdate.test.tsx) prueft, dass sie
// richtig verdrahtet ist; hier stehen die Faelle selbst.

describe('aufMinorKuerzen', () => {
  it('schneidet den Patch ab', () => {
    expect(aufMinorKuerzen('2.2.0')).toBe('2.2');
    expect(aufMinorKuerzen('2.1.1')).toBe('2.1');
    expect(aufMinorKuerzen('2.2.17')).toBe('2.2');
  });

  it('ergaenzt ein fehlendes Minor-Segment', () => {
    expect(aufMinorKuerzen('3')).toBe('3.0');
    expect(aufMinorKuerzen('2.2')).toBe('2.2');
  });

  it('rechnet zweistellige Minor-Versionen richtig', () => {
    // '2.10' als String waere kleiner als '2.9' -- genau der Fehler, der die
    // Anzeige ab Version 2.10 dauerhaft stummschalten wuerde.
    expect(aufMinorKuerzen('2.10.3')).toBe('2.10');
  });

  it('weist alles zurueck, was keine Version ist', () => {
    expect(aufMinorKuerzen(null)).toBeNull();
    expect(aufMinorKuerzen(undefined)).toBeNull();
    expect(aufMinorKuerzen('')).toBeNull();
    expect(aufMinorKuerzen('zwei-punkt-zwei')).toBeNull();
    expect(aufMinorKuerzen('2.2.0-beta')).toBeNull();
  });
});

describe('entscheideNeuerungen', () => {
  it('2.1.1 -> 2.2.0: zeigen, und 2.2 vermerken', () => {
    expect(entscheideNeuerungen('2.2.0', '2.1', false)).toEqual({
      art: 'zeigen',
      merkeVersion: '2.2',
    });
  });

  it('Neuinstallation: nichts zeigen, aber still vermerken', () => {
    // Wer die App zum ersten Mal oeffnet, will loslegen -- und soll beim
    // NAECHSTEN Start nicht nachtraeglich lesen muessen, was sich gegenueber
    // einer Version geaendert hat, die er nie hatte.
    expect(entscheideNeuerungen('2.2.0', null, true)).toEqual({
      art: 'still',
      merkeVersion: '2.2',
    });
  });

  it('Neuinstallation zeigt auch dann nichts, wenn ein alter Merker herumliegt', () => {
    expect(entscheideNeuerungen('2.2.0', '2.1', true)).toEqual({
      art: 'still',
      merkeVersion: '2.2',
    });
  });

  it('2.2.0 Build 187 -> Build 188: nichts zeigen, nichts vermerken', () => {
    // Die Build-Nummer steht nicht in der Version. Verglichen wird auf
    // Minor-Ebene, sonst meldete sich die Anzeige bei Beta-Tester:innen nach
    // jedem TestFlight-Build.
    expect(entscheideNeuerungen('2.2.0', '2.2', false)).toEqual({
      art: 'still',
      merkeVersion: null,
    });
  });

  it('2.2.0 -> 2.2.1: ein Patch ist keine Neuerung', () => {
    expect(entscheideNeuerungen('2.2.1', '2.2', false)).toEqual({
      art: 'still',
      merkeVersion: null,
    });
  });

  it('Bestandsgeraet ohne Merker: zeigen', () => {
    // Onboarding lief, aber es gibt noch keinen Merker -- ein Geraet, das die
    // App vor 2.2.0 benutzt hat. Genau der Fall, fuer den sie gebaut ist.
    expect(entscheideNeuerungen('2.2.0', null, false)).toEqual({
      art: 'zeigen',
      merkeVersion: '2.2',
    });
  });

  it('Sprung ueber eine Version (2.0 -> 2.2): zeigen', () => {
    expect(entscheideNeuerungen('2.2.0', '2.0', false)).toEqual({
      art: 'zeigen',
      merkeVersion: '2.2',
    });
  });

  it('naechste Hauptversion (2.2 -> 3.0): zeigen', () => {
    expect(entscheideNeuerungen('3.0.0', '2.2', false)).toEqual({
      art: 'zeigen',
      merkeVersion: '3.0',
    });
  });

  it('2.9 -> 2.10 ist ein Sprung nach VORN, nicht zurueck', () => {
    expect(entscheideNeuerungen('2.10.0', '2.9', false)).toEqual({
      art: 'zeigen',
      merkeVersion: '2.10',
    });
  });

  it('Zurueckgerollte Version: nichts zeigen, Merker nicht zuruecksetzen', () => {
    // Kommt bei TestFlight vor. Der Merker soll NICHT zurueckfallen, sonst
    // meldet sich die Anzeige beim naechsten Vorwaertssprung ein zweites Mal.
    expect(entscheideNeuerungen('2.1.1', '2.2', false)).toEqual({
      art: 'still',
      merkeVersion: null,
    });
  });

  it('ohne ermittelbare Version passiert gar nichts', () => {
    // Lieber keine Anzeige als eine auf Basis von Datenmuell -- und vor allem
    // nichts vermerken, sonst gilt eine Version als gesehen, die nie lief.
    for (const kaputt of [null, undefined, '', 'unbekannt']) {
      expect(entscheideNeuerungen(kaputt, '2.1', false)).toEqual({
        art: 'still',
        merkeVersion: null,
      });
    }
  });

  it('kaputter Merker zaehlt wie kein Merker: zeigen', () => {
    expect(entscheideNeuerungen('2.2.0', 'kaputt', false)).toEqual({
      art: 'zeigen',
      merkeVersion: '2.2',
    });
  });
});
