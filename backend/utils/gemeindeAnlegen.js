// Eine Gemeinde samt erster Gemeindeleitung anlegen -- EINE Stelle fuer
// alle Wege (03.10.2026).
//
// Bis hierher stand die Anlage allein in POST /organizations
// (routes/organizations.js). Die Support-Ansicht der Web-Version legt
// Gemeinden auch aus einer Anfrage vom Formular auf konfi-quest.de an
// (POST /support/anfragen/:id/anlegen; docs/planung/web-version.md,
// Entscheidung 4). Beide Wege rufen diese Funktion -- keine Kopie, damit eine
// neue Vorlage (Abzeichen, Stufe, Kategorie ...) nicht nur auf einem Weg
// ankommt. Die Vorlagen unten sind unveraendert aus der Route hierher
// gezogen; tests/routes/gemeindeAnlegenGemeinsam.test.js haelt fest, dass
// POST /organizations danach Stueck fuer Stueck dasselbe anlegt wie vorher.
//
// GANZ ODER GAR NICHT (29.09.2026, Nebenbefund Screens/Leitung BF-15):
// gemeindeAnlegen laeuft in der Transaktion des Aufrufers (BEGIN, COMMIT und
// ROLLBACK macht er). Scheitert eine der rund hundert Einfuegungen, rollt er
// alles zurueck -- es bleibt keine halbe Gemeinde mit belegtem Systemnamen.
//
// DER BENUTZERNAME DER ERSTEN GEMEINDELEITUNG wird systemweit geprueft,
// genau wie in POST /users und POST /:id/admins (gleicher Text, 409), unter
// derselben Sperre (utils/benutzernameSperre.js): Die Anmeldung sucht per
// LOWER(username), der Index ist nur (organization_id, username) und greift
// in einer neuen Gemeinde nie.
//
// DAS PASSWORT hasht der Aufrufer VOR dem Holen der Verbindung, damit bcrypt
// keine Pool-Verbindung belegt.

const { benutzernameSperrenUndPruefen, MELDUNG_VERGEBEN } = require('./benutzernameSperre');
const { kontoSperreAufheben } = require('./kontoSperre');
const { kirchenkreisFinden, MELDUNG_KIRCHENKREIS_FEHLT } = require('./kirchenkreisZuordnung');

// ---------------------------------------------------------------------------
// Vorlagen (aus POST /organizations, Nummern wie dort)
// ---------------------------------------------------------------------------

// 2. Create default roles for the organization
// WICHTIG: inkl. 'konfi' — konfi-management sucht die Rolle org-gescopt;
// ohne sie kann die neue Organisation keine Konfis anlegen.
// Namen wie in utils/rollenNamen.js (Simon, 28.09.2026): 'admin' heisst
// "Leitung", 'org_admin' "Org-Leitung". Bestehende Gemeinden behalten
// ihre alten display_name-Werte, die Oberflaeche beschriftet nach name.
const defaultRoles = [
  { name: 'org_admin', display_name: 'Gemeindeleitung', description: 'Vollzugriff auf alle Jahrgänge der Gemeinde', is_system_role: true },
  { name: 'admin', display_name: 'Leitung', description: 'Vollzugriff mit Jahrgangs-Beschränkungen', is_system_role: true },
  { name: 'teamer', display_name: 'Teamer:in', description: 'Kann Anträge bearbeiten und zugewiesene Jahrgänge verwalten', is_system_role: true },
  { name: 'konfi', display_name: 'Konfirmand:in', description: 'Konfirmand:innen haben Zugriff auf eigene Daten und können Aktivitäten beantragen', is_system_role: true }
];

// 4. Create default badges for the organization
const defaultBadges = [
  { name: "Erster Schritt", icon: "footsteps-outline", description: "Herzlich willkommen! Du hast deine ersten Punkte gesammelt.", criteria_type: "total_points", criteria_value: 1 },
  { name: "Auf dem Weg", icon: "walk-outline", description: "Du sammelst fleißig Punkte!", criteria_type: "total_points", criteria_value: 5 },
  { name: "Fleißiger Sammler", icon: "flag-outline", description: "10 Punkte gesammelt - super gemacht!", criteria_type: "total_points", criteria_value: 10 },
  { name: "Punktesammler", icon: "diamond-outline", description: "15 Punkte erreicht - du bist auf einem guten Weg!", criteria_type: "total_points", criteria_value: 15 },
  { name: "Punkteprofi", icon: "trophy-outline", description: "20 Punkte geschafft - großartig!", criteria_type: "total_points", criteria_value: 20 },
  { name: "Punktemeister", icon: "ribbon-outline", description: "25 Punkte erreicht - du bist spitze!", criteria_type: "total_points", criteria_value: 25 },
  { name: "Gottesdienst-Neuling", icon: "home-outline", description: "Du warst zum ersten Mal im Gottesdienst - toll!", criteria_type: "gottesdienst_points", criteria_value: 1 },
  { name: "Gottesdienst-Fan", icon: "book-outline", description: "5 Gottesdienst-Punkte gesammelt!", criteria_type: "gottesdienst_points", criteria_value: 5 },
  { name: "Gottesdienst-Profi", icon: "star-outline", description: "10 Gottesdienst-Punkte erreicht!", criteria_type: "gottesdienst_points", criteria_value: 10 },
  { name: "Gottesdienst-Experte", icon: "heart-outline", description: "15 Gottesdienst-Punkte geschafft!", criteria_type: "gottesdienst_points", criteria_value: 15 },
  { name: "Gemeinde-Neuling", icon: "people-outline", description: "Du hast dich zum ersten Mal in der Gemeinde engagiert!", criteria_type: "gemeinde_points", criteria_value: 1 },
  { name: "Gemeinde-Helfer", icon: "hand-left-outline", description: "5 Gemeinde-Punkte gesammelt - danke für dein Engagement!", criteria_type: "gemeinde_points", criteria_value: 5 },
  { name: "Gemeinde-Unterstützer", icon: "sunny-outline", description: "10 Gemeinde-Punkte erreicht!", criteria_type: "gemeinde_points", criteria_value: 10 },
  { name: "Gemeinde-Champion", icon: "medal-outline", description: "15 Gemeinde-Punkte geschafft - du bist eine große Hilfe!", criteria_type: "gemeinde_points", criteria_value: 15 },
  { name: "Ausgewogen", icon: "git-compare-outline", description: "Du sammelst in beiden Bereichen Punkte - sehr gut!", criteria_type: "both_categories", criteria_value: 3 },
  { name: "Harmonisch", icon: "musical-notes-outline", description: "5 Punkte in beiden Bereichen - perfekte Balance!", criteria_type: "both_categories", criteria_value: 5 },
  { name: "Aktiv dabei", icon: "fitness-outline", description: "Du hast schon 3 verschiedene Aktivitäten gemacht!", criteria_type: "activity_count", criteria_value: 3 },
  { name: "Vielfalts-Fan", icon: "color-palette-outline", description: "5 Aktivitäten absolviert - du probierst gerne Neues!", criteria_type: "activity_count", criteria_value: 5 },
  { name: "Aktivitäts-Sammler", icon: "stats-chart-outline", description: "10 Aktivitäten geschafft - beeindruckend!", criteria_type: "activity_count", criteria_value: 10 },
  { name: "Bonuspunkte-Gewinner", icon: "gift-outline", description: "Du hast Bonuspunkte erhalten - weiter so!", criteria_type: "bonus_points", criteria_value: 1 },
  { name: "Event-Entdecker", icon: "calendar-outline", description: "Du warst bei 3 Events dabei!", criteria_type: "event_count", criteria_value: 3 },
  { name: "Event-Stammgast", icon: "calendar-number-outline", description: "7 Events besucht - du bist richtig dabei!", criteria_type: "event_count", criteria_value: 7 },
  { name: "Zuverlässig", icon: "checkmark-done-outline", description: "Bei 5 Pflicht-Events anwesend - darauf ist Verlass!", criteria_type: "mandatory_event_count", criteria_value: 5 },
  { name: "Neugierig", icon: "compass-outline", description: "3 verschiedene Aktivitäten ausprobiert!", criteria_type: "unique_activities", criteria_value: 3 },
  { name: "Vielseitig", icon: "telescope-outline", description: "6 verschiedene Aktivitäten ausprobiert - stark!", criteria_type: "unique_activities", criteria_value: 6 },
  { name: "Dranbleiber", icon: "flame-outline", description: "3 Wochen in Folge aktiv gewesen!", criteria_type: "streak", criteria_value: 3 },
  { name: "Durchstarter", icon: "flash-outline", description: "6 Wochen am Stück aktiv - was für eine Serie!", criteria_type: "streak", criteria_value: 6 }
];

// TEAMER-ABZEICHEN. Sie brauchen einen eigenen Satz: custom_badges.
// target_role steht per DEFAULT auf 'konfi' (Migration 076), und die
// Teamer-Ansicht fragt ausschliesslich target_role = 'teamer' ab. Ohne
// diese Zeilen startet eine neue Gemeinde mit einer leeren Abzeichen-
// Seite fuer ihr Team, waehrend die bestehenden Gemeinden welche haben.
//
// Nur Kriterien, die OHNE weitere Einrichtung rechnen: Der Teamer-Zweig
// (routes/badges.js) kennt zehn Typen, aber specific_activity,
// category_activities, category_combination und activity_combination
// verlangen konkrete Aktivitaeten oder Kategorien -- die es in einer
// frischen Gemeinde noch nicht gibt. Uebrig bleiben activity_count
// (Aktivitaeten UND Termine), event_count, unique_activities,
// teamer_year und streak.
const defaultTeamerBadges = [
  { name: "Willkommen im Team", icon: "hand-right-outline", description: "Dein erster Einsatz als Teamer:in ist eingetragen.", criteria_type: "activity_count", criteria_value: 1 },
  { name: "Mit dabei", icon: "people-circle-outline", description: "5 Einsätze als Teamer:in.", criteria_type: "activity_count", criteria_value: 5 },
  { name: "Feste Größe", icon: "shield-checkmark-outline", description: "15 Einsätze als Teamer:in.", criteria_type: "activity_count", criteria_value: 15 },
  { name: "Erste Begleitung", icon: "calendar-outline", description: "Du warst bei deinem ersten Event dabei.", criteria_type: "event_count", criteria_value: 1 },
  { name: "Verlässlich dabei", icon: "calendar-number-outline", description: "Bei 10 Events dabei gewesen.", criteria_type: "event_count", criteria_value: 10 },
  { name: "Vielseitig im Einsatz", icon: "color-palette-outline", description: "5 verschiedene Aktivitäten begleitet.", criteria_type: "unique_activities", criteria_value: 5 },
  { name: "Ein Jahr im Team", icon: "ribbon-outline", description: "Ein Jahr als Teamer:in aktiv gewesen.", criteria_type: "teamer_year", criteria_value: 1 },
  { name: "Drei Jahre im Team", icon: "trophy-outline", description: "Drei Jahre als Teamer:in aktiv gewesen.", criteria_type: "teamer_year", criteria_value: 3 },
  { name: "Am Ball geblieben", icon: "flame-outline", description: "3 Wochen in Folge im Einsatz.", criteria_type: "streak", criteria_value: 3 }
];

// 5. Create default certificate types for the organization
const defaultCertificates = [
  { name: 'Teamer-Card', icon: 'card' },
  { name: 'JuLeiCa', icon: 'ribbon' },
  { name: 'Rettungsschwimmer', icon: 'water' },
  { name: 'Erste Hilfe', icon: 'medkit' }
];

// 6. Create default levels (Startpunkt zum Anpassen — Werte wie Referenz-Org)
//
// Titel, Punkte, Icons und Farben sind die von Kirchspiel West (Org 1),
// gemessen am 25.09.2026. Die Titel sind geschlechtsneutral (Noviz:in,
// Expert:in), wie die uebrige App. Anlass: Hennstedt (Org 2, angelegt am
// 05.12.2025) hatte KEINE Level -- die Org ist aelter als dieser Block
// (11.06.2026). Simon: "Die muessen standardmaessig in jeder Org angelegt
// werden." Der Test zur Org-Anlage prueft seither die konkrete Liste.
const defaultLevels = [
  { name: 'novize', title: 'Noviz:in', points_required: 2, icon: 'pin', color: '#f5b981' },
  { name: 'lehrling', title: 'Lehrling', points_required: 5, icon: 'hammer', color: '#3b82f6' },
  { name: 'gehilfe', title: 'Unterstützung', points_required: 10, icon: 'personAdd', color: '#8b5cf6' },
  { name: 'experte', title: 'Expert:in', points_required: 15, icon: 'school', color: '#f59e0b' },
  { name: 'meister', title: 'Meisterschaft', points_required: 20, icon: 'construct', color: '#ef4444' },
  { name: 'legende', title: 'Legende', points_required: 30, icon: 'medal', color: '#7c3aed' }
];

// 7. Create default categories (Startpunkt zum Anpassen). type:
// 'activity' | 'event' | 'both'. key dient nur der Verknuepfung unten.
//
// NEU SORTIERT AM 03.09.2026 (Simons Entscheidung). Zwei Aenderungen:
//
// 1. "Unterricht" ist RAUS. Woertlich: "Es heisst bewusst Konfi Zeit!"
//    Konfi-Arbeit ist keine Schule. Der Begriff wird auch nicht ersetzt,
//    er faellt ersatzlos weg.
//
// 2. "Gottesdienst" und "Gemeinde" sind RAUS als Kategorie. Sie sind der
//    TYP einer Aktivitaet (activities.type -- die Punkte-Achse
//    gottesdienst/gemeinde), nicht die Art des Anlasses. Als Kategorie
//    waren sie eine Doppelung: Jede Aktivitaet ist ohnehin das eine oder
//    das andere, das steht schon auf der Punkte-Seite des Rueckblicks.
//    Kategorien beantworten eine andere Frage -- WAS FUER EIN ANLASS war
//    das (Fest, Konzert, Freizeit) -- und nur die traegt eigene Seiten.
//
// BESTAND BLEIBT UNANGETASTET: Diese Liste gilt nur beim ANLEGEN einer
// neuen Gemeinde. Bestehende Organisationen behalten jede Kategorie, die
// sie haben, inklusive "Gottesdienst", "Gemeinde" und "Unterricht".
// Niemandes Daten aendern sich durch diese Zeilen.
const defaultCategories = [
  { key: 'fest', name: 'Fest', description: 'Gemeindefest, Feiern', type: 'both' },
  { key: 'senioren', name: 'Senior:innen', description: 'Besuche, Seniorenkreis', type: 'both' },
  { key: 'jugend', name: 'Jugend', description: 'Jugendgruppe, Jugendtreff', type: 'both' },
  { key: 'oeffentlichkeit', name: 'Öffentlichkeitsarbeit', description: 'Gemeindebrief, Aushang, Social Media', type: 'both' },
  { key: 'freizeit', name: 'Freizeit', description: 'Fahrten und Freizeiten', type: 'both' },
  { key: 'weihnachten', name: 'Weihnachten', description: 'Adventszeit, Christvesper, Krippenspiel', type: 'both' },
  // Fuer die Teamer:innen -- taucht im Teamer-Rueckblick auf, nicht im
  // Konfi-Rueckblick.
  { key: 'teamtreff', name: 'Teamtreff', description: 'Treffen des Teams', type: 'both' },
  { key: 'konzert', name: 'Konzert', description: 'Konzerte und Musik', type: 'both' },
  { key: 'kinder', name: 'Kinder', description: 'Kindergottesdienst, Kindergruppe', type: 'both' },
  { key: 'kreativ', name: 'Kreativ', description: 'Basteln, Gestalten, Werkstatt', type: 'both' },
  { key: 'seelsorge', name: 'Seelsorge', description: 'Besuche, Gespräche, Begleitung', type: 'both' },
  // Kasualien bleibt: Die Standard-Aktivitaeten Taufe, Hochzeit und
  // Beerdigung haengen daran (defaultActivities unten). Ohne diese
  // Kategorie liefe das Anlegen einer Gemeinde auf einen leeren
  // Kategorie-Verweis.
  { key: 'kasualien', name: 'Kasualien', description: 'Taufe, Hochzeit, Beerdigung', type: 'activity' },
  // Gottesdienst und Gemeinde bleiben als Kategorie erhalten -- sie
  // schaden hier nicht und viele Gemeinden erwarten sie. Sie tragen nur
  // KEINE eigene Wrapped-Seite, weil sie die Punkte-Achse doppeln
  // (activities.type). Siehe utils/wrappedKategorien.js.
  { key: 'gottesdienst', name: 'Gottesdienst', description: '', type: 'both' },
  { key: 'gemeinde', name: 'Gemeinde', description: '', type: 'both' }
];

// 8. Create default activities (Startpunkt zum Anpassen) + Kategorie-Verknuepfung.
// type: 'gottesdienst' | 'gemeinde'. categoryKey verweist auf defaultCategories.
const defaultActivities = [
  { name: 'Gottesdienstbesuch', points: 1, type: 'gottesdienst', categoryKey: 'gottesdienst' },
  { name: 'Taufe', points: 1, type: 'gottesdienst', categoryKey: 'kasualien' },
  { name: 'Hochzeit', points: 1, type: 'gottesdienst', categoryKey: 'kasualien' },
  { name: 'Beerdigung', points: 2, type: 'gottesdienst', categoryKey: 'kasualien' },
  { name: 'Küsterdienst', points: 1, type: 'gemeinde', categoryKey: 'gemeinde' }
];

// Aktivitaeten fuers Team (Simons Standard, 07.09.2026). Bewusst OHNE
// Punkte und ohne Punktetyp: Teamer:innen sammeln keine Gottesdienst-
// oder Gemeindepunkte. Ein Typ hier waere nicht nur sinnlos, sondern
// schaedlich -- die Loeschroute rief bis heute getPointField() darauf
// und brach mit "Ungueltiger Punktetyp" ab.
// Was NICHT hierher gehoert: "Kirchenuebernachtung" und "SFZ Norwegen"
// sind Eigenheiten einzelner Gemeinden und werden dort von Hand
// angelegt.
const defaultTeamerActivities = [
  { name: 'Andacht halten', categoryKey: 'gottesdienst' },
  { name: 'Gottesdienst mitgestalten', categoryKey: 'gottesdienst' },
  { name: 'Team-Schulung', categoryKey: 'teamtreff' },
  { name: 'Team-Sitzung', categoryKey: 'teamtreff' }
];

// 9. Beispiel-Challenges (Startpunkt zum Anpassen). Je eine pro
// challenge_type, als Entwuerfe (is_draft=true) angelegt, damit nichts
// ungewollt live geht — die Leitung passt Inhalte an und veroeffentlicht
// selbst. Platzhalter-Zeitraum (7 bis 14 Tage ab jetzt), da eine neue Org
// noch keine Jahrgänge hat und die Challenges daher bewusst OHNE
// Jahrgangs-Zuweisung starten (challenge_jahrgang_assignments bleibt leer;
// routes/challenges.js zeigt Entwuerfe ohne Zuweisung über LEFT JOIN /
// COALESCE sauber an).
const defaultChallenges = [
  {
    title: 'Unbezahlbar — Momente, die man nicht kaufen kann',
    description: 'Eine Woche lang achtest du auf Momente, die nichts kosten und dir trotzdem wichtig sind — ein Lachen, ein Sonnenuntergang, ein gutes Gespräch. Teile so einen Moment als Foto oder Text.',
    challenge_type: 'wahrnehmung',
    visibility: 'konfi_choice',
    moderated: true,
    badge_name: 'Unbezahlbar'
  },
  {
    title: 'Dein Song',
    description: 'Es gibt bestimmt einen Song, der etwas mit dir macht — der dich runterholt, aufbaut oder einfach zu dir passt. Teile ihn als Link und schreib in einem Satz, warum genau dieser Song.',
    challenge_type: 'beitrag',
    visibility: 'konfi_choice',
    moderated: false,
    badge_name: 'Dein Song'
  },
  {
    title: 'Eine Woche ein guter Vorsatz',
    description: 'Zieh eine Woche lang etwas Kleines durch, das dir guttut — zum Beispiel morgens an eine Sache denken, für die du dankbar bist, oder jeden Tag einen freundlichen Satz zu jemandem sagen. Schreib am Ende kurz auf, wie es für dich war. Das lesen nur wir.',
    challenge_type: 'praxis',
    visibility: 'private',
    moderated: false,
    badge_name: 'Guter Vorsatz'
  }
];
// ---------------------------------------------------------------------------
// Angaben lesen (fuer beide Wege gleich)
// ---------------------------------------------------------------------------

const MELDUNG_SLUG_VERGEBEN = 'Gemeinde-Slug existiert bereits';

/**
 * max_konfis: nur gueltige Zahl >= 0 oder NULL (unbegrenzt).
 * @returns {{wert: number|null} | {fehler: {status: number, body: object}}}
 */
function konfiLimitLesen(max_konfis) {
  if (max_konfis === null || max_konfis === undefined || max_konfis === '') {
    return { wert: null };
  }
  const parsed = parseInt(max_konfis, 10);
  if (isNaN(parsed) || parsed < 0) {
    return { fehler: { status: 400, body: { error: 'Konfi-Limit muss eine Zahl ab 0 oder leer sein' } } };
  }
  return { wert: parsed };
}

/**
 * Zeitraum (trial_ends_at) + Trial-Kennzeichnung (is_trial). Explizite Werte
 * haben Vorrang; fehlen sie, startet eine neue Gemeinde als 30-Tage-Testphase.
 *   trial_ends_at: NULL = unbegrenzt; Datum = Zugang bis dahin (dann Sperre).
 *   is_trial:      true = Dashboard-Hinweis; false = stiller Lizenz-Ablauf.
 *
 * @param {object} body  Koerper der Anfrage
 * @returns {{trialEndsAt: Date|string|null, isTrial: boolean}}
 */
function laufzeitLesen(body) {
  if (Object.prototype.hasOwnProperty.call(body, 'trial_ends_at')) {
    return { trialEndsAt: body.trial_ends_at || null, isTrial: body.is_trial === true };
  }
  return { trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), isTrial: true };
}

/**
 * Ein Fehler, an dem die Anlage abgebrochen ist, als Antwort -- oder null,
 * dann ist es ein Serverfehler (500). Doppelter Systemname: 409.
 */
function fehlerAlsAntwort(err) {
  if (err && err.code === '23505') { // unique_violation
    return { status: 409, body: { error: MELDUNG_SLUG_VERGEBEN } };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Die Anlage
// ---------------------------------------------------------------------------

/**
 * Legt Gemeinde, Rollen, erste Gemeindeleitung und alle Vorlagen an -- in
 * der offenen Transaktion des Aufrufers (kein BEGIN/COMMIT hier).
 *
 * @param {import('pg').PoolClient} client  in einer Transaktion
 * @param {object} g
 * @param {string} g.name           Systemname (organizations.name)
 * @param {string} g.slug           Systemname fuer slug
 * @param {string} g.display_name
 * @param {string} [g.description]
 * @param {string} [g.contact_name]
 * @param {string} [g.contact_email]
 * @param {string} [g.contact_phone]
 * @param {string} [g.address]
 * @param {string} [g.website_url]
 * @param {string} [g.kirchenkreis]  Freitext (Textspalte), ohne kirchenkreis_id
 * @param {number|string|null} [g.kirchenkreis_id]  Zuordnung (Migration 191);
 *   unbekannt -> fehler 400 "Kirchenkreis nicht gefunden"
 * @param {number|null} g.max_konfis  schon gelesen (konfiLimitLesen)
 * @param {Date|string|null} g.trial_ends_at  schon gelesen (laufzeitLesen)
 * @param {boolean} g.is_trial
 * @param {{username: string, email: string|null, display_name: string, passwortHash: string}} g.admin
 * @returns {Promise<{fehler: {status: number, body: object}} |
 *   {organizationId: number, adminId: number, anzahl: {abzeichen: number,
 *    zertifikate: number, stufen: number, kategorien: number,
 *    aktivitaeten: number, challenges: number}}>}
 *   fehler: Benutzername vergeben (409) oder Kirchenkreis unbekannt (400) --
 *   der Aufrufer rollt zurueck.
 */
async function gemeindeAnlegen(client, g) {
  // Benutzername systemweit eindeutig -- wie POST /users und /:id/admins,
  // unter derselben Sperre (utils/benutzernameSperre.js): Eine
  // gleichzeitige Anlage mit demselben Namen wartet bis zum COMMIT und
  // bekommt dann 409.
  if (await benutzernameSperrenUndPruefen(client, g.admin.username)) {
    return { fehler: { status: 409, body: { error: MELDUNG_VERGEBEN } } };
  }

  // Kirchenkreis als Zuordnung (Migration 191, utils/kirchenkreisZuordnung.js):
  // Mit kirchenkreis_id steht dessen Name auch in der Textspalte, ein
  // geschickter Freitext zaehlt dann nicht. Ohne kirchenkreis_id bleibt es
  // beim Freitext wie bisher.
  let kirchenkreisText = g.kirchenkreis || null;
  let kirchenkreisId = null;
  if (g.kirchenkreis_id !== undefined && g.kirchenkreis_id !== null) {
    const kk = await kirchenkreisFinden(client, g.kirchenkreis_id);
    if (!kk) {
      return { fehler: { status: 400, body: { error: MELDUNG_KIRCHENKREIS_FEHLT } } };
    }
    kirchenkreisId = kk.id;
    kirchenkreisText = kk.name;
  }

  // 1. Create Organization
  const orgQuery = `INSERT INTO organizations (
    name, slug, display_name, description, contact_name, contact_email,
    contact_phone, address, website_url, kirchenkreis, max_konfis, trial_ends_at, is_trial,
    kirchenkreis_id
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`;

  const { rows: [newOrg] } = await client.query(orgQuery, [
    g.name, g.slug, g.display_name, g.description, g.contact_name || null, g.contact_email, g.contact_phone,
    g.address, g.website_url, kirchenkreisText, g.max_konfis, g.trial_ends_at, g.is_trial,
    kirchenkreisId
  ]);
  const organizationId = newOrg.id;

  // 2. Standardrollen (Vorlage oben)
  let orgAdminRoleId = null;
  const roleQuery = `INSERT INTO roles (organization_id, name, display_name, description, is_system_role)
                     VALUES ($1, $2, $3, $4, $5) RETURNING id`;

  for (const role of defaultRoles) {
    const { rows: [newRole] } = await client.query(roleQuery, [
      organizationId, role.name, role.display_name, role.description, role.is_system_role
    ]);
    if (role.name === 'org_admin') {
      orgAdminRoleId = newRole.id;
    }
  }

  // 3. Create the admin user for the organization (Passwort vorher gehasht)
  const userQuery = `INSERT INTO users (organization_id, role_id, username, email, password_hash, display_name, is_active)
                     VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`;
  const { rows: [newAdmin] } = await client.query(userQuery, [
    organizationId, orgAdminRoleId, g.admin.username, g.admin.email, g.admin.passwortHash, g.admin.display_name
  ]);
  // Ein vorher durchprobierter Benutzername startet frei (utils/kontoSperre.js).
  // Mit dem Client: Das Konto ist ausserhalb der Transaktion noch unsichtbar.
  await kontoSperreAufheben(client, newAdmin.id);

  // 4. Abzeichen fuer Konfis und Team (Vorlagen oben)
  const badgeQuery = `INSERT INTO custom_badges (
    organization_id, name, icon, description, criteria_type, criteria_value,
    is_active, is_hidden, created_by, target_role
  ) VALUES ($1, $2, $3, $4, $5, $6, true, false, $7, $8)`;

  for (const badge of defaultBadges) {
    await client.query(badgeQuery, [
      organizationId, badge.name, badge.icon, badge.description,
      badge.criteria_type, badge.criteria_value, newAdmin.id, 'konfi'
    ]);
  }

  for (const badge of defaultTeamerBadges) {
    await client.query(badgeQuery, [
      organizationId, badge.name, badge.icon, badge.description,
      badge.criteria_type, badge.criteria_value, newAdmin.id, 'teamer'
    ]);
  }

  // 5. Zertifikatsarten
  const certQuery = `INSERT INTO certificate_types (name, icon, organization_id)
                     VALUES ($1, $2, $3)`;
  for (const cert of defaultCertificates) {
    await client.query(certQuery, [cert.name, cert.icon, organizationId]);
  }

  // 6. Stufen
  const levelQuery = `INSERT INTO levels (organization_id, name, title, points_required, icon, color, is_active, created_by)
                      VALUES ($1, $2, $3, $4, $5, $6, true, $7)`;
  for (const level of defaultLevels) {
    await client.query(levelQuery, [
      organizationId, level.name, level.title, level.points_required, level.icon, level.color, newAdmin.id
    ]);
  }

  // 7. Kategorien
  const categoryIdByKey = {};
  const categoryQuery = `INSERT INTO categories (name, description, type, organization_id)
                         VALUES ($1, $2, $3, $4) RETURNING id`;
  for (const cat of defaultCategories) {
    const { rows: [newCat] } = await client.query(categoryQuery, [cat.name, cat.description, cat.type, organizationId]);
    categoryIdByKey[cat.key] = newCat.id;
  }

  // 8. Aktivitaeten fuer Konfis und Team, mit Kategorie-Verknuepfung
  const activityQuery = `INSERT INTO activities (name, points, type, organization_id)
                         VALUES ($1, $2, $3, $4) RETURNING id`;
  const activityCategoryQuery = `INSERT INTO activity_categories (activity_id, category_id)
                                 VALUES ($1, $2)`;
  for (const act of defaultActivities) {
    const { rows: [newAct] } = await client.query(activityQuery, [act.name, act.points, act.type, organizationId]);
    const catId = categoryIdByKey[act.categoryKey];
    if (catId) {
      await client.query(activityCategoryQuery, [newAct.id, catId]);
    }
  }

  const teamerActivityQuery = `INSERT INTO activities (name, points, type, target_role, organization_id)
                               VALUES ($1, 0, NULL, 'teamer', $2) RETURNING id`;
  for (const act of defaultTeamerActivities) {
    const { rows: [newAct] } = await client.query(teamerActivityQuery, [act.name, organizationId]);
    const catId = categoryIdByKey[act.categoryKey];
    if (catId) {
      await client.query(activityCategoryQuery, [newAct.id, catId]);
    }
  }

  // 9. Beispiel-Challenges als Entwuerfe
  const challengeQuery = `INSERT INTO challenges (
    organization_id, title, description, challenge_type, visibility, moderated,
    badge_name, created_by, starts_at, ends_at, is_draft
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + INTERVAL '7 days', NOW() + INTERVAL '14 days', true)`;

  for (const challenge of defaultChallenges) {
    await client.query(challengeQuery, [
      organizationId, challenge.title, challenge.description, challenge.challenge_type,
      challenge.visibility, challenge.moderated, challenge.badge_name, newAdmin.id
    ]);
  }

  return {
    organizationId,
    adminId: newAdmin.id,
    anzahl: {
      // Wie bei den Aktivitaeten: Konfi- und Teamer-Vorlagen zusammen.
      abzeichen: defaultBadges.length + defaultTeamerBadges.length,
      zertifikate: defaultCertificates.length,
      stufen: defaultLevels.length,
      kategorien: defaultCategories.length,
      aktivitaeten: defaultActivities.length + defaultTeamerActivities.length,
      challenges: defaultChallenges.length,
    },
  };
}

module.exports = {
  gemeindeAnlegen,
  konfiLimitLesen,
  laufzeitLesen,
  fehlerAlsAntwort,
  MELDUNG_SLUG_VERGEBEN,
};
