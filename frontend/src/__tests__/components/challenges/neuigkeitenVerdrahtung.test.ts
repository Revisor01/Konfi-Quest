import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Verdrahtung des Challenge-Neuigkeiten-Zaehlers (24.09.2026). Simons
// Anforderung nennt drei Orte -- "auf der Challenge, auf dem Navi-Tab, auf
// dem Icon" -- und jeder ist eine eigene Stelle im Code, die einzeln
// vergessen werden kann. Diese Tests lesen die Quelldateien statt zu
// rendern (Muster: abzeichenZaehlerTeamer.test.ts): Sie halten fest, dass
// jede Stelle an derselben Quelle haengt.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const baeume = lies('src/navigation/rollenBaeume.ts');
const mainTabs = lies('src/components/layout/MainTabs.tsx');
const konfiSeite = lies('src/components/konfi/pages/KonfiChallengesPage.tsx');
const detail = lies('src/components/konfi/modals/ChallengeDetailModal.tsx');
const chatListe = lies('src/components/chat/ChatOverview.tsx');
const challengeListe = lies('src/components/konfi/views/ChallengesView.tsx');
const leitungsSeite = lies('src/components/shared/ChallengesPage.tsx');
const leitungsListe = lies('src/components/admin/views/ChallengesManageView.tsx');

describe('Challenge-Neuigkeiten: drei Orte, eine Quelle', () => {
  it('Navi-Tab: der Konfi-Reiter Challenges traegt den Zaehler', () => {
    const zeile = baeume.split('\n').find(z => z.includes("href: '/konfi/challenges'")) || '';
    expect(zeile).toContain("badge: 'challenges'");
  });

  it('Navi-Tab: Freigaben (Team/Leitung) und Neuigkeiten (Konfis) laufen im selben Schluessel zusammen', () => {
    // Der Server liefert je Rolle nur einen der beiden Anteile; der andere
    // ist 0. Die Summe ist deshalb nie eine Mischung.
    expect(mainTabs).toContain('challenges: pendingChallengesCount + challengeUpdatesTotal');
  });

  it('Challenge: die Liste bekommt die Zahl je Challenge aus dem BadgeContext', () => {
    expect(konfiSeite).toContain('const { challengeUpdatesByChallenge } = useBadge()');
    expect(konfiSeite).toContain('neuigkeiten={challengeUpdatesByChallenge}');
  });

  it('Challenge: das Oeffnen meldet sie als gelesen', () => {
    expect(detail).toContain('markChallengeAsRead(challenge.id)');
  });

  it('Challenge (Team und Leitung): die Liste bekommt die offenen Freigaben je Challenge aus dem BadgeContext', () => {
    // 25.09.2026, Simon: "Auf der Challenge muss auch ein Badge sein wie
    // bei den Chats" -- dieselbe Quelle wie der Reiter (pendingChallenges),
    // NICHT challenge.pending_count aus der Liste.
    expect(leitungsSeite).toContain('pendingChallengesByChallenge } = useBadge()');
    expect(leitungsSeite).toContain('offeneFreigaben={pendingChallengesByChallenge}');
    expect(leitungsListe).toContain('offeneFreigaben[challenge.id]');
    expect(leitungsListe).not.toContain('challenge.pending_count');
  });

  it('eine Kugel fuer Chat und Challenges statt zweier Abschriften', () => {
    expect(chatListe).toContain("import ZaehlerKugel from '../shared/ZaehlerKugel'");
    expect(challengeListe).toContain("import ZaehlerKugel from '../../shared/ZaehlerKugel'");
    expect(leitungsListe).toContain("import ZaehlerKugel from '../../shared/ZaehlerKugel'");
    // Die alte Inline-Kugel der Chat-Liste ist weg -- sonst gaebe es wieder
    // zwei Fassungen, die auseinanderlaufen.
    expect(chatListe).not.toContain("'9+'");
  });
});
