import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonPage,
  IonButtons,
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
  useIonAlert
} from '@ionic/react';
import {
  closeOutline,
  flag,
  shareOutline,
  checkmarkCircleOutline,
  eyeOffOutline,
  eyeOutline,
  documentTextOutline,
  linkOutline,
  imageOutline,
  micOutline,
  videocamOutline,
  albumsOutline,
  timeOutline,
  checkmarkOutline,
  lockClosedOutline,
  removeCircleOutline
} from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import { EmptyState, SectionHeader, AudioPlayer } from '../../shared';
import { triggerPullHaptic } from '../../../utils/haptics';
import type { AdminChallenge, ChallengeSubmission } from '../../../types/challenges';

// Medienvorschau fuer Challenge-Beitraege (Foto/Audio/Video). Bewusst eine
// eigene, schlanke Variante statt des Chat-LazyImage: der mediaCache-Service
// ist fest auf /chat/files/ verdrahtet, Challenges liegen unter
// /challenges/files/. Geladen wird per axios (Auth-Header) in eine
// Object-URL, freigegeben beim Unmount — identisches Prinzip wie ChallengeMedia
// in ChallengeDetailModal (Konfi-Seite).
const ChallengeMedia: React.FC<{
  filePath: string;
  fileName?: string | null;
  mediaType: 'photo' | 'audio' | 'video';
}> = ({ filePath, fileName, mediaType }) => {
  const [src, setSrc] = useState<string>('');
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
      <div style={{ padding: '12px', color: '#999', fontSize: '0.8rem' }}>
        Datei konnte nicht geladen werden
      </div>
    );
  }

  if (!src) {
    return (
      <div
        style={{
          marginTop: '8px',
          borderRadius: '10px',
          background: '#f0f0f0',
          minHeight: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <span style={{ color: '#666', fontSize: '0.85rem' }}>Wird geladen...</span>
      </div>
    );
  }

  if (mediaType === 'photo') {
    return (
      <div style={{ marginTop: '8px', borderRadius: '10px', overflow: 'hidden' }}>
        <img
          src={src}
          alt={fileName || 'Beitrag'}
          style={{ width: '100%', maxHeight: '260px', objectFit: 'cover', display: 'block' }}
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
        style={{ width: '100%', maxHeight: '260px', marginTop: '8px', borderRadius: '10px', display: 'block' }}
      />
    );
  }

  // audio
  return <AudioPlayer src={src} />;
};

const MEDIA_ICON: Record<string, string> = {
  text: documentTextOutline,
  photo: imageOutline,
  audio: micOutline,
  video: videocamOutline,
  link: linkOutline
};

const MEDIA_LABEL: Record<string, string> = {
  text: 'Text',
  photo: 'Foto',
  audio: 'Audio',
  video: 'Video',
  link: 'Link'
};

// Icon/Farb-Zuordnung fuer Corner-Badges — dieselbe Zuordnung wie getOwnStatus
// in ChallengeDetailModal.tsx (Konfi-Seite), damit Status ueberall gleich
// aussieht. Hier zusaetzlich die reinen Konsens-Werte (unabhaengig vom Status),
// weil die Moderation Konsens UND Status gleichzeitig zeigen soll.
const STATUS_BADGE: Record<string, { label: string; icon: string; color: string }> = {
  pending: { label: 'Wartet auf Freigabe', icon: timeOutline, color: 'var(--app-color-warning)' },
  approved: { label: 'Freigegeben', icon: checkmarkOutline, color: 'var(--app-color-success)' },
  hidden: { label: 'Ausgeblendet', icon: removeCircleOutline, color: 'var(--app-color-danger)' }
};

const CONSENT_BADGE: Record<string, { label: string; icon: string; color: string }> = {
  publish: { label: 'Veröffentlichung ok', icon: checkmarkOutline, color: 'var(--app-color-success)' },
  private: { label: 'Nur Leitung', icon: lockClosedOutline, color: '#6b7280' },
  anonymous: { label: 'Anonym ok', icon: eyeOffOutline, color: '#7c3aed' }
};

const formatDateTime = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
};

interface ChallengeModerationModalProps {
  challenge: AdminChallenge;
  onClose: () => void;
  // Wird nach jeder Moderations-Aktion gerufen, damit die Liste dahinter
  // (Pending-Zaehler) aktuell bleibt.
  onChanged?: () => void;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'hidden';

const ChallengeModerationModal: React.FC<ChallengeModerationModalProps> = ({
  challenge,
  onClose,
  onChanged
}) => {
  const { setError, setSuccess } = useApp();
  const [presentAlert] = useIonAlert();
  const [submissions, setSubmissions] = useState<ChallengeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const loadSubmissions = useCallback(async () => {
    try {
      const res = await api.get(`/challenges/admin/${challenge.id}/submissions`);
      // Backend liefert { challenge, submissions } — die Liste daraus ziehen und
      // den Konfi-Namen aus display_name normalisieren.
      const raw = Array.isArray(res.data) ? res.data : (res.data?.submissions || []);
      setSubmissions(
        raw.map((row: any) => ({
          ...row,
          konfi_name: row.konfi_name ?? row.display_name ?? null
        }))
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler beim Laden der Beiträge');
    } finally {
      setLoading(false);
    }
  }, [challenge.id, setError]);

  useEffect(() => {
    setLoading(true);
    loadSubmissions();
  }, [loadSubmissions]);

  const counts = useMemo(() => ({
    total: submissions.length,
    pending: submissions.filter((s) => s.moderation_status === 'pending').length,
    approved: submissions.filter((s) => s.moderation_status === 'approved').length,
    hidden: submissions.filter((s) => s.moderation_status === 'hidden').length
  }), [submissions]);

  const filtered = useMemo(() => {
    const list = statusFilter === 'all'
      ? [...submissions]
      : submissions.filter((s) => s.moderation_status === statusFilter);
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [submissions, statusFilter]);

  const moderate = async (submission: ChallengeSubmission, action: 'approve' | 'hide' | 'unhide') => {
    setBusyId(submission.id);
    try {
      await api.put(`/challenges/admin/submissions/${submission.id}/moderate`, { action });
      await loadSubmissions();
      onChanged?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Fehler bei der Moderation');
    } finally {
      setBusyId(null);
    }
  };

  const confirmHide = (submission: ChallengeSubmission) => {
    presentAlert({
      header: 'Beitrag ausblenden',
      message: `Der Beitrag von ${submission.konfi_name || 'diesem Konfi'} wird für die Gruppe nicht mehr sichtbar sein. Der Konfi sieht seinen Beitrag weiterhin.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        { text: 'Ausblenden', role: 'destructive', handler: () => { moderate(submission, 'hide'); } }
      ]
    });
  };

  const handleExport = async () => {
    try {
      const res = await api.get(`/challenges/admin/${challenge.id}/export`, { responseType: 'text' });
      const text = typeof res.data === 'string' ? res.data : String(res.data ?? '');
      if (!text.trim()) {
        setError('Es gibt noch keine Texte oder Links zum Exportieren.');
        return;
      }

      const fileName = `challenge-${challenge.id}-beitraege.txt`;

      if (Capacitor.isNativePlatform()) {
        await Filesystem.writeFile({
          path: fileName,
          data: text,
          directory: Directory.Cache,
          encoding: 'utf8' as any
        });
        const uri = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        await Share.share({ title: challenge.title, files: [uri.uri] });
      } else {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setSuccess('Export heruntergeladen');
      }
    } catch (err: any) {
      // Abgebrochenes Share-Sheet ist kein Fehler
      if (err?.message && /cancel/i.test(err.message)) return;
      setError(err.response?.data?.error || 'Export fehlgeschlagen');
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Beiträge</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose} className="app-modal-close-btn">
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton onClick={handleExport} title="Beiträge exportieren">
              <IonIcon icon={shareOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        <IonRefresher
          slot="fixed"
          onIonRefresh={async (e) => { await loadSubmissions(); e.detail.complete(); }}
          onIonPull={triggerPullHaptic}
        >
          <IonRefresherContent />
        </IonRefresher>

        {/* Kopf: Challenge-Info */}
        <SectionHeader
          title={challenge.title}
          subtitle={challenge.moderated ? 'Beiträge brauchen eine Freigabe' : 'Beiträge erscheinen sofort'}
          icon={flag}
          preset="challenges"
          stats={[
            { value: counts.total, label: 'Gesamt' },
            { value: counts.pending, label: 'Offen' },
            { value: counts.approved, label: 'Freigegeben' },
            { value: counts.hidden, label: 'Ausgeblendet' }
          ]}
        />

        <div style={{ margin: '16px 16px 8px 16px' }}>
          <IonSegment value={statusFilter} onIonChange={(e) => setStatusFilter(e.detail.value as StatusFilter)}>
            <IonSegmentButton value="all"><IonLabel>Alle</IonLabel></IonSegmentButton>
            <IonSegmentButton value="pending"><IonLabel>Offen</IonLabel></IonSegmentButton>
            <IonSegmentButton value="approved"><IonLabel>Frei</IonLabel></IonSegmentButton>
            <IonSegmentButton value="hidden"><IonLabel>Versteckt</IonLabel></IonSegmentButton>
          </IonSegment>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <IonList inset={true} style={{ margin: '16px' }}>
            <IonListHeader>
              <div className="app-section-icon app-section-icon--challenges">
                <IonIcon icon={albumsOutline} />
              </div>
              <IonLabel>Beiträge ({filtered.length})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent style={{ padding: filtered.length === 0 ? '16px' : '12px' }}>
                {filtered.length === 0 ? (
                  <EmptyState
                    icon={albumsOutline}
                    title="Keine Beiträge"
                    message="Sobald Konfis etwas einreichen, erscheint es hier."
                    iconColor="#be185d"
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filtered.map((submission) => {
                      const status = STATUS_BADGE[submission.moderation_status] || STATUS_BADGE.pending;
                      const consent = submission.konfi_consent ? CONSENT_BADGE[submission.konfi_consent] : null;
                      const isBusy = busyId === submission.id;

                      return (
                        <div
                          key={submission.id}
                          className="app-list-item app-list-item--challenges"
                          style={{
                            borderLeftColor: status.color,
                            marginBottom: '0',
                            display: 'block',
                            position: 'relative',
                            overflow: 'hidden',
                            opacity: submission.moderation_status === 'hidden' ? 0.75 : 1
                          }}
                        >
                          {/* Corner-Badges: Konsens + Status (max. 2, wie im Konfi-Detail) */}
                          <div className="app-corner-badges">
                            {consent && (
                              <>
                                <div
                                  className="app-corner-badge"
                                  style={{ backgroundColor: consent.color, padding: '4px 6px' }}
                                  title={consent.label}
                                >
                                  <IonIcon icon={consent.icon} style={{ color: '#fff', fontSize: '0.85rem', display: 'block' }} />
                                </div>
                                <div className="app-corner-badges__separator" />
                              </>
                            )}
                            <div
                              className="app-corner-badge"
                              style={{ backgroundColor: status.color, padding: '4px 6px' }}
                              title={status.label}
                            >
                              <IonIcon icon={status.icon} style={{ color: '#fff', fontSize: '0.85rem', display: 'block' }} />
                            </div>
                          </div>

                          {/* Kopfzeile: Konfi + Zeit */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', paddingRight: '60px' }}>
                            <div className="app-icon-circle app-icon-circle--lg" style={{ backgroundColor: status.color }}>
                              <IonIcon icon={MEDIA_ICON[submission.media_type] || documentTextOutline} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="app-list-item__title">
                                {submission.konfi_name || 'Unbekannt'}
                              </div>
                              <div className="app-list-item__subtitle">
                                {MEDIA_LABEL[submission.media_type] || submission.media_type}
                                {submission.jahrgang_name ? ` · ${submission.jahrgang_name}` : ''}
                                {' · '}{formatDateTime(submission.created_at)}
                              </div>
                            </div>
                          </div>

                          {/* Inhalt */}
                          {submission.text_content && (
                            <div style={{ fontSize: '0.9rem', color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                              {submission.text_content}
                            </div>
                          )}

                          {submission.media_type === 'link' && submission.link_url && /^https?:\/\//i.test(submission.link_url) && (
                            <a
                              href={submission.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                marginTop: '6px', fontSize: '0.85rem', color: 'var(--app-color-challenges)',
                                wordBreak: 'break-all'
                              }}
                            >
                              <IonIcon icon={linkOutline} />
                              {submission.link_url}
                            </a>
                          )}

                          {submission.file_path && (submission.media_type === 'photo' || submission.media_type === 'audio' || submission.media_type === 'video') && (
                            <ChallengeMedia
                              filePath={submission.file_path}
                              fileName={submission.file_name}
                              mediaType={submission.media_type}
                            />
                          )}

                          {/* Aktionen — Moderation braucht explizite Buttons (bewusst keine
                              Swipe-Actions), Farben ueber Tokens statt harter Hex-Werte. */}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                            {submission.moderation_status === 'pending' && (
                              <IonButton
                                size="small"
                                disabled={isBusy}
                                onClick={() => moderate(submission, 'approve')}
                                style={{ '--background': 'var(--app-color-success)', '--color': 'white', '--border-radius': '8px', height: '32px' }}
                              >
                                <IonIcon icon={checkmarkCircleOutline} slot="start" />
                                Freigeben
                              </IonButton>
                            )}
                            {submission.moderation_status !== 'hidden' ? (
                              <IonButton
                                size="small"
                                fill="outline"
                                disabled={isBusy}
                                onClick={() => confirmHide(submission)}
                                style={{ '--color': 'var(--app-color-danger)', '--border-color': 'var(--app-color-danger)', '--border-radius': '8px', height: '32px' }}
                              >
                                <IonIcon icon={eyeOffOutline} slot="start" />
                                Ausblenden
                              </IonButton>
                            ) : (
                              <IonButton
                                size="small"
                                fill="outline"
                                disabled={isBusy}
                                onClick={() => moderate(submission, 'unhide')}
                                style={{ '--color': 'var(--app-color-challenges)', '--border-color': 'var(--app-color-challenges)', '--border-radius': '8px', height: '32px' }}
                              >
                                <IonIcon icon={eyeOutline} slot="start" />
                                Wieder einblenden
                              </IonButton>
                            )}
                            {isBusy && <IonSpinner name="crescent" style={{ alignSelf: 'center' }} />}
                          </div>
                        </div>
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
    </IonPage>
  );
};

export default ChallengeModerationModal;
