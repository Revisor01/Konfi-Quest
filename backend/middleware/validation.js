const { validationResult } = require('express-validator');

/**
 * Middleware: Prueft express-validator Ergebnisse und gibt 400 zurueck bei Fehlern.
 * Wird in Plan 01-03 mit express-validator Chains verwendet.
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

module.exports = { handleValidationErrors, getPointField };
