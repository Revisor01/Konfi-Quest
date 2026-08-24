// Darstellung eingereichter Links (Challenge-Beitraege).
//
// Die volle URL als Beschriftung sprengt auf dem Telefon mehrere Zeilen —
// eine YouTube- oder Spotify-Adresse mit Parametern ist schnell 80 Zeichen lang
// und wurde bisher per word-break mitten im Wort umgebrochen. Stattdessen wird
// die Domain gezeigt; die vollstaendige Adresse bleibt im href und im title.

import { dienstNameAus } from './musikLinks';

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
 * Bewusst NICHT auf die Musikdienst-Erlaubnisliste verengt: Alt-Beitraege
 * aus der Zeit vor der Liste waren regelkonform und sollen anklickbar bleiben.
 */
export const istWebLink = (url?: string | null): boolean =>
  !!url && /^https?:\/\//i.test(url);

/**
 * Beschriftung fuer einen Link-Beitrag: mit gespeicherten Metadaten
 * "Titel · Interpret · Dienst", ohne (Alt-Beitraege, fehlgeschlagener
 * Abruf) wie bisher die Domain. Cover werden bewusst nie geladen.
 */
export const linkBeschriftung = (link: {
  link_url?: string | null;
  link_title?: string | null;
  link_author?: string | null;
}): string => {
  const teile = [link.link_title, link.link_author].filter(
    (t): t is string => !!t && !!t.trim()
  );
  if (teile.length > 0) {
    const dienst = dienstNameAus(link.link_url);
    if (dienst) teile.push(dienst);
    return teile.join(' · ');
  }
  return link.link_url ? hostAus(link.link_url) : '';
};
