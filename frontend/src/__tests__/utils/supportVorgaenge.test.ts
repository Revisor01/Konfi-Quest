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
  antwortVorgangLesen,
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
  istZugeordnet,
  kennzahl,
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
  ART_SYMBOL,
  DANACH_VORGABE,
  danachWahlen,
  einordnenAenderung,
  einordnenFehler,
  einordnenHinweis,
  einordnenVorbelegen,
  mailAusAdresse,
  naechsterEintrag,
  standZeit,
  tageOffen,
  vorgangAngaben,
  vorgangKennzahlen,
  type AngabenKarte,
  type VorgangDetail,
  type VorgangGemeinde,
} from '../../utils/supportVorgaenge';
import {
  ICON_CHATS, ICON_FUNKELN, ICON_HILFE, ICON_KATEGORIE, ICON_ORGANISATION, ICON_SCHLUESSEL, ICON_SCHUTZ, ICON_WARNHINWEIS,
} from '../../components/shared/icons';

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
    // Herauslösen aus einem Vorgang: der Kern, nie roh „AW: [Vorgang 2] Re: …" (Plan, Verlauf).
    expect(einsortierenNeuVorbelegen('AW: [Vorgang 2] Re: AW: Re: Konfis sehen den Termin am Samstag nicht').betreff)
      .toBe('Konfis sehen den Termin am Samstag nicht');
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

// --- Detailseiten (docs/planung/support-detailseiten.md, „Die gemeinsame Regel-Stelle") ---

const JETZT = new Date('2026-10-11T10:00:00Z');

const GEMEINDE_7: VorgangGemeinde = {
  id: 7, name: 'st-martin', display_name: 'Test-Gemeinde St. Martin', is_active: true, is_trial: true, trial_ends_at: '2026-11-02T10:00:00Z',
  max_konfis: 5, konfi_count: 3, kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche', wunsch_lizenz: 'standard', kirchenkreis_id: 11, intern: false,
};

const detail = (teil: Partial<VorgangDetail> = {}): VorgangDetail => ({
  ...vorgang(2, { art: 'fehler', bereich: 'termine', status: 'in_arbeit', organization_id: 7, gemeinde_name: 'Test-Gemeinde St. Martin', created_at: '2026-10-09T10:21:00Z' }),
  notiz: null, beschreibung: 'Hallo Support', kontakt_name: 'Test Org-Admin 1', kontakt_email: 'orgadmin1@example.org', kontakt_funktion: 'Pastor',
  gemeinde_angabe: null, verlauf: [], anfrage: null, gemeinde: GEMEINDE_7, leitung: [], status_seit: null, updated_at: null, erstellt_von_name: null,
  empfaenger: [], ...teil,
});

const ANFRAGE_41 = {
  id: 41, gemeinde: 'Kirchengemeinde Musterdorf', kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche', kontakt_name: 'A. Beispiel',
  funktion: 'Diakonin', email: 'a.beispiel@example.org', mobil: '0170 123 45-67', anzahl_konfis: 38, anzahl_teamer: 9, nachricht: 'Wir starten im November.',
  status: 'neu', notiz: null, organization_id: null, created_at: '2026-10-09T08:02:00Z', updated_at: '2026-10-09T08:02:00Z', wunsch_lizenz: 'standard',
} as GemeindeAnfrage;

const mailMit = (id: number, teil: Partial<MailNachricht> = {}): MailNachricht => ({
  id, postfach: 'support', richtung: 'ein', anfrage_id: null, organization_id: 7, von_adresse: 'orgadmin1@example.org', von_name: 'Test Org-Admin 1',
  an_adressen: ['support@konfi-quest.example'], betreff: 'Frage', text: 'Hallo', anhaenge: null, gesendet_am: '2026-10-10T08:00:00Z', gelesen_am: null, ...teil,
});

describe('Detail lesen: die Felder, die der Server schon lieferte und der Leser verwarf', () => {
  it('status_seit, updated_at, erstellt_von_name, empfaenger (Schlüssel und Reihenfolge des Servers) und an der Gemeinde wunsch_lizenz, kirchenkreis_id, intern', () => {
    const d = vorgangDetailLesen({
      id: 2, status_seit: '2026-10-10T08:00:00Z', updated_at: '2026-10-10T09:00:00Z', erstellt_von_name: 'Test Super-Admin',
      empfaenger: [
        { adresse: 'anna@example.org', name: 'Anna', herkunft: 'absender' },
        { adresse: 'kontakt@example.org', name: null, herkunft: 'kontakt' },
        { adresse: 'ANNA@example.org', name: 'Doppelt', herkunft: 'leitung' },
        { adresse: 'kaputt', herkunft: 'verlauf' },
      ],
      gemeinde: { id: 7, name: 'st-martin', display_name: 'Test-Gemeinde St. Martin', wunsch_lizenz: 'standard', kirchenkreis_id: 11, intern: true },
    });
    expect(d).toMatchObject({ status_seit: '2026-10-10T08:00:00Z', updated_at: '2026-10-10T09:00:00Z', erstellt_von_name: 'Test Super-Admin' });
    expect(d?.empfaenger).toEqual([
      { adresse: 'anna@example.org', name: 'Anna', herkunft: 'absender' },
      { adresse: 'kontakt@example.org', name: null, herkunft: 'kontakt' },
    ]);
    expect(d?.gemeinde).toMatchObject({ wunsch_lizenz: 'standard', kirchenkreis_id: 11, intern: true });
  });

  it('ein älterer Server: sichere Werte; eine unbekannte Wunschlizenz wird null', () => {
    const d = vorgangDetailLesen({ id: 2, gemeinde: { id: 7, name: 'x', wunsch_lizenz: 'riesig', kirchenkreis_id: 'elf' } });
    expect(d).toMatchObject({ status_seit: null, updated_at: null, erstellt_von_name: null, empfaenger: [] });
    expect(d?.gemeinde).toMatchObject({ wunsch_lizenz: null, kirchenkreis_id: null, intern: false });
  });
});

describe('Antwort lesen: der Stand nach POST …/antworten (additiv seit 12.10.2026)', () => {
  it('liest `vorgang` mit Status, status_seit und archiviert_am', () => {
    expect(antwortVorgangLesen({ nachricht: { id: 99 }, vorgang: { id: 4, status: 'erledigt', status_seit: '2026-10-12T09:00:00Z', archiviert_am: '2026-10-12T09:00:00Z' } }))
      .toEqual({ id: 4, status: 'erledigt', status_seit: '2026-10-12T09:00:00Z', archiviert_am: '2026-10-12T09:00:00Z' });
    expect(antwortVorgangLesen({ nachricht: {}, vorgang: { id: 4, status: 'wartet', status_seit: null, archiviert_am: null } }))
      .toEqual({ id: 4, status: 'wartet', status_seit: null, archiviert_am: null });
  });

  it('ein älterer Server ({ nachricht }) oder ein kaputtes Feld: null -- der Status gilt als nicht bestätigt', () => {
    expect(antwortVorgangLesen({ nachricht: { id: 99 } })).toBeNull();
    expect(antwortVorgangLesen({})).toBeNull();
    expect(antwortVorgangLesen(null)).toBeNull();
    expect(antwortVorgangLesen('ok')).toBeNull();
    expect(antwortVorgangLesen({ vorgang: null })).toBeNull();
    expect(antwortVorgangLesen({ vorgang: [] })).toBeNull();
    expect(antwortVorgangLesen({ vorgang: { status: 'wartet' } })).toBeNull();
    expect(antwortVorgangLesen({ vorgang: { id: '4', status: 'wartet' } })).toBeNull();
    expect(antwortVorgangLesen({ vorgang: { id: 4, status: 'archiviert' } })).toBeNull();
    expect(antwortVorgangLesen({ vorgang: { id: 4 } })).toBeNull();
  });
});

describe('Symbol je Art', () => {
  it('jede der acht Arten hat ihr Symbol, die Lizenz das Preisschild', () => {
    expect(Object.keys(ART_SYMBOL)).toEqual(ARTEN.map((a) => a.wert));
    expect(ART_SYMBOL).toEqual({
      neue_gemeinde: ICON_ORGANISATION, frage: ICON_HILFE, fehler: ICON_WARNHINWEIS, wunsch: ICON_FUNKELN,
      zugang: ICON_SCHLUESSEL, lizenz: ICON_KATEGORIE, datenschutz: ICON_SCHUTZ, sonstiges: ICON_CHATS,
    });
  });
});

describe('Zeit im Stand und Tage offen', () => {
  it('heute, gestern, im Jahr mit Uhrzeit, sonst das Datum', () => {
    expect(standZeit('2026-10-11T10:23:00Z', JETZT)).toBe('heute, 12:23');
    expect(standZeit('2026-10-10T12:05:00Z', JETZT)).toBe('gestern, 14:05');
    expect(standZeit('2026-10-03T12:05:00Z', JETZT)).toBe('03.10., 14:05');
    expect(standZeit('2025-10-10T12:05:00Z', JETZT)).toBe('10.10.2025');
    expect(standZeit('kaputt', JETZT)).toBe('');
  });

  it('Kalendertage vom Eingang bis heute bzw. bis zum Archivieren', () => {
    // 22:30 UTC am 09.10. ist 00:30 am 10.10. in Berlin: ein Kalendertag, nicht zwei.
    expect(tageOffen({ created_at: '2026-10-09T22:30:00Z', archiviert_am: null }, JETZT)).toBe(1);
    expect(tageOffen({ created_at: '2026-10-09T21:30:00Z', archiviert_am: null }, JETZT)).toBe(2);
    expect(tageOffen({ created_at: '2026-10-09T10:21:00Z', archiviert_am: null }, JETZT)).toBe(2);
    expect(tageOffen({ created_at: '2026-09-20T10:00:00Z', archiviert_am: '2026-09-25T10:00:00Z' }, JETZT)).toBe(5);
    expect(tageOffen({ created_at: '2026-10-11T09:00:00Z', archiviert_am: null }, JETZT)).toBe(0);
    expect(tageOffen({ created_at: '', archiviert_am: null }, JETZT)).toBe(0);
  });
});

describe('Kennzahlen', () => {
  it('ein Vorgang: Mails · Neu · Tage offen; „Mails" zählt wie der Verlauf das Anliegen aus dem Formular mit', () => {
    // Freigegebene Skizze (Simon, 11.10.2026): Vorgang 2 mit Formular und fünf Mails zeigt „6 MAILS" und „Verlauf 6".
    expect(vorgangKennzahlen(detail({ verlauf: [mailMit(1), mailMit(2), mailMit(3)] }), 1, JETZT)).toEqual([
      { schluessel: 'mails', label: 'Mails', wert: '4', zahl: 4 },
      { schluessel: 'neu', label: 'Neu', wert: '1', zahl: 1 },
      { schluessel: 'tage_offen', label: 'Tage offen', wert: '2', zahl: 2 },
    ]);
    // Ohne Text aus dem Formular (reiner Mail-Vorgang) gibt es keinen Anfang: nur die Mails.
    expect(vorgangKennzahlen(detail({ beschreibung: null, verlauf: [mailMit(1), mailMit(2), mailMit(3)] }), 0, JETZT)[0])
      .toEqual({ schluessel: 'mails', label: 'Mails', wert: '3', zahl: 3 });
    expect(vorgangKennzahlen(detail({ beschreibung: '', verlauf: [] }), 0, JETZT)[0].zahl).toBe(0);
  });

  it('bei genau 1 die Einzahl: „1 Mail", „1 Tag offen", „1 Konfi", „1 Teamer:in", „1 Anhang" -- „Neu" bleibt', () => {
    const eins = vorgangKennzahlen(detail({ beschreibung: null, verlauf: [mailMit(1)], created_at: '2026-10-10T10:00:00Z' }), 1, JETZT);
    expect(eins.map((k) => [k.label, k.zahl])).toEqual([['Mail', 1], ['Neu', 1], ['Tag offen', 1]]);
    const anfrage = vorgangKennzahlen(detail({ beschreibung: null, anfrage: { ...ANFRAGE_41, anzahl_konfis: 1, anzahl_teamer: 1 }, verlauf: [] }), 0, JETZT);
    expect(anfrage.map((k) => k.label)).toEqual(['Konfi', 'Teamer:in', 'Mail']);
    expect(kennzahl('anhaenge', 1).label).toBe('Anhang');
    expect(kennzahl('anhaenge', 2).label).toBe('Anhänge');
    expect(kennzahl('mails', 0).label).toBe('Mails');
    expect(kennzahl('konfis', null).label).toBe('Konfis');
  });

  it('auch der Lizenz-Vorgang: die Konfis stehen nur in der Karte', () => {
    expect(vorgangKennzahlen(detail({ art: 'lizenz', bereich: null }), 0, JETZT).map((k) => k.schluessel)).toEqual(['mails', 'neu', 'tage_offen']);
  });

  it('eine Anfrage: Konfis · Teamer:innen · Mails (mit der Nachricht der Anfrage); ohne Angabe „–"', () => {
    // Skizze: die Anfrage mit zwei Mails zeigt „3 MAILS" und „Verlauf 3".
    expect(vorgangKennzahlen(detail({ beschreibung: null, anfrage: ANFRAGE_41, verlauf: [mailMit(1), mailMit(2)] }), 0, JETZT)).toEqual([
      { schluessel: 'konfis', label: 'Konfis', wert: '38', zahl: 38 },
      { schluessel: 'teamer', label: 'Teamer:innen', wert: '9', zahl: 9 },
      { schluessel: 'mails', label: 'Mails', wert: '3', zahl: 3 },
    ]);
    expect(vorgangKennzahlen(detail({ beschreibung: null, anfrage: { ...ANFRAGE_41, nachricht: null }, verlauf: [mailMit(1)] }), 0, JETZT)[2].zahl).toBe(1);
    expect(vorgangKennzahlen(detail({ anfrage: { ...ANFRAGE_41, anzahl_teamer: null } }), 0, JETZT)[1]).toEqual({ schluessel: 'teamer', label: 'Teamer:innen', wert: '–', zahl: null });
  });
});

describe('Angaben als Karten -- keine Angabe doppelt', () => {
  const zeilen = (k: AngabenKarte | undefined) => (k?.zeilen ?? []).map((z) => [z.label, z.wert]);

  it('Anliegen einer zugeordneten Gemeinde: Kontakt, dann Gemeinde mit Laufzeit (Ton), Konfis, Kreis, Leitung und Links', () => {
    const karten = vorgangAngaben(detail({
      leitung: [
        { id: 21, display_name: 'Test Org-Admin 1', username: 'orgadmin1', email: 'orgadmin1@example.org', is_active: true, last_login_at: '2026-10-02T08:00:00Z' },
        { id: 22, display_name: '', username: 'gesperrt.konto', email: null, is_active: false, last_login_at: null },
      ],
    }), { jetzt: JETZT });
    expect(karten.map((k) => k.schluessel)).toEqual(['kontakt', 'gemeinde']);
    expect(zeilen(karten[0])).toEqual([
      ['Person', 'Test Org-Admin 1 (Pastor)'], ['E-Mail', 'orgadmin1@example.org'], ['Eingang', 'Support-Formular auf der Homepage'],
    ]);
    expect(karten[0].zeilen[1]).toMatchObject({ href: 'mailto:orgadmin1@example.org', aktion: { art: 'im_vorgang_antworten', label: 'Im Vorgang antworten', adresse: 'orgadmin1@example.org' } });
    const g = karten[1];
    expect(g.titel).toBe('Test-Gemeinde St. Martin');
    expect(zeilen(g)).toEqual([['Laufzeit', 'Testphase bis 02.11.'], ['Konfis', '3 von 5'], ['Kreis', 'Dithmarschen › Nordkirche']]);
    expect(g.zeilen[0]).toMatchObject({ ton: 'info', titel: 'Testphase bis 02.11.2026, noch 22 Tage' });
    expect(g.zeilen[1].ton).toBe('info');
    expect(g.links).toEqual([
      { label: 'Gemeinde öffnen', href: '/admin/organizations?gemeinde=7' },
      { label: 'Alle Vorgänge', href: '/admin/support/vorgaenge?gemeinde=7' },
    ]);
    expect(g.leitung).toEqual([
      { id: 21, name: 'Test Org-Admin 1', benutzername: 'orgadmin1', gesperrt: false, email: 'orgadmin1@example.org', anmeldung: 'zuletzt angemeldet 02.10.2026' },
      { id: 22, name: 'gesperrt.konto', benutzername: 'gesperrt.konto', gesperrt: true, email: null, anmeldung: 'noch nicht angemeldet' },
    ]);
  });

  it('ohne Zuordnung: „Nicht zugeordnet – laut Formular: X" mit Zuordnen in der Kontakt-Karte, keine Gemeinde-Karte, keine Links', () => {
    const karten = vorgangAngaben(detail({ organization_id: null, gemeinde: null, gemeinde_name: 'Kirchengemeinde Heide', gemeinde_angabe: 'Kirchengemeinde Heide' }), { jetzt: JETZT });
    expect(karten.map((k) => k.schluessel)).toEqual(['kontakt']);
    expect(karten[0].zeilen.find((z) => z.schluessel === 'zuordnung')).toEqual({
      schluessel: 'zuordnung', label: 'Gemeinde', wert: 'Nicht zugeordnet – laut Formular: Kirchengemeinde Heide', aktion: { art: 'zuordnen', label: 'Zuordnen' },
    });
    expect(karten.flatMap((k) => k.links)).toEqual([]);
  });

  it('Mail-Vorgang: Kontakt ist der erste Absender, Eingang „Mail an support@"; vom Support angelegt: „Angelegt von"', () => {
    const mail = vorgangAngaben(detail({ quelle: 'mail', beschreibung: null, kontakt_name: null, kontakt_email: null, kontakt_funktion: null,
      verlauf: [mailMit(1, { von_name: 'Sam Muster', von_adresse: 'sam@example.org' })] }), { jetzt: JETZT });
    expect(zeilen(mail[0])).toEqual([['Person', 'Sam Muster'], ['E-Mail', 'sam@example.org'], ['Eingang', 'Mail an support@']]);
    const support = vorgangAngaben(detail({ quelle: 'support', beschreibung: null, erstellt_von_name: 'Test Super-Admin' }), { jetzt: JETZT });
    expect(zeilen(support[0]).slice(-2)).toEqual([['Eingang', 'Vom Support angelegt'], ['Angelegt von', 'Test Super-Admin']]);
  });

  it('Anfrage: Karte „Anfrage" vor „Kontakt"; Mobil beim Kontakt; Eingang nur in der Anfrage; kein „Nicht zugeordnet"', () => {
    const karten = vorgangAngaben(detail({ organization_id: null, gemeinde: null, quelle: 'anfrage', anfrage: ANFRAGE_41, beschreibung: null,
      kontakt_name: null, kontakt_email: null, kontakt_funktion: null }), { jetzt: JETZT, kirchenkreisInStruktur: false });
    expect(karten.map((k) => k.schluessel)).toEqual(['anfrage', 'kontakt']);
    expect(zeilen(karten[0])).toEqual([
      ['Gemeinde', 'Kirchengemeinde Musterdorf (angefragt)'],
      ['Kreis', 'Dithmarschen › Nordkirche · fehlt noch'],
      ['Wunsch', 'Standard — bis 50 Konfis · 99\u00a0€ pro Jahr'],
      ['Eingang', 'Anfrage über die Homepage'],
    ]);
    expect(karten[0].zeilen[1].aktion).toEqual({ art: 'kirchenkreis_anlegen', label: 'Als Kirchenkreis anlegen' });
    expect(zeilen(karten[1])).toEqual([['Person', 'A. Beispiel (Diakonin)'], ['E-Mail', 'a.beispiel@example.org'], ['Mobil', '0170 123 45-67']]);
    expect(karten[1].zeilen[2].href).toBe('tel:01701234567');
    // Jede Angabe einmal: die Gemeinde der Anfrage, ihr Kreis, der Eingang.
    const alle = karten.flatMap((k) => k.zeilen.map((z) => z.wert));
    expect(alle.filter((w) => w.includes('Kirchengemeinde Musterdorf'))).toHaveLength(1);
    expect(alle.filter((w) => w.includes('Dithmarschen'))).toHaveLength(1);
    expect(alle.filter((w) => w.includes('Homepage'))).toHaveLength(1);
  });

  it('Anfrage: der Kreis steht in der Struktur -- ohne Aktion; unbekannt: ohne Zusatz; ohne Wunsch „Noch offen"', () => {
    const da = vorgangAngaben(detail({ anfrage: ANFRAGE_41, organization_id: null, gemeinde: null }), { jetzt: JETZT, kirchenkreisInStruktur: true })[0];
    expect(da.zeilen[1]).toEqual({ schluessel: 'kreis', label: 'Kreis', wert: 'Dithmarschen › Nordkirche · steht in der Struktur' });
    const unbekannt = vorgangAngaben(detail({ anfrage: { ...ANFRAGE_41, wunsch_lizenz: null }, organization_id: null, gemeinde: null }), { jetzt: JETZT })[0];
    expect(zeilen(unbekannt).slice(1, 3)).toEqual([['Kreis', 'Dithmarschen › Nordkirche'], ['Wunsch', 'Noch offen']]);
  });

  it('Lizenz-Vorgang: Karte „Lizenz" zuerst mit Tarif, Konfis, Laufzeit, Wunsch; die Gemeinde-Karte ohne Laufzeit und Konfis', () => {
    const karten = vorgangAngaben(detail({ art: 'lizenz', bereich: null }), { jetzt: JETZT });
    expect(karten.map((k) => k.schluessel)).toEqual(['lizenz', 'kontakt', 'gemeinde']);
    expect(karten[0]).toMatchObject({ titel: 'Lizenz', aktion: { art: 'lizenz_aendern', label: 'Ändern', gesperrt: false }, links: [] });
    expect(zeilen(karten[0])).toEqual([
      ['Tarif', 'Testphase — bis 5 Konfis · kostenlos'],
      ['Konfis', '3 von 5'],
      ['Laufzeit', 'Testphase bis 02.11.'],
      ['Wunsch bei der Anmeldung', 'Standard — bis 50 Konfis · 99\u00a0€ pro Jahr'],
    ]);
    expect(zeilen(karten[2])).toEqual([['Kreis', 'Dithmarschen › Nordkirche']]);
  });

  it('Lizenz: Konfis im Ton des Limits, ohne Limit „· ohne Limit", Wunsch gleich Tarif, gesperrt', () => {
    const voll = vorgangAngaben(detail({ art: 'lizenz', bereich: null, gemeinde: { ...GEMEINDE_7, konfi_count: 5, max_konfis: 5 } }), { jetzt: JETZT })[0];
    expect(voll.zeilen[1]).toMatchObject({ wert: '5 von 5', ton: 'fehler' });
    const fast = vorgangAngaben(detail({ art: 'lizenz', bereich: null, gemeinde: { ...GEMEINDE_7, konfi_count: 45, max_konfis: 50, wunsch_lizenz: 'standard', is_active: false } }), { jetzt: JETZT })[0];
    expect(zeilen(fast)).toEqual([
      ['Tarif', 'Standard — bis 50 Konfis · 99\u00a0€ pro Jahr'],
      ['Konfis', '45 von 50'],
      ['Laufzeit', 'Testphase bis 02.11.'],
      ['Wunsch bei der Anmeldung', 'Standard — bis 50 Konfis · 99\u00a0€ pro Jahr · entspricht dem Tarif'],
      ['Zugang', 'Gesperrt'],
    ]);
    expect(fast.zeilen[1].ton).toBe('warnung');
    const offen = vorgangAngaben(detail({ art: 'lizenz', bereich: null, gemeinde: { ...GEMEINDE_7, max_konfis: null, wunsch_lizenz: null } }), { jetzt: JETZT })[0];
    expect(zeilen(offen).slice(0, 2)).toEqual([['Tarif', 'Unbegrenzt — ohne Konfi-Grenze'], ['Konfis', '3 · ohne Limit']]);
    expect(offen.zeilen[1].ton).toBeUndefined();
  });

  it('Lizenz ohne Gemeinde: eine Zeile „Nicht zugeordnet" mit Zuordnen, Ändern gesperrt; nicht noch einmal beim Kontakt', () => {
    const karten = vorgangAngaben(detail({ art: 'lizenz', bereich: null, organization_id: null, gemeinde: null, gemeinde_angabe: 'Kirchengemeinde Heide' }), { jetzt: JETZT });
    expect(karten.map((k) => k.schluessel)).toEqual(['lizenz', 'kontakt']);
    expect(karten[0]).toMatchObject({ aktion: { art: 'lizenz_aendern', label: 'Ändern', gesperrt: true } });
    expect(zeilen(karten[0])).toEqual([['Gemeinde', 'Nicht zugeordnet – laut Formular: Kirchengemeinde Heide']]);
    expect(karten[1].zeilen.some((z) => z.schluessel === 'zuordnung')).toBe(false);
  });
});

describe('Einordnen: ein Entwurf, eine Prüfung, ein PATCH mit dem Geänderten', () => {
  it('vorbelegt aus dem Vorgang', () => {
    expect(einordnenVorbelegen(detail({ dringlichkeit: 'dringend' }))).toEqual({
      status: 'in_arbeit', art: 'fehler', bereich: 'termine', dringlichkeit: 'dringend', gemeinde: '7', betreff: 'Betreff 2',
    });
    expect(einordnenVorbelegen(detail({ bereich: null, organization_id: null }))).toMatchObject({ bereich: '', gemeinde: '' });
  });

  it('Pflicht-Bereich, leerer und zu langer Betreff', () => {
    const e = einordnenVorbelegen(detail());
    expect(einordnenFehler(e)).toBeNull();
    expect(einordnenFehler({ ...e, art: 'frage', bereich: '' })).toBe('Bitte einen Bereich wählen');
    expect(einordnenFehler({ ...e, art: 'lizenz', bereich: '' })).toBeNull();
    expect(einordnenFehler({ ...e, betreff: '  \n ' })).toBe('Bitte einen Betreff eingeben');
    expect(einordnenFehler({ ...e, betreff: 'x'.repeat(301) })).toBe('Der Betreff darf höchstens 300 Zeichen haben');
  });

  it('nur das Geänderte; Gemeinde und Bereich leer sind null; der Betreff einzeilig', () => {
    const v = detail();
    const e = einordnenVorbelegen(v);
    expect(einordnenAenderung(v, e)).toEqual({});
    expect(einordnenAenderung(v, { ...e, status: 'wartet', gemeinde: '', bereich: '', betreff: '  Neuer\nBetreff ' })).toEqual({
      status: 'wartet', organization_id: null, bereich: null, betreff: 'Neuer Betreff',
    });
    expect(einordnenAenderung(v, { ...e, art: 'wunsch', dringlichkeit: 'dringend', gemeinde: '8' })).toEqual({ art: 'wunsch', dringlichkeit: 'dringend', organization_id: 8 });
  });

  it('Hinweis nur bei Erledigt -- bei einer nicht angelegten Anfrage: die Ablehnung', () => {
    const v = detail();
    expect(einordnenHinweis(v, einordnenVorbelegen(v))).toBeNull();
    expect(einordnenHinweis(v, { ...einordnenVorbelegen(v), status: 'erledigt' })).toBe(ERLEDIGT_HINWEIS);
    const a = detail({ anfrage: ANFRAGE_41 });
    expect(einordnenHinweis(a, { ...einordnenVorbelegen(a), status: 'erledigt' })).toBe('Erledigt lehnt die Anfrage ab; sie wird nach 180 Tagen gelöscht.');
    const angelegt = detail({ anfrage: { ...ANFRAGE_41, status: 'angelegt' } });
    expect(einordnenHinweis(angelegt, { ...einordnenVorbelegen(angelegt), status: 'erledigt' })).toBe(ERLEDIGT_HINWEIS);
  });
});

describe('Danach, nächster Eintrag, ?mail=', () => {
  it('Vorgabe Wartet; bei einer nicht angelegten Anfrage ohne Erledigt', () => {
    const offen = { status: 'in_arbeit', archiviert_am: null } as const;
    expect(DANACH_VORGABE).toBe('wartet');
    expect(danachWahlen({ ...offen, anfrage: null })).toEqual(['wartet', 'in_arbeit', 'erledigt']);
    expect(danachWahlen({ ...offen, anfrage: ANFRAGE_41 })).toEqual(['wartet', 'in_arbeit']);
    expect(danachWahlen({ ...offen, anfrage: { ...ANFRAGE_41, status: 'abgelehnt' } })).toEqual(['wartet', 'in_arbeit']);
    expect(danachWahlen({ ...offen, anfrage: { ...ANFRAGE_41, status: 'angelegt' } })).toEqual(['wartet', 'in_arbeit', 'erledigt']);
  });

  it('erledigt oder im Archiv: kein „Danach“ -- eine Antwort lässt den Status (Stand 1b und 1c); zurück holt nur „Wiederherstellen“', () => {
    // Eine abgelehnte Anfrage: „Wartet“ holte Vorgang und Anfrage aus dem Archiv, die Ablehnung wäre still weg.
    expect(danachWahlen({ status: 'erledigt', archiviert_am: '2026-10-02T12:00:00Z', anfrage: { ...ANFRAGE_41, status: 'abgelehnt' } })).toEqual([]);
    expect(danachWahlen({ status: 'erledigt', archiviert_am: '2026-10-02T12:00:00Z', anfrage: null })).toEqual([]);
    expect(danachWahlen({ status: 'erledigt', archiviert_am: null, anfrage: null })).toEqual([]);
    expect(danachWahlen({ status: 'wartet', archiviert_am: '2026-10-02T12:00:00Z', anfrage: null })).toEqual([]);
    expect(danachWahlen({ status: 'erledigt', archiviert_am: '2026-10-02T12:00:00Z', anfrage: { ...ANFRAGE_41, status: 'angelegt' } })).toEqual([]);
  });

  it('der nächste Eintrag: danach, sonst davor, sonst keiner', () => {
    expect(naechsterEintrag([4, 7, 9], 7)).toBe(9);
    expect(naechsterEintrag([4, 7, 9], 9)).toBe(7);
    expect(naechsterEintrag([7], 7)).toBeNull();
    expect(naechsterEintrag([4, 9], 7)).toBeNull();
  });

  it('nach einer Sammelaktion: die mit abgeschlossenen werden übersprungen', () => {
    expect(naechsterEintrag([4, 7, 9, 11], 7, [7, 9])).toBe(11);
    expect(naechsterEintrag([4, 7, 9], 7, [7, 9])).toBe(4);
    expect(naechsterEintrag([4, 7, 9], 7, [4, 7, 9])).toBeNull();
  });

  it('?mail= aus der Adresse', () => {
    expect(mailAusAdresse('?mail=5')).toBe(5);
    expect(mailAusAdresse('?filter=offen&mail=12')).toBe(12);
    expect(mailAusAdresse('?mail=0')).toBeNull();
    expect(mailAusAdresse('?mail=abc')).toBeNull();
    expect(mailAusAdresse('')).toBeNull();
  });
});

describe('Zugeordnet ist ein Vorgang nur mit organization_id (Fehler vorab 3)', () => {
  it('der Gemeindename aus Formular oder Anfrage zählt nicht', () => {
    expect(istZugeordnet(vorgang(1, { organization_id: null, gemeinde_name: 'Kirchengemeinde Heide' }))).toBe(false);
    expect(istZugeordnet(vorgang(2, { organization_id: null, gemeinde_name: null }))).toBe(false);
    expect(istZugeordnet(vorgang(3, { organization_id: 7, gemeinde_name: 'Kirchengemeinde Musterdorf' }))).toBe(true);
    // Auch ohne Namen: Die Zuordnung steht in der Kennung.
    expect(istZugeordnet(vorgang(4, { organization_id: 7, gemeinde_name: null }))).toBe(true);
  });
});
