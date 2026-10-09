// backend/utils/konfspruch.js
// Konfisprueche und Bibeluebersetzungen — gemeinsame Quelle fuer den Konfi-
// und den Teamer-Weg (Befund M4, 01.09.2026).
//
// Vorher lagen die beiden Konstantenlisten und die Aufloesung des gewaehlten
// Spruchs doppelt bzw. dreifach im Code:
//   KONFSPRUCH_TRANSLATIONS  konfi.js:2236 und teamer.js:859
//   validTranslations        konfi.js:2203 und teamer.js:1106 — die
//                            RVR60-Entfernung am 27.08.2026 musste an BEIDEN
//                            Stellen passieren
//   Spruch-Aufloesung        inline in konfi.js GET /profile, als Helfer in
//                            teamer.js (loadKonfspruch)
//   Listen-Query             konfi.js und teamer.js GET /konfsprueche

// ------------------------------------------------------------------
// Uebersetzungen
// ------------------------------------------------------------------

// Kuerzel der TAGESLOSUNG (Spalte users.bible_translation).
// RVR60 (Reina-Valera) am 27.08.2026 entfernt -- Entscheidung Simon.
// Wer sie noch gespeichert hat, faellt beim naechsten Setzen auf eine der
// uebrigen zurueck; ein bestehender Wert in der Datenbank stoert nicht, die
// Losungs-Schnittstelle wird damit nur nicht mehr neu angefragt.
const BIBEL_UEBERSETZUNGEN = ['LUT', 'ELB', 'GNB', 'BIGS', 'NIV', 'LSG'];

// Gueltige Translation-Keys für den KONFISPRUCH (deskriptiv, NICHT die
// Kuerzel der Tageslosung). Diese Werte landen in der dedizierten Spalte
// konfi_profiles.konfspruch_translation — getrennt von der Tageslosungs-
// Praeferenz bible_translation, damit sich die beiden Features nicht
// gegenseitig ueberschreiben.
const KONFSPRUCH_TRANSLATIONS = ['luther2017', 'bigs', 'gute_nachricht', 'elberfelder'];

// ------------------------------------------------------------------
// Kuratierte Spruchliste (Auswahl-Modal)
// ------------------------------------------------------------------

const SPRUCHLISTE_QUERY = `
  SELECT ks.id, ks.reference, ks.book, ks.chapter, ks.verse,
         COALESCE(
           json_object_agg(ku.translation, ku.text) FILTER (WHERE ku.translation IS NOT NULL),
           '{}'::json
         ) AS uebersetzungen
  FROM konfsprueche ks
  LEFT JOIN konfspruch_uebersetzungen ku ON ku.spruch_id = ks.id
  WHERE ks.is_active = true
    AND (ks.organization_id IS NULL OR ks.organization_id = $1)
  GROUP BY ks.id, ks.reference, ks.book, ks.chapter, ks.verse, ks.sort_order
  ORDER BY ks.sort_order, ks.id
`;

/**
 * Kuratierte Spruchliste einer Organisation (org-eigene plus globale).
 * Jeder Spruch traegt ALLE vier Uebersetzungs-Keys; fehlende sind ein
 * leerer String, damit die Oberflaeche keine undefined-Tabs bekommt.
 *
 * @param {object} db - pg Pool
 * @param {number} organizationId
 * @returns {Promise<object[]>} [{id, reference, book, chapter, verse, uebersetzungen}]
 */
async function ladeSpruchliste(db, organizationId) {
  const { rows } = await db.query(SPRUCHLISTE_QUERY, [organizationId]);
  return rows.map((row) => {
    const uebersetzungen = {};
    for (const key of KONFSPRUCH_TRANSLATIONS) {
      uebersetzungen[key] = (row.uebersetzungen && row.uebersetzungen[key]) || '';
    }
    return {
      id: row.id,
      reference: row.reference,
      book: row.book,
      chapter: row.chapter,
      verse: row.verse,
      uebersetzungen
    };
  });
}

// ------------------------------------------------------------------
// Gewaehlten Spruch aufloesen
// ------------------------------------------------------------------

/**
 * Loest den gespeicherten Konfispruch eines Users auf. Genau EINE Quelle ist
 * aktiv: Listen-Wahl ODER Freitext.
 *
 * Nimmt die bereits geladene konfi_profiles-Zeile entgegen (das Konfi-Profil
 * liest sie ohnehin) — so entsteht keine zusaetzliche Abfrage.
 *
 * @param {object} db - pg Pool
 * @param {object|null} profil - Zeile mit konfspruch_id, konfspruch_freitext,
 *                               konfspruch_freitext_referenz, konfspruch_translation
 * @param {number} organizationId
 * @returns {Promise<object|null>} {source:'liste',id,reference,text,translation}
 *                                 | {source:'freitext',text,reference} | null
 */
async function loeseKonfspruchAuf(db, profil, organizationId) {
  if (!profil) return null;

  if (profil.konfspruch_id) {
    // Listen-Wahl: gewaehlte Uebersetzung nachladen. Org-gescopt + is_active
    // wie in der Listen- und der PATCH-Route. Bei NULL-Translation greift ein
    // Default (luther2017), damit der Text nicht leer bleibt.
    const spruchTranslation = profil.konfspruch_translation || 'luther2017';
    const { rows: [spruch] } = await db.query(
      `SELECT ks.id, ks.reference, ku.text
       FROM konfsprueche ks
       LEFT JOIN konfspruch_uebersetzungen ku
         ON ku.spruch_id = ks.id AND ku.translation = $2
       WHERE ks.id = $1 AND ks.is_active = true
         AND (ks.organization_id IS NULL OR ks.organization_id = $3)`,
      [profil.konfspruch_id, spruchTranslation, organizationId]
    );
    if (!spruch) return null;
    return {
      source: 'liste',
      id: spruch.id,
      reference: spruch.reference,
      text: spruch.text || '',
      translation: profil.konfspruch_translation || null
    };
  }

  if (profil.konfspruch_freitext) {
    return {
      source: 'freitext',
      text: profil.konfspruch_freitext,
      reference: profil.konfspruch_freitext_referenz
    };
  }
  return null;
}

/**
 * Wie loeseKonfspruchAuf, laedt die Profilzeile aber selbst.
 * Fuer Aufrufer ohne bereits geladenes Profil (Teamer-Weg).
 */
async function ladeKonfspruch(db, userId, organizationId) {
  const { rows: [profil] } = await db.query(
    `SELECT konfspruch_id, konfspruch_freitext, konfspruch_freitext_referenz,
            konfspruch_translation
     FROM konfi_profiles WHERE user_id = $1`,
    [userId]
  );
  return loeseKonfspruchAuf(db, profil, organizationId);
}

// ------------------------------------------------------------------
// Personenunabhaengige Spruch-Statistik (Migration 207, S1)
// ------------------------------------------------------------------

/**
 * Der gespeicherte Spruch einer Person VOR dem Speichern -- damit ein
 * unveraendertes erneutes Speichern keine zweite Wahl zaehlt.
 *
 * @returns {Promise<object|null>} Zeile oder null ohne Profil
 */
async function spruchStandLesen(db, userId) {
  const { rows: [stand] } = await db.query(
    `SELECT konfspruch_id, konfspruch_translation, konfspruch_freitext, konfspruch_freitext_referenz
       FROM konfi_profiles WHERE user_id = $1`,
    [userId]
  );
  return stand || null;
}

/**
 * Eine Wahl in konfspruch_wahlen festhalten -- OHNE Person, Konto oder
 * Profil: Gemeinde, Monat und der Spruch selbst (Simon, 09.10.2026: „volle
 * Speicherung ... personenunabhängig"). Die Zeile bleibt bei einer
 * Kontoloeschung stehen; sie hat keinen Verweis auf users.
 *
 * Unveraendert erneut gespeichert zaehlt nicht. Ein Fehler hier darf das
 * Speichern des Spruchs nie scheitern lassen -- er wird nur protokolliert.
 *
 * @param {object} db
 * @param {number} organizationId  Gemeinde, in der gewaehlt wurde
 * @param {{quelle:'vorschlag', spruchId:number, translation:string}
 *        |{quelle:'eigen', freitext:string, referenz:string}} wahl
 * @param {object|null} vorher  Ergebnis von spruchStandLesen
 * @returns {Promise<boolean>} true, wenn eine Zeile geschrieben wurde
 */
async function spruchWahlMerken(db, organizationId, wahl, vorher) {
  try {
    if (wahl.quelle === 'vorschlag') {
      if (vorher && Number(vorher.konfspruch_id) === Number(wahl.spruchId)
        && vorher.konfspruch_translation === wahl.translation) return false;
      await db.query(
        `INSERT INTO konfspruch_wahlen (organization_id, quelle, konfspruch_id, stelle, translation, monat)
         VALUES ($1, 'vorschlag', $2::bigint, (SELECT reference FROM konfsprueche WHERE id = $2::bigint), $3,
                 date_trunc('month', NOW())::date)`,
        [organizationId, wahl.spruchId, wahl.translation]
      );
      return true;
    }
    if (vorher && vorher.konfspruch_id == null
      && vorher.konfspruch_freitext === wahl.freitext
      && vorher.konfspruch_freitext_referenz === wahl.referenz) return false;
    await db.query(
      `INSERT INTO konfspruch_wahlen (organization_id, quelle, freitext, freitext_referenz, monat)
       VALUES ($1, 'eigen', $2, $3, date_trunc('month', NOW())::date)`,
      [organizationId, wahl.freitext, wahl.referenz]
    );
    return true;
  } catch (err) {
    console.error('Konfispruch-Statistik nicht geschrieben:', err.message);
    return false;
  }
}

// ------------------------------------------------------------------
// Routen-Kerne, geteilt von routes/konfi.js und routes/teamer.js
// ------------------------------------------------------------------
//
// PATCH /profile und PUT /bible-translation standen bis 09.10.2026 je
// zweimal im Code, mit eigener Pruefliste je Seite (offene Befunde,
// „Doppelter Code Konfi/Team"). Wie bei der Tageslosung
// (services/losungService.js, beantworteTageslosung) pruefen die Routen nur
// noch die Rolle; Pruefung, Speichern und Antwort stehen hier. Statuscodes,
// Rumpf und Fehlertexte sind byte-gleich mit dem alten Stand -- die
// Store-Apps lesen sie (tests/routes/konfiTeamerKopienCharakterisierung.test.js).

const FEHLER_WEDER_NOCH = 'Bitte entweder einen Spruch aus der Liste (konfspruch_id + translation) oder einen eigenen Spruch (konfspruch_freitext + konfspruch_freitext_referenz) angeben';

// Die beiden Schreibweisen der Profilzeile. Konfis haben sie immer (sie
// entsteht beim Anlegen des Kontos) -- dort wird nur aktualisiert, und ohne
// Zeile bleibt es bei 200 ohne Wirkung, wie bisher. Direkt als Teamer:in
// angelegte Konten haben noch keine; dort wird sie per Upsert angelegt.
const SCHREIBEN = {
  liste: {
    aktualisieren: `UPDATE konfi_profiles
       SET konfspruch_id = $2, konfspruch_translation = $3,
           konfspruch_freitext = NULL, konfspruch_freitext_referenz = NULL
       WHERE user_id = $1`,
    anlegen: `INSERT INTO konfi_profiles (user_id, organization_id, konfspruch_id, konfspruch_translation)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
       SET konfspruch_id = EXCLUDED.konfspruch_id,
           konfspruch_translation = EXCLUDED.konfspruch_translation,
           konfspruch_freitext = NULL, konfspruch_freitext_referenz = NULL`,
  },
  freitext: {
    // konfspruch_translation bleibt unveraendert (Freitext hat keine Tabs).
    aktualisieren: `UPDATE konfi_profiles
       SET konfspruch_freitext = $2, konfspruch_freitext_referenz = $3,
           konfspruch_id = NULL
       WHERE user_id = $1`,
    anlegen: `INSERT INTO konfi_profiles (user_id, organization_id, konfspruch_freitext, konfspruch_freitext_referenz)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
       SET konfspruch_freitext = EXCLUDED.konfspruch_freitext,
           konfspruch_freitext_referenz = EXCLUDED.konfspruch_freitext_referenz,
           konfspruch_id = NULL`,
  },
};

/**
 * PATCH /profile: eigenen Konfispruch setzen -- Listen-Wahl ODER Freitext,
 * genau EINE Quelle aktiv. Die Rolle prueft die aufrufende Route.
 *
 * konfspruch_translation ist die DEDIZIERTE Spalte; bible_translation
 * (Tageslosung) wird hier bewusst nicht angefasst.
 *
 * @param {object} db
 * @param {object} req  req.user.id, req.user.organization_id, req.body
 * @param {object} res
 * @param {{anlegen: boolean, ort: string}} optionen
 *   anlegen: Profilzeile per Upsert anlegen (Team) statt nur aktualisieren
 *   (Konfi); ort: Pfad fuer die Fehlerzeile im Log
 */
async function beantworteKonfspruchSetzen(db, req, res, { anlegen, ort }) {
  const art = anlegen ? 'anlegen' : 'aktualisieren';
  try {
    const userId = req.user.id;
    const orgId = req.user.organization_id;
    const { konfspruch_id, translation, konfspruch_freitext, konfspruch_freitext_referenz } = req.body;
    // Das UPDATE kennt die Gemeinde nicht (die Zeile hat sie schon); ein
    // unbenutzter Parameter liesse Postgres am Typ scheitern.
    const werte = (a, b) => (anlegen ? [userId, orgId, a, b] : [userId, a, b]);

    // Modus 1: Listen-Wahl
    if (konfspruch_id !== undefined && konfspruch_id !== null) {
      const spruchId = parseInt(konfspruch_id, 10);
      if (Number.isNaN(spruchId)) {
        return res.status(400).json({ error: 'Ungültige Spruch-ID' });
      }
      if (!KONFSPRUCH_TRANSLATIONS.includes(translation)) {
        return res.status(400).json({
          error: 'Ungültige Bibelübersetzung',
          valid_translations: KONFSPRUCH_TRANSLATIONS
        });
      }
      // Spruch muss existieren und fuer die Gemeinde sichtbar sein.
      const { rows: [spruch] } = await db.query(
        `SELECT id FROM konfsprueche
         WHERE id = $1 AND is_active = true
           AND (organization_id IS NULL OR organization_id = $2)`,
        [spruchId, orgId]
      );
      if (!spruch) {
        return res.status(404).json({ error: 'Konfispruch nicht gefunden' });
      }
      const vorher = await spruchStandLesen(db, userId);
      const { rowCount } = await db.query(SCHREIBEN.liste[art], werte(spruchId, translation));
      // Personenunabhaengige Statistik (Migration 207): nur, wenn wirklich
      // ein Profil geschrieben wurde.
      if (rowCount > 0) await spruchWahlMerken(db, orgId, { quelle: 'vorschlag', spruchId, translation }, vorher);
      return res.json({
        success: true,
        konfspruch: { source: 'liste', id: spruchId, translation }
      });
    }

    // Modus 2: Freitext
    if (konfspruch_freitext !== undefined && konfspruch_freitext !== null) {
      const freitext = String(konfspruch_freitext).trim();
      const referenz = konfspruch_freitext_referenz != null
        ? String(konfspruch_freitext_referenz).trim()
        : '';
      if (!freitext) {
        return res.status(400).json({ error: 'Der Spruchtext darf nicht leer sein' });
      }
      if (!referenz) {
        return res.status(400).json({
          error: 'Bei einem eigenen Spruch ist die Stellenangabe (Referenz) verpflichtend'
        });
      }
      // Laengen (referenz -> VARCHAR(100)), damit ein zu langer Wert ein
      // sauberes 400 statt eines Postgres-22001/500 liefert.
      if (referenz.length > 100) {
        return res.status(400).json({ error: 'Die Stellenangabe darf höchstens 100 Zeichen lang sein' });
      }
      if (freitext.length > 1000) {
        return res.status(400).json({ error: 'Der Spruchtext ist zu lang' });
      }
      const vorher = await spruchStandLesen(db, userId);
      const { rowCount } = await db.query(SCHREIBEN.freitext[art], werte(freitext, referenz));
      if (rowCount > 0) await spruchWahlMerken(db, orgId, { quelle: 'eigen', freitext, referenz }, vorher);
      return res.json({
        success: true,
        konfspruch: { source: 'freitext', text: freitext, reference: referenz }
      });
    }

    return res.status(400).json({ error: FEHLER_WEDER_NOCH });
  } catch (err) {
    console.error(`Database error in PATCH ${ort}:`, err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
}

/**
 * PUT /bible-translation: Uebersetzung der Tageslosung setzen. Die Wahl
 * liegt seit Migration 132 fuer ALLE Rollen an users (Befund N8).
 *
 * @param {string} ort  Pfad fuer die Fehlerzeile im Log
 */
async function beantworteBibelUebersetzung(db, req, res, ort) {
  try {
    const { translation } = req.body;
    if (!BIBEL_UEBERSETZUNGEN.includes(translation)) {
      return res.status(400).json({ error: 'Ungültige Bibelübersetzung', valid_translations: BIBEL_UEBERSETZUNGEN });
    }
    await db.query('UPDATE users SET bible_translation = $1 WHERE id = $2', [translation, req.user.id]);
    res.json({ success: true, message: 'Bibelübersetzung erfolgreich aktualisiert', translation });
  } catch (err) {
    console.error(`Database error in PUT ${ort}:`, err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
}

module.exports = {
  BIBEL_UEBERSETZUNGEN,
  KONFSPRUCH_TRANSLATIONS,
  ladeSpruchliste,
  loeseKonfspruchAuf,
  ladeKonfspruch,
  spruchStandLesen,
  spruchWahlMerken,
  beantworteKonfspruchSetzen,
  beantworteBibelUebersetzung,
};
