// Anzeigenamen der Rollen in Texten, die der Server selbst formuliert
// (Einladung per Push und E-Mail, "Einladung angenommen", Rollenangabe in den
// Chat-Kontaktlisten).
//
// Simon, 28.09.2026: Die Rolle `admin` heisst "Leitung", `org_admin`
// "Org-Leitung" -- auch Ehrenamtliche haben diese Rollen. In der Datenbank
// stehen bei den bestehenden Gemeinden weiter die alten display_name-Werte
// ("Hauptamt", "Organisations-Admin"); die werden bewusst nicht migriert
// ("Alte Orga fassen wir nicht an"). Deshalb gilt fuer die bekannten Rollen
// das feste Wort nach dem technischen Namen, nicht der display_name.
//
// Gegenstueck in der App: frontend/src/utils/rollenNamen.ts (dieselben Woerter).

const ROLLEN_NAMEN = Object.freeze({
  org_admin: 'Org-Leitung',
  admin: 'Leitung',
  teamer: 'Teamer:in'
});

/**
 * @param {string|null|undefined} name         technischer Rollenname (roles.name)
 * @param {string|null|undefined} displayName  roles.display_name als Rueckfall
 * @returns {string}
 */
const rollenAnzeigename = (name, displayName) =>
  (name && ROLLEN_NAMEN[name]) || displayName || name || '';

module.exports = { ROLLEN_NAMEN, rollenAnzeigename };
