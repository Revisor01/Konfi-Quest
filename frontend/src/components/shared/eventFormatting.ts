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

// Kategorienamen eines Termins als ein Text ("Freizeit, Musik").
// Die Listen-Antwort (GET /events) liefert beides: categories[] aus dem
// Transform und category_names als fertigen String. Die Detail-Antwort
// kennt nur categories[]. Beide Formen werden hier bedient, damit die
// Karten unabhaengig davon funktionieren, aus welcher Route sie kommen.
export const kategorienText = (event: {
  categories?: Array<{ name: string }>;
  category_names?: string;
}): string => {
  if (event.categories && event.categories.length > 0) {
    return event.categories.map(c => c.name).join(', ');
  }
  return (event.category_names || '').trim();
};

// Zeigt der Termin ueberhaupt eine Punkteart an?
// Gleiche Regel wie im Detail (EventDetailSections, TeamerEventsPage,
// Konfi-EventDetailView): Bei Pflicht-, Konfirmations- und reinen
// Team-Terminen gibt es keine Konfi-Punkte -- dort stand sonst
// irrefuehrend "Gemeinde", obwohl niemand Punkte bekommt.
export const zeigtPunkteart = (event: {
  mandatory?: boolean;
  teamer_only?: boolean;
  is_konfirmation?: boolean;
  points?: number;
}): boolean =>
  !event.mandatory
  && !event.teamer_only
  && !event.is_konfirmation
  && (event.points || 0) > 0;

// Anzeigename der Punkteart. point_type (Gottesdienst/Gemeinde), NICHT
// type -- das ist die Event-Art (Termin vs. Aktivitaet) und war schon
// einmal die Ursache dafuer, dass ueberall "Gemeinde" stand.
export const punkteartText = (event: { point_type?: string }): string =>
  event.point_type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde';

/**
 * Ist dieser Termin abgesagt? (15.09.2026)
 *
 * ZWEI FELDER, WEIL ZWEI ROUTEN: GET /events/cancelled liefert
 * registration_status = 'cancelled' (fest gesetzt), die Detailansicht
 * zusaetzlich das Feld cancelled aus der Tabelle. Beide Listen laufen durch
 * dieselben Ansichten, und wer nur eines der beiden prueft, sieht den Termin
 * je nach Herkunft mal als abgesagt und mal nicht. Genau diese Doppelung
 * stand vorher an vier Stellen einzeln im Code.
 */
export const istAbgesagt = (
  event: { cancelled?: boolean; registration_status?: string } | null | undefined
): boolean => !!event && (event.cancelled === true || event.registration_status === 'cancelled');

/**
 * Streicht die Ansicht den Titel eines abgesagten Termins durch? (15.09.2026)
 *
 * NUR IN LISTEN UND AUF KACHELN, NICHT IM DETAIL -- und das ist eine
 * Entscheidung, keine Nachlaessigkeit:
 *
 * In einer Liste steht der Titel zwischen zwanzig anderen, alle gleich gross.
 * Das Eck-Badge ist klein und liegt am Rand; wer die Liste ueberfliegt, liest
 * die Titelspalte und sonst nichts. Der Durchstrich ist dort das einzige
 * Zeichen, das im Vorbeilesen ankommt.
 *
 * In der Detailansicht steht der Titel gross und allein, darunter sagt der
 * Kopf "Abgesagt" im Klartext, die Farbe ist danger, und unmittelbar darunter
 * steht der Absagegrund in einem roten Kasten. Vier Aussagen ueber dieselbe
 * Sache; eine fuenfte in Form eines durchgestrichenen Ueberschrift-Titels
 * traegt nichts bei und liest sich wie geloeschter Text statt wie ein
 * ausgefallener Termin.
 *
 * Die Funktion existiert, damit diese Entscheidung an EINER Stelle steht und
 * nicht sieben Ansichten jeweils fuer sich entscheiden -- genau das war der
 * Zustand bis zum 15.09.2026: Leitung und Konfi strichen in der Liste durch,
 * das Team nicht, und im Detail strich keine der drei durch, ohne dass
 * irgendwo stand, ob das Absicht war.
 */
export const streichtDurch = (
  ort: 'liste' | 'detail' | 'kachel',
  event: { cancelled?: boolean; registration_status?: string } | null | undefined
): boolean => ort !== 'detail' && istAbgesagt(event);

/**
 * Die Textdekoration fuer den Titel -- fertig zum Einsetzen in style.
 * Spart den Dreisatz an jeder Aufrufstelle und macht im Test pruefbar, dass
 * alle Listen dieselbe Quelle benutzen.
 */
export const titelDekoration = (
  ort: 'liste' | 'detail' | 'kachel',
  event: { cancelled?: boolean; registration_status?: string } | null | undefined
): 'line-through' | 'none' => (streichtDurch(ort, event) ? 'line-through' : 'none');

/**
 * Sortiert abgesagte Termine ans ENDE, sonst bleibt die Reihenfolge wie sie
 * ist (der Server liefert nach event_date aufsteigend). 15.09.2026.
 *
 * WARUM DAS KONFI-REITER "ALLE" DAS BRAUCHT: Dort stehen die anmeldbaren
 * Termine. Ein abgesagter ist der einzige darunter, bei dem Tippen zu nichts
 * fuehrt -- er mischte sich aber nach Datum zwischen die anderen, und wer die
 * Liste von oben durchgeht, laeuft mitten im Anmelden in eine Sackgasse.
 *
 * WARUM NICHT AUSBLENDEN: Die Konfi-Liste zeigt einen abgesagten Termin
 * ueberhaupt nur, wenn sie selbst dafuer gebucht war (backend/routes/konfi.js:
 * `e.cancelled IS NOT TRUE OR eb_konfi.id IS NOT NULL`). Er geht sie also an
 * -- sie hat sich angemeldet und muss sehen, dass er ausfaellt. Ihn hier zu
 * verstecken hiesse, die Absage vor genau der Person zu verbergen, die
 * betroffen ist.
 *
 * WARUM KEIN EIGENER ABSCHNITT: Ein vierter Abschnitt fuer im Schnitt einen
 * Eintrag kostet mehr Platz und Erklaerung, als er einspart. Am Ende der
 * Liste, durchgestrichen und mit dem roten Eck-Badge, ist er zu finden und
 * steht niemandem im Weg.
 *
 * Stabil: Bei gleicher Absage-Lage bleibt die Serverreihenfolge erhalten
 * (Array.prototype.sort ist seit ES2019 stabil).
 */
export const abgesagteAnsEnde = <T extends { cancelled?: boolean; registration_status?: string }>(
  a: T,
  b: T
): number => Number(istAbgesagt(a)) - Number(istAbgesagt(b));

// --- Die drei Reiter der Leitungs-Terminliste ---------------------------
//
// Die Aufteilung steht hier und nicht in AdminEventsPage, damit sie sich
// ohne die halbe Seite pruefen laesst.
//
// `offen` sind die nicht abgesagten Termine (GET /events, der Client filtert
// registration_status === 'cancelled' heraus), `abgesagt` die aus
// GET /events/cancelled (e.cancelled = TRUE). Die beiden Mengen sind
// komplementaer -- derselbe Termin kann nie in beiden stehen.

interface ReiterTermin {
  event_date: string;
  event_end_time?: string | null;
  pending_bookings_count?: number;
  registration_status?: string;
}

const hatOffeneBuchungen = (event: ReiterTermin): boolean =>
  !!event.pending_bookings_count && event.pending_bookings_count > 0;

const nachDatumAufsteigend = <T extends ReiterTermin>(a: T, b: T) =>
  new Date(a.event_date).getTime() - new Date(b.event_date).getTime();

const nachDatumAbsteigend = <T extends ReiterTermin>(a: T, b: T) =>
  new Date(b.event_date).getTime() - new Date(a.event_date).getTime();

// Reiter "Aktuell": alles, was noch laeuft oder bevorsteht -- ABGESAGTE
// EINGESCHLOSSEN. Sie stehen dort durchgestrichen; verschwaenden sie ganz,
// saehe die Leitung nicht mehr, dass der Termin existierte und abgesagt
// wurde (Fund 22.08.2026).
export const aktuelleTermine = <T extends ReiterTermin>(offen: T[], abgesagt: T[]): T[] =>
  [...offen, ...abgesagt].filter(e => eventEnde(e) >= new Date()).sort(nachDatumAufsteigend);

// Reiter "Verbuchen": beendete Termine mit offenen Buchungen. Abgesagte
// gehoeren bewusst NICHT dazu -- an einem abgesagten Termin gibt es nichts
// zu verbuchen.
export const zuVerbuchendeTermine = <T extends ReiterTermin>(offen: T[]): T[] =>
  offen
    .filter(e => eventEnde(e) < new Date() && hatOffeneBuchungen(e) && e.registration_status !== 'cancelled')
    .sort(nachDatumAbsteigend);

// Reiter "Vergangen": beendete Termine ohne offene Buchungen (fertig
// verbucht), plus ALLE bereits beendeten abgesagten Termine.
//
// Der Filter auf offene Buchungen gilt nur fuer die nicht abgesagten. Eine
// Absage laesst die Buchungen auf 'confirmed' stehen (backgroundService.js),
// ein abgesagter Termin behaelt also seinen pending_bookings_count. Wurde er
// mitgefiltert, fiel er hier heraus -- und weil "Verbuchen" abgesagte
// ausschliesst und "Aktuell" ihn nach dem Enddatum loslaesst, stand er in
// KEINEM Reiter mehr (Fund 15.09.2026).
export const vergangeneTermine = <T extends ReiterTermin>(offen: T[], abgesagt: T[]): T[] => {
  const jetzt = new Date();
  const verbucht = offen.filter(e => eventEnde(e) < jetzt && !hatOffeneBuchungen(e));
  const abgesagtVorbei = abgesagt.filter(e => eventEnde(e) < jetzt);
  return [...verbucht, ...abgesagtVorbei].sort(nachDatumAbsteigend);
};
