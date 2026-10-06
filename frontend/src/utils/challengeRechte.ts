// Was eine Person bei Challenges darf und wo ihre Liste steht -- fuer die
// Liste der App (ChallengesManageView) und die Web-Fassung gemeinsam. Was
// jemand SIEHT, entscheidet der Server (backend/utils/challengeLeitungSicht.js).

type Nutzer = { type?: string | null } | null | undefined;

/**
 * Wer eine Challenge endgueltig loeschen darf: die Leitung. Teamer:innen
 * moderieren voll mit, nur das Endgueltige nicht (Nutzerentscheid
 * 28.08.2026) -- der Server weist es sonst mit 403 ab.
 */
export const darfChallengesLoeschen = (user: Nutzer): boolean => user?.type === 'admin';

/** Die Liste der Challenges in dieser Rolle; eine Challenge liegt darunter (<pfad>/<id>). */
export const challengeListenPfad = (user: Nutzer): string =>
  user?.type === 'teamer' ? '/teamer/challenges' : user?.type === 'konfi' ? '/konfi/challenges' : '/admin/challenges';
