/**
 * Anzeigenamen der Rollen in der Oberfläche -- an EINER Stelle.
 *
 * Simon, 28.09.2026: Die Rolle `admin` heißt „Leitung", die Rolle
 * `org_admin` „Org-Leitung". „Hauptamt" (so steht `admin` als display_name in
 * der Datenbank der bestehenden Gemeinden) war falsch -- auch Ehrenamtliche
 * haben diese Rolle. Vorher trug jede Ansicht ihr eigenes Wort ein
 * (Benutzerliste, Benutzer anlegen, Einladen, offene Einladungen,
 * Jahrgangs-Zuweisung, Gemeinde-Verwaltung, Chat-Mitglieder) -- dieselbe
 * Rolle hieß mal „Admin", mal „Hauptamt", mal „Organisations-Admin".
 *
 * Die Anzeige geht nach dem technischen Rollennamen, NICHT nach
 * role_display_name aus der Datenbank: Bestehende Gemeinden behalten dort ihre
 * alten Werte („Hauptamt", „Organisations-Admin"), die werden nicht migriert.
 */

export const ROLLEN_NAMEN: Readonly<Record<string, string>> = {
  org_admin: 'Org-Leitung',
  admin: 'Leitung',
  teamer: 'Teamer:in',
};

/**
 * Anzeigename einer Rolle nach ihrem technischen Namen. Unbekannte Namen
 * kommen unverändert zurück (oder der Rückfall, falls angegeben).
 */
export const rollenName = (name?: string | null, rueckfall?: string): string => {
  if (name && ROLLEN_NAMEN[name]) return ROLLEN_NAMEN[name];
  return rueckfall ?? name ?? '';
};
