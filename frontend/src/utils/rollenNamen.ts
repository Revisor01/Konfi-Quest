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
  org_admin: 'Gemeindeleitung',
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
 * Selbstbezeichnung unter dem Namen (Simon, 01.10.2026): „Da soll die
 * Selbstbezeichnung stehen, die man sich geben kann." Das ist
 * `users.role_title`, im eigenen Profil unter „Funktionsbeschreibung"
 * gesetzt. Getrimmt; leer oder nur Leerzeichen gilt als nicht gesetzt, dann
 * steht der Rueckfall (im Teamer-Profil „Teamer:in" wie auf der Startseite).
 */
export const selbstbezeichnung = (roleTitle?: string | null, rueckfall = ''): string =>
  roleTitle?.trim() || rueckfall;

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

/**
 * Wie eine PERSON in einer Liste aussieht -- Strich links, Symbolkreis,
 * Eck-Marke und Schrift aus EINER Stelle (02.10.2026, Paket 2.4.0, Punkt 6).
 *
 * Simon, 02.10.2026: "wir haben die farbe für leitung von der für teamer
 * getrennt, das muss aber in alle listen und überall berücksichtigt werden.
 * aktuell ist es in der chat mitglieder liste nur im corner badge, nicht vorne
 * beim strich und kreis". Bis dahin faerbte rollenFarbeVar dort nur die
 * Eck-Marke; Strich und Kreis trugen app-list-item--team /
 * app-icon-circle--team -- die allgemeine Team-Farbe (Beere) auch fuer jede
 * Leitung.
 *
 * Die Werte sind CSS-Klassen (theme/variables.css), keine Farbwerte: Die
 * Klassen lesen die Tokens --app-color-<farbe> (Flaeche) und
 * --app-text-<farbe> (Schrift, im Dunkeln aufgehellt). Die Auswahl bekommt
 * ihren zarten Grund ueber `app-list-item--selected` zusammen mit `strich`.
 */
export interface RollenDarstellung {
  /** Die Rollenfarbe (Token-Name ohne Praefix). */
  farbe: RollenFarbe;
  /** Strich links an der Karte (`app-list-item--…`). */
  strich: string;
  /** Symbolkreis (`app-icon-circle--…`). */
  kreis: string;
  /** Eck-Marke (`app-corner-badge--…`). */
  marke: string;
  /** Schrift und kleine Symbole auf der Karte (`app-rollen-schrift--…`). */
  schrift: string;
}

const DARSTELLUNG: Readonly<Record<RollenFarbe, Omit<RollenDarstellung, 'farbe'>>> = {
  users: {
    strich: 'app-list-item--users',
    kreis: 'app-icon-circle--users',
    marke: 'app-corner-badge--users',
    schrift: 'app-rollen-schrift--users',
  },
  leitung: {
    strich: 'app-list-item--leitung',
    kreis: 'app-icon-circle--leitung',
    marke: 'app-corner-badge--leitung',
    schrift: 'app-rollen-schrift--leitung',
  },
  teamer: {
    strich: 'app-list-item--teamer',
    kreis: 'app-icon-circle--teamer',
    marke: 'app-corner-badge--teamer',
    schrift: 'app-rollen-schrift--teamer',
  },
  // Die Konfi-Klassen heissen seit jeher --konfi (Einzahl); Farbe wie bisher.
  konfis: {
    strich: 'app-list-item--konfi',
    kreis: 'app-icon-circle--konfi',
    marke: 'app-corner-badge--konfi',
    schrift: 'app-rollen-schrift--konfis',
  },
  neutral: {
    strich: 'app-list-item--neutral',
    kreis: 'app-icon-circle--neutral',
    marke: 'app-corner-badge--neutral',
    schrift: 'app-rollen-schrift--neutral',
  },
};

/** Was eine Liste ueber eine Person weiss. */
export interface PersonMitRolle {
  /** Rolle in der aktiven Gemeinde -- die eigentliche Quelle. */
  role_name?: string | null;
  /** Typ im Chat (chat_participants.user_type). */
  user_type?: string | null;
  /** Typ in den Auswahllisten des Chats (ChatUser.type). */
  type?: string | null;
}

/**
 * Rueckfall NUR fuer Antworten ohne Rolle: der Typ. `admin` steht im Chat
 * fuer Leitung UND Gemeindeleitung; ohne Rolle laesst sich das nicht trennen,
 * die Leitung ist die haeufigere. Die Beere fuer jede Leitung (der Rueckfall
 * bis 02.10.2026) war in jedem Fall falsch.
 */
const FARBE_NACH_TYP: Readonly<Record<string, RollenFarbe>> = {
  konfi: 'konfis',
  teamer: 'teamer',
  admin: 'leitung',
};

/** Die Rollenfarbe einer Person: nach der Rolle, ohne Rolle nach dem Typ. */
export const personFarbe = (person: PersonMitRolle): RollenFarbe => {
  if (person.role_name) return rollenFarbe(person.role_name);
  const typ = person.user_type ?? person.type;
  return (typ && FARBE_NACH_TYP[typ]) || 'neutral';
};

/**
 * Strich, Kreis, Eck-Marke und Schrift fuer eine Person -- oder direkt fuer
 * einen Rollennamen (Listen, die nur eine Rolle zeigen, etwa die
 * Gemeindeleitung einer Gemeinde).
 */
export const rollenDarstellung = (person: PersonMitRolle | string | null | undefined): RollenDarstellung => {
  const farbe = person == null || typeof person === 'string'
    ? rollenFarbe(person)
    : personFarbe(person);
  return { farbe, ...DARSTELLUNG[farbe] };
};
