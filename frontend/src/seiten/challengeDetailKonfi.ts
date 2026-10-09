// Seite einer Challenge für Konfis (/konfi/challenges/:id): die Reiter über den Beiträgen.
// App: components/konfi/pages/KonfiChallengeDetailPage.tsx (Zustand in
// konfi/pages/useKonfiChallengeAnsicht.ts). Web:
// components/konfi/web/challenges/WebKonfiChallengeDetail.tsx.
//
// Bei „nur Leitung" gibt es keine Gruppen-Galerie; dann entfällt die Leiste
// in beiden Fassungen, es bleibt „Meins".

import type { Fassung } from './beschreibung';
import { wahlen } from './beschreibung';

export const CHALLENGE_DETAIL_KONFI_REITER = wahlen([
  { schluessel: 'feed', label: 'Feed' },
  { schluessel: 'meins', label: 'Meins' },
]);

export type ChallengeDetailKonfiReiter = (typeof CHALLENGE_DETAIL_KONFI_REITER)[number]['schluessel'];

export const CHALLENGE_DETAIL_KONFI_BESCHRIFTUNG = 'Beiträge';

/** Die Überschrift über den Beiträgen. */
export const konfiDetailUeberschrift = (reiter: ChallengeDetailKonfiReiter, eigene: number): string =>
  reiter === 'meins' ? (eigene === 1 ? 'Dein Beitrag' : 'Deine Beiträge') : 'Aus deiner Gruppe';

/**
 * Die Leerzustände, je nachdem, ob die Challenge noch läuft. Bewusster
 * Unterschied bei „Meins", solange sie läuft: Die App nennt das Plus oben,
 * der Browser den Knopf „Beitrag einreichen" -- der Hinweis zeigte sonst auf
 * einen Knopf, den es dort nicht gibt (Befund 30.08.2026).
 */
export function konfiDetailLeer(reiter: ChallengeDetailKonfiReiter, laeuft: boolean, fassung: Fassung): { titel: string; text: string } {
  if (reiter === 'meins') {
    return {
      titel: 'Noch kein Beitrag von dir',
      text: !laeuft
        ? 'Diese Challenge ist beendet — du hattest nichts eingereicht.'
        : fassung === 'app'
          ? 'Tippe oben auf das Plus, um etwas einzureichen.'
          : 'Reiche oben rechts über „Beitrag einreichen“ deinen Beitrag ein.',
    };
  }
  return {
    titel: 'Noch keine geteilten Beiträge',
    text: laeuft
      ? 'Sobald jemand aus deiner Gruppe etwas veröffentlicht, findest du es hier. Vielleicht machst du ja den Anfang.'
      : 'Aus dieser Challenge hat niemand aus deiner Gruppe etwas veröffentlicht.',
  };
}
