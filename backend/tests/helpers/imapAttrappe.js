// backend/tests/helpers/imapAttrappe.js -- Attrappe des imapflow-Clients fuer
// die Support-Mail (services/mailAbholung.js, services/mailVersand.js).
//
// Kein Netz: Die Fabrik liefert Clients, die ein Postfach im Speicher
// spielen -- INBOX mit Nachrichten (UID, Quelltext, Eingang), UIDVALIDITY und
// eine Ordnerliste. Jeder Aufruf wird mitgeschrieben; Methoden, die etwas
// am Postfach aendern wuerden (Flags setzen, verschieben, loeschen), stehen
// zusaetzlich in `aenderungen` -- die Tests verlangen dort eine leere Liste.
// `quelltextFuer` nennt die UIDs, deren Quelltext angefordert wurde.
//
// Dazu rohmail(): eine echte Mail als Quelltext (nodemailer MailComposer),
// wie sie aus dem Postfach kaeme.
const MailComposer = require('nodemailer/lib/mail-composer');

/** Bereich "a:b" oder "a:*" (UIDs) als Pruefung. */
function imBereich(bereich, uid, hoechste) {
  const [von, bis] = String(bereich).split(':');
  const a = von === '*' ? hoechste : Number(von);
  const b = bis === undefined ? a : (bis === '*' ? hoechste : Number(bis));
  const [unten, oben] = a <= b ? [a, b] : [b, a];
  return uid >= unten && uid <= oben;
}

/**
 * @param {object} [postfach]
 * @param {bigint|number} [postfach.uidValidity]
 * @param {Array<{uid: number, source: Buffer|string, internalDate?: Date}>} [postfach.nachrichten]
 * @param {Array<object>} [postfach.ordner]  Antwort von list()
 * @param {Error|null} [postfach.verbindungsFehler]  connect() wirft ihn
 * @param {Error|null} [postfach.anhaengenFehler]    append() wirft ihn
 * @param {boolean} [postfach.ohneUidNext]           mailboxOpen ohne uidNext
 */
function imapAttrappe(postfach = {}) {
  const zustand = {
    uidValidity: postfach.uidValidity ?? 1n,
    nachrichten: [...(postfach.nachrichten || [])],
    ordner: postfach.ordner || [],
    verbindungsFehler: postfach.verbindungsFehler || null,
    anhaengenFehler: postfach.anhaengenFehler || null,
    ohneUidNext: Boolean(postfach.ohneUidNext),
  };
  const aufrufe = [];
  const aenderungen = [];
  const optionen = [];
  // UIDs, deren Quelltext angefordert wurde (fetch oder fetchOne mit source).
  const quelltextFuer = [];

  /** Antwort des Servers auf eine FETCH-Abfrage fuer eine Nachricht. */
  const antwort = (n, query = {}) => {
    if (query.source) quelltextFuer.push(n.uid);
    return {
      uid: n.uid,
      ...(query.source ? { source: Buffer.from(n.source) } : {}),
      ...(query.internalDate ? { internalDate: n.internalDate || new Date() } : {}),
      ...(query.size ? { size: n.size ?? Buffer.byteLength(n.source) } : {}),
      ...(query.envelope ? { envelope: n.envelope || {} } : {}),
      ...(query.bodyStructure ? { bodyStructure: n.bodyStructure || { type: 'text/plain' } } : {}),
    };
  };

  const fabrik = (opt) => {
    optionen.push(opt);
    const merke = (name, ...args) => aufrufe.push([name, ...args]);
    const aendert = (name) => (...args) => {
      merke(name, ...args);
      aenderungen.push([name, ...args]);
      return Promise.resolve(true);
    };
    return {
      on: () => {},
      async connect() {
        merke('connect');
        if (zustand.verbindungsFehler) throw zustand.verbindungsFehler;
      },
      async mailboxOpen(pfad, opts) {
        merke('mailboxOpen', pfad, opts);
        const hoechste = zustand.nachrichten.reduce((m, n) => Math.max(m, n.uid), 0);
        return {
          path: pfad,
          uidValidity: BigInt(zustand.uidValidity),
          uidNext: zustand.ohneUidNext ? undefined : hoechste + 1,
          exists: zustand.nachrichten.length,
          readOnly: Boolean(opts && opts.readOnly),
        };
      },
      async *fetch(bereich, query, opts) {
        merke('fetch', bereich, query, opts);
        const hoechste = zustand.nachrichten.reduce((m, n) => Math.max(m, n.uid), 0);
        const sortiert = [...zustand.nachrichten].sort((x, y) => x.uid - y.uid);
        for (const n of sortiert) {
          if (opts && opts.uid ? imBereich(bereich, n.uid, hoechste) : (bereich === '*' && n.uid === hoechste)) {
            yield antwort(n, query);
          }
        }
      },
      async fetchOne(uid, query, opts) {
        merke('fetchOne', uid, query, opts);
        const n = zustand.nachrichten.find((x) => String(x.uid) === String(uid));
        if (!n) return false;
        return antwort(n, query);
      },
      async list() {
        merke('list');
        return zustand.ordner;
      },
      async mailboxCreate(pfad) {
        merke('mailboxCreate', pfad);
        const angelegt = { path: pfad, name: pfad, delimiter: '.', flags: new Set(), specialUse: undefined };
        zustand.ordner = [...zustand.ordner, angelegt];
        return { path: pfad, created: true };
      },
      async append(pfad, inhalt, flags, datum) {
        merke('append', pfad, Buffer.from(inhalt).toString('utf8'), flags, datum);
        if (zustand.anhaengenFehler) throw zustand.anhaengenFehler;
        return { destination: pfad, uid: 1 };
      },
      messageFlagsAdd: aendert('messageFlagsAdd'),
      messageFlagsRemove: aendert('messageFlagsRemove'),
      messageFlagsSet: aendert('messageFlagsSet'),
      messageDelete: aendert('messageDelete'),
      messageMove: aendert('messageMove'),
      messageCopy: aendert('messageCopy'),
      mailboxDelete: aendert('mailboxDelete'),
      async logout() {
        merke('logout');
      },
      close() {
        merke('close');
      },
    };
  };

  return {
    fabrik,
    aufrufe,
    aenderungen,
    optionen,
    zustand,
    quelltextFuer,
    /**
     * Neue Mail ins Postfach legen. `extra` setzt, was der Server ohne
     * Quelltext meldet: size (sonst die Laenge des Quelltexts), envelope,
     * bodyStructure.
     */
    einwerfen(uid, source, internalDate = new Date(), extra = {}) {
      zustand.nachrichten.push({ uid, source, internalDate, ...extra });
    },
    /** Namen der Aufrufe, in der Reihenfolge. */
    namen: () => aufrufe.map((a) => a[0]),
  };
}

/**
 * Eine Mail als Quelltext.
 * @param {object} m
 * @returns {Promise<Buffer>}
 */
async function rohmail({
  von = 'Pastorin Probe <probe@gemeinde.example>', an = 'moin@konfi-quest.de', betreff = 'Frage',
  text, html, messageId, inReplyTo, references, datum = new Date('2026-10-01T08:00:00Z'), anhaenge,
  ohneMessageId = false,
} = {}) {
  const mail = {
    from: von,
    to: an,
    subject: betreff,
    date: datum,
    ...(text !== undefined ? { text } : {}),
    ...(html !== undefined ? { html } : {}),
    ...(messageId ? { messageId } : {}),
    ...(inReplyTo ? { inReplyTo } : {}),
    ...(references ? { references } : {}),
    ...(anhaenge ? { attachments: anhaenge } : {}),
  };
  if (text === undefined && html === undefined) mail.text = 'Hallo';
  let quelltext = await new MailComposer(mail).compile().build();
  if (ohneMessageId) {
    quelltext = Buffer.from(quelltext.toString('utf8').replace(/^Message-ID:.*\r?\n/mi, ''));
  }
  return quelltext;
}

module.exports = { imapAttrappe, rohmail };
