// Der Weg zurueck aus einem Event zur Detailseite der Person, von der es
// geoeffnet wurde (Simon, Seiten-Interview 13.10.2026: „ein angeklicktes event
// führt ins event, zurück dann aber auf alle events -- geht das auch anders?
// also zurück ins profil?").
//
// Die Eventliste der Personenseite verlinkt `/admin/events/:id?person=:konfiId`.
// Die Eventseite liest den Parameter (ParamSeite reicht die Adresse als
// `abfrage` durch, components/layout/MainTabs.tsx) und fuehrt zurueck zu
// `/admin/konfis/:konfiId`, beschriftet mit dem Namen der Person. Ohne
// Parameter -- Liste, Push, Lesezeichen -- bleibt es bei „Alle Events".
// Dasselbe Muster wie `?filter=team` (zurueck in die Team-Liste) und `?mail=`
// im Support: Die Herkunft steht in der Adresse und uebersteht ein Neuladen.
//
// Der NAME steht nicht in der Adresse (Adressen landen in Verlauf, Lesezeichen
// und Server-Logs). Die Eventseite findet ihn unter den Teilnehmenden; damit
// er schon waehrend des Ladens dasteht, merkt sich die Personenseite ihn hier
// im Speicher der Sitzung.

/** Name des Parameters in der Adresse des Events. */
export const PERSON_PARAMETER = 'person';

/** Das Event mit dem Rueckweg zur Person. */
export const eventMitRueckweg = (eventId: number, personId: number): string =>
  `/admin/events/${eventId}?${PERSON_PARAMETER}=${personId}`;

/** Die Kennung der Person aus der Abfrage (`?person=9`); sonst null. */
export const personAusAbfrage = (abfrage: string | null | undefined): number | null => {
  if (!abfrage) return null;
  const wert = new URLSearchParams(abfrage).get(PERSON_PARAMETER);
  return wert !== null && /^[1-9]\d{0,15}$/.test(wert) ? Number(wert) : null;
};

const namen = new Map<number, string>();

/** Die Personenseite merkt sich den Namen, bevor sie in ein Event fuehrt. */
export const personNameMerken = (personId: number, name: string): void => {
  if (name.trim()) namen.set(personId, name.trim());
};

/** Der gemerkte Name der Person; null, wenn die Seite in dieser Sitzung nicht offen war. */
export const gemerkterPersonName = (personId: number): string | null => namen.get(personId) ?? null;

/** Nur fuer Tests: den Speicher leeren. */
export const gemerkteNamenVergessen = (): void => { namen.clear(); };

/**
 * Der Zurueck-Link der Eventseite: zur Person, wenn sie in der Abfrage steht,
 * sonst `null` (dann „Alle Events"). Der Name aus den Teilnehmenden geht vor
 * dem gemerkten; ohne beides „Zurück zum Profil".
 */
export const rueckwegZurPerson = (
  abfrage: string | null | undefined,
  nameAusTermin: (personId: number) => string | null | undefined,
): { href: string; text: string } | null => {
  const personId = personAusAbfrage(abfrage);
  if (personId === null) return null;
  const name = nameAusTermin(personId)?.trim() || gemerkterPersonName(personId);
  return { href: `/admin/konfis/${personId}`, text: name || 'Zurück zum Profil' };
};
