import { describe, it, expect } from 'vitest';
import {
  anlegenFehler,
  anlegenKoerper,
  anlegenVorbelegen,
  benutzernameVorschlag,
  kirchenkreisFinden,
  landeskircheFinden,
  passwortRegelFehler,
  type AnlegenFormular,
} from '../../utils/supportAnfragen';
import type { GemeindeAnfrage, Kirchenkreis } from '../../types/support';

// Aus einer Anfrage der Homepage wird mit wenigen Schritten eine Gemeinde
// samt erster Gemeindeleitung (Web-Version, Entscheidung 4). Hier: die
// Vorbelegung, die Pruefung vor dem Absenden und der Koerper an den Server.

const KREISE: Kirchenkreis[] = [
  { id: 11, name: 'Kirchenkreis Dithmarschen', landeskirche_id: 1, landeskirche: 'Nordkirche' },
  { id: 12, name: 'Mitte', landeskirche_id: 1, landeskirche: 'Nordkirche' },
  { id: 21, name: 'Mitte', landeskirche_id: 2, landeskirche: 'EKM' },
  { id: 31, name: 'Plön-Segeberg', landeskirche_id: null, landeskirche: null },
];

describe('kirchenkreisFinden', () => {
  it.each([
    ['Dithmarschen', 11],
    ['Kirchenkreis Dithmarschen', 11],
    ['  kirchenkreis   DITHMARSCHEN ', 11],
    ['Ev.-Luth. Kirchenkreis Dithmarschen', 11],
    ['Ploen-Segeberg', 31],
  ])('"%s" findet %s', (text, id) => {
    expect(kirchenkreisFinden(text, null, KREISE)?.id).toBe(id);
  });

  it('gleicher Name in zwei Landeskirchen: die Landeskirche der Anfrage entscheidet', () => {
    expect(kirchenkreisFinden('Mitte', 'EKM', KREISE)?.id).toBe(21);
    expect(kirchenkreisFinden('Mitte', 'nordkirche', KREISE)?.id).toBe(12);
  });

  it('mehrdeutig ohne passende Landeskirche: nichts vorwaehlen', () => {
    expect(kirchenkreisFinden('Mitte', null, KREISE)).toBeNull();
    expect(kirchenkreisFinden('Mitte', 'Bayern', KREISE)).toBeNull();
  });

  it('leer oder unbekannt: nichts', () => {
    expect(kirchenkreisFinden('', null, KREISE)).toBeNull();
    expect(kirchenkreisFinden(null, null, KREISE)).toBeNull();
    expect(kirchenkreisFinden('Steinburg', null, KREISE)).toBeNull();
  });
});

describe('landeskircheFinden', () => {
  it('ohne Gross/klein und Leerraum', () => {
    expect(landeskircheFinden(' NORDKIRCHE ', [{ id: 1, name: 'Nordkirche' }])?.id).toBe(1);
    expect(landeskircheFinden('Bayern', [{ id: 1, name: 'Nordkirche' }])).toBeNull();
  });
});

describe('benutzernameVorschlag', () => {
  it.each([
    ['Anna Beispiel', 'anna.beispiel'],
    ['Pastorin Anna Müller', 'anna.mueller'],
    ['Jörg Weiß-Groß', 'joerg.weiss-gross'],
    ['Simon', 'simon'],
    ['', ''],
    ['Al', ''],
  ])('"%s" -> "%s"', (name, vorschlag) => {
    expect(benutzernameVorschlag(name)).toBe(vorschlag);
  });
});

const ANFRAGE: GemeindeAnfrage = {
  id: 4, gemeinde: 'Kirchengemeinde Büsum', kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche',
  kontakt_name: 'Anna Beispiel', funktion: null, email: 'anna@example.org', mobil: null,
  anzahl_konfis: 20, anzahl_teamer: 4, nachricht: null, status: 'neu', notiz: null, organization_id: null,
  created_at: '2026-10-02T08:00:00Z', updated_at: '2026-10-02T08:00:00Z',
};

const gueltig = (teil: Partial<AnlegenFormular> = {}): AnlegenFormular => ({
  ...anlegenVorbelegen(ANFRAGE, KREISE), adminPassword: 'Buesum-2026!', ...teil,
});

describe('anlegenVorbelegen', () => {
  it('uebernimmt Name, Kirchenkreis, Kontakt; Testphase mit 5 Konfis; Passwort leer', () => {
    expect(anlegenVorbelegen(ANFRAGE, KREISE)).toEqual({
      name: 'Kirchengemeinde Büsum', kirchenkreisId: 11, kontaktName: 'Anna Beispiel',
      kontaktEmail: 'anna@example.org', kontaktTelefon: '', maxKonfis: '5', testphase: true,
      adminUsername: 'anna.beispiel', adminDisplayName: 'Anna Beispiel', adminEmail: 'anna@example.org', adminPassword: '',
    });
  });
});

describe('anlegenFehler', () => {
  it('ein vollstaendiges Formular ist in Ordnung', () => {
    expect(anlegenFehler(gueltig())).toBeNull();
  });

  it.each<[string, Partial<AnlegenFormular>, string]>([
    ['ohne Namen', { name: '  ' }, 'Name der Gemeinde ist erforderlich'],
    ['ohne Benutzername', { adminUsername: '' }, 'Alle Felder der Gemeindeleitung sind erforderlich'],
    ['ohne Passwort', { adminPassword: '' }, 'Alle Felder der Gemeindeleitung sind erforderlich'],
    ['Benutzername mit Umlaut', { adminUsername: 'jörg' }, 'Benutzername darf nur Buchstaben, Zahlen, Punkt (.) und Bindestrich (-) enthalten — keine Leerzeichen oder Umlaute'],
    ['E-Mail der Gemeinde kaputt', { kontaktEmail: 'anna@' }, 'Ungültige E-Mail-Adresse'],
    ['E-Mail der Leitung kaputt', { adminEmail: 'anna' }, 'Ungültige E-Mail-Adresse'],
    ['Limit keine Zahl', { maxKonfis: 'viele' }, 'Das Konfi-Limit muss eine Zahl ab 0 oder leer sein'],
    ['Limit negativ', { maxKonfis: '-3' }, 'Das Konfi-Limit muss eine Zahl ab 0 oder leer sein'],
    ['Passwort zu kurz', { adminPassword: 'Ab1!' }, 'Das Passwort muss mindestens 8 Zeichen lang sein'],
  ])('%s', (_fall, teil, meldung) => {
    expect(anlegenFehler(gueltig(teil))).toBe(meldung);
  });

  it('leeres Limit heisst unbegrenzt und ist erlaubt', () => {
    expect(anlegenFehler(gueltig({ maxKonfis: '' }))).toBeNull();
  });
});

describe('passwortRegelFehler (wie der Server)', () => {
  it.each([
    ['Kurz1!', 'Das Passwort muss mindestens 8 Zeichen lang sein'],
    ['Mit Leer 1!', 'Das Passwort darf keine Leerzeichen enthalten'],
    ['klein-2026!', 'Das Passwort muss einen Großbuchstaben enthalten'],
    ['GROSS-2026!', 'Das Passwort muss einen Kleinbuchstaben enthalten'],
    ['OhneZahl!!', 'Das Passwort muss eine Zahl enthalten'],
    ['OhneSonder2026', 'Das Passwort muss ein Sonderzeichen enthalten'],
    ['Richtig-2026', null],
  ])('%s', (pw, meldung) => {
    expect(passwortRegelFehler(pw)).toBe(meldung);
  });
});

describe('anlegenKoerper', () => {
  const jetzt = new Date('2026-10-03T12:00:00Z');

  it('Systemname aus dem Namen (Umlaute umgeschrieben), Testphase 30 Tage, leere Felder als null', () => {
    expect(anlegenKoerper(gueltig({ kontaktTelefon: ' ', adminEmail: '' }), jetzt)).toEqual({
      name: 'kirchengemeinde-buesum',
      display_name: 'Kirchengemeinde Büsum',
      kirchenkreis_id: 11,
      contact_name: 'Anna Beispiel',
      contact_email: 'anna@example.org',
      contact_phone: null,
      max_konfis: 5,
      trial_ends_at: '2026-11-02T12:00:00.000Z',
      is_trial: true,
      admin_username: 'anna.beispiel',
      admin_display_name: 'Anna Beispiel',
      admin_email: null,
      admin_password: 'Buesum-2026!',
    });
  });

  it('ohne Testphase: kein Ablaufdatum; leeres Limit: unbegrenzt; ohne Kirchenkreis: null', () => {
    expect(anlegenKoerper(gueltig({ testphase: false, maxKonfis: '', kirchenkreisId: null }), jetzt)).toMatchObject({
      trial_ends_at: null, is_trial: false, max_konfis: null, kirchenkreis_id: null,
    });
  });
});
