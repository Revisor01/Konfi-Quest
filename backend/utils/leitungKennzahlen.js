// Kennzahlen-Wahl der Leitung (Simon, 09.10.2026; docs/planung/
// darf-freigeben.md): Jede Leitungsperson -- Admin und Org-Admin --
// entscheidet je Gemeinde selbst, welche Zahlen sie sieht.
//
//   antraege    pendingRequests (Reiter "Antraege")
//   verbuchen   pendingEvents   (Reiter "Events", Abschnitt "Verbuchen")
//   challenges  pendingChallenges / challengeApprovals und die
//               Challenge-Neuigkeiten der Leitung (Reiter "Challenges")
//
// Aus heisst an JEDER Stelle, die diese Zahl liest: badge-counts liefert 0
// (dieselbe Form -- auch die Store-Apps zeigen dann keine Zahl), die Zahl am
// App-Symbol und am Gemeinde-Umschalter zaehlt den Bereich nicht, und die
// Pushes dazu ("Neuer Antrag", "Neuer Challenge-Beitrag", die
// Verbuchen-Erinnerung) gehen nicht an die Person. Der Postfach-Eintrag
// eines Vorgangs ("Neuer Antrag eingegangen") bleibt: Simon nannte fuer die
// Abwahl "Push und Zahl" -- anders als beim fehlenden Recht
// (utils/freigabeRechte.js), das auch das Postfach nimmt. Die
// Verbuchen-Erinnerung ist selbst eine Zahl und entfaellt mit der Abwahl
// ganz, samt Postfach (utils/terminLeitungSicht.js).
//
// Keine Zeile in leitung_kennzahlen heisst "alles an" (Migration 204) -- so
// zaehlt fuer alle bestehenden Konten nach dem Deploy alles wie vorher.
//
// Teamer:innen und Konfis haben keine Wahl: Fuer sie gilt immer "an".

const BEREICHE = Object.freeze(['antraege', 'verbuchen', 'challenges']);

const ALLES_AN = Object.freeze({ antraege: true, verbuchen: true, challenges: true });

function pruefeBereich(bereich) {
  if (!BEREICHE.includes(bereich)) throw new Error(`Unbekannter Bereich: ${bereich}`);
}

/** Hat diese Rolle eine Kennzahlen-Wahl? */
function hatKennzahlenWahl(rolle) {
  return rolle === 'org_admin' || rolle === 'admin';
}

/**
 * Die Wahl vieler Personen je Gemeinde -- eine Abfrage.
 *
 * @param {object} db
 * @param {Array<{id:number, organization_id:number}>} paare
 * @returns {Promise<Map<string, {antraege:boolean, verbuchen:boolean, challenges:boolean}>>}
 *   Schluessel `${id}_${organization_id}`; wer fehlt, hat alles an.
 */
async function ladeKennzahlenVieler(db, paare) {
  const ergebnis = new Map();
  const liste = (paare || []).filter((p) => p && p.id != null && p.organization_id != null);
  if (liste.length === 0) return ergebnis;
  const { rows } = await db.query(
    `SELECT lk.user_id, lk.organization_id, lk.antraege, lk.verbuchen, lk.challenges
       FROM leitung_kennzahlen lk
       JOIN unnest($1::bigint[], $2::bigint[]) AS z(user_id, organization_id)
         ON z.user_id = lk.user_id AND z.organization_id = lk.organization_id`,
    [liste.map((p) => p.id), liste.map((p) => p.organization_id)]
  );
  for (const r of rows) {
    ergebnis.set(`${Number(r.user_id)}_${Number(r.organization_id)}`, {
      antraege: r.antraege, verbuchen: r.verbuchen, challenges: r.challenges
    });
  }
  return ergebnis;
}

/** Die Wahl EINER Person in EINER Gemeinde (alles an, wenn nichts gespeichert ist). */
async function ladeKennzahlen(db, userId, organizationId) {
  const jePaar = await ladeKennzahlenVieler(db, [{ id: userId, organization_id: organizationId }]);
  return { ...(jePaar.get(`${Number(userId)}_${Number(organizationId)}`) || ALLES_AN) };
}

/** Ist der Bereich fuer diese Person an? (Eintrag aus ladeKennzahlenVieler) */
function bereichAn(jePaar, userId, organizationId, bereich) {
  pruefeBereich(bereich);
  const wahl = jePaar.get(`${Number(userId)}_${Number(organizationId)}`);
  return !wahl || wahl[bereich] !== false;
}

/**
 * Nur die Personen, die den Bereich in dieser Gemeinde an haben -- fuer
 * Push-Empfaenger. Reihenfolge bleibt.
 */
async function nurMitKennzahl(db, userIds, organizationId, bereich) {
  pruefeBereich(bereich);
  const ids = (userIds || []).map(Number);
  if (ids.length === 0) return [];
  const jePaar = await ladeKennzahlenVieler(db, ids.map((id) => ({ id, organization_id: organizationId })));
  return ids.filter((id) => bereichAn(jePaar, id, organizationId, bereich));
}

/**
 * Speichert die Wahl (nur die mitgeschickten Bereiche; die uebrigen bleiben).
 *
 * @returns {Promise<{antraege:boolean, verbuchen:boolean, challenges:boolean}>}
 */
async function speichereKennzahlen(db, userId, organizationId, wahl) {
  const jetzt = await ladeKennzahlen(db, userId, organizationId);
  for (const b of BEREICHE) {
    if (typeof wahl[b] === 'boolean') jetzt[b] = wahl[b];
  }
  await db.query(
    `INSERT INTO leitung_kennzahlen (user_id, organization_id, antraege, verbuchen, challenges)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, organization_id) DO UPDATE
       SET antraege = EXCLUDED.antraege, verbuchen = EXCLUDED.verbuchen,
           challenges = EXCLUDED.challenges, updated_at = NOW()`,
    [userId, organizationId, jetzt.antraege, jetzt.verbuchen, jetzt.challenges]
  );
  return jetzt;
}

module.exports = {
  BEREICHE,
  ALLES_AN,
  hatKennzahlenWahl,
  ladeKennzahlenVieler,
  ladeKennzahlen,
  bereichAn,
  nurMitKennzahl,
  speichereKennzahlen
};
