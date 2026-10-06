// Ein kleiner Server im Speicher fuer die gerenderten Tests der Vorgaenge
// (docs/planung/support-vorgaenge.md): Er haelt seinen Stand und antwortet auf
// die Routen unter /api/support wie der echte -- Liste, Vorgang, einordnen,
// archivieren, wiederherstellen, loeschen, Sammelaktionen, antworten, Mails
// lesen, Posteingang und die roten Zahlen. So pruefen die Tests, was in der App
// passiert, wenn eine Seite etwas aendert und eine ANDERE Seite im Speicher
// stehen bleibt (Ionic haelt besuchte Seiten): Antworten kommen aus dem Stand,
// nicht aus festen Attrappen. Alle Daten sind erfunden.

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
}

export const GEMEINDEN = [
  { id: 7, name: 'musterdorf', display_name: 'Kirchengemeinde Musterdorf' },
  { id: 8, name: 'wiesengrund', display_name: 'Kirchengemeinde Wiesengrund' },
];

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
}

export function vorgaengeServer(optionen: ServerOptionen = {}) {
  const s = {
    vorgaenge: [...(optionen.vorgaenge ?? [])],
    mails: [...(optionen.mails ?? [])],
    aufrufe: [] as Aufruf[],
    naechsteId: 100,
    jetzt: '2026-10-03T09:00:00Z',
    /** Einzelne Routen scheitern lassen: Pfad -> Fehler. */
    fehler: new Map<string, unknown>(),
  };

  const mailsVon = (id: number) => s.mails.filter((m) => m.vorgang_id === id).sort((a, b) => a.gesendet_am.localeCompare(b.gesendet_am) || a.id - b.id);
  const ungelesenVon = (id: number) => mailsVon(id).filter((m) => m.richtung === 'ein' && !m.gelesen_am).length;
  const gemeindeName = (id: number | null) => (id === null ? null : GEMEINDEN.find((g) => g.id === id)?.display_name ?? `Gemeinde ${id}`);
  const aktivitaet = (v: TestVorgang) => [v.created_at, ...mailsVon(v.id).map((m) => m.gesendet_am)].sort().pop() as string;

  const eintrag = (v: TestVorgang) => ({
    id: v.id, art: v.art, bereich: v.bereich, dringlichkeit: v.dringlichkeit, status: v.status, betreff: v.betreff, quelle: v.quelle,
    organization_id: v.organization_id, gemeinde_name: gemeindeName(v.organization_id), anfrage_id: v.anfrage_id, ungelesen: ungelesenVon(v.id),
    letzte_aktivitaet: aktivitaet(v), created_at: v.created_at, archiviert_am: v.archiviert_am,
  });

  const detail = (v: TestVorgang) => {
    const g = v.organization_id === null ? null : GEMEINDEN.find((x) => x.id === v.organization_id) ?? null;
    return {
      ...eintrag(v), notiz: v.notiz, beschreibung: v.beschreibung, kontakt_name: v.kontakt_name, kontakt_email: v.kontakt_email,
      kontakt_funktion: v.kontakt_funktion, gemeinde_angabe: v.gemeinde_angabe,
      verlauf: mailsVon(v.id).map((m) => ({ ...m, anfrage_id: null, organization_id: v.organization_id })),
      anfrage: v.anfrage,
      gemeinde: g && { id: g.id, name: g.name, display_name: g.display_name, is_active: true, is_trial: true, trial_ends_at: '2026-11-02T00:00:00Z', max_konfis: 5, konfi_count: 3, kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche' },
      leitung: g ? LEITUNG[g.id] ?? [] : [],
    };
  };

  const fadenVon = (m: TestMail): TestMail[] => {
    if (m.vorgang_id !== null) return mailsVon(m.vorgang_id);
    if (!m.faden) return [m];
    return s.mails.filter((x) => x.faden === m.faden && x.vorgang_id === null).sort((a, b) => a.gesendet_am.localeCompare(b.gesendet_am) || a.id - b.id);
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
      return Promise.resolve({ data: { ...m, anfrage_id: null, organization_id: null, verlauf: fadenVon(m) } });
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
    if (/^\/support\/gemeinden\/\d+\/empfaenger$/.test(pfad)) {
      const id = idAus(pfad, /gemeinden\/(\d+)/);
      return Promise.resolve({ data: (LEITUNG[id] ?? []).filter((l) => l.email).map((l) => ({ adresse: l.email, name: l.display_name, herkunft: 'Gemeindeleitung' })) });
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
      if (koerper?.text) s.mails.push(mail(s.naechsteId++, id, { richtung: 'aus', postfach: 'support', von_adresse: 'support@konfi-quest.example', von_name: 'Support', an_adressen: [String(koerper.an)], betreff: `Re: ${v.betreff} [Vorgang ${id}]`, text: String(koerper.text), gesendet_am: s.jetzt, gelesen_am: s.jetzt }));
      return Promise.resolve({ data: { id } });
    }
    if (pfad === '/support/vorgaenge/sammel') {
      const ids = koerper?.ids as number[];
      for (const id of ids) {
        const v = finde(id);
        if (!v) continue;
        if (koerper?.aktion === 'archivieren') v.archiviert_am = s.jetzt;
        if (koerper?.aktion === 'wiederherstellen') { v.archiviert_am = null; v.status = 'in_arbeit'; }
        if (koerper?.aktion === 'status') { v.status = koerper.status as TestVorgang['status']; erledigtArchiviert(v); }
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
      if (v) { v.archiviert_am = null; v.status = 'in_arbeit'; }
      return Promise.resolve({ data: {} });
    }
    if (/^\/support\/anfragen\/\d+\/anlegen$/.test(pfad)) {
      // Gemeinde und erste Gemeindeleitung angelegt: die Anfrage steht auf „angelegt“, ihr Vorgang ist erledigt (Uebernahme-Regel des Plans).
      const aid = idAus(pfad, /anfragen\/(\d+)/);
      const v = s.vorgaenge.find((x) => x.anfrage_id === aid);
      if (v?.anfrage) { v.anfrage = { ...v.anfrage, status: 'angelegt', organization_id: 77 }; v.organization_id = 77; v.status = 'erledigt'; erledigtArchiviert(v); }
      return Promise.resolve({ data: { organization_id: 77, admin_id: 301 } });
    }
    if (pfad === '/support/kirchenkreise') {
      return Promise.resolve({ data: { id: 13 } });
    }
    if (/^\/support\/vorgaenge\/\d+\/antworten$/.test(pfad)) {
      const id = idAus(pfad, /vorgaenge\/(\d+)/);
      const v = finde(id);
      if (v && v.status === 'neu') v.status = 'in_arbeit';
      s.mails.push(mail(s.naechsteId++, id, { richtung: 'aus', von_adresse: 'support@konfi-quest.example', von_name: 'Support', betreff: `${koerper?.betreff ?? ''} [Vorgang ${id}]`, text: String(koerper?.text), gesendet_am: s.jetzt, gelesen_am: s.jetzt }));
      return Promise.resolve({ data: {} });
    }
    if (/^\/support\/mail\/nachrichten\/\d+\/antworten$/.test(pfad)) {
      // Antwort auf eine Mail ohne Vorgang: eine ausgehende Mail im selben Faden.
      const m = s.mails.find((x) => x.id === idAus(pfad, /nachrichten\/(\d+)/));
      if (m) s.mails.push(mail(s.naechsteId++, m.vorgang_id, { faden: m.faden ?? `mail-${m.id}`, richtung: 'aus', postfach: m.postfach, von_adresse: 'support@konfi-quest.example', von_name: 'Support', an_adressen: [m.von_adresse], betreff: String(koerper?.betreff ?? ''), text: String(koerper?.text), gesendet_am: s.jetzt, gelesen_am: s.jetzt }));
      if (m && !m.faden) m.faden = `mail-${m.id}`;
      return Promise.resolve({ data: {} });
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
      if (m && ziel) for (const x of fadenVon(m)) x.vorgang_id = ziel;
      return Promise.resolve({ data: { vorgang_id: ziel } });
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
    const v = finde(idAus(pfad, /vorgaenge\/(\d+)$/));
    if (!v) return Promise.reject(nichtGefunden());
    Object.assign(v, koerper);
    erledigtArchiviert(v);
    return Promise.resolve({ data: detail(v) });
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
    /** Haengt den Server an die Attrappen des Tests (axios-Form: get, post, patch, delete). */
    installieren: (api: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }) => {
      api.get.mockImplementation(get);
      api.post.mockImplementation(post);
      api.patch.mockImplementation(patch);
      api.delete.mockImplementation(loeschen);
    },
  };
}

/** Ein Vorgang mit einer ungelesenen Mail -- der haeufigste Fall. */
export const mitMail = (id: number, extra: Partial<TestVorgang> = {}, mailExtra: Partial<TestMail> = {}) => ({
  vorgang: vorgang(id, extra),
  mail: mail(id * 10, id, mailExtra),
});
