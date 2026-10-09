import React, { useMemo } from 'react';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonSpinner,
  IonList,
  IonListHeader,
  IonLabel,
  IonCard,
  IonCardContent,
  IonSegment,
  IonSegmentButton,
  IonRefresher,
  IonRefresherContent,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  useIonActionSheet
} from '@ionic/react';
import {
  ICON_ALBEN,
  ICON_BEARBEITEN,
  ICON_CHALLENGE_GEFUELLT,
  ICON_HINZUFUEGEN,
  ICON_PERSON,
  ICON_TEILEN,
  ICON_TEXTDOKUMENT,
  ICON_UHRZEIT,
} from '../../shared/icons';
import { EmptyState, SectionHeader } from '../../shared';
import AppKopfzeile from '../../shared/AppKopfzeile';
import ChallengeMedium from '../../shared/ChallengeMedium';
import OfflinePlatzhalter from '../../shared/OfflinePlatzhalter';
import { triggerPullHaptic } from '../../../utils/haptics';
import { closeOpenSlidingItems } from '../../../utils/slidingItems';
import { istWebLink } from '../../../utils/linkDisplay';
import MusikLink from '../../shared/MusikLink';
import { anzahlBeitraege } from '../../../utils/challengeTexte';
import SegmentZahl from '../../shared/SegmentZahl';
import type {
  AdminChallenge,
  ChallengeSubmission
} from '../../../types/challenges';
import { datumUhrzeit } from '../../../utils/dateUtils';
import {
  CONSENT_BADGE,
  HINWEIS_OHNE_FREIGABERECHT,
  MEDIA_ICON,
  getStatusBadge,
  useChallengeLeitung,
  type StatusFilter
} from './useChallengeLeitung';
import { leerVon } from '../../../seiten/beschreibung';
import {
  CHALLENGE_DETAIL_FEED_WARTET,
  CHALLENGE_DETAIL_LEER_TITEL,
  CHALLENGE_DETAIL_LEITUNG_REITER,
  detailReiterFuer,
} from '../../../seiten/challengeDetailLeitung';

// VEREINTES Challenge-Detail für Leitung und Teamer:innen (11.08.): Verwalten
// UND Mitmachen in EINER Ansicht, statt eines Segments, das die ganze Seite
// umschaltet. Enthaelt die Moderation aus ChallengeModerationModal und den
// Abschnitt "Dein Beitrag" aus der Konfi-Detailansicht.
//
// Seit 2.4.0 eine eigene Seite statt eines Dialogs (Simon, 02.10.2026:
// "challenge nicht in modal öffnen, sondern in unterseite, damit man direkt
// auf die challenge linken kann aus einem push"). Die Challenge holt
// shared/ChallengeLeitungPage ueber ihre Adresse /admin/challenges/:id bzw.
// /teamer/challenges/:id und reicht sie hier herein; diese Ansicht laedt die
// Beitraege und traegt Moderation, eigenen Beitrag und Export.

// Untertitel im Kopf. Beide Angaben werden AUSDRUECKLICH benannt
// ("Sichtbarkeit: ..." / "Moderiert: ..."), weil die frühere Kurzform
// ("Für die Gruppe sichtbar · sofort") nicht erkennen liess, welcher Teil
// wofür stand (User-Hinweis 25.08.2026).
const buildVisibilitySubtitle = (challenge: AdminChallenge): string => {
  const sichtbarkeit = challenge.visibility === 'public'
    ? 'sofort sichtbar'
    : challenge.visibility === 'private'
      ? 'nur Leitung'
      : 'Konfi entscheidet';
  // Bei 'private' ist die Freigabe für die Gruppe bedeutungslos — dort gibt es
  // keine Galerie, in der etwas erscheinen könnte.
  if (challenge.visibility === 'private') return `Sichtbarkeit: ${sichtbarkeit}`;
  return `Sichtbarkeit: ${sichtbarkeit} · Moderiert: ${challenge.moderated ? 'ja' : 'nein'}`;
};

const formatDateTime = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return datumUhrzeit(d);
};

export interface ChallengeLeitungViewProps {
  // NULL-SICHER: Ein kaputter Cache-Eintrag kann ein undefined liefern. Das
  // darf hier NICHT werfen — ein Render-Fehler landet sonst in der
  // ErrorBoundary, die Auth + Cache leert ("Rauswurf zur Anmeldung").
  challenge?: AdminChallenge | null;
  /** Zurueck zur Liste (MainTabs: mit Verlauf zurueck, ohne auf die Liste). */
  onBack: () => void;
  /**
   * Öffnet das Bearbeiten-Formular für diese Challenge. In der Liste liegt
   * Bearbeiten bewusst nur auf dem Wisch (Tippen = Challenge öffnen) — wer die
   * Challenge schon geöffnet hat, soll dafür nicht zurück und wischen müssen
   * (Nutzerwunsch 24.08.2026). Der Knopf erscheint IMMER: auch nach dem Start
   * bleiben Titel, Beschreibung, Ende, Stempel und Jahrgänge änderbar; die
   * eingefrorenen Felder zeigt das Formular selbst als gesperrt.
   */
  onEdit?: (challenge: AdminChallenge) => void;
  // Wird nach jeder Moderations-Aktion und nach eigenem Einreichen gerufen,
  // damit die Liste dahinter (Pending-Zähler) aktuell bleibt.
  onChanged?: () => void;
  /**
   * Die IonPage der Seite drumherum (shared/ChallengeLeitungPage) -- fuer
   * die Card-Optik des Einreichen-Modals. Ohne dieses schiebt die Seite
   * darunter nicht nach hinten, das Sheet legt sich hart darueber
   * (User-Hinweis 11.08.).
   */
  seitenRef?: React.RefObject<HTMLElement | null>;
}

const ChallengeLeitungView: React.FC<ChallengeLeitungViewProps> = ({
  challenge,
  onBack,
  onEdit,
  onChanged,
  seitenRef
}) => {
  const [presentActionSheet] = useIonActionSheet();
  const {
    user,
    loading,
    offlineOhneStand,
    busyId,
    statusFilter,
    setStatusFilter,
    effectiveFilter,
    counts,
    status,
    canSubmitMore,
    filtered,
    dateiOeffnen,
    loadSubmissions,
    availableActions,
    darfFreigeben,
    handleExport,
    oeffneEinreichen,
  } = useChallengeLeitung({ challenge, onChanged, seitenRef });

  // GENAU DREI Kacheln — nie mehr (harte Gestaltungsregel).
  // "Freigegeben" steht immer. Die beiden anderen Plaetze gehen an das, was
  // gerade etwas aussagt:
  //   - "Wartet" nur bei Freigabe-Pflicht (sonst wartet nie etwas)
  //   - "Ausgeblendet" nur wenn es ausgeblendete Beitraege gibt
  // Sind beide relevant, weicht "Gesamt" — die Gesamtzahl steht ohnehin in der
  // Listenueberschrift ("Beiträge (8)") und ist die schwaechste der Angaben.
  const headerStats = useMemo(() => {
    // Reihenfolge wie im Feed gedacht: erst was zu sehen ist, dann was noch
    // wartet, dann was zurueckgehalten wurde (Nutzerwunsch 24.08.2026).
    // "Frei" war unklar — "Sichtbar" sagt, was die Gruppe erlebt, und bildet
    // mit "Ausgeblendet" ein Paar.
    //
    // Labels müssen KURZ sein: die Kachel ist auf 100px gedeckelt und das
    // Label steht in Grossbuchstaben mit Sperrung und ohne Umbruch
    // (.app-stats-row__label).
    const stats: Array<{ value: number; label: string }> = [
      { value: counts.approved, label: 'Sichtbar' }
    ];
    if (challenge?.moderated) stats.push({ value: counts.pending, label: 'Wartet' });
    // Bei "nur Leitung" gibt es keine Gruppen-Galerie und damit nichts
    // auszublenden — Kachel und Reiter entfallen (User-Entscheid 25.08.2026).
    if (challenge?.visibility !== 'private') {
      stats.push({ value: counts.hidden, label: 'Abgelehnt' });
    }

    // Ohne Freigabe-Pflicht bleiben nur zwei Kacheln — die Gesamtzahl fuellt
    // auf und beantwortet zugleich "wie viele Beitraege sind es insgesamt".
    // Einzahl korrekt: bei genau einem Beitrag hiess die Kachel "1 Beiträge"
    // (User-Hinweis). Der Helfer entscheidet, das Label traegt nur das Wort —
    // die Zahl steht schon als Kachelwert darueber.
    if (stats.length < 3) {
      stats.splice(1, 0, {
        value: counts.total,
        label: anzahlBeitraege(counts.total).replace(`${counts.total} `, '')
      });
    }

    // Kacheln, die einem Reiter entsprechen, schalten dorthin. "Gesamt" hat
    // keinen eigenen Reiter (die Reiter sind disjunkt) und bleibt reine Anzeige.
    const filterZuLabel: Record<string, StatusFilter> = {
      'Sichtbar': 'feed',
      'Wartet': 'pending',
      'Abgelehnt': 'hidden'
    };

    // effectiveFilter wird erst weiter unten deklariert — hier dieselbe
    // Ableitung, damit die aktive Kachel zum tatsaechlich wirksamen Reiter passt.
    const aktiverFilter: StatusFilter =
      (statusFilter === 'pending' && !challenge?.moderated) ||
      (statusFilter === 'hidden' && challenge?.visibility === 'private')
        ? 'feed' : statusFilter;

    return stats.slice(0, 3).map((s) => {
      const ziel = filterZuLabel[s.label];
      if (!ziel) return s;
      return { ...s, onClick: () => setStatusFilter(ziel), active: aktiverFilter === ziel };
    });
    // challenge?.visibility gehoert in die Abhaengigkeiten: Die Sichtbarkeit
    // ist in der OFFENEN Challenge aenderbar (Bearbeiten-Knopf; die Seite
    // drumherum, shared/ChallengeLeitungPage, laedt die Challenge danach neu). Ohne sie blieb die
    // "Abgelehnt"-Kachel nach dem Umstellen auf "nur Leitung" stehen,
    // solange sich counts und Filter nicht aenderten (Befund 30.08.2026).
  }, [challenge?.moderated, challenge?.visibility, counts, statusFilter]);

  // Tippen auf einen Beitrag oeffnet die Aktionen — dasselbe Muster wie in den
  // uebrigen Listen (Events, Konfis).
  const openActions = (submission: ChallengeSubmission) => {
    const actions = availableActions(submission);
    presentActionSheet({
      header: submission.konfi_name || 'Beitrag',
      buttons: [
        ...actions.map((a) => ({
          text: a.text,
          role: a.role,
          handler: () => { a.run(); }
        })),
        { text: 'Abbrechen', role: 'cancel' }
      ]
    });
  };

  // Nach den Hooks (Hook-Reihenfolge!): ohne Challenge nichts rendern statt werfen.
  if (!challenge) {
    return null;
  }

  // KEINE EIGENE IonPage: Kopfzeile und Inhalt stehen in der IonPage der
  // Seite (shared/ChallengeLeitungPage), die je Route genau einmal montiert
  // wird -- auch waehrend sie noch laedt. Ein Tausch der IonPage bliebe dem
  // IonRouterOutlet verborgen, die Seite weiss (MainTabs.tsx, SeiteMitChunk).
  return (
    <>
      {/* Die gemeinsame Kopfzeile wie auf jeder Seite, mit Zurueck statt des
          frueheren Schliessen-Kreuzes. Rechts stehen drei Knoepfe; fuer
          Gemeinde-Umschalter und Glocke ist daneben kein Platz -- beides
          steht auf der Liste davor (AppKopfzeile: "in einer Detailansicht,
          in der rechts der Platz knapp ist"). */}
      <AppKopfzeile
        titel="Challenge"
        onZurueck={onBack}
        gemeindeUmschalter={false}
        glocke={false}
        rechts={(
          <>
            {/* Stammdaten bearbeiten — oben in der Leiste, weil der Wisch in
                der Liste schwer zu entdecken ist (Nutzerwunsch 24.08.2026). */}
            {onEdit && (
              <IonButton
                onClick={() => onEdit(challenge)}
                title="Challenge bearbeiten"
                aria-label="Challenge bearbeiten"
              >
                <IonIcon icon={ICON_BEARBEITEN} slot="icon-only" />
              </IonButton>
            )}
            {/* Selbst mitmachen — nur solange die Challenge laeuft */}
            {canSubmitMore && (
              <IonButton
                onClick={oeffneEinreichen}
                title="Beitrag einreichen"
                aria-label="Beitrag einreichen"
              >
                <IonIcon icon={ICON_HINZUFUEGEN} slot="icon-only" />
              </IonButton>
            )}
            <IonButton onClick={handleExport} title="Beiträge exportieren" aria-label="Beiträge exportieren">
              <IonIcon icon={ICON_TEILEN} slot="icon-only" />
            </IonButton>
          </>
        )}
      />

      <IonContent className="app-gradient-background" fullscreen>
        <IonRefresher
          slot="fixed"
          onIonRefresh={async (e) => { await loadSubmissions(); e.detail.complete(); }}
          onIonPull={triggerPullHaptic}
        >
          <IonRefresherContent />
        </IonRefresher>

        {/* Kopf: Challenge-Info — IMMER GENAU DREI Kacheln (harte Regel). */}
        <SectionHeader
          title={challenge.title}
          subtitle={buildVisibilitySubtitle(challenge)}
          icon={ICON_CHALLENGE_GEFUELLT}
          preset="challenges"
          stats={headerStats}
        />

        {/* Aufgabentext als CARD wie in der Konfi-Sicht (User-Entscheid
            11.08.): der rote Infokasten war fuer den Haupttext zu laut, die
            Karte mit Meta-Zeile liest sich ruhiger. Aufbau bewusst identisch
            zur Konfi-Seite (konfi/pages/KonfiChallengeDetailPage). */}
        {challenge.description && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--challenges">
                <IonIcon icon={ICON_TEXTDOKUMENT} />
              </div>
              <IonLabel>{status === 'ended' ? 'Worum ging es?' : 'Worum geht es?'}</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: 'var(--app-abstand-mittelweit)' }}>
                <div style={{ fontSize: 'var(--app-text-basis)', lineHeight: 1.5, color: 'var(--app-text-ios)', whiteSpace: 'pre-wrap' }}>
                  {challenge.description}
                </div>
                <div
                  style={{
                    display: 'flex', flexWrap: 'wrap', gap: 'var(--app-abstand-eng) var(--app-abstand-mittelweit)',
                    marginTop: 'var(--app-abstand-mittel)', fontSize: 'var(--app-text-hinweis)', color: 'var(--app-text-system)'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-mini)' }}>
                    <IonIcon icon={ICON_UHRZEIT} className="app-icon-color--challenges" />
                    {status === 'draft' && 'Entwurf — noch nicht veröffentlicht'}
                    {status === 'scheduled' && 'Startet erst noch'}
                    {status === 'active' && 'Läuft gerade'}
                    {status === 'ended' && 'Beendet'}
                  </span>
                  {(challenge.author_name || challenge.author_freetext) && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-mini)' }}>
                      <IonIcon icon={ICON_PERSON} className="app-icon-color--challenges" />
                      Gestellt von {challenge.author_name || challenge.author_freetext}
                    </span>
                  )}
                </div>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Moderation: Filter + alle Beitraege.
            Die Leiste erscheint nur, wenn es ueberhaupt etwas zu waehlen gibt.
            Bei "nur Leitung" ohne Freigabe-Pflicht bliebe sonst eine Leiste
            mit dem einzigen Knopf "Feed" stehen — ein Sortiermodus ohne
            Auswahl (User-Hinweis 26.08.2026). */}
        <div style={{ margin: 'var(--app-abstand-basis) var(--app-abstand-basis) var(--app-abstand-eng) var(--app-abstand-basis)' }}>
          <IonSegment value={effectiveFilter} onIonChange={(e) => setStatusFilter(e.detail.value as StatusFilter)}>
            {/* "Feed" zeigt nur Freigegebenes — denselben Blick, den die
                Konfis auf die Galerie haben. Wartendes/Ausgeblendetes steht
                ausschliesslich in den eigenen Reitern. */}
            {/* Reiter aus der gemeinsamen Beschreibung (seiten/challengeDetailLeitung.ts):
                "Wartet" nur mit Freigabe-Pflicht, "Abgelehnt" nicht bei "nur Leitung".
                Orange Zahl an "Wartet" wie am Umschalter Aktuell/Geplant/Archiv
                (SegmentZahl, Simon 29.09.2026); bei 0 steht keine Zahl. */}
            {detailReiterFuer(challenge).map((r) => (
              <IonSegmentButton key={r.schluessel} value={r.schluessel}>
                <IonLabel>
                  {r.kurz ?? r.label}
                  {r.zahlText && <SegmentZahl anzahl={counts.pending} label={r.zahlText(counts.pending)} />}
                </IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>
        </div>

        {/* Ohne das Recht "Challenge-Beiträge freigeben": lesen ja,
            moderieren nein -- und der Grund steht da. */}
        {!darfFreigeben && (
          <IonList inset={true} style={{ margin: 'var(--app-abstand-basis)' }}>
            <IonCard className="app-card">
              <IonCardContent className="app-info-box app-info-box--blue">
                {HINWEIS_OHNE_FREIGABERECHT}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--app-abstand-block)' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : offlineOhneStand ? (
          <OfflinePlatzhalter was="Die Liste der Beiträge" />
        ) : (
          <IonList inset={true} style={{ margin: 'var(--app-abstand-basis)' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--challenges">
                <IonIcon icon={ICON_ALBEN} />
              </div>
              <IonLabel>{anzahlBeitraege(filtered.length)}</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: filtered.length === 0 ? 'var(--app-abstand-basis)' : 'var(--app-abstand-mittel)' }}>
                {filtered.length === 0 ? (
                  <EmptyState
                    icon={ICON_ALBEN}
                    title={CHALLENGE_DETAIL_LEER_TITEL}
                    message={
                      effectiveFilter === 'feed' && counts.pending > 0
                        ? CHALLENGE_DETAIL_FEED_WARTET
                        : leerVon(CHALLENGE_DETAIL_LEITUNG_REITER, effectiveFilter)
                    }
                    iconColor="var(--app-color-challenges)"
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-schmal)' }}>
                    {filtered.map((submission) => {
                      const status = getStatusBadge(submission, challenge);
                      const consent = submission.konfi_consent ? CONSENT_BADGE[submission.konfi_consent] : null;
                      const isBusy = busyId === submission.id;
                      // Eigener Beitrag: frueher stand er zusaetzlich in einem
                      // eigenen Block oben — also doppelt. Jetzt steht er nur
                      // hier im Feed, dafuer deutlich hervorgehoben
                      // (User-Hinweis 26.08.2026).
                      const istEigener = Boolean(user?.id) && submission.user_id === user?.id;

                      const actions = availableActions(submission);

                      return (
                        <IonItemSliding key={submission.id} disabled={isBusy}>
                          <IonItem
                            button
                            onClick={() => !isBusy && openActions(submission)}
                            detail={false}
                            lines="none"
                            style={{
                              '--background': 'transparent',
                              '--padding-start': '0',
                              '--padding-end': '0',
                              '--inner-padding-end': '0',
                              '--inner-border-width': '0',
                              '--border-style': 'none',
                              '--min-height': 'auto'
                            }}
                          >
                            <div
                              className="app-list-item app-list-item--challenges"
                              style={{
                                width: '100%',
                                borderLeftColor: status.color,
                                marginBottom: '0',
                                display: 'block',
                                position: 'relative',
                                overflow: 'hidden',
                                opacity: submission.moderation_status === 'hidden' ? 0.75 : 1,
                                // Eigener Beitrag: zarter Grund in der
                                // Bereichsfarbe. Ein Rahmen war zu laut —
                                // Farbe und die Zeile "Dein Beitrag" reichen
                                // (User-Hinweis 26.08.2026).
                                ...(istEigener ? {
                                  background: 'rgba(var(--app-color-challenges-rgb), 0.06)'
                                } : {})
                              }}
                            >
                              {/* Corner-Badges: Konsens + Status (max. 2) */}
                              <div className="app-corner-badges">
                                {consent && (
                                  <>
                                    <div
                                      className="app-corner-badge"
                                      style={{ backgroundColor: consent.color, padding: 'var(--app-abstand-mini) var(--app-abstand-kompakt)' }}
                                      title={consent.label}
                                      role="img"
                                      aria-label={consent.label}
                                    >
                                      <IonIcon icon={consent.icon} style={{ color: 'white', fontSize: 'var(--app-text-sekundaer)', display: 'block' }} />
                                    </div>
                                    <div className="app-corner-badges__separator" />
                                  </>
                                )}
                                <div
                                  className="app-corner-badge"
                                  style={{ backgroundColor: status.color, padding: 'var(--app-abstand-mini) var(--app-abstand-kompakt)' }}
                                  title={status.label}
                                  role="img"
                                  aria-label={status.label}
                                >
                                  <IonIcon icon={status.icon} style={{ color: 'white', fontSize: 'var(--app-text-sekundaer)', display: 'block' }} />
                                </div>
                              </div>

                              {/* Kopfzeile: Konfi + Zeit */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-schmal)', marginBottom: 'var(--app-abstand-eng)', paddingRight: 'var(--app-freiraum-aktion-m)' }}>
                                <div className="app-icon-circle app-icon-circle--lg" style={{ backgroundColor: status.color }}>
                                  <IonIcon icon={MEDIA_ICON[submission.media_type] || ICON_TEXTDOKUMENT} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="app-list-item__title">
                                    {submission.konfi_name || 'Unbekannt'}
                                  </div>
                                  {/* Eigener Beitrag: eigene Zeile statt an den
                                      Namen gehaengt — bei langen Namen wurde
                                      der Zusatz sonst abgeschnitten
                                      ("Pastorin Kathrin Moeller · D..."). */}
                                  {istEigener && (
                                    <div style={{
                                      fontSize: 'var(--app-text-hinweis)', fontWeight: 'var(--app-schrift-fett)',
                                      color: 'var(--app-text-challenges)',
                                      textTransform: 'uppercase', letterSpacing: '0.03em'
                                    }}>
                                      Dein Beitrag
                                    </div>
                                  )}
                                  <div className="app-list-item__subtitle">
                                    {submission.jahrgang_name ? `${submission.jahrgang_name} · ` : ''}
                                    {formatDateTime(submission.created_at)}
                                  </div>
                                </div>
                              </div>

                              {/* Inhalt */}
                              {submission.text_content && (
                                <div style={{ fontSize: 'var(--app-text-basis)', color: 'var(--app-text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                                  {submission.text_content}
                                </div>
                              )}

                              {submission.media_type === 'link' && istWebLink(submission.link_url) && (
                                <MusikLink submission={submission} />
                              )}

                              {/* Begruendung des Ausblendens UNTER dem Beitrag —
                                  gleiche Form wie bei Aktivitaeten
                                  (app-reason-box, User-Hinweis 26.08.2026).
                                  Bleibt fuer die Leitung nachvollziehbar, bis
                                  der Beitrag wieder eingeblendet wird. */}
                              {submission.moderation_status === 'hidden' && submission.moderation_note && (
                                <div className="app-reason-box app-reason-box--danger">
                                  <span className="app-reason-box__label" style={{ fontSize: 'var(--app-text-meta)' }}>
                                    Grund der Ablehnung
                                  </span>
                                  <p style={{ margin: 'var(--app-abstand-winzig) 0 0 0', fontSize: 'var(--app-text-hinweis)', lineHeight: 1.4 }}>
                                    {submission.moderation_note}
                                  </p>
                                </div>
                              )}

                              {submission.file_path && (submission.media_type === 'photo' || submission.media_type === 'audio' || submission.media_type === 'video') && (
                                // Audio-/Video-Steuerung braucht ihre eigenen Klicks
                                // (Play, Scrubben) — ohne diesen Stopper landet jeder
                                // Griff zum Player im Aktions-Menue des Items.
                                <div role="presentation" onClick={(e) => e.stopPropagation()}>
                                  <ChallengeMedium
                                    filePath={submission.file_path}
                                    fileName={submission.file_name}
                                    mediaType={submission.media_type}
                                    maxHoehe={260}
                                    onOeffnen={(pfad, name) => { void dateiOeffnen(pfad, name); }}
                                  />
                                </div>
                              )}

                              {isBusy && (
                                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--app-abstand-schmal)' }}>
                                  <IonSpinner name="crescent" />
                                </div>
                              )}
                            </div>
                          </IonItem>

                          <IonItemOptions side="end" className="app-swipe-actions">
                            {actions.map((action) => (
                              <IonItemOption
                                key={action.key}
                                // Zuerst das aufgewischte Element schliessen,
                                // sonst bleibt die Zeile offen stehen, während
                                // die Aktion läuft (User-Hinweis 11.08.).
                                onClick={() => { closeOpenSlidingItems(); action.run(); }}
                                className="app-swipe-action"
                                aria-label={action.text}
                              >
                                <div
                                  className="app-icon-circle app-icon-circle--lg"
                                  style={{ backgroundColor: action.color }}
                                  title={action.text}
                                >
                                  <IonIcon icon={action.icon} />
                                </div>
                              </IonItemOption>
                            ))}
                          </IonItemOptions>
                        </IonItemSliding>
                      );
                    })}
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        <div className="ion-padding-bottom" />
      </IonContent>
    </>
  );
};

export default ChallengeLeitungView;
