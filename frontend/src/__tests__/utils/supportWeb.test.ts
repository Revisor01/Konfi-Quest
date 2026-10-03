// Reine Regeln der Web-Fassung der Support-Ansicht (utils/supportWeb.ts,
// 03.10.2026, docs/planung/support-web.md): die neuen Antwortformen defensiv
// lesen, Monate und Wochen benennen, Suche (Umlaute, Hervorheben), Gruppen
// Landeskirche -> Kirchenkreis, Laufzeit und Limit, Filter und Zaehler von
// Anfragen und Posteingang.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  EINGANG_FILTER,
  eingangFiltern,
  eingangLesen,
  eingangSortieren,
  eingangZaehlen,
  filterAusAdresse,
  gemeindePasst,
  gemeindenGruppieren,
  gemeindenLesen,
  gruppenSchluessel,
  istNichtZugeordnet,
  laufzeitAngabe,
  limitAnteil,
  limitTon,
  mailLesen,
  monatKurz,
  monatLang,
  monatName,
  suchSegmente,
  suchTreffer,
  suchbegriff,
  uebersichtLesen,
  wocheKurz,
  wocheLang,
  zuordnungZiel,
  type MailEingangWeb,
  type SupportGemeinde,
} from '../../utils/supportWeb';
import { VORGANG_FILTER } from '../../utils/supportVorgaenge';

// Datumsangaben im Test sind die eines Geraets in Deutschland.
let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

const JETZT = new Date('2026-10-03T08:30:00Z');

const gemeinde = (id: number, name: string, extra: Partial<SupportGemeinde> = {}): SupportGemeinde => ({
  id, name: name.toLowerCase(), display_name: name, is_active: true, is_trial: false, trial_ends_at: null, max_konfis: null,
  konfi_count: 10, team_count: 2, created_at: '2026-01-01T00:00:00Z',
  kirchenkreis_id: null, kirchenkreis: null, landeskirche_id: null, landeskirche: null, wunsch_lizenz: null, leitung: [],
  ...extra,
});

describe('Monate und Wochen', () => {
  it('kurz, lang und Name; Unbekanntes bleibt, wie es ist', () => {
    expect(monatKurz('2025-11')).toBe('Nov');
    expect(monatKurz('2026-03')).toBe('Mär');
    expect(monatKurz('2026-10')).toBe('Okt');
    expect(monatLang('2026-10')).toBe('Oktober 2026');
    expect(monatName('2026-12')).toBe('Dezember');
    expect(monatKurz('kaputt')).toBe('kaputt');
    expect(monatKurz('2026-13')).toBe('2026-13');
    expect(wocheKurz('2026-W40')).toBe('KW 40');
    expect(wocheKurz('2026-W05')).toBe('KW 5');
    expect(wocheLang('2026-W40')).toBe('Kalenderwoche 40, 2026');
    expect(wocheKurz('x')).toBe('x');
  });
});

describe('uebersichtLesen: der Vertrag von GET /support/uebersicht', () => {
  const monate = ['2026-09', '2026-10'];
  const voll = {
    kennzahlen: {
      gemeinden: { gesamt: 15, testphase: 4, lizenz: 8, unbegrenzt: 2, gesperrt: 1 },
      konten: { konfi: 100, teamer: 20, admin: 5, org_admin: 3 },
      aktiv_30_tage: 90, anfragen_offen: 5, mails_ungelesen: 3,
    },
    entwicklung: {
      monate, gemeinden_neu: [1, 2], konten_neu: { konfi: [10, 20], team: [1, 2] }, konten_gesamt: [100, 130], anfragen_neu: [3, 4],
    },
    aktivitaet: { wochen: ['2026-W39', '2026-W40'], antraege: [5, 6], buchungen: [1, 2], nachrichten: [50, 60] },
    neueste_anfragen: [{ id: 41, gemeinde: 'Musterdorf', kontakt_name: 'Alex Beispiel', status: 'neu', wunsch_lizenz: 'standard', created_at: '2026-10-03T07:00:00Z', ungelesen: 1 }],
    neueste_mails: [{ id: 301, postfach: 'support', von_name: null, von_adresse: 'a@example.org', betreff: 'Hallo', gesendet_am: '2026-10-03T07:00:00Z', gelesen_am: null, anfrage_id: null, organization_id: 7, gemeinde_name: 'Büsum' }],
    testphase_endet: [{ id: 5, display_name: 'Seehausen', trial_ends_at: '2026-10-07T00:00:00Z' }],
  };

  it('liest die Zahlen und Reihen wie geliefert', () => {
    const u = uebersichtLesen(voll)!;
    expect(u.kennzahlen.gemeinden).toEqual({ gesamt: 15, testphase: 4, lizenz: 8, unbegrenzt: 2, gesperrt: 1 });
    expect(u.kennzahlen.konten).toEqual({ konfi: 100, teamer: 20, admin: 5, org_admin: 3 });
    expect(u.entwicklung.monate).toEqual(monate);
    expect(u.entwicklung.konten_neu).toEqual({ konfi: [10, 20], team: [1, 2] });
    expect(u.aktivitaet.nachrichten).toEqual([50, 60]);
    expect(u.neueste_anfragen).toHaveLength(1);
    expect(u.neueste_mails[0]).toMatchObject({ id: 301, postfach: 'support', organization_id: 7, anfrage_id: null, gemeinde_name: 'Büsum', von_name: null });
    expect(u.testphase_endet).toEqual([{ id: 5, display_name: 'Seehausen', trial_ends_at: '2026-10-07T00:00:00Z' }]);
  });

  it('kurze Reihen werden hinten mit 0 aufgefuellt, zu lange gekappt -- Reihe und Monate bleiben gleich lang', () => {
    const u = uebersichtLesen({ ...voll, entwicklung: { ...voll.entwicklung, gemeinden_neu: [1], konten_gesamt: [1, 2, 3, 4] } })!;
    expect(u.entwicklung.gemeinden_neu).toEqual([1, 0]);
    expect(u.entwicklung.konten_gesamt).toEqual([1, 2]);
  });

  it('fehlende Teile zaehlen 0 oder leer; ohne Kennzahlen ist die Antwort unbrauchbar', () => {
    const u = uebersichtLesen({ kennzahlen: {} })!;
    expect(u.kennzahlen.gemeinden.gesamt).toBe(0);
    expect(u.kennzahlen.aktiv_30_tage).toBe(0);
    expect(u.entwicklung.monate).toEqual([]);
    expect(u.neueste_anfragen).toEqual([]);
    expect(uebersichtLesen(null)).toBeNull();
    expect(uebersichtLesen([])).toBeNull();
    expect(uebersichtLesen({ entwicklung: {} })).toBeNull();
  });

  it('Eintraege ohne Kennung fallen weg, unbekannter Status wird "neu"', () => {
    const u = uebersichtLesen({ ...voll, neueste_anfragen: [{ gemeinde: 'ohne Id' }, { id: 2, status: 'seltsam' }], neueste_mails: [{ betreff: 'x' }] })!;
    expect(u.neueste_anfragen.map((a) => [a.id, a.status])).toEqual([[2, 'neu']]);
    expect(u.neueste_mails).toEqual([]);
  });
});

describe('Mails mit Zuordnung', () => {
  it('mailLesen: Zuordnung und Gemeindename; ohne Zuordnung null', () => {
    expect(mailLesen({ id: 1, postfach: 'moin', von_adresse: 'a@example.org', anfrage_id: 41, gemeinde_name: 'Musterdorf' })).toMatchObject({ id: 1, anfrage_id: 41, organization_id: null, gemeinde_name: 'Musterdorf', postfach: 'moin' });
    expect(mailLesen({ id: 2, postfach: 'support' })).toMatchObject({ anfrage_id: null, organization_id: null, gemeinde_name: null, vorgang_id: null, archiviert_am: null });
    // Seit den Vorgaengen: der Vorgang der Mail und das Archivdatum.
    expect(mailLesen({ id: 3, postfach: 'moin', vorgang_id: 12, archiviert_am: '2026-10-03T08:00:00Z' })).toMatchObject({ vorgang_id: 12, archiviert_am: '2026-10-03T08:00:00Z' });
    expect(mailLesen({ postfach: 'moin' })).toBeNull();
    expect(mailLesen('x')).toBeNull();
  });

  it('eingangLesen: Liste oder null', () => {
    expect(eingangLesen([{ id: 1, postfach: 'moin' }, { kaputt: true }])).toHaveLength(1);
    expect(eingangLesen({})).toBeNull();
  });

  it('zuordnungZiel: Vorgang, sonst Anfrage oder Gemeinde (aeltere Server), nichts', () => {
    expect(zuordnungZiel({ vorgang_id: 12, anfrage_id: 41, organization_id: 7, gemeinde_name: 'Musterdorf' })).toEqual({ art: 'vorgang', pfad: '/admin/support/vorgaenge/12', text: 'Musterdorf' });
    expect(zuordnungZiel({ vorgang_id: 12, anfrage_id: null, organization_id: null, gemeinde_name: null })).toEqual({ art: 'vorgang', pfad: '/admin/support/vorgaenge/12', text: 'Vorgang 12' });
    // Die alten Adressen fuehren in die Vorgaenge: die Anfrage zu ihrem Vorgang, die Gemeinde zur Liste ihrer Vorgaenge.
    expect(zuordnungZiel({ anfrage_id: 41, organization_id: null, gemeinde_name: 'Musterdorf' })).toEqual({ art: 'anfrage', pfad: '/admin/support/anfragen/41', text: 'Musterdorf' });
    expect(zuordnungZiel({ anfrage_id: null, organization_id: 7, gemeinde_name: null })).toEqual({ art: 'gemeinde', pfad: '/admin/support/vorgaenge?gemeinde=7', text: 'Gemeinde 7' });
    expect(zuordnungZiel({ anfrage_id: null, organization_id: null, gemeinde_name: null })).toBeNull();
  });

  const mail = (id: number, postfach: 'moin' | 'support', zu: Partial<MailEingangWeb> = {}): MailEingangWeb => ({
    id, postfach, von_adresse: 'a@example.org', von_name: null, betreff: 'x', gesendet_am: '2026-10-03T07:00:00Z', gelesen_am: null,
    anfrage_id: null, organization_id: null, gemeinde_name: null, ...zu,
  });
  const mails = [mail(1, 'moin', { anfrage_id: 4 }), mail(2, 'support', { organization_id: 3 }), mail(3, 'support'), mail(4, 'moin')];

  it('Zaehler und Filter des Posteingangs: Alle, Ungelesen, moin@, support@ -- „Archiv" ist eine andere Liste', () => {
    expect(eingangZaehlen(mails)).toEqual({ alle: 4, ungelesen: 4, moin: 2, support: 2 });
    expect(eingangFiltern(mails, 'alle').map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(eingangFiltern(mails, 'moin').map((m) => m.id)).toEqual([1, 4]);
    expect(eingangFiltern(mails, 'support').map((m) => m.id)).toEqual([2, 3]);
    // Das Archiv wird eigens geladen; auf der geladenen Liste filtert es nichts weg.
    expect(eingangFiltern(mails, 'archiv').map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(EINGANG_FILTER).toEqual(['alle', 'ungelesen', 'moin', 'support', 'archiv']);
  });

  it('istNichtZugeordnet: ohne Anfrage, Gemeinde und Vorgang', () => {
    expect(istNichtZugeordnet(mail(1, 'moin'))).toBe(true);
    expect(istNichtZugeordnet(mail(2, 'moin', { vorgang_id: 3 }))).toBe(false);
    expect(istNichtZugeordnet(mail(3, 'moin', { anfrage_id: 3 }))).toBe(false);
    expect(istNichtZugeordnet(mail(4, 'moin', { organization_id: 3 }))).toBe(false);
  });

  it('Ungelesen zaehlt jede Mail ohne Lesezeit, zugeordnet oder nicht', () => {
    const gemischt = [mail(1, 'moin', { anfrage_id: 4 }), mail(2, 'support', { organization_id: 3, gelesen_am: '2026-10-03T08:00:00Z' }), mail(3, 'support'), mail(4, 'moin', { gelesen_am: '2026-10-03T08:00:00Z' })];
    expect(eingangZaehlen(gemischt).ungelesen).toBe(2);
    expect(eingangFiltern(gemischt, 'ungelesen').map((m) => m.id)).toEqual([1, 3]);
    expect(eingangZaehlen([]).ungelesen).toBe(0);
  });

  it('eingangSortieren: neueste Sendezeit zuerst, bei gleicher Zeit die hoehere Kennung; die Eingabe bleibt unberuehrt', () => {
    const wirr = [
      mail(5, 'moin', { gesendet_am: '2026-09-28T10:00:00Z' }),
      mail(2, 'moin', { gesendet_am: '2026-10-03T08:00:00Z' }),
      mail(9, 'support', { gesendet_am: '2026-10-03T08:00:00Z' }),
      mail(7, 'moin', { gesendet_am: '2026-10-02T08:00:00Z' }),
    ];
    expect(eingangSortieren(wirr).map((m) => m.id)).toEqual([9, 2, 7, 5]);
    expect(wirr.map((m) => m.id)).toEqual([5, 2, 9, 7]);
  });

  it('eingangSortieren: eine Mail ohne lesbare Zeit steht ganz unten, statt die Reihenfolge zu stoeren', () => {
    const wirr = [mail(1, 'moin', { gesendet_am: 'kaputt' }), mail(2, 'moin', { gesendet_am: '2026-09-01T08:00:00Z' })];
    expect(eingangSortieren(wirr).map((m) => m.id)).toEqual([2, 1]);
  });
});

describe('gemeindenLesen', () => {
  it('liest die Felder des Vertrags samt Leitung; kaputte Eintraege fallen weg', () => {
    const liste = gemeindenLesen([
      {
        id: 1, name: 'musterdorf', display_name: 'Musterdorf', is_active: false, is_trial: true, trial_ends_at: '2026-10-12T00:00:00Z', max_konfis: 5,
        konfi_count: 4, team_count: 2, created_at: '2026-09-01T00:00:00Z', kirchenkreis_id: 11, kirchenkreis: 'Küstenland', landeskirche_id: 1, landeskirche: 'Nordland',
        wunsch_lizenz: 'klein',
        leitung: [{ id: 10, display_name: 'Alex Beispiel', username: 'alex', email: 'alex@example.org', is_active: false, last_login_at: null }, { display_name: 'ohne Id' }],
      },
      { name: 'ohne id' },
      'kaputt',
    ])!;
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ id: 1, is_active: false, is_trial: true, max_konfis: 5, konfi_count: 4, team_count: 2, kirchenkreis: 'Küstenland', wunsch_lizenz: 'klein' });
    expect(liste[0].leitung).toEqual([{ id: 10, display_name: 'Alex Beispiel', username: 'alex', email: 'alex@example.org', is_active: false, last_login_at: null }]);
    expect(gemeindenLesen({})).toBeNull();
  });
});

describe('Suche: Umlaute, Hervorheben, Felder', () => {
  it('suchbegriff: klein, ae statt ä, Leerraum zusammen', () => {
    expect(suchbegriff('  Büsum  ')).toBe('buesum');
    expect(suchbegriff('Straße')).toBe('strasse');
    expect(suchbegriff('A   B')).toBe('a b');
    expect(suchbegriff('   ')).toBe('');
  });

  it('wer "buesum" tippt, findet "Büsum" -- und umgekehrt; Treffer liegen im Originaltext', () => {
    expect(suchTreffer('Kirchengemeinde Büsum', 'buesum')).toEqual([[16, 21]]);
    expect(suchTreffer('Kirchengemeinde Buesum', 'büsum')).toEqual([[16, 22]]);
    expect(suchTreffer('Büsum und Büsum', 'büsum')).toEqual([[0, 5], [10, 15]]);
    expect(suchTreffer('Nichts', 'xyz')).toEqual([]);
    expect(suchTreffer('Text', '')).toEqual([]);
  });

  it('suchSegmente zerlegt in Treffer und Rest und gibt den Text unveraendert wieder', () => {
    const segmente = suchSegmente('Alex Beispiel', 'bei');
    expect(segmente).toEqual([{ text: 'Alex ', treffer: false }, { text: 'Bei', treffer: true }, { text: 'spiel', treffer: false }]);
    expect(segmente.map((s) => s.text).join('')).toBe('Alex Beispiel');
    expect(suchSegmente('Alex', '')).toEqual([{ text: 'Alex', treffer: false }]);
    expect(suchSegmente('Straße', 'ss')).toEqual([{ text: 'Stra', treffer: false }, { text: 'ß', treffer: true }, { text: 'e', treffer: false }]);
  });

  it('gemeindePasst: Gemeinde, Kirchenkreis, Landeskirche, Name, Benutzername und E-Mail der Leitung', () => {
    const g = gemeinde(1, 'Kirchengemeinde Musterdorf', {
      kirchenkreis: 'Kirchenkreis Küstenland', landeskirche: 'Nordlandkirche',
      leitung: [{ id: 9, display_name: 'Alex Beispiel', username: 'alex.beispiel', email: 'alex@example.org', is_active: true, last_login_at: null }],
    });
    for (const treffer of ['musterdorf', 'küstenland', 'kuestenland', 'nordland', 'alex beispiel', 'alex.beispiel', 'alex@example.org', 'EXAMPLE.ORG']) {
      expect(gemeindePasst(g, treffer), treffer).toBe(true);
    }
    for (const kein of ['hafenstadt', 'sam@example.org', 'mittelland']) {
      expect(gemeindePasst(g, kein), kein).toBe(false);
    }
    expect(gemeindePasst(g, '')).toBe(true);
  });
});

describe('gemeindenGruppieren: Landeskirche -> Kirchenkreis -> Gemeinde', () => {
  const liste = [
    gemeinde(1, 'Zeta', { landeskirche_id: 2, landeskirche: 'Zukunftskirche', kirchenkreis_id: 21, kirchenkreis: 'Marschen', konfi_count: 30 }),
    gemeinde(2, 'Alpha', { landeskirche_id: 2, landeskirche: 'Zukunftskirche', kirchenkreis_id: 20, kirchenkreis: 'Küstenland', konfi_count: 20 }),
    gemeinde(3, 'Beta', { landeskirche_id: 2, landeskirche: 'Zukunftskirche', kirchenkreis_id: 20, kirchenkreis: 'Küstenland', konfi_count: 5 }),
    gemeinde(4, 'Gamma', { landeskirche_id: 1, landeskirche: 'Mittellandkirche', kirchenkreis_id: 10, kirchenkreis: 'Hügelland', konfi_count: 7 }),
    gemeinde(5, 'Ohne', { konfi_count: 2 }),
  ];

  // "Zukunftskirche" kommt im Alphabet NACH "Ohne Zuordnung": nur so beweist der Test, dass die Gruppe ohne Zuordnung
  // wirklich zuletzt steht und nicht zufaellig durch die Sortierung nach Namen.
  it('Landeskirchen und Kirchenkreise alphabetisch, "Ohne Zuordnung" zuletzt, Gemeinden nach Namen', () => {
    const gruppen = gemeindenGruppieren(liste);
    expect(gruppen.map((g) => g.name)).toEqual(['Mittellandkirche', 'Zukunftskirche', 'Ohne Zuordnung']);
    const nord = gruppen[1];
    expect(nord.kirchenkreise.map((k) => k.name)).toEqual(['Küstenland', 'Marschen']);
    expect(nord.kirchenkreise[0].gemeinden.map((g) => g.display_name)).toEqual(['Alpha', 'Beta']);
  });

  it('Zahlen je Gruppe: Gemeinden und Konfis', () => {
    const [mitte, nord, ohne] = gemeindenGruppieren(liste);
    expect([mitte.gemeinden, mitte.konfis]).toEqual([1, 7]);
    expect([nord.gemeinden, nord.konfis]).toEqual([3, 55]);
    expect(nord.kirchenkreise.map((k) => [k.gemeinden.length, k.konfis])).toEqual([[2, 25], [1, 30]]);
    expect([ohne.gemeinden, ohne.konfis]).toEqual([1, 2]);
  });

  it('die Gruppe ohne Zuordnung hat keine eigene Kirchenkreis-Ebene (Name null)', () => {
    const ohne = gemeindenGruppieren(liste)[2];
    expect(ohne.ohneZuordnung).toBe(true);
    expect(ohne.kirchenkreise).toHaveLength(1);
    expect(ohne.kirchenkreise[0].name).toBeNull();
  });

  it('ein Kirchenkreis ohne Landeskirche steht unter "Ohne Landeskirche", davor die mit Landeskirche', () => {
    const gruppen = gemeindenGruppieren([
      gemeinde(1, 'A', { kirchenkreis_id: 5, kirchenkreis: 'Waldmark' }),
      gemeinde(2, 'B', { landeskirche_id: 1, landeskirche: 'Zuletzt', kirchenkreis_id: 6, kirchenkreis: 'Seenplatte' }),
    ]);
    expect(gruppen.map((g) => g.name)).toEqual(['Zuletzt', 'Ohne Landeskirche']);
    expect(gruppen[1].ohneZuordnung).toBe(false);
    expect(gruppen[1].kirchenkreise.map((k) => k.name)).toEqual(['Waldmark']);
  });

  it('gruppenSchluessel: Landeskirchen und benannte Kirchenkreise, nicht der namenlose', () => {
    const gruppen = gemeindenGruppieren(liste);
    const schluessel = gruppenSchluessel(gruppen);
    expect(schluessel).toHaveLength(3 + 3);
    expect(new Set(schluessel).size).toBe(schluessel.length);
    expect(schluessel).toContain('lk-ohne');
    expect(schluessel).not.toContain('kk-ohne-lk-ohne');
  });

  it('leere Liste: keine Gruppen', () => {
    expect(gemeindenGruppieren([])).toEqual([]);
  });
});

describe('Laufzeit und Limit', () => {
  it('Testphase mit Ende: "Testphase bis 12.10." -- Warnton ab 7 Tagen davor', () => {
    expect(laufzeitAngabe({ is_trial: true, trial_ends_at: '2026-10-12T00:00:00Z' }, JETZT)).toMatchObject({ text: 'Testphase bis 12.10.', ton: 'info' });
    expect(laufzeitAngabe({ is_trial: true, trial_ends_at: '2026-10-07T00:00:00Z' }, JETZT)).toMatchObject({ text: 'Testphase bis 07.10.', ton: 'warnung', titel: 'Testphase bis 07.10.2026, noch 4 Tage' });
  });

  it('Lizenz mit Ende: "Lizenz bis 31.12.2026" in Gruen; ohne Ende: Unbegrenzt', () => {
    expect(laufzeitAngabe({ is_trial: false, trial_ends_at: '2026-12-31T12:00:00Z' }, JETZT)).toMatchObject({ text: 'Lizenz bis 31.12.2026', ton: 'erfolg' });
    expect(laufzeitAngabe({ is_trial: false, trial_ends_at: null }, JETZT)).toEqual({ text: 'Unbegrenzt', ton: 'neutral' });
  });

  it('abgelaufen steht in Rot; heute und morgen sagen es', () => {
    expect(laufzeitAngabe({ is_trial: true, trial_ends_at: '2026-10-01T10:00:00Z' }, JETZT)).toMatchObject({ text: 'Testphase abgelaufen', ton: 'fehler' });
    expect(laufzeitAngabe({ is_trial: false, trial_ends_at: '2026-09-30T10:00:00Z' }, JETZT)).toMatchObject({ text: 'Lizenz abgelaufen', ton: 'fehler' });
    expect(laufzeitAngabe({ is_trial: true, trial_ends_at: '2026-10-03T20:00:00Z' }, JETZT).titel).toContain('endet heute');
    expect(laufzeitAngabe({ is_trial: true, trial_ends_at: '2026-10-04T10:00:00Z' }, JETZT).titel).toContain('noch 1 Tag');
  });

  it('Testphase ohne Enddatum bleibt Testphase', () => {
    expect(laufzeitAngabe({ is_trial: true, trial_ends_at: null }, JETZT)).toEqual({ text: 'Testphase', ton: 'warnung' });
  });

  it('Limit: Anteil und Ton -- ab 90 % Warnung, ab 100 % Fehler; ohne Limit null', () => {
    expect(limitAnteil({ konfi_count: 38, max_konfis: 50 })).toBe(0.76);
    expect(limitAnteil({ konfi_count: 5, max_konfis: null })).toBeNull();
    expect(limitAnteil({ konfi_count: 5, max_konfis: 0 })).toBeNull();
    expect(limitTon(0.76)).toBe('info');
    expect(limitTon(0.9)).toBe('warnung');
    expect(limitTon(1)).toBe('fehler');
    expect(limitTon(1.2)).toBe('fehler');
  });
});

describe('filterAusAdresse', () => {
  it('liest ?filter= und kennt nur erlaubte Werte', () => {
    expect(filterAusAdresse('?filter=offen', VORGANG_FILTER)).toBe('offen');
    expect(filterAusAdresse('?foo=1&filter=in_arbeit', VORGANG_FILTER)).toBe('in_arbeit');
    expect(filterAusAdresse('?filter=ungelesen', EINGANG_FILTER)).toBe('ungelesen');
    expect(filterAusAdresse('?filter=archiv', EINGANG_FILTER)).toBe('archiv');
  });

  it('Unbekanntes, Leeres und Fehlendes ergibt null -- auch ein Wert, der nur in der anderen Liste steht', () => {
    expect(filterAusAdresse('?filter=blau', VORGANG_FILTER)).toBeNull();
    expect(filterAusAdresse('?filter=', VORGANG_FILTER)).toBeNull();
    expect(filterAusAdresse('', VORGANG_FILTER)).toBeNull();
    expect(filterAusAdresse('?gemeinde=3', EINGANG_FILTER)).toBeNull();
    expect(filterAusAdresse('?filter=neu', EINGANG_FILTER)).toBeNull();
    expect(filterAusAdresse('?filter=moin', VORGANG_FILTER)).toBeNull();
    // „Nicht zugeordnet“ gibt es im Posteingang nicht mehr: Er zeigt nur noch Nicht-Einsortiertes.
    expect(filterAusAdresse('?filter=offen', EINGANG_FILTER)).toBeNull();
  });
});
