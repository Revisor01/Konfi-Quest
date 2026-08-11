import React, { useState, useMemo } from 'react';
import {
  IonIcon,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonList,
  IonListHeader,
  IonCard,
  IonCardContent,
  useIonModal
} from '@ionic/react';
import {
  flag,
  createOutline,
  trashOutline,
  albumsOutline,
  calendarOutline,
  timeOutline,
  peopleOutline,
  eyeOutline,
  eyeOffOutline,
  archiveOutline,
  ribbonOutline,
  paperPlaneOutline
} from 'ionicons/icons';
import { SectionHeader, ListSection, ChallengeLegendModal, EmptyState } from '../../shared';
import { getChallengeBadgeIcon } from '../../konfi/views/ChallengesView';
import type { AdminChallenge, ChallengeStatus, ChallengeMark } from '../../../types/challenges';
import { closeOpenSlidingItems } from '../../../utils/slidingItems';

// Gemeinsame Verwaltungs-Ansicht fuer Admin UND Teamer. Bewusst ohne eigenen
// Datenzugriff: Laden/Modale liegen in der jeweiligen Seite, hier nur Darstellung
// und Filter — so teilen sich AdminChallengesPage und TeamerChallengesPage
// exakt dieselbe UI (keine Kopie).

interface ChallengesManageViewProps {
  challenges: AdminChallenge[];
  onSelectChallenge: (challenge: AdminChallenge) => void;
  onEditChallenge: (challenge: AdminChallenge) => void;
  onDeleteChallenge: (challenge: AdminChallenge) => void;
  // Fuer Card-Modal-Optik der Legende (Sheet ueber der Seite statt Vollbild).
  presentingElement?: HTMLElement | null;
  // Zusaetzlicher Inhalt DIREKT UNTER dem SectionHeader (Verwalten|Mitmachen der
  // Page) — gleiches Muster wie EventsView/RequestsView, damit der Switcher das
  // Design nicht zerreisst (User-Feedback 09.08.).
  headerSlot?: React.ReactNode;
  /**
   * Eigene Abzeichen der angemeldeten Person. Seit der Zusammenlegung von
   * "Verwalten" und "Mitmachen" (11.08.) zeigt diese Liste auch die eigene
   * Teilnahme — Leitung und Team machen selbst mit.
   */
  marks?: ChallengeMark[];
}

// Status wird NICHT gespeichert, sondern aus is_draft/starts_at/ends_at abgeleitet
// (siehe Datenmodell). Dieselbe Logik nutzt auch das Backend.
export const getChallengeStatus = (challenge: AdminChallenge): ChallengeStatus => {
  if (challenge.is_draft) return 'draft';
  const now = Date.now();
  const start = new Date(challenge.starts_at).getTime();
  const end = new Date(challenge.ends_at).getTime();
  if (now < start) return 'scheduled';
  if (now > end) return 'ended';
  return 'active';
};

const STATUS_LABEL: Record<ChallengeStatus, string> = {
  draft: 'Entwurf',
  scheduled: 'Geplant',
  active: 'Aktiv',
  ended: 'Beendet'
};

const STATUS_COLOR: Record<ChallengeStatus, string> = {
  draft: '#8e8e93',
  scheduled: '#007aff',
  active: '#059669',
  ended: '#6b7280'
};

// Jeder Status hat sein EIGENES Icon (User-Feedback 07.08.: vier Mal Flagge
// hilft niemandem). Muss mit ChallengeLegendModal uebereinstimmen.
const STATUS_ICON: Record<ChallengeStatus, string> = {
  draft: createOutline,
  scheduled: calendarOutline,
  active: flag,
  ended: archiveOutline
};

const VISIBILITY_LABEL: Record<string, string> = {
  public: 'Öffentlich',
  konfi_choice: 'Konfi entscheidet',
  // Meta-Zeile der Liste: knapp halten, aber dieselbe Aussage wie in der
  // Anlage ("Nur für euch in der Leitung") — nicht "nicht öffentlich", das
  // sagte nur, was es NICHT ist (User-Hinweis 10.08.).
  private: 'Nur Leitung'
};

// Teilnahme-Kreis (Migration 121). 'konfis' ist der Normalfall und wird in der
// Meta-Zeile NICHT angezeigt — nur die Abweichungen sind erwaehnenswert.
const AUDIENCE_LABEL: Record<string, string> = {
  konfis_und_team: 'Konfis und Team',
  nur_team: 'Nur Team'
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// 'upcoming' fasst 'scheduled' und 'draft' zusammen (User-Entscheid 10.08.:
// fuenf Segmente waren zu viel) — beides ist "noch nicht gelaufen".
type FilterValue = 'all' | 'active' | 'upcoming' | 'ended';

const ChallengesManageView: React.FC<ChallengesManageViewProps> = ({
  challenges: challengesRaw,
  onSelectChallenge,
  onEditChallenge,
  onDeleteChallenge,
  presentingElement,
  headerSlot,
  marks: marksRaw = []
}) => {
  const marks: ChallengeMark[] = Array.isArray(marksRaw) ? marksRaw : [];
  // Defensive: bei kaputten/gecachten Responses (Object statt Array) auf [] fallen
  const challenges: AdminChallenge[] = Array.isArray(challengesRaw) ? challengesRaw : [];

  const [presentLegend, dismissLegend] = useIonModal(ChallengeLegendModal, {
    onClose: () => dismissLegend(),
  });

  const [statusFilter, setStatusFilter] = useState<FilterValue>('all');

  // Offene Freigaben erscheinen NICHT mehr als vierte Kachel — die Anzeige
  // laeuft ueber das Tab-Badge (BadgeContext, wie Chat) und den orangen
  // Corner-Badge am jeweiligen Listeneintrag.
  const counts = useMemo(() => {
    const byStatus: Record<ChallengeStatus, number> = { draft: 0, scheduled: 0, active: 0, ended: 0 };
    challenges.forEach((c) => {
      byStatus[getChallengeStatus(c)] += 1;
    });
    return byStatus;
  }, [challenges]);

  const filtered = useMemo(() => {
    let result = [...challenges];
    if (statusFilter === 'upcoming') {
      result = result.filter((c) => {
        const s = getChallengeStatus(c);
        return s === 'scheduled' || s === 'draft';
      });
    } else if (statusFilter !== 'all') {
      result = result.filter((c) => getChallengeStatus(c) === statusFilter);
    }
    // Sortierung: aktive zuerst, dann geplante, Entwuerfe, zuletzt Archiv.
    const order: Record<ChallengeStatus, number> = { active: 0, scheduled: 1, draft: 2, ended: 3 };
    return result.sort((a, b) => {
      const diff = order[getChallengeStatus(a)] - order[getChallengeStatus(b)];
      if (diff !== 0) return diff;
      return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
    });
  }, [challenges, statusFilter]);

  return (
    <>
      <SectionHeader
        title="Challenges"
        subtitle="Anlegen, begleiten, mitmachen"
        icon={flag}
        preset="challenges"
        stats={[
          { value: counts.active, label: 'Aktiv' },
          { value: counts.scheduled, label: 'Geplant' },
          { value: counts.draft, label: 'Entwürfe' }
        ]}
        onInfo={() => presentLegend({ presentingElement: presentingElement || undefined })}
      />

      {headerSlot}

      <div style={{ margin: '16px 16px 8px 16px' }}>
        <IonSegment
          value={statusFilter}
          onIonChange={(e) => setStatusFilter(e.detail.value as FilterValue)}
        >
          <IonSegmentButton value="all">
            <IonLabel>Alle</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="active">
            <IonLabel>Aktiv</IonLabel>
          </IonSegmentButton>
          {/* Geplant und Entwurf zusammen: beides ist "noch nicht gelaufen",
              die Unterscheidung zeigt das Status-Badge am Eintrag. */}
          <IonSegmentButton value="upcoming">
            <IonLabel>Geplant</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="ended">
            <IonLabel>Archiv</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </div>

      <ListSection
        icon={flag}
        title="Challenges"
        count={filtered.length}
        iconColorClass="challenges"
        isEmpty={filtered.length === 0}
        emptyIcon={flag}
        emptyTitle="Keine Challenges vorhanden"
        emptyMessage="Lege eine Challenge an, damit deine Konfis eigene Beiträge einreichen können"
        emptyIconColor="#be185d"
      >
        {filtered.map((challenge, index) => {
          const status = getChallengeStatus(challenge);
          const statusColor = STATUS_COLOR[status];
          const isArchived = status === 'ended';
          const pending = challenge.pending_count || 0;

          return (
            <IonItemSliding
              key={challenge.id}
              style={{ marginBottom: index < filtered.length - 1 ? '8px' : '0' }}
            >
              <IonItem
                button
                onClick={() => onSelectChallenge(challenge)}
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
                    borderLeftColor: statusColor,
                    opacity: isArchived ? 0.7 : 1,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div className="app-corner-badges">
                    {pending > 0 && (
                      <>
                        <div
                          className="app-corner-badge"
                          style={{ backgroundColor: '#ff9500' }}
                          title="Beiträge warten auf Freigabe"
                        >
                          {pending} offen
                        </div>
                        <div className="app-corner-badges__separator" />
                      </>
                    )}
                    {/* Eigener Beitrag vorhanden — dasselbe Papierflieger-Badge
                        wie in der Konfi-Sicht (11.08.). */}
                    {challenge.has_badge && (
                      <>
                        <div
                          className="app-corner-badge app-corner-badge--queue"
                          style={{ backgroundColor: 'var(--app-color-challenges)' }}
                          title="Du hast bereits eingereicht"
                        >
                          <IonIcon icon={paperPlaneOutline} />
                        </div>
                        <div className="app-corner-badges__separator" />
                      </>
                    )}
                    {/* Status als Symbol-Badge (wie in der Moderation), Legende erklaert */}
                    <div
                      className="app-corner-badge"
                      style={{ backgroundColor: statusColor, padding: '4px 6px' }}
                      title={STATUS_LABEL[status]}
                    >
                      <IonIcon icon={STATUS_ICON[status]} style={{ color: '#fff', fontSize: '0.85rem', display: 'block' }} />
                    </div>
                  </div>

                  <div className="app-list-item__row">
                    <div className="app-list-item__main">
                      <div
                        className="app-icon-circle app-icon-circle--lg"
                        style={{ backgroundColor: statusColor }}
                      >
                        <IonIcon icon={STATUS_ICON[status]} />
                      </div>

                      <div className="app-list-item__content">
                        <div
                          className="app-list-item__title"
                          style={{
                            color: isArchived ? '#999' : undefined,
                            paddingRight: pending > 0 ? '130px' : '80px'
                          }}
                        >
                          {challenge.title}
                        </div>

                        <div
                          className="app-list-item__subtitle"
                          style={{
                            color: isArchived ? '#999' : '#666',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {challenge.description}
                        </div>

                        <div className="app-list-item__meta">
                          <span className="app-list-item__meta-item">
                            <IonIcon icon={calendarOutline} className="app-icon-color--challenges" />
                            {formatDate(challenge.starts_at)}
                          </span>
                          <span className="app-list-item__meta-item">
                            <IonIcon icon={timeOutline} className="app-icon-color--muted" />
                            bis {formatDate(challenge.ends_at)}
                          </span>
                          <span className="app-list-item__meta-item">
                            <IonIcon icon={albumsOutline} className="app-icon-color--challenges" />
                            {challenge.submission_count || 0} Beiträge
                          </span>
                          <span className="app-list-item__meta-item">
                            <IonIcon
                              icon={challenge.visibility === 'private' ? eyeOffOutline : eyeOutline}
                              className="app-icon-color--muted"
                            />
                            {VISIBILITY_LABEL[challenge.visibility] || challenge.visibility}
                          </span>
                          {challenge.audience && AUDIENCE_LABEL[challenge.audience] && (
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={peopleOutline} className="app-icon-color--teamer" />
                              {AUDIENCE_LABEL[challenge.audience]}
                            </span>
                          )}
                          {challenge.jahrgaenge && challenge.jahrgaenge.length > 0 && (
                            <span
                              className="app-list-item__meta-item"
                              style={{ maxWidth: '100%' }}
                              title={challenge.jahrgaenge.map((j) => j.name).join(', ')}
                            >
                              <IonIcon icon={peopleOutline} className="app-icon-color--jahrgang" />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {challenge.jahrgaenge.length > 2
                                  ? `${challenge.jahrgaenge.length} Jahrgänge`
                                  : challenge.jahrgaenge.map((j) => j.name).join(', ')}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </IonItem>

              {/* BEWUSSTE AUSNAHME von "Tippen = bearbeiten": Tippen oeffnet
                  hier die Beitraege (Moderation) — das ist die taegliche
                  Arbeit an einer Challenge, das Aendern der Stammdaten die
                  Ausnahme. Deshalb liegt Bearbeiten hier auf dem Wisch.
                  Ueberall sonst gilt: Tippen = bearbeiten, Wischen = loeschen. */}
              <IonItemOptions side="end" className="app-swipe-actions">
                <IonItemOption
                  onClick={() => { closeOpenSlidingItems(); onEditChallenge(challenge); }}
                  aria-label="Challenge bearbeiten"
                  className="app-swipe-action"
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--challenges">
                    <IonIcon icon={createOutline} />
                  </div>
                </IonItemOption>
                <IonItemOption
                  onClick={() => { closeOpenSlidingItems(); onDeleteChallenge(challenge); }}
                  aria-label="Challenge löschen"
                  className="app-swipe-action"
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                    <IonIcon icon={trashOutline} />
                  </div>
                </IonItemOption>
              </IonItemOptions>
            </IonItemSliding>
          );
        })}
      </ListSection>

      {/* Eigene Abzeichen — dieselbe Reihe wie in der Konfi-Sicht. Seit der
          Zusammenlegung von "Verwalten" und "Mitmachen" (11.08.) ist das Team
          hier nicht mehr nur Verwaltung, sondern nimmt selbst teil.
          IMMER anzeigen, auch leer: war der Abschnitt bei 0 Abzeichen
          ausgeblendet, sah man nie, dass es ihn ueberhaupt gibt — und damit
          auch nicht, dass Mitmachen vorgesehen ist (User-Hinweis 11.08.). */}
      <IonList inset={true} style={{ margin: '16px' }}>
          <IonListHeader>
            <div className="app-section-icon app-section-icon--challenges">
              <IonIcon icon={ribbonOutline} />
            </div>
            <IonLabel>Deine Abzeichen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: marks.length === 0 ? '16px' : '16px 12px' }}>
              {marks.length === 0 ? (
                <EmptyState
                  icon={ribbonOutline}
                  title="Noch keine Abzeichen"
                  message="Mach selbst bei einer Challenge mit — tippe sie an und reiche oben über das Plus deinen Beitrag ein."
                  iconColor="var(--app-color-challenges)"
                />
              ) : (
              <div
                style={{
                  display: 'flex', gap: '14px', overflowX: 'auto',
                  paddingBottom: '4px', WebkitOverflowScrolling: 'touch'
                }}
              >
                {marks.map((mark) => (
                  <div
                    key={mark.challenge_id}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: '6px', minWidth: '74px', maxWidth: '92px', flexShrink: 0
                    }}
                  >
                    <div
                      style={{
                        width: '52px', height: '52px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--app-color-challenges) 0%, #be123c 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(var(--app-color-challenges-rgb), 0.35)'
                      }}
                    >
                      <IonIcon
                        icon={getChallengeBadgeIcon(mark.badge_icon)}
                        style={{ fontSize: '1.5rem', color: 'white' }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: '0.72rem', fontWeight: 600, color: '#3c3c43',
                        textAlign: 'center', lineHeight: 1.2
                      }}
                    >
                      {mark.badge_name}
                    </div>
                  </div>
                ))}
              </div>
              )}
            </IonCardContent>
          </IonCard>
      </IonList>
    </>
  );
};

export default ChallengesManageView;
export { STATUS_LABEL, STATUS_COLOR, STATUS_ICON, VISIBILITY_LABEL };
