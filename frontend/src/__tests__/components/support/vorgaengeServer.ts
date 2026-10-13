// Ein kleiner Server im Speicher fuer die gerenderten Tests der Vorgaenge
// (docs/planung/support-vorgaenge.md): Er haelt seinen Stand und antwortet auf
// die Routen unter /api/support wie der echte -- Liste, Vorgang, einordnen,
// archivieren, wiederherstellen, loeschen, Sammelaktionen, antworten, Mails
// lesen, Posteingang und die roten Zahlen. So pruefen die Tests, was in der App
// passiert, wenn eine Seite etwas aendert und eine ANDERE Seite im Speicher
// stehen bleibt (Ionic haelt besuchte Seiten): Antworten kommen aus dem Stand,
// nicht aus festen Attrappen. Alle Daten sind erfunden.
//
// Seit 12.10.2026 (Paket 6, additiv) wie der Server: Die Antwort im Vorgang
// nimmt `status` und `antwort_auf` (beide vor dem Versand geprüft, sonst 400)
// und antwortet `{ nachricht, vorgang }`; das Mail-Detail trägt
// `absender_bekannt` (Standard null; bekannte Absender stellt der Test über
// `bekannteAbsender` ein). Mit `alterServer` wie ein Server davor -- er
// übergeht beide Felder, antwortet nur `{ nachricht }` und kennt
// `absender_bekannt` nicht.

import { vi } from 'vitest';

export interface TestMail {
  id: number;
  postfach: 'moin' | 'support';
  richtung: 'ein' | 'aus';
  vorgang_id: number | null;
  anfrage_id?: number | null;
  organization_id?: number | null;
  von_adresse: string;
  von_name: string | null;
  an_adressen: string[] | null;
  betreff: string | null;
  text: string | null;
  anhaenge: Array<{ name: string }> | null;
  gesendet_am: string;
  gelesen_am: string | null;
  archiviert_am: string | null;
  /** Mails ohne Vorgang mit gleichem Schluessel bilden einen Faden; er geht beim Einsortieren ganz mit. */
  faden?: string | null;
  /** Kopfzeilen fuer den Gespraechsbaum (MailGespraeche, 11.10.2026). */
  message_id?: string | null;
  in_reply_to?: string | null;
  referenzen?: string[] | null;
  /** Das Konto, das eine ausgehende Mail verfasst hat; leer bei der automatischen Bestätigung. */
  verfasst_von?: number | null;
  verfasst_von_name?: string | null;
}

export interface TestVorgang {
  id: number;
  art: string;
  bereich: string | null;
  dringlichkeit: 'normal' | 'dringend';
  status: 'neu' | 'in_arbeit' | 'wartet' | 'erledigt';
  betreff: string;
  quelle: 'anfrage' | 'formular' | 'mail' | 'support';
  organization_id: number | null;
  anfrage_id: number | null;
  created_at: string;
  archiviert_am: string | null;
  notiz: string | null;
  beschreibung: string | null;
  kontakt_name: string | null;
  kontakt_email: string | null;
  kontakt_funktion: string | null;
  gemeinde_angabe: string | null;
  anfrage: Record<string, unknown> | null;
  /** Seit wann der Status gilt; ohne Angabe der Eingang. */
  status_seit?: string | null;
  updated_at?: string | null;
  /** Wer den Vorgang angelegt hat (Herkunft „support"). */
  erstellt_von_name?: string | null;
}

export const GEMEINDEN = [
  { id: 7, name: 'musterdorf', display_name: 'Kirchengemeinde Musterdorf' },
  { id: 8, name: 'wiesengrund', display_name: 'Kirchengemeinde Wiesengrund' },
];

/**
 * Eine Gemeinde, wie GET /organizations/:id sie liefert (SELECT * und die
 * Zähler) -- und wie die Attrappe sie über PUT und PATCH …/limit ändert.
 */
export interface TestGemeinde {
  id: number;
  name: string;
  slug: string;
  display_name: string;
  description: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  website_url: string | null;
  kirchenkreis: string | null;
  kirchenkreis_id: number | null;
  landeskirche: string | null;
  is_active: boolean;
  is_trial: boolean;
  trial_ends_at: string | null;
  max_konfis: number | null;
  konfi_count: number;
  wunsch_lizenz: string | null;
  intern: boolean;
}

/** Die Werte, die die Attrappe vor dem 11.10.2026 fest lieferte -- ältere Tests rechnen mit ihnen. */
const gemeindeVorgabe = (g: (typeof GEMEINDEN)[number]): TestGemeinde => ({
  ...g, slug: g.name, description: null, contact_name: null, contact_email: null, contact_phone: null, address: null, website_url: null,
  kirchenkreis: 'Dithmarschen', kirchenkreis_id: 11, landeskirche: 'Nordkirche', is_active: true, is_trial: true,
  trial_ends_at: '2026-11-02T00:00:00Z', max_konfis: 5, konfi_count: 3, wunsch_lizenz: null, intern: false,
});

export const LEITUNG: Record<number, Array<{ id: number; display_name: string; username: string; email: string | null; is_active: boolean; last_login_at: string | null }>> = {
  7: [{ id: 21, display_name: 'Pastorin Lena Probe', username: 'lena.probe', email: 'lena.probe@example.org', is_active: true, last_login_at: '2026-10-02T08:00:00Z' }],
  8: [],
};

export const ANFRAGE_41 = {
  id: 41, gemeinde: 'Kirchengemeinde Lindenau', kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche',
  kontakt_name: 'Anna Beispiel', funktion: 'Pastorin', email: 'anna@example.org', mobil: '0170 1234567',
  anzahl_konfis: 25, anzahl_teamer: 6, nachricht: 'Wir starten im November.', status: 'neu', notiz: null,
  organization_id: null, created_at: '2026-10-02T08:00:00Z', updated_at: '2026-10-02T08:00:00Z', wunsch_lizenz: 'standard', ungelesen: 0,
};

export const vorgang = (id: number, extra: Partial<TestVorgang> = {}): TestVorgang => ({
  id, art: 'frage', bereich: 'chat', dringlichkeit: 'normal', status: 'neu', betreff: `Betreff ${id}`, quelle: 'formular',
  organization_id: null, anfrage_id: null, created_at: '2026-10-03T07:00:00Z', archiviert_am: null, notiz: null, beschreibung: null,
  kontakt_name: null, kontakt_email: null, kontakt_funktion: null, gemeinde_angabe: null, anfrage: null, ...extra,
});

export const mail = (id: number, vorgangId: number | null, extra: Partial<TestMail> = {}): TestMail => ({
  id, postfach: 'support', richtung: 'ein', vorgang_id: vorgangId, von_adresse: 'lena.probe@example.org', von_name: 'Pastorin Lena Probe',
  an_adressen: ['support@konfi-quest.example'], betreff: `Mail ${id}`, text: 'Hallo', anhaenge: [], gesendet_am: '2026-10-03T08:00:00Z',
  gelesen_am: null, archiviert_am: null, ...extra,
});

type Aufruf = { methode: 'get' | 'post' | 'patch' | 'put' | 'delete'; pfad: string; koerper?: unknown; optionen?: unknown };

export interface ServerOptionen {
  vorgaenge?: TestVorgang[];
  mails?: TestMail[];
  /**
   * `gemeinde_name` wie der echte Server: der Name der zugeordneten Gemeinde,
   * sonst die Gemeinde der Anfrage, sonst die Angabe im Formular
   * (COALESCE in backend/routes/supportVorgaenge.js, LISTE_SPALTEN). Ohne die
   * Option nur der Name der zugeordneten Gemeinde -- so bleiben die älteren
   * Tests, wie sie sind. Mit ihr fällt auf, wenn eine Seite den Freitext für
   * eine zugeordnete Gemeinde hält (Fehler vorab 3).
   */
  gemeindeNameWieServer?: boolean;
  /** Abweichende Angaben je Gemeinde (Lizenz, Stammdaten), etwa `{ 7: { max_konfis: 50, wunsch_lizenz: 'standard' } }`. */
  gemeinden?: Record<number, Partial<TestGemeinde>>;
  /**
   * Ein Server vor dem 12.10.2026: POST /support/vorgaenge/:id/antworten
   * übergeht `status` und `antwort_auf` und antwortet nur `{ nachricht }`
   * -- für die Rückfallebene („Danach" per PATCH).
   */
  alterServer?: boolean;
  /**
   * Adressen, die zu genau einem Konto genau einer Gemeinde gehören
   * (backend/utils/mailZuordnung.js, gemeindeDesKontos): Adresse -> Gemeinde.
   * Daraus entsteht `absender_bekannt` am Mail-Detail; ohne Eintrag null.
   */
  bekannteAbsender?: Record<string, number>;
}

/** Die Status eines Vorgangs, wie der Server sie prüft (backend/utils/supportVorgaenge.js, STATUS). */
const STATUS: ReadonlyArray<TestVorgang['status']> = ['neu', 'in_arbeit', 'wartet', 'erledigt'];

/** 400 wie der Server (middleware/validation.js bzw. eine eigene Meldung der Route). */
const ungueltig = (data: Record<string, unknown>) => Object.assign(new Error('ungültig'), { response: { status: 400, data } });

export function vorgaengeServer(optionen: ServerOptionen = {}) {
  // Unter eigenem Namen: get() hat einen Parameter `optionen` (die Abruf-Optionen), der diesen verdeckt.
  const alterServer = optionen.alterServer === true;
  const s = {
    vorgaenge: [...(optionen.vorgaenge ?? [])],
    mails: [...(optionen.mails ?? [])],
    /** Die Gemeinden mit Lizenz und Stammdaten (GET/PUT /organizations/:id, PATCH …/limit). */
    gemeinden: Object.fromEntries(GEMEINDEN.map((g) => [g.id, { ...gemeindeVorgabe(g), ...(optionen.gemeinden?.[g.id] ?? {}) }])) as Record<number, TestGemeinde>,
    aufrufe: [] as Aufruf[],
    naechsteId: 100,
    jetzt: '2026-10-03T09:00:00Z',
    /** Das Konto der Tests (verfasst_von der Antworten). */
    konto: { id: 9, name: 'Test Super-Admin' },
    /** Einzelne Routen scheitern lassen: Pfad -> Fehler. */
    fehler: new Map<string, unknown>(),
    /** Adresse (klein) -> Gemeinde, für `absender_bekannt`; im Test änderbar. */
    bekannteAbsender: Object.fromEntries(Object.entries(optionen.bekannteAbsender ?? {}).map(([a, g]) => [a.trim().toLowerCase(), g])) as Record<string, number>,
  };

  const mailsVon = (id: number) => s.mails.filter((m) => m.vorgang_id === id).sort((a, b) => a.gesendet_am.localeCompare(b.gesendet_am) || a.id - b.id);
  const ungelesenVon = (id: number) => mailsVon(id).filter((m) => m.richtung === 'ein' && !m.gelesen_am).length;
  const gemeindeName = (id: number | null) => (id === null ? null : s.gemeinden[id]?.display_name ?? `Gemeinde ${id}`);
  const aktivitaet = (v: TestVorgang) => [v.created_at, ...mailsVon(v.id).map((m) => m.gesendet_am)].sort().pop() as string;
  const gemeindeNameVon = (v: TestVorgang): string | null => {
    const zugeordnet = gemeindeName(v.organization_id);
    if (!optionen.gemeindeNameWieServer) return zugeordnet;
    const ausAnfrage = typeof v.anfrage?.gemeinde === 'string' && v.anfrage.gemeinde.trim() ? v.anfrage.gemeinde : null;
    return zugeordnet ?? ausAnfrage ?? v.gemeinde_angabe ?? null;
  };

  const eintrag = (v: TestVorgang) => ({
    id: v.id, art: v.art, bereich: v.bereich, dringlichkeit: v.dringlichkeit, status: v.status, betreff: v.betreff, quelle: v.quelle,
    organization_id: v.organization_id, gemeinde_name: gemeindeNameVon(v), anfrage_id: v.anfrage_id, ungelesen: ungelesenVon(v.id),
    letzte_aktivitaet: aktivitaet(v), created_at: v.created_at, archiviert_am: v.archiviert_am,
  });

  /**
   * Die möglichen Empfänger wie der Server (backend/routes/supportVorgaenge.js,
   * empfaengerFuerVorgang): Absender eingehender Mails (zuletzt geschrieben
   * zuerst), Kontakt aus dem Formular, Adresse der Anfrage, Gemeindeleitung --
   * jede Adresse einmal, klein geschrieben, `herkunft` als Schlüssel.
   */
  const empfaengerVon = (v: TestVorgang) => {
    const liste: Array<{ adresse: string; name: string | null; herkunft: string }> = [];
    const gesehen = new Set<string>();
    const dazu = (adresse: unknown, name: unknown, herkunft: string) => {
      const a = typeof adresse === 'string' ? adresse.trim().toLowerCase() : '';
      if (!a || gesehen.has(a)) return;
      gesehen.add(a);
      liste.push({ adresse: a, name: typeof name === 'string' && name ? name : null, herkunft });
    };
    for (const m of mailsVon(v.id).filter((x) => x.richtung === 'ein').reverse()) dazu(m.von_adresse, m.von_name, 'absender');
    dazu(v.kontakt_email, v.kontakt_name, 'kontakt');
    if (v.anfrage) dazu(v.anfrage.email, v.anfrage.kontakt_name, 'anfrage');
    if (v.organization_id !== null) for (const l of LEITUNG[v.organization_id] ?? []) dazu(l.email, l.display_name, 'leitung');
    return liste;
  };

  const detail = (v: TestVorgang) => {
    const g = v.organization_id === null ? null : s.gemeinden[v.organization_id] ?? null;
    return {
      ...eintrag(v), status_seit: v.status_seit ?? v.created_at, updated_at: v.updated_at ?? v.created_at,
      notiz: v.notiz, beschreibung: v.beschreibung, kontakt_name: v.kontakt_name, kontakt_email: v.kontakt_email,
      kontakt_funktion: v.kontakt_funktion, gemeinde_angabe: v.gemeinde_angabe, erstellt_von_name: v.erstellt_von_name ?? null,
      verlauf: mailsVon(v.id).map((m) => ({ ...m, anfrage_id: null, organization_id: v.organization_id })),
      anfrage: v.anfrage,
      gemeinde: g && {
        id: g.id, name: g.name, display_name: g.display_name, is_active: g.is_active, is_trial: g.is_trial, trial_ends_at: g.trial_ends_at,
        max_konfis: g.max_konfis, intern: g.intern, konfi_count: g.konfi_count, kirchenkreis_id: g.kirchenkreis_id, kirchenkreis: g.kirchenkreis,
        landeskirche_id: 1, landeskirche: g.landeskirche, wunsch_lizenz: g.wunsch_lizenz,
      },
      leitung: g ? LEITUNG[g.id] ?? [] : [],
      empfaenger: empfaengerVon(v),
    };
  };

  /** Eine Gemeinde wie GET /organizations/:id (SELECT * und Zähler). */
  const organisation = (g: TestGemeinde) => ({ ...g, user_count: (LEITUNG[g.id] ?? []).length, teamer_count: 0, admin_count: (LEITUNG[g.id] ?? []).length });

  /** Status setzen wie backend/utils/supportVorgaenge.js (statusSetzen): status_seit läuft neu, wenn er sich ändert. */
  const statusSetzen = (v: TestVorgang, status: TestVorgang['status']) => {
    if (v.status !== status) v.status_seit = s.jetzt;
    v.status = status;
    v.updated_at = s.jetzt;
  };

  const fadenVon = (m: TestMail): TestMail[] => {
    if (m.vorgang_id !== null) return mailsVon(m.vorgang_id);
    if (!m.faden) return [m];
    return s.mails.filter((x) => x.faden === m.faden && x.vorgang_id === null).sort((a, b) => a.gesendet_am.localeCompare(b.gesendet_am) || a.id - b.id);
  };

  /**
   * Der Faden im Mail-Detail wie der Server (backend/utils/mailNachrichten.js,
   * fadenIds): über die Kopfzeilen, gleich wo die Mails liegen. Zu einer Mail
   * im Posteingang gehören so auch Mails desselben Fadens aus einem Vorgang
   * (etwa dieselbe Mail an moin@ und support@). Einsortieren nimmt dagegen nur
   * mit, was noch im Posteingang liegt (fadenVon).
   */
  const verlaufVon = (m: TestMail): TestMail[] => {
    if (m.vorgang_id !== null || !m.faden) return fadenVon(m);
    return s.mails.filter((x) => x.faden === m.faden).sort((a, b) => a.gesendet_am.localeCompare(b.gesendet_am) || a.id - b.id);
  };

  /**
   * `absender_bekannt` wie der Server: nur für eingehende Mails ohne Vorgang,
   * deren Adresse einer Gemeinde gehört. Offen heißt nicht im Archiv und nicht
   * erledigt; der Vorgang ist der jüngste offene (offenerVorgangDerGemeinde).
   */
  const absenderBekanntVon = (m: TestMail) => {
    if (m.richtung !== 'ein' || m.vorgang_id !== null) return null;
    const org = s.bekannteAbsender[m.von_adresse.trim().toLowerCase()];
    if (org === undefined) return null;
    const offen = s.vorgaenge.filter((v) => v.organization_id === org && !v.archiviert_am && v.status !== 'erledigt');
    const juengster = [...offen].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)[0] ?? null;
    return { organization_id: org, gemeinde_name: gemeindeName(org), offene_vorgaenge: offen.length, vorgang_id: juengster?.id ?? null };
  };

  const posteingang = () => s.mails.filter((m) => m.richtung === 'ein' && m.vorgang_id === null && !m.archiviert_am);
  const eingangEintrag = (m: TestMail) => ({
    id: m.id, postfach: m.postfach, von_adresse: m.von_adresse, von_name: m.von_name, betreff: m.betreff, auszug: m.text, gesendet_am: m.gesendet_am,
    gelesen_am: m.gelesen_am, anhaenge: m.anhaenge, anfrage_id: null, organization_id: null, gemeinde_name: null, vorgang_id: m.vorgang_id,
    archiviert_am: m.archiviert_am,
  });

  const zaehler = () => ({
    anfragen: 0, gemeinden: 0, eingang: posteingang().filter((m) => !m.gelesen_am).length, je_anfrage: {}, je_gemeinde: {},
    vorgaenge: s.vorgaenge.filter((v) => !v.archiviert_am && (v.status === 'neu' || ungelesenVon(v.id) > 0)).length,
    posteingang: posteingang().filter((m) => !m.gelesen_am).length,
  });

  const erledigtArchiviert = (v: TestVorgang) => { if (v.status === 'erledigt' && !v.archiviert_am) v.archiviert_am = s.jetzt; };
  const finde = (id: number) => s.vorgaenge.find((v) => v.id === id);
  const idAus = (pfad: string, muster: RegExp): number => Number(muster.exec(pfad)?.[1]);
  const nichtGefunden = () => Object.assign(new Error('nicht gefunden'), { response: { status: 404, data: { error: 'Nicht gefunden' } } });

  const get = (pfad: string, optionen?: { params?: Record<string, unknown> }): Promise<{ data: unknown }> => {
    s.aufrufe.push({ methode: 'get', pfad, optionen });
    const fehler = s.fehler.get(`GET ${pfad}`);
    if (fehler) return Promise.reject(fehler);
    const p = optionen?.params ?? {};
    if (pfad === '/support/vorgaenge') {
      const archiv = p.filter === 'archiv';
      return Promise.resolve({ data: s.vorgaenge.filter((v) => (archiv ? !!v.archiviert_am : !v.archiviert_am)).map(eintrag) });
    }
    if (/^\/support\/vorgaenge\/\d+$/.test(pfad)) {
      const v = finde(idAus(pfad, /(\d+)$/));
      return v ? Promise.resolve({ data: detail(v) }) : Promise.reject(nichtGefunden());
    }
    if (pfad === '/support/mail/zaehler') return Promise.resolve({ data: zaehler() });
    if (pfad === '/support/mail/eingang') {
      const liste = p.archiv ? s.mails.filter((m) => m.richtung === 'ein' && m.vorgang_id === null && m.archiviert_am) : posteingang();
      return Promise.resolve({ data: liste.map(eingangEintrag) });
    }
    if (/^\/support\/mail\/nachrichten\/\d+$/.test(pfad)) {
      const m = s.mails.find((x) => x.id === idAus(pfad, /(\d+)$/));
      if (!m) return Promise.reject(nichtGefunden());
      const detail = { ...m, anfrage_id: null, organization_id: null, verlauf: verlaufVon(m) };
      return Promise.resolve({ data: alterServer ? detail : { ...detail, absender_bekannt: absenderBekanntVon(m) } });
    }
    if (pfad === '/support/mail/status') {
      return Promise.resolve({ data: { postfaecher: [
        { postfach: 'moin', adresse: 'moin@konfi-quest.example', eingerichtet: true, abgeholt_am: '2026-10-03T08:29:00Z', fehler: null, fehler_am: null, auf_diesem_server: true },
        { postfach: 'support', adresse: 'support@konfi-quest.example', eingerichtet: true, abgeholt_am: '2026-10-03T08:29:00Z', fehler: null, fehler_am: null, auf_diesem_server: true },
      ] } });
    }
    if (pfad === '/support/mail/bausteine') return Promise.resolve({ data: [{ id: 1, titel: 'Danke für die Meldung', betreff: null, text: 'Danke, {{name}}.', postfach: null, sortierung: 1 }] });
    if (pfad === '/support/mail/einstellungen') return Promise.resolve({ data: { fusszeile: 'Konfi Quest', absendername: 'Support-Team' } });
    if (pfad === '/support/mail/platzhalter') return Promise.resolve({ data: { name: 'Anna Beispiel', gemeinde: 'Kirchengemeinde Lindenau', lizenz: null, testphase_bis: null, benutzername: null, absender: null } });
    if (pfad === '/organizations') return Promise.resolve({ data: GEMEINDEN });
    if (/^\/organizations\/\d+$/.test(pfad)) {
      const g = s.gemeinden[idAus(pfad, /(\d+)$/)];
      return g ? Promise.resolve({ data: organisation(g) }) : Promise.reject(nichtGefunden());
    }
    if (/^\/support\/gemeinden\/\d+\/empfaenger$/.test(pfad)) {
      const id = idAus(pfad, /gemeinden\/(\d+)/);
      // herkunft ist der Schlüssel des Servers ('leitung', 'verlauf'; backend/routes/supportMail.js,
      // empfaengerLaden) -- bis 11.10.2026 stand hier schon das Etikett, und der rohe Schlüssel fiel nie auf.
      return Promise.resolve({ data: (LEITUNG[id] ?? []).filter((l) => l.email).map((l) => ({ adresse: l.email, name: l.display_name, herkunft: 'leitung' })) });
    }
    if (pfad === '/support/kirchenkreise') return Promise.resolve({ data: [{ id: 11, name: 'Kirchenkreis Dithmarschen', landeskirche_id: 1, landeskirche: 'Nordkirche' }] });
    if (pfad === '/support/landeskirchen') return Promise.resolve({ data: [{ id: 1, name: 'Nordkirche', kirchenkreise: [] }] });
    return Promise.reject(new Error(`unerwartet GET ${pfad}`));
  };

  const post = (pfad: string, koerper?: Record<string, unknown>): Promise<{ data: unknown }> => {
    s.aufrufe.push({ methode: 'post', pfad, koerper });
    const fehler = s.fehler.get(`POST ${pfad}`);
    if (fehler) return Promise.reject(fehler);
    if (pfad === '/support/mail/gelesen') {
      for (const m of s.mails) if ((koerper?.ids as number[]).includes(m.id)) m.gelesen_am = m.gelesen_am ?? s.jetzt;
      return Promise.resolve({ data: {} });
    }
    if (pfad === '/support/vorgaenge') {
      const id = s.naechsteId++;
      const v = vorgang(id, {
        art: String(koerper?.art), bereich: (koerper?.bereich as string) ?? null, dringlichkeit: (koerper?.dringlichkeit as 'normal' | 'dringend') ?? 'normal',
        betreff: String(koerper?.betreff), quelle: 'support', organization_id: (koerper?.organization_id as number) ?? null, created_at: s.jetzt, status: 'neu',
      });
      s.vorgaenge.push(v);
      if (koerper?.text) s.mails.push(mail(s.naechsteId++, id, { richtung: 'aus', postfach: 'support', von_adresse: 'support@konfi-quest.example', von_name: 'Support', an_adressen: [String(koerper.an)], betreff: `Re: ${v.betreff} [Vorgang ${id}]`, text: String(koerper.text), gesendet_am: s.jetzt, gelesen_am: s.jetzt, verfasst_von: s.konto.id, verfasst_von_name: s.konto.name }));
      return Promise.resolve({ data: { id } });
    }
    if (pfad === '/support/vorgaenge/sammel') {
      const ids = koerper?.ids as number[];
      for (const id of ids) {
        const v = finde(id);
        if (!v) continue;
        if (koerper?.aktion === 'archivieren') v.archiviert_am = s.jetzt;
        if (koerper?.aktion === 'wiederherstellen') { v.archiviert_am = null; statusSetzen(v, 'in_arbeit'); }
        if (koerper?.aktion === 'status') { statusSetzen(v, koerper.status as TestVorgang['status']); erledigtArchiviert(v); }
        if (koerper?.aktion === 'loeschen') { s.vorgaenge = s.vorgaenge.filter((x) => x.id !== id); s.mails = s.mails.filter((m) => m.vorgang_id !== id); }
      }
      return Promise.resolve({ data: { ok: true } });
    }
    if (/^\/support\/vorgaenge\/\d+\/archivieren$/.test(pfad)) {
      const v = finde(idAus(pfad, /vorgaenge\/(\d+)/));
      if (v) v.archiviert_am = s.jetzt;
      return Promise.resolve({ data: {} });
    }
    if (/^\/support\/vorgaenge\/\d+\/wiederherstellen$/.test(pfad)) {
      const v = finde(idAus(pfad, /vorgaenge\/(\d+)/));
      if (v) { v.archiviert_am = null; statusSetzen(v, 'in_arbeit'); }
      return Promise.resolve({ data: {} });
    }
    if (/^\/support\/anfragen\/\d+\/anlegen$/.test(pfad)) {
      // Gemeinde und erste Gemeindeleitung angelegt: die Anfrage steht auf „angelegt“, ihr Vorgang ist erledigt (Uebernahme-Regel des Plans).
      const aid = idAus(pfad, /anfragen\/(\d+)/);
      const v = s.vorgaenge.find((x) => x.anfrage_id === aid);
      if (v?.anfrage) { v.anfrage = { ...v.anfrage, status: 'angelegt', organization_id: 77 }; v.organization_id = 77; statusSetzen(v, 'erledigt'); erledigtArchiviert(v); }
      return Promise.resolve({ data: { organization_id: 77, admin_id: 301 } });
    }
    if (pfad === '/support/kirchenkreise') {
      return Promise.resolve({ data: { id: 13 } });
    }
    if (/^\/support\/vorgaenge\/\d+\/antworten$/.test(pfad)) {
      const id = idAus(pfad, /vorgaenge\/(\d+)/);
      const v = finde(id);
      if (!v) return Promise.reject(nichtGefunden());
      const alt = alterServer;
      // Wie der Server: `status` und `antwort_auf` werden VOR dem Versand geprüft -- bei 400 geht nichts hinaus.
      const status = alt ? undefined : koerper?.status;
      if (status !== undefined && !STATUS.includes(status as TestVorgang['status'])) {
        return Promise.reject(ungueltig({ error: 'Validierungsfehler', details: [{ field: 'status', message: `status: ${STATUS.join(', ')}` }] }));
      }
      // antwort_auf wie body('antwort_auf').optional({ values: 'null' }).not().isArray().isInt({ min: 1 }):
      // null heißt „nicht angegeben", eine Kennung als Zeichenkette ('11') geht wie die Zahl.
      const antwortAufRoh = alt ? undefined : (koerper?.antwort_auf ?? undefined);
      if (antwortAufRoh !== undefined && (Array.isArray(antwortAufRoh) || !/^[-+]?[0-9]+$/.test(String(antwortAufRoh)) || Number(antwortAufRoh) < 1)) {
        return Promise.reject(ungueltig({ error: 'Validierungsfehler', details: [{ field: 'antwort_auf', message: 'Ungültige Mail' }] }));
      }
      const antwortAuf = antwortAufRoh === undefined ? undefined : Number(antwortAufRoh);
      const beantwortet = antwortAuf === undefined ? null : s.mails.find((m) => m.id === antwortAuf) ?? null;
      if (antwortAuf !== undefined && beantwortet?.vorgang_id !== id) {
        return Promise.reject(ungueltig({ error: 'Die beantwortete Mail gehört nicht zu diesem Vorgang' }));
      }
      // Der Bezug (In-Reply-To, References): die beantwortete Mail, sonst die jüngste des Vorgangs gleich welcher Richtung.
      const bezug = beantwortet ?? mailsVon(id).at(-1) ?? null;
      const nr = s.naechsteId++;
      const nachricht = mail(nr, id, {
        richtung: 'aus', von_adresse: 'support@konfi-quest.example', von_name: 'Support', an_adressen: koerper?.an ? [String(koerper.an)] : null,
        betreff: `${koerper?.betreff ?? (bezug?.betreff ? `Re: ${bezug.betreff}` : v.betreff)} [Vorgang ${id}]`, text: String(koerper?.text),
        gesendet_am: s.jetzt, gelesen_am: s.jetzt, verfasst_von: s.konto.id, verfasst_von_name: s.konto.name,
        message_id: `<kq-${nr}@konfi-quest.example>`,
        in_reply_to: bezug?.message_id ?? null,
        referenzen: bezug?.message_id ? [...(bezug.referenzen ?? []).filter((r) => r !== bezug.message_id), bezug.message_id] : [],
      });
      s.mails.push(nachricht);
      // In derselben Transaktion: der mitgeschickte Status -- sonst wie bisher „neu" auf „in Arbeit".
      if (status !== undefined) { statusSetzen(v, status as TestVorgang['status']); erledigtArchiviert(v); } else if (v.status === 'neu') statusSetzen(v, 'in_arbeit');
      if (alt) return Promise.resolve({ data: { nachricht } });
      return Promise.resolve({ data: { nachricht, vorgang: { id: v.id, status: v.status, status_seit: v.status_seit ?? v.created_at, archiviert_am: v.archiviert_am } } });
    }
    if (/^\/support\/mail\/nachrichten\/\d+\/antworten$/.test(pfad)) {
      // Antwort auf eine Mail ohne Vorgang: eine ausgehende Mail im selben Faden.
      const m = s.mails.find((x) => x.id === idAus(pfad, /nachrichten\/(\d+)/));
      if (!m) return Promise.reject(nichtGefunden());
      const nachricht = mail(s.naechsteId++, m.vorgang_id, { faden: m.faden ?? `mail-${m.id}`, richtung: 'aus', postfach: m.postfach, von_adresse: 'support@konfi-quest.example', von_name: 'Support', an_adressen: [m.von_adresse], betreff: String(koerper?.betreff ?? ''), text: String(koerper?.text), gesendet_am: s.jetzt, gelesen_am: s.jetzt, verfasst_von: s.konto.id, verfasst_von_name: s.konto.name });
      s.mails.push(nachricht);
      if (!m.faden) m.faden = `mail-${m.id}`;
      // Wie der Server: 201 { nachricht }.
      return Promise.resolve({ data: { nachricht } });
    }
    if (/^\/support\/mail\/nachrichten\/\d+\/(archivieren|wiederherstellen)$/.test(pfad)) {
      const m = s.mails.find((x) => x.id === idAus(pfad, /nachrichten\/(\d+)/));
      if (m) m.archiviert_am = pfad.endsWith('/archivieren') ? s.jetzt : null;
      return Promise.resolve({ data: {} });
    }
    if (/^\/support\/mail\/nachrichten\/\d+\/einsortieren$/.test(pfad)) {
      const m = s.mails.find((x) => x.id === idAus(pfad, /nachrichten\/(\d+)/));
      let ziel = koerper?.vorgang_id as number | undefined;
      if (koerper?.neu) {
        const neu = koerper.neu as Record<string, unknown>;
        ziel = s.naechsteId++;
        s.vorgaenge.push(vorgang(ziel, {
          art: String(neu.art), bereich: (neu.bereich as string) ?? null, dringlichkeit: (neu.dringlichkeit as 'normal' | 'dringend') ?? 'normal',
          betreff: String(neu.betreff), quelle: 'mail', organization_id: (neu.organization_id as number) ?? null, created_at: s.jetzt,
        }));
      }
      // Wie der Server (backend/routes/supportMail.js): Aus dem Posteingang geht der Faden mit, eine Mail
      // aus einem Vorgang allein; archivierte Mails sind danach nicht mehr archiviert.
      const bewegt = m && ziel ? (m.vorgang_id !== null ? [m] : fadenVon(m)) : [];
      for (const x of bewegt) { x.vorgang_id = ziel as number; x.archiviert_am = null; }
      return Promise.resolve({ data: { anzahl: bewegt.length, vorgang_id: ziel, ids: bewegt.map((x) => x.id) } });
    }
    if (pfad === '/support/mail/sammel') {
      for (const id of koerper?.ids as number[]) {
        const m = s.mails.find((x) => x.id === id);
        if (!m) continue;
        if (koerper?.aktion === 'archivieren') m.archiviert_am = s.jetzt;
        if (koerper?.aktion === 'wiederherstellen') m.archiviert_am = null;
        if (koerper?.aktion === 'loeschen') s.mails = s.mails.filter((x) => x.id !== id);
      }
      return Promise.resolve({ data: { ok: true } });
    }
    return Promise.reject(new Error(`unerwartet POST ${pfad}`));
  };

  const patch = (pfad: string, koerper: Record<string, unknown>): Promise<{ data: unknown }> => {
    s.aufrufe.push({ methode: 'patch', pfad, koerper });
    const fehler = s.fehler.get(`PATCH ${pfad}`);
    if (fehler) return Promise.reject(fehler);
    if (/^\/organizations\/\d+\/limit$/.test(pfad)) {
      // Wie backend/routes/organizations.js: null = unbegrenzt, sonst eine ganze Zahl ab 0.
      const g = s.gemeinden[idAus(pfad, /organizations\/(\d+)/)];
      if (!g) return Promise.reject(nichtGefunden());
      const wert = koerper.max_konfis === undefined ? null : koerper.max_konfis;
      if (wert !== null && (typeof wert !== 'number' || !Number.isInteger(wert) || wert < 0)) {
        return Promise.reject(Object.assign(new Error('ungültig'), { response: { status: 400, data: { error: 'max_konfis muss null oder eine nicht-negative ganze Zahl sein' } } }));
      }
      g.max_konfis = wert as number | null;
      return Promise.resolve({ data: { message: 'Konfi-Limit erfolgreich aktualisiert', max_konfis: wert } });
    }
    const v = finde(idAus(pfad, /vorgaenge\/(\d+)$/));
    if (!v) return Promise.reject(nichtGefunden());
    const { status, ...rest } = koerper;
    Object.assign(v, rest);
    if (status !== undefined) statusSetzen(v, status as TestVorgang['status']);
    v.updated_at = s.jetzt;
    erledigtArchiviert(v);
    return Promise.resolve({ data: detail(v) });
  };

  /**
   * PUT /organizations/:id wie der Server: name, slug und display_name sind
   * Pflicht (sonst 400); description, contact_*, address, website_url und
   * kirchenkreis schreibt er IMMER -- was fehlt, wird leer. kirchenkreis_id,
   * is_active, trial_ends_at und is_trial nur, wenn sie im Körper stehen.
   */
  const put = (pfad: string, koerper: Record<string, unknown>): Promise<{ data: unknown }> => {
    s.aufrufe.push({ methode: 'put', pfad, koerper });
    const fehler = s.fehler.get(`PUT ${pfad}`);
    if (fehler) return Promise.reject(fehler);
    if (!/^\/organizations\/\d+$/.test(pfad)) return Promise.reject(new Error(`unerwartet PUT ${pfad}`));
    const g = s.gemeinden[idAus(pfad, /(\d+)$/)];
    if (!g) return Promise.reject(nichtGefunden());
    const pflicht = (wert: unknown) => typeof wert === 'string' && wert.trim() !== '';
    if (!pflicht(koerper.name) || !pflicht(koerper.slug) || !pflicht(koerper.display_name)) {
      return Promise.reject(Object.assign(new Error('ungültig'), { response: { status: 400, data: { error: 'Name ist erforderlich' } } }));
    }
    const text = (wert: unknown) => (typeof wert === 'string' ? wert : null);
    Object.assign(g, {
      name: koerper.name, slug: koerper.slug, display_name: koerper.display_name, description: text(koerper.description),
      contact_name: text(koerper.contact_name), contact_email: text(koerper.contact_email), contact_phone: text(koerper.contact_phone),
      address: text(koerper.address), website_url: text(koerper.website_url), kirchenkreis: text(koerper.kirchenkreis),
    });
    const hat = (feld: string) => Object.prototype.hasOwnProperty.call(koerper, feld);
    if (hat('kirchenkreis_id')) g.kirchenkreis_id = (koerper.kirchenkreis_id as number | null) ?? null;
    if (hat('is_active')) g.is_active = koerper.is_active === true;
    if (hat('trial_ends_at')) g.trial_ends_at = (koerper.trial_ends_at as string | null) || null;
    if (hat('is_trial')) g.is_trial = koerper.is_trial === true;
    return Promise.resolve({ data: { message: 'Gemeinde erfolgreich aktualisiert' } });
  };

  const loeschen = (pfad: string): Promise<{ data: unknown }> => {
    s.aufrufe.push({ methode: 'delete', pfad });
    const fehler = s.fehler.get(`DELETE ${pfad}`);
    if (fehler) return Promise.reject(fehler);
    if (/^\/support\/vorgaenge\/\d+$/.test(pfad)) {
      const id = idAus(pfad, /(\d+)$/);
      s.vorgaenge = s.vorgaenge.filter((v) => v.id !== id);
      s.mails = s.mails.filter((m) => m.vorgang_id !== id);
      return Promise.resolve({ data: {} });
    }
    if (/^\/support\/mail\/nachrichten\/\d+$/.test(pfad)) {
      const id = idAus(pfad, /(\d+)$/);
      s.mails = s.mails.filter((m) => m.id !== id);
      return Promise.resolve({ data: {} });
    }
    return Promise.reject(new Error(`unerwartet DELETE ${pfad}`));
  };

  return {
    stand: s,
    zaehler,
    /** Die Aufrufe einer Methode (und optional eines Pfades), ohne das stille „als gelesen melden“. */
    aufrufe: (methode: Aufruf['methode'], pfad?: string | RegExp) => s.aufrufe.filter((a) => a.methode === methode
      && (pfad === undefined || (typeof pfad === 'string' ? a.pfad === pfad : pfad.test(a.pfad)))
      && a.pfad !== '/support/mail/gelesen'),
    /**
     * Haengt den Server an die Attrappen des Tests (axios-Form: get, post,
     * patch, delete; put, wenn der Test eine hat -- PUT /organizations/:id).
     */
    installieren: (api: {
      get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn>;
      put?: ReturnType<typeof vi.fn>;
    }) => {
      api.get.mockImplementation(get);
      api.post.mockImplementation(post);
      api.patch.mockImplementation(patch);
      api.delete.mockImplementation(loeschen);
      api.put?.mockImplementation(put);
    },
  };
}

/** Ein Vorgang mit einer ungelesenen Mail -- der haeufigste Fall. */
export const mitMail = (id: number, extra: Partial<TestVorgang> = {}, mailExtra: Partial<TestMail> = {}) => ({
  vorgang: vorgang(id, extra),
  mail: mail(id * 10, id, mailExtra),
});
