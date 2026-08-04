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
  albumsOutline
} from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import { EmptyState } from '../../shared';
import { triggerPullHaptic } from '../../../utils/haptics';
import type { AdminChallenge, ChallengeSubmission } from '../../../types/challenges';

// Medienvorschau fuer Challenge-Bilder. Bewusst eine eigene, schlanke Variante
// statt des Chat-LazyImage: der mediaCache-Service ist fest auf /chat/files/
// verdrahtet, Challenges liegen unter /challenges/files/. Geladen wird per
// axios (Auth-Header) in eine Object-URL, freigegeben beim Unmount.
const ChallengeImage: React.FC<{ filePath: string; fileName?: string }> = ({ filePath, fileName }) => {
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
        Bild konnte nicht geladen werden
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: '8px',
        borderRadius: '10px',
        overflow: 'hidden',
        background: src ? 'transparent' : '#f0f0f0',
        minHeight: src ? undefined : '120px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {src ? (
        <img
          src={src}
          alt={fileName || 'Beitrag'}
          style={{ width: '100%', maxHeight: '260px', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span style={{ color: '#666', fontSize: '0.85rem' }}>Bild wird geladen...</span>
      )}
    </div>
  );
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

const CONSENT_CHIP: Record<string, { label: string; color: string }> = {
  publish: { label: 'Veröffentlichung ok', color: '#059669' },
  private: { label: 'Nur Leitung', color: '#6b7280' },
  anonymous: { label: 'Anonym ok', color: '#7c3aed' }
};

const STATUS_CHIP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Wartet auf Freigabe', color: '#ff9500' },
  approved: { label: 'Freigegeben', color: '#059669' },
  hidden: { label: 'Ausgeblendet', color: '#dc3545' }
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
        <div
          className="app-header-banner"
          style={{
            background: 'linear-gradient(135deg, #be185d 0%, #831843 100%)',
            boxShadow: '0 8px 32px rgba(190, 24, 93, 0.25)'
          }}
        >
          <div className="app-header-banner__circle-top" />
          <div className="app-header-banner__circle-bottom" />
          <div className="app-header-banner__header">
            <div className="app-header-banner__icon">
              <IonIcon icon={flag} />
            </div>
            <div>
              <h2 className="app-header-banner__title">{challenge.title}</h2>
              <p className="app-header-banner__subtitle">
                {challenge.moderated ? 'Beiträge brauchen eine Freigabe' : 'Beiträge erscheinen sofort'}
              </p>
            </div>
          </div>
          <div className="app-stats-row">
            <div className="app-stats-row__item">
              <div className="app-stats-row__value">{counts.total}</div>
              <div className="app-stats-row__label">Gesamt</div>
            </div>
            <div className="app-stats-row__item">
              <div className="app-stats-row__value">{counts.pending}</div>
              <div className="app-stats-row__label">Offen</div>
            </div>
            <div className="app-stats-row__item">
              <div className="app-stats-row__value">{counts.approved}</div>
              <div className="app-stats-row__label">Freigegeben</div>
            </div>
            <div className="app-stats-row__item">
              <div className="app-stats-row__value">{counts.hidden}</div>
              <div className="app-stats-row__label">Ausgeblendet</div>
            </div>
          </div>
        </div>

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
                      const status = STATUS_CHIP[submission.moderation_status] || STATUS_CHIP.pending;
                      const consent = submission.konfi_consent ? CONSENT_CHIP[submission.konfi_consent] : null;
                      const isBusy = busyId === submission.id;

                      return (
                        <div
                          key={submission.id}
                          className="app-list-item app-list-item--challenges"
                          style={{
                            borderLeftColor: status.color,
                            marginBottom: '0',
                            display: 'block',
                            opacity: submission.moderation_status === 'hidden' ? 0.75 : 1
                          }}
                        >
                          {/* Kopfzeile: Konfi + Zeit */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
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

                          {/* Chips: Status + Consent */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                            <span
                              style={{
                                fontSize: '0.7rem', fontWeight: 700, color: 'white',
                                background: status.color, borderRadius: '999px', padding: '3px 10px'
                              }}
                            >
                              {status.label}
                            </span>
                            {consent && (
                              <span
                                style={{
                                  fontSize: '0.7rem', fontWeight: 700, color: 'white',
                                  background: consent.color, borderRadius: '999px', padding: '3px 10px'
                                }}
                              >
                                {consent.label}
                              </span>
                            )}
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

                          {submission.media_type === 'photo' && submission.file_path && (
                            <ChallengeImage filePath={submission.file_path} fileName={submission.file_name ?? undefined} />
                          )}

                          {(submission.media_type === 'audio' || submission.media_type === 'video') && submission.file_path && (
                            <div
                              className="app-info-box app-info-box--neutral"
                              style={{ borderRadius: '10px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                              <IonIcon icon={MEDIA_ICON[submission.media_type]} style={{ fontSize: '1.1rem' }} />
                              <span>{submission.file_name || 'Mediendatei'}</span>
                            </div>
                          )}

                          {/* Aktionen */}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                            {submission.moderation_status === 'pending' && (
                              <IonButton
                                size="small"
                                disabled={isBusy}
                                onClick={() => moderate(submission, 'approve')}
                                style={{ '--background': '#059669', '--color': 'white', '--border-radius': '8px' }}
                              >
                                <IonIcon icon={checkmarkCircleOutline} slot="start" />
                                Freigeben
                              </IonButton>
                            )}
                            {submission.moderation_status !== 'hidden' ? (
                              <IonButton
                                size="small"
                                fill="outline"
                                color="danger"
                                disabled={isBusy}
                                onClick={() => confirmHide(submission)}
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
                                style={{ '--color': 'var(--app-color-challenges)', '--border-color': 'var(--app-color-challenges)' }}
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
