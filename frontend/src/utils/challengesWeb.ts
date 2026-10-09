// Regeln der Web-Fassung der Challenges (Browser ab 992 px,
// docs/planung/web-alle-bereiche.md, Entscheidung 6): welche Challenge unter
// welchem Filter steht, was die Suche trifft, wie die rote Zahl an der Karte
// gerechnet wird. Reine Funktionen -- die Karten, die Filterleiste und die
// Tests lesen dieselbe Stelle.
//
// WAS HIER NICHT STEHT: wer eine Challenge sehen darf. Das entscheidet der
// Server (backend/utils/challengeLeitungSicht.js, Liste und Zaehler lesen
// dieselbe Regel); die Web-Fassung filtert nur, was ihr der Server schickt.
// Ebenso bleibt die Einteilung in Aktuell/Geplant/Archiv der App
// (teileChallengesAuf) die einzige: Die Web-Fassung ordnet danach. Namen,
// Leertexte und Praedikate der Reiter stehen in seiten/challengesLeitung.ts.

import type { AdminChallenge, ChallengeAudience, ChallengeBase, ChallengeJahrgang, ChallengeMediaType, ChallengeStatus } from '../types/challenges';
import { getChallengeStatus, teileChallengesAuf } from '../components/admin/views/ChallengesManageView';
import { kugelTextAmEintrag, kugelTextNeueBeitraege } from './challengeTexte';
import { suchTreffer, type PillTon } from './supportWeb';
import { datumKurz } from './dateUtils';
import { schluesselIn, wahlVon } from '../seiten/beschreibung';
import { CHALLENGES_LEITUNG_REITER, type ChallengesLeitungReiter } from '../seiten/challengesLeitung';
import { CHALLENGES_KONFI_REITER } from '../seiten/challengesKonfi';

/**
 * Eine Challenge, wie die Karte sie braucht. Die Leitungsliste
 * (AdminChallenge) und die Konfi-Liste (KonfiChallenge) erfuellen beide
 * diese Form -- die Karte liest nur, was da ist.
 */
export type ListenChallenge = ChallengeBase & {
  jahrgaenge?: ChallengeJahrgang[];
  submission_count?: number;
  own_submission_count?: number;
  /** Nur die Konfi-Liste: schon einmal eingereicht? */
  has_submission?: boolean;
  author_name?: string | null;
};

/** Eine Challenge mit ihrem Stand auf der Uhr -- die Reihenfolge ist die der Liste. */
export interface ListenEintrag<T extends ListenChallenge = ListenChallenge> {
  challenge: T;
  status: ChallengeStatus;
  /** Beitraege, die auf Freigabe warten (nur Team und Leitung, aus dem BadgeContext). */
  wartend?: number;
}

/**
 * Die Filter der Listen -- Schluessel, Beschriftung, Leertext und Praedikat
 * stehen in der gemeinsamen Beschreibung (seiten/challengesLeitung.ts,
 * seiten/challengesKonfi.ts), aus der auch die App liest. 'wartet':
 * Challenges mit Beitraegen, die auf Freigabe warten -- ueber alle Zustaende.
 */
export type ListenFilter = ChallengesLeitungReiter;

/** Die Filter der Liste von Team und Leitung im Browser. */
export const LISTEN_FILTER: readonly ListenFilter[] = schluesselIn(CHALLENGES_LEITUNG_REITER, 'web');

/** Die Filter der Konfi-Liste im Browser: Geplantes bekommen Konfis nie zu sehen. */
export const KONFI_LISTEN_FILTER: readonly ListenFilter[] = schluesselIn(CHALLENGES_KONFI_REITER, 'web');

/** Der Status als Wort auf der Marke: der Zustand der Challenge ("Läuft"), nicht der Name des Reiters ("Aktuell"). */
export const STATUS_WORT: Record<ChallengeStatus, string> = {
  draft: 'Entwurf',
  scheduled: 'Geplant',
  active: 'Läuft',
  ended: 'Beendet',
};

/** Womit geantwortet werden darf, als Wort. */
export const MEDIEN_WORT: Record<ChallengeMediaType, string> = {
  text: 'Text',
  photo: 'Foto',
  audio: 'Aufnahme',
  video: 'Video',
  link: 'Musik-Link',
};

/** Der Status als Klassenendung an Karte und Zeile (web-challenge-karte--aktiv): jeder Zustand traegt seine Farbe. */
export const STATUS_MODIFIKATOR: Record<ChallengeStatus, string> = {
  active: 'aktiv',
  scheduled: 'geplant',
  draft: 'entwurf',
  ended: 'beendet',
};

/** Der Status als Marke: laufend gruen, geplant blau, Entwurf und beendet neutral. */
export const STATUS_TON: Record<ChallengeStatus, PillTon> = {
  draft: 'neutral',
  scheduled: 'info',
  active: 'erfolg',
  ended: 'neutral',
};

/**
 * Die Eintraege der Leitungsliste, in der Reihenfolge der App: erst was
 * laeuft, dann was kommt (Entwuerfe zuerst), dann das Archiv -- genau die
 * drei Reiter, hintereinander.
 */
export function leitungEintraege(
  challenges: readonly AdminChallenge[],
  jetzt: number = Date.now(),
  offeneFreigaben: Record<number, number> = {},
): Array<ListenEintrag<AdminChallenge>> {
  const teile = teileChallengesAuf([...challenges], jetzt);
  const mit = (liste: AdminChallenge[]) => liste.map((c) => ({
    challenge: c,
    status: getChallengeStatus(c, jetzt),
    wartend: offeneFreigaben[c.id] ?? 0,
  }));
  return [...mit(teile.current), ...mit(teile.planned), ...mit(teile.archived)];
}

/**
 * Die Eintraege der Konfi-Liste: was der Server als laufend liefert, die
 * knappste Frist zuerst; danach das Archiv, zuletzt Beendetes zuerst -- wie
 * ChallengesView.
 */
export function konfiEintraege<T extends ListenChallenge>(active: readonly T[], archive: readonly T[]): Array<ListenEintrag<T>> {
  const zeit = (c: T) => new Date(c.ends_at).getTime();
  return [
    ...[...active].sort((a, b) => zeit(a) - zeit(b)).map((challenge) => ({ challenge, status: 'active' as const })),
    ...[...archive].sort((a, b) => zeit(b) - zeit(a)).map((challenge) => ({ challenge, status: 'ended' as const })),
  ];
}

/** Gehoert der Eintrag zum Filter? Das Praedikat steht am Reiter der Beschreibung (seiten/challengesLeitung.ts). */
export function passtZumFilter(eintrag: Pick<ListenEintrag, 'status' | 'wartend'>, filter: ListenFilter): boolean {
  return wahlVon(CHALLENGES_LEITUNG_REITER, filter).passt?.(eintrag) ?? true;
}

/** Zielgruppe der Challenge; fehlt sie (Altdaten), gilt 'konfis' wie im Typ beschrieben. */
export const zielgruppeVon = (c: Pick<ChallengeBase, 'audience'>): ChallengeAudience => c.audience ?? 'konfis';

export interface ListenAuswahl {
  filter: ListenFilter;
  /** 'alle' oder eine Zielgruppe. */
  zielgruppe: ChallengeAudience | 'alle';
  /** 'alle' oder die ID eines Jahrgangs als Text. */
  jahrgang: string;
  suche: string;
}

export const OHNE_AUSWAHL: ListenAuswahl = { filter: 'alle', zielgruppe: 'alle', jahrgang: 'alle', suche: '' };

/** Namen und Texte, in denen die Suche sucht: Titel, Aufgabe, Stempel, Urheber:in, Jahrgaenge. */
export const challengeSuchtexte = (c: ListenChallenge): string[] => [
  c.title,
  c.description ?? '',
  c.badge_name ?? '',
  c.author_name ?? c.author_display_name ?? c.author_freetext ?? '',
  ...(c.jahrgaenge ?? []).map((j) => j.name),
];

/** Passt die Challenge zur Suche? Ohne Suche: ja. Umlaute zaehlen als Umschreibung (supportWeb). */
export const passtZurSuche = (c: ListenChallenge, suche: string): boolean =>
  suche.trim() === '' || challengeSuchtexte(c).some((t) => suchTreffer(t, suche).length > 0);

const passtZuZielgruppe = (c: ListenChallenge, zielgruppe: ListenAuswahl['zielgruppe']): boolean =>
  zielgruppe === 'alle' || zielgruppeVon(c) === zielgruppe;

const passtZumJahrgang = (c: ListenChallenge, jahrgang: string): boolean =>
  jahrgang === 'alle' || (c.jahrgaenge ?? []).some((j) => String(j.id) === jahrgang);

/** Die Eintraege nach Zielgruppe, Jahrgang und Suche -- ohne den Statusfilter (daraus rechnen die Zaehler an den Chips). */
export function ohneStatusFiltern<T extends ListenChallenge>(
  eintraege: ReadonlyArray<ListenEintrag<T>>,
  auswahl: Omit<ListenAuswahl, 'filter'>,
): Array<ListenEintrag<T>> {
  return eintraege.filter((e) => (
    passtZuZielgruppe(e.challenge, auswahl.zielgruppe)
    && passtZumJahrgang(e.challenge, auswahl.jahrgang)
    && passtZurSuche(e.challenge, auswahl.suche)
  ));
}

/** Alle drei Filter und die Suche zusammen. */
export function challengesFiltern<T extends ListenChallenge>(
  eintraege: ReadonlyArray<ListenEintrag<T>>,
  auswahl: ListenAuswahl,
): Array<ListenEintrag<T>> {
  return ohneStatusFiltern(eintraege, auswahl).filter((e) => passtZumFilter(e, auswahl.filter));
}

/**
 * Zahl je Filter-Chip, gerechnet ueber die Auswahl nach Zielgruppe, Jahrgang
 * und Suche. Die Chips zaehlen Challenges; nur "Wartet auf Freigabe" zaehlt
 * die wartenden BEITRAEGE -- die Zahl, die jemand abarbeitet (wie die orange
 * Zahl am Reiter der App).
 */
export function challengesZaehlen<T extends ListenChallenge>(
  eintraege: ReadonlyArray<ListenEintrag<T>>,
  auswahl: Omit<ListenAuswahl, 'filter'>,
): Record<ListenFilter, number> {
  const rest = ohneStatusFiltern(eintraege, auswahl);
  return {
    aktuell: rest.filter((e) => passtZumFilter(e, 'aktuell')).length,
    geplant: rest.filter((e) => passtZumFilter(e, 'geplant')).length,
    archiv: rest.filter((e) => passtZumFilter(e, 'archiv')).length,
    alle: rest.length,
    wartet: rest.reduce((summe, e) => summe + (e.wartend ?? 0), 0),
  };
}

/** Die Jahrgaenge, die in den Challenges vorkommen, nach Namen -- fuer die Auswahl. */
export function jahrgaengeDerChallenges(challenges: readonly ListenChallenge[]): ChallengeJahrgang[] {
  const nachId = new Map<number, ChallengeJahrgang>();
  for (const c of challenges) for (const j of c.jahrgaenge ?? []) nachId.set(j.id, j);
  return [...nachId.values()].sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
}

/**
 * Die Jahrgaenge einer Challenge als kurzer Text fuer Karte und Zeile:
 * bis zu zwei mit Namen, ab drei nur die Zahl ("3 Jahrgänge").
 */
export const jahrgangText = (jahrgaenge: readonly ChallengeJahrgang[] = []): string =>
  jahrgaenge.length > 2 ? `${jahrgaenge.length} Jahrgänge` : jahrgaenge.map((j) => j.name).join(', ');

/**
 * Die rote Zahl am Eintrag der Leitung und des Teams -- dieselbe Rechnung wie
 * in der Liste der App (ChallengesManageView): jeder fremde Beitrag seit dem
 * letzten Oeffnen, auch der wartende; ohne das Feld des Servers (aelterer
 * Server) wartende Freigaben plus neue freigegebene. Dazu die Zahl der
 * wartenden Freigaben (das orange Feld) und der Satz fuer Vorleseprogramme.
 * Der Test challengesWebKugel prueft beide Listen gegeneinander.
 */
export function kugelAmEintrag(
  id: number,
  stand: {
    offeneFreigaben?: Record<number, number>;
    neuigkeiten?: Record<number, number>;
    neueBeitraege?: Record<number, number>;
    neueWartend?: Record<number, number>;
  },
): { anzahl: number; text: string; wartend: number } {
  const wartend = stand.offeneFreigaben?.[id] ?? 0;
  const neuigkeiten = stand.neuigkeiten?.[id] ?? 0;
  const anzahl = stand.neueBeitraege ? (stand.neueBeitraege[id] ?? 0) : wartend + neuigkeiten;
  const text = stand.neueBeitraege
    ? kugelTextNeueBeitraege(anzahl, stand.neueWartend?.[id] ?? 0)
    : kugelTextAmEintrag(wartend, neuigkeiten);
  return { anzahl, text, wartend };
}

/**
 * Der Zeitraum fuer die Karte: "03.10. – 17.10.2026" (im selben Jahr faellt
 * das Jahr beim Start weg), "Zeitraum noch offen" beim Entwurf -- dort ist
 * das gespeicherte Datum nur ein Platzhalter (Nutzerentscheid 24.08.2026).
 */
export function zeitraumText(c: Pick<ChallengeBase, 'starts_at' | 'ends_at'>, status: ChallengeStatus): string {
  if (status === 'draft') return 'Zeitraum noch offen';
  const start = new Date(c.starts_at);
  const ende = new Date(c.ends_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(ende.getTime())) return '';
  const gleichesJahr = start.getFullYear() === ende.getFullYear();
  return `${datumKurz(start, { ohneJahr: gleichesJahr })} – ${datumKurz(ende)}`;
}

/**
 * Die Restzeit einer laufenden Challenge als Satzteil: "Noch 3 Tage",
 * "Endet gleich". Die Zeit selbst rechnet formatRemaining der App-Liste
 * (konfi/views/ChallengesView) -- kindgerecht und eine Stelle.
 */
export function restzeitText(restzeit: string): string {
  if (!restzeit) return '';
  return /^\d/.test(restzeit) ? `Noch ${restzeit}` : `${restzeit.charAt(0).toUpperCase()}${restzeit.slice(1)}`;
}

/**
 * Die Kachel "Laufzeit" auf der Seite einer Challenge (Leitung, Team, Konfis):
 * laufend wie lange noch ("Noch 9 Tage", "Endet gleich"), sonst der Zustand --
 * Entwurf, Geplant mit Start, Beendet mit Ende. `restzeit` kommt aus
 * formatRemaining der App-Liste (konfi/views/ChallengesView), damit die Zeit
 * eine Stelle hat.
 */
export function laufzeitKachel(
  c: Pick<ChallengeBase, 'starts_at' | 'ends_at'>,
  status: ChallengeStatus,
  restzeit: string,
): { wert: string; zusatz: string[] } {
  switch (status) {
    case 'draft': return { wert: 'Entwurf', zusatz: ['Zeitraum noch offen'] };
    case 'scheduled': return { wert: 'Geplant', zusatz: [`Beginnt am ${datumKurz(c.starts_at)}`] };
    case 'active': return { wert: restzeitText(restzeit) || 'Läuft', zusatz: [`bis ${datumKurz(c.ends_at)}`] };
    default: return { wert: 'Beendet', zusatz: [`am ${datumKurz(c.ends_at)}`] };
  }
}

/**
 * Die Marke zu einer Farbe der App-Zuordnung (Status und Einwilligung eines
 * Beitrags, useChallengeLeitung: STATUS_BADGE, CONSENT_BADGE): Wartendes
 * orange, Freigegebenes gruen, Ausgeblendetes rot, "nur Leitung" grau, anonym
 * blau. Die Farbe bleibt die Quelle -- aendert die App sie, faellt die Marke
 * auf neutral, nie auf eine falsche Aussage.
 */
export function tonVonFarbe(farbe: string): PillTon {
  switch (farbe) {
    case 'var(--app-color-warning)': return 'warnung';
    case 'var(--app-color-success-strong)': return 'erfolg';
    case 'var(--app-color-danger)': return 'fehler';
    case 'var(--app-color-wrapped)': return 'info';
    default: return 'neutral';
  }
}
