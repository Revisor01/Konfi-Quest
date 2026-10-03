import { describe, it, expect } from 'vitest';
import { TESTPHASE_KONFIS, limitNachUmschalten, limitVorgabe } from '../../utils/konfiLimitVorgabe';

// Simon, 03.10.2026: "Testphase 5 danach unbegrenzt. Das andere als Optionen
// solange es noch nicht von der EKD gekauft ist." Und dazu: "Die anderen
// Limits muessen aber erhalten bleiben. [...] die Leute waehlen ihre
// Wunsch[lizenz]!" -- nach der Testphase gilt die Wunschlizenz.

describe('Vorgabe des Konfi-Limits', () => {
  it('in der Testphase 5, wie auf der Startseite zugesagt', () => {
    expect(TESTPHASE_KONFIS).toBe(5);
    expect(limitVorgabe(true)).toBe('5');
  });

  it('danach ohne Wunschlizenz unbegrenzt (leeres Feld)', () => {
    expect(limitVorgabe(false)).toBe('');
  });

  it('danach die Konfi-Zahl der Wunschlizenz; in der Testphase trotzdem 5', () => {
    expect(limitVorgabe(false, '50')).toBe('50');
    expect(limitVorgabe(true, '50')).toBe('5');
  });
});

describe('Umschalten mit Wunschlizenz', () => {
  it.each([
    ['Testphase aus: 5 wird die Wunschlizenz', '5', true, false, '50', '50'],
    ['Testphase an: die Wunschlizenz wird 5', '50', false, true, '50', '5'],
    ['Testphase aus: ein anderer Tarif bleibt', '15', true, false, '50', '15'],
    ['Testphase an: unbegrenzt bleibt, wenn die Wunschlizenz eine Zahl hat', '', false, true, '50', ''],
  ])('%s', (_name, aktuell, war, ist, lizenz, erwartet) => {
    expect(limitNachUmschalten(aktuell, war, ist, lizenz)).toBe(erwartet);
  });
});

describe('Limit beim Umschalten zwischen Testphase und Lizenz', () => {
  it.each([
    ['Testphase aus: 5 wird unbegrenzt', '5', true, false, ''],
    ['Testphase an: unbegrenzt wird 5', '', false, true, '5'],
    ['Testphase aus: ein Tarif bleibt', '50', true, false, '50'],
    ['Testphase an: ein Tarif bleibt', '15', false, true, '15'],
    ['Testphase aus: ein eigenes Limit bleibt', '30', true, false, '30'],
    ['Lizenz bleibt Lizenz: 5 bleibt 5', '5', false, false, '5'],
    ['Testphase bleibt Testphase: unbegrenzt bleibt', '', true, true, ''],
    ['Leerraum um die Vorgabe zählt als Vorgabe', ' 5 ', true, false, ''],
  ])('%s', (_name, aktuell, war, ist, erwartet) => {
    expect(limitNachUmschalten(aktuell, war, ist)).toBe(erwartet);
  });
});
