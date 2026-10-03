import { describe, it, expect } from 'vitest';
import { TESTPHASE_KONFIS, limitNachUmschalten, limitVorgabe } from '../../utils/konfiLimitVorgabe';

// Simon, 03.10.2026: "Testphase 5 danach unbegrenzt. Das andere als Optionen
// solange es noch nicht von der EKD gekauft ist."

describe('Vorgabe des Konfi-Limits', () => {
  it('in der Testphase 5, wie auf der Startseite zugesagt', () => {
    expect(TESTPHASE_KONFIS).toBe(5);
    expect(limitVorgabe(true)).toBe('5');
  });

  it('danach unbegrenzt (leeres Feld)', () => {
    expect(limitVorgabe(false)).toBe('');
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
