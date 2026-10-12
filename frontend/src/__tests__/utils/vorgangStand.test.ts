// Die Stand-Regel eines Vorgangs (utils/supportVorgaenge.ts, vorgangStand;
// docs/planung/support-detailseiten.md, „Die Stand-Regel"): wer dran ist und
// seit wann, der Hauptknopf und die Nebenknöpfe -- jeder Fall 1a bis 6, die
// automatische Bestätigung ohne verfasst_von, die Anfrage ohne Mail, Wartet
// mit 6, 7 und 8 Tagen und die Ausprägung des Lizenz-Vorgangs (Simon,
// 11.10.2026: „Antrag meint bitte um Lizenz"). Die Testläufe stehen auf
// Europe/Berlin (vite.config.ts); „jetzt" ist der 11.10.2026, 12:00 Uhr.
import { describe, it, expect } from 'vitest';
import type { GemeindeAnfrage, MailNachricht } from '../../types/support';
import { vorgangStand, type VorgangDetail, type VorgangGemeinde } from '../../utils/supportVorgaenge';

const JETZT = new Date('2026-10-11T10:00:00Z');

const GEMEINDE: VorgangGemeinde = {
  id: 7, name: 'st-martin', display_name: 'Test-Gemeinde St. Martin', is_active: true, is_trial: true,
  trial_ends_at: '2026-10-20T10:00:00Z', max_konfis: 5, konfi_count: 3, kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche',
  wunsch_lizenz: 'standard', kirchenkreis_id: 11, intern: false,
};

const vorgang = (teil: Partial<VorgangDetail> = {}): VorgangDetail => ({
  id: 2, art: 'fehler', bereich: 'termine', dringlichkeit: 'normal', status: 'in_arbeit', betreff: 'Konfis sehen das Event am Samstag nicht',
  quelle: 'formular', organization_id: 7, gemeinde_name: 'Test-Gemeinde St. Martin', anfrage_id: null, ungelesen: 0,
  letzte_aktivitaet: '2026-10-11T08:00:00Z', created_at: '2026-10-09T10:21:00Z', archiviert_am: null,
  notiz: null, beschreibung: 'Hallo Support, wir haben für Samstag …', kontakt_name: 'Test Org-Admin 1', kontakt_email: 'orgadmin1@example.org',
  kontakt_funktion: 'Pastor', gemeinde_angabe: null, verlauf: [], anfrage: null, gemeinde: GEMEINDE, leitung: [],
  status_seit: '2026-10-09T10:21:00Z', updated_at: null, erstellt_von_name: null, empfaenger: [],
  ...teil,
});

const ein = (id: number, zeit: string, teil: Partial<MailNachricht> = {}): MailNachricht => ({
  id, postfach: 'support', richtung: 'ein', anfrage_id: null, organization_id: 7, von_adresse: 'orgadmin1@example.org', von_name: 'Test Org-Admin 1',
  an_adressen: ['support@konfi-quest.example'], betreff: 'AW: [Vorgang 2] Konfis sehen das Event', text: 'Danke!', anhaenge: [],
  gesendet_am: zeit, gelesen_am: null, ...teil,
});
/** Eine Antwort des Supports: ausgehend, mit Konto. */
const aus = (id: number, zeit: string, teil: Partial<MailNachricht> = {}): MailNachricht => ein(id, zeit, {
  richtung: 'aus', von_adresse: 'support@konfi-quest.example', von_name: 'Konfi Quest Support', an_adressen: ['orgadmin1@example.org'],
  verfasst_von: 9, verfasst_von_name: 'Test Super-Admin', gelesen_am: zeit, ...teil,
});
/** Die automatische Bestätigung: ausgehend, ohne Konto. */
const bestaetigung = (id: number, zeit: string): MailNachricht => aus(id, zeit, { verfasst_von: null, verfasst_von_name: null, betreff: 'Euer Anliegen ist angekommen [Vorgang 2]' });

const ANFRAGE = {
  id: 41, gemeinde: 'Kirchengemeinde Musterdorf', kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche', kontakt_name: 'A. Beispiel',
  funktion: 'Diakonin', email: 'a.beispiel@example.org', mobil: '0170 1234567', anzahl_konfis: 38, anzahl_teamer: 9, nachricht: 'Wir starten im November.',
  status: 'neu', notiz: null, organization_id: null, created_at: '2026-10-09T08:02:00Z', updated_at: '2026-10-09T08:02:00Z', wunsch_lizenz: 'standard',
} as GemeindeAnfrage;

const anfrageVorgang = (teil: Partial<VorgangDetail> = {}, anfrage: Partial<GemeindeAnfrage> = {}): VorgangDetail => vorgang({
  id: 1, art: 'neue_gemeinde', bereich: null, betreff: 'Anfrage: Kirchengemeinde Musterdorf', quelle: 'anfrage', organization_id: null,
  gemeinde_name: 'Kirchengemeinde Musterdorf', anfrage_id: 41, beschreibung: null, kontakt_name: null, kontakt_email: null, kontakt_funktion: null,
  gemeinde: null, created_at: '2026-10-09T08:02:00Z', anfrage: { ...ANFRAGE, ...anfrage }, ...teil,
});

const stand = (v: VorgangDetail, o: { anlegbar?: boolean; angelegtUsername?: string | null } = {}) =>
  vorgangStand(v, { anlegbar: o.anlegbar ?? false, jetzt: JETZT, angelegtUsername: o.angelegtUsername });

describe('Fall 3: die jüngste Nachricht kam von außen', () => {
  it('eine eingehende Mail ist die jüngste: wartet seit ihrer Zeit, Hauptknopf Antworten, Erledigt daneben', () => {
    const s = stand(vorgang({ verlauf: [aus(11, '2026-10-10T09:14:00Z'), ein(12, '2026-10-11T10:23:00Z')] }));
    expect(s).toMatchObject({
      fall: '3', ton: 'warnung', satz: 'Test Org-Admin 1 wartet seit heute, 12:23 auf Antwort.', zusatz: null,
      haupt: 'antworten', neben: ['erledigt'], antwortGesperrt: false,
    });
  });

  it('nur das Formular, noch keine Mail: wartet seit dem Eingang', () => {
    expect(stand(vorgang({ created_at: '2026-10-10T12:05:00Z' })).satz).toBe('Test Org-Admin 1 wartet seit gestern, 14:05 auf Antwort.');
  });

  it('die automatische Bestätigung ohne verfasst_von zählt nicht als Antwort', () => {
    const s = stand(vorgang({ verlauf: [bestaetigung(11, '2026-10-09T10:22:00Z')] }));
    expect(s.fall).toBe('3');
    expect(s.satz).toBe('Test Org-Admin 1 wartet seit 09.10., 12:21 auf Antwort.');
  });

  it('Risiko: die Antwort eines gelöschten Kontos (verfasst_von genullt) sieht aus wie die Bestätigung und zählt ebenso nicht', () => {
    const s = stand(vorgang({ verlauf: [aus(11, '2026-10-10T09:14:00Z', { verfasst_von: null, verfasst_von_name: null })] }));
    expect(s.fall).toBe('3');
  });

  it('ohne Namen nennt der Satz die Adresse der Mail', () => {
    const s = stand(vorgang({ quelle: 'mail', beschreibung: null, kontakt_name: null, kontakt_email: null, verlauf: [ein(12, '2026-10-11T07:00:00Z', { von_name: null, von_adresse: 'info@beispiel.example' })] }));
    expect(s.satz).toBe('info@beispiel.example wartet seit heute, 09:00 auf Antwort.');
  });
});

describe('Fall 6: der Support schrieb zuletzt', () => {
  it('Satz mit Konto und Zeit, neutral; Hauptknopf Erledigt, Antworten daneben', () => {
    const s = stand(vorgang({ verlauf: [ein(11, '2026-10-10T09:00:00Z'), aus(12, '2026-10-11T09:30:00Z')] }));
    expect(s).toMatchObject({ fall: '6', ton: 'neutral', satz: 'Support (Test Super-Admin) hat heute, 11:30 geantwortet.', haupt: 'erledigt', neben: ['antworten'] });
  });

  it('ohne Kontonamen nur „Support"', () => {
    const s = stand(vorgang({ verlauf: [aus(12, '2026-10-11T09:30:00Z', { verfasst_von_name: null })] }));
    expect(s.satz).toBe('Support hat heute, 11:30 geantwortet.');
  });

  it('vom Support angelegt, noch ohne jede Nachricht: sagt das, statt eine Antwort zu behaupten', () => {
    const s = stand(vorgang({ quelle: 'support', beschreibung: null, created_at: '2026-10-11T07:00:00Z', erstellt_von_name: 'Test Super-Admin' }));
    expect(s).toMatchObject({ fall: '6', satz: 'Angelegt von Test Super-Admin heute, 09:00, noch ohne Nachricht.', haupt: 'erledigt' });
  });
});

describe('Fall 5: Status „Wartet"', () => {
  const wartend = (seit: string) => vorgang({
    status: 'wartet', status_seit: seit, created_at: '2026-09-29T09:00:00Z', verlauf: [ein(11, '2026-09-30T09:00:00Z'), aus(12, '2026-10-01T09:00:00Z')],
  });

  it('6 Tage: Wartet seit … auf die Person, an die der Support schrieb; Hauptknopf Erledigt', () => {
    expect(stand(wartend('2026-10-05T10:00:00Z'))).toMatchObject({
      fall: '5', ton: 'neutral', satz: 'Wartet seit 05.10., 12:00 auf Test Org-Admin 1.', haupt: 'erledigt', neben: ['antworten'],
    });
  });

  it('7 Tage: nachfassen, Antworten wird Hauptknopf', () => {
    expect(stand(wartend('2026-10-04T10:00:00Z'))).toMatchObject({ satz: 'Wartet seit 04.10., 12:00 auf Test Org-Admin 1 – nachfassen?', haupt: 'antworten', neben: ['erledigt'] });
  });

  it('8 Tage: ebenso', () => {
    expect(stand(wartend('2026-10-03T10:00:00Z'))).toMatchObject({ satz: 'Wartet seit 03.10., 12:00 auf Test Org-Admin 1 – nachfassen?', haupt: 'antworten', neben: ['erledigt'] });
  });

  it('der Name kommt aus den Empfängern, wenn der Support an eine andere Adresse schrieb', () => {
    const v = wartend('2026-10-05T10:00:00Z');
    v.verlauf[1] = aus(12, '2026-10-01T09:00:00Z', { an_adressen: ['Pfarrbuero@Example.org'] });
    v.empfaenger = [{ adresse: 'pfarrbuero@example.org', name: 'Pfarrbüro', herkunft: 'leitung' }];
    expect(stand(v).satz).toBe('Wartet seit 05.10., 12:00 auf Pfarrbüro.');
  });

  it('eine neue Mail von außen geht vor: dann Fall 3', () => {
    const v = wartend('2026-10-05T10:00:00Z');
    v.verlauf.push(ein(13, '2026-10-11T08:00:00Z'));
    expect(stand(v).fall).toBe('3');
  });

  // Der Server setzt status_seit nur, wenn sich der Status ändert. Wer nachfasst
  // und „Danach: Wartet“ lässt, ändert ihn nicht -- gewartet wird dann ab der
  // Nachfass-Mail, nicht mehr ab dem ersten „Wartet“.
  it('nach dem Nachfassen: wartet seit der Mail des Supports, kein „nachfassen?“, Hauptknopf Erledigt', () => {
    const v = wartend('2026-10-03T10:00:00Z');
    v.verlauf.push(aus(13, '2026-10-11T09:30:00Z'));
    expect(stand(v)).toMatchObject({
      fall: '5', satz: 'Wartet seit heute, 11:30 auf Test Org-Admin 1.', haupt: 'erledigt', neben: ['antworten'],
    });
  });

  it('auch die Nachfass-Mail ist irgendwann 7 Tage alt: dann wieder nachfassen, ab ihrem Tag', () => {
    const v = wartend('2026-10-02T10:00:00Z');
    v.verlauf.push(aus(13, '2026-10-04T08:00:00Z'));
    expect(stand(v)).toMatchObject({ satz: 'Wartet seit 04.10., 10:00 auf Test Org-Admin 1 – nachfassen?', haupt: 'antworten', neben: ['erledigt'] });
  });

  it('die automatische Bestätigung nach status_seit ist kein Nachfassen', () => {
    const v = wartend('2026-10-03T10:00:00Z');
    v.verlauf.push(bestaetigung(13, '2026-10-11T09:30:00Z'));
    expect(stand(v)).toMatchObject({ satz: 'Wartet seit 03.10., 12:00 auf Test Org-Admin 1 – nachfassen?', haupt: 'antworten' });
  });
});

describe('Fall 2: kein Antwortweg', () => {
  it('keine Gemeinde, kein Kontakt, keine Mail: Gemeinde zuordnen, Antworten gesperrt; der Freitext steht im Satz', () => {
    const v = vorgang({ quelle: 'support', organization_id: null, gemeinde: null, gemeinde_name: 'Kirchengemeinde Heide', beschreibung: null,
      kontakt_name: null, kontakt_email: null, gemeinde_angabe: 'Kirchengemeinde Heide' });
    expect(stand(v)).toMatchObject({
      fall: '2', ton: 'warnung', satz: 'Niemand, dem sich antworten ließe: keine Gemeinde, kein Kontakt. Laut Formular: Kirchengemeinde Heide.',
      haupt: 'gemeinde_zuordnen', neben: [], antwortGesperrt: true,
    });
  });

  it('ohne Freitext endet der Satz nach „kein Kontakt."', () => {
    const v = vorgang({ quelle: 'support', organization_id: null, gemeinde: null, beschreibung: null, kontakt_name: null, kontakt_email: null });
    expect(stand(v).satz).toBe('Niemand, dem sich antworten ließe: keine Gemeinde, kein Kontakt.');
  });
});

describe('Fall 1c: erledigt oder archiviert', () => {
  it('erledigt: Datum aus status_seit, Wiederherstellen ist Hauptknopf', () => {
    const v = vorgang({ status: 'erledigt', status_seit: '2026-10-10T08:00:00Z', archiviert_am: '2026-10-10T08:00:00Z', verlauf: [ein(11, '2026-10-11T08:00:00Z')] });
    expect(stand(v)).toMatchObject({ fall: '1c', ton: 'hinweis', satz: 'Erledigt am 10.10.2026. Eine neue Mail holt ihn zurück.', haupt: 'wiederherstellen', neben: [] });
  });

  it('nur archiviert: Datum aus archiviert_am', () => {
    const v = vorgang({ status: 'wartet', status_seit: '2026-09-20T08:00:00Z', archiviert_am: '2026-10-01T08:00:00Z' });
    expect(stand(v).satz).toBe('Im Archiv seit 01.10.2026. Eine neue Mail holt ihn zurück.');
  });
});

describe('Anfrage einer neuen Gemeinde', () => {
  it('Fall 3: Anlegen und Ablehnen daneben; Marke „Noch nicht angelegt" statt Art', () => {
    const s = stand(anfrageVorgang({ verlauf: [aus(31, '2026-10-10T07:14:00Z', { postfach: 'moin' }), ein(32, '2026-10-11T13:23:00Z', { von_name: 'A. Beispiel', von_adresse: 'a.beispiel@example.org' })] }), { anlegbar: true });
    expect(s).toMatchObject({ fall: '3', satz: 'A. Beispiel wartet seit heute, 15:23 auf Antwort.', haupt: 'antworten', neben: ['gemeinde_anlegen', 'ablehnen'] });
    expect(s.marken.map((m) => [m.schluessel, m.text])).toEqual([['status', 'In Arbeit'], ['nicht_angelegt', 'Noch nicht angelegt']]);
  });

  it('die Anfrage ohne Mail: wartet seit dem Eingang der Anfrage', () => {
    expect(stand(anfrageVorgang(), { anlegbar: true }).satz).toBe('A. Beispiel wartet seit 09.10., 10:02 auf Antwort.');
  });

  it('Fall 4: der Support schrieb zuletzt -- Gemeinde anlegen ist Hauptknopf, Ablehnen und Antworten daneben', () => {
    const s = stand(anfrageVorgang({ verlauf: [aus(31, '2026-10-11T07:14:00Z', { postfach: 'moin' })] }), { anlegbar: true });
    expect(s).toMatchObject({ fall: '4', ton: 'hinweis', satz: 'Support hat heute, 09:14 geantwortet. Anlegen oder ablehnen?', haupt: 'gemeinde_anlegen', neben: ['ablehnen', 'antworten'] });
  });

  it('Fall 1a: angelegt -- Datum und Benutzername nach dem Neuladen aus der Leitung; Gemeinde öffnen', () => {
    const v = anfrageVorgang({
      status: 'erledigt', status_seit: '2026-10-10T08:00:00Z', archiviert_am: '2026-10-10T08:00:00Z', organization_id: 77, gemeinde: { ...GEMEINDE, id: 77 },
      leitung: [{ id: 301, display_name: 'A. Beispiel', username: 'a.beispiel', email: 'a.beispiel@example.org', is_active: true, last_login_at: null }],
    }, { status: 'angelegt', organization_id: 77 });
    expect(stand(v)).toMatchObject({
      fall: '1a', ton: 'erfolg', haupt: 'gemeinde_oeffnen', neben: [],
      satz: 'Gemeinde angelegt am 10.10.2026. Benutzername der Gemeindeleitung: a.beispiel – Benutzername und Passwort getrennt weitergeben.',
    });
  });

  it('Fall 1a direkt nach dem Anlegen, vor dem Neuladen: mit dem Benutzernamen aus dem Anlegen', () => {
    const s = stand(anfrageVorgang({ status_seit: null }), { anlegbar: false, angelegtUsername: 'anna.neu' });
    expect(s.fall).toBe('1a');
    expect(s.satz).toBe('Gemeinde angelegt am 11.10.2026. Benutzername der Gemeindeleitung: anna.neu – Benutzername und Passwort getrennt weitergeben.');
  });

  it('Fall 1a ohne Leitung: nur das Datum', () => {
    const v = anfrageVorgang({ status: 'erledigt', status_seit: '2026-10-10T08:00:00Z', archiviert_am: '2026-10-10T08:00:00Z' }, { status: 'angelegt' });
    expect(stand(v).satz).toBe('Gemeinde angelegt am 10.10.2026.');
  });

  it('Fall 1b: abgelehnt -- Wiederherstellen; Gemeinde anlegen daneben, solange sie anlegbar ist', () => {
    const v = anfrageVorgang({ status: 'erledigt', status_seit: '2026-10-10T08:00:00Z', archiviert_am: '2026-10-10T08:00:00Z' }, { status: 'abgelehnt' });
    expect(stand(v, { anlegbar: true })).toMatchObject({
      fall: '1b', ton: 'hinweis', haupt: 'wiederherstellen', neben: ['gemeinde_anlegen'],
      satz: 'Anfrage abgelehnt am 10.10.2026. Sie wird nach 180 Tagen gelöscht; Wiederherstellen holt sie zurück.',
    });
    expect(stand(v, { anlegbar: false }).neben).toEqual([]);
  });

  it('eine angelegte Anfrage, deren Vorgang wieder offen ist: wie jeder Vorgang, Erledigt statt Ablehnen', () => {
    const v = anfrageVorgang({ organization_id: 77, gemeinde: { ...GEMEINDE, id: 77 }, verlauf: [ein(32, '2026-10-11T08:00:00Z', { von_name: 'A. Beispiel' })] }, { status: 'angelegt' });
    expect(stand(v, { anlegbar: false })).toMatchObject({ fall: '3', neben: ['erledigt'] });
  });

  // useGemeindeAnlegen behält den Benutzernamen, solange die Seite steht. Meldet
  // der Server die Anfrage schon als angelegt, entscheidet allein das Archiv --
  // sonst bliebe 1a nach Wiederherstellen in derselben Sitzung stehen.
  it('angelegt, in derselben Sitzung wiederhergestellt: trotz Benutzername aus dem Anlegen wie jeder Vorgang', () => {
    const v = anfrageVorgang({ organization_id: 77, gemeinde: { ...GEMEINDE, id: 77 }, verlauf: [ein(32, '2026-10-11T08:00:00Z', { von_name: 'A. Beispiel' })] }, { status: 'angelegt' });
    expect(stand(v, { anlegbar: false, angelegtUsername: 'a.beispiel' })).toMatchObject({ fall: '3', haupt: 'antworten', neben: ['erledigt'] });
  });
});

describe('Marken', () => {
  it('Status, Dringend, Art › Bereich -- der Bereich „termine" heißt „Events" (Frage 12)', () => {
    const s = stand(vorgang({ dringlichkeit: 'dringend' }));
    expect(s.marken).toEqual([
      { schluessel: 'status', text: 'In Arbeit', ton: 'info', oeffnetEinordnen: true },
      { schluessel: 'dringend', text: 'Dringend', ton: 'fehler', oeffnetEinordnen: true },
      { schluessel: 'art', text: 'Fehler › Events', ton: 'neutral', oeffnetEinordnen: true },
    ]);
  });

  it('fehlt der Pflicht-Bereich, steht „Bereich fehlt"; ohne Zuordnung „Keine Gemeinde"', () => {
    const s = stand(vorgang({ art: 'frage', bereich: null, organization_id: null, gemeinde: null }));
    expect(s.marken.map((m) => m.text)).toEqual(['In Arbeit', 'Frage', 'Bereich fehlt', 'Keine Gemeinde']);
    // Lizenz braucht keinen Bereich.
    expect(stand(vorgang({ art: 'lizenz', bereich: null })).marken.map((m) => m.schluessel)).not.toContain('bereich_fehlt');
  });
});

describe('Lizenz-Vorgang (Art „Lizenz und Abrechnung")', () => {
  const lizenz = (teil: Partial<VorgangDetail> = {}) => vorgang({ art: 'lizenz', bereich: null, betreff: 'Bitte um Lizenz', ...teil });

  it('Fall 3: „Lizenz ändern" vor Erledigt; die Zeile nennt Lizenz heute und den abweichenden Wunsch', () => {
    const s = stand(lizenz({ verlauf: [ein(12, '2026-10-11T08:00:00Z')] }));
    expect(s).toMatchObject({ fall: '3', haupt: 'antworten', neben: ['lizenz_aendern', 'erledigt'] });
    expect(s.zusatz).toEqual({ text: 'Lizenz heute: Testphase bis 20.10. · bei der Anmeldung gewünscht: Standard.', ton: 'neutral' });
  });

  it('Fall 5 und 6: „Lizenz ändern" nach Antworten bzw. Erledigt', () => {
    const verlauf = [ein(11, '2026-10-09T09:00:00Z'), aus(12, '2026-10-10T09:00:00Z')];
    expect(stand(lizenz({ status: 'wartet', status_seit: '2026-10-10T09:00:00Z', verlauf })).neben).toEqual(['antworten', 'lizenz_aendern']);
    // Ab 7 Tagen nachfassen: Status und die letzte Mail des Supports liegen beide so weit zurück
    // (eine spätere Mail des Supports wäre schon das Nachfassen, Fall 5 oben).
    const frueher = [ein(11, '2026-09-29T09:00:00Z'), aus(12, '2026-09-30T09:00:00Z')];
    expect(stand(lizenz({ status: 'wartet', status_seit: '2026-10-01T09:00:00Z', created_at: '2026-09-28T09:00:00Z', verlauf: frueher })).neben).toEqual(['erledigt', 'lizenz_aendern']);
    expect(stand(lizenz({ verlauf })).neben).toEqual(['antworten', 'lizenz_aendern']);
  });

  it('nicht in Fall 1c und 2', () => {
    expect(stand(lizenz({ status: 'erledigt', archiviert_am: '2026-10-10T08:00:00Z' })).neben).toEqual([]);
    const ohneWeg = lizenz({ quelle: 'support', organization_id: null, gemeinde: null, beschreibung: null, kontakt_name: null, kontakt_email: null });
    expect(stand(ohneWeg)).toMatchObject({ fall: '2', neben: [] });
  });

  it('ohne Gemeinde: „Gemeinde zuordnen" statt „Lizenz ändern", die Zeile sagt warum', () => {
    const s = stand(lizenz({ organization_id: null, gemeinde: null, gemeinde_angabe: 'Kirchengemeinde Heide' }));
    expect(s.neben).toEqual(['gemeinde_zuordnen', 'erledigt']);
    expect(s.zusatz).toEqual({ text: 'Die Lizenz lässt sich erst ändern, wenn eine Gemeinde zugeordnet ist – laut Formular: Kirchengemeinde Heide.', ton: 'hinweis' });
  });

  it('abgelaufen: im Ton Warnung, ohne Wunsch, wenn er dem Tarif entspricht', () => {
    const s = stand(lizenz({ gemeinde: { ...GEMEINDE, trial_ends_at: '2026-10-01T10:00:00Z', wunsch_lizenz: null } }));
    expect(s.zusatz).toEqual({ text: 'Lizenz heute: Testphase, abgelaufen am 01.10.', ton: 'warnung' });
    const gleich = stand(lizenz({ gemeinde: { ...GEMEINDE, is_trial: false, max_konfis: 50, trial_ends_at: '2026-12-31T10:00:00Z' } }));
    expect(gleich.zusatz?.text).toBe('Lizenz heute: Standard bis 31.12.');
  });

  it('gesperrt: „· Zugang gesperrt" im Ton Warnung', () => {
    const s = stand(lizenz({ gemeinde: { ...GEMEINDE, is_active: false } }));
    expect(s.zusatz).toEqual({ text: 'Lizenz heute: Testphase bis 20.10. · bei der Anmeldung gewünscht: Standard · Zugang gesperrt.', ton: 'warnung' });
  });

  it('jede andere Art hat keine Zusatzzeile', () => {
    expect(stand(vorgang()).zusatz).toBeNull();
  });
});
