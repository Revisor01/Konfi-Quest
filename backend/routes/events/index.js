// Events routes
//
// WER DARF WAS (Stand 16.09.2026):
//   Termin anlegen, aendern, loeschen, absagen, Absagegrund, reaktivieren,
//   Serien, Teilnehmerverwaltung, Anwesenheit  -> requireAdmin
//     (org_admin, admin). Teamer:innen bekommen hier 403.
//   QR-Code erzeugen und Check-in-Zaehler, Liste der abgesagten Termine
//                                              -> requireTeamer
//   Lesen, eigene Buchung, eigene Zu-/Absage   -> jede:r Angemeldete
//
// Vorher stand hier "Teamer darf alles". Simon woertlich: "teamer erstellen
// keine veranstaltungen fertig. das machen admins und org admins. das ist
// einfach nicht der weg. ich halte das fuer zu komplex. lass es uns
// rausnehmen. also auch nicht loeschen und absagen"
//
// Aufteilung am 28.08.2026: Die frühere routes/events.js war auf über 3300
// Zeilen gewachsen und ist hier entlang der Zuständigkeiten aufgeteilt.
// Die Signatur dieses Moduls und alle API-Pfade sind unverändert —
// createApp.js hängt weiterhin require('./routes/events') unter /api/events ein.
//
// Zur Einhänge-Reihenfolge: Die Teilmodule haben keine überlappenden
// Pfad-Muster (gleiche Methode UND gleiche Segmentzahl), mit einer Ausnahme:
// GET /cancelled und GET /:id liegen deshalb bewusst BEIDE in lesen.js,
// dort in der richtigen Reihenfolge. checkin.js steht als erstes, damit
// die alte Zusicherung "QR-Routen vor den /:id-Routen" erhalten bleibt.
const express = require('express');

module.exports = (db, rbacVerifier, roleHelpers, checkAndAwardBadges) => {
  const router = express.Router();

  // Check-in/QR: POST /qr-checkin, POST /:id/generate-qr, GET /:id/attendance-count
  router.use(require('./checkin')(db, rbacVerifier, roleHelpers, checkAndAwardBadges));
  // Lesen/Listen: GET /, GET /cancelled, GET /:id/timeslots, GET /:id
  router.use(require('./lesen')(db, rbacVerifier, roleHelpers));
  // Anlegen/Bearbeiten/Löschen/Absagen/Chat: POST /, PUT /:id, DELETE /:id,
  // POST /:id/chat, PUT /:id/cancel
  router.use(require('./verwaltung')(db, rbacVerifier, roleHelpers));
  // Buchung/Stornierung durch die Nutzer:innen: POST /:id/book,
  // DELETE /:id/book, GET /user/bookings
  router.use(require('./buchung')(db, rbacVerifier));
  // Teilnehmerverwaltung: POST /:id/participants, DELETE /:id/bookings/:bookingId,
  // PUT /:id/participants/:participantId/status
  router.use(require('./teilnehmer')(db, rbacVerifier, roleHelpers));
  // Serien: POST /series
  router.use(require('./serien')(db, rbacVerifier, roleHelpers));
  // Anwesenheit/Verbuchung: PUT /:id/participants/attendance-all,
  // PUT /:id/participants/:participantId/attendance
  router.use(require('./anwesenheit')(db, rbacVerifier, roleHelpers, checkAndAwardBadges));

  return router;
};
