// Mitmachen der Leitung (/admin/events): Events und gemeldete Aktivitäten.
// App: components/admin/pages/AdminEventsPage.tsx mit admin/EventsView.tsx und
// admin/ActivityRequestsView.tsx. Web: components/admin/web/termine/
// (WebLeitungReiter, WebEventsTabelle, WebAntraege, WebMitmachenLeitung).
//
// Die Listen hinter den Zeitraum-Reitern rechnen beide Fassungen mit
// denselben Funktionen aus components/shared/eventFormatting.ts
// (aktuelleTermine, zuVerbuchendeTermine, vergangeneTermine); sie brauchen
// offene und abgesagte Events zugleich und stehen deshalb nicht als `passt`
// am einzelnen Reiter.

import { wahlen, zahlwort } from './beschreibung';

/** Die zwei Bereiche oben -- auch `?segment=` in der Adresse (Deep-Links der App). */
export const LEITUNG_BEREICHE = wahlen([
  { schluessel: 'events', label: 'Events', zahlText: zahlwort('Event wartet auf Verbuchung', 'Events warten auf Verbuchung') },
  // Simon, 06.10.2026: der Reiter mit den gemeldeten Aktivitäten heißt überall „Aktivitäten".
  { schluessel: 'antraege', label: 'Aktivitäten', zahlText: zahlwort('Antrag wartet auf Entscheidung', 'Anträge warten auf Entscheidung') },
]);
export const LEITUNG_BEREICHE_BESCHRIFTUNG = 'Bereiche von Mitmachen';

export const LEITUNG_EVENTS_TITEL = 'Events';
export const LEITUNG_EVENTS_UNTERTITEL = 'Gottesdienste, Konfi-Tage und Fahrten';

/** Die Zeiträume der Events -- auch `?filter=` in der Adresse. */
export const LEITUNG_ZEITRAUM = wahlen([
  { schluessel: 'aktuell', label: 'Aktuell', leer: 'Keine anstehenden Events' },
  { schluessel: 'verbuchen', label: 'Verbuchen', leer: 'Keine Events zum Verbuchen', zahlText: zahlwort('Event wartet auf Verbuchung', 'Events warten auf Verbuchung') },
  { schluessel: 'vergangen', label: 'Vergangen', leer: 'Keine vergangenen Events' },
  {
    schluessel: 'abgesagt', label: 'Abgesagt', leer: 'Keine abgesagten Events',
    nurIn: 'web',
    warum: 'In der App stehen abgesagte Events an ihrem Datum in Aktuell bzw. Vergangen (Simon, 16.09.2026); im Browser ist neben den Tabellen Platz für eine eigene Liste.',
  },
]);
export const LEITUNG_ZEITRAUM_BESCHRIFTUNG = 'Events nach Zeitraum';
export const LEITUNG_EVENTS_LEER_TITEL = 'Keine Events gefunden';

export const JAHRGANG_FILTER = { label: 'Jahrgang', alle: 'Alle Jahrgänge' } as const;

/**
 * Art der Events (nur im Browser, neben Jahrgang und Kategorie): Die App hat
 * unter den Reitern nur Suche und Jahrgang; die Tabelle im Browser hat Platz
 * für mehr Filter.
 */
export const LEITUNG_ART = wahlen([
  { schluessel: 'alle', label: 'Alle Arten' },
  { schluessel: 'pflicht', label: 'Pflicht-Events' },
  { schluessel: 'konfirmation', label: 'Konfirmation' },
  { schluessel: 'team', label: 'Nur Team' },
]);
export const KATEGORIE_FILTER = { label: 'Kategorie', alle: 'Alle Kategorien' } as const;

export const LEITUNG_ANTRAEGE_TITEL = 'Aktivitäten';
export const LEITUNG_ANTRAEGE_UNTERTITEL = 'Gemeldete Aktivitäten verwalten';

interface MitStatus { status: 'pending' | 'approved' | 'rejected' }

/**
 * Die Stände der gemeldeten Aktivitäten -- auch `?filter=` in der Adresse.
 * „Verbucht" statt „Genehmigt" (Entscheidung 28.08.2026).
 */
export const LEITUNG_ANTRAG_STATUS = wahlen([
  {
    schluessel: 'offen', label: 'Offen', leer: 'Keine Aktivitäten warten auf eine Entscheidung.',
    passt: (a: MitStatus) => a.status === 'pending',
    zahlText: zahlwort('Antrag wartet auf Entscheidung', 'Anträge warten auf Entscheidung'),
  },
  { schluessel: 'verbucht', label: 'Verbucht', leer: 'Noch keine Aktivität verbucht.', passt: (a: MitStatus) => a.status === 'approved' },
  { schluessel: 'abgelehnt', label: 'Abgelehnt', leer: 'Keine abgelehnte Aktivität.', passt: (a: MitStatus) => a.status === 'rejected' },
  {
    schluessel: 'alle', label: 'Alle', leer: 'Konfirmand:innen können Aktivitäten beantragen.',
    passt: () => true,
    nurIn: 'web',
    warum: 'Die App zeigt über den drei Reitern die Zahlen je Stand als Kacheln; im Browser stehen die Zahlen an den Chips, die Gesamtliste ist ein eigener Chip.',
  },
]);
export const LEITUNG_ANTRAG_STATUS_BESCHRIFTUNG = 'Aktivitäten nach Status';
export const LEITUNG_ANTRAEGE_LEER_TITEL = 'Keine Aktivitäten vorhanden';

/** Admin ohne zugewiesenen Jahrgang (Header X-Kein-Jahrgang-Zugewiesen, Entscheidung 31.08.2026). */
export const OHNE_JAHRGANG = {
  titel: 'Kein Jahrgang zugewiesen',
  text: 'Dir ist noch kein Jahrgang zugewiesen, deshalb siehst du keine Meldungen von Konfis. Die Gemeindeleitung kann das in den Einstellungen ändern.',
} as const;
