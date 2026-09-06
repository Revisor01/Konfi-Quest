// Zentrale Stelle für wiederkehrende Icons.
//
// Warum (Simon, 04.09.2026): "Wir könnten Icons global tauschen, sodass wir
// die an einer Stelle nur definieren müssen. Ich überlege, mittels Icon dem
// Ganzen noch mal einen etwas anderen Look zu geben."
//
// Vorher stand `arrowBack` an 34 Stellen einzeln importiert — ein Wechsel
// hätte 34 Dateien angefasst und dabei zuverlässig eine vergessen.

/**
 * Zurück-Pfeil in Kopfzeilen.
 *
 * Eigenes SVG im Heroicons-Stil (Simons Wunsch, 05.09.2026: "einen coolen
 * Zurückpfeil ... Heroicons finde ich gut").
 *
 * ZUR STRICHSTÄRKE — der Grund für das eigene SVG: Ionicons hat KEINE dünnere
 * Variante. Alle Strich-Icons dort nutzen stroke-width 48 auf einer
 * Zeichenfläche von 512, das entspricht 2.25 auf 24er-Fläche. Auch die
 * `-outline`-Namen sind bei Pfeil und Chevron mit der Basisvariante identisch.
 * Heroicons "outline" zeichnet mit 1.5 auf 24 — ein Drittel dünner, und genau
 * das macht den leichteren, moderneren Eindruck.
 *
 * Als Data-URL, weil IonIcon `icon` entweder einen Ionicons-Namen ODER eine
 * URL entgegennimmt. Kein zusätzliches Paket, keine Netzabfrage, und der
 * Strich erbt über `stroke="currentColor"` die Farbe der Umgebung — sonst
 * bliebe der Pfeil im Dunkelmodus schwarz.
 *
 * Zum Ändern des Looks reicht es, hier ein anderes Icon zuzuweisen.
 */
const ZURUECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/></svg>`;

export const ICON_ZURUECK = `data:image/svg+xml,${encodeURIComponent(ZURUECK_SVG)}`;

// ---------------------------------------------------------------------------
// ALLE uebrigen Icons der App, semantisch benannt (05.09.2026).
//
// Simons Auftrag woertlich: "kannst du es so bauen, dass wir nur an einer
// stelle die icons anpassen muessen damit ueberall an der richtigen stelle
// die icons geaendert werden ... dann haben wir einfach mehr flexibilitaet."
//
// Vorher importierten 144 Dateien direkt aus 'ionicons/icons' — ein Wechsel
// des Icon-Satzes (z.B. auf Heroicons wie beim Zurueck-Pfeil oben) haette
// jede einzelne angefasst. Jetzt gilt:
//
//   * Komponenten importieren Icons NUR aus dieser Datei (abgesichert durch
//     __tests__/components/zentraleIcons.test.ts).
//   * Die Konstanten sind nach BEDEUTUNG benannt, nicht nach Icon-Name:
//     Wer "das Zusage-Symbol" tauschen will, aendert EINE Zeile hier —
//     nicht 33 Importe.
//   * Suffix _GEFUELLT = die gefuellte Ionicons-Variante; ohne Suffix die
//     Strich-Variante (bzw. die einzige, die es gibt). Beide Varianten je
//     Bedeutung existieren nur, wo die App beide wirklich nutzt.
//   * Ein Glyph darf mehrere Bedeutungen tragen (siehe Aliase unten):
//     home ist zugleich Gottesdienst-Kategorie UND Start-Tab. Getrennte
//     Konstanten, damit ein spaeterer Tausch die andere Bedeutung nicht
//     mitreisst.
//
// Diese Datei liegt bewusst in components/shared (nicht theme/): Das Muster
// ICON_ZURUECK wohnte schon hier, 62 Importe zeigten bereits auf diesen Ort,
// und die Datei exportiert neben Namen auch eigene SVGs (oben) — das ist
// Komponenten-Zubehoer, kein Theme-Token.
//
// AUSNAHMEN, die weiter direkt aus 'ionicons/icons' importieren:
//   * utils/badgeIcons.ts — loest in der DATENBANK gespeicherte Icon-Namen
//     (badge.icon, certificate.icon) auf. Die Schluessel dort sind
//     Datenvertrag mit alten App-Versionen, keine UI-Semantik.
//   * die badgeIcons-Tests, die genau diesen Vorrat pruefen.
export {
  // ===================================================================
  // NUR-KONTUR-MODUS (Simon, 06.09.2026)
  //
  // Die _GEFUELLT-Namen zeigen hier bewusst auf die KONTUR-Glyphen: Die App
  // nutzt durchgehend Strich-Icons, so wie der Zurueck-Pfeil seit Build 174.
  //
  // Warum nicht die 1121 Fundstellen aendern? Weil die Bedeutungen erhalten
  // bleiben sollen. Eine Tab-Leiste darf spaeter wieder gefuellte Zeichen
  // fuer den aktiven Reiter bekommen -- dann wird HIER zurueckgestellt, nicht
  // in 142 Dateien gesucht. Der Unterschied "gefuellt/Kontur" bleibt als
  // Absicht im Code stehen, nur die Darstellung ist vereinheitlicht.
  //
  // Zum Zurueckstellen: In den Zeilen unten das Outline-Glyph wieder durch
  // sein gefuelltes Gegenstueck ersetzen (z. B. addOutline -> add).
  // ===================================================================


  // --- Navigation & Grundaktionen ---
  addOutline as ICON_HINZUFUEGEN_GEFUELLT,
  addOutline as ICON_HINZUFUEGEN,
  addCircleOutline as ICON_PLUS_KREIS_GEFUELLT,
  addCircleOutline as ICON_PLUS_KREIS,
  arrowForwardOutline as ICON_PFEIL_WEITER_GEFUELLT,
  arrowForwardOutline as ICON_PFEIL_WEITER,
  arrowUndoOutline as ICON_RUECKGAENGIG,
  chevronDownOutline as ICON_AUFKLAPPEN_GEFUELLT,
  chevronDownOutline as ICON_AUFKLAPPEN,
  chevronUpOutline as ICON_ZUKLAPPEN,
  chevronForwardOutline as ICON_WEITER_GEFUELLT,
  chevronForwardOutline as ICON_WEITER,
  closeOutline as ICON_SCHLIESSEN_GEFUELLT,
  closeOutline as ICON_SCHLIESSEN,
  createOutline as ICON_BEARBEITEN_GEFUELLT,
  createOutline as ICON_BEARBEITEN,
  copyOutline as ICON_KOPIEREN_GEFUELLT,
  copyOutline as ICON_KOPIEREN,
  trashOutline as ICON_LOESCHEN_GEFUELLT,
  trashOutline as ICON_LOESCHEN,
  searchOutline as ICON_SUCHE_GEFUELLT,
  searchOutline as ICON_SUCHE,
  filterOutline as ICON_FILTER,
  refreshOutline as ICON_AKTUALISIEREN,
  swapHorizontalOutline as ICON_WECHSEL,
  swapVerticalOutline as ICON_SORTIEREN,
  openOutline as ICON_EXTERN_OEFFNEN,
  downloadOutline as ICON_HERUNTERLADEN,
  cloudUploadOutline as ICON_HOCHLADEN,
  printOutline as ICON_DRUCKEN,
  shareOutline as ICON_TEILEN,
  scanOutline as ICON_SCANNEN,
  ellipsisHorizontalOutline as ICON_MEHR,
  ellipsisVerticalOutline as ICON_MEHR_VERTIKAL,
  removeCircleOutline as ICON_ENTFERNEN_GEFUELLT,
  removeCircleOutline as ICON_ENTFERNEN,
  listOutline as ICON_LISTE,
  gridOutline as ICON_RASTER_GEFUELLT,
  gridOutline as ICON_RASTER,
  appsOutline as ICON_APPS,
  checkboxOutline as ICON_CHECKBOX,
  logOutOutline as ICON_ABMELDEN_GEFUELLT,
  logOutOutline as ICON_ABMELDEN,

  // --- Status & Rueckmeldung ---
  checkmarkOutline as ICON_HAKEN_GEFUELLT,
  checkmarkOutline as ICON_HAKEN,
  checkmarkCircleOutline as ICON_ZUSAGE_GEFUELLT,
  checkmarkCircleOutline as ICON_ZUSAGE,
  checkmarkDoneCircleOutline as ICON_ANWESEND,
  closeCircleOutline as ICON_ABSAGE,
  ellipseOutline as ICON_KREIS_LEER,
  hourglassOutline as ICON_WARTEND_GEFUELLT,
  hourglassOutline as ICON_WARTEND,
  alertCircleOutline as ICON_WARNHINWEIS_GEFUELLT,
  alertCircleOutline as ICON_WARNHINWEIS,
  warningOutline as ICON_WARNUNG_GEFUELLT,
  warningOutline as ICON_WARNUNG,
  informationCircleOutline as ICON_INFO_GEFUELLT,
  informationCircleOutline as ICON_INFO,
  helpCircleOutline as ICON_HILFE_GEFUELLT,
  helpCircleOutline as ICON_HILFE,
  banOutline as ICON_GESPERRT,
  cloudOfflineOutline as ICON_OFFLINE,
  infiniteOutline as ICON_UNENDLICH,
  pulseOutline as ICON_PULS,
  notificationsOutline as ICON_BENACHRICHTIGUNG,

  // --- Termine & Zeit ---
  calendarOutline as ICON_TERMIN_GEFUELLT,
  calendarOutline as ICON_TERMIN,
  timeOutline as ICON_UHRZEIT_GEFUELLT,
  timeOutline as ICON_UHRZEIT,

  // --- Personen & Rollen ---
  personOutline as ICON_PERSON_GEFUELLT,
  personOutline as ICON_PERSON,
  peopleOutline as ICON_GRUPPE_GEFUELLT,
  peopleOutline as ICON_GRUPPE,
  personAddOutline as ICON_PERSON_HINZUFUEGEN_GEFUELLT,
  personAddOutline as ICON_PERSON_HINZUFUEGEN,
  personCircleOutline as ICON_PROFIL,
  schoolOutline as ICON_JAHRGANG_GEFUELLT,
  schoolOutline as ICON_JAHRGANG,
  handLeftOutline as ICON_HAND_GEFUELLT,
  handLeftOutline as ICON_HAND,
  happyOutline as ICON_FROEHLICH_GEFUELLT,
  happyOutline as ICON_FROEHLICH,
  sadOutline as ICON_TRAURIG_GEFUELLT,
  sadOutline as ICON_TRAURIG,
  thumbsUpOutline as ICON_DAUMEN_HOCH_GEFUELLT,
  thumbsUpOutline as ICON_DAUMEN_HOCH,
  heartOutline as ICON_HERZ_GEFUELLT,
  heartOutline as ICON_HERZ,

  // --- Punkte, Abzeichen & Erfolge ---
  trophyOutline as ICON_POKAL_GEFUELLT,
  trophyOutline as ICON_POKAL,
  ribbonOutline as ICON_ABZEICHEN_GEFUELLT,
  ribbonOutline as ICON_ABZEICHEN,
  starOutline as ICON_STERN_GEFUELLT,
  starOutline as ICON_STERN,
  flagOutline as ICON_CHALLENGE_GEFUELLT,
  flagOutline as ICON_CHALLENGE,
  flashOutline as ICON_AKTION_GEFUELLT,
  flashOutline as ICON_AKTION,
  giftOutline as ICON_BONUS_GEFUELLT,
  giftOutline as ICON_BONUS,
  sparklesOutline as ICON_FUNKELN_GEFUELLT,
  sparklesOutline as ICON_FUNKELN,
  flameOutline as ICON_FLAMME_GEFUELLT,
  flameOutline as ICON_FLAMME,
  rocketOutline as ICON_RAKETE,
  podiumOutline as ICON_PODIUM,
  statsChartOutline as ICON_STATISTIK_GEFUELLT,
  statsChartOutline as ICON_STATISTIK,
  barChartOutline as ICON_DIAGRAMM,
  speedometerOutline as ICON_TACHO,
  layersOutline as ICON_STUFEN,
  pricetagOutline as ICON_KATEGORIE_GEFUELLT,
  pricetagOutline as ICON_KATEGORIE,

  // --- Chat & Kommunikation ---
  chatbubbleOutline as ICON_CHAT,
  chatbubbleEllipsesOutline as ICON_CHAT_AKTIV,
  chatbubblesOutline as ICON_CHATS_GEFUELLT,
  chatbubblesOutline as ICON_CHATS,
  paperPlaneOutline as ICON_SENDEN,
  paperPlaneOutline as ICON_SENDEN_GEFUELLT,
  returnUpBackOutline as ICON_ANTWORTEN,
  mailOutline as ICON_MAIL_GEFUELLT,
  mailOutline as ICON_MAIL,
  atOutline as ICON_AT_ZEICHEN,
  callOutline as ICON_TELEFON,
  megaphoneOutline as ICON_ANKUENDIGUNG,

  // --- Medien & Dateien ---
  documentOutline as ICON_DATEI_GEFUELLT,
  documentOutline as ICON_DATEI,
  documentTextOutline as ICON_TEXTDOKUMENT_GEFUELLT,
  documentTextOutline as ICON_TEXTDOKUMENT,
  imageOutline as ICON_BILD_GEFUELLT,
  imageOutline as ICON_BILD,
  imagesOutline as ICON_GALERIE,
  cameraOutline as ICON_KAMERA_GEFUELLT,
  cameraOutline as ICON_KAMERA,
  videocamOutline as ICON_VIDEO,
  micOutline as ICON_MIKROFON_GEFUELLT,
  micOutline as ICON_MIKROFON,
  musicalNotesOutline as ICON_MUSIK,
  playOutline as ICON_ABSPIELEN,
  pauseOutline as ICON_PAUSE,
  attachOutline as ICON_ANHANG_GEFUELLT,
  attachOutline as ICON_ANHANG,
  linkOutline as ICON_LINK,
  folderOpenOutline as ICON_ORDNER,
  archiveOutline as ICON_ARCHIV,
  albumsOutline as ICON_ALBEN,
  textOutline as ICON_TEXT,
  bagHandleOutline as ICON_MATERIAL,
  bookOutline as ICON_BUCH_GEFUELLT,
  bookOutline as ICON_BUCH,

  // --- Sichtbarkeit & Sicherheit ---
  eyeOutline as ICON_SICHTBAR_GEFUELLT,
  eyeOutline as ICON_SICHTBAR,
  eyeOffOutline as ICON_VERBORGEN_GEFUELLT,
  eyeOffOutline as ICON_VERBORGEN,
  lockClosedOutline as ICON_SPERRE_GEFUELLT,
  lockClosedOutline as ICON_SPERRE,
  lockOpenOutline as ICON_ENTSPERRT,
  keyOutline as ICON_SCHLUESSEL_GEFUELLT,
  keyOutline as ICON_SCHLUESSEL,
  shieldOutline as ICON_SCHILD_GEFUELLT,
  shieldOutline as ICON_SCHILD,
  shieldCheckmarkOutline as ICON_SCHUTZ_GEFUELLT,
  shieldCheckmarkOutline as ICON_SCHUTZ,
  fingerPrintOutline as ICON_FINGERABDRUCK,
  qrCodeOutline as ICON_QRCODE_GEFUELLT,
  qrCodeOutline as ICON_QRCODE,

  // --- Orte & Organisation ---
  homeOutline as ICON_GOTTESDIENST_GEFUELLT,
  homeOutline as ICON_GOTTESDIENST,
  locationOutline as ICON_ORT_GEFUELLT,
  locationOutline as ICON_ORT,
  businessOutline as ICON_ORGANISATION_GEFUELLT,
  businessOutline as ICON_ORGANISATION,
  globeOutline as ICON_WELT,
  compassOutline as ICON_KOMPASS,
  gitNetworkOutline as ICON_NETZWERK,

  // --- Sonstiges ---
  settingsOutline as ICON_EINSTELLUNGEN_GEFUELLT,
  settingsOutline as ICON_EINSTELLUNGEN,
  constructOutline as ICON_WERKZEUG,
  briefcaseOutline as ICON_AKTENTASCHE_GEFUELLT,
  briefcaseOutline as ICON_AKTENTASCHE,
  cubeOutline as ICON_WUERFEL,
  prismOutline as ICON_PRISMA,
  flaskOutline as ICON_EXPERIMENT,
  sunnyOutline as ICON_SONNE,
  arrowUpCircleOutline as ICON_UPGRADE,

} from 'ionicons/icons';

// Aliase: dasselbe Glyph, eine ANDERE Bedeutung. Absichtlich eigene
// Konstanten, damit ein spaeterer Icon-Wechsel nur die gemeinte Stelle
// trifft (05.09.2026):
//   * home steht in Punkte-Kontexten fuer die Kategorie Gottesdienst
//     (ICON_GOTTESDIENST oben), in Tab-Leiste und Onboarding aber fuer
//     die Startseite.
//   * people steht meist fuer Gruppe/Teilnehmende (ICON_GRUPPE oben), im
//     Paar "gottesdienst : gemeinde" aber fuer die Kategorie Gemeinde.
export {
  homeOutline as ICON_STARTSEITE_GEFUELLT,
  homeOutline as ICON_STARTSEITE,
  peopleOutline as ICON_GEMEINDE_GEFUELLT,
  peopleOutline as ICON_GEMEINDE,
} from 'ionicons/icons';
