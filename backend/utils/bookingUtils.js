// Shared Booking-Logik fuer Event-Buchungen
// Wird von konfi.js und events.js genutzt
// Keine Push-Notifications oder liveUpdate-Aufrufe — nur Datenbank-Logik

/**
 * Prueft ob ein User bereits fuer ein Event gebucht ist
 * @param {object} client - DB-Client (innerhalb Transaktion)
 * @param {number} userId - User ID
 * @param {number} eventId - Event ID
 * @returns {object|null} Booking-Objekt oder null
 */
async function checkExistingBooking(client, userId, eventId) {
  const { rows: [existing] } = await client.query(
    'SELECT id FROM event_bookings WHERE user_id = $1 AND event_id = $2',
    [userId, eventId]
  );
  return existing || null;
}

/**
 * Laedt Event mit confirmed_count und waitlist_count (FOR UPDATE)
 * @param {object} client - DB-Client (innerhalb Transaktion)
 * @param {number} eventId - Event ID
 * @param {number} orgId - Organisation ID
 * @param {object} options - { excludeTeamers: boolean }
 * @returns {object|null} Event mit confirmed_count und waitlist_count oder null
 */
async function getEventWithCounts(client, eventId, orgId, options = {}) {
  const { excludeTeamers = false } = options;

  let query;
  if (excludeTeamers) {
    query = `
      SELECT e.*,
             COUNT(eb.id) FILTER (WHERE eb.status = 'confirmed') as confirmed_count,
             COUNT(eb.id) FILTER (WHERE eb.status = 'waitlist') as waitlist_count
      FROM events e
      LEFT JOIN event_bookings eb ON e.id = eb.event_id
      LEFT JOIN users u ON eb.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id AND r.name = 'teamer'
      WHERE e.id = $1 AND e.organization_id = $2 AND (eb.id IS NULL OR r.id IS NULL)
      GROUP BY e.id
      FOR UPDATE OF e
    `;
  } else {
    query = `
      SELECT e.*,
             COUNT(eb.id) FILTER (WHERE eb.status = 'confirmed') as confirmed_count,
             COUNT(eb.id) FILTER (WHERE eb.status = 'waitlist') as waitlist_count
      FROM events e
      LEFT JOIN event_bookings eb ON e.id = eb.event_id
      WHERE e.id = $1 AND e.organization_id = $2
      GROUP BY e.id
      FOR UPDATE OF e
    `;
  }

  const { rows: [event] } = await client.query(query, [eventId, orgId]);
  return event || null;
}

/**
 * Bestimmt den Buchungsstatus basierend auf Kapazitaet und Warteliste
 * @param {object} event - Event-Objekt
 * @param {number} confirmedCount - Anzahl bestaetigter Buchungen
 * @param {number} waitlistCount - Anzahl Wartelisten-Eintraege
 * @param {number} maxCapacity - Maximale Kapazitaet
 * @returns {string|object} 'confirmed', 'waitlist', oder { error: string, status: number }
 */
function determineBookingStatus(event, confirmedCount, waitlistCount, maxCapacity) {
  // 0 = unbegrenzt
  if (maxCapacity > 0 && confirmedCount >= maxCapacity) {
    if (event.waitlist_enabled && waitlistCount < (event.max_waitlist_size || 10)) {
      return 'waitlist';
    }
    // Kein Platz und keine Warteliste oder Warteliste voll
    if (!event.waitlist_enabled) {
      return { error: 'Das Event ist leider bereits ausgebucht', status: 400 };
    }
    return { error: 'Event ist voll und Warteliste ist auch voll', status: 400 };
  }
  return 'confirmed';
}

/**
 * Rueckt den ersten Wartelisten-Eintrag nach (timeslot-aware)
 * @param {object} db - DB-Pool
 * @param {number} eventId - Event ID
 * @param {number|null} timeslotId - Timeslot ID (null fuer Events ohne Timeslots)
 * @returns {number|null} User-ID des nachgerueckten Users oder null
 */
async function promoteFromWaitlist(db, eventId, timeslotId) {
  const query = timeslotId
    ? "SELECT id, user_id FROM event_bookings WHERE event_id = $1 AND timeslot_id = $2 AND status = 'waitlist' ORDER BY created_at ASC LIMIT 1"
    : "SELECT id, user_id FROM event_bookings WHERE event_id = $1 AND status = 'waitlist' ORDER BY created_at ASC LIMIT 1";
  const params = timeslotId ? [eventId, timeslotId] : [eventId];

  const { rows: [nextInLine] } = await db.query(query, params);

  if (!nextInLine) return null;

  await db.query("UPDATE event_bookings SET status = 'confirmed' WHERE id = $1", [nextInLine.id]);
  return nextInLine.user_id;
}

/**
 * Prueft ob das Anmeldezeitraum fuer ein Event offen ist
 * @param {object} event - Event-Objekt mit registration_opens_at und registration_closes_at
 * @returns {object} { valid: boolean, error?: string }
 */
function validateRegistrationWindow(event) {
  const now = new Date();
  if (event.registration_opens_at && now < new Date(event.registration_opens_at)) {
    return { valid: false, error: 'Anmeldung noch nicht geöffnet' };
  }
  if (event.registration_closes_at && now > new Date(event.registration_closes_at)) {
    return { valid: false, error: 'Anmeldung bereits geschlossen' };
  }
  return { valid: true };
}

module.exports = {
  checkExistingBooking,
  getEventWithCounts,
  determineBookingStatus,
  promoteFromWaitlist,
  validateRegistrationWindow
};
