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

/**
 * Farbe einer Rolle -- ebenfalls an EINER Stelle (29.09.2026).
 *
 * Simon, TestFlight 233: "Es braucht noch eine dritte Farbe. Es gibt die
 * Org-Admins, die Admins und die Teamer. Die Admins brauchen eine andere
 * Farbe, damit es leichter erkennbar ist." Bis dahin trugen Org-Leitung und
 * Leitung dasselbe Indigo, und jede Ansicht rechnete die Farbe selbst aus
 * (Benutzerliste, Benutzer anlegen, Einladen, offene Einladungen) -- viermal
 * dieselbe switch-Anweisung.
 *
 * Der Wert ist der Name des Farb-Tokens ohne Praefix: `--app-color-<wert>`
 * fuer Flaechen (Rahmen, Symbolkreis, Eck-Marke), `--app-text-<wert>` fuer
 * Schrift und Symbole auf der Karte (im Dunkeln aufgehellt). Unbekannte
 * Rollen: neutral.
 */
export type RollenFarbe = 'users' | 'leitung' | 'teamer' | 'konfis' | 'neutral';

export const ROLLEN_FARBEN: Readonly<Record<string, RollenFarbe>> = {
  org_admin: 'users',
  admin: 'leitung',
  teamer: 'teamer',
  konfi: 'konfis',
};

/**
 * `rueckfall` gilt fuer Eintraege ohne bekannten Rollennamen -- etwa im Chat,
 * wo ein aelterer Server fuer Team-Mitglieder nur den Typ liefert: Dort
 * bleibt es bei der Team-Farbe wie bisher.
 */
export const rollenFarbe = (name?: string | null, rueckfall: RollenFarbe = 'neutral'): RollenFarbe =>
  (name && ROLLEN_FARBEN[name]) || rueckfall;

/** Flaechenfarbe der Rolle: Rahmen, Symbolkreis, Eck-Marke. */
export const rollenFarbeVar = (name?: string | null, rueckfall?: RollenFarbe): string =>
  `var(--app-color-${rollenFarbe(name, rueckfall)})`;

/** Zarter Grund in der Rollenfarbe (ausgewaehlte Karte). */
export const rollenTonVar = (name?: string | null, deckkraft = 0.08): string =>
  `rgba(var(--app-color-${rollenFarbe(name)}-rgb), ${deckkraft})`;

/** Schrift- und Symbolfarbe der Rolle auf der Karte (im Dunkeln lesbar). */
export const rollenTextFarbeVar = (name?: string | null, rueckfall?: RollenFarbe): string => {
  const farbe = rollenFarbe(name, rueckfall);
  return farbe === 'neutral' ? 'var(--app-text-system)' : `var(--app-text-${farbe})`;
};
