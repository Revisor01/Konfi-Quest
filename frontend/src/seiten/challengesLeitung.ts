// Challenges von Team und Leitung (/admin/challenges, /teamer/challenges): die Liste.
// App: components/admin/views/ChallengesManageView.tsx (über shared/ChallengesPage.tsx).
// Web: components/shared/web/challenges/WebChallengesLeitung.tsx mit
// WebChallengeFilter.tsx; die Regeln dazu in utils/challengesWeb.ts
// (LISTEN_FILTER, passtZumFilter, challengesZaehlen lesen von hier).
//
// Aktuell, Geplant und Archiv sind in beiden Fassungen dieselben Mengen
// (getChallengeStatus: läuft; geplant oder Entwurf; beendet) und heißen
// seit 09.10.2026 auch im Browser so -- bis dahin „Laufend" und „Beendet".
// Die Marke an der Karte sagt weiter den Zustand („Läuft", „Beendet",
// utils/challengesWeb.ts: STATUS_WORT).
//
// Die Zahl am Reiter: In der App trägt jeder Reiter orange die Beiträge, die
// unter ihm auf Freigabe warten (`zahlText`). Im Browser zählt jeder Chip die
// Challenges darunter; die wartenden Beiträge stehen am Chip „Wartet auf
// Freigabe".

import type { ChallengeStatus } from '../types/challenges';
import { wartenAufFreigabeKurz } from '../utils/challengeTexte';
import { wahlen, zahlwort } from './beschreibung';

/** Was ein Reiter von einem Eintrag braucht: seinen Zustand und die wartenden Beiträge. */
export interface ReiterEintrag {
  status: ChallengeStatus;
  wartend?: number;
}

export const CHALLENGES_LEITUNG_REITER = wahlen([
  {
    schluessel: 'aktuell', label: 'Aktuell',
    leer: 'Lege eine Challenge an, damit deine Konfis eigene Beiträge einreichen können',
    passt: (e: ReiterEintrag) => e.status === 'active',
    zahlText: wartenAufFreigabeKurz,
  },
  {
    // Entwürfe gehören zu dem, was kommt (Nutzerentscheid 24.08.2026).
    schluessel: 'geplant', label: 'Geplant',
    leer: 'Entwürfe und Challenges mit einem Startdatum in der Zukunft erscheinen hier',
    passt: (e: ReiterEintrag) => e.status === 'scheduled' || e.status === 'draft',
    zahlText: wartenAufFreigabeKurz,
  },
  {
    schluessel: 'archiv', label: 'Archiv',
    leer: 'Beendete Challenges sammeln sich hier — mit allen Beiträgen zum Nachlesen',
    passt: (e: ReiterEintrag) => e.status === 'ended',
    zahlText: wartenAufFreigabeKurz,
  },
  {
    schluessel: 'alle', label: 'Alle',
    leer: 'Lege eine Challenge an, damit deine Konfis eigene Beiträge einreichen können',
    passt: () => true,
    nurIn: 'web',
    warum: 'Die App zeigt die Zahl je Reiter als Kacheln darüber; im Browser filtern Suche, Zielgruppe und Jahrgang über alle Zustände, dafür gibt es die Gesamtliste als eigenen Chip.',
  },
  {
    schluessel: 'wartet', label: 'Wartet auf Freigabe',
    leer: 'Beiträge, die du freigeben sollst, erscheinen hier — mit der Challenge, zu der sie gehören.',
    passt: (e: ReiterEintrag) => (e.wartend ?? 0) > 0,
    zahlText: zahlwort('Beitrag wartet auf Freigabe', 'Beiträge warten auf Freigabe'),
    nurIn: 'web',
    warum: 'In der App trägt jeder Reiter die orange Zahl seiner wartenden Beiträge; im Browser zählen die Chips Challenges, das Wartende steht über alle Zustände an einem eigenen Chip.',
  },
]);

export type ChallengesLeitungReiter = (typeof CHALLENGES_LEITUNG_REITER)[number]['schluessel'];

/** Die Überschriften der Leerzustände, je Reiter (der Text steht als `leer` am Reiter). */
export const CHALLENGES_LEITUNG_LEER_TITEL: Record<ChallengesLeitungReiter, string> = {
  aktuell: 'Gerade läuft keine Challenge',
  geplant: 'Nichts in Planung',
  archiv: 'Noch nichts im Archiv',
  alle: 'Noch keine Challenge',
  wartet: 'Nichts wartet auf Freigabe',
};

export const CHALLENGES_LEITUNG_TITEL = 'Challenges';
export const CHALLENGES_LEITUNG_UNTERTITEL = 'Anlegen, begleiten, mitmachen';
export const CHALLENGES_REITER_BESCHRIFTUNG = 'Challenges nach Zustand';

/** Ohne zugewiesenen Jahrgang (Server: X-Kein-Jahrgang-Zugewiesen) -- wortgleich in App und Browser. */
export const CHALLENGES_OHNE_JAHRGANG = {
  titel: 'Kein Jahrgang zugewiesen',
  text: 'Dir ist noch kein Jahrgang zugewiesen, deshalb siehst du hier keine Challenges. Die Gemeindeleitung kann das in den Einstellungen ändern.',
} as const;
