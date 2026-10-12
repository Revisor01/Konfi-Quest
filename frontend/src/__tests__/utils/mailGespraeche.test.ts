// Mails als Verlauf (utils/mailGespraeche.ts, 11.10.2026): Vorgänger aus den
// Kopfzeilen, Signatur und Zitate abtrennen, Vorschau, Kreis, Zeit und der
// flache Verlauf. Der Baum mit Einrückung (gespraecheBilden, anfangsOffen,
// mailAbsender, MAX_TIEFE) ist mit dem flachen Verlauf entfallen; was er über
// die Kopfzeilen prüfte, prüft jetzt der Block „vorgaengerVon".
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { MailNachricht } from '../../types/support';
import {
  absenderZeile,
  betreffKern,
  initialen,
  mailTextZerlegen,
  mailVorschau,
  mailZeit,
  verlaufReihe,
  verlaufZaehler,
  vorgaengerVon,
  type VerlaufAnfang,
  type VerlaufEintrag,
} from '../../utils/mailGespraeche';
import { betreffKern as betreffKernMail } from '../../utils/supportMail';

const mail = (id: number, teil: Partial<MailNachricht> = {}): MailNachricht => ({
  id,
  postfach: 'support',
  richtung: 'ein',
  anfrage_id: null,
  organization_id: null,
  message_id: `<m${id}@x>`,
  in_reply_to: null,
  referenzen: [],
  von_adresse: `p${id}@example.org`,
  von_name: `Person ${id}`,
  an_adressen: ['support@konfi-quest.de'],
  betreff: 'Frage',
  text: `Text ${id}`,
  anhaenge: null,
  gesendet_am: `2026-10-0${Math.min(id, 9)}T10:00:00Z`,
  gelesen_am: null,
  ...teil,
});

/** Wer worauf antwortet, als [Mail, Vorgänger]. */
const paare = (mails: MailNachricht[]) => [...vorgaengerVon(mails).entries()].map(([id, m]) => [id, m.id]).sort((a, b) => a[0] - b[0]);

describe('vorgaengerVon: wer worauf antwortet, aus den Kopfzeilen', () => {
  it('jede Antwort hat ihren Vorgänger, auch wenn zwei auf dieselbe Mail antworten', () => {
    const mails = [
      mail(1),
      mail(2, { in_reply_to: '<m1@x>', referenzen: ['<m1@x>'] }),
      mail(3, { in_reply_to: '<m2@x>', referenzen: ['<m1@x>', '<m2@x>'] }),
      mail(4, { in_reply_to: '<m1@x>', referenzen: ['<m1@x>'] }),
    ];
    expect(paare(mails)).toEqual([[2, 1], [3, 2], [4, 1]]);
  });

  it('kommt die Liste durcheinander, zählt die Zeit -- nicht die Reihenfolge der Liste', () => {
    expect(paare([mail(4, { in_reply_to: '<m1@x>' }), mail(9), mail(1), mail(2, { in_reply_to: '<m1@x>' })])).toEqual([[2, 1], [4, 1]]);
  });

  it('folgt den References, wenn In-Reply-To auf eine fehlende Mail zeigt', () => {
    expect(paare([mail(1), mail(3, { in_reply_to: '<fehlt@x>', referenzen: ['<m1@x>', '<fehlt@x>'] })])).toEqual([[3, 1]]);
  });

  it('ein Vorgänger zählt nur, wenn er früher kam -- falsche Kopfzeilen bilden keinen Kreis', () => {
    expect(paare([mail(1, { in_reply_to: '<m2@x>' }), mail(2, { in_reply_to: '<m1@x>' })])).toEqual([[2, 1]]);
  });

  it('ohne Kennung kein Bezug', () => {
    expect(paare([mail(1, { message_id: null }), mail(2, { in_reply_to: '<m1@x>' })])).toEqual([]);
  });
});

describe('betreffKern', () => {
  it('entfernt Vorsilben mehrfach und alle drei Kennungen', () => {
    expect(betreffKern('Re: AW: WG: Frage [Anfrage 2]')).toBe('Frage');
    expect(betreffKern('Fwd: Bitte [Gemeinde 7] prüfen')).toBe('Bitte prüfen');
    expect(betreffKern(null)).toBe('');
  });

  it('entfernt erst die Kennungen, dann die Vorsilben wiederholt -- auch die hinter einer Kennung (Fehler vorab 1)', () => {
    // Gemessen am 11.10.2026: „Re: AW: Re: Konfis sehen …" blieb stehen.
    expect(betreffKern('AW: [Vorgang 2] Re: AW: Re: Konfis sehen den Termin am Samstag nicht')).toBe('Konfis sehen den Termin am Samstag nicht');
    expect(betreffKern('[Vorgang 2] WG: Fwd: Frage')).toBe('Frage');
    expect(betreffKern('Re[2]: [Anfrage 41] Antw: Eure Anfrage bei Konfi Quest')).toBe('Eure Anfrage bei Konfi Quest');
  });

  it('ist dieselbe Funktion wie in utils/supportMail.ts -- eine Stelle für Gespräche und Antworten', () => {
    expect(betreffKern).toBe(betreffKernMail);
  });
});

describe('mailTextZerlegen', () => {
  it('trennt die Signatur am Trenner „-- " und lässt Zitate danach stehen', () => {
    const text = 'Hallo,\n\nbitte prüft das.\n\n-- \nKonfi Quest\nkonfi-quest.de\n\nAm 1.10. schrieb Anna <a@b.de>:\n> Frage';
    const { teile, signatur } = mailTextZerlegen(text);
    expect(signatur).toBe('Konfi Quest\nkonfi-quest.de');
    expect(teile).toEqual([
      { zitat: false, text: 'Hallo,\n\nbitte prüft das.' },
      { zitat: true, text: 'Am 1.10. schrieb Anna <a@b.de>:\n> Frage' },
    ]);
  });

  it('erkennt den Trenner auch ohne Leerzeichen und ohne Signatur bleibt sie null', () => {
    expect(mailTextZerlegen('Text\n--\nGruß').signatur).toBe('Gruß');
    expect(mailTextZerlegen('Nur Text').signatur).toBeNull();
    expect(mailTextZerlegen(null)).toEqual({ teile: [], signatur: null });
  });

  it('„-- " in einem Zitat ist keine Signatur', () => {
    const { signatur, teile } = mailTextZerlegen('Danke!\n> Hallo\n> -- \n> Konfi Quest');
    expect(signatur).toBeNull();
    expect(teile.map((t) => t.zitat)).toEqual([false, true]);
  });
});

describe('mailVorschau', () => {
  it('zeigt den eigenen Text ohne Zitat und ohne Signatur in einer Zeile', () => {
    const text = 'Das war es,\njetzt klappt es.\n\n-- \nLena\n\n> alte Mail';
    expect(mailVorschau(text)).toBe('Das war es, jetzt klappt es.');
  });

  it('kürzt an einer Wortgrenze', () => {
    expect(mailVorschau('eins zwei drei vier fünf sechs', 18)).toBe('eins zwei drei…');
  });
});

describe('initialen', () => {
  it('nimmt zwei Anfangsbuchstaben, sonst den der Adresse', () => {
    expect(initialen('Lena Probe')).toBe('LP');
    expect(initialen('Pastorin Lena Probe')).toBe('PL');
    expect(initialen(null, 'info@verein.example')).toBe('I');
    expect(initialen('  ', 'max.mustermann@x.de')).toBe('MM');
    expect(initialen(null, null)).toBe('?');
  });
});

describe('Der flache Verlauf (Simon, 11.10.2026: Frage 2)', () => {
  const JETZT = new Date('2026-10-11T12:00:00Z');
  const gelesen = (id: number, teil: Partial<MailNachricht> = {}) => mail(id, { gelesen_am: '2026-10-10T00:00:00Z', ...teil });
  const support = (id: number, teil: Partial<MailNachricht> = {}) => gelesen(id, {
    richtung: 'aus', von_adresse: 'support@konfi-quest.de', von_name: 'Konfi Quest Support', verfasst_von: 9, verfasst_von_name: 'Test Super-Admin', ...teil,
  });
  const ANFANG: VerlaufAnfang = { marke: 'Formular', name: 'Test Org-Admin 1', adresse: 'orgadmin1@example.org', datum: '2026-10-01T08:00:00Z', text: 'Hallo Support' };
  /** Die Reihe als kurze Zeichen: a = Anfang (+ offen, - kurz), m3+ = Mail 3 offen, m3- = zu, s[1,2,3] = Stapel. */
  const kurz = (r: VerlaufEintrag[]) => r.map((e) => (e.art === 'anfang' ? `a${e.offen ? '+' : '-'}` : e.art === 'mail' ? `m${e.mail.id}${e.offen ? '+' : '-'}` : `s[${e.ids.join(',')}]`));

  it('flach, das Älteste zuerst; offen sind die jüngste und jede neue; zwei eingeklappte stehen einzeln', () => {
    const r = verlaufReihe([mail(3), gelesen(1), support(2)], null, new Set([3]), { jetzt: JETZT });
    expect(kurz(r)).toEqual(['m1-', 'm2-', 'm3+']);
    const m3 = r[2] as Extract<VerlaufEintrag, { art: 'mail' }>;
    expect(m3).toMatchObject({ schluessel: 'mail-3', neu: true, ausgehend: false, absender: 'Person 3', konto: null, kreis: 'P3', antwortAuf: null, betreffAbweichend: null });
    // Eine neue Mail mitten im Verlauf ist offen, auch wenn sie nicht die jüngste ist.
    expect(kurz(verlaufReihe([gelesen(1), mail(2), gelesen(3)], null, new Set([2]), { jetzt: JETZT }))).toEqual(['m1-', 'm2+', 'm3+']);
  });

  it('ab drei eingeklappten Mails in Folge ein Stapel mit Absendern und Anhängen; zwei bleiben einzeln', () => {
    const vier = verlaufReihe([gelesen(1, { anhaenge: [{ name: 'a.pdf' }] }), support(2), gelesen(3, { anhaenge: [{ name: 'b.png' }, { name: 'c.png' }] }), support(4), gelesen(5)], null, new Set(), { jetzt: JETZT });
    expect(kurz(vier)).toEqual(['s[1,2,3,4]', 'm5+']);
    expect(vier[0]).toEqual({ art: 'stapel', schluessel: 'stapel-1', ids: [1, 2, 3, 4], anzahl: 4, absender: ['Person 1', 'Support', 'Person 3'], anhaenge: 3 });
    expect(kurz(verlaufReihe([gelesen(1), gelesen(2), gelesen(3), gelesen(4)], null, new Set(), { jetzt: JETZT }))).toEqual(['s[1,2,3]', 'm4+']);
    expect(kurz(verlaufReihe([gelesen(1), gelesen(2), gelesen(3)], null, new Set(), { jetzt: JETZT }))).toEqual(['m1-', 'm2-', 'm3+']);
  });

  it('Ungelesenes und Neues wird nie gestapelt -- es unterbricht den Lauf', () => {
    const r = verlaufReihe([gelesen(1), gelesen(2), mail(3), gelesen(4), gelesen(5), gelesen(6)], null, new Set(), { jetzt: JETZT });
    expect(kurz(r)).toEqual(['m1-', 'm2-', 'm3-', 'm4-', 'm5-', 'm6+']);
    const mitNeu = verlaufReihe([gelesen(1), gelesen(2), gelesen(3), mail(4), gelesen(5), gelesen(6), gelesen(7), gelesen(8)], null, new Set([4]), { jetzt: JETZT });
    expect(kurz(mitNeu)).toEqual(['s[1,2,3]', 'm4+', 's[5,6,7]', 'm8+']);
  });

  it('ein aufgelöster Stapel steht einzeln eingeklappt; „Alle aufklappen" öffnet alles, auch den Anfang', () => {
    const mails = [support(1), gelesen(2), gelesen(3), gelesen(4)];
    expect(kurz(verlaufReihe(mails, ANFANG, new Set(), { jetzt: JETZT, stapelOffen: new Set(['stapel-1']) }))).toEqual(['a-', 'm1-', 'm2-', 'm3-', 'm4+']);
    expect(kurz(verlaufReihe(mails, ANFANG, new Set(), { jetzt: JETZT, alleOffen: true }))).toEqual(['a+', 'm1+', 'm2+', 'm3+', 'm4+']);
    expect(kurz(verlaufReihe(mails, ANFANG, new Set(), { jetzt: JETZT, offen: new Set([2]) }))).toEqual(['a-', 'm1-', 'm2+', 'm3-', 'm4+']);
  });

  it('der Anfang ist offen, bis der Support antwortet -- die automatische Bestätigung zählt nicht; danach kurz', () => {
    const bestaetigung = support(1, { verfasst_von: null, verfasst_von_name: null });
    expect(verlaufReihe([bestaetigung, gelesen(2)], ANFANG, new Set(), { jetzt: JETZT })[0])
      .toEqual({ art: 'anfang', schluessel: 'anfang', anfang: ANFANG, offen: true, kurz: false });
    expect(verlaufReihe([gelesen(2), support(3)], ANFANG, new Set(), { jetzt: JETZT })[0]).toMatchObject({ offen: false, kurz: true });
    expect(verlaufReihe([], ANFANG, new Set(), { jetzt: JETZT })).toEqual([{ art: 'anfang', schluessel: 'anfang', anfang: ANFANG, offen: true, kurz: false }]);
  });

  it('ausgehend heißt einheitlich „Support" mit KQ, das Konto daneben; ohne Konto nur „Support"', () => {
    const r = verlaufReihe([support(1), support(2, { verfasst_von: null, verfasst_von_name: null })], null, new Set(), { jetzt: JETZT });
    expect(r.map((e) => (e.art === 'mail' ? [e.absender, e.konto, e.kreis, e.ausgehend] : null))).toEqual([
      ['Support', 'Test Super-Admin', 'KQ', true],
      ['Support', null, 'KQ', true],
    ]);
  });

  it('zwei Gespräche nebeneinander: „Antwort auf {Name}, {Zeit}", wo die Mail nicht auf die direkt davor antwortet', () => {
    const r = verlaufReihe([
      gelesen(1, { gesendet_am: '2026-10-09T08:00:00Z' }),
      gelesen(2, { gesendet_am: '2026-10-10T08:00:00Z' }),
      support(3, { gesendet_am: '2026-10-11T07:00:00Z', in_reply_to: '<m1@x>' }),
      gelesen(4, { gesendet_am: '2026-10-11T08:00:00Z', in_reply_to: '<m3@x>' }),
    ], null, new Set(), { jetzt: JETZT, alleOffen: true });
    const antwortAuf = r.flatMap((e) => (e.art === 'mail' ? [e.antwortAuf] : []));
    expect(antwortAuf).toEqual([null, null, { name: 'Person 1', zeit: '09.10., 10:00' }, null]);
  });

  it('weicht der Kern des Betreffs vom Titel ab, steht er da -- nie roh mit Kennung und Vorsilben', () => {
    const r = verlaufReihe([
      gelesen(1, { betreff: 'AW: [Vorgang 2] Re: Konfis sehen das Event' }),
      gelesen(2, { betreff: 'Neue Frage zu Badges [Vorgang 2]' }),
      gelesen(3, { betreff: null }),
    ], null, new Set(), { jetzt: JETZT, titelKern: 'Konfis sehen das Event' });
    expect(r.flatMap((e) => (e.art === 'mail' ? [e.betreffAbweichend] : []))).toEqual([null, 'Neue Frage zu Badges', null]);
    // Ohne Titel kein Vergleich.
    expect(verlaufReihe([gelesen(2, { betreff: 'Neue Frage' })], null, new Set(), { jetzt: JETZT })[0]).toMatchObject({ betreffAbweichend: null });
  });

  it('absenderZeile: eingehend Name oder Adresse mit Initialen', () => {
    expect(absenderZeile(mail(1, { von_name: 'Anna Beispiel' }))).toEqual({ name: 'Anna Beispiel', konto: null, kreis: 'AB', ausgehend: false });
    expect(absenderZeile(mail(1, { von_name: null, von_adresse: 'info@beispiel.example' }))).toEqual({ name: 'info@beispiel.example', konto: null, kreis: 'I', ausgehend: false });
  });

  it('vorgaengerVon: der nächste Vorgänger aus In-Reply-To oder References, nie ein späterer', () => {
    const v = vorgaengerVon([
      mail(1), mail(2, { in_reply_to: '<m1@x>' }), mail(3, { referenzen: ['<m1@x>', '<m2@x>'] }), mail(4, { in_reply_to: '<m5@x>' }), mail(5),
    ]);
    expect([...v.entries()].map(([id, m]) => [id, m.id])).toEqual([[2, 1], [3, 2]]);
  });

  it('Zähler: „6 Nachrichten, 1 neu" -- mit dem Anfang, wenn er dazugehört', () => {
    const mails = [gelesen(1), gelesen(2), gelesen(3), gelesen(4), mail(5)];
    expect(verlaufZaehler(mails, new Set([5]), true)).toBe('6 Nachrichten, 1 neu');
    expect(verlaufZaehler(mails, new Set())).toBe('5 Nachrichten');
    expect(verlaufZaehler([gelesen(1)], new Set())).toBe('1 Nachricht');
    expect(verlaufZaehler([], new Set(), true)).toBe('1 Nachricht');
  });
});

describe('mailZeit', () => {
  // Die Zeitzone ist die des Geraets; der Test legt sie auf Deutschland.
  let vorherTZ: string | undefined;
  beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
  afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });
  const jetzt = new Date('2026-10-11T12:00:00Z');
  it('heute nur die Uhrzeit, gestern mit Wort, dieses Jahr ohne Jahr, sonst mit', () => {
    expect(mailZeit('2026-10-11T07:05:00Z', jetzt)).toBe('09:05');
    expect(mailZeit('2026-10-10T07:05:00Z', jetzt)).toBe('gestern, 09:05');
    expect(mailZeit('2026-03-02T07:05:00Z', jetzt)).toBe('02.03., 08:05');
    expect(mailZeit('2025-12-24T07:05:00Z', jetzt)).toBe('24.12.2025');
    expect(mailZeit('kein Datum', jetzt)).toBe('');
  });
});
