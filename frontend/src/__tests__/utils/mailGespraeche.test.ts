// Mails als Gespräche (utils/mailGespraeche.ts, 11.10.2026): Baum aus den
// Kopfzeilen, Signatur und Zitate abtrennen, Vorschau, Kreis, Zeit.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { MailNachricht } from '../../types/support';
import {
  MAX_TIEFE,
  anfangsOffen,
  betreffKern,
  gespraecheBilden,
  initialen,
  mailAbsender,
  mailTextZerlegen,
  mailVorschau,
  mailZeit,
} from '../../utils/mailGespraeche';

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

/** Die Reihe eines Gesprächs als „Kennung@Tiefe" -- so liest sich der Baum auf einen Blick. */
const reihe = (mails: MailNachricht[]) => gespraecheBilden(mails).map((g) => g.mails.map((m) => `${m.mail.id}@${m.tiefe}`).join(' '));

describe('gespraecheBilden', () => {
  it('ordnet jede Antwort unter ihren Vorgänger, auch wenn zwei auf dieselbe Mail antworten', () => {
    const mails = [
      mail(1),
      mail(2, { in_reply_to: '<m1@x>', referenzen: ['<m1@x>'] }),
      mail(3, { in_reply_to: '<m2@x>', referenzen: ['<m1@x>', '<m2@x>'] }),
      mail(4, { in_reply_to: '<m1@x>', referenzen: ['<m1@x>'] }),
    ];
    expect(reihe(mails)).toEqual(['1@0 2@1 3@2 4@1']);
  });

  it('kommt die Liste durcheinander, bleibt die Reihenfolge nach Zeit -- ältestes Gespräch zuerst', () => {
    const mails = [
      mail(4, { in_reply_to: '<m1@x>' }),
      mail(9, { betreff: 'Anderes Thema' }),
      mail(1),
      mail(2, { in_reply_to: '<m1@x>' }),
    ];
    expect(reihe(mails)).toEqual(['1@0 2@1 4@1', '9@0']);
  });

  it('folgt den References, wenn In-Reply-To auf eine fehlende Mail zeigt', () => {
    const mails = [
      mail(1),
      mail(3, { in_reply_to: '<fehlt@x>', referenzen: ['<m1@x>', '<fehlt@x>'] }),
    ];
    expect(reihe(mails)).toEqual(['1@0 3@1']);
  });

  it('zwei Antworten auf eine Mail, die hier fehlt, stehen in EINEM Gespräch nebeneinander', () => {
    const mails = [
      mail(2, { in_reply_to: '<fehlt@x>', referenzen: ['<fehlt@x>'] }),
      mail(3, { in_reply_to: '<fehlt@x>', referenzen: ['<fehlt@x>'] }),
    ];
    expect(reihe(mails)).toEqual(['2@0 3@0']);
  });

  it('Mails ohne Bezug beginnen je ein eigenes Gespräch', () => {
    expect(reihe([mail(1, { message_id: null }), mail(2, { message_id: null })])).toEqual(['1@0', '2@0']);
  });

  it('ein Vorgänger zählt nur, wenn er früher kam -- falsche Kopfzeilen bilden keinen Kreis', () => {
    const mails = [
      mail(1, { in_reply_to: '<m2@x>' }),
      mail(2, { in_reply_to: '<m1@x>' }),
    ];
    expect(reihe(mails)).toEqual(['1@0 2@1']);
  });

  it('rückt höchstens MAX_TIEFE Stufen ein', () => {
    const kette = [mail(1)];
    for (let i = 2; i <= 7; i++) kette.push(mail(i, { in_reply_to: `<m${i - 1}@x>` }));
    const tiefen = gespraecheBilden(kette)[0].mails.map((m) => m.tiefe);
    expect(MAX_TIEFE).toBe(3);
    expect(tiefen).toEqual([0, 1, 2, 3, 3, 3, 3]);
  });

  it('nimmt als Überschrift den Betreff ohne Re:, AW:, WG: und ohne Kennung des Servers', () => {
    const g = gespraecheBilden([
      mail(1, { betreff: null }),
      mail(2, { in_reply_to: '<m1@x>', betreff: 'AW: Re: Euer Anliegen ist angekommen [Vorgang 4]' }),
    ]);
    expect(g[0].betreff).toBe('Euer Anliegen ist angekommen');
    expect(g[0].letzte).toBe('2026-10-02T10:00:00Z');
    expect(g[0].schluessel).toBe('gespraech-1');
  });
});

describe('betreffKern', () => {
  it('entfernt Vorsilben mehrfach und alle drei Kennungen', () => {
    expect(betreffKern('Re: AW: WG: Frage [Anfrage 2]')).toBe('Frage');
    expect(betreffKern('Fwd: Bitte [Gemeinde 7] prüfen')).toBe('Bitte prüfen');
    expect(betreffKern(null)).toBe('');
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

describe('initialen und Absender', () => {
  it('nimmt zwei Anfangsbuchstaben, sonst den der Adresse', () => {
    expect(initialen('Lena Probe')).toBe('LP');
    expect(initialen('Pastorin Lena Probe')).toBe('PL');
    expect(initialen(null, 'info@verein.example')).toBe('I');
    expect(initialen('  ', 'max.mustermann@x.de')).toBe('MM');
    expect(initialen(null, null)).toBe('?');
  });

  it('nennt bei gesendeten Mails das Konto, das sie schrieb', () => {
    expect(mailAbsender({ ...mail(1), richtung: 'aus', von_name: 'Konfi Quest', verfasst_von_name: 'Simon Luthe' })).toBe('Simon Luthe');
    expect(mailAbsender({ ...mail(1), richtung: 'aus', von_name: 'Konfi Quest', verfasst_von_name: null })).toBe('Konfi Quest');
    expect(mailAbsender({ ...mail(1), von_name: null })).toBe('p1@example.org');
  });
});

describe('anfangsOffen', () => {
  it('klappt die jüngste und alle ungelesenen auf', () => {
    const mails = [mail(3), mail(1), mail(2)];
    expect([...anfangsOffen(mails, new Set([1]))].sort()).toEqual([1, 3]);
    expect([...anfangsOffen([])]).toEqual([]);
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
