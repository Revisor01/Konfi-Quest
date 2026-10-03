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
const reiterZaehler = lies('src/navigation/reiterZaehler.ts');
const konfiSeite = lies('src/components/konfi/pages/KonfiChallengesPage.tsx');
const detail = lies('src/components/konfi/pages/KonfiChallengeDetailPage.tsx');
const leitungsDetail = lies('src/components/shared/ChallengeLeitungPage.tsx');
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
    // ist 0. Die Summe ist deshalb nie eine Mischung. Gerechnet seit dem
    // 03.10.2026 in navigation/reiterZaehler.ts (auch fuer die Seitenleiste
    // der Web-Version), MainTabs ruft es.
    expect(reiterZaehler).toContain('challenges: pendingChallengesCount + challengeUpdatesTotal');
    expect(mainTabs).toContain('const zaehler = useReiterZaehler();');
  });

  it('Challenge: die Liste bekommt die Zahl je Challenge aus dem BadgeContext', () => {
    expect(konfiSeite).toContain('const { challengeUpdatesByChallenge } = useBadge()');
    expect(konfiSeite).toContain('neuigkeiten={challengeUpdatesByChallenge}');
  });

  it('Challenge: das Oeffnen meldet sie als gelesen', () => {
    // Seit 2.4.0 eine eigene Seite: gemeldet wird, sobald die Challenge da
    // ist (challengeOeffnenMeldetGelesen.test.tsx prueft es gerendert).
    expect(detail).toContain('markChallengeAsRead(current.id)');
  });

  it('Challenge (Team und Leitung): die Liste bekommt die offenen Freigaben je Challenge aus dem BadgeContext', () => {
    // 25.09.2026, Simon: "Auf der Challenge muss auch ein Badge sein wie
    // bei den Chats" -- dieselbe Quelle wie der Reiter (pendingChallenges),
    // NICHT challenge.pending_count aus der Liste.
    expect(leitungsSeite).toMatch(/const \{[^}]*pendingChallengesByChallenge[^}]*\} = useBadge\(\)/);
    expect(leitungsSeite).toContain('offeneFreigaben={pendingChallengesByChallenge}');
    expect(leitungsListe).toContain('offeneFreigaben[challenge.id]');
    expect(leitungsListe).not.toContain('challenge.pending_count');
  });

  it('eine Kugel fuer Chat und Challenges statt zweier Abschriften', () => {
    expect(chatListe).toContain("import ZaehlerKugel from '../shared/ZaehlerKugel'");
    expect(challengeListe).toContain("import ZaehlerKugel from '../../shared/ZaehlerKugel'");
    // Die Leitungs-Liste traegt seit 27.09.2026 ebenfalls die Kugel (Simon:
    // "Die Challenges sollen sich verhalten wie der Chat"). Seit 29.09.2026
    // zaehlt sie jeden neuen Beitrag seit dem letzten Oeffnen, auch wartende
    // (challengeNeueBeitraege); ohne das Feld die Rechnung vom 28.09.2026
    // (wartend + neu freigegeben). Das orange Eck-Badge mit Uhr steht
    // daneben fuer Wartendes.
    expect(leitungsListe).toContain("import ZaehlerKugel from '../../shared/ZaehlerKugel'");
    expect(leitungsListe).toContain('<ZaehlerKugel anzahl={kugel} label={kugelText} />');
    expect(leitungsListe).toContain('neueBeitraege[challenge.id]');
    expect(leitungsListe).toContain('neuigkeiten[challenge.id]');
    expect(leitungsListe).toContain('wartenAufFreigabe(pending)');
    expect(leitungsSeite).toContain('neuigkeiten={challengeUpdatesByChallenge}');
    expect(leitungsSeite).toContain('neueBeitraege={challengeNeueBeitraegeByChallenge ?? undefined}');
    expect(leitungsSeite).toContain('neueWartend={challengeNeueWartendByChallenge}');
    // Oeffnen setzt die Zahl zurueck, beim Aufgehen und beim Verlassen --
    // seit 2.4.0 auf der Seite der Challenge statt im Dialog der Liste
    // (gerendert geprueft in challengeSeiteLeitung.test.tsx).
    expect(leitungsDetail).toMatch(/void gesehen\(challenge\)/);
    expect(leitungsDetail).toMatch(/useEffect\(\(\) => \(\) => \{[\s\S]*?void gesehen\(challengeRef\.current\)/);
    expect(leitungsSeite).not.toContain('markChallengeAsRead');
    // Die alte Inline-Kugel der Chat-Liste ist weg -- sonst gaebe es wieder
    // zwei Fassungen, die auseinanderlaufen.
    expect(chatListe).not.toContain("'9+'");
  });
});
