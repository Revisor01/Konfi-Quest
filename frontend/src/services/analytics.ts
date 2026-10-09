/**
 * Anonyme Nutzungsmessung (Umami, self-hosted auf t.godsapp.de).
 *
 * WAS ERFASST WIRD: ausschliesslich Ereignisse ohne Personenbezug — welcher
 * Bereich wurde geoeffnet, welche Funktion genutzt, wo bricht etwas ab. Dazu
 * die ROLLE (konfi/teamer/admin), damit sich die Zahlen nach Gruppe filtern
 * lassen.
 *
 * WAS NICHT ERFASST WIRD: keine Nutzer-ID, kein Name, kein Jahrgang, keine
 * Organisation, keine Beitragsinhalte, keine Chat-Nachrichten. Die Nutzenden
 * sind ueberwiegend minderjaehrig — die Zahlen sollen zeigen, was die App
 * taugt, nicht was einzelne Personen tun. Bewusst auch KEINE Organisation:
 * bei einer Gemeinde mit drei Teamern wäre das faktisch personenbezogen.
 *
 * Umami setzt keine Cookies und speichert keine IP-Adressen. Die Zuordnung
 * einer Sitzung passiert serverseitig über einen Hash aus IP-Adresse,
 * Browserkennung und einem Salz, das MONATLICH wechselt (Umami 3.4.0 ohne
 * SALT_ROTATION, Vorgabe "month"; nachgemessen 01.10.2026). Aus der
 * IP-Adresse leitet Umami zudem Land, Region und Stadt ab und speichert sie
 * zur Sitzung (30 Tage: 93,9 % mit Region, 92,4 % mit Stadt). So steht es
 * auch in der Datenschutzerklärung, Abschnitt 9a (Simon, 01.10.2026: Texte
 * richtigstellen statt Einstellung ändern).
 *
 * In der nativen App gibt es keine Domain, an der das Umami-Script hängen
 * könnte — deshalb sprechen wir die /api/send-Schnittstelle direkt an.
 *
 * ACHTUNG bei der Fehlersuche: Umami antwortet auf JEDE Anfrage mit HTTP 200,
 * verwirft sie aber still, wenn der User-Agent nicht nach einem echten Browser
 * aussieht (Bot-Filter). Ein erfolgreicher curl-Test ohne Browser-User-Agent
 * beweist also gar nichts — nachsehen, ob das Ereignis wirklich in
 * `website_event` steht. Aus der App heraus liefert der WebView einen echten
 * User-Agent, dort greift der Filter nicht (geprüft 10.08.2026).
 */

import { BEKANNTE_FEHLERTEXTE, ZUGELASSENE_SERVERTEXTE } from '../utils/bekannteFehlertexte';

const UMAMI_URL = 'https://t.godsapp.de/api/send';
const WEBSITE_ID = '72da966c-4b34-41f8-9dbe-e7fb7397f6d6';

// Rolle der aktuellen Sitzung. Wird beim Login gesetzt und ist die EINZIGE
// Eigenschaft, die etwas über die Person aussagt — bewusst grob gehalten.
let aktuelleRolle: string | null = null;

// Messung abschaltbar (z.B. Entwicklung), ohne alle Aufrufe anzufassen.
const AKTIV = import.meta.env.PROD;

export function setAnalyticsRole(roleName?: string | null): void {
  if (!roleName) { aktuelleRolle = null; return; }
  // Auf die drei bekannten Gruppen normalisieren; alles andere wird "sonstige",
  // damit keine selbst vergebenen Rollentitel aus einer Gemeinde durchsickern.
  const r = roleName.toLowerCase();
  aktuelleRolle = (r === 'konfi' || r === 'teamer' || r === 'admin' || r === 'org_admin')
    ? (r === 'org_admin' ? 'admin' : r)
    : 'sonstige';
}

/**
 * Ereignis melden. Schlaegt der Versand fehl (offline, Blocker, Server weg),
 * wird das still verworfen — Messung darf die App nie stoeren oder bremsen.
 */
/**
 * Gemeinsamer Sendeweg. keepalive: Die Anfrage geht auch dann noch raus,
 * wenn die App direkt danach in den Hintergrund wechselt.
 */
function sende(typ: 'event', nutzlast: Record<string, unknown>): void {
  try {
    fetch(UMAMI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: typ, payload: nutzlast }),
      keepalive: true
    }).catch(() => { /* Messung darf nie stoeren */ });
  } catch {
    /* Messung darf nie stoeren */
  }
}

export function track(ereignis: string, daten?: Record<string, string | number | boolean>): void {
  if (!AKTIV) return;

  sende('event', {
    website: WEBSITE_ID,
    name: ereignis,
    data: { ...(daten || {}), ...(aktuelleRolle ? { rolle: aktuelleRolle } : {}) },
    // Ohne Domain/URL ordnet Umami das Ereignis keiner Seite zu. Feste Werte
    // statt echter Routen: die Route kann Namen oder IDs enthalten.
    hostname: 'app.konfi-quest.de',
    url: '/app',
    language: 'de',
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`
  });
}

/**
 * Sitzungsbeginn als Seitenaufruf melden.
 *
 * WARUM DAS NOETIG IST: Umami zählt Besucher und Sitzungen ausschliesslich
 * über SEITENAUFRUFE. Wir haben anfangs nur benannte Ereignisse gesendet —
 * die kamen alle an, aber das Dashboard zeigte 0 Besucher und 0 Seitenaufrufe,
 * weil dort nichts zu zählen war (nachgesehen 11.08.: 130 Ereignisse, 0
 * Seitenaufrufe).
 *
 * WIE EIN SEITENAUFRUF GESENDET WIRD: als `type: 'event'` OHNE `name`.
 * Das ist der Unterschied — mit `name` wird daraus ein benanntes Ereignis
 * (event_type=2), ohne `name` ein Seitenaufruf (event_type=1). Ein
 * `type: 'pageview'` lehnt diese Umami-Version mit HTTP 400 ab; erlaubt sind
 * nur 'event', 'identify' und 'performance' (am Server geprüft 11.08.).
 *
 * Ein Aufruf je Sitzung genuegt; die Ereignisse hängen sich über die
 * Session daran. Bewusst dieselbe feste URL wie bei den Ereignissen — echte
 * Routen können Namen oder IDs enthalten.
 */
export function trackSitzungsstart(): void {
  if (!AKTIV) return;
  sende('event', {
    website: WEBSITE_ID,
    // KEIN `name` — genau das macht daraus einen Seitenaufruf.
    hostname: 'app.konfi-quest.de',
    url: '/app',
    language: 'de',
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    data: { ...(aktuelleRolle ? { rolle: aktuelleRolle } : {}), dunkel: istDunkelmodus() }
  });
}

/**
 * Steht das Geraet auf Dunkel? Die App folgt der Einstellung des Systems
 * (theme/variables.css, prefers-color-scheme) und hat keinen eigenen
 * Schalter -- deshalb genuegt die Medienabfrage (docs/messung/umami.md, S11).
 *
 * Bewusst NUR der Dunkelmodus: „Bewegung reduzieren", grosse Schrift oder
 * erhoehter Kontrast koennen auf eine Beeintraechtigung hindeuten
 * (Gesundheitsdaten) und werden nicht gelesen.
 */
export function istDunkelmodus(): boolean {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-color-scheme: dark)').matches === true;
  } catch {
    return false;
  }
}

/** Aufruf eines Bereichs (Tab, Hauptansicht). */
export function trackBereich(bereich: string): void {
  track('bereich-geoeffnet', { bereich });
}

/**
 * Erlaubte Form eines Bereichsnamens: Kleinbuchstaben und Bindestriche,
 * hoechstens 40 Zeichen. Alle Routen tragen an dieser Stelle einen festen
 * Namen; eine Kennung (`/konfi/42` aus einem alten Link, bevor die Umleitung
 * greift) faellt damit heraus, statt als Bereich im Dashboard zu stehen.
 */
const BEREICH_MUSTER = /^[a-z][a-z-]{0,39}$/;

/**
 * Bereichsname aus einem Pfad — nie die volle Route, die kann Kennungen
 * enthalten (/admin/konfis/42).
 *
 * Grundregel: der zweite Pfadteil (`/admin/konfis/42` -> `konfis`), bei
 * einteiligen Pfaden der erste (`/login`).
 *
 * Ausnahme Profil: Unterseiten des Profils zaehlen unter ihrem eigenen Namen.
 * Der Reiter „Material" des Teams liegt seit dem 04.09.2026 unter
 * `/teamer/profile/material` und zaehlte bis 27.09.2026 als `profile` —
 * Material-Aufrufe des Teams waren von Profil-Aufrufen nicht zu trennen
 * (docs/messung/umami.md, Befund B3). Dasselbe fuer `/teamer/profile/badges`.
 *
 * Liefert `null`, wenn der Name nicht die erlaubte Form hat — dann wird
 * nichts gemeldet.
 */
export function bereichAusPfad(pfad: string): string | null {
  const teile = pfad.split('/').filter(Boolean);
  const bereich = teile[1] === 'profile' && teile[2] ? teile[2] : (teile[1] || teile[0]);
  return bereich && BEREICH_MUSTER.test(bereich) ? bereich : null;
}

/**
 * Ansicht unter „Mitmachen" (Konfi und Team): Events oder Aktivitäten.
 *
 * Die Bereichsmessung in MainTabs zählt am PFAD. Events und Aktivitäten
 * liegen aber auf EINER Seite (/konfi/events, /teamer/events), umgeschaltet
 * über die Leiste „Events | Aktivitäten" -- jeder Besuch zählte als
 * „events" (Simon, 27.09.2026: „Activities hat heute nur 2, Events 235").
 * Deshalb meldet die Seite das Umschalten selbst. „activities" ist derselbe
 * Name wie die Aktivitäten-Seite der Leitung (/admin/activities), damit ein
 * Ziel im Dashboard beides zählt.
 */
export function trackMitmachenAnsicht(ansicht: 'events' | 'antraege'): void {
  trackBereich(ansicht === 'antraege' ? 'activities' : 'events');
}

/**
 * Platzhalter fuer `stelle`, wenn der Meldungstext nicht zu den bekannten
 * Texten gehoert — in der Regel ein Text vom Server, der Namen, Titel oder
 * Dateinamen enthalten kann (Befund B1, docs/messung/umami.md).
 */
export const STELLE_ANDERE_MELDUNG = 'andere-meldung';

/** Ziffernfolgen zu einem `#`, hoechstens 80 Zeichen. */
function entschaerft(text: string): string {
  return text.replace(/\d+/g, '#').slice(0, 80);
}

/**
 * Die einzigen Werte, die `stelle` je annehmen kann: die bekannten Texte in
 * entschaerfter Form und der Platzhalter. Eine feste, endliche Menge aus
 * Literalen des Quelltextes — was nicht darin steht, geht nicht raus.
 */
export const ERLAUBTE_STELLEN: ReadonlySet<string> = new Set([
  ...[...BEKANNTE_FEHLERTEXTE, ...ZUGELASSENE_SERVERTEXTE].map(entschaerft),
  STELLE_ANDERE_MELDUNG
]);

/**
 * `stelle` fuer die Messung: der Meldungstext, wenn er ein bekannter Text ist
 * (Ziffern zu `#`, gekuerzt), sonst der `ersatz` der Aufrufstelle, wenn DER
 * bekannt ist, sonst `andere-meldung`.
 *
 * WARUM eine Positivliste und keine Entschaerfung: Ein Name laesst sich nicht
 * herausrechnen — „Emilia Mustermann gehoert zu keinem Jahrgang dieses
 * Events" kam bis 27.09.2026 vollstaendig an. Deshalb gilt hier derselbe
 * Grundsatz wie bei den Merkmalen der Handlungen: Werte, die nicht aus dem
 * Code selbst stammen, nur ueber eine Positivliste.
 *
 * Verglichen wird die entschaerfte Form. Das aendert nichts an der Sperre:
 * Gesendet wird immer ein Element von ERLAUBTE_STELLEN, und jedes davon ist
 * ein Text aus dem Quelltext.
 */
export function fehlerStelle(meldung: string, ersatz?: string): string {
  const stelle = entschaerft(meldung);
  if (ERLAUBTE_STELLEN.has(stelle) && stelle !== STELLE_ANDERE_MELDUNG) return stelle;
  if (ersatz) {
    const ersatzStelle = entschaerft(ersatz);
    if (ERLAUBTE_STELLEN.has(ersatzStelle)) return ersatzStelle;
  }
  return STELLE_ANDERE_MELDUNG;
}

/**
 * Fehler, den die nutzende Person zu sehen bekommt.
 *
 * `stelle` ist die Meldung (das WAS) — aber nur, wenn sie zu den bekannten
 * Texten gehoert, siehe `fehlerStelle`. `art` ist die grobe Ursache (das
 * WARUM: `http-404`, `netz`, `timeout` …) und `ort` ein im Code fest
 * vergebenes Kuerzel (das WO). Alle drei sind bewusst grob und niemals
 * rueckfuehrbar — siehe `fehlerArt`/`ORT_MUSTER` unten.
 *
 * `stelle` wird HIER noch einmal gegen die Liste geprueft — die zweite
 * Sperre, falls jemand kuenftig an AppContext vorbei meldet. Ein Wert, den
 * `fehlerStelle` schon geliefert hat, kommt dabei unveraendert durch.
 */
export function trackFehler(stelle: string, art?: string, ort?: string): void {
  track('fehler', {
    stelle: fehlerStelle(stelle),
    ...(art ? { art } : {}),
    ...(ort ? { ort } : {})
  });
}

/**
 * Erlaubte Form eines Ort-Kuerzels: nur Kleinbuchstaben, Ziffern und
 * Bindestriche, hoechstens 40 Zeichen. Die Kuerzel stehen fest im Code
 * (`material-teamer-liste`, `chat-datei` …) und enthalten nie Daten aus einer
 * Antwort, einem Dateinamen oder einer Eingabe. Die Pruefung ist die zweite
 * Sperre: selbst wenn irgendwo versehentlich ein Dateiname durchgereicht
 * wuerde, faellt er hier raus statt bei Umami zu landen.
 */
const ORT_MUSTER = /^[a-z0-9-]{1,40}$/;

/** Erlaubte Werte fuer `art` — eine feste, kurze Liste. */
const ART_MUSTER = /^(http-[1-5][0-9]{2}|netz|timeout|abbruch|intern)$/;

export function istGueltigerOrt(ort: string): boolean {
  return ORT_MUSTER.test(ort);
}

export function istGueltigeArt(art: string): boolean {
  return ART_MUSTER.test(art);
}

/* ------------------------------------------------------------------ *
 * Nutzungstiefe: WAS wird in der App getan, nicht nur DASS jemand da war
 * ------------------------------------------------------------------ */

/**
 * Die Handlungen, die gezaehlt werden. Bewusst eine KURZE, feste Liste — sie
 * beantwortet die Frage, die eine Landeskirche vor einem Rollout stellt:
 * arbeiten Gemeinden wirklich mit der App, oder melden sich Leute nur an?
 *
 *  - `punkte-vergeben`      Die Kernhandlung der Leitung: eine Aktivitaet oder
 *                           Bonuspunkte bei einer Konfi verbucht.
 *  - `anwesenheit-erfasst`  Ein Termin wurde nachbereitet statt nur angelegt.
 *  - `beitrag-moderiert`    Jemand hat einen Challenge-Beitrag durchgesehen.
 *  - `termin-angelegt`      Die Gemeinde plant ihre Arbeit in der App.
 *  - `material-bereitgestellt` Inhalte fuer das Team eingestellt.
 *
 * Dazu, auf Simons Wunsch (27.09.2026; Bestand und Begruendung in
 * docs/messung/umami.md, U1–U3) — Handlungen im weiteren Sinn, deren Werte
 * ebenfalls aus Formularen oder Serverantworten stammen und deshalb dieselbe
 * Positivliste brauchen:
 *
 *  - `antrag-entschieden`   Die Leitung nimmt einen Antrag an oder lehnt ihn ab.
 *  - `material-angesehen`   Die Detailansicht eines Materials ist geoeffnet.
 *  - `material-abgerufen`   Eine Datei oder ein Link daraus ist geoeffnet.
 *  - `konfispruch-gespeichert` Ein Spruch aus den Vorschlaegen oder ein eigener.
 *                           Bewusst OHNE Bibelstelle: ein Konfirmationsspruch
 *                           ist oeffentlich und machte die Sitzung einer Konfi
 *                           wiedererkennbar (docs/messung/umami.md, S1).
 *
 * Dazu die Vorschlaege S2–S17 (Simon, 09.10.2026: „Go"; Bestand in
 * docs/messung/umami.md, Messpunkte). Nicht alle sind Arbeit im engen Sinn --
 * sie laufen trotzdem hier durch, weil ihre Werte ebenfalls aus Formularen,
 * Einstellungen oder Serverantworten stammen und deshalb dieselbe
 * Positivliste brauchen:
 *
 *  - `badge-angelegt`, `challenge-angelegt`  Gemeinden pflegen Eigenes.
 *  - `event-abgemeldet`     Abmeldung bzw. Absage, mit Pflicht-Kennzeichen.
 *  - `wrapped-angesehen`, `neuigkeiten-angesehen`  Beim Schliessen, mit
 *                           `bis_ende` -- „angesehen" ist keine Arbeit, aber
 *                           eine eigene Frage, kein Handlungszaehler.
 *  - `postfach-angesehen`, `mitteilung-angetippt`  Mit der ART der Mitteilung,
 *                           nie Inhalt, Event oder Name.
 *  - `push-gruppe-umgeschaltet`, `push-erlaubnis`  Push-Auswahl und -Erlaubnis.
 *  - `einladung-gesendet`, `einladung-beantwortet`  Nie die eingegebene Kennung.
 *  - `losung-bibel`         Uebersetzung der Tageslosung.
 *  - `suche-genutzt`        Einmal je Oeffnen der Seite, NIE der Suchbegriff.
 *
 * `nachgesendet: 'true'` (S14) traegt eine Handlung, die offline eingereiht
 * war und erst beim Nachsenden der Warteschlange gelungen ist
 * (services/nachgesendetMessung.ts).
 *
 * NICHT dabei und bewusst nicht: Chat-Nachrichten (Zahl sagt ueber die
 * paedagogische Nutzung nichts aus und liegt inhaltlich zu nah an den
 * Beteiligten), Jahresrueckblick-Aufrufe (wird an sechs Stellen geoeffnet,
 * "angesehen" ist keine Arbeit), Anmeldungen zu Terminen und
 * Challenge-Beitraege (werden bereits als `event-angemeldet` und
 * `challenge-beitrag` gezaehlt — nicht doppelt zaehlen).
 */
export type Handlung =
  | 'punkte-vergeben'
  | 'anwesenheit-erfasst'
  | 'beitrag-moderiert'
  | 'termin-angelegt'
  | 'material-bereitgestellt'
  | 'antrag-entschieden'
  | 'material-angesehen'
  | 'material-abgerufen'
  | 'konfispruch-gespeichert'
  | 'badge-angelegt'
  | 'challenge-angelegt'
  | 'event-abgemeldet'
  | 'wrapped-angesehen'
  | 'neuigkeiten-angesehen'
  | 'postfach-angesehen'
  | 'mitteilung-angetippt'
  | 'push-gruppe-umgeschaltet'
  | 'push-erlaubnis'
  | 'einladung-gesendet'
  | 'einladung-beantwortet'
  | 'losung-bibel'
  | 'suche-genutzt';

/** Kennzeichen einer offline eingereihten, spaeter nachgesendeten Handlung (S14). */
const NACHGESENDET = ['true'] as const;

/**
 * Arten der Mitteilungen im Postfach, so wie der Server sie schreibt
 * (backend/utils/postfachArten.js: POSTFACH_ARTEN und die vier Arten, die
 * ihre Routen selbst schreiben), Unterstrich als Bindestrich. Feste Liste
 * statt Muster: eine Art, die neu dazukommt, zaehlt ohne Merkmal, bis sie
 * hier steht. `messungVorschlaege.test.ts` vergleicht beide Listen.
 */
export const MITTEILUNGS_ARTEN = [
  'badge-earned',
  'new-activity-request',
  'activity-request-submitted',
  'activity-request-decision',
  'event-attendance',
  'bonus-points',
  'activity-assigned',
  'level-up',
  'challenge-badge-earned',
  'waitlist-promotion',
  'event-cancelled',
  'event-changed',
  'event-reactivated',
  'event-registered',
  'event-unregistered',
  'event-removed',
  'event-waitlisted',
  'challenge-submission-hidden',
  'event-unregistration',
  'teamer-event-booking',
  'teamer-event-cancellation',
  'events-pending-approval',
  'new-konfi-registration',
  'challenge-submission',
  'jahrgang-deletion-warning',
  'gemeinde-einladung',
  'event-opt-out',
  'event-opt-in',
  'gemeinde-einladung-beantwortet',
  'wrapped',
  'certificate'
] as const;

/**
 * Push-Gruppen des Servers (backend/utils/pushGruppen.js), Unterstrich als
 * Bindestrich; `alle` ist der Hauptschalter „Mitteilungen aufs Handy".
 */
export const PUSH_GRUPPEN = ['konfi-chat', 'konfi-termine', 'konfi-fortschritt', 'konfi-verwaltung', 'alle'] as const;

/**
 * Kuerzel der Tageslosung (BibleTranslationModal) -> Messwert. Dieselben
 * Namen wie beim Konfispruch, damit Luther hier wie dort `luther` heisst.
 */
const LOSUNG_BIBEL_MESSWERT: Record<string, string> = {
  LUT: 'luther',
  ELB: 'elberfelder',
  GNB: 'gute-nachricht',
  BIGS: 'bigs',
  NIV: 'niv',
  LSG: 'segond'
};

/** Messwert der Losungs-Uebersetzung; ein unbekanntes Kuerzel faellt heraus. */
export function losungBibelMesswert(code: string | null | undefined): string | undefined {
  return code ? LOSUNG_BIBEL_MESSWERT[code] : undefined;
}

/** Server-Schluessel (`event_cancelled`) -> Messwert (`event-cancelled`). */
export function serverSchluesselMesswert(schluessel: string | null | undefined): string | undefined {
  return typeof schluessel === 'string' ? schluessel.replace(/_/g, '-') : undefined;
}

/**
 * Sichtbarkeit einer Challenge (types/challenges.ts) -> Messwert, ASCII ohne
 * Unterstrich und ohne Umlaut-Umschreibung.
 */
export const CHALLENGE_SICHTBARKEIT_MESSWERT: Record<string, string> = {
  public: 'offen',
  konfi_choice: 'konfi-entscheidet',
  private: 'privat'
};

/**
 * Erlaubte Auspraegungen je Handlung. Diese Liste ist die harte Grenze: was
 * hier nicht steht, geht NICHT raus.
 *
 * WARUM eine Positivliste und kein Muster wie bei `ort`: Ein Muster laesst
 * jede Zeichenkette durch, die zufaellig aus Kleinbuchstaben besteht — ein
 * Aktivitaetsname ("gottesdienst-in-huesby"), ein Titel, ein Dateiname. Hier
 * werden aber Werte aus Formularen weitergereicht; da genuegt eine Formregel
 * nicht. Steht ein Wert nicht in der Liste, wird das Merkmal weggelassen —
 * das Ereignis selbst geht trotzdem raus, damit die Zaehlung stimmt.
 */
const ERLAUBTE_MERKMALE: Record<Handlung, Record<string, readonly string[]>> = {
  'punkte-vergeben': {
    // Aktivitaet aus der Liste oder frei vergebene Bonuspunkte.
    weg: ['aktivitaet', 'bonus'],
    // Punkteart des Jahrgangs. 'ohne' = Teamer-Aktivitaet ohne Punkteart.
    punkteart: ['gottesdienst', 'gemeinde', 'ohne'],
    nachgesendet: NACHGESENDET
  },
  'anwesenheit-erfasst': {
    // Einzeln abgehakt oder der ganze Termin auf einmal.
    umfang: ['einzeln', 'alle'],
    // Ob Konfis oder das Team verbucht wurden.
    gruppe: ['konfi', 'teamer']
  },
  'beitrag-moderiert': {
    entscheidung: ['freigegeben', 'ausgeblendet', 'wieder-sichtbar', 'anonymisiert']
  },
  'termin-angelegt': {
    // Einzeltermin oder Serie — zeigt, ob laufende Arbeit geplant wird.
    form: ['einzeln', 'serie'],
    zielgruppe: ['konfi', 'teamer'],
    nachgesendet: NACHGESENDET
  },
  'material-bereitgestellt': {
    inhalt: ['datei', 'link', 'beides', 'nur-text'],
    nachgesendet: NACHGESENDET
  },
  'antrag-entschieden': {
    entscheidung: ['angenommen', 'abgelehnt'],
    // Wer den Antrag gestellt hat — aus der Zielgruppe der Aktivitaet, nie
    // die Person. Kein Grund, keine Aktivitaet, keine Punktzahl.
    antrag_von: ['konfi', 'teamer'],
    nachgesendet: NACHGESENDET
  },
  'material-angesehen': {
    // Dieselben Werte wie beim Bereitstellen (materialInhalt), damit sich
    // Eingestelltes und Angesehenes nebeneinanderlegen lassen.
    inhalt: ['datei', 'link', 'beides', 'nur-text']
  },
  'material-abgerufen': {
    // Was geoeffnet wurde — nie Dateiname, Dateityp oder Adresse.
    inhalt: ['datei', 'link']
  },
  'konfispruch-gespeichert': {
    quelle: ['vorschlag', 'eigen'],
    bibel: ['luther', 'gute-nachricht', 'bigs', 'elberfelder']
  },
  // ---- S2–S17 (09.10.2026) ----
  'badge-angelegt': {
    zielgruppe: ['konfi', 'teamer'],
    nachgesendet: NACHGESENDET
  },
  'challenge-angelegt': {
    sichtbarkeit: ['offen', 'konfi-entscheidet', 'privat'],
    // Beitraege brauchen eine Freigabe (moderated).
    freigabe: ['true', 'false']
  },
  'event-abgemeldet': {
    // Pflicht-Event (Opt-out) oder freiwillige Anmeldung. Kein Grund, kein Event.
    pflicht: ['true', 'false'],
    nachgesendet: NACHGESENDET
  },
  'wrapped-angesehen': {
    art: ['konfi', 'team'],
    bis_ende: ['true', 'false']
  },
  'neuigkeiten-angesehen': {
    bis_ende: ['true', 'false']
  },
  'postfach-angesehen': {},
  'mitteilung-angetippt': {
    art: MITTEILUNGS_ARTEN
  },
  'push-gruppe-umgeschaltet': {
    gruppe: PUSH_GRUPPEN,
    an: ['true', 'false']
  },
  'push-erlaubnis': {
    ergebnis: ['erteilt', 'abgelehnt']
  },
  'einladung-gesendet': {
    // Feste Rollennamen, Unterstrich als Bindestrich -- nie die Kennung.
    rolle_ziel: ['konfi', 'teamer', 'admin', 'org-admin']
  },
  'einladung-beantwortet': {
    antwort: ['angenommen', 'abgelehnt']
  },
  'losung-bibel': {
    bibel: ['luther', 'elberfelder', 'gute-nachricht', 'bigs', 'niv', 'segond'],
    nachgesendet: NACHGESENDET
  },
  'suche-genutzt': {
    bereich: ['material', 'konfis', 'team']
  }
};

/**
 * Art des Material-Inhalts, fuer `material-bereitgestellt` und
 * `material-angesehen` aus derselben Hand.
 */
export function materialInhalt(
  hatDatei: boolean,
  hatLink: boolean
): 'datei' | 'link' | 'beides' | 'nur-text' {
  if (hatDatei && hatLink) return 'beides';
  if (hatDatei) return 'datei';
  if (hatLink) return 'link';
  return 'nur-text';
}

/**
 * Eine Handlung melden, die auf dem Server GELUNGEN ist.
 *
 * Aufrufregel: erst nach der erfolgreichen Antwort, nie beim Klick. Ein Klick,
 * der in einem Fehler endet, ist keine Nutzung — und wuerde die Zahlen genau
 * dort schoenen, wo sie ehrlich sein muessen.
 *
 * DATENSCHUTZ: Uebertragen werden ausschliesslich die Art der Handlung, die
 * groben Merkmale aus der Liste oben und die Rolle (haengt `track` an). Kein
 * Name, keine Kennung, kein Jahrgang, keine Gemeinde, kein Titel, kein
 * Dateiname, keine Punktzahl und keine Anzahl — bei einer Gemeinde mit drei
 * Teamer:innen waere schon eine Anzahl ein Fingerabdruck. Werte ausserhalb der
 * Liste werden verworfen, nicht gesendet.
 *
 * KEINE LAST: `track` sendet fire-and-forget mit `keepalive`; ein
 * fehlgeschlagener Versand wird still verworfen. Zusaetzlich faengt diese
 * Funktion jeden eigenen Fehler ab — ein kaputtes Merkmal darf niemals
 * verhindern, dass Punkte vergeben werden.
 */
export function trackHandlung(
  handlung: Handlung,
  merkmale?: Record<string, string | undefined | null>
): void {
  try {
    const erlaubt = ERLAUBTE_MERKMALE[handlung];
    // Unbekannte Handlung: gar nicht senden. Sonst waere jeder Tippfehler
    // ein neuer Ereignisname im Dashboard.
    if (!erlaubt) return;

    const gefiltert: Record<string, string> = {};
    for (const [schluessel, werte] of Object.entries(erlaubt)) {
      const wert = merkmale?.[schluessel];
      if (typeof wert === 'string' && (werte as readonly string[]).includes(wert)) {
        gefiltert[schluessel] = wert;
      }
    }

    track(handlung, gefiltert);
  } catch {
    /* Messung darf nie stoeren */
  }
}

/**
 * Die Uebersicht „Was ist neu?" nach dem Update ist geschlossen worden
 * (docs/messung/umami.md, S16). Gerufen von OnboardingTour ueber
 * `beimSchliessen`, nur aus den drei Aenderungsanzeigen -- nicht aus der
 * Begruessungstour beim ersten Start.
 */
export function trackNeuigkeitenAngesehen(bisEnde: boolean): void {
  trackHandlung('neuigkeiten-angesehen', { bis_ende: bisEnde ? 'true' : 'false' });
}

/**
 * Antwort auf die Push-Frage des Systems (docs/messung/umami.md, S9). Nur
 * gerufen, wenn die Frage wirklich gestellt wurde (Status `prompt`); ein
 * anderer Stand als erteilt/abgelehnt wird nicht gemeldet.
 */
export function trackPushErlaubnis(antwort: string | null | undefined): void {
  if (antwort === 'granted') trackHandlung('push-erlaubnis', { ergebnis: 'erteilt' });
  else if (antwort === 'denied') trackHandlung('push-erlaubnis', { ergebnis: 'abgelehnt' });
}
