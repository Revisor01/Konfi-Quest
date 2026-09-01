// Gemeinsame Datums-/Zeit-Formatierung für Events (zuvor in jeder Rolle
// dupliziert: Konfi/Admin/Teamer Views + DetailViews). Deutsche Locale.

// 14.06.2026
export const formatEventDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

// 18:30 (leere/ungueltige Eingaben -> '')
export const formatEventTime = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Sonntag, 14. Juni 2026
export const formatEventDateLong = (dateString: string): string =>
  new Date(dateString).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

// Befund N6 (27.08.2026): Ob ein Termin "vergangen" ist, wurde an ELF
// Stellen einzeln gerechnet -- und nur an einer davon richtig. Zehn nutzten
// allein `event_date` (den START), obwohl mehrtaegige Termine erst nach
// `event_end_time` vorbei sind.
//
// Folge: Bei einer Freizeit vom 10. bis 14. sagte die Konfi-Liste ab dem
// 11. noch "laeuft", die Detailansicht desselben Termins aber schon
// "vergangen" -- zwei Ansichten derselben Sache widersprachen sich.
//
// Die Begruendung stand bereits zweimal im Code (konfi/views/EventsView.tsx,
// admin/pages/AdminEventsPage.tsx), nur eben nicht an den anderen neun
// Stellen. Deshalb steht sie jetzt hier, einmal.

// Ende eines Termins: bei mehrtaegigen das Ende, sonst der Start.
export const eventEnde = (event: { event_date: string; event_end_time?: string | null }): Date =>
  new Date(event.event_end_time || event.event_date);

// Ist der Termin vorbei? Mehrtaegige erst NACH ihrem letzten Tag.
export const istVergangen = (
  event: { event_date: string; event_end_time?: string | null },
  jetzt: Date = new Date()
): boolean => eventEnde(event) < jetzt;

// Der Kalendertag eines Datums als 'JJJJ-MM-TT', in der Zone des Geraets.
//
// NICHT `toISOString().split('T')[0]` benutzen: Das liefert IMMER den
// UTC-Tag. Zwischen Mitternacht und 02:00 Berliner Sommerzeit ist das noch
// der Vortag -- ein Cache-Schluessel daraus zeigte die Losung von gestern,
// bis es zwei Uhr wurde. Dieselbe Falle war im Backend an neun Stellen
// (dort behoben mit `heuteBerlin()` in utils/zeitformat.js); die Anzeige zog
// nicht nach, deshalb wechselte die Tageslosung weiterhin erst um zwei.
//
// Absichtlich die GERAETEZONE und nicht fest Europe/Berlin: Der Schluessel
// soll dem Tag folgen, den die Nutzerin gerade sieht.
export const kalendertag = (datum: Date = new Date()): string => {
  const monat = String(datum.getMonth() + 1).padStart(2, '0');
  const tag = String(datum.getDate()).padStart(2, '0');
  return `${datum.getFullYear()}-${monat}-${tag}`;
};

// Wie viele KALENDERTAGE liegen zwischen heute und dem Zieltag?
// 0 = heute, 1 = morgen, -1 = gestern.
//
// Vorher rechnete das `Math.ceil(differenzInMillisekunden / 24h)`, also in
// 24-Stunden-Bloecken statt in Tagen. Ein Termin in einer Stunde ergab damit
// aufgerundet 1 -- und wurde als "Morgen" angezeigt, obwohl er heute ist.
// Der Zweig fuer "Heute" (=== 0) war so gut wie nie erreichbar: Er traf nur,
// wenn der Termin exakt jetzt begann. Ueber eine Sommerzeitumstellung hinweg
// verschob sich zusaetzlich alles um einen Tag, weil ein Kalendertag dort
// 23 oder 25 Stunden hat.
export const tageBis = (ziel: Date, jetzt: Date = new Date()): number => {
  const zielTag = new Date(ziel.getFullYear(), ziel.getMonth(), ziel.getDate());
  const heute = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
  // Ueber Mittag rechnen: Der Abstand zweier Mitternachte ist an einem
  // Umstellungstag keine ganze Zahl von Tagen, der zweier Mittage schon.
  const proTag = 1000 * 60 * 60 * 24;
  return Math.round((zielTag.getTime() - heute.getTime()) / proTag);
};

// "Heute" / "Morgen" / "3 Tage" / "2 Wochen" ... fuer einen kommenden Termin.
// Zuvor zweimal byte-gleich kopiert (Konfi-Dashboard, Teamer-Dashboard).
export const formatTimeUntil = (dateString: string | undefined): string => {
  if (!dateString) return '';
  const ziel = new Date(dateString);
  if (isNaN(ziel.getTime())) return '';

  const tage = tageBis(ziel);

  if (tage < 0) return 'Vorbei';
  if (tage === 0) return 'Heute';
  if (tage === 1) return 'Morgen';
  if (tage < 7) return `${tage} Tage`;
  if (tage < 14) return '1 Woche';
  if (tage < 21) return '2 Wochen';
  if (tage < 30) return `${Math.floor(tage / 7)} Wochen`;
  if (tage < 365) return `${tage} Tage`;
  const jahre = Math.floor(tage / 365);
  return `${jahre} Jahr${jahre > 1 ? 'e' : ''}`;
};
