// GET /api/metrics/konfisprueche -- welche Konfisprueche gewaehlt werden
// (docs/messung/umami.md, S1; Simon, 09.10.2026).
//
// Quelle ist konfspruch_wahlen (Migration 207): je Wahl eine Zeile OHNE
// Person, Konto oder Profil. Ausgewertet ueber ALLE Gemeinden, jeder Spruch
// mit seiner Anzahl -- auch Einzelnennungen, die eigenen Sprueche im Wortlaut
// (Simon: „volle Auswertung, auch wenn sie einzeln sind, insbesondere die,
// die selbst eingetragen werden"). Nichts davon geht an Umami.
//
// Gezaehlt werden WAHLEN, nicht Personen: Wer seinen Spruch wechselt, steht
// mit beiden in der Liste. Der heutige Stand je Person liegt in
// konfi_profiles und verschwindet mit dem Konto; diese Zahlen bleiben.
//
// Nur super_admin, wie die uebrigen Betreiber-Kennzahlen unter /api/metrics.
// Die Gemeinde ist gespeichert, wird hier aber nicht ausgegeben -- die
// Ansicht zeigt Summen ueber alle Gemeinden.
const express = require('express');

module.exports = (db, rbacVerifier) => {
  const router = express.Router();

  router.get('/', rbacVerifier, async (req, res) => {
    if (!req.user?.is_super_admin) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    try {
      const [gesamt, uebersetzungen, sprueche, eigene, monate] = await Promise.all([
        db.query(
          `SELECT COUNT(*)::int AS wahlen,
                  COUNT(*) FILTER (WHERE quelle = 'vorschlag')::int AS vorschlag,
                  COUNT(*) FILTER (WHERE quelle = 'eigen')::int AS eigen,
                  COUNT(*) FILTER (WHERE monat IS NULL)::int AS aus_bestand
             FROM konfspruch_wahlen`
        ),
        db.query(
          `SELECT translation, COUNT(*)::int AS anzahl
             FROM konfspruch_wahlen
            WHERE quelle = 'vorschlag'
            GROUP BY translation
            ORDER BY anzahl DESC, translation`
        ),
        db.query(
          `SELECT stelle, COUNT(*)::int AS anzahl
             FROM konfspruch_wahlen
            WHERE quelle = 'vorschlag'
            GROUP BY stelle
            ORDER BY anzahl DESC, stelle`
        ),
        db.query(
          `SELECT freitext, freitext_referenz, COUNT(*)::int AS anzahl
             FROM konfspruch_wahlen
            WHERE quelle = 'eigen'
            GROUP BY freitext, freitext_referenz
            ORDER BY anzahl DESC, freitext_referenz, freitext`
        ),
        db.query(
          `SELECT to_char(monat, 'YYYY-MM') AS monat, COUNT(*)::int AS anzahl
             FROM konfspruch_wahlen
            GROUP BY monat
            ORDER BY monat NULLS FIRST`
        ),
      ]);
      res.json({
        gesamt: gesamt.rows[0],
        uebersetzungen: uebersetzungen.rows,
        sprueche: sprueche.rows,
        eigene: eigene.rows,
        monate: monate.rows,
      });
    } catch (err) {
      console.error('Database error in GET /api/metrics/konfisprueche:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  return router;
};
