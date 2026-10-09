// Seite einer Challenge für Team und Leitung (/admin/challenges/:id,
// /teamer/challenges/:id): die Reiter über den Beiträgen.
// App: components/admin/views/ChallengeLeitungView.tsx (Zustand und Liste in
// admin/views/useChallengeLeitung.ts). Web:
// components/shared/web/challenges/WebChallengeLeitungDetail.tsx.
//
// Beide Fassungen zeigen dieselben Reiter; welche es gibt, hängt an der
// Challenge (detailReiterFuer). Im Browser trägt jeder Chip die Zahl seiner
// Beiträge, in der App nur „Wartet" die orange Zahl -- dieselbe Zählung.

import { wartenAufFreigabeKurz } from '../utils/challengeTexte';
import { wahlen } from './beschreibung';

interface MitStand { moderation_status?: string | null }

export const CHALLENGE_DETAIL_LEITUNG_REITER = wahlen([
  // „Feed" zeigt nur Freigegebenes -- denselben Blick, den die Konfis auf die Galerie haben.
  { schluessel: 'feed', label: 'Feed', leer: 'Sobald Beiträge freigegeben sind, erscheinen sie hier — wie bei den Konfis.', passt: (b: MitStand) => b.moderation_status === 'approved' },
  // Nur mit Freigabe-Pflicht: ohne Moderation wäre der Reiter immer leer.
  { schluessel: 'pending', label: 'Wartet', leer: 'Hier ist gerade nichts.', passt: (b: MitStand) => b.moderation_status === 'pending', zahlText: wartenAufFreigabeKurz },
  // Nicht bei „nur Leitung": ohne Gruppen-Galerie gibt es nichts herauszunehmen (User-Entscheid 25.08.2026).
  { schluessel: 'hidden', label: 'Abgelehnt', leer: 'Hier ist gerade nichts.', passt: (b: MitStand) => b.moderation_status === 'hidden' },
  // Die eigenen Beiträge, gleich welcher Stand -- das Prädikat braucht die angemeldete Person (useChallengeLeitung).
  { schluessel: 'meins', label: 'Meins', leer: 'Hier ist gerade nichts.' },
]);

export type ChallengeDetailLeitungReiter = (typeof CHALLENGE_DETAIL_LEITUNG_REITER)[number]['schluessel'];

/** Die Reiter, die es an dieser Challenge gibt -- in beiden Fassungen dieselben. */
export function detailReiterFuer(challenge: { moderated?: boolean | null; visibility?: string | null }) {
  return CHALLENGE_DETAIL_LEITUNG_REITER.filter((r) => (
    (r.schluessel !== 'pending' || !!challenge.moderated)
    && (r.schluessel !== 'hidden' || challenge.visibility !== 'private')
  ));
}

export const CHALLENGE_DETAIL_LEER_TITEL = 'Keine Beiträge';
/** Im Feed ist nichts, es wartet aber etwas: der Hinweis, wo es steht. */
export const CHALLENGE_DETAIL_FEED_WARTET = 'Im Feed steht nur, was freigegeben ist. Beiträge, die noch warten, findest du unter „Wartet“.';
export const CHALLENGE_DETAIL_REITER_BESCHRIFTUNG = 'Beiträge nach Zustand';
