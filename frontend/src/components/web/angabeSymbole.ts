// Angaben stehen in der Web-Fassung immer mit Symbol (Simon, 07.10.2026: „da
// meine ich sollten icons rein. wie in der app", „also angaben immer mit
// icons"). Eine Tabelle fuer alle Seiten: Bezeichnung -> Symbol und Farbe,
// nach den Zeilen der App (app-info-row, app-icon-color--*). WebAngaben liest
// sie selbst; eine Seite gibt nur dann ein Symbol mit, wenn die Bezeichnung
// vom Inhalt abhaengt (der Konfispruch heisst nach seiner Bibelstelle) oder
// der Wert es bestimmt (Typ: Gottesdienst oder Gemeinde).
//
// Fehlt eine Bezeichnung hier, steht ein neutrales Info-Symbol da -- mit
// data-symbol="ersatz", damit die Tests der Seiten es finden.

import {
  ICON_ABZEICHEN_GEFUELLT,
  ICON_ALBEN,
  ICON_BUCH_GEFUELLT,
  ICON_CHALLENGE_GEFUELLT,
  ICON_DATEI_GEFUELLT,
  ICON_ENTSPERRT,
  ICON_FLAMME_GEFUELLT,
  ICON_GEMEINDE_GEFUELLT,
  ICON_GOTTESDIENST_GEFUELLT,
  ICON_GRUPPE_GEFUELLT,
  ICON_INFO_GEFUELLT,
  ICON_JAHRGANG_GEFUELLT,
  ICON_KATEGORIE_GEFUELLT,
  ICON_LISTE,
  ICON_MAIL_GEFUELLT,
  ICON_MATERIAL,
  ICON_ORGANISATION_GEFUELLT,
  ICON_ORT_GEFUELLT,
  ICON_PERSON_GEFUELLT,
  ICON_POKAL_GEFUELLT,
  ICON_QRCODE,
  ICON_SCHILD_GEFUELLT,
  ICON_SCHUTZ_GEFUELLT,
  ICON_SICHTBAR_GEFUELLT,
  ICON_STATISTIK_GEFUELLT,
  ICON_TELEFON,
  ICON_TERMIN_GEFUELLT,
  ICON_UHRZEIT_GEFUELLT,
  ICON_VERBORGEN_GEFUELLT,
  ICON_WARTEND_GEFUELLT,
  ICON_WELT,
  ICON_ZUSAGE_GEFUELLT,
} from '../shared/icons';

export interface AngabeSymbol {
  icon: string;
  /** Farbe als Klasse der App (app-icon-color--...). */
  klasse: string;
}

const s = (icon: string, farbe: string): AngabeSymbol => ({ icon, klasse: `app-icon-color--${farbe}` });

export const ANGABE_SYMBOLE: Readonly<Record<string, AngabeSymbol>> = {
  // Zeit
  Datum: s(ICON_TERMIN_GEFUELLT, 'events'),
  Uhrzeit: s(ICON_UHRZEIT_GEFUELLT, 'time'),
  Zeitfenster: s(ICON_UHRZEIT_GEFUELLT, 'time'),
  Zeitraum: s(ICON_TERMIN_GEFUELLT, 'challenges'),
  Laufzeit: s(ICON_UHRZEIT_GEFUELLT, 'challenges'),
  'Dabei seit': s(ICON_TERMIN_GEFUELLT, 'konfis'),
  'Erstellt am': s(ICON_TERMIN_GEFUELLT, 'system'),
  Eingegangen: s(ICON_TERMIN_GEFUELLT, 'system'),
  'Erreicht am': s(ICON_TERMIN_GEFUELLT, 'badges'),
  Konfirmationstermin: s(ICON_FLAMME_GEFUELLT, 'konfis'),
  Konfispruch: s(ICON_BUCH_GEFUELLT, 'konfis'),

  // Events
  Anmeldung: s(ICON_ENTSPERRT, 'events'),
  'Teilnehmer:innen': s(ICON_GRUPPE_GEFUELLT, 'participants'),
  Teilnehmende: s(ICON_GRUPPE_GEFUELLT, 'participants'),
  Anwesend: s(ICON_ZUSAGE_GEFUELLT, 'participants'),
  Team: s(ICON_GRUPPE_GEFUELLT, 'team'),
  'Team-Zugang': s(ICON_GRUPPE_GEFUELLT, 'team'),
  Warteliste: s(ICON_LISTE, 'waitlist'),
  'Team-Warteliste': s(ICON_LISTE, 'waitlist'),
  Kategorien: s(ICON_KATEGORIE_GEFUELLT, 'category'),
  Ort: s(ICON_ORT_GEFUELLT, 'location'),
  'Pflicht-Event': s(ICON_SCHUTZ_GEFUELLT, 'events'),
  'Pflicht-Events': s(ICON_SCHUTZ_GEFUELLT, 'events'),
  'Check-in-Fenster': s(ICON_QRCODE, 'events'),
  Mitbringen: s(ICON_MATERIAL, 'bring'),
  Material: s(ICON_DATEI_GEFUELLT, 'material'),
  'Event-Serie': s(ICON_TERMIN_GEFUELLT, 'events'),
  Event: s(ICON_TERMIN_GEFUELLT, 'events'),
  Events: s(ICON_TERMIN_GEFUELLT, 'events'),

  // Punkte und Auszeichnungen
  Punkte: s(ICON_POKAL_GEFUELLT, 'points'),
  'Punkte gesamt': s(ICON_POKAL_GEFUELLT, 'points'),
  Gesamt: s(ICON_POKAL_GEFUELLT, 'points'),
  Bonuspunkte: s(ICON_POKAL_GEFUELLT, 'points'),
  Gottesdienst: s(ICON_GOTTESDIENST_GEFUELLT, 'gottesdienst'),
  Fortschritt: s(ICON_STATISTIK_GEFUELLT, 'points'),
  Badges: s(ICON_ABZEICHEN_GEFUELLT, 'badges'),
  Zertifikate: s(ICON_SCHILD_GEFUELLT, 'teamer'),

  // Challenges
  Status: s(ICON_INFO_GEFUELLT, 'system'),
  Stempel: s(ICON_CHALLENGE_GEFUELLT, 'challenges'),
  Zielgruppe: s(ICON_GRUPPE_GEFUELLT, 'challenges'),
  'Sichtbar für': s(ICON_GRUPPE_GEFUELLT, 'challenges'),
  Sichtbarkeit: s(ICON_SICHTBAR_GEFUELLT, 'challenges'),
  Freigabe: s(ICON_SCHUTZ_GEFUELLT, 'challenges'),
  'Gestellt von': s(ICON_PERSON_GEFUELLT, 'challenges'),
  'Antwort mit': s(ICON_ALBEN, 'challenges'),
  'Beiträge je Person': s(ICON_ALBEN, 'challenges'),
  Beiträge: s(ICON_ALBEN, 'challenges'),
  'Beiträge im Feed': s(ICON_ALBEN, 'challenges'),
  'Meine Beiträge': s(ICON_ALBEN, 'challenges'),
  'Warten auf Freigabe': s(ICON_WARTEND_GEFUELLT, 'warning'),
  Abgelehnt: s(ICON_VERBORGEN_GEFUELLT, 'danger'),

  // Personen und Gemeinde
  Name: s(ICON_PERSON_GEFUELLT, 'users'),
  Benutzername: s(ICON_PERSON_GEFUELLT, 'konfis'),
  Rolle: s(ICON_SCHUTZ_GEFUELLT, 'users'),
  Funktion: s(ICON_PERSON_GEFUELLT, 'users'),
  'Erstellt von': s(ICON_PERSON_GEFUELLT, 'system'),
  Verantwortlich: s(ICON_PERSON_GEFUELLT, 'users'),
  'E-Mail': s(ICON_MAIL_GEFUELLT, 'users'),
  Mobilnummer: s(ICON_TELEFON, 'users'),
  Jahrgang: s(ICON_JAHRGANG_GEFUELLT, 'jahrgang'),
  'Jahrgänge': s(ICON_JAHRGANG_GEFUELLT, 'jahrgang'),
  Konfis: s(ICON_GRUPPE_GEFUELLT, 'konfis'),
  Gemeinde: s(ICON_GEMEINDE_GEFUELLT, 'gemeinde'),
  'Gemeinde laut Formular': s(ICON_GEMEINDE_GEFUELLT, 'gemeinde'),
  Kirchenkreis: s(ICON_ORGANISATION_GEFUELLT, 'organizations'),
  Landeskirche: s(ICON_WELT, 'organizations'),
  'Eingegangen über': s(ICON_MAIL_GEFUELLT, 'system'),
  Wunschlizenz: s(ICON_SCHILD_GEFUELLT, 'organizations'),
  'Ungefähre Zahl': s(ICON_GRUPPE_GEFUELLT, 'konfis'),
};

export const ERSATZ_SYMBOL: AngabeSymbol = s(ICON_INFO_GEFUELLT, 'muted');

/** Das Symbol zu einer Bezeichnung; ohne Eintrag das neutrale Ersatzsymbol. */
export const angabeSymbol = (label: string): { symbol: AngabeSymbol; ersatz: boolean } => {
  const treffer = ANGABE_SYMBOLE[label];
  return treffer ? { symbol: treffer, ersatz: false } : { symbol: ERSATZ_SYMBOL, ersatz: true };
};
