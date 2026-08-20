// Darstellung eingereichter Links (Challenge-Beitraege).
//
// Die volle URL als Beschriftung sprengt auf dem Telefon mehrere Zeilen —
// eine YouTube- oder Spotify-Adresse mit Parametern ist schnell 80 Zeichen lang
// und wurde bisher per word-break mitten im Wort umgebrochen. Stattdessen wird
// die Domain gezeigt; die vollstaendige Adresse bleibt im href und im title.

/** Hostname als lesbare Beschriftung, ohne fuehrendes "www.". */
export const hostAus = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/**
 * Nur http/https durchlassen. Die URL stammt aus einer fremden Einreichung —
 * ein praepariertes javascript:-Schema darf nie in ein href geraten.
 */
export const istWebLink = (url?: string | null): boolean =>
  !!url && /^https?:\/\//i.test(url);
