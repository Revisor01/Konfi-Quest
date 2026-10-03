// backend/tests/services/mailVersand.test.js
//
// Bausteine des Versands (services/mailVersand.js) ohne Datenbank: der
// Gesendet-Ordner (Befund in der Produktion, 03.10.2026: moin@ hat "Sent"
// ohne \Sent-Markierung, support@ hat gar keinen), Betreff, Fusszeile und
// Bezug auf die letzte Mail. Die Routen samt gesendetem Quelltext pruefen
// tests/routes/supportMailAntworten.test.js.
const { imapAttrappe } = require('../helpers/imapAttrappe');
const {
  inGesendetAblegen, antwortBetreff, betreffMitKennung, textMitFusszeile, bezugKopf, versandAufDiesemServer,
} = require('../../services/mailVersand');

const ordner = (path, { specialUse, flags = [], delimiter = '.', name } = {}) => ({
  path, name: name || path.split(delimiter).pop(), delimiter, flags: new Set(flags), specialUse,
});

describe('inGesendetAblegen', () => {
  const DATUM = new Date('2026-10-03T10:00:00Z');
  const ablegen = async (liste) => {
    const attrappe = imapAttrappe({ ordner: liste });
    const client = attrappe.fabrik({});
    const pfad = await inGesendetAblegen(client, 'From: a\r\n\r\nHallo', DATUM);
    return { pfad, attrappe };
  };

  it('Ordner mit der Markierung \\Sent: dorthin, auch wenn ein anderer „Sent“ heißt', async () => {
    const { pfad, attrappe } = await ablegen([
      ordner('INBOX', { specialUse: '\\Inbox' }),
      ordner('Sent'),
      ordner('INBOX.Gesendete Elemente', { specialUse: '\\Sent' }),
    ]);
    expect(pfad).toBe('INBOX.Gesendete Elemente');
    expect(attrappe.aufrufe.filter((a) => a[0] === 'append'))
      .toEqual([['append', 'INBOX.Gesendete Elemente', 'From: a\r\n\r\nHallo', ['\\Seen'], DATUM]]);
    expect(attrappe.namen()).not.toContain('mailboxCreate');
  });

  it('nur ein Ordner „Sent“ ohne Markierung (moin@, LIST (\\HasNoChildren \\UnMarked) "." Sent): dorthin', async () => {
    const { pfad, attrappe } = await ablegen([
      ordner('INBOX', { specialUse: '\\Inbox' }),
      ordner('Sent', { flags: ['\\HasNoChildren', '\\UnMarked'] }),
      ordner('Trash', { specialUse: '\\Trash' }),
    ]);
    expect(pfad).toBe('Sent');
    expect(attrappe.namen()).toEqual(['list', 'append']);
  });

  it.each([
    ['sent', 'sent'],
    ['INBOX.Gesendet', 'INBOX.Gesendet'],
    ['Sent Items', 'Sent Items'],
    ['INBOX/Gesendete Objekte', 'INBOX/Gesendete Objekte'],
  ])('Name ohne Markierung, ohne Rücksicht auf Groß/klein und mit Trennzeichen: %s', async (pfadImPostfach, erwartet) => {
    const delimiter = pfadImPostfach.includes('/') ? '/' : '.';
    const { pfad } = await ablegen([ordner('INBOX'), ordner(pfadImPostfach, { delimiter })]);
    expect(pfad).toBe(erwartet);
  });

  it('kein Gesendet-Ordner (support@): „Sent“ wird angelegt und die Mail dorthin gelegt', async () => {
    const { pfad, attrappe } = await ablegen([ordner('INBOX', { specialUse: '\\Inbox' }), ordner('Drafts', { specialUse: '\\Drafts' })]);
    expect(pfad).toBe('Sent');
    expect(attrappe.namen()).toEqual(['list', 'mailboxCreate', 'append']);
    expect(attrappe.aufrufe[1]).toEqual(['mailboxCreate', 'Sent']);
  });

  it('ein Ordner, der nicht wählbar ist (\\Noselect), zählt nicht', async () => {
    const { pfad, attrappe } = await ablegen([ordner('Sent', { flags: ['\\Noselect'], specialUse: '\\Sent' })]);
    expect(pfad).toBe('Sent');
    expect(attrappe.namen()).toEqual(['list', 'mailboxCreate', 'append']);
  });
});

describe('Betreff, Fußzeile, Bezug', () => {
  it.each([
    ['Frage', 'Re: Frage'],
    ['Re: Frage', 'Re: Frage'],
    ['RE: AW: Re[2]: Frage', 'Re: Frage'],
    ['Antw: Frage', 'Re: Frage'],
    ['  Zwei\r\nZeilen  ', 'Re: Zwei Zeilen'],
    ['', 'Re:'],
  ])('antwortBetreff(%j) = %j', (ein, aus) => {
    expect(antwortBetreff(ein)).toBe(aus);
  });

  it('betreffMitKennung: hängt die Kennung an, wenn sie fehlt, bleibt einzeilig und höchstens 300 Zeichen', () => {
    expect(betreffMitKennung('Eure Anfrage', { anfrageId: 12 })).toBe('Eure Anfrage [Anfrage 12]');
    expect(betreffMitKennung('Re: X [Anfrage 12]', { anfrageId: 12 })).toBe('Re: X [Anfrage 12]');
    expect(betreffMitKennung('Re: X [Anfrage 13]', { anfrageId: 12 })).toBe('Re: X [Anfrage 13] [Anfrage 12]');
    expect(betreffMitKennung('Hallo\nWelt', { organizationId: 7 })).toBe('Hallo Welt [Gemeinde 7]');
    expect(betreffMitKennung('Ohne', {})).toBe('Ohne');
    const lang = betreffMitKennung('x'.repeat(300), { anfrageId: 12 });
    expect(lang.length).toBe(300);
    expect(lang.endsWith(' [Anfrage 12]')).toBe(true);
  });

  it('textMitFusszeile: Trenner „-- “ auf eigener Zeile; ohne Fußzeile kein Trenner; Zeilenenden einheitlich', () => {
    expect(textMitFusszeile('Hallo\r\n\r\nGruß  \n\n', 'Konfi Quest\nkonfi-quest.de'))
      .toBe('Hallo\n\nGruß\n\n-- \nKonfi Quest\nkonfi-quest.de\n');
    expect(textMitFusszeile('Hallo', '  ')).toBe('Hallo\n');
  });

  it('bezugKopf: In-Reply-To = letzte Mail, References = ihre References + ihre Message-ID (ohne Doppelte)', () => {
    expect(bezugKopf(null)).toEqual({ inReplyTo: null, referenzen: [] });
    expect(bezugKopf({ message_id: '<b@x>', referenzen: ['<a@x>', '<b@x>'] }))
      .toEqual({ inReplyTo: '<b@x>', referenzen: ['<a@x>', '<b@x>'] });
    const viele = Array.from({ length: 120 }, (_, i) => `<r${i}@x>`);
    const { referenzen } = bezugKopf({ message_id: '<neu@x>', referenzen: viele });
    expect(referenzen.length).toBe(100);
    expect(referenzen[99]).toBe('<neu@x>');
  });

  it('versandAufDiesemServer: nur RUN_BACKGROUND_JOBS=false schaltet ab', () => {
    expect(versandAufDiesemServer({ RUN_BACKGROUND_JOBS: 'false' })).toBe(false);
    expect(versandAufDiesemServer({ RUN_BACKGROUND_JOBS: 'true' })).toBe(true);
    expect(versandAufDiesemServer({})).toBe(true);
  });
});
