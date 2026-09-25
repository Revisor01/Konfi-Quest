import { describe, it, expect, vi } from 'vitest';
import { zeitpunktText, oeffnePostfach, POSTFACH_OEFFNEN_EVENT } from '../../utils/postfach';
import { buildPushTargetUrl } from '../../utils/pushNavigation';

describe('zeitpunktText -- wann kam die Mitteilung', () => {
  const jetzt = new Date('2026-09-25T12:00:00.000Z');

  it('unter einer Minute: gerade eben', () => {
    expect(zeitpunktText('2026-09-25T11:59:30.000Z', jetzt)).toBe('gerade eben');
  });

  it('Minuten und Stunden', () => {
    expect(zeitpunktText('2026-09-25T11:55:00.000Z', jetzt)).toBe('vor 5 Min.');
    expect(zeitpunktText('2026-09-25T09:00:00.000Z', jetzt)).toBe('vor 3 Std.');
  });

  it('gestern: erst, wenn es laenger als 24 Stunden her ist -- davor zaehlen die Stunden', () => {
    // Gestern 23 Uhr um 12 Uhr mittags ist 13 Stunden her: "vor 13 Std." sagt
    // mehr als "gestern". Gestern 8 Uhr ist 28 Stunden her -- dann "gestern".
    const spaetGestern = new Date(jetzt); spaetGestern.setDate(spaetGestern.getDate() - 1); spaetGestern.setHours(23, 0, 0, 0);
    const jetztOrt = new Date(jetzt); jetztOrt.setHours(12, 0, 0, 0);
    expect(zeitpunktText(spaetGestern.toISOString(), jetztOrt)).toBe('vor 13 Std.');

    const fruehGestern = new Date(jetztOrt); fruehGestern.setDate(fruehGestern.getDate() - 1); fruehGestern.setHours(8, 0, 0, 0);
    expect(zeitpunktText(fruehGestern.toISOString(), jetztOrt)).toBe('gestern');
  });

  it('aelter: das Datum', () => {
    expect(zeitpunktText('2026-09-01T08:00:00.000Z', jetzt)).toBe('01.09.2026');
  });

  it('kaputte Angabe: leer statt "Invalid Date"', () => {
    expect(zeitpunktText('kein Datum', jetzt)).toBe('');
  });
});

describe('oeffnePostfach', () => {
  it('feuert das Fenster-Ereignis, auf das das Postfach hoert', () => {
    const gehoert = vi.fn();
    window.addEventListener(POSTFACH_OEFFNEN_EVENT, gehoert);
    oeffnePostfach();
    expect(gehoert).toHaveBeenCalledTimes(1);
    window.removeEventListener(POSTFACH_OEFFNEN_EVENT, gehoert);
  });
});

describe('Die beiden Postfach-Mitteilungen zum Antrag haben ein Ziel', () => {
  // activity_request_submitted und activity_request_decision kamen nie als
  // Push und standen deshalb bis zum 25.09.2026 nicht in buildPushTargetUrl.
  // Das Postfach navigiert ueber dieselbe Funktion -- ohne Ziel liefe der
  // Tipp ins Leere.
  it.each(['activity_request_submitted', 'activity_request_decision'])('%s fuehrt in die Antragsliste der Rolle', (typ) => {
    expect(buildPushTargetUrl(typ, { request_id: 5 }, 'konfi')).toBe('/konfi/requests');
    expect(buildPushTargetUrl(typ, { request_id: 5 }, 'teamer')).toBe('/teamer/requests');
    expect(buildPushTargetUrl(typ, { request_id: 5 }, 'admin')).toBe('/admin/requests');
  });
});
