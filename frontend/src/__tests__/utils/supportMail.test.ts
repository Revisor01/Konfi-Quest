// Reine Regeln der Support-Mail (utils/supportMail.ts, 03.10.2026,
// docs/planung/support-mail.md): Platzhalter, Zitate, Betreff, Vorschau mit
// Fusszeile, Auszug, Bausteine, Antworten des Servers lesen.
import { describe, it, expect } from 'vitest';
import {
  ANFRAGE_BETREFF,
  EMPFAENGER_ETIKETT,
  PLATZHALTER,
  absenderText,
  antwortFehler,
  antwortKoerper,
  aufDiesemServer,
  auszug,
  bausteinEinfuegen,
  bausteinFehler,
  bausteinFormular,
  bausteinKoerper,
  bausteinPostfachText,
  bausteineFuer,
  chronologisch,
  empfaengerEtikett,
  empfaengerLesen,
  empfaengerText,
  fadenAus,
  gemeindenSortiert,
  offenePlatzhalter,
  platzhalterFuellen,
  sendeProblem,
  standardBetreff,
  ungeleseneIds,
  vorschauText,
  zaehlerLesen,
  zitateTrennen,
  mailImPosteingang,
  mailKennzahlen,
  mailStand,
  mailWeiterleitung,
  type MailMitVorgang,
} from '../../utils/supportMail';
import type { MailBaustein, MailNachricht } from '../../types/support';

const mail = (id: number, extra: Partial<MailNachricht> = {}): MailNachricht => ({
  id, postfach: 'moin', richtung: 'ein', anfrage_id: null, organization_id: null,
  von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', an_adressen: ['moin@konfi-quest.de'],
  betreff: 'Frage', text: 'Hallo', anhaenge: [], gesendet_am: '2026-10-02T08:00:00Z', gelesen_am: null,
  ...extra,
});

const baustein = (id: number, titel: string, postfach: MailBaustein['postfach'], sortierung = 0, extra: Partial<MailBaustein> = {}): MailBaustein => ({
  id, titel, postfach, sortierung, betreff: null, text: `Text ${titel}`, ...extra,
});

describe('Platzhalter fuellen', () => {
  const WERTE = {
    name: 'Anna Beispiel', gemeinde: 'Kirchengemeinde Heide', lizenz: 'Standard',
    testphase_bis: '2026-11-02T00:00:00.000Z', benutzername: 'anna.beispiel', absender: 'Support-Team',
  };

  it('setzt alle sechs Platzhalter ein; das Datum der Testphase deutsch', () => {
    const text = 'Hallo {{name}}, {{gemeinde}} hat {{lizenz}} bis {{testphase_bis}}. Benutzername: {{benutzername}}. {{absender}}';
    expect(platzhalterFuellen(text, WERTE)).toBe(
      'Hallo Anna Beispiel, Kirchengemeinde Heide hat Standard bis 02.11.2026. Benutzername: anna.beispiel. Support-Team'
    );
  });

  it('unbekannte Platzhalter bleiben sichtbar stehen', () => {
    expect(platzhalterFuellen('Hallo {{vorname}} von {{gemeinde}}', WERTE)).toBe('Hallo {{vorname}} von Kirchengemeinde Heide');
  });

  it('bekannte ohne Wert (null, leer, fehlt) bleiben ebenfalls stehen', () => {
    expect(platzhalterFuellen('{{name}} {{lizenz}} {{benutzername}}', { name: null, lizenz: '  ' })).toBe('{{name}} {{lizenz}} {{benutzername}}');
  });

  it('Leerzeichen in den Klammern sind erlaubt; jeder Platzhalter wird ueberall ersetzt', () => {
    expect(platzhalterFuellen('{{ name }} und {{name}}', WERTE)).toBe('Anna Beispiel und Anna Beispiel');
  });

  it('ein Datum ohne ISO-Form bleibt, wie der Server es schickt', () => {
    expect(platzhalterFuellen('{{testphase_bis}}', { testphase_bis: '2. November' })).toBe('2. November');
  });

  it('die Hilfe nennt genau die sechs Platzhalter des Vertrags', () => {
    expect(PLATZHALTER.map((p) => p.schluessel)).toEqual(['name', 'gemeinde', 'lizenz', 'testphase_bis', 'benutzername', 'absender']);
  });

  it('offenePlatzhalter findet, was noch im Text steht, ohne Dubletten', () => {
    expect(offenePlatzhalter('{{name}} {{vorname}} {{ name }}')).toEqual(['name', 'vorname']);
  });
});

describe('Zitate erkennen', () => {
  it('Zeilen mit „>" sind ein Zitat; der eigene Text davor und danach bleibt', () => {
    const text = 'Danke, das hilft.\n\n> Wie lege ich einen Jahrgang an?\n> Gruss Anna\n\nNoch eine Frage dazu.';
    expect(zitateTrennen(text)).toEqual([
      { zitat: false, text: 'Danke, das hilft.' },
      { zitat: true, text: '> Wie lege ich einen Jahrgang an?\n> Gruss Anna' },
      { zitat: false, text: 'Noch eine Frage dazu.' },
    ]);
  });

  it('„Am … schrieb …:" leitet ein Zitat bis zum Ende ein -- auch ohne „>" darunter', () => {
    const text = 'Passt, danke!\n\nAm 02.10.2026 um 10:00 schrieb Anna Beispiel <anna@example.org>:\nHallo,\nwie geht das?';
    expect(zitateTrennen(text)).toEqual([
      { zitat: false, text: 'Passt, danke!' },
      { zitat: true, text: 'Am 02.10.2026 um 10:00 schrieb Anna Beispiel <anna@example.org>:\nHallo,\nwie geht das?' },
    ]);
  });

  it('„On … wrote:" ebenso; ueber zwei Zeilen umgebrochen auch', () => {
    expect(zitateTrennen('Thanks.\nOn Fri, Oct 2, 2026 at 10:00 Anna <anna@example.org> wrote:\n> Hi')).toEqual([
      { zitat: false, text: 'Thanks.' },
      { zitat: true, text: 'On Fri, Oct 2, 2026 at 10:00 Anna <anna@example.org> wrote:\n> Hi' },
    ]);
    expect(zitateTrennen('Danke.\nAm Fr., 2. Okt. 2026 um 10:00 Uhr schrieb Anna Beispiel <\nanna@example.org>:\n> Frage')).toEqual([
      { zitat: false, text: 'Danke.' },
      { zitat: true, text: 'Am Fr., 2. Okt. 2026 um 10:00 Uhr schrieb Anna Beispiel <\nanna@example.org>:\n> Frage' },
    ]);
  });

  it('„-----Ursprüngliche Nachricht-----" leitet ebenfalls ein Zitat ein', () => {
    expect(zitateTrennen('Siehe unten.\n-----Ursprüngliche Nachricht-----\nVon: Anna')).toEqual([
      { zitat: false, text: 'Siehe unten.' },
      { zitat: true, text: '-----Ursprüngliche Nachricht-----\nVon: Anna' },
    ]);
  });

  it('ein Satz mit „Am …" ohne „schrieb …:" ist kein Zitat', () => {
    expect(zitateTrennen('Am Montag passt es.\nAm Dienstag nicht.')).toEqual([
      { zitat: false, text: 'Am Montag passt es.\nAm Dienstag nicht.' },
    ]);
  });

  it('leere Zeilen zwischen Zitatzeilen trennen das Zitat nicht; Windows-Zeilenenden zaehlen wie \\n', () => {
    expect(zitateTrennen('Ja.\r\n> eins\r\n\r\n> zwei')).toEqual([
      { zitat: false, text: 'Ja.' },
      { zitat: true, text: '> eins\n\n> zwei' },
    ]);
  });

  it('leer oder null: keine Teile', () => {
    expect(zitateTrennen('')).toEqual([]);
    expect(zitateTrennen(null)).toEqual([]);
    expect(zitateTrennen('\n \n')).toEqual([]);
  });
});

describe('Betreff, Vorschau, Auszug', () => {
  it('Standardbetreff: „Re: " davor, ohne doppelte Vorsilbe', () => {
    expect(standardBetreff('Frage zum Jahrgang')).toBe('Re: Frage zum Jahrgang');
    expect(standardBetreff('Re: Frage')).toBe('Re: Frage');
    expect(standardBetreff('AW: Re: RE: Frage')).toBe('Re: Frage');
    // Die Kennung faellt weg: Der Server haengt die richtige selbst an (betreffMitKennung).
    expect(standardBetreff('Antw: Re[2]: Frage [Anfrage 12]')).toBe('Re: Frage');
    expect(standardBetreff('  ')).toBe('');
    expect(standardBetreff(null)).toBe('');
    // „Reise" beginnt mit „Re", ist aber keine Vorsilbe.
    expect(standardBetreff('Reise nach Heide')).toBe('Re: Reise nach Heide');
    expect(standardBetreff(ANFRAGE_BETREFF)).toBe('Re: Eure Anfrage bei Konfi Quest');
  });

  it('Standardbetreff: erst die Kennungen weg, dann alle Vorsilben -- auch die hinter der Kennung (Fehler vorab 1)', () => {
    // Gemessen am 11.10.2026: vorgeschlagen war „Re: [Vorgang 2] Re: AW: Re: …".
    expect(standardBetreff('AW: [Vorgang 2] Re: AW: Re: Konfis sehen den Termin am Samstag nicht')).toBe('Re: Konfis sehen den Termin am Samstag nicht');
    expect(standardBetreff('Re: Chat zeigt nichts Neues [Vorgang 1]')).toBe('Re: Chat zeigt nichts Neues');
    // Weitergeleitetes beantwortet man ebenfalls mit „Re:".
    expect(standardBetreff('WG: Fwd: FW: Einladung')).toBe('Re: Einladung');
    expect(standardBetreff('[Vorgang 4]')).toBe('');
  });

  it('Vorschau: Text, Leerzeile, „-- ", Fusszeile', () => {
    expect(vorschauText('Hallo Anna,\n\nviele Grüße\n\n', 'Konfi Quest\nmoin@konfi-quest.de\n')).toBe(
      'Hallo Anna,\n\nviele Grüße\n\n-- \nKonfi Quest\nmoin@konfi-quest.de'
    );
  });

  it('Vorschau ohne Fusszeile: nur der Text, kein Trenner', () => {
    expect(vorschauText('Hallo', '')).toBe('Hallo');
    expect(vorschauText('Hallo', '  \n')).toBe('Hallo');
    expect(vorschauText('Hallo', null)).toBe('Hallo');
  });

  it('Auszug: ohne Zitate, Leerraum zusammengezogen, an einer Wortgrenze gekuerzt', () => {
    expect(auszug('Kurz und\n\nknapp.\n> altes Zitat')).toBe('Kurz und knapp.');
    expect(auszug('eins zwei drei vier fuenf', 12)).toBe('eins zwei…');
    expect(auszug('> nur Zitat')).toBe('> nur Zitat');
    expect(auszug(null)).toBe('');
  });

  it('Absender mit Name oder nur Adresse', () => {
    expect(absenderText({ von_name: 'Anna Beispiel', von_adresse: 'anna@example.org' })).toBe('Anna Beispiel <anna@example.org>');
    expect(absenderText({ von_name: null, von_adresse: 'anna@example.org' })).toBe('anna@example.org');
  });
});

describe('Bausteine einfuegen und verwalten', () => {
  const werte = { name: 'Anna', gemeinde: 'Heide' };

  it('fuegt unter den vorhandenen Text ein, Platzhalter gefuellt', () => {
    const neu = bausteinEinfuegen({ betreff: 'Re: Frage', text: 'Hallo {{name}},\n' }, { betreff: null, text: 'eure Gemeinde {{gemeinde}} ist angelegt.' }, werte, 'Re: Frage');
    expect(neu).toEqual({ betreff: 'Re: Frage', text: 'Hallo {{name}},\n\neure Gemeinde Heide ist angelegt.' });
  });

  it('leeres Textfeld: der Baustein ist der Text', () => {
    expect(bausteinEinfuegen({ betreff: '', text: '  ' }, { betreff: null, text: 'Hallo {{name}}' }, werte, '').text).toBe('Hallo Anna');
  });

  it('der Betreff des Bausteins ersetzt nur einen leeren oder vorgeschlagenen Betreff', () => {
    const b = { betreff: 'Zugang für {{gemeinde}}', text: 'x' };
    expect(bausteinEinfuegen({ betreff: 'Re: Frage', text: '' }, b, werte, 'Re: Frage').betreff).toBe('Zugang für Heide');
    expect(bausteinEinfuegen({ betreff: '', text: '' }, b, werte, 'Re: Frage').betreff).toBe('Zugang für Heide');
    expect(bausteinEinfuegen({ betreff: 'Selbst getippt', text: '' }, b, werte, 'Re: Frage').betreff).toBe('Selbst getippt');
  });

  it('Bausteine eines Postfachs: seine und die fuer beide, nach Sortierung, dann Titel', () => {
    const liste = [
      baustein(1, 'Zugang', 'support', 1),
      baustein(2, 'Absage', 'moin', 2),
      baustein(3, 'Eingang', null, 1),
      baustein(4, 'Angebot', 'moin', 1),
    ];
    expect(bausteineFuer(liste, 'moin').map((b) => b.titel)).toEqual(['Angebot', 'Eingang', 'Absage']);
    expect(bausteineFuer(liste, 'support').map((b) => b.titel)).toEqual(['Eingang', 'Zugang']);
  });

  it('Formular und Koerper: „beide" geht als null, leerer Betreff als null, Titel getrimmt', () => {
    expect(bausteinKoerper({ titel: ' Eingang ', postfach: 'beide', betreff: ' ', text: 'Danke!\n\n' })).toEqual({
      titel: 'Eingang', betreff: null, text: 'Danke!', postfach: null,
    });
    expect(bausteinKoerper({ titel: 'Zugang', postfach: 'support', betreff: 'Zugang', text: 'x' }).postfach).toBe('support');
    expect(bausteinFormular(baustein(5, 'Absage', null, 0, { betreff: null }))).toEqual({
      titel: 'Absage', postfach: 'beide', betreff: '', text: 'Text Absage',
    });
    expect(bausteinFehler({ titel: '', postfach: 'beide', betreff: '', text: 'x' })).toBe('Titel und Text sind erforderlich');
    expect(bausteinFehler({ titel: 'x', postfach: 'beide', betreff: '', text: ' ' })).toBe('Titel und Text sind erforderlich');
    expect(bausteinFehler({ titel: 'x', postfach: 'beide', betreff: '', text: 'y' })).toBeNull();
    expect(bausteinPostfachText(null)).toBe('Beide Postfächer');
    expect(bausteinPostfachText('moin')).toBe('moin@');
  });
});

describe('Antworten senden', () => {
  it('Koerper: Text ohne Leerraum am Ende, Betreff nur wenn vorhanden, „an" nur bei Gemeinden', () => {
    expect(antwortKoerper({ betreff: ' Re: Frage ', text: 'Hallo\n\n' })).toEqual({ text: 'Hallo', betreff: 'Re: Frage' });
    expect(antwortKoerper({ betreff: '', text: 'Hallo' })).toEqual({ text: 'Hallo' });
    expect(antwortKoerper({ betreff: '', text: 'Hallo' }, 'leitung@example.org')).toEqual({ text: 'Hallo', an: 'leitung@example.org' });
  });

  it('Koerper im Vorgang (additiv seit 12.10.2026): „Danach" als status und die beantwortete Mail als antwort_auf -- nur, wenn es sie gibt', () => {
    expect(antwortKoerper({ betreff: 'Re: Frage', text: 'Hallo' }, 'leitung@example.org', { status: 'wartet', antwortAuf: 13 }))
      .toEqual({ text: 'Hallo', betreff: 'Re: Frage', an: 'leitung@example.org', status: 'wartet', antwort_auf: 13 });
    expect(antwortKoerper({ betreff: '', text: 'Hallo' }, null, { status: 'erledigt' })).toEqual({ text: 'Hallo', status: 'erledigt' });
    expect(antwortKoerper({ betreff: '', text: 'Hallo' }, null, { antwortAuf: 13 })).toEqual({ text: 'Hallo', antwort_auf: 13 });
    // Ohne „Danach" und ohne beantwortete Mail bleibt der Körper, wie er war -- auch keine leeren Felder.
    expect(antwortKoerper({ betreff: '', text: 'Hallo' }, null, { status: null, antwortAuf: null })).toEqual({ text: 'Hallo' });
    // Keine Kennung: kein antwort_auf (der Server lehnte sonst mit 400 ab).
    expect(antwortKoerper({ betreff: '', text: 'Hallo' }, null, { antwortAuf: 0 })).toEqual({ text: 'Hallo' });
    expect(antwortKoerper({ betreff: '', text: 'Hallo' }, null, { antwortAuf: 1.5 })).toEqual({ text: 'Hallo' });
  });

  it('vor dem Senden: Empfaenger (wenn noetig), dann Text', () => {
    expect(antwortFehler({ betreff: '', text: 'x' }, true, '')).toBe('Bitte einen Empfänger wählen');
    expect(antwortFehler({ betreff: '', text: '  ' })).toBe('Bitte einen Text schreiben');
    expect(antwortFehler({ betreff: '', text: 'x' }, true, 'a@example.org')).toBeNull();
  });

  it('503 ohne Text des Servers: Postfach nicht eingerichtet; mit „Auf diesem Server …": der Text des Servers; 502: Versand gescheitert', () => {
    expect(sendeProblem(503)).toEqual({ art: 'nicht_eingerichtet' });
    expect(sendeProblem(503, 'Postfach moin ist nicht eingerichtet')).toEqual({ art: 'nicht_eingerichtet' });
    expect(sendeProblem(503, 'Auf diesem Server ist der Versand aus.')).toEqual({ art: 'server_aus', text: 'Auf diesem Server ist der Versand aus.' });
    expect(sendeProblem(502, 'egal')).toEqual({ art: 'versand_gescheitert' });
    expect(sendeProblem(500)).toBeNull();
    expect(sendeProblem(undefined)).toBeNull();
  });

  it('auf_diesem_server: nur ein ausdrueckliches false schaltet aus; fehlt das Feld, gilt ja', () => {
    expect(aufDiesemServer({ auf_diesem_server: false })).toBe(false);
    expect(aufDiesemServer({ auf_diesem_server: true })).toBe(true);
    expect(aufDiesemServer({})).toBe(true);
    expect(aufDiesemServer(null)).toBe(true);
  });
});

describe('Faden und Liste', () => {
  it('chronologisch: aelteste zuerst, bei gleicher Zeit nach Kennung', () => {
    const liste = [
      mail(3, { gesendet_am: '2026-10-02T10:00:00Z' }),
      mail(1, { gesendet_am: '2026-10-02T09:00:00Z' }),
      mail(2, { gesendet_am: '2026-10-02T10:00:00Z' }),
    ];
    expect(chronologisch(liste).map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it('ungelesen sind nur eingehende ohne Lesedatum', () => {
    expect(ungeleseneIds([
      mail(1), mail(2, { gelesen_am: '2026-10-02T09:00:00Z' }), mail(3, { richtung: 'aus' }), mail(4),
    ])).toEqual([1, 4]);
  });

  it('fadenAus: Verlauf chronologisch; die Mail selbst ist dabei, auch wenn der Server sie im Verlauf weglaesst', () => {
    const selbst = mail(5, { gesendet_am: '2026-10-02T12:00:00Z' });
    const frueher = mail(4, { gesendet_am: '2026-10-02T08:00:00Z', richtung: 'aus' });
    expect(fadenAus({ ...selbst, verlauf: [selbst, frueher] }).map((m) => m.id)).toEqual([4, 5]);
    const ohne = fadenAus({ ...selbst, verlauf: [frueher] });
    expect(ohne.map((m) => m.id)).toEqual([4, 5]);
    expect('verlauf' in ohne[1]).toBe(false);
    expect(fadenAus({ ...selbst }).map((m) => m.id)).toEqual([5]);
  });

  it('Gemeinden nach Anzeigename', () => {
    expect(gemeindenSortiert([
      { id: 1, name: 'zz', display_name: 'Wesselburen' },
      { id: 2, name: 'Büsum', display_name: null },
      { id: 3, name: 'heide', display_name: 'Heide' },
    ]).map((g) => g.id)).toEqual([2, 3, 1]);
  });
});

describe('Antworten des Servers lesen', () => {
  it('Zaehler: Zahlen uebernommen, fehlende und falsche als 0, Tabellen nur mit Zahlen ueber 0', () => {
    expect(zaehlerLesen({ anfragen: 2, gemeinden: 1, eingang: 3, je_anfrage: { 4: 2, 5: 0, 6: 'x' }, je_gemeinde: { 7: 1 } })).toEqual({
      anfragen: 2, gemeinden: 1, eingang: 3, je_anfrage: { 4: 2 }, je_gemeinde: { 7: 1 }, vorgaenge: 0, posteingang: 0,
    });
    expect(zaehlerLesen({ eingang: '3' })).toEqual({ anfragen: 0, gemeinden: 0, eingang: 0, je_anfrage: {}, je_gemeinde: {}, vorgaenge: 0, posteingang: 0 });
    expect(zaehlerLesen([])).toBeNull();
    expect(zaehlerLesen(null)).toBeNull();
  });

  it('Zaehler: die zwei roten Zahlen der Vorgaenge (vorgaenge, posteingang) kommen mit; falsche Werte zaehlen 0', () => {
    expect(zaehlerLesen({ vorgaenge: 5, posteingang: 2 })).toMatchObject({ vorgaenge: 5, posteingang: 2 });
    expect(zaehlerLesen({ vorgaenge: -1, posteingang: 'viele' })).toMatchObject({ vorgaenge: 0, posteingang: 0 });
    // Ein aelterer Server kennt die Felder nicht: nichts bricht, die Zahlen stehen auf 0.
    expect(zaehlerLesen({ anfragen: 4, gemeinden: 1, eingang: 2, je_anfrage: {}, je_gemeinde: {} })).toMatchObject({ vorgaenge: 0, posteingang: 0 });
  });

  it('Empfaenger: Zeichenketten und Objekte (adresse/email, name/display_name, herkunft/quelle/rolle), ohne Dubletten und ohne Ungueltiges', () => {
    expect(empfaengerLesen([
      { adresse: 'leitung@example.org', name: 'Pastorin Anna', herkunft: 'Gemeindeleitung' },
      { email: 'team@example.org', display_name: 'Ben', rolle: 'Leitung' },
      'kontakt@example.org',
      'LEITUNG@example.org',
      { name: 'ohne Adresse' },
      'kein-at',
    ])).toEqual([
      { adresse: 'leitung@example.org', name: 'Pastorin Anna', herkunft: 'Gemeindeleitung' },
      { adresse: 'team@example.org', name: 'Ben', herkunft: 'Leitung' },
      { adresse: 'kontakt@example.org', name: null, herkunft: null },
    ]);
    expect(empfaengerLesen({ empfaenger: ['a@example.org'] })).toEqual([{ adresse: 'a@example.org', name: null, herkunft: null }]);
    expect(empfaengerLesen(null)).toEqual([]);
  });

  it('Empfaenger als Text', () => {
    expect(empfaengerText({ adresse: 'a@example.org', name: 'Anna', herkunft: 'Gemeindeleitung' })).toBe('Anna <a@example.org> · Gemeindeleitung');
    expect(empfaengerText({ adresse: 'a@example.org', name: null, herkunft: null })).toBe('a@example.org');
  });

  it('Empfaenger als Text: die Herkunft des Servers als lesbares Etikett, nie roh (Fehler vorab 4)', () => {
    // Gemessen am 11.10.2026: „Test Org-Admin 1 <…> · verlauf".
    const e = (herkunft: string | null) => empfaengerText({ adresse: 'a@example.org', name: 'Anna', herkunft });
    expect(e('absender')).toBe('Anna <a@example.org> · schrieb uns');
    expect(e('kontakt')).toBe('Anna <a@example.org> · Kontakt aus dem Formular');
    expect(e('anfrage')).toBe('Anna <a@example.org> · aus der Anfrage');
    expect(e('leitung')).toBe('Anna <a@example.org> · Gemeindeleitung');
    expect(e('verlauf')).toBe('Anna <a@example.org> · aus früheren Mails');
    // Ein unbekannter Schlüssel steht nicht roh da.
    expect(e('neue_quelle')).toBe('Anna <a@example.org>');
  });

  it('Etikett der Herkunft: bekannte Schlüssel übersetzt, unbekannte Schlüssel nie roh, lesbarer Text unverändert', () => {
    expect(Object.keys(EMPFAENGER_ETIKETT)).toEqual(['absender', 'kontakt', 'anfrage', 'leitung', 'verlauf']);
    expect(empfaengerEtikett('verlauf')).toBe('aus früheren Mails');
    expect(empfaengerEtikett(' leitung ')).toBe('Gemeindeleitung');
    expect(empfaengerEtikett('neue_quelle')).toBeNull();
    expect(empfaengerEtikett('Kontakt aus dem Formular')).toBe('Kontakt aus dem Formular');
    expect(empfaengerEtikett('Gemeindeleitung')).toBe('Gemeindeleitung');
    expect(empfaengerEtikett('')).toBeNull();
    expect(empfaengerEtikett(null)).toBeNull();
    // Ein geerbter Name ist kein Schlüssel.
    expect(empfaengerEtikett('constructor')).toBeNull();
  });
});

describe('Detailseite einer Mail (docs/planung/support-detailseiten.md, D und E)', () => {
  const mitVorgang = (extra: Partial<MailMitVorgang> = {}): MailMitVorgang => ({ ...mail(5), verlauf: [], vorgang_id: null, archiviert_am: null, ...extra });

  it('im Posteingang nur ohne Vorgang, Anfrage und Gemeinde -- alle drei Spalten wie der Server', () => {
    expect(mailImPosteingang({ anfrage_id: null, organization_id: null, vorgang_id: null })).toBe(true);
    expect(mailImPosteingang({ anfrage_id: null, organization_id: null })).toBe(true);
    expect(mailImPosteingang({ anfrage_id: null, organization_id: null, vorgang_id: 2 })).toBe(false);
    expect(mailImPosteingang({ anfrage_id: 41, organization_id: null, vorgang_id: null })).toBe(false);
    expect(mailImPosteingang({ anfrage_id: null, organization_id: 7, vorgang_id: null })).toBe(false);
  });

  it('Weiterleitung: in den Vorgang mit der Mail offen, sonst Anfrage oder Gemeinde; im Posteingang keine', () => {
    expect(mailWeiterleitung({ id: 5, vorgang_id: 2, anfrage_id: 41, organization_id: 7 })).toBe('/admin/support/vorgaenge/2?mail=5');
    expect(mailWeiterleitung({ id: 5, vorgang_id: null, anfrage_id: 41, organization_id: null })).toBe('/admin/support/anfragen/41');
    expect(mailWeiterleitung({ id: 5, anfrage_id: null, organization_id: 7 })).toBe('/admin/support/vorgaenge?gemeinde=7');
    expect(mailWeiterleitung({ id: 5, vorgang_id: null, anfrage_id: null, organization_id: null })).toBeNull();
  });

  it('Posteingang: Einsortieren ist Hauptknopf, Antworten daneben, kein Satz; Archivieren und Löschen erlaubt', () => {
    expect(mailStand(mitVorgang())).toEqual({
      imPosteingang: true, archiviert: false, satz: null, ton: null, haupt: 'einsortieren', neben: ['antworten'],
      archivierbar: true, loeschbar: true, weiterleitung: null,
    });
  });

  it('im Archiv: ein Satz ohne Widerspruch -- Einsortieren holt sie zurück; Wiederherstellen daneben', () => {
    expect(mailStand(mitVorgang({ archiviert_am: '2026-10-02T12:00:00Z' }))).toEqual({
      imPosteingang: true, archiviert: true, satz: 'Im Archiv seit 02.10.2026 · wird nach 180 Tagen gelöscht · Einsortieren holt sie zurück.', ton: 'hinweis',
      haupt: 'einsortieren', neben: ['wiederherstellen'], archivierbar: false, loeschbar: true, weiterleitung: null,
    });
  });

  it('in einem Vorgang: keine Knöpfe, die der Server mit 409 ablehnt -- nur die Weiterleitung (Fehler vorab 2)', () => {
    expect(mailStand(mitVorgang({ vorgang_id: 2 }))).toEqual({
      imPosteingang: false, archiviert: false, satz: null, ton: null, haupt: null, neben: [], archivierbar: false, loeschbar: false,
      weiterleitung: '/admin/support/vorgaenge/2?mail=5',
    });
    // Auch eine ältere Zuordnung nur über die Anfrage zählt.
    expect(mailStand(mitVorgang({ anfrage_id: 41 }))).toMatchObject({ archivierbar: false, loeschbar: false, weiterleitung: '/admin/support/anfragen/41' });
  });

  it('Kennzahlen: Mails im Faden · Neu · Anhänge', () => {
    const faden = [mail(1, { anhaenge: [{ name: 'a.pdf' }, { name: 'b.png' }] }), mail(2, { anhaenge: null }), mail(3, { anhaenge: [{ name: 'c.pdf' }] })];
    expect(mailKennzahlen(faden, 1)).toEqual([
      { schluessel: 'mails', label: 'Mails', wert: '3', zahl: 3 },
      { schluessel: 'neu', label: 'Neu', wert: '1', zahl: 1 },
      { schluessel: 'anhaenge', label: 'Anhänge', wert: '3', zahl: 3 },
    ]);
  });
});
