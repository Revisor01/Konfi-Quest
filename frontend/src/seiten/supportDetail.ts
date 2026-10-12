// Die Texte der Detailseiten des Supports: Vorgang, Anfrage und Mail
// (docs/planung/support-detailseiten.md). App und Browser zeigen dieselben
// Sätze; die Regeln, welcher Satz wann gilt, stehen in utils/supportVorgaenge.ts
// (vorgangStand, vorgangAngaben, vorgangKennzahlen, einordnen…),
// utils/supportMail.ts (mailStand) und utils/lizenzAendern.ts.
//
// Rückfragen zum Löschen und Ablehnen gibt es je EINMAL (bis 11.10.2026 zwei
// Fassungen je Seite). Die Stand-Sätze nennen nur Tatsachen und geben keinen
// Befehl -- Antworten und Einordnen sind immer erreichbar.

import { wahlen } from './beschreibung';
import type { StandAktion } from '../utils/supportVorgaenge';

/** Der Satz zum Stand eines Vorgangs, je Fall der Stand-Regel. */
export const STAND_TEXT = {
  /** 1a: Anfrage angelegt. */
  angelegt: (datum: string, benutzer: string | null): string =>
    `Gemeinde angelegt am ${datum}.${benutzer ? ` Benutzername der Gemeindeleitung: ${benutzer} – Benutzername und Passwort getrennt weitergeben.` : ''}`,
  /** 1b: Anfrage abgelehnt (Archiv). */
  abgelehnt: (datum: string): string =>
    `Anfrage abgelehnt am ${datum}. Sie wird nach 180 Tagen gelöscht; Wiederherstellen holt sie zurück.`,
  /** 1c: erledigt. */
  erledigt: (datum: string): string => `Erledigt am ${datum}. Eine neue Mail holt ihn zurück.`,
  /** 1c: archiviert, ohne erledigt zu sein. */
  archiv: (datum: string): string => `Im Archiv seit ${datum}. Eine neue Mail holt ihn zurück.`,
  /** 2: kein Antwortweg. */
  keinWeg: (formularGemeinde: string | null): string =>
    `Niemand, dem sich antworten ließe: keine Gemeinde, kein Kontakt.${formularGemeinde ? ` Laut Formular: ${formularGemeinde}.` : ''}`,
  /** 3: Die jüngste Nachricht kam von außen. */
  wartetAufUns: (wer: string, seit: string): string => `${wer} wartet seit ${seit} auf Antwort.`,
  /** 4: Anfrage anlegbar, der Support schrieb zuletzt. */
  anlegenOderAblehnen: (zeit: string): string => `Support hat ${zeit} geantwortet. Anlegen oder ablehnen?`,
  /** 5: Status „Wartet". Ab 7 Tagen mit „nachfassen?". */
  wartetAuf: (seit: string, wer: string, nachfassen: boolean): string =>
    `Wartet seit ${seit} auf ${wer}${nachfassen ? ' – nachfassen?' : '.'}`,
  /** 6: Der Support schrieb zuletzt. */
  geantwortet: (konto: string | null, zeit: string): string => `Support${konto ? ` (${konto})` : ''} hat ${zeit} geantwortet.`,
  /** 6 ohne jede Nachricht (vom Support angelegt, noch nichts geschrieben). */
  ohneNachricht: (zeit: string, wer: string | null): string =>
    `${wer ? `Angelegt von ${wer}` : 'Angelegt'} ${zeit}, noch ohne Nachricht.`,
  /** Fall 5: auf wen gewartet wird, wenn niemand bekannt ist. */
  rueckmeldung: 'eine Rückmeldung',
  /** Fall 3: wer wartet, wenn weder Name noch Adresse bekannt sind. */
  jemand: 'Jemand',
} as const;

/** Beschriftung und Tooltip je Aktion des Stands -- in App und Browser gleich. */
export const AKTION_TEXT: Readonly<Record<StandAktion, { label: string; titel: string }>> = {
  antworten: { label: 'Antworten', titel: 'Antwort schreiben' },
  erledigt: { label: 'Erledigt', titel: 'Als erledigt ins Archiv legen' },
  gemeinde_anlegen: { label: 'Gemeinde anlegen', titel: 'Gemeinde und erste Gemeindeleitung aus der Anfrage anlegen' },
  gemeinde_oeffnen: { label: 'Gemeinde öffnen', titel: 'Die angelegte Gemeinde öffnen' },
  wiederherstellen: { label: 'Wiederherstellen', titel: 'Aus dem Archiv holen – Status „In Arbeit“' },
  gemeinde_zuordnen: { label: 'Gemeinde zuordnen', titel: 'Den Vorgang einer Gemeinde zuordnen' },
  ablehnen: { label: 'Ablehnen', titel: 'Anfrage ablehnen' },
  lizenz_aendern: { label: 'Lizenz ändern', titel: 'Tarif und Laufzeit der Gemeinde ändern' },
};

/** Die Marken neben dem Status (Kennzeichen im Browser, Stand-Karte in der App). */
export const MARKEN_TEXT = {
  dringend: 'Dringend',
  bereichFehlt: 'Bereich fehlt',
  keineGemeinde: 'Keine Gemeinde',
  nichtAngelegt: 'Noch nicht angelegt',
  /** In Listenzeilen statt der Gemeinde, wenn keine zugeordnet ist (bei einer Anfrage: nichtAngelegt). */
  nichtZugeordnet: 'Nicht zugeordnet',
} as const;

/** Die Rückfrage vor dem Löschen eines Vorgangs -- ein Text für App und Web. */
export const LOESCHEN_RUECKFRAGE = (betreff: string, mitAnfrage: boolean): { header: string; message: string } => ({
  header: 'Vorgang löschen',
  message: `„${betreff}“ wird mit seinen Mails in Konfi Quest${mitAnfrage ? ' und der Anfrage' : ''} gelöscht. Im Postfach selbst bleibt alles stehen. Das lässt sich nicht rückgängig machen.`,
});

/**
 * Die Rückfrage vor dem Ablehnen einer Anfrage -- ein Text für App und Web.
 * Dahinter steht PATCH { status: 'erledigt' }: Der Server lehnt die Anfrage
 * dann ab (backend/utils/supportVorgaenge.js, statusSetzen); Wiederherstellen
 * holt beides zurück.
 */
export const ABLEHNEN_RUECKFRAGE = {
  header: 'Anfrage ablehnen?',
  message: 'Der Vorgang wird erledigt und archiviert, die Anfrage gilt als abgelehnt und wird nach 180 Tagen gelöscht. Eine Absage-Mail geht dabei nicht hinaus. Wiederherstellen holt beides zurück.',
  knopf: 'Ablehnen',
} as const;

/**
 * Im Browser, bevor ein Abschluss (Erledigt, Archivieren, Ablehnen) den
 * nächsten Eintrag öffnet: Was im Editor oder in der Notiz steht, ginge
 * verloren. Dieselben Worte wie die Rückfrage der App-Fenster.
 */
export const ENTWURF_RUECKFRAGE = {
  header: 'Ungespeicherte Änderungen',
  message: (was: { antwort: boolean; notiz: boolean }): string => (was.antwort && was.notiz
    ? 'Antwort und Notiz sind noch nicht gespeichert. Möchtest du sie verwerfen?'
    : was.antwort
      ? 'Die Antwort ist noch nicht gesendet. Möchtest du sie verwerfen?'
      : 'Die Notiz ist noch nicht gespeichert. Möchtest du sie verwerfen?'),
  abbrechen: 'Abbrechen',
  verwerfen: 'Verwerfen',
} as const;

/** „Danach": der Status nach dem Senden einer Antwort (Simon, 11.10.2026: Frage 3). */
export const DANACH_WAHLEN = wahlen([
  { schluessel: 'wartet', label: 'Wartet auf Rückmeldung', kurz: 'Wartet' },
  { schluessel: 'in_arbeit', label: 'In Arbeit' },
  { schluessel: 'erledigt', label: 'Erledigt' },
]);
export const DANACH_BESCHRIFTUNG = 'Danach';

/** Gesendet, aber der Status ließ sich nicht setzen -- nie Stille. */
export const DANACH_FEHLER = 'Gesendet, Status nicht gesetzt.';

/** Einordnen: die Hinweise beim Status und die Prüfungen. */
export const EINORDNEN_TEXT = {
  /** Erledigt an einer Anfrage, die noch nicht angelegt ist: Der Server lehnt sie dabei ab. */
  erledigtAnfrage: 'Erledigt lehnt die Anfrage ab; sie wird nach 180 Tagen gelöscht.',
  bereichFehlt: 'Bitte einen Bereich wählen',
  betreffFehlt: 'Bitte einen Betreff eingeben',
  betreffLang: (max: number): string => `Der Betreff darf höchstens ${max} Zeichen haben`,
} as const;

/** Eine Mail im Archiv des Posteingangs. Einsortieren holt sie selbst heraus (backend/utils/supportVorgaenge.js). */
export const MAIL_ARCHIV_SATZ = (datum: string): string =>
  `Im Archiv seit ${datum} · wird nach 180 Tagen gelöscht · Einsortieren holt sie zurück.`;

/** Das Menü (···) an einer Mail im Vorgang. */
export const MAIL_MENUE = {
  verschieben: 'In anderen Vorgang verschieben',
  herausloesen: 'In neuen Vorgang herauslösen',
  kopfzeilen: 'Kopfzeilen zeigen',
} as const;

/**
 * Was beim Einsortieren mitgeht (backend/routes/supportMail.js, einsortieren):
 * Aus dem Posteingang geht der Faden mit, soweit er noch dort liegt; eine
 * Mail aus einem Vorgang geht allein.
 */
export const EINSORTIEREN_HINWEIS = {
  faden: 'Die Mails desselben Gesprächs, die noch im Posteingang liegen, gehen mit.',
  allein: 'Nur diese Mail wird verschoben; der Rest des Vorgangs bleibt, wo er ist.',
} as const;

/** Der flache Verlauf (utils/mailGespraeche.ts, verlaufReihe). */
export const VERLAUF_TEXT = {
  /** Ausgehende Mails heißen einheitlich so; das Konto steht klein daneben. */
  support: 'Support',
  /** Der Kreis vor ausgehenden Mails. */
  supportKreis: 'KQ',
  nachrichten: (anzahl: number): string => (anzahl === 1 ? '1 Nachricht' : `${anzahl} Nachrichten`),
  neu: (anzahl: number): string => `${anzahl} neu`,
  marke: { formular: 'Formular', anfrage: 'Anfrage' },
  // --- Der Baustein MailGespraeche (Stufe verlauf, 11.10.2026) ---
  /** Name des Anfangs für Vorleseprogramme, je Marke. */
  anfangBeschriftung: { Formular: 'Anliegen aus dem Formular', Anfrage: 'Nachricht aus der Anfrage' },
  ganzLesen: 'ganz lesen',
  kuerzer: 'kürzer',
  alleAuf: 'Alle aufklappen',
  alleZu: 'Alle einklappen',
  /** Ab drei eingeklappten Mails in Folge. */
  stapel: (anzahl: number): string => `${anzahl} frühere Mails`,
  anhaenge: (anzahl: number): string => (anzahl === 1 ? '1 Anhang' : `${anzahl} Anhänge`),
  /** Antwortet eine Mail nicht auf die direkt davor. */
  antwortAuf: (name: string, zeit: string): string => `Antwort auf ${name}, ${zeit}`,
  /** Der Kern des Betreffs, wenn er vom Titel abweicht. */
  betreff: (kern: string): string => `Betreff: ${kern}`,
  gesendet: 'Gesendet',
  markeNeu: 'Neu',
  an: (liste: string): string => `An ${liste}`,
  ohneEmpfaenger: 'Ohne Empfänger',
  vonPostfach: (postfach: string): string => `von ${postfach}`,
  ohneText: 'Ohne Text',
  unbekannt: 'Unbekannt',
  mitAnhang: 'mit Anhang',
  /** Das Menü (···) an einer offenen Mail. */
  menue: (wer: string): string => `Aktionen zur Mail von ${wer}`,
  kopfzeilenAus: 'Kopfzeilen ausblenden',
  kopfzeilen: 'Kopfzeilen',
  kopf: { von: 'Von', an: 'An', betreff: 'Betreff', datum: 'Datum', messageId: 'Message-ID', antwortAuf: 'In-Reply-To', referenzen: 'References' },
} as const;

/** Die drei Zahlen über einem Vorgang oder einer Mail. */
export const KENNZAHL_TEXT = {
  mails: 'Mails',
  neu: 'Neu',
  tage_offen: 'Tage offen',
  konfis: 'Konfis',
  teamer: 'Teamer:innen',
  anhaenge: 'Anhänge',
} as const;

/** Bei genau 1 die Einzahl („1 Mail", „1 Tag offen"); „Neu" bleibt. */
const KENNZAHL_EINZAHL: Partial<Record<keyof typeof KENNZAHL_TEXT, string>> = {
  mails: 'Mail',
  tage_offen: 'Tag offen',
  konfis: 'Konfi',
  teamer: 'Teamer:in',
  anhaenge: 'Anhang',
};

/** Die Beschriftung einer Kennzahl zu ihrer Zahl (ohne Zahl die Mehrzahl). */
export const kennzahlLabel = (schluessel: keyof typeof KENNZAHL_TEXT, zahl: number | null): string =>
  (zahl === 1 ? KENNZAHL_EINZAHL[schluessel] ?? KENNZAHL_TEXT[schluessel] : KENNZAHL_TEXT[schluessel]);

/** Die Karten und Zeilen der Angaben (vorgangAngaben). */
export const ANGABEN_TEXT = {
  karte: { lizenz: 'Lizenz', anfrage: 'Anfrage', kontakt: 'Kontakt', gemeinde: 'Gemeinde' },
  person: 'Person',
  email: 'E-Mail',
  mobil: 'Mobil',
  eingang: 'Eingang',
  angelegtVon: 'Angelegt von',
  gemeinde: 'Gemeinde',
  kreis: 'Kreis',
  wunsch: 'Wunsch',
  laufzeit: 'Laufzeit',
  konfis: 'Konfis',
  tarif: 'Tarif',
  wunschAnmeldung: 'Wunsch bei der Anmeldung',
  zugang: 'Zugang',
  gesperrt: 'Gesperrt',
  keineEmail: 'Keine E-Mail',
  angefragt: (gemeinde: string): string => `${gemeinde} (angefragt)`,
  nichtZugeordnet: (formular: string | null): string => `Nicht zugeordnet${formular ? ` – laut Formular: ${formular}` : ''}`,
  zuordnen: 'Zuordnen',
  imVorgangAntworten: 'Im Vorgang antworten',
  kreisInStruktur: 'steht in der Struktur',
  kreisFehlt: 'fehlt noch',
  kirchenkreisAnlegen: 'Als Kirchenkreis anlegen',
  wunschOffen: 'Noch offen',
  /** Wie der Tarif („Standard — bis 50 Konfis · 99 € pro Jahr"), mit geschütztem Leerzeichen vor „€". */
  wunschMitPreis: (text: string, euro: number): string => `${text} · ${euro}\u00a0€ pro Jahr`,
  entsprichtTarif: 'entspricht dem Tarif',
  konfisOhneLimit: (anzahl: number): string => `${anzahl} · ohne Limit`,
  konfisVon: (anzahl: number, limit: number): string => `${anzahl} von ${limit}`,
  zuletztAngemeldet: (datum: string): string => `zuletzt angemeldet ${datum}`,
  nochNichtAngemeldet: 'noch nicht angemeldet',
  gemeindeOeffnen: 'Gemeinde öffnen',
  alleVorgaenge: 'Alle Vorgänge',
  gemeindeFehlt: 'Die Angaben der Gemeinde fehlen.',
  eingangHerkunft: {
    anfrage: 'Anfrage über die Homepage',
    formular: 'Support-Formular auf der Homepage',
    mail: (postfach: string | null): string => (postfach ? `Mail an ${postfach}` : 'Mail'),
    support: 'Vom Support angelegt',
  },
} as const;

/** Der Vorgang „Lizenz und Abrechnung": Karte, Zusatzzeile, Dialog „Lizenz ändern". */
export const LIZENZ_TEXT = {
  titel: 'Lizenz',
  aendern: 'Lizenz ändern',
  /** Die Aktion der Karte. */
  kartenAktion: 'Ändern',
  /** Tooltip der gesperrten Aktion ohne Gemeinde. */
  ohneGemeindeGesperrt: 'Erst eine Gemeinde zuordnen',
  wunschUebernehmen: (name: string): string => `Wunschlizenz übernehmen: ${name}`,
  teilGespeichert: 'Tarif gespeichert, Laufzeit nicht – bitte erneut speichern.',
  gespeichert: (text: string): string => `Lizenz geändert: ${text}`,
  /**
   * Eine gesperrte Gemeinde (etwa nach Ablauf, backgroundService) bleibt
   * gesperrt: „Lizenz ändern" schreibt is_active, wie es ist. Ob der Dialog
   * sie selbst freigeben soll, entscheidet Simon (offene-befunde.md).
   */
  bleibtGesperrt: 'Der Zugang der Gemeinde bleibt gesperrt – freigeben lässt er sich im Formular der Gemeinde.',
  formularLink: 'Alle Angaben der Gemeinde bearbeiten',
  /** Der Teil „Laufzeit" ist gesperrt, wenn GET /organizations/:id keine lesbare Gemeinde liefert. */
  stammFehlt: 'Die Laufzeit lässt sich hier gerade nicht ändern – bitte im Formular der Gemeinde.',
  testphaseSchalter: 'Testphase (Hinweis auf den Startseiten)',
  felder: { tarif: 'Tarif', eigenesLimit: 'Eigenes Limit…', limitZahl: 'Konfi-Limit', laufzeit: 'Laufzeit', datum: 'Enddatum' },
  /** Tarife, die nicht aus der Liste der Lizenzen kommen (utils/lizenzen.ts, TARIF_OPTIONEN). */
  tarif: {
    testphase: (name: string, konfis: number): string => `${name} — bis ${konfis} Konfis · kostenlos`,
    eigenName: 'Eigenes Limit',
    eigen: (konfis: number): string => `Eigenes Limit — ${konfis} Konfis`,
  },
  laufzeit: {
    unveraendert: (heute: string): string => `Unverändert (${heute})`,
    jahrAbHeute: (bis: string): string => `1 Jahr ab heute (bis ${bis})`,
    jahrAbEnde: (bis: string): string => `1 Jahr ab Laufzeitende (bis ${bis})`,
    testphase: (bis: string): string => `30 Tage Testphase (bis ${bis})`,
    unbegrenzt: 'Unbegrenzt',
    datum: 'Eigenes Datum…',
  },
  fehler: {
    limit: 'Das Konfi-Limit muss eine ganze Zahl ab 1 sein',
    datum: 'Bitte ein Enddatum wählen',
  },
  /** Zusatzzeile im Stand: nur Namen, die Zahlen stehen in der Karte. */
  heute: (lizenz: string): string => `Lizenz heute: ${lizenz}`,
  bis: (datum: string): string => `bis ${datum}`,
  abgelaufen: (datum: string): string => `abgelaufen am ${datum}`,
  testphaseHinweis: 'Testphase',
  gewuenscht: (name: string): string => `bei der Anmeldung gewünscht: ${name}`,
  gesperrt: 'Zugang gesperrt',
  ohneGemeinde: (formular: string | null): string =>
    `Die Lizenz lässt sich erst ändern, wenn eine Gemeinde zugeordnet ist${formular ? ` – laut Formular: ${formular}` : ''}.`,
  /** Vorschau im Dialog. */
  danach: (tarif: string, laufzeit: string): string => `Danach: ${tarif} · ${laufzeit}${laufzeit.endsWith('.') ? '' : '.'}`,
  laufzeitUnbegrenzt: 'Laufzeit unbegrenzt',
  /** Mehr Konfis als das neue Limit (backend/utils/konfiLimit.js: bis 5 darüber mit Bestätigung, dann gesperrt). */
  ueberLimit: (anzahl: number, limit: number, gesperrtAb: number): string =>
    `${anzahl} Konfis sind schon angelegt – ${anzahl === limit ? 'so viele wie' : 'mehr als'} ${limit}. Neue Konfis nur noch mit Bestätigung, ab ${gesperrtAb} gar nicht.`,
  gesperrtLimit: (anzahl: number, limit: number, gesperrtAb: number): string =>
    `${anzahl} Konfis sind schon angelegt – mehr als ${limit}. Neue Konfis lassen sich nicht mehr anlegen (gesperrt ab ${gesperrtAb}).`,
} as const;

/** „Breit lesen": die Liste ausblenden, der Lesebereich wird breit (Frage 9). */
export const BREIT_LESEN = {
  an: 'Breit lesen',
  /** Tooltip des Schalters im Kopf der Liste (Stufe ui-mail-rahmen, additiv). */
  titel: 'Breit lesen – die Liste ausblenden',
  aus: 'Liste zeigen',
  zurueck: (liste: string): string => `Zurück zu „${liste}“`,
  vorher: 'Voriger Eintrag',
  weiter: 'Nächster Eintrag',
  /** Name der Leiste über dem breiten Lesebereich (Stufe verlauf, additiv). */
  navigation: 'Blättern',
  /** Wohin „‹ …" über dem breiten Lesebereich zurückführt (Stufe ui-mail-rahmen, additiv). */
  liste: { vorgaenge: 'Alle Vorgänge', posteingang: 'Posteingang' },
} as const;

/**
 * Die App-Fassung eines Vorgangs (components/support/SupportVorgangDetailPage.tsx,
 * SupportVorgangTeile.tsx und das Antwortformular in SupportMailTeile.tsx).
 * „ganz lesen", „kürzer" und „Ohne Text" stehen in VERLAUF_TEXT.
 */
export const APP_VORGANG_TEXT = {
  /** Die Zeile unter der jüngsten Mail; sie öffnet das Modal „Antworten" (Skizze App A). */
  antwortzeile: (an: string | null): string => (an ? `Antwort an ${an} …` : 'Antwort schreiben …'),
  /** Gesperrt: niemand, dem sich antworten ließe (Stand Fall 2), bzw. ohne Netz. */
  antwortzeileKeinWeg: 'Niemand, dem sich antworten ließe – siehe Stand',
  antwortzeileOffline: 'Ohne Netz lässt sich nicht antworten',
  /** Über dem Antwortformular: die Mail, auf die geantwortet wird. */
  beantwortet: 'Du antwortest auf',
  beantwortetKopf: (wer: string, zeit: string): string => `Du antwortest auf · ${wer} · ${zeit}`,
  /** Die Notiz als letzte Zeile der Karte „Stand". */
  notizLeer: 'Interne Notiz',
  notizMarke: 'Notiz:',
  notizHinzufuegen: 'Interne Notiz hinzufügen',
  notizBearbeiten: (text: string): string => `Interne Notiz bearbeiten: ${text}`,
  /** Der einzige Knopf ganz unten. */
  loeschen: (mitAnfrage: boolean): string => (mitAnfrage ? 'Vorgang und Anfrage löschen' : 'Vorgang löschen'),
} as const;

/**
 * Die Mail im Posteingang (web/WebPostDetail.tsx, SupportPostDetailPage.tsx;
 * docs/planung/support-detailseiten.md, D und E). Einsortieren ist der
 * Hauptknopf -- der Posteingang ist zum Zuordnen da.
 */
export const MAIL_DETAIL_TEXT = {
  einsortieren: { label: 'Einsortieren', titel: 'In einen bestehenden oder neuen Vorgang einsortieren' },
  antworten: { label: 'Antworten', titel: 'Dem Absender antworten' },
  wiederherstellen: { label: 'Wiederherstellen', titel: 'Zurück in den Posteingang' },
  archivieren: 'Archivieren',
  loeschen: 'Löschen',
  /** App: der einzige Knopf ganz unten. */
  loeschenUnten: 'Mail löschen',
  /** Kopf: wer schrieb, an welches Postfach. */
  von: 'Von',
  an: 'an',
  /** Marke einer archivierten Mail. */
  archiv: 'Archiv',
  /** Solange die Seite dorthin weiterleitet, wo die Mail liegt (E). */
  weiterleitung: (vorgang: number | null): string =>
    (vorgang !== null ? `Die Mail liegt in Vorgang ${vorgang} – sie öffnet sich dort.` : 'Die Mail ist schon zugeordnet – sie öffnet sich dort.'),
  /**
   * Die gewählte Mail ist inzwischen woanders einsortiert (anderer Reiter,
   * Handy, zweite Person): Der Posteingang bleibt stehen, ein Knopf öffnet sie dort.
   */
  verschoben: (vorgang: number | null): string =>
    (vorgang !== null ? `Die Mail liegt inzwischen in Vorgang ${vorgang}.` : 'Die Mail ist inzwischen zugeordnet.'),
  verschobenOeffnen: (vorgang: number | null): string => (vorgang !== null ? `Im Vorgang ${vorgang} öffnen` : 'Dort öffnen'),
} as const;
