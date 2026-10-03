import { useBadge } from '../contexts/BadgeContext';
import type { BadgeKey } from './routes';
import { supportMailZahl, useSupportMailZaehler } from './supportMailZaehler';

/**
 * Die Zahlen an den Reitern, je Zaehler-Schluessel aus rollenBaeume.ts.
 *
 * EINE Stelle fuer die Reiterleiste unten (MainTabs) und die Leiste links
 * der Web-Version (Seitenleiste, 03.10.2026): Beide zeigen dieselbe Zahl,
 * weil beide diese Funktion rufen -- nicht, weil zwei Abschriften zufaellig
 * gleich rechnen. Bis zum 03.10.2026 stand die Rechnung in MainTabs.tsx.
 *
 * Alle fuenf Zahlen an den Reitern kommen aus EINER Quelle: dem BadgeContext,
 * gespeist aus GET /notifications/badge-counts. Aktualisiert werden sie
 * gemeinsam mit refreshAllCounts().
 *
 * Bis 27.08.2026 war newBadgesCount die Ausnahme: eigener State, eigener
 * Abruf, nur ueber useLiveRefresh('badges') aktualisierbar. Wer nach einer
 * Aktion refreshAllCounts() rief -- das Naheliegende --, bewirkte nichts.
 * Genau daran krankte der Konfi-Zaehler seit dem 03.07.2026 unbemerkt
 * (Befund B1): mark-seen setzte 'seen', aber niemand stiess eine
 * Aktualisierung an, und die rote Zahl blieb die ganze Sitzung stehen.
 *
 * Die zwei Zahlen der Support-Ansicht (03.10.2026) kommen aus
 * navigation/supportMailZaehler.ts. Abgerufen werden sie nur, wo die Leiste
 * sie zeigt (`supportMailLaden`, Seitenleiste im Baum super_admin und in
 * Simons Konto, dem die Leiste die Support-Gruppen anhaengt) -- die
 * Reiterleiste der Apps fragt nie.
 */
export const useReiterZaehler = ({ supportMailLaden = false }: { supportMailLaden?: boolean } = {}): Record<BadgeKey, number> => {
  const { chatUnreadTotal, pendingRequestsCount, pendingEventsCount, pendingChallengesCount, challengeUpdatesTotal, newBadgesCount } = useBadge();
  const mail = useSupportMailZaehler(supportMailLaden);
  return {
    chat: chatUnreadTotal,
    events: pendingEventsCount + pendingRequestsCount,
    // Ein Reiter, eine Bedeutung je Rolle: Team und Leitung zaehlen offene
    // Freigaben, Konfis ihre Challenge-Neuigkeiten (24.09.2026). Der Server
    // liefert je Rolle nur den einen Anteil, der andere ist 0 -- die Summe
    // ist also nie eine Mischung.
    challenges: pendingChallengesCount + challengeUpdatesTotal,
    badges: newBadgesCount,
    // Ungelesene Mails der Support-Ansicht; die Rechnung steht in
    // supportMailZahl, damit Leiste und Uebersicht dieselbe Zahl zeigen.
    supportAnfragen: supportMailZahl(mail, 'supportAnfragen'),
    supportPost: supportMailZahl(mail, 'supportPost'),
  };
};

/** Die Zahl am Reiter: ab zehn „9+", damit der Kreis klein bleibt. */
export const zaehlerText = (n: number): string => (n > 9 ? '9+' : String(n));
