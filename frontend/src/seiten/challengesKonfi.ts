// Challenges der Konfis (/konfi/challenges): die Liste.
// App: components/konfi/views/ChallengesView.tsx (über konfi/pages/KonfiChallengesPage.tsx).
// Web: components/konfi/web/challenges/WebKonfiChallenges.tsx; Zahlen und
// Filter rechnet utils/challengesWeb.ts (KONFI_LISTEN_FILTER liest von hier).
//
// Aktuell und Archiv sind in beiden Fassungen dieselben Mengen (was der Server
// als laufend bzw. beendet liefert, utils/challengesWeb.ts: konfiEintraege) und
// heißen seit 09.10.2026 auch im Browser so (bis dahin „Laufend", „Beendet").
// Geplantes und Wartendes bekommen Konfis nie zu sehen.

import { wahlen } from './beschreibung';
import type { ReiterEintrag } from './challengesLeitung';

export const CHALLENGES_KONFI_REITER = wahlen([
  {
    schluessel: 'aktuell', label: 'Aktuell',
    leer: 'Sobald eine neue Challenge startet, findest du sie hier — und bekommst eine Nachricht.',
    passt: (e: ReiterEintrag) => e.status === 'active',
  },
  {
    schluessel: 'archiv', label: 'Archiv',
    leer: 'Beendete Challenges kannst du hier später in Ruhe nachlesen.',
    passt: (e: ReiterEintrag) => e.status === 'ended',
  },
  {
    schluessel: 'alle', label: 'Alle',
    leer: 'Sobald eine neue Challenge startet, findest du sie hier — und bekommst eine Nachricht.',
    passt: () => true,
    nurIn: 'web',
    warum: 'In der App stehen die Zahlen je Reiter als Kacheln darüber; im Browser sucht die Suche über beide Zustände, dafür gibt es die Gesamtliste als eigenen Chip.',
  },
]);

export type ChallengesKonfiReiter = (typeof CHALLENGES_KONFI_REITER)[number]['schluessel'];

export const CHALLENGES_KONFI_LEER_TITEL: Record<ChallengesKonfiReiter, string> = {
  aktuell: 'Gerade läuft keine Challenge',
  archiv: 'Noch nichts im Archiv',
  alle: 'Noch keine Challenge',
};

export const CHALLENGES_KONFI_TITEL = 'Challenges';
export const CHALLENGES_KONFI_UNTERTITEL = 'Mach mit, sei dabei';
