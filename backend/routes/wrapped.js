const express = require('express');
const router = express.Router();
const { param, query } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const { darfJahrgang, darfKonfi } = require('../utils/jahrgangsZugriff');

module.exports = (db, rbacVerifier, roleHelpers) => {
  const { requireAdmin, requireOrgAdmin } = roleHelpers;
  const PushService = require('../services/pushService');

  // Schema-Migrationen: siehe backend/migrations/075_wrapped.sql

  // Deutsche Monatsnamen
  const MONAT_NAMEN = [
    '', 'Januar', 'Februar', 'M\u00e4rz', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  // ====================================================================
  // HILFSFUNKTIONEN
  // ====================================================================

  /**
   * Konfi-Jahr als Datumsfenster [start, ende] (beide inklusive).
   *
   * Frueher wurde der Zeitraum erst am Ende der Funktion berechnet und nur auf
   * die Challenge-Momente angewendet -- alle anderen Zahlen liefen ueber die
   * gesamte Kontolebenszeit (Befund W-B, 01.09.2026). Jetzt steht er vorn und
   * gilt fuer jede Zahl.
   *
   * Regeln:
   * - Mit Konfirmationstermin: 1.9. des Vorjahres bis zum Termin.
   * - Ohne Termin (3 von 5 Jahrgaengen in Produktion, Befund W-C): volles
   *   Konfi-Jahr 1.9.(year-1) bis 31.8.(year). Der frueher fest verdrahtete
   *   31.7. liess den August in jedem Fallback-Jahr verschwinden.
   *
   * Datumsstrings werden mit padStart gebaut, NICHT ueber
   * new Date(y, 8, 1).toISOString() -- letzteres rechnet Ortszeit nach UTC und
   * machte in Sommerzeit aus dem 1.9. den 31.8.
   */
  function berechneZeitraum(konfirmationTermin, year) {
    const iso = (d) => {
      const dt = (d instanceof Date) ? d : new Date(d);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };
    if (konfirmationTermin) {
      const termin = new Date(konfirmationTermin);
      const start = `${termin.getFullYear() - 1}-09-01`;
      return { start, ende: iso(termin), konfirmation: iso(termin) };
    }
    return { start: `${year - 1}-09-01`, ende: `${year}-08-31`, konfirmation: null };
  }

  async function generateKonfiSnapshot(client, userId, orgId, jahrgangId, year) {
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

    const zeitraum = berechneZeitraum(konfirmationTermin, year);
    const zeitraumStart = zeitraum.start;
    const zeitraumEnde = zeitraum.ende;

    // Punkte aus konfi_profiles
    const { rows: [profile] } = await client.query(
      `SELECT kp.gottesdienst_points, kp.gemeinde_points
       FROM konfi_profiles kp
       WHERE kp.user_id = $1 AND kp.jahrgang_id = $2`,
      [userId, jahrgangId]
    );
    const gottesdienst = profile ? profile.gottesdienst_points : 0;
    const gemeinde = profile ? profile.gemeinde_points : 0;

    // Bonus-Punkte
    const { rows: [bonusRow] } = await client.query(
      `SELECT COALESCE(SUM(points), 0) as total FROM bonus_points WHERE konfi_id = $1 AND organization_id = $2`,
      [userId, orgId]
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

    // Kategorie-Verteilung (Aktivitäten nach Kategorie)
    const { rows: kategorieVerteilung } = await client.query(
      `SELECT COALESCE(a.category, a.type) as kategorie, COUNT(*) as count
       FROM user_activities ua
       JOIN activities a ON ua.activity_id = a.id
       WHERE ua.user_id = $1 AND ua.organization_id = $2
         AND ua.completed_date >= $3::date
         AND ua.completed_date < ($4::date + INTERVAL '1 day')
       GROUP BY COALESCE(a.category, a.type)
       ORDER BY count DESC`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );

    // Gesamt-Events verfuegbar für diesen Jahrgang
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

    // Badges
    const { rows: badgeRows } = await client.query(
      `SELECT cb.name, cb.icon, cb.color FROM user_badges ub
       JOIN custom_badges cb ON ub.badge_id = cb.id
       WHERE ub.user_id = $1 AND ub.organization_id = $2
         AND ub.awarded_date >= $3::date
         AND ub.awarded_date < ($4::date + INTERVAL '1 day')
       ORDER BY ub.awarded_date DESC`,
      [userId, orgId, zeitraumStart, zeitraumEnde]
    );
    const { rows: [totalBadgesRow] } = await client.query(
      `SELECT COUNT(*) as count FROM custom_badges WHERE organization_id = $1`,
      [orgId]
    );
    const totalBadgesAvailable = parseInt(totalBadgesRow.count, 10) || 0;

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

    // Endspurt: Vergleich mit Zielwerten aus jahrgaenge
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

    return {
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
          badges: badgeRows.map(b => ({ name: b.name, icon: b.icon, color: b.color }))
        },
        pflicht: {
          besucht: pflichtBesucht,
          gesamt: pflichtGesamt
        },
        aktivster_monat: aktivsterMonat,
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
          verteilung: kategorieVerteilung.map(k => ({ kategorie: k.kategorie, count: parseInt(k.count, 10) })),
          top_kategorie: kategorieVerteilung.length > 0 ? kategorieVerteilung[0].kategorie : null
        }
      }
    };
  }

  async function generateTeamerSnapshot(client, userId, orgId, year) {
    // Events geleitet (Teamer war als Teilnehmer gebucht)
    const { rows: [eventsGeleitetRow] } = await client.query(
      `SELECT COUNT(*) as count FROM event_bookings eb
       JOIN events e ON eb.event_id = e.id
       WHERE eb.user_id = $1 AND eb.status = 'confirmed' AND eb.attendance_status = 'present'
         AND e.organization_id = $2`,
      [userId, orgId]
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
       GROUP BY e.id, e.name
       ORDER BY teilnehmer DESC
       LIMIT 1`,
      [userId, orgId]
    );
    const meisteTeilnehmerEvent = topEventRows.length > 0
      ? { name: topEventRows[0].name, count: parseInt(topEventRows[0].teilnehmer, 10) }
      : null;

    // Konfis betreut (über zugewiesene Jahrgänge)
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

    // Badges
    const { rows: teamerBadges } = await client.query(
      `SELECT cb.name, cb.icon, cb.color FROM user_badges ub
       JOIN custom_badges cb ON ub.badge_id = cb.id
       WHERE ub.user_id = $1 AND ub.organization_id = $2
       ORDER BY ub.awarded_date DESC`,
      [userId, orgId]
    );

    // Zertifikate
    const { rows: certRows } = await client.query(
      `SELECT ct.name, uc.issued_date FROM user_certificates uc
       JOIN certificate_types ct ON uc.certificate_type_id = ct.id
       WHERE uc.user_id = $1 AND uc.organization_id = $2
       ORDER BY uc.issued_date DESC`,
      [userId, orgId]
    );

    // Jahre aktiv (teamer_since)
    const { rows: [userRow] } = await client.query(
      `SELECT teamer_since FROM users WHERE id = $1`,
      [userId]
    );
    const teamerSeit = userRow && userRow.teamer_since ? userRow.teamer_since : null;
    const jahreAktiv = teamerSeit
      ? Math.max(1, Math.floor((Date.now() - new Date(teamerSeit).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
      : 0;

    return {
      version: 1,
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
        zeitraum: {
          year
        }
      }
    };
  }

  /**
   * Parallele Hilfsfunktion: Generiert und speichert einen Konfi-Snapshot.
   * Holt eigenen DB-Client aus dem Pool (kein geteilter Client für parallele Queries).
   */
  async function generateAndSaveKonfiSnapshot(dbRef, userId, orgId, jahrgangId, year) {
    const konfiClient = await dbRef.getClient();
    try {
      const snapshot = await generateKonfiSnapshot(konfiClient, userId, orgId, jahrgangId, year);
      await konfiClient.query(
        `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, jahrgang_id, year, data, computed_at)
         VALUES ($1, $2, 'konfi', $3, $4, $5, NOW())
         ON CONFLICT (user_id, wrapped_type, year, COALESCE(jahrgang_id, 0))
         DO UPDATE SET data = EXCLUDED.data, computed_at = NOW(), organization_id = EXCLUDED.organization_id`,
        [userId, orgId, jahrgangId, year, JSON.stringify(snapshot)]
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

      const { rows } = await db.query(
        `SELECT data, computed_at, year FROM wrapped_snapshots
         WHERE user_id = $1 AND wrapped_type = $2
         ORDER BY year DESC LIMIT 1`,
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
        wrapped_type: wrappedType
      });
    } catch (err) {
      console.error('Error loading wrapped snapshot:', err);
      res.status(500).json({ error: 'Fehler beim Laden des Wrapped-Snapshots' });
    }
  });

  // POST /generate/:jahrgangId - Konfi-Snapshots für alle Konfis eines Jahrgangs generieren
  router.post('/generate/:jahrgangId',
    rbacVerifier,
    requireAdmin,
    param('jahrgangId').isInt({ min: 1 }),
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
          konfis.map(konfi => generateAndSaveKonfiSnapshot(db, konfi.user_id, req.user.organization_id, jahrgangId, currentYear))
        );
        const generated = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
        const errors = results.length - generated;

        // wrapped_released_at setzen (auch bei erneutem Generieren)
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
  router.post('/generate-teamer',
    rbacVerifier,
    requireOrgAdmin,
    async (req, res) => {
      const client = await db.getClient();
      try {
        const currentYear = new Date().getFullYear();

        await client.query('BEGIN');

        // Alle Teamer der Organisation laden
        const { rows: teamers } = await client.query(
          `SELECT u.id as user_id FROM users u
           JOIN roles r ON u.role_id = r.id
           WHERE r.name = 'teamer' AND u.organization_id = $1`,
          [req.user.organization_id]
        );

        let generated = 0;
        let errors = 0;

        for (const teamer of teamers) {
          try {
            const snapshot = await generateTeamerSnapshot(client, teamer.user_id, req.user.organization_id, currentYear);

            await client.query(
              `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, year, data, computed_at)
               VALUES ($1, $2, 'teamer', $3, $4, NOW())
               ON CONFLICT (user_id, wrapped_type, year, COALESCE(jahrgang_id, 0))
               DO UPDATE SET data = EXCLUDED.data, computed_at = NOW(), organization_id = EXCLUDED.organization_id`,
              [teamer.user_id, req.user.organization_id, currentYear, JSON.stringify(snapshot)]
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
          message: `Wrapped f\u00fcr ${generated} Teamer:innen generiert`,
          generated,
          errors,
          year: currentYear
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

        const { rows } = await db.query(
          `SELECT id, wrapped_type, year, data, computed_at
           FROM wrapped_snapshots
           WHERE user_id = $1
           ORDER BY year DESC, wrapped_type`,
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
  router.generateAllKonfiWrapped = async (dbRef, jahrgangId, orgId, year) => {
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
        konfis.map(konfi => generateAndSaveKonfiSnapshot(dbRef, konfi.user_id, orgId, jahrgangId, year))
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
  router.generateAllTeamerWrapped = async (dbRef, orgId, year) => {
    const client = await dbRef.getClient();
    try {
      await client.query('BEGIN');

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
          const snapshot = await generateTeamerSnapshot(client, teamer.user_id, orgId, year);
          await client.query(
            `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, year, data, computed_at)
             VALUES ($1, $2, 'teamer', $3, $4, NOW())
             ON CONFLICT (user_id, wrapped_type, year, COALESCE(jahrgang_id, 0))
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
