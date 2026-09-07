const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const { darfJahrgang, darfKonfi } = require('../utils/jahrgangsZugriff');
const { waehleKacheln, waehleTeamerKacheln } = require('../utils/wrappedKacheln');
const { seiteFuerKategorie, datumsFenster, STAVANGER_VON, STAVANGER_BIS } = require('../utils/wrappedKategorien');

module.exports = (db, rbacVerifier, roleHelpers) => {
  const { requireAdmin, requireOrgAdmin } = roleHelpers;
  const PushService = require('../services/pushService');

  // Schema-Migrationen: siehe backend/migrations/075_wrapped.sql

  // Deutsche Monatsnamen
  // Wochentage, indiziert wie EXTRACT(DOW): 0 = Sonntag.
  const WOCHENTAG_NAMEN = [
    'Sonntag', 'Montag', 'Dienstag', 'Mittwoch',
    'Donnerstag', 'Freitag', 'Samstag'
  ];

  const MONAT_NAMEN = [
    '', 'Januar', 'Februar', 'M\u00e4rz', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  // ====================================================================
  // HILFSFUNKTIONEN
  // ====================================================================

  /**
   * Der Zeitraum eines Rueckblicks als Datumsfenster [start, ende] (beide
   * inklusive).
   *
   * SIMONS REGEL (07.09.2026), woertlich:
   *   "bei konfi jahrgaengen muss das wrapped alles erfassen was der konfi
   *    gemacht hat. den ganzen zeitraum, bei manchen sind das auch zwei
   *    jahre. es sollte nur die option mit rein das man auch zwischenberichte
   *    machen kann" -- "Konfi regel. Immer vom anfang an bis zum jetzigen
   *    zeitpunkt."
   *   "Und bei teamern das erste wrapped geht vom anbeginn der zeit als
   *    teamer bis zum zeitpunkt des wrapped und dann immer bis zum letzten
   *    wrapped."
   *
   * Daraus:
   *   KONFI  -> Beginn der Konfi-Zeit bis HEUTE. Kein 1.9.-Fenster, kein
   *             Kalenderjahr, und der Konfirmationstermin schneidet NICHT
   *             mehr ab.
   *   TEAMER -> lueckenlose Kette: vom Ende der vorigen Teamer-Ausgabe
   *             derselben Organisation (beim ersten Mal: seit wann jemand im
   *             Team ist) bis HEUTE.
   *
   * WAS VORHER FALSCH WAR (gemessen an der Produktionsdatenbank, 07.09.2026):
   * Mit Konfirmationstermin setzte die Funktion start = (Jahr des Termins -1)
   * + '-09-01'. Eine echte Konfi in Org 1 (Jahrgang 12, Konfirmation
   * 2027-05-01) bekam damit 01.09.2026 bis 01.05.2027 -- ihre 20 Abzeichen
   * liegen aber alle im Sommer 2026, also DAVOR. Ihre Abzeichen-Seite zeigte
   * eine glatte 0. Genau das schliesst Simons Regel aus.
   *
   * Der Konfirmationstermin bleibt als ANGABE erhalten (die Konfirmations-
   * Seite und die Teilen-Karte zeigen ihn ueber `zeitraum.konfirmation`), er
   * bestimmt nur den Zeitraum nicht mehr.
   *
   * Die Funktion bleibt bewusst SYNCHRON und ohne Datenbank: Woher der Beginn
   * kommt, weiss der Aufrufer (Konfi-Profil, vorige Ausgabe, teamer_since) --
   * hier wird nur noch gerechnet. Das macht sie einzeln pruefbar.
   *
   * @param {string|Date|null} konfirmationTermin Nur noch Angabe, nie Grenze.
   * @param {string|Date|null} beginn  Beginn des Zeitraums (Konfi-Zeit bzw.
   *   Ende der vorigen Teamer-Ausgabe / teamer_since). Fehlt er, faellt der
   *   Zeitraum auf das laufende Konfi-Jahr zurueck -- besser eine bekannte
   *   Spanne als eine seit 1970.
   * @param {number} year  Nur noch fuer diesen Fallback.
   * @param {object|null} vorgabe  Ausdruecklich gesetzter Zeitraum aus dem
   *   Formular (Simons "Option fuer Zwischenberichte"). Geht IMMER vor.
   * @param {Date} jetzt  Ende des Zeitraums; injizierbar fuer Tests.
   *
   * Datumsstrings werden mit padStart gebaut, NICHT ueber
   * new Date(y, 8, 1).toISOString() -- letzteres rechnet Ortszeit nach UTC und
   * machte in Sommerzeit aus dem 1.9. den 31.8.
   */
  /**
   * Liest eine Zahl, die auf einer Spalte aus einer NEUEN Migration beruht.
   *
   * BEFUND 07.09.2026, gemessen: Produktion stand auf Migration 144, die
   * Spalte event_bookings.war_auf_warteliste (145) existierte dort nicht.
   * Die Abfrage im Snapshot hatte kein try/catch -- sie waere fuer JEDE
   * Konfi mit "column does not exist" abgebrochen.
   *
   * Dass die Migrationen beim Start automatisch laufen, rettet das NICHT:
   * runMigrations faengt Fehler ab und laesst den Server WEITERLAUFEN
   * (database.js, "Server laeuft weiter"). Schlaegt eine Migration aus
   * irgendeinem Grund fehl, startet das Backend trotzdem -- und ohne diese
   * Absicherung faellt der komplette Rueckblick still aus, wegen einer
   * einzigen Seite.
   *
   * WARUM SAVEPOINT UND NICHT NUR try/catch (das war der eigentliche
   * Fallstrick, gemessen am 07.09.2026): Der Teamer-Zweig laeuft in einer
   * Transaktion (BEGIN ... COMMIT). In PostgreSQL bricht EIN
   * fehlgeschlagenes Statement die ganze Transaktion ab -- jede weitere
   * Query scheitert danach mit "current transaction is aborted", ganz
   * gleich, ob der Fehler abgefangen wurde. Genau das stand hier schon
   * einmal fuer die Challenge-Freigaben: ein try/catch, das den Fehler
   * brav schluckte, waehrend der Teamer-Rueckblick trotzdem fuer jede
   * Person ausfiel. Der SAVEPOINT nimmt genau dieses eine Statement
   * zurueck und laesst die Transaktion heil.
   *
   * Dasselbe Muster steht in routes/users.js (Loeschweg, 22.08.2026).
   *
   * Nur die beiden Codes fuer "Spalte fehlt" (42703) und "Tabelle fehlt"
   * (42P01) werden geschluckt. Alles andere -- ein Tippfehler im SQL, ein
   * Timeout -- fliegt weiter: Ein echter Fehler darf sich nicht als
   * harmlose Null tarnen.
   *
   * @returns {Promise<number>} der gelesene Wert, oder 0 wenn die Spalte fehlt
   */
  async function zahlAusNeuerSpalte(client, sql, params, was) {
    // DER SAVEPOINT DARF NUR IN EINER TRANSAKTION GESETZT WERDEN.
    //
    // Beide Zweige benutzen diese Funktion, aber sie arbeiten
    // unterschiedlich: Der Teamer-Zweig laeuft in BEGIN ... COMMIT, der
    // Konfi-Zweig holt je Person einen eigenen Client aus dem Pool und
    // laeuft im Autocommit. Dort wirft `SAVEPOINT` selbst den Fehler
    // "SAVEPOINT can only be used in transaction blocks" -- und haette dann
    // genau den Ausfall verursacht, den diese Funktion verhindern soll
    // (gemessen 07.09.2026 im ersten Anlauf: alle Konfi-Snapshots weg).
    //
    // Deshalb wird der SAVEPOINT versucht und sein Scheitern hingenommen.
    // Im Autocommit braucht es ihn nicht: Dort reisst ein fehlgeschlagenes
    // Statement nichts mit sich, es gibt keine Transaktion zum Abbrechen.
    let mitSavepoint = false;
    try {
      await client.query('SAVEPOINT neue_spalte');
      mitSavepoint = true;
    } catch {
      // Kein Transaktionsblock -- dann eben ohne.
    }

    try {
      const { rows: [row] } = await client.query(sql, params);
      if (mitSavepoint) await client.query('RELEASE SAVEPOINT neue_spalte');
      return row ? (row.anzahl || 0) : 0;
    } catch (err) {
      if (mitSavepoint) {
        await client.query('ROLLBACK TO SAVEPOINT neue_spalte').catch(() => {});
      }
      if (err.code !== '42703' && err.code !== '42P01') throw err;
      // Alt-Deployment ohne die Migration. Der Rueckfall ist 0, und die
      // zugehoerige Seite faellt damit ueber ihre Bedingung in
      // wrappedKacheln.js einfach weg -- das richtige Verhalten: Ohne die
      // Spalte WEISS niemand etwas, eine Seite auf Verdacht waere schlimmer
      // als keine.
      console.warn(`Wrapped: ${was} nicht verfuegbar (${err.code}), Seite entfaellt:`, err.message);
      return 0;
    }
  }

  function berechneZeitraum(konfirmationTermin, year, vorgabe = null, beginn = null, jetzt = new Date()) {
    const iso = (d) => {
      // Ein reiner Datumsstring bleibt UNANGETASTET. new Date('2025-10-01')
      // ist Mitternacht UTC -- in Berlin also der 30.09. um 02:00, und
      // getDate() liefert 30. Genau diese Verschiebung hat schon einmal aus
      // dem 1.9. den 31.8. gemacht (siehe Kommentar oben); sie traefe jetzt
      // jeden Zeitraum, den jemand im Formular eintraegt.
      if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      const dt = (d instanceof Date) ? d : new Date(d);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };
    const konfirmation = konfirmationTermin ? iso(konfirmationTermin) : null;

    // Ein AUSDRUECKLICH gesetzter Zeitraum geht vor -- das ist Simons Option
    // fuer Zwischenberichte. Er kommt aus dem Anlege-Formular und steht so
    // auch in der Ausgabe (wrapped_ausgaben); die angezeigte Spanne und die
    // Zahlen darunter muessen dieselbe sein.
    if (vorgabe && vorgabe.start && vorgabe.ende) {
      return { start: iso(vorgabe.start), ende: iso(vorgabe.ende), konfirmation };
    }

    // Ohne Vorgabe: vom Beginn bis JETZT. "Jetzt" ist der Tag der Erzeugung
    // und wird im Snapshot festgeschrieben -- ein einmal erzeugter Rueckblick
    // aendert sich nie wieder.
    const ende = iso(jetzt);

    if (beginn) {
      const start = iso(beginn);
      // Ein Beginn NACH dem heutigen Tag (verschobene Uhr, Datenfehler) gaebe
      // ein Fenster, das nichts zaehlen kann. Dann lieber der Tag selbst.
      return { start: start > ende ? ende : start, ende, konfirmation };
    }

    // Kein Beginn ermittelbar (Altdaten ohne created_at, Teamer ohne
    // teamer_since und ohne Aktivitaet): das laufende Konfi-Jahr wie bisher.
    return { start: `${year - 1}-09-01`, ende, konfirmation };
  }

  /**
   * Das Ende der VORIGEN Teamer-Ausgabe dieser Organisation -- der Anfang der
   * naechsten (Simons Kette, 07.09.2026).
   *
   * "sagen wir ich werde teamer am 1.9.2025 und das wrapped wird
   *  freigeschaltet am 1.1.2027 dann bekomme ich diesen zeitraum. Und das
   *  naechste wrapped wird gestartet am 1.5.2028 dann geht es vom
   *  1.1.2027-1.5.2028"
   *
   * Genommen wird das GROESSTE zeitraum_ende, nicht die zuletzt angelegte
   * Ausgabe: Wer nachtraeglich einen Zwischenbericht ueber einen frueheren
   * Abschnitt anlegt, darf die Kette nicht zurueckdrehen.
   *
   * `ausserAusgabeId` schliesst die soeben angelegte Ausgabe aus. Sie steht
   * beim Erzeugen der Snapshots schon in der Tabelle (bewusst -- der
   * Fremdschluessel der Snapshots braucht sie) und faende sich sonst selbst
   * als eigene Vorgaengerin: Der Zeitraum begaenne dann an seinem eigenen
   * Ende und der Rueckblick zaehlte nichts.
   */
  async function ermittleVorigesTeamerEnde(client, orgId, ausserAusgabeId = null) {
    const { rows: [row] } = await client.query(
      `SELECT MAX(zeitraum_ende) AS ende
         FROM wrapped_ausgaben
        WHERE organization_id = $1
          AND wrapped_type = 'teamer'
          AND ($2::bigint IS NULL OR id <> $2::bigint)`,
      [orgId, ausserAusgabeId]
    );
    return row && row.ende ? row.ende : null;
  }

  /**
   * War diese Person bei der Sommerfreizeit 2026 nach Stavanger dabei?
   *
   * SIMONS VORGABE (07.09.2026): "kannst du bitte eine seite bauen fuer
   * sommerfreizeit 2026 stavanger norwegen. das sehen dann nur die teamer
   * und konfis die dabei waren. ich lege das als aktivitaet an mit
   * sommerfrezeit als kategorie."
   *
   * GEPRUEFT WIRD DIE KATEGORIE, nicht ein Aktivitaets- oder Terminname.
   * Beide Quellen zaehlen -- Aktivitaeten UND Termine -- weil die Fahrt je
   * nach Gemeinde als das eine oder das andere gefuehrt wird (dieselbe
   * Ueberlegung wie bei der Kategorie-Verteilung weiter unten).
   *
   * ZWEI FENSTER MUESSEN BEIDE ZUTREFFEN:
   *   1. der Zeitraum DIESES Rueckblicks (Simons Regel 07.09.2026: der
   *      Rueckblick zeigt nur, was in seiner Spanne liegt), und
   *   2. der Zeitraum der FAHRT selbst. Sonst loeste die Freizeit 2027
   *      dieselbe Norwegen-Seite noch einmal aus.
   *
   * DIE KATEGORIE EXISTIERT HEUTE IN KEINER GEMEINDE -- sie wird erst per
   * SQL angelegt. Bis dahin liefert diese Funktion ueberall false und die
   * Seite erscheint nirgends. Kein Fehler, keine leere Seite.
   *
   * Eine fehlende Tabelle oder Spalte darf den ganzen Rueckblick nicht
   * verhindern: Im Fehlerfall gilt "nicht dabei" (siehe zaehleWennMoeglich
   * weiter oben -- dieselbe Regel, hier auf einen Wahrheitswert bezogen).
   */
  async function warBeiStavanger(client, userId, orgId, zeitraumStart, zeitraumEnde) {
    // Der Schnitt der beiden Fenster. Liegt der Rueckblick ganz vor oder
    // ganz nach der Fahrt, ist er leer und wir fragen gar nicht erst.
    const von = zeitraumStart > STAVANGER_VON ? zeitraumStart : STAVANGER_VON;
    const bis = zeitraumEnde < STAVANGER_BIS ? zeitraumEnde : STAVANGER_BIS;
    if (von > bis) return false;

    try {
      const { rows: [row] } = await client.query(
        `SELECT EXISTS (
           SELECT 1
             FROM user_activities ua
             JOIN activity_categories ac ON ac.activity_id = ua.activity_id
             JOIN categories c ON c.id = ac.category_id
            WHERE ua.user_id = $1 AND ua.organization_id = $2
              AND LOWER(BTRIM(c.name)) = 'sommerfreizeit'
              AND ua.completed_date >= $3::date
              AND ua.completed_date < ($4::date + INTERVAL '1 day')
           UNION ALL
           SELECT 1
             FROM event_bookings eb
             JOIN events e ON eb.event_id = e.id
             JOIN event_categories ec ON ec.event_id = e.id
             JOIN categories c ON c.id = ec.category_id
            WHERE eb.user_id = $1 AND eb.organization_id = $2
              AND LOWER(BTRIM(c.name)) = 'sommerfreizeit'
              AND e.event_date >= $3::date
              AND e.event_date < ($4::date + INTERVAL '1 day')
         ) AS dabei`,
        [userId, orgId, von, bis]
      );
      return Boolean(row && row.dabei);
    } catch (err) {
      console.warn('Wrapped: Sommerfreizeit-Pruefung nicht moeglich, Seite entfaellt:', err.message);
      return false;
    }
  }

  async function generateKonfiSnapshot(client, userId, orgId, jahrgangId, year, zeitraumVorgabe = null) {
    // Konfirmationstermin je Jahrgang aus dem is_konfirmation-Event ableiten
    // (frueheste nicht-cancelled Konfirmation, org-gescopt) -- ersetzt die alte
    // Jahrgang-Stichtag-Spalte (D-04/D-05).
    const { rows: [konfirmationRow] } = await client.query(
      `SELECT MIN(e.event_date) AS termin
         FROM events e
         JOIN event_jahrgang_assignments eja ON e.id = eja.event_id
        WHERE eja.jahrgang_id = $1
          AND e.is_konfirmation = true
          AND e.organization_id = $2
          AND (e.cancelled IS NULL OR e.cancelled = false)`,
      [jahrgangId, orgId]
    );
    const konfirmationTermin = konfirmationRow && konfirmationRow.termin ? konfirmationRow.termin : null;

    // BEGINN DER KONFI-ZEIT -- der Anfang des Rueckblicks (Simons Regel
    // 07.09.2026: "Immer vom anfang an bis zum jetzigen zeitpunkt").
    //
    // QUELLE: konfi_profiles.created_at des Profils IN DIESEM Jahrgang.
    // Das ist der Tag, an dem die Person diesem Jahrgang zugeordnet wurde --
    // also der Beginn genau der Konfi-Zeit, die dieser Rueckblick erzaehlt.
    //
    // WARUM NICHT jahrgaenge.created_at: Das ist der Tag, an dem die LEITUNG
    // den Jahrgang anlegte, nicht der Tag, an dem diese Person dazukam. Wer
    // spaeter nachrueckt oder aus einem anderen Jahrgang wechselt, bekaeme
    // einen Zeitraum, der vor der eigenen Konfi-Zeit beginnt. Umgekehrt
    // liegt konfi_profiles.created_at bei einem nachtraeglich angelegten
    // Jahrgang nie VOR dem Jahrgang selbst.
    //
    // WARUM NICHT users.created_at: Ein Konto kann aelter sein als die
    // Konfi-Zeit (zweiter Jahrgang, Teamer, der spaeter Konfi wird) -- dann
    // zaehlte der Rueckblick eine fremde Zeit mit.
    //
    // Fehlt created_at (Altdaten), faellt berechneZeitraum auf das laufende
    // Konfi-Jahr zurueck.
    const { rows: [beginnRow] } = await client.query(
      `SELECT kp.created_at FROM konfi_profiles kp
        WHERE kp.user_id = $1 AND kp.jahrgang_id = $2`,
      [userId, jahrgangId]
    );
    const konfiBeginn = beginnRow && beginnRow.created_at ? beginnRow.created_at : null;

    const zeitraum = berechneZeitraum(konfirmationTermin, year, zeitraumVorgabe, konfiBeginn);
    const zeitraumStart = zeitraum.start;
    const zeitraumEnde = zeitraum.ende;

    // Punkte aus konfi_profiles.
    //
    // BEWUSST OHNE ZEITFILTER: Das sind laufende STAENDE, keine Ereignisse --
    // konfi_profiles fuehrt zwei Summenspalten und kein Datum, an dem sich
    // filtern liesse. Der Endspurt weiter unten vergleicht sie mit dem Ziel
    // des Jahrgangs; beides ist der aktuelle Stand und muss zueinander
    // passen.
    const { rows: [profile] } = await client.query(
      `SELECT kp.gottesdienst_points, kp.gemeinde_points
       FROM konfi_profiles kp
       WHERE kp.user_id = $1 AND kp.jahrgang_id = $2`,
      [userId, jahrgangId]
    );
    const gottesdienst = profile ? profile.gottesdienst_points : 0;
    const gemeinde = profile ? profile.gemeinde_points : 0;

    // Bonus-Punkte im Zeitraum.
    //
    // BEFUND 06.09.2026: Diese Query hatte als einzige EREIGNIS-Query keinen
    // Zeitfilter -- sie summierte alle Bonuspunkte seit Kontobeginn. Bei
    // einem Konto, das ein zweites Konfi-Jahr durchlaeuft, trug der
    // Rueckblick damit die Sonderpunkte des Vorjahres mit. bonus_points hat
    // ein completed_date (Spalte existiert in Produktion), der Filter war
    // also jederzeit moeglich.
    const { rows: [bonusRow] } = await client.query(
      `SELECT COALESCE(SUM(points), 0) as total FROM bonus_points
        WHERE konfi_id = $1 AND organization_id = $2
          AND completed_date >= $3::date
          AND completed_date < ($4::date + INTERVAL '1 day')`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );
    const bonus = parseInt(bonusRow.total, 10) || 0;

    // Termine: DIESELBE Zaehlregel wie das Konfi-Dashboard
    // (routes/konfi.js, eventCountSql) -- jede Buchung der Konfi, kein
    // Anwesenheits- und kein Jahrgangsfilter, nur zusaetzlich auf den
    // Wrapped-Zeitraum eingegrenzt.
    //
    // Befund W-A (01.09.2026): Wrapped zaehlte 'confirmed' + 'present' UND
    // jahrgangszugeordnet, das Dashboard jede Buchung. Fuer demo.emilia
    // (User 150, Org 4) ergab das 1 gegen 15. Gemessen in Produktion:
    // 15 Buchungen, davon 2 mit attendance_status='present' -- die uebrigen
    // 13 haben ihn schlicht auf NULL (8 liegen noch in der Zukunft, 5 sind
    // vorbei ohne je gepflegte Anwesenheit). 'present' ist damit KEIN Mass
    // fuer "besucht", sondern ein Mass dafuer, ob jemand die Liste gepflegt
    // hat. Ein Rueckblick, der einer Konfi 1 statt 15 Terminen zeigt, waere
    // schlicht falsch -- und sie hat das Jahr ueber 15 im Dashboard gesehen.
    // Deshalb: eine Regel, die des Dashboards.
    const { rows: [eventCount] } = await client.query(
      `SELECT COUNT(*) as count FROM event_bookings eb
       JOIN events e ON eb.event_id = e.id
       WHERE eb.user_id = $1 AND eb.organization_id = $2
         AND e.event_date >= $3::date
         AND e.event_date < ($4::date + INTERVAL '1 day')`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );
    const totalAttended = parseInt(eventCount.count, 10) || 0;

    // Gottesdienst-Count (Events mit point_type = 'gottesdienst')
    // Dieselbe Zaehlregel wie oben (frueher zaehlte diese Query in DERSELBEN
    // Funktion nach einer dritten Regel: present, aber ohne Jahrgangs-JOIN).
    const { rows: [gdCountRow] } = await client.query(
      `SELECT COUNT(*) as count FROM event_bookings eb
       JOIN events e ON eb.event_id = e.id
       WHERE eb.user_id = $1 AND eb.organization_id = $2
         AND e.point_type = 'gottesdienst'
         AND e.event_date >= $3::date
         AND e.event_date < ($4::date + INTERVAL '1 day')`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );
    const gottesdienstCount = parseInt(gdCountRow.count, 10) || 0;

    // Kategorie-Verteilung (Aktivitaeten nach Kategorie)
    //
    // GEMESSEN AM 02.09.2026 IN PRODUKTION -- der Grund fuer diese Abfrage:
    // Frueher stand hier COALESCE(a.category, a.type). Das Textfeld
    // activities.category ist aber bei ALLEN 48 Aktivitaeten NULL und wird
    // nirgends im Code befuellt. Die Abfrage fiel damit ausnahmslos auf
    // a.type zurueck, und das kennt nur 'gottesdienst', 'gemeinde' und NULL.
    // Der Rueckblick zeigte also nie die echte Kategorie, sondern den Typ --
    // und die geplanten Kategorie-Seiten haetten nie greifen koennen.
    //
    // Die echten Zuordnungen stehen in der Junction-Tabelle
    // activity_categories (35 Zuordnungen in Produktion), die ueber
    // categories.name die frei vergebenen Namen der Gemeinde traegt
    // ("Sonntag", "Kasualien", "Gottesdienst an Weihnachten", ...).
    //
    // FALLBACK BLEIBT: Eine Aktivitaet ohne jede Zuordnung faellt weiterhin
    // auf a.type zurueck. Sonst verloeren Gemeinden, die ihre Kategorien nie
    // gepflegt haben, ihre Schwerpunkt-Seite ersatzlos -- der Rueckblick
    // wuerde fuer sie aermer statt richtiger.
    //
    // MEHRFACHZUORDNUNG: Eine Aktivitaet darf in mehreren Kategorien liegen.
    // Sie zaehlt dann in jeder -- das ist gewollt: Wer bei einem Termin war,
    // der Kasualie UND Gottesdienst ist, war in beiden Bereichen unterwegs.
    //
    // BEIDE QUELLEN (Simons Einwand 03.09.2026): "Die Kategorien, die wir in
    // Events nutzen, koennen wir doch auch benutzen!" -- richtig, und sie
    // sind sogar die kraeftigere Quelle. Gemessen in Produktion:
    //   activity_categories: 35 Zuordnungen
    //   event_categories:    76 Zuordnungen auf 69 von 111 Terminen
    // Und die Namen unterscheiden sich stark. Bei Terminen fuehren
    // "Gruppen/ Treffen" (17), "Aktion" (16) und "Konfitreff" (9) -- alles
    // Namen, die bei den Aktivitaeten praktisch nicht vorkommen. Haette der
    // Rueckblick nur Aktivitaeten gelesen, waeren genau die Seiten leer
    // geblieben, die eine Gemeinde am ehesten erwartet (Jugend, Freizeit,
    // Oeffentlichkeitsarbeit).
    //
    // event_categories ist gebaut wie activity_categories (event_id,
    // category_id) und zeigt auf dieselbe categories-Tabelle -- die
    // Erkennungsliste in utils/wrappedKategorien.js gilt deshalb fuer beide
    // Quellen unveraendert.
    //
    // GETRENNT GEZAEHLT: 'aus_terminen' und 'aus_aktivitaeten' bleiben
    // einzeln erhalten, damit die Seite "du warst bei 4 Terminen" sagen kann
    // statt einer aufgeblaehten Gesamtsumme. 'count' ist die Summe fuer die
    // Sortierung und bleibt formgleich zu frueher (Alt-App-Vertrag: das Feld
    // existierte schon und behaelt Name und Typ).
    //
    // JEDER TERMIN ZAEHLT NUR EINMAL (Simon, 07.09.2026).
    //
    // BEFUND: Die Vorrang-Regel "Datum schlaegt Kategorie" steuerte bis
    // dahin nur die REIHENFOLGE der Seiten (wrappedKacheln.js), nicht die
    // Zahlen. Ein Gottesdienst in der Passionszeit zaehlte auf der
    // Oster-Seite UND auf der Gottesdienst-Seite -- dieselbe Stunde in
    // derselben Kirche, zweimal erzaehlt. Simons Regel dazu steht seit dem
    // 02.09.2026 in wrappedKategorien.js: "Eine Person bekommt nie zwei
    // Seiten ueber denselben Termin." Sie war nur nie bis in die Zahlen
    // durchgezogen.
    //
    // WARUM DIE AUFTEILUNG IN JS UND NICHT IN SQL: Welches Datum in welches
    // Fenster faellt, entscheidet datumsFenster() -- mit der Gaussschen
    // Osterformel darin. Die gehoert an EINE Stelle. Sie in SQL
    // nachzubauen hiesse, sie zweimal zu pflegen, und die zweite Fassung
    // liefe beim ersten Schaltjahr auseinander.
    //
    // Die Termine kommen deshalb EINZELN (Datum + Kategorie) und werden
    // unten in JS zugeordnet. Die Aktivitaeten bleiben in SQL gruppiert:
    // Sie haben kein Datum, das ein Fenster treffen koennte -- sie tragen
    // nur ein completed_date, das sagt, wann jemand sie eingetragen hat,
    // nicht wann das Ereignis war.
    const { rows: aktivitaetenVerteilung } = await client.query(
      `SELECT COALESCE(c.name, a.type) AS kategorie, COUNT(*)::int AS anzahl
         FROM user_activities ua
         JOIN activities a ON ua.activity_id = a.id
         LEFT JOIN activity_categories ac ON ac.activity_id = a.id
         LEFT JOIN categories c ON c.id = ac.category_id
        WHERE ua.user_id = $1 AND ua.organization_id = $2
          AND ua.completed_date >= $3::date
          AND ua.completed_date < ($4::date + INTERVAL '1 day')
          AND COALESCE(c.name, a.type) IS NOT NULL
        GROUP BY COALESCE(c.name, a.type)`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );

    // Die Termine EINZELN, mit Datum und Kategorie.
    //
    // Dieselbe Zaehlregel wie die Termin-Zahl weiter oben: jede Buchung der
    // Person, kein Anwesenheitsfilter (attendance_status ist in Produktion
    // ueberwiegend NULL und waere ein Mass dafuer, ob jemand die Liste
    // gepflegt hat, nicht dafuer, ob die Konfi da war).
    //
    // LEFT JOIN auf die Kategorien: Ein Termin OHNE Kategorie soll trotzdem
    // in den Datums-Fenstern zaehlen. Mit dem frueheren INNER JOIN fehlte
    // er dort -- die Datums-Seiten lasen ihre Zahl aus einer eigenen
    // Abfrage, die keine Kategorie verlangte, und beide liefen darum schon
    // vorher auseinander.
    const { rows: terminRows } = await client.query(
      `SELECT e.id AS event_id, e.event_date, c.name AS kategorie
         FROM event_bookings eb
         JOIN events e ON eb.event_id = e.id
         LEFT JOIN event_categories ec ON ec.event_id = e.id
         LEFT JOIN categories c ON c.id = ec.category_id
        WHERE eb.user_id = $1 AND eb.organization_id = $2
          AND e.event_date >= $3::date
          AND e.event_date < ($4::date + INTERVAL '1 day')`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );

    // Jetzt die Vorrang-Regel, Termin fuer Termin.
    //
    // Ein Termin mit MEHREREN Kategorien erscheint hier mehrfach (eine
    // Zeile je Kategorie). Er ist trotzdem EIN Termin: Faellt er in ein
    // Datums-Fenster, zaehlt er dort einmal und bei KEINER seiner
    // Kategorien. Faellt er in keins, zaehlt er bei seinen Kategorien --
    // dort dann bei jeder, wie bisher auch.
    const terminNachId = new Map();
    for (const r of terminRows) {
      const eintrag = terminNachId.get(r.event_id) || { datum: r.event_date, kategorien: [] };
      if (r.kategorie) eintrag.kategorien.push(r.kategorie);
      terminNachId.set(r.event_id, eintrag);
    }

    const datumsFensterZaehler = {};
    const kategorieAusTerminen = new Map();
    for (const { datum, kategorien } of terminNachId.values()) {
      const fenster = datumsFenster(datum);
      if (fenster) {
        // DATUM GEWINNT: Der Termin zaehlt hier -- und nirgends sonst.
        datumsFensterZaehler[fenster] = (datumsFensterZaehler[fenster] || 0) + 1;
        continue;
      }
      for (const k of kategorien) {
        kategorieAusTerminen.set(k, (kategorieAusTerminen.get(k) || 0) + 1);
      }
    }

    // Aktivitaeten und (bereinigte) Termine zu einer Verteilung
    // zusammenfuehren. Form und Feldnamen bleiben unveraendert -- alte
    // Apps lesen 'kategorie', 'count', 'aus_terminen' und
    // 'aus_aktivitaeten' genau wie bisher.
    const verteilungNachName = new Map();
    for (const r of aktivitaetenVerteilung) {
      verteilungNachName.set(r.kategorie, {
        kategorie: r.kategorie,
        aus_aktivitaeten: parseInt(r.anzahl, 10) || 0,
        aus_terminen: 0
      });
    }
    for (const [name, anzahl] of kategorieAusTerminen) {
      const vorhanden = verteilungNachName.get(name)
        || { kategorie: name, aus_aktivitaeten: 0, aus_terminen: 0 };
      vorhanden.aus_terminen += anzahl;
      verteilungNachName.set(name, vorhanden);
    }
    const kategorieVerteilung = [...verteilungNachName.values()]
      .map(v => ({ ...v, count: v.aus_aktivitaeten + v.aus_terminen }))
      // Kategorien, die NUR ueber Datums-Termine kamen, stehen jetzt bei
      // null -- sie fallen heraus statt als leere Seite zu erscheinen.
      .filter(v => v.count > 0)
      .sort((a, b) => b.count - a.count || String(a.kategorie).localeCompare(String(b.kategorie)));

    // Die DATEN der besuchten Termine -- Grundlage der Datums-Seiten
    // (Advent, Weihnachten, Ostern ...).
    //
    // Sie kommen jetzt aus derselben Abfrage wie die Kategorien (oben,
    // terminRows) statt aus einer zweiten. Bis zum 07.09.2026 gab es dafuer
    // eine eigene Abfrage -- und damit zwei Wahrheiten ueber dieselben
    // Termine, die auseinanderlaufen konnten, sobald eine der beiden
    // Bedingungen sich aenderte. Genau ein Termin, genau eine Zeile.
    const termineDaten = [...terminNachId.values()].map(t => t.datum);

    // Die Sonderseite zur Sommerfreizeit 2026 (Stavanger). Ein reiner
    // Wahrheitswert -- die "14 Tage" auf der Seite sind fester Text, keine
    // gerechnete Zahl (siehe warBeiStavanger und wrappedKacheln.js).
    const stavanger2026 = await warBeiStavanger(client, userId, orgId, zeitraumStart, zeitraumEnde);

    // Gesamt-Events verfuegbar für diesen Jahrgang.
    // BEWUSST OHNE ZEITFILTER: die Bezugsgroesse "wie viele Termine gab es
    // ueberhaupt", nicht eine Zahl aus dem Zeitraum.
    const { rows: [totalEventsRow] } = await client.query(
      `SELECT COUNT(DISTINCT e.id) as count FROM events e
       JOIN event_jahrgang_assignments eja ON e.id = eja.event_id AND eja.jahrgang_id = $2
       WHERE e.organization_id = $1`,
      [orgId, jahrgangId]
    );
    const totalAvailable = parseInt(totalEventsRow.count, 10) || 0;

    // Lieblings-Event (letztes besuchtes)
    const { rows: favoriteRows } = await client.query(
      `SELECT e.name, e.event_date FROM event_bookings eb
       JOIN events e ON eb.event_id = e.id
       WHERE eb.user_id = $1 AND eb.organization_id = $2
         AND e.event_date >= $3::date
         AND e.event_date < ($4::date + INTERVAL '1 day')
       ORDER BY e.event_date DESC LIMIT 1`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );
    const lieblingsEvent = favoriteRows.length > 0
      ? { name: favoriteRows[0].name, date: favoriteRows[0].event_date }
      : null;

    // Abzeichen -- BEWUSST OHNE ZEITFILTER, wie die Punkte weiter oben:
    // Das sind laufende STAENDE, keine Ereignisse. Ein Abzeichen bleibt,
    // wenn es einmal verliehen ist; awarded_date sagt nur, WANN es dazukam.
    //
    // BEFUND 06.09.2026 (Demo-Gemeinde, Org 4): Der frueher hier stehende
    // Filter auf awarded_date warf 146 von 162 Verleihungen heraus -- ihr
    // Datum liegt in der Zukunft. Alle 13 Rueckblicke zeigten daraufhin
    // total_earned = 1, waehrend die Leute 8 bis 19 Abzeichen hatten; die
    // Seite gratulierte jedem zum "ersten" Abzeichen.
    //
    // Der Filter war ausserdem in sich widerspruechlich: Die Seite zeigt
    // "x von y", und y (total_available) war noch nie gefiltert. Ein
    // gefilterter Zaehler ueber einem ungefilterten Nenner kann nur
    // schieflaufen.
    //
    // NICHT BETROFFEN ist "Das erste Abzeichen" im Teamer-Zweig: Die Seite
    // will ausdruecklich das FRUEHESTE des Zeitraums, nicht den Bestand,
    // und hat dafuer eine eigene Abfrage mit eigenem Zeitfilter.
    const { rows: badgeRows } = await client.query(
      `SELECT cb.name, cb.icon, cb.color FROM user_badges ub
       JOIN custom_badges cb ON ub.badge_id = cb.id
       WHERE ub.user_id = $1 AND ub.organization_id = $2
       ORDER BY ub.awarded_date DESC`,
      [userId, orgId]
    );
    // BEWUSST OHNE ZEITFILTER: wie viele Abzeichen es in der Gemeinde gibt.
    // Eine Konfiguration der Gemeinde, kein Ereignis im Zeitraum.
    //
    // ABER MIT DENSELBEN GRENZEN WIE DIE ABZEICHEN-ANSICHT DER APP
    // (routes/badges.js): nur aktive Abzeichen und nur die fuer Konfis.
    // Ohne die beiden Bedingungen zaehlte der Nenner Abzeichen mit, die
    // eine Konfi gar nicht bekommen kann -- gemessen am 06.09.2026 in Org 1
    // 56 statt 45, in Org 4 zeigte der Rueckblick 31 und die App 27. Die
    // Stufe "Alle. Wirklich alle." konnte damit nie greifen.
    //
    // is_hidden bleibt BEWUSST ungefiltert: Versteckte Abzeichen sind
    // erreichbar, sie werden nur nicht vorab angezeigt.
    const { rows: [totalBadgesRow] } = await client.query(
      `SELECT COUNT(*) as count FROM custom_badges
        WHERE organization_id = $1
          AND is_active = true
          AND target_role = 'konfi'`,
      [orgId]
    );
    const totalBadgesAvailable = parseInt(totalBadgesRow.count, 10) || 0;

    // DAS SELTENSTE ABZEICHEN -- Simons Idee vom 02.09.2026, ausdruecklich
    // gewuenscht: "Das haben nur x %."
    //
    // Warum das eine besondere Seite ist: Es ist die einzige Stelle im
    // Rueckblick, die etwas ueber die SELTENHEIT einer Leistung sagt. Alle
    // anderen Zahlen sind absolut ("8 Termine") -- diese hier setzt sie ins
    // Verhaeltnis und macht sie damit teilenswert.
    //
    // KEINE RANGLISTE UEBER MENSCHEN (Simons Regel, Migration 118): Die
    // Aussage gilt dem ABZEICHEN, nicht der Person. "Das haben nur 8 %"
    // sagt nichts darueber, wer sonst noch was hat.
    //
    // Gezaehlt wird gegen die Konfis der ganzen Organisation, nicht des
    // Jahrgangs: Bei 13 Konfis im Jahrgang waeren die Prozente grob
    // gerastert (jede Person = 7,7 Punkte) und wenig aussagekraeftig.
    const { rows: [seltenstes] } = await client.query(
      `WITH konfis_gesamt AS (
         SELECT COUNT(*)::int AS n
           FROM users u
           JOIN roles r ON r.id = u.role_id
          WHERE r.name = 'konfi' AND u.organization_id = $2
            AND u.deleted_at IS NULL
       )
       SELECT cb.name, cb.icon, cb.color,
              COUNT(DISTINCT alle.user_id)::int AS haben_es,
              (SELECT n FROM konfis_gesamt) AS konfis
         FROM user_badges meins
         JOIN custom_badges cb ON cb.id = meins.badge_id
         LEFT JOIN user_badges alle ON alle.badge_id = cb.id
        WHERE meins.user_id = $1
          AND meins.organization_id = $2
          AND meins.awarded_date >= $3::date
          AND meins.awarded_date < ($4::date + INTERVAL '1 day')
        GROUP BY cb.id, cb.name, cb.icon, cb.color
        -- Das seltenste zuerst; bei Gleichstand das zuletzt verliehene,
        -- damit die Seite nicht bei jedem Lauf ein anderes zeigt.
        ORDER BY haben_es ASC, cb.id ASC
        LIMIT 1`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );

    // Prozent nur, wenn es ueberhaupt Konfis gibt und die Zahl etwas
    // bedeutet. Bei 2 Konfis waere "50 %" eine Zahl ohne Aussage.
    const seltenstesAbzeichen = (seltenstes && seltenstes.konfis >= 5)
      ? {
          name: seltenstes.name,
          icon: seltenstes.icon,
          color: seltenstes.color,
          haben_es: seltenstes.haben_es,
          konfis: seltenstes.konfis,
          prozent: Math.max(1, Math.round((seltenstes.haben_es / seltenstes.konfis) * 100))
        }
      : null;

    // Pflicht-Events
    const { rows: [pflichtRow] } = await client.query(
      `SELECT
        COUNT(*) FILTER (WHERE eb.attendance_status = 'present') as besucht,
        COUNT(*) as gesamt
       FROM events e
       JOIN event_jahrgang_assignments eja ON e.id = eja.event_id AND eja.jahrgang_id = $3
       LEFT JOIN event_bookings eb ON eb.event_id = e.id AND eb.user_id = $1
       WHERE e.organization_id = $2 AND e.mandatory = true AND e.cancelled IS NOT TRUE
         AND e.event_date >= $4::date
         AND e.event_date < ($5::date + INTERVAL '1 day')`,
      [userId, orgId, jahrgangId, zeitraumStart, zeitraumEnde]
    );
    const pflichtBesucht = parseInt(pflichtRow?.besucht || '0', 10);
    const pflichtGesamt = parseInt(pflichtRow?.gesamt || '0', 10);

    // Absagen.
    // Befund W-B (01.09.2026): Diese Query hatte WEDER Org-Filter noch
    // Zeitfilter -- bei einem Konto in mehreren Organisationen zaehlte sie
    // Absagen fremder Gemeinden mit. Das ist eine Mandantengrenze, beide
    // Filter sind jetzt gesetzt.
    const { rows: [cancelRow] } = await client.query(
      `SELECT COUNT(*) as count FROM event_bookings eb
       JOIN events e ON eb.event_id = e.id
       WHERE eb.user_id = $1 AND eb.organization_id = $2 AND eb.status = 'cancelled'
         AND e.event_date >= $3::date
         AND e.event_date < ($4::date + INTERVAL '1 day')`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );
    const eventAbgesagt = parseInt(cancelRow.count, 10) || 0;

    // Aktivster Monat (Aktivitäten + Events kombiniert)
    // Befund W-B: EXTRACT(MONTH ...) ohne Jahresfilter warf Maerz 2026 und
    // Maerz 2027 in denselben Topf -- "dein aktivster Monat" wurde mit jedem
    // Jahr falscher. Jetzt auf den Wrapped-Zeitraum begrenzt.
    const { rows: monatRows } = await client.query(
      `SELECT monat, COUNT(*) as count FROM (
         SELECT EXTRACT(MONTH FROM completed_date)::int as monat
         FROM user_activities
         WHERE user_id = $1 AND organization_id = $2
           AND completed_date >= $3::date
           AND completed_date < ($4::date + INTERVAL '1 day')
         UNION ALL
         SELECT EXTRACT(MONTH FROM e.event_date)::int as monat
         FROM event_bookings eb
         JOIN events e ON eb.event_id = e.id
         WHERE eb.user_id = $1 AND eb.organization_id = $2
           AND e.event_date >= $3::date
           AND e.event_date < ($4::date + INTERVAL '1 day')
       ) combined
       GROUP BY monat
       ORDER BY count DESC
       LIMIT 1`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );
    const aktivsterMonat = monatRows.length > 0
      ? { monat: monatRows[0].monat, monat_name: MONAT_NAMEN[monatRows[0].monat] || '', aktivitaeten: parseInt(monatRows[0].count, 10) }
      : { monat: 0, monat_name: '', aktivitaeten: 0 };

    // WARTELISTE-HELD:IN -- wie oft jemand nachgerueckt ist.
    //
    // Die Spalte war_auf_warteliste setzt promoteFromWaitlist im Moment des
    // Nachrueckens (Migration 145). NULL heisst UNBEKANNT (Bestandszeilen
    // von vor der Migration), nicht "nein" -- deshalb wird hier auf
    // ausdrueckliches true geprueft und nicht auf "nicht false".
    //
    // EINE FEHLENDE SPALTE DARF DEN RUECKBLICK NICHT SPRENGEN (Befund
    // 07.09.2026, gemessen: Produktion stand auf Migration 144, die Spalte
    // existierte dort nicht). Die Migrationen laufen zwar beim Start
    // automatisch -- aber runMigrations FAENGT FEHLER AB und laesst den
    // Server weiterlaufen (database.js: "Server laeuft weiter"). Schlaegt
    // 145 aus irgendeinem Grund fehl, startet das Backend trotzdem, und
    // ohne dieses try/catch braeche generateKonfiSnapshot danach fuer JEDE
    // Konfi mit "column does not exist" ab: ein stiller Totalausfall des
    // gesamten Rueckblicks wegen einer einzigen Seite.
    //
    // Der Rueckfall ist 0, und damit faellt die Seite ueber ihre Bedingung
    // in wrappedKacheln.js (nachgerueckt > 0) einfach weg. Das ist das
    // richtige Verhalten: Ohne die Spalte WEISS niemand, wer gewartet hat --
    // eine Seite auf Verdacht waere schlimmer als keine.
    //
    // Dasselbe Muster steht weiter unten bei den Challenge-Freigaben
    // (approved_by, Migration 146).
    const nachgerueckt = await zahlAusNeuerSpalte(
      client,
      `SELECT COUNT(*)::int AS anzahl FROM event_bookings eb
         JOIN events e ON eb.event_id = e.id
        WHERE eb.user_id = $1 AND eb.organization_id = $2
          AND eb.war_auf_warteliste IS TRUE
          AND e.event_date >= $3::date
          AND e.event_date < ($4::date + INTERVAL '1 day')`,
      [userId, orgId, zeitraumStart, zeitraumEnde],
      'Warteliste (Migration 145)'
    );

    // DER LANGE ATEM -- die Spanne zwischen erstem und letztem Termin.
    //
    // Die Aussage ist "du warst ueber das ganze Jahr hinweg dabei", nicht
    // "du hast viele Termine". Deshalb zaehlt hier die SPANNE, nicht die
    // Menge -- und deshalb braucht die Seite eine Mindestzahl an Terminen
    // (siehe Bedingung in wrappedKacheln.js): Bei zwei Terminen im September
    // und im Mai waeren es rechnerisch auch 240 Tage, aber die Zahl erzaehlte
    // dann das Gegenteil von dem, was sie behauptet.
    //
    // Gerechnet in Berliner Zeit: event_date ist ein Zeitstempel mit Zone,
    // und ein Termin am Sonntagabend um 20 Uhr gehoert zum Sonntag, nicht
    // zum Montag in UTC.
    const { rows: [spanneRow] } = await client.query(
      `SELECT
         MIN((e.event_date AT TIME ZONE 'Europe/Berlin')::date) AS erster,
         MAX((e.event_date AT TIME ZONE 'Europe/Berlin')::date) AS letzter,
         COUNT(*)::int AS anzahl
       FROM event_bookings eb
       JOIN events e ON eb.event_id = e.id
       WHERE eb.user_id = $1 AND eb.organization_id = $2
         AND e.event_date >= $3::date
         AND e.event_date < ($4::date + INTERVAL '1 day')`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );
    // Die Spalten kommen als DATE zurueck. Sie in einen ISO-String zu
    // giessen, darf NICHT ueber toISOString() laufen -- das rechnet nach UTC
    // und schoebe das Datum um einen Tag (derselbe Fehler, den
    // berechneZeitraum() schon einmal hatte).
    const alsDatum = (d) => {
      const dt = (d instanceof Date) ? d : new Date(d);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };
    const langerAtem = (spanneRow && spanneRow.erster && spanneRow.letzter)
      ? {
          erster: alsDatum(spanneRow.erster),
          letzter: alsDatum(spanneRow.letzter),
          tage: Math.round(
            (new Date(spanneRow.letzter).getTime() - new Date(spanneRow.erster).getTime())
            / (24 * 60 * 60 * 1000)
          ),
          termine: spanneRow.anzahl
        }
      : null;

    // DEIN WOCHENTAG -- an welchem Tag die Termine ueberwiegend lagen.
    //
    // ZEITZONE (der eigentliche Fallstrick): EXTRACT(DOW ...) rechnet ohne
    // AT TIME ZONE in UTC. Ein Gottesdienst am Sonntag um 20 Uhr Berliner
    // Zeit ist in UTC noch Sonntag 18 Uhr -- aber im Winter ein Termin um
    // 00:30 waere schon Montag. Dieselbe Fehlerklasse wie der Datumsversatz
    // in berechneZeitraum(). Deshalb wird konsequent nach Europe/Berlin
    // umgerechnet, bevor der Wochentag bestimmt wird.
    const { rows: wochentagRows } = await client.query(
      `SELECT EXTRACT(DOW FROM (e.event_date AT TIME ZONE 'Europe/Berlin'))::int AS tag,
              COUNT(*)::int AS anzahl
         FROM event_bookings eb
         JOIN events e ON eb.event_id = e.id
        WHERE eb.user_id = $1 AND eb.organization_id = $2
          AND e.event_date >= $3::date
          AND e.event_date < ($4::date + INTERVAL '1 day')
        GROUP BY tag
        ORDER BY anzahl DESC, tag ASC
        LIMIT 1`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );
    const gesamtTermine = spanneRow ? spanneRow.anzahl : 0;
    const wochentag = wochentagRows.length > 0
      ? {
          tag: wochentagRows[0].tag,
          name: WOCHENTAG_NAMEN[wochentagRows[0].tag] || '',
          anzahl: wochentagRows[0].anzahl,
          gesamt: gesamtTermine,
          anteil: gesamtTermine > 0
            ? Math.round((wochentagRows[0].anzahl / gesamtTermine) * 100)
            : 0
        }
      : null;

    // DER VIELSEITIGE -- mit wie vielen Medienarten jemand geantwortet hat.
    //
    // BEWUSST "2 VON 3" STATT "ALLE DREI": challenges.allowed_media steht per
    // Default auf ["text","photo"] -- Audio ist in vielen Challenges gar
    // nicht erlaubt. Eine Seite, die alle drei verlangt, traefe fast nie zu
    // und waere damit keine Seite, sondern eine Fussnote. Gezaehlt werden
    // deshalb die verschiedenen Arten, und ab zwei ist es eine Geschichte.
    let medienarten = [];
    try {
      const { rows: medienRows } = await client.query(
        `SELECT DISTINCT cs.media_type
           FROM challenge_submissions cs
          WHERE cs.user_id = $1 AND cs.organization_id = $2
            AND cs.moderation_status <> 'hidden'
            AND cs.created_at >= $3::date
            AND cs.created_at < ($4::date + INTERVAL '1 day')
            AND cs.media_type IS NOT NULL`,
        [userId, orgId, zeitraumStart, zeitraumEnde]
      );
      medienarten = medienRows.map(r => r.media_type).sort();
    } catch (medienErr) {
      // Alt-Deployment ohne Challenge-Tabellen: die Seite entfaellt.
      console.warn('Wrapped: Medienarten konnten nicht geladen werden:', medienErr.message);
    }

    // Endspurt: Vergleich mit Zielwerten aus jahrgaenge.
    // BEWUSST OHNE ZEITFILTER: die Zielvorgabe des Jahrgangs ist eine
    // Einstellung, kein Ereignis.
    const { rows: [jahrgang] } = await client.query(
      `SELECT target_gottesdienst, target_gemeinde, gottesdienst_enabled, gemeinde_enabled
       FROM jahrgaenge WHERE id = $1`,
      [jahrgangId]
    );

    let zielTotal = 0;
    let aktuellTotal = gottesdienst + gemeinde;
    if (jahrgang) {
      if (jahrgang.gottesdienst_enabled) zielTotal += (jahrgang.target_gottesdienst || 0);
      if (jahrgang.gemeinde_enabled) zielTotal += (jahrgang.target_gemeinde || 0);
    }
    const fehlendePunkte = Math.max(0, zielTotal - aktuellTotal);
    const endspurtAktiv = aktuellTotal < zielTotal;

    // ================================================================
    // Persoenliche Zahlen fuer die Highlight-Auswahl (01.09.2026)
    // ================================================================
    // Simons Wunsch: Der Rueckblick soll sich von Konfi zu Konfi dynamisch
    // unterscheiden -- Chat, Reaktionen, Kraftproben, Verlaesslichkeit.
    // Alle Zaehlungen halten sich an DENSELBEN Zeitraum wie die uebrigen
    // Zahlen (berechneZeitraum), damit keine Seite anders zaehlt als die
    // andere.

    // Chat: gesendete Nachrichten (geloeschte zaehlen nicht -- was der Konfi
    // selbst zurueckgenommen hat, soll ihm der Rueckblick nicht vorrechnen).
    // Org-Grenze ueber den Raum, nicht ueber die Nachricht (chat_messages
    // traegt keine organization_id).
    const { rows: [chatRow] } = await client.query(
      `SELECT COUNT(*) as count FROM chat_messages cm
       JOIN chat_rooms cr ON cm.room_id = cr.id
       WHERE cm.user_id = $1 AND cr.organization_id = $2
         AND cm.deleted_at IS NULL
         AND cm.created_at >= $3::date
         AND cm.created_at < ($4::date + INTERVAL '1 day')`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );
    const chatNachrichten = parseInt(chatRow.count, 10) || 0;

    // Reaktionen BEKOMMEN (von anderen, auf eigene Nachrichten).
    // Entscheidung: Als Highlight zaehlt die Zustimmung, die jemand BEKOMMEN
    // hat, nicht die vergebenen Likes -- "deine Nachrichten kamen an" ist
    // eine Aussage ueber die Person und ihr Ankommen in der Gruppe,
    // "du hast viel geliked" nur eine ueber ihr Tippverhalten. Eigene
    // Reaktionen auf eigene Nachrichten zaehlen nicht mit.
    const { rows: [reaktionenBekommenRow] } = await client.query(
      `SELECT COUNT(*) as count FROM chat_message_reactions r
       JOIN chat_messages cm ON r.message_id = cm.id
       JOIN chat_rooms cr ON cm.room_id = cr.id
       WHERE cm.user_id = $1 AND r.user_id <> $1
         AND cr.organization_id = $2
         AND cm.deleted_at IS NULL
         AND r.created_at >= $3::date
         AND r.created_at < ($4::date + INTERVAL '1 day')`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );
    const reaktionenBekommen = parseInt(reaktionenBekommenRow.count, 10) || 0;

    // Reaktionen GEGEBEN -- nur als Zahl im Snapshot, kein eigenes Highlight
    // (siehe Begruendung oben).
    const { rows: [reaktionenGegebenRow] } = await client.query(
      `SELECT COUNT(*) as count FROM chat_message_reactions r
       JOIN chat_messages cm ON r.message_id = cm.id
       JOIN chat_rooms cr ON cm.room_id = cr.id
       WHERE r.user_id = $1 AND cr.organization_id = $2
         AND r.created_at >= $3::date
         AND r.created_at < ($4::date + INTERVAL '1 day')`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );
    const reaktionenGegeben = parseInt(reaktionenGegebenRow.count, 10) || 0;

    // Challenges: Gesamtzahl der Beitraege (challengeMomente ist auf 12
    // gedeckelt, fuer die Auswahl zaehlt die echte Zahl) plus die Challenge,
    // bei der die Person am aktivsten war. Defensiv wie die Momente selbst:
    // Alt-Deployments ohne Challenge-Tabellen liefern 0 / null.
    let challengeBeitraege = 0;
    let topChallenge = null;
    try {
      const { rows: [beitragRow] } = await client.query(
        `SELECT COUNT(*) as count FROM challenge_submissions cs
         WHERE cs.user_id = $1 AND cs.organization_id = $2
           AND cs.moderation_status <> 'hidden'
           AND cs.created_at >= $3::date
           AND cs.created_at < ($4::date + INTERVAL '1 day')`,
        [userId, orgId, zeitraumStart, zeitraumEnde]
      );
      challengeBeitraege = parseInt(beitragRow.count, 10) || 0;

      const { rows: topRows } = await client.query(
        `SELECT c.title, c.badge_icon, COUNT(*) as count
         FROM challenge_submissions cs
         JOIN challenges c ON cs.challenge_id = c.id
         WHERE cs.user_id = $1 AND cs.organization_id = $2
           AND cs.moderation_status <> 'hidden'
           AND cs.created_at >= $3::date
           AND cs.created_at < ($4::date + INTERVAL '1 day')
         GROUP BY c.id, c.title, c.badge_icon
         ORDER BY count DESC, c.title
         LIMIT 1`,
        [userId, orgId, zeitraumStart, zeitraumEnde]
      );
      if (topRows.length > 0) {
        topChallenge = {
          title: topRows[0].title,
          badge_icon: topRows[0].badge_icon,
          count: parseInt(topRows[0].count, 10)
        };
      }
    } catch (challengeErr) {
      console.warn('Wrapped: Challenge-Zahlen konnten nicht geladen werden:', challengeErr.message);
    }

    // Verlaesslichkeit: Selbst-Abmeldungen aus event_unregistrations.
    // Das ist die Handlung "Konfi meldet sich ab" (die Buchung wird dabei
    // GELOESCHT, routes/konfi.js) -- events.abgesagt oben zaehlt dagegen
    // stehen gebliebene 'cancelled'-Buchungen, das sind zwei verschiedene
    // Dinge. Zeitanker ist unregistered_at (die Handlung im Konfi-Jahr),
    // nicht das Eventdatum: Die Absage bleibt auch zaehlbar, wenn der Termin
    // spaeter verschoben oder geloescht wird.
    const { rows: [abmeldungRow] } = await client.query(
      `SELECT COUNT(*) as count FROM event_unregistrations eu
       WHERE eu.user_id = $1 AND eu.organization_id = $2
         AND eu.unregistered_at >= $3::date
         AND eu.unregistered_at < ($4::date + INTERVAL '1 day')`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );
    const abmeldungen = parseInt(abmeldungRow.count, 10) || 0;
    // "Nie abgesagt" ist erst ab 5 Buchungen eine Aussage -- wer nur zweimal
    // gebucht hat, hatte kaum Gelegenheit abzusagen.
    const nieAbgesagt = abmeldungen === 0 && totalAttended >= 5;

    // ================================================================
    // Jahrgangsvergleich: Was ist an DIESER Person besonders?
    // ================================================================
    // Frueher gewann der groesste Rohwert -- 15 Termine schlugen immer
    // 8 Abzeichen, und weil fast alle am meisten Termine haben, sah der
    // Rueckblick fuer fast alle gleich aus. Jetzt zaehlt, worin jemand
    // im Vergleich zum eigenen Jahrgang heraussticht: Der Durchschnitt
    // des Jahrgangs je Metrik ist die Messlatte, das beste Verhaeltnis
    // eigener Wert / Jahrgangsschnitt gewinnt. Der Vergleich bleibt anonym
    // (nur der Schnitt, nie andere Namen) und landet nur dann im Text,
    // wenn er freundlich ist (Frontend zeigt ihn nur oberhalb des Schnitts).
    let jahrgangsSchnitt = null;
    try {
      const { rows: [avgRow] } = await client.query(
        `WITH jahrgang_konfis AS (
           SELECT kp.user_id FROM konfi_profiles kp
           JOIN users u ON kp.user_id = u.id
           JOIN roles r ON u.role_id = r.id
           WHERE kp.jahrgang_id = $1 AND r.name = 'konfi' AND u.deleted_at IS NULL
         )
         SELECT
           (SELECT COUNT(*) FROM jahrgang_konfis) AS anzahl,
           (SELECT COUNT(*) FROM event_bookings eb
             JOIN events e ON eb.event_id = e.id
             WHERE eb.user_id IN (SELECT user_id FROM jahrgang_konfis)
               AND eb.organization_id = $2
               AND e.event_date >= $3::date
               AND e.event_date < ($4::date + INTERVAL '1 day')) AS events_gesamt,
           (SELECT COUNT(*) FROM event_bookings eb
             JOIN events e ON eb.event_id = e.id
             WHERE eb.user_id IN (SELECT user_id FROM jahrgang_konfis)
               AND eb.organization_id = $2
               AND e.point_type = 'gottesdienst'
               AND e.event_date >= $3::date
               AND e.event_date < ($4::date + INTERVAL '1 day')) AS gottesdienste_gesamt,
           (SELECT COUNT(*) FROM user_badges ub
             WHERE ub.user_id IN (SELECT user_id FROM jahrgang_konfis)
               AND ub.organization_id = $2
               AND ub.awarded_date >= $3::date
               AND ub.awarded_date < ($4::date + INTERVAL '1 day')) AS badges_gesamt,
           (SELECT COALESCE(SUM(kp2.gemeinde_points), 0) FROM konfi_profiles kp2
             WHERE kp2.user_id IN (SELECT user_id FROM jahrgang_konfis)
               AND kp2.jahrgang_id = $1) AS gemeinde_gesamt,
           (SELECT COUNT(*) FROM chat_messages cm
             JOIN chat_rooms cr ON cm.room_id = cr.id
             WHERE cm.user_id IN (SELECT user_id FROM jahrgang_konfis)
               AND cr.organization_id = $2
               AND cm.deleted_at IS NULL
               AND cm.created_at >= $3::date
               AND cm.created_at < ($4::date + INTERVAL '1 day')) AS chat_gesamt,
           (SELECT COUNT(*) FROM chat_message_reactions r
             JOIN chat_messages cm ON r.message_id = cm.id
             JOIN chat_rooms cr ON cm.room_id = cr.id
             WHERE cm.user_id IN (SELECT user_id FROM jahrgang_konfis)
               AND r.user_id <> cm.user_id
               AND cr.organization_id = $2
               AND cm.deleted_at IS NULL
               AND r.created_at >= $3::date
               AND r.created_at < ($4::date + INTERVAL '1 day')) AS reaktionen_gesamt,
           (SELECT COUNT(*) FROM challenge_submissions cs
             WHERE cs.user_id IN (SELECT user_id FROM jahrgang_konfis)
               AND cs.organization_id = $2
               AND cs.moderation_status <> 'hidden'
               AND cs.created_at >= $3::date
               AND cs.created_at < ($4::date + INTERVAL '1 day')) AS challenges_gesamt`,
        [jahrgangId, orgId, zeitraumStart, zeitraumEnde]
      );
      const anzahl = parseInt(avgRow.anzahl, 10) || 0;
      if (anzahl > 0) {
        jahrgangsSchnitt = {
          events: parseInt(avgRow.events_gesamt, 10) / anzahl,
          gottesdienste: parseInt(avgRow.gottesdienste_gesamt, 10) / anzahl,
          badges: parseInt(avgRow.badges_gesamt, 10) / anzahl,
          gemeinde: parseInt(avgRow.gemeinde_gesamt, 10) / anzahl,
          chat: parseInt(avgRow.chat_gesamt, 10) / anzahl,
          reaktionen: parseInt(avgRow.reaktionen_gesamt, 10) / anzahl,
          challenges: parseInt(avgRow.challenges_gesamt, 10) / anzahl
        };
      }
    } catch (avgErr) {
      // Alt-Deployment ohne Challenge-Tabellen o.ae.: ohne Schnitt faellt
      // die Auswahl unten auf die Rohwert-Logik zurueck.
      console.warn('Wrapped: Jahrgangsschnitt konnte nicht berechnet werden:', avgErr.message);
    }

    // ================================================================
    // WIE SELTEN IST JEDE SEITE? (Simon, 07.09.2026)
    // ================================================================
    //
    // Simons Vorgabe: "Wir gucken, welche die besonderen Folien sind, um
    // sie zu kriegen ... nicht jede Kirchengemeinde hat Sommerfreizeit."
    //
    // Gezaehlt wird, wie viele Konfis DESSELBEN JAHRGANGS die Voraussetzung
    // je Seite erfuellen -- das ist die Gruppe, mit der man sich vergleicht,
    // und dieselbe Bezugsgroesse wie beim Jahrgangsschnitt oben.
    //
    // WARUM JAHRGANG UND NICHT ORGANISATION (anders als beim seltensten
    // Abzeichen): Abzeichen sind Bestaende, die ueber Jahre wachsen -- da
    // ist die ganze Gemeinde die richtige Bezugsgroesse. Diese Seiten
    // haengen dagegen an dem, was IN DIESEM ZEITRAUM passiert ist, und der
    // ist je Jahrgang ein anderer. Ein Advent-Termin des Jahrgangs 2024/25
    // sagt nichts darueber, wie besonders er fuer den Jahrgang 2026/27 ist.
    //
    // ERST AB 5 KONFIS. Bei zweien waere jeder Anteil entweder 50 % oder
    // 100 % -- eine Zahl ohne Aussage. Dieselbe Schwelle wie beim
    // seltensten Abzeichen und aus demselben Grund. Darunter bleibt das
    // Feld leer und wrappedKacheln.js rechnet mit den geschaetzten
    // Grundhaeufigkeiten.
    //
    // NUR DIE SEITEN, DIE SICH GUENSTIG ZAEHLEN LASSEN: Termine, Punkte,
    // Abzeichen, Warteliste und der Wochentag. Fuer die uebrigen (Chat,
    // Challenges, Medienarten) braeuchte es je eine weitere Abfrage ueber
    // den ganzen Jahrgang; sie behalten ihre Schaetzung. Lieber fuenf
    // gemessene Werte als zwoelf, die den Rueckblick langsam machen.
    let seitenHaeufigkeit = null;
    try {
      const { rows: [hRow] } = await client.query(
        `WITH jahrgang_konfis AS (
           SELECT kp.user_id FROM konfi_profiles kp
           JOIN users u ON kp.user_id = u.id
           JOIN roles r ON u.role_id = r.id
           WHERE kp.jahrgang_id = $1 AND r.name = 'konfi' AND u.deleted_at IS NULL
         ),
         termine AS (
           SELECT eb.user_id, e.event_date, e.id AS event_id
             FROM event_bookings eb
             JOIN events e ON eb.event_id = e.id
            WHERE eb.user_id IN (SELECT user_id FROM jahrgang_konfis)
              AND eb.organization_id = $2
              AND e.event_date >= $3::date
              AND e.event_date < ($4::date + INTERVAL '1 day')
         )
         SELECT
           (SELECT COUNT(*) FROM jahrgang_konfis) AS konfis,
           (SELECT COUNT(DISTINCT user_id) FROM termine) AS mit_terminen,
           (SELECT COUNT(DISTINCT ub.user_id) FROM user_badges ub
             WHERE ub.user_id IN (SELECT user_id FROM jahrgang_konfis)
               AND ub.organization_id = $2) AS mit_abzeichen,
           (SELECT COUNT(*) FROM konfi_profiles kp
             WHERE kp.user_id IN (SELECT user_id FROM jahrgang_konfis)
               AND kp.jahrgang_id = $1
               AND (COALESCE(kp.gottesdienst_points, 0) + COALESCE(kp.gemeinde_points, 0)) > 0
           ) AS mit_punkten,
           -- DIE WARTELISTE FEHLT HIER BEWUSST: Ihre Spalte
           -- (war_auf_warteliste, Migration 145) existiert in Produktion
           -- nicht zuverlaessig -- genau deshalb liest die Seite selbst sie
           -- ueber zahlAusNeuerSpalte(). Haenge ich sie hier in dieselbe
           -- Abfrage wie die vier anderen, reisst ihr Fehlen ALLE
           -- Seltenheitswerte mit; die Auswahl fiele dann auch fuer
           -- Termine, Punkte und Abzeichen auf die Schaetzung zurueck.
           -- Sie behaelt ihren Schaetzwert (20 %), der ohnehin nah an der
           -- Wirklichkeit liegt.
           -- Der Wochentag: mindestens 4 Termine an EINEM Tag und die
           -- Haelfte aller Termine -- dieselbe Bedingung wie in
           -- wrappedKacheln.js. Waere sie hier anders, maesse die
           -- Seltenheit etwas anderes, als die Auswahl benutzt.
           (SELECT COUNT(*) FROM (
              SELECT user_id
                FROM termine
               GROUP BY user_id, EXTRACT(DOW FROM event_date)
              HAVING COUNT(*) >= 4
                 AND COUNT(*) * 2 >= (SELECT COUNT(*) FROM termine t2 WHERE t2.user_id = termine.user_id)
            ) w) AS mit_wochentag`,
        [jahrgangId, orgId, zeitraumStart, zeitraumEnde]
      );
      const konfisImJahrgang = parseInt(hRow?.konfis || '0', 10);
      if (konfisImJahrgang >= 5) {
        // Anteil in Prozent, mindestens 1 -- eine 0 hiesse "niemand hat
        // das", und die Person, die den Rueckblick liest, hat es ja.
        const anteil = (n) => Math.min(100, Math.max(1,
          Math.round((parseInt(n || '0', 10) / konfisImJahrgang) * 100)));
        seitenHaeufigkeit = {
          events: anteil(hRow.mit_terminen),
          badges: anteil(hRow.mit_abzeichen),
          punkte: anteil(hRow.mit_punkten),
          wochentag: anteil(hRow.mit_wochentag)
        };
      }
    } catch (haeufigkeitErr) {
      // Fehlt eine Spalte (Alt-Deployment vor Migration 145), bleibt das
      // Feld leer und die Auswahl rechnet mit den Schaetzwerten. Ein
      // fehlender Seltenheitswert darf nie den Rueckblick verhindern.
      console.warn('Wrapped: Seitenhaeufigkeit konnte nicht berechnet werden:', haeufigkeitErr.message);
    }

    // Deterministischer Formulierung-Seed (vor der Auswahl gebraucht: er
    // entscheidet auch den Gleichstand zwischen zwei Highlight-Kandidaten).
    const formulierungSeed = (userId * 31 + year * 17) % 97;

    // ================================================================
    // Highlight-Auswahl
    // ================================================================
    // ueber_das_ziel behaelt die hoechste Prioritaet (erreichtes Ziel ist
    // immer die Nachricht des Jahres). Danach: Kandidaten mit Mindestwert
    // (damit niemand fuer 2 Chat-Nachrichten zum "Chat-Star" wird), Score =
    // eigener Wert / Jahrgangsschnitt. 'verlaesslich' hat keinen Zaehlwert-
    // Vergleich und tritt mit festem Score 1.2 an: Es gewinnt, wenn sonst
    // niemand deutlich ueber dem Schnitt liegt -- ein echter Ausreisser
    // schlaegt es.
    //
    // BEWUSST WEGGELASSEN: ein Highlight "am oeftesten abgesagt". Der
    // Rueckblick geht an 12- bis 14-Jaehrige; Absagen haben oft Gruende
    // ausserhalb ihrer Kontrolle (Familie, Krankheit, Fahrdienste). Einem
    // Kind als Jahresbotschaft "du hast am meisten abgesagt" zu zeigen,
    // beschaemt und erzieht nicht -- der Gegenpol ist deshalb nur positiv
    // gewendet (verlaesslich = nie abgesagt bei genug Buchungen), die
    // Absagen-Zahl selbst steht neutral im Snapshot und wird nicht
    // hervorgehoben. Fachliche Entscheidung, siehe Handbuch 95-wrapped.
    let highlightType = 'events_held';
    let highlightWert = totalAttended;
    let highlightSchnitt = null;
    if (aktuellTotal >= zielTotal && zielTotal > 0) {
      highlightType = 'ueber_das_ziel';
      highlightWert = aktuellTotal - zielTotal;
    } else {
      const candidates = [
        { type: 'events_held', value: totalAttended, avg: jahrgangsSchnitt ? jahrgangsSchnitt.events : null, min: 3 },
        { type: 'badge_collector', value: badgeRows.length, avg: jahrgangsSchnitt ? jahrgangsSchnitt.badges : null, min: 2 },
        { type: 'gottesdienst_treue', value: gottesdienstCount, avg: jahrgangsSchnitt ? jahrgangsSchnitt.gottesdienste : null, min: 3 },
        { type: 'gemeinde_aktiv', value: gemeinde, avg: jahrgangsSchnitt ? jahrgangsSchnitt.gemeinde : null, min: 3 },
        { type: 'chat_star', value: chatNachrichten, avg: jahrgangsSchnitt ? jahrgangsSchnitt.chat : null, min: 20 },
        { type: 'reaktions_magnet', value: reaktionenBekommen, avg: jahrgangsSchnitt ? jahrgangsSchnitt.reaktionen : null, min: 5 },
        { type: 'challenge_fan', value: challengeBeitraege, avg: jahrgangsSchnitt ? jahrgangsSchnitt.challenges : null, min: 2 }
      ];

      if (jahrgangsSchnitt) {
        // Score-Auswahl: Verhaeltnis zum Jahrgangsschnitt, Nenner mindestens
        // 1, damit ein Schnitt nahe 0 keine absurden Scores erzeugt.
        const scored = candidates
          .filter(c => c.value >= c.min)
          .map(c => ({ ...c, score: c.value / Math.max(c.avg, 1) }));
        if (nieAbgesagt) {
          scored.push({ type: 'verlaesslich', value: totalAttended, avg: null, score: 1.2 });
        }
        if (scored.length > 0) {
          scored.sort((a, b) => b.score - a.score);
          // Gleichstand (praktisch identischer Score): der Seed entscheidet,
          // damit zwei aehnliche Konfis nicht dieselbe Seite sehen.
          const beste = scored.filter(c => scored[0].score - c.score < 0.001);
          const gewinner = beste[formulierungSeed % beste.length];
          highlightType = gewinner.type;
          highlightWert = gewinner.value;
          highlightSchnitt = (gewinner.avg !== null && gewinner.avg !== undefined)
            ? Math.round(gewinner.avg * 10) / 10
            : null;
        }
        // Kein Kandidat ueber Mindestwert: events_held bleibt als Default
        // stehen (wie bisher).
      } else {
        // Fallback ohne Jahrgangsschnitt: bisherige Rohwert-Logik ueber die
        // klassischen vier Kandidaten (unveraendertes Verhalten).
        let maxVal = -1;
        for (const c of candidates.slice(0, 4)) {
          if (c.value > maxVal) {
            maxVal = c.value;
            highlightType = c.type;
            highlightWert = c.value;
          }
        }
      }
    }

    // Challenge-Momente: eigene Beitraege im Wrapped-Zeitraum (max 12, neueste zuerst).
    // Defensiv: Auf Alt-Deployments ohne Challenge-Tabellen liefern wir ein leeres Array
    // statt die gesamte Snapshot-Generierung scheitern zu lassen.
    let challengeMomente = [];
    try {
      const { rows: submissionRows } = await client.query(
        `SELECT c.title AS challenge_title,
                c.badge_icon,
                cs.media_type,
                cs.file_path,
                cs.file_name,
                cs.text_content,
                cs.link_url,
                cs.link_title,
                cs.link_author,
                cs.created_at
           FROM challenge_submissions cs
           JOIN challenges c ON cs.challenge_id = c.id
          WHERE cs.user_id = $1
            AND cs.organization_id = $2
            AND cs.moderation_status <> 'hidden'
            AND cs.created_at >= $3::date
            AND cs.created_at < ($4::date + INTERVAL '1 day')
          ORDER BY cs.created_at DESC
          LIMIT 12`,
        [userId, orgId, zeitraumStart, zeitraumEnde]
      );
      challengeMomente = submissionRows.map(s => ({
        challenge_title: s.challenge_title,
        badge_icon: s.badge_icon,
        media_type: s.media_type,
        file_path: s.file_path,
        file_name: s.file_name,
        text_content: s.text_content
          ? (s.text_content.length > 200 ? `${s.text_content.slice(0, 200)}...` : s.text_content)
          : null,
        link_url: s.link_url,
        link_title: s.link_title,
        link_author: s.link_author,
        created_at: s.created_at
      }));
    } catch (challengeErr) {
      console.warn('Wrapped: Challenge-Momente konnten nicht geladen werden:', challengeErr.message);
      challengeMomente = [];
    }

    // ---------------------------------------------------------------
    // Bis hier die Zahlen. Ab hier die AUSWAHL DER SEITEN -- der Punkt, an
    // dem utils/wrappedKacheln.js an seinem Aufrufer haengt.
    //
    // Bis zum 03.09.2026 tat das Modul nichts: Es existierte, war mit 20
    // Tests gruen und wurde von NIEMANDEM gerufen; WrappedModal.tsx stellte
    // die Seiten fest verdrahtet zusammen. Ein Modul ohne Aufrufer besteht
    // jeden Test und aendert trotzdem nichts.
    //
    // Die Auswahl wird IM Snapshot gespeichert statt bei jedem Ansehen neu
    // gerechnet: Ein Rueckblick wird geteilt und mehrfach geoeffnet -- er
    // muss jedes Mal gleich aussehen.
    // ---------------------------------------------------------------
    const schnappschuss = {
      // Version 3 (01.09.2026): persoenliche Highlights + Chat-/Challenge-/
      // Verlaesslichkeits-Zahlen. Rein ADDITIV zu Version 2 -- kein Feld
      // wurde entfernt, umbenannt oder umtypisiert. Ausgelieferte Apps
      // rendern jeden Snapshot mit version >= 2 ueber die feste
      // Slide-Reihenfolge und ignorieren unbekannte Felder.
      version: 3,
      highlight_type: highlightType,
      formulierung_seed: formulierungSeed,
      slides: {
        challenge_momente: challengeMomente,
        // Das gewaehlte Highlight samt Zahl und (anonymem) Jahrgangsschnitt.
        // Neu ab Version 3; alte Clients kennen das Feld nicht und rendern
        // wie bisher.
        highlight: {
          type: highlightType,
          wert: highlightWert,
          jahrgangsschnitt: highlightSchnitt
        },
        // 'chat' gab es schon in Version-1-Snapshots als Objekt mit
        // nachrichten_gesendet -- derselbe Name, derselbe Typ, nur zwei
        // Felder mehr (Vertragstreue gegenueber alten Lesern).
        chat: {
          nachrichten_gesendet: chatNachrichten,
          reaktionen_gegeben: reaktionenGegeben,
          reaktionen_bekommen: reaktionenBekommen
        },
        challenges: {
          beitraege: challengeBeitraege,
          top_challenge: topChallenge
        },
        verlaesslichkeit: {
          abmeldungen,
          nie_abgesagt: nieAbgesagt
        },
        punkte: {
          gottesdienst,
          gemeinde,
          total: gottesdienst + gemeinde,
          bonus
        },
        events: {
          total_attended: totalAttended,
          total_available: totalAvailable,
          lieblings_event: lieblingsEvent,
          abgesagt: eventAbgesagt
        },
        badges: {
          total_earned: badgeRows.length,
          total_available: totalBadgesAvailable,
          badges: badgeRows.map(b => ({ name: b.name, icon: b.icon, color: b.color })),
          // Additiv (ab 03.09.2026): alte Apps ignorieren das Feld.
          seltenstes: seltenstesAbzeichen
        },
        pflicht: {
          besucht: pflichtBesucht,
          gesamt: pflichtGesamt
        },
        aktivster_monat: aktivsterMonat,
        // Additiv (ab 07.09.2026): alte Apps kennen die Felder nicht.
        warteliste: {
          nachgerueckt
        },
        langer_atem: langerAtem,
        wochentag: wochentag,
        medienarten: medienarten,
        endspurt: {
          aktiv: endspurtAktiv,
          fehlende_punkte: fehlendePunkte,
          ziel_total: zielTotal,
          aktuell_total: aktuellTotal
        },
        zeitraum: {
          start: zeitraumStart,
          ende: zeitraumEnde,
          // Neues Feld (additiv, alte Apps ignorieren es): der ECHTE
          // Konfirmationstermin, null wenn der Jahrgang keinen hat.
          // Das Frontend rendert bisher `ende` als "Deine Konfirmation am ..."
          // -- fuer die drei von fuenf Jahrgaengen ohne Konfirmations-Termin
          // war das eine frei erfundene Zahl (das Fallback-Ende).
          konfirmation: zeitraum.konfirmation
        },
        gottesdienst: {
          count: gottesdienstCount
        },
        kategorie: {
          verteilung: kategorieVerteilung.map(k => ({
            kategorie: k.kategorie,
            // Auf welche Seite zeigt dieser Name? Das Backend entscheidet
            // das ohnehin schon fuer die Seitenauswahl -- es hier
            // mitzuliefern erspart dem Frontend, dieselbe Zuordnung ein
            // zweites Mal (und irgendwann abweichend) zu bauen.
            // null = eigener Name der Gemeinde, faellt auf die allgemeine
            // Schwerpunkt-Seite.
            seite: (() => {
              const s = seiteFuerKategorie(k.kategorie);
              return s ? `kategorie:${s}` : null;
            })(),
            count: parseInt(k.count, 10),
            // Getrennt, damit eine Seite "bei 4 Terminen" sagen kann statt
            // einer aufgeblaehten Gesamtsumme.
            aus_terminen: parseInt(k.aus_terminen, 10) || 0,
            aus_aktivitaeten: parseInt(k.aus_aktivitaeten, 10) || 0
          })),
          top_kategorie: kategorieVerteilung.length > 0 ? kategorieVerteilung[0].kategorie : null
        },
        // Additiv (07.09.2026): War die Person bei der Sommerfreizeit 2026
        // nach Stavanger dabei? Alte Apps kennen das Feld nicht und
        // ignorieren es -- und die Seite selbst traegt bewusst einen
        // Schluessel OHNE 'kategorie:'-Praefix, damit sie dort spurlos
        // durchfaellt statt eine leere Seite zu erzeugen.
        stavanger_2026: stavanger2026,
        // Additiv (07.09.2026): Wie viel Prozent des Jahrgangs bekommen
        // diese Seite auch? Kleiner = seltener = wertvoller. Grundlage der
        // Seitenauswahl (utils/wrappedKacheln.js, haeufigkeitFuer).
        // null bei weniger als 5 Konfis -- dort waere jeder Anteil eine
        // Zahl ohne Aussage. Alte Apps kennen das Feld nicht.
        seiten_haeufigkeit: seitenHaeufigkeit,
        // Rohdaten fuer die Datums-Seiten. Bewusst nur die Daten, keine
        // Namen -- die Seite sagt "du warst bei drei Advents-Terminen", nicht
        // welche das waren.
        termine_daten: termineDaten,
        // Wie viele Termine je Zeitfenster. Das Frontend braucht die Zahl
        // fuer die Datums-Seiten und soll die Fenster nicht selbst
        // ausrechnen -- die Osterformel gehoert an EINE Stelle.
        // Dieselbe Zaehlung, die oben ueber den Vorrang entschieden hat --
        // nicht ein zweites Mal gerechnet. Waeren es zwei Rechnungen, koennte
        // die Seite eine andere Zahl zeigen als die Auswahl benutzt hat.
        datums_fenster: datumsFensterZaehler
      }
    };

    // Additives Feld: Alte App-Versionen kennen `kacheln` nicht und rendern
    // weiter ueber ihre eigene feste Reihenfolge. Der Vertrag bleibt gewahrt.
    schnappschuss.kacheln = waehleKacheln(schnappschuss.slides, jahrgangsSchnitt);
    return schnappschuss;
  }

  /**
   * Teamer-Rueckblick eines Jahres.
   *
   * BEFUND 06.09.2026: Diese Funktion filterte KEINE ihrer sechs Abfragen auf
   * den Zeitraum. Das `year` landete nur in slides.zeitraum.year -- die Zahlen
   * darunter zaehlten die gesamte Kontolebenszeit. Wer seit vier Jahren im
   * Team ist, sah in seinem "Jahresrueckblick" alle Termine aus vier Jahren.
   * Der Konfi-Zweig macht es seit dem 01.09.2026 richtig (berechneZeitraum),
   * der Teamer-Zweig blieb dabei stehen.
   *
   * WAS AUF DEN ZEITRAUM GEFILTERT WIRD -- und was bewusst nicht:
   *
   *   gefiltert: Termine, der Termin mit den meisten Teilnehmenden, Abzeichen
   *     und Zertifikate. Das sind EREIGNISSE mit Datum. Ein Abzeichen aus dem
   *     Vorjahr gehoert nicht in diesen Jahresrueckblick -- es war die
   *     Nachricht des VORIGEN Jahres und wuerde sie hier ein zweites Mal
   *     erzaehlen.
   *
   *   NICHT gefiltert: "Konfis betreut". Das ist ein ZUSTAND, kein Ereignis --
   *     user_jahrgang_assignments traegt kein Datum, an dem man filtern
   *     koennte, und die Aussage "du begleitest 13 Konfis" ist ohnehin als
   *     Gegenwart gemeint, nicht als Jahressumme.
   *
   *   NICHT gefiltert: teamer_since / jahre_aktiv. Das IST der Lebenszeitwert
   *     und genau die Aussage der Seite ("seit 4 Jahren dabei"). Auf ein Jahr
   *     eingegrenzt kaeme dort immer 1 heraus und die Seite verloere ihren
   *     Sinn. Gerechnet wird sie aber jetzt gegen das ZEITRAUM-ENDE statt
   *     gegen Date.now(): Ein Rueckblick auf 2024, im Jahr 2026 nochmals
   *     geoeffnet, sagte sonst "6 Jahre" -- eine Zahl, die zum Rueckblick
   *     nicht passt und sich mit jedem Aufruf aendert.
   */
  async function generateTeamerSnapshot(client, userId, orgId, year, zeitraumVorgabe = null, vorigesEnde = null) {
    // BEGINN DES TEAMER-ZEITRAUMS -- die lueckenlose Kette (Simons Regel
    // 07.09.2026): "das erste wrapped geht vom anbeginn der zeit als teamer
    // bis zum zeitpunkt des wrapped und dann immer bis zum letzten wrapped."
    //
    // 1. Gab es schon eine Teamer-Ausgabe in dieser Organisation, beginnt
    //    dieser Rueckblick an deren ENDE. Der Aufrufer ermittelt das einmal
    //    pro Lauf (ermittleVorigesTeamerEnde) und reicht es herein -- sonst
    //    fragte jede Person dieselbe Zeile erneut ab, und schlimmer: die
    //    Ausgabe DIESES Laufs steht beim Anlegen schon in der Tabelle und
    //    wuerde sich selbst als Vorgaengerin finden.
    // 2. Beim ersten Mal: seit wann die Person im Team ist -- users.
    //    teamer_since, sonst (nullable, Altdaten) die aelteste
    //    Teamer-Aktivitaet. Dieselbe Kette wie im Abzeichen-Zweig
    //    (routes/badges.js, 'teamer_year').
    //
    // Punkt 2 ist bewusst PERSONENBEZOGEN: Wer erst seit einem halben Jahr
    // dabei ist, bekommt sein halbes Jahr und nicht die Historie der Gemeinde.
    let teamerBeginn = vorigesEnde || null;
    if (!teamerBeginn) {
      const { rows: [seitRow] } = await client.query(
        `SELECT teamer_since FROM users WHERE id = $1`,
        [userId]
      );
      if (seitRow && seitRow.teamer_since) {
        teamerBeginn = seitRow.teamer_since;
      } else {
        const { rows: [ersteAkt] } = await client.query(
          `SELECT MIN(ua.completed_date) AS min_date FROM user_activities ua
             JOIN activities a ON ua.activity_id = a.id
            WHERE ua.user_id = $1 AND a.target_role = 'teamer'`,
          [userId]
        );
        if (ersteAkt && ersteAkt.min_date) teamerBeginn = ersteAkt.min_date;
      }
    }

    // Dieselbe Funktion wie beim Konfi -- eine Regel, eine Stelle. Der
    // Teamer-Zweig kennt keinen Konfirmationstermin, daher null.
    const zeitraum = berechneZeitraum(null, year, zeitraumVorgabe, teamerBeginn);
    const zeitraumStart = zeitraum.start;
    const zeitraumEnde = zeitraum.ende;

    // Events geleitet (Teamer war als Teilnehmer gebucht)
    const { rows: [eventsGeleitetRow] } = await client.query(
      `SELECT COUNT(*) as count FROM event_bookings eb
       JOIN events e ON eb.event_id = e.id
       WHERE eb.user_id = $1 AND eb.status = 'confirmed' AND eb.attendance_status = 'present'
         AND e.organization_id = $2
         AND e.event_date >= $3::date
         AND e.event_date < ($4::date + INTERVAL '1 day')`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );
    const eventsGeleitet = parseInt(eventsGeleitetRow.count, 10) || 0;

    // Event mit meisten Teilnehmern
    const { rows: topEventRows } = await client.query(
      `SELECT e.name, COUNT(eb2.id) as teilnehmer
       FROM event_bookings eb
       JOIN events e ON eb.event_id = e.id
       LEFT JOIN event_bookings eb2 ON e.id = eb2.event_id AND eb2.status = 'confirmed' AND eb2.attendance_status = 'present'
       WHERE eb.user_id = $1 AND eb.status = 'confirmed' AND eb.attendance_status = 'present'
         AND e.organization_id = $2
         AND e.event_date >= $3::date
         AND e.event_date < ($4::date + INTERVAL '1 day')
       GROUP BY e.id, e.name
       ORDER BY teilnehmer DESC
       LIMIT 1`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );
    const meisteTeilnehmerEvent = topEventRows.length > 0
      ? { name: topEventRows[0].name, count: parseInt(topEventRows[0].teilnehmer, 10) }
      : null;

    // Konfis betreut (über zugewiesene Jahrgänge).
    // BEWUSST OHNE ZEITFILTER: ein Zustand, kein Ereignis (siehe oben).
    const { rows: konfiRows } = await client.query(
      `SELECT COUNT(DISTINCT kp.user_id) as total,
              ARRAY_AGG(DISTINCT j.name) as jahrgaenge
       FROM user_jahrgang_assignments uja
       JOIN jahrgaenge j ON uja.jahrgang_id = j.id
       JOIN konfi_profiles kp ON kp.jahrgang_id = j.id
       WHERE uja.user_id = $1 AND j.organization_id = $2`,
      [userId, orgId]
    );
    const totalKonfis = konfiRows.length > 0 ? parseInt(konfiRows[0].total, 10) || 0 : 0;
    const jahrgaengeNamen = konfiRows.length > 0 && konfiRows[0].jahrgaenge
      ? konfiRows[0].jahrgaenge.filter(Boolean)
      : [];

    // Abzeichen -- BEWUSST OHNE ZEITFILTER, dieselbe Begruendung wie im
    // Konfi-Zweig: laufende STAENDE, keine Ereignisse. Ein Abzeichen bleibt,
    // wenn es einmal verliehen ist.
    //
    // "Das erste Abzeichen" weiter unten ist davon unberuehrt -- die Seite
    // will das FRUEHESTE des Zeitraums und hat ihren eigenen Zeitfilter.
    const { rows: teamerBadges } = await client.query(
      `SELECT cb.name, cb.icon, cb.color FROM user_badges ub
       JOIN custom_badges cb ON ub.badge_id = cb.id
       WHERE ub.user_id = $1 AND ub.organization_id = $2
       ORDER BY ub.awarded_date DESC`,
      [userId, orgId]
    );
    // Wie viele Abzeichen es fuer Teamer:innen ueberhaupt gibt -- mit
    // denselben Grenzen wie die Abzeichen-Ansicht der App: nur aktive, nur
    // die der eigenen Rolle. is_hidden bleibt bewusst ungefiltert
    // (versteckte Abzeichen sind erreichbar, nur nicht vorab sichtbar).
    const { rows: [teamerBadgesGesamtRow] } = await client.query(
      `SELECT COUNT(*) as count FROM custom_badges
        WHERE organization_id = $1
          AND is_active = true
          AND target_role = 'teamer'`,
      [orgId]
    );
    const teamerBadgesGesamt = parseInt(teamerBadgesGesamtRow.count, 10) || 0;

    // Zertifikate -- ebenfalls nur die im Zeitraum ausgestellten.
    const { rows: certRows } = await client.query(
      `SELECT ct.name, uc.issued_date FROM user_certificates uc
       JOIN certificate_types ct ON uc.certificate_type_id = ct.id
       WHERE uc.user_id = $1 AND uc.organization_id = $2
         AND uc.issued_date >= $3::date
         AND uc.issued_date < ($4::date + INTERVAL '1 day')
       ORDER BY uc.issued_date DESC`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );

    // DER ANFANG -- der erste Termin des Jahres.
    //
    // Die Termin-Seite zaehlt, wie VIELE es waren; diese hier erinnert an
    // den EINEN, mit dem es losging. Ein Datum und ein Name, mehr braucht
    // die Erinnerung nicht.
    const { rows: [ersterTermin] } = await client.query(
      `SELECT e.name, e.event_date FROM event_bookings eb
         JOIN events e ON eb.event_id = e.id
        WHERE eb.user_id = $1 AND eb.status = 'confirmed' AND eb.attendance_status = 'present'
          AND e.organization_id = $2
          AND e.event_date >= $3::date
          AND e.event_date < ($4::date + INTERVAL '1 day')
        ORDER BY e.event_date ASC
        LIMIT 1`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );

    // DAS ERSTE ABZEICHEN des Jahres -- dieselbe Idee wie beim ersten
    // Termin: nicht wie viele, sondern welches zuerst.
    const { rows: [erstesAbzeichen] } = await client.query(
      `SELECT cb.name, cb.icon, cb.color, ub.awarded_date FROM user_badges ub
         JOIN custom_badges cb ON ub.badge_id = cb.id
        WHERE ub.user_id = $1 AND ub.organization_id = $2
          AND ub.awarded_date >= $3::date
          AND ub.awarded_date < ($4::date + INTERVAL '1 day')
        ORDER BY ub.awarded_date ASC
        LIMIT 1`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );

    // DER ANTWORTENDE -- wie oft jemand im Chat auf andere geantwortet hat.
    //
    // Warum gerade ANTWORTEN und nicht Nachrichten: Eine Antwort ist die
    // Zuwendung, die den Unterschied macht. Wer im Team viel schreibt, redet
    // vielleicht viel; wer viel ANTWORTET, hat auf andere reagiert -- genau
    // das ist die Arbeit, die im Team selten jemand sieht. chat_messages
    // traegt dafuer reply_to (Fremdschluessel auf die beantwortete
    // Nachricht), es braucht keine neue Spalte.
    //
    // Org-Grenze ueber den Raum, nicht ueber die Nachricht (chat_messages
    // traegt keine organization_id) -- dieselbe Regel wie im Konfi-Zweig.
    // Geloeschte Antworten zaehlen nicht: Was jemand zurueckgenommen hat,
    // soll ihm der Rueckblick nicht vorrechnen.
    const { rows: [antwortenRow] } = await client.query(
      `SELECT COUNT(*) as count FROM chat_messages cm
         JOIN chat_rooms cr ON cm.room_id = cr.id
        WHERE cm.user_id = $1 AND cr.organization_id = $2
          AND cm.reply_to IS NOT NULL
          AND cm.deleted_at IS NULL
          AND cm.created_at >= $3::date
          AND cm.created_at < ($4::date + INTERVAL '1 day')`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );
    const antworten = parseInt(antwortenRow.count, 10) || 0;

    // DIE CHALLENGE-BEGLEITERIN -- wie viele Beitraege jemand freigegeben hat.
    //
    // NUR DIE EIGENE LEISTUNG, NIE EINE ABLEHNUNGSQUOTE (Konzept
    // docs/wrapped-kacheln-konzept.md): Gezaehlt wird ausschliesslich, was
    // diese Person FREIGEGEBEN hat. Eine Quote "x % abgelehnt" waere eine
    // Bewertung der Moderation und hat im Rueckblick nichts verloren --
    // deshalb wird hidden_by hier gar nicht erst gelesen.
    //
    // approved_by ist NULL bei Bestandszeilen (vor Migration 146) UND bei
    // unmoderierten Challenges, die automatisch auf 'approved' stehen. In
    // beiden Faellen hat niemand hingesehen -- niemand bekommt sie
    // gutgeschrieben.
    //
    // Zeitanker ist approved_at (die Handlung im Rueckblicksjahr), nicht
    // das Einreichungsdatum: Ein Beitrag vom August, im September
    // freigegeben, ist Arbeit des September.
    // Das blosse try/catch, das hier bis zum 07.09.2026 stand, war
    // WIRKUNGSLOS -- gemessen: Dieser Zweig laeuft in einer Transaktion,
    // und ein fehlgeschlagenes Statement bricht sie in PostgreSQL ganz ab.
    // Jede weitere Query scheiterte danach mit "current transaction is
    // aborted": Der Fehler war abgefangen, der Teamer-Rueckblick trotzdem
    // fuer jede Person weg. Siehe zahlAusNeuerSpalte().
    const freigegebeneBeitraege = await zahlAusNeuerSpalte(
      client,
      `SELECT COUNT(*)::int AS anzahl FROM challenge_submissions cs
        WHERE cs.approved_by = $1
          AND cs.organization_id = $2
          AND cs.approved_at >= $3::date
          AND cs.approved_at < ($4::date + INTERVAL '1 day')`,
      [userId, orgId, zeitraumStart, zeitraumEnde],
      'Challenge-Freigaben (Migration 146)'
    );

    // DEIN TEAM -- mit wie vielen anderen zusammen die Jahrgaenge betreut
    // wurden.
    //
    // Self-Join ueber user_jahrgang_assignments: alle, die auf denselben
    // Jahrgaengen stehen wie diese Person. NUR TEAMER:INNEN -- ohne den
    // Rollenfilter zaehlten Admins und die Leitung mit, und die Zahl waere
    // keine Aussage ueber das Team, sondern ueber die Zugriffsrechte.
    // Die Person selbst ist ausgenommen (sie ist nicht ihr eigenes Team).
    const { rows: [teamRow] } = await client.query(
      `SELECT COUNT(DISTINCT andere.user_id)::int AS mitstreitende
         FROM user_jahrgang_assignments meine
         JOIN user_jahrgang_assignments andere
           ON andere.jahrgang_id = meine.jahrgang_id
          AND andere.user_id <> meine.user_id
         JOIN jahrgaenge j ON j.id = meine.jahrgang_id
         JOIN users u ON u.id = andere.user_id
         JOIN roles r ON r.id = u.role_id
        WHERE meine.user_id = $1
          AND j.organization_id = $2
          AND u.organization_id = $2
          AND r.name = 'teamer'
          AND u.deleted_at IS NULL`,
      [userId, orgId]
    );
    const teamGroesse = teamRow ? teamRow.mitstreitende : 0;

    // VOM KONFI ZUR TEAMER:IN -- die eigene Geschichte in der Gemeinde.
    //
    // Wer heute im Team ist und frueher selbst Konfi war, hat eine
    // Konfi-Zeit in derselben Gemeinde hinter sich. Das ist die schoenste
    // Nachricht, die ein Teamer-Rueckblick tragen kann, und sie steht
    // laengst in der Datenbank: konfi_profiles bleibt beim Rollenwechsel
    // stehen (geloescht wird die Zeile nur, wenn der ganze Mensch geloescht
    // wird -- routes/users.js, purgeHistory).
    //
    // Die Seite erscheint nur, wenn wir wirklich etwas wissen: eine
    // Konfi-Zeit in DIESER Organisation. Ein Profil aus einer fremden
    // Gemeinde erzaehlt nicht die Geschichte dieser Gemeinde.
    const { rows: [konfiZeit] } = await client.query(
      `SELECT j.name AS jahrgang, kp.created_at
         FROM konfi_profiles kp
         LEFT JOIN jahrgaenge j ON j.id = kp.jahrgang_id
        WHERE kp.user_id = $1 AND kp.organization_id = $2
        ORDER BY kp.created_at ASC NULLS LAST
        LIMIT 1`,
      [userId, orgId]
    );
    const warSelbstKonfi = Boolean(konfiZeit);

    // Jahre aktiv (teamer_since). BEWUSST EIN LEBENSZEITWERT -- aber gegen
    // das Zeitraum-Ende gerechnet, nicht gegen "jetzt" (siehe oben).
    const { rows: [userRow] } = await client.query(
      `SELECT teamer_since FROM users WHERE id = $1`,
      [userId]
    );
    const teamerSeit = userRow && userRow.teamer_since ? userRow.teamer_since : null;
    const stichtag = new Date(`${zeitraumEnde}T00:00:00`).getTime();
    const jahreAktiv = teamerSeit
      ? Math.max(1, Math.floor((stichtag - new Date(teamerSeit).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
      : 0;

    // NEU DABEI -- das erste Jahr im Team.
    //
    // Fallback-Kette wie im Abzeichen-Zweig (routes/badges.js, 'teamer_year'):
    // erst users.teamer_since, sonst die aelteste Teamer-Aktivitaet. Ohne
    // beides bleibt es unbekannt -- und "unbekannt" ist NICHT "neu": Wer
    // seit Jahren dabei ist, aber kein Eintrittsdatum hinterlegt hat, darf
    // nicht als Neuling begruesst werden.
    let teamerStartJahr = null;
    if (teamerSeit) {
      teamerStartJahr = new Date(teamerSeit).getFullYear();
    } else {
      try {
        const { rows: [ersteAkt] } = await client.query(
          `SELECT MIN(ua.completed_date) AS min_date FROM user_activities ua
             JOIN activities a ON ua.activity_id = a.id
            WHERE ua.user_id = $1 AND a.target_role = 'teamer'`,
          [userId]
        );
        if (ersteAkt && ersteAkt.min_date) {
          teamerStartJahr = new Date(ersteAkt.min_date).getFullYear();
        }
      } catch (startErr) {
        console.warn('Wrapped: Teamer-Startjahr nicht ermittelbar:', startErr.message);
      }
    }
    // Erstes Jahr = das Startjahr liegt IM Rueckblicksjahr.
    const erstesJahr = teamerStartJahr !== null && teamerStartJahr === year;

    // Die Sonderseite zur Sommerfreizeit 2026 -- dieselbe Pruefung wie im
    // Konfi-Rueckblick. Simon: "das sehen dann nur die teamer und konfis
    // die dabei waren."
    const stavanger2026 = await warBeiStavanger(client, userId, orgId, zeitraumStart, zeitraumEnde);


    const schnappschuss = {
      // Version 3 (06.09.2026), in zwei Schritten gewachsen:
      //   2: alle Ereignis-Zahlen sind auf den Zeitraum eingegrenzt
      //      (`zeitraum` bekam start/ende dazu).
      //   3: der Rueckblick waehlt seine Seiten nach Inhalt statt sieben
      //      feste zu zeigen (`kacheln`, unten gesetzt).
      //
      // Beide Schritte rein ADDITIV -- kein Feld entfernt, umbenannt oder
      // umtypisiert. Ausgelieferte Apps kennen `kacheln` nicht, ignorieren
      // das Feld und rendern weiter ueber ihre feste Siebener-Reihenfolge.
      // Bereits erzeugte Snapshots liegen unveraendert in der Datenbank und
      // werden nie neu gerechnet -- der alte Rueckblick bleibt der alte.
      version: 3,
      slides: {
        events_geleitet: {
          total: eventsGeleitet,
          meiste_teilnehmer_event: meisteTeilnehmerEvent
        },
        konfis_betreut: {
          total_konfis: totalKonfis,
          jahrgaenge: jahrgaengeNamen
        },
        badges: {
          total_earned: teamerBadges.length,
          // Ab 06.09.2026 ergaenzt (rein additiv -- aeltere Apps ignorieren
          // das Feld, aeltere Snapshots tragen es schlicht nicht).
          total_available: teamerBadgesGesamt,
          badges: teamerBadges.map(b => ({ name: b.name, icon: b.icon, color: b.color }))
        },
        zertifikate: {
          total: certRows.length,
          zertifikate: certRows.map(c => ({ name: c.name, issued_date: c.issued_date }))
        },
        engagement: {
          teamer_seit: teamerSeit,
          jahre_aktiv: jahreAktiv
        },
        // Additiv (ab Version 3): alte Apps kennen die Felder nicht und
        // ignorieren sie.
        chat: {
          antworten
        },
        team: {
          mitstreitende: teamGroesse
        },
        moderation: {
          freigegeben: freigegebeneBeitraege
        },
        neu_dabei: {
          erstes_jahr: erstesJahr,
          start_jahr: teamerStartJahr
        },
        anfang: ersterTermin
          ? { name: ersterTermin.name, datum: ersterTermin.event_date }
          : null,
        erstes_abzeichen: erstesAbzeichen
          ? {
              name: erstesAbzeichen.name,
              icon: erstesAbzeichen.icon,
              color: erstesAbzeichen.color,
              datum: erstesAbzeichen.awarded_date
            }
          : null,
        konfi_zeit: warSelbstKonfi
          ? { jahrgang: konfiZeit.jahrgang || null }
          : null,
        // Additiv (07.09.2026): die Sommerfreizeit-Sonderseite. Alte Apps
        // kennen das Feld nicht und ignorieren es.
        stavanger_2026: stavanger2026,
        zeitraum: {
          year,
          // Additiv (ab Version 2): alte Apps ignorieren die Felder, neue
          // koennen den Zeitraum benennen, statt ihn aus `year` zu raten.
          start: zeitraumStart,
          ende: zeitraumEnde
        }
      }
    };

    // Die Seitenauswahl -- wie beim Konfi-Rueckblick IM Snapshot gespeichert
    // statt bei jedem Ansehen neu gerechnet: Ein Rueckblick wird geteilt und
    // mehrfach geoeffnet und muss jedes Mal gleich aussehen.
    //
    // Additiv: Alte App-Versionen kennen `kacheln` nicht und rendern weiter
    // ueber ihre feste Siebener-Reihenfolge. Der Vertrag bleibt gewahrt.
    schnappschuss.kacheln = waehleTeamerKacheln(schnappschuss.slides);
    return schnappschuss;
  }

  /**
   * Parallele Hilfsfunktion: Generiert und speichert einen Konfi-Snapshot.
   * Holt eigenen DB-Client aus dem Pool (kein geteilter Client für parallele Queries).
   */
  async function generateAndSaveKonfiSnapshot(dbRef, userId, orgId, jahrgangId, year, ausgabeId = null, zeitraumVorgabe = null) {
    const konfiClient = await dbRef.getClient();
    try {
      const snapshot = await generateKonfiSnapshot(konfiClient, userId, orgId, jahrgangId, year, zeitraumVorgabe);
      // Der Schluessel schliesst seit Migration 144 die AUSGABE ein: Je
      // Ausgabe ein Snapshot pro Person. Innerhalb einer Ausgabe bleibt der
      // Lauf idempotent (Korrektur ueberschreibt), zwei Ausgaben stehen
      // nebeneinander -- vorher ueberschrieb "Dein Abschluss" still "Dein
      // erstes Jahr".
      await konfiClient.query(
        `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, jahrgang_id, year, ausgabe_id, data, computed_at)
         VALUES ($1, $2, 'konfi', $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id, wrapped_type, year, COALESCE(jahrgang_id, 0), COALESCE(ausgabe_id, 0))
         DO UPDATE SET data = EXCLUDED.data, computed_at = NOW(), organization_id = EXCLUDED.organization_id`,
        [userId, orgId, jahrgangId, year, ausgabeId, JSON.stringify(snapshot)]
      );
      return { userId, ok: true };
    } catch (err) {
      console.error(`Wrapped generation error for konfi ${userId}:`, err.message);
      return { userId, ok: false, err };
    } finally {
      konfiClient.release();
    }
  }

  // ====================================================================
  // ENDPOINTS
  // ====================================================================

  // GET /me - Eigenen Wrapped-Snapshot abrufen
  router.get('/me', rbacVerifier, async (req, res) => {
    try {
      const roleName = req.user.role_name;
      const wrappedType = (roleName === 'teamer') ? 'teamer' : 'konfi';
      const currentYear = new Date().getFullYear();

      // Den zuletzt FREIGEGEBENEN Rueckblick holen -- samt Titel seiner
      // Ausgabe. Der Titel ist neu (Simon, 03.09.2026: "Damit man etwa auch
      // einen Zwischenstand mit Titel machen kann. Und das muss dann auch
      // entsprechend bei Konfis und Teamern angezeigt werden.").
      //
      // Alt-Snapshots haben keine ausgabe_id -- fuer sie bleibt titel null
      // und die App zeigt wie bisher ihre eigene Ueberschrift.
      const { rows } = await db.query(
        `SELECT s.data, s.computed_at, s.year,
                a.id AS ausgabe_id, a.titel, a.freigegeben_at
           FROM wrapped_snapshots s
           LEFT JOIN wrapped_ausgaben a ON a.id = s.ausgabe_id
          WHERE s.user_id = $1 AND s.wrapped_type = $2
            AND (a.id IS NULL OR a.freigegeben_at IS NOT NULL)
          ORDER BY COALESCE(a.freigegeben_at, s.computed_at) DESC, s.year DESC
          LIMIT 1`,
        [req.user.id, wrappedType]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Kein Wrapped-Snapshot vorhanden' });
      }

      // Freigabe-Gate: Konfi-Wrapped gibt es erst, wenn der Jahrgang
      // freigegeben ist (wrapped_released_at auf jahrgaenge). Bisher prüfte
      // das nur das Dashboard (routes/konfi.js) — der Snapshot selbst war
      // hier auch vor der Freigabe abrufbar (Drei-Ansichten-Befund M7).
      // Gleiche Abfrage wie im Dashboard: der AKTUELLE Jahrgang des Konfis
      // zaehlt. Nach der Snapshot-Pruefung, damit "kein Snapshot" weiterhin
      // 404 bleibt. Teamer-Wrapped kennt keine Freigabe, dort bleibt alles offen.
      if (roleName === 'konfi') {
        const { rows: [gate] } = await db.query(
          `SELECT EXISTS(
             SELECT 1 FROM jahrgaenge j
             JOIN konfi_profiles kp ON kp.jahrgang_id = j.id
             WHERE kp.user_id = $1
               AND j.wrapped_released_at IS NOT NULL
               AND j.wrapped_released_at <= NOW()
           ) AS released`,
          [req.user.id]
        );
        if (!gate || !gate.released) {
          return res.status(403).json({ error: 'Wrapped ist noch nicht freigegeben' });
        }
      }

      res.json({
        data: rows[0].data,
        computed_at: rows[0].computed_at,
        year: rows[0].year,
        wrapped_type: wrappedType,
        // Additiv -- alte Apps ignorieren die Felder und zeigen wie bisher.
        ausgabe_id: rows[0].ausgabe_id || null,
        titel: rows[0].titel || null
      });
    } catch (err) {
      console.error('Error loading wrapped snapshot:', err);
      res.status(500).json({ error: 'Fehler beim Laden des Wrapped-Snapshots' });
    }
  });

  // POST /generate/:jahrgangId - Konfi-Snapshots für alle Konfis eines Jahrgangs generieren
  // Erzeugt (und gibt frei) den Rueckblick eines Jahrgangs.
  //
  // AUSGABEN (Migration 143, Simons Vorgabe 02.09.2026): Ein Jahrgang laeuft
  // ueber mehrere Jahre und braucht mehrere Rueckblicke -- "Dein erstes
  // Jahr", "Zwischenstand", "Dein Abschluss". Diese Route legt deshalb bei
  // jedem Lauf eine AUSGABE an, statt einen einzigen Stand pro Jahrgang zu
  // ueberschreiben.
  //
  // BEWUSST KEINE ZWEITE ROUTE: Das Anlegen einer Ausgabe ist derselbe
  // Vorgang wie das Erzeugen des Rueckblicks -- eine eigene Route waere ein
  // zweiter Weg zum selben Ziel und liefe irgendwann auseinander.
  //
  // Der Titel ist optional. Ohne ihn entsteht ein Vorschlag aus dem
  // Jahrgangsnamen, damit niemand etwas eingeben MUSS.
  router.post('/generate/:jahrgangId',
    rbacVerifier,
    requireAdmin,
    param('jahrgangId').isInt({ min: 1 }),
    body('titel').optional({ nullable: true }).isString().trim().isLength({ min: 1, max: 120 }),
    body('zeitraum_start').optional({ nullable: true }).isISO8601(),
    body('zeitraum_ende').optional({ nullable: true }).isISO8601(),
    handleValidationErrors,
    async (req, res) => {
      const client = await db.getClient();
      try {
        const jahrgangId = parseInt(req.params.jahrgangId, 10);

        // Jahrgang validieren: gehört zur Org des Admins
        const { rows: [jahrgang] } = await client.query(
          `SELECT id, name, wrapped_released_at FROM jahrgaenge WHERE id = $1 AND organization_id = $2`,
          [jahrgangId, req.user.organization_id]
        );
        if (!jahrgang) {
          return res.status(404).json({ error: 'Jahrgang nicht gefunden' });
        }

        // Jahrgangs-Bindung (01.09.2026): Der Lauf ueberschreibt die Snapshots
        // ALLER Konfis des Jahrgangs, setzt die Freigabe und loest beim ersten
        // Mal einen Push an den ganzen Jahrgang aus. Das ist ein schreibender
        // Eingriff in den Jahrgang — bisher genuegte requireAdmin plus Org,
        // ein Admin konnte also den Rueckblick eines FREMDEN Jahrgangs
        // freigeben. Jetzt gilt Simons Regel: nur mit edit-Zuweisung,
        // org_admin/super_admin ausgenommen.
        if (!darfJahrgang(req, jahrgangId, { edit: true })) {
          return res.status(403).json({ error: 'Kein Zugriff auf diesen Jahrgang' });
        }

        // War der Rueckblick schon freigegeben, ist dieser Lauf eine
        // KORREKTUR und keine Freigabe. Der Push unten entfaellt dann --
        // sonst bekommt der ganze Jahrgang ein zweites Mal "Dein
        // Jahresrueckblick ist da", nur weil jemand eine Zahl richtiggestellt
        // hat. Zurueckgenommen wird die Marke ueber DELETE
        // /wrapped/jahrgang/:id (setzt wrapped_released_at auf NULL);
        // danach benachrichtigt eine erneute Freigabe wieder.
        const schonFreigegeben = jahrgang.wrapped_released_at !== null;

        const currentYear = new Date().getFullYear();

        // Die Transaktion umschliesst NUR das Setzen der Freigabe unten, nicht
        // die Snapshots: Die laufen bewusst parallel ueber eigene Pool-Clients
        // (generateAndSaveKonfiSnapshot) und liegen damit ausserhalb. Bei einem
        // ROLLBACK bleiben bereits geschriebene Snapshots stehen.
        //
        // Das ist gewollt und harmlos: Der Insert ist idempotent (ON CONFLICT
        // DO UPDATE), ein erneuter Lauf erzeugt denselben Stand. Ohne die
        // Freigabe sieht sie ohnehin niemand -- GET /me gibt fuer Konfis 403,
        // solange wrapped_released_at nicht gesetzt ist.
        //
        // Alles in EINE Transaktion zu ziehen hiesse, die parallele
        // Generierung aufzugeben (ein Client, seriell) -- teurer Umbau fuer
        // einen Fall, der keine falschen Daten erzeugt.
        // Die AUSGABE zuerst und AUSSERHALB der Transaktion.
        //
        // Zwei Gruende, beide gemessen:
        // 1. Die Snapshots brauchen ihre id als Teil des Schluessels
        //    (Migration 144) -- ohne sie ueberschreibt der zweite Lauf den
        //    ersten still.
        // 2. Die Snapshot-Generierung laeuft ueber EIGENE Pool-Clients
        //    (generateAndSaveKonfiSnapshot, parallel). Steckte die Ausgabe
        //    in dieser Transaktion, saehen die anderen Verbindungen sie
        //    nicht -- der Fremdschluessel schlug fehl:
        //    "violates foreign key constraint wrapped_snapshots_ausgabe_id_fkey".
        //
        // Bleibt der Lauf danach stecken, steht eine leere Ausgabe herum.
        // Das ist die harmlosere Seite: Sie ist sichtbar und loeschbar
        // (DELETE /wrapped/ausgabe/:id), waehrend ein Fremdschluesselfehler
        // gar keine Snapshots erzeugt haette.
        const titel = (req.body?.titel || '').trim()
          || `Rückblick ${jahrgang.name || currentYear}`;

        // Der Zeitraum der Ausgabe -- DIESELBEN Werte, die unten in
        // wrapped_ausgaben landen und die die Oberflaeche anzeigt.
        //
        // BEFUND 06.09.2026: zeitraum_start/zeitraum_ende wurden validiert
        // und gespeichert, aber NIE an die Generierung uebergeben. Gerechnet
        // wurde immer mit berechneZeitraum(konfirmationTermin, currentYear).
        // Solange das Formular kein Datumsfeld hatte, fiel das nicht auf --
        // sobald jemand einen Zeitraum eintraegt, staenden Zahlen aus einem
        // anderen Zeitraum darunter.
        //
        // null, wenn nichts angegeben wurde: dann greift wie bisher das
        // Konfirmations-Fallback in berechneZeitraum.
        const zeitraumStartVorgabe = req.body?.zeitraum_start || null;
        const zeitraumEndeVorgabe = req.body?.zeitraum_ende || null;
        const zeitraumVorgabe = (zeitraumStartVorgabe && zeitraumEndeVorgabe)
          ? { start: zeitraumStartVorgabe, ende: zeitraumEndeVorgabe }
          : null;
        // Der Zeitraum, der in der Ausgabe STEHT, muss der sein, mit dem
        // gerechnet wird (Simons Regel 07.09.2026: vom Anfang der Konfi-Zeit
        // bis heute). Ohne Vorgabe: der frueheste Beginn im Jahrgang bis
        // heute -- die Spanne, die die Ausgabe insgesamt abdeckt. Die
        // einzelnen Rueckblicke beginnen je am eigenen Eintritt.
        const heuteIso = (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })();
        let anzeigeStart = zeitraumStartVorgabe;
        if (!anzeigeStart) {
          const { rows: [fruehest] } = await client.query(
            `SELECT MIN(kp.created_at)::date AS beginn FROM konfi_profiles kp
               JOIN users u ON kp.user_id = u.id
               JOIN roles r ON u.role_id = r.id
              WHERE kp.jahrgang_id = $1 AND r.name = 'konfi' AND u.deleted_at IS NULL`,
            [jahrgangId]
          );
          anzeigeStart = fruehest && fruehest.beginn
            ? new Date(fruehest.beginn).toISOString().slice(0, 10)
            : `${currentYear - 1}-09-01`;
        }
        const { rows: [ausgabe] } = await client.query(
          `INSERT INTO wrapped_ausgaben
             (organization_id, wrapped_type, jahrgang_id, titel,
              zeitraum_start, zeitraum_ende, freigegeben_at, freigegeben_von,
              erstellt_von)
           VALUES ($1, 'konfi', $2, $3, $4::date, $5::date, NOW(), $6, $6)
           RETURNING id, titel`,
          [req.user.organization_id, jahrgangId, titel,
           anzeigeStart,
           zeitraumEndeVorgabe || heuteIso,
           req.user.id]
        );

        await client.query('BEGIN');

        // Alle Konfis des Jahrgangs laden
        const { rows: konfis } = await client.query(
          `SELECT kp.user_id FROM konfi_profiles kp
           JOIN users u ON kp.user_id = u.id
           JOIN roles r ON u.role_id = r.id
           WHERE kp.jahrgang_id = $1 AND r.name = 'konfi' AND u.deleted_at IS NULL`,
          [jahrgangId]
        );

        // Parallele Snapshot-Generierung (jeder Konfi holt eigenen DB-Client)
        const results = await Promise.allSettled(
          konfis.map(konfi => generateAndSaveKonfiSnapshot(db, konfi.user_id, req.user.organization_id, jahrgangId, currentYear, ausgabe.id, zeitraumVorgabe))
        );
        const generated = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
        const errors = results.length - generated;

        // ALT-APP-VERTRAG: wrapped_released_at bleibt gesetzt. Ausgelieferte
        // App-Versionen lesen diese Spalte ueber das Konfi-Dashboard --
        // verschwaende sie, braeche der Rueckblick auf den Geraeten.
        await client.query(
          `UPDATE jahrgaenge SET wrapped_released_at = NOW() WHERE id = $1`,
          [jahrgangId]
        );

        await client.query('COMMIT');

        // Push-Notification an alle Konfis -- nur bei der ERSTEN Freigabe.
        if (!schonFreigegeben) {
          try {
            const konfiIds = konfis.map(k => k.user_id);
            await PushService.sendWrappedReleased(db, konfiIds, 'konfi', req.user.organization_id);
          } catch (pushErr) {
            console.error('Push-Notification für Konfi-Wrapped fehlgeschlagen:', pushErr);
          }
        }

        res.json({
          message: `Wrapped f\u00fcr ${generated} Konfis generiert`,
          generated,
          errors,
          jahrgang: jahrgang.name,
          year: currentYear,
          // Additiv (ausgelieferte Apps lesen die Antwort): sagt der Leitung,
          // ob dieser Lauf benachrichtigt hat oder eine stille Korrektur war.
          benachrichtigt: !schonFreigegeben
        });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error generating konfi wrapped:', err);
        res.status(500).json({ error: 'Fehler beim Generieren der Konfi-Wrapped-Snapshots' });
      } finally {
        client.release();
      }
    }
  );

  // POST /generate-teamer - Teamer-Snapshots für alle Teamer der Organisation generieren
  // Erzeugt und GIBT FREI: die Teamer-Ausgabe.
  //
  // Auch hier eine Ausgabe je Lauf (Simons Vorgabe: mehrfach freigeben,
  // frei benennen). Rechte bewusst enger als bei den Konfis: nur org_admin,
  // weil eine Teamer-Ausgabe die ganze Organisation betrifft und nicht an
  // einem Jahrgang haengt.
  router.post('/generate-teamer',
    rbacVerifier,
    requireOrgAdmin,
    body('titel').optional({ nullable: true }).isString().trim().isLength({ min: 1, max: 120 }),
    // Zeitraum wie bei den Konfis. Fehlte hier komplett -- die Teamer-Route
    // nahm nur einen Titel entgegen und schrieb einen fest gerechneten
    // Zeitraum in die Ausgabe.
    body('zeitraum_start').optional({ nullable: true }).isISO8601(),
    body('zeitraum_ende').optional({ nullable: true }).isISO8601(),
    handleValidationErrors,
    async (req, res) => {
      const client = await db.getClient();
      try {
        const currentYear = new Date().getFullYear();

        const zeitraumStartVorgabe = req.body?.zeitraum_start || null;
        const zeitraumEndeVorgabe = req.body?.zeitraum_ende || null;
        const zeitraumVorgabe = (zeitraumStartVorgabe && zeitraumEndeVorgabe)
          ? { start: zeitraumStartVorgabe, ende: zeitraumEndeVorgabe }
          : null;

        await client.query('BEGIN');

        // Alle Teamer der Organisation laden
        const { rows: teamers } = await client.query(
          `SELECT u.id as user_id FROM users u
           JOIN roles r ON u.role_id = r.id
           WHERE r.name = 'teamer' AND u.organization_id = $1`,
          [req.user.organization_id]
        );

        // Die Ausgabe zuerst -- ihre id gehoert seit Migration 144 zum
        // Schluessel der Snapshots. Sonst ueberschreibt jeder Lauf den
        // vorigen (derselbe Fehler wie bei den Konfis).
        const teamerTitel = (req.body?.titel || '').trim()
          || `Teamer-Rückblick ${currentYear}`;
        // Der Zeitraum, der in der Ausgabe STEHT, muss der sein, mit dem
        // gerechnet wird. Ohne Vorgabe ist das die Kette: vom Ende der
        // vorigen Teamer-Ausgabe bis heute. Steht noch keine da (erste
        // Ausgabe), bleibt die Zeile beim heutigen Tag als Ende und dem
        // frueheren Eintritt als Anfang -- die Personen unterscheiden sich
        // darin, die ANZEIGE nennt deshalb den frueheren der beiden.
        const heuteIso = (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })();
        const vorigesEndeFuerAnzeige = zeitraumVorgabe
          ? null
          : await ermittleVorigesTeamerEnde(client, req.user.organization_id);
        const anzeigeStart = zeitraumStartVorgabe
          || (vorigesEndeFuerAnzeige
            ? new Date(vorigesEndeFuerAnzeige).toISOString().slice(0, 10)
            : null)
          // Ganz ohne Vorgaenger: der frueheste Eintritt ins Team. Das ist
          // die Spanne, die die Ausgabe insgesamt abdeckt.
          || (await (async () => {
            const { rows: [r] } = await client.query(
              `SELECT MIN(u.teamer_since)::date AS seit FROM users u
                 JOIN roles r ON u.role_id = r.id
                WHERE r.name = 'teamer' AND u.organization_id = $1`,
              [req.user.organization_id]
            );
            return r && r.seit ? new Date(r.seit).toISOString().slice(0, 10) : null;
          })())
          || `${currentYear - 1}-09-01`;
        const { rows: [teamerAusgabe] } = await client.query(
          `INSERT INTO wrapped_ausgaben
             (organization_id, wrapped_type, jahrgang_id, titel,
              zeitraum_start, zeitraum_ende, freigegeben_at, freigegeben_von,
              erstellt_von)
           VALUES ($1, 'teamer', NULL, $2, $3::date, $4::date, NOW(), $5, $5)
           RETURNING id, titel`,
          [req.user.organization_id, teamerTitel,
           anzeigeStart,
           zeitraumEndeVorgabe || heuteIso, req.user.id]
        );

        // Das Ende der VORIGEN Ausgabe -- der Anfang dieser. Einmal pro Lauf,
        // und ausdruecklich OHNE die soeben angelegte Ausgabe (sonst faende
        // sie sich selbst).
        const vorigesEnde = zeitraumVorgabe
          ? null
          : await ermittleVorigesTeamerEnde(client, req.user.organization_id, teamerAusgabe.id);

        let generated = 0;
        let errors = 0;

        for (const teamer of teamers) {
          try {
            const snapshot = await generateTeamerSnapshot(client, teamer.user_id, req.user.organization_id, currentYear, zeitraumVorgabe, vorigesEnde);

            await client.query(
              `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, year, ausgabe_id, data, computed_at)
               VALUES ($1, $2, 'teamer', $3, $4, $5, NOW())
               ON CONFLICT (user_id, wrapped_type, year, COALESCE(jahrgang_id, 0), COALESCE(ausgabe_id, 0))
               DO UPDATE SET data = EXCLUDED.data, computed_at = NOW(), organization_id = EXCLUDED.organization_id`,
              [teamer.user_id, req.user.organization_id, currentYear, teamerAusgabe.id, JSON.stringify(snapshot)]
            );
            generated++;
          } catch (err) {
            console.error(`Wrapped generation error for teamer ${teamer.user_id}:`, err.message);
            errors++;
          }
        }

        await client.query('COMMIT');

        // Push-Notification an alle Teamer:innen
        try {
          const teamerIds = teamers.map(t => t.user_id);
          await PushService.sendWrappedReleased(db, teamerIds, 'teamer', req.user.organization_id);
        } catch (pushErr) {
          console.error('Push-Notification für Teamer-Wrapped fehlgeschlagen:', pushErr);
        }

        res.json({
          message: `Wrapped f\u00fcr ${generated} Personen im Team generiert`,
          generated,
          errors,
          year: currentYear,
          // Additiv: alte Clients ignorieren die Felder.
          ausgabe_id: teamerAusgabe.id,
          titel: teamerAusgabe.titel
        });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error generating teamer wrapped:', err);
        res.status(500).json({ error: 'Fehler beim Generieren der Teamer-Wrapped-Snapshots' });
      } finally {
        client.release();
      }
    }
  );

  // GET /meine - alle eigenen Rueckblicke, mit Titel.
  //
  // Simon (03.09.2026): "Volle Flexibilitaet fuer Wrapped ... und das muss
  // dann auch entsprechend bei Konfis und Teamern angezeigt werden."
  // GET /me liefert nur den NEUESTEN -- bei mehreren Ausgaben ("Dein erstes
  // Jahr", "Zwischenstand", "Dein Abschluss") saehe eine Konfi die aelteren
  // sonst nie. Diese Route listet sie alle.
  //
  // Zeigt ausschliesslich FREIGEGEBENE Ausgaben: Was die Leitung noch nicht
  // freigegeben hat, bleibt unsichtbar.
  router.get('/meine', rbacVerifier, async (req, res) => {
    try {
      const wrappedType = (req.user.role_name === 'teamer') ? 'teamer' : 'konfi';
      const { rows } = await db.query(
        `SELECT s.id, s.year, s.computed_at,
                a.id AS ausgabe_id, a.titel, a.freigegeben_at,
                a.zeitraum_start, a.zeitraum_ende
           FROM wrapped_snapshots s
           LEFT JOIN wrapped_ausgaben a ON a.id = s.ausgabe_id
          WHERE s.user_id = $1 AND s.wrapped_type = $2
            AND (a.id IS NULL OR a.freigegeben_at IS NOT NULL)
          ORDER BY COALESCE(a.freigegeben_at, s.computed_at) DESC`,
        [req.user.id, wrappedType]
      );
      res.json(rows.map(r => ({
        snapshot_id: r.id,
        ausgabe_id: r.ausgabe_id,
        titel: r.titel || `Dein Rückblick ${r.year}`,
        year: r.year,
        zeitraum_start: r.zeitraum_start,
        zeitraum_ende: r.zeitraum_ende,
        computed_at: r.computed_at
      })));
    } catch (err) {
      console.error('Error loading own wrapped list:', err);
      res.status(500).json({ error: 'Fehler beim Laden der Rückblicke' });
    }
  });

  // DELETE /ausgabe/:id - eine EINZELNE Ausgabe samt ihrer Snapshots.
  //
  // Simon (03.09.2026): "Ich will auch alle Wrapped eines Zustandes loeschen
  // koennen." Die bestehenden Loeschwege raeumen pauschal auf (alles eines
  // Jahrgangs bzw. alle Teamer-Snapshots) -- mit mehreren Ausgaben je
  // Jahrgang braucht es den gezielten Weg, sonst nimmt das Loeschen eines
  // Zwischenstands den Abschluss mit.
  //
  // Die Snapshots haengen per ON DELETE CASCADE an der Ausgabe (Migration
  // 143) und verschwinden mit.
  router.delete('/ausgabe/:id',
    rbacVerifier,
    requireAdmin,
    param('id').isInt({ min: 1 }),
    handleValidationErrors,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        const istOrgAdmin = ['org_admin', 'super_admin'].includes(req.user.role_name);

        const { rows: [ausgabe] } = await db.query(
          `SELECT id, wrapped_type, jahrgang_id FROM wrapped_ausgaben
            WHERE id = $1 AND organization_id = $2`,
          [id, req.user.organization_id]
        );
        if (!ausgabe) {
          return res.status(404).json({ error: 'Ausgabe nicht gefunden' });
        }

        // Dieselbe Rechte-Grenze wie beim Anlegen und Anzeigen:
        // Teamer-Ausgaben nur org_admin, Konfi-Ausgaben nur eigene Jahrgaenge.
        if (ausgabe.wrapped_type === 'teamer' && !istOrgAdmin) {
          return res.status(403).json({ error: 'Nur die Leitung darf Teamer-Ausgaben loeschen' });
        }
        if (ausgabe.wrapped_type === 'konfi' && !istOrgAdmin) {
          const { rows: [zugriff] } = await db.query(
            `SELECT 1 FROM user_jahrgang_assignments
              WHERE user_id = $1 AND jahrgang_id = $2`,
            [req.user.id, ausgabe.jahrgang_id]
          );
          if (!zugriff) {
            return res.status(403).json({ error: 'Kein Zugriff auf diesen Jahrgang' });
          }
        }

        const { rows: [{ anzahl }] } = await db.query(
          `SELECT COUNT(*)::int AS anzahl FROM wrapped_snapshots WHERE ausgabe_id = $1`,
          [id]
        );
        await db.query(`DELETE FROM wrapped_ausgaben WHERE id = $1`, [id]);

        // Die Alt-Marke am Jahrgang nachziehen: Bleibt keine freigegebene
        // Konfi-Ausgabe uebrig, darf auch wrapped_released_at nicht stehen
        // bleiben -- sonst zeigte das Dashboard alter App-Versionen weiter
        // einen Rueckblick an, den es nicht mehr gibt.
        if (ausgabe.wrapped_type === 'konfi' && ausgabe.jahrgang_id) {
          await db.query(
            `UPDATE jahrgaenge SET wrapped_released_at = NULL
              WHERE id = $1 AND NOT EXISTS (
                SELECT 1 FROM wrapped_ausgaben
                 WHERE jahrgang_id = $1 AND freigegeben_at IS NOT NULL)`,
            [ausgabe.jahrgang_id]
          );
        }

        res.json({ message: `Ausgabe gelöscht (${anzahl} Rückblicke)`, deleted: anzahl });
      } catch (err) {
        console.error('Error deleting wrapped ausgabe:', err);
        res.status(500).json({ error: 'Fehler beim Loeschen der Ausgabe' });
      }
    }
  );

  // GET /ausgaben - die Rueckblick-Ausgaben der Organisation.
  //
  // DIE EINZIGE WIRKLICH NEUE ROUTE (Simon, 03.09.2026: "Routen die wir
  // brauchen sollst du bauen, aber nicht was Neues einfuehren, wenn wir es
  // schon woanders haben"). Geprueft: Es gibt keinen bestehenden Ort dafuer.
  // GET /history/:userId liefert die Rueckblicke EINER PERSON, nicht die
  // Ausgaben der Gemeinde -- das Anlegen und Freigeben laeuft dagegen ueber
  // die bestehenden generate-Routen, die dafuer nur erweitert wurden.
  //
  // RECHTE (Simons Entscheidung): Ein Admin sieht nur Ausgaben SEINER
  // Jahrgaenge, org_admin und super_admin sehen alle. Teamer-Ausgaben sind
  // organisationsweit und deshalb nur fuer org_admin sichtbar -- dieselbe
  // Grenze wie beim Erzeugen.
  router.get('/ausgaben',
    rbacVerifier,
    requireAdmin,
    query('typ').optional().isIn(['konfi', 'teamer']),
    handleValidationErrors,
    async (req, res) => {
      try {
        const istOrgAdmin = ['org_admin', 'super_admin'].includes(req.user.role_name);
        const typ = req.query.typ || null;

        const { rows } = await db.query(
          `SELECT a.id, a.wrapped_type, a.jahrgang_id, j.name AS jahrgang_name,
                  a.titel, a.zeitraum_start, a.zeitraum_ende,
                  a.freigegeben_at, a.created_at,
                  COUNT(s.id)::int AS snapshots
             FROM wrapped_ausgaben a
             LEFT JOIN jahrgaenge j ON j.id = a.jahrgang_id
             LEFT JOIN wrapped_snapshots s ON s.ausgabe_id = a.id
            WHERE a.organization_id = $1
              AND ($2::text IS NULL OR a.wrapped_type = $2::text)
              AND (
                -- Teamer-Ausgaben nur fuer org_admin.
                (a.wrapped_type = 'teamer' AND $3::boolean)
                -- Konfi-Ausgaben: org_admin alle, Admin nur eigene Jahrgaenge.
                OR (a.wrapped_type = 'konfi' AND ($3::boolean OR EXISTS (
                      SELECT 1 FROM user_jahrgang_assignments uja
                       WHERE uja.user_id = $4 AND uja.jahrgang_id = a.jahrgang_id)))
              )
            GROUP BY a.id, j.name
            ORDER BY a.created_at DESC`,
          [req.user.organization_id, typ, istOrgAdmin, req.user.id]
        );

        res.json(rows.map(r => ({
          id: r.id,
          typ: r.wrapped_type,
          jahrgang_id: r.jahrgang_id,
          jahrgang_name: r.jahrgang_name,
          titel: r.titel,
          zeitraum_start: r.zeitraum_start,
          zeitraum_ende: r.zeitraum_ende,
          freigegeben: r.freigegeben_at !== null,
          freigegeben_at: r.freigegeben_at,
          snapshots: r.snapshots,
          created_at: r.created_at
        })));
      } catch (err) {
        console.error('Error listing wrapped ausgaben:', err);
        res.status(500).json({ error: 'Fehler beim Laden der Rückblick-Ausgaben' });
      }
    }
  );

  // DELETE /teamer - Teamer-Wrapped-Snapshots der Organisation loeschen
  //
  // Der Loeschweg fuer Konfis haengt am Jahrgang (DELETE /:jahrgangId, unten).
  // Teamer-Snapshots werden ohne Jahrgang gespeichert (jahrgang_id IS NULL)
  // und waren damit ueber KEINE Route erreichbar: einmal erzeugt, blieben sie
  // fuer immer stehen -- auch wenn der Lauf fehlerhafte Zahlen erzeugt hatte.
  // Erneutes Generieren ueberschreibt zwar, hilft aber nicht bei Teamer:innen,
  // die inzwischen keine mehr sind.
  //
  // Eigene Route statt Erweiterung von DELETE /:jahrgangId: Dort ist der
  // Jahrgang die Bezugsgroesse, hier die Organisation. Das mit einem
  // Sonderwert im selben Pfad zu mischen, machte beide Wege unklar.
  //
  // Optionaler Query-Parameter `year`: löscht nur den Rückblick DIESES
  // Jahres. Teamer:innen bekommen jedes Jahr einen neuen, und die alten
  // bleiben erhalten (Simons Regel 02.09.2026) — bei den Konfis leistet das
  // der Jahrgangsfilter in DELETE /:jahrgangId, Teamer haben keinen Jahrgang,
  // dort ist das Jahr die einzige Trennlinie.
  //
  // OHNE `year` bleibt es beim bisherigen Verhalten (alle Jahre): Die
  // ausgelieferte Leitungsansicht ruft die Route ohne Parameter auf, und ein
  // stillschweigend geänderter Umfang wäre genau die Art Bruch, die man
  // erst bemerkt, wenn die Daten weg sind.
  router.delete('/teamer',
    rbacVerifier,
    requireOrgAdmin,
    query('year').optional().isInt({ min: 2000, max: 2100 }),
    handleValidationErrors,
    async (req, res) => {
      try {
        const jahr = req.query.year ? parseInt(req.query.year, 10) : null;
        const { rowCount } = await db.query(
          `DELETE FROM wrapped_snapshots
           WHERE wrapped_type = 'teamer' AND organization_id = $1
             AND ($2::int IS NULL OR year = $2::int)`,
          [req.user.organization_id, jahr]
        );
        res.json({ message: `${rowCount} Wrapped-Snapshots gel\u00f6scht`, deleted: rowCount });
      } catch (err) {
        console.error('Error deleting teamer wrapped snapshots:', err);
        res.status(500).json({ error: 'Fehler beim L\u00f6schen der Wrapped-Snapshots' });
      }
    }
  );

  // DELETE /:jahrgangId - Wrapped-Snapshots für einen Jahrgang löschen
  //
  // Loescht ausdruecklich nur die KONFI-Snapshots des Jahrgangs. Der Filter
  // auf wrapped_type kam am 01.09.2026 dazu: Ohne ihn haette der Zaehler in
  // der Antwort spaeter auch Teamer-Zeilen mitgezaehlt, sobald diese einen
  // Jahrgang bekaemen. Teamer-Snapshots loescht DELETE /teamer (oben).
  router.delete('/:jahrgangId',
    rbacVerifier,
    requireOrgAdmin,
    param('jahrgangId').isInt({ min: 1 }),
    handleValidationErrors,
    async (req, res) => {
      const client = await db.getClient();
      try {
        const jahrgangId = parseInt(req.params.jahrgangId, 10);

        // Jahrgang validieren
        const { rows: [jahrgang] } = await client.query(
          `SELECT id FROM jahrgaenge WHERE id = $1 AND organization_id = $2`,
          [jahrgangId, req.user.organization_id]
        );
        if (!jahrgang) {
          return res.status(404).json({ error: 'Jahrgang nicht gefunden' });
        }

        await client.query('BEGIN');

        const { rowCount } = await client.query(
          `DELETE FROM wrapped_snapshots
           WHERE jahrgang_id = $1 AND organization_id = $2 AND wrapped_type = 'konfi'`,
          [jahrgangId, req.user.organization_id]
        );

        await client.query(
          `UPDATE jahrgaenge SET wrapped_released_at = NULL WHERE id = $1`,
          [jahrgangId]
        );

        await client.query('COMMIT');
        res.json({ message: `${rowCount} Wrapped-Snapshots gel\u00f6scht`, deleted: rowCount });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error deleting wrapped snapshots:', err);
        res.status(500).json({ error: 'Fehler beim L\u00f6schen der Wrapped-Snapshots' });
      } finally {
        client.release();
      }
    }
  );

  // GET /history/:userId - Alle Wrapped-Snapshots eines Users
  router.get('/history/:userId',
    rbacVerifier,
    param('userId').isInt({ min: 1 }),
    handleValidationErrors,
    async (req, res) => {
      try {
        const targetUserId = parseInt(req.params.userId, 10);
        // Sicherheitspruefung: Nur eigene Daten ODER Admin der gleichen Org
        const roleName = req.user.role_name;
        if (req.user.id !== targetUserId) {
          if (roleName !== 'admin' && roleName !== 'org_admin') {
            return res.status(403).json({ error: 'Keine Berechtigung' });
          }
          // Admin: Pruefen ob User zur gleichen Org gehört
          const { rows: [targetUser] } = await db.query(
            `SELECT u.organization_id, r.name AS role_name
             FROM users u LEFT JOIN roles r ON u.role_id = r.id
             WHERE u.id = $1`, [targetUserId]
          );
          if (!targetUser || targetUser.organization_id !== req.user.organization_id) {
            return res.status(403).json({ error: 'Keine Berechtigung' });
          }

          // Jahrgangs-Bindung (01.09.2026): Der Rueckblick eines Konfis ist
          // Jahrgangs-Datenbestand — ein Admin sieht ihn nur mit view-
          // Zuweisung auf den Jahrgang des Konfis (Simons Regel; org_admin/
          // super_admin ausgenommen, darfKonfi steigt fuer sie vorher aus).
          // Teamer:innen als Ziel bleiben frei einsehbar (Teamer-Ausnahme:
          // die sieht ein Admin alle — ihr Wrapped haengt an keinem Jahrgang).
          if (targetUser.role_name === 'konfi') {
            const zugriff = await darfKonfi(db, req, targetUserId);
            if (!zugriff.erlaubt) {
              return res.status(403).json({ error: 'Keine Berechtigung' });
            }
          }
        }

        // MIT AUSGABE-TITEL (Simon, 03.09.2026: "Auch der Admin soll die
        // mehreren im Profil von Konfis und Teamern sehen koennen").
        //
        // Die Route liefert schon immer ALLE Snapshots einer Person -- mit
        // mehreren Ausgaben je Jahrgang waren die aber nicht mehr
        // auseinanderzuhalten: "2026" stand dann dreimal da. Der Titel macht
        // sie unterscheidbar ("Dein erstes Jahr", "Zwischenstand").
        //
        // Die Leitung sieht hier bewusst AUCH nicht freigegebene Ausgaben --
        // sie muss vor dem Freigeben hineinsehen koennen. Fuer die Person
        // selbst filtert GET /meine auf freigegeben.
        //
        // Rechte bleiben unveraendert (Pruefung oben): Admin nur eigene
        // Jahrgaenge, Teamer:innen frei, org_admin alles.
        //
        // ANTWORTFORM: weiterhin ein ARRAY mit denselben Feldern, nur zwei
        // additive dazu. Die ausgelieferte Leitungsansicht ruft .map()
        // darauf -- eine Umstellung auf ein Objekt haette sie zerlegt
        // (dieselbe Fehlerklasse wie GET /teamer/badges am 29.08.2026).
        const { rows } = await db.query(
          `SELECT s.id, s.wrapped_type, s.year, s.data, s.computed_at,
                  a.id AS ausgabe_id,
                  COALESCE(a.titel, 'Rückblick ' || s.year::text) AS titel,
                  a.freigegeben_at
             FROM wrapped_snapshots s
             LEFT JOIN wrapped_ausgaben a ON a.id = s.ausgabe_id
            WHERE s.user_id = $1
            ORDER BY COALESCE(a.freigegeben_at, s.computed_at) DESC,
                     s.year DESC, s.wrapped_type`,
          [targetUserId]
        );

        res.json(rows);
      } catch (err) {
        console.error('Error loading wrapped history:', err);
        res.status(500).json({ error: 'Fehler beim Laden der Wrapped-Historie' });
      }
    }
  );

  // ====================================================================
  // BATCH-GENERIERUNG (für backgroundService Cron)
  // ====================================================================

  /**
   * Generiert Konfi-Wrapped für alle Konfis eines Jahrgangs.
   * Wird vom Cron oder Admin-Endpoint aufgerufen.
   */
  router.generateAllKonfiWrapped = async (dbRef, jahrgangId, orgId, year, zeitraumVorgabe = null) => {
    const client = await dbRef.getClient();
    try {
      await client.query('BEGIN');

      const { rows: konfis } = await client.query(
        `SELECT kp.user_id FROM konfi_profiles kp
         JOIN users u ON kp.user_id = u.id
         JOIN roles r ON u.role_id = r.id
         WHERE kp.jahrgang_id = $1 AND r.name = 'konfi' AND u.deleted_at IS NULL`,
        [jahrgangId]
      );

      // Parallele Snapshot-Generierung (jeder Konfi holt eigenen DB-Client)
      const results = await Promise.allSettled(
        konfis.map(konfi => generateAndSaveKonfiSnapshot(dbRef, konfi.user_id, orgId, jahrgangId, year, null, zeitraumVorgabe))
      );
      const generated = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
      const errors = results.length - generated;

      // wrapped_released_at setzen
      await client.query(
        `UPDATE jahrgaenge SET wrapped_released_at = NOW() WHERE id = $1`,
        [jahrgangId]
      );

      await client.query('COMMIT');

      // Push (fire-and-forget, dbRef statt client da client released wird)
      try {
        const konfiIds = konfis.map(k => k.user_id);
        await PushService.sendWrappedReleased(dbRef, konfiIds, 'konfi', orgId);
      } catch (pushErr) {
        console.error('Wrapped-Cron Push fehlgeschlagen:', pushErr);
      }

      return { generated, errors };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  };

  /**
   * Generiert Teamer-Wrapped für alle Teamer einer Organisation.
   * Wird vom Cron oder Admin-Endpoint aufgerufen.
   */
  router.generateAllTeamerWrapped = async (dbRef, orgId, year, zeitraumVorgabe = null) => {
    const client = await dbRef.getClient();
    try {
      await client.query('BEGIN');

      // Anfang der Kette: das Ende der vorigen Teamer-Ausgabe. Dieser Weg
      // legt keine Ausgabe an, also gibt es hier nichts auszuschliessen.
      const vorigesEnde = zeitraumVorgabe
        ? null
        : await ermittleVorigesTeamerEnde(client, orgId);

      const { rows: teamers } = await client.query(
        `SELECT u.id as user_id FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE r.name = 'teamer' AND u.organization_id = $1`,
        [orgId]
      );

      let generated = 0;
      let errors = 0;

      for (const teamer of teamers) {
        try {
          const snapshot = await generateTeamerSnapshot(client, teamer.user_id, orgId, year, zeitraumVorgabe, vorigesEnde);
          await client.query(
            `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, year, data, computed_at)
             VALUES ($1, $2, 'teamer', $3, $4, NOW())
             ON CONFLICT (user_id, wrapped_type, year, COALESCE(jahrgang_id, 0), COALESCE(ausgabe_id, 0))
             DO UPDATE SET data = EXCLUDED.data, computed_at = NOW(), organization_id = EXCLUDED.organization_id`,
            [teamer.user_id, orgId, year, JSON.stringify(snapshot)]
          );
          generated++;
        } catch (err) {
          console.error(`Wrapped-Cron: Teamer ${teamer.user_id} Fehler:`, err.message);
          errors++;
        }
      }

      await client.query('COMMIT');

      // Push (fire-and-forget)
      try {
        const teamerIds = teamers.map(t => t.user_id);
        await PushService.sendWrappedReleased(dbRef, teamerIds, 'teamer', orgId);
      } catch (pushErr) {
        console.error('Wrapped-Cron Push fehlgeschlagen:', pushErr);
      }

      return { generated, errors };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  };

  return router;
};
