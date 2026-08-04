// Challenges 2.0 — der erste NICHT-quantitative Baustein der App.
//
// Konfis produzieren eigene Deutungen (Foto, Text, Audio, Video, Link) statt
// Teilnahme zu zaehlen. Bewusst OHNE Punkte, OHNE custom_badges-Eintrag, OHNE
// Zaehler/Ranglisten in der Konfi-Sicht.
//
// Kernentscheidungen:
// - Status wird ABGELEITET (is_draft / starts_at / ends_at), nie gespeichert.
// - Abzeichen wird ABGELEITET (EXISTS eigene Submission); badge_icon/badge_name
//   haengen an der Challenge.
// - Sichtbarkeit laeuft ueber GENAU EINE Helper-Funktion (isSubmissionPublic /
//   PUBLIC_SUBMISSION_SQL), damit Galerie, Datei-Auslieferung und Export nie
//   auseinanderlaufen koennen.
// - visibility / moderated / starts_at / allowed_media sind nach Start
//   unveraenderbar (Konsens-Integritaet): ein Konfi, der unter Zusage X
//   eingereicht hat, darf nicht nachtraeglich unter Zusage Y veroeffentlicht
//   werden.

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const { encryptBuffer, decryptBuffer } = require('../utils/photoCrypto');
const { allIdsBelongToOrg } = require('../utils/orgOwnership');
const { deleteChallengeFile } = require('../utils/photoStorage');
const PushService = require('../services/pushService');
const liveUpdate = require('../utils/liveUpdate');

const MEDIA_TYPES = ['text', 'photo', 'audio', 'video', 'link'];
const VISIBILITIES = ['public', 'konfi_choice', 'private'];
const CHALLENGE_TYPES = ['wahrnehmung', 'beitrag', 'praxis', 'frei'];
const CONSENTS = ['publish', 'private', 'anonymous'];

// Content-Type-Mapping fuer die Datei-Auslieferung (inkl. Audio/Video, weil
// Challenges anders als Chat-Bilder auch Sprachaufnahmen und Clips tragen).
const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.m4v': 'video/mp4'
};

// ====================================================================
// ZENTRALE SICHTBARKEITSLOGIK — hier und NUR hier
// ====================================================================
//
// Eine Submission ist oeffentlich sichtbar (Galerie fuer die Konfis der
// zugewiesenen Jahrgaenge) genau dann, wenn:
//   moderation_status = 'approved'
//   UND ( challenge.visibility = 'public'
//         ODER (challenge.visibility = 'konfi_choice'
//               UND konfi_consent IN ('publish','anonymous')) )
//
// visibility='private' ist NIE oeffentlich. 'hidden' schlaegt alles.
//
// SQL-Fragment fuer Queries, die challenges als "c" und challenge_submissions
// als "cs" aliasieren.
const PUBLIC_SUBMISSION_SQL = `(
  cs.moderation_status = 'approved'
  AND (
    c.visibility = 'public'
    OR (c.visibility = 'konfi_choice' AND cs.konfi_consent IN ('publish', 'anonymous'))
  )
)`;

// JS-Pendant fuer bereits geladene Zeilen (Datei-Auslieferung, Export).
// Erwartet { moderation_status, konfi_consent } und { visibility }.
function isSubmissionPublic(submission, challenge) {
  if (!submission || !challenge) return false;
  if (submission.moderation_status !== 'approved') return false;
  if (challenge.visibility === 'public') return true;
  if (challenge.visibility === 'konfi_choice') {
    return submission.konfi_consent === 'publish' || submission.konfi_consent === 'anonymous';
  }
  return false;
}

// Anonyme Beitraege duerfen in der Galerie KEINEN Namen tragen — das Backend
// schickt display_name gar nicht erst mit (nicht erst das Frontend blendet aus).
function isAnonymous(submission, challenge) {
  return challenge.visibility === 'konfi_choice' && submission.konfi_consent === 'anonymous';
}

// Abgeleiteter Status (nie als Spalte gespeichert).
function deriveStatus(challenge, now = new Date()) {
  if (challenge.is_draft) return 'draft';
  const starts = new Date(challenge.starts_at);
  const ends = new Date(challenge.ends_at);
  if (starts > now) return 'scheduled';
  if (ends < now) return 'ended';
  return 'active';
}

// Eine Challenge ist "gestartet", sobald sie kein Draft mehr ist UND starts_at
// erreicht wurde. Ab dann sind die Konsens-Felder eingefroren.
function hasStarted(challenge, now = new Date()) {
  return !challenge.is_draft && new Date(challenge.starts_at) <= now;
}

function isActive(challenge, now = new Date()) {
  return deriveStatus(challenge, now) === 'active';
}

// allowed_media kommt je nach Treiber als Array oder als JSON-String zurueck.
function parseAllowedMedia(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

module.exports = (db, rbacVerifier, roleHelpers, uploadsDir, challengeUpload) => {
  const { requireTeamer } = roleHelpers;
  const challengeDir = path.join(uploadsDir, 'challenges');

  // ====================================================================
  // HELFER
  // ====================================================================

  // Jahrgaenge, die ein Teamer sehen darf. org_admin/admin sehen alles (null =
  // keine Einschraenkung), super_admin nichts (leeres Array).
  function viewableJahrgangIds(req) {
    if (req.user.role_name === 'super_admin') return [];
    if (['org_admin', 'admin'].includes(req.user.role_name)) return null;
    return (req.user.assigned_jahrgaenge || []).filter(j => j.can_view).map(j => j.id);
  }

  // Darf die Leitung diese Challenge sehen/bearbeiten? org_admin/admin immer,
  // Teamer nur wenn mindestens ein zugewiesener Jahrgang zugeordnet ist.
  // Challenges ohne Jahrgangs-Zuordnung sind reine Leitungs-Entwuerfe und nur
  // fuer org_admin/admin sichtbar (sonst koennte ein Teamer fremde Entwuerfe sehen).
  async function leadershipMayAccess(req, challengeId) {
    const viewable = viewableJahrgangIds(req);
    if (viewable === null) return true;
    if (viewable.length === 0) return false;
    const { rows: [row] } = await db.query(
      `SELECT 1 FROM challenge_jahrgang_assignments
       WHERE challenge_id = $1 AND jahrgang_id = ANY($2::int[]) LIMIT 1`,
      [challengeId, viewable]
    );
    return !!row;
  }

  // Jahrgang des anfragenden Konfis (konfi_profiles haelt genau einen).
  async function konfiJahrgangId(userId) {
    const { rows: [row] } = await db.query(
      'SELECT jahrgang_id FROM konfi_profiles WHERE user_id = $1',
      [userId]
    );
    return row ? row.jahrgang_id : null;
  }

  // Challenge inkl. Org-Scoping laden.
  async function loadChallenge(id, organizationId) {
    const { rows: [row] } = await db.query(
      `SELECT c.*,
              COALESCE(au.display_name, c.author_freetext) AS author_name
       FROM challenges c
       LEFT JOIN users au ON c.author_user_id = au.id
       WHERE c.id = $1 AND c.organization_id = $2`,
      [id, organizationId]
    );
    return row || null;
  }

  // Jahrgangs-IDs einer Challenge.
  async function challengeJahrgangIds(challengeId) {
    const { rows } = await db.query(
      'SELECT jahrgang_id FROM challenge_jahrgang_assignments WHERE challenge_id = $1',
      [challengeId]
    );
    return rows.map(r => r.jahrgang_id);
  }

  // Einheitliche Aufbereitung einer Challenge fuer die Konfi-Sicht.
  function mapChallengeForKonfi(row, now = new Date()) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      challenge_type: row.challenge_type,
      visibility: row.visibility,
      moderated: row.moderated,
      allowed_media: parseAllowedMedia(row.allowed_media),
      allow_multiple: row.allow_multiple,
      badge_icon: row.badge_icon,
      badge_name: row.badge_name,
      author_name: row.author_name || null,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      status: deriveStatus(row, now),
      has_badge: row.has_badge === true || row.has_badge === 't',
      own_submission_count: parseInt(row.own_submission_count, 10) || 0
    };
  }

  // Live-Update an alle Konfis der zugewiesenen Jahrgaenge.
  // Wird bewusst OHNE await aufgerufen (fire-and-forget, immer nach der
  // Response) — deshalb faengt die Funktion jeden Fehler selbst ab und darf
  // NIE rejecten, sonst kippt der Prozess mit einer unhandled rejection.
  async function notifyJahrgaenge(challengeId, action, data) {
    try {
      const jahrgangIds = await challengeJahrgangIds(challengeId);
      for (const jahrgangId of jahrgangIds) {
        await liveUpdate.sendToJahrgang(jahrgangId, 'challenge', action, data);
      }
    } catch (err) {
      console.error('Live-Update fuer Challenge fehlgeschlagen:', err.message);
    }
  }

  // Datei aus dem Upload-Buffer verschluesselt ablegen. Gibt den Hex-Dateinamen
  // zurueck (die Abruf-Route akzeptiert nur [a-f0-9]+).
  async function storeUploadedFile(buffer) {
    const filename = crypto.randomBytes(32).toString('hex');
    await fs.promises.mkdir(challengeDir, { recursive: true });
    await fs.promises.writeFile(path.join(challengeDir, filename), encryptBuffer(buffer));
    return filename;
  }

  // ====================================================================
  // VALIDIERUNG
  // ====================================================================

  const validateCreate = [
    body('title').trim().notEmpty().isLength({ max: 200 }).withMessage('Titel ist erforderlich (max. 200 Zeichen)'),
    body('description').trim().notEmpty().withMessage('Beschreibung ist erforderlich'),
    body('challenge_type').optional().isIn(CHALLENGE_TYPES).withMessage('Ungültiger Challenge-Typ'),
    body('visibility').optional().isIn(VISIBILITIES).withMessage('Ungültige Sichtbarkeit'),
    body('moderated').optional().isBoolean().withMessage('Moderation muss ein Boolean sein'),
    body('allowed_media').optional().isArray({ min: 1 }).withMessage('Mindestens eine Medienart ist erforderlich'),
    body('allow_multiple').optional().isBoolean().withMessage('Mehrfach-Einreichung muss ein Boolean sein'),
    body('badge_icon').optional().trim().isLength({ max: 50 }).withMessage('Abzeichen-Icon max. 50 Zeichen'),
    body('badge_name').trim().notEmpty().isLength({ max: 100 }).withMessage('Abzeichen-Name ist erforderlich (max. 100 Zeichen)'),
    body('author_user_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Ungültige Urheber-ID'),
    body('author_freetext').optional({ nullable: true }).trim().isLength({ max: 200 }).withMessage('Urheber-Freitext max. 200 Zeichen'),
    body('starts_at').isISO8601().withMessage('Startzeitpunkt ist erforderlich'),
    body('ends_at').isISO8601().withMessage('Endzeitpunkt ist erforderlich'),
    body('is_draft').optional().isBoolean().withMessage('Entwurfs-Flag muss ein Boolean sein'),
    body('jahrgang_ids').optional().isArray().withMessage('jahrgang_ids muss ein Array sein'),
    handleValidationErrors
  ];

  const validateUpdate = [
    param('id').isInt({ min: 1 }).withMessage('Ungültige ID'),
    body('title').optional().trim().notEmpty().isLength({ max: 200 }).withMessage('Titel max. 200 Zeichen'),
    body('description').optional().trim().notEmpty().withMessage('Beschreibung darf nicht leer sein'),
    body('challenge_type').optional().isIn(CHALLENGE_TYPES).withMessage('Ungültiger Challenge-Typ'),
    body('visibility').optional().isIn(VISIBILITIES).withMessage('Ungültige Sichtbarkeit'),
    body('moderated').optional().isBoolean().withMessage('Moderation muss ein Boolean sein'),
    body('allowed_media').optional().isArray({ min: 1 }).withMessage('Mindestens eine Medienart ist erforderlich'),
    body('allow_multiple').optional().isBoolean().withMessage('Mehrfach-Einreichung muss ein Boolean sein'),
    body('badge_icon').optional().trim().isLength({ max: 50 }).withMessage('Abzeichen-Icon max. 50 Zeichen'),
    body('badge_name').optional().trim().notEmpty().isLength({ max: 100 }).withMessage('Abzeichen-Name max. 100 Zeichen'),
    body('starts_at').optional().isISO8601().withMessage('Ungültiger Startzeitpunkt'),
    body('ends_at').optional().isISO8601().withMessage('Ungültiger Endzeitpunkt'),
    body('is_draft').optional().isBoolean().withMessage('Entwurfs-Flag muss ein Boolean sein'),
    body('jahrgang_ids').optional().isArray().withMessage('jahrgang_ids muss ein Array sein'),
    handleValidationErrors
  ];

  const validateModerate = [
    param('id').isInt({ min: 1 }).withMessage('Ungültige ID'),
    body('action').isIn(['approve', 'hide', 'unhide']).withMessage('Ungültige Moderations-Aktion'),
    handleValidationErrors
  ];

  // ====================================================================
  // KONFI-ENDPUNKTE
  // ====================================================================

  // GET /konfi — aktive Challenges, Archiv und eigene Abzeichen.
  // Konfi sieht ausschliesslich Challenges seiner Jahrgaenge, nie Entwuerfe.
  router.get('/konfi', rbacVerifier, async (req, res) => {
    try {
      if (req.user.role_name !== 'konfi') {
        return res.status(403).json({ error: 'Nur für Konfis' });
      }
      const jahrgangId = await konfiJahrgangId(req.user.id);
      if (!jahrgangId) {
        return res.json({ active: [], archive: [], marks: [] });
      }

      const { rows } = await db.query(
        `SELECT c.*,
                COALESCE(au.display_name, c.author_freetext) AS author_name,
                EXISTS (
                  SELECT 1 FROM challenge_submissions s
                  WHERE s.challenge_id = c.id AND s.user_id = $3
                ) AS has_badge,
                (
                  SELECT COUNT(*) FROM challenge_submissions s2
                  WHERE s2.challenge_id = c.id AND s2.user_id = $3
                ) AS own_submission_count
         FROM challenges c
         JOIN challenge_jahrgang_assignments cja ON cja.challenge_id = c.id
         LEFT JOIN users au ON c.author_user_id = au.id
         WHERE c.organization_id = $1
           AND cja.jahrgang_id = $2
           AND c.is_draft = false
           AND c.starts_at <= NOW()
         ORDER BY c.starts_at DESC`,
        [req.user.organization_id, jahrgangId, req.user.id]
      );

      const now = new Date();
      const active = [];
      const archive = [];
      const marks = [];

      for (const row of rows) {
        const mapped = mapChallengeForKonfi(row, now);
        if (mapped.status === 'active') {
          active.push(mapped);
        } else if (mapped.status === 'ended') {
          archive.push(mapped);
        }
        if (mapped.has_badge) {
          marks.push({
            challenge_id: row.id,
            badge_icon: row.badge_icon,
            badge_name: row.badge_name,
            title: row.title
          });
        }
      }

      res.json({ active, archive, marks });
    } catch (err) {
      console.error('Database error in GET /challenges/konfi:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // GET /konfi/:id — Detail inkl. Galerie (oeffentliche Beitraege) und eigenen
  // Beitraegen (immer, mit Status).
  router.get('/konfi/:id',
    rbacVerifier,
    param('id').isInt({ min: 1 }).withMessage('Ungültige ID'),
    handleValidationErrors,
    async (req, res) => {
      try {
        if (req.user.role_name !== 'konfi') {
          return res.status(403).json({ error: 'Nur für Konfis' });
        }
        const challengeId = parseInt(req.params.id, 10);
        const jahrgangId = await konfiJahrgangId(req.user.id);
        if (!jahrgangId) {
          return res.status(404).json({ error: 'Challenge nicht gefunden' });
        }

        const challenge = await loadChallenge(challengeId, req.user.organization_id);
        if (!challenge || challenge.is_draft || new Date(challenge.starts_at) > new Date()) {
          return res.status(404).json({ error: 'Challenge nicht gefunden' });
        }

        const jahrgangIds = await challengeJahrgangIds(challengeId);
        if (!jahrgangIds.includes(jahrgangId)) {
          return res.status(403).json({ error: 'Kein Zugriff auf diese Challenge' });
        }

        // Galerie: NUR oeffentliche Beitraege (zentrale Logik), fremde
        // Beitraege. Bei 'anonymous' wird der Name in SQL bereits auf NULL
        // gesetzt — display_name verlaesst das Backend gar nicht erst.
        const { rows: gallery } = await db.query(
          `SELECT cs.id, cs.media_type, cs.text_content, cs.file_path, cs.file_name,
                  cs.link_url, cs.created_at,
                  CASE WHEN c.visibility = 'konfi_choice' AND cs.konfi_consent = 'anonymous'
                       THEN NULL ELSE u.display_name END AS display_name,
                  (c.visibility = 'konfi_choice' AND cs.konfi_consent = 'anonymous') AS is_anonymous
           FROM challenge_submissions cs
           JOIN challenges c ON cs.challenge_id = c.id
           JOIN users u ON cs.user_id = u.id
           WHERE cs.challenge_id = $1
             AND cs.user_id <> $2
             AND ${PUBLIC_SUBMISSION_SQL}
           ORDER BY cs.created_at DESC`,
          [challengeId, req.user.id]
        );

        const { rows: own } = await db.query(
          `SELECT id, media_type, text_content, file_path, file_name, link_url,
                  konfi_consent, moderation_status, created_at
           FROM challenge_submissions
           WHERE challenge_id = $1 AND user_id = $2
           ORDER BY created_at DESC`,
          [challengeId, req.user.id]
        );

        res.json({
          challenge: mapChallengeForKonfi({
            ...challenge,
            has_badge: own.length > 0,
            own_submission_count: own.length
          }),
          gallery,
          own_submissions: own
        });
      } catch (err) {
        console.error('Database error in GET /challenges/konfi/:id:', err);
        res.status(500).json({ error: 'Datenbankfehler' });
      }
    }
  );

  // POST /konfi/:id/submissions — Beitrag einreichen.
  // multipart (Feld 'file') fuer photo/audio/video, JSON fuer text/link.
  router.post('/konfi/:id/submissions',
    rbacVerifier,
    challengeUpload.single('file'),
    param('id').isInt({ min: 1 }).withMessage('Ungültige ID'),
    handleValidationErrors,
    async (req, res) => {
      try {
        if (req.user.role_name !== 'konfi') {
          return res.status(403).json({ error: 'Nur für Konfis' });
        }
        const challengeId = parseInt(req.params.id, 10);
        const { media_type, text_content, link_url, konfi_consent } = req.body;

        if (!MEDIA_TYPES.includes(media_type)) {
          return res.status(400).json({ error: 'Ungültige Medienart' });
        }

        const challenge = await loadChallenge(challengeId, req.user.organization_id);
        if (!challenge || challenge.is_draft) {
          return res.status(404).json({ error: 'Challenge nicht gefunden' });
        }

        const jahrgangId = await konfiJahrgangId(req.user.id);
        const jahrgangIds = await challengeJahrgangIds(challengeId);
        if (!jahrgangId || !jahrgangIds.includes(jahrgangId)) {
          return res.status(403).json({ error: 'Kein Zugriff auf diese Challenge' });
        }

        if (!isActive(challenge)) {
          return res.status(409).json({ error: 'Diese Challenge läuft gerade nicht.' });
        }

        const allowedMedia = parseAllowedMedia(challenge.allowed_media);
        if (!allowedMedia.includes(media_type)) {
          return res.status(400).json({ error: 'Diese Medienart ist für diese Challenge nicht erlaubt.' });
        }

        // Mehrfach-Einreichung
        if (!challenge.allow_multiple) {
          const { rows: [existing] } = await db.query(
            'SELECT 1 FROM challenge_submissions WHERE challenge_id = $1 AND user_id = $2 LIMIT 1',
            [challengeId, req.user.id]
          );
          if (existing) {
            return res.status(409).json({ error: 'Du hast für diese Challenge bereits einen Beitrag abgegeben.' });
          }
        }

        // Inhaltliche Pflichtfelder je Medienart
        const trimmedText = typeof text_content === 'string' ? text_content.trim() : '';
        if (media_type === 'text' && !trimmedText) {
          return res.status(400).json({ error: 'Bitte schreibe einen Text.' });
        }
        if (media_type === 'link') {
          if (!link_url || !/^https?:\/\/\S+$/i.test(link_url)) {
            return res.status(400).json({ error: 'Bitte gib einen gültigen Link an (beginnend mit http:// oder https://).' });
          }
        }
        if (['photo', 'audio', 'video'].includes(media_type) && !req.file) {
          return res.status(400).json({ error: 'Bitte wähle eine Datei aus.' });
        }

        // Konsens: nur bei visibility='konfi_choice' relevant. Das Frontend zeigt
        // die Auswahl dort als Pflichtfeld; kommt trotzdem nichts an, gilt
        // 'publish' als Fallback. Bei public/private wird NICHTS gespeichert,
        // damit die zentrale Sichtbarkeitslogik eindeutig bleibt.
        let consent = null;
        if (challenge.visibility === 'konfi_choice') {
          consent = konfi_consent || 'publish';
          if (!CONSENTS.includes(consent)) {
            return res.status(400).json({ error: 'Ungültige Sichtbarkeits-Auswahl' });
          }
        }

        // Datei verarbeiten (Magic-Bytes-Pruefung wie im Chat: der Header eines
        // Uploads ist Client-Angabe, der echte Typ steht in den ersten Bytes).
        let filePath = null;
        let fileName = null;
        if (req.file) {
          if (!req.file.buffer) {
            return res.status(400).json({ error: 'Datei konnte nicht gelesen werden' });
          }
          const { fileTypeFromBuffer } = await import('file-type');
          const detected = await fileTypeFromBuffer(req.file.buffer);
          const expectedPrefix = media_type === 'photo' ? 'image/'
            : media_type === 'audio' ? 'audio/'
              : 'video/';
          // Manche Container (m4a/mp4/mov) werden als video/* erkannt, obwohl nur
          // eine Tonspur drin ist — deshalb bei Audio auch video/mp4 zulassen.
          const audioFallback = media_type === 'audio'
            && detected && ['video/mp4', 'video/quicktime', 'application/mp4'].includes(detected.mime);
          if (!detected || (!detected.mime.startsWith(expectedPrefix) && !audioFallback)) {
            return res.status(415).json({ error: 'Dateityp konnte nicht verifiziert werden' });
          }
          filePath = await storeUploadedFile(req.file.buffer);
          fileName = req.file.originalname;
        }

        // Auto-Approve: ohne Moderation gilt der Beitrag sofort als freigegeben.
        const moderationStatus = challenge.moderated ? 'pending' : 'approved';

        const { rows: [created] } = await db.query(
          `INSERT INTO challenge_submissions
             (challenge_id, user_id, organization_id, media_type, text_content,
              file_path, file_name, link_url, konfi_consent, moderation_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, media_type, text_content, file_path, file_name, link_url,
                     konfi_consent, moderation_status, created_at`,
          [
            challengeId,
            req.user.id,
            req.user.organization_id,
            media_type,
            trimmedText || null,
            filePath,
            fileName,
            media_type === 'link' ? link_url : null,
            consent,
            moderationStatus
          ]
        );

        res.status(201).json(created);

        // Fire-and-forget NACH der Antwort: Push an die Leitung (immer, auch
        // wenn der Beitrag sofort oeffentlich ist) und — bei der ERSTEN eigenen
        // Submission zu dieser Challenge — der "Abzeichen erhalten"-Push an den
        // Konfi. Das Abzeichen ist abgeleitet (EXISTS eigene Submission, s.o.),
        // erscheint im UI also schon jetzt, unabhaengig vom Moderationsstatus.
        (async () => {
          try {
            await PushService.sendChallengeSubmissionToLeadership(
              db,
              req.user.organization_id,
              challengeId,
              challenge.title,
              req.user.display_name,
              challenge.moderated
            );
          } catch (pushErr) {
            console.error('Push für Challenge-Beitrag fehlgeschlagen:', pushErr.message);
          }

          try {
            const { rows: [{ count: ownCount }] } = await db.query(
              `SELECT COUNT(*)::int AS count FROM challenge_submissions
               WHERE challenge_id = $1 AND user_id = $2`,
              [challengeId, req.user.id]
            );
            // Genau 1 => die soeben erstellte Submission ist die erste ueberhaupt.
            if (ownCount === 1) {
              await PushService.sendChallengeBadgeEarnedToKonfi(
                db,
                req.user.id,
                challengeId,
                challenge.title
              );
            }
          } catch (badgeErr) {
            console.error('Abzeichen-Push für Challenge-Beitrag fehlgeschlagen:', badgeErr.message);
          }
        })();

        // Live-Update nur, wenn der Beitrag sofort oeffentlich sichtbar ist.
        if (isSubmissionPublic(created, challenge)) {
          notifyJahrgaenge(challengeId, 'submission_update', { challengeId });
        }
      } catch (err) {
        console.error('Database error in POST /challenges/konfi/:id/submissions:', err);
        res.status(500).json({ error: 'Datenbankfehler' });
      }
    }
  );

  // DELETE /konfi/submissions/:id — nur eigene Beitraege, Datei wird mitgeloescht.
  router.delete('/konfi/submissions/:id',
    rbacVerifier,
    param('id').isInt({ min: 1 }).withMessage('Ungültige ID'),
    handleValidationErrors,
    async (req, res) => {
      try {
        if (req.user.role_name !== 'konfi') {
          return res.status(403).json({ error: 'Nur für Konfis' });
        }
        const submissionId = parseInt(req.params.id, 10);
        const { rows: [submission] } = await db.query(
          `SELECT id, challenge_id, file_path
           FROM challenge_submissions
           WHERE id = $1 AND user_id = $2 AND organization_id = $3`,
          [submissionId, req.user.id, req.user.organization_id]
        );
        if (!submission) {
          return res.status(404).json({ error: 'Beitrag nicht gefunden' });
        }

        await db.query('DELETE FROM challenge_submissions WHERE id = $1', [submissionId]);
        if (submission.file_path) {
          await deleteChallengeFile(submission.file_path);
        }

        res.json({ message: 'Beitrag gelöscht' });
        notifyJahrgaenge(submission.challenge_id, 'submission_update', { challengeId: submission.challenge_id });
      } catch (err) {
        console.error('Database error in DELETE /challenges/konfi/submissions/:id:', err);
        res.status(500).json({ error: 'Datenbankfehler' });
      }
    }
  );

  // ====================================================================
  // DATEI-AUSLIEFERUNG
  // ====================================================================
  //
  // Auth NUR per Authorization-Header. Alle Frontend-Abrufe laden per
  // axios-Blob mit Header; ein ?token=-Fallback (Chat-Pattern) waere hier
  // reine Angriffsflaeche — Tokens in Query-Strings landen in Access-Logs
  // und Referrern (Security-Review 04.08.2026).
  // Zugriff hat: die Leitung der Org, der Eigentuemer, sowie Konfis eines
  // zugewiesenen Jahrgangs, wenn der Beitrag oeffentlich ist.
  router.get('/files/:filename', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Kein Token vorhanden' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Ungültiger Token' });
    }

    try {
      const filename = path.basename(req.params.filename);
      if (!/^[a-f0-9]+$/.test(filename)) {
        return res.status(400).json({ error: 'Ungültiger Dateiname' });
      }

      // Der JWT traegt nur die Primaer-Org; die aktuelle Rolle und der Jahrgang
      // kommen frisch aus der DB (der Token koennte veraltet sein).
      const { rows: [requester] } = await db.query(
        `SELECT u.id, u.organization_id, r.name AS role_name, kp.jahrgang_id
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN konfi_profiles kp ON kp.user_id = u.id
         WHERE u.id = $1 AND u.deleted_at IS NULL`,
        [decoded.id]
      );
      if (!requester) {
        return res.status(401).json({ error: 'Nicht angemeldet' });
      }

      const { rows: [row] } = await db.query(
        `SELECT cs.id, cs.user_id, cs.file_name, cs.moderation_status, cs.konfi_consent,
                c.id AS challenge_id, c.visibility, c.organization_id
         FROM challenge_submissions cs
         JOIN challenges c ON cs.challenge_id = c.id
         WHERE cs.file_path = $1 AND cs.organization_id = $2`,
        [filename, requester.organization_id]
      );
      if (!row) {
        return res.status(404).json({ error: 'Datei nicht gefunden' });
      }

      const isOwner = row.user_id === requester.id;
      const isLeadership = ['org_admin', 'admin', 'teamer'].includes(requester.role_name);
      let mayAccess = isOwner || isLeadership;

      if (!mayAccess && requester.role_name === 'konfi') {
        // Konfi darf nur oeffentliche Beitraege aus seinem Jahrgang sehen.
        // row traegt sowohl Submission- als auch Challenge-Felder (ein JOIN),
        // die zentrale Logik bekommt beide Sichten explizit uebergeben.
        const submissionView = { moderation_status: row.moderation_status, konfi_consent: row.konfi_consent };
        const challengeView = { visibility: row.visibility };
        if (isSubmissionPublic(submissionView, challengeView) && requester.jahrgang_id) {
          const jahrgangIds = await challengeJahrgangIds(row.challenge_id);
          mayAccess = jahrgangIds.includes(requester.jahrgang_id);
        }
      }

      if (!mayAccess) {
        return res.status(403).json({ error: 'Zugriff verweigert' });
      }

      const filePath = path.join(challengeDir, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Datei nicht auf dem Server gefunden' });
      }

      if (row.file_name) {
        const ext = path.extname(row.file_name).toLowerCase();
        if (CONTENT_TYPES[ext]) {
          res.setHeader('Content-Type', CONTENT_TYPES[ext]);
        }
      }

      const fileBuffer = await fs.promises.readFile(filePath);
      let mediaBuffer;
      try {
        mediaBuffer = decryptBuffer(fileBuffer);
      } catch (decErr) {
        console.error('Error decrypting challenge file:', decErr);
        return res.status(500).json({ error: 'Datei konnte nicht entschlüsselt werden' });
      }
      res.send(mediaBuffer);
    } catch (error) {
      console.error('Error serving challenge file:', error);
      res.status(500).json({ error: 'Serverfehler' });
    }
  });

  // ====================================================================
  // LEITUNGS-ENDPUNKTE (org_admin / admin / teamer)
  // ====================================================================

  // GET /admin — alle Challenges der Org (inkl. Entwuerfe) mit Zaehlern.
  // Teamer sehen nur Challenges ihrer zugewiesenen Jahrgaenge.
  router.get('/admin', rbacVerifier, requireTeamer, async (req, res) => {
    try {
      const viewable = viewableJahrgangIds(req);
      const params = [req.user.organization_id];
      let jahrgangFilter = '';
      if (viewable !== null) {
        if (viewable.length === 0) {
          return res.json([]);
        }
        params.push(viewable);
        jahrgangFilter = `AND EXISTS (
          SELECT 1 FROM challenge_jahrgang_assignments cja2
          WHERE cja2.challenge_id = c.id AND cja2.jahrgang_id = ANY($2::int[])
        )`;
      }

      const { rows } = await db.query(
        `SELECT c.*,
                COALESCE(au.display_name, c.author_freetext) AS author_name,
                (SELECT COUNT(*) FROM challenge_submissions s WHERE s.challenge_id = c.id) AS submission_count,
                (SELECT COUNT(*) FROM challenge_submissions s WHERE s.challenge_id = c.id AND s.moderation_status = 'pending') AS pending_count,
                COALESCE(
                  (SELECT json_agg(json_build_object('id', j.id, 'name', j.name) ORDER BY j.name)
                   FROM challenge_jahrgang_assignments cja
                   JOIN jahrgaenge j ON cja.jahrgang_id = j.id
                   WHERE cja.challenge_id = c.id),
                  '[]'::json
                ) AS jahrgaenge
         FROM challenges c
         LEFT JOIN users au ON c.author_user_id = au.id
         WHERE c.organization_id = $1
         ${jahrgangFilter}
         ORDER BY c.starts_at DESC, c.id DESC`,
        params
      );

      const now = new Date();
      res.json(rows.map(row => ({
        ...row,
        allowed_media: parseAllowedMedia(row.allowed_media),
        submission_count: parseInt(row.submission_count, 10) || 0,
        pending_count: parseInt(row.pending_count, 10) || 0,
        status: deriveStatus(row, now),
        locked: hasStarted(row, now)
      })));
    } catch (err) {
      console.error('Database error in GET /challenges/admin:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // POST /admin — Challenge anlegen (Entwurf oder direkt geplant).
  router.post('/admin', rbacVerifier, requireTeamer, validateCreate, async (req, res) => {
    const client = await db.getClient();
    try {
      const {
        title, description, challenge_type, visibility, moderated, allowed_media,
        allow_multiple, badge_icon, badge_name, author_user_id, author_freetext,
        starts_at, ends_at, is_draft, jahrgang_ids
      } = req.body;

      if (new Date(ends_at) <= new Date(starts_at)) {
        return res.status(400).json({ error: 'Das Ende muss nach dem Start liegen.' });
      }

      const media = Array.isArray(allowed_media) && allowed_media.length > 0
        ? allowed_media
        : ['text', 'photo'];
      if (media.some(m => !MEDIA_TYPES.includes(m))) {
        return res.status(400).json({ error: 'Ungültige Medienart' });
      }

      // Org-Isolation: fremde Jahrgaenge/Urheber abweisen.
      if (jahrgang_ids && jahrgang_ids.length > 0) {
        if (!(await allIdsBelongToOrg(db, 'jahrgaenge', jahrgang_ids, req.user.organization_id))) {
          return res.status(403).json({ error: 'Ungültige Jahrgänge' });
        }
        // Teamer duerfen nur ihre eigenen Jahrgaenge bespielen.
        const viewable = viewableJahrgangIds(req);
        if (viewable !== null && !jahrgang_ids.every(id => viewable.includes(Number(id)))) {
          return res.status(403).json({ error: 'Kein Zugriff auf einen der gewählten Jahrgänge' });
        }
      }
      if (author_user_id) {
        const { rows: [author] } = await db.query(
          'SELECT id FROM users WHERE id = $1 AND organization_id = $2',
          [author_user_id, req.user.organization_id]
        );
        if (!author) {
          return res.status(400).json({ error: 'Urheber nicht gefunden' });
        }
      }

      await client.query('BEGIN');

      const { rows: [created] } = await client.query(
        `INSERT INTO challenges
           (organization_id, title, description, challenge_type, visibility, moderated,
            allowed_media, allow_multiple, badge_icon, badge_name, author_user_id,
            author_freetext, created_by, starts_at, ends_at, is_draft)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING *`,
        [
          req.user.organization_id,
          title,
          description,
          challenge_type || 'frei',
          visibility || 'konfi_choice',
          moderated !== undefined ? moderated : true,
          JSON.stringify(media),
          allow_multiple !== undefined ? allow_multiple : true,
          badge_icon || 'flag',
          badge_name,
          author_user_id || null,
          author_freetext || null,
          req.user.id,
          starts_at,
          ends_at,
          is_draft !== undefined ? is_draft : true
        ]
      );

      if (jahrgang_ids && jahrgang_ids.length > 0) {
        await client.query(
          `INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id)
           SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
          [created.id, jahrgang_ids]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        ...created,
        allowed_media: parseAllowedMedia(created.allowed_media),
        status: deriveStatus(created)
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Database error in POST /challenges/admin:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    } finally {
      client.release();
    }
  });

  // PUT /admin/:id — vor Start: alles. Nach Start nur noch
  // title/description/ends_at/badge_icon/badge_name; visibility, moderated,
  // starts_at und allowed_media sind eingefroren (Konsens-Integritaet).
  router.put('/admin/:id', rbacVerifier, requireTeamer, validateUpdate, async (req, res) => {
    const client = await db.getClient();
    try {
      const challengeId = parseInt(req.params.id, 10);
      const challenge = await loadChallenge(challengeId, req.user.organization_id);
      if (!challenge) {
        return res.status(404).json({ error: 'Challenge nicht gefunden' });
      }
      if (!(await leadershipMayAccess(req, challengeId))) {
        return res.status(403).json({ error: 'Kein Zugriff auf diese Challenge' });
      }

      const started = hasStarted(challenge);
      const {
        title, description, challenge_type, visibility, moderated, allowed_media,
        allow_multiple, badge_icon, badge_name, author_user_id, author_freetext,
        starts_at, ends_at, is_draft, jahrgang_ids
      } = req.body;

      if (started) {
        const lockedChanges = [];
        if (visibility !== undefined && visibility !== challenge.visibility) lockedChanges.push('Sichtbarkeit');
        if (moderated !== undefined && moderated !== challenge.moderated) lockedChanges.push('Moderation');
        if (starts_at !== undefined && new Date(starts_at).getTime() !== new Date(challenge.starts_at).getTime()) lockedChanges.push('Startzeitpunkt');
        if (allowed_media !== undefined
          && JSON.stringify(allowed_media) !== JSON.stringify(parseAllowedMedia(challenge.allowed_media))) {
          lockedChanges.push('erlaubte Medienarten');
        }
        if (lockedChanges.length > 0) {
          return res.status(409).json({
            error: `Nach dem Start der Challenge lässt sich Folgendes nicht mehr ändern: ${lockedChanges.join(', ')}. Die Konfis haben unter diesen Bedingungen eingereicht.`
          });
        }
      }

      const newStartsAt = started ? challenge.starts_at : (starts_at !== undefined ? starts_at : challenge.starts_at);
      const newEndsAt = ends_at !== undefined ? ends_at : challenge.ends_at;
      if (new Date(newEndsAt) <= new Date(newStartsAt)) {
        return res.status(400).json({ error: 'Das Ende muss nach dem Start liegen.' });
      }

      let media = parseAllowedMedia(challenge.allowed_media);
      if (!started && allowed_media !== undefined) {
        if (!Array.isArray(allowed_media) || allowed_media.length === 0 || allowed_media.some(m => !MEDIA_TYPES.includes(m))) {
          return res.status(400).json({ error: 'Ungültige Medienart' });
        }
        media = allowed_media;
      }

      if (jahrgang_ids !== undefined && jahrgang_ids.length > 0) {
        if (!(await allIdsBelongToOrg(db, 'jahrgaenge', jahrgang_ids, req.user.organization_id))) {
          return res.status(403).json({ error: 'Ungültige Jahrgänge' });
        }
        const viewable = viewableJahrgangIds(req);
        if (viewable !== null && !jahrgang_ids.every(id => viewable.includes(Number(id)))) {
          return res.status(403).json({ error: 'Kein Zugriff auf einen der gewählten Jahrgänge' });
        }
      }
      if (author_user_id) {
        const { rows: [author] } = await db.query(
          'SELECT id FROM users WHERE id = $1 AND organization_id = $2',
          [author_user_id, req.user.organization_id]
        );
        if (!author) {
          return res.status(400).json({ error: 'Urheber nicht gefunden' });
        }
      }

      await client.query('BEGIN');

      const { rows: [updated] } = await client.query(
        `UPDATE challenges SET
           title = $1,
           description = $2,
           challenge_type = $3,
           visibility = $4,
           moderated = $5,
           allowed_media = $6::jsonb,
           allow_multiple = $7,
           badge_icon = $8,
           badge_name = $9,
           author_user_id = $10,
           author_freetext = $11,
           starts_at = $12,
           ends_at = $13,
           is_draft = $14,
           updated_at = NOW()
         WHERE id = $15 AND organization_id = $16
         RETURNING *`,
        [
          title !== undefined ? title : challenge.title,
          description !== undefined ? description : challenge.description,
          !started && challenge_type !== undefined ? challenge_type : challenge.challenge_type,
          started ? challenge.visibility : (visibility !== undefined ? visibility : challenge.visibility),
          started ? challenge.moderated : (moderated !== undefined ? moderated : challenge.moderated),
          JSON.stringify(media),
          !started && allow_multiple !== undefined ? allow_multiple : challenge.allow_multiple,
          badge_icon !== undefined ? badge_icon : challenge.badge_icon,
          badge_name !== undefined ? badge_name : challenge.badge_name,
          author_user_id !== undefined ? (author_user_id || null) : challenge.author_user_id,
          author_freetext !== undefined ? (author_freetext || null) : challenge.author_freetext,
          newStartsAt,
          newEndsAt,
          started ? false : (is_draft !== undefined ? is_draft : challenge.is_draft),
          challengeId,
          req.user.organization_id
        ]
      );

      if (!started && jahrgang_ids !== undefined) {
        await client.query('DELETE FROM challenge_jahrgang_assignments WHERE challenge_id = $1', [challengeId]);
        if (jahrgang_ids.length > 0) {
          await client.query(
            `INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id)
             SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
            [challengeId, jahrgang_ids]
          );
        }
      }

      await client.query('COMMIT');

      res.json({
        ...updated,
        allowed_media: parseAllowedMedia(updated.allowed_media),
        status: deriveStatus(updated),
        locked: hasStarted(updated)
      });

      notifyJahrgaenge(challengeId, 'challenge_update', { challengeId });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Database error in PUT /challenges/admin/:id:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    } finally {
      client.release();
    }
  });

  // DELETE /admin/:id — Entwuerfe direkt; gestartete Challenges nur mit
  // ?force=true (loescht dann Beitraege inkl. Dateien mit).
  router.delete('/admin/:id',
    rbacVerifier,
    requireTeamer,
    param('id').isInt({ min: 1 }).withMessage('Ungültige ID'),
    query('force').optional().isIn(['true', 'false']).withMessage('Ungültiger force-Parameter'),
    handleValidationErrors,
    async (req, res) => {
      try {
        const challengeId = parseInt(req.params.id, 10);
        const challenge = await loadChallenge(challengeId, req.user.organization_id);
        if (!challenge) {
          return res.status(404).json({ error: 'Challenge nicht gefunden' });
        }
        if (!(await leadershipMayAccess(req, challengeId))) {
          return res.status(403).json({ error: 'Kein Zugriff auf diese Challenge' });
        }

        const force = req.query.force === 'true';
        if (hasStarted(challenge) && !force) {
          return res.status(409).json({
            error: 'Diese Challenge läuft bereits oder ist beendet. Beim Löschen gehen alle Beiträge der Konfis verloren — bitte ausdrücklich bestätigen.'
          });
        }

        // Dateien VOR dem DB-Delete einsammeln (danach sind die Zeilen weg).
        const { rows: files } = await db.query(
          'SELECT file_path FROM challenge_submissions WHERE challenge_id = $1 AND file_path IS NOT NULL',
          [challengeId]
        );

        await db.query('DELETE FROM challenges WHERE id = $1 AND organization_id = $2',
          [challengeId, req.user.organization_id]);

        for (const f of files) {
          await deleteChallengeFile(f.file_path);
        }

        res.json({ message: 'Challenge gelöscht' });
      } catch (err) {
        console.error('Database error in DELETE /challenges/admin/:id:', err);
        res.status(500).json({ error: 'Datenbankfehler' });
      }
    }
  );

  // GET /admin/:id/submissions — Sammelansicht fuer die Leitung: ALLE Beitraege
  // mit Konfi-Name, Konsens und Status (die Leitung sieht immer alles, auch
  // anonyme Beitraege mit Namen — Anonymitaet gilt gegenueber der Gruppe).
  router.get('/admin/:id/submissions',
    rbacVerifier,
    requireTeamer,
    param('id').isInt({ min: 1 }).withMessage('Ungültige ID'),
    handleValidationErrors,
    async (req, res) => {
      try {
        const challengeId = parseInt(req.params.id, 10);
        const challenge = await loadChallenge(challengeId, req.user.organization_id);
        if (!challenge) {
          return res.status(404).json({ error: 'Challenge nicht gefunden' });
        }
        if (!(await leadershipMayAccess(req, challengeId))) {
          return res.status(403).json({ error: 'Kein Zugriff auf diese Challenge' });
        }

        const { rows } = await db.query(
          `SELECT cs.id, cs.user_id, cs.media_type, cs.text_content, cs.file_path,
                  cs.file_name, cs.link_url, cs.konfi_consent, cs.moderation_status,
                  cs.hidden_at, cs.created_at,
                  u.display_name,
                  j.name AS jahrgang_name
           FROM challenge_submissions cs
           JOIN users u ON cs.user_id = u.id
           LEFT JOIN konfi_profiles kp ON kp.user_id = u.id
           LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
           WHERE cs.challenge_id = $1
           ORDER BY cs.created_at DESC`,
          [challengeId]
        );

        res.json({
          challenge: {
            ...challenge,
            allowed_media: parseAllowedMedia(challenge.allowed_media),
            status: deriveStatus(challenge),
            locked: hasStarted(challenge)
          },
          submissions: rows.map(row => ({
            ...row,
            // Fuer die Leitung transparent machen, ob dieser Beitrag in der
            // Gruppen-Galerie mit oder ohne Namen erscheint.
            is_public: isSubmissionPublic(row, challenge),
            is_anonymous: isAnonymous(row, challenge)
          }))
        });
      } catch (err) {
        console.error('Database error in GET /challenges/admin/:id/submissions:', err);
        res.status(500).json({ error: 'Datenbankfehler' });
      }
    }
  );

  // PUT /admin/submissions/:id/moderate — { action: 'approve'|'hide'|'unhide' }.
  // Ausblenden geht IMMER, auch bei visibility='public' — hidden schlaegt alles.
  router.put('/admin/submissions/:id/moderate',
    rbacVerifier,
    requireTeamer,
    validateModerate,
    async (req, res) => {
      try {
        const submissionId = parseInt(req.params.id, 10);
        const { action } = req.body;

        const { rows: [submission] } = await db.query(
          `SELECT cs.id, cs.challenge_id, cs.moderation_status
           FROM challenge_submissions cs
           WHERE cs.id = $1 AND cs.organization_id = $2`,
          [submissionId, req.user.organization_id]
        );
        if (!submission) {
          return res.status(404).json({ error: 'Beitrag nicht gefunden' });
        }
        if (!(await leadershipMayAccess(req, submission.challenge_id))) {
          return res.status(403).json({ error: 'Kein Zugriff auf diesen Beitrag' });
        }

        let updated;
        if (action === 'hide') {
          ({ rows: [updated] } = await db.query(
            `UPDATE challenge_submissions
             SET moderation_status = 'hidden', hidden_by = $2, hidden_at = NOW()
             WHERE id = $1 RETURNING id, moderation_status`,
            [submissionId, req.user.id]
          ));
        } else {
          // approve und unhide fuehren beide zu 'approved' und raeumen die
          // hidden-Metadaten ab (ein wieder eingeblendeter Beitrag ist freigegeben).
          ({ rows: [updated] } = await db.query(
            `UPDATE challenge_submissions
             SET moderation_status = 'approved', hidden_by = NULL, hidden_at = NULL
             WHERE id = $1 RETURNING id, moderation_status`,
            [submissionId]
          ));
        }

        res.json(updated);
        notifyJahrgaenge(submission.challenge_id, 'submission_update', { challengeId: submission.challenge_id });
      } catch (err) {
        console.error('Database error in PUT /challenges/admin/submissions/:id/moderate:', err);
        res.status(500).json({ error: 'Datenbankfehler' });
      }
    }
  );

  // GET /admin/:id/export — text/plain mit allen Texten und Links, damit die
  // Leitung daraus eine Liturgie, eine Playlist oder eine Wand bauen kann.
  // Anonyme Beitraege erscheinen ohne Namen.
  router.get('/admin/:id/export',
    rbacVerifier,
    requireTeamer,
    param('id').isInt({ min: 1 }).withMessage('Ungültige ID'),
    handleValidationErrors,
    async (req, res) => {
      try {
        const challengeId = parseInt(req.params.id, 10);
        const challenge = await loadChallenge(challengeId, req.user.organization_id);
        if (!challenge) {
          return res.status(404).json({ error: 'Challenge nicht gefunden' });
        }
        if (!(await leadershipMayAccess(req, challengeId))) {
          return res.status(403).json({ error: 'Kein Zugriff auf diese Challenge' });
        }

        // Export verlaesst typischerweise die Leitungssphaere (Liturgie-Blatt,
        // Playlist, Wand) — deshalb strenger als die Sammelansicht:
        // - konfi_choice: NUR freigegebene Beitraege mit Veroeffentlichungs-
        //   Konsens. "Nur fuer die Leitung" (private) ist die staerkste Zusage
        //   des Konfi und landet NIE im Export (Security-Review 04.08.2026).
        // - public: nur freigegebene Beitraege (pending bleibt draussen).
        // - private Challenge: alle nicht-ausgeblendeten — hier IST der Export
        //   der in der Beschreibung angekuendigte Rueckkanal (z.B. Fuerbitten).
        const { rows } = await db.query(
          `SELECT cs.media_type, cs.text_content, cs.link_url, cs.file_name,
                  cs.konfi_consent, cs.moderation_status, cs.created_at,
                  u.display_name
           FROM challenge_submissions cs
           JOIN users u ON cs.user_id = u.id
           WHERE cs.challenge_id = $1
             AND cs.moderation_status <> 'hidden'
             AND (
               $2 = 'private'
               OR (cs.moderation_status = 'approved'
                   AND ($2 = 'public' OR cs.konfi_consent IN ('publish', 'anonymous')))
             )
           ORDER BY cs.created_at ASC`,
          [challengeId, challenge.visibility]
        );

        const lines = [];
        lines.push(challenge.title);
        lines.push('='.repeat(challenge.title.length));
        lines.push('');
        if (challenge.author_name) {
          lines.push(`Gestellt von: ${challenge.author_name}`);
          lines.push('');
        }
        lines.push(challenge.description);
        lines.push('');
        lines.push(`Beiträge: ${rows.length}`);
        lines.push('');

        for (const row of rows) {
          const anonymous = isAnonymous(row, challenge);
          const name = anonymous ? 'Anonym' : row.display_name;
          const datum = new Date(row.created_at).toLocaleDateString('de-DE');
          lines.push(`--- ${name} (${datum}) ---`);
          if (row.text_content) {
            lines.push(row.text_content);
          }
          if (row.link_url) {
            lines.push(row.link_url);
          }
          if (!row.text_content && !row.link_url && row.file_name) {
            lines.push(`[${row.media_type}: ${row.file_name}]`);
          }
          lines.push('');
        }

        const filenameSafe = challenge.title.replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, '').trim() || 'challenge';
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filenameSafe)}.txt"`);
        res.send(lines.join('\n'));
      } catch (err) {
        console.error('Database error in GET /challenges/admin/:id/export:', err);
        res.status(500).json({ error: 'Datenbankfehler' });
      }
    }
  );

  return router;
};

// Sichtbarkeitslogik auch fuer Tests und andere Module exportierbar machen,
// ohne dass jemand sie nachbaut.
module.exports.PUBLIC_SUBMISSION_SQL = PUBLIC_SUBMISSION_SQL;
module.exports.isSubmissionPublic = isSubmissionPublic;
module.exports.isAnonymous = isAnonymous;
module.exports.deriveStatus = deriveStatus;
module.exports.hasStarted = hasStarted;
