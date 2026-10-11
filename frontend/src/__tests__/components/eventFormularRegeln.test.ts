// Regeln des Event-Formulars, aufgerufen (11.10.2026): Modal der App und
// Dialog der Web-Fassung rufen dieselben Funktionen
// (components/admin/modals/eventFormularRegeln.ts). Gerendert geprüft in
// termineWeb/webEventDialog*.test.tsx; hier die Grenzfälle, die das
// Formular selten erreicht.
import { describe, it, expect } from 'vitest';
import {
  letzterSerienTermin, lokaleZeit, mitAnmeldungAbSofort, mitKonfirmation, mitPflicht, mitSerie, mitSerienIntervall,
  mitSichtbarerAuswahl, mitUhrzeit, nachDatumswechsel, nachZielgruppe, plaetzeHoechstwert, serienHoechstzahl,
  verdeckteAuswahl, verfuegbarePunktearten,
} from '../../components/admin/modals/eventFormularRegeln';
import type { EventFormData } from '../../components/admin/modals/EventFormSections';

const formular = (teil: Partial<EventFormData> = {}): EventFormData => ({
  name: 'Konfi-Tag', description: '', event_date: '2026-10-10T18:00:00', event_end_time: '2026-10-10T20:00:00',
  location: '', points: 1, point_type: 'gemeinde', category_ids: [], jahrgang_ids: [], type: 'event',
  max_participants: 5, registration_opens_at: '', registration_closes_at: '2026-10-09T18:00:00',
  has_timeslots: true, waitlist_enabled: true, max_waitlist_size: 3, is_series: false, series_count: 1, series_interval: 'week',
  mandatory: true, is_konfirmation: true, bring_items: '', checkin_window: 30,
  teamer_max_participants: 0, teamer_waitlist_enabled: true, teamer_max_waitlist_size: 3,
  ...teil,
});

describe('Zielgruppe, Pflicht, Konfirmation', () => {
  it('„Nur Team" schaltet Pflicht, Konfirmation und Zeitfenster ab; die anderen Zugänge lassen das Formular, wie es ist', () => {
    const f = formular();
    expect(nachZielgruppe(f, 'teamer_only')).toEqual({ ...f, mandatory: false, is_konfirmation: false, has_timeslots: false });
    expect(nachZielgruppe(f, 'teamer_needed')).toBe(f);
    expect(nachZielgruppe(f, 'normal')).toBe(f);
  });

  it('Pflicht und Konfirmation an schalten Zeitfenster ab, aus lässt sie', () => {
    expect(mitPflicht(formular({ mandatory: false }), true)).toMatchObject({ mandatory: true, has_timeslots: false });
    expect(mitPflicht(formular(), false)).toMatchObject({ mandatory: false, has_timeslots: true });
    expect(mitKonfirmation(formular({ is_konfirmation: false }), true)).toMatchObject({ is_konfirmation: true, has_timeslots: false });
    expect(mitKonfirmation(formular(), false)).toMatchObject({ is_konfirmation: false, has_timeslots: true });
  });
});

describe('Serie', () => {
  it('Höchstzahl: monatlich 12, sonst 26; ein Wechsel auf monatlich kappt die Anzahl', () => {
    expect(serienHoechstzahl('month')).toBe(12);
    expect(serienHoechstzahl('2weeks')).toBe(26);
    expect(mitSerienIntervall(formular({ series_count: 20 }), 'month')).toMatchObject({ series_interval: 'month', series_count: 12 });
    expect(mitSerienIntervall(formular({ series_count: 20 }), 'day')).toMatchObject({ series_interval: 'day', series_count: 20 });
  });

  it('an hebt eine Anzahl unter 2 auf 2 und kappt eine zu große; aus lässt sie', () => {
    expect(mitSerie(formular({ series_count: 1 }), true)).toMatchObject({ is_series: true, series_count: 2 });
    expect(mitSerie(formular({ series_count: 20, series_interval: 'month' }), true)).toMatchObject({ is_series: true, series_count: 12 });
    expect(mitSerie(formular({ series_count: 1, is_series: true }), false)).toMatchObject({ is_series: false, series_count: 1 });
  });

  it('letzter Termin wie im Backend: täglich, wöchentlich, zweiwöchentlich, monatlich; ohne Serie keiner', () => {
    const f = (series_interval: string) => formular({ is_series: true, series_count: 3, series_interval });
    expect(letzterSerienTermin(f('day'))).toEqual(new Date(2026, 9, 12, 18, 0));
    expect(letzterSerienTermin(f('week'))).toEqual(new Date(2026, 9, 24, 18, 0));
    expect(letzterSerienTermin(f('2weeks'))).toEqual(new Date(2026, 10, 7, 18, 0));
    expect(letzterSerienTermin(f('month'))).toEqual(new Date(2026, 11, 10, 18, 0));
    expect(letzterSerienTermin(formular({ is_series: false }))).toBe(null);
    expect(letzterSerienTermin(formular({ is_series: true, event_date: '' }))).toBe(null);
  });
});

describe('Datum und Anmeldung', () => {
  it('neuer Beginn beim Anlegen: Ende mit gleicher Dauer, Anmeldeschluss neu', () => {
    expect(nachDatumswechsel(formular(), '2026-11-20T09:00:00', false)).toMatchObject({
      event_date: '2026-11-20T09:00:00', event_end_time: '2026-11-20T11:00:00', registration_closes_at: '2026-11-19T09:00:00',
    });
  });

  it('beim Bearbeiten bleibt der Anmeldeschluss', () => {
    expect(nachDatumswechsel(formular(), '2026-11-20T09:00:00', true)).toMatchObject({
      event_end_time: '2026-11-20T11:00:00', registration_closes_at: '2026-10-09T18:00:00',
    });
  });

  it('ein geleertes Datumsfeld setzt nur den Beginn -- kein „NaN" im Ende', () => {
    expect(nachDatumswechsel(formular(), '', false)).toEqual({ ...formular(), event_date: '' });
  });

  it('„Anmeldung ab sofort": an leert den Start, aus setzt jetzt (auf die Minute)', () => {
    expect(mitAnmeldungAbSofort(formular({ registration_opens_at: '2026-10-01T08:00:00' }), true).registration_opens_at).toBe('');
    expect(mitAnmeldungAbSofort(formular(), false, new Date(2026, 9, 3, 10, 37, 42)).registration_opens_at).toBe('2026-10-03T10:37:00');
  });
});

describe('Zeitfenster-Uhrzeiten', () => {
  it('Werte vom Server (UTC) werden zur Ortszeit, lokale bleiben', () => {
    expect(lokaleZeit('2026-10-16T15:00:00.000Z')).toBe('2026-10-16T17:00:00');
    expect(lokaleZeit('2026-10-16T15:00:00+00:00')).toBe('2026-10-16T17:00:00');
    expect(lokaleZeit('2026-10-16T17:00:00')).toBe('2026-10-16T17:00:00');
  });

  it('eine neue Uhrzeit behält den Tag des Zeitfensters; ohne lesbaren Tag gilt der des Events', () => {
    expect(mitUhrzeit('2026-10-16T15:00:00.000Z', '18:30', '2026-10-10T18:00:00')).toBe('2026-10-16T18:30:00');
    expect(mitUhrzeit('', '09:15', '2026-10-10T18:00:00')).toBe('2026-10-10T09:15:00');
  });
});

describe('Plätze und Punktearten', () => {
  it('die Plätze wachsen mit einem Bestandswert über 30 mit', () => {
    expect(plaetzeHoechstwert(12)).toBe(30);
    expect(plaetzeHoechstwert(50)).toBe(50);
  });

  it('eine Punkteart bleibt, solange sie in einem gewählten Jahrgang aktiv ist; ohne Jahrgang beide', () => {
    const jahrgaenge = [
      { id: 1, name: 'A', gottesdienst_enabled: false },
      { id: 2, name: 'B', gemeinde_enabled: false },
    ];
    expect(verfuegbarePunktearten([], jahrgaenge)).toEqual(['gottesdienst', 'gemeinde']);
    expect(verfuegbarePunktearten([1], jahrgaenge)).toEqual(['gemeinde']);
    expect(verfuegbarePunktearten([2], jahrgaenge)).toEqual(['gottesdienst']);
    expect(verfuegbarePunktearten([1, 2], jahrgaenge)).toEqual(['gottesdienst', 'gemeinde']);
  });
});

describe('Auswahl aus einer Liste, die nicht alles zeigt (Jahrgänge außerhalb der eigenen)', () => {
  it('die verdeckten Werte bleiben; erst die gezeigten in Listenfolge, dann die verdeckten', () => {
    // Gezeigt wird nur Jahrgang 1; das Event gehört auch Jahrgang 2.
    expect(mitSichtbarerAuswahl([1, 2], [1], [])).toEqual([2]);
    expect(mitSichtbarerAuswahl([2], [1], [1])).toEqual([1, 2]);
    expect(mitSichtbarerAuswahl([2, 1], [1, 3], [1, 3])).toEqual([1, 3, 2]);
    // Alles gezeigt: die Auswahl der Liste, nichts dazu.
    expect(mitSichtbarerAuswahl([1, 2], [1, 2], [2])).toEqual([2]);
    // Ein Wert, den die Liste nicht kennt, kommt über die Auswahl nicht herein.
    expect(mitSichtbarerAuswahl([], [1], [1, 9])).toEqual([1]);
  });

  it('verdeckt ist, was gewählt ist und die Liste nicht zeigt', () => {
    expect(verdeckteAuswahl([1, 2, 4], [1, 3])).toEqual([2, 4]);
    expect(verdeckteAuswahl([1], [1, 3])).toEqual([]);
    expect(verdeckteAuswahl([], [])).toEqual([]);
  });
});
