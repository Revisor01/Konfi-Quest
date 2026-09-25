// Postfach oeffnen — von ueberall, ohne Router und ohne Context.
//
// Die Glocke steht in JEDER Kopfzeile (AppKopfzeile), das Postfach selbst
// haengt aber nur EINMAL auf App-Ebene (common/PostfachModal). Wuerde jede
// Seite ihr eigenes Modal mitbringen, laegen bei sechs Konfi-Seiten sechs
// Modale im Speicher — der IonRouterOutlet haelt Seiten gemountet — und jede
// muesste ihre Liste selbst laden. Stattdessen sagt die Glocke nur "auf",
// und das eine Postfach hoert zu. Dasselbe Muster wie pushZielMelden in
// utils/pushNavigation: ein Fenster-Ereignis, kein Zirkelbezug.

export const POSTFACH_OEFFNEN_EVENT = 'postfach:oeffnen';

/** Das Postfach oeffnen. Wirkt von jeder Seite aus. */
export const oeffnePostfach = (): void => {
  window.dispatchEvent(new CustomEvent(POSTFACH_OEFFNEN_EVENT));
};

/**
 * Mitteilung aus GET /notifications/postfach — die Zeile der Tabelle
 * notifications, dazu der Name der Gemeinde, aus der sie stammt.
 */
export interface PostfachEintrag {
  id: number;
  title: string;
  message: string;
  type: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  organization_id: number | null;
  organization_name: string | null;
}

export interface PostfachAntwort {
  eintraege: PostfachEintrag[];
  /** Ungelesen insgesamt — ueber alle Gemeinden, unabhaengig von der Seite. */
  ungelesen: number;
  /** Gibt es aeltere Eintraege als die gelieferten? */
  weitere: boolean;
}

/**
 * Wann eine Mitteilung ankam, so wie man es einer Freundin sagen wuerde:
 * "gerade eben", "vor 5 Min.", "vor 3 Std.", "gestern", sonst das Datum.
 * Ohne Bibliothek — die App hat keine dafuer, und mehr als diese fuenf
 * Stufen braucht ein Postfach nicht.
 */
export const zeitpunktText = (iso: string, jetzt: Date = new Date()): string => {
  const dann = new Date(iso);
  if (Number.isNaN(dann.getTime())) return '';
  const sekunden = Math.max(0, Math.round((jetzt.getTime() - dann.getTime()) / 1000));
  if (sekunden < 60) return 'gerade eben';
  const minuten = Math.floor(sekunden / 60);
  if (minuten < 60) return `vor ${minuten} Min.`;
  const stunden = Math.floor(minuten / 60);
  if (stunden < 24) return `vor ${stunden} Std.`;
  const gestern = new Date(jetzt);
  gestern.setDate(gestern.getDate() - 1);
  if (dann.toDateString() === gestern.toDateString()) return 'gestern';
  return dann.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
