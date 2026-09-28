import type { KonfiChallenge, ChallengeConsent } from '../types/challenges';

// Textbausteine rund um Challenges — als pure Funktionen, damit Einzahl/Mehrzahl
// und die Sichtbarkeits-Sätze testbar sind, ohne die Ionic-Modale zu rendern.

/** "1 Beitrag" / "5 Beiträge" — nie "1 Beiträge" (User-Hinweis 24.08.2026). */
export const anzahlBeitraege = (n: number): string =>
  n === 1 ? '1 Beitrag' : `${n} Beiträge`;

/** Tooltip/aria-Text für das Zähler-Badge in der Moderationsliste. */
export const wartenAufFreigabe = (n: number): string =>
  n === 1 ? '1 Beitrag wartet auf Freigabe' : `${n} Beiträge warten auf Freigabe`;

/** Vorlesetext der orangen Zahl im Reiter-Knopf, ohne fuehrende Zahl: "wartet auf Freigabe" / "warten auf Freigabe". */
export const wartenAufFreigabeKurz = (n: number): string =>
  n === 1 ? 'wartet auf Freigabe' : 'warten auf Freigabe';

/**
 * Vorlesetext der roten Kugel am Challenge-Eintrag der Leitung (ohne die
 * fuehrende Zahl -- die setzt ZaehlerKugel davor). Die Kugel zaehlt seit
 * 28.09.2026 wartende Freigaben PLUS neue Beitraege; der Text nennt beides,
 * damit niemand die Summe fuer "5 neue Beitraege" haelt.
 *   (0, 3) -> "neue Beiträge"                       => "3 neue Beiträge"
 *   (1, 0) -> "offen: 1 Beitrag wartet auf Freigabe" => "1 offen: ..."
 *   (2, 3) -> "offen: 2 Beiträge warten auf Freigabe, 3 neue Beiträge"
 */
export const kugelTextAmEintrag = (pending: number, neu: number): string => {
  if (!(pending > 0)) return 'neue Beiträge';
  const teile = [wartenAufFreigabe(pending)];
  if (neu > 0) teile.push(`${neu} neue Beiträge`);
  return `offen: ${teile.join(', ')}`;
};

type SichtbarkeitsRelevant = Pick<KonfiChallenge, 'visibility' | 'moderated'>;

/**
 * Behandlungs-Info für den Kopf des Einreich-Modals: EIN knapper Satz, der in
 * jeder Sichtbarkeits-Konstellation sagt, wer den Beitrag sieht — auch wenn der
 * Konfi nichts einstellen kann (User-Vorgabe). Steht seit 24.08.2026 als
 * Untertitel direkt in der Kopf-Überschrift statt in einem eigenen
 * Hinweis-Kasten.
 */
export const getVisibilityInfo = (challenge: SichtbarkeitsRelevant): string => {
  if (challenge.visibility === 'private') {
    return 'Deinen Beitrag sieht nur das Leitungsteam';
  }
  if (challenge.visibility === 'public') {
    return challenge.moderated
      ? 'Für deine Gruppe sichtbar — nach Freigabe durch das Leitungsteam'
      : 'Für deine Gruppe sofort sichtbar';
  }
  return challenge.moderated
    ? 'Du entscheidest unten, wer deinen Beitrag sieht — veröffentlicht wird nach Freigabe'
    : 'Du entscheidest unten, wer deinen Beitrag sieht';
};

/** Erfolgsmeldung nach dem Absenden — spiegelt den tatsächlichen Behandlungsweg. */
export const getSuccessMessage = (
  challenge: SichtbarkeitsRelevant,
  consent: ChallengeConsent
): string => {
  const willBePublic =
    challenge.visibility === 'public' ||
    (challenge.visibility === 'konfi_choice' && consent !== 'private');
  if (challenge.moderated && willBePublic) {
    return 'Eingereicht — dein Beitrag wartet auf Freigabe.';
  }
  if (willBePublic) {
    return 'Veröffentlicht!';
  }
  return 'Eingereicht — dein Beitrag ist nur für die Leitung sichtbar.';
};
