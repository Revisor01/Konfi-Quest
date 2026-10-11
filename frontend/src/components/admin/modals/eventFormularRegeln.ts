// Regeln des Event-Formulars, ohne Darstellung (11.10.2026, Simon: „Web
// braucht eigene kompaktere Modale überall").
//
// Das Formular gibt es zweimal: als Modal der App (EventModal mit den
// Abschnitten aus EventFormSections) und als Dialog der Web-Fassung
// (admin/web/termine/WebEventDialog). Was ein Schalter am Rest des
// Formulars ändert -- „Nur Team" schaltet Pflicht, Konfirmation und
// Zeitfenster ab, ein neues Datum zieht Ende und Anmeldeschluss mit --,
// steht deshalb hier, einmal, und beide Fassungen rufen es auf. Laden,
// Prüfen und Speichern stehen im Hook daneben (useEventFormular.ts).

import type { Jahrgang } from '../../../types/event';
import type { EventFormData } from './EventFormSections';
import { istPunkteartAktiv, type Punkteart } from '../../../utils/punktearten';
import { anmeldeschlussVorschlag, endeNachDatumswechsel, toIonDatetimeISO } from '../../../utils/terminVorbelegung';

/** „Für wen ist das Event?" -- die drei Zugänge des Formulars. */
export type TeamerZugang = 'normal' | 'teamer_needed' | 'teamer_only';

/**
 * Grenzen der Zahlenfelder, wie die Regler der App sie haben. Die Plätze
 * wachsen mit einem Bestandswert über 30 mit (siehe EventFormSections:
 * 6 von 186 Terminen in Produktion haben mehr als 30 Plätze).
 */
export const EVENT_GRENZEN = {
  punkte: { min: 1, max: 5 },
  plaetze: { min: 1, max: 30 },
  warteliste: { min: 1, max: 10 },
  team: { min: 1, max: 25 },
  zeitfensterPlaetze: { min: 1, max: 20 },
  checkin: { min: 5, max: 60, schritt: 5 },
  serie: { min: 2 },
} as const;

/** Die Plätze, die ein Bestandswert über der Vorgabe mitbringt, bleiben wählbar. */
export const plaetzeHoechstwert = (aktuell: number): number => Math.max(EVENT_GRENZEN.plaetze.max, aktuell);

/**
 * „Nur Team" schließt Pflicht-Event, Konfirmation und Zeitfenster aus: Pflicht
 * und Konfirmation sind Konfi-Kategorien und ergeben ohne Konfis keinen Sinn.
 * Die anderen Zugänge ändern am Formular nichts.
 */
export const nachZielgruppe = (formData: EventFormData, zugang: TeamerZugang): EventFormData =>
  zugang === 'teamer_only'
    ? { ...formData, mandatory: false, is_konfirmation: false, has_timeslots: false }
    : formData;

/** Pflicht-Event schließt Zeitfenster aus (fester Termin für den ganzen Jahrgang). */
export const mitPflicht = (formData: EventFormData, mandatory: boolean): EventFormData =>
  ({ ...formData, mandatory, ...(mandatory ? { has_timeslots: false } : {}) });

/** Konfirmation schließt Zeitfenster aus (feste Termine). */
export const mitKonfirmation = (formData: EventFormData, is_konfirmation: boolean): EventFormData =>
  ({ ...formData, is_konfirmation, ...(is_konfirmation ? { has_timeslots: false } : {}) });

/**
 * Höchstzahl einer Serie: zwölf Monate Spannweite (das Backend prüft
 * identisch). Monatlich also 12 Termine, sonst 26.
 */
export const serienHoechstzahl = (intervall: string): number => (intervall === 'month' ? 12 : 26);

/**
 * „Als Serie erstellen": an setzt die Anzahl auf mindestens 2 -- eine Serie
 * aus einem Event lehnt der Server ab („Serienanzahl (min. 2)"), und das
 * Formular beginnt mit 1. Die Web-Fassung nutzt das. Die App setzt bisher
 * nur den Schalter; ihr Regler zeigt dann 2, gespeichert würde 1, bis man
 * ihn bewegt.
 */
export const mitSerie = (formData: EventFormData, an: boolean): EventFormData => ({
  ...formData,
  is_series: an,
  ...(an ? { series_count: Math.min(Math.max(EVENT_GRENZEN.serie.min, formData.series_count), serienHoechstzahl(formData.series_interval)) } : {}),
});

/** Neues Intervall; beim Wechsel auf monatlich wird die Anzahl auf das 12-Monats-Limit gekappt. */
export const mitSerienIntervall = (formData: EventFormData, intervall: string): EventFormData => ({
  ...formData,
  series_interval: intervall,
  series_count: Math.min(formData.series_count, serienHoechstzahl(intervall)),
});

/** Der letzte Termin einer Serie -- dieselbe Datums-Logik wie das Backend. */
export const letzterSerienTermin = (formData: Pick<EventFormData, 'is_series' | 'event_date' | 'series_count' | 'series_interval'>): Date | null => {
  if (!formData.is_series || !formData.event_date) return null;
  const d = new Date(formData.event_date);
  if (isNaN(d.getTime())) return null;
  const steps = (formData.series_count || 2) - 1;
  if (formData.series_interval === 'day') d.setDate(d.getDate() + steps);
  else if (formData.series_interval === '2weeks') d.setDate(d.getDate() + steps * 14);
  else if (formData.series_interval === 'month') d.setMonth(d.getMonth() + steps);
  else d.setDate(d.getDate() + steps * 7);
  return d;
};

/**
 * Punktearten, die zur Auswahl stehen: Ein Termin gehört mehreren
 * Jahrgängen, eine Art bleibt wählbar, solange sie in MINDESTENS EINEM der
 * gewählten Jahrgänge aktiv ist. Ohne Jahrgang bleiben beide wählbar.
 */
export const verfuegbarePunktearten = (jahrgangIds: readonly number[], jahrgaenge: readonly Jahrgang[]): Punkteart[] => {
  const gewaehlte = jahrgaenge.filter((j) => jahrgangIds.includes(j.id));
  return (['gottesdienst', 'gemeinde'] as Punkteart[]).filter(
    (art) => gewaehlte.length === 0 || gewaehlte.some((j) => istPunkteartAktiv(j, art)),
  );
};

/**
 * Gewählte Werte, die die Liste nicht zeigt -- in der Reihenfolge der Auswahl.
 * Admins und Teamer:innen bekommen in GET /admin/jahrgaenge nur ihre eigenen
 * Jahrgänge; ein Event kann zusätzlich einem fremden gehören. Die Ankreuzliste
 * (WebMehrfachAuswahl) behält solche Werte beim Umschalten; der Dialog nennt sie.
 */
export const verdeckteAuswahl = (gewaehlt: readonly number[], gezeigt: readonly number[]): number[] => {
  const sichtbar = new Set(gezeigt);
  return gewaehlt.filter((id) => !sichtbar.has(id));
};

/**
 * Neuer Beginn: Das Ende wandert mit, die Dauer bleibt (Befund 17.09.2026).
 * Den Anmeldeschluss zieht nur das NEUANLEGEN mit -- beim Bearbeiten würde
 * ein Dreh am Datum still die gesetzten Anmeldezeiten überschreiben
 * (Datenverlust). „Ab sofort" (leeres registration_opens_at) bleibt immer.
 *
 * Ein leerer oder unlesbarer Wert (im Browser lässt sich das Feld leeren)
 * setzt nur den Beginn; die Prüfung beim Speichern sagt dann, was fehlt.
 */
export const nachDatumswechsel = (formData: EventFormData, neuerBeginn: string, bearbeiten: boolean): EventFormData => {
  const beginn = new Date(neuerBeginn);
  if (!neuerBeginn || isNaN(beginn.getTime())) return { ...formData, event_date: neuerBeginn };
  const ende = endeNachDatumswechsel(beginn, formData.event_date, formData.event_end_time);
  return {
    ...formData,
    event_date: neuerBeginn,
    event_end_time: toIonDatetimeISO(ende),
    ...(bearbeiten ? {} : { registration_closes_at: toIonDatetimeISO(anmeldeschlussVorschlag(beginn)) }),
  };
};

/**
 * „Anmeldung ab sofort": an heißt registration_opens_at leer; aus setzt
 * einen sinnvollen Startwert -- jetzt, auf die Minute.
 */
export const mitAnmeldungAbSofort = (formData: EventFormData, abSofort: boolean, jetzt: Date = new Date()): EventFormData => {
  if (abSofort) return { ...formData, registration_opens_at: '' };
  const pad = (n: number) => n.toString().padStart(2, '0');
  return {
    ...formData,
    registration_opens_at: `${jetzt.getFullYear()}-${pad(jetzt.getMonth() + 1)}-${pad(jetzt.getDate())}T${pad(jetzt.getHours())}:${pad(jetzt.getMinutes())}:00`,
  };
};

/**
 * Ein Zeitpunkt als lokale Zeichenkette ("…T18:30:00"), wie das Formular sie
 * hält. Zeitfenster eines bestehenden Events kommen vom Server mit Zeitzone
 * ("…T16:30:00.000Z"); das Uhrzeitfeld des Browsers zeigte sonst die Zeit in
 * UTC. Ohne Zeitzone bleibt der Wert, wie er ist.
 */
export const lokaleZeit = (wert: string): string => {
  if (!/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(wert)) return wert;
  const d = new Date(wert);
  return isNaN(d.getTime()) ? wert : toIonDatetimeISO(d);
};

/**
 * Neue Uhrzeit ("HH:MM") für einen Zeitpunkt; der Tag bleibt. Fehlt ein
 * lesbarer Tag, gilt der Tag des Events. So arbeitet auch der Uhrzeit-Wähler
 * der App: Er ändert die Uhrzeit, nicht den Tag.
 */
export const mitUhrzeit = (wert: string, uhrzeit: string, tagDesEvents: string): string => {
  const lokal = lokaleZeit(wert);
  const tag = /^\d{4}-\d{2}-\d{2}/.test(lokal) ? lokal.slice(0, 10) : tagDesEvents.slice(0, 10);
  return `${tag}T${uhrzeit}:00`;
};
