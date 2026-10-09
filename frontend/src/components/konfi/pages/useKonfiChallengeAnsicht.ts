import { useMemo, useState } from 'react';
import {
  ICON_BILD,
  ICON_ENTFERNEN,
  ICON_HAKEN,
  ICON_LINK,
  ICON_MIKROFON,
  ICON_SPERRE,
  ICON_TEXTDOKUMENT,
  ICON_UHRZEIT,
  ICON_VERBORGEN,
  ICON_VIDEO,
} from '../../shared/icons';
import { useJetztMitGrenzen } from '../../../hooks/useJetztMitGrenzen';
import { useDateiOeffnen } from '../../../hooks/useDateiOeffnen';
import { datumUhrzeit } from '../../../utils/dateUtils';
import { ROLLEN_NAMEN, rollenName } from '../../../utils/rollenNamen';
import { getAuthorLabel } from '../views/ChallengesView';
import type {
  KonfiChallenge,
  KonfiChallengeDetail,
  ChallengeSubmission,
  ChallengeMediaType
} from '../../../types/challenges';
import type { ChallengeDetailKonfiReiter } from '../../../seiten/challengeDetailKonfi';

// Was die Challenge-Seite der Konfis ableitet -- laeuft sie noch, wer darf
// einreichen, was steht unter welchem Reiter, wie lautet die Sichtbarkeit --
// an EINER Stelle fuer die Ansicht der App (KonfiChallengeDetailPage) und die
// Web-Fassung (konfi/web/challenges/WebKonfiChallengeDetail). Herausgezogen
// (03.10.2026, docs/planung/web-alle-bereiche.md, Entscheidung 2), ohne etwas
// an der Darstellung zu aendern.

/** Reiter im Challenge-Detail: Gruppen-Feed oder eigene Beitraege. */
export type KonfiReiter = ChallengeDetailKonfiReiter;

export const MEDIA_ICON: Record<ChallengeMediaType, string> = {
  text: ICON_TEXTDOKUMENT,
  photo: ICON_BILD,
  audio: ICON_MIKROFON,
  video: ICON_VIDEO,
  link: ICON_LINK
};

/**
 * Status als Icon-Corner-Badge für eigene Beitraege (Muster wie das
 * Warteliste-Badge bei Events: kompaktes, farbiges Icon-only-Badge statt
 * Text). Ausgeblendet schlägt alles; danach entscheidet die Sichtbarkeit
 * der Challenge bzw. die eigene Einwilligung. Label dient nur als Titel
 * (Tooltip/Barrierefreiheit), nicht als sichtbarer Text.
 */
export const getOwnStatus = (
  submission: ChallengeSubmission,
  challenge: KonfiChallenge
): { label: string; icon: string; color: string } => {
  if (submission.moderation_status === 'hidden') {
    return { label: 'Ausgeblendet', icon: ICON_ENTFERNEN, color: 'var(--app-color-danger)' };
  }
  if (submission.moderation_status === 'pending') {
    return { label: 'Wartet auf Freigabe', icon: ICON_UHRZEIT, color: 'var(--app-color-warning)' };
  }
  // approved
  if (challenge.visibility === 'private') {
    return { label: 'Nur Leitung', icon: ICON_SPERRE, color: 'var(--app-color-neutral)' };
  }
  // Anonym VOR der Sichtbarkeits-Unterscheidung: Die Leitung kann seit
  // 24.08.2026 auch Beitraege in public-Challenges nachtraeglich anonym
  // stellen — der Konsens allein entscheidet dann ueber die Namens-Anzeige.
  if (submission.konfi_consent === 'anonymous') {
    return { label: 'Anonym', icon: ICON_VERBORGEN, color: 'var(--app-color-wrapped)' };
  }
  if (challenge.visibility === 'public') {
    // Dunkleres Grün wie bei den aktiven Challenges — das helle Success-Grün
    // war hier zu grell (Nutzerentscheid 24.08.2026).
    return { label: 'Veröffentlicht', icon: ICON_HAKEN, color: 'var(--app-color-success-strong)' };
  }
  // konfi_choice -> eigene Entscheidung entscheidet
  if (submission.konfi_consent === 'publish') {
    return { label: 'Veröffentlicht', icon: ICON_HAKEN, color: 'var(--app-color-success-strong)' };
  }
  return { label: 'Nur Leitung', icon: ICON_SPERRE, color: 'var(--app-color-neutral)' };
};

export const formatDateTime = (value?: string): string => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return datumUhrzeit(d);
};

// Rollen-Kennzeichnung in der Galerie: Beitraege von Pastor:innen/Teamer:innen
// sollen als solche erkennbar sein, ohne sie hervorzuheben (gleichgewichtet).
// Die Woerter aus utils/rollenNamen; Konfis bekommen keins (dort steht der
// Jahrgang).
const galerieRolle = (roleName?: string | null): string | null =>
  roleName && ROLLEN_NAMEN[roleName] ? rollenName(roleName) : null;

// "Name · Teamer:in" bzw. "Name · Jahrgang 2026". Der Jahrgang hilft, wenn eine
// Challenge mehrere Jahrgänge umfasst (User-Entscheid 08.08.). Anonyme
// Beitraege liefert das Backend ohne Name/Rolle/Jahrgang -> nur "Anonym".
export const buildGalleryAuthorLabel = (submission: ChallengeSubmission): string => {
  const name = submission.konfi_name?.trim();
  if (!name) return 'Anonym';
  const roleLabel = galerieRolle(submission.role_name);
  const suffix = roleLabel || submission.jahrgang_name?.trim();
  return suffix ? `${name} · ${suffix}` : name;
};


/**
 * Was die Seite aus der Challenge und ihrem Detail ableitet. `current` darf
 * fehlen (die Web-Fassung ruft den Hook, solange die Seite noch laedt): Dann
 * laeuft nichts, und es darf nichts eingereicht werden.
 */
export function useKonfiChallengeAnsicht(current: KonfiChallenge | null, detail: KonfiChallengeDetail | null) {
  const author = current ? getAuthorLabel(current) : null;
  // „Läuft" folgt der Uhr, nicht nur den Daten: Beginn und Ende stellen einen
  // Wecker, der die Ansicht genau dann neu zeichnet. Bis 29.09.2026 hing der
  // Wert per useMemo an `current` — endete die Challenge bei offenem Detail,
  // blieb sie „laufend" samt Plus zum Einreichen (Release-Audit Toolchain
  // BF-12, Test challengeEndetBeiOffenemDetail).
  const startMs = current ? new Date(current.starts_at).getTime() : NaN;
  const endeMs = current ? new Date(current.ends_at).getTime() : NaN;
  const jetzt = useJetztMitGrenzen([startMs, endeMs + 1]);
  const isActive = !!current && !current.is_draft && jetzt >= startMs && jetzt <= endeMs;

  const [reiter, setReiter] = useState<KonfiReiter>('feed');
  const gallery = detail?.gallery || [];
  const ownSubmissions = detail?.own_submissions || [];

  const canSubmitMore = isActive && (!!current?.allow_multiple || ownSubmissions.length === 0);

  // Bei "nur Leitung" gibt es keine Gruppen-Galerie — dann steht immer der
  // eigene Reiter, unabhaengig davon, was zuletzt gewaehlt war.
  const effektiverReiter: KonfiReiter = current?.visibility === 'private' ? 'meins' : reiter;
  const sichtbareBeitraege = effektiverReiter === 'meins' ? ownSubmissions : gallery;

  // Ein Foto öffnen wie eine Chat-Datei: nativ mit Teilen und Sichern, sonst
  // im Betrachter, in dem sich durch die Fotos dieses Reiters wischen lässt.
  // Nur was die Liste gerade führt — ein ausgeblendeter oder gelöschter
  // Beitrag steht nicht darin und ist so auch nicht zu erreichen.
  const { dateiOeffnen } = useDateiOeffnen({
    quelle: 'challenges',
    fehlerOrt: 'challenge-datei',
    kontext: () => sichtbareBeitraege
      .filter((b) => b.media_type === 'photo' && b.file_path)
      .map((b) => ({ pfad: b.file_path!, name: b.file_name })),
  });

  // Kurzform der Sichtbarkeit für den Kopf: EIN knapper Halbsatz neben der
  // Laufzeit, damit beim Mitmachen sofort klar ist, wer den Beitrag zu sehen
  // bekommt (User-Hinweis 10.08.). Dieselbe Angabe steht zusätzlich in der
  // Meta-Zeile unter "Worum geht es".
  // Rollenneutral formulieren: Diese Ansicht gehört seit der Zusammenlegung
  // (11.08.) allein den Konfis — Teamer und Leitung nutzen
  // admin/views/ChallengeLeitungView. Der Text bleibt trotzdem neutral, weil hier früher
  // faelschlich "Nur für euch in der Leitung" stand (Audit 10.08.).
  const sichtbarkeit = current?.visibility;
  const moderiert = current?.moderated;
  const visibilityShort = useMemo(() => {
    if (sichtbarkeit === 'private') return 'Nur das Leitungsteam sieht die Beiträge';
    if (sichtbarkeit === 'public') return 'Für die Gruppe sichtbar';
    return 'Du entscheidest je Beitrag';
  }, [sichtbarkeit]);

  // Der Modus steht seit 24.08.2026 direkt unter "Worum geht es" in der
  // Meta-Zeile (Sichtbarkeit plus sofort/Freigabe) — der frühere eigene
  // "Hinweis"-Kasten ist dafür entfallen (Nutzerentscheid).
  const moderationShort = useMemo(() => {
    if (sichtbarkeit === 'private') return null; // sagt visibilityShort schon alles
    return moderiert ? 'Sichtbar nach Freigabe' : 'Sofort sichtbar';
  }, [sichtbarkeit, moderiert]);


  return {
    author,
    isActive,
    reiter,
    setReiter,
    gallery,
    ownSubmissions,
    canSubmitMore,
    effektiverReiter,
    sichtbareBeitraege,
    dateiOeffnen,
    visibilityShort,
    moderationShort,
  };
}
