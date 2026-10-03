import { ICON_CHALLENGE, ICON_JAHRGANG, ICON_OFFLINE, ICON_WARNUNG } from './icons';

// Die Worte der Seite einer Challenge, solange sie keine Challenge zeigen
// kann (ChallengeHinweis in der App, WebChallengeHinweis im Browser): fuer
// Konfis, Team und Leitung gleich. Eigene Datei, damit die App-Ansicht und
// die Web-Fassung dieselben Texte lesen, ohne sich gegenseitig zu importieren.

export type ChallengeHinweisArt =
  /** Laedt noch. */
  | 'laedt'
  /** 404: geloescht, fremde Gemeinde, (fuer Konfis) noch nicht gestartet. */
  | 'weg'
  /** 403 bei Konfis: gehoert zu einem anderen Jahrgang. */
  | 'nichtFuerDich'
  /** 403 bei Team und Leitung: kein zugewiesener Jahrgang der Challenge. */
  | 'jahrgang'
  /** Ohne Netz und ohne gespeicherten Stand. */
  | 'offline'
  /** Unerwarteter Serverfehler. */
  | 'fehler';

export const HINWEIS_TEXTE: Record<Exclude<ChallengeHinweisArt, 'laedt'>, { icon: string; titel: string; text: string }> = {
  weg: {
    icon: ICON_CHALLENGE,
    titel: 'Diese Challenge gibt es nicht mehr',
    text: 'Sie wurde wohl gelöscht. Alle übrigen Challenges findest du in der Liste.',
  },
  nichtFuerDich: {
    icon: ICON_JAHRGANG,
    titel: 'Diese Challenge ist nicht für dich',
    text: 'Sie gehört zu einem anderen Jahrgang. Deine Challenges findest du in der Liste.',
  },
  // Wortgleich mit dem Termin (admin/views/EventDetailView, jahrgangFehlt):
  // derselbe Grund, dieselben Worte.
  jahrgang: {
    icon: ICON_JAHRGANG,
    titel: 'Nicht deinem Jahrgang zugeordnet',
    text: 'Diese Challenge gehört zu einem Jahrgang, dem du nicht zugewiesen bist. Die Leitung deiner Gemeinde kann das in den Einstellungen ändern.',
  },
  offline: {
    icon: ICON_OFFLINE,
    titel: 'Keine Verbindung',
    text: 'Diese Challenge wurde noch nicht geladen — dafür brauchst du eine Verbindung.',
  },
  fehler: {
    icon: ICON_WARNUNG,
    titel: 'Die Challenge ließ sich nicht laden',
    text: 'Versuch es gleich noch einmal.',
  },
};

