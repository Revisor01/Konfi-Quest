import React, { useState, useMemo } from 'react';
import {
  IonIcon,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonSegment,
  IonSegmentButton,
  IonLabel
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
  eyeOffOutline
} from 'ionicons/icons';
import { SectionHeader, ListSection, StatusBadge } from '../../shared';
import type { AdminChallenge, ChallengeStatus } from '../../../types/challenges';

// Gemeinsame Verwaltungs-Ansicht fuer Admin UND Teamer. Bewusst ohne eigenen
// Datenzugriff: Laden/Modale liegen in der jeweiligen Seite, hier nur Darstellung
// und Filter — so teilen sich AdminChallengesPage und TeamerChallengesPage
// exakt dieselbe UI (keine Kopie).

interface ChallengesManageViewProps {
  challenges: AdminChallenge[];
  onSelectChallenge: (challenge: AdminChallenge) => void;
  onEditChallenge: (challenge: AdminChallenge) => void;
  onDeleteChallenge: (challenge: AdminChallenge) => void;
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

const VISIBILITY_LABEL: Record<string, string> = {
  public: 'Öffentlich',
  konfi_choice: 'Konfi entscheidet',
  private: 'Nicht öffentlich'
};

const TYPE_LABEL: Record<string, string> = {
  wahrnehmung: 'Wahrnehmung',
  beitrag: 'Beitrag',
  praxis: 'Praxis',
  frei: 'Frei'
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

type FilterValue = 'all' | ChallengeStatus;

const ChallengesManageView: React.FC<ChallengesManageViewProps> = ({
  challenges: challengesRaw,
  onSelectChallenge,
  onEditChallenge,
  onDeleteChallenge
}) => {
  // Defensive: bei kaputten/gecachten Responses (Object statt Array) auf [] fallen
  const challenges: AdminChallenge[] = Array.isArray(challengesRaw) ? challengesRaw : [];

  const [statusFilter, setStatusFilter] = useState<FilterValue>('all');

  const counts = useMemo(() => {
    const byStatus: Record<ChallengeStatus, number> = { draft: 0, scheduled: 0, active: 0, ended: 0 };
    let pending = 0;
    challenges.forEach((c) => {
      byStatus[getChallengeStatus(c)] += 1;
      pending += c.pending_count || 0;
    });
    return { ...byStatus, pending };
  }, [challenges]);

  const filtered = useMemo(() => {
    let result = [...challenges];
    if (statusFilter !== 'all') {
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
        subtitle="Aufgaben stellen und Beiträge begleiten"
        icon={flag}
        colors={{ primary: '#be185d', secondary: '#831843' }}
        stats={[
          { value: counts.active, label: 'Aktiv' },
          { value: counts.scheduled, label: 'Geplant' },
          { value: counts.draft, label: 'Entwürfe' },
          { value: counts.pending, label: 'Zu prüfen' }
        ]}
      />

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
          <IonSegmentButton value="scheduled">
            <IonLabel>Geplant</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="draft">
            <IonLabel>Entwurf</IonLabel>
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
          // Backend liefert den aufgeloesten Urheber als author_name
          // (COALESCE aus users.display_name und author_freetext).
          const authorName = (challenge as any).author_name
            || challenge.author_display_name
            || challenge.author_freetext
            || '';

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
                    <StatusBadge statusText={STATUS_LABEL[status]} statusColor={statusColor} />
                  </div>

                  <div className="app-list-item__row">
                    <div className="app-list-item__main">
                      <div
                        className="app-icon-circle app-icon-circle--lg"
                        style={{ backgroundColor: statusColor }}
                      >
                        <IonIcon icon={flag} />
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
                          {TYPE_LABEL[challenge.challenge_type] || 'Frei'}
                          {authorName ? ` · Gestellt von ${authorName}` : ''}
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
                          {challenge.jahrgaenge && challenge.jahrgaenge.length > 0 && (
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={peopleOutline} className="app-icon-color--jahrgang" />
                              {challenge.jahrgaenge.map((j) => j.name).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </IonItem>

              <IonItemOptions side="end" className="app-swipe-actions">
                <IonItemOption
                  onClick={() => onEditChallenge(challenge)}
                  className="app-swipe-action"
                >
                  <div className="app-icon-circle app-icon-circle--lg app-icon-circle--challenges">
                    <IonIcon icon={createOutline} />
                  </div>
                </IonItemOption>
                <IonItemOption
                  onClick={() => onDeleteChallenge(challenge)}
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
    </>
  );
};

export default ChallengesManageView;
export { STATUS_LABEL, STATUS_COLOR, VISIBILITY_LABEL, TYPE_LABEL };
