// Posteingang der Support-Ansicht (/admin/support/post).
// App: components/support/SupportPosteingangPage.tsx. Web:
// components/support/web/WebPosteingang.tsx. Filtern und Zählen:
// utils/supportWeb.ts (eingangFiltern, eingangZaehlen) über `passt` von hier.
//
// „Archiv" ist eine eigene Liste (GET /support/mail/eingang?archiv=1) und
// hat deshalb kein `passt`: usePosteingang lädt sie, statt zu filtern.

import { wahlen } from './beschreibung';
import { POSTFACH_INFO } from '../utils/supportMail';
import type { MailEingangWeb } from '../utils/supportWeb';

type Mail = Pick<MailEingangWeb, 'gelesen_am' | 'postfach'>;

/**
 * Die Filter des Posteingangs -- auch `?filter=` in der Adresse. `leer` ist
 * der erklärende Satz; die Überschrift dazu steht in POSTEINGANG_LEER_TITEL.
 */
export const POSTEINGANG_FILTER = wahlen([
  { schluessel: 'alle', label: 'Alle', leer: 'Alles ist einsortiert. Neue Mails, die zu keinem Vorgang passen, erscheinen hier.', passt: () => true },
  {
    schluessel: 'ungelesen', label: 'Ungelesen', leer: 'Alle Mails sind gelesen.',
    passt: (m: Mail) => !m.gelesen_am,
    zahlText: () => 'ungelesen',
  },
  {
    schluessel: 'moin', label: POSTFACH_INFO.moin.kurz,
    leer: `Keine Mails an ${POSTFACH_INFO.moin.kurz}, die noch einsortiert werden müssen.`,
    passt: (m: Mail) => m.postfach === 'moin',
  },
  {
    schluessel: 'support', label: POSTFACH_INFO.support.kurz,
    leer: `Keine Mails an ${POSTFACH_INFO.support.kurz}, die noch einsortiert werden müssen.`,
    passt: (m: Mail) => m.postfach === 'support',
  },
  { schluessel: 'archiv', label: 'Archiv', leer: 'Archivierte Mails liegen hier und werden nach 180 Tagen gelöscht.' },
]);

export type PosteingangFilter = (typeof POSTEINGANG_FILTER)[number]['schluessel'];

/** Die Überschrift des Leerzustands je Filter (bis 09.10.2026 sagte die App überall „Nichts einzusortieren"). */
export const POSTEINGANG_LEER_TITEL: Record<PosteingangFilter, string> = {
  alle: 'Nichts einzusortieren',
  ungelesen: 'Nichts Ungelesenes',
  moin: 'Keine Mails',
  support: 'Keine Mails',
  archiv: 'Das Archiv ist leer',
};

export const POSTEINGANG_TITEL = 'Posteingang';
export const POSTEINGANG_FILTER_BESCHRIFTUNG = 'Mails filtern';

/** Ein Postfach ohne Zugangsdaten (auf diesem Server eingeschaltet). */
export const ZUGANGSDATEN_FEHLEN = {
  titel: 'Zugangsdaten fehlen',
  text: 'Ohne Benutzer, Passwort und IMAP-Server auf dem Server wird dieses Postfach nicht gelesen.',
} as const;
