// Befund B2b (27.08.2026): Das App-Icon hatte mehrere Schreiber mit
// unterschiedlicher Bedeutung.
//
// - Der Chat-Push setzte die CHAT-Unread-Zahl allein aufs Icon
//   (chat.js:1105, 1905) und ueberschrieb damit Antraege, Termine,
//   Challenge-Freigaben und Abzeichen.
// - Alle anderen Pushes fielen auf `badge: 1` zurueck (pushService.js:135,
//   265) -- egal, wie viel tatsaechlich offen war.
// - Nur der Client kannte die echte Summe (BadgeContext.totalBadgeCount),
//   konnte sie aber bei geschlossener App nicht setzen.
//
// Warum der Server rechnen muss und nicht einfach gar nichts setzt: Bei
// geschlossener App gibt es keinen Client. Genau dann ist das Icon aber das
// Einzige, was jemand sieht, bevor er die App oeffnet. Ohne Badge im Push
// bliebe es auf dem letzten Stand stehen.
//
// Diese Datei haelt die Summe an EINER Stelle. Sie muss mit
// BadgeContext.totalBadgeCount uebereinstimmen -- dieselbe Aufteilung je
// Rolle, dieselben Bestandteile. Aendert sich eine Seite, gehoert die andere
// nachgezogen; ein Test haelt die Zusammensetzung fest.
//
// Das Postfach zaehlt seit dem 28.09.2026 NICHT mehr mit (Simon, siehe
// die Begruendung weiter unten bei "Postfach"): Die Glocke zeigt fuer
// ungelesene Mitteilungen einen Briefumschlag statt einer Zahl.
//
// Bei mehreren Gemeinden (27.09.2026, Befund BF-12) ist die Zahl am Symbol
// die Summe ueber alle Gemeinden, je Gemeinde mit der dortigen Rolle:
// appIconSummenAllerGemeinden. Push, Hintergrund-Lauf und Gemeinde-Umschalter
// lesen alle diese eine Funktion; tests/services/appIconMehrereGemeinden.test.js
// haelt fest, dass sie dieselbe Zahl ergeben.
const { challengeNeuigkeitenJeChallenge, challengeNeuigkeitenLeitungJeChallenge } = require('./challengeNeuigkeiten');
const { leitungSiehtChallengeSql } = require('./challengeLeitungSicht');
const { gebundeneLeitungSiehtAntragSql } = require('./antragLeitungSicht');
const { ladeMitgliedschaftenVieler } = require('./orgMitglieder');
const { gebundeneLeitungSiehtTerminSql, terminWartetAufVerbuchungSql } = require('./terminLeitungSicht');

/**
 * Die Bausteine der Summe -- jeder als EINE Abfrage ueber viele
 * Personen (`= ANY($1)`), nicht als Abfrage pro Person.
 *
 * Genau hier liegt der Grund fuer den Zuschnitt: Einzel- und Bulk-Weg teilen
 * sich diese Bausteine. Der Einzelfall ist ein Array mit einem Element. Zwei
 * getrennte SQL-Fassungen derselben Regel waren der urspruengliche Fehler
 * (Befund B2b) -- sie laufen frueher oder spaeter auseinander.
 *
 * Jede Funktion liefert Zeilen `{ user_id, c }`; wer nicht vorkommt, hat 0.
 */

// Chat-Unread. Eigene Nachrichten zaehlen nicht mit -- dieselbe Bedingung
// wie in badge-counts.
//
// Die Zuordnung laeuft ueber (user_id, user_type): Ein und dieselbe id kann
// es in zwei Typen geben, deshalb reicht die id allein nicht als Schluessel.
//
// Alle personenbezogenen Zaehler liefern seit dem 25.09.2026 zusaetzlich
// z.organization_id und gruppieren danach. Fuer die Summe je Person aendert
// das nichts (die Zeilen einer Person werden ohnehin addiert); es erlaubt
// aber die Aufschluesselung je Gemeinde (appIconSummenJeOrganisation) in
// DENSELBEN Abfragen -- statt einer Abfragerunde pro Gemeinde.
async function chatZaehler(db, personen) {
  if (personen.length === 0) return [];
  return (await db.query(
    `SELECT p.user_id, p.user_type, z.organization_id,
            COALESCE(SUM(
              (SELECT COUNT(*)
                 FROM chat_messages m
                WHERE m.room_id = r.id
                  AND m.deleted_at IS NULL
                  AND m.created_at > COALESCE(crs.last_read_at, '1970-01-01')
                  -- Nachrichten aus der Zukunft zaehlen nicht -- wie am Reiter
                  -- (routes/notifications.js) seit dem 03.09.2026. Beim
                  -- Buendeln des Push-Fan-outs (26.09.2026) ging diese Zeile
                  -- verloren; das Symbol zeigte dann mehr als die Reiter.
                  AND m.created_at <= NOW()
                  AND NOT (m.user_id = p.user_id AND m.user_type = p.user_type))
            ), 0)::int AS c
       FROM chat_participants p
       JOIN chat_rooms r ON r.id = p.room_id
       LEFT JOIN chat_read_status crs
              ON crs.room_id = r.id AND crs.user_id = p.user_id AND crs.user_type = p.user_type
       JOIN unnest($1::int[], $2::text[], $3::int[]) AS z(user_id, user_type, organization_id)
              ON z.user_id = p.user_id AND z.user_type = p.user_type
      WHERE r.organization_id = z.organization_id
      GROUP BY p.user_id, p.user_type, z.organization_id`,
    spalten(personen)
  )).rows;
}

// Offene Antraege und unverarbeitete Termine haengen fuer den ORG-ADMIN nicht
// an der Person, sondern an der Organisation. Deshalb je Organisation einmal
// zaehlen und das Ergebnis auf alle org-weiten Leitungen dieser Organisation
// verteilen -- bei 20 Leitungen in einer Gemeinde ist das eine Abfrage statt 20.
//
// Fuer die Rolle 'admin' gilt das seit 01.09.2026 NICHT mehr: Sie ist an ihre
// zugewiesenen Jahrgaenge gebunden (Simons Regel vom 31.08.), badge-counts
// zaehlt fuer sie nur noch, was ihre Listen zeigen -- und das App-Icon muss
// dieselbe Summe tragen (Paritaets-Invariante B2b). Gebundene Admins laufen
// deshalb unten durch personenbezogene Zaehler (antragZaehlerGebunden,
// terminZaehlerGebunden, teamerFreigabeZaehler).
async function antragZaehlerProOrg(db, orgIds) {
  if (orgIds.length === 0) return [];
  return (await db.query(
    `SELECT a.organization_id, COUNT(*)::int AS c
       FROM activity_requests ar
       JOIN activities a ON ar.activity_id = a.id
      WHERE a.organization_id = ANY($1::int[]) AND ar.status = 'pending'
      GROUP BY a.organization_id`,
    [orgIds]
  )).rows;
}

// Abgesagte Termine zaehlen NICHT: Der "Verbuchen"-Tab blendet sie aus, also
// stuende sonst eine Zahl am Icon, hinter der eine leere Liste wartet.
// `IS NOT TRUE` statt `= FALSE`, weil die Spalte nullable ist -- Termine aus
// dem Altbestand tragen dort NULL und sind damit nicht abgesagt.
// Seit 27.09.2026 ueber die gemeinsame Bedingung terminWartetAufVerbuchungSql
// (utils/terminLeitungSicht.js) -- dieselbe wie badge-counts und die
// Verbuchen-Erinnerung um 09:00; Buchungen geloeschter Konten zaehlen seitdem
// wie in der Eventliste nicht mehr mit.
async function terminZaehlerProOrg(db, orgIds) {
  if (orgIds.length === 0) return [];
  return (await db.query(
    `SELECT e.organization_id, COUNT(*)::int AS c
       FROM events e
      WHERE e.organization_id = ANY($1::int[])
        AND ${terminWartetAufVerbuchungSql()}
      GROUP BY e.organization_id`,
    [orgIds]
  )).rows;
}

// Offene Antraege fuer GEBUNDENE Admins: Teamer-Antraege zaehlen immer
// (Teamer-Ausnahme), Konfi-Antraege nur aus zugewiesenen Jahrgaengen --
// exakt der Filter der Antragsliste und von badge-counts. ANY auf leerem
// Array trifft nichts: ohne Zuweisung bleiben nur Teamer-Antraege.
// Seit 27.09.2026 ueber die gemeinsame Regel (utils/antragLeitungSicht.js),
// nach der auch die Empfaenger von "Neuer Antrag eingegangen" bestimmt werden.
async function antragZaehlerGebunden(db, personen) {
  if (personen.length === 0) return [];
  return (await db.query(
    `SELECT z.user_id, z.user_type, z.organization_id, COUNT(ar.id)::int AS c
       FROM unnest($1::int[], $2::text[], $3::int[], $4::text[])
              AS z(user_id, user_type, organization_id, jahrgaenge)
       LEFT JOIN activities a ON a.organization_id = z.organization_id
       LEFT JOIN activity_requests ar
              ON ar.activity_id = a.id
             AND ar.status = 'pending'
             AND ${gebundeneLeitungSiehtAntragSql({ jahrgaenge: 'z.jahrgaenge::int[]' })}
      GROUP BY z.user_id, z.user_type, z.organization_id`,
    [...spalten(personen), jahrgangsSpalte(personen)]
  )).rows;
}

// Unverarbeitete Termine fuer GEBUNDENE Admins: derselbe Sichtbarkeits-Filter
// wie die Terminliste (events/lesen.js) und badge-counts -- Termine ohne
// Jahrgang und Teamer-Termine zaehlen immer, jahrgangsgebundene nur aus
// zugewiesenen Jahrgaengen. Abgesagte Termine bleiben hier ebenso aussen vor
// wie in terminZaehlerProOrg -- beide Wege muessen dieselbe Zahl liefern.
// Seit 27.09.2026 ueber die gemeinsame Regel (utils/terminLeitungSicht.js):
// "Team gesucht" (teamer_needed) zaehlt nicht mehr als Sichtbarkeitsgrund --
// die Liste hatte ihn am 08.09.2026 gestrichen, dieser Zaehler nicht
// (Audit wer-bekommt-was, BF-11).
async function terminZaehlerGebunden(db, personen) {
  if (personen.length === 0) return [];
  return (await db.query(
    `SELECT z.user_id, z.user_type, z.organization_id, COUNT(e.id)::int AS c
       FROM unnest($1::int[], $2::text[], $3::int[], $4::text[])
              AS z(user_id, user_type, organization_id, jahrgaenge)
       LEFT JOIN events e
              ON e.organization_id = z.organization_id
             AND ${terminWartetAufVerbuchungSql()}
             AND ${gebundeneLeitungSiehtTerminSql({ jahrgaenge: 'z.jahrgaenge::int[]' })}
      GROUP BY z.user_id, z.user_type, z.organization_id`,
    [...spalten(personen), jahrgangsSpalte(personen)]
  )).rows;
}

// Offene Challenge-Freigaben der ORG-WEITEN Leitung: org-weit, nicht personen-
// gebunden.
async function freigabeZaehlerProOrg(db, orgIds) {
  if (orgIds.length === 0) return [];
  return (await db.query(
    `SELECT c.organization_id, COUNT(*)::int AS c
       FROM challenge_submissions cs
       JOIN challenges c ON cs.challenge_id = c.id
      WHERE c.organization_id = ANY($1::int[]) AND cs.moderation_status = 'pending'
      GROUP BY c.organization_id`,
    [orgIds]
  )).rows;
}

// Offene Freigaben fuer Teamer:innen UND (seit 01.09.2026) gebundene Admins.
// Hier haengt der Zaehler an der Person, weil jede:r andere Jahrgaenge sieht.
//
// 'nur_team' ist ausdruecklich eingeschlossen: Solche Runden haben per
// Definition keine Jahrgangs-Zuordnung, sind aber fuer das ganze Team der
// Organisation moderierbar (Migration 121, Befund H4).
//
// Seit 27.09.2026 ueber die gemeinsame Regel (utils/challengeLeitungSicht.js);
// die Rolle geht je Person mit in die Abfrage (org_admin sieht alles).
async function teamerFreigabeZaehler(db, teamer) {
  if (teamer.length === 0) return [];
  const jahrgangsListen = jahrgangsSpalte(teamer);
  return (await db.query(
    `SELECT z.user_id, z.user_type, z.organization_id, COUNT(cs.id)::int AS c
       FROM unnest($1::int[], $2::text[], $3::int[], $4::text[], $5::text[])
              AS z(user_id, user_type, organization_id, jahrgaenge, rolle)
       LEFT JOIN challenges c
              ON c.organization_id = z.organization_id
       LEFT JOIN challenge_submissions cs
              ON cs.challenge_id = c.id
             AND cs.moderation_status = 'pending'
             AND ${leitungSiehtChallengeSql({ rolle: 'z.rolle', jahrgaenge: 'z.jahrgaenge::int[]' })}
      GROUP BY z.user_id, z.user_type, z.organization_id`,
    [...spalten(teamer), jahrgangsListen, rollenSpalte(teamer)]
  )).rows;
}

// Ungesehene Abzeichen. Die Leitung kann keine verdienen -> gar nicht erst
// abgefragt. `target_role` muss zum Typ passen, damit Teamer:innen keine
// Konfi-Abzeichen mitzaehlen.
async function abzeichenZaehler(db, personen) {
  if (personen.length === 0) return [];
  return (await db.query(
    `SELECT ub.user_id, z.user_type, z.organization_id, COUNT(*)::int AS c
       FROM user_badges ub
       JOIN custom_badges cb ON ub.badge_id = cb.id
       JOIN unnest($1::int[], $2::text[], $3::int[]) AS z(user_id, user_type, organization_id)
              ON z.user_id = ub.user_id AND z.organization_id = ub.organization_id
      WHERE ub.seen = false
        AND COALESCE(cb.target_role, 'konfi') = z.user_type
      GROUP BY ub.user_id, z.user_type, z.organization_id`,
    spalten(personen)
  )).rows;
}

// POSTFACH ZAEHLT NICHT MIT (28.09.2026, Entscheidung Simon als
// Produktverantwortlicher): Das Postfach bekommt keine Zahl mehr, sondern an
// der Glocke einen blauen Badge mit Briefumschlag, sobald mindestens eine
// Mitteilung ungelesen ist -- und es wird nicht mehr auf die Zahl am
// App-Symbol addiert. Gilt fuer alle drei Rollen und an jeder Stelle, die
// diese Rechnung liest: Push (sichtbar und still), Hintergrund-Lauf und
// Gemeinde-Umschalter (GET /notifications/badge-counts/je-organisation).
// Der Client rechnet dasselbe (BadgeContext.totalBadgeCount);
// tests/utils/appIconBadgeParitaet.test.js haelt beide Seiten fest.
//
// Die Zahl am Symbol ist damit wieder die Summe der Zahlen an den Reitern;
// eine Mitteilung zu einem offenen Antrag zaehlt den Antrag nicht mehr
// doppelt.
//
// UEBERHOLT ist damit die Entscheidung vom 25.09.2026 ("lass es dagegen
// zaehlen, bitte! Das, was an Benachrichtigungen drin ist, wird mit
// reingezaehlt, damit es logisch konsistent bleibt"), nach der hier ein
// postfachZaehler alle ungelesenen Mitteilungen ueber alle Gemeinden in die
// Summe gab (je Mitteilung einmal, bei ihrer Gemeinde oder der
// Stamm-Gemeinde). Die Abfrage entfaellt ganz -- eine Abfrage weniger je
// Zaehlrunde.
//
// UNVERAENDERT: badge-counts liefert postfach.ungelesen weiter mit Form und
// Wert (Vertrag mit der Store-App 2.3.0, die daraus die Anzeige an der
// Glocke macht). Was einen Push ausloest, bleibt ebenso; nur die
// mitgeschickte Zahl enthaelt das Postfach nicht mehr.

/** Zerlegt die Empfaengerliste in die drei parallelen Arrays fuer `unnest`. */
function spalten(personen) {
  return [
    personen.map((p) => p.id),
    personen.map((p) => p.type),
    personen.map((p) => p.organization_id)
  ];
}

/** Die can_view-Jahrgaenge je Person als Text-Array-Literal fuer `unnest`. */
function jahrgangsSpalte(personen) {
  return personen.map((p) =>
    `{${(p.assigned_jahrgaenge || []).filter((j) => j.can_view).map((j) => j.id).join(',')}}`
  );
}

/** Die Rolle je Person; Teamer:innen ohne role_name gelten als 'teamer'. */
function rollenSpalte(personen) {
  return personen.map((p) => p.role_name || (p.type === 'teamer' ? 'teamer' : 'admin'));
}

/** Schluessel der Zuordnung: id allein reicht nicht, der Typ gehoert dazu. */
function schluessel(userId, userType) {
  return `${userId}_${userType}`;
}

// Wie im Client: super_admin zaehlt NICHT als Admin-Typ (der Client schliesst
// sie ueber isAdmin ebenfalls aus) -- fuer sie gilt der Konfi-Zweig.
function istLeitung(empfaenger) {
  return empfaenger.type === 'admin' && empfaenger.role_name !== 'super_admin';
}

/**
 * Dieselbe Summe wie `berechneAppIconSumme`, aber fuer viele Personen in
 * wenigen Abfragen statt sieben pro Person.
 *
 * Warum es die Variante gibt: Der Hintergrund-Sync laeuft alle fuenf Minuten
 * ueber ALLE Nutzer:innen. Einzeln gerechnet waeren das bei 1000 Konfis rund
 * 7000 Abfragen je Takt. Hier sind es sechs -- unabhaengig von der Anzahl.
 *
 * Gemischte Rollen in einem Aufruf sind der Normalfall: Die rollenabhaengigen
 * Teile werden nach Rolle gruppiert abgefragt, wer nicht dazugehoert, taucht
 * in der jeweiligen Abfrage gar nicht erst auf.
 *
 * NUR FUER EINEN EINTRAG JE PERSON: Der Schluessel kennt die Gemeinde nicht.
 * Push und Hintergrund-Lauf riefen diese Funktion bis 27.09.2026 je Gemeinde
 * einmal und addierten -- mit der Rolle am Nutzerkonto fuer jede Gemeinde und
 * dem Postfach in jeder Runde (Befund BF-12). Die Zahl am Symbol kommt seither
 * aus appIconSummenAllerGemeinden.
 *
 * @param {object} db          Pool oder Client
 * @param {Array<object>} empfaenger  je { id, type, organization_id, role_name?, assigned_jahrgaenge? }
 * @returns {Promise<Map<string, number>>}  Schluessel `${id}_${type}`, Wert nie negativ
 */
async function appIconSummenFuerAlle(db, empfaenger) {
  return (await summenBerechnen(db, empfaenger, (id, type) => schluessel(id, type))).summen;
}

/**
 * Dieselben Bausteine, aber JE GEMEINDE aufgeschluesselt (25.09.2026, Simon:
 * "an jede Org einen Indikator haengen -- das wuerde helfen, wenn was offen
 * ist"). Der Gemeinde-Umschalter zeigt damit an jedem Eintrag, wo Arbeit
 * liegt, bevor man hineinwechselt.
 *
 * Die Empfaengerliste traegt DIESELBE Person einmal je Gemeinde -- mit der
 * Rolle und den Jahrgaengen, die sie DORT hat (orgMitglieder.js:
 * ladeMitgliedschaftenDerPerson). Wer in Gemeinde A org_admin und in B nur
 * Teamer:in ist, bekommt fuer B die Teamer-Zaehler. Bei
 * `appIconSummenFuerAlle` kaemen diese Eintraege auf EINEN Schluessel und
 * wuerden addiert; hier bleibt jede Gemeinde fuer sich.
 *
 * Eine Abfragerunde fuer alle Gemeinden zusammen, nicht eine je Gemeinde --
 * das ist der Grund, warum die personenbezogenen Zaehler oben
 * z.organization_id mitliefern.
 *
 * @returns {Promise<Map<string, number>>}  Schluessel `${id}_${type}_${organization_id}`
 */
async function appIconSummenJeOrganisation(db, empfaenger) {
  return (await summenBerechnen(db, empfaenger, (id, type, orgId) => `${schluessel(id, type)}_${orgId}`)).summen;
}

/**
 * DIE Zahl am App-Symbol -- fuer eine oder viele Personen, ueber ALLE ihre
 * Gemeinden (27.09.2026, Audit "Wer bekommt was", Befund BF-12, Frage F-09).
 *
 * Summe ueber alle Gemeinden der Person, je Gemeinde mit der Rolle und den
 * Jahrgaengen, die sie DORT hat. Postfach-Mitteilungen zaehlen seit dem
 * 28.09.2026 nicht mit (Begruendung oben bei "POSTFACH ZAEHLT NICHT MIT").
 *
 * VORHER gab es drei Rechnungen fuer diese Zahl, und sie liefen auseinander:
 * Push und Hintergrund-Lauf rechneten jede Gemeinde mit der Rolle am
 * Nutzerkonto (wer zuhause Org-Admin und in B Teamer:in ist, bekam Bs Antraege
 * mitgezaehlt, die er dort gar nicht sieht) und zaehlten das ganze Postfach in
 * jeder Gemeinde-Runde erneut; der Gemeinde-Umschalter rechnete richtig; die
 * offene App setzte nur die aktive Gemeinde. Gemessen im Audit (A11): Push 5,
 * Umschalter 2 + 0, App 2.
 *
 * JETZT lesen alle dieselbe Stelle: der Push an eine Person und an viele
 * (pushService.berechneBadgesFuerAlle), der Hintergrund-Lauf
 * (backgroundService.zaehlerUndAbzeichenLauf) und der Gemeinde-Umschalter
 * (GET /notifications/badge-counts/je-organisation), dessen Summe die offene
 * App bei mehreren Gemeinden aufs Symbol setzt (BadgeContext).
 *
 * Kosten: zwei Abfragen fuer die Zugehoerigkeit (ladeMitgliedschaftenVieler)
 * und EINE Zaehlrunde ueber alle Personen und Gemeinden zusammen -- nicht eine
 * je Gemeinde und nicht eine je Person.
 *
 * Fuer Personen mit einer Gemeinde ist das genau berechneAppIconSumme mit
 * ihrem einen Eintrag.
 *
 * @param {object} db
 * @param {Array<number>} userIds
 * @returns {Promise<Map<number, {summe:number, jeOrganisation:Map<number, number>,
 *   stamm_organization_id:number|null, mitgliedschaften:Array}>>}
 *   Je Person (Schluessel: id als Zahl) die Summe, die Aufteilung je Gemeinde
 *   (alle aktiven Gemeinden, auch mit 0) und die Stamm-Gemeinde. Geloeschte
 *   oder unbekannte Konten fehlen; wer keiner aktiven Gemeinde angehoert, hat
 *   die Summe 0. `mitgliedschaften` (seit 28.09.2026) reicht die Gemeinden
 *   mit der Rolle DORT aus ladeMitgliedschaftenVieler durch -- der
 *   Hintergrund-Lauf prueft damit die Badges je Gemeinde, ohne die zwei
 *   Abfragen ein zweites Mal zu stellen.
 */
async function appIconSummenAllerGemeinden(db, userIds) {
  const jePerson = await ladeMitgliedschaftenVieler(db, userIds);

  const empfaenger = [];
  for (const [userId, { mitgliedschaften }] of jePerson) {
    for (const m of mitgliedschaften) {
      empfaenger.push({
        id: userId,
        type: m.type,
        role_name: m.role_name,
        organization_id: m.organization_id,
        assigned_jahrgaenge: m.assigned_jahrgaenge
      });
    }
  }
  const { summen, alteApps } = await summenBerechnen(
    db, empfaenger, (id, type, orgId) => `${schluessel(id, type)}_${orgId}`
  );

  const ergebnis = new Map();
  for (const [userId, { mitgliedschaften, stamm_organization_id }] of jePerson) {
    const jeOrganisation = new Map();
    let summe = 0;
    let summeAlteApps = 0;
    for (const m of mitgliedschaften) {
      const k = `${schluessel(userId, m.type)}_${m.organization_id}`;
      const wert = summen.get(k) || 0;
      jeOrganisation.set(m.organization_id, wert);
      summe += wert;
      summeAlteApps += alteApps.get(k) || 0;
    }
    // summeAlteApps: die Zahl fuer Geraete der Store-Apps 2.2.x (ohne
    // Challenge-Neuigkeiten, siehe summenBerechnen).
    ergebnis.set(userId, { summe, summeAlteApps, jeOrganisation, stamm_organization_id, mitgliedschaften });
  }
  return ergebnis;
}

// Der gemeinsame Rechenkern. `schluesselVon(id, type, organization_id)`
// bestimmt, wie fein die Summe aufgeloest wird -- je Person oder je Person
// und Gemeinde. Die Zaehler-Abfragen und die Rollenregeln sind in beiden
// Faellen dieselben; es gibt absichtlich keine zweite Fassung davon.
async function summenBerechnen(db, empfaenger, schluesselVon) {
  const summen = new Map();
  if (!empfaenger || empfaenger.length === 0) return { summen, alteApps: new Map() };

  for (const p of empfaenger) summen.set(schluesselVon(p.id, p.type, p.organization_id), 0);

  // Challenge-Neuigkeiten kommen ohne organization_id zurueck (Konfis sind
  // immer Single-Org). Die Gemeinde dafuer aus der Empfaengerliste nehmen.
  const orgJeKonfi = new Map();
  for (const p of empfaenger) {
    const k = schluessel(p.id, p.type);
    if (!orgJeKonfi.has(k)) orgJeKonfi.set(k, p.organization_id);
  }

  const leitung = empfaenger.filter(istLeitung);
  // Jahrgangs-Bindung (01.09.2026): Nur org_admin zaehlt org-weit; die Rolle
  // 'admin' ist gebunden und laeuft durch dieselben personenbezogenen
  // Zaehler-Filter wie badge-counts. Das is_super_admin-Flag liegt hier
  // nicht vor -- in Produktion tragen es nur org_admin-Konten (gemessen
  // 31.08.2026), fuer die sich nichts aendert.
  const leitungOrgWeit = leitung.filter((p) => p.role_name === 'org_admin');
  const leitungGebunden = leitung.filter((p) => p.role_name !== 'org_admin');
  const teamer = empfaenger.filter((p) => p.type === 'teamer');
  const mitAbzeichen = empfaenger.filter((p) => p.type === 'konfi' || p.type === 'teamer');
  const leitungsOrgs = [...new Set(leitungOrgWeit.map((p) => p.organization_id))];

  // Challenge-Neuigkeiten: Konfis mit ihrer Regel (24.09.2026), Leitung und
  // Team seit 27.09.2026 mit der schlankeren aus challengeNeuigkeiten.js.
  const konfis = empfaenger.filter((p) => p.type === 'konfi');

  const [chat, antraege, termine, freigaben, gebundeneFreigaben, gebundeneAntraege, gebundeneTermine, abzeichen, neuigkeiten, leitungsNeuigkeiten] = await Promise.all([
    chatZaehler(db, empfaenger),
    antragZaehlerProOrg(db, leitungsOrgs),
    terminZaehlerProOrg(db, leitungsOrgs),
    freigabeZaehlerProOrg(db, leitungsOrgs),
    // Teamer:innen und gebundene Admins teilen sich die Freigaben-Regel
    // (nur_team immer, sonst zugewiesene Jahrgaenge).
    teamerFreigabeZaehler(db, [...teamer, ...leitungGebunden]),
    antragZaehlerGebunden(db, leitungGebunden),
    terminZaehlerGebunden(db, leitungGebunden),
    abzeichenZaehler(db, mitAbzeichen),
    // Dieselbe SQL-Fassung wie badge-counts.challengeUpdates -- die Zeilen
    // kommen je Challenge, hier werden sie je Person aufsummiert.
    challengeNeuigkeitenJeChallenge(db, konfis),
    // Kein Postfach mehr (28.09.2026, siehe "POSTFACH ZAEHLT NICHT MIT").
    // Challenge-Neuigkeiten fuer Leitung und Team (27.09.2026) -- dieselbe
    // SQL-Fassung wie badge-counts.challengeUpdates fuer diese Rollen.
    challengeNeuigkeitenLeitungJeChallenge(db, [...leitung, ...teamer])
  ]);

  // Zwei Summen in einem Durchgang (27.09.2026, Kompatibilitaet mit den
  // Store-Apps 2.2.x): `summen` ist die volle Zahl, `alteApps` die Rechnung
  // von 2.2.0 -- OHNE Challenge-Neuigkeiten. Sie kamen nach 2.2.0
  // (18.09.2026) dazu, und die alte App kann sie nicht abbauen: Sie ruft nie
  // mark-read fuer Challenges auf. Welche Summe ein Geraet bekommt,
  // entscheidet der Versand je Push-Token (pushService.badgeFuerGeraet).
  // Keine zusaetzliche Abfrage. (Bis 28.09.2026 fehlte hier auch das
  // Postfach; seitdem fehlt es in beiden Summen.)
  const alteApps = new Map([...summen.keys()].map((k) => [k, 0]));
  const addiere = (userId, userType, orgId, wert, auchAlteApps = true) => {
    const k = schluesselVon(userId, userType, orgId);
    if (summen.has(k)) summen.set(k, summen.get(k) + (wert || 0));
    if (auchAlteApps && alteApps.has(k)) alteApps.set(k, alteApps.get(k) + (wert || 0));
  };

  for (const r of chat) addiere(r.user_id, r.user_type, r.organization_id, r.c);
  for (const r of gebundeneFreigaben) addiere(r.user_id, r.user_type, r.organization_id, r.c);
  for (const r of gebundeneAntraege) addiere(r.user_id, r.user_type, r.organization_id, r.c);
  for (const r of gebundeneTermine) addiere(r.user_id, r.user_type, r.organization_id, r.c);
  for (const r of abzeichen) addiere(r.user_id, r.user_type, r.organization_id, r.c);
  // Challenge-Neuigkeiten nur in die volle Summe (siehe oben).
  for (const r of neuigkeiten) {
    addiere(r.user_id, r.user_type, orgJeKonfi.get(schluessel(r.user_id, r.user_type)), r.c, false);
  }
  for (const r of leitungsNeuigkeiten) addiere(r.user_id, r.user_type, r.organization_id, r.c, false);

  // Die org-weiten Zahlen auf jede ORG-WEITE Leitung dieser Organisation
  // verteilen (gebundene Admins haben ihre Zahlen oben schon bekommen).
  const proOrg = new Map();
  for (const reihe of [antraege, termine, freigaben]) {
    for (const r of reihe) proOrg.set(r.organization_id, (proOrg.get(r.organization_id) || 0) + r.c);
  }
  for (const p of leitungOrgWeit) addiere(p.id, p.type, p.organization_id, proOrg.get(p.organization_id) || 0);

  for (const [k, wert] of summen) summen.set(k, Math.max(0, wert));
  for (const [k, wert] of alteApps) alteApps.set(k, Math.max(0, wert));
  return { summen, alteApps };
}

/**
 * Zaehlt alles, was fuer eine Person offen ist -- exakt so, wie es der
 * Client im App-Icon anzeigt.
 *
 * Aufteilung je Rolle (identisch zu BadgeContext.totalBadgeCount):
 *   org_admin  Chat + offene Antraege + unverarbeitete Termine + Freigaben
 *              (org-weit)
 *   admin      dieselben Bausteine, aber seit 01.09.2026 auf die
 *              zugewiesenen Jahrgaenge gebunden (wie badge-counts:
 *              Teamer-Antraege, Termine ohne Jahrgang/Teamer-Termine und
 *              nur_team-Freigaben zaehlen immer)
 *   teamer     Chat + Freigaben + ungesehene Abzeichen
 *   konfi      Chat + ungesehene Abzeichen + Challenge-Neuigkeiten
 *              (seit 24.09.2026: neue Challenge, fremde Galerie-Beitraege,
 *              Moderation eigener Beitraege -- je seit dem letzten Oeffnen,
 *              nur laufende Challenges des eigenen Jahrgangs)
 *   Postfach   zaehlt fuer KEINE Rolle (seit 28.09.2026; vom 25. bis
 *              28.09.2026 zaehlte es fuer alle -- siehe "POSTFACH ZAEHLT
 *              NICHT MIT" oben)
 *
 * Fuer super_admin gilt der Konfi-Zweig (org-fremde Rolle, hat weder
 * Antraege noch Abzeichen noch Challenge-Neuigkeiten) -- der Client
 * schliesst sie ueber isAdmin ebenfalls aus.
 *
 * Der Einzelfall ist bewusst nur ein Bulk-Aufruf mit einem Element: So kann
 * es keine zweite, abweichende Fassung der Regeln geben.
 *
 * @param {object} db          Pool oder Client
 * @param {object} empfaenger  { id, type, organization_id, role_name?, assigned_jahrgaenge? }
 * @returns {Promise<number>}  Summe, nie negativ
 */
async function berechneAppIconSumme(db, empfaenger) {
  const summen = await appIconSummenFuerAlle(db, [empfaenger]);
  return summen.get(schluessel(empfaenger.id, empfaenger.type)) || 0;
}

module.exports = { berechneAppIconSumme, appIconSummenFuerAlle, appIconSummenJeOrganisation, appIconSummenAllerGemeinden };
