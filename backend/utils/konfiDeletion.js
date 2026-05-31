// backend/utils/konfiDeletion.js
// Gemeinsame kaskadierende Loesch-Funktion fuer Konfis (D-04).
// Single Source of Truth: wird von Admin-Delete, Self-Delete (Plan 02)
// und Auto-Delete (Plan 05) genutzt, damit die Loesch-Pfade nicht
// auseinanderlaufen.

/**
 * Loescht einen Konfi und alle 16 abhaengigen Tabellen in der korrekten
 * FK-Reihenfolge (Kind-Tabellen zuerst, users zuletzt).
 *
 * WICHTIG: Diese Funktion fuehrt KEIN BEGIN/COMMIT/ROLLBACK aus. Der Aufrufer
 * steuert die Transaktion und uebergibt einen client (aus db.getClient()).
 * So koennen Admin/Self/Auto-Delete die Loeschung in ihre eigene Transaktion
 * einbetten.
 *
 * organization_id wird nur bei Tabellen mitgegeben, die die Spalte besitzen
 * (user_activities, bonus_points, event_points, event_bookings, activity_requests).
 *
 * @param {import('pg').PoolClient} client - DB-Client (Transaktion vom Aufrufer gesteuert)
 * @param {number} userId - ID des zu loeschenden Konfis
 * @param {number} organizationId - Organisation des Konfis (Scope-Schutz)
 */
async function deleteKonfiCascade(client, userId, organizationId) {
  // Reihenfolge MUSS erhalten bleiben (FK-Constraints).
  await client.query("DELETE FROM user_activities WHERE user_id = $1 AND organization_id = $2", [userId, organizationId]);
  await client.query("DELETE FROM bonus_points WHERE konfi_id = $1 AND organization_id = $2", [userId, organizationId]);
  await client.query("DELETE FROM event_points WHERE konfi_id = $1 AND organization_id = $2", [userId, organizationId]);
  await client.query("DELETE FROM event_bookings WHERE user_id = $1 AND organization_id = $2", [userId, organizationId]);
  await client.query("DELETE FROM user_badges WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM activity_requests WHERE user_id = $1 AND organization_id = $2", [userId, organizationId]);
  await client.query("DELETE FROM chat_participants WHERE user_id = $1 AND user_type = 'konfi'", [userId]);
  await client.query("DELETE FROM chat_read_status WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM chat_messages WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM notifications WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM password_resets WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM user_jahrgang_assignments WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM chat_poll_votes WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM push_tokens WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM konfi_profiles WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM users WHERE id = $1", [userId]);
}

module.exports = { deleteKonfiCascade };
