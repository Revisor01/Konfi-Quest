const { validationResult, body, param, query } = require('express-validator');

/**
 * Middleware: Prueft express-validator Ergebnisse und gibt 400 zurueck bei Fehlern.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validierungsfehler',
      details: errors.array().map(e => ({
        field: e.path,
        message: e.msg
      }))
    });
  }
  next();
};

/**
 * Whitelist-validierter Spaltennamen-Resolver fuer Punktetypen.
 * Verhindert SQL-Injection ueber dynamische Spaltennamen in Template Literals.
 */
const VALID_POINT_FIELDS = {
  gottesdienst: 'gottesdienst_points',
  gemeinde: 'gemeinde_points'
};

function getPointField(type) {
  const field = VALID_POINT_FIELDS[type];
  if (!field) {
    throw new Error('Ungueltiger Punktetyp');
  }
  return field;
}

// Wiederverwendbar: ID-Parameter validieren
const validateId = param('id').isInt({ min: 1 }).withMessage('Ungültige ID');

// Wiederverwendbar: Pagination-Parameter
const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Seitenzahl muss positiv sein'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit muss zwischen 1 und 100 liegen')
];

// Gemeinsame Validierungen fuer haeufige Felder
const commonValidations = {
  name: body('name').trim().notEmpty().withMessage('Name ist erforderlich')
    .isLength({ min: 2, max: 100 }).withMessage('Name muss zwischen 2 und 100 Zeichen lang sein'),
  description: body('description').optional().trim()
    .isLength({ max: 500 }).withMessage('Beschreibung darf maximal 500 Zeichen lang sein'),
  points: body('points').isInt({ min: 1 }).withMessage('Punkte müssen eine positive Ganzzahl sein'),
  type: body('type').isIn(['gottesdienst', 'gemeinde']).withMessage('Typ muss "gottesdienst" oder "gemeinde" sein'),
  email: body('email').trim().isEmail().withMessage('Gültige E-Mail-Adresse erforderlich'),
  username: body('username').trim()
    .isLength({ min: 3, max: 50 }).withMessage('Benutzername muss zwischen 3 und 50 Zeichen lang sein')
    .matches(/^[a-zA-Z0-9._-]+$/).withMessage('Benutzername darf nur Buchstaben, Zahlen, Punkte, Bindestriche und Unterstriche enthalten'),
  password: body('password')
    .isLength({ min: 6 }).withMessage('Passwort muss mindestens 6 Zeichen lang sein'),
  date: body('completed_date').optional().isISO8601().withMessage('Ungültiges Datumsformat'),
};

module.exports = {
  handleValidationErrors,
  getPointField,
  validateId,
  validatePagination,
  commonValidations
};
