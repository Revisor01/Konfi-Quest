// Vorgänge der Support-Ansicht (/admin/support/vorgaenge).
// App: components/support/SupportVorgaengePage.tsx. Web:
// components/support/web/WebVorgaenge.tsx. Filtern, Zählen und `?filter=`
// der Adresse: utils/supportVorgaenge.ts (VORGANG_FILTER, vorgaengeZaehlen,
// vorgaengeFiltern) über `passt` von hier.
//
// „Offen" ist die ganze Liste der offenen Vorgänge (neu, in Arbeit, wartet);
// „Archiv" ist eine eigene Liste (GET /vorgaenge?filter=archiv) und hat
// deshalb kein `passt`.

import { wahlen } from './beschreibung';
import type { Vorgang } from '../utils/supportVorgaenge';

type MitStatus = Pick<Vorgang, 'status'>;

/** Die Stände der Liste -- auch `?filter=` in der Adresse. Die Beschriftungen sind die Kurznamen der Status. */
export const VORGANG_STAENDE = wahlen([
  {
    schluessel: 'offen', label: 'Offen',
    leer: 'Es gibt keinen offenen Vorgang. Neue Anfragen, Formulare und Mails erscheinen hier.',
    passt: () => true,
    zahlText: () => 'neu, in Arbeit oder wartet',
  },
  { schluessel: 'neu', label: 'Neu', leer: 'Alle Vorgänge sind schon in Arbeit.', passt: (v: MitStatus) => v.status === 'neu' },
  { schluessel: 'in_arbeit', label: 'In Arbeit', leer: 'Gerade ist kein Vorgang in Arbeit.', passt: (v: MitStatus) => v.status === 'in_arbeit' },
  { schluessel: 'wartet', label: 'Wartet', leer: 'Kein Vorgang wartet auf eine Rückmeldung.', passt: (v: MitStatus) => v.status === 'wartet' },
  {
    schluessel: 'archiv', label: 'Archiv',
    leer: 'Erledigte und archivierte Vorgänge liegen hier. Gelöscht werden sie 730 Tage nach dem Archivieren.',
    zahlText: () => 'archiviert oder erledigt',
  },
]);

export type VorgangStand = (typeof VORGANG_STAENDE)[number]['schluessel'];

/** Die Überschrift des Leerzustands je Stand (bis 09.10.2026 sagte die App überall „Keine Vorgänge"). */
export const VORGANG_LEER_TITEL: Record<VorgangStand, string> = {
  offen: 'Nichts zu tun',
  neu: 'Nichts Neues',
  in_arbeit: 'Nichts in Arbeit',
  wartet: 'Nichts wartet',
  archiv: 'Das Archiv ist leer',
};

/**
 * Leer, weil Art, Gemeinde oder Suche eingrenzen -- nicht, weil der Stand leer
 * ist (bis 09.10.2026 meldete die App dann etwa „Alle Vorgänge sind schon in Arbeit.").
 */
export const VORGANG_KEINE_TREFFER = {
  titel: 'Keine Treffer',
  text: (suche: string): string => `In dieser Auswahl gibt es keinen Vorgang${suche.trim() ? ` zu „${suche.trim()}“` : ''}.`,
  zuruecksetzen: 'Auswahl zurücksetzen',
} as const;

export const VORGAENGE_TITEL = 'Vorgänge';
export const VORGANG_STAENDE_BESCHRIFTUNG = 'Vorgänge nach Stand';
export const ALLE_ARTEN = 'Alle Arten';
export const ALLE_GEMEINDEN = 'Alle Gemeinden';
