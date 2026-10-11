// Ein kleiner Server fuer die gerenderten Tests des Badge-Formulars (App-Modal
// und Web-Dialog, 11.10.2026): Aktivitaeten je Zielgruppe, Kategorien, die
// Kriterientypen und einzelne Badges -- in der Form, in der backend/routes
// sie liefern (badges.js: GET /admin/badges/criteria-types, GET /admin/badges/:id).

export const AKTIVITAETEN_KONFI = [
  { id: 1, name: 'Sonntagsgottesdienst', type: 'gottesdienst' },
  { id: 3, name: 'Gemeindefest', type: 'gemeinde' },
  { id: 4, name: 'Kirchenchor', type: 'gemeinde' },
];

export const AKTIVITAETEN_TEAM = [
  { id: 90, name: 'Gruppenstunde', type: 'gemeinde' },
  { id: 91, name: 'Freizeitleitung', type: 'gemeinde' },
];

export const KATEGORIEN = [
  { id: 1, name: 'Gottesdienst' },
  { id: 2, name: 'Gemeinde' },
  { id: 5, name: 'Freizeit' },
];

/** Auszug aus CRITERIA_TYPES (backend/routes/badges.js), dieselbe Reihenfolge. */
export const KRITERIEN = {
  total_points: { label: 'Gesamtpunkte', description: 'Mindestanzahl aller Punkte', help: 'Badge wird vergeben, wenn die Summe aus Gottesdienst- und Gemeindepunkten erreicht wird.' },
  gottesdienst_points: { label: 'Gottesdienst-Punkte', description: 'Mindestanzahl gottesdienstlicher Punkte', help: 'Gottesdienst-Punkte erreicht.' },
  activity_count: { label: 'Aktivitäten & Events', description: 'Gesamtanzahl aller Aktivitäten und Events', help: 'Aktivitäten und Events zusammen.' },
  mandatory_event_count: { label: 'Pflicht-Anwesenheit', description: 'Anzahl besuchter Pflicht-Events', help: 'Nur Pflicht-Events zählen.' },
  specific_activity: { label: 'Spezifische Aktivität', description: 'Bestimmte Aktivität X-mal absolviert', help: 'Eine bestimmte Aktivität so oft.' },
  category_activities: { label: 'Kategorie-Aktivitäten', description: 'Aktivitäten & Events aus Kategorie', help: 'Aus einer Kategorie so oft.' },
  activity_combination: { label: 'Aktivitäts-Kombination', description: 'Spezifische Kombination von Aktivitäten', help: 'Aus der Liste so viele.' },
  category_combination: { label: 'Kategorie-Kombination', description: 'Aus wie vielen verschiedenen Kategorien war jemand dabei', help: 'Kreuze die Kategorien an, die in Frage kommen.' },
  time_based: { label: 'Zeitbasiert', description: 'Aktivitäten & Events im Zeitraum', help: 'So viele innerhalb der Wochen.' },
  streak: { label: 'Serie', description: 'Aufeinanderfolgende Wochen aktiv', help: 'Wochen in Folge.' },
  teamer_year: { label: 'Teamer-Jahre', description: 'Aktive Jahre als Teamer:in', help: 'So viele Jahre im Team.' },
};

export interface GespeichertesBadge {
  id: number;
  name: string;
  icon: string;
  description: string;
  criteria_type: string;
  criteria_value: number;
  criteria_extra: unknown;
  is_active: boolean;
  is_hidden: boolean;
  color: string;
  target_role: 'konfi' | 'teamer';
}

export const gespeichertesBadge = (teil: Partial<GespeichertesBadge> & { id: number }): GespeichertesBadge => ({
  name: 'Chorprobe',
  icon: 'musicalNote',
  description: 'Dreimal beim Kirchenchor',
  criteria_type: 'specific_activity',
  criteria_value: 3,
  // Wie aus der Datenbank: als Text, wie badges.js es liefert.
  criteria_extra: JSON.stringify({ required_activity_name: 'Kirchenchor' }),
  is_active: true,
  is_hidden: false,
  color: '#ffce00',
  target_role: 'konfi',
  ...teil,
});

/** Antwortet auf die Abrufe des Formulars; unbekannte Adressen scheitern laut. */
export function badgeServer(badges: GespeichertesBadge[]) {
  return (url: string) => {
    if (url === '/admin/activities?target_role=konfi') return Promise.resolve({ data: AKTIVITAETEN_KONFI });
    if (url === '/admin/activities?target_role=teamer') return Promise.resolve({ data: AKTIVITAETEN_TEAM });
    if (url === '/admin/categories') return Promise.resolve({ data: KATEGORIEN });
    if (url === '/admin/badges/criteria-types') return Promise.resolve({ data: KRITERIEN });
    const treffer = /^\/admin\/badges\/(\d+)$/.exec(url);
    if (treffer) {
      const badge = badges.find((b) => b.id === Number(treffer[1]));
      return badge ? Promise.resolve({ data: badge }) : Promise.reject({ response: { status: 404, data: { error: 'Badge nicht gefunden' } } });
    }
    return Promise.reject(new Error(`Unerwarteter Abruf: ${url}`));
  };
}
