// Tests fuer den semantischen Versionsvergleich des Store-Update-Hinweises.
//
// Der wichtigste Fall steht zuerst: "2.10.0" > "2.9.0" ist als STRING falsch
// ("1" < "9") — genau daran wuerde der Update-Hinweis ab Version 2.10
// dauerhaft verstummen. Dazu die Grenzfaelle: gleich, aelter, fehlende
// Segmente und unplausible Eingaben.
import { describe, it, expect } from 'vitest';
import { vergleicheVersionen, istNeuereVersion } from '../../utils/versionVergleich';

describe('vergleicheVersionen', () => {
  it('2.10.0 ist NEUER als 2.9.0 (semantisch, nicht als String)', () => {
    expect(vergleicheVersionen('2.10.0', '2.9.0')).toBe(1);
    expect(vergleicheVersionen('2.9.0', '2.10.0')).toBe(-1);
  });

  it('gleiche Versionen ergeben 0', () => {
    expect(vergleicheVersionen('2.1.1', '2.1.1')).toBe(0);
  });

  it('aelter/neuer in jeder Stelle', () => {
    expect(vergleicheVersionen('3.0.0', '2.9.9')).toBe(1);
    expect(vergleicheVersionen('2.2.0', '2.1.9')).toBe(1);
    expect(vergleicheVersionen('2.1.2', '2.1.1')).toBe(1);
    expect(vergleicheVersionen('1.9.9', '2.0.0')).toBe(-1);
  });

  it('fehlende Segmente zaehlen als 0: "2.1" === "2.1.0"', () => {
    expect(vergleicheVersionen('2.1', '2.1.0')).toBe(0);
    expect(vergleicheVersionen('2.1.1', '2.1')).toBe(1);
    expect(vergleicheVersionen('2', '2.0.1')).toBe(-1);
  });

  it('Leerzeichen am Rand stoeren nicht', () => {
    expect(vergleicheVersionen(' 2.1.1 ', '2.1.1')).toBe(0);
  });
});

describe('istNeuereVersion', () => {
  it('true nur, wenn die Store-Version echt neuer ist', () => {
    expect(istNeuereVersion('2.2.0', '2.1.1')).toBe(true);
    expect(istNeuereVersion('2.10.0', '2.9.0')).toBe(true);
    expect(istNeuereVersion('2.1.1', '2.1.1')).toBe(false);
    // Store aelter als installiert (TestFlight/interner Build): kein Hinweis
    expect(istNeuereVersion('2.1.0', '2.1.1')).toBe(false);
  });

  it('false bei fehlenden Werten (Server meldet version=null)', () => {
    expect(istNeuereVersion(null, '2.1.1')).toBe(false);
    expect(istNeuereVersion('2.2.0', undefined)).toBe(false);
    expect(istNeuereVersion('', '2.1.1')).toBe(false);
  });

  it('false bei unplausiblen Strings statt Zufallsergebnis', () => {
    expect(istNeuereVersion('Varies with device', '2.1.1')).toBe(false);
    expect(istNeuereVersion('2.2.0-beta', '2.1.1')).toBe(false);
    expect(istNeuereVersion('2.2.0', 'kaputt')).toBe(false);
  });
});
