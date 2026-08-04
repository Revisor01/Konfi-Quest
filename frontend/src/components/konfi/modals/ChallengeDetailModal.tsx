import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonList,
  IonListHeader,
  IonLabel,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  useIonAlert
} from '@ionic/react';
import {
  close,
  timeOutline,
  personOutline,
  documentTextOutline,
  imageOutline,
  micOutline,
  videocamOutline,
  linkOutline,
  peopleOutline,
  trashOutline,
  addOutline,
  openOutline,
  ribbonOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import { EmptyState } from '../../shared';
import { triggerPullHaptic } from '../../../utils/haptics';
import { getChallengeBadgeIcon, getAuthorLabel, formatRemaining } from '../views/ChallengesView';
import type {
  KonfiChallenge,
  KonfiChallengeDetail,
  ChallengeSubmission,
  ChallengeMediaType
} from '../../../types/challenges';

// Detailansicht einer Challenge fuer Konfis: Beschreibung, oeffentliche Galerie
// (anonyme Beitraege OHNE Namen — das Backend liefert dort gar keinen Namen mit)
// und die eigenen Beitraege mit Status. Beitraege koennen jederzeit
// zurueckgezogen werden.

const MEDIA_ICON: Record<ChallengeMediaType, string> = {
  text: documentTextOutline,
  photo: imageOutline,
  audio: micOutline,
  video: videocamOutline,
  link: linkOutline
};

/**
 * Status-Chip fuer eigene Beitraege. Ausgeblendet schlaegt alles; danach
 * entscheidet die Sichtbarkeit der Challenge bzw. die eigene Einwilligung.
 */
const getOwnStatus = (
  submission: ChallengeSubmission,
  challenge: KonfiChallenge
): { label: string; color: string } => {
  if (submission.moderation_status === 'hidden') {
    return { label: 'Ausgeblendet', color: '#dc3545' };
  }
  if (submission.moderation_status === 'pending') {
    return { label: 'Wartet auf Freigabe', color: '#ff9500' };
  }
  // approved
  if (challenge.visibility === 'private') {
    return { label: 'Nur für die Leitung sichtbar', color: '#6b7280' };
  }
  if (challenge.visibility === 'public') {
    return { label: 'Veröffentlicht', color: '#059669' };
  }
  // konfi_choice -> eigene Entscheidung entscheidet
  if (submission.konfi_consent === 'anonymous') {
    return { label: 'Anonym veröffentlicht', color: '#7c3aed' };
  }
  if (submission.konfi_consent === 'publish') {
    return { label: 'Veröffentlicht', color: '#059669' };
  }
  return { label: 'Nur für die Leitung sichtbar', color: '#6b7280' };
};

const formatDateTime = (value?: string): string => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
};

// Medienvorschau fuer Challenge-Dateien. Eigene, schlanke Ladefunktion statt des
// Chat-LazyImage: der mediaCache-Service ist fest auf /chat/files/ verdrahtet,
// Challenges liegen unter /challenges/files/. Der Abruf laeuft ueber axios (also
// mit Auth-Header, kein ?token= noetig), die Object-URL wird beim Unmount wieder
// freigegeben.
const ChallengeMedia: React.FC<{
  filePath: string;
  fileName?: string | null;
  mediaType: ChallengeMediaType;
}> = ({ filePath, fileName, mediaType }) => {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    (async () => {
      try {
        const res = await api.get(`/challenges/files/${filePath}`, { responseType: 'blob' });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data as Blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [filePath]);

  if (failed) {
    return (
      <div style={{ marginTop: '8px', color: '#999', fontSize: '0.82rem' }}>
        Datei konnte nicht geladen werden
      </div>
    );
  }

  if (!src) {
    return (
      <div
        style={{
          marginTop: '8px', minHeight: '80px', borderRadius: '10px', background: '#f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#666', fontSize: '0.85rem', gap: '8px'
        }}
      >
        <IonSpinner name="dots" /> wird geladen...
      </div>
    );
  }

  if (mediaType === 'photo') {
    return (
      <div style={{ marginTop: '8px', borderRadius: '10px', overflow: 'hidden' }}>
        <img
          src={src}
          alt={fileName || 'Beitrag'}
          style={{ width: '100%', maxHeight: '320px', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <video
        src={src}
        controls
        playsInline
        style={{ width: '100%', maxHeight: '320px', marginTop: '8px', borderRadius: '10px', display: 'block' }}
      />
    );
  }

  if (mediaType === 'audio') {
    return (
      <audio src={src} controls style={{ width: '100%', marginTop: '8px' }} />
    );
  }

  return null;
};

/** Eine Beitragskarte — in der Galerie ohne, bei eigenen Beitraegen mit Status. */
const SubmissionCard: React.FC<{
  submission: ChallengeSubmission;
  authorLabel: string;
  statusChip?: { label: string; color: string };
  onDelete?: () => void;
}> = ({ submission, authorLabel, statusChip, onDelete }) => (
  <div
    className="app-list-item app-list-item--challenges"
    style={{ position: 'relative' }}
  >
    <div className="app-list-item__row">
      <div className="app-list-item__main" style={{ alignItems: 'flex-start' }}>
        <div className="app-icon-circle app-icon-circle--challenges" style={{ flexShrink: 0 }}>
          <IonIcon icon={MEDIA_ICON[submission.media_type] || documentTextOutline} />
        </div>
        <div className="app-list-item__content" style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              flexWrap: 'wrap', marginBottom: '2px'
            }}
          >
            <span className="app-list-item__title" style={{ margin: 0 }}>{authorLabel}</span>
            {statusChip && (
              <span
                style={{
                  fontSize: '0.68rem', fontWeight: 700, color: 'white',
                  background: statusChip.color, padding: '2px 8px', borderRadius: '8px',
                  whiteSpace: 'nowrap'
                }}
              >
                {statusChip.label}
              </span>
            )}
          </div>
          <div className="app-list-item__subtitle" style={{ marginBottom: '4px' }}>
            {formatDateTime(submission.created_at)}
          </div>

          {submission.text_content && (
            <div
              style={{
                fontSize: '0.9rem', color: '#3c3c43', lineHeight: 1.45,
                whiteSpace: 'pre-wrap', marginTop: '4px'
              }}
            >
              {submission.text_content}
            </div>
          )}

          {submission.media_type === 'link' && submission.link_url && (
            <a
              href={submission.link_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '6px',
                fontSize: '0.86rem', color: 'var(--app-color-challenges)',
                fontWeight: 600, wordBreak: 'break-all'
              }}
            >
              <IonIcon icon={openOutline} style={{ flexShrink: 0 }} />
              {submission.link_url}
            </a>
          )}

          {submission.file_path && submission.media_type !== 'link' && submission.media_type !== 'text' && (
            <ChallengeMedia
              filePath={submission.file_path}
              fileName={submission.file_name}
              mediaType={submission.media_type}
            />
          )}

          {onDelete && (
            <div style={{ marginTop: '8px' }}>
              <IonButton
                fill="clear"
                color="danger"
                size="small"
                style={{ margin: 0, '--padding-start': '4px', '--padding-end': '8px' }}
                onClick={onDelete}
              >
                <IonIcon icon={trashOutline} slot="start" />
                Zurückziehen
              </IonButton>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

interface ChallengeDetailModalProps {
  // Kann im ersten Render-Frame null sein — siehe Hinweis im Einreich-Modal
  // (useIonModal reicht die Props des present()-Renders durch).
  challenge: KonfiChallenge | null;
  onClose: () => void;
  /** Oeffnet das Einreich-Modal (wird von der Seite gesteuert). */
  onSubmit?: (challenge: KonfiChallenge) => void;
  /** Wird gerufen, wenn sich etwas geaendert hat (Beitrag geloescht). */
  onChanged?: () => void;
}

interface ChallengeDetailContentProps {
  challenge: KonfiChallenge;
  onClose: () => void;
  onSubmit?: (challenge: KonfiChallenge) => void;
  onChanged?: () => void;
}

const ChallengeDetailContent: React.FC<ChallengeDetailContentProps> = ({
  challenge,
  onClose,
  onSubmit,
  onChanged
}) => {
  const { setError, setSuccess, isOnline } = useApp();
  const [presentAlert] = useIonAlert();
  const [detail, setDetail] = useState<KonfiChallengeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(async () => {
    try {
      const res = await api.get(`/challenges/konfi/${challenge.id}`);
      setDetail(res.data || null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Laden der Challenge');
    } finally {
      setLoading(false);
    }
  }, [challenge.id, setError]);

  useEffect(() => {
    setLoading(true);
    loadDetail();
  }, [loadDetail]);

  // Basis fuer Kopf/Status: das Detail (frisch) hat Vorrang vor der Listenkarte.
  const current: KonfiChallenge = detail || challenge;
  const author = getAuthorLabel(current);
  const isActive = useMemo(() => {
    const start = new Date(current.starts_at).getTime();
    const end = new Date(current.ends_at).getTime();
    const now = Date.now();
    return !current.is_draft && now >= start && now <= end;
  }, [current]);

  const gallery = detail?.gallery || [];
  const ownSubmissions = detail?.own_submissions || [];

  const canSubmitMore = isActive && (current.allow_multiple || ownSubmissions.length === 0);

  const handleDelete = (submission: ChallengeSubmission) => {
    if (!isOnline) {
      setError('Zurückziehen nicht möglich — du bist offline');
      return;
    }
    presentAlert({
      header: 'Beitrag zurückziehen',
      message: 'Dein Beitrag wird gelöscht. Das lässt sich nicht rückgängig machen.',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Zurückziehen',
          role: 'destructive',
          handler: () => {
            (async () => {
              try {
                await api.delete(`/challenges/konfi/submissions/${submission.id}`);
                setSuccess('Dein Beitrag wurde zurückgezogen');
                await loadDetail();
                onChanged?.();
              } catch (err: any) {
                setError(err.response?.data?.error || 'Fehler beim Zurückziehen');
              }
            })();
          }
        }
      ]
    });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Challenge</IonTitle>
          <IonButtons slot="start">
            <IonButton className="app-modal-close-btn" onClick={onClose}>
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
          {canSubmitMore && onSubmit && (
            <IonButtons slot="end">
              <IonButton onClick={() => onSubmit(current)} title="Beitrag einreichen">
                <IonIcon icon={addOutline} slot="icon-only" />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        <IonRefresher
          slot="fixed"
          onIonRefresh={async (e) => { await loadDetail(); e.detail.complete(); }}
          onIonPull={triggerPullHaptic}
        >
          <IonRefresherContent />
        </IonRefresher>

        {/* Kopf */}
        <div className="app-header-banner app-header-banner--challenges">
          <div className="app-header-banner__circle-top" />
          <div className="app-header-banner__circle-bottom" />
          <div className="app-header-banner__header">
            <div className="app-header-banner__icon">
              <IonIcon icon={getChallengeBadgeIcon(current.badge_icon)} />
            </div>
            <div>
              <h2 className="app-header-banner__title">{current.title}</h2>
              <p className="app-header-banner__subtitle">
                {isActive ? formatRemaining(current.ends_at) : 'Diese Challenge ist vorbei'}
              </p>
            </div>
          </div>
          {author && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                marginTop: '10px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.9)',
                position: 'relative', zIndex: 1
              }}
            >
              <IonIcon icon={personOutline} />
              Gestellt von {author}
            </div>
          )}
        </div>

        {/* Beschreibung */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--challenges">
              <IonIcon icon={documentTextOutline} />
            </div>
            <IonLabel>Worum geht es?</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: '14px' }}>
              <div style={{ fontSize: '0.93rem', lineHeight: 1.5, color: '#3c3c43', whiteSpace: 'pre-wrap' }}>
                {current.description}
              </div>
              <div
                style={{
                  display: 'flex', flexWrap: 'wrap', gap: '8px 14px',
                  marginTop: '12px', fontSize: '0.8rem', color: '#8e8e93'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <IonIcon icon={timeOutline} className="app-icon-color--challenges" />
                  {isActive ? formatRemaining(current.ends_at) : 'beendet'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <IonIcon icon={ribbonOutline} className="app-icon-color--challenges" />
                  Abzeichen: {current.badge_name}
                </span>
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <>
            {/* Eigene Beitraege */}
            <IonList inset={true} className="app-segment-wrapper">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--challenges">
                  <IonIcon icon={personOutline} />
                </div>
                <IonLabel>Deine Beiträge</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent style={{ padding: ownSubmissions.length === 0 ? '16px' : '12px' }}>
                  {ownSubmissions.length === 0 ? (
                    <EmptyState
                      icon={documentTextOutline}
                      title="Noch kein Beitrag von dir"
                      message={isActive
                        ? 'Tippe oben auf das Plus, um etwas einzureichen.'
                        : 'Bei dieser Challenge hast du nichts eingereicht.'}
                      iconColor="var(--app-color-challenges)"
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {ownSubmissions.map((submission) => (
                        <SubmissionCard
                          key={submission.id}
                          submission={submission}
                          authorLabel="Dein Beitrag"
                          statusChip={getOwnStatus(submission, current)}
                          onDelete={() => handleDelete(submission)}
                        />
                      ))}
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
            </IonList>

            {/* Galerie — nur wenn die Challenge ueberhaupt oeffentlich sein kann */}
            {current.visibility !== 'private' && (
              <IonList inset={true} className="app-segment-wrapper">
                <IonListHeader>
                  <div className="app-section-icon app-section-icon--challenges">
                    <IonIcon icon={peopleOutline} />
                  </div>
                  <IonLabel>Aus deiner Gruppe</IonLabel>
                </IonListHeader>
                <IonCard className="app-card">
                  <IonCardContent style={{ padding: gallery.length === 0 ? '16px' : '12px' }}>
                    {gallery.length === 0 ? (
                      <EmptyState
                        icon={peopleOutline}
                        title="Noch nichts zu sehen"
                        message="Sobald jemand aus deiner Gruppe etwas veröffentlicht, findest du es hier."
                        iconColor="var(--app-color-challenges)"
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {gallery.map((submission) => (
                          <SubmissionCard
                            key={submission.id}
                            submission={submission}
                            // Anonyme Beitraege liefert das Backend ohne Namen —
                            // fehlt der Name, wird bewusst "Anonym" gezeigt.
                            authorLabel={submission.konfi_name?.trim() || 'Anonym'}
                          />
                        ))}
                      </div>
                    )}
                  </IonCardContent>
                </IonCard>
              </IonList>
            )}
          </>
        )}

        {/* Einreichen-Button, solange die Challenge laeuft */}
        {canSubmitMore && onSubmit && (
          <div style={{ padding: '0 16px 24px 16px' }}>
            <IonButton
              expand="block"
              style={{
                '--background': 'var(--app-color-challenges)',
                '--background-activated': '#9d174d',
                '--border-radius': '12px'
              }}
              onClick={() => onSubmit(current)}
            >
              <IonIcon icon={addOutline} slot="start" />
              {ownSubmissions.length > 0 ? 'Noch etwas einreichen' : 'Mitmachen'}
            </IonButton>
          </div>
        )}

      </IonContent>
    </IonPage>
  );
};

/** Huelle: wartet auf die durchgereichte Challenge und remountet pro Challenge. */
const ChallengeDetailModal: React.FC<ChallengeDetailModalProps> = ({
  challenge,
  onClose,
  onSubmit,
  onChanged
}) => {
  if (!challenge) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Challenge</IonTitle>
            <IonButtons slot="start">
              <IonButton className="app-modal-close-btn" onClick={onClose}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="app-gradient-background">
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <ChallengeDetailContent
      key={challenge.id}
      challenge={challenge}
      onClose={onClose}
      onSubmit={onSubmit}
      onChanged={onChanged}
    />
  );
};

export default ChallengeDetailModal;
