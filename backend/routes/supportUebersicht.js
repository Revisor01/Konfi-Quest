// /api/support/uebersicht und /api/support/gemeinden -- das Dashboard und die
// Gemeindeliste der Web-Ansicht (docs/planung/support-web.md, Entscheidungen
// 3 bis 5; 03.10.2026).
//
// Eingehaengt in routes/support.js HINTER rbacVerifier und requireSuperAdmin:
// nur Super-Admins (Rolle oder Merkmal, mit oder ohne Gemeinde); jede andere
// Rolle bekommt 403, ohne Anmeldung 401.
//
// INTERNE GEMEINDEN (organizations.intern, Migration 194) zaehlen nirgends
// mit und stehen in keiner Liste. Mails werden nicht nach `intern` gefiltert.
//
// DIE REGELN, EINMAL FESTGELEGT:
//
//   KONTEN (kennzahlen.konten, entwicklung.konten_*, Leitung): je Gemeinde die
//     Rolle DORT, ueber beide Quellen der Zugehoerigkeit
//     (utils/orgMitglieder.js, MITGLIEDSCHAFTEN_SQL -- dieselbe Stelle wie
//     GET /support/statistik). Gesperrte und geloeschte Konten zaehlen nicht,
//     Support-Konten ohne Gemeinde nicht. Ein Konto zaehlt je Rolle hoechstens
//     einmal (wer in zwei Gemeinden Teamer:in ist, einmal; wer in einer
//     Gemeinde Leitung und in einer anderen Teamer:in ist, je einmal).
//     In der Entwicklung zaehlt jedes Konto GENAU EINMAL: als Team, sobald es
//     in irgendeiner Gemeinde Teamer:in, Admin oder Gemeindeleitung ist,
//     sonst als Konfi -- damit konfi + team die Neuzugaenge und konten_gesamt
//     die Summe bleiben. konten_gesamt eines Monats: heute vorhandene Konten
//     mit users.created_at bis zum Monatsende (ein inzwischen geloeschtes
//     oder gesperrtes Konto fehlt in allen Monaten).
//
//   ANTRAEGE:    activity_requests -- die Antraege der Konfis auf Punkte fuer
//                eine Aktivitaet --, je Zeile der Zeitpunkt created_at.
//                Gemeinde: activity_requests.organization_id.
//   BUCHUNGEN:   event_bookings -- die Anmeldungen zu Terminen --, je Zeile der
//                Zeitpunkt booking_date (der Anmeldemoment; eine erneute
//                Anmeldung setzt ihn neu). Alle Status; auch die
//                automatischen Buchungen bei Pflichtterminen.
//                Gemeinde: event_bookings.organization_id.
//   NACHRICHTEN: chat_messages -- Chat-Nachrichten, auch Umfragen; auch
//                spaeter geloeschte, denn gesendet sind sie --, je Zeile der
//                Zeitpunkt created_at. Gemeinde: chat_rooms.organization_id
//                des Raums (die Nachricht hat keine eigene).
//   Eine Zeile ohne Gemeinde (organization_id NULL oder unbekannt) zaehlt
//   nicht mit.
//
//   ZEITRAEUME: Kalendermonate und ISO-Wochen (Montag bis Sonntag) in der
//   Zeitzone Europe/Berlin, die laufende eingeschlossen, aelteste zuerst,
//   lueckenlos mit 0. Der Bezugszeitpunkt ist `new Date()` der Anfrage und
//   geht als Parameter in jede Abfrage -- die Datenbank-Uhr und die
//   Sitzungszone der Datenbank spielen keine Rolle (Produktion laeuft in UTC).
//
// WENIGE ABFRAGEN: die Uebersicht acht, die Gemeindeliste drei -- keine
// Schleife ueber Gemeinden.
//
// PROTOKOLL: Fehler nur mit Code und Meldung, nie err.detail.

const express = require('express');
const { abfragenBuendeln } = require('../utils/abfragenBuendeln');
const {
  MITGLIEDSCHAFTEN_SQL, aktiv30TageSql, STATISTIK_ROLLEN, zaehleKontenJeGemeinde,
} = require('../utils/orgMitglieder');
const { BERLIN } = require('../utils/zeitformat');
const { ZUORDNUNG_SPALTEN, ZUORDNUNG_JOINS, UNGELESEN_JE_ANFRAGE_SQL } = require('../utils/mailNachrichten');

// Wie viele Monate und Wochen die Reihen lang sind, wie viele Eintraege die
// "neuesten" Listen haben und wie weit voraus eine Testphase als "endet bald"
// gilt.
const MONATE = 12;
const WOCHEN = 12;
const NEUESTE = 5;
const TESTPHASE_TAGE = 14;
const TAG_MS = 24 * 60 * 60 * 1000;

const ZONE = `'${BERLIN}'`;

/** Fehler ins Protokoll: nur Code und Meldung. */
const protokolliere = (wo, err) => console.error(`${wo}: %s %s`, err.code || '', err.message);

// Die Monate als Tabelle: label ('2026-10'), von und bis (der Monat als
// halboffenes Zeitfenster, Berliner Monatsgrenzen). $1 ist der
// Bezugszeitpunkt. generate_series laeuft ueber lokale Zeitstempel ohne Zone;
// erst die Grenzen werden mit AT TIME ZONE zu Zeitpunkten -- so haben Monate
// mit Zeitumstellung ihre echte Laenge.
const MONATE_SQL = `
  monate AS (
    SELECT to_char(m, 'YYYY-MM') AS label,
           m AT TIME ZONE ${ZONE} AS von,
           (m + interval '1 month') AT TIME ZONE ${ZONE} AS bis
      FROM generate_series(
             date_trunc('month', $1::timestamptz AT TIME ZONE ${ZONE}) - interval '${MONATE - 1} months',
             date_trunc('month', $1::timestamptz AT TIME ZONE ${ZONE}),
             interval '1 month') AS m
  )`;

// Dasselbe fuer ISO-Wochen: label '2026-W40' (ISO-Jahr, nicht Kalenderjahr:
// der 31.12.2024 liegt in 2025-W01); date_trunc('week') faellt auf den Montag.
const WOCHEN_LABEL = `'IYYY"-W"IW'`;
const WOCHEN_SQL = `
  wochen AS (
    SELECT to_char(w, ${WOCHEN_LABEL}) AS label,
           w AT TIME ZONE ${ZONE} AS von,
           (w + interval '1 week') AT TIME ZONE ${ZONE} AS bis
      FROM generate_series(
             date_trunc('week', $1::timestamptz AT TIME ZONE ${ZONE}) - interval '${WOCHEN - 1} weeks',
             date_trunc('week', $1::timestamptz AT TIME ZONE ${ZONE}),
             interval '1 week') AS w
  )`;

// Konten in nicht internen Gemeinden: je Konto und Gemeinde eine Zeile in
// `mitglied` (Rolle DORT; nur aktive Konten, nur die vier Rollen). rollenParam
// ist der Platzhalter ($1, $2 ...) des Parameters mit den vier Rollen.
const mitgliedSql = (rollenParam) => `
  mitglied AS (
    SELECT ms.user_id, ms.rolle
      FROM (${MITGLIEDSCHAFTEN_SQL}) ms
      JOIN organizations o ON o.id = ms.organization_id
     WHERE NOT o.intern AND ms.is_active AND ms.rolle = ANY(${rollenParam}::text[])
  )`;

module.exports = (db) => {
  const router = express.Router();

  // ==========================================================================
  // UEBERSICHT
  // ==========================================================================

  /** Gemeinden: gesamt, nach Laufzeit und gesperrt (ohne interne). */
  const gemeindenKennzahlen = async () => {
    const { rows: [z] } = await db.query(
      `SELECT COUNT(*)::int AS gesamt,
              COUNT(*) FILTER (WHERE COALESCE(o.is_active, true) AND o.trial_ends_at IS NOT NULL AND o.is_trial)::int AS testphase,
              COUNT(*) FILTER (WHERE COALESCE(o.is_active, true) AND o.trial_ends_at IS NOT NULL AND NOT o.is_trial)::int AS lizenz,
              COUNT(*) FILTER (WHERE COALESCE(o.is_active, true) AND o.trial_ends_at IS NULL)::int AS unbegrenzt,
              COUNT(*) FILTER (WHERE NOT COALESCE(o.is_active, true))::int AS gesperrt
         FROM organizations o
        WHERE NOT o.intern`);
    return z;
  };

  /** Konten je Rolle und aktive Konten ueber alle Gemeinden, je Konto einmal. */
  const kontenKennzahlen = async (jetzt) => {
    const { rows: [z] } = await db.query(
      `WITH ${mitgliedSql('$1')},
            aktiv AS (${aktiv30TageSql('$2::timestamptz')})
       SELECT COUNT(DISTINCT m.user_id) FILTER (WHERE m.rolle = 'konfi')::int     AS konfi,
              COUNT(DISTINCT m.user_id) FILTER (WHERE m.rolle = 'teamer')::int    AS teamer,
              COUNT(DISTINCT m.user_id) FILTER (WHERE m.rolle = 'admin')::int     AS admin,
              COUNT(DISTINCT m.user_id) FILTER (WHERE m.rolle = 'org_admin')::int AS org_admin,
              COUNT(DISTINCT m.user_id) FILTER (WHERE a.user_id IS NOT NULL)::int AS aktiv_30_tage
         FROM mitglied m
         LEFT JOIN aktiv a ON a.user_id = m.user_id`,
      [STATISTIK_ROLLEN, jetzt]);
    return z;
  };

  /** Offene Anfragen und ungelesene eingehende Mails (alle, auch zugeordnete). */
  const offenesZaehlen = async () => {
    const { rows: [z] } = await db.query(
      `SELECT (SELECT COUNT(*)::int FROM gemeinde_anfragen WHERE status IN ('neu', 'in_arbeit')) AS anfragen_offen,
              (SELECT COUNT(*)::int FROM mail_nachrichten WHERE richtung = 'ein' AND gelesen_am IS NULL) AS mails_ungelesen`);
    return z;
  };

  /** Neue Gemeinden, Anfragen und Konten je Monat, dazu die Konten gesamt. */
  const entwicklungLaden = async (jetzt) => {
    const { rows } = await db.query(
      `WITH ${MONATE_SQL},
            ${mitgliedSql('$2')},
            konto AS (
              SELECT m.user_id, u.created_at, bool_or(m.rolle <> 'konfi') AS team
                FROM mitglied m
                JOIN users u ON u.id = m.user_id
               GROUP BY m.user_id, u.created_at
            )
       SELECT mo.label,
              (SELECT COUNT(*)::int FROM organizations o
                WHERE NOT o.intern AND o.created_at >= mo.von AND o.created_at < mo.bis) AS gemeinden_neu,
              (SELECT COUNT(*)::int FROM gemeinde_anfragen a
                WHERE a.created_at >= mo.von AND a.created_at < mo.bis) AS anfragen_neu,
              (SELECT COUNT(*)::int FROM konto k
                WHERE NOT k.team AND k.created_at >= mo.von AND k.created_at < mo.bis) AS konfi_neu,
              (SELECT COUNT(*)::int FROM konto k
                WHERE k.team AND k.created_at >= mo.von AND k.created_at < mo.bis) AS team_neu,
              (SELECT COUNT(*)::int FROM konto k WHERE k.created_at < mo.bis) AS konten_gesamt
         FROM monate mo
        ORDER BY mo.von`,
      [jetzt, STATISTIK_ROLLEN]);
    const spalte = (name) => rows.map((r) => r[name]);
    return {
      monate: spalte('label'),
      gemeinden_neu: spalte('gemeinden_neu'),
      konten_neu: { konfi: spalte('konfi_neu'), team: spalte('team_neu') },
      konten_gesamt: spalte('konten_gesamt'),
      anfragen_neu: spalte('anfragen_neu'),
    };
  };

  /**
   * Antraege, Buchungen und Nachrichten je ISO-Woche. Jede Tabelle wird
   * einmal ueber das ganze Fenster gelesen und nach Woche gezaehlt, nicht
   * zwoelfmal; erst danach fuellt der Join die leeren Wochen mit 0.
   */
  const aktivitaetLaden = async (jetzt) => {
    const woche = (spalte) => `to_char(${spalte} AT TIME ZONE ${ZONE}, ${WOCHEN_LABEL})`;
    const { rows } = await db.query(
      `WITH ${WOCHEN_SQL},
            fenster AS (SELECT MIN(von) AS von, MAX(bis) AS bis FROM wochen),
            antraege AS (
              SELECT ${woche('r.created_at')} AS label, COUNT(*)::int AS n
                FROM activity_requests r
                JOIN organizations o ON o.id = r.organization_id
                CROSS JOIN fenster f
               WHERE NOT o.intern AND r.created_at >= f.von AND r.created_at < f.bis
               GROUP BY 1
            ),
            buchungen AS (
              SELECT ${woche('b.booking_date')} AS label, COUNT(*)::int AS n
                FROM event_bookings b
                JOIN organizations o ON o.id = b.organization_id
                CROSS JOIN fenster f
               WHERE NOT o.intern AND b.booking_date >= f.von AND b.booking_date < f.bis
               GROUP BY 1
            ),
            nachrichten AS (
              SELECT ${woche('cm.created_at')} AS label, COUNT(*)::int AS n
                FROM chat_messages cm
                JOIN chat_rooms cr ON cr.id = cm.room_id
                JOIN organizations o ON o.id = cr.organization_id
                CROSS JOIN fenster f
               WHERE NOT o.intern AND cm.created_at >= f.von AND cm.created_at < f.bis
               GROUP BY 1
            )
       SELECT wo.label,
              COALESCE(a.n, 0) AS antraege,
              COALESCE(b.n, 0) AS buchungen,
              COALESCE(n.n, 0) AS nachrichten
         FROM wochen wo
         LEFT JOIN antraege a ON a.label = wo.label
         LEFT JOIN buchungen b ON b.label = wo.label
         LEFT JOIN nachrichten n ON n.label = wo.label
        ORDER BY wo.von`,
      [jetzt]);
    const spalte = (name) => rows.map((r) => r[name]);
    return {
      wochen: spalte('label'),
      antraege: spalte('antraege'),
      buchungen: spalte('buchungen'),
      nachrichten: spalte('nachrichten'),
    };
  };

  /** Die neuesten Anfragen, alle Status. */
  const neuesteAnfragen = async () => {
    const { rows } = await db.query(
      `SELECT a.id, a.gemeinde, a.kontakt_name, a.status, a.wunsch_lizenz, a.created_at,
              ${UNGELESEN_JE_ANFRAGE_SQL} AS ungelesen
         FROM gemeinde_anfragen a
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT $1`, [NEUESTE]);
    return rows;
  };

  /** Die neuesten eingehenden Mails, zugeordnet oder nicht (nicht nach intern gefiltert). */
  const neuesteMails = async () => {
    const { rows } = await db.query(
      `SELECT m.id, m.postfach, m.von_name, m.von_adresse, m.betreff, m.gesendet_am, m.gelesen_am,
              ${ZUORDNUNG_SPALTEN}
         FROM mail_nachrichten m
         ${ZUORDNUNG_JOINS}
        WHERE m.richtung = 'ein'
        ORDER BY m.gesendet_am DESC, m.id DESC
        LIMIT $1`, [NEUESTE]);
    return rows;
  };

  /** Laufende Testphasen, die in den naechsten 14 Tagen enden (nicht gesperrte, nicht interne). */
  const testphasenEndenBald = async (jetzt) => {
    const bis = new Date(jetzt.getTime() + TESTPHASE_TAGE * TAG_MS);
    const { rows } = await db.query(
      `SELECT o.id, COALESCE(NULLIF(btrim(o.display_name), ''), o.name) AS display_name, o.trial_ends_at
         FROM organizations o
        WHERE NOT o.intern AND COALESCE(o.is_active, true) AND o.is_trial
          AND o.trial_ends_at > $1::timestamptz AND o.trial_ends_at <= $2::timestamptz
        ORDER BY o.trial_ends_at, o.id`, [jetzt, bis]);
    return rows;
  };

  // GET /uebersicht -- Kennzahlen, Entwicklung ueber 12 Monate, Aktivitaet
  // ueber 12 Wochen, neueste Anfragen und Mails, Testphasen, die bald enden
  // (docs/planung/support-web.md, Vertrag; die Regeln stehen oben).
  router.get('/uebersicht', async (req, res) => {
    try {
      const jetzt = new Date();
      const [
        gemeinden, konten, offen, entwicklung, aktivitaet, anfragen, mails, testphase,
      ] = await abfragenBuendeln(db, [
        () => gemeindenKennzahlen(),
        () => kontenKennzahlen(jetzt),
        () => offenesZaehlen(),
        () => entwicklungLaden(jetzt),
        () => aktivitaetLaden(jetzt),
        () => neuesteAnfragen(),
        () => neuesteMails(),
        () => testphasenEndenBald(jetzt),
      ]);
      const { aktiv_30_tage: aktiv, ...kontenJeRolle } = konten;
      res.json({
        kennzahlen: {
          gemeinden,
          konten: kontenJeRolle,
          aktiv_30_tage: aktiv,
          anfragen_offen: offen.anfragen_offen,
          mails_ungelesen: offen.mails_ungelesen,
        },
        entwicklung,
        aktivitaet,
        neueste_anfragen: anfragen,
        neueste_mails: mails,
        testphase_endet: testphase,
      });
    } catch (err) {
      protokolliere('GET /support/uebersicht', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // ==========================================================================
  // GEMEINDEN
  // ==========================================================================

  // GET /gemeinden -- alle Gemeinden (ohne interne) mit Zuordnung, Laufzeit,
  // Konten und Gemeindeleitung. Sortiert nach Landeskirche, Kirchenkreis,
  // Anzeigename; Gemeinden ohne Zuordnung zuletzt.
  //
  //   konfi_count: Konfis, die auf das Konfi-Limit zaehlen (Rolle konfi, Stamm-
  //     Gemeinde, nicht geloescht -- utils/konfiLimit.js), auch gesperrte.
  //   team_count:  aktive Konten mit der Rolle Teamer:in, Admin oder
  //     Gemeindeleitung in dieser Gemeinde (beide Quellen, wie /statistik).
  //   leitung:     Konten mit der Rolle org_admin in dieser Gemeinde (beide
  //     Quellen, nicht geloescht), auch gesperrte (is_active zeigt es);
  //     nach Anzeigename. Ohne Super-Admin-Sonderfall: ein Super-Admin-Konto
  //     mit Gemeinde steht dort, wo es org_admin ist, wie jedes Konto.
  //   wunsch_lizenz: aus der neuesten Anfrage, aus der die Gemeinde
  //     entstanden ist (wie GET /organizations/:id).
  router.get('/gemeinden', async (req, res) => {
    try {
      const [{ rows: gemeinden }, konten, { rows: leitungen }] = await abfragenBuendeln(db, [
        () => db.query(
          `SELECT o.id, o.name,
                  COALESCE(NULLIF(btrim(o.display_name), ''), o.name) AS display_name,
                  COALESCE(o.is_active, true) AS is_active, o.is_trial, o.trial_ends_at, o.max_konfis,
                  (SELECT COUNT(*)::int FROM users u JOIN roles r ON r.id = u.role_id
                    WHERE r.name = 'konfi' AND u.organization_id = o.id AND u.deleted_at IS NULL) AS konfi_count,
                  o.created_at,
                  o.kirchenkreis_id, k.name AS kirchenkreis, k.landeskirche_id, l.name AS landeskirche,
                  (SELECT a.wunsch_lizenz FROM gemeinde_anfragen a WHERE a.organization_id = o.id
                    ORDER BY a.status_seit DESC, a.id DESC LIMIT 1) AS wunsch_lizenz
             FROM organizations o
             LEFT JOIN kirchenkreise k ON k.id = o.kirchenkreis_id
             LEFT JOIN landeskirchen l ON l.id = k.landeskirche_id
            WHERE NOT o.intern
            ORDER BY lower(l.name) NULLS LAST, lower(k.name) NULLS LAST,
                     lower(COALESCE(NULLIF(btrim(o.display_name), ''), o.name)), o.id`),
        () => zaehleKontenJeGemeinde(db),
        () => db.query(
          `SELECT ms.organization_id, u.id, u.display_name, u.username, u.email, ms.is_active, u.last_login_at
             FROM (${MITGLIEDSCHAFTEN_SQL}) ms
             JOIN users u ON u.id = ms.user_id
             JOIN organizations o ON o.id = ms.organization_id
            WHERE ms.rolle = 'org_admin' AND NOT o.intern
            ORDER BY ms.organization_id, lower(u.display_name), u.id`),
      ]);

      const leitungJeGemeinde = new Map();
      for (const l of leitungen) {
        const liste = leitungJeGemeinde.get(Number(l.organization_id)) || [];
        liste.push({
          id: l.id,
          display_name: l.display_name,
          username: l.username,
          email: l.email,
          is_active: l.is_active,
          last_login_at: l.last_login_at,
        });
        leitungJeGemeinde.set(Number(l.organization_id), liste);
      }

      res.json(gemeinden.map(({ konfi_count: konfiCount, ...g }) => {
        const z = konten.get(Number(g.id));
        return {
          id: g.id,
          name: g.name,
          display_name: g.display_name,
          is_active: g.is_active,
          is_trial: g.is_trial,
          trial_ends_at: g.trial_ends_at,
          max_konfis: g.max_konfis,
          konfi_count: konfiCount,
          team_count: z ? z.konten.teamer + z.konten.admin + z.konten.org_admin : 0,
          created_at: g.created_at,
          kirchenkreis_id: g.kirchenkreis_id,
          kirchenkreis: g.kirchenkreis,
          landeskirche_id: g.landeskirche_id,
          landeskirche: g.landeskirche,
          wunsch_lizenz: g.wunsch_lizenz,
          leitung: leitungJeGemeinde.get(Number(g.id)) || [],
        };
      }));
    } catch (err) {
      protokolliere('GET /support/gemeinden', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  return router;
};
