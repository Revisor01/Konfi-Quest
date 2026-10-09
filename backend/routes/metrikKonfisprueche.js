// GET /api/metrics/konfisprueche -- welche Konfisprueche gewaehlt werden
// (docs/messung/umami.md, S1; Simon, 09.10.2026).
//
// Quelle ist konfspruch_wahlen (Migrationen 207 und 208): je Wahl eine Zeile
// OHNE Person, Konto oder Profil. Jeder Spruch mit seiner Anzahl -- auch
// Einzelnennungen, die eigenen Sprueche im Wortlaut (Simon: „volle
// Auswertung, auch wenn sie einzeln sind, insbesondere die, die selbst
// eingetragen werden"). Nichts davon geht an Umami.
//
// EBENEN (Simon, 09.10.2026: „nach Gemeinde, Kirchenkreis und
// Landeskirche"): ohne Parameter ueber alle Wahlen; mit ?ebene=landeskirche|
// kirchenkreis|gemeinde&id=N nur die Wahlen dieses Eintrags. `auswahl` nennt
// je Ebene die Eintraege, die Wahlen haben, mit Anzahl (dazu die heutige
// Landeskirche des Kirchenkreises bzw. der heutige Kirchenkreis der Gemeinde,
// um gleiche Namen zu unterscheiden) -- daraus baut die Ansicht ihre Auswahl. Namen von Gemeinden, Kirchenkreisen und
// Landeskirchen, nie von Personen.
//
// WELCHE EBENE EINE WAHL HAT: Kirchenkreis und Landeskirche, wie sie beim
// Waehlen galten (Migration 208). Fehlen beide (Gemeinde damals ohne
// Zuordnung, oder Zeile eines Server-Stands vor 208), gilt die heutige
// Zuordnung der Gemeinde. Steht ein Kirchenkreis da, aber keine Landeskirche
// (der Kirchenkreis hatte damals keine), gilt dessen heutige Landeskirche.
// Ein geloeschter Kirchenkreis laesst die Landeskirche stehen.
//
// Gezaehlt werden WAHLEN, nicht Personen: Wer seinen Spruch wechselt, steht
// mit beiden in der Liste. Der heutige Stand je Person liegt in
// konfi_profiles und verschwindet mit dem Konto; diese Zahlen bleiben.
//
// Nur super_admin, wie die uebrigen Betreiber-Kennzahlen unter /api/metrics.
const express = require('express');

const EBENEN = ['landeskirche', 'kirchenkreis', 'gemeinde'];

// Jede Wahl mit ihrer wirksamen Gemeinde, ihrem Kirchenkreis und ihrer
// Landeskirche (Regel oben).
const WAHLEN_MIT_EBENEN = `
  wahl AS (
    SELECT kw.quelle, kw.stelle, kw.translation, kw.freitext, kw.freitext_referenz, kw.monat,
           kw.organization_id AS gemeinde_id,
           CASE WHEN kw.kirchenkreis_id IS NULL AND kw.landeskirche_id IS NULL
                THEN o.kirchenkreis_id ELSE kw.kirchenkreis_id END AS kirchenkreis_id,
           CASE WHEN kw.landeskirche_id IS NOT NULL THEN kw.landeskirche_id
                WHEN kw.kirchenkreis_id IS NOT NULL THEN kk_wahl.landeskirche_id
                ELSE kk_heute.landeskirche_id END AS landeskirche_id
      FROM konfspruch_wahlen kw
      LEFT JOIN organizations o ON o.id = kw.organization_id
      LEFT JOIN kirchenkreise kk_wahl ON kk_wahl.id = kw.kirchenkreis_id
      LEFT JOIN kirchenkreise kk_heute ON kk_heute.id = o.kirchenkreis_id
  )`;

// Nur die Wahlen der gewaehlten Ebene; $1 Ebene (NULL = alle), $2 Kennung.
const GEFILTERT = `
  ${WAHLEN_MIT_EBENEN},
  w AS (
    SELECT * FROM wahl
     WHERE $1::text IS NULL
        OR ($1 = 'landeskirche' AND landeskirche_id = $2::bigint)
        OR ($1 = 'kirchenkreis' AND kirchenkreis_id = $2::bigint)
        OR ($1 = 'gemeinde' AND gemeinde_id = $2::bigint)
  )`;

const GEMEINDE_NAME = `COALESCE(NULLIF(btrim(o.display_name), ''), o.name)`;

module.exports = (db, rbacVerifier) => {
  const router = express.Router();

  router.get('/', rbacVerifier, async (req, res) => {
    if (!req.user?.is_super_admin) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }

    const { ebene = null } = req.query;
    let id = null;
    if (ebene !== null) {
      id = /^\d{1,18}$/.test(String(req.query.id ?? '')) ? Number(req.query.id) : null;
      if (!EBENEN.includes(ebene) || id === null) {
        return res.status(400).json({ error: 'Ungültige Ebene' });
      }
    }
    const p = [ebene, id];

    try {
      const [gesamt, uebersetzungen, sprueche, eigene, monate, landeskirchen, kirchenkreise, gemeinden] = await Promise.all([
        db.query(
          `WITH ${GEFILTERT}
           SELECT COUNT(*)::int AS wahlen,
                  COUNT(*) FILTER (WHERE quelle = 'vorschlag')::int AS vorschlag,
                  COUNT(*) FILTER (WHERE quelle = 'eigen')::int AS eigen,
                  COUNT(*) FILTER (WHERE monat IS NULL)::int AS aus_bestand
             FROM w`, p),
        db.query(
          `WITH ${GEFILTERT}
           SELECT translation, COUNT(*)::int AS anzahl
             FROM w WHERE quelle = 'vorschlag'
            GROUP BY translation
            ORDER BY anzahl DESC, translation`, p),
        db.query(
          `WITH ${GEFILTERT}
           SELECT stelle, COUNT(*)::int AS anzahl
             FROM w WHERE quelle = 'vorschlag'
            GROUP BY stelle
            ORDER BY anzahl DESC, stelle`, p),
        db.query(
          `WITH ${GEFILTERT}
           SELECT freitext, freitext_referenz, COUNT(*)::int AS anzahl
             FROM w WHERE quelle = 'eigen'
            GROUP BY freitext, freitext_referenz
            ORDER BY anzahl DESC, freitext_referenz, freitext`, p),
        db.query(
          `WITH ${GEFILTERT}
           SELECT to_char(monat, 'YYYY-MM') AS monat, COUNT(*)::int AS anzahl
             FROM w
            GROUP BY monat
            ORDER BY monat NULLS FIRST`, p),
        db.query(
          `WITH ${WAHLEN_MIT_EBENEN}
           SELECT l.id::int AS id, l.name, COUNT(*)::int AS anzahl
             FROM wahl JOIN landeskirchen l ON l.id = wahl.landeskirche_id
            GROUP BY l.id, l.name
            ORDER BY lower(l.name), l.id`),
        db.query(
          `WITH ${WAHLEN_MIT_EBENEN}
           SELECT k.id::int AS id, k.name, l.name AS landeskirche, COUNT(*)::int AS anzahl
             FROM wahl JOIN kirchenkreise k ON k.id = wahl.kirchenkreis_id
             LEFT JOIN landeskirchen l ON l.id = k.landeskirche_id
            GROUP BY k.id, k.name, l.name
            ORDER BY lower(k.name), k.id`),
        db.query(
          `WITH ${WAHLEN_MIT_EBENEN}
           SELECT o.id::int AS id, ${GEMEINDE_NAME} AS name, k.name AS kirchenkreis, COUNT(*)::int AS anzahl
             FROM wahl JOIN organizations o ON o.id = wahl.gemeinde_id
             LEFT JOIN kirchenkreise k ON k.id = o.kirchenkreis_id
            GROUP BY o.id, k.name
            ORDER BY lower(${GEMEINDE_NAME}), o.id`),
      ]);
      res.json({
        gesamt: gesamt.rows[0],
        uebersetzungen: uebersetzungen.rows,
        sprueche: sprueche.rows,
        eigene: eigene.rows,
        monate: monate.rows,
        ebene: { art: ebene ?? 'alle', id },
        auswahl: {
          landeskirchen: landeskirchen.rows,
          kirchenkreise: kirchenkreise.rows,
          gemeinden: gemeinden.rows,
        },
      });
    } catch (err) {
      console.error('Database error in GET /api/metrics/konfisprueche:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  return router;
};
