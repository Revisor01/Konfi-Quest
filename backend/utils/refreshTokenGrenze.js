// Obergrenze fuer offene Refresh-Tokens (Entscheidung Simon, 01.10.2026).
//
// GEMESSEN (Produktion, 01.10.2026): 1.281 offene Refresh-Tokens auf 133
// Konten, das groesste mit 208. Jede Anmeldung legte ein neues Token an, ohne
// ein altes zu beenden, und ein Token lief erst nach 90 Tagen ab. Am meisten
// sammelten die Konten der Bildschirmfoto-Laeufe (jeder Lauf meldet sich neu
// an); echte Konten trugen bis zu 19 -- ueberwiegend Nachfolger aus einer
// Rotation, die das Geraet nie gespeichert hat. Jedes offene Token ist ein
// 90-Tage-Schluessel zum Konto.
//
// DIE REGEL, nach jeder Ausgabe eines Tokens (Anmeldung, Registrierung,
// Refresh, Passwortwechsel):
//   1. Traegt das neue Token eine Geraete-Kennung (Migration 171), endet jedes
//      andere offene Token desselben Kontos auf DEMSELBEN Geraet. Ein Geraet
//      haelt nur eine Sitzung je Konto; ein aelteres Token dort ist eine
//      vergessene Anmeldung.
//   2. Vom Konto bleiben die REFRESH_TOKENS_JE_KONTO juengsten offenen Tokens,
//      aeltere werden beendet.
//
// WARUM ZEHN: Ein Token rotiert bei jeder Nutzung; das Token eines Geraets,
// das die App benutzt, ist deshalb immer eines der juengsten. Echte Konten
// hatten am 01.10.2026 hoechstens fuenf Tokens aus den letzten sieben Tagen
// (95 % hoechstens drei) -- Telefon, Tablet, Browser und ein Rest. Zehn laesst
// dafuer das Doppelte Platz. Wirkung auf den Bestand (Migration 186): 812
// Tokens auf 12 Konten, davon 714 auf Demo-, Review- und Testkonten; keines
// der beendeten Tokens echter Konten war juenger als sieben Tage.
//
// BEENDET heisst wie beim Abmelden: revoked_at UND expires_at auf jetzt. So
// faellt das Token weder in die Gnadenfrist noch unter das Diebstahl-Signal
// (routes/auth.js, /refresh) -- es gibt ein schlichtes 401, und die App geht
// zur Anmeldung (auch 2.2.0 und 2.3.0: der 401-Pfad in services/api.ts leert
// die Sitzung und zeigt "Sitzung abgelaufen"). Die Gnadenfrist selbst bleibt
// unberuehrt: das gerade rotierte Token ist bereits widerrufen und zaehlt
// nicht mit, sein Nachfolger ist das juengste.
//
// Der Aufraeumlauf (BackgroundService.cleanupRefreshTokens) loescht beendete
// Tokens beim naechsten Lauf, weil ihr expires_at dann in der Vergangenheit
// liegt.

const REFRESH_TOKENS_JE_KONTO = 10;

/**
 * Setzt die Regel fuer ein Konto durch, nachdem ein Token ausgegeben wurde.
 *
 * @param {object} db            pg-Pool oder -Client
 * @param {number} userId
 * @param {object} [optionen]
 * @param {number} [optionen.neuId]   id des gerade ausgegebenen Tokens
 * @param {string|null} [optionen.geraet]  seine Geraete-Kennung
 * @returns {Promise<{geraet: number, ueberGrenze: number}>} beendete Tokens
 */
async function refreshTokensBegrenzen(db, userId, { neuId = null, geraet = null } = {}) {
  let proGeraet = 0;
  if (geraet && neuId) {
    const { rowCount } = await db.query(
      `UPDATE refresh_tokens
          SET revoked_at = NOW(), expires_at = NOW()
        WHERE user_id = $1 AND device_id = $2 AND id <> $3
          AND revoked_at IS NULL AND expires_at > NOW()`,
      [userId, geraet, neuId]
    );
    proGeraet = rowCount || 0;
  }

  const { rowCount: ueberGrenze } = await db.query(
    `UPDATE refresh_tokens
        SET revoked_at = NOW(), expires_at = NOW()
      WHERE id IN (
        SELECT id FROM refresh_tokens
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC NULLS LAST, id DESC
        OFFSET $2
      )`,
    [userId, REFRESH_TOKENS_JE_KONTO]
  );

  return { geraet: proGeraet, ueberGrenze: ueberGrenze || 0 };
}

module.exports = { REFRESH_TOKENS_JE_KONTO, refreshTokensBegrenzen };
