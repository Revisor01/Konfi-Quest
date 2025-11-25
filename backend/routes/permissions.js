const express = require('express');
const router = express.Router();

// Permissions sind jetzt hardcoded in roleHierarchy.js
// Diese Route gibt nur noch statische Info zurück
module.exports = (db, rbacVerifier, { requireOrgAdmin }) => {

  // Statische Permissions-Info (für Dokumentation)
  const STATIC_PERMISSIONS = {
    org_admin: [
      'Alle Berechtigungen in der eigenen Organisation',
      'User-Verwaltung (erstellen, bearbeiten, löschen)',
      'Rollen zuweisen',
      'Einstellungen bearbeiten'
    ],
    admin: [
      'Konfis verwalten (erstellen, bearbeiten, löschen)',
      'Events verwalten',
      'Badges verwalten',
      'Aktivitäten verwalten',
      'Anträge bearbeiten',
      'Jahrgänge verwalten',
      'Chat-Zugriff'
    ],
    teamer: [
      'Konfis ansehen',
      'Punkte vergeben',
      'Events verwalten',
      'Aktivitäten ansehen',
      'Badges ansehen',
      'Jahrgänge ansehen'
    ],
    konfi: [
      'Eigene Daten ansehen',
      'Eigene Punkte und Badges ansehen',
      'An Events teilnehmen',
      'Anträge einreichen'
    ]
  };

  router.get('/', rbacVerifier, requireOrgAdmin, (req, res) => {
    res.json(STATIC_PERMISSIONS);
  });

  router.get('/grouped', rbacVerifier, requireOrgAdmin, (req, res) => {
    res.json(STATIC_PERMISSIONS);
  });

  return router;
};
