import { describe, it, expect } from 'vitest';
import type { GemeindeAnfrage, MailNachricht } from '../../types/support';
import {
  ARTEN,
  BEREICHE,
  DRINGLICHKEITEN,
  ERLEDIGT_HINWEIS,
  STATUS_REIHE,
  VORGANG_FILTER,
  VORGANG_STATUS,
  antwortWegVon,
  artLabel,
  auswahlAusAdresse,
  bereichIstPflicht,
  brauchtAufmerksamkeit,
  einsortierenBestehendKoerper,
  einsortierenNeuFehler,
  einsortierenNeuKoerper,
  einsortierenNeuVorbelegen,
  gemeindeAngabeVon,
  gemeindenAusVorgaengen,
  istArchiviert,
  kontaktVon,
  LEERER_VORGANG,
  mailSammelKoerper,
  neuerVorgangFehler,
  neuerVorgangKoerper,
  vorgaengeFiltern,
  vorgaengeLesen,
  vorgaengeSortieren,
  vorgaengeText,
  vorgaengeZaehlen,
  vorgangDetailLesen,
  vorgangLesen,
  vorgangSammelKoerper,
  vorgangSuchtexte,
  type NeuerVorgangFormular,
  type Vorgang,
  type VorgangAuswahl,
} from '../../utils/supportVorgaenge';

// Vorgänge der Support-Ansicht (docs/planung/support-vorgaenge.md): die Auswahlwerte
// des Plans, das defensive Lesen der Antworten, Filter, Suche, Zähler und die Körper
// der Aufrufe.

const vorgang = (id: number, extra: Partial<Vorgang> = {}): Vorgang => ({
  id, art: 'frage', bereich: 'chat', dringlichkeit: 'normal', status: 'neu', betreff: `Betreff ${id}`, quelle: 'formular',
  organization_id: null, gemeinde_name: null, anfrage_id: null, ungelesen: 0, letzte_aktivitaet: '2026-10-03T08:00:00Z',
  created_at: '2026-10-03T07:00:00Z', archiviert_am: null, ...extra,
});

describe('Auswahlwerte: Arten, Bereiche, Dringlichkeit, Status', () => {
  it('die acht Arten in der Reihenfolge des Plans, mit ihren Namen', () => {
    expect(ARTEN.map((a) => [a.wert, a.label])).toEqual([
      ['neue_gemeinde', 'Neue Gemeinde'],
      ['frage', 'Frage zur Bedienung'],
      ['fehler', 'Fehler melden'],
      ['wunsch', 'Wunsch oder Idee'],
      ['zugang', 'Zugang und Konten'],
      ['lizenz', 'Lizenz und Abrechnung'],
      ['datenschutz', 'Datenschutz'],
      ['sonstiges', 'Sonstiges'],
    ]);
    expect(artLabel('lizenz')).toBe('Lizenz und Abrechnung');
  });

  it('die zehn Bereiche des Plans', () => {
    expect(BEREICHE.map((b) => [b.wert, b.label])).toEqual([
      ['konfis', 'Konfis'], ['termine', 'Events'], ['punkte', 'Punkte und Anträge'], ['challenges', 'Challenges'],
      ['chat', 'Chat'], ['badges', 'Badges'], ['material', 'Material'], ['konten', 'Konten und Einladungen'],
      ['einstellungen', 'Einstellungen'], ['sonstiges', 'Sonstiges'],
    ]);
  });

  it('Dringlichkeit: normal und dringend („wir können gerade nicht weiterarbeiten“)', () => {
    expect(DRINGLICHKEITEN.map((d) => d.wert)).toEqual(['normal', 'dringend']);
    expect(DRINGLICHKEITEN[1].hinweis).toBe('wir können gerade nicht weiterarbeiten');
  });

  it('vier Status; „Erledigt“ sagt, dass der Vorgang ins Archiv geht', () => {
    expect(STATUS_REIHE).toEqual(['neu', 'in_arbeit', 'wartet', 'erledigt']);
    expect(VORGANG_STATUS.wartet).toMatchObject({ label: 'Wartet auf Rückmeldung', kurz: 'Wartet' });
    expect(ERLEDIGT_HINWEIS).toContain('Archiv');
    expect(ERLEDIGT_HINWEIS).toContain('Eine neue Mail holt den Vorgang zurück');
  });

  it('der Bereich ist bei Frage, Fehler und Wunsch Pflicht -- sonst nicht', () => {
    for (const art of ['frage', 'fehler', 'wunsch'] as const) expect(bereichIstPflicht(art), art).toBe(true);
    for (const art of ['neue_gemeinde', 'zugang', 'lizenz', 'datenschutz', 'sonstiges', ''] as const) expect(bereichIstPflicht(art), art).toBe(false);
  });

  it('die Filter der Liste: Offen, Neu, In Arbeit, Wartet, Archiv -- erledigte liegen im Archiv', () => {
    expect(VORGANG_FILTER).toEqual(['offen', 'neu', 'in_arbeit', 'wartet', 'archiv']);
  });
});

describe('Vorgänge lesen: der Vertrag von GET /support/vorgaenge', () => {
  it('ein vollständiger Eintrag wird übernommen', () => {
    const roh = {
      id: 12, art: 'fehler', bereich: 'chat', dringlichkeit: 'dringend', status: 'in_arbeit', betreff: 'Chat geht nicht', quelle: 'formular',
      organization_id: 7, gemeinde_name: 'Musterdorf', anfrage_id: null, ungelesen: 2, letzte_aktivitaet: '2026-10-03T09:00:00Z',
      created_at: '2026-10-02T09:00:00Z', archiviert_am: null,
    };
    expect(vorgangLesen(roh)).toEqual(roh);
  });

  it('fehlende und falsche Felder bekommen sichere Werte; ohne Kennung kein Vorgang', () => {
    expect(vorgangLesen({ id: 3 })).toEqual({
      id: 3, art: 'sonstiges', bereich: null, dringlichkeit: 'normal', status: 'neu', betreff: '', quelle: 'support', organization_id: null,
      gemeinde_name: null, anfrage_id: null, ungelesen: 0, letzte_aktivitaet: '', created_at: '', archiviert_am: null,
    });
    expect(vorgangLesen({ id: 4, art: 'unbekannt', bereich: 'nix', status: 'kaputt', quelle: 'x', ungelesen: -2, dringlichkeit: 'egal' })).toMatchObject({
      art: 'sonstiges', bereich: null, status: 'neu', quelle: 'support', ungelesen: 0, dringlichkeit: 'normal',
    });
    expect(vorgangLesen({ betreff: 'ohne Nummer' })).toBeNull();
    expect(vorgangLesen({ id: 0 })).toBeNull();
    expect(vorgangLesen('x')).toBeNull();
    expect(vorgangLesen(null)).toBeNull();
  });

  it('ohne letzte Aktivität gilt der Eingang', () => {
    expect(vorgangLesen({ id: 5, created_at: '2026-10-01T10:00:00Z' })?.letzte_aktivitaet).toBe('2026-10-01T10:00:00Z');
  });

  it('eine Liste: kein Array ergibt null, Eintraege ohne Kennung fallen weg', () => {
    expect(vorgaengeLesen({})).toBeNull();
    expect(vorgaengeLesen(null)).toBeNull();
    expect(vorgaengeLesen([{ id: 1 }, { kaputt: true }, 'x', { id: 2 }])?.map((v) => v.id)).toEqual([1, 2]);
  });

  it('der Vorgang mit allem: Notiz, Formulartext, Kontakt, Gemeinde, Leitung, Verlauf, Anfrage', () => {
    const detail = vorgangDetailLesen({
      id: 12, art: 'frage', status: 'neu', betreff: 'Frage', quelle: 'formular', created_at: '2026-10-03T07:00:00Z',
      notiz: 'Nachfragen', beschreibung: 'Wo finde ich …?', kontakt_name: 'Anna Beispiel', kontakt_email: 'anna@example.org', kontakt_funktion: 'Pastorin',
      gemeinde_angabe: 'Kirchengemeinde Heide',
      verlauf: [{ id: 5, postfach: 'support', richtung: 'ein', von_adresse: 'anna@example.org', gesendet_am: '2026-10-03T07:00:00Z', anhaenge: [{ name: 'a.pdf' }] }, { kaputt: 1 }],
      anfrage: { id: 41, gemeinde: 'Kirchengemeinde Heide', kontakt_name: 'Anna', email: 'anna@example.org', status: 'neu' },
      gemeinde: { id: 7, name: 'heide', display_name: 'Kirchengemeinde Heide', is_trial: true, trial_ends_at: '2026-11-01T00:00:00Z', max_konfis: 5, konfi_count: 3, kirchenkreis: 'Dithmarschen' },
      leitung: [{ id: 9, display_name: 'Anna Beispiel', username: 'anna', email: 'anna@example.org' }, { name: 'ohne Kennung' }],
    });
    expect(detail).toMatchObject({
      id: 12, notiz: 'Nachfragen', beschreibung: 'Wo finde ich …?', kontakt_name: 'Anna Beispiel', kontakt_email: 'anna@example.org',
      kontakt_funktion: 'Pastorin', gemeinde_angabe: 'Kirchengemeinde Heide',
    });
    expect(detail?.verlauf.map((m) => m.id)).toEqual([5]);
    expect(detail?.verlauf[0].anhaenge).toEqual([{ name: 'a.pdf' }]);
    expect(detail?.anfrage?.id).toBe(41);
    expect(detail?.gemeinde).toMatchObject({ id: 7, display_name: 'Kirchengemeinde Heide', is_trial: true, max_konfis: 5, konfi_count: 3, kirchenkreis: 'Dithmarschen', landeskirche: null });
    expect(detail?.leitung).toEqual([{ id: 9, display_name: 'Anna Beispiel', username: 'anna', email: 'anna@example.org', is_active: true, last_login_at: null }]);
  });

  it('ohne die neuen Teile (älterer oder knapper Stand): leere Verläufe, keine Gemeinde, keine Anfrage', () => {
    const detail = vorgangDetailLesen({ id: 8 });
    expect(detail).toMatchObject({ notiz: null, beschreibung: null, kontakt_name: null, gemeinde_angabe: null, anfrage: null, gemeinde: null });
    expect(detail?.verlauf).toEqual([]);
    expect(detail?.leitung).toEqual([]);
    expect(vorgangDetailLesen([])).toBeNull();
    expect(vorgangDetailLesen({ betreff: 'x' })).toBeNull();
  });

  it('Kontakt und Gemeinde-Angabe fallen auf die Anfrage zurück, wenn das Formular sie nicht trug', () => {
    const anfrage = { id: 41, gemeinde: 'Kirchengemeinde Heide', kontakt_name: 'Anna Beispiel', email: 'anna@example.org', funktion: 'Pastorin' } as GemeindeAnfrage;
    expect(kontaktVon({ kontakt_name: null, kontakt_email: null, kontakt_funktion: null, anfrage })).toEqual({ name: 'Anna Beispiel', email: 'anna@example.org', funktion: 'Pastorin' });
    expect(kontaktVon({ kontakt_name: 'Sam', kontakt_email: 'sam@example.org', kontakt_funktion: null, anfrage })).toEqual({ name: 'Sam', email: 'sam@example.org', funktion: 'Pastorin' });
    expect(kontaktVon({ kontakt_name: null, kontakt_email: null, kontakt_funktion: null, anfrage: null })).toEqual({ name: null, email: null, funktion: null });
    expect(gemeindeAngabeVon({ gemeinde_angabe: 'Heide Süd', anfrage })).toBe('Heide Süd');
    expect(gemeindeAngabeVon({ gemeinde_angabe: null, anfrage })).toBe('Kirchengemeinde Heide');
    expect(gemeindeAngabeVon({ gemeinde_angabe: null, anfrage: null })).toBeNull();
  });
});

describe('Filter, Zähler, Suche und Sortierung der Liste', () => {
  const offene = [
    vorgang(1, { status: 'neu', organization_id: 7, gemeinde_name: 'Büsum', art: 'frage', ungelesen: 1 }),
    vorgang(2, { status: 'in_arbeit', art: 'neue_gemeinde', gemeinde_name: null, betreff: 'Anfrage Lindenau' }),
    vorgang(3, { status: 'wartet', organization_id: 8, gemeinde_name: 'Heide', art: 'fehler', bereich: 'termine' }),
    vorgang(4, { status: 'neu', organization_id: 7, gemeinde_name: 'Büsum', art: 'wunsch' }),
  ];
  const auswahl = (teil: Partial<VorgangAuswahl>): VorgangAuswahl => ({ filter: 'offen', art: 'alle', gemeinde: 'alle', suche: '', ...teil });

  it('Zahl je Filter aus den offenen Vorgängen', () => {
    expect(vorgaengeZaehlen(offene)).toEqual({ offen: 4, neu: 2, in_arbeit: 1, wartet: 1 });
    expect(vorgaengeZaehlen([])).toEqual({ offen: 0, neu: 0, in_arbeit: 0, wartet: 0 });
  });

  it('Offen zeigt alle, Neu, In Arbeit und Wartet je einen Status', () => {
    expect(vorgaengeFiltern(offene, auswahl({})).map((v) => v.id)).toEqual([1, 2, 3, 4]);
    expect(vorgaengeFiltern(offene, auswahl({ filter: 'neu' })).map((v) => v.id)).toEqual([1, 4]);
    expect(vorgaengeFiltern(offene, auswahl({ filter: 'in_arbeit' })).map((v) => v.id)).toEqual([2]);
    expect(vorgaengeFiltern(offene, auswahl({ filter: 'wartet' })).map((v) => v.id)).toEqual([3]);
  });

  it('Art und Gemeinde grenzen weiter ein', () => {
    expect(vorgaengeFiltern(offene, auswahl({ art: 'neue_gemeinde' })).map((v) => v.id)).toEqual([2]);
    expect(vorgaengeFiltern(offene, auswahl({ gemeinde: '7' })).map((v) => v.id)).toEqual([1, 4]);
    expect(vorgaengeFiltern(offene, auswahl({ gemeinde: '7', art: 'wunsch' })).map((v) => v.id)).toEqual([4]);
    expect(vorgaengeFiltern(offene, auswahl({ gemeinde: '99' }))).toEqual([]);
  });

  it('die Suche findet Nummer, Betreff, Gemeinde, Art und Bereich -- „buesum“ findet „Büsum“', () => {
    expect(vorgaengeFiltern(offene, auswahl({ suche: 'buesum' })).map((v) => v.id)).toEqual([1, 4]);
    expect(vorgaengeFiltern(offene, auswahl({ suche: 'lindenau' })).map((v) => v.id)).toEqual([2]);
    expect(vorgaengeFiltern(offene, auswahl({ suche: 'Vorgang 3' })).map((v) => v.id)).toEqual([3]);
    expect(vorgaengeFiltern(offene, auswahl({ suche: 'events' })).map((v) => v.id)).toEqual([3]);
    expect(vorgaengeFiltern(offene, auswahl({ suche: 'Wunsch oder Idee' })).map((v) => v.id)).toEqual([4]);
    expect(vorgaengeFiltern(offene, auswahl({ suche: '   ' })).map((v) => v.id)).toEqual([1, 2, 3, 4]);
    expect(vorgangSuchtexte(vorgang(9, { gemeinde_name: 'Heide' }))).toContain('Heide');
  });

  it('neueste Aktivität zuerst, bei gleicher Zeit die höhere Nummer; die Eingabe bleibt unberührt', () => {
    const wirr = [
      vorgang(1, { letzte_aktivitaet: '2026-10-01T08:00:00Z' }),
      vorgang(2, { letzte_aktivitaet: '2026-10-03T08:00:00Z' }),
      vorgang(3, { letzte_aktivitaet: '2026-10-03T08:00:00Z' }),
      vorgang(4, { letzte_aktivitaet: '', created_at: '2026-10-02T08:00:00Z' }),
    ];
    expect(vorgaengeSortieren(wirr).map((v) => v.id)).toEqual([3, 2, 4, 1]);
    expect(wirr.map((v) => v.id)).toEqual([1, 2, 3, 4]);
  });

  it('die Gemeinden der Liste für die Auswahl: je Gemeinde einmal, nach Namen, ohne die ohne Gemeinde', () => {
    expect(gemeindenAusVorgaengen(offene)).toEqual([{ id: 7, name: 'Büsum' }, { id: 8, name: 'Heide' }]);
    expect(gemeindenAusVorgaengen([vorgang(1, { organization_id: 5, gemeinde_name: null })])).toEqual([{ id: 5, name: 'Gemeinde 5' }]);
    expect(gemeindenAusVorgaengen([])).toEqual([]);
  });

  it('Aufmerksamkeit wie die rote Zahl der Leiste: Status „Neu“ oder ungelesene Mail, nicht archiviert', () => {
    expect(brauchtAufmerksamkeit(vorgang(1, { status: 'neu' }))).toBe(true);
    expect(brauchtAufmerksamkeit(vorgang(2, { status: 'in_arbeit', ungelesen: 1 }))).toBe(true);
    expect(brauchtAufmerksamkeit(vorgang(3, { status: 'in_arbeit' }))).toBe(false);
    expect(brauchtAufmerksamkeit(vorgang(4, { status: 'neu', archiviert_am: '2026-10-03T08:00:00Z' }))).toBe(false);
  });

  it('archiviert ist, was ein Archivdatum trägt -- und jeder erledigte', () => {
    expect(istArchiviert(vorgang(1, { archiviert_am: '2026-10-03T08:00:00Z', status: 'wartet' }))).toBe(true);
    expect(istArchiviert(vorgang(2, { status: 'erledigt' }))).toBe(true);
    expect(istArchiviert(vorgang(3, { status: 'in_arbeit' }))).toBe(false);
  });

  it('aus der Adresse: Filter, Art und Gemeinde; Unbekanntes bleibt null', () => {
    expect(auswahlAusAdresse('?filter=neu&art=neue_gemeinde&gemeinde=7')).toEqual({ filter: 'neu', art: 'neue_gemeinde', gemeinde: '7' });
    expect(auswahlAusAdresse('?filter=erledigt&art=nix&gemeinde=abc')).toEqual({ filter: null, art: null, gemeinde: null });
    expect(auswahlAusAdresse('')).toEqual({ filter: null, art: null, gemeinde: null });
  });

  it('Zahlwörter: ein Vorgang, zwei Vorgänge', () => {
    expect(vorgaengeText(1)).toBe('1 Vorgang');
    expect(vorgaengeText(3)).toBe('3 Vorgänge');
  });
});

describe('Neuer Vorgang', () => {
  const voll = (teil: Partial<NeuerVorgangFormular> = {}): NeuerVorgangFormular => ({ ...LEERER_VORGANG, art: 'zugang', betreff: 'Passwort', ...teil });

  it('ohne Art, ohne Betreff, ohne Bereich bei Frage, Fehler, Wunsch: ein Satz sagt, was fehlt', () => {
    expect(neuerVorgangFehler(LEERER_VORGANG)).toBe('Bitte eine Art wählen');
    expect(neuerVorgangFehler(voll({ betreff: '  ' }))).toBe('Bitte einen Betreff eingeben');
    expect(neuerVorgangFehler(voll({ art: 'fehler' }))).toBe('Bitte einen Bereich wählen');
    expect(neuerVorgangFehler(voll({ art: 'fehler', bereich: 'chat' }))).toBeNull();
    expect(neuerVorgangFehler(voll())).toBeNull();
  });

  it('eine erste Mail braucht eine gültige Adresse', () => {
    expect(neuerVorgangFehler(voll({ text: 'Hallo' }))).toBe('Bitte die E-Mail-Adresse eingeben, an die die Mail geht');
    expect(neuerVorgangFehler(voll({ text: 'Hallo', organizationId: '7' }))).toBe('Bitte wählen, an wen die Mail geht');
    expect(neuerVorgangFehler(voll({ text: 'Hallo', an: 'kaputt' }))).toBe('Ungültige E-Mail-Adresse');
    expect(neuerVorgangFehler(voll({ text: 'Hallo', an: 'anna@example.org' }))).toBeNull();
  });

  it('der Körper trägt nur, was ausgefüllt ist; die Adresse nur mit Text', () => {
    expect(neuerVorgangKoerper(voll())).toEqual({ art: 'zugang', dringlichkeit: 'normal', betreff: 'Passwort' });
    expect(neuerVorgangKoerper(voll({ art: 'fehler', bereich: 'chat', dringlichkeit: 'dringend', betreff: '  Chat  ', organizationId: '7', text: 'Hallo\n\n', an: ' anna@example.org ' }))).toEqual({
      art: 'fehler', bereich: 'chat', dringlichkeit: 'dringend', betreff: 'Chat', organization_id: 7, text: 'Hallo', an: 'anna@example.org',
    });
    // Ohne Text keine Mail: die Adresse bleibt weg.
    expect(neuerVorgangKoerper(voll({ an: 'anna@example.org' }))).not.toHaveProperty('an');
  });
});

describe('Einsortieren und Sammelaktionen', () => {
  it('in einen bestehenden Vorgang: nur dessen Nummer', () => {
    expect(einsortierenBestehendKoerper(12)).toEqual({ vorgang_id: 12 });
  });

  it('in einen neuen: Art, Bereich, Dringlichkeit, Betreff, Gemeinde -- vorbelegt mit dem Betreff der Mail', () => {
    const f = einsortierenNeuVorbelegen('  Passwort vergessen ', '7');
    expect(f).toEqual({ art: '', bereich: '', dringlichkeit: 'normal', betreff: 'Passwort vergessen', organizationId: '7' });
    expect(einsortierenNeuFehler(f)).toBe('Bitte eine Art wählen');
    expect(einsortierenNeuFehler({ ...f, art: 'frage' })).toBe('Bitte einen Bereich wählen');
    expect(einsortierenNeuFehler({ ...f, art: 'frage', bereich: 'konten', betreff: '' })).toBe('Bitte einen Betreff eingeben');
    expect(einsortierenNeuKoerper({ ...f, art: 'frage', bereich: 'konten' })).toEqual({
      neu: { art: 'frage', bereich: 'konten', dringlichkeit: 'normal', betreff: 'Passwort vergessen', organization_id: 7 },
    });
    expect(einsortierenNeuKoerper({ ...f, art: 'sonstiges', organizationId: '' })).toEqual({
      neu: { art: 'sonstiges', dringlichkeit: 'normal', betreff: 'Passwort vergessen' },
    });
    expect(einsortierenNeuVorbelegen(null)).toMatchObject({ betreff: '', organizationId: '' });
  });

  it('Sammelkörper: Nummern und Aktion; der Status nur bei „status“', () => {
    expect(vorgangSammelKoerper([1, 2], 'archivieren')).toEqual({ ids: [1, 2], aktion: 'archivieren' });
    expect(vorgangSammelKoerper([3], 'status', 'erledigt')).toEqual({ ids: [3], aktion: 'status', status: 'erledigt' });
    expect(vorgangSammelKoerper([3], 'loeschen', 'erledigt')).toEqual({ ids: [3], aktion: 'loeschen' });
    expect(mailSammelKoerper([5, 6], 'wiederherstellen')).toEqual({ ids: [5, 6], aktion: 'wiederherstellen' });
  });
});

describe('Antwortweg: von welchem Postfach an wen', () => {
  const mail = (id: number, richtung: 'ein' | 'aus', postfach: 'moin' | 'support', von: string): MailNachricht => ({
    id, postfach, richtung, anfrage_id: null, organization_id: null, von_adresse: von, von_name: null, an_adressen: null, betreff: null,
    text: null, anhaenge: null, gesendet_am: '2026-10-03T08:00:00Z', gelesen_am: null,
  });
  const anfrage = { id: 41, email: 'anfrage@example.org' } as GemeindeAnfrage;

  it('eine Anfrage antwortet moin@ an die Adresse der Anfrage -- auch mit Gemeinde', () => {
    expect(antwortWegVon({ anfrage, organization_id: 7, kontakt_email: 'x@example.org', verlauf: [] })).toEqual({ art: 'anfrage', postfach: 'moin', an: 'anfrage@example.org' });
  });

  it('mit Gemeinde antwortet support@ an eine Adresse der Gemeinde; der Kontakt des Formulars steht zur Wahl', () => {
    expect(antwortWegVon({ anfrage: null, organization_id: 7, kontakt_email: 'kontakt@example.org', verlauf: [] })).toEqual({
      art: 'gemeinde', postfach: 'support', organizationId: 7, kontakt: 'kontakt@example.org',
    });
  });

  it('ohne Gemeinde: der Kontakt des Formulars, sonst der Absender der letzten eingehenden Mail -- aus deren Postfach', () => {
    expect(antwortWegVon({ anfrage: null, organization_id: null, kontakt_email: 'kontakt@example.org', verlauf: [] })).toEqual({ art: 'adresse', postfach: 'support', an: 'kontakt@example.org' });
    const verlauf = [mail(1, 'ein', 'moin', 'erste@example.org'), mail(2, 'ein', 'moin', 'letzte@example.org'), mail(3, 'aus', 'moin', 'moin@konfi-quest.example')];
    expect(antwortWegVon({ anfrage: null, organization_id: null, kontakt_email: null, verlauf })).toEqual({ art: 'adresse', postfach: 'moin', an: 'letzte@example.org' });
  });

  it('ohne alles gibt es niemanden, dem sich antworten ließe', () => {
    expect(antwortWegVon({ anfrage: null, organization_id: null, kontakt_email: null, verlauf: [] })).toEqual({ art: 'keiner' });
    expect(antwortWegVon({ anfrage: null, organization_id: null, kontakt_email: null, verlauf: [mail(1, 'aus', 'support', 'support@konfi-quest.example')] })).toEqual({ art: 'keiner' });
  });
});
