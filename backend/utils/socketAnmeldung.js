// socketAnmeldung.js -- Anmeldung am Socket.io-Server.
//
// Stand bis zum 28.09.2026 unmittelbar in server.js (io.use) und war dadurch
// nur ueber den ganzen Server pruefbar. server.js haengt jetzt diese Funktion
// ein, die Tests dieselbe.
//
// Frueher stand hier `socket.user = decoded` — die Angaben aus dem Token
// galten damit ungeprueft, und ein Socket lebt deutlich laenger als die
// 15 Minuten Token-Laufzeit. Ein geloeschtes, deaktiviertes oder per
// Passwortwechsel gesperrtes Konto behielt seine Live-Verbindung
// (Audit 22.08.2026). Die Prüfung kostet EINE Query je Verbindungsaufbau,
// nicht je Nachricht — der Socket verbindet sich einmal und bleibt dann.
//
// display_name gehoert seit dem 28.09.2026 wieder zu socket.user (Audit
// 26.09.2026, Fachlogik Chat/Challenges/Rueckblick BF-12): Seit der Umstellung
// auf die Datenbankpruefung (22.08.2026) fehlte er, und das Tipp-Ereignis
// (utils/chatRoomAccess.js, 'userTyping') schickte `userName: undefined`.
// Er kommt aus derselben Abfrage, eine weitere gibt es nicht.
const jwt = require('jsonwebtoken');
const { Sammelzeile } = require('./sammelzeile');
const { ladeMitgliedschaftenMitSperre, waehleGemeinde } = require('./orgMitglieder');

// Abgelehnte Tokens beim Verbindungsaufbau (01.10.2026): gebuendelt je
// Viertelstunde statt eine Zeile je Versuch. Der haeufigste Grund ist
// "jwt expired" -- eine App, die nach der Pause mit dem alten Token
// wiederverbindet, bevor sie es erneuert hat. Routine, aber ein Muster wie
// "invalid signature" soll sichtbar bleiben: Die Zeile nennt die Anzahl je
// Grund (utils/sammelzeile.js).
const abgelehnteAnmeldungen = new Sammelzeile('Socket.io Auth fehlgeschlagen');

/**
 * @param {object} db
 * @param {string} jwtSecret
 * @returns {(socket: import('socket.io').Socket, next: (err?: Error) => void) => Promise<void>}
 */
function socketAnmeldung(db, jwtSecret) {
  return async (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (err) {
      abgelehnteAnmeldungen.zaehle(err.message);
      return next(new Error('Invalid token'));
    }

    try {
      const { rows: [nutzer] } = await db.query(
        `SELECT u.id, u.organization_id, u.display_name, u.token_invalidated_at, r.name AS role_name
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1 AND u.deleted_at IS NULL AND u.is_active = true`,
        [decoded.id]
      );
      if (!nutzer) {
        return next(new Error('Invalid token'));
      }

      // Soft-Revoke wie in rbac.js: Sperren aus einem Passwortwechsel gelten auch hier.
      if (nutzer.token_invalidated_at) {
        const ausgestellt = decoded.iat;
        const gesperrtAb = Math.floor(new Date(nutzer.token_invalidated_at).getTime() / 1000);
        if (ausgestellt < gesperrtAb) {
          return next(new Error('Token invalidated'));
        }
      }

      // Aktive Organisation aufloesen (Umschalter). Ohne das arbeitet der Socket
      // immer in der Primaer-Org — die Raum-Prüfungen (joinRoom) hätten
      // in einer Zweit-Gemeinde die falsche Organisation verglichen.
      // Dieselbe Regel wie rbac.js (utils/orgMitglieder.js, waehleGemeinde;
      // 08.10.2026): Eine Gemeinde, in der die Person gesperrt ist, geht
      // nicht; ist sie nur in der Stamm-Gemeinde gesperrt, verbindet der
      // Socket ohne Wunsch in die erste freie weitere Gemeinde.
      let orgId = nutzer.organization_id;
      let rolle = nutzer.role_name;
      const tokenOrg = decoded.active_organization_id ? parseInt(decoded.active_organization_id) : null;
      const gewuenscht = Number.isInteger(tokenOrg) ? tokenOrg : null;

      if (gewuenscht !== null || orgId !== null) {
        const mitgliedschaften = await ladeMitgliedschaftenMitSperre(db, decoded.id);
        const { gemeinde, grund } = waehleGemeinde(mitgliedschaften, gewuenscht);
        if (grund === 'kein_mitglied' || grund === 'gesperrt') {
          return next(new Error('Kein Zugriff auf diese Gemeinde'));
        }
        if (!gemeinde || grund === 'keine_freie') {
          return next(new Error('Invalid token'));
        }
        orgId = gemeinde.organization_id;
        rolle = gemeinde.role_name;
      }

      socket.user = {
        id: nutzer.id,
        organization_id: orgId,
        role_name: rolle,
        type: rolle === 'konfi' ? 'konfi' : rolle === 'teamer' ? 'teamer' : 'admin',
        display_name: nutzer.display_name
      };
      next();
    } catch (err) {
      console.error('Socket.io Auth: Datenbankfehler:', err.message);
      return next(new Error('Authentication failed'));
    }
  };
}

module.exports = { socketAnmeldung, abgelehnteAnmeldungen };
