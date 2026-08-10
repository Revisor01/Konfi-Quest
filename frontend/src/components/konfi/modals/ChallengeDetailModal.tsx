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
  IonSpinner
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
  addOutline,
  openOutline,
  checkmarkOutline,
  eyeOffOutline,
  lockClosedOutline,
  removeCircleOutline,
  informationCircleOutline
} from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import { EmptyState, AudioPlayer } from '../../shared';
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
// und die eigenen Beitraege mit Status.

const MEDIA_ICON: Record<ChallengeMediaType, string> = {
  text: documentTextOutline,
  photo: imageOutline,
  audio: micOutline,
  video: videocamOutline,
  link: linkOutline
};

/**
 * Status als Icon-Corner-Badge fuer eigene Beitraege (Muster wie das
 * Warteliste-Badge bei Events: kompaktes, farbiges Icon-only-Badge statt
 * Text). Ausgeblendet schlaegt alles; danach entscheidet die Sichtbarkeit
 * der Challenge bzw. die eigene Einwilligung. Label dient nur als Titel
 * (Tooltip/Barrierefreiheit), nicht als sichtbarer Text.
 */
const getOwnStatus = (
  submission: ChallengeSubmission,
  challenge: KonfiChallenge
): { label: string; icon: string; color: string } => {
  if (submission.moderation_status === 'hidden') {
    return { label: 'Ausgeblendet', icon: removeCircleOutline, color: 'var(--app-color-danger)' };
  }
  if (submission.moderation_status === 'pending') {
    return { label: 'Wartet auf Freigabe', icon: timeOutline, color: 'var(--app-color-warning)' };
  }
  // approved
  if (challenge.visibility === 'private') {
    return { label: 'Nur Leitung', icon: lockClosedOutline, color: '#6b7280' };
  }
  if (challenge.visibility === 'public') {
    return { label: 'Veröffentlicht', icon: checkmarkOutline, color: 'var(--app-color-success)' };
  }
  // konfi_choice -> eigene Entscheidung entscheidet
  if (submission.konfi_consent === 'anonymous') {
    return { label: 'Anonym', icon: eyeOffOutline, color: '#7c3aed' };

  }
  if (submission.konfi_consent === 'publish') {
    return { label: 'Veröffentlicht', icon: checkmarkOutline, color: 'var(--app-color-success)' };
  }
  return { label: 'Nur Leitung', icon: lockClosedOutline, color: '#6b7280' };
};

const formatDateTime = (value?: string): string => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
};

// Rollen-Kennzeichnung in der Galerie: Beitraege von Pastor:innen/Teamer:innen
// sollen als solche erkennbar sein, ohne sie hervorzuheben (gleichgewichtet).
const GALLERY_ROLE_LABEL: Record<string, string> = {
  org_admin: 'Leitung',
  admin: 'Leitung',
  teamer: 'Teamer:in'
};

// "Name · Teamer:in" bzw. "Name · Jahrgang 2026". Der Jahrgang hilft, wenn eine
// Challenge mehrere Jahrgaenge umfasst (User-Entscheid 08.08.). Anonyme
// Beitraege liefert das Backend ohne Name/Rolle/Jahrgang -> nur "Anonym".
const buildGalleryAuthorLabel = (submission: ChallengeSubmission): string => {
  const name = submission.konfi_name?.trim();
  if (!name) return 'Anonym';
  const roleLabel = submission.role_name ? GALLERY_ROLE_LABEL[submission.role_name] : null;
  const suffix = roleLabel || submission.jahrgang_name?.trim();
  return suffix ? `${name} · ${suffix}` : name;
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
    return <AudioPlayer src={src} />;
  }

  return null;
};

/** Eine Beitragskarte — in der Galerie ohne, bei eigenen Beitraegen mit Status. */
const SubmissionCard: React.FC<{
  submission: ChallengeSubmission;
  authorLabel: string;
  statusBadge?: { label: string; icon: string; color: string };
}> = ({ submission, authorLabel, statusBadge }) => (
  <div
    className="app-list-item app-list-item--challenges"
    style={{ position: 'relative', overflow: 'hidden', width: '100%' }}
  >
    {statusBadge && (
      <div className="app-corner-badges">
        <div
          className="app-corner-badge"
          style={{ backgroundColor: statusBadge.color, padding: '4px 6px' }}
          title={statusBadge.label}
        >
          <IonIcon icon={statusBadge.icon} style={{ color: '#fff', fontSize: '0.85rem', display: 'block' }} />
        </div>
      </div>
    )}
    <div className="app-list-item__row">
      <div className="app-list-item__main" style={{ alignItems: 'flex-start', width: '100%' }}>
        <div className="app-icon-circle app-icon-circle--challenges" style={{ flexShrink: 0 }}>
          <IonIcon icon={MEDIA_ICON[submission.media_type] || documentTextOutline} />
        </div>
        <div className="app-list-item__content" style={{ minWidth: 0, flex: 1, paddingRight: statusBadge ? '34px' : 0 }}>
          <span className="app-list-item__title" style={{ margin: 0, display: 'block' }}>{authorLabel}</span>
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
  /** Wird gerufen, wenn sich etwas geaendert hat. */
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
  const { setError } = useApp();
  const [detail, setDetail] = useState<KonfiChallengeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(async () => {
    try {
      const res = await api.get(`/challenges/konfi/${challenge.id}`);
      // Backend liefert { challenge, gallery, own_submissions } — Challenge-Felder
      // muessen auf die oberste Ebene, sonst ist starts_at/ends_at undefined und
      // die Challenge erscheint faelschlich als beendet.
      const data = res.data;
      // Die Galerie-Query liefert den Namen als display_name (bei anonymen
      // Beitraegen NULL), das UI liest konfi_name -> hier normalisieren, sonst
      // erscheint JEDER Galerie-Beitrag als "Anonym".
      const gallery = (data?.gallery || []).map((row: any) => ({
        ...row,
        konfi_name: row.konfi_name ?? row.display_name ?? null
      }));
      setDetail(
        data?.challenge
          ? { ...data.challenge, gallery, own_submissions: data.own_submissions || [] }
          : null
      );
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

  // Beendete Challenge ohne eigene Beitraege: der Abschnitt "Deine Beitraege"
  // faellt komplett weg, direkt die Gruppen-Galerie folgt auf die Beschreibung.
  const showOwnSection = isActive || ownSubmissions.length > 0;

  // Sichtbarkeits-/Moderationshinweis als Standard-Infokasten-Text (Muster:
  // ChangeEmailModal "Hinweis"-Box). Je nach Sichtbarkeitsmodus und Moderation
  // ein kurzer, konkreter Satz.
  // Kurzform der Sichtbarkeit fuer den Kopf: EIN knapper Halbsatz neben der
  // Laufzeit, damit beim Mitmachen sofort klar ist, wer den Beitrag zu sehen
  // bekommt (User-Hinweis 10.08.). Der ausfuehrliche Satz steht weiterhin
  // unten im Hinweis-Kasten.
  // Rollenneutral formulieren: Dieses Modal gehoert seit der Zusammenlegung
  // (11.08.) allein den Konfis — Teamer und Leitung nutzen
  // ChallengeLeitungModal. Der Text bleibt trotzdem neutral, weil hier frueher
  // faelschlich "Nur für euch in der Leitung" stand (Audit 10.08.).
  const visibilityShort = useMemo(() => {
    if (current.visibility === 'private') return 'Nur das Leitungsteam sieht die Beiträge';
    if (current.visibility === 'public') return 'Für die Gruppe sichtbar';
    return 'Du entscheidest je Beitrag';
  }, [current.visibility]);

  const visibilityHint = useMemo(() => {
    if (current.visibility === 'private') {
      return 'Beiträge sieht nur das Leitungsteam.';
    }
    if (current.visibility === 'public') {
      return current.moderated
        ? 'Beiträge werden nach Freigabe für die Gruppe veröffentlicht.'
        : 'Beiträge sind für deine Gruppe sichtbar.';
    }
    // konfi_choice
    return current.moderated
      ? 'Du wählst beim Einreichen, wer deinen Beitrag sieht. Veröffentlichung erst nach Freigabe.'
      : 'Du wählst beim Einreichen, wer deinen Beitrag sieht.';
  }, [current.visibility, current.moderated]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Challenge</IonTitle>
          <IonButtons slot="start">
            <IonButton className="app-modal-close-btn" onClick={onClose} aria-label="Schließen">
              <IonIcon icon={close} />
            </IonButton>
          </IonButtons>
          {canSubmitMore && onSubmit && (
            <IonButtons slot="end">
              <IonButton onClick={() => onSubmit(current)} title="Beitrag einreichen" aria-label="Beitrag einreichen">
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
              {/* Laufzeit UND Sichtbarkeit in einer Zeile: "noch 3 Tage · Nur
                  für euch in der Leitung". Bei beendeten Challenges faellt die
                  Laufzeit weg (sie steht dezent in der Meta-Zeile unten), die
                  Sichtbarkeit bleibt — wer die Beitraege sieht, gilt weiter. */}
              <p className="app-header-banner__subtitle">
                {isActive ? `${formatRemaining(current.ends_at)} · ${visibilityShort}` : visibilityShort}
              </p>
            </div>
          </div>
        </div>

        {/* Beschreibung */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--challenges">
              <IonIcon icon={documentTextOutline} />
            </div>
            {/* Bei beendeten Challenges in der Vergangenheit formulieren. */}
            <IonLabel>{isActive ? 'Worum geht es?' : 'Worum ging es?'}</IonLabel>
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
                  {isActive ? formatRemaining(current.ends_at) : 'Beendet'}
                </span>
                {/* Urheber deutlich sichtbar in derselben unauffaelligen Meta-Zeile. */}
                {author && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <IonIcon icon={personOutline} className="app-icon-color--challenges" />
                    Gestellt von {author}
                  </span>
                )}
              </div>
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Sichtbarkeits-/Moderationshinweis — Standard-Infokasten-Pattern
            (siehe ActivityRequestModal, graue Hinweis-Box), nur solange die
            Challenge noch laeuft: bei beendeten Challenges ist die Zusage,
            wer den Beitrag sieht, ohnehin nicht mehr aenderbar/relevant. */}
        {isActive && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--challenges">
                <IonIcon icon={informationCircleOutline} />
              </div>
              <IonLabel>Hinweis</IonLabel>
            </IonListHeader>
            <IonCard className="app-card app-info-box--challenges">
              <IonCardContent className="app-info-box">
                <p style={{ margin: 0 }}>
                  {visibilityHint}
                </p>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <>
            {/* Eigene Beitraege — bei beendeter Challenge ohne eigene Beitraege
                komplett ausgeblendet, dann folgt direkt die Gruppen-Galerie. */}
            {showOwnSection && (
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
                        message="Tippe oben auf das Plus, um etwas einzureichen."
                        iconColor="var(--app-color-challenges)"
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {ownSubmissions.map((submission) => (
                          <SubmissionCard
                            key={submission.id}
                            submission={submission}
                            authorLabel="Dein Beitrag"
                            statusBadge={getOwnStatus(submission, current)}
                          />
                        ))}
                      </div>
                    )}
                  </IonCardContent>
                </IonCard>
              </IonList>
            )}

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
                        title="Noch keine geteilten Beiträge"
                        message={isActive
                          ? 'Sobald jemand aus deiner Gruppe etwas veröffentlicht, findest du es hier. Vielleicht machst du ja den Anfang.'
                          : 'Aus dieser Challenge hat niemand aus deiner Gruppe etwas veröffentlicht.'}
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
                            // Sonst Name + Herkunft: Team-Beitraege als solche
                            // erkennbar, bei mehreren Jahrgaengen der Jahrgang
                            // (User-Entscheid 08.08.).
                            authorLabel={buildGalleryAuthorLabel(submission)}
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
              <IonButton aria-label="Schließen" className="app-modal-close-btn" onClick={onClose}>
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
